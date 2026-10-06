import { Injectable, computed, inject, signal } from '@angular/core';
import { SYNC_CONFIG } from './models/sync-config';
import {
  SyncChange,
  SyncCollectionHandler,
  SyncEnvelope,
  SyncHttpError,
  SyncStatus,
} from './models/sync.model';
import { SYNC_PROVIDER } from './providers/sync-provider';
import { SyncOutboxService } from './sync-outbox.service';
import { SyncSessionStore } from './sync-session.store';

const ENABLED_KEY = 'flamenco_sync_enabled';
const CURSOR_PREFIX = 'flamenco_sync_cursor_';

/**
 * Orquestador de la sincronización en la nube.
 *
 * - Con la sincronización desactivada, la app funciona solo en local.
 * - El proveedor activo se inyecta vía `SYNC_PROVIDER` (`HttpSyncProvider`).
 * - Cada colección de la app se registra mediante un `SyncCollectionHandler`.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly config = inject(SYNC_CONFIG);
  private readonly provider = inject(SYNC_PROVIDER);
  private readonly outbox = inject(SyncOutboxService);
  private readonly sessions = inject(SyncSessionStore);
  private readonly handlers = new Map<string, SyncCollectionHandler>();

  private readonly _status = signal<SyncStatus>('disabled');
  private readonly _lastSyncAt = signal<string | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _pending = signal<number>(this.outbox.size);
  private readonly _busy = signal(false);
  private pushTimer: ReturnType<typeof setTimeout> | null = null;

  readonly session = this.sessions.session;
  readonly status = this._status.asReadonly();
  readonly lastSyncAt = this._lastSyncAt.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pending = this._pending.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly enabled = computed(() => this._status() !== 'disabled');
  readonly appId = this.config.appId;

  constructor() {
    this.restore();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => void this.syncNow());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.syncNow();
      });
    }
  }

  /** Registra el adaptador de una colección de la aplicación. */
  registerHandler(handler: SyncCollectionHandler): void {
    this.handlers.set(handler.collection, handler);
  }

  /** Activa o desactiva la sincronización en la nube. */
  setEnabled(enabled: boolean): void {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
    if (!enabled) {
      this._status.set('disabled');
      this._error.set(null);
      return;
    }
    this._status.set(this.sessions.get() ? 'idle' : 'signedOut');
    if (this.sessions.get()) {
      this.prepareInitialUpload();
      void this.syncNow();
    }
  }

  /** Crea una cuenta nueva y sincroniza. */
  async signUp(username: string, password: string): Promise<void> {
    await this.authenticate(() => this.provider.register(this.config.appId, username, password));
  }

  /** Inicia sesión con una cuenta existente y sincroniza. */
  async signIn(username: string, password: string): Promise<void> {
    await this.authenticate(() => this.provider.login(this.config.appId, username, password));
  }

  /** Cierra la sesión (revoca el token en el servidor). */
  async signOut(): Promise<void> {
    const token = this.sessions.token();
    this._busy.set(true);
    try {
      if (token) {
        await this.provider.logout(token);
      }
    } finally {
      this.sessions.set(null);
      this._status.set(this.enabled() ? 'signedOut' : 'disabled');
      this._busy.set(false);
    }
  }

  /**
   * Elimina la cuenta en la nube (usuario y datos) y cierra la sesión.
   * Los datos locales del dispositivo no se tocan.
   */
  async deleteAccount(): Promise<void> {
    const token = this.sessions.token();
    if (!token) return;
    this._busy.set(true);
    this._error.set(null);
    try {
      await this.provider.deleteAccount(token);
      this.outbox.clear();
      this._pending.set(0);
      this.sessions.set(null);
      this._status.set(this.enabled() ? 'signedOut' : 'disabled');
    } catch (err) {
      this.handleSyncError(err, 'No se pudo eliminar la cuenta');
      throw err;
    } finally {
      this._busy.set(false);
    }
  }

  /** Registra un cambio local en la cola pendiente de subir. */
  enqueue(change: SyncChange): void {
    if (!this.enabled() || !this.sessions.get()) return;
    this.outbox.enqueue(change);
    this._pending.set(this.outbox.size);
    this.schedulePush();
  }

  /** Sincroniza ahora: sube la cola pendiente y descarga novedades. */
  async syncNow(): Promise<void> {
    if (!this.enabled() || !this.sessions.get()) return;
    this._busy.set(true);
    this._status.set('syncing');
    this._error.set(null);
    try {
      const pending = this.outbox.all();
      if (pending.length) {
        const pushed = await this.provider.push(pending);
        const keys = pushed.applied
          .map((docId) => {
            const change = pending.find((c) => c.docId === docId);
            return change ? this.outbox.key(change) : '';
          })
          .filter(Boolean);
        this.outbox.remove(keys);
        // Los documentos donde gana el servidor se aplican en local.
        pushed.conflicts.forEach((env) => this.applyRemote(env));
      }

      const since = this.readCursor();
      const pulled = await this.provider.pull(since, this.config.collections);
      pulled.changes.forEach((env) => this.applyRemote(env));
      this.writeCursor(pulled.rev);

      this._lastSyncAt.set(new Date().toISOString());
      this._pending.set(this.outbox.size);
      this._status.set('idle');
    } catch (err) {
      this.handleSyncError(err, 'Error de sincronización');
    } finally {
      this._busy.set(false);
    }
  }

  private async authenticate(
    action: () => Promise<{ username: string; token: string; expiresAt: string }>
  ): Promise<void> {
    this._busy.set(true);
    this._error.set(null);
    try {
      const session = await action();
      this.sessions.set(session);
      this._status.set('idle');
      this._busy.set(false);
      this.prepareInitialUpload();
      await this.syncNow();
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'No se pudo autenticar');
      this._status.set('signedOut');
      this._busy.set(false);
    }
  }

  /** Encola todos los documentos locales para la primera subida. */
  private prepareInitialUpload(): void {
    if (this.readCursor() !== 0) return;
    for (const handler of this.handlers.values()) {
      for (const change of handler.snapshot()) {
        this.outbox.enqueue(change);
      }
    }
    this._pending.set(this.outbox.size);
  }

  private applyRemote(envelope: SyncEnvelope): void {
    this.handlers.get(envelope.collection)?.applyRemote(envelope);
  }

  /**
   * Gestiona un error de sync. Si es un 401 (token caducado o inválido),
   * cierra la sesión para que el usuario vuelva a iniciarla.
   */
  private handleSyncError(err: unknown, fallback: string): void {
    if (err instanceof SyncHttpError && err.status === 401) {
      this.sessions.set(null);
      this._status.set(this.enabled() ? 'signedOut' : 'disabled');
      this._error.set('Tu sesión ha caducado. Vuelve a iniciar sesión.');
      return;
    }
    this._error.set(err instanceof Error ? err.message : fallback);
    this._status.set('error');
  }

  /** Programa una subida automática tras un breve periodo sin cambios. */
  private schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.syncNow();
    }, 1500);
  }

  private restore(): void {
    const enabled = localStorage.getItem(ENABLED_KEY) === '1';
    if (!enabled) {
      this._status.set('disabled');
      return;
    }
    this._status.set(this.sessions.get() ? 'idle' : 'signedOut');
  }

  private cursorKey(): string {
    const username = this.sessions.get()?.username ?? 'anon';
    return `${CURSOR_PREFIX}${this.config.appId}_${username}`;
  }

  private readCursor(): number {
    return Number(localStorage.getItem(this.cursorKey()) ?? '0') || 0;
  }

  private writeCursor(rev: number): void {
    localStorage.setItem(this.cursorKey(), String(rev));
  }
}

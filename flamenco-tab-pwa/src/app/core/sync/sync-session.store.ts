import { Injectable, signal } from '@angular/core';
import { SyncSession } from './models/sync.model';

const SESSION_KEY = 'flamenco_sync_session';

/**
 * Guarda la sesión activa (token) y la comparte entre `SyncService` y el
 * proveedor HTTP, evitando dependencias circulares.
 */
@Injectable({ providedIn: 'root' })
export class SyncSessionStore {
  private readonly _session = signal<SyncSession | null>(this.read());
  readonly session = this._session.asReadonly();

  get(): SyncSession | null {
    return this._session();
  }

  token(): string {
    return this._session()?.token ?? '';
  }

  set(session: SyncSession | null): void {
    this._session.set(session);
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  private read(): SyncSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as SyncSession) : null;
    } catch {
      return null;
    }
  }
}

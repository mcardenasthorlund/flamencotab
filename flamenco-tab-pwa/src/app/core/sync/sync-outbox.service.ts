import { Injectable } from '@angular/core';
import { SyncChange } from './models/sync.model';

const OUTBOX_KEY = 'flamenco_sync_outbox';

/**
 * Cola persistente de cambios locales pendientes de subir al servidor.
 *
 * Sobrevive a recargas y cierres de la app. Cada entrada se identifica por
 * `collection:docId`, de modo que un cambio nuevo del mismo documento
 * reemplaza al anterior (no se acumulan versiones intermedias).
 */
@Injectable({ providedIn: 'root' })
export class SyncOutboxService {
  private changes = new Map<string, SyncChange>(this.load());

  get size(): number {
    return this.changes.size;
  }

  enqueue(change: SyncChange): void {
    this.changes.set(this.key(change), change);
    this.persist();
  }

  all(): SyncChange[] {
    return [...this.changes.values()];
  }

  /** Elimina de la cola los documentos ya confirmados por el servidor. */
  remove(keys: string[]): void {
    for (const k of keys) this.changes.delete(k);
    this.persist();
  }

  removeChange(change: SyncChange): void {
    this.remove([this.key(change)]);
  }

  clear(): void {
    this.changes.clear();
    this.persist();
  }

  key(change: Pick<SyncChange, 'collection' | 'docId'>): string {
    return `${change.collection}:${change.docId}`;
  }

  private load(): Array<[string, SyncChange]> {
    try {
      const raw = localStorage.getItem(OUTBOX_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SyncChange[];
      return parsed.map((c) => [this.key(c), c] as [string, SyncChange]);
    } catch {
      return [];
    }
  }

  private persist(): void {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(this.all()));
  }
}

import { Injectable } from '@angular/core';
import { SyncChange, SyncPullResult, SyncPushResult, SyncSession } from '../models/sync.model';
import { SyncProvider } from './sync-provider';

const UNAVAILABLE = 'La sincronización en la nube no está disponible.';

/**
 * Proveedor por defecto: la aplicación funciona en local y no habla con
 * ningún servidor. Se usa cuando el usuario no quiere sincronizar.
 */
@Injectable({ providedIn: 'root' })
export class LocalOnlyProvider implements SyncProvider {
  async pull(): Promise<SyncPullResult> {
    return { rev: 0, changes: [] };
  }

  async push(_changes: SyncChange[]): Promise<SyncPushResult> {
    return { rev: 0, applied: [], conflicts: [] };
  }

  async register(): Promise<SyncSession> {
    throw new Error(UNAVAILABLE);
  }

  async login(): Promise<SyncSession> {
    throw new Error(UNAVAILABLE);
  }

  async logout(): Promise<void> {
    // Sin servidor no hay nada que revocar.
  }

  async deleteAccount(): Promise<void> {
    throw new Error(UNAVAILABLE);
  }
}

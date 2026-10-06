import { InjectionToken } from '@angular/core';
import { SyncChange, SyncPullResult, SyncPushResult, SyncSession } from '../models/sync.model';
import { LocalOnlyProvider } from './local-only.provider';

/**
 * Contrato que debe cumplir cualquier proveedor de sincronización.
 *
 * `LocalOnlyProvider` lo implementa como no-op (sin nube) y
 * `HttpSyncProvider` habla con el backend PHP.
 */
export interface SyncProvider {
  /** Descarga los cambios posteriores a `since` (cursor de revisión). */
  pull(since: number, collections: string[]): Promise<SyncPullResult>;

  /** Sube un lote de cambios locales. */
  push(changes: SyncChange[]): Promise<SyncPushResult>;

  /** Alta de usuario en el backend. */
  register(appId: string, username: string, password: string): Promise<SyncSession>;

  /** Inicio de sesión en el backend. */
  login(appId: string, username: string, password: string): Promise<SyncSession>;

  /** Cierra la sesión (revoca el token). */
  logout(token: string): Promise<void>;

  /** Elimina la cuenta y todos sus datos en la nube. */
  deleteAccount(token: string): Promise<void>;
}

/**
 * Token para inyectar el proveedor activo.
 *
 * Por defecto usa `LocalOnlyProvider` (sin nube). `app.config.ts` lo sobrescribe
 * con `HttpSyncProvider` para habilitar el backend.
 */
export const SYNC_PROVIDER = new InjectionToken<SyncProvider>('SYNC_PROVIDER', {
  providedIn: 'root',
  factory: () => new LocalOnlyProvider(),
});

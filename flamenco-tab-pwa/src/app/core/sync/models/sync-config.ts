import { InjectionToken } from '@angular/core';

/**
 * Configuración del módulo de sincronización.
 *
 * Cada aplicación que reutilice este módulo solo debe sobrescribir este token
 * (normalmente en su `app.config.ts`) con su propio `appId` y sus colecciones.
 */
export interface SyncConfig {
  /** URL base de la API PHP (por defecto "/api"). */
  apiBaseUrl: string;
  /** Identificador de la aplicación dentro del backend compartido. */
  appId: string;
  /** Colecciones que esta aplicación sincroniza. */
  collections: string[];
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  apiBaseUrl: '/api',
  appId: 'flamencotab',
  collections: ['tabs', 'chords'],
};

export const SYNC_CONFIG = new InjectionToken<SyncConfig>('SYNC_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_SYNC_CONFIG,
});

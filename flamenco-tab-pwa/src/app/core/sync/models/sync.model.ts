/**
 * Modelos genéricos de sincronización.
 *
 * Este contrato es agnóstico al backend y a la aplicación: cualquier app
 * puede reutilizarlo cambiando únicamente su `SyncConfig`.
 */

/** Documento tal y como lo almacena el servidor. */
export interface SyncEnvelope<T = unknown> {
  /** Identificador global del documento (UUID). */
  docId: string;
  /** Colección a la que pertenece (p. ej. "tabs", "chords"). */
  collection: string;
  /** Revisión monotónica asignada por el servidor. */
  rev: number;
  /** Fecha de última modificación según el servidor (ISO). */
  updatedAt: string;
  /** Marca de borrado (tombstone). */
  deleted: boolean;
  /** Versión del esquema del payload, para migraciones. */
  schemaVersion: number;
  /** Contenido propio de la aplicación. */
  payload: T;
}

/** Cambio local pendiente de enviar al servidor. */
export interface SyncChange<T = unknown> {
  docId: string;
  collection: string;
  /** Fecha local del último cambio (ISO), usada para el LWW. */
  clientUpdatedAt: string;
  deleted: boolean;
  /** Versión del esquema del payload, para migraciones. */
  schemaVersion: number;
  payload: T;
}

/** Resultado de una operación de descarga. */
export interface SyncPullResult<T = unknown> {
  /** Revisión del servidor tras el pull (cursor para la próxima vez). */
  rev: number;
  changes: SyncEnvelope<T>[];
}

/** Resultado de una operación de subida. */
export interface SyncPushResult {
  /** Revisión del servidor tras el push. */
  rev: number;
  /** docIds aceptados por el servidor. */
  applied: string[];
  /** Documentos en los que ganó la versión del servidor (LWW). */
  conflicts: SyncEnvelope[];
}

/** Estado global del servicio de sincronización. */
export type SyncStatus = 'disabled' | 'signedOut' | 'idle' | 'syncing' | 'error';

/** Sesión autenticada contra el backend. */
export interface SyncSession {
  username: string;
  token: string;
  expiresAt: string;
}

/** Credenciales introducidas por el usuario. */
export interface SyncCredentials {
  username: string;
  password: string;
}

/** Error de red con el código HTTP, para poder reaccionar (p. ej. a un 401). */
export class SyncHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'SyncHttpError';
  }
}

/**
 * Adaptador de una colección concreta de la aplicación.
 *
 * Permite que el módulo genérico de sync no dependa de los modelos de cada app.
 */
export interface SyncCollectionHandler {
  /** Nombre de la colección (debe coincidir con `SyncConfig.collections`). */
  collection: string;
  /** Aplica un documento remoto en el almacén local (sin re-encolarlo). */
  applyRemote(envelope: SyncEnvelope): void;
  /** Devuelve todos los documentos locales para la subida inicial. */
  snapshot(): SyncChange[];
}

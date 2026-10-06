# Integración de una nueva app con el backend de sincronización

Guía para conectar **cualquier app Angular (PWA)** al backend genérico de sync.
Pensada para entregársela a un agente de codificación: incluye el contrato de la API,
el módulo cliente reutilizable y una checklist paso a paso.

- **Backend (producción):** `https://appbackend.ideasypruebas2.es`
- **Backend (local):** `http://localhost:8000` (ver `docker-compose.yaml`)
- **Implementación de referencia:** app **FlamencoTab** (este repo).

---

## 0. Modelo mental

- Un **único backend** sirve a varias apps.
- Cada app se identifica con un **`appId`** (p. ej. `flamencotab`).
- Cada app tiene **sus propios usuarios** (cuentas separadas) y cada usuario su
  carpeta: `data/{appId}/{username}/`.
- La sincronización es **opcional** y **local-first**: la app funciona igual sin nube;
  la nube es una réplica.
- Resolución de conflictos: **Last-Write-Wins** con hora del servidor.
- Los datos de cada app son **opacos** para el backend: este solo guarda un `payload`
  JSON por documento. Por eso el backend sirve para cualquier modelo de datos.

---

## 1. Requisitos previos (una sola vez en el backend)

Edita `backend/config/config.php`:

```php
'apps' => ['flamencotab', 'miapp'],            // añade el appId de la nueva app
'cors_origins' => [
    'https://appflamencotab.ideasypruebas2.es',
    'https://miapp.ejemplo.com',               // dominio de la nueva app
    'http://localhost:4200',                   // desarrollo
],
```

No hay que crear ninguna carpeta: `data/{appId}/{username}/` se genera sola al registrar.

> El `appId` debe cumplir `[a-zA-Z0-9_-]{1,64}`.

---

## 2. Contrato de la API

Todas las respuestas son JSON. Base de ejemplo: `https://appbackend.ideasypruebas2.es`.

### Cabeceras

| Uso | Cabecera |
| :--- | :--- |
| Cuerpo | `Content-Type: application/json` |
| Autenticación | `Authorization: Bearer <token>` **y** `X-Auth-Token: <token>` |

> ⚠️ Envía **siempre las dos** cabeceras de auth. En hostings con **CGI/FastCGI**
> Apache descarta `Authorization`, pero `X-Auth-Token` sí llega. El backend acepta
> cualquiera de las dos.

### Endpoints

| Método | Ruta | Auth | Cuerpo / Query | Respuesta OK |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/health` | No | — | `{ ok, phpVersion, sapi, barriers }` |
| `POST` | `/auth/register` | No | `{ appId, username, password }` | `201 { token, expiresAt, username }` |
| `POST` | `/auth/login` | No | `{ appId, username, password }` | `200 { token, expiresAt, username }` |
| `POST` | `/auth/logout` | Sí | — | `{ ok: true }` |
| `GET` | `/account` | Sí | — | `{ username, appId, usageBytes }` |
| `DELETE` | `/account` | Sí | — | `{ ok: true }` (borra usuario y datos) |
| `GET` | `/sync/pull` | Sí | `?since=<rev>&collections=a,b` | `{ rev, changes: [Envelope] }` |
| `POST` | `/sync/push` | Sí | `{ changes: [Change] }` | `{ rev, applied: [docId], conflicts: [Envelope] }` |

Reglas de validación:
- `username`: `[a-zA-Z0-9_-]{3,32}`.
- `password`: mínimo 8 caracteres.
- `collection` y `docId`: `[a-zA-Z0-9_-]{1,64}`.
- Tamaño máximo del cuerpo: 2 MB.
- Rate limit en `/auth/*` (por defecto 60 req/min por IP) → `429`.

### Formatos

**Envelope** (lo que devuelve el servidor en `changes` y `conflicts`):

```json
{
  "docId": "uuid",
  "collection": "items",
  "rev": 7,
  "updatedAt": "2026-10-06T09:01:49+00:00",
  "deleted": false,
  "schemaVersion": 1,
  "payload": { }
}
```

**Change** (lo que envía el cliente en `push.changes`):

```json
{
  "docId": "uuid",
  "collection": "items",
  "clientUpdatedAt": "2026-10-06T09:01:49.000Z",
  "deleted": false,
  "schemaVersion": 1,
  "payload": { }
}
```

### Semántica de sincronización

- **Cursor (`rev`):** el servidor mantiene un contador monotónico por usuario. `pull`
  devuelve los documentos con `rev > since`. Guarda el `rev` de la respuesta como
  cursor para la próxima llamada.
- **LWW en `push`:** por cada documento, si `clientUpdatedAt > updatedAt` del servidor
  se sobrescribe (`rev = ++lastRev`, `updatedAt = ahora`). Si no, **gana el servidor** y
  el documento se devuelve en `conflicts` para que el cliente lo aplique en local.
- **Borrados:** nunca se eliminan; se marcan `deleted: true` (tombstone) con su propio `rev`.
- **IDs:** usa **UUID v4** en el cliente (no `Date.now()`: colisiona entre dispositivos).

### Errores

Formato: `{ "error": "<code>", "message": "<texto>" }`.

| HTTP | `error` | Significado |
| :--- | :--- | :--- |
| 400 | `invalid_json`, `invalid_segment` | Cuerpo o identificador no válido |
| 401 | `unauthenticated`, `invalid_credentials`, `revoked` | Auth fallida / token caducado / revocado |
| 403 | `invalid_app` | `appId` no está en la whitelist |
| 409 | `user_exists` | El usuario ya existe |
| 413 | `payload_too_large` | Cuerpo > 2 MB |
| 422 | `invalid_username`, `weak_password` | Validación de alta |
| 429 | `rate_limited` | Demasiadas peticiones |

---

## 3. Módulo cliente reutilizable (`core/sync/`)

Copia esta carpeta **tal cual** a la nueva app:

```
src/app/core/sync/
├── models/
│   ├── sync.model.ts          # Envelope, Change, SyncStatus, SyncSession, SyncHttpError…
│   └── sync-config.ts         # SyncConfig + token SYNC_CONFIG
├── providers/
│   ├── sync-provider.ts       # interfaz SyncProvider + token SYNC_PROVIDER
│   ├── local-only.provider.ts # no-op (sin nube)
│   └── http-sync.provider.ts  # habla con el backend PHP
├── sync.service.ts            # estado, auth, pull/push, 401→logout
├── sync-outbox.service.ts     # cola offline persistente
└── sync-session.store.ts      # sesión/token persistidos
```

No modifiques estos ficheros: la app se adapta mediante **configuración** y **handlers**.

### 3.1 Configurar el módulo (`app.config.ts`)

```ts
import { provideHttpClient } from '@angular/common/http';
import { SYNC_PROVIDER } from './core/sync/providers/sync-provider';
import { HttpSyncProvider } from './core/sync/providers/http-sync.provider';
import { SYNC_CONFIG, DEFAULT_SYNC_CONFIG } from './core/sync/models/sync-config';
import { environment } from '../environments/environment';

providers: [
  provideHttpClient(),
  { provide: SYNC_PROVIDER, useExisting: HttpSyncProvider },
  {
    provide: SYNC_CONFIG,
    useValue: {
      ...DEFAULT_SYNC_CONFIG,
      apiBaseUrl: environment.apiBaseUrl,   // 'https://appbackend.ideasypruebas2.es'
      appId: 'miapp',
      collections: ['items', 'settings'],    // las colecciones de ESTA app
    },
  },
]
```

### 3.2 Adaptador de la app (`core/services/sync-coordinator.service.ts`)

Instancia los servicios de datos (que registran sus colecciones) y lanza el sync inicial:

```ts
@Injectable({ providedIn: 'root' })
export class SyncCoordinator {
  private readonly sync = inject(SyncService);
  private readonly items = inject(ItemStoreService);

  start(): void {
    this.items.list();                 // fuerza la instanciación → registra 'items'
    if (this.sync.enabled() && this.sync.session()) {
      void this.sync.syncNow();
    }
  }
}
```

Llámalo al arrancar la app (en el componente raíz):

```ts
constructor() { inject(SyncCoordinator).start(); }
```

---

## 4. Implementar una colección (patrón a copiar)

Cada colección se registra con un **handler** que sabe leer los datos locales
(`snapshot`) y aplicar los remotos (`applyRemote`). Ejemplo genérico:

```ts
const COLLECTION = 'items';

@Injectable({ providedIn: 'root' })
export class ItemStoreService {
  private readonly sync = inject(SyncService);
  private readonly items = signal<Item[]>(this.loadFromLocal());

  constructor() {
    this.sync.registerHandler({
      collection: COLLECTION,
      snapshot: () => this.items().map((it) => this.toChange(it)),
      applyRemote: (env) => this.applyRemote(env),
    });
  }

  // --- cambios locales ---
  save(item: Item): void {
    item.updatedAt = new Date().toISOString();
    this.upsert(item);
    this.persist();
    this.sync.enqueue(this.toChange(item));   // solo encola si el sync está activo
  }

  remove(id: string): void {
    const item = this.items().find((i) => i.id === id);
    this.items.update((list) => list.filter((i) => i.id !== id));
    this.persist();
    if (item) this.sync.enqueue(this.toChange(item, true)); // tombstone
  }

  // --- sync ---
  private toChange(item: Item, deleted = false): SyncChange {
    return {
      docId: item.id,                 // UUID v4
      collection: COLLECTION,
      clientUpdatedAt: item.updatedAt ?? new Date().toISOString(),
      deleted,
      schemaVersion: 1,
      payload: deleted ? null : item,
    };
  }

  private applyRemote(env: SyncEnvelope): void {
    // OJO: no re-encolar aquí (rompería el ciclo). Solo aplicar y persistir.
    this.items.update((list) => {
      const rest = list.filter((i) => i.id !== env.docId);
      return env.deleted ? rest : [...rest, env.payload as Item];
    });
    this.persist();
  }
}
```

Reglas de oro:
- **UUID v4** para los `docId`.
- **Encolar solo en cambios locales** (`sync.enqueue`), **nunca** en `applyRemote`.
- Guardar un `updatedAt` por documento (lo usa el LWW).
- Los borrados se representan como **tombstone** (`deleted: true`), no se eliminan del servidor.

---

## 5. UI de ajustes (patrón)

Una página `/settings` con:
- Interruptor **"Sincronización en la nube"** → `sync.setEnabled(bool)`.
- Si no hay sesión: formulario **alta/login** → `sync.signUp()` / `sync.signIn()`.
- Si hay sesión: usuario, última sync, **Sincronizar ahora** (`sync.syncNow()`),
  **Cerrar sesión** (`sync.signOut()`) y **Eliminar cuenta** (`sync.deleteAccount()`).
- Mostrar `sync.status()`, `sync.error()`, `sync.pending()`.

Referencia directa:
`src/app/features/settings/pages/settings-page/` (componente + plantilla + estilos).

---

## 6. PWA y entornos

1. **Service Worker:** excluye la API del cacheo. En `ngsw-config.json`:
   ```json
   "navigationUrls": ["/**", "!/**/*.*", "!/**/*__*", "/**/*__*", "!/api/**"]
   ```
   (Si la API está en otro dominio, no hace falta, pero es buena práctica.)

2. **Entornos** (`src/environments/environment.ts` y `environment.production.ts`):
   ```ts
   export const environment = { production: false, apiBaseUrl: 'http://localhost:8000' };
   export const environment = { production: true,  apiBaseUrl: 'https://appbackend.ideasypruebas2.es' };
   ```
   Y en `angular.json` (configuración `production`):
   ```json
   "fileReplacements": [
     { "replace": "src/environments/environment.ts",
       "with": "src/environments/environment.production.ts" }
   ]
   ```

3. **Dev con backend local:** `proxy.conf.json` mapeando `/api` → `http://localhost:8000`
   (opcional; si usas la URL absoluta, no hace falta).

---

## 7. Checklist de integración

1. [ ] Añadir el `appId` a `apps` y el dominio a `cors_origins` en `backend/config/config.php`.
2. [ ] Copiar `src/app/core/sync/` a la nueva app.
3. [ ] Añadir `provideHttpClient()`, `SYNC_PROVIDER` (HttpSyncProvider) y `SYNC_CONFIG` en `app.config.ts`.
4. [ ] Crear `SyncCoordinator` y llamarlo al arrancar.
5. [ ] Definir las **colecciones** de la app y registrar un **handler** por cada una.
6. [ ] Migrar los IDs a **UUID v4**.
7. [ ] Encolar en los cambios locales; aplicar remotos sin re-encolar.
8. [ ] Añadir la página `/settings` (toggle + alta/login + estado + borrar cuenta).
9. [ ] Configurar entornos y (si aplica) excluir `/api/**` del Service Worker.
10. [ ] Probar con la checklist de abajo.

---

## 8. Pruebas rápidas (curl / PowerShell)

```powershell
$base = 'https://appbackend.ideasypruebas2.es'
$app  = 'miapp'
$u    = 'prueba_' + (Get-Random -Maximum 9999)

# Alta
$reg = Invoke-RestMethod -Uri "$base/auth/register" -Method Post -ContentType 'application/json' `
  -Body (@{ appId=$app; username=$u; password='password123' } | ConvertTo-Json)
$tok = $reg.token
$h = @{ 'X-Auth-Token' = $tok }

# Push de un documento
$now = (Get-Date).ToUniversalTime().ToString('o')
$doc = 'item-' + [guid]::NewGuid()
Invoke-RestMethod -Uri "$base/sync/push" -Method Post -ContentType 'application/json' -Headers $h `
  -Body (@{ changes = @(@{ docId=$doc; collection='items'; clientUpdatedAt=$now; deleted=$false; schemaVersion=1; payload=@{ id=$doc; name='hola' } }) } | ConvertTo-Json -Depth 6)

# Pull
Invoke-RestMethod -Uri "$base/sync/pull?since=0&collections=items" -Headers $h

# Cuenta y borrado
Invoke-RestMethod -Uri "$base/account" -Headers $h
Invoke-RestMethod -Uri "$base/account" -Method Delete -Headers $h
```

Comprobaciones:
- `GET /health` → `ok: true`.
- Registro duplicado → `409`; credenciales malas → `401`; `appId` no autorizado → `403`.
- Tras `DELETE /account`, el token deja de valer (`401`).

---

## 9. Seguridad (resumen)

- Las contraseñas se **hashean en el servidor** (Argon2id/bcrypt). El cliente solo las envía.
- El `userId` **siempre se deriva del token** en el servidor; el cliente nunca lo envía.
- Envía el token en `Authorization` **y** `X-Auth-Token` (CGI/FastCGI).
- HTTPS obligatorio. CORS restringido a dominios concretos.
- Al recibir **401**, el `SyncService` cierra sesión y pide re-login (sesión caducada).

---

## 10. Prompt sugerido para el agente de codificación

> Integra la app `<NOMBRE>` con el backend de sync descrito en `backend/INTEGRATION.md`.
> `appId`: `<appid>`. Colecciones: `<col1>`, `<col2>`.
> Copia `core/sync/` tal cual, configura `SYNC_CONFIG` en `app.config.ts`, crea el
> `SyncCoordinator`, registra un handler por colección (con `snapshot`/`applyRemote`),
> migra los IDs a UUID v4, añade la página `/settings` con el patrón indicado y
> configura los entornos. Usa la app FlamencoTab como referencia.

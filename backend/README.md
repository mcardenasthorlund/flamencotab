# FlamencoTab Sync API

Backend PHP genérico y multi-aplicación para sincronizar datos de PWAs sin servidor
de base de datos. Cada aplicación tiene su carpeta (`appId`) y, dentro, una carpeta
por usuario con sus documentos en JSON.

- **Sin base de datos:** el sistema de ficheros es el almacén.
- **Sin dependencias:** PHP 8.0+ y Apache con `mod_rewrite` (o `?r=/ruta`).
- **Dos barreras de seguridad:** `.htaccess` (deny) + JSON envuelto en PHP.

> 📘 **¿Quieres conectar otra app?** Consulta [`INTEGRATION.md`](./INTEGRATION.md):
> contrato completo de la API, módulo cliente reutilizable y checklist paso a paso.

## Estructura

```
backend/
├── index.php              # front controller (único punto público)
├── .htaccess              # front controller + bloqueo de dirs internos
├── src/                   # código PHP (deny)
├── config/                # config.php (deny, NO versionado)
└── data/                  # datos de usuarios (deny, NO versionado)
```

## Instalación

1. Sube el contenido de `backend/` al hosting (p. ej. `public_html/api/`).
2. Copia `config/config.sample.php` a `config/config.php` y ajusta:
   - `secret`: cadena larga y aleatoria.
   - `apps`: lista blanca de `appId` permitidos.
   - `cors_origins`: dominios de tus apps.
3. Comprueba la protección con `GET /api/health`.

`data/` se crea automáticamente en la primera petición, junto con su `.htaccess`.

## API

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Estado y verificación de las dos barreras de seguridad |
| `POST` | `/api/auth/register` | Alta de usuario `{ appId, username, password }` |
| `POST` | `/api/auth/login` | Login `{ appId, username, password }` → `{ token, expiresAt }` |
| `POST` | `/api/auth/logout` | Revoca el token actual (cabecera `Authorization: Bearer …`) |
| `GET` | `/api/account` | Datos de la cuenta y uso de disco |
| `DELETE` | `/api/account` | Elimina la cuenta y todos sus datos en la nube |
| `GET` | `/api/sync/pull?since=<rev>&collections=tabs,chords` | Cambios con `rev > since` |
| `POST` | `/api/sync/push` | Sube `{ changes: [...] }` |

> El token puede enviarse en `Authorization: Bearer …` o en `X-Auth-Token` (útil en
> hostings con CGI/FastCGI que descartan la cabecera `Authorization`).

### Envelope de documento

```json
{
  "docId": "uuid",
  "collection": "tabs",
  "rev": 7,
  "updatedAt": "2026-10-06T…Z",
  "deleted": false,
  "schemaVersion": 1,
  "payload": { }
}
```

### Sincronización

- **Pull:** devuelve los documentos con `rev > since`; el campo `rev` de la
  respuesta es el cursor para la próxima llamada.
- **Push:** por cada documento gana el más reciente (`clientUpdatedAt` vs
  `updatedAt` del servidor, Last-Write-Wins). Los documentos donde gana el
  servidor se devuelven en `conflicts`.
- **Borrados:** se marcan con `deleted: true` (tombstone), nunca se eliminan.

## Seguridad

- `data/`, `src/` y `config/` denegados por `.htaccess` (Apache 2.4 y 2.2).
- Todos los ficheros de datos se guardan como `.php` con `<?php exit; ?>` delante,
  de modo que un acceso directo por URL devuelve cuerpo vacío aunque `.htaccess`
  no se aplique.
- `userId` siempre derivado del token firmado (HMAC-SHA256), nunca del cliente.
- Contraseñas con `password_hash()` (Argon2id/bcrypt según el sistema).
- Validación estricta de `appId`, `username`, `collection` y `docId`.
- Rate limiting por IP en las rutas de autenticación.

## Copias de seguridad

`bin/backup.php` copia `data/` en `data/_backups/` (protegido por el `.htaccess`
de `data/`) y conserva las últimas `backup_keep` copias (por defecto 7).

**Por cron (recomendado):**

```cron
0 3 * * * php /ruta/al/backend/bin/backup.php >> /ruta/al/backend/data/_backups/backup.log 2>&1
```

**Por web** (si tu cron solo puede lanzar URLs): define `admin_token` en
`config/config.php` y llama a:

```
https://tu-dominio/bin/backup.php?token=TU_TOKEN
```

Si `admin_token` está vacío, el disparo por web devuelve 403.

Las copias de `data/` pueden descargarse por FTP/gestor de archivos para
guardarlas fuera del servidor.

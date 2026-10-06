<?php
/**
 * Configuración del backend.
 *
 * Copia este archivo a `config.php` (en la misma carpeta) y ajusta los valores.
 * `config.php` NO se versiona.
 */
return [
    // Clave secreta para firmar los tokens. Cámbiala por una cadena larga y aleatoria.
    'secret' => 'cambia-esta-clave-por-una-larga-y-aleatoria',

    // Lista blanca de aplicaciones que pueden usar este backend.
    'apps' => ['flamencotab'],

    // Carpeta de datos (por defecto, `data/` junto al backend).
    'data_dir' => __DIR__ . '/../data',

    // Duración de los tokens en segundos (30 días).
    'token_ttl' => 60 * 60 * 24 * 30,

    // Tamaño máximo del cuerpo JSON de una petición (2 MB).
    'max_payload_bytes' => 2 * 1024 * 1024,

    // Rate limiting: máximo de peticiones por ventana (segundos) y por IP.
    'rate_limit' => ['window' => 60, 'max' => 60],

    // Backups: número de copias a conservar en `data/_backups/`.
    'backup_keep' => 7,

    // Token para disparar backups por web (vacío = deshabilitado).
    // Solo necesario si tu cron no puede ejecutar PHP por CLI.
    'admin_token' => '',

    // URL base para la auto-comprobación de seguridad de `/health`.
    // Déjalo vacío para derivarla de la petición (Apache). Con el servidor
    // embebido de PHP (php -S, mono-hilo) la auto-comprobación se omite.
    'health_base_url' => '',

    // Orígenes permitidos (CORS).
    'cors_origins' => [
        'https://appflamencotab.ideasypruebas2.es',
        'http://localhost:4200',
    ],
];

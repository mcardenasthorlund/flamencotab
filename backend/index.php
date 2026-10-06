<?php
declare(strict_types=1);

/**
 * FlamencoTab Sync API — backend PHP genérico multi-aplicación.
 *
 * Único punto público. El resto de carpetas (`src/`, `config/`, `data/`) están
 * denegadas por `.htaccess` y los datos, además, envueltos en PHP.
 */

require __DIR__ . '/src/Response.php';
require __DIR__ . '/src/Storage.php';
require __DIR__ . '/src/Router.php';
require __DIR__ . '/src/RateLimit.php';
require __DIR__ . '/src/Auth.php';
require __DIR__ . '/src/Sync.php';
require __DIR__ . '/src/Health.php';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
$configFile = __DIR__ . '/config/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'not_configured',
        'message' => 'Falta config/config.php. Copia config/config.sample.php y ajústalo.',
    ]);
    exit;
}
/** @var array<string, mixed> $config */
$config = require $configFile;

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
$allowedOrigins = $config['cors_origins'] ?? [];
if ($origin !== '' && is_array($allowedOrigins) && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
    header('Access-Control-Max-Age: 86400');
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------------
// Resolución de la ruta: ?r=/ruta  →  PATH_INFO  →  REQUEST_URI
// ---------------------------------------------------------------------------
if (isset($_GET['r']) && $_GET['r'] !== '') {
    $path = (string) $_GET['r'];
} elseif (isset($_SERVER['PATH_INFO']) && $_SERVER['PATH_INFO'] !== '') {
    $path = (string) $_SERVER['PATH_INFO'];
} else {
    $uri = (string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?? '/');
    $scriptDir = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? ''))), '/');
    $path = $uri;
    if ($scriptDir !== '' && str_starts_with($path, $scriptDir)) {
        $path = substr($path, strlen($scriptDir));
    }
}
$path = '/' . trim($path, '/');
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

// ---------------------------------------------------------------------------
// Dependencias
// ---------------------------------------------------------------------------
$storage = new Storage((string) $config['data_dir']);
$storage->ensureDataDir();
$auth = new Auth($storage, $config);
$sync = new Sync($storage);
$rate = new RateLimit($storage, $config);
$router = new Router();

/**
 * Lee y valida el cuerpo JSON de la petición.
 *
 * @return array<string, mixed>
 */
function json_body(array $config): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $max = (int) ($config['max_payload_bytes'] ?? 2097152);
    if ($max > 0 && strlen($raw) > $max) {
        Response::error('Cuerpo de la petición demasiado grande', 413, 'payload_too_large');
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        Response::error('JSON no válido', 400, 'invalid_json');
    }
    return $data;
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------
$router->add('GET', '/health', function () use ($storage, $config): void {
    $health = new Health($storage, $config);
    Response::json($health->check());
});

$router->add('POST', '/auth/register', function () use ($auth, $rate, $config): void {
    $rate->enforce('auth');
    $body = json_body($config);
    $result = $auth->register(
        (string) ($body['appId'] ?? ''),
        (string) ($body['username'] ?? ''),
        (string) ($body['password'] ?? '')
    );
    Response::json($result, 201);
});

$router->add('POST', '/auth/login', function () use ($auth, $rate, $config): void {
    $rate->enforce('auth');
    $body = json_body($config);
    $result = $auth->login(
        (string) ($body['appId'] ?? ''),
        (string) ($body['username'] ?? ''),
        (string) ($body['password'] ?? '')
    );
    Response::json($result);
});

$router->add('POST', '/auth/logout', function () use ($auth): void {
    $auth->authenticate();
    $auth->logout();
    Response::json(['ok' => true]);
});

$router->add('GET', '/account', function () use ($auth, $storage): void {
    $ctx = $auth->authenticate();
    Response::json([
        'username' => $ctx['username'],
        'appId' => $ctx['appId'],
        'usageBytes' => $storage->userUsage($ctx['appId'], $ctx['username']),
    ]);
});

$router->add('DELETE', '/account', function () use ($auth): void {
    $ctx = $auth->authenticate();
    $auth->deleteAccount($ctx['appId'], $ctx['username']);
    Response::json(['ok' => true]);
});

$router->add('GET', '/sync/pull', function () use ($auth, $sync): void {
    $ctx = $auth->authenticate();
    $since = (int) ($_GET['since'] ?? 0);
    $collections = isset($_GET['collections'])
        ? array_values(array_filter(explode(',', (string) $_GET['collections']), static fn ($c): bool => $c !== ''))
        : [];
    Response::json($sync->pull($ctx['appId'], $ctx['username'], $since, $collections));
});

$router->add('POST', '/sync/push', function () use ($auth, $sync, $config): void {
    $ctx = $auth->authenticate();
    $body = json_body($config);
    $changes = is_array($body['changes'] ?? null) ? $body['changes'] : [];
    Response::json($sync->push($ctx['appId'], $ctx['username'], $changes));
});

$router->dispatch($method, $path);

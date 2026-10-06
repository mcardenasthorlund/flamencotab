<?php
declare(strict_types=1);

/**
 * Copia de seguridad de `data/` con rotación.
 *
 * Uso por CLI (recomendado, p. ej. desde cron):
 *     php /ruta/al/backend/bin/backup.php
 *
 * Uso por web (para hostings cuyo cron solo lanza URLs), requiere `admin_token`
 * en config.php:
 *     https://tu-dominio/bin/backup.php?token=TU_TOKEN
 *
 * Configuración (config/config.php):
 *   - 'backup_keep'  => número de copias a conservar (por defecto 7)
 *   - 'admin_token'  => token para el disparo por web (vacío = deshabilitado)
 *
 * Las copias se guardan en `data/_backups/`, que está protegido por el
 * `.htaccess` de `data/`.
 */

$isCli = PHP_SAPI === 'cli';

$configFile = __DIR__ . '/../config/config.php';
if (!is_file($configFile)) {
    fail($isCli, 'Falta config/config.php');
}
/** @var array<string, mixed> $config */
$config = require $configFile;

if (!$isCli) {
    $adminToken = (string) ($config['admin_token'] ?? '');
    $provided = (string) ($_GET['token'] ?? '');
    if ($adminToken === '' || !hash_equals($adminToken, $provided)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'forbidden']);
        exit;
    }
}

$dataDir = (string) ($config['data_dir'] ?? __DIR__ . '/../data');
$backupRoot = $dataDir . '/_backups';
$keep = max(1, (int) ($config['backup_keep'] ?? 7));

if (!is_dir($dataDir)) {
    fail($isCli, 'No existe el directorio de datos: ' . $dataDir);
}
if (!is_dir($backupRoot) && !@mkdir($backupRoot, 0775, true) && !is_dir($backupRoot)) {
    fail($isCli, 'No se pudo crear ' . $backupRoot);
}

$name = 'backup-' . gmdate('Ymd-His');
$dest = $backupRoot . '/' . $name;
if (!is_dir($dest) && !@mkdir($dest, 0775, true) && !is_dir($dest)) {
    fail($isCli, 'No se pudo crear ' . $dest);
}

$files = copyTree($dataDir, $dest, ['_backups', '_ratelimit']);

// Rotación: conservar solo las `$keep` copias más recientes.
$backups = array_values(array_filter(glob($backupRoot . '/backup-*') ?: [], 'is_dir'));
sort($backups);
$removed = [];
while (count($backups) > $keep) {
    $old = array_shift($backups);
    removeTree($old);
    $removed[] = basename($old);
}

$result = [
    'ok' => true,
    'backup' => $name,
    'files' => $files,
    'kept' => count($backups),
    'removed' => $removed,
];

if ($isCli) {
    echo 'Backup creado: ' . $name . ' (' . $files . ' ficheros)' . "\n";
    if ($removed) {
        echo 'Eliminadas copias antiguas: ' . implode(', ', $removed) . "\n";
    }
    exit(0);
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// ---------------------------------------------------------------------------

/**
 * @param string[] $exclude
 */
function copyTree(string $src, string $dst, array $exclude = []): int
{
    $count = 0;
    foreach (scandir($src) ?: [] as $item) {
        if ($item === '.' || $item === '..' || in_array($item, $exclude, true)) {
            continue;
        }
        $from = $src . '/' . $item;
        $to = $dst . '/' . $item;
        if (is_dir($from)) {
            if (!is_dir($to)) {
                @mkdir($to, 0775, true);
            }
            $count += copyTree($from, $to, $exclude);
        } elseif (@copy($from, $to)) {
            $count++;
        }
    }
    return $count;
}

function removeTree(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($items as $item) {
        if ($item->isDir()) {
            @rmdir($item->getPathname());
        } else {
            @unlink($item->getPathname());
        }
    }
    @rmdir($dir);
}

function fail(bool $isCli, string $message): void
{
    if ($isCli) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

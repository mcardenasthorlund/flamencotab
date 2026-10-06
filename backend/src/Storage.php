<?php
declare(strict_types=1);

/**
 * Acceso al almacén de ficheros.
 *
 * Los datos se guardan como ficheros `.php` con el prefijo `<?php exit; ?>`,
 * de modo que un acceso directo por URL no devuelve nada (segunda barrera de
 * seguridad). El contenido JSON va a continuación del prefijo.
 */
final class Storage
{
    private const GUARD = "<?php exit; ?>\n";
    private const SEGMENT_RE = '/^[a-zA-Z0-9_-]{1,64}$/';

    public function __construct(private string $dataDir)
    {
    }

    public function dataDirPath(): string
    {
        return $this->dataDir;
    }

    /** Crea la carpeta de datos y su `.htaccess` si no existen. */
    public function ensureDataDir(): void
    {
        $this->ensureDir($this->dataDir);
        $htaccess = $this->dataDir . '/.htaccess';
        if (!is_file($htaccess)) {
            @file_put_contents($htaccess, $this->denyHtaccess());
        }
    }

    public function appDir(string $appId): string
    {
        return $this->dataDir . '/' . $this->segment($appId);
    }

    public function usersFile(string $appId): string
    {
        return $this->appDir($appId) . '/users.php';
    }

    public function revokedFile(string $appId): string
    {
        return $this->appDir($appId) . '/revoked.php';
    }

    public function userDir(string $appId, string $username): string
    {
        return $this->appDir($appId) . '/' . $this->segment($username);
    }

    public function metaFile(string $appId, string $username): string
    {
        return $this->userDir($appId, $username) . '/meta.php';
    }

    public function docsDir(string $appId, string $username): string
    {
        return $this->userDir($appId, $username) . '/docs';
    }

    public function docFile(string $appId, string $username, string $collection, string $docId): string
    {
        return $this->docsDir($appId, $username)
            . '/' . $this->segment($collection)
            . '/' . $this->segment($docId) . '.php';
    }

    public function ensureUserDir(string $appId, string $username): void
    {
        $this->ensureDir($this->docsDir($appId, $username));
    }

    /** Elimina por completo la carpeta de un usuario. */
    public function deleteUserDir(string $appId, string $username): void
    {
        $this->removeDir($this->userDir($appId, $username));
    }

    /** Tamaño en bytes ocupado por un usuario. */
    public function userUsage(string $appId, string $username): int
    {
        $dir = $this->userDir($appId, $username);
        if (!is_dir($dir)) {
            return 0;
        }
        $bytes = 0;
        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)
        );
        foreach ($items as $item) {
            if ($item->isFile()) {
                $bytes += (int) $item->getSize();
            }
        }
        return $bytes;
    }

    private function removeDir(string $dir): void
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

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listDocs(string $appId, string $username, string $collection): array
    {
        $dir = $this->docsDir($appId, $username) . '/' . $this->segment($collection);
        if (!is_dir($dir)) {
            return [];
        }
        $docs = [];
        foreach (glob($dir . '/*.php') ?: [] as $file) {
            $doc = $this->readJson($file, null);
            if (is_array($doc)) {
                $docs[] = $doc;
            }
        }
        return $docs;
    }

    public function readJson(string $file, mixed $default = null): mixed
    {
        if (!is_file($file)) {
            return $default;
        }
        $raw = file_get_contents($file);
        if ($raw === false) {
            return $default;
        }
        $json = $this->stripGuard($raw);
        if (trim($json) === '') {
            return $default;
        }
        $data = json_decode($json, true);
        return $data === null ? $default : $data;
    }

    public function writeJson(string $file, mixed $data): void
    {
        $this->ensureDir(dirname($file));
        $payload = self::GUARD
            . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        $tmp = $file . '.' . bin2hex(random_bytes(6)) . '.tmp';
        if (file_put_contents($tmp, $payload, LOCK_EX) === false) {
            Response::error('No se pudo escribir en el almacén', 500, 'write_failed');
        }
        @chmod($tmp, 0664);
        if (!rename($tmp, $file)) {
            @unlink($tmp);
            Response::error('No se pudo guardar en el almacén', 500, 'rename_failed');
        }
    }

    /**
     * Ejecuta `$fn` manteniendo un bloqueo exclusivo sobre `$file`.
     */
    public function withLock(string $file, callable $fn): mixed
    {
        $this->ensureDir(dirname($file));
        $lockFile = $file . '.lock';
        $fh = @fopen($lockFile, 'c');
        if ($fh === false) {
            Response::error('No se pudo bloquear el almacén', 500, 'lock_failed');
        }
        try {
            flock($fh, LOCK_EX);
            return $fn();
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
    }

    private function segment(string $value): string
    {
        if (!preg_match(self::SEGMENT_RE, $value)) {
            Response::error('Identificador no válido', 400, 'invalid_segment');
        }
        return $value;
    }

    private function ensureDir(string $dir): void
    {
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
                Response::error('No se pudo crear el directorio de datos', 500, 'mkdir_failed');
            }
        }
    }

    private function stripGuard(string $raw): string
    {
        if (str_starts_with($raw, '<?php')) {
            $pos = strpos($raw, "\n");
            return $pos === false ? '' : substr($raw, $pos + 1);
        }
        return $raw;
    }

    private function denyHtaccess(): string
    {
        return "Options -Indexes\n"
            . "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n";
    }
}

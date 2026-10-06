<?php
declare(strict_types=1);

/**
 * Rate limiting sencillo por IP basado en ficheros.
 */
final class RateLimit
{
    public function __construct(
        private Storage $storage,
        private array $config,
    ) {
    }

    public function enforce(string $bucket): void
    {
        $window = (int) ($this->config['rate_limit']['window'] ?? 60);
        $max = (int) ($this->config['rate_limit']['max'] ?? 60);
        if ($max <= 0 || $window <= 0) {
            return;
        }

        $dir = $this->storage->dataDirPath() . '/_ratelimit';
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
        $file = $dir . '/' . sha1($bucket . '|' . $ip) . '.php';
        $now = time();

        $this->storage->withLock($file, function () use ($file, $window, $max, $now): void {
            $data = $this->storage->readJson($file, ['hits' => []]);
            $hits = is_array($data) ? ($data['hits'] ?? []) : [];
            $hits = array_values(array_filter(
                is_array($hits) ? $hits : [],
                static fn ($t): bool => (int) $t > $now - $window
            ));
            if (count($hits) >= $max) {
                Response::error('Demasiadas peticiones, inténtalo de nuevo más tarde', 429, 'rate_limited');
            }
            $hits[] = $now;
            $this->storage->writeJson($file, ['hits' => $hits]);
        });
    }
}

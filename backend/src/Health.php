<?php
declare(strict_types=1);

/**
 * Comprobación de estado y verificación de las barreras de seguridad.
 *
 * Por defecto NO hace peticiones HTTP a sí mismo (en hosting compartido eso
 * puede bloquearse y agotar los workers). Verifica:
 *  - Barrera 2 (envoltorio PHP): comprobación estructural del fichero de datos.
 *  - Barrera 1 (`.htaccess`): comprobación de que está declarado con reglas de
 *    denegación. Para verificarlo de verdad, comprueba desde fuera que
 *    `GET /data/.htaccess` devuelve 403.
 *
 * Si se configura `health_base_url`, además hace la comprobación HTTP real.
 */
final class Health
{
    public function __construct(
        private Storage $storage,
        private array $config,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function check(): array
    {
        $this->storage->ensureDataDir();
        $dir = $this->storage->dataDirPath();

        // --- Barrera 2: el envoltorio PHP está en los ficheros de datos ---
        $probe = $dir . '/_health_probe.php';
        $this->storage->writeJson($probe, ['probe' => true]);
        $raw = is_file($probe) ? (string) file_get_contents($probe) : '';
        @unlink($probe);
        $structural = str_starts_with($raw, '<?php exit;');

        // --- Barrera 1: `.htaccess` declarado con reglas de denegación ---
        $htaccessFile = $dir . '/.htaccess';
        $htaccessContent = is_file($htaccessFile) ? (string) file_get_contents($htaccessFile) : '';
        $htaccessDeclared = str_contains($htaccessContent, 'Require all denied')
            || str_contains($htaccessContent, 'Deny from all');

        // --- Comprobación HTTP opcional (solo si se configura health_base_url) ---
        $http = $this->httpProbe($dir);

        $wrapperProtected = $structural && ($http['phpWrapper']['protected'] ?? true);
        $htaccessProtected = $http['htaccess']['protected'] ?? ($htaccessDeclared ? null : false);
        $ok = $wrapperProtected && ($htaccessProtected !== false);

        return [
            'ok' => $ok,
            'phpVersion' => PHP_VERSION,
            'sapi' => PHP_SAPI,
            'barriers' => [
                'phpWrapper' => [
                    'protected' => $wrapperProtected,
                    'structural' => $structural,
                    'http' => $http['phpWrapper'] ?? null,
                ],
                'htaccess' => [
                    'protected' => $htaccessProtected,
                    'declared' => $htaccessDeclared,
                    'http' => $http['htaccess'] ?? null,
                    'note' => $htaccessDeclared
                        ? 'Declarado. Verifícalo desde fuera: GET /data/.htaccess debe devolver 403.'
                        : 'Falta data/.htaccess o no contiene reglas de denegación.',
                ],
            ],
        ];
    }

    /**
     * @return array{htaccess: array<string, mixed>, phpWrapper: array<string, mixed>}|null
     */
    private function httpProbe(string $dir): ?array
    {
        $base = trim((string) ($this->config['health_base_url'] ?? ''));
        if ($base === '') {
            return null;
        }
        $base = rtrim($base, '/');

        $txt = $dir . '/_health_probe.txt';
        @file_put_contents($txt, 'PROBE');
        $htaccessRes = $this->fetch($base . '/data/_health_probe.txt');
        @unlink($txt);

        $php = $dir . '/_health_probe.php';
        @file_put_contents($php, "<?php exit; ?>\nPROBE");
        $wrapperRes = $this->fetch($base . '/data/_health_probe.php');
        @unlink($php);

        return [
            'htaccess' => $this->judge($htaccessRes, false),
            'phpWrapper' => $this->judge($wrapperRes, true),
        ];
    }

    /**
     * @param array{status: int, body: string}|null $res
     * @return array{protected: bool|null, status: int|null, method: string}
     */
    private function judge(?array $res, bool $emptyOk): array
    {
        if ($res === null || $res['status'] === 0) {
            return ['protected' => null, 'status' => null, 'method' => 'http'];
        }
        $status = (int) $res['status'];
        $protected = in_array($status, [403, 404], true)
            || ($emptyOk && trim((string) $res['body']) === '');
        return ['protected' => $protected, 'status' => $status, 'method' => 'http'];
    }

    /**
     * @return array{status: int, body: string}|null
     */
    private function fetch(string $url): ?array
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 3,
                CURLOPT_CONNECTTIMEOUT => 2,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => 0,
            ]);
            $body = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            return ['status' => $status, 'body' => $body === false ? '' : (string) $body];
        }

        if (ini_get('allow_url_fopen')) {
            $context = stream_context_create(['http' => ['timeout' => 3, 'ignore_errors' => true]]);
            $body = @file_get_contents($url, false, $context);
            $status = 0;
            if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', (string) $http_response_header[0], $m)) {
                $status = (int) $m[1];
            }
            return ['status' => $status, 'body' => $body === false ? '' : (string) $body];
        }

        return null;
    }
}

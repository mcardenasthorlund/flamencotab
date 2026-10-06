<?php
declare(strict_types=1);

/**
 * Registro, login y autenticación mediante tokens firmados (HMAC-SHA256).
 *
 * El token codifica `appId`, `username` y `exp`, y va firmado con el secreto de
 * la configuración. El servidor deriva siempre el usuario del token, nunca del
 * cuerpo de la petición.
 */
final class Auth
{
    private const USERNAME_RE = '/^[a-zA-Z0-9_-]{3,32}$/';

    public function __construct(
        private Storage $storage,
        private array $config,
    ) {
    }

    /**
     * @return array{token: string, expiresAt: string, username: string}
     */
    public function register(string $appId, string $username, string $password): array
    {
        $this->assertApp($appId);
        if (!preg_match(self::USERNAME_RE, $username)) {
            Response::error(
                'Nombre de usuario no válido (3-32 caracteres: letras, números, guion o guion bajo)',
                422,
                'invalid_username'
            );
        }
        if (strlen($password) < 8) {
            Response::error('La contraseña debe tener al menos 8 caracteres', 422, 'weak_password');
        }

        $usersFile = $this->storage->usersFile($appId);

        return $this->storage->withLock($usersFile, function () use ($appId, $username, $password, $usersFile): array {
            $users = $this->storage->readJson($usersFile, []);
            if (!is_array($users)) {
                $users = [];
            }
            if (isset($users[$username])) {
                Response::error('El usuario ya existe', 409, 'user_exists');
            }
            $users[$username] = [
                'hash' => password_hash($password, $this->hashAlgo()),
                'createdAt' => gmdate('c'),
            ];
            $this->storage->writeJson($usersFile, $users);
            $this->storage->ensureUserDir($appId, $username);
            $this->storage->writeJson(
                $this->storage->metaFile($appId, $username),
                ['lastRev' => 0, 'createdAt' => gmdate('c')]
            );
            return $this->issueToken($appId, $username);
        });
    }

    /**
     * @return array{token: string, expiresAt: string, username: string}
     */
    public function login(string $appId, string $username, string $password): array
    {
        $this->assertApp($appId);
        $users = $this->storage->readJson($this->storage->usersFile($appId), []);
        $user = is_array($users) ? ($users[$username] ?? null) : null;
        if (!is_array($user) || !isset($user['hash']) || !password_verify($password, (string) $user['hash'])) {
            Response::error('Usuario o contraseña incorrectos', 401, 'invalid_credentials');
        }
        return $this->issueToken($appId, $username);
    }

    public function logout(): void
    {
        $token = $this->bearerToken();
        $payload = $this->verify($token);
        if ($payload === null) {
            return;
        }
        $this->revoke((string) $payload['appId'], $token, (int) $payload['exp']);
    }

    /**
     * @return array{appId: string, username: string}
     */
    public function authenticate(): array
    {
        $token = $this->bearerToken();
        $payload = $this->verify($token);
        if ($payload === null) {
            Response::error('No autenticado', 401, 'unauthenticated');
        }
        $appId = (string) $payload['appId'];
        $username = (string) $payload['username'];
        $this->assertApp($appId);
        if (!$this->userExists($appId, $username)) {
            Response::error('No autenticado', 401, 'unauthenticated');
        }
        if ($this->isRevoked($appId, $token)) {
            Response::error('Sesión cerrada', 401, 'revoked');
        }
        return ['appId' => $appId, 'username' => $username];
    }

    /** Elimina la cuenta: borra el usuario del registro y su carpeta de datos. */
    public function deleteAccount(string $appId, string $username): void
    {
        $usersFile = $this->storage->usersFile($appId);
        $this->storage->withLock($usersFile, function () use ($appId, $username, $usersFile): void {
            $users = $this->storage->readJson($usersFile, []);
            if (is_array($users) && isset($users[$username])) {
                unset($users[$username]);
                $this->storage->writeJson($usersFile, $users);
            }
        });
        $this->storage->deleteUserDir($appId, $username);
    }

    private function userExists(string $appId, string $username): bool
    {
        $users = $this->storage->readJson($this->storage->usersFile($appId), []);
        return is_array($users) && isset($users[$username]);
    }

    /**
     * @return array{token: string, expiresAt: string, username: string}
     */
    private function issueToken(string $appId, string $username): array
    {
        $ttl = (int) ($this->config['token_ttl'] ?? 2592000);
        $exp = time() + $ttl;
        $body = $this->b64((string) json_encode(
            [
                'appId' => $appId,
                'username' => $username,
                'exp' => $exp,
                // Nonce: garantiza tokens únicos aunque se emitan en el mismo segundo.
                'jti' => bin2hex(random_bytes(8)),
            ],
            JSON_UNESCAPED_UNICODE
        ));
        $sig = $this->b64(hash_hmac('sha256', $body, $this->secret(), true));
        return [
            'token' => $body . '.' . $sig,
            'expiresAt' => gmdate('c', $exp),
            'username' => $username,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }
        [$body, $sig] = $parts;
        $expected = $this->b64(hash_hmac('sha256', $body, $this->secret(), true));
        if (!hash_equals($expected, $sig)) {
            return null;
        }
        $decoded = base64_decode(strtr($body, '-_', '+/'), true);
        if ($decoded === false) {
            return null;
        }
        $payload = json_decode($decoded, true);
        if (!is_array($payload) || !isset($payload['exp']) || (int) $payload['exp'] < time()) {
            return null;
        }
        return $payload;
    }

    private function revoke(string $appId, string $token, int $exp): void
    {
        $file = $this->storage->revokedFile($appId);
        $this->storage->withLock($file, function () use ($file, $token, $exp): void {
            $list = $this->storage->readJson($file, []);
            if (!is_array($list)) {
                $list = [];
            }
            $now = time();
            $list = array_filter($list, static fn ($e): bool => (int) $e > $now);
            $list[hash('sha256', $token)] = $exp;
            $this->storage->writeJson($file, $list);
        });
    }

    private function isRevoked(string $appId, string $token): bool
    {
        $list = $this->storage->readJson($this->storage->revokedFile($appId), []);
        if (!is_array($list)) {
            return false;
        }
        $key = hash('sha256', $token);
        return isset($list[$key]) && (int) $list[$key] > time();
    }

    private function bearerToken(): string
    {
        $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if ($header === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $key => $value) {
                if (strcasecmp((string) $key, 'Authorization') === 0) {
                    $header = (string) $value;
                    break;
                }
            }
        }
        if (preg_match('/Bearer\s+(\S+)/i', $header, $m)) {
            return $m[1];
        }
        $alt = (string) ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? '');
        if ($alt !== '') {
            return $alt;
        }
        return (string) ($_GET['token'] ?? '');
    }

    private function assertApp(string $appId): void
    {
        $apps = $this->config['apps'] ?? [];
        if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $appId) || !in_array($appId, $apps, true)) {
            Response::error('Aplicación no autorizada', 403, 'invalid_app');
        }
    }

    private function secret(): string
    {
        $secret = (string) ($this->config['secret'] ?? '');
        if ($secret === '') {
            Response::error('Configuración incompleta', 500, 'no_secret');
        }
        return $secret;
    }

    /** Usa Argon2id si el sistema lo soporta; si no, el algoritmo por defecto. */
    private function hashAlgo(): string|int
    {
        return defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
    }

    private function b64(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }
}

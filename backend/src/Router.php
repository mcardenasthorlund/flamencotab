<?php
declare(strict_types=1);

/**
 * Enrutador mínimo de rutas exactas (método + ruta).
 */
final class Router
{
    /** @var array<string, array<string, callable>> */
    private array $routes = [];

    public function add(string $method, string $path, callable $handler): void
    {
        $this->routes[strtoupper($method)][$this->normalize($path)] = $handler;
    }

    public function dispatch(string $method, string $path): void
    {
        $path = $this->normalize($path);
        $handler = $this->routes[strtoupper($method)][$path] ?? null;
        if ($handler === null) {
            Response::error('Ruta no encontrada', 404, 'not_found');
        }
        $handler();
        Response::error('Ruta no encontrada', 404, 'not_found');
    }

    private function normalize(string $path): string
    {
        return '/' . trim($path, '/');
    }
}

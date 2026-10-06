<?php
declare(strict_types=1);

/**
 * Lógica de sincronización: pull/push con resolución Last-Write-Wins.
 *
 * `meta.php` de cada usuario mantiene un contador monotónico `lastRev` que
 * actúa como cursor incremental.
 */
final class Sync
{
    public function __construct(private Storage $storage)
    {
    }

    /**
     * @param string[] $collections
     * @return array{rev: int, changes: array<int, array<string, mixed>>}
     */
    public function pull(string $appId, string $username, int $since, array $collections): array
    {
        $meta = $this->storage->readJson($this->storage->metaFile($appId, $username), ['lastRev' => 0]);
        $rev = (int) (is_array($meta) ? ($meta['lastRev'] ?? 0) : 0);

        $changes = [];
        foreach ($collections as $collection) {
            if (!is_string($collection) || $collection === '') {
                continue;
            }
            foreach ($this->storage->listDocs($appId, $username, $collection) as $doc) {
                if ((int) ($doc['rev'] ?? 0) > $since) {
                    $changes[] = $doc;
                }
            }
        }

        return ['rev' => $rev, 'changes' => $changes];
    }

    /**
     * @param array<int, array<string, mixed>> $changes
     * @return array{rev: int, applied: string[], conflicts: array<int, array<string, mixed>>}
     */
    public function push(string $appId, string $username, array $changes): array
    {
        $metaFile = $this->storage->metaFile($appId, $username);

        return $this->storage->withLock($metaFile, function () use ($appId, $username, $changes, $metaFile): array {
            $meta = $this->storage->readJson($metaFile, ['lastRev' => 0]);
            if (!is_array($meta)) {
                $meta = ['lastRev' => 0];
            }
            $lastRev = (int) ($meta['lastRev'] ?? 0);

            $applied = [];
            $conflicts = [];
            $now = gmdate('c');

            foreach ($changes as $change) {
                if (!is_array($change)) {
                    continue;
                }
                $collection = (string) ($change['collection'] ?? '');
                $docId = (string) ($change['docId'] ?? '');
                if ($collection === '' || $docId === '') {
                    continue;
                }

                $file = $this->storage->docFile($appId, $username, $collection, $docId);
                $existing = $this->storage->readJson($file, null);
                $clientUpdated = (string) ($change['clientUpdatedAt'] ?? $now);

                // Last-Write-Wins: si el servidor tiene una versión más reciente,
                // gana el servidor y se devuelve como conflicto.
                if (is_array($existing) && (string) ($existing['updatedAt'] ?? '') > $clientUpdated) {
                    $conflicts[] = $existing;
                    continue;
                }

                $lastRev++;
                $doc = [
                    'docId' => $docId,
                    'collection' => $collection,
                    'rev' => $lastRev,
                    'updatedAt' => $now,
                    'deleted' => (bool) ($change['deleted'] ?? false),
                    'schemaVersion' => (int) ($change['schemaVersion'] ?? 1),
                    'payload' => $change['payload'] ?? null,
                ];
                $this->storage->writeJson($file, $doc);
                $applied[] = $docId;
            }

            $meta['lastRev'] = $lastRev;
            $this->storage->writeJson($metaFile, $meta);

            return ['rev' => $lastRev, 'applied' => $applied, 'conflicts' => $conflicts];
        });
    }
}

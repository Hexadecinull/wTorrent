<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');
require_auth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_out(get_torrents());
}

if ($method === 'POST') {
    require_csrf();

    $body   = body();
    $action = $body['action'] ?? '';

    if ($action === 'save') {
        $infoHash = trim($body['infoHash'] ?? '');

        if (empty($infoHash) || !preg_match('/^[a-fA-F0-9]{40}$/', $infoHash)) {
            json_out(['error' => 'Invalid info hash.'], 400);
        }

        $torrents = get_torrents();
        $index    = -1;

        foreach ($torrents as $i => $t) {
            if ($t['infoHash'] === $infoHash) {
                $index = $i;
                break;
            }
        }

        $entry = [
            'infoHash'   => $infoHash,
            'magnetURI'  => $body['magnetURI'] ?? '',
            'name'       => $body['name'] ?? '',
            'size'       => (int)($body['size'] ?? 0),
            'addedAt'    => (int)($body['addedAt'] ?? time() * 1000),
            'userPaused' => (bool)($body['userPaused'] ?? false),
        ];

        if ($index >= 0) {
            $torrents[$index] = $entry;
        } else {
            $torrents[] = $entry;
        }

        if (save_torrents($torrents)) {
            json_out(['ok' => true, 'torrent' => $entry]);
        }

        json_out(['error' => 'Failed to save torrent.'], 500);
    }

    if ($action === 'remove') {
        $infoHash = trim($body['infoHash'] ?? '');

        if (empty($infoHash)) {
            json_out(['error' => 'Missing info hash.'], 400);
        }

        $torrents = get_torrents();
        $torrents = array_filter($torrents, fn($t) => $t['infoHash'] !== $infoHash);

        if (save_torrents($torrents)) {
            json_out(['ok' => true]);
        }

        json_out(['error' => 'Failed to remove torrent.'], 500);
    }

    if ($action === 'update_paused') {
        $infoHash   = trim($body['infoHash'] ?? '');
        $userPaused = (bool)($body['userPaused'] ?? false);

        if (empty($infoHash)) {
            json_out(['error' => 'Missing info hash.'], 400);
        }

        $torrents = get_torrents();

        foreach ($torrents as &$t) {
            if ($t['infoHash'] === $infoHash) {
                $t['userPaused'] = $userPaused;
                break;
            }
        }
        unset($t);

        if (save_torrents($torrents)) {
            json_out(['ok' => true]);
        }

        json_out(['error' => 'Failed to update torrent.'], 500);
    }

    json_out(['error' => 'Invalid action.'], 400);
}

json_out(['error' => 'Method not allowed'], 405);

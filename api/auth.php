<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_out(['authenticated' => is_authenticated()]);
}

if ($method === 'POST') {
    $body = body();
    $action = $body['action'] ?? '';

    if ($action === 'logout') {
        require_auth();
        require_csrf();
        $_SESSION = [];
        session_destroy();
        json_out(['ok' => true]);
    }

    json_out(['error' => 'Invalid action'], 400);
}

json_out(['error' => 'Method not allowed'], 405);

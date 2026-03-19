<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');
require_auth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $settings = get_settings();
    unset($settings['password_hash']);
    json_out($settings);
}

if ($method === 'POST') {
    require_csrf();

    $body     = body();
    $settings = get_settings();
    $action   = $body['action'] ?? 'update';

    if ($action === 'change_password') {
        $current = $body['current_password'] ?? '';
        $new     = $body['new_password'] ?? '';
        $confirm = $body['confirm_password'] ?? '';

        if (!password_verify($current, $settings['password_hash'])) {
            json_out(['error' => 'Current password is incorrect.'], 400);
        }
        if (strlen($new) < 6) {
            json_out(['error' => 'New password must be at least 6 characters.'], 400);
        }
        if ($new !== $confirm) {
            json_out(['error' => 'Passwords do not match.'], 400);
        }

        $settings['password_hash'] = password_hash($new, PASSWORD_BCRYPT);
        save_settings($settings);
        json_out(['ok' => true, 'message' => 'Password updated.']);
    }

    $allowed = ['max_dl_speed', 'max_ul_speed', 'max_connections', 'enable_dht', 'enable_pex', 'enable_lsd', 'start_paused', 'refresh_interval'];

    foreach ($allowed as $key) {
        if (isset($body[$key])) {
            $settings[$key] = $body[$key];
        }
    }

    if (save_settings($settings)) {
        unset($settings['password_hash']);
        json_out(['ok' => true, 'settings' => $settings]);
    }

    json_out(['error' => 'Failed to save settings.'], 500);
}

json_out(['error' => 'Method not allowed'], 405);

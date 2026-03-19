<?php
define('APP_NAME', 'wTorrent');
define('APP_VERSION', '1.0.0');
define('DATA_DIR', __DIR__ . '/data');
define('SETTINGS_FILE', DATA_DIR . '/settings.json');
define('TORRENTS_FILE', DATA_DIR . '/torrents.json');

if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0755, true);
}

session_name('wtorrent_session');
session_set_cookie_params([
    'lifetime' => 604800,
    'path'     => '/',
    'secure'   => isset($_SERVER['HTTPS']),
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function is_authenticated(): bool
{
    return isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true;
}

function get_settings(): array
{
    $defaults = [
        'password_hash'    => password_hash('admin', PASSWORD_BCRYPT),
        'max_dl_speed'     => 0,
        'max_ul_speed'     => 0,
        'max_connections'  => 200,
        'enable_dht'       => true,
        'enable_pex'       => true,
        'enable_lsd'       => true,
        'start_paused'     => false,
        'refresh_interval' => 1500,
    ];

    if (!file_exists(SETTINGS_FILE)) {
        @file_put_contents(SETTINGS_FILE, json_encode($defaults, JSON_PRETTY_PRINT));
        return $defaults;
    }

    $raw = @file_get_contents(SETTINGS_FILE);
    $data = $raw ? json_decode($raw, true) : null;

    return is_array($data) ? array_merge($defaults, $data) : $defaults;
}

function save_settings(array $settings): bool
{
    return file_put_contents(SETTINGS_FILE, json_encode($settings, JSON_PRETTY_PRINT)) !== false;
}

function get_torrents(): array
{
    if (!file_exists(TORRENTS_FILE)) {
        return [];
    }

    $raw = @file_get_contents(TORRENTS_FILE);
    $data = $raw ? json_decode($raw, true) : null;

    return is_array($data) ? $data : [];
}

function save_torrents(array $torrents): bool
{
    return file_put_contents(TORRENTS_FILE, json_encode(array_values($torrents), JSON_PRETTY_PRINT)) !== false;
}

function csrf_valid(string $token): bool
{
    return hash_equals($_SESSION['csrf_token'] ?? '', $token);
}

function json_out(mixed $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function require_auth(): void
{
    if (!is_authenticated()) {
        json_out(['error' => 'Unauthorized'], 401);
    }
}

function require_csrf(): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!csrf_valid($token)) {
        json_out(['error' => 'Invalid CSRF token'], 403);
    }
}

function body(): array
{
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?? []) : [];
}

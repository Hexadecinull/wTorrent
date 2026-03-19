<?php
require_once __DIR__ . '/config.php';

if (is_authenticated()) {
    header('Location: /');
    exit;
}

$settings = get_settings();
$error    = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $attempts     = (int)($_SESSION['login_attempts'] ?? 0);
    $last_attempt = (int)($_SESSION['last_attempt'] ?? 0);

    if ($attempts >= 5 && (time() - $last_attempt) < 300) {
        $remaining = 300 - (time() - $last_attempt);
        $error = 'Too many failed attempts. Try again in ' . ceil($remaining / 60) . ' minute(s).';
    } else {
        if ((time() - $last_attempt) >= 300) {
            $attempts = 0;
            $_SESSION['login_attempts'] = 0;
        }

        $password = $_POST['password'] ?? '';

        if (!empty($password) && password_verify($password, $settings['password_hash'])) {
            $_SESSION['authenticated'] = true;
            $_SESSION['login_attempts'] = 0;
            session_regenerate_id(true);
            header('Location: /');
            exit;
        }

        $_SESSION['login_attempts'] = $attempts + 1;
        $_SESSION['last_attempt']   = time();
        $error = 'Incorrect password.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>wTorrent — Sign In</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="login-body">
    <div class="login-card">
        <div class="login-header">
            <div class="login-logo">wT</div>
            <h1>wTorrent</h1>
            <p>Authentication required</p>
        </div>
        <?php if ($error !== ''): ?>
            <div class="login-error" role="alert"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        <form method="POST" action="/login.php" autocomplete="on">
            <div class="form-field">
                <label for="password">Password</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    autofocus
                    autocomplete="current-password"
                    placeholder="Enter password"
                    required>
            </div>
            <button type="submit" class="btn btn-primary btn-full">Sign In</button>
        </form>
        <p class="login-hint">Default password is <code>admin</code>. Change it in Settings after first sign-in.</p>
    </div>
</body>
</html>

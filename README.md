# wTorrent

A self-hosted, browser-based torrent client modelled on qBittorrent. wTorrent runs entirely on standard PHP shared hosting with no server-side daemons, build tools, or databases required. Torrent activity is handled in the browser via WebTorrent and WebRTC; PHP provides authentication, settings persistence, and torrent-list storage.

---

## Requirements

- PHP 7.4 or later
- A web server with `mod_rewrite` enabled (Apache) or equivalent URL rewriting
- The `data/` directory must be writable by the web server process
- A modern browser with WebRTC support (Chrome, Firefox, Edge, Brave, Opera)

---

## Installation

1. Upload all project files to your hosting document root, preserving the directory structure.
2. Ensure `data/` is writable: `chmod 755 data/` or equivalent.
3. Navigate to your domain. You will be redirected to the login page.
4. Sign in with the default credentials (see below) and change the password immediately under Settings > Security.

No database setup, no dependency installation, and no build step is required.

---

## Default Credentials

| Field    | Value   |
|----------|---------|
| Password | `admin` |

Change this immediately after first login.

---

## Automatic Deployment from GitHub

The included workflow at `.github/workflows/deploy.yml` automatically pushes the repository to InfinityFree via FTP on every push to `main`.

To enable it:

1. Go to your repository on GitHub: **Settings > Secrets and variables > Actions**.
2. Add three repository secrets:

   | Secret name    | Value                                      |
   |----------------|--------------------------------------------|
   | `FTP_SERVER`   | Your InfinityFree FTP hostname             |
   | `FTP_USERNAME` | Your InfinityFree FTP username             |
   | `FTP_PASSWORD` | Your InfinityFree FTP password             |

3. Push a commit to `main`. The workflow will deploy all files except `.git/`, `.github/`, `data/`, and `docs/`.

The `data/` directory is intentionally excluded from deployment to prevent overwriting live settings and torrent state.

---

## Features

- Add torrents via magnet links or `.torrent` files
- Pause, resume, and remove individual or multiple torrents
- Per-torrent detail panel: general info, tracker list, connected peers, file list with per-file progress, speed chart
- Global download and upload speed limits
- DHT, PEX, and LSD toggle
- Configurable maximum peer connections
- Auto-start paused option
- Configurable UI refresh interval
- Password-protected access with bcrypt hashing
- CSRF protection on all state-mutating requests
- Persistent torrent list across page reloads (stored server-side as JSON)

---

## Browser Compatibility

| Browser         | Support |
|-----------------|---------|
| Chrome 80+      | Full    |
| Firefox 75+     | Full    |
| Edge 80+        | Full    |
| Brave           | Full    |
| Opera 67+       | Full    |
| Safari 15.4+    | Partial (WebRTC constraints) |
| Mobile browsers | Limited |

---

## Limitations

- **The browser tab must remain open** for downloads to progress. Closing the tab pauses all activity. This is a fundamental constraint of browser-based torrenting.
- wTorrent connects only to **WebRTC-capable peers**. It cannot connect to peers that do not support WebRTC, which is the majority of the classic BitTorrent network. Connectivity depends on the availability of WebRTC-enabled peers for the given torrent.
- Downloaded files are stored in **browser memory** (IndexedDB via WebTorrent). They must be saved to disk from the Content tab before closing the tab, or they will be lost.
- PHP scripts on shared hosting have a maximum execution time (typically 30 seconds). The PHP layer is used only for short-lived API calls and is not affected by download duration.
- InfinityFree and similar free hosts impose inode and storage limits. The `data/` directory stores only small JSON files and is not used for torrent data.

---

## Security Notes

- The `data/` directory is protected by `.htaccess` and returns 403 for all direct HTTP requests.
- `config.php` is blocked from direct access.
- All API endpoints require a valid session and a CSRF token.
- Passwords are stored as bcrypt hashes; plaintext passwords are never written to disk.
- Rate limiting (5 failed attempts per 5 minutes) is enforced on the login form using PHP sessions.

---

## License

GNU General Public License v3.0. See `LICENSE` for the full text.

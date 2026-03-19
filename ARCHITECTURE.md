# wTorrent — Architecture Reference

## Overview

wTorrent is a two-layer application. The browser layer handles all torrent activity; the server layer handles authentication, settings, and persistence. No server-side torrent daemon exists; PHP is used exclusively for short-lived HTTP request handlers.

---

## Component Diagram

```
Browser
├── app.js          Bootstrap and orchestration
├── engine.js       WebTorrent client wrapper (IIFE: Engine)
├── ui.js           DOM rendering and event handling (IIFE: UI)
└── api.js          Fetch wrapper for PHP API calls (IIFE: API)
        │
        │ HTTP (JSON, CSRF-protected)
        ▼
PHP (Apache / InfinityFree)
├── config.php      Constants, session, helper functions
├── index.php       Main application shell (auth guard + HTML)
├── login.php       Login form and credential validation
└── api/
    ├── auth.php        Session status and logout
    ├── settings.php    Read and write user settings
    └── torrents.php    Persist torrent list (save, remove, update)
        │
        ▼
data/  (writable directory, blocked from HTTP)
├── settings.json   Persisted settings object
└── torrents.json   Persisted torrent metadata array
```

---

## PHP API Endpoints

| Method | Path                | Auth | CSRF | Description                            |
|--------|---------------------|------|------|----------------------------------------|
| GET    | /api/auth.php       | No   | No   | Returns `{authenticated: bool}`        |
| POST   | /api/auth.php       | Yes  | Yes  | `action=logout`: destroys session      |
| GET    | /api/settings.php   | Yes  | No   | Returns settings object (no hash)      |
| POST   | /api/settings.php   | Yes  | Yes  | Update settings or change password     |
| GET    | /api/torrents.php   | Yes  | No   | Returns torrent list array             |
| POST   | /api/torrents.php   | Yes  | Yes  | `action=save`, `remove`, `update_paused` |

All POST endpoints expect `Content-Type: application/json` and an `X-CSRF-Token` header. A 401 response from any endpoint causes the browser to redirect to `/login.php`.

---

## JavaScript Modules

### engine.js (IIFE: Engine)

Wraps the WebTorrent client. Exposes:

- `init(cfg)` — Creates the WebTorrent instance with settings from `window.__wt_config`.
- `add(source, opts)` — Adds a magnet URI or `.torrent` file buffer. Returns a Promise that resolves once metadata is ready. Deduplicates by infoHash.
- `remove(infoHash, destroyStore)` — Destroys the torrent and optionally wipes IndexedDB storage.
- `pause(infoHash)` / `resume(infoHash)` — Calls WebTorrent's native pause/resume and tracks the user-set paused state.
- `getAll()` — Returns an array of plain objects describing each torrent (infoHash, progress, speeds, peers, files, status string, etc.).
- `getGlobalStats()` — Returns aggregate speeds and total counts.
- `applySpeedLimits(dl, ul)` — Applies throttle objects to all active torrents.
- `downloadFile(infoHash, fileIndex)` — Produces a blob URL and triggers a browser download.

Status derivation order: `paused` → `errored` → `checking` (not ready) → `seeding` (done) → `downloading` (speed > 0) → `inactive`.

### ui.js (IIFE: UI)

Handles all DOM manipulation. Exposes:

- `init(onAdd, onRemove, onPause, onResume, onSettings, onLogout)` — Wires all event listeners. Accepts callback functions from `app.js`; the UI module itself has no knowledge of the engine or API.
- `renderList(torrents)` — Applies the active filter, sorts, and rebuilds the torrent table.
- `renderDetailPanel()` — Redraws the active tab of the detail panel for the selected torrent.
- `renderStatusBar(stats)` — Updates the footer counters and global speed display.
- `openModal(id)` / `closeModal(id)` — Shows and hides modal overlays.
- `loadSettingsIntoForm(s)` / `collectSettingsFromForm()` — Syncs the settings modal with the live settings object.

### api.js (IIFE: API)

A thin async fetch wrapper. All POST calls include `X-CSRF-Token` from `window.__wt_csrf`. A 401 response triggers an immediate redirect. Exposes: `getSettings`, `saveSettings`, `changePassword`, `getTorrents`, `saveTorrent`, `removeTorrent`, `updatePaused`, `logout`.

### app.js

The bootstrap entry point. Runs as a top-level async IIFE. Sequence:

1. Read `window.__wt_config` (emitted by `index.php`).
2. Call `Engine.init(cfg)`.
3. Load saved torrents from `API.getTorrents()` and re-add each via `Engine.add()`.
4. Call `UI.init()` with bound callback functions.
5. Run an initial `tick()`.
6. Start the refresh interval (`setInterval(tick, refreshInterval)`).

---

## Data Flow

### Adding a torrent

```
User pastes magnet / drops .torrent
  → UI fires onAdd(source, opts)
    → Engine.add(source) → WebTorrent resolves with torrent object
      → API.saveTorrent(metadata) → POST /api/torrents.php action=save
        → tick() re-renders the list
```

### Refresh cycle

```
setInterval(tick, N ms)
  → Engine.getAll()           — snapshot of WebTorrent state
  → UI.renderList(torrents)   — rebuild table + sidebar counts
  → UI.renderDetailPanel()    — rebuild detail tabs
  → UI.renderStatusBar(stats) — update footer
```

---

## Security Model

- **Session**: PHP session with `httponly`, `samesite=Strict`, 7-day lifetime. Regenerated on login.
- **CSRF**: A 64-character hex token is generated once per session and stored in `$_SESSION['csrf_token']`. Every mutating POST must supply it in the `X-CSRF-Token` header. Verified with `hash_equals` to prevent timing attacks.
- **Password storage**: bcrypt via `password_hash(..., PASSWORD_BCRYPT)`. Plaintext is never written anywhere.
- **Rate limiting**: Five failed login attempts within five minutes triggers a session-level lockout.
- **Data directory**: Protected by a dedicated `.htaccess` that returns 403 for all requests. `config.php` is also blocked from direct HTTP access.
- **Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: same-origin` are set globally via the root `.htaccess`.

---

## Storage Format

### data/settings.json

```json
{
    "password_hash": "<bcrypt>",
    "max_dl_speed": 0,
    "max_ul_speed": 0,
    "max_connections": 200,
    "enable_dht": true,
    "enable_pex": true,
    "enable_lsd": true,
    "start_paused": false,
    "refresh_interval": 1500
}
```

Speed values are in KB/s; 0 means unlimited. `refresh_interval` is in milliseconds.

### data/torrents.json

```json
[
    {
        "infoHash": "<40-char hex>",
        "magnetURI": "magnet:?xt=urn:btih:...",
        "name": "Example Torrent",
        "size": 1073741824,
        "addedAt": 1710000000000,
        "userPaused": false
    }
]
```

`addedAt` is a Unix timestamp in milliseconds. `size` is in bytes. Only metadata is stored; torrent data lives in the browser's IndexedDB.

---

## Hosting Constraints (InfinityFree)

- No persistent processes; PHP runs only during HTTP requests.
- No Node.js, no WebSockets, no server-side torrent processing.
- 5 GB storage, 30 000 inode limit; the `data/` directory stores only small JSON files.
- 10 MB maximum upload size; not relevant to torrent data (stored client-side).
- `mod_rewrite` is available; the root `.htaccess` uses it for security rules.

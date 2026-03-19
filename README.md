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
2. Make `data/` writable. InfinityFree does not provide SSH access, so this must be done through the control panel: log in to the InfinityFree client area, open **File Manager** (under the Hosting panel), navigate to your `htdocs/data` folder, right-click it, select **Change Permissions**, and set the value to `755`. If you are on a different host that does provide SSH, run `chmod 755 data/` from the document root.
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

1. Go to your repository on GitHub: **Settings > Secrets and variables > Actions > Repository secrets**.
2. Add three secrets (use the Secrets tab, not Variables — the workflow references `secrets.*` and will fail silently if these are added as variables instead):

   | Secret name    | Value                                      |
   |----------------|--------------------------------------------|
   | `FTP_SERVER`   | Your InfinityFree FTP hostname             |
   | `FTP_USERNAME` | Your InfinityFree FTP username             |
   | `FTP_PASSWORD` | Your InfinityFree FTP password             |

3. Push a commit to `main`. The workflow will deploy all files except `.git/`, `.github/`, and `data/`.

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

### Session and persistence

- **The browser tab must remain open** for any torrent activity to continue. Closing or navigating away from the tab terminates all active connections and halts all downloads and uploads immediately. There is no background process or service worker that can maintain the session. This is a fundamental architectural constraint of running a torrent client inside a browser.
- **Downloaded data is held in browser storage** (IndexedDB, managed by WebTorrent). It is not written to the server. Files must be explicitly saved to disk from the Content tab while the tab is still open. If the tab is closed before saving, the downloaded data is lost and the torrent must be re-downloaded from the beginning.
- **Seeding does not persist across sessions.** When the tab is closed, all upload activity stops. On re-opening the application, torrents marked as completed will attempt to resume seeding, but only to WebRTC-capable peers.
- **The torrent list is persistent, but data is not.** wTorrent saves torrent metadata (magnet URI, name, size, paused state) to the server so the list survives page reloads. The actual piece data does not. For completed torrents the piece data remains in IndexedDB until the browser clears it; for incomplete torrents a reload resumes the download from the pieces already cached in IndexedDB.

### WebRTC peer connectivity

This is the most significant practical limitation of any browser-based torrent client and warrants detailed explanation.

**Why classic peers are unreachable.** The standard BitTorrent protocol communicates over TCP and UDP, using either the standard BitTorrent TCP transport or the uTP (Micro Transport Protocol) extension over UDP. Browsers have no access to raw TCP or UDP sockets. WebTorrent works around this by transporting BitTorrent over WebRTC DataChannels, which is an entirely different underlying transport. A peer running qBittorrent, Transmission, or any other conventional client cannot speak WebRTC and is therefore invisible to wTorrent. Estimates of the WebRTC-capable fraction of the BitTorrent network are consistently below one percent.

**Tracker compatibility.** Standard BitTorrent trackers communicate over HTTP, HTTPS, or UDP. WebTorrent requires trackers that support the WebSocket protocol (`wss://`). Most public and private trackers do not. WebTorrent ships with a small set of known public WebSocket trackers which are used by default; if none of those trackers serve peers for a given torrent, the swarm will be empty regardless of how many conventional peers exist. Adding the torrent's existing trackers to a magnet link has no effect if those trackers do not have a WebSocket endpoint.

**DHT limitations.** WebTorrent implements a WebRTC-specific DHT that operates over the same DataChannel transport. It cannot query or respond to nodes in the main BitTorrent DHT, which runs over UDP. Enabling DHT in wTorrent will find other WebTorrent clients in the WebRTC DHT but will not surface peers from the standard distributed hash table that conventional clients use.

**NAT traversal.** WebRTC uses ICE (Interactive Connectivity Establishment) with STUN to punch through NAT. wTorrent relies on the STUN servers bundled with WebTorrent. In networks where UDP is blocked (some corporate or institutional firewalls), ICE negotiation will fail and no peer connections will be established. TURN relay servers, which can work around strict firewalls, are not configured by default because they require a separately hosted TURN server.

**Safari and mobile browsers.** Safari's WebRTC implementation has historically imposed tighter constraints on DataChannel usage and has had intermittent compatibility issues with WebTorrent. Functionality is possible but not guaranteed. Mobile browsers face the additional constraint that the operating system may suspend the tab when it is backgrounded, terminating all connections.

**Practical consequence.** wTorrent works best with torrents that have an active community of WebTorrent users, or torrents that include direct HTTP or HTTPS web seeds. Web seeds bypass the peer connectivity problem entirely since they are fetched over standard HTTP. A torrent with no web seeds and no WebRTC peers will stall at zero progress regardless of the size of the conventional swarm.

### Feature scope

- **No torrent creation.** wTorrent cannot produce `.torrent` files.
- **No RSS feed support.** Automatic torrent addition from RSS or Atom feeds is not implemented.
- **No IP filtering or blocklist.** Peer IP blocklists (such as those used to exclude known bad actors) are not supported.
- **No file priority selection.** Files within a torrent cannot be individually prioritised or excluded from download. All files in a torrent are downloaded.
- **No sequential download mode.** Pieces are not fetched in sequential order. Media files cannot be streamed progressively while downloading.
- **No bandwidth scheduling.** The alternate speed limit and schedule settings visible in qBittorrent are not implemented. Speed limits are applied globally and statically.
- **No categories or tags.** The category and tag columns are present in the interface but are not populated. Organisational grouping of torrents is not supported.
- **Single-user only.** Authentication supports one password. There is no concept of multiple user accounts or per-user permissions.
- **Large torrents strain browser memory.** Because piece data is held in IndexedDB and partially in memory, torrents in the range of several tens of gigabytes may cause the browser to exhaust available memory, particularly on devices with limited RAM. This is a constraint of the browser sandbox, not of wTorrent specifically.

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

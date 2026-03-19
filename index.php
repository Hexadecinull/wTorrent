<?php
require_once __DIR__ . '/config.php';

if (!is_authenticated()) {
    header('Location: /login.php');
    exit;
}

$settings = get_settings();
$csrf     = $_SESSION['csrf_token'];

$client_settings = json_encode([
    'maxDlSpeed'      => (int)$settings['max_dl_speed'],
    'maxUlSpeed'      => (int)$settings['max_ul_speed'],
    'maxConnections'  => (int)$settings['max_connections'],
    'enableDht'       => (bool)$settings['enable_dht'],
    'enablePex'       => (bool)$settings['enable_pex'],
    'enableLsd'       => (bool)$settings['enable_lsd'],
    'startPaused'     => (bool)$settings['start_paused'],
    'refreshInterval' => (int)$settings['refresh_interval'],
], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars($csrf, ENT_QUOTES) ?>">
    <title>wTorrent</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>

<header class="toolbar" id="toolbar">
    <div class="toolbar-brand">
        <span class="brand-mark">wT</span>
        <span class="brand-name">wTorrent</span>
    </div>
    <div class="toolbar-actions">
        <button class="btn btn-icon-label" id="btn-add" title="Add Torrent (Ctrl+N)">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            Add Torrent
        </button>
        <div class="toolbar-sep"></div>
        <button class="btn btn-icon" id="btn-resume" title="Resume (Space)" disabled>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M3 1.5l8 5-8 5V1.5z" fill="currentColor"/></svg>
        </button>
        <button class="btn btn-icon" id="btn-pause" title="Pause (Space)" disabled>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><rect x="2" y="2" width="3.5" height="9" rx="0.8" fill="currentColor"/><rect x="7.5" y="2" width="3.5" height="9" rx="0.8" fill="currentColor"/></svg>
        </button>
        <div class="toolbar-sep"></div>
        <button class="btn btn-icon" id="btn-remove" title="Remove (Delete)" disabled>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M1.5 3.5h10M4.5 3.5V2h4v1.5M5.5 6v4.5M7.5 6v4.5M2.5 3.5L3.2 11a.5.5 0 00.498.5h5.604A.5.5 0 009.8 11l.7-7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="toolbar-sep"></div>
        <button class="btn btn-icon" id="btn-settings" title="Settings">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M6.5 1v1.2M6.5 10.8V12M1 6.5h1.2M10.8 6.5H12M2.4 2.4l.85.85M9.75 9.75l.85.85M2.4 10.6l.85-.85M9.75 3.25l.85-.85" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </button>
        <button class="btn btn-icon" id="btn-logout" title="Sign Out">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M4.5 11H2.5a.5.5 0 01-.5-.5v-8A.5.5 0 012.5 2h2M9 9l2.5-2.5L9 4M11.5 6.5H5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
    </div>
</header>

<div class="app-body">
    <aside class="sidebar" id="sidebar">
        <nav class="sidebar-nav" aria-label="Filter torrents">
            <span class="sidebar-group-label">Status</span>
            <button class="sidebar-item active" data-filter="all">
                <span class="si-indicator si-all"></span>
                <span class="si-label">All</span>
                <span class="si-count" id="cnt-all">0</span>
            </button>
            <button class="sidebar-item" data-filter="downloading">
                <span class="si-indicator si-downloading"></span>
                <span class="si-label">Downloading</span>
                <span class="si-count" id="cnt-downloading">0</span>
            </button>
            <button class="sidebar-item" data-filter="seeding">
                <span class="si-indicator si-seeding"></span>
                <span class="si-label">Seeding</span>
                <span class="si-count" id="cnt-seeding">0</span>
            </button>
            <button class="sidebar-item" data-filter="completed">
                <span class="si-indicator si-completed"></span>
                <span class="si-label">Completed</span>
                <span class="si-count" id="cnt-completed">0</span>
            </button>
            <button class="sidebar-item" data-filter="paused">
                <span class="si-indicator si-paused"></span>
                <span class="si-label">Paused</span>
                <span class="si-count" id="cnt-paused">0</span>
            </button>
            <button class="sidebar-item" data-filter="active">
                <span class="si-indicator si-active"></span>
                <span class="si-label">Active</span>
                <span class="si-count" id="cnt-active">0</span>
            </button>
            <button class="sidebar-item" data-filter="inactive">
                <span class="si-indicator si-inactive"></span>
                <span class="si-label">Inactive</span>
                <span class="si-count" id="cnt-inactive">0</span>
            </button>
            <button class="sidebar-item" data-filter="errored">
                <span class="si-indicator si-errored"></span>
                <span class="si-label">Errored</span>
                <span class="si-count" id="cnt-errored">0</span>
            </button>
        </nav>
    </aside>

    <main class="content-area">
        <div class="torrent-list-wrap" id="torrent-list-wrap">
            <table class="torrent-table" id="torrent-table" role="grid">
                <colgroup>
                    <col class="col-name">
                    <col class="col-size">
                    <col class="col-done">
                    <col class="col-bar">
                    <col class="col-status">
                    <col class="col-seeds">
                    <col class="col-peers">
                    <col class="col-dl">
                    <col class="col-ul">
                    <col class="col-eta">
                    <col class="col-ratio">
                </colgroup>
                <thead>
                    <tr>
                        <th class="sortable th-name" data-col="name">Name <span class="sort-icon"></span></th>
                        <th class="sortable th-size" data-col="size">Size <span class="sort-icon"></span></th>
                        <th class="sortable th-done" data-col="done">Done <span class="sort-icon"></span></th>
                        <th class="th-bar">Progress</th>
                        <th class="sortable th-status" data-col="status">Status <span class="sort-icon"></span></th>
                        <th class="sortable th-seeds" data-col="seeds">Seeds <span class="sort-icon"></span></th>
                        <th class="sortable th-peers" data-col="peers">Peers <span class="sort-icon"></span></th>
                        <th class="sortable th-dl" data-col="dl">Down Speed <span class="sort-icon"></span></th>
                        <th class="sortable th-ul" data-col="ul">Up Speed <span class="sort-icon"></span></th>
                        <th class="sortable th-eta" data-col="eta">ETA <span class="sort-icon"></span></th>
                        <th class="sortable th-ratio" data-col="ratio">Ratio <span class="sort-icon"></span></th>
                    </tr>
                </thead>
                <tbody id="torrent-tbody"></tbody>
            </table>
            <div class="empty-state" id="empty-state">
                <p class="empty-title">No torrents</p>
                <p class="empty-sub">Click <strong>Add Torrent</strong> or drag a .torrent file anywhere on the page.</p>
            </div>
        </div>

        <div class="detail-panel" id="detail-panel">
            <div class="detail-tabs" role="tablist">
                <button class="detail-tab active" data-tab="general" role="tab" aria-selected="true">General</button>
                <button class="detail-tab" data-tab="trackers" role="tab" aria-selected="false">Trackers</button>
                <button class="detail-tab" data-tab="peers" role="tab" aria-selected="false">Peers</button>
                <button class="detail-tab" data-tab="content" role="tab" aria-selected="false">Content</button>
                <button class="detail-tab" data-tab="speed" role="tab" aria-selected="false">Speed</button>
            </div>
            <div class="detail-body" id="detail-body">
                <div class="detail-placeholder">Select a torrent to view its details.</div>
            </div>
        </div>
    </main>
</div>

<footer class="status-bar">
    <span class="sb-item" id="sb-dht">DHT: —</span>
    <span class="sb-sep"></span>
    <span class="sb-item sb-mono" id="sb-dl">&#8595; 0 B/s</span>
    <span class="sb-sep"></span>
    <span class="sb-item sb-mono" id="sb-ul">&#8593; 0 B/s</span>
    <span class="sb-sep"></span>
    <span class="sb-item" id="sb-active">0 active</span>
    <span class="sb-sep"></span>
    <span class="sb-item sb-right" id="sb-version">wTorrent <?= APP_VERSION ?></span>
</footer>

<div class="modal-backdrop" id="modal-add" hidden role="dialog" aria-modal="true" aria-labelledby="title-add">
    <div class="modal">
        <div class="modal-header">
            <h2 id="title-add">Add Torrent</h2>
            <button class="modal-close" data-close="modal-add" aria-label="Close">&#10005;</button>
        </div>
        <div class="modal-body">
            <div class="tab-strip">
                <button class="tab-strip-btn active" data-panel="panel-magnet">Magnet Link</button>
                <button class="tab-strip-btn" data-panel="panel-file">Torrent File</button>
            </div>
            <div id="panel-magnet" class="tab-panel active">
                <div class="form-field">
                    <label for="magnet-input">Magnet URI or Info Hash</label>
                    <textarea id="magnet-input" rows="3" placeholder="magnet:?xt=urn:btih:...&#10;or paste multiple, one per line" spellcheck="false"></textarea>
                </div>
            </div>
            <div id="panel-file" class="tab-panel">
                <div class="dropzone" id="dropzone">
                    <div class="dropzone-inner">
                        <div class="dropzone-icon">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 4v18M9 15l7 7 7-7M4 24v3a1 1 0 001 1h22a1 1 0 001-1v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                        <p>Drop .torrent file here</p>
                        <span class="dropzone-or">or</span>
                        <label class="btn btn-secondary" for="file-input">Browse</label>
                        <input type="file" id="file-input" accept=".torrent" hidden>
                    </div>
                </div>
                <p class="file-selected-name" id="file-selected-name"></p>
            </div>
            <div class="add-opts">
                <label class="check-label">
                    <input type="checkbox" id="opt-paused">
                    <span>Start paused</span>
                </label>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" data-close="modal-add">Cancel</button>
            <button class="btn btn-primary" id="btn-add-confirm">Add Torrent</button>
        </div>
    </div>
</div>

<div class="modal-backdrop" id="modal-settings" hidden role="dialog" aria-modal="true" aria-labelledby="title-settings">
    <div class="modal modal-lg">
        <div class="modal-header">
            <h2 id="title-settings">Settings</h2>
            <button class="modal-close" data-close="modal-settings" aria-label="Close">&#10005;</button>
        </div>
        <div class="modal-body modal-body-split">
            <div class="settings-nav">
                <button class="sn-item active" data-sp="sp-speed">Speed</button>
                <button class="sn-item" data-sp="sp-connection">Connection</button>
                <button class="sn-item" data-sp="sp-bittorrent">BitTorrent</button>
                <button class="sn-item" data-sp="sp-ui">Interface</button>
                <button class="sn-item" data-sp="sp-security">Security</button>
            </div>
            <div class="settings-body">
                <div id="sp-speed" class="sp active">
                    <h3>Transfer Speed Limits</h3>
                    <div class="form-row">
                        <div class="form-field">
                            <label for="s-dl">Download Limit</label>
                            <div class="input-group">
                                <input type="number" id="s-dl" min="0" value="0">
                                <span class="input-addon">KB/s</span>
                            </div>
                            <span class="form-hint">0 disables the limit</span>
                        </div>
                        <div class="form-field">
                            <label for="s-ul">Upload Limit</label>
                            <div class="input-group">
                                <input type="number" id="s-ul" min="0" value="0">
                                <span class="input-addon">KB/s</span>
                            </div>
                            <span class="form-hint">0 disables the limit</span>
                        </div>
                    </div>
                </div>
                <div id="sp-connection" class="sp">
                    <h3>Peer Connections</h3>
                    <div class="form-field">
                        <label for="s-maxconn">Maximum Connected Peers</label>
                        <input type="number" id="s-maxconn" min="1" max="1000" value="200">
                    </div>
                </div>
                <div id="sp-bittorrent" class="sp">
                    <h3>Protocol</h3>
                    <label class="check-label"><input type="checkbox" id="s-dht" checked><span>Enable DHT (Distributed Hash Table)</span></label>
                    <label class="check-label"><input type="checkbox" id="s-pex" checked><span>Enable Peer Exchange (PEX)</span></label>
                    <label class="check-label"><input type="checkbox" id="s-lsd" checked><span>Enable Local Service Discovery (LSD)</span></label>
                    <label class="check-label"><input type="checkbox" id="s-start-paused"><span>Add new torrents in paused state by default</span></label>
                </div>
                <div id="sp-ui" class="sp">
                    <h3>Display</h3>
                    <div class="form-field">
                        <label for="s-refresh">Refresh Interval</label>
                        <div class="input-group">
                            <input type="number" id="s-refresh" min="500" max="10000" step="100" value="1500">
                            <span class="input-addon">ms</span>
                        </div>
                        <span class="form-hint">How often the torrent list updates (500–10000)</span>
                    </div>
                </div>
                <div id="sp-security" class="sp">
                    <h3>Change Password</h3>
                    <div class="form-field">
                        <label for="s-cur-pass">Current Password</label>
                        <input type="password" id="s-cur-pass" autocomplete="current-password">
                    </div>
                    <div class="form-field">
                        <label for="s-new-pass">New Password</label>
                        <input type="password" id="s-new-pass" autocomplete="new-password">
                    </div>
                    <div class="form-field">
                        <label for="s-conf-pass">Confirm New Password</label>
                        <input type="password" id="s-conf-pass" autocomplete="new-password">
                    </div>
                    <p class="pass-msg" id="pass-msg"></p>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" data-close="modal-settings">Cancel</button>
            <button class="btn btn-primary" id="btn-settings-save">Apply Settings</button>
        </div>
    </div>
</div>

<div class="modal-backdrop" id="modal-remove" hidden role="dialog" aria-modal="true" aria-labelledby="title-remove">
    <div class="modal modal-sm">
        <div class="modal-header">
            <h2 id="title-remove">Remove Torrent</h2>
            <button class="modal-close" data-close="modal-remove" aria-label="Close">&#10005;</button>
        </div>
        <div class="modal-body">
            <p id="remove-msg">Are you sure you want to remove the selected torrent(s)?</p>
            <label class="check-label" style="margin-top:14px">
                <input type="checkbox" id="opt-delete-data">
                <span>Delete data from browser storage</span>
            </label>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" data-close="modal-remove">Cancel</button>
            <button class="btn btn-danger" id="btn-remove-confirm">Remove</button>
        </div>
    </div>
</div>

<div class="ctx-menu" id="ctx-menu" hidden role="menu">
    <button class="ctx-item" data-action="resume" role="menuitem">Resume</button>
    <button class="ctx-item" data-action="pause" role="menuitem">Pause</button>
    <div class="ctx-sep" role="separator"></div>
    <button class="ctx-item" data-action="copy-magnet" role="menuitem">Copy Magnet Link</button>
    <button class="ctx-item" data-action="recheck" role="menuitem">Force Re-check</button>
    <div class="ctx-sep" role="separator"></div>
    <button class="ctx-item ctx-danger" data-action="remove" role="menuitem">Remove</button>
</div>

<script>window.__wt_config = <?= $client_settings ?>;</script>
<script src="https://cdn.jsdelivr.net/npm/webtorrent@1.9.7/webtorrent.min.js"></script>
<script src="/assets/js/api.js"></script>
<script src="/assets/js/engine.js"></script>
<script src="/assets/js/ui.js"></script>
<script src="/assets/js/app.js"></script>
</body>
</html>

'use strict';

(async () => {
    const cfg = window.__wt_config || {};
    let refreshTimer = null;
    let currentSettings = { ...cfg };

    try {
        Engine.init(cfg);
    } catch (err) {
        document.body.innerHTML = '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0f0f11;color:#e05252;font-family:sans-serif;font-size:14px;text-align:center;padding:40px">' +
            '<div><strong>wTorrent failed to initialise.</strong><br><br>' +
            'The WebTorrent library could not be loaded. Check your internet connection and reload the page.<br><br>' +
            '<small style="color:#666">' + (err.message || err) + '</small></div></div>';
        return;
    }

    function startRefresh() {
        if (refreshTimer) clearInterval(refreshTimer);
        const interval = Math.max(500, currentSettings.refreshInterval || 1500);
        refreshTimer = setInterval(tick, interval);
    }

    function tick() {
        const torrents = Engine.getAll();
        UI.renderList(torrents);
        UI.renderDetailPanel();
        UI.renderStatusBar(Engine.getGlobalStats());
    }

    async function onAdd(source, opts = {}) {
        try {
            const paused = opts.paused !== undefined ? !!opts.paused : !!currentSettings.startPaused;
            let src = source;
            if (source instanceof File) {
                src = new Uint8Array(await source.arrayBuffer());
            }
            const torrent = await Engine.add(src, { paused });
            await API.saveTorrent({
                infoHash:   torrent.infoHash,
                magnetURI:  torrent.magnetURI,
                name:       torrent.name || torrent.infoHash,
                size:       torrent.length || 0,
                addedAt:    Date.now(),
                userPaused: paused,
            });
            tick();
        } catch (err) {
            console.error('[wTorrent] add failed', err);
        }
    }

    async function onRemove(infoHash, destroyStore) {
        Engine.remove(infoHash, destroyStore);
        try { await API.removeTorrent(infoHash); } catch (_) {}
        tick();
    }

    async function onPause(infoHash) {
        Engine.pause(infoHash);
        try { await API.updatePaused(infoHash, true); } catch (_) {}
        tick();
    }

    async function onResume(infoHash) {
        Engine.resume(infoHash);
        try { await API.updatePaused(infoHash, false); } catch (_) {}
        tick();
    }

    async function onSettings(action) {
        if (action === 'save') {
            const activePanel = document.querySelector('.sp.active');
            if (activePanel && activePanel.id === 'sp-security') {
                const cur  = document.getElementById('s-cur-pass').value;
                const nw   = document.getElementById('s-new-pass').value;
                const conf = document.getElementById('s-conf-pass').value;
                const msg  = document.getElementById('pass-msg');
                msg.textContent = '';
                msg.className   = 'pass-msg';
                try {
                    await API.changePassword(cur, nw, conf);
                    msg.textContent = 'Password changed successfully.';
                    msg.classList.add('pass-ok');
                    document.getElementById('s-cur-pass').value  = '';
                    document.getElementById('s-new-pass').value  = '';
                    document.getElementById('s-conf-pass').value = '';
                } catch (err) {
                    msg.textContent = err.message || 'Failed to change password.';
                    msg.classList.add('pass-err');
                }
                return;
            }

            const patch = UI.collectSettingsFromForm();
            try {
                await API.saveSettings(patch);
                currentSettings = Object.assign({}, currentSettings, {
                    maxDlSpeed:      patch.max_dl_speed,
                    maxUlSpeed:      patch.max_ul_speed,
                    maxConnections:  patch.max_connections,
                    enableDht:       patch.enable_dht,
                    enablePex:       patch.enable_pex,
                    enableLsd:       patch.enable_lsd,
                    startPaused:     patch.start_paused,
                    refreshInterval: patch.refresh_interval,
                });
                Engine.applySpeedLimits(patch.max_dl_speed, patch.max_ul_speed);
                startRefresh();
                UI.closeModal('modal-settings');
            } catch (err) {
                console.error('[wTorrent] save settings failed', err);
            }
            return;
        }

        try {
            const s = await API.getSettings();
            UI.loadSettingsIntoForm(s);
        } catch (_) {}
        UI.openModal('modal-settings');
    }

    async function onLogout() {
        try { await API.logout(); } catch (_) {}
        window.location.href = '/login.php';
    }

    try {
        const saved = await API.getTorrents();
        if (Array.isArray(saved)) {
            for (const entry of saved) {
                if (entry.magnetURI) {
                    Engine.add(entry.magnetURI, {
                        addedAt: entry.addedAt,
                        paused:  !!entry.userPaused,
                    }).catch(() => {});
                }
            }
        }
    } catch (_) {}

    UI.init(onAdd, onRemove, onPause, onResume, onSettings, onLogout);
    tick();
    startRefresh();
})();

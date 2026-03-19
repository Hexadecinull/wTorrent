'use strict';

const UI = (() => {
    const sel  = id => document.getElementById(id);
    const qsa  = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
    const qs   = (s, ctx = document) => ctx.querySelector(s);

    let selectedHashes = new Set();
    let activeFilter   = 'all';
    let activeTab      = 'general';
    let sortCol        = 'addedAt';
    let sortDir        = 'desc';

    let lastTorrents   = [];
    let pendingFile    = null;

    const fmt = {
        bytes(n) {
            if (!n || n < 0) return '0 B';
            const u = ['B', 'KB', 'MB', 'GB', 'TB'];
            let i = 0;
            while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
            return `${i === 0 ? n : n.toFixed(1)} ${u[i]}`;
        },
        speed(n) {
            if (!n || n < 1) return '0 B/s';
            return this.bytes(n) + '/s';
        },
        eta(sec) {
            if (!sec || !isFinite(sec) || sec === Infinity || sec <= 0) return '∞';
            if (sec < 60)   return `${sec}s`;
            if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            return `${h}h ${m}m`;
        },
        ratio(r) {
            if (!r || r < 0) return '0.000';
            return r.toFixed(3);
        },
        pct(p) {
            if (!p && p !== 0) return '0.0%';
            return (p * 100).toFixed(1) + '%';
        },
        date(ms) {
            if (!ms) return '—';
            return new Date(ms).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        },
        statusLabel(s) {
            const map = { downloading: 'Downloading', seeding: 'Seeding', paused: 'Paused', checking: 'Checking', inactive: 'Inactive', errored: 'Error', completed: 'Completed', queued: 'Queued', unknown: 'Unknown' };
            return map[s] || s;
        },
    };

    function _filterTorrents(torrents) {
        if (activeFilter === 'all') return torrents;
        if (activeFilter === 'active') return torrents.filter(t => t.downloadSpeed > 0 || t.uploadSpeed > 0);
        if (activeFilter === 'inactive') return torrents.filter(t => t.status !== 'downloading' && t.status !== 'seeding' && t.status !== 'errored' && t.downloadSpeed === 0 && t.uploadSpeed === 0);
        return torrents.filter(t => t.status === activeFilter || (activeFilter === 'completed' && t.status === 'seeding' && t.progress >= 1));
    }

    function _sortTorrents(torrents) {
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...torrents].sort((a, b) => {
            let va, vb;
            switch (sortCol) {
                case 'name':    va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
                case 'size':    va = a.size;    vb = b.size;    break;
                case 'done':    va = a.progress; vb = b.progress; break;
                case 'status':  va = a.status;  vb = b.status;  break;
                case 'seeds':   va = a.numPeers; vb = b.numPeers; break;
                case 'peers':   va = a.numPeers; vb = b.numPeers; break;
                case 'dl':      va = a.downloadSpeed; vb = b.downloadSpeed; break;
                case 'ul':      va = a.uploadSpeed;   vb = b.uploadSpeed;   break;
                case 'eta':     va = isFinite(a.etaSec) ? a.etaSec : 1e12; vb = isFinite(b.etaSec) ? b.etaSec : 1e12; break;
                case 'ratio':   va = a.ratio;  vb = b.ratio;    break;
                default:        va = a.addedAt; vb = b.addedAt;  break;
            }
            if (typeof va === 'string') return va < vb ? -dir : va > vb ? dir : 0;
            return (va - vb) * dir;
        });
    }

    function renderList(torrents) {
        lastTorrents = torrents;
        const tbody   = sel('torrent-tbody');
        const empty   = sel('empty-state');
        const visible = _sortTorrents(_filterTorrents(torrents));

        _updateCounts(torrents);
        _updateSortHeaders();

        if (visible.length === 0) {
            tbody.innerHTML = '';
            empty.classList.add('visible');
            return;
        }
        empty.classList.remove('visible');

        const rows = visible.map(t => _buildRow(t)).join('');
        tbody.innerHTML = rows;

        qsa('.torrent-row', tbody).forEach(row => {
            row.addEventListener('click',       e => _onRowClick(e, row.dataset.hash));
            row.addEventListener('contextmenu', e => _onRowCtx(e, row.dataset.hash));
        });
    }

    function _buildRow(t) {
        const sel2  = selectedHashes.has(t.infoHash) ? ' selected' : '';
        const pct   = Math.round(t.progress * 100);
        const stat  = t.status;

        return `<tr class="torrent-row${sel2}" data-hash="${t.infoHash}" aria-selected="${selectedHashes.has(t.infoHash)}">
            <td>
                <div class="td-name">
                    <span class="status-dot ${stat}"></span>
                    <span class="td-name-text" title="${_esc(t.name)}">${_esc(t.name)}</span>
                </div>
            </td>
            <td class="td-mono td-right">${fmt.bytes(t.size)}</td>
            <td class="td-mono td-right">${fmt.pct(t.progress)}</td>
            <td>
                <div class="prog-bar-wrap" title="${pct}%">
                    <div class="prog-bar-fill ${stat}" style="width:${pct}%"></div>
                </div>
            </td>
            <td><span class="status-label ${stat}">${fmt.statusLabel(stat)}</span></td>
            <td class="td-mono td-right td-muted">—</td>
            <td class="td-mono td-right${t.numPeers > 0 ? ' td-blue' : ' td-muted'}">${t.numPeers}</td>
            <td class="td-mono${t.downloadSpeed > 0 ? ' td-blue' : ' td-muted'}">${fmt.speed(t.downloadSpeed)}</td>
            <td class="td-mono${t.uploadSpeed > 0 ? ' td-green' : ' td-muted'}">${fmt.speed(t.uploadSpeed)}</td>
            <td class="td-mono td-muted">${fmt.eta(t.etaSec)}</td>
            <td class="td-mono td-right${t.ratio >= 1 ? ' td-green' : ''}">${fmt.ratio(t.ratio)}</td>
        </tr>`;
    }

    function _esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function _onRowClick(e, hash) {
        if (e.ctrlKey || e.metaKey) {
            if (selectedHashes.has(hash)) selectedHashes.delete(hash);
            else selectedHashes.add(hash);
        } else if (e.shiftKey && selectedHashes.size > 0) {
            const tbody  = sel('torrent-tbody');
            const rows   = Array.from(tbody.querySelectorAll('.torrent-row'));
            const hashes = rows.map(r => r.dataset.hash);
            const last   = Array.from(selectedHashes).pop();
            const a = hashes.indexOf(last);
            const b = hashes.indexOf(hash);
            const [lo, hi] = [Math.min(a,b), Math.max(a,b)];
            for (let i = lo; i <= hi; i++) selectedHashes.add(hashes[i]);
        } else {
            selectedHashes = new Set([hash]);
        }

        _refreshSelectionClasses();
        _updateToolbarButtons();
        renderDetailPanel();
    }

    function _onRowCtx(e, hash) {
        e.preventDefault();
        if (!selectedHashes.has(hash)) {
            selectedHashes = new Set([hash]);
            _refreshSelectionClasses();
            renderDetailPanel();
        }
        _updateToolbarButtons();
        _showCtxMenu(e.clientX, e.clientY);
    }

    function _refreshSelectionClasses() {
        qsa('.torrent-row').forEach(row => {
            const s = selectedHashes.has(row.dataset.hash);
            row.classList.toggle('selected', s);
            row.setAttribute('aria-selected', s);
        });
    }

    function _updateToolbarButtons() {
        const has = selectedHashes.size > 0;
        ['btn-resume', 'btn-pause', 'btn-remove'].forEach(id => {
            sel(id).disabled = !has;
        });
    }

    function _updateCounts(torrents) {
        const map = { all: 0, downloading: 0, seeding: 0, completed: 0, paused: 0, active: 0, inactive: 0, errored: 0 };
        for (const t of torrents) {
            map.all++;
            if (t.status === 'downloading') map.downloading++;
            if (t.status === 'seeding') { map.seeding++; if (t.progress >= 1) map.completed++; }
            if (t.status === 'paused') map.paused++;
            if (t.downloadSpeed > 0 || t.uploadSpeed > 0) map.active++;
            if (t.status !== 'downloading' && t.status !== 'seeding' && t.downloadSpeed === 0) map.inactive++;
            if (t.status === 'errored') map.errored++;
        }
        for (const [k, v] of Object.entries(map)) {
            const el = sel(`cnt-${k}`);
            if (el) el.textContent = v;
        }
    }

    function _updateSortHeaders() {
        qsa('.torrent-table th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.col === sortCol) th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        });
    }

    function renderStatusBar(stats) {
        sel('sb-dl').textContent     = '\u2193 ' + fmt.speed(stats.downloadSpeed);
        sel('sb-ul').textContent     = '\u2191 ' + fmt.speed(stats.uploadSpeed);
        sel('sb-active').textContent = stats.total + ' torrent' + (stats.total !== 1 ? 's' : '');
        sel('sb-dht').textContent    = 'DHT: ' + (stats.dhtNodes || 0) + ' nodes';
    }

    function renderDetailPanel() {
        const hash = selectedHashes.size === 1 ? Array.from(selectedHashes)[0] : null;
        const t    = hash ? lastTorrents.find(x => x.infoHash === hash) : null;
        const body = sel('detail-body');

        if (!t) { body.innerHTML = '<div class="detail-placeholder">Select a torrent to view its details.</div>'; return; }

        switch (activeTab) {
            case 'general':  body.innerHTML = _tabGeneral(t);  break;
            case 'trackers': body.innerHTML = _tabTrackers(t); break;
            case 'peers':    body.innerHTML = _tabPeers(t);    break;
            case 'content':  body.innerHTML = _tabContent(t);  break;
            case 'speed':    body.innerHTML = _tabSpeed(t);    break;
            default:         body.innerHTML = '';
        }

        if (activeTab === 'content') {
            qsa('.file-dl-btn', body).forEach(btn => {
                btn.addEventListener('click', () => {
                    Engine.downloadFile(hash, parseInt(btn.dataset.idx, 10));
                });
            });
        }
    }

    function _tabGeneral(t) {
        return `<div class="detail-grid">
            <span class="detail-key">Name</span>
            <span class="detail-val plain" title="${_esc(t.name)}">${_esc(t.name)}</span>
            <span class="detail-key">Status</span>
            <span class="detail-val plain"><span class="status-label ${t.status}">${fmt.statusLabel(t.status)}</span></span>

            <span class="detail-key">Info Hash</span>
            <span class="detail-val wrap" title="${t.infoHash}">${t.infoHash}</span>
            <span class="detail-key">Progress</span>
            <span class="detail-val">${fmt.pct(t.progress)}</span>

            <span class="detail-key">Total Size</span>
            <span class="detail-val">${fmt.bytes(t.size)}</span>
            <span class="detail-key">Downloaded</span>
            <span class="detail-val">${fmt.bytes(t.downloaded)}</span>

            <span class="detail-key">Uploaded</span>
            <span class="detail-val">${fmt.bytes(t.uploaded)}</span>
            <span class="detail-key">Share Ratio</span>
            <span class="detail-val">${fmt.ratio(t.ratio)}</span>

            <span class="detail-key">Down Speed</span>
            <span class="detail-val td-blue">${fmt.speed(t.downloadSpeed)}</span>
            <span class="detail-key">Up Speed</span>
            <span class="detail-val td-green">${fmt.speed(t.uploadSpeed)}</span>

            <span class="detail-key">ETA</span>
            <span class="detail-val">${fmt.eta(t.etaSec)}</span>
            <span class="detail-key">Connected Peers</span>
            <span class="detail-val">${t.numPeers}</span>

            <span class="detail-key">Added</span>
            <span class="detail-val plain">${fmt.date(t.addedAt)}</span>
            <span class="detail-key">Files</span>
            <span class="detail-val">${t.files.length}</span>

            ${t.lastError ? `<span class="detail-key td-red">Error</span><span class="detail-val plain td-red" style="grid-column:span 3">${_esc(t.lastError)}</span>` : ''}
        </div>`;
    }

    function _tabTrackers(t) {
        if (!t.announce || t.announce.length === 0) {
            return '<p class="detail-placeholder">No trackers available for this torrent.</p>';
        }
        const rows = t.announce.map(url =>
            `<tr><td class="plain">${_esc(url)}</td><td class="td-muted">—</td><td class="td-muted">—</td><td class="td-muted">—</td></tr>`
        ).join('');
        return `<table class="detail-table"><thead><tr><th>URL</th><th>Status</th><th>Seeds</th><th>Peers</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    function _tabPeers(t) {
        if (!t.wires || t.wires.length === 0) {
            return '<p class="detail-placeholder">No connected peers.</p>';
        }
        const rows = t.wires.map(w =>
            `<tr>
                <td>${_esc(w.address)}</td>
                <td>${_esc(w.protocol)}</td>
                <td class="td-blue">${fmt.speed(w.downloadSpeed)}</td>
                <td class="td-green">${fmt.speed(w.uploadSpeed)}</td>
            </tr>`
        ).join('');
        return `<table class="detail-table"><thead><tr><th>Address</th><th>Protocol</th><th>Down Speed</th><th>Up Speed</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    function _tabContent(t) {
        if (!t.files || t.files.length === 0) {
            return '<p class="detail-placeholder">File list not yet available. Metadata is still loading.</p>';
        }
        const rows = t.files.map(f =>
            `<tr>
                <td class="file-name" title="${_esc(f.path)}">${_esc(f.name)}</td>
                <td class="file-size">${fmt.bytes(f.length)}</td>
                <td style="width:90px">
                    <div class="prog-bar-wrap">
                        <div class="prog-bar-fill ${t.status}" style="width:${Math.round(f.progress*100)}%"></div>
                    </div>
                </td>
                <td class="file-size">${fmt.pct(f.progress)}</td>
                <td><button class="file-dl-btn" data-idx="${f.index}" ${t.progress < 1 ? 'disabled' : ''}>Save</button></td>
            </tr>`
        ).join('');
        return `<table class="file-tree"><thead><tr><th>Name</th><th>Size</th><th style="width:90px">Progress</th><th>Done</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    function _tabSpeed(t) {
        return `<div class="speed-grid">
            <div class="speed-card">
                <div class="speed-card-label">Download</div>
                <div class="speed-card-value td-blue">${fmt.speed(t.downloadSpeed)}</div>
                <div class="speed-card-sub">${fmt.bytes(t.downloaded)} total</div>
            </div>
            <div class="speed-card">
                <div class="speed-card-label">Upload</div>
                <div class="speed-card-value td-green">${fmt.speed(t.uploadSpeed)}</div>
                <div class="speed-card-sub">${fmt.bytes(t.uploaded)} total</div>
            </div>
            <div class="speed-card">
                <div class="speed-card-label">Share Ratio</div>
                <div class="speed-card-value">${fmt.ratio(t.ratio)}</div>
                <div class="speed-card-sub">uploaded / downloaded</div>
            </div>
            <div class="speed-card">
                <div class="speed-card-label">ETA</div>
                <div class="speed-card-value">${fmt.eta(t.etaSec)}</div>
                <div class="speed-card-sub">${t.numPeers} connected peer${t.numPeers !== 1 ? 's' : ''}</div>
            </div>
        </div>`;
    }

    function _showCtxMenu(x, y) {
        const menu = sel('ctx-menu');
        menu.hidden = false;
        const vw = window.innerWidth, vh = window.innerHeight;
        const mw = menu.offsetWidth || 172, mh = menu.offsetHeight || 160;
        menu.style.left = Math.min(x, vw - mw - 4) + 'px';
        menu.style.top  = Math.min(y, vh - mh - 4) + 'px';
    }

    function hideCtxMenu() {
        sel('ctx-menu').hidden = true;
    }

    function openModal(id) {
        sel(id).hidden = false;
        sel(id).querySelector('.modal-close, [data-close]')?.focus();
    }

    function closeModal(id) {
        sel(id).hidden = true;
    }

    function loadSettingsIntoForm(s) {
        sel('s-dl').value          = s.max_dl_speed    || 0;
        sel('s-ul').value          = s.max_ul_speed    || 0;
        sel('s-maxconn').value     = s.max_connections || 200;
        sel('s-dht').checked       = s.enable_dht      !== false;
        sel('s-pex').checked       = s.enable_pex      !== false;
        sel('s-lsd').checked       = s.enable_lsd      !== false;
        sel('s-start-paused').checked = !!s.start_paused;
        sel('s-refresh').value     = s.refresh_interval || 1500;
    }

    function collectSettingsFromForm() {
        return {
            max_dl_speed:     parseInt(sel('s-dl').value, 10)     || 0,
            max_ul_speed:     parseInt(sel('s-ul').value, 10)     || 0,
            max_connections:  parseInt(sel('s-maxconn').value, 10) || 200,
            enable_dht:       sel('s-dht').checked,
            enable_pex:       sel('s-pex').checked,
            enable_lsd:       sel('s-lsd').checked,
            start_paused:     sel('s-start-paused').checked,
            refresh_interval: parseInt(sel('s-refresh').value, 10) || 1500,
        };
    }

    function resetAddForm() {
        sel('magnet-input').value = '';
        sel('file-input').value   = '';
        sel('file-selected-name').textContent = '';
        sel('opt-paused').checked = false;
        pendingFile = null;
        _switchAddTab('panel-magnet');
    }

    function _switchAddTab(panelId) {
        qsa('.tab-strip-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === panelId));
        qsa('.tab-panel').forEach(p => p.classList.toggle('active', p.id === panelId));
    }

    function init(onAdd, onRemove, onPause, onResume, onSettings, onLogout) {
        sel('btn-add').addEventListener('click', () => { resetAddForm(); openModal('modal-add'); });
        sel('btn-settings').addEventListener('click', () => { onSettings(); });
        sel('btn-logout').addEventListener('click', () => onLogout());
        sel('btn-resume').addEventListener('click', () => { for (const h of selectedHashes) onResume(h); });
        sel('btn-pause').addEventListener('click',  () => { for (const h of selectedHashes) onPause(h); });
        sel('btn-remove').addEventListener('click', () => _confirmRemove());

        qsa('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));

        qsa('.modal-backdrop').forEach(bd => {
            bd.addEventListener('click', e => { if (e.target === bd) closeModal(bd.id); });
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') { hideCtxMenu(); qsa('.modal-backdrop').forEach(m => { m.hidden = true; }); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); resetAddForm(); openModal('modal-add'); }
            if (e.key === 'Delete' && selectedHashes.size > 0) _confirmRemove();
            if (e.key === ' ' && selectedHashes.size > 0) {
                e.preventDefault();
                const torrents = lastTorrents.filter(t => selectedHashes.has(t.infoHash));
                const allPaused = torrents.every(t => t.status === 'paused');
                for (const h of selectedHashes) allPaused ? onResume(h) : onPause(h);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                lastTorrents.forEach(t => selectedHashes.add(t.infoHash));
                _refreshSelectionClasses();
                _updateToolbarButtons();
            }
        });

        document.addEventListener('click', () => hideCtxMenu());
        document.addEventListener('contextmenu', e => { if (!e.target.closest('.torrent-row')) hideCtxMenu(); });

        sel('ctx-menu').addEventListener('click', e => {
            const btn = e.target.closest('.ctx-item');
            if (!btn) return;
            const action = btn.dataset.action;
            hideCtxMenu();
            for (const h of selectedHashes) {
                if (action === 'resume')  onResume(h);
                if (action === 'pause')   onPause(h);
                if (action === 'recheck') { }
                if (action === 'copy-magnet') {
                    const m = Engine.getMagnet(h);
                    if (m) navigator.clipboard.writeText(m).catch(() => {});
                }
            }
            if (action === 'remove') _confirmRemove();
        });

        qsa('.detail-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                qsa('.detail-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                activeTab = tab.dataset.tab;
                renderDetailPanel();
            });
        });

        qsa('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                qsa('.sidebar-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                activeFilter = item.dataset.filter;
                selectedHashes.clear();
                _updateToolbarButtons();
                renderDetailPanel();
            });
        });

        qsa('.torrent-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                if (sortCol === th.dataset.col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                else { sortCol = th.dataset.col; sortDir = 'asc'; }
                renderList(lastTorrents);
                renderDetailPanel();
            });
        });

        qsa('.tab-strip-btn').forEach(btn => {
            btn.addEventListener('click', () => _switchAddTab(btn.dataset.panel));
        });

        sel('file-input').addEventListener('change', e => {
            const f = e.target.files[0];
            if (f) { pendingFile = f; sel('file-selected-name').textContent = f.name; }
        });

        const dropzone = sel('dropzone');
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            const f = e.dataTransfer.files[0];
            if (f && f.name.endsWith('.torrent')) { pendingFile = f; sel('file-selected-name').textContent = f.name; }
        });

        document.body.addEventListener('dragover', e => e.preventDefault());
        document.body.addEventListener('drop', e => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f && f.name.endsWith('.torrent')) {
                pendingFile = f;
                resetAddForm();
                sel('file-selected-name').textContent = f.name;
                _switchAddTab('panel-file');
                openModal('modal-add');
            }
        });

        sel('btn-add-confirm').addEventListener('click', () => {
            const activePanel = qs('.tab-panel.active').id;
            const paused = sel('opt-paused').checked;

            if (activePanel === 'panel-magnet') {
                const raw = sel('magnet-input').value.trim();
                if (!raw) { sel('magnet-input').focus(); return; }
                const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
                closeModal('modal-add');
                lines.forEach(src => onAdd(src, { paused }));
            } else {
                if (!pendingFile) { return; }
                closeModal('modal-add');
                onAdd(pendingFile, { paused });
            }
        });

        sel('btn-remove-confirm').addEventListener('click', () => {
            const deleteData = sel('opt-delete-data').checked;
            closeModal('modal-remove');
            for (const h of Array.from(selectedHashes)) onRemove(h, deleteData);
            selectedHashes.clear();
            _updateToolbarButtons();
        });

        qsa('.sn-item').forEach(item => {
            item.addEventListener('click', () => {
                qsa('.sn-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                qsa('.sp').forEach(p => p.classList.remove('active'));
                sel(item.dataset.sp).classList.add('active');
            });
        });

        sel('btn-settings-save').addEventListener('click', () => onSettings('save'));
    }

    function _confirmRemove() {
        const count = selectedHashes.size;
        sel('remove-msg').textContent = `Remove ${count} torrent${count !== 1 ? 's' : ''}? This cannot be undone.`;
        sel('opt-delete-data').checked = false;
        openModal('modal-remove');
    }

    return { init, renderList, renderDetailPanel, renderStatusBar, openModal, closeModal, loadSettingsIntoForm, collectSettingsFromForm, fmt };
})();

'use strict';

const Engine = (() => {
    let client = null;
    const meta = new Map();

    function init(cfg) {
        const opts = {
            maxConns: cfg.maxConnections || 200,
            dht:  cfg.enableDht  !== false,
            lsd:  cfg.enableLsd  !== false,
            pex:  cfg.enablePex  !== false,
        };

        if (cfg.maxDlSpeed > 0) opts.downloadLimit = cfg.maxDlSpeed * 1024;
        if (cfg.maxUlSpeed > 0) opts.uploadLimit   = cfg.maxUlSpeed * 1024;

        client = new WebTorrent(opts);

        client.on('error', err => {
            console.error('[wTorrent engine]', err.message || err);
        });
    }

    function add(source, options = {}) {
        return new Promise((resolve, reject) => {
            if (!client) return reject(new Error('Engine not initialized.'));

            const existing = _findBySource(source);
            if (existing) return resolve(existing);

            let settled = false;

            const onError = err => {
                if (!settled) { settled = true; reject(err); }
            };

            client.add(source, {}, torrent => {
                if (settled) return;
                settled = true;
                client.removeListener('error', onError);

                const entry = {
                    infoHash:   torrent.infoHash,
                    magnetURI:  torrent.magnetURI,
                    name:       torrent.name,
                    size:       torrent.length,
                    addedAt:    options.addedAt || Date.now(),
                    userPaused: !!options.paused,
                };

                meta.set(torrent.infoHash, entry);

                if (options.paused) torrent.pause();

                torrent.on('done', () => {
                    const m = meta.get(torrent.infoHash);
                    if (m && !m.userPaused) m.status = 'seeding';
                });

                torrent.on('error', err => {
                    const m = meta.get(torrent.infoHash);
                    if (m) { m.lastError = err.message; }
                });

                resolve(torrent);
            });

            client.once('error', onError);
        });
    }

    function _findBySource(source) {
        if (!client) return null;
        const s = typeof source === 'string' ? source : null;
        if (!s) return null;
        return client.torrents.find(t => t.infoHash === s || t.magnetURI === s) || null;
    }

    function remove(infoHash, destroyStore) {
        const torrent = client ? client.get(infoHash) : null;
        if (torrent) {
            torrent.destroy({ destroyStore: !!destroyStore });
        }
        meta.delete(infoHash);
    }

    function pause(infoHash) {
        const torrent = client ? client.get(infoHash) : null;
        const m = meta.get(infoHash);
        if (torrent) torrent.pause();
        if (m) m.userPaused = true;
    }

    function resume(infoHash) {
        const torrent = client ? client.get(infoHash) : null;
        const m = meta.get(infoHash);
        if (torrent) torrent.resume();
        if (m) m.userPaused = false;
    }

    function _statusOf(torrent, m) {
        if (!torrent) return m ? (m.lastError ? 'errored' : 'queued') : 'unknown';
        if (m && m.userPaused) return 'paused';
        if (m && m.lastError) return 'errored';
        if (!torrent.ready) return 'checking';
        if (torrent.done) return 'seeding';
        if (torrent.downloadSpeed > 0 || torrent.uploadSpeed > 0) return 'downloading';
        return 'inactive';
    }

    function _eta(torrent) {
        if (!torrent || torrent.done) return 0;
        const tr = torrent.timeRemaining;
        if (!tr || !isFinite(tr)) return Infinity;
        return Math.round(tr / 1000);
    }

    function getAll() {
        const result = [];
        for (const [infoHash, m] of meta) {
            const t = client ? client.get(infoHash) : null;
            result.push({
                infoHash,
                name:          t ? (t.name || m.name || infoHash.slice(0, 8)) : (m.name || infoHash.slice(0, 8)),
                size:          t ? t.length : m.size || 0,
                downloaded:    t ? t.downloaded : 0,
                uploaded:      t ? t.uploaded : 0,
                downloadSpeed: t ? t.downloadSpeed : 0,
                uploadSpeed:   t ? t.uploadSpeed : 0,
                progress:      t ? t.progress : 0,
                etaSec:        _eta(t),
                numPeers:      t ? t.numPeers : 0,
                ratio:         (t && t.downloaded > 0) ? (t.uploaded / t.downloaded) : 0,
                status:        _statusOf(t, m),
                addedAt:       m.addedAt,
                magnetURI:     t ? t.magnetURI : m.magnetURI,
                lastError:     m.lastError || null,
                files: t ? t.files.map((f, i) => ({
                    index:      i,
                    name:       f.name,
                    path:       f.path,
                    length:     f.length,
                    downloaded: f.downloaded,
                    progress:   f.progress,
                })) : [],
                wires: t ? t.wires.map(w => ({
                    address:       w.remoteAddress || '—',
                    downloadSpeed: typeof w.downloadSpeed === 'function' ? w.downloadSpeed() : 0,
                    uploadSpeed:   typeof w.uploadSpeed === 'function' ? w.uploadSpeed() : 0,
                    protocol:      w.type || 'WebRTC',
                })) : [],
                announce: t ? (t.announce || []) : [],
            });
        }
        return result;
    }

    function getGlobalStats() {
        return {
            downloadSpeed: client ? client.downloadSpeed : 0,
            uploadSpeed:   client ? client.uploadSpeed   : 0,
            progress:      client ? client.progress      : 0,
            ratio:         client ? client.ratio         : 0,
            total:         meta.size,
        };
    }

    function downloadFile(infoHash, fileIndex) {
        const t = client ? client.get(infoHash) : null;
        if (!t || !t.files[fileIndex]) return;
        const f = t.files[fileIndex];

        f.getBlobURL((err, url) => {
            if (err) { console.error('[wTorrent download]', err); return; }
            const a = document.createElement('a');
            a.href = url;
            a.download = f.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        });
    }

    function getMagnet(infoHash) {
        const t = client ? client.get(infoHash) : null;
        if (t) return t.magnetURI;
        const m = meta.get(infoHash);
        return m ? m.magnetURI : null;
    }

    function hasMeta(infoHash) {
        return meta.has(infoHash);
    }

    function applySpeedLimits(dlKbps, ulKbps) {
        if (!client) return;
        client.throttleDownload(dlKbps > 0 ? dlKbps * 1024 : -1);
        client.throttleUpload(ulKbps > 0 ? ulKbps * 1024 : -1);
    }

    function destroy() {
        if (client) { client.destroy(); client = null; }
        meta.clear();
    }

    return { init, add, remove, pause, resume, getAll, getGlobalStats, downloadFile, getMagnet, hasMeta, applySpeedLimits, destroy };
})();

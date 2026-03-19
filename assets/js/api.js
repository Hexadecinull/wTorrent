'use strict';

const API = (() => {
    const csrf = () => document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    async function req(url, opts = {}) {
        const method = opts.method || 'GET';
        const config = {
            method,
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        };
        if (opts.body) config.body = JSON.stringify(opts.body);

        const res = await fetch(url, config);

        if (res.status === 401) {
            window.location.href = '/login.php';
            return null;
        }

        let data;
        try { data = await res.json(); }
        catch (_) { throw new Error('Invalid server response'); }

        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        return data;
    }

    async function getSettings() {
        return req('/api/settings.php');
    }

    async function saveSettings(patch) {
        return req('/api/settings.php', { method: 'POST', body: patch });
    }

    async function changePassword(currentPassword, newPassword, confirmPassword) {
        return req('/api/settings.php', {
            method: 'POST',
            body: {
                action: 'change_password',
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword,
            },
        });
    }

    async function getTorrents() {
        return req('/api/torrents.php');
    }

    async function saveTorrent(meta) {
        return req('/api/torrents.php', { method: 'POST', body: { action: 'save', ...meta } });
    }

    async function removeTorrent(infoHash) {
        return req('/api/torrents.php', { method: 'POST', body: { action: 'remove', infoHash } });
    }

    async function updatePaused(infoHash, userPaused) {
        return req('/api/torrents.php', { method: 'POST', body: { action: 'update_paused', infoHash, userPaused } });
    }

    async function logout() {
        return req('/api/auth.php', { method: 'POST', body: { action: 'logout' } });
    }

    return { getSettings, saveSettings, changePassword, getTorrents, saveTorrent, removeTorrent, updatePaused, logout };
})();

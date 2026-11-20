/**
 * ROSI CINEMA VIP - GitHub Remote Version Checker (version.json)
 * Tự động kiểm tra bản cập nhật mới từ GitHub khi mở ứng dụng hoặc kiểm tra thủ công.
 */

(function () {
  const CURRENT_VERSION = '1.0.1';
  const CURRENT_VERSION_CODE = 2;

  const DEFAULT_VERSION_URL = 'https://raw.githubusercontent.com/tronghuu2k/rosi-cinema-apk/main/version.json';
  const STORAGE_KEY_URL = 'rosi_version_json_url';
  const STORAGE_KEY_SKIPPED = 'rosi_skipped_version';

  function compareSemver(remoteVer, localVer) {
    const r = String(remoteVer || '0.0.0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const l = String(localVer || '0.0.0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(r.length, l.length, 3);
    for (let i = 0; i < len; i++) {
      const rv = r[i] || 0;
      const lv = l[i] || 0;
      if (rv > lv) return 1;
      if (rv < lv) return -1;
    }
    return 0;
  }

  class GitHubUpdater {
    constructor() {
      this.currentVersion = CURRENT_VERSION;
      this.currentVersionCode = CURRENT_VERSION_CODE;
      this.latestData = null;
      this.versionUrl = DEFAULT_VERSION_URL;

      try {
        const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
        if (savedUrl && savedUrl.trim()) {
          this.versionUrl = savedUrl.trim();
        }
      } catch (e) {}
    }

    getVersionUrl() {
      return this.versionUrl;
    }

    setVersionUrl(url) {
      const clean = (url || '').trim();
      this.versionUrl = clean || DEFAULT_VERSION_URL;
      try {
        localStorage.setItem(STORAGE_KEY_URL, this.versionUrl);
      } catch (e) {}
    }

    resetVersionUrl() {
      this.versionUrl = DEFAULT_VERSION_URL;
      try {
        localStorage.removeItem(STORAGE_KEY_URL);
        localStorage.removeItem(STORAGE_KEY_SKIPPED);
      } catch (e) {}
    }

    isNewer(remote) {
      if (!remote) return false;
      const remoteCode = parseInt(remote.versionCode, 10);
      if (!isNaN(remoteCode) && remoteCode > this.currentVersionCode) {
        return true;
      }
      if (remote.version && compareSemver(remote.version, this.currentVersion) > 0) {
        return true;
      }
      return false;
    }

    async fetchRemoteVersion() {
      const baseUrl = this.versionUrl;
      const sep = baseUrl.includes('?') ? '&' : '?';
      const bustUrl = `${baseUrl}${sep}t=${Date.now()}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      try {
        const res = await fetch(bustUrl, {
          signal: controller.signal,
          cache: 'no-store'
        });
        clearTimeout(timer);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!data || (!data.version && !data.versionCode)) {
          throw new Error('File version.json không đúng định dạng');
        }
        this.latestData = data;
        return data;
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    }

    async checkForUpdates(manual = false) {
      const statusEl = document.getElementById('updateCheckStatus');
      if (manual && statusEl) {
        statusEl.textContent = '⏳ Đang kiểm tra phiên bản từ GitHub...';
        statusEl.style.color = '#f5c518';
      }

      try {
        const remote = await this.fetchRemoteVersion();
        const hasUpdate = this.isNewer(remote);

        if (hasUpdate) {
          let skippedVer = '';
          try {
            skippedVer = localStorage.getItem(STORAGE_KEY_SKIPPED) || '';
          } catch (e) {}

          if (statusEl) {
            statusEl.textContent = `🎉 Có bản mới v${remote.version} (hiện tại v${this.currentVersion})`;
            statusEl.style.color = '#10b981';
          }

          // Nếu kiểm tra thủ công hoặc bản bắt buộc hoặc chưa bấm bỏ qua thì hiện modal
          if (manual || remote.forceUpdate || skippedVer !== String(remote.version)) {
            this.showUpdateModal(remote);
          }
          return { hasUpdate: true, remote };
        } else {
          if (statusEl) {
            statusEl.textContent = `✅ Bạn đang dùng bản mới nhất (v${this.currentVersion})`;
            statusEl.style.color = '#10b981';
          }
          if (manual && window.showToast) {
            window.showToast(`Bạn đang dùng phiên bản mới nhất (v${this.currentVersion})`);
          }
          return { hasUpdate: false, remote };
        }
      } catch (err) {
        console.warn('[GitHubUpdater] Không kiểm tra được version.json:', err.message);
        if (statusEl) {
          statusEl.textContent = `⚠️ Không kết nối được version.json (${err.message})`;
          statusEl.style.color = '#f87171';
        }
        if (manual && window.showToast) {
          window.showToast('Không thể kiểm tra cập nhật. Kiểm tra mạng hoặc link version.json!');
        }
        return { hasUpdate: false, error: err.message };
      }
    }

    showUpdateModal(remote) {
      const modal = document.getElementById('updateModal');
      if (!modal) return;

      document.getElementById('updateModalTitle').textContent = remote.title || `Cập Nhật Mới v${remote.version}`;
      document.getElementById('updateVerCompare').textContent = `v${this.currentVersion}  →  v${remote.version}`;
      document.getElementById('updateReleaseDate').textContent = remote.releaseDate ? `Phát hành: ${remote.releaseDate}` : '';

      const listEl = document.getElementById('updateChangelogList');
      listEl.innerHTML = '';
      const notes = Array.isArray(remote.changelog) && remote.changelog.length > 0
        ? remote.changelog
        : ['Cải thiện hiệu năng và sửa lỗi phát phim.'];

      notes.forEach(line => {
        const li = document.createElement('li');
        li.textContent = line;
        listEl.appendChild(li);
      });

      const laterBtn = document.getElementById('btnUpdateLater');
      const closeBtn = document.getElementById('btnCloseUpdateModal');
      if (remote.forceUpdate) {
        laterBtn.classList.add('hidden');
        closeBtn.classList.add('hidden');
      } else {
        laterBtn.classList.remove('hidden');
        closeBtn.classList.remove('hidden');
      }

      const downloadUrl = remote.downloadUrl || remote.githubRepoUrl || 'https://github.com/tronghuu2k/rosi-cinema-apk/releases/latest';
      document.getElementById('btnDownloadUpdate').onclick = () => {
        const win = window.open(downloadUrl, '_system');
        if (!win) {
          const winBlank = window.open(downloadUrl, '_blank');
          if (!winBlank) window.location.href = downloadUrl;
        }
      };

      laterBtn.onclick = () => {
        try {
          localStorage.setItem(STORAGE_KEY_SKIPPED, String(remote.version));
        } catch (e) {}
        modal.classList.add('hidden');
      };

      closeBtn.onclick = () => {
        modal.classList.add('hidden');
      };

      modal.classList.remove('hidden');
    }
  }

  window.githubUpdater = new GitHubUpdater();
})();

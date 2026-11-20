/**
 * ROSI CINEMA 2.0 - Silent update metadata checker.
 * Không mở modal và không hiển thị lỗi version.json cho người dùng.
 * Việc cài đặt APK vẫn do người dùng chủ động thực hiện qua bản phát hành tin cậy.
 */
(function () {
  const CURRENT_VERSION = '2.0.0';
  const CURRENT_VERSION_CODE = 3;
  const DEFAULT_VERSION_URL = 'https://raw.githubusercontent.com/tronghuu2k/rosi-cinema-apk/main/version.json';

  class GitHubUpdater {
    constructor() {
      this.currentVersion = CURRENT_VERSION;
      this.currentVersionCode = CURRENT_VERSION_CODE;
      this.versionUrl = DEFAULT_VERSION_URL;
      this.latestData = null;
    }

    getVersionUrl() { return this.versionUrl; }
    setVersionUrl(url) { this.versionUrl = String(url || '').trim() || DEFAULT_VERSION_URL; }
    resetVersionUrl() { this.versionUrl = DEFAULT_VERSION_URL; }

    async fetchRemoteVersion() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const url = `${this.versionUrl}${this.versionUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data || (!data.version && !data.versionCode)) throw new Error('Invalid version metadata');
        this.latestData = data;
        return data;
      } finally {
        clearTimeout(timer);
      }
    }

    async checkForUpdates() {
      try {
        const remote = await this.fetchRemoteVersion();
        const remoteCode = Number(remote.versionCode || 0);
        return { hasUpdate: remoteCode > this.currentVersionCode, remote };
      } catch (error) {
        // Không chặn khởi động ứng dụng và không hiển thị lỗi cấu hình cho người dùng.
        console.info('[ROSI updater] Bỏ qua kiểm tra cập nhật:', error.message);
        return { hasUpdate: false, error: error.message, silent: true };
      }
    }
  }

  window.githubUpdater = new GitHubUpdater();
})();

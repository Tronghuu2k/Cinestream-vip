/**
 * ROSI CINEMA VIP - Main Application & HLS Video Player Controller
 * Kết nối trực tiếp window.movieApi (api-service.js) và window.githubUpdater (updater.js)
 */

(function () {
  const FAVORITES_KEY = 'rosi_cinema_favorites';
  const HISTORY_KEY = 'rosi_cinema_history';

  function syncNativeStatusBar(hexColor = '#141414') {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', hexColor);
    const statusBar = window.Capacitor?.Plugins?.StatusBar;
    if (statusBar) {
      statusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      statusBar.setStyle({ style: 'DARK' }).catch(() => {});
      statusBar.setBackgroundColor({ color: hexColor }).catch(() => {});
    }
  }
  window.syncNativeStatusBar = syncNativeStatusBar;

  function showToast(msg, duration = 2600) {
    const el = document.getElementById('toastBox');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), duration);
  }
  window.showToast = showToast;

  function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function safeMediaUrl(value, fallback = 'img/placeholder.svg') {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return ['https:', 'http:'].includes(url.protocol) || url.protocol === 'file:' ? url.href : fallback;
    } catch (e) { return fallback; }
  }

  function formatEpisodeLabel(ep) {
    const s = String(ep || '1').trim();
    if (/^full$/i.test(s)) return 'Bản Full';
    if (/^tập\s*/i.test(s)) return s;
    return `Tập ${s}`;
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  class RosiCinemaApp {
    constructor() {
      this.currentMovie = null;
      this.categoryState = { type: 'danh-sach', slug: 'phim-bo', title: 'Phim Bộ', page: 1 };
      this.searchTimer = null;
      this.lastBackPressTime = 0;
    }

    init() {
      syncNativeStatusBar('#141414');
      this.bindEvents();
      this.setupAndroidBackHandler();
      this.setupOrientationHandler();
      this.loadHome(false);

      // Cập nhật ứng dụng được tắt trong bản người dùng; không hiện popup/cảnh báo version.json.
    }

    bindEvents() {
      // Navigation pills
      document.querySelectorAll('.nav-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.id === 'btnOpenGenres') {
            this.openModal('genreModal');
            return;
          }
          document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const nav = btn.dataset.nav;
          if (nav === 'home') {
            this.goHome();
          } else if (nav === 'favorites') {
            this.openFavorites();
          } else if (btn.dataset.type && btn.dataset.slug) {
            this.openCategory(btn.dataset.type, btn.dataset.slug, btn.dataset.title || btn.textContent, 1);
          }
        });
      });

      // Header buttons
      document.getElementById('btnOpenSearch').addEventListener('click', () => {
        this.openModal('searchModal');
        setTimeout(() => document.getElementById('searchInput').focus(), 80);
      });

      document.getElementById('btnCloseSearch').addEventListener('click', () => {
        this.closeModal('searchModal');
      });

      document.getElementById('btnClearSearch').addEventListener('click', () => {
        const inp = document.getElementById('searchInput');
        inp.value = '';
        inp.focus();
        document.getElementById('searchResults').innerHTML = '<p class="search-hint">Gõ từ khóa để tìm kiếm trực tiếp trên kho phim VIP...</p>';
      });

      document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(this.searchTimer);
        const q = e.target.value.trim();
        this.searchTimer = setTimeout(() => this.performSearch(q), 380);
      });

      document.getElementById('btnRefresh').addEventListener('click', () => {
        window.movieApi.clearCache();
        showToast('Đang làm mới kho phim mới nhất...');
        this.loadHome(true);
      });



      // Pagination
      document.getElementById('btnPrevPage').addEventListener('click', () => {
        if (this.categoryState.page > 1) {
          this.openCategory(
            this.categoryState.type,
            this.categoryState.slug,
            this.categoryState.title,
            this.categoryState.page - 1
          );
        }
      });

      document.getElementById('btnNextPage').addEventListener('click', () => {
        this.openCategory(
          this.categoryState.type,
          this.categoryState.slug,
          this.categoryState.title,
          this.categoryState.page + 1
        );
      });
    }

    openModal(id) {
      document.getElementById(id)?.classList.remove('hidden');
    }

    closeModal(id) {
      document.getElementById(id)?.classList.add('hidden');
    }

    setupAndroidBackHandler() {
      // Đóng hộp thoại khi chạm ra vùng tối bên ngoài
      ['genreModal', 'detailModal', 'searchModal'].forEach(modalId => {
        const overlay = document.getElementById(modalId);
        if (!overlay) return;
        overlay.addEventListener('click', (e) => {
          if (e.target !== overlay) return;
          this.closeModal(modalId);
        });
      });

      // Xử lý nút Back phần cứng / cử chỉ vuốt quay lại trên Android (Capacitor App Plugin)
      const capApp = window.Capacitor?.Plugins?.App;
      if (capApp && typeof capApp.addListener === 'function') {
        capApp.addListener('backButton', () => {
          this.handleHardwareBack(true);
        });
      }

      // Dự phòng cho trình duyệt di động / WebView thường
      try {
        window.history.pushState({ rosiRoot: true }, '');
        window.addEventListener('popstate', () => {
          const handled = this.handleHardwareBack(false);
          if (handled) {
            window.history.pushState({ rosiRoot: true }, '');
          }
        });
      } catch (e) {}
    }

    handleHardwareBack(isNativeCapacitor = true) {
      // 1. Nếu đang mở trình phát video -> đóng drawer trước, sau đó đóng trình phát
      const playerOverlay = document.getElementById('playerOverlay');
      if (playerOverlay && !playerOverlay.classList.contains('hidden')) {
        const drawer = document.getElementById('playerDrawer');
        if (drawer && !drawer.classList.contains('hidden')) {
          window.player.closeDrawer();
        } else {
          window.player.close();
        }
        return true;
      }

      // 2. Nếu đang mở hộp thoại (Modal) -> đóng hộp thoại trên cùng
      const modalOrder = ['detailModal', 'genreModal', 'searchModal'];
      for (const id of modalOrder) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) {
          this.closeModal(id);
          return true;
        }
      }

      // 3. Nếu đang ở trang danh mục / yêu thích -> quay về Trang Chủ
      const gridView = document.getElementById('gridView');
      if (gridView && !gridView.classList.contains('hidden')) {
        this.goHome();
        return true;
      }

      // 4. Đang ở Trang Chủ -> nhấn Back 2 lần trong 2 giây để thoát ứng dụng
      if (isNativeCapacitor) {
        const now = Date.now();
        if (now - this.lastBackPressTime < 2000) {
          window.Capacitor?.Plugins?.App?.exitApp?.();
        } else {
          this.lastBackPressTime = now;
          showToast('Nhấn Quay lại lần nữa để thoát ứng dụng', 2000);
        }
        return true;
      }

      return false;
    }

    setupOrientationHandler() {
      const handleOrientationChange = () => {
        const isLandscape = window.innerWidth > window.innerHeight;
        const statusBar = window.Capacitor?.Plugins?.StatusBar;
        const playerOverlay = document.getElementById('playerOverlay');
        const isPlayerOpen = playerOverlay && !playerOverlay.classList.contains('hidden');

        if (isPlayerOpen && isLandscape) {
          playerOverlay.classList.add('player-immersive');
          if (statusBar?.hide) statusBar.hide().catch(() => {});
        } else if (!isPlayerOpen) {
          syncNativeStatusBar('#141414');
          if (statusBar?.show) statusBar.show().catch(() => {});
        }
      };

      window.addEventListener('resize', handleOrientationChange);
      window.addEventListener('orientationchange', () => setTimeout(handleOrientationChange, 120));
      if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
        screen.orientation.addEventListener('change', () => setTimeout(handleOrientationChange, 120));
      }
    }

    goHome() {
      document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
      document.querySelector('.nav-pill[data-nav="home"]')?.classList.add('active');
      document.getElementById('gridView').classList.add('hidden');
      document.getElementById('homeView').classList.remove('hidden');
      this.renderHistoryRow();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async loadHome(forceRefresh = false) {
      const loading = document.getElementById('loadingScreen');
      const errorBox = document.getElementById('errorBox');
      const homeView = document.getElementById('homeView');
      const gridView = document.getElementById('gridView');

      loading.classList.remove('hidden');
      errorBox.classList.add('hidden');
      homeView.classList.add('hidden');
      gridView.classList.add('hidden');

      try {
        const data = await window.movieApi.getHome(forceRefresh);
        this.renderHero(data.hero);
        this.renderHistoryRow();
        this.renderSections(data.sections || []);

        loading.classList.add('hidden');
        homeView.classList.remove('hidden');
        if (window.Capacitor?.Plugins?.SplashScreen) {
          window.Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
        }
      } catch (err) {
        loading.classList.add('hidden');
        document.getElementById('errorMessage').textContent = err.message || 'Lỗi kết nối kho phim.';
        errorBox.classList.remove('hidden');
      }
    }

    renderHero(hero) {
      if (!hero) return;
      document.getElementById('heroBg').src = safeMediaUrl(hero.backdrop || hero.poster);
      document.getElementById('heroTitle').textContent = hero.title || 'Rosi Cinema VIP';
      document.getElementById('heroQuality').textContent = hero.status || 'FHD • VIETSUB';
      document.getElementById('heroYear').textContent = hero.year || '2026';

      const metaParts = [hero.country, hero.genre, hero.duration].filter(Boolean);
      document.getElementById('heroMeta').textContent = metaParts.join(' • ');
      document.getElementById('heroDesc').textContent = hero.description || 'Trải nghiệm xem phim tốc độ cao chuẩn rạp chiếu trên Rosi Cinema.';

      document.getElementById('heroPlayBtn').onclick = () => {
        window.player.playMovie(hero.slug, '1', hero.title, hero.poster);
      };
      document.getElementById('heroDetailBtn').onclick = () => {
        this.openMovieDetail(hero.slug);
      };
    }

    createMovieCard(item, subtitleOverride = '') {
      const card = document.createElement('div');
      card.className = 'movie-card';
      const safeAlt = escapeAttr(item.title);
      const posterUrl = escapeAttr(safeMediaUrl(item.poster || item.thumb));
      const badge = escapeAttr(subtitleOverride || item.badge || 'HD');
      card.innerHTML = `
        <div class="card-poster-wrap">
          <img class="card-poster" src="${posterUrl}" alt="${safeAlt}" loading="lazy" onerror="this.src='img/placeholder.svg'" />
          <span class="card-badge">${badge}</span>
        </div>
        <div class="card-title">${safeAlt}</div>
      `;
      card.addEventListener('click', () => this.openMovieDetail(item.slug));
      return card;
    }

    renderSections(sections) {
      const container = document.getElementById('sectionsContainer');
      container.innerHTML = '';

      sections.forEach(sec => {
        if (!sec.items || sec.items.length === 0) return;
        const sectionEl = document.createElement('section');
        sectionEl.className = 'movie-row';

        const header = document.createElement('div');
        header.className = 'row-header';
        header.innerHTML = `
          <h2 class="row-title">${escapeAttr(sec.icon || '🎬')} ${escapeAttr(sec.title)}</h2>
          <button class="row-more">Xem tất cả →</button>
        `;
        header.querySelector('.row-more').addEventListener('click', () => {
          this.openCategory('danh-sach', sec.id, sec.title, 1);
        });

        const scroller = document.createElement('div');
        scroller.className = 'row-scroller';
        sec.items.forEach(item => {
          scroller.appendChild(this.createMovieCard(item));
        });

        sectionEl.appendChild(header);
        sectionEl.appendChild(scroller);
        container.appendChild(sectionEl);
      });
    }

    async openCategory(type, slug, title, page = 1) {
      this.closeModal('genreModal');
      this.categoryState = { type, slug, title, page };

      const homeView = document.getElementById('homeView');
      const gridView = document.getElementById('gridView');
      const movieGrid = document.getElementById('movieGrid');
      const paginationBar = document.getElementById('paginationBar');

      homeView.classList.add('hidden');
      gridView.classList.remove('hidden');
      document.getElementById('gridTitle').textContent = title;
      movieGrid.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';
      paginationBar.classList.add('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      try {
        const res = await window.movieApi.getCategory(type, slug, page);
        document.getElementById('gridTitle').textContent = res.title || title;
        movieGrid.innerHTML = '';

        if (!res.items || res.items.length === 0) {
          movieGrid.innerHTML = '<p style="color:#a1a1aa;">Chưa có phim trong danh mục này.</p>';
          return;
        }

        res.items.forEach(item => {
          movieGrid.appendChild(this.createMovieCard(item));
        });

        paginationBar.classList.remove('hidden');
        document.getElementById('pageIndicator').textContent = `Trang ${res.page}`;
        document.getElementById('btnPrevPage').disabled = res.page <= 1;
        document.getElementById('btnNextPage').disabled = !res.hasNext;
      } catch (err) {
        movieGrid.textContent = `Lỗi tải danh sách: ${err.message}`;
      }
    }

    async performSearch(query) {
      const resultsBox = document.getElementById('searchResults');
      if (!query) {
        resultsBox.innerHTML = '<p class="search-hint">Gõ từ khóa để tìm kiếm trực tiếp trên kho phim VIP...</p>';
        return;
      }

      resultsBox.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';
      try {
        const items = await window.movieApi.search(query);
        if (!items || items.length === 0) {
          resultsBox.textContent = `Không tìm thấy phim nào khớp với "${query}".`;
          return;
        }

        const grid = document.createElement('div');
        grid.className = 'movie-grid';
        items.forEach(item => {
          const card = this.createMovieCard(item);
          card.addEventListener('click', () => this.closeModal('searchModal'));
          grid.appendChild(card);
        });
        resultsBox.innerHTML = '';
        resultsBox.appendChild(grid);
      } catch (err) {
        resultsBox.textContent = `Lỗi tìm kiếm: ${err.message}`;
      }
    }

    getSavedEpisode(slug) {
      try {
        const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        const found = list.find(x => x.slug === slug);
        return found ? found.episode : null;
      } catch (e) {
        return null;
      }
    }

    async openMovieDetail(slug) {
      this.openModal('detailModal');
      document.getElementById('detailTitle').textContent = 'Đang tải thông tin phim...';
      document.getElementById('detailOrigin').textContent = '';
      document.getElementById('detailDesc').textContent = '';
      document.getElementById('detailTags').innerHTML = '';
      document.getElementById('detailEpisodeGrid').innerHTML = '<div class="spinner"></div>';

      try {
        const movie = await window.movieApi.getMovieDetail(slug);
        this.currentMovie = movie;

        document.getElementById('detailBackdrop').src = safeMediaUrl(movie.backdrop || movie.poster);
        document.getElementById('detailPoster').src = safeMediaUrl(movie.poster);
        document.getElementById('detailTitle').textContent = movie.title;
        document.getElementById('detailOrigin').textContent = movie.originalTitle ? `${movie.originalTitle} (${movie.year})` : movie.year;
        document.getElementById('detailDesc').textContent = movie.description;

        const tags = [movie.status, movie.country, movie.duration, movie.genre].filter(Boolean);
        document.getElementById('detailTags').innerHTML = tags.map(t => `<span class="badge-dark">${escapeAttr(t)}</span>`).join('');

        // Favorite state
        this.updateFavButton(movie.slug);
        document.getElementById('detailFavBtn').onclick = () => this.toggleFavorite(movie);

        // Resume from watch history if available
        const savedEp = this.getSavedEpisode(movie.slug);
        const startEp = savedEp || movie.episodes[0]?.number || '1';
        const playLabelEl = document.getElementById('detailPlayBtnLabel');
        if (playLabelEl) {
          playLabelEl.textContent = savedEp ? `Tiếp Tục (${formatEpisodeLabel(savedEp)})` : 'Phát Ngay';
        }

        document.getElementById('detailPlayBtn').onclick = () => {
          this.closeModal('detailModal');
          window.player.playMovie(movie.slug, startEp, movie.title, movie.poster);
        };

        // Render episodes
        const epGrid = document.getElementById('detailEpisodeGrid');
        epGrid.innerHTML = '';
        document.getElementById('detailEpCount').textContent = `${movie.episodes.length} tập`;

        movie.episodes.forEach(ep => {
          const btn = document.createElement('button');
          btn.className = `ep-btn ${savedEp && String(ep.number) === String(savedEp) ? 'active' : ''}`;
          btn.textContent = ep.name;
          btn.addEventListener('click', () => {
            this.closeModal('detailModal');
            window.player.playMovie(movie.slug, ep.number, movie.title, movie.poster);
          });
          epGrid.appendChild(btn);
        });
      } catch (err) {
        document.getElementById('detailTitle').textContent = 'Không thể tải phim';
        document.getElementById('detailDesc').textContent = err.message;
        document.getElementById('detailEpisodeGrid').innerHTML = '';
      }
    }

    // FAVORITES
    getFavorites() {
      try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      } catch (e) {
        return [];
      }
    }

    toggleFavorite(movie) {
      let list = this.getFavorites();
      const idx = list.findIndex(x => x.slug === movie.slug);
      if (idx >= 0) {
        list.splice(idx, 1);
        showToast('Đã xóa khỏi danh sách Yêu Thích');
      } else {
        list.unshift({
          slug: movie.slug,
          title: movie.title,
          poster: movie.poster,
          badge: movie.status || 'VIP'
        });
        showToast('❤️ Đã thêm vào Yêu Thích');
      }
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(list.slice(0, 60)));
      this.updateFavButton(movie.slug);
    }

    updateFavButton(slug) {
      const btn = document.getElementById('detailFavBtn');
      const exists = this.getFavorites().some(x => x.slug === slug);
      btn.textContent = exists ? '❤️ Đã Thích' : '♡ Yêu Thích';
    }

    openFavorites() {
      const homeView = document.getElementById('homeView');
      const gridView = document.getElementById('gridView');
      const movieGrid = document.getElementById('movieGrid');
      const paginationBar = document.getElementById('paginationBar');

      homeView.classList.add('hidden');
      gridView.classList.remove('hidden');
      paginationBar.classList.add('hidden');
      document.getElementById('gridTitle').textContent = '❤️ Phim Yêu Thích Của Bạn';

      const list = this.getFavorites();
      movieGrid.innerHTML = '';
      if (list.length === 0) {
        movieGrid.innerHTML = '<p style="color:#a1a1aa;">Bạn chưa lưu phim yêu thích nào.</p>';
        return;
      }
      list.forEach(item => movieGrid.appendChild(this.createMovieCard(item)));
    }

    // WATCH HISTORY
    saveHistory(slug, title, poster, episode) {
      try {
        let list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        list = list.filter(x => x.slug !== slug);
        list.unshift({ slug, title, poster, episode, updatedAt: Date.now() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
        this.renderHistoryRow();
      } catch (e) {}
    }

    renderHistoryRow() {
      const sec = document.getElementById('historySection');
      const row = document.getElementById('historyRow');
      try {
        const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        if (!list.length) {
          sec.classList.add('hidden');
          return;
        }
        sec.classList.remove('hidden');
        row.innerHTML = '';
        list.forEach(item => {
          const card = this.createMovieCard(item, `Đang xem ${formatEpisodeLabel(item.episode)}`);
          card.onclick = () => window.player.playMovie(item.slug, item.episode, item.title, item.poster);
          row.appendChild(card);
        });
      } catch (e) {
        sec.classList.add('hidden');
      }
    }

    clearHistory() {
      localStorage.removeItem(HISTORY_KEY);
      this.renderHistoryRow();
      showToast('Đã xóa lịch sử xem');
    }


  }

  /**
   * VIP HLS VIDEO PLAYER CONTROLLER
   */
  class VipVideoPlayer {
    constructor() {
      this.overlay = document.getElementById('playerOverlay');
      this.container = document.getElementById('playerContainer');
      this.video = document.getElementById('videoElement');
      this.embed = document.getElementById('embedFrame');
      this.hud = document.getElementById('playerHud');
      this.loader = document.getElementById('playerLoader');

      this.hls = null;
      this.hudTimer = null;
      this.currentSlug = '';
      this.currentTitle = '';
      this.currentPoster = '';
      this.currentEpisode = '1';
      this.sources = [];
      this.episodes = [];
      this.activeSourceIndex = 0;
      this.hlsNetworkRetries = 0;
      this.hlsMediaRetries = 0;
      this.playRequestId = 0;
      this.sourceLoadTimer = null;

      this.speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
      this.speedIdx = 1;
      this.aspects = [
        { cls: 'fit-contain', label: 'Khung: Fit' },
        { cls: 'fit-cover', label: 'Khung: Fill' },
        { cls: 'fit-fill', label: 'Khung: Stretch' },
        { cls: 'fit-original', label: 'Khung: Gốc' }
      ];
      this.aspectIdx = 0;
      let savedAspect = 'fit-contain';
      try { savedAspect = localStorage.getItem('rosi_player_aspect') || savedAspect; } catch (e) {}
      if (!['fit-contain','fit-cover','fit-fill','fit-original'].includes(savedAspect)) savedAspect = 'fit-contain';
      this.video.classList.add(savedAspect);
      this.aspectIdx = this.aspects.findIndex(item => item.cls === savedAspect);
      if (this.aspectIdx < 0) this.aspectIdx = 0;
      document.getElementById('btnAspect').textContent = this.aspects[this.aspectIdx].label;

      this.bindPlayerEvents();
    }

    bindPlayerEvents() {
      document.getElementById('btnClosePlayer').addEventListener('click', () => this.close());
      document.getElementById('btnPlayPause').addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlay();
      });

      document.getElementById('btnSeekBack').addEventListener('click', (e) => {
        e.stopPropagation();
        this.seekBy(-10);
      });

      document.getElementById('btnSeekForward').addEventListener('click', (e) => {
        e.stopPropagation();
        this.seekBy(10);
      });

      document.getElementById('btnMute').addEventListener('click', (e) => {
        e.stopPropagation();
        this.video.muted = !this.video.muted;
        document.getElementById('btnMute').textContent = this.video.muted ? '🔇' : '🔊';
      });

      document.getElementById('btnSpeed').addEventListener('click', (e) => {
        e.stopPropagation();
        this.speedIdx = (this.speedIdx + 1) % this.speeds.length;
        const rate = this.speeds[this.speedIdx];
        this.video.playbackRate = rate;
        document.getElementById('btnSpeed').textContent = `${rate}x`;
        showToast(`Tốc độ phát: ${rate}x`);
      });

      document.getElementById('btnAspect').addEventListener('click', (e) => {
        e.stopPropagation();
        this.aspectIdx = (this.aspectIdx + 1) % this.aspects.length;
        const mode = this.aspects[this.aspectIdx];
        this.video.classList.remove('fit-contain', 'fit-cover', 'fit-fill', 'fit-original');
        this.video.classList.add(mode.cls);
        try { localStorage.setItem('rosi_player_aspect', mode.cls); } catch (e) {}
        document.getElementById('btnAspect').textContent = mode.label;
      });

      document.getElementById('btnFullscreen').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFullscreen();
      });

      document.getElementById('btnSwitchServer').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openServerDrawer();
      });

      document.getElementById('btnPlayerEpisodes').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEpisodesDrawer();
      });

      document.getElementById('btnQuality').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openQualityDrawer();
      });

      document.getElementById('btnNextEp').addEventListener('click', (e) => {
        e.stopPropagation();
        this.playNextEpisode();
      });

      // Video events
      this.video.addEventListener('timeupdate', () => {
        if (!this.video.duration) return;
        const pct = (this.video.currentTime / this.video.duration) * 100;
        document.getElementById('seekSlider').value = pct;
        document.getElementById('currentTimeText').textContent = formatTime(this.video.currentTime);
        document.getElementById('durationTimeText').textContent = formatTime(this.video.duration);
      });

      document.getElementById('seekSlider').addEventListener('input', (e) => {
        e.stopPropagation();
        if (this.video.duration) {
          this.video.currentTime = (parseFloat(e.target.value) / 100) * this.video.duration;
        }
        this.resetHudTimer();
      });

      this.video.addEventListener('waiting', () => this.showLoader('Đang tải đệm video...'));
      this.video.addEventListener('playing', () => {
        this.hideLoader();
        this.updatePlayIcon(true);
      });
      this.video.addEventListener('pause', () => this.updatePlayIcon(false));
      this.video.addEventListener('ended', () => this.playNextEpisode());
      this.video.addEventListener('error', () => {
        if (this.overlay.classList.contains('hidden')) return;
        this.hideLoader();
        showToast('Video gặp lỗi định dạng hoặc nguồn phát. Hãy thử server khác.');
      });

      // Tap / Double-tap on player
      let lastTap = 0;
      this.container.addEventListener('click', (e) => {
        if (e.target.closest('.player-drawer') || e.target.closest('button') || e.target.closest('input')) return;
        const now = Date.now();
        const diff = now - lastTap;
        if (diff < 280 && diff > 0) {
          const rect = this.container.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width * 0.4) {
            this.seekBy(-10);
          } else if (x > rect.width * 0.6) {
            this.seekBy(10);
          } else {
            this.togglePlay();
          }
        } else {
          this.toggleHud();
        }
        lastTap = now;
      });
    }

    showLoader(text) {
      document.getElementById('playerStatusText').textContent = text;
      this.loader.classList.remove('hidden');
    }

    hideLoader() {
      this.loader.classList.add('hidden');
    }

    toggleHud() {
      if (this.hud.classList.contains('hud-hidden')) {
        this.hud.classList.remove('hud-hidden');
        this.resetHudTimer();
      } else {
        this.hud.classList.add('hud-hidden');
      }
    }

    resetHudTimer() {
      this.hud.classList.remove('hud-hidden');
      clearTimeout(this.hudTimer);
      this.hudTimer = setTimeout(() => {
        if (!this.video.paused && document.getElementById('playerDrawer').classList.contains('hidden')) {
          this.hud.classList.add('hud-hidden');
        }
      }, 4200);
    }

    updatePlayIcon(isPlaying) {
      const icon = document.getElementById('iconPlayPause');
      if (isPlaying) {
        icon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
      } else {
        icon.innerHTML = '<polygon points="6 4 20 12 6 20 6 4"></polygon>';
      }
    }

    async safeAutoPlay() {
      try {
        const playPromise = this.video.play();
        if (playPromise !== undefined) await playPromise;
        this.updatePlayIcon(true);
      } catch (err) {
        console.warn('[ROSI Player] Autoplay có tiếng bị chặn, thử phát tắt tiếng tự động:', err?.name || err);
        try {
          this.video.muted = true;
          const muteBtn = document.getElementById('btnMute');
          if (muteBtn) muteBtn.textContent = '🔇';
          await this.video.play();
          this.updatePlayIcon(true);
          showToast('🔇 Đã tự động phát tắt tiếng — chạm nút Loa để bật tiếng', 3200);
        } catch (mutedErr) {
          this.updatePlayIcon(false);
          showToast('Nguồn đã sẵn sàng. Nhấn nút Play đỏ ở giữa để xem.');
        }
      }
    }

    togglePlay() {
      if (this.video.paused) {
        if (!this.video.currentSrc && !this.hls && this.sources.length > 0) {
          this.loadSource(this.activeSourceIndex || 0);
          return;
        }
        this.video.play().then(() => {
          this.updatePlayIcon(true);
        }).catch(() => {
          this.safeAutoPlay();
        });
      } else {
        this.video.pause();
        this.updatePlayIcon(false);
      }
      this.resetHudTimer();
    }

    seekBy(delta) {
      if (!isFinite(this.video.duration)) return;
      this.video.currentTime = Math.max(0, Math.min(this.video.duration, this.video.currentTime + delta));
      const el = document.getElementById(delta < 0 ? 'seekLeft' : 'seekRight');
      el.classList.remove('hidden');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.add('hidden'), 650);
      this.resetHudTimer();
    }

    async toggleFullscreen() {
      const statusBar = window.Capacitor?.Plugins?.StatusBar;
      try {
        if (!document.fullscreenElement) {
          if (this.container.requestFullscreen) await this.container.requestFullscreen();
          if (statusBar?.hide) await statusBar.hide().catch(() => {});
          if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
          this.overlay.classList.add('player-immersive');
        } else {
          if (document.exitFullscreen) await document.exitFullscreen();
          if (statusBar?.show) await statusBar.show().catch(() => {});
          if (screen.orientation?.unlock) screen.orientation.unlock();
          this.overlay.classList.remove('player-immersive');
        }
      } catch (e) {
        // Một số WebView/thiết bị không hỗ trợ Fullscreen API; overlay vẫn phủ toàn màn hình.
        this.overlay.classList.toggle('player-immersive');
        if (statusBar?.hide) statusBar.hide().catch(() => {});
        if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
      }
    }

    async playMovie(slug, episodeNum = '1', title = '', poster = '') {
      const requestId = ++this.playRequestId;
      this.currentSlug = slug;
      this.currentEpisode = String(episodeNum);
      if (title) this.currentTitle = title;
      if (poster) this.currentPoster = poster;

      const epDisplay = formatEpisodeLabel(this.currentEpisode);
      syncNativeStatusBar('#000000');
      this.overlay.classList.remove('hidden');
      if (window.innerWidth > window.innerHeight) {
        this.overlay.classList.add('player-immersive');
        window.Capacitor?.Plugins?.StatusBar?.hide?.().catch(() => {});
      }
      this.closeDrawer();
      this.resetHudTimer();
      this.showLoader(`Đang nạp nguồn phát ${epDisplay}...`);
      document.getElementById('hudMovieTitle').textContent = this.currentTitle || slug;
      document.getElementById('hudEpSubtitle').textContent = epDisplay;
      document.getElementById('currentTimeText').textContent = '00:00';
      document.getElementById('durationTimeText').textContent = '00:00';
      document.getElementById('seekSlider').value = 0;

      this.stopCurrentMedia();
      this.sources = [];
      this.episodes = [];

      try {
        const streamData = await window.movieApi.getStream(slug, this.currentEpisode);
        if (requestId !== this.playRequestId) return;
        const rawSources = Array.isArray(streamData?.sources) ? streamData.sources : [];
        this.sources = rawSources.map((source, index) => {
          const url = typeof source === 'string' ? source : (source?.url || source?.link || source?.link_m3u8 || source?.link_embed || '');
          const isHls = Boolean(source?.isHls || source?.type === 'm3u8' || /\.m3u8(?:$|[?#])/i.test(url));
          return {
            ...((typeof source === 'object' && source) ? source : {}),
            url,
            isHls,
            type: isHls ? 'm3u8' : (source?.type || 'embed'),
            label: source?.label || `Nguồn ${index + 1}`
          };
        }).filter(source => /^https?:\/\//i.test(source.url));
        this.episodes = Array.isArray(streamData?.episodes) ? streamData.episodes : [];
        this.activeSourceIndex = 0;

        if (!this.sources.length) {
          throw new Error('API có phản hồi nhưng không trả về đường dẫn video hợp lệ cho tập này.');
        }
        window.app.saveHistory(slug, this.currentTitle || slug, this.currentPoster, this.currentEpisode);
        this.loadSource(0);
      } catch (err) {
        if (requestId !== this.playRequestId) return;
        this.hideLoader();
        console.error('[ROSI Player] Không lấy được nguồn phát:', err);
        showToast(err.message || 'Không lấy được nguồn phát video.');
      }
    }

    stopCurrentMedia() {
      clearTimeout(this.sourceLoadTimer);
      if (this.hls) {
        try { this.hls.destroy(); } catch (e) { console.warn('[ROSI Player] HLS destroy:', e); }
        this.hls = null;
      }
      try {
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
      } catch (e) {}
      this.video.onerror = null;
      this.video.onloadedmetadata = null;
      this.video.oncanplay = null;
      this.embed.src = 'about:blank';
      this.embed.classList.add('hidden');
      this.video.classList.remove('hidden');
      document.getElementById('hudBottomControls').classList.remove('hidden');
    }

    loadSource(index) {
      const src = this.sources[index];
      if (!src || !src.url || !/^https?:\/\//i.test(src.url)) {
        this.hideLoader();
        showToast('Nguồn phát không hợp lệ hoặc không khả dụng.');
        return;
      }
      this.activeSourceIndex = index;
      this.hlsNetworkRetries = 0;
      this.hlsMediaRetries = 0;
      clearTimeout(this.sourceLoadTimer);
      document.getElementById('btnSwitchServer').textContent = (src.label || `Nguồn ${index + 1}`).split('(')[0].trim();
      this.stopCurrentMedia();
      this.showLoader(`Đang kết nối ${src.label || 'nguồn video'}...`);

      const currentReqId = this.playRequestId;
      let settled = false;

      const tryNext = (reason) => {
        if (settled || currentReqId !== this.playRequestId) return;
        settled = true;
        clearTimeout(this.sourceLoadTimer);
        console.warn('[ROSI Player] Nguồn phát lỗi:', reason);
        if (this.sources[index + 1]) {
          showToast('Đang chuyển sang nguồn phát dự phòng...');
          this.loadSource(index + 1);
        } else {
          this.hideLoader();
          showToast(`Không phát được video: ${reason}. Hãy thử server khác.`);
        }
      };

      const isHls = Boolean(src.isHls || src.type === 'm3u8' || /\.m3u8(?:$|[?#])/i.test(src.url));

      if (!isHls) {
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
        this.video.classList.add('hidden');
        document.getElementById('hudBottomControls').classList.add('hidden');
        this.embed.classList.remove('hidden');
        this.embed.onload = () => {
          clearTimeout(this.sourceLoadTimer);
          this.hideLoader();
        };
        this.embed.src = safeMediaUrl(src.url, 'about:blank');
        this.sourceLoadTimer = setTimeout(() => this.hideLoader(), 3500);
        return;
      }

      this.embed.classList.add('hidden');
      this.video.classList.remove('hidden');
      document.getElementById('hudBottomControls').classList.remove('hidden');

      // Tầng 2: Phát trực tiếp bằng trình giải mã gốc Android WebView (vượt qua lỗi CORS Origin của XHR)
      const startNativeHlsFallback = (fallbackReason) => {
        if (settled || currentReqId !== this.playRequestId) return;
        console.info('[ROSI Player] Chuyển sang Native HTML5 Video Engine:', fallbackReason);
        clearTimeout(this.sourceLoadTimer);
        if (this.hls) {
          try { this.hls.destroy(); } catch (e) {}
          this.hls = null;
        }

        this.showLoader('Đang kết nối luồng phát trực tiếp...');
        this.video.onloadedmetadata = () => {
          clearTimeout(this.sourceLoadTimer);
          this.hideLoader();
          const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
          document.getElementById('durationTimeText').textContent = formatTime(duration);
        };
        this.video.oncanplay = () => {
          clearTimeout(this.sourceLoadTimer);
          this.hideLoader();
        };
        this.video.onerror = () => {
          const code = this.video.error?.code || 0;
          const detail = ({
            1: 'phát bị hủy',
            2: 'lỗi mạng/máy chủ',
            3: 'lỗi giải mã video',
            4: 'định dạng không hỗ trợ'
          })[code] || 'không tải được luồng trực tiếp';
          tryNext(detail);
        };

        this.video.src = src.url;
        this.video.load();
        this.safeAutoPlay();

        this.sourceLoadTimer = setTimeout(() => {
          if (this.video.readyState < 1) {
            tryNext('quá thời gian phản hồi từ máy chủ phim');
          }
        }, 10000);
      };

      // Tầng 1: HLS.js (tắt WebWorker để tránh treo trên Android WebView)
      const HlsCtor = window.Hls;
      if (HlsCtor && HlsCtor.isSupported()) {
        try {
          this.video.onloadedmetadata = () => {
            clearTimeout(this.sourceLoadTimer);
            this.hideLoader();
            const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
            document.getElementById('durationTimeText').textContent = formatTime(duration);
          };
          this.video.oncanplay = () => {
            clearTimeout(this.sourceLoadTimer);
            this.hideLoader();
          };
          this.video.onerror = () => {
            if (!settled && currentReqId === this.playRequestId) {
              startNativeHlsFallback('HTML5 video error trong chế độ HLS.js');
            }
          };

          this.hls = new HlsCtor({
            maxBufferLength: 20,
            maxMaxBufferLength: 40,
            backBufferLength: 30,
            enableWorker: false,
            startLevel: -1,
            maxBufferHole: 0.5,
            manifestLoadingTimeOut: 9000,
            levelLoadingTimeOut: 9000,
            fragLoadingTimeOut: 12000,
            manifestLoadingMaxRetry: 1,
            levelLoadingMaxRetry: 1,
            fragLoadingMaxRetry: 2
          });

          const hls = this.hls;
          this.sourceLoadTimer = setTimeout(() => {
            if (this.hls === hls && this.video.readyState < 1) {
              startNativeHlsFallback('HLS.js quá thời gian tải manifest');
            }
          }, 9000);

          hls.on(HlsCtor.Events.MEDIA_ATTACHED, () => {
            if (this.hls === hls) hls.loadSource(src.url);
          });

          hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
            if (this.hls !== hls) return;
            clearTimeout(this.sourceLoadTimer);
            this.hideLoader();
            this.safeAutoPlay();
          });

          hls.on(HlsCtor.Events.ERROR, (event, data) => {
            if (!data?.fatal || this.hls !== hls) return;
            if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR && this.hlsNetworkRetries < 1) {
              this.hlsNetworkRetries += 1;
              hls.startLoad();
              return;
            }
            if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR && this.hlsMediaRetries < 1) {
              this.hlsMediaRetries += 1;
              hls.recoverMediaError();
              return;
            }
            startNativeHlsFallback(data.details || data.type || 'HLS.js fatal error');
          });

          hls.attachMedia(this.video);
        } catch (error) {
          startNativeHlsFallback(error.message || 'HLS.js init exception');
        }
      } else {
        startNativeHlsFallback('Trình duyệt ưu tiên HLS gốc');
      }
    }

    playNextEpisode() {
      if (!this.episodes || this.episodes.length <= 1) {
        showToast('Đã hết danh sách tập');
        return;
      }
      const idx = this.episodes.findIndex(e => String(e.number) === String(this.currentEpisode));
      if (idx >= 0 && idx + 1 < this.episodes.length) {
        const next = this.episodes[idx + 1];
        this.playMovie(this.currentSlug, next.number, this.currentTitle, this.currentPoster);
      } else {
        showToast('Bạn đang xem tập mới nhất!');
      }
    }

    openServerDrawer() {
      const drawer = document.getElementById('playerDrawer');
      const content = document.getElementById('drawerContent');
      document.getElementById('drawerTitle').textContent = 'Chọn Server Phát';
      content.innerHTML = '';

      this.sources.forEach((s, idx) => {
        const btn = document.createElement('button');
        btn.className = `drawer-option ${idx === this.activeSourceIndex ? 'active' : ''}`;
        btn.textContent = s.label;
        btn.onclick = () => {
          this.closeDrawer();
          this.showLoader(`Đang chuyển sang ${s.label}...`);
          this.loadSource(idx);
        };
        content.appendChild(btn);
      });
      drawer.classList.remove('hidden');
    }

    openQualityDrawer() {
      const drawer = document.getElementById('playerDrawer');
      const content = document.getElementById('drawerContent');
      document.getElementById('drawerTitle').textContent = 'Chất Lượng Hình Ảnh';
      content.innerHTML = '';

      if (!this.hls || !this.hls.levels || this.hls.levels.length === 0) {
        content.innerHTML = '<p style="color:#a1a1aa;font-size:13px;">Đang phát chất lượng gốc tự động (Full HD).</p>';
        drawer.classList.remove('hidden');
        return;
      }

      const autoBtn = document.createElement('button');
      autoBtn.className = `drawer-option ${this.hls.currentLevel === -1 ? 'active' : ''}`;
      autoBtn.textContent = 'Tự Động (Auto Tốt Nhất)';
      autoBtn.onclick = () => {
        this.hls.currentLevel = -1;
        document.getElementById('btnQuality').textContent = '4K / Auto';
        this.closeDrawer();
      };
      content.appendChild(autoBtn);

      this.hls.levels.forEach((lvl, idx) => {
        const btn = document.createElement('button');
        btn.className = `drawer-option ${this.hls.currentLevel === idx ? 'active' : ''}`;
        const label = lvl.height ? `${lvl.height}p HD` : `Mức ${idx + 1}`;
        btn.textContent = label;
        btn.onclick = () => {
          this.hls.currentLevel = idx;
          document.getElementById('btnQuality').textContent = label;
          this.closeDrawer();
        };
        content.appendChild(btn);
      });
      drawer.classList.remove('hidden');
    }

    openEpisodesDrawer() {
      const drawer = document.getElementById('playerDrawer');
      const content = document.getElementById('drawerContent');
      document.getElementById('drawerTitle').textContent = `Danh Sách Tập (${this.episodes.length})`;
      content.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'episode-grid';
      this.episodes.forEach(ep => {
        const btn = document.createElement('button');
        btn.className = `ep-btn ${String(ep.number) === String(this.currentEpisode) ? 'active' : ''}`;
        btn.textContent = ep.name;
        btn.onclick = () => {
          this.closeDrawer();
          this.playMovie(this.currentSlug, ep.number, this.currentTitle, this.currentPoster);
        };
        grid.appendChild(btn);
      });
      content.appendChild(grid);
      drawer.classList.remove('hidden');
    }

    closeDrawer() {
      document.getElementById('playerDrawer').classList.add('hidden');
    }

    close() {
      this.playRequestId += 1;
      this.stopCurrentMedia();
      this.overlay.classList.add('hidden');
      syncNativeStatusBar('#141414');
      const statusBar = window.Capacitor?.Plugins?.StatusBar;
      if (statusBar?.show) statusBar.show().catch(() => {});
      this.overlay.classList.remove('player-immersive');
      if (screen.orientation?.unlock) screen.orientation.unlock();
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  window.app = new RosiCinemaApp();
  window.player = new VipVideoPlayer();

  document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
  });
})();

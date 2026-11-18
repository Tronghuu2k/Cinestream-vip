/**
 * Motchill TV - Unified Movie API & Data Service
 * 
 * Cho phép ứng dụng chạy hoàn toàn ĐỘC LẬP (STANDALONE) KHÔNG CẦN MÁY CHỦ:
 * - Trực tiếp kết nối kho phim CDN chất lượng cao (HLS M3U8 Siêu Tốc FHD)
 * - Tương thích 100% khi chạy trong Android TV APK (file:///android_asset/www/...)
 * - Tự động phát hiện và hỗ trợ cả chế độ Server lẫn Offline/Standalone
 */

(function () {
  const PHIM_API_BASE = 'https://phimapi.com';
  const DEFAULT_CDN_IMAGE = 'https://phimimg.com';

  // In-memory cache for fast navigation on TV
  const cache = new Map();
  const CACHE_TTL = 3 * 60 * 1000; // 3 phút

  function getCache(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() > item.exp) {
      cache.delete(key);
      return null;
    }
    return item.data;
  }

  function setCache(key, data, ttl = CACHE_TTL) {
    if (cache.size > 25) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(key, { data, exp: Date.now() + ttl });
  }

  // Mọi yêu cầu API đều có timeout và kiểm tra HTTP/JSON rõ ràng.
  async function fetchJson(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('Kết nối API quá thời gian chờ. Vui lòng thử lại.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // Format full image url
  function getImageUrl(url, cdnBase = DEFAULT_CDN_IMAGE) {
    if (!url) return 'img/placeholder.svg';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const cleanCdn = cdnBase.replace(/\/+$/, '');
    const cleanPath = url.replace(/^\/+/, '');
    return `${cleanCdn}/${cleanPath}`;
  }

  // Normalize movie card item for TV UI
  function normalizeCardItem(raw, cdnBase = DEFAULT_CDN_IMAGE) {
    if (!raw) return null;
    const slug = raw.slug || '';
    const title = raw.name || raw.title || '';
    const rawPoster = raw.poster_url || raw.thumb_url || raw.poster || raw.thumb || '';
    const poster = getImageUrl(rawPoster, cdnBase);
    const rawThumb = raw.thumb_url || raw.poster_url || raw.thumb || raw.poster || '';
    const thumb = getImageUrl(rawThumb, cdnBase);
    
    let badge = raw.episode_current || raw.quality || raw.badge || '';
    if (raw.lang && !badge.includes(raw.lang)) {
      badge = badge ? `${badge} - ${raw.lang}` : raw.lang;
    }

    return {
      slug,
      title,
      thumb: poster,
      poster: poster,
      backdrop: thumb,
      badge: badge || 'HD'
    };
  }

  class MovieApiService {
    constructor() {
      this.primaryServer = '';
      this.backupServer = '';
      this.bothServersFailed = false;
      this.activeServer = '';

      try {
        this.primaryServer = localStorage.getItem('motchill_server_primary') || '';
        this.backupServer = localStorage.getItem('motchill_server_backup') || '';
        this.bothServersFailed = localStorage.getItem('motchill_both_failed') === 'true';
        this.activeServer = this.primaryServer || this.backupServer || '';
      } catch (e) {}
    }

    setServerEndpoints(primaryUrl, backupUrl, bothFailed = false) {
      this.primaryServer = (primaryUrl || '').trim().replace(/\/+$/, '');
      this.backupServer = (backupUrl || '').trim().replace(/\/+$/, '');
      this.bothServersFailed = Boolean(bothFailed);

      try {
        localStorage.setItem('motchill_server_primary', this.primaryServer);
        localStorage.setItem('motchill_server_backup', this.backupServer);
        localStorage.setItem('motchill_both_failed', this.bothServersFailed ? 'true' : 'false');
      } catch (e) {}

      if (!this.bothServersFailed) {
        this.activeServer = this.primaryServer || this.backupServer || '';
      } else {
        this.activeServer = '';
      }
      console.log('📡 [MovieApi] Đã nạp cấu hình máy chủ:', {
        primary: this.primaryServer,
        backup: this.backupServer,
        bothFailed: this.bothServersFailed,
        active: this.activeServer
      });
    }

    setCustomApiBase(url) {
      if (url && typeof url === 'string') {
        this.setServerEndpoints(url, this.backupServer, false);
      }
    }

    async fetchServer(endpoint) {
      if (this.bothServersFailed) return null;

      const candidates = [];
      if (this.activeServer) candidates.push(this.activeServer);
      if (this.primaryServer && !candidates.includes(this.primaryServer)) candidates.push(this.primaryServer);
      if (this.backupServer && !candidates.includes(this.backupServer)) candidates.push(this.backupServer);

      if (candidates.length === 0 && window.location.protocol !== 'file:') {
        candidates.push('');
      }

      if (candidates.length === 0) return null;

      for (const base of candidates) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const fullUrl = base ? `${base}${endpoint}` : endpoint;
          let res;
          try {
            res = await fetch(fullUrl, { signal: controller.signal, headers: { Accept: 'application/json' } });
          } finally {
            clearTimeout(timeoutId);
          }
          if (res.ok) {
            const data = await res.json();
            if (base && this.activeServer !== base) {
              this.activeServer = base;
              console.log(`✅ [MovieApi] Đã kết nối thành công máy chủ: ${base}`);
            }
            return data;
          }
        } catch (e) {
          console.warn(`[MovieApi] Máy chủ ${base || 'gốc'} không phản hồi (${endpoint}):`, e.message);
        }
      }

      // Cả máy chủ chính và phụ đều không phản hồi
      return null;
    }

    /**
     * Lấy dữ liệu Trang Chủ (Featured, Phim Bộ, Phim Lẻ, Phim Rạp, Hoạt Hình)
     */
    async getHome(forceRefresh = false) {
      const cacheKey = 'home_data';
      if (!forceRefresh) {
        const cached = getCache(cacheKey);
        if (cached) return cached;
      }

      // Thử nạp từ máy chủ (chính hoặc phụ)
      const serverData = await this.fetchServer(`/api/home${forceRefresh ? '?refresh=true' : ''}`);
      if (serverData && serverData.success && serverData.data && serverData.data.sections?.length > 0) {
        setCache(cacheKey, serverData.data);
        return serverData.data;
      }

      // Chế độ Standalone Direct CDN (Không cần Server)
      try {
        const [resHot, resBo, resLe, resRap, resAnime] = await Promise.allSettled([
          fetchJson(`${PHIM_API_BASE}/danh-sach/phim-moi-cap-nhat?page=1`),
          fetchJson(`${PHIM_API_BASE}/v1/api/danh-sach/phim-bo?page=1`),
          fetchJson(`${PHIM_API_BASE}/v1/api/danh-sach/phim-le?page=1`),
          fetchJson(`${PHIM_API_BASE}/v1/api/danh-sach/phim-chieu-rap?page=1`),
          fetchJson(`${PHIM_API_BASE}/v1/api/danh-sach/hoat-hinh?page=1`)
        ]);

        const sections = [];

        // 1. Phim Đề Cử & Thịnh Hành
        if (resHot.status === 'fulfilled' && resHot.value.items) {
          const cdn = resHot.value.APP_DOMAIN_CDN_IMAGE || DEFAULT_CDN_IMAGE;
          const items = resHot.value.items.map(it => normalizeCardItem(it, cdn)).filter(Boolean);
          if (items.length > 0) {
            sections.push({
              id: 'featured',
              title: 'Phim Mới & Đề Cử Thịnh Hành',
              icon: '🔥',
              items: items.slice(0, 24)
            });
          }
        }

        // 2. Phim Bộ Mới
        if (resBo.status === 'fulfilled' && resBo.value.data?.items) {
          const cdn = resBo.value.data.APP_DOMAIN_CDN_IMAGE || DEFAULT_CDN_IMAGE;
          const items = resBo.value.data.items.map(it => normalizeCardItem(it, cdn)).filter(Boolean);
          if (items.length > 0) {
            sections.push({
              id: 'phim-bo',
              title: 'Phim Bộ Mới Cập Nhật',
              icon: '📺',
              items: items.slice(0, 24)
            });
          }
        }

        // 3. Phim Lẻ Đặc Sắc
        if (resLe.status === 'fulfilled' && resLe.value.data?.items) {
          const cdn = resLe.value.data.APP_DOMAIN_CDN_IMAGE || DEFAULT_CDN_IMAGE;
          const items = resLe.value.data.items.map(it => normalizeCardItem(it, cdn)).filter(Boolean);
          if (items.length > 0) {
            sections.push({
              id: 'phim-le',
              title: 'Phim Lẻ Hay Tuyển Chọn',
              icon: '🎬',
              items: items.slice(0, 24)
            });
          }
        }

        // 4. Phim Chiếu Rạp
        if (resRap.status === 'fulfilled' && resRap.value.data?.items) {
          const cdn = resRap.value.data.APP_DOMAIN_CDN_IMAGE || DEFAULT_CDN_IMAGE;
          const items = resRap.value.data.items.map(it => normalizeCardItem(it, cdn)).filter(Boolean);
          if (items.length > 0) {
            sections.push({
              id: 'phim-chieu-rap',
              title: 'Phim Chiếu Rạp Bom Tấn',
              icon: '🍿',
              items: items.slice(0, 24)
            });
          }
        }

        // 5. Anime & Hoạt Hình
        if (resAnime.status === 'fulfilled' && resAnime.value.data?.items) {
          const cdn = resAnime.value.data.APP_DOMAIN_CDN_IMAGE || DEFAULT_CDN_IMAGE;
          const items = resAnime.value.data.items.map(it => normalizeCardItem(it, cdn)).filter(Boolean);
          if (items.length > 0) {
            sections.push({
              id: 'hoat-hinh',
              title: 'Anime & Hoạt Hình Tuyển Chọn',
              icon: '✨',
              items: items.slice(0, 24)
            });
          }
        }

        // Top Hero movie
        const topCandidate = sections[0]?.items[0] || sections[1]?.items[0] || null;
        let hero = null;
        if (topCandidate) {
          try {
            hero = await this.getMovieDetail(topCandidate.slug);
          } catch (e) {
            hero = topCandidate;
          }
        }

        if (!sections.length) {
          throw new Error('PhimAPI chưa trả về danh sách phim. Hãy kiểm tra mạng hoặc thử tải lại sau.');
        }
        const result = {
          hero,
          sections,
          lastUpdated: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now()
        };

        setCache(cacheKey, result);
        return result;
      } catch (err) {
        console.error('[MovieApi] Lỗi tải dữ liệu Trang Chủ:', err);
        throw new Error('Không thể kết nối kho phim. Vui lòng kiểm tra kết nối mạng Internet!');
      }
    }

    /**
     * Danh mục phim (Phim bộ, Phim lẻ, Thể loại, Quốc gia)
     */
    async getCategory(type, slug, page = 1) {
      const p = Math.max(1, parseInt(page, 10) || 1);
      const cacheKey = `cat_${type}_${slug}_p${p}`;
      const cached = getCache(cacheKey);
      if (cached) return cached;

      // Thử nạp danh mục từ máy chủ (chính hoặc phụ)
      const serverData = await this.fetchServer(`/api/category?type=${type}&slug=${slug}&page=${p}`);
      if (serverData && serverData.success && serverData.data) {
        setCache(cacheKey, serverData.data);
        return serverData.data;
      }

      // Standalone Direct API
      let endpoint = '';
      if (type === 'danh-sach') {
        endpoint = `${PHIM_API_BASE}/v1/api/danh-sach/${slug}?page=${p}`;
      } else if (type === 'the-loai') {
        const mappedSlug = slug === 'phim-hai' ? 'hai-huoc' : slug;
        endpoint = `${PHIM_API_BASE}/v1/api/the-loai/${mappedSlug}?page=${p}`;
      } else if (type === 'quoc-gia') {
        const mappedCountry = slug === 'phim-thai-lan' ? 'thai-lan' : slug;
        endpoint = `${PHIM_API_BASE}/v1/api/quoc-gia/${mappedCountry}?page=${p}`;
      } else {
        endpoint = `${PHIM_API_BASE}/v1/api/danh-sach/${slug}?page=${p}`;
      }

      const json = await fetchJson(endpoint);
      if (json.status === false || json.status === 'error') {
        throw new Error('Không thể tải danh sách phim.');
      }

      const dataObj = json.data || json;
      const cdn = dataObj.APP_DOMAIN_CDN_IMAGE || DEFAULT_CDN_IMAGE;
      const rawItems = dataObj.items || [];
      const items = rawItems.map(it => normalizeCardItem(it, cdn)).filter(Boolean);

      const title = dataObj.titlePage || slug;
      const totalItems = dataObj.params?.pagination?.totalItems || 0;
      const totalPerPage = dataObj.params?.pagination?.totalItemsPerPage || 24;
      const hasNext = (p * totalPerPage < totalItems) || items.length >= 12;

      const result = {
        title,
        type,
        slug,
        page: p,
        hasNext,
        items
      };

      setCache(cacheKey, result);
      return result;
    }

    /**
     * Tìm kiếm phim theo từ khóa
     */
    async search(query) {
      if (!query || !query.trim()) return [];
      const q = query.trim();
      const cacheKey = `search_${encodeURIComponent(q.toLowerCase())}`;
      const cached = getCache(cacheKey);
      if (cached) return cached;

      // Thử tìm kiếm từ máy chủ (chính hoặc phụ)
      const serverData = await this.fetchServer(`/api/search?q=${encodeURIComponent(q)}`);
      if (serverData && serverData.success && serverData.items) {
        setCache(cacheKey, serverData.items);
        return serverData.items;
      }

      // Standalone Direct API Search
      const url = `${PHIM_API_BASE}/v1/api/tim-kiem?keyword=${encodeURIComponent(q)}&limit=24`;
      const json = await fetchJson(url);
      
      const cdn = json.data?.APP_DOMAIN_CDN_IMAGE || DEFAULT_CDN_IMAGE;
      const rawItems = json.data?.items || [];
      const items = rawItems.map(it => normalizeCardItem(it, cdn)).filter(Boolean);

      setCache(cacheKey, items, 2 * 60 * 1000);
      return items;
    }

    /**
     * Chi tiết phim và danh sách tập
     */
    async getMovieDetail(slug) {
      const cacheKey = `movie_${slug}`;
      const cached = getCache(cacheKey);
      if (cached) return cached;

      // Thử lấy chi tiết phim từ máy chủ (chính hoặc phụ)
      const serverData = await this.fetchServer(`/api/movie/${slug}`);
      if (serverData && serverData.success && serverData.movie) {
        setCache(cacheKey, serverData.movie);
        return serverData.movie;
      }

      // Standalone Direct API Movie Detail
      const url = `${PHIM_API_BASE}/phim/${slug}`;
      const json = await fetchJson(url);

      if (!json.status || !json.movie) {
        throw new Error('Không tìm thấy thông tin phim này.');
      }

      const m = json.movie;
      const poster = getImageUrl(m.poster_url || m.thumb_url);
      const backdrop = getImageUrl(m.thumb_url || m.poster_url);

      const episodes = [];
      const seenEps = new Set();

      if (json.episodes && Array.isArray(json.episodes)) {
        for (const s of json.episodes) {
          if (!s.server_data) continue;
          for (const ep of s.server_data) {
            const rawNum = String(ep.name).replace(/^tập\s*/i, '').trim();
            const num = rawNum || String(episodes.length + 1);
            if (!seenEps.has(num)) {
              seenEps.add(num);
              episodes.push({
                number: num,
                name: isNaN(num) ? num : `Tập ${num}`,
                slug: ep.slug || `tap-${num}`,
                url: ep.link_m3u8 || ep.link_embed || ''
              });
            }
          }
        }
      }

      if (episodes.length === 0) {
        episodes.push({
          number: '1',
          name: 'Xem Phim (Full)',
          slug: 'full',
          url: ''
        });
      }

      // Format metadata
      const genreNames = Array.isArray(m.category) ? m.category.map(c => c.name).join(', ') : 'Phim Hay';
      const countryNames = Array.isArray(m.country) ? m.country.map(c => c.name).join(', ') : 'Quốc Tế';

      let cleanDesc = (m.content || 'Đang cập nhật nội dung phim...')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();

      const result = {
        slug: m.slug || slug,
        title: m.name || slug,
        originalTitle: m.origin_name || '',
        poster,
        backdrop,
        description: cleanDesc,
        year: String(m.year || '2026'),
        duration: m.time || 'N/A',
        country: countryNames,
        genre: genreNames,
        status: m.episode_current || `${episodes.length} Tập`,
        episodes
      };

      setCache(cacheKey, result);
      return result;
    }

    /**
     * Lấy nguồn video (HLS M3U8 & Embed) cho tập phim cụ thể
     */
    async getStream(slug, episodeNum = '1') {
      const targetEp = String(episodeNum).toLowerCase().replace(/^tập\s*/i, '').replace(/^tap[-_]?/i, '').trim();
      const cacheKey = `stream_${slug}_ep${targetEp}`;
      const cached = getCache(cacheKey);
      if (cached) return cached;

      // Thử lấy nguồn phát video từ máy chủ (chính hoặc phụ)
      const serverData = await this.fetchServer(`/api/stream/${slug}/${targetEp}`);
      if (serverData && serverData.success && serverData.sources && serverData.sources.length > 0) {
        setCache(cacheKey, serverData);
        return serverData;
      }

      // Standalone Direct API Stream Extraction
      const url = `${PHIM_API_BASE}/phim/${slug}`;
      const json = await fetchJson(url);

      if (!json.status || !json.episodes || json.episodes.length === 0) {
        throw new Error('Không tìm thấy nguồn video phát cho phim này.');
      }

      const sources = [];
      const seenUrls = new Set();
      const allEpisodes = [];
      const seenAllEps = new Set();

      // Chuẩn hoá mã tập để so sánh chính xác tuyệt đối: "01" == "1", "Tập 02" == "2", "Full" == "full"
      const cleanEp = (val) => {
        if (!val) return '';
        const s = String(val).toLowerCase().replace(/^tập\s*/i, '').replace(/^tap[-_]?/i, '').trim();
        const num = parseInt(s, 10);
        return (!isNaN(num) && num > 0) ? String(num) : s;
      };

      const normTarget = cleanEp(targetEp);

      // Duyệt qua tất cả Server (Vietsub, Thuyết minh, Lồng tiếng...)
      for (const server of json.episodes) {
        const sName = server.server_name || 'VIP Server';
        if (!server.server_data) continue;

        const isSingleEpServer = server.server_data.length === 1;

        for (const ep of server.server_data) {
          const rawNum = String(ep.name).replace(/^tập\s*/i, '').trim();
          const epNum = rawNum || '1';
          const epNorm = cleanEp(ep.name);
          const slugNorm = cleanEp(ep.slug);

          // Gom danh sách tập tổng hợp
          if (!seenAllEps.has(epNum)) {
            seenAllEps.add(epNum);
            allEpisodes.push({
              number: epNum,
              name: isNaN(epNum) ? epNum : `Tập ${epNum}`,
              slug: ep.slug,
              isCurrent: epNorm === normTarget
            });
          }

          // Kiểm tra xem tập này có khớp với tập cần xem không
          const isMatch = (epNorm === normTarget) || 
                          (slugNorm === normTarget) || 
                          (ep.slug === `tap-${normTarget}`) || 
                          (ep.slug === `tap-0${normTarget}`) || 
                          (isSingleEpServer) ||
                          (normTarget === '1' && (epNorm === 'full' || slugNorm === 'full')) ||
                          (normTarget === 'full' && (epNorm === '1' || slugNorm === '1'));

          if (isMatch) {
            // Nguồn HLS M3U8 trực tiếp
            if (ep.link_m3u8 && !seenUrls.has(ep.link_m3u8)) {
              seenUrls.add(ep.link_m3u8);
              sources.push({
                label: `${sName} (HLS Siêu Tốc)`,
                type: 'm3u8',
                url: ep.link_m3u8,
                isHls: true
              });
            }

            // Nguồn Embed dự phòng
            if (ep.link_embed && !seenUrls.has(ep.link_embed)) {
              seenUrls.add(ep.link_embed);
              sources.push({
                label: `${sName} (Dự Phòng)`,
                type: 'embed',
                url: ep.link_embed,
                isHls: false
              });
            }
          }
        }
      }

      // Nếu không tìm thấy tập theo tên, tự động nạp tập đầu tiên của mỗi server
      if (sources.length === 0) {
        console.warn(`[MovieApi] Không tìm thấy tập ${episodeNum}, tự động nạp tập đầu tiên khả dụng`);
        for (const server of json.episodes) {
          if (!server.server_data || server.server_data.length === 0) continue;
          const sName = server.server_name || 'VIP Server';
          const firstEp = server.server_data[0];
          if (firstEp.link_m3u8 && !seenUrls.has(firstEp.link_m3u8)) {
            seenUrls.add(firstEp.link_m3u8);
            sources.push({
              label: `${sName} (HLS Siêu Tốc)`,
              type: 'm3u8',
              url: firstEp.link_m3u8,
              isHls: true
            });
          }
          if (firstEp.link_embed && !seenUrls.has(firstEp.link_embed)) {
            seenUrls.add(firstEp.link_embed);
            sources.push({
              label: `${sName} (Dự Phòng)`,
              type: 'embed',
              url: firstEp.link_embed,
              isHls: false
            });
          }
        }
      }

      // Ưu tiên HLS M3U8 lên đầu
      sources.sort((a, b) => (b.isHls ? 1 : 0) - (a.isHls ? 1 : 0));

      if (sources.length === 0) {
        throw new Error(`Chưa có link xem cho Tập ${episodeNum}. Vui lòng thử lại hoặc chọn tập khác.`);
      }

      const result = {
        success: true,
        slug,
        currentEpisode: targetEp,
        sources,
        episodes: allEpisodes.length > 0 ? allEpisodes : [{ number: targetEp, name: `Tập ${targetEp}`, isCurrent: true }]
      };

      setCache(cacheKey, result);
      return result;
    }
  }

  // Khởi tạo Singleton toàn cục
  window.movieApi = new MovieApiService();
})();

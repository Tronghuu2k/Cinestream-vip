/* Rosi Rạp Phim MAX - mobile-first movie app */
import { App } from '@capacitor/app';
import { createClient } from '@supabase/supabase-js';
const $ = (s) => document.querySelector(s);
const STORE = { history: 'rosi_history', favorites: 'rosi_favorites', progress: 'rosi_progress', autoplay: 'rosi_autoplay', fit: 'rosi_fit' };
const cloudConfig = window.ROSI_CLOUD_CONFIG || {};
const cloudClient = cloudConfig.url && cloudConfig.anonKey && !cloudConfig.url.includes('YOUR_') && !cloudConfig.anonKey.includes('YOUR_') ? createClient(cloudConfig.url, cloudConfig.anonKey) : null;
let cloudUser = null, cloudSyncTimer = null, cloudBusy = false;
let catalog = [], activeMovie = null, activeEpisode = null, currentFilter = 'all', activeGenre = 'all', activeTab = 'favorites', currentPage = 'home', hls = null, currentSources = [], detailCache = new Map(), lastBackAt = 0, lastSwipeAt = 0, toastTimer = 0;
const get = (k, d = []) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} if ([STORE.history,STORE.favorites,STORE.progress].includes(k)) scheduleCloudSync(); };
function scheduleCloudSync() { if (!cloudClient || !cloudUser || cloudBusy || cloudSyncTimer) return; cloudSyncTimer = setTimeout(() => { cloudSyncTimer = null; syncCloud(false); }, 6000); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2300); }
function favorites() { return get(STORE.favorites); }
function historyItems() { return get(STORE.history); }
function find(id) { return catalog.find(x => String(x.id) === String(id)) || catalog.find(x => x.slug === id) || get('rosi_movie_cache',{})[id] || historyItems().find(x => String(x.id) === String(id))?.movie || null; }
function cacheMovie(m) { if (!m?.id) return; const cache=get('rosi_movie_cache',{}); cache[m.id]=m; set('rosi_movie_cache',cache); }
function normalizeApiCard(x) { const genre = Array.isArray(x.genre) ? x.genre.join(', ') : (Array.isArray(x.category) ? x.category.map(c => c.name || c).join(', ') : (x.genre || '')); const rawType=String(x.type || x.movie_type || '').toLowerCase(); const type=/series|phim-bo/.test(rawType)?'series':(/anime|hoat.?hinh/.test(rawType)?'anime':'movie'); return {...x, id:x.slug || x.id || x._id, title:x.title || x.name || 'Phim chưa có tên', poster:x.poster || x.thumb || x.poster_url || x.thumb_url || '', backdrop:x.backdrop || x.thumb || x.poster || x.thumb_url || '', genre, year:x.year || '', type, badge:x.badge || x.quality || 'HD', desc:x.description || x.desc || x.content || ''}; }
function card(m) { return `<button class="movie-card" data-id="${esc(m.id)}"><div class="poster">${m.poster ? `<img loading="lazy" src="${esc(m.poster)}" alt="" onerror="this.style.display='none'">` : '<span class="poster-fallback">▶</span>'}<small class="poster-badge">${esc(m.badge || 'HD')}</small></div><span class="movie-name">${esc(m.title)}</span><span class="movie-sub">${esc(m.year || '')} ${esc(m.genre || '')}</span></button>`; }
function genreList() { const values = new Set(); catalog.forEach(m => String(m.genre || '').split(/[,|]/).map(x => x.trim()).filter(Boolean).forEach(x => values.add(x))); const select = $('#genreSelect'); const old = activeGenre; select.innerHTML = '<option value="all">Tất cả thể loại</option>' + [...values].sort((a,b)=>a.localeCompare(b,'vi')).map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join(''); select.value = [...values].includes(old) ? old : 'all'; activeGenre = select.value; }
function applyFilters() { const list = catalog.filter(m => (currentFilter === 'all' || m.type === currentFilter || (currentFilter === 'anime' && /hoạt hình|anime/i.test(m.genre))) && (activeGenre === 'all' || String(m.genre).toLowerCase().includes(activeGenre.toLowerCase()))); $('#movieGrid').innerHTML = list.map(card).join('') || '<p class="muted">Không tìm thấy phim phù hợp.</p>'; }
function render() { applyFilters(); $('#suggestList').innerHTML = catalog.slice(6,18).map(card).join(''); const hs = historyItems().map(h => find(h.id)).filter(Boolean); $('#continueList').innerHTML = hs.map(card).join(''); $('#continueSection').classList.toggle('hidden', !hs.length); renderLibrary(); renderHistory(); genreList(); applyFilters(); }
function renderLibrary() { const ids = activeTab === 'favorites' ? favorites() : historyItems().map(x => x.id); $('#libraryGrid').innerHTML = ids.map(id => find(id)).filter(Boolean).map(card).join('') || '<div class="empty">♡<h3>Chưa có phim</h3><p>Nội dung bạn lưu sẽ xuất hiện tại đây.</p></div>'; }
function renderHistory() { $('#historyGrid').innerHTML = historyItems().map(x => find(x.id)).filter(Boolean).map(card).join('') || '<div class="empty">◷<h3>Chưa có lịch sử</h3><p>Phim bạn đã xem sẽ xuất hiện tại đây.</p></div>'; }
function renderSections(sections) { const all = []; let html = ''; for (const sec of sections || []) { const sectionType = sec.id === 'phim-bo' ? 'series' : sec.id === 'hoat-hinh' ? 'anime' : sec.id === 'phim-le' ? 'movie' : ''; const items = (sec.items || []).map(x => normalizeApiCard({...x, type: x.type || sectionType})).filter(x => x.id); all.push(...items); html += `<section class="section api-section"><div class="section-head"><h2>${esc(sec.icon || '✦')} ${esc(sec.title || 'Phim')}</h2></div><div class="horizontal-list">${items.map(card).join('')}</div></section>`; } catalog = all.filter((m,i,a)=>a.findIndex(x=>x.id===m.id)===i); const old = $('#apiSections'); if (old) old.remove(); const node = document.createElement('div'); node.id = 'apiSections'; node.innerHTML = html; $('#main').insertBefore(node, $('#continueSection')); render(); $('#hero').classList.toggle('hidden', !catalog.length); }
async function loadHome(force = false) { try { toast('Đang cập nhật danh sách phim…'); const data = await window.movieApi.getHome(force); if (!data?.sections?.length) throw new Error('API chưa trả về danh sách phim'); renderSections(data.sections); if (data.hero) { const hero = normalizeApiCard(data.hero); $('#hero').querySelector('h1').textContent = hero.title; $('#hero').querySelector('p').textContent = hero.desc || 'Khám phá bộ phim nổi bật.'; if (hero.backdrop) $('#hero').style.backgroundImage = `linear-gradient(90deg,#090812 0%,#090812d9 48%,#09081233 100%),url("${hero.backdrop}")`; $('#heroExplore').onclick = () => openDetail(hero); } toast('Đã cập nhật phim mới'); } catch (e) { console.error(e); $('#movieGrid').innerHTML = '<div class="empty">☁<h3>Chưa tải được phim</h3><p>Kiểm tra kết nối mạng hoặc thử tải lại.</p><button class="primary-btn" onclick="location.reload()">Thử lại</button></div>'; toast('Không kết nối được nguồn phim'); } }
async function openDetail(m) { cacheMovie(m); activeMovie = m; $('#detailModal').classList.remove('hidden'); $('#detailTitle').textContent = m.title; $('#detailMeta').textContent = [m.year,m.genre,m.badge].filter(Boolean).join(' • '); $('#detailDesc').textContent = m.desc || 'Đang tải thông tin phim…'; $('#detailCover').innerHTML = m.backdrop ? `<img src="${esc(m.backdrop)}" alt="">` : ''; $('#favoriteBtn').textContent = favorites().includes(m.id) ? '♥ Đã yêu thích' : '♡ Yêu thích'; $('#episodeArea').innerHTML = '<p class="muted">Đang tải danh sách tập…</p>'; try { let d = detailCache.get(m.id); if (!d) { d = await window.movieApi.getMovieDetail(m.slug || m.id); detailCache.set(m.id,d); } activeMovie = {...m,...d,id:m.id,slug:d.slug || m.slug}; $('#detailTitle').textContent = d.title || m.title; $('#detailMeta').textContent = [d.year,d.genre,d.country,d.duration].filter(Boolean).join(' • '); $('#detailDesc').textContent = d.description || m.desc || ''; $('#detailCover').innerHTML = d.backdrop ? `<img src="${esc(d.backdrop)}" alt="">` : ''; const eps = d.episodes || []; $('#episodeArea').innerHTML = eps.map((ep,i)=>`<button class="episode" data-episode="${i}">▶ ${esc(ep.name || `Tập ${i+1}`)}</button>`).join('') || '<p class="muted">Chưa có danh sách tập.</p>'; } catch(e) { $('#episodeArea').innerHTML = '<p class="muted">Không lấy được chi tiết phim. Thử lại sau.</p>'; console.warn(e); } }
function resetQuality() { $('#qualitySelect').innerHTML = '<option value="auto">Tự động</option>'; }
function updateQualityOptions() { const select = $('#qualitySelect'); select.innerHTML = '<option value="auto">Tự động</option>'; if (!hls || !hls.levels?.length) return; const levels = hls.levels.map((l,i)=>({i,h:l.height||0,b:l.bitrate||0})).sort((a,b)=>a.h-b.h); const unique = new Map(); levels.forEach(x=>unique.set(x.h || `bitrate-${x.b}`,x)); for (const x of unique.values()) { const label = x.h >= 2160 ? '4K · 2160p' : x.h >= 1440 ? '2K · 1440p' : x.h >= 1080 ? 'Full HD · 1080p' : x.h >= 720 ? 'HD · 720p' : x.h ? `${x.h}p` : `${Math.round(x.b/1000)} kbps`; const option = document.createElement('option'); option.value = String(x.i); option.textContent = label; select.append(option); } }
function chooseQuality(value) { if (!hls) { toast('Nguồn hiện tại không hỗ trợ chọn chất lượng riêng'); return; } hls.currentLevel = value === 'auto' ? -1 : Number(value); toast(value === 'auto' ? 'Đã bật chất lượng tự động' : `Đã chọn ${$('#qualitySelect').selectedOptions[0]?.textContent || 'chất lượng'}`); }
function setFit(mode) { const video = $('#video'); video.dataset.fit = mode; video.style.objectFit = mode; $('#fitBtn').textContent = mode === 'contain' ? 'Vừa màn hình' : 'Lấp đầy màn hình'; set(STORE.fit,mode); }
function setSourceOptions(sources) { $('#sourceSelect').innerHTML = sources.map((s,i)=>`<option value="${i}">${esc(s.label || `Nguồn ${i+1}`)}</option>`).join(''); }
async function startSource(index = 0) {
  const source = currentSources[index]; if (!source?.url) throw new Error('Nguồn phát không hợp lệ');
  const video = $('#video'), frame = $('#embedFrame');
  if (hls) { hls.destroy(); hls = null; }
  video.pause(); video.removeAttribute('src'); video.load(); frame.src='about:blank'; frame.classList.add('hidden'); video.classList.remove('hidden'); resetQuality();
  $('#playerStatus').textContent = source.label || 'Đang phát';
  if (source.type === 'embed') { video.classList.add('hidden'); frame.classList.remove('hidden'); frame.src=source.url; $('#qualitySelect').innerHTML='<option value="auto">Theo trình phát nhúng</option>'; $('#qualitySelect').disabled=true; return; }
  $('#qualitySelect').disabled=false;
  if ((source.isHls || /\.m3u8(?:$|\?)/i.test(source.url)) && window.Hls && Hls.isSupported()) {
    hls = new Hls({enableWorker:true,capLevelToPlayerSize:true,startLevel:-1});
    hls.on(Hls.Events.MANIFEST_PARSED,()=>{updateQualityOptions(); video.play().catch(()=>{});});
    hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal) $('#playerStatus').textContent='Nguồn video gặp lỗi. Thử đổi nguồn.';});
    hls.loadSource(source.url); hls.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src=source.url; video.play().catch(()=>{}); $('#qualitySelect').innerHTML='<option value="auto">Tự động / theo nguồn</option>'; }
  else { video.src=source.url; video.play().catch(()=>{}); $('#qualitySelect').innerHTML='<option value="auto">Chất lượng gốc của nguồn</option>'; }
}
async function play(m, episode = null) { if (!m) return; activeMovie = m; const savedProgress=get(STORE.progress,{})[m.id]; const resumeEpisode=!episode && savedProgress?.episode && m.episodes?.find(ep=>String(ep.number||ep.name)===String(savedProgress.episode)); activeEpisode = episode || resumeEpisode || m.episodes?.[0] || null; $('#video').dataset.resumeAsked = ''; $('#player').classList.remove('hidden'); $('#detailModal').classList.add('hidden'); $('#playerTitle').textContent = m.title + (activeEpisode?.name ? ' · ' + activeEpisode.name : ''); $('#playerStatus').textContent = 'Đang lấy nguồn phát…'; $('#sourceSelect').innerHTML = '<option>Đang tải…</option>'; try { const epNum = activeEpisode?.number || activeEpisode?.name || '1'; const result = await window.movieApi.getStream(m.slug || m.id,epNum); currentSources = result.sources || []; if (!currentSources.length) throw new Error('Không có nguồn phát cho nội dung này'); setSourceOptions(currentSources); await startSource(0); let hs = historyItems().filter(x=>x.id !== m.id); hs.unshift({id:m.id,at:Date.now(),movie:{...m}}); set(STORE.history,hs.slice(0,100)); const video = $('#video'); video.ontimeupdate = () => { if (video.duration) { const p = get(STORE.progress,{}); p[m.id] = {time:video.currentTime,duration:video.duration,episode:epNum,updatedAt:Date.now()}; set(STORE.progress,p); } }; video.onloadedmetadata = () => { const p = get(STORE.progress,{})[m.id]; if (p?.time > 10 && p.time < video.duration - 15 && String(p.episode) === String(epNum) && !video.dataset.resumeAsked) { video.dataset.resumeAsked = '1'; if (confirm(`Tiếp tục từ ${Math.floor(p.time/60)} phút ${Math.floor(p.time%60)} giây?`)) video.currentTime = p.time; } }; video.onended = () => { if (get(STORE.autoplay,true)) nextEpisode(); }; render(); } catch(e) { console.error(e); $('#playerStatus').textContent = e.message || 'Không phát được video'; toast(e.message || 'Không phát được video'); } }
function nextEpisode() { if (!activeMovie) return; const eps = activeMovie.episodes || []; const i = eps.findIndex(x=>x===activeEpisode || String(x.number)===String(activeEpisode?.number)); if (eps[i+1]) play(activeMovie,eps[i+1]); else toast('Bạn đã xem hết các tập'); }
function closePlayer() { $('#video').pause(); $('#embedFrame').src='about:blank'; $('#embedFrame').classList.add('hidden'); $('#video').classList.remove('hidden'); if (hls) { hls.destroy(); hls = null; } $('#player').classList.add('hidden'); }
function page(name) { currentPage = name; $('#main').classList.toggle('hidden',name !== 'home'); $('#libraryPage').classList.toggle('hidden',name !== 'library'); $('#historyPage').classList.toggle('hidden',name !== 'history'); $('#downloadsPage').classList.toggle('hidden',name !== 'downloads'); document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===name)); if (name==='library') renderLibrary(); if (name==='history') renderHistory(); }
function backAction() { if (!$('#player').classList.contains('hidden')) { closePlayer(); return; } if (!$('#detailModal').classList.contains('hidden')) { $('#detailModal').classList.add('hidden'); return; } if (!$('#searchWrap').classList.contains('hidden')) { $('#searchWrap').classList.add('hidden'); $('#searchInput').value=''; return; } if (currentPage !== 'home') { page('home'); return; } const now = Date.now(); if (now - lastBackAt < 2200) { if (App?.exitApp) App.exitApp(); } else { lastBackAt = now; toast('Nhấn quay lại lần nữa để thoát ứng dụng'); } }
function setupNativeBack() { if (App?.addListener) App.addListener('backButton', () => backAction()); window.addEventListener('popstate',()=>{backAction(); historyPush();}); historyPush(); }
function historyPush() { try { window.history.pushState({rosi:true},'','#rosi'); } catch {} }
// Double downward two-finger swipe is an optional shortcut; Android Back remains the primary exit gesture.
let touchStart = null; document.addEventListener('touchstart',e=>{if(e.touches.length===2) touchStart={y:(e.touches[0].clientY+e.touches[1].clientY)/2};},{passive:true}); document.addEventListener('touchend',e=>{if(!touchStart)return;const y=e.changedTouches.length?Array.from(e.changedTouches).reduce((a,t)=>a+t.clientY,0)/e.changedTouches.length:touchStart.y;const delta=y-touchStart.y;touchStart=null;if(delta>100){const now=Date.now();if(now-lastSwipeAt<2200){if(App?.exitApp) App.exitApp();}else{lastSwipeAt=now;toast('Vuốt hai ngón xuống lần nữa để thoát');}}},{passive:true});
document.addEventListener('click',e=>{const c=e.target.closest('.movie-card'); if(c){const m=find(c.dataset.id); if(m)openDetail(m);} const p=e.target.closest('[data-page]'); if(p)page(p.dataset.page); const f=e.target.closest('[data-filter]'); if(f){currentFilter=f.dataset.filter;document.querySelectorAll('.quick-nav button').forEach(b=>b.classList.toggle('active',b===f));applyFilters();} const ep=e.target.closest('[data-episode]'); if(ep&&activeMovie)play(activeMovie,activeMovie.episodes[+ep.dataset.episode]); if(e.target.matches('[data-close]'))$('#detailModal').classList.add('hidden');});
async function loadCategory(type) { try { const map={series:'phim-bo',movie:'phim-le',anime:'hoat-hinh'}; const d=await window.movieApi.getCategory('danh-sach',map[type]||type,1); catalog=(d.items||[]).map(normalizeApiCard).filter(x=>x.id); genreList(); applyFilters(); } catch(e) { toast('Không tải được danh mục'); } }

function cloudStatus(message) { const el = $('#cloudStatus'); if (el) el.textContent = message; }
function cloudSnapshot() { return { favorites:favorites(), history:historyItems(), progress:get(STORE.progress,{}), movieCache:get('rosi_movie_cache',{}), updatedAt:new Date().toISOString() }; }
function mergeCloud(local, remote) {
  const fav = [...new Set([...(local.favorites||[]), ...(remote.favorites||[])])];
  const hist = new Map(); [...(local.history||[]), ...(remote.history||[])].forEach(x=>{ if(x?.id) { const old=hist.get(x.id); if(!old || (x.at||0)>(old.at||0)) hist.set(x.id,x); } });
  const progress = {...(remote.progress||{})}; Object.entries(local.progress||{}).forEach(([id,value])=>{if(!progress[id] || (value.updatedAt||0)>=(progress[id].updatedAt||0)) progress[id]=value;});
  return {favorites:fav,history:[...hist.values()].sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,150),progress,movieCache:{...(remote.movieCache||{}),...(local.movieCache||{})}};
}
async function syncCloud(showToast=true) {
  if (!cloudClient || !cloudUser || cloudBusy) return; cloudBusy=true; cloudStatus('Đang đồng bộ…');
  try {
    const {data,error}=await cloudClient.from('rosi_user_data').select('payload').eq('user_id',cloudUser.id).maybeSingle(); if(error) throw error;
    const local=cloudSnapshot(); const merged=mergeCloud(local,data?.payload||{});
    set(STORE.favorites,merged.favorites); set(STORE.history,merged.history); set(STORE.progress,merged.progress); set('rosi_movie_cache',merged.movieCache||{});
    const {error:saveError}=await cloudClient.from('rosi_user_data').upsert({user_id:cloudUser.id,payload:merged,updated_at:new Date().toISOString()},{onConflict:'user_id'}); if(saveError) throw saveError;
    cloudStatus('Đã đồng bộ đám mây'); render(); if(showToast) toast('Đã đồng bộ dữ liệu Rosi');
  } catch(e) { console.error('Cloud sync:',e); cloudStatus('Chưa đồng bộ · kiểm tra cấu hình hoặc mạng'); if(showToast) toast('Đồng bộ thất bại. Kiểm tra cấu hình Supabase.'); } finally { cloudBusy=false; }
}
async function refreshCloudSession() {
  if(!cloudClient) { cloudStatus('Chưa cấu hình Supabase'); $('#cloudAccountBtn').textContent='Thiết lập đồng bộ'; return; }
  let data; try { const result=await cloudClient.auth.getSession(); data=result.data; } catch(e) { cloudStatus('Không kết nối được Supabase'); return; } cloudUser=data.session?.user||null;
  $('#cloudAccountBtn').textContent=cloudUser ? 'Tài khoản đám mây' : 'Đăng nhập đồng bộ'; cloudStatus(cloudUser ? `Đã đăng nhập: ${cloudUser.email||'tài khoản'}` : 'Chưa đăng nhập đồng bộ');
  if(cloudUser) await syncCloud(false);
}
$('#cloudAccountBtn').onclick=async()=>{
  if(!cloudClient){ $('#cloudModal').classList.remove('hidden'); cloudStatus('Chưa cấu hình Supabase. Xem file SUPABASE-SETUP.md.'); return; }
  if(cloudUser){ const choice=confirm('Đăng xuất tài khoản đồng bộ?'); if(choice){await cloudClient.auth.signOut();cloudUser=null;await refreshCloudSession();toast('Đã đăng xuất đồng bộ');} return; }
  $('#cloudModal').classList.remove('hidden');
};
$('#cloudClose').onclick=()=>$('#cloudModal').classList.add('hidden');
$('#cloudSignIn').onclick=async()=>{
  if(!cloudClient){toast('Cần cấu hình Supabase trước');return;} const email=$('#cloudEmail').value.trim(),password=$('#cloudPassword').value; if(!email||!password){toast('Nhập email và mật khẩu');return;}
  try { let result; if($('#cloudMode').value==='signup') result=await cloudClient.auth.signUp({email,password}); else result=await cloudClient.auth.signInWithPassword({email,password}); if(result.error) throw result.error; cloudUser=result.data.user; if(!result.data.session && $('#cloudMode').value==='signup') {cloudStatus('Hãy xác nhận email rồi đăng nhập.');toast('Kiểm tra email xác nhận');return;} $('#cloudModal').classList.add('hidden'); await refreshCloudSession(); toast('Đăng nhập đồng bộ thành công'); } catch(e){cloudStatus(e.message||'Không đăng nhập được');}
};
$('#cloudSyncNow').onclick=()=>syncCloud(true);

$('#searchToggle').onclick=()=>{$('#searchWrap').classList.toggle('hidden'); if(!$('#searchWrap').classList.contains('hidden'))$('#searchInput').focus();};
$('#clearSearch').onclick=()=>{$('#searchInput').value='';loadHome(true);};
let searchTimer; $('#searchInput').oninput=e=>{clearTimeout(searchTimer);const q=e.target.value.trim();if(!q){applyFilters();return;}searchTimer=setTimeout(async()=>{try{const a=await window.movieApi.search(q);catalog=a.map(normalizeApiCard).filter(x=>x.id);genreList();applyFilters();}catch(err){toast('Tìm kiếm thất bại');}},350);};
$('#genreSelect').onchange=e=>{activeGenre=e.target.value;applyFilters();};
$('#clearFilters').onclick=()=>{currentFilter='all';activeGenre='all';$('#genreSelect').value='all';document.querySelectorAll('.quick-nav button').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));applyFilters();};
$('#heroExplore').onclick=()=>$('#movieGrid').scrollIntoView({behavior:'smooth'});
$('#favoriteBtn').onclick=()=>{if(!activeMovie)return;cacheMovie(activeMovie);let a=favorites();a=a.includes(activeMovie.id)?a.filter(x=>x!==activeMovie.id):[activeMovie.id,...a];set(STORE.favorites,a);$('#favoriteBtn').textContent=a.includes(activeMovie.id)?'♥ Đã yêu thích':'♡ Yêu thích';renderLibrary();toast('Đã cập nhật yêu thích');};
$('#playBtn').onclick=()=>play(activeMovie);
$('#closePlayer').onclick=closePlayer;
$('#fullscreenBtn').onclick=()=>{const v=$('#videoStage');if(v.requestFullscreen)v.requestFullscreen();else if($('#video').webkitEnterFullscreen)$('#video').webkitEnterFullscreen();};
$('#fitBtn').onclick=()=>setFit($('#video').dataset.fit==='contain'?'cover':'contain');
$('#qualitySelect').onchange=e=>chooseQuality(e.target.value);
$('#sourceSelect').onchange=e=>startSource(Number(e.target.value)).catch(err=>toast(err.message));
$('#nextEpisode').onclick=nextEpisode;
$('#reloadBtn').onclick=()=>{toast('Đang tải lại Rosi Rạp Phim…');location.reload();};
$('#dismissWelcome').onclick=()=>$('#welcomeStrip').classList.add('hidden');
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));renderLibrary();});
$('#qualitySelect').innerHTML='<option value="auto">Tự động</option>';
const welcomeHour = new Date().getHours(); $('#welcomeTitle').textContent = welcomeHour < 11 ? 'Chào buổi sáng! Chào mừng đến Rosi.' : welcomeHour < 18 ? 'Chào buổi chiều! Chào mừng đến Rosi.' : 'Chào buổi tối! Chào mừng đến Rosi.';
setFit(get(STORE.fit,'contain'));
render(); setupNativeBack(); refreshCloudSession(); loadHome(); document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden') scheduleCloudSync();});

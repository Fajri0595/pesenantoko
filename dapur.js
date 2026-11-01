// Layar Dapur & Antrean TV: Mode TV Ruang Tunggu & Mode KDS Kerja Dapur, Ding-Dong chime, TTS, Fullscreen.
const rp = (n) => 'Rp' + (n || 0).toLocaleString('id-ID');
const token = () => localStorage.getItem('admin_token') || '';
const escD = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let kenal = {}, suara = false, ctxSuara = null, pollTimer = null, DAPUR_CACHE = [], gagalBeruntun = 0;
let displayMode = localStorage.getItem('dapur_display_mode') || 'tv'; // 'tv' | 'kds'
let lastCalledCode = null;
let callBannerTimer = null;

function setDisplayMode(mode) {
  displayMode = mode;
  localStorage.setItem('dapur_display_mode', mode);
  document.getElementById('btnModeTV')?.classList.toggle('on', mode === 'tv');
  document.getElementById('btnModeKDS')?.classList.toggle('on', mode === 'kds');
  const viewTV = document.getElementById('viewTV');
  const viewKDS = document.getElementById('viewKDS');
  if (viewTV) viewTV.style.display = mode === 'tv' ? 'flex' : 'none';
  if (viewKDS) viewKDS.style.display = mode === 'kds' ? 'block' : 'none';
  document.body.classList.toggle('tv-mode-active', mode === 'tv');
  renderCurrentView();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

async function pair() {
  const username = document.getElementById('du').value, password = document.getElementById('dp').value;
  document.getElementById('dmsg').textContent = 'Memverifikasi kredensial...';
  try {
    const j = await apiPost({ action: 'adminLogin', username, password });
    localStorage.setItem('admin_token', j.token);
    mulai();
  } catch (e) { document.getElementById('dmsg').textContent = e.message; }
}
function keluar() { localStorage.removeItem('admin_token'); location.reload(); }

function aktifkanSuara() {
  try {
    if (!ctxSuara) ctxSuara = new (window.AudioContext || window.webkitAudioContext)();
    if (ctxSuara && ctxSuara.state === 'suspended') ctxSuara.resume();
  } catch (e) { /* abaikan */ }
  suara = true;
  const btn = document.getElementById('btnSound');
  if (btn) {
    btn.textContent = '✓ Bel Suara Aktif';
    btn.style.borderColor = 'var(--brand)';
    btn.style.color = 'var(--brand)';
  }
  dingDong();
}

// Bel Ding-Dong 2-nada merdu untuk panggilan antrean TV
function dingDong() {
  if (!suara || !ctxSuara) return;
  try {
    if (ctxSuara.state === 'suspended') ctxSuara.resume();
    const t0 = ctxSuara.currentTime;
    // Nada 1: D5 (587.33 Hz)
    const o1 = ctxSuara.createOscillator(), g1 = ctxSuara.createGain();
    o1.type = 'sine'; o1.frequency.value = 587.33;
    o1.connect(g1); g1.connect(ctxSuara.destination);
    g1.gain.setValueAtTime(0.001, t0);
    g1.gain.exponentialRampToValueAtTime(0.65, t0 + 0.05);
    g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    o1.start(t0); o1.stop(t0 + 0.62);

    // Nada 2: A5 (880.00 Hz)
    const t1 = t0 + 0.42;
    const o2 = ctxSuara.createOscillator(), g2 = ctxSuara.createGain();
    o2.type = 'sine'; o2.frequency.value = 880.00;
    o2.connect(g2); g2.connect(ctxSuara.destination);
    g2.gain.setValueAtTime(0.001, t1);
    g2.gain.exponentialRampToValueAtTime(0.7, t1 + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, t1 + 0.95);
    o2.start(t1); o2.stop(t1 + 0.98);
  } catch (e) { /* abaikan */ }
}

function bip(kali) {
  if (!suara || !ctxSuara) return;
  for (let i = 0; i < (kali || 1); i++) {
    const o = ctxSuara.createOscillator(), g = ctxSuara.createGain();
    o.connect(g); g.connect(ctxSuara.destination);
    o.frequency.value = 880; o.type = 'sine';
    const t = ctxSuara.currentTime + i * 0.35;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.start(t); o.stop(t + 0.32);
  }
}

let dapurFilter = 'all';
function setDapurFilter(flt) {
  dapurFilter = flt;
  document.getElementById('dFltAll')?.classList.toggle('on', flt === 'all');
  document.getElementById('dFltDI')?.classList.toggle('on', flt === 'dine_in');
  document.getElementById('dFltTA')?.classList.toggle('on', flt === 'takeaway');
  poll(true);
}

function panggilById(id) {
  const o = DAPUR_CACHE.find((x) => Number(x.id) === Number(id));
  if (!o) return;
  const isDineIn = o.order_type === 'dine_in' || /^DI-/i.test(o.queue_no || '');
  panggil(o.queue_no || o.code, o.customer_name || '', isDineIn, o.table_no || '', o.code);
}

function panggil(queue, nama, isDineIn, tableNo, code) {
  lastCalledCode = code || queue;
  dingDong();
  showTVCallBanner(queue, nama, isDineIn, tableNo);

  try {
    const q = String(queue || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 20);
    const n = String(nama || '').replace(/[<>"']/g, '').slice(0, 40);
    let text = '';
    if (isDineIn) {
      text = 'Pesanan ' + (tableNo ? 'Meja ' + tableNo : 'Dine In') + ', atas nama ' + n + ', telah siap disajikan. Selamat menikmati.';
    } else {
      text = 'Nomor antrean ' + q + ', pesanan atas nama ' + n + ', telah siap dan dapat diambil di counter. Terima kasih.';
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'id-ID';
    u.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) { /* abaikan */ }

  renderCurrentView();
}

function showTVCallBanner(queue, nama, isDineIn, tableNo) {
  const banner = document.getElementById('tvCallBanner');
  const bNo = document.getElementById('tvCallNo');
  const bInfo = document.getElementById('tvCallInfo');
  if (!banner || !bNo) return;

  bNo.textContent = queue;
  const target = isDineIn ? (tableNo ? 'Meja ' + tableNo : 'Dine-In') : 'Silakan ke Counter';
  bInfo.textContent = `Atas Nama ${nama || 'Pelanggan'} • ${target}`;
  banner.style.display = 'block';

  clearTimeout(callBannerTimer);
  callBannerTimer = setTimeout(() => {
    banner.style.display = 'none';
  }, 8500);
}

function elapsedMin(dibuat) {
  const d = new Date(String(dibuat || '').replace(' ', 'T')).getTime();
  if (isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d) / 60000));
}
function elapsed(dibuat) {
  const m = elapsedMin(dibuat);
  return m < 60 ? m + ' mnt' : Math.floor(m / 60) + ' jam ' + (m % 60) + ' mnt';
}
function slaClass(mnt) { return mnt >= 25 ? 'bad' : (mnt >= 12 ? 'warn' : ''); }

let cariT = null;
function cariDapur() { clearTimeout(cariT); cariT = setTimeout(() => poll(true), 400); }

async function poll(manual) {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  try {
    const rows = await apiGet('adminOrders', { token: token() });
    gagalBeruntun = 0;
    DAPUR_CACHE = rows;

    let baru = 0;
    rows.forEach((o) => {
      if ((o.status === 'dimasak' || o.status === 'siap_diambil') && !kenal[o.id]) { baru++; }
      kenal[o.id] = o.status;
    });
    if (baru > 0 && !manual) bip(2);

    renderCurrentView();
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/login/i.test(msg)) {
      localStorage.removeItem('admin_token');
      document.getElementById('dMain').style.display = 'none';
      document.getElementById('dLogin').style.display = 'block';
      document.getElementById('btnOut').style.display = 'none';
      document.getElementById('dmsg').textContent = 'Sesi berakhir (' + msg + '). Silakan tautkan ulang.';
      return;
    }
    gagalBeruntun++;
    const tunggu = Math.min(60, 10 * gagalBeruntun);
    document.getElementById('dCount').textContent = 'Gagal memuat (' + msg + '). Coba lagi ' + tunggu + ' dtk...';
    pollTimer = setTimeout(poll, tunggu * 1000);
    return;
  }
  pollTimer = setTimeout(poll, 10000);
}

function renderCurrentView() {
  const rows = DAPUR_CACHE || [];
  const q = ((document.getElementById('dq') && document.getElementById('dq').value) || '').toLowerCase();

  let list = rows;
  if (dapurFilter === 'dine_in') {
    list = list.filter((o) => o.order_type === 'dine_in' || /^DI-/i.test(o.queue_no || ''));
  } else if (dapurFilter === 'takeaway') {
    list = list.filter((o) => o.order_type !== 'dine_in' && !/^DI-/i.test(o.queue_no || ''));
  }
  if (q) {
    list = list.filter((o) => [o.code, o.customer_name, o.queue_no, o.table_no].join(' ').toLowerCase().includes(q));
  }

  const masuk = list.filter((o) => o.status === 'menunggu_pembayaran');
  const masak = list.filter((o) => o.status === 'dimasak').sort((a, b) => elapsedMin(b.created_at) - elapsedMin(a.created_at));
  const siap = list.filter((o) => o.status === 'siap_diambil').sort((a, b) => elapsedMin(b.created_at) - elapsedMin(a.created_at));

  // Render Layar Antrean TV
  renderTVBoard(masak, siap);

  // Render Layar KDS Kerja Dapur
  renderKDSBoard(masuk, masak, siap);

  const dCnt = document.getElementById('dCount');
  if (dCnt) {
    dCnt.textContent = `${masak.length} sedang dimasak • ${siap.length} siap diambil • diperbarui ${new Date().toLocaleTimeString('id-ID')}`;
  }
}

// Render Layar TV Ruang Tunggu (Besar & Kontras)
function renderTVBoard(masak, siap) {
  const boxPrep = document.getElementById('tvListMasak');
  const boxReady = document.getElementById('tvListSiap');
  const cntPrep = document.getElementById('tvCountPrep');
  const cntReady = document.getElementById('tvCountReady');

  if (cntPrep) cntPrep.textContent = masak.length;
  if (cntReady) cntReady.textContent = siap.length;

  if (boxPrep) {
    if (!masak.length) {
      boxPrep.innerHTML = '<div class="empty" style="grid-column:1/-1;padding:40px 10px;font-size:16px">Semua pesanan telah selesai disiapkan ✨</div>';
    } else {
      boxPrep.innerHTML = masak.map((o) => {
        const isDineIn = o.order_type === 'dine_in' || /^DI-/i.test(o.queue_no || '');
        const badge = isDineIn ? `🍽️ MEJA ${escD(o.table_no || '-')}` : '🛍️ TAKEAWAY';
        return `
          <div class="tv-card prep">
            <span class="tv-card-badge" style="background:#f7edd3;color:#8a6a1a">${badge}</span>
            <div class="tv-card-no">${escD(o.queue_no || o.code)}</div>
            <div class="tv-card-name">${escD(o.customer_name || 'Pelanggan')}</div>
          </div>`;
      }).join('');
    }
  }

  if (boxReady) {
    if (!siap.length) {
      boxReady.innerHTML = '<div class="empty" style="grid-column:1/-1;padding:40px 10px;font-size:16px">Belum ada antrean yang menunggu diambil.</div>';
    } else {
      boxReady.innerHTML = siap.map((o) => {
        const isDineIn = o.order_type === 'dine_in' || /^DI-/i.test(o.queue_no || '');
        const badge = isDineIn ? `🍽️ MEJA ${escD(o.table_no || '-')}` : '🛍️ SILAKAN AMBIL';
        const isCalling = lastCalledCode && (lastCalledCode === o.code || lastCalledCode === o.queue_no);
        return `
          <div class="tv-card ready ${isCalling ? 'calling' : ''}">
            <span class="tv-card-badge" style="background:#d9f2e2;color:#1e5234">${badge}</span>
            <div class="tv-card-no">${escD(o.queue_no || o.code)}</div>
            <div class="tv-card-name">${escD(o.customer_name || 'Pelanggan')}</div>
          </div>`;
      }).join('');
    }
  }
}

// Render Layar KDS Kerja Dapur (Kanban 3 Kolom)
function renderKDSBoard(masuk, masak, siap) {
  const boxMasuk = document.getElementById('kdsMasuk');
  const boxMasak = document.getElementById('kdsMasak');
  const boxSiap = document.getElementById('kdsSiap');

  const cMasuk = document.getElementById('kdsCountMasuk');
  const cMasak = document.getElementById('kdsCountMasak');
  const cSiap = document.getElementById('kdsCountSiap');
  if (cMasuk) cMasuk.textContent = masuk.length;
  if (cMasak) cMasak.textContent = masak.length;
  if (cSiap) cSiap.textContent = siap.length;

  if (boxMasuk) renderKDSColumn(boxMasuk, masuk, 'masuk');
  if (boxMasak) renderKDSColumn(boxMasak, masak, 'masak');
  if (boxSiap) renderKDSColumn(boxSiap, siap, 'siap');
}

function renderKDSColumn(container, list, colType) {
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<div class="empty" style="padding:28px 10px">Tidak ada antrean</div>';
    return;
  }

  list.forEach((o) => {
    const mnt = elapsedMin(o.created_at);
    const sla = slaClass(mnt);
    const isDineIn = o.order_type === 'dine_in' || /^DI-/i.test(o.queue_no || '');
    const badgeType = isDineIn
      ? `<span class="badge" style="background:#e8f4ec;color:#2e7d4f;font-weight:800">🍽️ MEJA ${escD(o.table_no || '-')}</span>`
      : `<span class="badge" style="background:#f4ecda;color:#8f6b1d;font-weight:800">🛍️ TAKEAWAY</span>`;

    const itemsHtml = (o.items || []).map((i) =>
      `<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed #ede5d5">
        <div><b style="color:var(--brand-d)">${escD(i.qty)}x</b> <b>${escD(i.menu_name)}</b> ${i.level ? '<span style="color:#b97900;font-weight:700">[' + escD(i.level) + ']</span>' : ''}</div>
      </div>`
    ).join('');

    let actionButtons = '';
    if (colType === 'masuk') {
      actionButtons = `<button class="btn sm" style="width:100%" data-masak="${o.id}">🍳 Mulai Masak</button>`;
    } else if (colType === 'masak') {
      actionButtons = `<button class="btn sm green" style="width:100%" data-siap="${o.id}">✓ Siap Saji / Diambil</button>`;
    } else if (colType === 'siap') {
      actionButtons = `
        <button class="btn sm" style="flex:1" data-panggil="${o.id}">📢 Panggil TV</button>
        <button class="btn sm green" style="flex:1" data-selesai="${o.id}">✓ Selesai</button>`;
    }

    const d = document.createElement('div');
    d.className = 'antri-card' + (colType === 'siap' ? ' siap' : '') + (mnt >= 25 ? ' late' : (mnt >= 12 ? ' over' : ''));
    d.innerHTML = `
      <div class="antri-top">
        <span class="antri-no">${escD(o.queue_no || o.code)}</span>
        <div class="row" style="gap:6px">${badgeType}<span class="sla ${sla}">${escD(elapsed(o.created_at))}</span></div>
      </div>
      <div class="antri-meta">
        <b>${escD(o.customer_name)}</b> (${escD(o.code)}) • ${escD(o.payment_method)}
        <div style="margin:8px 0">${itemsHtml}</div>
        ${o.note ? '<div style="color:#b97900;font-weight:700;margin-top:4px">Catatan: ' + escD(o.note) + '</div>' : ''}
      </div>
      <div class="row" style="margin-top:10px;gap:8px">
        ${actionButtons}
      </div>`;
    container.appendChild(d);
  });

  container.querySelectorAll('button[data-masak]').forEach((b) => b.onclick = () => tandaiMasak(Number(b.dataset.masak)));
  container.querySelectorAll('button[data-siap]').forEach((b) => b.onclick = () => tandaiSiap(Number(b.dataset.siap)));
  container.querySelectorAll('button[data-panggil]').forEach((b) => b.onclick = () => panggilById(b.dataset.panggil));
  container.querySelectorAll('button[data-selesai]').forEach((b) => b.onclick = () => tandaiSelesai(Number(b.dataset.selesai)));
}

async function tandaiMasak(id) {
  try {
    await apiPost({ action: 'adminUpdateOrder', token: token(), id, status: 'dimasak' });
  } catch (e) { alert(e.message); return; }
  bip(1); poll(true);
}
async function tandaiSiap(id) {
  try {
    await apiPost({ action: 'adminUpdateOrder', token: token(), id, status: 'siap_diambil' });
  } catch (e) { alert(e.message); return; }
  panggilById(id);
  poll(true);
}
async function tandaiSelesai(id) {
  try {
    await apiPost({ action: 'adminUpdateOrder', token: token(), id, status: 'selesai' });
  } catch (e) { alert(e.message); return; }
  bip(1); poll(true);
}

async function mulai() {
  document.getElementById('dLogin').style.display = 'none';
  document.getElementById('dMain').style.display = 'block';
  document.getElementById('btnOut').style.display = 'inline';
  setDisplayMode(displayMode);
  poll(true);
  try {
    const s = await apiGet('settings');
    if (s.store_name) {
      document.title = 'Dapur & Antrean TV — ' + s.store_name;
      document.getElementById('dapurBrand').textContent = s.store_name;
      const marq = document.getElementById('tvMarqueeText');
      if (marq) {
        marq.textContent = `Selamat menikmati sajian spesial di ${s.store_name} • Harap menunggu nomor antrean dipanggil • Tunjukkan struk atau kode pesanan saat pengambilan • Terima kasih atas kunjungan Anda!`;
      }
    }
  } catch (e) { /* abaikan */ }
}

setInterval(() => {
  const el = document.getElementById('dClock');
  if (el) el.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}, 1000);

document.addEventListener('visibilitychange', () => { if (!document.hidden && token()) poll(true); });
if (token()) mulai();

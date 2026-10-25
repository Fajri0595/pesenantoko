// Admin (GitHub Pages) -> GAS — v3: thumbnail foto, tanpa ikon.
const rp = (n) => 'Rp' + (n || 0).toLocaleString('id-ID');
const token = () => localStorage.getItem('admin_token') || '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function imgFallback(el) { el.onerror = null; el.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#ece5d3"/><text x="100" y="108" font-family="sans-serif" font-size="16" fill="#8a8175" text-anchor="middle">Menu</text></svg>'); }
const ST_LABEL = { menunggu_pembayaran: 'Menunggu Pembayaran', dimasak: 'Sedang Dimasak', siap_diambil: 'Siap Diambil', selesai: 'Selesai', dibatalkan: 'Dibatalkan', kedaluwarsa: 'Kedaluwarsa' };
let ORDERS_CACHE = [], MENU_CACHE = [];
let ordersPage = 1; const ORDERS_PER_PAGE = 20;
let ordersDebounce = null;
function loadOrdersDebounced() { clearTimeout(ordersDebounce); ordersDebounce = setTimeout(() => { ordersPage = 1; loadOrders(); }, 300); }

async function me() {
  if (!isConfigured()) document.getElementById('cfgWarn').style.display = 'block';
  applyBrand();
  if (token()) {
    document.getElementById('login').style.display = 'none';
    document.getElementById('main').style.display = 'block';
    document.getElementById('btnOut').style.display = 'inline';
    loadStats(); loadOrders(); loadMenu();
  }
}
// Nama toko di header admin mengikuti Settings (tanpa login)
async function applyBrand() {
  try {
    const s = await apiGet('settings');
    if (s.store_name) {
      document.title = 'Admin — ' + s.store_name;
      const logos = document.querySelectorAll('header .logo');
      if (logos[0]) logos[0].textContent = s.store_name;
    }
  } catch (e) { /* abaikan, pakai default HTML */ }
}
async function login() {
  const username = document.getElementById('u').value, password = document.getElementById('p').value;
  document.getElementById('msg').textContent = 'Memverifikasi kredensial...';
  try {
    const j = await apiPost({ action: 'adminLogin', username, password });
    localStorage.setItem('admin_token', j.token);
    me();
  } catch (e) { document.getElementById('msg').textContent = e.message; }
}
function logout() { localStorage.removeItem('admin_token'); location.reload(); }
function tab(t) {
  document.getElementById('vOrders').style.display = t === 'orders' ? 'block' : 'none';
  document.getElementById('vMenu').style.display = t === 'menu' ? 'block' : 'none';
  document.getElementById('vLaporan').style.display = t === 'laporan' ? 'block' : 'none';
  document.getElementById('vSetting').style.display = t === 'setting' ? 'block' : 'none';
  document.getElementById('fstat').style.display = t === 'orders' ? 'block' : 'none';
  if (t === 'laporan') loadLaporan();
  if (t === 'setting') loadSettings();
}
async function loadStats() {
  try {
    const s = await apiGet('stats', { token: token() });
    document.getElementById('stats').innerHTML =
      `<div class="stat-card st-a"><b>${s.aktif}</b><span>pesanan aktif yang perlu diproses</span></div>` +
      `<div class="stat-card st-b"><b>${s.hari_ini}</b><span>total pesanan hari ini</span></div>` +
      `<div class="stat-card st-c"><b>${rp(s.omzet)}</b><span>estimasi omzet hari ini</span></div>`;
  } catch (e) {
    document.getElementById('stats').innerHTML = '<div class="warn">Ringkasan belum dapat dimuat: ' + e.message + '</div>';
  }
}
async function loadOrders() {
  const f = document.getElementById('fstat').value;
  const q = ((document.getElementById('fq') && document.getElementById('fq').value) || '').toLowerCase().trim();
  const box = document.getElementById('vOrders');
  box.innerHTML = '<p class="muted">Memuat data pesanan...</p>';
  try {
    const rows = await apiGet('adminOrders', Object.assign({ token: token() }, f ? { status: f } : {}));
    ORDERS_CACHE = rows;
    let list = rows;
    if (q) list = list.filter((o) => [o.code, o.customer_name, o.customer_phone, o.queue_no].join(' ').toLowerCase().includes(q));
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<div class="empty">Belum ada pesanan pada filter ini.</div>'; return; }
    const totalPage = Math.max(1, Math.ceil(list.length / ORDERS_PER_PAGE));
    ordersPage = Math.min(ordersPage, totalPage);
    const slice = list.slice((ordersPage - 1) * ORDERS_PER_PAGE, ordersPage * ORDERS_PER_PAGE);
    slice.forEach((o) => {
      const d = document.createElement('div'); d.className = 'order-card';
      const itemsTxt = (o.items || []).map((i) => esc(i.qty) + 'x ' + esc(i.menu_name) + (i.level ? ' [' + esc(i.level) + ']' : '')).join(', ');
      const isDineIn = o.order_type === 'dine_in' || /^DI-/i.test(o.queue_no || '');
      const modeBadge = isDineIn
        ? `<span class="badge" style="background:#e8f4ec;color:#2e7d4f">🍽️ DINE-IN ${o.table_no ? '(Meja ' + esc(o.table_no) + ')' : ''}</span>`
        : `<span class="badge" style="background:#f4ecda;color:#8f6b1d">🛍️ TAKEAWAY</span>`;
      const discTxt = Number(o.discount) > 0 ? ` • Diskon: -${rp(o.discount)}` : '';

      d.innerHTML = `<div class="row" style="justify-content:space-between">
        <div class="row" style="gap:8px"><b style="font-size:16px">${esc(o.code)}</b> ${modeBadge}</div>
        <span class="badge ${o.payment_status === 'paid' ? 'paid' : 'pending'}">${esc(o.payment_status)} • ${esc(ST_LABEL[o.status] || o.status)}</span></div>
      <div class="meta" style="margin-top:4px">${esc(o.queue_no || '')} • <b>${esc(o.customer_name)}</b> (${esc(o.customer_phone || '-')}) • ${esc(o.payment_method)} • <b>${rp(o.total)}</b>${discTxt} • ${esc(o.created_at || '')}</div>
      <div class="meta" style="font-weight:600;color:#2e2a23">${itemsTxt}${o.note ? ' • Catatan: <span style="color:#b97900">' + esc(o.note) + '</span>' : ''}</div>
      <div class="row" style="margin-top:10px">
      <button class="btn sm" data-act="dimasak" data-id="${o.id}">Proses Masak</button>
      <button class="btn sm" data-act="siap_diambil" data-id="${o.id}">Siap Disajikan</button>
      <button class="btn sm green" data-act="selesai" data-id="${o.id}">Selesaikan</button>
      <button class="btn sm ghost" data-act="dibatalkan" data-id="${o.id}">Batalkan</button>
      <button class="btn sm ghost" data-pay="paid" data-id="${o.id}">Tandai Lunas</button>
      <button class="btn sm ghost" data-print="${o.id}">🖨️ Struk POS</button>
      ${o.customer_phone ? `<button class="btn sm ghost" data-chat="${o.id}">💬 Chat WA</button>` : ''}
      </div>`;
      box.appendChild(d);
    });
    const nav = document.createElement('div');
    nav.className = 'row';
    nav.style.margin = '12px 0';
    nav.innerHTML = `<span class="muted">Hal ${ordersPage}/${totalPage} • ${list.length} pesanan</span>
      <button class="btn sm ghost" ${ordersPage <= 1 ? 'disabled' : ''} id="pgPrev">← Prev</button>
      <button class="btn sm ghost" ${ordersPage >= totalPage ? 'disabled' : ''} id="pgNext">Next →</button>`;
    box.appendChild(nav);
    const pv = document.getElementById('pgPrev'); if (pv) pv.onclick = () => { ordersPage--; loadOrders(); };
    const nx = document.getElementById('pgNext'); if (nx) nx.onclick = () => { ordersPage++; loadOrders(); };
    box.querySelectorAll('button[data-act]').forEach((b) => b.onclick = () => setSt(Number(b.dataset.id), b.dataset.act));
    box.querySelectorAll('button[data-pay]').forEach((b) => b.onclick = () => setPay(Number(b.dataset.id), b.dataset.pay));
    box.querySelectorAll('button[data-print]').forEach((b) => b.onclick = () => printOrderStruk(Number(b.dataset.print)));
    box.querySelectorAll('button[data-chat]').forEach((b) => b.onclick = () => chatWA(Number(b.dataset.chat)));
  } catch (e) { box.innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; }
}

function chatWA(id) {
  const o = ORDERS_CACHE.find((x) => Number(x.id) === Number(id));
  if (!o || !o.customer_phone) return;
  let hp = String(o.customer_phone).replace(/\D/g, '');
  if (hp.startsWith('0')) hp = '62' + hp.slice(1);
  const isDineIn = o.order_type === 'dine_in' || /^DI-/i.test(o.queue_no || '');
  const store = document.title.replace(/^Admin — /, '') || 'Toko Kami';
  const txt = `Halo Kak ${o.customer_name}, kami dari ${store}.\nMengenai pesanan ${o.code} (${o.queue_no || '-'}) ${isDineIn ? 'Meja ' + (o.table_no || '') : 'Takeaway'}: status pesanan Anda saat ini adalah "${ST_LABEL[o.status] || o.status}". Terima kasih!`;
  window.open(`https://wa.me/${hp}?text=${encodeURIComponent(txt)}`, '_blank');
}

function printOrderStruk(id) {
  const o = ORDERS_CACHE.find((x) => Number(x.id) === Number(id));
  if (!o) return;
  const w = window.open('', '_blank', 'width=380,height=650');
  if (!w) return;
  const store = esc(document.title.replace(/^Admin — /, '') || 'UMKM Mandiri');
  const isDineIn = o.order_type === 'dine_in' || /^DI-/i.test(o.queue_no || '');
  const tipe = isDineIn ? `DINE-IN ${o.table_no ? '(MEJA ' + esc(o.table_no) + ')' : ''}` : 'TAKEAWAY';
  const rows = (o.items || []).map((i) => `
    <tr>
      <td style="padding:3px 0">${esc(i.qty)}x ${esc(i.menu_name)}${i.level ? '<br><small style="color:#666">*' + esc(i.level) + '</small>' : ''}</td>
      <td style="text-align:right;white-space:nowrap;vertical-align:top">Rp${(i.price * i.qty).toLocaleString('id-ID')}</td>
    </tr>`).join('');
  const discRow = Number(o.discount) > 0 ? `<tr><td>Diskon Promo</td><td style="text-align:right">-Rp${Number(o.discount).toLocaleString('id-ID')}</td></tr>` : '';
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(o.code);

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk ${esc(o.code)}</title>
  <style>
    @page{margin:0}
    body{font-family:'Courier New',Courier,monospace;font-size:12px;color:#000;padding:12px;max-width:72mm;margin:0 auto}
    .c{text-align:center}
    .r{text-align:right}
    .b{font-weight:bold}
    .line{border-top:1px dashed #444;margin:8px 0}
    table{width:100%;border-collapse:collapse;font-size:12px}
  </style></head><body>
  <div class="c"><b style="font-size:15px">${store}</b><br><span class="b" style="font-size:13px">${tipe}</span><br>${esc(o.code)} • ${esc(o.queue_no || '')}</div>
  <div class="line"></div>
  <div>Tgl : ${esc(o.created_at || '')}<br>Plg : ${esc(o.customer_name)} (${esc(o.customer_phone || '-')})</div>
  ${o.note ? `<div>Cat : ${esc(o.note)}</div>` : ''}
  <div class="line"></div>
  <table>${rows}</table>
  <div class="line"></div>
  <table>
    <tr><td>Subtotal</td><td class="r">Rp${Number(o.subtotal || 0).toLocaleString('id-ID')}</td></tr>
    ${discRow}
    <tr><td>Biaya Layanan</td><td class="r">Rp${Number(o.service_fee || 0).toLocaleString('id-ID')}</td></tr>
    <tr class="b" style="font-size:14px"><td>TOTAL</td><td class="r">Rp${Number(o.total || 0).toLocaleString('id-ID')}</td></tr>
    <tr><td>Metode</td><td class="r">${esc(o.payment_method)} (${esc(o.payment_status).toUpperCase()})</td></tr>
  </table>
  <div class="line"></div>
  <div class="c" style="margin-top:8px">
    <img src="${qrUrl}" width="90" height="90" alt="QR"><br>
    <small>Simpan struk ini sebagai bukti pembayaran.<br>Terima kasih atas kunjungan Anda!</small>
  </div>
  <script>window.print();<\/script>
  </body></html>`);
  w.document.close();
}
let LAPORAN_CACHE = null;
async function loadLaporan() {
  const periode = document.getElementById('fperiode').value;
  const sum = document.getElementById('lapSum'), tbl = document.getElementById('lapTable');
  tbl.innerHTML = '<p class="muted">Menyusun laporan penjualan...</p>';
  const doc = document.getElementById('lapDoc'); if (doc) doc.innerHTML = '';
  try {
    const L = await apiGet('laporan', { token: token(), periode });
    LAPORAN_CACHE = L;
    const nama = { harian: 'Hari Ini', mingguan: '7 Hari Terakhir', bulanan: 'Bulan Berjalan' }[L.periode] || L.periode;
    sum.innerHTML =
      `<div class="stat-card st-a"><b>${L.total_pesanan}</b><span>total pesanan • ${nama}</span></div>` +
      `<div class="stat-card st-b"><b>${rp(L.omzet)}</b><span>total omzet • ${nama}</span></div>` +
      `<div class="stat-card st-c"><b>${L.lunas}</b><span>pesanan lunas • ${L.menunggu} menunggu</span></div>`;
    tbl.innerHTML = '<div class="box screen-box" style="padding:0;overflow:auto"><table><tr><th>Tanggal</th><th>Pesanan</th><th>Omzet</th></tr>' +
      L.rows.map((r) => `<tr><td>${r.tanggal}</td><td>${r.pesanan}</td><td>${rp(r.omzet)}</td></tr>`).join('') +
      `<tr><td><b>Total</b></td><td><b>${L.total_pesanan}</b></td><td><b>${rp(L.omzet)}</b></td></tr></table></div>` +
      '<h3 style="margin:16px 0 4px">Rincian item terjual • ' + nama + '</h3>' +
      ((L.items && L.items.length)
        ? '<div class="box screen-box" style="padding:0;overflow:auto"><table><tr><th>Menu</th><th>Terjual</th><th>Omzet</th></tr>' +
          L.items.map((it) => `<tr><td>${it.menu}</td><td>${it.qty} pcs</td><td>${rp(it.omzet)}</td></tr>`).join('') + '</table></div>'
        : '<p class="muted">Belum ada item terjual pada periode ini.</p>');
    renderLapDoc(L, nama);
  } catch (e) { tbl.innerHTML = '<div class="warn">Laporan belum dapat dimuat: ' + esc(e.message) + '</div>'; }
}
function renderLapDoc(L, nama) {
  const doc = document.getElementById('lapDoc'); if (!doc) return;
  const store = esc(L.store_name || document.title.replace(/^Admin — /, '') || 'UMKM Mandiri');
  const rentang = esc((L.tanggal_awal || '') + (L.tanggal_akhir && L.tanggal_akhir !== L.tanggal_awal ? ' s/d ' + L.tanggal_akhir : ''));
  const detail = L.detail || [];
  const itemsLunas = L.items_lunas || L.items || [];
  const byPay = L.by_payment || [];
  const detRows = detail.map((o, i) => {
    const itemTxt = (o.items || []).map((it) => `${it.qty}x ${it.menu_name}`).join(', ');
    return `<tr><td class="num">${i + 1}</td><td>${esc(o.created_at)}</td><td><b>${esc(o.code)}</b><br><small>${esc(o.queue_no)}</small></td>` +
      `<td>${esc(o.customer_name)}</td><td>${esc(itemTxt)}</td><td>${esc(o.payment_method)}</td><td class="num">${rp(o.total)}</td></tr>`;
  }).join('');
  doc.innerHTML = `<div class="lap-doc">
    <div class="lap-kop"><b>${store}</b><span>LAPORAN PENJUALAN • ${esc(String(nama).toUpperCase())}</span><small>Periode: ${rentang} • Dicetak: ${esc(L.generated_at || '')}</small></div>
    <table class="lap-tbl"><tr><th style="width:60%">Uraian</th><th class="num">Nilai</th></tr>
      <tr><td>Total transaksi lunas</td><td class="num"><b>${L.lunas} transaksi</b></td></tr>
      <tr><td>Total item terjual</td><td class="num"><b>${L.total_qty || 0} pcs</b></td></tr>
      <tr><td>Total biaya layanan</td><td class="num">${rp(L.total_service_fee || 0)}</td></tr>
      <tr><td><b>Total omzet</b></td><td class="num"><b>${rp(L.omzet)}</b></td></tr>
      <tr><td>Transaksi menunggu pembayaran (tidak termasuk omzet)</td><td class="num">${L.menunggu}</td></tr>
    </table>
    <h4>A. Rincian Transaksi Lunas</h4>
    ${detail.length
      ? `<table class="lap-tbl"><tr><th class="num">No</th><th>Waktu</th><th>Kode</th><th>Pelanggan</th><th>Item</th><th>Bayar</th><th class="num">Total</th></tr>${detRows}` +
        `<tr><td colspan="6"><b>Total ${detail.length} transaksi • ${L.total_qty || 0} pcs</b></td><td class="num"><b>${rp(L.omzet)}</b></td></tr></table>`
      : '<p class="muted">Belum ada transaksi lunas pada periode ini.</p>'}
    ${byPay.length ? `<h4>B. Rekap per Metode Pembayaran</h4><table class="lap-tbl"><tr><th>Metode</th><th class="num">Transaksi</th><th class="num">Omzet</th></tr>` +
      byPay.map((b) => `<tr><td>${esc(b.method)}</td><td class="num">${b.transaksi}</td><td class="num">${rp(b.omzet)}</td></tr>`).join('') + '</table>' : ''}
    <h4>C. Rekap Item Terjual (Lunas)</h4>
    ${itemsLunas.length
      ? `<table class="lap-tbl"><tr><th class="num">No</th><th>Menu</th><th class="num">Terjual</th><th class="num">Omzet</th></tr>` +
        itemsLunas.map((it, i) => `<tr><td class="num">${i + 1}</td><td>${esc(it.menu)}</td><td class="num">${it.qty} pcs</td><td class="num">${rp(it.omzet)}</td></tr>`).join('') +
        `<tr><td colspan="2"><b>Total</b></td><td class="num"><b>${L.total_qty || 0} pcs</b></td><td class="num"><b>${rp((itemsLunas || []).reduce((a, x) => a + (x.omzet || 0), 0))}</b></td></tr></table>`
      : '<p class="muted">Belum ada item terjual pada periode ini.</p>'}
    <div class="lap-sign"><span>Dicetak oleh Admin<br><br><br>( ........................ )</span><span>Mengetahui, Pemilik Toko<br><br><br>( ........................ )</span></div>
  </div>`;
}
function exportLaporanCSV() {
  const L = LAPORAN_CACHE;
  if (!L || !(L.detail && L.detail.length)) { alert('Belum ada rincian transaksi untuk diekspor. Tampilkan laporan dulu.'); return; }
  const head = ['no', 'waktu', 'kode', 'antrean', 'pelanggan', 'item', 'pembayaran', 'subtotal', 'biaya_layanan', 'total'];
  const lines = [head.join(';')].concat(L.detail.map((o, i) => {
    const itemTxt = (o.items || []).map((it) => it.qty + 'x ' + it.menu_name).join(', ');
    return [i + 1, o.created_at, o.code, o.queue_no, o.customer_name, itemTxt, o.payment_method, o.subtotal, o.service_fee, o.total]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';');
  }));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'laporan-' + (L.periode || 'harian') + '-' + (L.tanggal_akhir || 'hari-ini') + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function printLaporan() {
  document.body.classList.add('p-laporan');
  window.print();
  setTimeout(() => document.body.classList.remove('p-laporan'), 500);
}
async function setSt(id, status) { await apiPost({ action: 'adminUpdateOrder', token: token(), id, status }); loadOrders(); loadStats(); }
async function setPay(id, payment_status) { await apiPost({ action: 'adminUpdateOrder', token: token(), id, payment_status }); loadOrders(); loadStats(); }
async function loadMenu() {
  try {
    const rows = await apiGet('adminMenu', { token: token() });
    MENU_CACHE = rows;
    document.getElementById('mlist').innerHTML = '<div class="box" style="padding:0;overflow:auto"><table><tr><th>Foto</th><th>Nama Menu</th><th>Harga</th><th>Stok</th><th>Kategori</th><th>Status</th><th>Aksi</th></tr>' +
      rows.map((m) => `<tr><td><img class="menu-thumb" src="${esc(foodImg(m))}" alt="${esc(m.name)}" loading="lazy" onerror="imgFallback(this)"></td>
      <td><b>${esc(m.name)}</b></td><td>${rp(m.price)}</td><td>${(m.stok === '' || m.stok === undefined || m.stok === null || Number(m.stok) === -1) ? '∞' : esc(m.stok)}</td><td>${esc(m.category)}</td>
      <td><span class="badge ${m.is_available ? 'paid' : 'pending'}">${m.is_available ? 'Tersedia' : 'Nonaktif'}</span></td>
      <td style="white-space:nowrap"><button class="btn sm ghost" data-edit="${m.id}">Ubah</button> <button class="btn sm ghost" data-del="${m.id}">Hapus</button></td></tr>`).join('') + '</table></div>';
    document.querySelectorAll('#mlist button[data-edit]').forEach((b) => b.onclick = () => editMById(Number(b.dataset.edit)));
    document.querySelectorAll('#mlist button[data-del]').forEach((b) => b.onclick = () => delM(Number(b.dataset.del)));
  } catch (e) { document.getElementById('mlist').innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; }
}
function editMById(id) {
  const m = MENU_CACHE.find((x) => Number(x.id) === Number(id));
  if (!m) return;
  editM(m);
}
function editM(m) {
  document.getElementById('mid').value = m.id; document.getElementById('mname').value = m.name;
  document.getElementById('mcat').value = m.category; document.getElementById('mprice').value = m.price;
  document.getElementById('memoji').value = (m.emoji && m.emoji.indexOf('http') === 0) ? m.emoji : '';
  document.getElementById('mdesc').value = m.description || '';
  const st = (m.stok === '' || m.stok === undefined || m.stok === null) ? -1 : m.stok;
  document.getElementById('mstok').value = st;
  document.getElementById('mavail').value = m.is_available ? 1 : 0; window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetForm() { document.getElementById('mid').value = ''; document.getElementById('mname').value = ''; document.getElementById('mprice').value = 11000; document.getElementById('memoji').value = ''; document.getElementById('mstok').value = -1; }
async function saveMenu() {
  const id = document.getElementById('mid').value;
  const foto = document.getElementById('memoji').value.trim();
  const body = {
    action: id ? 'adminUpdateMenu' : 'adminCreateMenu', token: token(), id: id || undefined,
    name: document.getElementById('mname').value, category: document.getElementById('mcat').value || 'Mie',
    price: parseInt(document.getElementById('mprice').value) || 0, emoji: foto,
    stok: document.getElementById('mstok').value,
    description: document.getElementById('mdesc').value, is_available: document.getElementById('mavail').value === '1' ? 1 : 0,
  };
  try { await apiPost(body); resetForm(); loadMenu(); } catch (e) { alert(e.message); }
}
async function delM(id) { if (!confirm('Hapus menu ini dari katalog? Tindakan ini tidak dapat dibatalkan.')) return; await apiPost({ action: 'adminDeleteMenu', token: token(), id }); loadMenu(); }

// ---------- Pengaturan ----------
const PAY_METHODS = ['QRIS', 'GOPAY', 'OVO', 'DANA', 'CASH'];
async function loadSettings() {
  const box = document.getElementById('spays');
  box.innerHTML = '<p class="muted">Memuat pengaturan toko...</p>';
  try {
    const s = await apiGet('adminSettings', { token: token() });
    document.getElementById('sname').value = s.store_name || '';
    document.getElementById('stag').value = s.tagline || '';
    document.getElementById('sfee').value = s.service_fee || 0;
    document.getElementById('sest').value = s.estimasi || '';
    document.getElementById('sbuka').value = s.jam_buka || '';
    document.getElementById('stup').value = s.jam_tutup || '';
    document.getElementById('sbatas').value = s.batas_bayar_menit || 15;
    const sp = document.getElementById('spromos');
    if (sp) sp.value = s.promo_codes || '';
    document.getElementById('swa_on').value = s.wa_enabled === '1' ? 1 : 0;
    document.getElementById('swa_admin').value = s.wa_admin || '';
    document.getElementById('swa_token').value = s.wa_token || '';
    box.innerHTML = '';
    PAY_METHODS.forEach((m) => {
      const on = s['pay_' + m + '_enabled'] === '1';
      const d = document.createElement('div'); d.className = 'payopt' + (on ? ' sel' : '');
      d.innerHTML = `<input type="checkbox" id="spay_${m}" ${on ? 'checked' : ''} style="width:auto" onchange="this.closest('.payopt').classList.toggle('sel',this.checked)">
        <div style="flex:1"><input type="text" id="slabel_${m}" value="${(s['pay_' + m + '_label'] || m).replace(/"/g, '&quot;')}" placeholder="Nama tampilan">
        <input type="text" id="sdesc_${m}" value="${(s['pay_' + m + '_desc'] || '').replace(/"/g, '&quot;')}" placeholder="Deskripsi singkat" style="margin-top:6px"></div>`;
      box.appendChild(d);
    });
    document.getElementById('smsg').textContent = '';
  } catch (e) { box.innerHTML = '<div class="warn">' + e.message + '</div>'; }
}
async function saveSettings() {
  const settings = {
    store_name: document.getElementById('sname').value,
    tagline: document.getElementById('stag').value,
    service_fee: document.getElementById('sfee').value,
    estimasi: document.getElementById('sest').value,
    jam_buka: document.getElementById('sbuka').value,
    jam_tutup: document.getElementById('stup').value,
    batas_bayar_menit: document.getElementById('sbatas').value,
    promo_codes: document.getElementById('spromos') ? document.getElementById('spromos').value.trim() : '',
    wa_enabled: document.getElementById('swa_on').value,
    wa_admin: document.getElementById('swa_admin').value,
    wa_token: document.getElementById('swa_token').value,
  };
  PAY_METHODS.forEach((m) => {
    settings['pay_' + m + '_enabled'] = document.getElementById('spay_' + m).checked ? '1' : '0';
    settings['pay_' + m + '_label'] = document.getElementById('slabel_' + m).value;
    settings['pay_' + m + '_desc'] = document.getElementById('sdesc_' + m).value;
  });
  document.getElementById('smsg').textContent = 'Menyimpan pengaturan...';
  try {
    await apiPost({ action: 'adminUpdateSettings', token: token(), settings });
    document.getElementById('smsg').textContent = 'Pengaturan berhasil disimpan. Halaman publik akan diperbarui secara otomatis.';
    loadStats(); applyBrand();
  } catch (e) { document.getElementById('smsg').textContent = e.message; }
}
me();

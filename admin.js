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
      const itemsTxt = (o.items || []).map((i) => esc(i.qty) + ' x ' + esc(i.menu_name) + ' ' + esc(i.level || '')).join(', ');
      d.innerHTML = `<div class="row" style="justify-content:space-between">
        <b style="font-size:16px">${esc(o.code)}</b>
        <span class="badge ${o.payment_status === 'paid' ? 'paid' : 'pending'}">${esc(o.payment_status)} • ${esc(ST_LABEL[o.status] || o.status)}</span></div>
      <div class="meta">${esc(o.queue_no || '')} • ${esc(o.customer_name)} (${esc(o.customer_phone)}) • ${esc(o.payment_method)} • <b>${rp(o.total)}</b> • ${esc(o.created_at || '')}</div>
      <div class="meta">${itemsTxt}${o.note ? ' • Catatan: ' + esc(o.note) : ''}</div>
      <div class="row" style="margin-top:8px">
      <button class="btn sm" data-act="dimasak" data-id="${o.id}">Proses Masak</button>
      <button class="btn sm" data-act="siap_diambil" data-id="${o.id}">Siap Diambil</button>
      <button class="btn sm green" data-act="selesai" data-id="${o.id}">Selesaikan</button>
      <button class="btn sm ghost" data-act="dibatalkan" data-id="${o.id}">Batalkan</button>
      <button class="btn sm ghost" data-pay="paid" data-id="${o.id}">Tandai Lunas</button>
      <button class="btn sm ghost" data-print="${o.id}">Struk</button></div>`;
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
  } catch (e) { box.innerHTML = '<div class="warn">' + esc(e.message) + '</div>'; }
}
function exportOrdersCSV() {
  if (!ORDERS_CACHE.length) { alert('Belum ada data untuk diekspor.'); return; }
  const head = ['id', 'code', 'queue_no', 'customer_name', 'customer_phone', 'payment_method', 'payment_status', 'status', 'total', 'created_at'];
  const lines = [head.join(';')].concat(ORDERS_CACHE.map((o) => head.map((k) => `"${String(o[k] ?? '').replace(/"/g, '""')}"`).join(';')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pesanan-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function printOrderStruk(id) {
  const o = ORDERS_CACHE.find((x) => Number(x.id) === Number(id));
  if (!o) return;
  const w = window.open('', '_blank', 'width=320,height=600');
  if (!w) return;
  const rows = (o.items || []).map((i) => `${esc(i.qty)}x ${esc(i.menu_name)} — Rp${(i.price * i.qty).toLocaleString('id-ID')}`).join('<br>');
  w.document.write(`<html><head><title>Struk ${esc(o.code)}</title><style>body{font-family:monospace;font-size:13px;padding:12px;max-width:58mm}hr{border-top:1px dashed #999}</style></head><body><center><b>${esc(document.title)}</b><br>${esc(o.code)} • ${esc(o.queue_no || '')}</center><hr>${esc(o.customer_name)} (${esc(o.customer_phone)})<br>${esc(o.created_at || '')}<hr>${rows}<hr>Subtotal: Rp${Number(o.subtotal || 0).toLocaleString('id-ID')}<br>Service: Rp${Number(o.service_fee || 0).toLocaleString('id-ID')}<br><b>Total: Rp${Number(o.total || 0).toLocaleString('id-ID')}</b><br>${esc(o.payment_method)} • ${esc(o.payment_status)}<hr><center>Terima kasih</center><script>window.print()<\/script></body></html>`);
  w.document.close();
}
async function loadLaporan() {
  const periode = document.getElementById('fperiode').value;
  const sum = document.getElementById('lapSum'), tbl = document.getElementById('lapTable');
  tbl.innerHTML = '<p class="muted">Menyusun laporan penjualan...</p>';
  try {
    const L = await apiGet('laporan', { token: token(), periode });
    const nama = { harian: 'Hari Ini', mingguan: '7 Hari Terakhir', bulanan: 'Bulan Berjalan' }[L.periode] || L.periode;
    sum.innerHTML =
      `<div class="stat-card st-a"><b>${L.total_pesanan}</b><span>total pesanan • ${nama}</span></div>` +
      `<div class="stat-card st-b"><b>${rp(L.omzet)}</b><span>total omzet • ${nama}</span></div>` +
      `<div class="stat-card st-c"><b>${L.lunas}</b><span>pesanan lunas • ${L.menunggu} menunggu</span></div>`;
    tbl.innerHTML = '<div class="box" style="padding:0;overflow:auto"><table><tr><th>Tanggal</th><th>Pesanan</th><th>Omzet</th></tr>' +
      L.rows.map((r) => `<tr><td>${r.tanggal}</td><td>${r.pesanan}</td><td>${rp(r.omzet)}</td></tr>`).join('') +
      `<tr><td><b>Total</b></td><td><b>${L.total_pesanan}</b></td><td><b>${rp(L.omzet)}</b></td></tr></table></div>` +
      '<h3 style="margin:16px 0 4px">Rincian item terjual • ' + nama + '</h3>' +
      ((L.items && L.items.length)
        ? '<div class="box" style="padding:0;overflow:auto"><table><tr><th>Menu</th><th>Terjual</th><th>Omzet</th></tr>' +
          L.items.map((it) => `<tr><td>${it.menu}</td><td>${it.qty} pcs</td><td>${rp(it.omzet)}</td></tr>`).join('') + '</table></div>'
        : '<p class="muted">Belum ada item terjual pada periode ini.</p>');
  } catch (e) { tbl.innerHTML = '<div class="warn">Laporan belum dapat dimuat: ' + e.message + '</div>'; }
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

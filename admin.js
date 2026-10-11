// Admin (GitHub Pages) -> GAS — v3: thumbnail foto, tanpa ikon.
const rp = (n) => 'Rp' + (n || 0).toLocaleString('id-ID');
const token = () => localStorage.getItem('admin_token') || '';
const ST_LABEL = { menunggu_pembayaran: 'Menunggu Bayar', dimasak: 'Dimasak', siap_diambil: 'Siap Diambil', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };

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
  document.getElementById('msg').textContent = 'Memeriksa...';
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
      `<div class="stat-card st-a"><b>${s.aktif}</b><span>pesanan aktif perlu proses</span></div>` +
      `<div class="stat-card st-b"><b>${s.hari_ini}</b><span>pesanan hari ini</span></div>` +
      `<div class="stat-card st-c"><b>${rp(s.omzet)}</b><span>omzet hari ini</span></div>`;
  } catch (e) {
    document.getElementById('stats').innerHTML = '<div class="warn">Ringkasan gagal dimuat: ' + e.message + '</div>';
  }
}
async function loadOrders() {
  const f = document.getElementById('fstat').value;
  const box = document.getElementById('vOrders');
  box.innerHTML = '<p class="muted">Memuat pesanan...</p>';
  try {
    const rows = await apiGet('adminOrders', Object.assign({ token: token() }, f ? { status: f } : {}));
    box.innerHTML = '';
    if (!rows.length) { box.innerHTML = '<div class="empty">Tidak ada pesanan pada filter ini.</div>'; return; }
    rows.forEach((o) => {
      const d = document.createElement('div'); d.className = 'order-card';
      d.innerHTML = `<div class="row" style="justify-content:space-between">
        <b style="font-size:16px">${o.code}</b>
        <span class="badge ${o.payment_status === 'paid' ? 'paid' : 'pending'}">${o.payment_status} • ${ST_LABEL[o.status] || o.status}</span></div>
      <div class="meta">${o.queue_no} • ${o.customer_name} (${o.customer_phone}) • ${o.payment_method} • <b>${rp(o.total)}</b> • ${o.created_at || ''}</div>
      <div class="meta">${(o.items || []).map((i) => i.qty + ' x ' + i.menu_name + ' ' + (i.level || '')).join(', ')}${o.note ? ' • Catatan: ' + o.note : ''}</div>
      <div class="row" style="margin-top:8px">
      <button class="btn sm" onclick="setSt(${o.id},'dimasak')">Dimasak</button>
      <button class="btn sm" onclick="setSt(${o.id},'siap_diambil')">Siap Diambil</button>
      <button class="btn sm green" onclick="setSt(${o.id},'selesai')">Selesai</button>
      <button class="btn sm ghost" onclick="setSt(${o.id},'dibatalkan')">Batal</button>
      <button class="btn sm ghost" onclick="setPay(${o.id},'paid')">Lunas (cash)</button></div>`;
      box.appendChild(d);
    });
  } catch (e) { box.innerHTML = '<div class="warn">' + e.message + '</div>'; }
}
async function loadLaporan() {
  const periode = document.getElementById('fperiode').value;
  const sum = document.getElementById('lapSum'), tbl = document.getElementById('lapTable');
  tbl.innerHTML = '<p class="muted">Memuat laporan...</p>';
  try {
    const L = await apiGet('laporan', { token: token(), periode });
    const nama = { harian: 'Hari ini', mingguan: '7 hari terakhir', bulanan: 'Bulan berjalan' }[L.periode] || L.periode;
    sum.innerHTML =
      `<div class="stat-card st-a"><b>${L.total_pesanan}</b><span>pesanan • ${nama}</span></div>` +
      `<div class="stat-card st-b"><b>${rp(L.omzet)}</b><span>omzet • ${nama}</span></div>` +
      `<div class="stat-card st-c"><b>${L.lunas}</b><span>lunas • ${L.menunggu} menunggu</span></div>`;
    tbl.innerHTML = '<div class="box" style="padding:0;overflow:auto"><table><tr><th>Tanggal</th><th>Pesanan</th><th>Omzet</th></tr>' +
      L.rows.map((r) => `<tr><td>${r.tanggal}</td><td>${r.pesanan}</td><td>${rp(r.omzet)}</td></tr>`).join('') +
      `<tr><td><b>Total</b></td><td><b>${L.total_pesanan}</b></td><td><b>${rp(L.omzet)}</b></td></tr></table></div>`;
  } catch (e) { tbl.innerHTML = '<div class="warn">Laporan gagal dimuat: ' + e.message + '</div>'; }
}
async function setSt(id, status) { await apiPost({ action: 'adminUpdateOrder', token: token(), id, status }); loadOrders(); loadStats(); }
async function setPay(id, payment_status) { await apiPost({ action: 'adminUpdateOrder', token: token(), id, payment_status }); loadOrders(); loadStats(); }
async function loadMenu() {
  try {
    const rows = await apiGet('adminMenu', { token: token() });
    document.getElementById('mlist').innerHTML = '<div class="box" style="padding:0;overflow:auto"><table><tr><th>Foto</th><th>Menu</th><th>Harga</th><th>Kategori</th><th>Status</th><th></th></tr>' +
      rows.map((m) => `<tr><td><img class="menu-thumb" src="${foodImg(m)}" alt="${m.name}" loading="lazy" onerror="this.remove()"></td>
      <td><b>${m.name}</b></td><td>${rp(m.price)}</td><td>${m.category}</td>
      <td><span class="badge ${m.is_available ? 'paid' : 'pending'}">${m.is_available ? 'Aktif' : 'Nonaktif'}</span></td>
      <td style="white-space:nowrap"><button class="btn sm ghost" onclick='editM(${JSON.stringify(m).replace(/'/g, '&#39;')})'>Edit</button> <button class="btn sm ghost" onclick="delM(${m.id})">Hapus</button></td></tr>`).join('') + '</table></div>';
  } catch (e) { document.getElementById('mlist').innerHTML = '<div class="warn">' + e.message + '</div>'; }
}
function editM(m) {
  document.getElementById('mid').value = m.id; document.getElementById('mname').value = m.name;
  document.getElementById('mcat').value = m.category; document.getElementById('mprice').value = m.price;
  document.getElementById('memoji').value = (m.emoji && m.emoji.indexOf('http') === 0) ? m.emoji : '';
  document.getElementById('mdesc').value = m.description || '';
  document.getElementById('mavail').value = m.is_available ? 1 : 0; window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetForm() { document.getElementById('mid').value = ''; document.getElementById('mname').value = ''; document.getElementById('mprice').value = 11000; document.getElementById('memoji').value = ''; }
async function saveMenu() {
  const id = document.getElementById('mid').value;
  const foto = document.getElementById('memoji').value.trim();
  const body = {
    action: id ? 'adminUpdateMenu' : 'adminCreateMenu', token: token(), id: id || undefined,
    name: document.getElementById('mname').value, category: document.getElementById('mcat').value || 'Mie',
    price: parseInt(document.getElementById('mprice').value) || 0, emoji: foto,
    description: document.getElementById('mdesc').value, is_available: document.getElementById('mavail').value === '1' ? 1 : 0,
  };
  try { await apiPost(body); resetForm(); loadMenu(); } catch (e) { alert(e.message); }
}
async function delM(id) { if (!confirm('Hapus menu ini?')) return; await apiPost({ action: 'adminDeleteMenu', token: token(), id }); loadMenu(); }

// ---------- Pengaturan ----------
const PAY_METHODS = ['QRIS', 'GOPAY', 'OVO', 'DANA', 'CASH'];
async function loadSettings() {
  const box = document.getElementById('spays');
  box.innerHTML = '<p class="muted">Memuat...</p>';
  try {
    const s = await apiGet('adminSettings', { token: token() });
    document.getElementById('sname').value = s.store_name || '';
    document.getElementById('stag').value = s.tagline || '';
    document.getElementById('sfee').value = s.service_fee || 0;
    document.getElementById('sest').value = s.estimasi || '';
    box.innerHTML = '';
    PAY_METHODS.forEach((m) => {
      const on = s['pay_' + m + '_enabled'] === '1';
      const d = document.createElement('div'); d.className = 'payopt' + (on ? ' sel' : '');
      d.innerHTML = `<input type="checkbox" id="spay_${m}" ${on ? 'checked' : ''} style="width:auto" onchange="this.closest('.payopt').classList.toggle('sel',this.checked)">
        <div style="flex:1"><input type="text" id="slabel_${m}" value="${(s['pay_' + m + '_label'] || m).replace(/"/g, '&quot;')}" placeholder="Label">
        <input type="text" id="sdesc_${m}" value="${(s['pay_' + m + '_desc'] || '').replace(/"/g, '&quot;')}" placeholder="Deskripsi" style="margin-top:6px"></div>`;
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
  };
  PAY_METHODS.forEach((m) => {
    settings['pay_' + m + '_enabled'] = document.getElementById('spay_' + m).checked ? '1' : '0';
    settings['pay_' + m + '_label'] = document.getElementById('slabel_' + m).value;
    settings['pay_' + m + '_desc'] = document.getElementById('sdesc_' + m).value;
  });
  document.getElementById('smsg').textContent = 'Menyimpan...';
  try {
    await apiPost({ action: 'adminUpdateSettings', token: token(), settings });
    document.getElementById('smsg').textContent = 'Tersimpan. Halaman publik ikut diperbarui otomatis.';
    loadStats(); applyBrand();
  } catch (e) { document.getElementById('smsg').textContent = e.message; }
}
me();

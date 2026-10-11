// Admin (GitHub Pages) -> GAS — v3: thumbnail foto, tanpa ikon.
const rp = (n) => 'Rp' + (n || 0).toLocaleString('id-ID');
const token = () => localStorage.getItem('admin_token') || '';
const ST_LABEL = { menunggu_pembayaran: 'Menunggu Bayar', dimasak: 'Dimasak', siap_diambil: 'Siap Diambil', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };

async function me() {
  if (!isConfigured()) document.getElementById('cfgWarn').style.display = 'block';
  if (token()) {
    document.getElementById('login').style.display = 'none';
    document.getElementById('main').style.display = 'block';
    document.getElementById('btnOut').style.display = 'inline';
    loadStats(); loadOrders(); loadMenu();
  }
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
}
async function loadStats() {
  try {
    const s = await apiGet('stats', { token: token() });
    document.getElementById('stats').innerHTML =
      `<div class="stat-card st-a"><b>${s.aktif}</b><span>pesanan aktif perlu proses</span></div>` +
      `<div class="stat-card st-b"><b>${s.hari_ini}</b><span>pesanan hari ini</span></div>` +
      `<div class="stat-card st-c"><b>${rp(s.omzet)}</b><span>omzet hari ini</span></div>`;
  } catch (e) { /* abaikan */ }
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
me();

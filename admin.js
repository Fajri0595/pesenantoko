// Admin (GitHub Pages) -> GAS. Token disimpan di localStorage.
const rp = (n) => 'Rp' + (n || 0).toLocaleString('id-ID');
const token = () => localStorage.getItem('admin_token') || '';

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
    document.getElementById('stats').innerHTML = `<div class="step"><b>${s.aktif} aktif</b><span>pesanan perlu proses</span></div><div class="step"><b>${s.hari_ini} pesanan</b><span>hari ini</span></div><div class="step"><b>${rp(s.omzet)}</b><span>omzet hari ini</span></div>`;
  } catch (e) { /* abaikan */ }
}
async function loadOrders() {
  const f = document.getElementById('fstat').value;
  const box = document.getElementById('vOrders');
  try {
    const rows = await apiGet('adminOrders', Object.assign({ token: token() }, f ? { status: f } : {}));
    box.innerHTML = '';
    if (!rows.length) { box.innerHTML = '<p>Tidak ada pesanan.</p>'; return; }
    rows.forEach((o) => {
      const d = document.createElement('div'); d.className = 'box'; d.style.margin = '10px 0';
      d.innerHTML = `<b>${o.code}</b> • ${o.queue_no} • ${o.customer_name} (${o.customer_phone}) • ${o.payment_method} • <span class="badge ${o.payment_status === 'paid' ? 'paid' : ''}">${o.payment_status}</span> • <b>${o.status}</b> • ${rp(o.total)}<br>
      <small>${(o.items || []).map((i) => i.qty + '× ' + i.menu_name + ' ' + (i.level || '')).join(', ')}${o.note ? ' • note: ' + o.note : ''}</small><br>
      <div class="row" style="margin-top:6px;flex-wrap:wrap">
      <button onclick="setSt(${o.id},'dimasak')">Dimasak</button><button onclick="setSt(${o.id},'siap_diambil')">Siap Diambil</button>
      <button onclick="setSt(${o.id},'selesai')">Selesai</button><button onclick="setSt(${o.id},'dibatalkan')">Batal</button>
      <button onclick="setPay(${o.id},'paid')">Lunas (cash)</button></div>`;
      box.appendChild(d);
    });
  } catch (e) { box.innerHTML = '<p style="color:red">' + e.message + '</p>'; }
}
async function setSt(id, status) { await apiPost({ action: 'adminUpdateOrder', token: token(), id, status }); loadOrders(); loadStats(); }
async function setPay(id, payment_status) { await apiPost({ action: 'adminUpdateOrder', token: token(), id, payment_status }); loadOrders(); loadStats(); }
async function loadMenu() {
  try {
    const rows = await apiGet('adminMenu', { token: token() });
    document.getElementById('mlist').innerHTML = '<table><tr><th>Menu</th><th>Harga</th><th>Kat</th><th>Ada</th><th></th></tr>' + rows.map((m) => `<tr><td>${m.emoji} ${m.name}</td><td>${rp(m.price)}</td><td>${m.category}</td><td>${m.is_available ? 'Ya' : 'Tidak'}</td><td><button onclick='editM(${JSON.stringify(m).replace(/'/g, '&#39;')})'>Edit</button> <button onclick="delM(${m.id})">Hapus</button></td></tr>`).join('') + '</table>';
  } catch (e) { document.getElementById('mlist').innerHTML = '<p style="color:red">' + e.message + '</p>'; }
}
function editM(m) {
  document.getElementById('mid').value = m.id; document.getElementById('mname').value = m.name;
  document.getElementById('mcat').value = m.category; document.getElementById('mprice').value = m.price;
  document.getElementById('memoji').value = m.emoji; document.getElementById('mdesc').value = m.description || '';
  document.getElementById('mavail').value = m.is_available ? 1 : 0; window.scrollTo(0, 0);
}
function resetForm() { document.getElementById('mid').value = ''; document.getElementById('mname').value = ''; document.getElementById('mprice').value = 11000; }
async function saveMenu() {
  const id = document.getElementById('mid').value;
  const body = {
    action: id ? 'adminUpdateMenu' : 'adminCreateMenu', token: token(), id: id || undefined,
    name: document.getElementById('mname').value, category: document.getElementById('mcat').value || 'Mie',
    price: parseInt(document.getElementById('mprice').value) || 0, emoji: document.getElementById('memoji').value || '🍜',
    description: document.getElementById('mdesc').value, is_available: document.getElementById('mavail').value === '1' ? 1 : 0,
  };
  try { await apiPost(body); resetForm(); loadMenu(); } catch (e) { alert(e.message); }
}
async function delM(id) { if (!confirm('Hapus menu?')) return; await apiPost({ action: 'adminDeleteMenu', token: token(), id }); loadMenu(); }
me();

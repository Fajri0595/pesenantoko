// Layar dapur/antrian: polling 15 detik, bunyi pesanan baru, panggil antrian.
const rp = (n) => 'Rp' + (n || 0).toLocaleString('id-ID');
const token = () => localStorage.getItem('admin_token') || '';
let kenal = {}, suara = false, ctxSuara = null;

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
  try { ctxSuara = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* abaikan */ }
  suara = true;
  document.getElementById('btnSound').textContent = 'Notifikasi Suara Aktif';
  bip(2);
}
function bip(kali) {
  if (!suara || !ctxSuara) return;
  for (let i = 0; i < (kali || 1); i++) {
    const o = ctxSuara.createOscillator(), g = ctxSuara.createGain();
    o.connect(g); g.connect(ctxSuara.destination);
    o.frequency.value = 880; o.type = 'sine';
    const t = ctxSuara.currentTime + i * 0.35;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.start(t); o.stop(t + 0.32);
  }
}
function panggil(queue, nama) {
  bip(2);
  try {
    const u = new SpeechSynthesisUtterance('Nomor antrean ' + queue + ', pesanan atas nama ' + nama + ', telah siap dan dapat diambil di counter. Terima kasih.');
    u.lang = 'id-ID';
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* abaikan */ }
}
function elapsed(dibuat) {
  const d = new Date(String(dibuat || '').replace(' ', 'T')).getTime();
  if (isNaN(d)) return '';
  const m = Math.max(0, Math.floor((Date.now() - d) / 60000));
  return m < 60 ? m + ' mnt' : Math.floor(m / 60) + ' jam ' + (m % 60) + ' mnt';
}
async function poll() {
  try {
    const rows = await apiGet('adminOrders', { token: token() });
    const masak = rows.filter((o) => o.status === 'dimasak');
    const siap = rows.filter((o) => o.status === 'siap_diambil');
    // Bunyi jika ada pesanan yang belum dikenal
    let baru = 0;
    rows.forEach((o) => {
      if ((o.status === 'dimasak' || o.status === 'siap_diambil') && !kenal[o.id]) { baru++; }
      kenal[o.id] = o.status;
    });
    if (baru > 0) bip(3);
    document.getElementById('dCount').textContent =
      masak.length + ' sedang dimasak • ' + siap.length + ' siap diambil • diperbarui ' + new Date().toLocaleTimeString('id-ID');
    gambar(document.getElementById('dMasak'), masak, false);
    gambar(document.getElementById('dSiap'), siap, true);
  } catch (e) {
    document.getElementById('dCount').textContent = 'Data belum dapat dimuat: ' + e.message;
  }
  setTimeout(poll, 15000);
}
function gambar(box, list, sudahSiap) {
  box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="empty">Belum ada pesanan</div>'; return; }
  list.forEach((o) => {
    const d = document.createElement('div');
    d.className = 'antri-card' + (sudahSiap ? ' siap' : '');
    d.innerHTML = `<div class="antri-top"><span class="antri-no">${o.queue_no}</span><span class="badge">${elapsed(o.created_at)}</span></div>
      <div class="antri-meta"><b>${o.code}</b> • ${o.customer_name}<br>${(o.items || []).map((i) => i.qty + ' x ' + i.menu_name).join(', ')}</div>
      <div class="row">
        <button class="btn sm" onclick="panggil('${o.queue_no}','${String(o.customer_name).replace(/'/g, '')}')">Panggil Antrean</button>
        ${sudahSiap ? '' : `<button class="btn sm green" onclick="tandaiSiap(${o.id})">Tandai Siap Diambil</button>`}
      </div>`;
    box.appendChild(d);
  });
}
async function tandaiSiap(id) {
  await apiPost({ action: 'adminUpdateOrder', token: token(), id, status: 'siap_diambil' });
  bip(2); poll();
}
async function mulai() {
  document.getElementById('dLogin').style.display = 'none';
  document.getElementById('dMain').style.display = 'block';
  document.getElementById('btnOut').style.display = 'inline';
  try {
    const s = await apiGet('settings');
    if (s.store_name) {
      document.title = 'Dapur — ' + s.store_name;
      document.getElementById('dapurBrand').textContent = s.store_name;
    }
  } catch (e) { /* abaikan */ }
  poll();
}
setInterval(() => {
  document.getElementById('dClock').textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}, 1000);
if (token()) mulai();

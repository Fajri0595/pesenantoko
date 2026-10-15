// Layar dapur/antrian: polling 10 detik, bunyi pesanan baru, panggil antrian, SLA warna, TV mode.
const rp = (n) => 'Rp' + (n || 0).toLocaleString('id-ID');
const token = () => localStorage.getItem('admin_token') || '';
const escD = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let kenal = {}, suara = false, ctxSuara = null, pollTimer = null, DAPUR_CACHE = [];

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
function toggleTV() { document.body.classList.toggle('tv'); }
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
function panggilById(id) {
  const o = DAPUR_CACHE.find((x) => Number(x.id) === Number(id));
  if (!o) return;
  panggil(o.queue_no || '', o.customer_name || '');
}
function panggil(queue, nama) {
  bip(2);
  try {
    const q = String(queue || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 20);
    const n = String(nama || '').replace(/[<>"']/g, '').slice(0, 40);
    const u = new SpeechSynthesisUtterance('Nomor antrean ' + q + ', pesanan atas nama ' + n + ', telah siap dan dapat diambil di counter. Terima kasih.');
    u.lang = 'id-ID';
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* abaikan */ }
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
function slaClass(mnt) { return mnt >= 30 ? 'bad' : (mnt >= 15 ? 'warn' : ''); }
async function poll(manual) {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  try {
    const rows = await apiGet('adminOrders', { token: token() });
    DAPUR_CACHE = rows;
    const q = ((document.getElementById('dq') && document.getElementById('dq').value) || '').toLowerCase();
    let masak = rows.filter((o) => o.status === 'dimasak');
    let siap = rows.filter((o) => o.status === 'siap_diambil');
    if (q) {
      const flt = (o) => [o.code, o.customer_name, o.queue_no].join(' ').toLowerCase().includes(q);
      masak = masak.filter(flt); siap = siap.filter(flt);
    }
    masak.sort((a, b) => elapsedMin(a.created_at) - elapsedMin(b.created_at));
    siap.sort((a, b) => elapsedMin(a.created_at) - elapsedMin(b.created_at));
    let baru = 0;
    rows.forEach((o) => {
      if ((o.status === 'dimasak' || o.status === 'siap_diambil') && !kenal[o.id]) { baru++; }
      kenal[o.id] = o.status;
    });
    if (baru > 0 && !manual) bip(3);
    document.getElementById('dCount').textContent =
      masak.length + ' sedang dimasak • ' + siap.length + ' siap diambil • diperbarui ' + new Date().toLocaleTimeString('id-ID');
    gambar(document.getElementById('dMasak'), masak, false);
    gambar(document.getElementById('dSiap'), siap, true);
  } catch (e) {
    document.getElementById('dCount').textContent = 'Data belum dapat dimuat: ' + e.message;
  }
  pollTimer = setTimeout(poll, 10000);
}
function gambar(box, list, sudahSiap) {
  box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="empty">Belum ada pesanan</div>'; return; }
  list.forEach((o) => {
    const mnt = elapsedMin(o.created_at);
    const sla = slaClass(mnt);
    const cls = 'antri-card' + (sudahSiap ? ' siap' : '') + (mnt >= 30 ? ' late' : (mnt >= 15 ? ' over' : ''));
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = `<div class="antri-top"><span class="antri-no">${escD(o.queue_no)}</span><span class="sla ${sla}">${escD(elapsed(o.created_at))}</span></div>
      <div class="antri-meta"><b>${escD(o.code)}</b> • ${escD(o.customer_name)}<br>${escD((o.items || []).map((i) => i.qty + ' x ' + i.menu_name).join(', '))}${o.note ? '<br>Catatan: ' + escD(o.note) : ''}</div>
      <div class="row">
        <button class="btn sm" data-panggil="${o.id}">Panggil Antrean</button>
        ${sudahSiap ? `<button class="btn sm green" data-selesai="${o.id}">Selesaikan</button>` : `<button class="btn sm green" data-siap="${o.id}">Tandai Siap Diambil</button>`}
      </div>`;
    box.appendChild(d);
  });
  box.querySelectorAll('button[data-panggil]').forEach((b) => b.onclick = () => panggilById(b.dataset.panggil));
  box.querySelectorAll('button[data-siap]').forEach((b) => b.onclick = () => tandaiSiap(Number(b.dataset.siap)));
  box.querySelectorAll('button[data-selesai]').forEach((b) => b.onclick = () => tandaiSelesai(Number(b.dataset.selesai)));
}
async function tandaiSiap(id) {
  try { await apiPost({ action: 'adminUpdateOrder', token: token(), id, status: 'siap_diambil' }); } catch (e) { alert(e.message); return; }
  bip(2); poll(true);
}
async function tandaiSelesai(id) {
  try { await apiPost({ action: 'adminUpdateOrder', token: token(), id, status: 'selesai' }); } catch (e) { alert(e.message); return; }
  bip(1); poll(true);
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
  poll(true);
}
setInterval(() => {
  const el = document.getElementById('dClock');
  if (el) el.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && token()) poll(true); });
if (token()) mulai();

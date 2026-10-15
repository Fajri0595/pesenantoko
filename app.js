// Frontend publik (GitHub Pages) -> Backend GAS — v3: thumbnail foto, tanpa ikon
let MENU = [], CART = [];
try { CART = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { CART = []; }
let PAYMENTS = {}, paySel = 'QRIS', lastOrder = null, lastLacak = null, showBayarRef = null;
let SETTINGS = { store_name: 'UMKM MANDIRI', tagline: 'TAKEAWAY • PRAKTIS & TANPA ANTRE', service_fee: 2000, estimasi: '15–20 menit', batas_bayar_menit: 15, jam_buka: '', jam_tutup: '', buka: true };
const stokOf = (m) => (m.stok === '' || m.stok === undefined || m.stok === null) ? -1 : (isNaN(parseInt(m.stok, 10)) ? -1 : parseInt(m.stok, 10));
const fee = () => SETTINGS.service_fee || 0;
const storeSlug = () => SETTINGS.store_name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'TOKO';
const rp = (n) => 'Rp' + (n || 0).toLocaleString('id-ID');
const $ = (id) => document.getElementById(id);
const PAY_SHORT = { QRIS: 'QR', GOPAY: 'GP', OVO: 'OV', DANA: 'DN', CASH: 'CS' };
// Helpers keamanan & gambar — anti-XSS + placeholder elegan
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ece5d3"/><stop offset="1" stop-color="#ddd2b8"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><text x="400" y="255" font-family="sans-serif" font-size="42" font-weight="700" fill="#8a8175" text-anchor="middle">UMKM Mandiri</text></svg>');
function imgFallback(el) { el.onerror = null; el.src = PLACEHOLDER; }
const payLabelOf = (method) => ((PAYMENTS[method] && PAYMENTS[method].label) || method || '—');
const parseCreatedAt = (v) => {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  const s = String(v).trim().replace(' ', 'T');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

function toast(msg) {
  const box = $('toast'); if (!box) return;
  const d = document.createElement('div'); d.className = 'toast-msg'; d.textContent = msg;
  box.appendChild(d); setTimeout(() => d.remove(), 2200);
}

async function init() {
  if (!isConfigured()) $('cfgWarn').style.display = 'block';
  try {
    const [m, k] = await Promise.all([apiGet('menu'), apiGet('kategori')]);
    MENU = m;
    // Settings opsional: backend lama yang belum redeploy tidak punya action ini.
    // Fallback ke endpoint payments lama agar menu tetap tampil.
    let s = null;
    try { s = await apiGet('settings'); } catch (e) { s = null; }
    if (!s) {
      let p = null;
      try { p = await apiGet('payments'); } catch (e2) { p = null; }
      s = p ? { payments: p } : {};
    }
    applySettings(s);
    const sel = $('kategori');
    k.forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
    sel.onchange = () => { render(); syncPills(); };
    $('q').oninput = render;
    buildPills(k); renderPays(); render(); renderCart();
  } catch (e) {
    $('grid').innerHTML = '<p style="color:red">Gagal memuat menu: ' + e.message + '</p>';
  }
}
function applySettings(s) {
  s = s || {};
  if (s.store_name) SETTINGS.store_name = String(s.store_name);
  if (s.tagline) SETTINGS.tagline = String(s.tagline);
  if (s.service_fee !== undefined) SETTINGS.service_fee = Math.max(0, parseInt(s.service_fee) || 0);
  if (s.estimasi) SETTINGS.estimasi = String(s.estimasi);
  if (s.batas_bayar_menit !== undefined) SETTINGS.batas_bayar_menit = Math.max(1, parseInt(s.batas_bayar_menit) || 15);
  if (s.jam_buka) SETTINGS.jam_buka = String(s.jam_buka);
  if (s.jam_tutup) SETTINGS.jam_tutup = String(s.jam_tutup);
  if (s.buka !== undefined) SETTINGS.buka = !!s.buka;
  const tw = $('tutupWarn');
  if (tw) {
    if (SETTINGS.buka === false) {
      tw.style.display = 'block';
      tw.innerHTML = '<b>Toko tutup.</b> Jam buka ' + SETTINGS.jam_buka + '–' + SETTINGS.jam_tutup + '. Pesanan dibuka kembali saat jam operasional.';
    } else tw.style.display = 'none';
  }
  if (s.payments && Object.keys(s.payments).length) {
    PAYMENTS = s.payments;
    if (!PAYMENTS[paySel]) paySel = Object.keys(PAYMENTS)[0];
  }
  document.title = SETTINGS.store_name + ' — Layanan Takeaway';
  const bn = $('brandName'); if (bn) bn.textContent = SETTINGS.store_name;
  const bt = $('brandTag'); if (bt) bt.textContent = SETTINGS.tagline;
  const fb = $('footBrand'); if (fb) fb.textContent = SETTINGS.store_name;
  const ec = $('estChip'); if (ec) ec.textContent = 'Estimasi siap ' + SETTINGS.estimasi;
  const sl = $('svcLabel'); if (sl) sl.textContent = rp(fee());
}
function buildPills(kats) {
  const box = $('pills'); if (!box) return;
  const mk = (val, label) => {
    const b = document.createElement('button');
    b.className = 'pill-btn' + (!val ? ' on' : ''); b.textContent = label; b.dataset.val = val;
    b.onclick = () => setKat(val);
    return b;
  };
  box.innerHTML = '';
  box.appendChild(mk('', 'Semua'));
  kats.forEach((c) => box.appendChild(mk(c, c)));
}
function setKat(v) { $('kategori').value = v; render(); syncPills(); }
function syncPills() {
  const v = $('kategori').value;
  document.querySelectorAll('#pills .pill-btn').forEach((b) => b.classList.toggle('on', b.dataset.val === v));
}
function render() {
  const q = ($('q').value || '').toLowerCase();
  const kat = $('kategori').value;
  const sortV = ($('sort') && $('sort').value) || '';
  const onlyAvail = $('onlyAvail') && $('onlyAvail').checked;
  let list = MENU.filter((m) => (!kat || m.category === kat) && String(m.name || '').toLowerCase().includes(q));
  if (onlyAvail) list = list.filter((m) => stokOf(m) !== 0);
  if (sortV === 'murah') list = list.slice().sort((a, b) => (a.price || 0) - (b.price || 0));
  else if (sortV === 'mahal') list = list.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
  else if (sortV === 'nama') list = list.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'id'));
  $('menuCount').textContent = list.length + ' menu' + (kat ? ' • ' + kat : '');
  const g = $('grid'); g.innerHTML = '';
  list.forEach((m) => {
    const d = document.createElement('div'); d.className = 'card';
    const img = foodImg(m);
    const nm = String(m.name || '');
    const isPedas = /level\s*[4-9]|level\s*8|pedas/i.test(nm);
    const sisa = stokOf(m);
    d.innerHTML = `<div class="thumb"><img src="${esc(img)}" alt="${esc(nm)}" loading="lazy" onerror="imgFallback(this)">${isPedas ? '<span class="flag">Pedas</span>' : ''}</div><div class="body">
      <div class="cat">${esc(m.category || '')}</div><h3>${esc(nm)}</h3>
      <div class="desc">${esc(m.description || '')}</div>
      <div class="price-row"><div class="price">${rp(m.price)}</div><span class="badge ${sisa === 0 ? 'pending' : ''}">${sisa === -1 ? 'Tersedia' : (sisa === 0 ? 'Habis' : 'Sisa ' + sisa + ' porsi')}</span></div>
       <input id="lv-${m.id}" class="level" type="text" placeholder="Level / catatan — contoh: Lv 4" maxlength="20" aria-label="Level untuk ${esc(nm)}">
      <div class="act">
        <div class="qty"><button onclick="addCart(${m.id},-1)" aria-label="Kurangi">−</button><button onclick="addCart(${m.id},1)" aria-label="Tambah">+</button></div>
        <button class="add" onclick="addCart(${m.id},1)" ${sisa === 0 ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>${sisa === 0 ? 'Habis' : 'Tambah'}</button>
      </div></div>`;
    g.appendChild(d);
  });
  if (!g.children.length) g.innerHTML = '<div class="empty">Menu tidak ditemukan. Silakan coba kata kunci lain.</div>';
}
function addCart(id, delta) {
  const m = MENU.find((x) => x.id === id); if (!m) return;
  const lv = (document.getElementById('lv-' + id)?.value || '').slice(0, 20);
  if (delta > 0) {
    const sisa = stokOf(m);
    const diKeranjang = CART.filter((c) => c.menu_id === id).reduce((a, c) => a + c.qty, 0);
    if (sisa !== -1 && diKeranjang + 1 > sisa) { toast('Mohon maaf, ' + m.name + ' tersisa ' + sisa + ' porsi'); return; }
    const same = CART.find((c) => c.menu_id === id && (c.level || '') === lv);
    if (same) same.qty = Math.min(20, same.qty + 1);
    else CART.push({ menu_id: id, name: m.name, price: m.price, qty: 1, level: lv });
    toast(m.name + ' telah ditambahkan ke keranjang');
  } else {
    const i = CART.findIndex((c) => c.menu_id === id);
    if (i > -1) { CART[i].qty--; if (CART[i].qty <= 0) CART.splice(i, 1); }
  }
  saveCart(true);
}
function saveCart(pop) {
  localStorage.setItem('cart', JSON.stringify(CART)); renderCart();
  if (pop) { const f = $('fab'); f.classList.remove('pop'); void f.offsetWidth; f.classList.add('pop'); }
}
function renderCart() {
  const count = CART.reduce((a, c) => a + c.qty, 0);
  $('cnt').textContent = count;
  const sub2 = $('cartSub'); if (sub2) sub2.textContent = count ? count + ' menu dipilih' : 'Belum ada menu dipilih';
  const box = $('citems'); box.innerHTML = '';
  let sub = 0;
  CART.forEach((c, i) => {
    sub += c.price * c.qty;
    const d = document.createElement('div'); d.className = 'ci';
    const img = foodImg({ name: c.name, id: c.menu_id });
    d.innerHTML = `<img class="ci-thumb" src="${esc(img)}" alt="${esc(c.name)}" loading="lazy" onerror="imgFallback(this)">
      <div class="ci-info"><b>${esc(c.name)}</b><small class="muted">${c.level ? esc(c.level) + ' • ' : ''}${rp(c.price)} / porsi</small>
        <div class="qty"><button onclick="chQty(${i},-1)" aria-label="Kurangi">−</button><span><b>${c.qty}</b></span><button onclick="chQty(${i},1)" aria-label="Tambah">+</button>
        <button class="link" onclick="rmItem(${i})">Hapus</button></div></div>
      <div class="ci-total"><b>${rp(c.price * c.qty)}</b></div>`;
    box.appendChild(d);
  });
  if (!CART.length) box.innerHTML = '<div class="empty">Keranjang Anda masih kosong.<br>Silakan pilih menu favorit Anda terlebih dahulu.</div>';
  const total = sub + (CART.length ? fee() : 0);
  $('csub').textContent = rp(sub);
  $('ctotal').textContent = rp(total);
  $('fabTotal').textContent = rp(total);
  const fab = $('fab');
  if (fab) fab.style.display = CART.length ? '' : '';
}
function chQty(i, d) { CART[i].qty += d; if (CART[i].qty <= 0) CART.splice(i, 1); saveCart(); }
function rmItem(i) { CART.splice(i, 1); saveCart(); }
function toggleCart(forceOpen) {
  const p = $('cartPanel'); if (!p) return;
  if (window.innerWidth < 1024) {
    const willOpen = forceOpen === true ? true : !p.classList.contains('open-drawer');
    p.classList.toggle('open-drawer', willOpen);
    let ov = document.getElementById('cartOv');
    if (willOpen && !ov) { ov = document.createElement('div'); ov.id = 'cartOv'; ov.className = 'cart-ov'; ov.onclick = () => toggleCart(false); document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('show')); }
    if (!willOpen && ov) { ov.classList.remove('show'); setTimeout(() => ov.remove(), 250); }
    document.body.classList.toggle('lock', willOpen);
  } else {
    p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash');
  }
}
function closeCartDrawer() { const p = $('cartPanel'); if (p) p.classList.remove('open-drawer'); const ov = document.getElementById('cartOv'); if (ov) ov.remove(); document.body.classList.remove('lock'); }

function renderPays() {
  const box = $('pays'); box.innerHTML = '';
  Object.entries(PAYMENTS).forEach(([k, v]) => {
    const d = document.createElement('div');
    d.className = 'payopt' + (k === paySel ? ' sel' : '');
    d.setAttribute('role', 'radio');
    d.setAttribute('aria-checked', k === paySel ? 'true' : 'false');
    d.tabIndex = 0;
    d.innerHTML = `<div class="pay-name">${esc(PAY_SHORT[k] || 'BY')}</div><div><b>${esc(v.label)}</b><br><small class="muted">${esc(v.desc || '')}</small></div>
      <input type="radio" ${k === paySel ? 'checked' : ''} style="margin-left:auto;width:auto" tabindex="-1" aria-hidden="true">`;
    d.onclick = () => { paySel = k; renderPays(); };
    d.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); paySel = k; renderPays(); } };
    box.appendChild(d);
  });
  if (!Object.keys(PAYMENTS).length) box.innerHTML = '<div class="warn">Metode pembayaran belum tersedia.</div>';
}
function validHP(hp) {
  let d = String(hp || '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  else if (d.startsWith('8') && !d.startsWith('0')) d = '0' + d;
  return /^08\d{8,12}$/.test(d) ? d : null;
}
function openCheckout() {
  if (!CART.length) { toast('Keranjang Anda masih kosong'); return; }
  if (SETTINGS.buka === false) { toast('Mohon maaf, toko sedang tutup (' + SETTINGS.jam_buka + '–' + SETTINGS.jam_tutup + '). Silakan kembali pada jam operasional.'); return; }
  loadCustomer();
  const sub = CART.reduce((a, c) => a + c.price * c.qty, 0);
  $('coSum').innerHTML = `${CART.length} jenis menu • Subtotal ${rp(sub)} + biaya layanan ${rp(fee())} = <b>${rp(sub + fee())}</b>`;
  closeCartDrawer();
  openM('mCheckout');
  setTimeout(() => { const n = $('nama'); if (n && !n.value) n.focus(); }, 100);
}
function openM(id) { $(id).classList.add('open'); }
function closeM(id) { $(id).classList.remove('open'); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open')); });

async function buatPesanan() {
  const customer_name = $('nama').value.trim().slice(0, 60);
  const rawHP = $('hp').value.trim();
  const customer_phone = validHP(rawHP);
  const note = $('catatan').value.trim().slice(0, 200);
  if (!customer_name) { toast('Mohon isi nama pemesan'); $('nama').focus(); return; }
  if (!customer_phone) { toast('No. HP tidak valid. Contoh: 081234567890'); $('hp').focus(); return; }
  if (!PAYMENTS[paySel]) { toast('Metode pembayaran tidak tersedia'); return; }
  if (!CART.length) return;
  const btn = $('btnOrder'); btn.disabled = true; btn.textContent = 'Memproses pesanan...';
  try {
    const j = await apiPost({
      action: 'createOrder', customer_name, customer_phone, note,
      payment_method: paySel, items: CART.map((c) => ({ menu_id: c.menu_id, qty: c.qty, level: c.level })),
    });
    lastOrder = j.order;
    try { localStorage.setItem('last_code', lastOrder.code); } catch (e) {}
    saveCustomer(customer_name, customer_phone);
    CART = []; saveCart(); closeCartDrawer(); closeM('mCheckout');
    if (j.demo) toast('Mode pratinjau — hubungkan GAS untuk menyimpan pesanan asli');
    if (lastOrder.payment_method === 'CASH') showStruk(lastOrder);
    else showBayar(lastOrder);
  } catch (e) { toast(e.message); }
  btn.disabled = false; btn.textContent = 'Konfirmasi Pesanan';
}
function saveCustomer(nama, hp) { try { localStorage.setItem('cust_name', nama); localStorage.setItem('cust_hp', hp); } catch (e) {} }
function loadCustomer() { try { if (!$('nama').value) $('nama').value = localStorage.getItem('cust_name') || ''; if (!$('hp').value) $('hp').value = localStorage.getItem('cust_hp') || ''; } catch (e) {} }
function qrFake(code) {
  let s = ''; const ch = '█▓▒░<>+*#$%&';
  for (let i = 0; i < 96; i++) s += ch[Math.floor(Math.random() * ch.length)] + (i % 12 === 11 ? '\n' : '');
  return `SIMULASI-${code}\n` + s;
}
// --- Panduan pembayaran yang menyerupai aslinya: pindai QR, nomor referensi, instruksi, dan hitung mundur ---
let payTimer = null;
function stopPayTimer() { if (payTimer) { clearInterval(payTimer); payTimer = null; } }
function payRef(code, method) {
  let h = 0; const s = code + '|' + method;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000000;
  const d = String(h).padStart(8, '0');
  if (method === 'QRIS') return 'NMID ID1024' + d;
  if (method === 'GOPAY') return '0812 ' + d.slice(0, 4) + ' ' + d.slice(4);
  if (method === 'OVO') return '0813 ' + d.slice(0, 4) + ' ' + d.slice(4);
  return '0817 ' + d.slice(0, 4) + ' ' + d.slice(4);
}
const PAY_STEPS = {
  QRIS: ['Buka aplikasi m-banking atau e-wallet pilihan Anda', 'Pilih menu Bayar atau Pindai QR', 'Pindai kode QR di atas', 'Pastikan nama merchant dan nominal sudah sesuai, lalu konfirmasi'],
  GOPAY: ['Buka aplikasi GoPay', 'Pilih Bayar ke nomor tujuan di atas', 'Masukkan nominal tepat sesuai tagihan', 'Konfirmasi dengan PIN GoPay Anda'],
  OVO: ['Buka aplikasi OVO', 'Pilih Transfer ke nomor tujuan di atas', 'Masukkan nominal tepat sesuai tagihan', 'Konfirmasi dengan PIN OVO Anda'],
  DANA: ['Buka aplikasi DANA', 'Pilih Kirim ke nomor tujuan di atas', 'Masukkan nominal tepat sesuai tagihan', 'Konfirmasi dengan PIN DANA Anda'],
  CASH: ['Tunjukkan kode pesanan di counter', 'Bayar tunai sesuai nominal', 'Simpan struk sebagai bukti'],
};
function showBayar(o) {
  if (!o || !o.code) { toast('Data pembayaran tidak valid'); return; }
  stopPayTimer();
  showBayarRef = o;
  const label = payLabelOf(o.payment_method);
  $('bTitle').textContent = `Pembayaran ${label} — ${rp(o.total)}`;
  const ref = payRef(o.code, o.payment_method);
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(storeSlug() + '|' + o.code + '|' + o.total);
  const steps = (PAY_STEPS[o.payment_method] || PAY_STEPS.QRIS).map((s, i) => `<div class="struk-row"><span>Langkah ${i + 1}</span><span>${esc(s.split('UMKM MANDIRI').join(SETTINGS.store_name))}</span></div>`).join('');
  const mnit = SETTINGS.batas_bayar_menit || 15;
  // Deadline persisten dari created_at server, bukan Date.now() client
  let batas = Date.now() + mnit * 60 * 1000;
  const dibuat = parseCreatedAt(o.created_at);
  if (dibuat) batas = dibuat.getTime() + mnit * 60 * 1000;
  const safeCode = esc(o.code);
  $('bBody').innerHTML = `
    <div class="struk-row"><span>Merchant</span><b>${esc(SETTINGS.store_name)}</b></div>
    <div class="struk-row"><span>Kode Pesanan</span><b>${safeCode}</b></div>
    <div class="struk-row"><span>Nomor Antrean</span><b>${esc(o.queue_no || '-')}</b></div>
    <div class="struk-row"><span>${o.payment_method === 'QRIS' ? 'NMID' : 'Nomor Tujuan'}</span><b>${esc(ref)}</b></div>
    <div class="struk-row"><span>Nominal Pembayaran</span><b>${rp(o.total)}</b></div>
    <div class="struk-row"><span>Batas Pembayaran</span><b id="payCount">--:--</b></div>
    <div class="qrbox" style="margin-top:10px">
      <img class="qr-img" src="${esc(qrUrl)}" alt="Kode QR pembayaran" onerror="this.style.display='none';document.getElementById('qrFb').style.display='block'">
      <pre id="qrFb" style="display:none;text-align:left;font-size:10px">${esc(qrFake(o.code))}</pre>
      <div style="font-size:16px;font-weight:800;margin-top:8px">${rp(o.total)}</div>
      <small>Mode simulasi — tidak ada dana aktual yang berpindah</small></div>
    <div style="margin-top:10px">${steps}</div>
    <div class="row" style="margin-top:10px"><button class="btn ghost" onclick="stopPayTimer();closeM('mBayar')">Bayar Nanti</button>
    <button id="btnPay" class="btn green" data-pay-code="${safeCode}">Saya Sudah Membayar</button></div>`;
  const btnPay = $('btnPay');
  if (btnPay) btnPay.onclick = () => simPay(o.code);
  openM('mBayar');
  const tick = () => {
    const sisa = Math.max(0, Math.floor((batas - Date.now()) / 1000));
    const el = $('payCount');
    if (el) el.textContent = String(Math.floor(sisa / 60)).padStart(2, '0') + ':' + String(sisa % 60).padStart(2, '0');
    if (sisa <= 0) {
      stopPayTimer();
      const b = $('btnPay');
      if (b) { b.disabled = true; b.textContent = 'Telah Kedaluwarsa'; }
      toast('Waktu pembayaran telah berakhir — silakan buat pesanan baru');
    }
  };
  tick();
  payTimer = setInterval(tick, 1000);
}
async function simPay(code) {
  const b = $('btnPay');
  b.disabled = true; b.textContent = 'Memverifikasi pembayaran...';
  await new Promise((r) => setTimeout(r, 1800));
  try {
    const j = await apiPost({ action: 'payOrder', code });
    stopPayTimer(); closeM('mBayar'); showStruk(j.order); toast('Pembayaran berhasil dikonfirmasi. Terima kasih.');
  } catch (e) { b.disabled = false; b.textContent = 'Saya Sudah Membayar'; toast(e.message); }
}
function showStruk(o) {
  const lunas = o.payment_status === 'paid';
  const payLabel = payLabelOf(o.payment_method);
  const tgl = o.created_at || new Date().toLocaleString('id-ID');
  const itemsHtml = (o.items || []).map((i) => `<tr><td>${esc(i.qty)} x ${esc(i.menu_name)} <small class="muted">${esc(i.level || '')}</small><br><small class="muted">${rp(i.price)} / porsi</small></td><td style="text-align:right;white-space:nowrap">${rp(i.price * i.qty)}</td></tr>`).join('');
  $('sBody').innerHTML = `
    <div id="strukPrint" class="struk">
      <div class="struk-head"><b>${esc(SETTINGS.store_name)}</b><span>Layanan Takeaway</span></div>
      <div class="struk-row"><span>No. Struk</span><b>${esc(o.code)}</b></div>
      <div class="struk-row"><span>No. Antrean</span><b>${esc(o.queue_no || '-')}</b></div>
      <div class="struk-row"><span>Tanggal</span><span>${esc(tgl)}</span></div>
      <div class="struk-row"><span>Pemesan</span><span>${esc(o.customer_name)} (${esc(o.customer_phone)})</span></div>
      ${o.note ? `<div class="struk-row"><span>Catatan</span><span>${esc(o.note)}</span></div>` : ''}
      <div class="struk-div"></div>
      <table>${itemsHtml}
      <tr><td>Subtotal</td><td style="text-align:right">${rp(o.subtotal)}</td></tr>
      <tr><td>Biaya Layanan</td><td style="text-align:right">${rp(o.service_fee)}</td></tr>
      <tr><td><b>Total Pembayaran</b></td><td style="text-align:right"><b>${rp(o.total)}</b></td></tr></table>
      <div class="struk-div"></div>
      <div class="struk-row"><span>Metode</span><b>${esc(payLabel)}</b></div>
      <div class="struk-row"><span>Status Pembayaran</span><span class="badge ${lunas ? 'paid' : 'pending'}">${lunas ? 'LUNAS' : (o.payment_method === 'CASH' ? 'BAYAR DI COUNTER' : 'MENUNGGU PEMBAYARAN')}</span></div>
      <div class="struk-row"><span>Estimasi Siap</span><span>${esc(SETTINGS.estimasi)}</span></div>
      <div class="qrbox" style="margin-top:12px"><div style="font-size:26px;font-weight:800;letter-spacing:2px">${esc(o.code)}</div>
      <div>Mohon tunjukkan kode ini di counter</div></div>
      <p class="muted" style="text-align:center">Terima kasih telah memesan di ${esc(SETTINGS.store_name)}</p>
    </div>
    <div class="row no-print" style="margin-top:12px"><button class="btn ghost" onclick="printStruk()">Cetak Struk</button>
    <button class="btn ghost" id="btnSalin">Salin Kode</button>
    <button class="btn" onclick="lacakDariStruk()">Lacak Pesanan</button></div>`;
  const btnSalin = $('btnSalin');
  if (btnSalin) btnSalin.onclick = () => salinKode(o.code);
  openM('mStruk');
}
function salinKode(code) {
  const done = () => toast('Kode ' + code + ' disalin');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done).catch(() => fallbackSalin(code, done));
  else fallbackSalin(code, done);
}
function fallbackSalin(code, done) {
  try { const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); done(); }
  catch (e) { toast('Gagal menyalin: ' + code); }
}
function shareWA(code) {
  const txt = encodeURIComponent(`Halo ${SETTINGS.store_name}! Saya memesan ${code}. Mohon info statusnya.`);
  window.open('https://wa.me/?text=' + txt, '_blank');
}
function printStruk() {
  document.body.classList.add('p-struk');
  window.print();
  setTimeout(() => document.body.classList.remove('p-struk'), 500);
}
function lacakDariStruk() {
  let code = (lastOrder && lastOrder.code) || '';
  try { if (!code) code = localStorage.getItem('last_code') || ''; } catch (e) {}
  closeM('mStruk');
  if (code) { $('kode').value = code; lacak(); }
  const el = $('lacak'); if (el) el.scrollIntoView({ behavior: 'smooth' });
}
const STATUS = { menunggu_pembayaran: 'Menunggu Pembayaran', dimasak: 'Sedang Dimasak', siap_diambil: 'Siap Diambil', selesai: 'Selesai', dibatalkan: 'Dibatalkan', kedaluwarsa: 'Kedaluwarsa' };
let lacakTimer = null;
function stopLacakTimer() { if (lacakTimer) { clearInterval(lacakTimer); lacakTimer = null; } }
async function lacak(silent) {
  const code = ($('kode').value || '').trim().toUpperCase();
  const box = $('hasil');
  if (!code) { toast('Mohon masukkan kode pesanan terlebih dahulu, contoh GC-XXXXXX'); return; }
  if (!silent) { box.innerHTML = '<p class="muted">Mencari pesanan Anda...</p>'; stopLacakTimer(); }
  try {
    const j = await apiGet('order', { code });
    const o = j.order;
    lastLacak = o;
    if (o.payment_method !== 'CASH' && o.payment_status !== 'paid') showBayarRef = o;
    pushRiwayat(o.code);
    try { history.replaceState(null, '', location.pathname + '?kode=' + encodeURIComponent(o.code) + location.hash); } catch (e) {}
    const flow = ['menunggu_pembayaran', 'dimasak', 'siap_diambil', 'selesai'];
    const pills = (o.status === 'dibatalkan' || o.status === 'kedaluwarsa') ? `<span class="pill cur">${esc(STATUS[o.status] || o.status)}</span>` : flow.map((s) => {
      const idx = flow.indexOf(o.status), i = flow.indexOf(s);
      return `<span class="pill ${i < idx ? 'on' : ''} ${i === idx ? 'cur' : ''}">${esc(STATUS[s])}</span>`;
    }).join(' → ');
    const selesai = ['selesai', 'dibatalkan', 'kedaluwarsa'].includes(o.status);
    box.innerHTML = `<div class="track-card">
      <div class="row" style="justify-content:space-between"><b style="font-size:18px">${esc(o.code)}</b>
      <span class="badge ${o.payment_status === 'paid' ? 'paid' : 'pending'}">${o.payment_status === 'paid' ? 'LUNAS' : o.payment_status === 'unpaid_cash' ? 'BAYAR DI COUNTER' : 'BELUM DIBAYAR'}</span></div>
      <div class="muted">${esc(o.queue_no || '-')} • ${esc(payLabelOf(o.payment_method))} • ${esc(o.customer_name || '')} • ${rp(o.total)}</div>
      <div class="timeline">${pills}</div>
      <small class="muted">${esc(o.created_at || '')} • auto-refresh 10 dtk</small>
      <div class="row" style="margin-top:8px">
      ${o.payment_method !== 'CASH' && o.payment_status !== 'paid' && !selesai ? `<button class="btn" id="btnBayarLacak">Bayar Sekarang</button>` : ''}
      <button class="btn ghost" id="btnSalinLacak">Salin Kode</button>
      <button class="btn ghost" id="btnWALacak">Tanya via WA</button>
      </div>
    </div>`;
    const bB = $('btnBayarLacak'); if (bB) bB.onclick = () => showBayar(o);
    const bS = $('btnSalinLacak'); if (bS) bS.onclick = () => salinKode(o.code);
    const bW = $('btnWALacak'); if (bW) bW.onclick = () => shareWA(o.code);
    renderRiwayat();
    if (!selesai) { stopLacakTimer(); lacakTimer = setInterval(() => lacak(true), 10000); }
    else stopLacakTimer();
  } catch (e) { if (!silent) box.innerHTML = `<div class="warn">${esc(e.message)}</div>`; }
}
function pushRiwayat(code) {
  try {
    let r = JSON.parse(localStorage.getItem('riwayat') || '[]');
    r = [code].concat(r.filter((x) => x !== code)).slice(0, 5);
    localStorage.setItem('riwayat', JSON.stringify(r));
  } catch (e) {}
}
function renderRiwayat() {
  const box = $('riwayat'); if (!box) return;
  let r = [];
  try { r = JSON.parse(localStorage.getItem('riwayat') || '[]'); } catch (e) {}
  if (!r.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<span class="muted">Terakhir:</span> ' + r.map((c) => `<button class="pill-btn sm" data-kode="${esc(c)}">${esc(c)}</button>`).join(' ');
  box.querySelectorAll('button').forEach((b) => b.onclick = () => { $('kode').value = b.dataset.kode; lacak(); });
}
// Init tambahan: deep-link ?kode=, sortir, customer tersimpan, tutup drawer saat checkout
(function initExtra() {
  document.addEventListener('DOMContentLoaded', () => {
    loadCustomer();
    renderRiwayat();
    try {
      const u = new URL(location.href);
      const k = (u.searchParams.get('kode') || '').toUpperCase();
      if (k) { $('kode').value = k; lacak(); }
      else { const lc = localStorage.getItem('last_code'); if (lc && !$('kode').value) { /* jangan auto, hanya saran */ } }
    } catch (e) {}
    const s = $('sort'); if (s) s.onchange = render;
    const oa = $('onlyAvail'); if (oa) oa.onchange = render;
    const hp = $('hp'); if (hp) hp.addEventListener('input', () => { hp.value = hp.value.replace(/[^\d+\s-]/g, ''); });
  });
})();
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) { m.classList.remove('open'); if (m.id === 'mBayar') stopPayTimer(); } }));
init();

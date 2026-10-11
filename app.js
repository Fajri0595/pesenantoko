// Frontend publik (GitHub Pages) -> Backend GAS — v3: thumbnail foto, tanpa ikon
let MENU = [], CART = [];
try { CART = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { CART = []; }
let PAYMENTS = {}, paySel = 'QRIS', lastOrder = null, lastLacak = null, showBayarRef = null;
const rp = (n) => 'Rp' + (n || 0).toLocaleString('id-ID');
const $ = (id) => document.getElementById(id);
const PAY_SHORT = { QRIS: 'QR', GOPAY: 'GP', OVO: 'OV', DANA: 'DN', CASH: 'CS' };

function toast(msg) {
  const box = $('toast'); if (!box) return;
  const d = document.createElement('div'); d.className = 'toast-msg'; d.textContent = msg;
  box.appendChild(d); setTimeout(() => d.remove(), 2200);
}

async function init() {
  if (!isConfigured()) $('cfgWarn').style.display = 'block';
  try {
    const [m, p, k] = await Promise.all([apiGet('menu'), apiGet('payments'), apiGet('kategori')]);
    MENU = m; PAYMENTS = p;
    const sel = $('kategori');
    k.forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
    sel.onchange = () => { render(); syncPills(); };
    $('q').oninput = render;
    buildPills(k); renderPays(); render(); renderCart();
  } catch (e) {
    $('grid').innerHTML = '<p style="color:red">Gagal memuat menu: ' + e.message + '</p>';
  }
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
  const q = $('q').value.toLowerCase();
  const kat = $('kategori').value;
  const list = MENU.filter((m) => (!kat || m.category === kat) && m.name.toLowerCase().includes(q));
  $('menuCount').textContent = list.length + ' menu' + (kat ? ' • ' + kat : '');
  const g = $('grid'); g.innerHTML = '';
  list.forEach((m) => {
    const d = document.createElement('div'); d.className = 'card';
    const img = foodImg(m);
    d.innerHTML = `<div class="thumb"><img src="${img}" alt="${m.name}" loading="lazy" onerror="this.remove()"></div><div class="body">
      <div class="cat">${m.category}</div><h3>${m.name}</h3>
      <div class="desc">${m.description || ''}</div>
      <div class="price-row"><div class="price">${rp(m.price)}</div><span class="badge">Tersedia</span></div>
      <input id="lv-${m.id}" class="level" type="text" placeholder="Level / catatan — cth. Lv 4" maxlength="20">
      <div class="act">
        <div class="qty"><button onclick="addCart(${m.id},-1)" aria-label="kurang">−</button><button onclick="addCart(${m.id},1)" aria-label="tambah">+</button></div>
        <button class="add" onclick="addCart(${m.id},1)">Tambah</button>
      </div></div>`;
    g.appendChild(d);
  });
  if (!g.children.length) g.innerHTML = '<div class="empty">Menu tidak ditemukan. Coba kata kunci lain.</div>';
}
function addCart(id, delta) {
  const m = MENU.find((x) => x.id === id); if (!m) return;
  const lv = (document.getElementById('lv-' + id)?.value || '').slice(0, 20);
  if (delta > 0) {
    const same = CART.find((c) => c.menu_id === id && (c.level || '') === lv);
    if (same) same.qty = Math.min(20, same.qty + 1);
    else CART.push({ menu_id: id, name: m.name, price: m.price, qty: 1, level: lv });
    toast(m.name + ' masuk keranjang');
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
  const sub2 = $('cartSub'); if (sub2) sub2.textContent = count + ' item';
  const box = $('citems'); box.innerHTML = '';
  let sub = 0;
  CART.forEach((c, i) => {
    sub += c.price * c.qty;
    const d = document.createElement('div'); d.className = 'ci';
    const img = foodImg({ name: c.name, id: c.menu_id });
    d.innerHTML = `<img class="ci-thumb" src="${img}" alt="${c.name}" loading="lazy" onerror="this.remove()">
      <div class="ci-info"><b>${c.name}</b><small class="muted">${c.level ? c.level + ' • ' : ''}${rp(c.price)} / pcs</small>
        <div class="qty"><button onclick="chQty(${i},-1)" aria-label="kurang">−</button><span><b>${c.qty}</b></span><button onclick="chQty(${i},1)" aria-label="tambah">+</button>
        <button class="link" onclick="rmItem(${i})">Hapus</button></div></div>
      <div class="ci-total"><b>${rp(c.price * c.qty)}</b></div>`;
    box.appendChild(d);
  });
  if (!CART.length) box.innerHTML = '<div class="empty">Keranjang kosong.<br>Pilih menu favorit terlebih dahulu.</div>';
  const total = sub + (CART.length ? 2000 : 0);
  $('csub').textContent = rp(sub);
  $('ctotal').textContent = rp(total);
  $('fabTotal').textContent = rp(total);
}
function chQty(i, d) { CART[i].qty += d; if (CART[i].qty <= 0) CART.splice(i, 1); saveCart(); }
function rmItem(i) { CART.splice(i, 1); saveCart(); }
function toggleCart() {
  const p = $('cartPanel'); if (!p) return;
  p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash');
}

function renderPays() {
  const box = $('pays'); box.innerHTML = '';
  Object.entries(PAYMENTS).forEach(([k, v]) => {
    const d = document.createElement('div');
    d.className = 'payopt' + (k === paySel ? ' sel' : '');
    d.innerHTML = `<div class="pay-name">${PAY_SHORT[k] || 'BY'}</div><div><b>${v.label}</b><br><small class="muted">${v.desc}</small></div>
      <input type="radio" ${k === paySel ? 'checked' : ''} style="margin-left:auto;width:auto">`;
    d.onclick = () => { paySel = k; renderPays(); };
    box.appendChild(d);
  });
}
function openCheckout() {
  if (!CART.length) { toast('Keranjang masih kosong'); return; }
  const sub = CART.reduce((a, c) => a + c.price * c.qty, 0);
  $('coSum').innerHTML = `${CART.length} jenis item • Subtotal ${rp(sub)} + service Rp2.000 = <b>${rp(sub + 2000)}</b>`;
  openM('mCheckout');
}
function openM(id) { $(id).classList.add('open'); }
function closeM(id) { $(id).classList.remove('open'); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open')); });

async function buatPesanan() {
  const customer_name = $('nama').value.trim();
  const customer_phone = $('hp').value.trim();
  const note = $('catatan').value.trim();
  if (!customer_name || !customer_phone) { toast('Isi nama dan HP terlebih dahulu'); return; }
  if (!CART.length) return;
  const btn = $('btnOrder'); btn.disabled = true; btn.textContent = 'Memproses...';
  try {
    const j = await apiPost({
      action: 'createOrder', customer_name, customer_phone, note,
      payment_method: paySel, items: CART.map((c) => ({ menu_id: c.menu_id, qty: c.qty, level: c.level })),
    });
    lastOrder = j.order;
    CART = []; saveCart(); closeM('mCheckout');
    if (j.demo) toast('Mode demo — hubungkan GAS untuk menyimpan asli');
    if (lastOrder.payment_method === 'CASH') showStruk(lastOrder);
    else showBayar(lastOrder);
  } catch (e) { toast(e.message); }
  btn.disabled = false; btn.textContent = 'Buat Pesanan';
}
function qrFake(code) {
  let s = ''; const ch = '█▓▒░<>+*#$%&';
  for (let i = 0; i < 96; i++) s += ch[Math.floor(Math.random() * ch.length)] + (i % 12 === 11 ? '\n' : '');
  return `SIMULASI-${code}\n` + s;
}
function showBayar(o) {
  $('bTitle').textContent = `Bayar ${PAYMENTS[o.payment_method].label} — ${rp(o.total)}`;
  $('bBody').innerHTML = `
    <p>Kode <b>${o.code}</b> • Antrian <b>${o.queue_no}</b></p>
    <div class="qrbox"><pre style="text-align:left;font-size:10px">${qrFake(o.code)}</pre>
    <div style="font-size:18px;font-weight:800">${o.payment_method} • ${rp(o.total)}</div><small>QR simulasi — tidak ada uang asli</small></div>
    <p><small class="muted">${PAYMENTS[o.payment_method].desc}. Tekan tombol di bawah seolah sudah membayar di aplikasi aslinya.</small></p>
    <div class="row"><button class="btn ghost" onclick="closeM('mBayar')">Bayar Nanti</button>
    <button id="btnPay" class="btn green" onclick="simPay('${o.code}')">Saya Sudah Bayar</button></div>`;
  openM('mBayar');
}
async function simPay(code) {
  const b = $('btnPay');
  b.disabled = true; b.textContent = 'Memverifikasi...';
  await new Promise((r) => setTimeout(r, 1800));
  try {
    const j = await apiPost({ action: 'payOrder', code });
    closeM('mBayar'); showStruk(j.order); toast('Pembayaran lunas');
  } catch (e) { b.disabled = false; b.textContent = 'Saya Sudah Bayar'; toast(e.message); }
}
function showStruk(o) {
  const lunas = o.payment_status === 'paid';
  const payLabel = (PAYMENTS[o.payment_method] && PAYMENTS[o.payment_method].label) || o.payment_method;
  const tgl = o.created_at || new Date().toLocaleString('id-ID');
  $('sBody').innerHTML = `
    <div id="strukPrint" class="struk">
      <div class="struk-head"><b>UMKM MANDIRI</b><span>Takeaway Tanpa Antri</span></div>
      <div class="struk-row"><span>No. Struk</span><b>${o.code}</b></div>
      <div class="struk-row"><span>Antrian</span><b>${o.queue_no}</b></div>
      <div class="struk-row"><span>Tanggal</span><span>${tgl}</span></div>
      <div class="struk-row"><span>Pelanggan</span><span>${o.customer_name} (${o.customer_phone})</span></div>
      ${o.note ? `<div class="struk-row"><span>Catatan</span><span>${o.note}</span></div>` : ''}
      <div class="struk-div"></div>
      <table>${o.items.map((i) => `<tr><td>${i.qty} x ${i.menu_name} <small class="muted">${i.level || ''}</small><br><small class="muted">${rp(i.price)} / pcs</small></td><td style="text-align:right;white-space:nowrap">${rp(i.price * i.qty)}</td></tr>`).join('')}
      <tr><td>Subtotal</td><td style="text-align:right">${rp(o.subtotal)}</td></tr>
      <tr><td>Service</td><td style="text-align:right">${rp(o.service_fee)}</td></tr>
      <tr><td><b>Total</b></td><td style="text-align:right"><b>${rp(o.total)}</b></td></tr></table>
      <div class="struk-div"></div>
      <div class="struk-row"><span>Metode</span><b>${payLabel}</b></div>
      <div class="struk-row"><span>Status bayar</span><span class="badge ${lunas ? 'paid' : 'pending'}">${lunas ? 'LUNAS' : (o.payment_method === 'CASH' ? 'BAYAR DI COUNTER' : 'MENUNGGU')}</span></div>
      <div class="struk-row"><span>Estimasi siap</span><span>15–20 menit</span></div>
      <div class="qrbox" style="margin-top:12px"><div style="font-size:26px;font-weight:800;letter-spacing:2px">${o.code}</div>
      <div>Tunjukkan kode ini ke counter</div></div>
      <p class="muted" style="text-align:center">Terima kasih sudah memesan di UMKM Mandiri</p>
    </div>
    <div class="row no-print" style="margin-top:12px"><button class="btn ghost" onclick="window.print()">Cetak</button>
    <button class="btn" onclick="lacakDariStruk()">Lacak Status</button></div>`;
  openM('mStruk');
}
function lacakDariStruk() { closeM('mStruk'); $('kode').value = lastOrder.code; lacak(); $('lacak').scrollIntoView({ behavior: 'smooth' }); }
const STATUS = { menunggu_pembayaran: 'Menunggu Bayar', dimasak: 'Dimasak', siap_diambil: 'Siap Diambil', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };
async function lacak() {
  const code = $('kode').value.trim().toUpperCase();
  const box = $('hasil');
  if (!code) { toast('Isi kode terlebih dahulu, contoh GC-XXXXXX'); return; }
  box.innerHTML = '<p class="muted">Mencari pesanan...</p>';
  try {
    const j = await apiGet('order', { code });
    const o = j.order;
    const flow = ['menunggu_pembayaran', 'dimasak', 'siap_diambil', 'selesai'];
    const pills = o.status === 'dibatalkan' ? '<span class="pill cur">Dibatalkan</span>' : flow.map((s) => {
      const idx = flow.indexOf(o.status), i = flow.indexOf(s);
      return `<span class="pill ${i < idx ? 'on' : ''} ${i === idx ? 'cur' : ''}">${STATUS[s]}</span>`;
    }).join(' → ');
    box.innerHTML = `<div class="track-card">
      <div class="row" style="justify-content:space-between"><b style="font-size:18px">${o.code}</b>
      <span class="badge ${o.payment_status === 'paid' ? 'paid' : 'pending'}">${o.payment_status === 'paid' ? 'LUNAS' : o.payment_status === 'unpaid_cash' ? 'BAYAR DI COUNTER' : 'BELUM BAYAR'}</span></div>
      <div class="muted">${o.queue_no} • ${o.payment_method} • ${o.customer_name} • ${rp(o.total)}</div>
      <div class="timeline">${pills}</div>
      <small class="muted">${o.created_at}</small>
      ${o.payment_method !== 'CASH' && o.payment_status !== 'paid' && o.status !== 'dibatalkan' ? `<br><button class="btn" style="margin-top:8px" onclick="showBayar(lastLacak)">Bayar Sekarang</button>` : ''}
    </div>`;
    lastLacak = o;
    if (o.payment_method !== 'CASH' && o.payment_status !== 'paid') showBayarRef = o;
  } catch (e) { box.innerHTML = `<div class="warn">${e.message}</div>`; }
}
document.addEventListener('click', (e) => { if (e.target.textContent.includes('Bayar Sekarang') && showBayarRef) showBayar(showBayarRef); });
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); }));
init();

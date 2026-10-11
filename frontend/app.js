// Frontend publik (GitHub Pages) -> Backend GAS
let MENU = [], CART = [];
try { CART = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { CART = []; }
let PAYMENTS = {}, paySel = 'QRIS', lastOrder = null, lastLacak = null, showBayarRef = null;
const rp = (n) => 'Rp' + (n || 0).toLocaleString('id-ID');

async function init() {
  if (!isConfigured()) document.getElementById('cfgWarn').style.display = 'block';
  try {
    const [m, p, k] = await Promise.all([
      apiGet('menu'), apiGet('payments'), apiGet('kategori'),
    ]);
    MENU = m; PAYMENTS = p;
    const sel = document.getElementById('kategori');
    k.forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
    sel.onchange = render; document.getElementById('q').oninput = render;
    renderPays(); render(); renderCart();
  } catch (e) {
    document.getElementById('grid').innerHTML = '<p style="color:red">Gagal memuat menu: ' + e.message + '</p>';
  }
}
function render() {
  const q = document.getElementById('q').value.toLowerCase();
  const kat = document.getElementById('kategori').value;
  const g = document.getElementById('grid'); g.innerHTML = '';
  MENU.filter((m) => (!kat || m.category === kat) && m.name.toLowerCase().includes(q)).forEach((m) => {
    const d = document.createElement('div'); d.className = 'card';
    d.innerHTML = `<div class="pic">${m.emoji || '🍜'}</div><div class="body">
      <div class="cat">${m.category}</div><h3>${m.name}</h3>
      <div class="desc">${m.description || ''}</div>
      <div class="price">${rp(m.price)}</div>
      <div class="row">
        <input id="lv-${m.id}" type="text" placeholder="Lv / note" style="flex:1" title="Contoh: Lv 4, es sedikit">
        <div class="qty"><button onclick="addCart(${m.id},-1)">−</button><button onclick="addCart(${m.id},1)">＋ Tambah</button></div>
      </div></div>`;
    g.appendChild(d);
  });
  if (!g.children.length) g.innerHTML = '<p>Menu tidak ditemukan.</p>';
}
function addCart(id, delta) {
  const m = MENU.find((x) => x.id === id); if (!m) return;
  const lv = (document.getElementById('lv-' + id)?.value || '').slice(0, 20);
  if (delta > 0) {
    const same = CART.find((c) => c.menu_id === id && (c.level || '') === lv);
    if (same) same.qty = Math.min(20, same.qty + 1);
    else CART.push({ menu_id: id, name: m.name, price: m.price, qty: 1, level: lv });
  } else {
    const i = CART.findIndex((c) => c.menu_id === id);
    if (i > -1) { CART[i].qty--; if (CART[i].qty <= 0) CART.splice(i, 1); }
  }
  saveCart();
}
function saveCart() { localStorage.setItem('cart', JSON.stringify(CART)); renderCart(); }
function renderCart() {
  document.getElementById('cnt').textContent = CART.reduce((a, c) => a + c.qty, 0);
  const box = document.getElementById('citems'); box.innerHTML = '';
  let total = 0;
  CART.forEach((c, i) => {
    total += c.price * c.qty;
    const d = document.createElement('div');
    d.innerHTML = `<div class="row" style="justify-content:space-between;border-bottom:1px solid #eee;padding:8px 0">
      <div><b>${c.name}</b><br><small>${c.level || ''} • ${rp(c.price)} × ${c.qty} = <b>${rp(c.price * c.qty)}</b></small></div>
      <div class="qty"><button onclick="chQty(${i},-1)">−</button><span>${c.qty}</span><button onclick="chQty(${i},1)">＋</button>
      <button onclick="rmItem(${i})">🗑</button></div></div>`;
    box.appendChild(d);
  });
  if (!CART.length) box.innerHTML = '<p>Keranjang kosong. Pilih menu dulu.</p>';
  document.getElementById('ctotal').textContent = rp(total + (CART.length ? 2000 : 0));
}
function chQty(i, d) { CART[i].qty += d; if (CART[i].qty <= 0) CART.splice(i, 1); saveCart(); }
function rmItem(i) { CART.splice(i, 1); saveCart(); }
function toggleCart(open) { document.getElementById('drawer').classList.toggle('open', open); }

function renderPays() {
  const box = document.getElementById('pays'); box.innerHTML = '';
  Object.entries(PAYMENTS).forEach(([k, v]) => {
    const d = document.createElement('div');
    d.className = 'payopt' + (k === paySel ? ' sel' : '');
    d.innerHTML = `<input type="radio" ${k === paySel ? 'checked' : ''}><div><b>${v.label}</b><br><small>${v.desc}</small></div>`;
    d.onclick = () => { paySel = k; renderPays(); };
    box.appendChild(d);
  });
}
function openCheckout() {
  if (!CART.length) return alert('Keranjang kosong');
  toggleCart(false);
  const sub = CART.reduce((a, c) => a + c.price * c.qty, 0);
  document.getElementById('coSum').innerHTML = `${CART.length} jenis item • Subtotal ${rp(sub)} + service Rp2.000 = <b>${rp(sub + 2000)}</b>`;
  openM('mCheckout');
}
function openM(id) { document.getElementById(id).classList.add('open'); }
function closeM(id) { document.getElementById(id).classList.remove('open'); }

async function buatPesanan() {
  const customer_name = document.getElementById('nama').value.trim();
  const customer_phone = document.getElementById('hp').value.trim();
  const note = document.getElementById('catatan').value.trim();
  if (!customer_name || !customer_phone) return alert('Nama dan HP wajib');
  if (!CART.length) return alert('Keranjang kosong');
  try {
    const j = await apiPost({
      action: 'createOrder', customer_name, customer_phone, note,
      payment_method: paySel, items: CART.map((c) => ({ menu_id: c.menu_id, qty: c.qty, level: c.level })),
    });
    lastOrder = j.order;
    CART = []; saveCart(); closeM('mCheckout');
    if (j.demo) alert('Mode DEMO: pesanan tidak tersimpan. Isi GAS_API_URL di config.js lalu deploy ulang.');
    if (lastOrder.payment_method === 'CASH') showStruk(lastOrder);
    else showBayar(lastOrder);
  } catch (e) { alert(e.message); }
}
function qrFake(code) {
  let s = ''; const ch = '█▓▒░<>+*#$%&';
  for (let i = 0; i < 96; i++) s += ch[Math.floor(Math.random() * ch.length)] + (i % 12 === 11 ? '\n' : '');
  return `SIMULASI-${code}\n` + s;
}
function showBayar(o) {
  document.getElementById('bTitle').textContent = `Bayar ${PAYMENTS[o.payment_method].label} — ${rp(o.total)}`;
  document.getElementById('bBody').innerHTML = `
    <p>Kode <b>${o.code}</b> • Antrian <b>${o.queue_no}</b></p>
    <div class="qrbox"><pre style="text-align:left;font-size:10px">${qrFake(o.code)}</pre>
    <div>${o.payment_method} • ${rp(o.total)}</div><small>QR simulasi — tidak ada uang asli</small></div>
    <p><small>${PAYMENTS[o.payment_method].desc}. Klik tombol di bawah seolah kamu sudah bayar di aplikasi aslinya.</small></p>
    <div class="row"><button class="btn ghost" onclick="closeM('mBayar')">Nanti</button>
    <button id="btnPay" class="btn green" onclick="simPay('${o.code}')">Saya Sudah Bayar</button></div>`;
  openM('mBayar');
}
async function simPay(code) {
  const b = document.getElementById('btnPay');
  b.disabled = true; b.textContent = 'Memverifikasi... ⏳';
  await new Promise((r) => setTimeout(r, 2000));
  try {
    const j = await apiPost({ action: 'payOrder', code });
    closeM('mBayar'); showStruk(j.order);
  } catch (e) { b.disabled = false; b.textContent = 'Saya Sudah Bayar'; alert(e.message); }
}
function showStruk(o) {
  document.getElementById('sBody').innerHTML = `
    <p>Kode: <b style="font-size:20px">${o.code}</b> • Antrian: <b>${o.queue_no}</b></p>
    <p>${o.payment_method === 'CASH' ? 'Bayar <b>Cash Rp' + o.total.toLocaleString('id-ID') + '</b> saat ambil di counter.' : 'Sudah <b>LUNAS</b> (' + o.payment_method + ').'}</p>
    <p>Estimasi siap: <b>15–20 menit</b>. Tunjukkan kode ini saat ambil.</p>
    <table>${o.items.map((i) => `<tr><td>${i.qty}× ${i.menu_name} <small>${i.level || ''}</small></td><td>${rp(i.price * i.qty)}</td></tr>`).join('')}
    <tr><td>Service</td><td>${rp(o.service_fee)}</td></tr><tr><td><b>Total</b></td><td><b>${rp(o.total)}</b></td></tr></table>`;
  openM('mStruk');
}
function lacakDariStruk() { closeM('mStruk'); document.getElementById('kode').value = lastOrder.code; lacak(); document.getElementById('lacak').scrollIntoView(); }
const STATUS = { menunggu_pembayaran: 'Menunggu Bayar', dimasak: 'Dimasak', siap_diambil: 'Siap Diambil', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };
async function lacak() {
  const code = document.getElementById('kode').value.trim().toUpperCase();
  const box = document.getElementById('hasil');
  if (!code) return;
  box.innerHTML = 'Mencari...';
  try {
    const j = await apiGet('order', { code });
    const o = j.order;
    const flow = ['menunggu_pembayaran', 'dimasak', 'siap_diambil', 'selesai'];
    const pills = o.status === 'dibatalkan' ? '<span class="pill cur">Dibatalkan</span>' : flow.map((s) => {
      const idx = flow.indexOf(o.status), i = flow.indexOf(s);
      return `<span class="pill ${i < idx ? 'on' : ''} ${i === idx ? 'cur' : ''}">${STATUS[s]}</span>`;
    }).join(' → ');
    box.innerHTML = `<div class="box" style="margin-top:10px">
      <b>${o.code}</b> • ${o.queue_no} • ${o.payment_method} • <span class="badge ${o.payment_status === 'paid' ? 'paid' : ''}">${o.payment_status === 'paid' ? 'LUNAS' : o.payment_status === 'unpaid_cash' ? 'BAYAR DI COUNTER' : 'BELUM BAYAR'}</span>
      <div class="timeline">${pills}</div>
      <small>${o.customer_name} • Total ${rp(o.total)} • ${o.created_at}</small>
      ${o.payment_method !== 'CASH' && o.payment_status !== 'paid' && o.status !== 'dibatalkan' ? `<br><button class="btn" style="margin-top:8px" onclick="showBayar(lastLacak)">Bayar Sekarang</button>` : ''}
    </div>`;
    lastLacak = o;
    if (o.payment_method !== 'CASH' && o.payment_status !== 'paid') showBayarRef = o;
  } catch (e) { box.innerHTML = `<p style="color:red">${e.message}</p>`; }
}
document.addEventListener('click', (e) => { if (e.target.textContent === 'Bayar Sekarang' && showBayarRef) showBayar(showBayarRef); });
init();

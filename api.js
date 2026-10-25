// API client: GitHub Pages (statis) -> GAS Web App (dinamis)
// Memakai text/plain agar tidak kena preflight CORS GAS.
function API_URL() { return (window.GAS_API_URL || '').trim(); }
function isConfigured() { return API_URL().indexOf('https://script.google.com/') === 0; }

async function fetchT(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 25000);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('Koneksi timeout — server lambat merespons. Coba lagi.');
    throw new Error('Jaringan bermasalah: ' + (e.message || e));
  } finally { clearTimeout(t); }
}

async function apiGet(action, params) {
  params = params || {};
  if (!isConfigured()) return demoGet(action, params);
  const qs = new URLSearchParams(Object.assign({ action: action }, params));
  const r = await fetchT(API_URL() + '?' + qs.toString());
  const j = await r.json();
  if (j && j.error) throw new Error(j.error);
  return j;
}

async function apiPost(body) {
  if (!isConfigured()) return demoPost(body);
  const r = await fetchT(API_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j && j.error) throw new Error(j.error);
  return j;
}

// ---------- Mode demo (sebelum GAS_API_URL diisi) ----------
// Agar GitHub Pages tetap tampil cantik sebelum backend dihubungkan.
const DEMO_PAYMENTS = {
  QRIS: { label: 'QRIS', desc: 'Pindai QR dari m-banking / e-wallet pilihan Anda' },
  GOPAY: { label: 'GoPay', desc: 'Pembayaran praktis via GoPay' },
  OVO: { label: 'OVO', desc: 'Pembayaran praktis via OVO' },
  DANA: { label: 'DANA', desc: 'Pembayaran praktis via DANA' },
  CASH: { label: 'Tunai di Counter', desc: 'Pesan sekarang, bayar tunai saat pengambilan' },
};
const DEMO_MENU = [
  { id: 1, name: 'Mie Level 1', category: 'Mie', price: 11000, description: 'Manis gurih, level 1 pemula.', emoji: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800&auto=format&fit=crop', is_available: 1 },
  { id: 2, name: 'Mie Level 4', category: 'Mie', price: 11000, description: 'Level favorit.', emoji: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=800&auto=format&fit=crop', is_available: 1 },
  { id: 6, name: 'Siomay Ayam', category: 'Dimsum', price: 16000, description: 'Isi 3, saus mayo.', emoji: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?q=80&w=800&auto=format&fit=crop', is_available: 1 },
  { id: 8, name: 'Udang Rambutan', category: 'Dimsum', price: 17000, description: 'Bola udang crispy isi 3.', emoji: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=800&auto=format&fit=crop', is_available: 1 },
  { id: 11, name: 'Es Gobak Sodor', category: 'Minuman', price: 9000, description: 'Best seller.', emoji: 'https://images.unsplash.com/photo-1558857563-b371033873b8?q=80&w=800&auto=format&fit=crop', is_available: 1 },
  { id: 13, name: 'Es Teklek', category: 'Minuman', price: 8000, description: 'Teh + jeruk + soda.', emoji: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=800&auto=format&fit=crop', is_available: 1 },
];
const DEMO_PROMOS = {
  DISKON10: { type: 'percent', val: 10, max: 15000, desc: 'Diskon 10% (Maks Rp15.000)' },
  HEMAT5K: { type: 'nominal', val: 5000, min: 25000, desc: 'Potongan Rp5.000 (Min. Belanja Rp25.000)' },
  MAKANENAK: { type: 'percent', val: 15, max: 20000, desc: 'Diskon 15% (Maks Rp20.000)' },
};
let demoSeq = 1;
function demoGet(action, params) {
  params = params || {};
  if (action === 'payments') return Promise.resolve(DEMO_PAYMENTS);
  if (action === 'settings') return Promise.resolve({
    store_name: 'UMKM MANDIRI', tagline: 'KULINER SPESIAL • TAKEAWAY & DINE-IN',
    service_fee: 2000, estimasi: '15–20 menit', payments: DEMO_PAYMENTS,
    promo_codes: 'DISKON10,HEMAT5K,MAKANENAK',
  });
  if (action === 'kategori') return Promise.resolve(['Dimsum', 'Mie', 'Minuman']);
  if (action === 'menu') {
    let list = DEMO_MENU.slice();
    if (params.kategori) list = list.filter(function (m) { return m.category === params.kategori; });
    if (params.q) list = list.filter(function (m) { return m.name.toLowerCase().indexOf(String(params.q).toLowerCase()) > -1; });
    return Promise.resolve(list);
  }
  if (action === 'order') return Promise.reject(new Error('Mode pratinjau: hubungkan GAS_API_URL terlebih dahulu untuk melacak pesanan asli.'));
  return Promise.reject(new Error('Mode pratinjau: mohon isi GAS_API_URL di config.js untuk mengakses layanan admin.'));
}
function demoPost(body) {
  if (body.action === 'createOrder') {
    const isDineIn = body.order_type === 'dine_in';
    const code = 'GC-DEMO' + String(demoSeq).padStart(2, '0');
    const prefix = isDineIn ? 'DI-' : 'TA-';
    const queue_no = prefix + String(demoSeq).padStart(3, '0') + (isDineIn && body.table_no ? ' (Meja ' + body.table_no + ')' : '');
    demoSeq++;
    const subtotal = (body.items || []).reduce(function (a, it) {
      const m = DEMO_MENU.filter(function (x) { return x.id === Number(it.menu_id); })[0];
      return a + (m ? m.price * (it.qty || 1) : 0);
    }, 0);
    const discount = Math.max(0, parseInt(body.discount, 10) || 0);
    const total = Math.max(0, subtotal - discount + 2000);
    const order = {
      id: demoSeq, code: code, queue_no: queue_no,
      order_type: isDineIn ? 'dine_in' : 'takeaway',
      table_no: body.table_no || '',
      discount: discount,
      promo_code: body.promo_code || '',
      customer_name: body.customer_name,
      customer_phone: body.customer_phone || '',
      note: body.note || '',
      payment_method: body.payment_method, payment_status: body.payment_method === 'CASH' ? 'unpaid_cash' : 'pending',
      status: body.payment_method === 'CASH' ? 'dimasak' : 'menunggu_pembayaran',
      subtotal: subtotal, service_fee: 2000, total: total, created_at: new Date().toLocaleString('id-ID'),
      items: (body.items || []).map(function (it) {
        const m = DEMO_MENU.filter(function (x) { return x.id === Number(it.menu_id); })[0] || { name: 'Menu', price: 0 };
        return { menu_name: m.name, price: m.price, qty: it.qty || 1, level: it.level || '' };
      }),
    };
    return Promise.resolve({ order: order, demo: true });
  }
  if (body.action === 'payOrder') {
    return Promise.resolve({ order: { code: body.code, payment_status: 'paid', status: 'dimasak' } });
  }
  if (body.action === 'adminUpdateSettings') return Promise.reject(new Error('Mode pratinjau: hubungkan GAS_API_URL terlebih dahulu untuk menyimpan pengaturan.'));
  return Promise.reject(new Error('Mode pratinjau: mohon isi GAS_API_URL di config.js'));
}

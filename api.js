// API client: GitHub Pages (statis) -> GAS Web App (dinamis)
// Memakai text/plain agar tidak kena preflight CORS GAS.
function API_URL() { return (window.GAS_API_URL || '').trim(); }
function isConfigured() { return API_URL().indexOf('https://script.google.com/') === 0; }

async function apiGet(action, params) {
  params = params || {};
  if (!isConfigured()) return demoGet(action, params);
  const qs = new URLSearchParams(Object.assign({ action: action }, params));
  const r = await fetch(API_URL() + '?' + qs.toString());
  const j = await r.json();
  if (j && j.error) throw new Error(j.error);
  return j;
}

async function apiPost(body) {
  if (!isConfigured()) return demoPost(body);
  const r = await fetch(API_URL(), {
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
  QRIS: { label: 'QRIS', desc: 'Scan QR dari m-banking / e-wallet apa pun' },
  GOPAY: { label: 'GoPay', desc: 'Bayar via GoPay (simulasi)' },
  OVO: { label: 'OVO', desc: 'Bayar via OVO (simulasi)' },
  DANA: { label: 'DANA', desc: 'Bayar via DANA (simulasi)' },
  CASH: { label: 'Cash di Counter', desc: 'Pesan dulu, bayar tunai saat ambil' },
};
const DEMO_MENU = [
  { id: 1, name: 'Mie Level 1', category: 'Mie', price: 11000, description: 'Manis gurih, level 1 pemula.', emoji: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800&auto=format&fit=crop', is_available: 1 },
  { id: 2, name: 'Mie Level 4', category: 'Mie', price: 11000, description: 'Level favorit.', emoji: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=800&auto=format&fit=crop', is_available: 1 },
  { id: 6, name: 'Siomay Ayam', category: 'Dimsum', price: 16000, description: 'Isi 3, saus mayo.', emoji: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?q=80&w=800&auto=format&fit=crop', is_available: 1 },
  { id: 8, name: 'Udang Rambutan', category: 'Dimsum', price: 17000, description: 'Bola udang crispy isi 3.', emoji: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=800&auto=format&fit=crop', is_available: 1 },
  { id: 11, name: 'Es Gobak Sodor', category: 'Minuman', price: 9000, description: 'Best seller.', emoji: 'https://images.unsplash.com/photo-1558857563-b371033873b8?q=80&w=800&auto=format&fit=crop', is_available: 1 },
  { id: 13, name: 'Es Teklek', category: 'Minuman', price: 8000, description: 'Teh + jeruk + soda.', emoji: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=800&auto=format&fit=crop', is_available: 1 },
];
let demoSeq = 1;
function demoGet(action, params) {
  params = params || {};
  if (action === 'payments') return Promise.resolve(DEMO_PAYMENTS);
  if (action === 'settings') return Promise.resolve({
    store_name: 'UMKM MANDIRI', tagline: 'TAKEAWAY • TANPA ANTRI',
    service_fee: 2000, estimasi: '15–20 menit', payments: DEMO_PAYMENTS,
  });
  if (action === 'kategori') return Promise.resolve(['Dimsum', 'Mie', 'Minuman']);
  if (action === 'menu') {
    let list = DEMO_MENU.slice();
    if (params.kategori) list = list.filter(function (m) { return m.category === params.kategori; });
    if (params.q) list = list.filter(function (m) { return m.name.toLowerCase().indexOf(String(params.q).toLowerCase()) > -1; });
    return Promise.resolve(list);
  }
  if (action === 'order') return Promise.reject(new Error('Mode demo: hubungkan GAS_API_URL dulu untuk lacak pesanan asli.'));
  return Promise.reject(new Error('Mode demo: isi GAS_API_URL di config.js untuk akses admin.'));
}
function demoPost(body) {
  if (body.action === 'createOrder') {
    const code = 'GC-DEMO' + String(demoSeq).padStart(2, '0');
    const queue_no = 'TA-' + String(demoSeq).padStart(3, '0');
    demoSeq++;
    const subtotal = (body.items || []).reduce(function (a, it) {
      const m = DEMO_MENU.filter(function (x) { return x.id === Number(it.menu_id); })[0];
      return a + (m ? m.price * (it.qty || 1) : 0);
    }, 0);
    const order = {
      id: demoSeq, code: code, queue_no: queue_no, customer_name: body.customer_name,
      payment_method: body.payment_method, payment_status: body.payment_method === 'CASH' ? 'unpaid_cash' : 'pending',
      status: body.payment_method === 'CASH' ? 'dimasak' : 'menunggu_pembayaran',
      subtotal: subtotal, service_fee: 2000, total: subtotal + 2000, created_at: new Date().toLocaleString('id-ID'),
      items: (body.items || []).map(function (it) {
        const m = DEMO_MENU.filter(function (x) { return x.id === Number(it.menu_id); })[0] || { name: 'Menu', price: 0 };
        return { menu_name: m.name, price: m.price, qty: it.qty || 1, level: it.level || '' };
      }),
    };
    return Promise.resolve({ order: order, demo: true });
  }
  if (body.action === 'payOrder') return Promise.reject(new Error('Mode demo: isi GAS_API_URL dulu untuk simulasi bayar.'));
  if (body.action === 'adminUpdateSettings') return Promise.reject(new Error('Mode demo: isi GAS_API_URL dulu untuk menyimpan pengaturan.'));
  return Promise.reject(new Error('Mode demo: isi GAS_API_URL di config.js'));
}

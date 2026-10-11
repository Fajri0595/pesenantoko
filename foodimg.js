// Peta thumbnail foto asli per menu (Unsplash, terverifikasi).
// Jika kolom foto di database berisi URL http, URL itu yang dipakai.
function __U(id) { return 'https://images.unsplash.com/' + id + '?q=80&w=800&auto=format&fit=crop'; }
const FOOD_IMG = {
  mieKuah: __U('photo-1569718212165-3a8278d5f624'),
  mieGoreng: __U('photo-1585032226651-759b368d7246'),
  dimsum: __U('photo-1496116218417-1a781b1c416c'),
  goreng: __U('photo-1601050690597-df0568f70950'),
  esTeh: __U('photo-1556679343-c7306c1976bc'),
  boba: __U('photo-1558857563-b371033873b8'),
  coklat: __U('photo-1563805042-7684c019e1cb'),
};
function foodImg(m) {
  if (m && typeof m.emoji === 'string' && m.emoji.indexOf('http') === 0) return m.emoji;
  if (m && typeof m.foto === 'string' && m.foto.indexOf('http') === 0) return m.foto;
  const n = ((m && m.name) || '').toLowerCase();
  if (/milo|coklat|dinosaur/.test(n)) return FOOD_IMG.coklat;
  if (/petak|gobak|boba|susu/.test(n)) return FOOD_IMG.boba;
  if (/teklek|teh|jeruk|soda/.test(n)) return FOOD_IMG.esTeh;
  if (/es batu/.test(n)) return FOOD_IMG.esTeh;
  if (/pangsit|lumpia|rambutan|crispy/.test(n)) return FOOD_IMG.goreng;
  if (/siomay|dimsum|udang/.test(n)) return FOOD_IMG.dimsum;
  if (/suit|hompimpa/.test(n)) return FOOD_IMG.mieGoreng;
  if (/mie|ramen|noodle/.test(n)) return (m && m.id % 2) ? FOOD_IMG.mieKuah : FOOD_IMG.mieGoreng;
  const c = ((m && m.category) || '').toLowerCase();
  if (c.indexOf('minum') > -1) return FOOD_IMG.esTeh;
  if (c.indexOf('dimsum') > -1) return FOOD_IMG.dimsum;
  if (c.indexOf('topping') > -1) return FOOD_IMG.goreng;
  return FOOD_IMG.mieKuah;
}

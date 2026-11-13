// v9.9.29 (Ali's screenshot: a Telegram news line «… قاعدة عسكرية خشبية …» became "I found a stay · 11 nights"): exactly 10,000 everyday
// messages that are NOT bookings — Telegram / WhatsApp news and chats, ads and offers — in English and Arabic (Egyptian + Fusha), full of
// the trap words: night / ليلة / ليالي, stay / إقامة, hotel / فندق, طيران / flight, airport / المطار, dates, times, flight-like numbers
// (MS 804, F-16), prices and percent. readBooking must return null for every one. `node tests/tr1/notbook.mjs [N] [from]`
// (held-out: from = 50000 — run only after the fix was written).
const B = await import(process.env.TR1 || "../../web-src/bookings.js");
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export const NOW = Date.parse("2026-11-12T12:00:00");
const AR = (s) => String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], MON_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const pad = (n) => String(n).padStart(2, "0");
const HOT = ["Hilton", "Marriott", "Steigenberger", "Movenpick", "شيراتون", "هيلتون", "ماريوت", "سونستا"];
const CITY_EN = ["Cairo", "Gaza", "Jeddah", "Dubai", "Hurghada", "Istanbul", "Beirut", "Khartoum"], CITY_AR = ["القاهرة", "غزة", "جدة", "دبي", "الغردقة", "اسطنبول", "بيروت", "الخرطوم"];
export function make(i) {
  const r = rng(i * 977 + 3), pick = (a) => a[Math.floor(r() * a.length)], n = 1 + Math.floor(r() * 14);
  const d = new Date(NOW + (Math.floor(r() * 120) - 30) * 864e5), h = Math.floor(r() * 24), m = pick([0, 15, 30, 45]);
  const de = pick([`${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`, `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, `${d.getDate()} ${MON[d.getMonth()]}`]);
  const da = pick([`${AR(d.getDate())} ${MON_AR[d.getMonth()]}`, `${d.getDate()} ${MON_AR[d.getMonth()]} ${d.getFullYear()}`, `${AR(pad(d.getDate()))}/${AR(pad(d.getMonth() + 1))}/${AR(d.getFullYear())}`]);
  const t = pad(h) + ":" + pad(m), ce = pick(CITY_EN), ca = pick(CITY_AR), ho = pick(HOT), fl = pick(["MS", "SV", "EK", "XY", "QR"]) + " " + (100 + Math.floor(r() * 899)), pct = 10 + Math.floor(r() * 60);
  const T = [
    // news (Telegram channels)
    `عاجل | طيران الاحتلال يقصف قاعدة عسكرية خشبية في ${ca} الليلة الماضية بعد ${AR(n)} ليالي من القصف`,
    `غارات ليلية على ${ca} استمرت ${AR(n)} ساعات يوم ${da} وطيران حربي فوق المطار`,
    `حريق في فندق ${ho} بـ${ca} يوم ${da} الساعة ${AR(t)} ولا إصابات`,
    `${ca}: إقامة مؤتمر السياحة في فندق ${ho} من ${da} لمدة ${AR(n)} ليالي`,
    `Breaking: flight ${fl} diverted to ${ce} on ${de} after a medical emergency at ${t}`,
    `${ce} airport closed for ${n} nights from ${de} — airlines advise passengers to check their flights`,
    `F-16 jets seen over ${ce} on ${de}; residents told to stay indoors tonight`,
    `Hotel ${ho} in ${ce} evacuated on ${de} at ${t}, police say`,
    `Tourism: ${ce} hotels report ${pct}% occupancy over ${n} nights of the festival starting ${de}`,
    // chats
    `انا هبات عند خالتي ${AR(n)} ليالي ونرجع يوم ${da} ان شاء الله`,
    `الطيارة بتاعة بابا وصلت المطار الساعة ${AR(t)} الحمد لله`,
    `We stayed ${n} nights at my aunt's place, back on ${de} at ${t}`,
    `Meet me at the ${ho} lobby at ${t} on ${de}?`,
    `ليلة امبارح كانت حلوة جدا، نتقابل ${da} الساعة ${t}`,
    `can you pick me up from the airport on ${de}? my flight lands around ${t}`,
    `بكرة الساعة ${AR(t)} اجتماع في فندق ${ho} متنساش`,
    // ads and offers
    `Booking.com: Save ${pct}% on your next stay! Book now, valid until ${de}`,
    `عرض خاص من فندق ${ho}: خصم ${AR(pct)}% على ${AR(n)} ليالي حتى ${da} احجز الآن`,
    `EgyptAir offers: fly ${ce} from only 4,999 EGP, book before ${de}`,
    `Agoda deals: hotels in ${ce} from $${20 + n} a night — sale ends ${de}`,
    `طيران ناس: عروض الشتاء ${AR(pct)}% خصم على الرحلات إلى ${ca} حتى ${da}`,
    `Airbnb: Homes in ${ce} for ${n} nights starting from $${30 + n * 3} — offer ends ${de}`,
  ];
  return { msg: T[i % T.length] };
}
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) { const { msg } = make(i), b = B.readBooking(msg, NOW); if (b) { if (bad.length < 8) bad.push({ i, msg, got: b.kind + " " + (b.name || b.no || b.code || "") }); } else pass++; }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0)), null, 1));

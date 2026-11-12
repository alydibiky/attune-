// v9.9.25 B7 TR1 the trip from bookings: exactly 10,000 cases — each a short history of 1–3 messages about ONE booking (a flight from
// EgyptAir / Saudia / flynas / flyadeal / Air Arabia / Emirates, or a stay from Booking.com / Airbnb / Agoda / a hotel — English or
// Arabic with Arabic-Indic digits; dates "03 Mar 2027", "03/03/2027", "2027-03-03", «٣ مارس ٢٠٢٧»; 24 h or am/pm), then maybe a
// schedule change (new time / new day, "instead of …") and maybe a cancellation (sometimes only the code). Each message is read and
// applied in order (as if the person tapped Add). Checked: the flight number, route, date, time and code exact; the stay's name, dates,
// nights and code; a change REPLACES (one item, the new time), a cancellation REMOVES (no item).
const B = await import(process.env.TR1 || "../../web-src/bookings.js");
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const NOW = Date.parse("2026-11-12T12:00:00");
const AR = (s) => String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], MON_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const AIR = [["EgyptAir", "مصر للطيران", "MS"], ["Saudia", "الخطوط السعودية", "SV"], ["flynas", "طيران ناس", "XY"], ["flyadeal", "طيران أديل", "F3"], ["Air Arabia", "العربية للطيران", "G9"], ["Emirates", "طيران الإمارات", "EK"]];
const RT = [["CAI", "JED", "Cairo", "Jeddah", "القاهرة", "جدة"], ["CAI", "RUH", "Cairo", "Riyadh", "القاهرة", "الرياض"], ["JED", "CAI", "Jeddah", "Cairo", "جدة", "القاهرة"], ["CAI", "DXB", "Cairo", "Dubai", "القاهرة", "دبي"], ["RUH", "IST", "Riyadh", "Istanbul", "الرياض", "اسطنبول"], ["CAI", "MED", "Cairo", "Medina", "القاهرة", "المدينة"]];
const HOT = ["Hilton Makkah", "Pullman Zamzam", "Marriott Jeddah", "Swissotel Al Maqam", "دار التوحيد", "Le Meridien Dubai"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
function fmtDate(d, f, ar) { const s = [`${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}`, `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, iso(d)][f]; return ar ? (f === 0 ? AR(d.getDate()) + " " + MON_AR[d.getMonth()] + " " + AR(d.getFullYear()) : AR(s)) : s; }
function fmtTime(h, m, ap) { if (!ap) return pad(h) + ":" + pad(m); const hh = h % 12 || 12; return hh + ":" + pad(m) + " " + (h < 12 ? "AM" : "PM"); }
const CODE = (r) => Array.from({ length: 6 }, (_, k) => (k === 0 ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")[Math.floor(r() * (k === 0 ? 24 : 32))]).join("");
export function make(i) {
  const r = rng(i * 131 + 17), pick = (a) => a[Math.floor(r() * a.length)], ar = r() < 0.35, msgs = [];
  const d = new Date(NOW + (10 + Math.floor(r() * 300)) * 864e5); d.setHours(12, 0, 0, 0);
  const code = CODE(r), f = Math.floor(r() * 3);
  let want;
  if (i % 3 !== 2) {   // a flight
    const [an, aar, pfx] = pick(AIR), [a, b, ca, cb, aa, ab] = pick(RT), no = pfx + (100 + Math.floor(r() * 899)), h = Math.floor(r() * 24), m = [0, 10, 25, 40, 55][Math.floor(r() * 5)], ap = !ar && r() < 0.3;
    msgs.push(ar ? `${aar}: تم تأكيد رحلتك ${no} من ${aa} إلى ${ab} يوم ${fmtDate(d, f, true)} الساعة ${pad(h)}:${pad(m)} رقم الحجز ${code}`
      : pick([`${an}: Your flight ${no.slice(0, 2)} ${no.slice(2)} ${ca} (${a}) to ${cb} (${b}) on ${fmtDate(d, f)} at ${fmtTime(h, m, ap)}. Booking ref ${code}.`,
              `${an} booking confirmed. PNR: ${code}. Flight ${no} ${a}-${b}, departure ${fmtDate(d, f)} ${fmtTime(h, m, ap)}. Please be at the airport 3 hours before.`]));
    want = { kind: "flight", no, from: a, to: b, date: iso(d), time: pad(h) + ":" + pad(m), code };
    if (r() < 0.35) { const nd = new Date(d.getTime() + (r() < 0.5 ? 864e5 : 0)), nh = (h + 1 + Math.floor(r() * 5)) % 24, nm = [5, 15, 30, 45][Math.floor(r() * 4)];
      msgs.push(ar ? `${aar}: تم تغيير موعد رحلتك ${no} الموعد الجديد يوم ${fmtDate(nd, 1, true)} الساعة ${pad(nh)}:${pad(nm)} رقم الحجز ${code}`
        : `Schedule change: flight ${no} now departs on ${fmtDate(nd, 1)} at ${pad(nh)}:${pad(nm)} instead of ${pad(h)}:${pad(m)}. PNR ${code}`);
      want = { ...want, date: iso(nd), time: pad(nh) + ":" + pad(nm) }; }
  } else {   // a stay
    const name = pick(HOT), n = 1 + Math.floor(r() * 9), co = new Date(d.getTime() + n * 864e5), site = pick(["Booking.com", "Agoda", "Airbnb"]);
    msgs.push(ar ? `تم تأكيد حجزك في فندق ${name} من ${fmtDate(d, f, true)} لمدة ${AR(n)} ليالي رقم الحجز ${code}`
      : r() < 0.5 ? `${site}: Your reservation at ${name} is confirmed. Check-in ${fmtDate(d, f)}, check-out ${fmtDate(co, f)}. Confirmation number ${code}`
      : `${site}: ${n} nights at ${name}, check-in ${fmtDate(d, f)}. Booking code ${code}.`);
    want = { kind: "stay", name: ar ? "فندق " + name : name, checkin: iso(d), checkout: iso(co), nights: n, code };
  }
  if (r() < 0.2) { msgs.push(ar ? `تم إلغاء الحجز رقم ${code}` : pick([`Your booking ${code} has been cancelled.`, `Cancellation confirmed for booking ref ${code}.`])); want = null; }
  return { msgs, want };
}
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const c = make(i); let items = []; const why = [];
    for (const m of c.msgs) { const b = B.readBooking(m, NOW); if (!b) { why.push("not read: " + m.slice(0, 70)); break; } items = B.applyBooking(items, b).items; }
    if (!why.length) {
      if (!c.want) { if (items.length) why.push("cancelled but still there"); }
      else if (items.length !== 1) why.push(items.length + " items");
      else { const x = items[0]; for (const [k, v] of Object.entries(c.want)) if (x[k] !== v) why.push(k + " " + JSON.stringify(x[k]) + " ≠ " + JSON.stringify(v)); }
    }
    if (why.length) { if (bad.length < 8) bad.push({ i, why, msgs: c.msgs }); } else pass++;
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));

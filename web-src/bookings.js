/* ---- v9.9.25 B7 TR1 the trip from bookings (Ali picked B: "ask first, then add"). A booking message (SMS, email, app notification —
   EgyptAir, Saudia, flynas, flyadeal, Air Arabia, Emirates, Booking.com, Airbnb, Agoda… in English and Arabic) is read by code into a
   flight { airline, no "MS643", from "CAI", to "JED", date, time (local, as printed), code "K7QX2P" } or a stay { name, checkin, checkout,
   nights, code }, and whether it is a CHANGE (the same code, new time — it replaces the old one) or a CANCELLATION (the same code — it
   removes it). Nothing goes into the trip without the person's tap; the card shows exactly what was read. Pure.
   Tests: tests/tr1/gen.mjs (10,000 confirmations) + tests/unit/v9925tr1.test.mjs. */
import { AIRLINE_NAMES } from "./flights.js";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
const pad = (n) => String(n).padStart(2, "0");
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, "يناير": 1, "فبراير": 2, "مارس": 3, "ابريل": 4, "أبريل": 4, "مايو": 5, "يونيو": 6, "يوليو": 7, "اغسطس": 8, "أغسطس": 8, "سبتمبر": 9, "اكتوبر": 10, "أكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12 };
const AIRLINE_AR = { "مصر للطيران": "EgyptAir", "الخطوط السعودية": "Saudia", "السعودية": "Saudia", "طيران ناس": "flynas", "فلاي ناس": "flynas", "طيران أديل": "flyadeal", "العربية للطيران": "Air Arabia", "طيران الإمارات": "Emirates", "فلاي دبي": "flydubai", "القطرية": "Qatar Airways" };
const IATA = /\b(CAI|HBE|HRG|SSH|LXR|ASW|SPX|JED|RUH|DMM|MED|TIF|AHB|DXB|AUH|SHJ|DOH|KWI|BAH|MCT|AMM|BEY|IST|SAW|AYT|CMN|TUN|ADD|NBO|LHR|CDG|FRA|AMS|FCO|MAD|JFK|KUL|CGK|BKK|DEL|BOM|KHI|LHE|ISB|DAC|IKA)\b/g;
const CITY = { cairo: "CAI", "القاهرة": "CAI", jeddah: "JED", "جدة": "JED", "جده": "JED", riyadh: "RUH", "الرياض": "RUH", medina: "MED", madinah: "MED", "المدينة": "MED", dubai: "DXB", "دبي": "DXB",
  istanbul: "IST", "اسطنبول": "IST", dammam: "DMM", "الدمام": "DMM", "abu dhabi": "AUH", "أبوظبي": "AUH", doha: "DOH", "الدوحة": "DOH", kuwait: "KWI", "الكويت": "KWI", amman: "AMM", "عمان": "AMM", hurghada: "HRG", "الغردقة": "HRG", "sharm el sheikh": "SSH", "شرم الشيخ": "SSH" };
/** Every date in the text, in order → [{ iso, at }] (12 Mar 2027 · 12/03/2027 · 2027-03-12 · ١٢ مارس ٢٠٢٧ · 12MAR27). */
function dates(t, now) {
  const out = [], yNow = new Date(now).getFullYear(), push = (y, m, d, at) => { if (y < 100) y += 2000; const dt = new Date(y, m - 1, d); if (m >= 1 && m <= 12 && dt.getDate() === d && y >= yNow - 1 && y <= yNow + 2) out.push({ iso: y + "-" + pad(m) + "-" + pad(d), at }); };
  for (const m of t.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) push(+m[1], +m[2], +m[3], m.index);
  for (const m of t.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?![\d/])/g)) push(+m[3], +m[2], +m[1], m.index);
  const names = Object.keys(MON).join("|");
  for (const m of t.matchAll(new RegExp("(?<![\\d\\p{L}])(\\d{1,2})\\s*(" + names + ")[a-z]*\\.?,?\\s*(\\d{4}|\\d{2})?(?![\\d\\p{L}])", "giu"))) push(m[3] ? +m[3] : yNow, MON[m[2].toLowerCase()], +m[1], m.index);
  return out.sort((a, b) => a.at - b.at).filter((x, i, a) => !a.slice(0, i).some((y) => y.iso === x.iso && Math.abs(y.at - x.at) < 3));
}
const times = (t) => [...t.matchAll(/(?<![\d:])([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)\s*(am|pm|ص|م)?/gi)].map((m) => { let h = +m[1]; const ap = (m[3] || "").toLowerCase(); if ((ap === "pm" || ap === "م") && h < 12) h += 12; if ((ap === "am" || ap === "ص") && h === 12) h = 0; return { hm: pad(h) + ":" + m[2], at: m.index }; });
/** The booking code (PNR): 6 letters/digits with at least one letter, after a code word — never a flight number or a date. */
function codeIn(t) {
  const m = /(?:booking\s*(?:ref(?:erence)?|code|number|no\.?)|confirmation\s*(?:code|number|no\.?)?|pnr|reservation\s*(?:code|number|no\.?)?|ref(?:erence)?\.?|رقم\s*الحجز|كود\s*الحجز|مرجع\s*الحجز|رمز\s*الحجز|الحجز\s*رقم)\s*[:#\-]?\s*([A-Z0-9]{5,10})\b/i.exec(t);
  return m && /[A-Z]/i.test(m[1]) ? m[1].toUpperCase() : m && /^\d{8,10}$/.test(m[1]) ? m[1] : "";
}
/** One message → null | { kind: "flight" | "stay", status: "confirmed" | "changed" | "cancelled", code, … } */
export function readBooking(text, now = Date.now()) {
  const raw = String(text || ""), t = latin(raw).replace(/\s+/g, " ");
  const status = /\b(cancel(?:l)?ed|cancellation)\b|ملغ[يى]|تم إلغاء|تم الغاء|إلغاء الحجز|الغاء الحجز|اتلغى/i.test(t) ? "cancelled" : /\b(changed|rescheduled|schedule change|new time|updated|retimed)\b|تغيير|تعديل|الموعد الجديد|تم تغيير|اتغير/i.test(t) ? "changed" : "confirmed";
  const code = codeIn(t);
  // the flight number: the booking code is taken out first ("PNR: TA6898" is not a flight); the one after "flight" / «رحلة» first
  const tf = code ? t.split(code).join(" ") : t, FN = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b(?![:/])/;
  const afterWord = /(?:flight|flt|رحلتك|رحلة|الرحلة)\s*(?:no\.?|number|رقم)?\s*[:#]?\s*/i.exec(tf);
  const fno = (afterWord && FN.exec(tf.slice(afterWord.index + afterWord[0].length, afterWord.index + afterWord[0].length + 12)) && (() => { const m = FN.exec(tf.slice(afterWord.index + afterWord[0].length)); m.index += afterWord.index + afterWord[0].length; return m; })()) || FN.exec(tf.replace(/\b(PNR|REF|CODE)\b/gi, ""));
  const airline = AIRLINE_NAMES.find((n) => new RegExp("\\b" + n.replace(/ /g, "\\s+") + "\\b", "i").test(t)) || (Object.entries(AIRLINE_AR).find(([a]) => raw.includes(a)) || [])[1] || "";
  const isFlight = (fno && /\b(flight|flt|depart|departure|boarding|gate|airport|seat)\b|رحلة|رحلتك|الرحلة|طيران|مغادرة|الإقلاع|اقلاع|المطار/i.test(t)) || (airline && fno);
  const tc = code ? t.split(code).join(" ") : t, ds = dates(tc, now), tm = times(tc);   // (never a date out of the booking code: "GX3MAR")
  // v9.9.29 (Ali's screenshot: a Telegram news line «… قاعدة عسكرية خشبية …» became "I found a stay · 11 nights"): "night / ليلة /
  // stay / طيران" are everyday words. A stay needs a hotel / booking word AND a date or a booking code; a flight needs a date or a code.
  const mine = !!code || /\b(check-?in|check-?out|your (?:reservation|booking|stay|flight|trip|e-?ticket)|e-?ticket|boarding pass|itinerary|(?:reservation|booking) (?:is )?confirmed|confirmation (?:code|number|no))\b|تسجيل الدخول|تسجيل الوصول|حجزك|رحلتك|تذكرتك|تم تأكيد|تم الحجز|تأكيد الحجز|تاكيد الحجز|بطاقة الصعود/i.test(t);
  const promo = !code && /\b(off|discount|deals?|sale|save|offers?|promo|from only|starting from|book now)\b|%|خصم|عروض|عرض|تخفيض|احجز الآن|احجز الان/i.test(t);
  const isStay = mine && !promo && (!!code || ds.length > 0) && /\b(check-?in|check-?out|hotel|booking\.com|airbnb|agoda|nights?|stay|reservation at)\b|فندق|الفندق|تسجيل الدخول|تسجيل الوصول|ليالي|ليلة|إقامة|اقامة|حجزك في/i.test(t);
  if (isFlight && mine && !promo && (code || ds.length)) {
    let codes = [...t.matchAll(IATA)].map((m) => m[1]);
    // (cities in the order they are written: «من جدة إلى القاهرة» = JED → CAI)
    if (codes.length < 2) codes = [...codes, ...Object.entries(CITY).map(([c, i]) => { const m = new RegExp("(?<![\\p{L}])" + c + "(?![\\p{L}])", "iu").exec(raw.toLowerCase()); return m ? [m.index, i] : null; }).filter(Boolean).sort((x, y) => x[0] - y[0]).map((x) => x[1])];
    codes = codes.filter((c, i) => codes.indexOf(c) === i);
    // the date and time nearest AFTER the flight number (a change message prints the new time; "was" times come with "was / instead of")
    const at = fno.index;
    const newSide = status === "changed" ? (/\b(new (?:time|date|departure)|now (?:departs|at)|rescheduled to)\b|الموعد الجديد|الجديد/i.exec(t) || { index: at }).index : at;
    const d = ds.find((x) => x.at >= newSide - 40) || ds[0] || null, h = tm.find((x) => x.at >= (d ? d.at : newSide) - 20) || tm[0] || null;
    return { kind: "flight", status, code, airline, no: fno[1].toUpperCase() + fno[2], from: codes[0] || "", to: codes[1] || "", date: d ? d.iso : "", time: h ? h.hm : "", src: raw.slice(0, 300),
      sure: { no: true, date: !!d, time: !!h, code: !!code, route: codes.length >= 2 } };
  }
  if (isStay) {
    const nm = /(?:at|in|hotel|فندق|في)\s+([A-Z؀-ۿ][\w؀-ۿ'&.\- ]{2,40}?)(?=\s*(?:[,.\n]|\b(?:is|has|was|from|check|for)\b|\d|من|يوم|لمدة|تم|$))/u.exec(raw);
    const ci = ds[0] || null, co = ds[1] || null;
    let nights = (/(\d+)\s*(?:nights?|ليالي|ليلة|ليال)/i.exec(t) || [])[1]; nights = nights ? +nights : ci && co ? Math.round((Date.parse(co.iso) - Date.parse(ci.iso)) / 864e5) : 0;
    let checkout = co ? co.iso : ""; if (!checkout && ci && nights) { const x = new Date(ci.iso + "T12:00:00"); x.setDate(x.getDate() + nights); checkout = x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); }
    return { kind: "stay", status, code, name: nm ? nm[1].trim() : "", checkin: ci ? ci.iso : "", checkout, nights, src: raw.slice(0, 300), sure: { dates: !!ci && !!checkout, code: !!code, name: !!nm } };
  }
  // only the code and the word "cancelled" ("Your booking K7QX2P has been cancelled") → cancels whatever has that code
  if (status === "cancelled" && /\b(booking|reservation|pnr|ref(?:erence)?)\b|حجز|الحجز/i.test(t)) { const c = code || ((/\b([A-Z0-9]{6})\b/.exec(t.replace(/\b(PNR|REF|CODE)\b/g, "")) || [])[1] || ""); if (c && /[A-Z]/.test(c)) return { kind: "any", status, code: c, src: raw.slice(0, 300), sure: { code: true } }; }
  return null;
}
/** Apply a booking the person OK'd to the trip's list: a change replaces the one with the same code (or the same flight number and day),
 *  a cancellation removes it, a new one is added once. → { items, did: "added" | "replaced" | "removed" | "same" | "nothing" } */
export function applyBooking(items = [], b) {
  const same = (x) => b.kind === "any" ? !!b.code && x.code === b.code : x.kind === b.kind && ((b.code && x.code === b.code && (b.kind !== "flight" || x.no === b.no)) || (b.kind === "flight" && x.no === b.no && (x.date === b.date || b.status !== "confirmed")));
  const i = items.findIndex(same);
  if (b.status === "cancelled") return i >= 0 ? { items: items.filter((_, k) => k !== i), did: "removed" } : { items, did: "nothing" };
  const clean = { ...b }; delete clean.status; delete clean.src;
  if (i >= 0) { const was = items[i]; if (Object.entries(clean).every(([k, v]) => k === "sure" || v === "" || v == null || JSON.stringify(was[k]) === JSON.stringify(v))) return { items, did: "same" };
    // a change message often says only the new time — what it doesn't say (the route, the airline, the hotel's name) stays as it was
    const kept = { ...was }; for (const [k, v] of Object.entries(clean)) if (v !== "" && v != null && !(k === "sure")) kept[k] = v;
    kept.sure = { ...(was.sure || {}), ...Object.fromEntries(Object.entries(clean.sure || {}).filter(([, v]) => v)) };
    return { items: items.map((x, k) => (k === i ? kept : x)), did: "replaced" }; }
  return { items: [...items, { ...clean, id: "b" + Math.random().toString(36).slice(2, 9) }], did: "added" };
}

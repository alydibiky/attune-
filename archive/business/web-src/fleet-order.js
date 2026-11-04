/* ---- v6.37 (Ali picked "do them all", upgrade W1): a client's WhatsApp message → a booked job.
   «محتاج ونش 50 طن السبت في 6 أكتوبر يومين» / "need a 100 ton crane from 25/10 for 3 days at New Capital" →
   what is asked (tons, start, days or hours, site), the cranes that can do it and are FREE those days (smallest that fits
   first), the price from each crane's own rate, a quote message (Egyptian Arabic or English) and a printable quote.
   All by code — no model. Booking goes through fleet.js addJob, so every Fleet rule still holds (a crane at another site
   must be moved first). Tests: tests/unit/v740fleetorder.test.mjs.                                                         */
import { isoDay, addDays, showDate, r2 } from "./fleet.js";

const AR_DIGITS = /[٠-٩]/g;
const latin = (t) => String(t || "").replace(AR_DIGITS, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[إأآ]/g, "ا").replace(/ى/g, "ي");
const WEEK = [   // JS getDay(): 0 = Sunday
  [0, /(?:يوم\s+)?(?:ال)?(?:حد|احد)(?![\p{L}])|\bsun(?:day)?\b/iu], [1, /(?:ال)?(?:اتنين|اثنين)(?![\p{L}])|\bmon(?:day)?\b/iu],
  [2, /(?:ال)?(?:تلات|ثلاثاء|تلاتاء)(?![\p{L}])|\btue(?:s|sday)?\b/iu], [3, /(?:ال)?(?:اربع|اربعاء)(?![\p{L}])|\bwed(?:nesday)?\b/iu],
  [4, /(?:ال)?خميس(?![\p{L}])|\bthu(?:rs|rsday)?\b/iu], [5, /(?:ال)?جمع[هة](?![\p{L}])|\bfri(?:day)?\b/iu], [6, /(?:ال)?سبت(?![\p{L}])|\bsat(?:urday)?\b/iu],
];
const MONTHS = [["يناير|jan(?:uary)?", 1], ["فبراير|feb(?:ruary)?", 2], ["مارس|mar(?:ch)?", 3], ["ابريل|apr(?:il)?", 4], ["مايو|may", 5], ["يونيو|jun(?:e)?", 6],
  ["يوليو|jul(?:y)?", 7], ["اغسطس|aug(?:ust)?", 8], ["سبتمبر|sep(?:t|tember)?", 9], ["اكتوبر|oct(?:ober)?", 10], ["نوفمبر|nov(?:ember)?", 11], ["ديسمبر|dec(?:ember)?", 12]];
const MONTH_RX = MONTHS.map((m) => m[0]).join("|");
const monthOf = (w) => (MONTHS.find(([rx]) => new RegExp("^(?:" + rx + ")$", "i").test(w)) || [, 0])[1];
const NUMW = { "واحد": 1, "يوم": 1, "يومين": 2, "اتنين": 2, "تلات": 3, "تلاته": 3, "تلاتة": 3, "ثلاث": 3, "اربع": 4, "اربعه": 4, "اربعة": 4, "خمس": 5, "خمسه": 5, "خمسة": 5, "ست": 6, "سته": 6, "ستة": 6, "سبع": 7, "سبعه": 7, "سبعة": 7, "عشر": 10, "عشره": 10, "عشرة": 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
const nOf = (w) => (/^\d+$/.test(w) ? +w : NUMW[w] || 0);

/** The 6th of October city (مدينة 6 أكتوبر) — said as «في 6 أكتوبر», «6 اكتوبر», «اكتوبر». A place, not a date, when the
    message has another date, says «مدينة», or a site of that name exists. */
const OCT_CITY = /(?:مدينه|مدينة)?\s*(?:في|فى|ب)?\s*(?:ال)?6\s*اكتوبر|6th of october|6 october city|october city/i;

/** The order in the message → { tons, start, days, hours, mode, siteText, dates: how the start was read } */
export function readOrder(text, { today = isoDay(), sites = [] } = {}) {
  const raw = String(text || ""), t = latin(raw).toLowerCase();
  const tons = (() => { const m = t.match(/(\d{2,4})\s*(?:طن|tons?|t\b|ton\b)/i) || t.match(/(?:ونش|كرين|crane)\s*(\d{2,4})\b/i); return m ? +m[1] : 0; })();
  // the 6th of October city: kept as the site, and blanked out so it is not read as a date
  let siteHint = "", t2 = t;
  const oct = t.match(OCT_CITY), hasOtherDate = WEEK.some(([, rx]) => rx.test(t)) || /بكره|بكرة|بعد بكره|النهارده|tomorrow|today|\d{1,2}\s*[/.-]\s*\d{1,2}/.test(t) || new RegExp("\\b\\d{1,2}\\s*(?:" + MONTH_RX.replace("اكتوبر|oct(?:ober)?|", "") + ")", "i").test(t);
  if (oct && (/مدين|city/.test(oct[0]) || hasOtherDate || sites.some((s) => /اكتوبر|october/i.test(latin(s.name || s))))) { siteHint = "6th of October"; t2 = t.replace(oct[0], " "); }
  // the start day
  let start = "", how = "";
  const tod = new Date(today + "T12:00:00");
  const dm = t2.match(/(?:من|from|يوم|on)?\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?/);
  const dmw = t2.match(new RegExp("(\\d{1,2})\\s*(" + MONTH_RX + ")|(" + MONTH_RX + ")\\s*(\\d{1,2})(?!\\d)", "i"));
  if (dm && +dm[2] >= 1 && +dm[2] <= 12 && +dm[1] >= 1 && +dm[1] <= 31) {
    let y = dm[3] ? (+dm[3] < 100 ? 2000 + +dm[3] : +dm[3]) : tod.getFullYear();
    let d = `${y}-${String(+dm[2]).padStart(2, "0")}-${String(+dm[1]).padStart(2, "0")}`;
    if (!dm[3] && d < today) d = `${y + 1}${d.slice(4)}`;
    start = d; how = "date";
  } else if (dmw) {
    const day = +(dmw[1] || dmw[4]), mon = monthOf(dmw[2] || dmw[3]);
    let d = `${tod.getFullYear()}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (d < today) d = `${tod.getFullYear() + 1}${d.slice(4)}`;
    start = d; how = "date";
  } else if (/بعد بكره|بعد بكرة|day after tomorrow/.test(t2)) { start = addDays(today, 2); how = "relative"; }
  else if (/بكره|بكرة|tomorrow/.test(t2)) { start = addDays(today, 1); how = "relative"; }
  else if (/النهارده|النهاردة|today/.test(t2)) { start = today; how = "relative"; }
  else {
    const w = WEEK.find(([, rx]) => rx.test(t2));
    if (w) { const diff = (w[0] - tod.getDay() + 7) % 7 || 7; start = addDays(today, /الجاي|الجاية|next/.test(t2) && diff < 7 && diff <= 2 ? diff + 7 : diff); how = "weekday"; }
  }
  // how long: hours → priced by the hour; days / a week / a month → by the day
  let hours = 0, days = 0;
  const hm = t2.match(/(\d{1,2})\s*(?:ساعه|ساعة|ساعات|hours?|hrs?|h\b)/);
  if (hm) hours = +hm[1];
  else if (/(?:^|\s)(?:نص|نصف) يوم|half a day/.test(t2)) hours = 4;
  const dd = t2.match(/(\d{1,3}|[\p{L}]+)\s*(?:ايام|أيام|يوم|days?)(?![\p{L}])/u), two = /يومين|two days|2 days/.test(t2);
  if (two) days = 2;
  else if (dd && nOf(dd[1]) > 1) days = nOf(dd[1]);
  else if (/اسبوعين|two weeks/.test(t2)) days = 14;
  else if (/اسبوع|week/.test(t2)) days = 7;
  else if (/شهرين|two months/.test(t2)) days = 60;
  else if (/شهر|month/.test(t2)) days = 30;
  // a range «من 25/10 ل 28/10»
  const rg = t2.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*(?:-|–|ل|الى|إلى|لحد|to|till|until)\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})/);
  if (rg && start) { const y = start.slice(0, 4); let end = `${y}-${String(+rg[4]).padStart(2, "0")}-${String(+rg[3]).padStart(2, "0")}`; if (end < start) end = `${+y + 1}${end.slice(4)}`; days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1; }
  if (!hours && !days) days = 1;
  // where: a known site named in the message, else the words after «في / at / in / موقع»
  let siteText = siteHint;
  const known = sites.find((s) => { const n = latin(s.name || s).toLowerCase().replace(/^\[demo\]\s*/, ""); return n.length >= 3 && t.includes(n); });
  if (known) siteText = known.name || known;
  // (\b doesn't see Arabic letters, so «في» is matched after a space)
  if (!siteText) { const m = raw.match(/(?:(?:^|\s)(?:في|فى)|\bat\b|\bin\b|موقع|location)\s+([^\n,.،؛;]{3,40})/i); if (m) siteText = m[1].replace(/\s+(?:يوم|من|لمدة|for|from|on|بكره|بكرة|السبت|الحد|الاتنين|التلات|الاربع|الخميس|الجمعه|الجمعة|\d)(?:\s|$).*$/i, "").trim(); }
  return { tons, start, how, days: hours ? 0 : days, hours, mode: hours ? "hourly" : "daily", siteText };
}

const live = (a) => (a || []).filter((x) => !x.del);
/** The cranes that can do it (enough tons) and are free from start for the days asked: [{ crane, price, busy, where }],
    the smallest crane that fits first; busy ones last, with the job they're on. */
export function cranesFor(s, order) {
  const from = order.start || isoDay(), to = order.days > 1 ? addDays(from, order.days - 1) : from;
  return live(s.cranes).filter((c) => !order.tons || (+c.tons || 0) >= order.tons).map((c) => {
    const job = live(s.jobs).find((j) => j.crane === c.id && j.status === "active" && j.start <= to && (!j.end || j.end >= from));
    const rate = order.mode === "hourly" ? +c.hourly || 0 : +c.daily || 0, qty = order.mode === "hourly" ? order.hours : order.days;
    return { crane: c, rate, qty, price: r2(rate * qty), busy: job || null };
  }).sort((a, b) => (!!a.busy - !!b.busy) || ((+a.crane.tons || 0) - (+b.crane.tons || 0)) || a.price - b.price);
}

/** The reply to send the client. */
export function quoteText(order, pick, { lang = "ar", currency = "EGP", site = "" } = {}) {
  const c = pick.crane, n = (x) => (+x).toLocaleString("en-US", { maximumFractionDigits: 2 }), when = order.start ? showDate(order.start) : "";
  let where = site || order.siteText;
  if (lang === "ar") {
    if (where === "6th of October") where = "6 أكتوبر";
    const qty = order.mode === "hourly" ? `${order.hours} ساعة` : order.days === 1 ? "يوم" : order.days === 2 ? "يومين" : `${order.days} أيام`;
    return `أهلًا يا فندم 👋\nمتاح ${c.name} (${c.tons} طن)${when ? ` من يوم ${when}` : ""}${where ? ` في ${where}` : ""} لمدة ${qty}.\nالسعر: ${n(pick.rate)} ${currency} ${order.mode === "hourly" ? "في الساعة" : "في اليوم"} × ${order.mode === "hourly" ? order.hours : order.days} = ${n(pick.price)} ${currency}.\nلو تمام ابعتلي تأكيد ونحجزلك على طول.`;
  }
  const qty = order.mode === "hourly" ? `${order.hours} hours` : order.days === 1 ? "1 day" : `${order.days} days`;
  return `Hello,\n${c.name} (${c.tons} t) is available${when ? ` from ${when}` : ""}${where ? ` at ${where}` : ""} for ${qty}.\nPrice: ${n(pick.rate)} ${currency} ${order.mode === "hourly" ? "per hour" : "per day"} × ${order.mode === "hourly" ? order.hours : order.days} = ${n(pick.price)} ${currency}.\nReply to confirm and we will book it.`;
}

/** A printable quote (same look as the Fleet statement). */
export function quoteHTML(order, pick, { client = "", company = "", currency = "EGP", rtl = false, no = "" } = {}) {
  const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const fmt = (v) => (+v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const L = rtl ? { t: "عرض سعر", to: "إلى", crane: "الونش", site: "الموقع", from: "من", qty: "المدة", rate: "السعر", total: "الإجمالي", day: "يوم", hour: "ساعة", valid: "العرض سارٍ لمدة 7 أيام." }
    : { t: "Quotation", to: "To", crane: "Crane", site: "Site", from: "From", qty: "Duration", rate: "Rate", total: "Total", day: "day(s)", hour: "hour(s)", valid: "Valid for 7 days." };
  const qty = order.mode === "hourly" ? `${order.hours} ${L.hour}` : `${order.days} ${L.day}`;
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${L.t}${no ? " " + esc(no) : ""}</title><style>body{font:14px system-ui,Segoe UI,Tahoma,sans-serif;margin:32px;color:#0F172A}h1{font-size:20px;margin:0 0 4px}.m{color:#475569;margin:2px 0}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border-bottom:1px solid #CBD5E1;padding:6px 8px;text-align:start}.n{text-align:end;font-variant-numeric:tabular-nums}tfoot th{border-top:2px solid #0F172A}</style></head><body>
<p class="m">${esc(company)}</p><h1>${L.t}${no ? " " + esc(no) : ""}</h1><p class="m">${showDate(isoDay())}${client ? ` · ${L.to}: ${esc(client)}` : ""}</p>
<table><thead><tr><th>${L.crane}</th><th>${L.site}</th><th>${L.from}</th><th>${L.qty}</th><th class="n">${L.rate}</th><th class="n">${L.total}</th></tr></thead><tbody>
<tr><td>${esc(pick.crane.name)} (${esc(pick.crane.tons)} t)</td><td>${esc(order.siteText)}</td><td>${showDate(order.start)}</td><td>${qty}</td><td class="n">${fmt(pick.rate)}</td><td class="n">${fmt(pick.price)}</td></tr>
</tbody><tfoot><tr><th colspan="5">${L.total}</th><th class="n">${fmt(pick.price)} ${esc(currency)}</th></tr></tfoot></table><p class="m">${L.valid}</p></body></html>`;
}

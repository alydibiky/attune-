/* ---- v6.32: the Overpaying check — "find where I'm overpaying" (Ali, 17 Oct 2026: like Gemini's Gmail scan, but better) -------
   Gemini reads 12 months of Gmail in the cloud and writes a list once a month. Attune does it ON THE PHONE, by code, from
   everything it already has, and keeps it live:
     payments        Money's ledger (logged by itself from bank notifications)                 → charges
     notifications   the money notifications the phone kept (PayListener)                      → charges, trials, price notices, perks
     emails          a Gmail export (Google Takeout .mbox, read here, never uploaded) or a pasted email   → the same, with a Gmail link
     radar           Deadline Radar's trials and renewals
   and finds, per subscription (monthly, quarterly or yearly):
     trial      a free trial that turns paid soon                → days left, what it will cost
     hike       a price rise (two charges, or a "new price" email) → old → new, %, the extra per year
     overlap    two or more services doing the same job (3 AI apps, 2 video apps)     → keep one: what the others cost a year
     renewal    a yearly / quarterly renewal coming up           → the date, to cancel or check before it renews
     perk       points, vouchers, lounge passes, free months nobody used               → claim it before it expires
   The totals: what you pay a month (per currency — no guessed exchange rates), and how much a year is at stake.
   Each finding keeps its SOURCE (an email → a Gmail link; a notification → its text; a payment → its Money entry).
   Monthly: a snapshot per month ("+7% since last month") and a reminder on the 1st (Reminders "monthly").
   Pure logic; store "attune:overpay:v1" = { emails: [...], snaps: {YYYY-MM: {...}}, done: [ids], monthly: bool }.
   Tests: tests/unit/v732overpay.test.mjs.                                                                                      */
import { merchantOf, SUBS } from "./guardian.js";
import { readDeadlines, isoDay, datesIn } from "./deadlines.js";

const DAY = 86400000;
const r2 = (n) => Math.round(n * 100) / 100;
const titleCase = (s) => String(s || "").replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

// ---- what a service is ----------------------------------------------------------------------------------------------------------
/** Services by name (the longest first, so "YouTube Music" is not "YouTube"). The name shown is the first spelling. */
const SERVICES = [
  ["Google AI Pro", /google ai (?:pro|ultra|premium)|gemini advanced|ai premium/i], ["Google One", /google one|google storage/i],
  ["ChatGPT", /chatgpt|openai/i], ["Claude", /claude|anthropic/i], ["Copilot", /copilot/i], ["Perplexity", /perplexity/i], ["Midjourney", /midjourney/i],
  ["YouTube Music", /youtube music/i], ["YouTube Premium", /youtube premium/i], ["Netflix", /netflix|نتفليكس/i], ["Shahid", /shahid|شاهد/i],
  ["OSN+", /osn/i], ["Watch It", /watch ?it/i], ["Disney+", /disney/i], ["HBO Max", /hbo/i], ["Prime Video", /prime video/i], ["Amazon Prime", /amazon prime/i],
  ["StarzPlay", /starz ?play/i], ["Apple TV+", /apple tv/i], ["Apple Music", /apple music/i], ["Apple One", /apple one/i], ["iCloud+", /icloud/i],
  ["Spotify", /spotify/i], ["Anghami", /anghami|انغامي|أنغامي/i], ["Deezer", /deezer/i], ["Microsoft 365", /microsoft 365|office 365|m365|email essentials/i],
  ["Dropbox", /dropbox/i], ["OneDrive", /onedrive/i], ["Canva", /canva/i], ["Adobe", /adobe/i], ["Notion", /notion/i], ["Duolingo", /duolingo/i],
  ["LinkedIn Premium", /linkedin/i], ["NordVPN", /nordvpn/i], ["ExpressVPN", /expressvpn/i], ["Surfshark", /surfshark/i],
  ["Talabat Pro", /talabat pro/i], ["Uber One", /uber one/i], ["Careem Plus", /careem plus/i], ["Xbox Game Pass", /game ?pass|xbox/i], ["PlayStation Plus", /ps plus|playstation plus/i],
  ["GoDaddy", /godaddy/i], ["Namecheap", /namecheap/i],
];
export function serviceOf(text) { const t = String(text || ""); for (const [name, re] of SERVICES) if (re.test(t)) return name; return ""; }

/** Services that do the same job. A service can be in two groups (Google AI Pro is AI and cloud storage). */
export const GROUPS = [
  ["ai", "AI assistants", /chatgpt|claude|copilot|perplexity|google ai pro|midjourney/i],
  ["video", "Video streaming", /netflix|shahid|osn|watch it|disney|hbo|prime video|starzplay|apple tv|youtube premium/i],
  ["music", "Music", /spotify|anghami|deezer|apple music|youtube music|youtube premium/i],
  ["cloud", "Cloud storage", /google one|google ai pro|icloud|dropbox|onedrive|microsoft 365|apple one/i],
  ["vpn", "VPN", /vpn|surfshark/i],
  ["delivery", "Delivery passes", /talabat pro|uber one|careem plus|amazon prime/i],
];
export const groupsOf = (name) => GROUPS.filter(([, , re]) => re.test(name)).map(([k]) => k);

// ---- money in a text ------------------------------------------------------------------------------------------------------------
const CUR = [["EGP", /egp|le\b|l\.e\.?|ج\.?\s?م|جنيه/i], ["USD", /usd|us\$|\$/i], ["EUR", /eur|€/i], ["GBP", /gbp|£/i], ["SAR", /sar|ر\.?\s?س|ريال/i],
  ["AED", /aed|د\.?\s?إ|درهم/i], ["KWD", /kwd|د\.?\s?ك/i], ["QAR", /qar/i], ["TRY", /try|₺/i], ["INR", /inr|₹|rs\.?/i]];
const SYM = "(?:EGP|LE|L\\.E\\.?|ج\\.?\\s?م\\.?|جنيه|USD|US\\$|\\$|EUR|€|GBP|£|SAR|ر\\.?\\s?س|ريال|AED|درهم|KWD|QAR|TRY|₺|INR|₹)";
const NUM = "(\\d{1,3}(?:[,\\s]\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)";
const MONEY_RE = new RegExp(`${SYM}\\s?${NUM}|${NUM}\\s?${SYM}`, "giu");
const curOf = (s) => (CUR.find(([, re]) => re.test(s)) || [""])[0];
/** Every amount with a currency, in order: "from EGP 699.99 to EGP 939.99" → [{699.99, EGP}, {939.99, EGP}]. */
export function moneyIn(text) {
  const out = [];
  for (const m of String(text || "").matchAll(MONEY_RE)) {
    const n = Number((m[1] || m[2]).replace(/[,\s]/g, ""));
    if (n > 0 && n < 1e7) out.push({ amount: n, currency: curOf(m[0].replace(m[1] || m[2], "")), at: m.index });
  }
  return out;
}

// ---- reading one source (an email, a notification, a pasted text) -----------------------------------------------------------
const W = (words) => new RegExp("(?<![\\p{L}])(?:" + words + ")(?![\\p{L}])", "iu");
const CHARGE = W("receipt|invoice|order|payment (?:received|confirmation|successful)|you(?:'ve| have)? paid|charged|billed|renewed|has been renewed|renewal (?:receipt|confirmation)|subscription (?:confirmed|renewed)|thanks for your (?:purchase|payment)|إيصال|فاتورة|تم الدفع|تم خصم|تم تجديد|تم التجديد");
const HIKE = W("price (?:increase|change|update)|prices? (?:is|are|will be) (?:going up|increasing|changing)|new price|will (?:increase|go up|rise)|increas(?:e|ing) (?:the|your) (?:price|subscription)|raising (?:the|our) price|زيادة (?:في )?(?:السعر|الأسعار|سعر)|السعر الجديد|سعر جديد|تغيير (?:في )?السعر");
const PERK = W("points?|voucher|coupon|gift card|reward|rewards|cashback|cash back|lounge|complimentary|perk|perks|free month|unclaimed|redeem|benefits?|قسيمة|كوبون|نقاط|نقطة|مكافأة|مكافآت|هدية|استرداد نقدي|ميزة|مزايا");
const PERK_NOISE = W("verification|password|sign in|security alert|otp|newsletter|unsubscribe from (?:this|these) promotions only");
const YEARLY = W("year|yearly|annual|annually|/yr|per year|12 months|سنة|سنوي|سنويا|سنويًا");
const QUARTER = W("quarter|quarterly|3 months|ربع سنوي");
const MONTHLY = W("month|monthly|/mo|per month|شهر|شهري|شهريا|شهريًا");

/** A source {id, kind: email|notification|paste, title, text, at, link, from} → the events in it:
 *  charge {service, amount, currency, cadence?} · trial {service, date, amount?} · renewal {service, date, amount?}
 *  · hike {service, from, to, currency} · perk {service, what, value?, currency?, expires?}. Every event keeps `src`. */
export function readSource(s, { now = Date.now() } = {}) {
  const text = [s.title, s.text].filter(Boolean).join(" — "), out = [];
  if (!text.trim()) return out;
  const service = serviceOf(text) || serviceOf(s.from) || titleCase(merchantOf(String(s.from || "").replace(/<.*>|".*?"|@.*/g, "") || s.title || ""));
  const money = moneyIn(text), src = { id: s.id, kind: s.kind, at: s.at || now, title: s.title || "", link: s.link || "", app: s.app || "", text: text.slice(0, 400) };
  const cadence = YEARLY.test(text) ? "year" : QUARTER.test(text) ? "quarter" : MONTHLY.test(text) ? "month" : "";
  // price rise: two amounts, the second bigger, in the same currency
  if (HIKE.test(text) && money.length >= 2) {
    const [a, b] = money.length > 2 ? money.slice(-2) : money;
    if (b.amount > a.amount && (a.currency === b.currency || !a.currency || !b.currency))
      out.push({ type: "hike", service, from: a.amount, to: b.amount, currency: b.currency || a.currency, cadence: cadence || "month", src });
  }
  // trials and renewals: Deadline Radar's reader (dates, "7-day trial", "renews on")
  for (const d of readDeadlines(text, { now: s.at || now, base: s.at || now })) {
    if (d.confidence === "low" || (d.kind !== "trial" && d.kind !== "renewal")) continue;
    const m = money[0];
    out.push({ type: d.kind, service: serviceOf(d.title) || service, date: d.date, amount: m ? m.amount : 0, currency: m ? m.currency : "", cadence, src });
  }
  // a charge: a receipt / renewal receipt / invoice with an amount (a trial notice is not a charge)
  if (CHARGE.test(text) && money.length && !out.some((e) => e.type === "trial" || e.type === "hike")) {
    const m = money.reduce((a, x) => (x.amount > a.amount ? x : a), money[0]);   // the total is the biggest amount
    out.push({ type: "charge", service, amount: m.amount, currency: m.currency, cadence, date: isoDay(s.at || now), src });
  }
  // a perk nobody used: points, a voucher, a free month, lounge passes
  if (PERK.test(text) && !PERK_NOISE.test(text) && !out.some((e) => e.type === "charge" || e.type === "hike")) {
    const m = money[0], exp = readDeadlines(text, { now: s.at || now, base: s.at || now }).find((d) => d.kind === "expiry" || d.kind === "other")
      || datesIn(text, { now }).filter((d) => d.t > now).sort((x, y) => x.t - y.t).map((d) => ({ date: isoDay(d.t) }))[0];
    const pts = text.match(/(\d[\d,]*)\s*(?:points|pts|نقطة|نقاط)/i);
    out.push({ type: "perk", service, what: s.title || text.slice(0, 80), value: m ? m.amount : 0, currency: m ? m.currency : "", points: pts ? Number(pts[1].replace(/,/g, "")) : 0,
      expires: exp && exp.date >= isoDay(now) ? exp.date : "", src });
  }
  return out;
}

// ---- Gmail export (Google Takeout → Mail → .mbox), read on the phone -------------------------------------------------------------
const decodeQP = (s) => { const bytes = []; const t = s.replace(/=\r?\n/g, ""); for (let i = 0; i < t.length; i++) { if (t[i] === "=" && /^[0-9A-F]{2}$/i.test(t.slice(i + 1, i + 3))) { bytes.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2; } else { const c = t.charCodeAt(i); if (c < 128) bytes.push(c); else for (const b of new TextEncoder().encode(t[i])) bytes.push(b); } } return new TextDecoder().decode(new Uint8Array(bytes)); };
const decodeB64 = (s) => { try { const bin = atob(s.replace(/\s+/g, "")); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); } catch (e) { return ""; } };
/** "=?UTF-8?B?…?=" / "=?utf-8?Q?…?=" in a header → text. */
export const decodeWords = (h) => String(h || "").replace(/\?=\s+=\?/g, "?==?").replace(/=\?[^?]+\?([BQ])\?([^?]*)\?=/gi, (m, e, t) => (e.toUpperCase() === "B" ? decodeB64(t) : decodeQP(t.replace(/_/g, " "))));
const htmlText = (h) => String(h || "").replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
function headers(block) {
  const h = {}, lines = block.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/);
  for (const l of lines) { const i = l.indexOf(":"); if (i > 0) { const k = l.slice(0, i).trim().toLowerCase(); if (!(k in h)) h[k] = l.slice(i + 1).trim(); } }
  return h;
}
function bodyOf(h, body) {
  const ct = h["content-type"] || "text/plain", enc = (h["content-transfer-encoding"] || "").toLowerCase();
  const bnd = ct.match(/boundary="?([^";]+)"?/i);
  if (/multipart\//i.test(ct) && bnd) {
    const parts = body.split("--" + bnd[1]).slice(1).filter((p) => !p.startsWith("--"));
    let html = "";
    for (const p of parts) {
      const cut = p.search(/\r?\n\r?\n/); if (cut < 0) continue;
      const ph = headers(p.slice(0, cut)), pb = p.slice(cut).replace(/^\s+/, "");
      const t = bodyOf(ph, pb);
      if (/text\/plain/i.test(ph["content-type"] || "text/plain") && !/multipart/i.test(ph["content-type"] || "") && t.trim()) return t;
      if (!html && t.trim()) html = t;
    }
    return html;
  }
  const raw = enc === "base64" ? decodeB64(body) : enc === "quoted-printable" ? decodeQP(body) : body;
  return /text\/html/i.test(ct) ? htmlText(raw) : raw;
}
/** A Gmail link to the message: by its thread id (X-GM-THRID, in every Takeout export), else by its Message-ID. */
export const gmailLink = (h) => (h["x-gm-thrid"] ? "https://mail.google.com/mail/#all/thread-f:" + h["x-gm-thrid"].trim()
  : h["message-id"] ? "https://mail.google.com/mail/#search/rfc822msgid:" + encodeURIComponent(h["message-id"].replace(/[<>]/g, "")) : "");
/** One message of an mbox → { id, kind: "email", from, title, text, at, link }. */
export function readEmail(raw) {
  const cut = raw.search(/\r?\n\r?\n/); if (cut < 0) return null;
  const h = headers(raw.slice(0, cut).replace(/^From .*\r?\n/, "")), at = Date.parse(h.date || "") || 0;
  const text = bodyOf(h, raw.slice(cut).replace(/^\s+/, "")).replace(/\s+/g, " ").trim().slice(0, 3000);
  return { id: (h["message-id"] || h["x-gm-thrid"] || String(at) + (h.subject || "")).trim(), kind: "email", from: decodeWords(h.from || ""), title: decodeWords(h.subject || ""), text, at, link: gmailLink(h) };
}
// only the messages worth reading (the rest of the inbox is skipped without decoding its body)
const MONEY_HINT = /receipt|invoice|order|subscription|renew|trial|price|payment|billing|charged|points|voucher|reward|perk|lounge|membership|plan|إيصال|فاتورة|اشتراك|تجديد|تجريبية|السعر|دفع|نقاط|قسيمة|مكافأة|عضوية/i;
/** Part of an mbox file → { emails, rest } (rest = an unfinished last message, to prepend to the next part).
 *  Reads only messages newer than `since` whose subject or sender looks like money. */
export function readMbox(chunk, { since = 0, final = false } = {}) {
  const parts = String(chunk).split(/\r?\n(?=From \S+ .{10,40}\d{4}(?:\r?\n|$))/), rest = final ? "" : parts.pop(), emails = [];
  for (const p of parts) {
    const head = p.slice(0, Math.min(p.length, 6000));
    const subj = (head.match(/\nSubject:(.*)/i) || [])[1] || "", from = (head.match(/\nFrom:(.*)/i) || [])[1] || "", lab = (head.match(/\nX-Gmail-Labels:(.*)/i) || [])[1] || "";
    if (!MONEY_HINT.test(decodeWords(subj) + " " + from + " " + lab)) continue;
    const e = readEmail(p); if (e && e.at >= since) emails.push(e);
  }
  return { emails, rest };
}

// ---- putting it all together -----------------------------------------------------------------------------------------------------
const MONTHS = { month: 1, quarter: 3, year: 12 };
const CAD_DAYS = { month: 30, quarter: 91, year: 365 };
const addDays = (date, n) => isoDay(Date.parse(date + "T12:00:00") + n * DAY);
const daysTo = (date, now) => Math.round((Date.parse(date + "T12:00:00") - Date.parse(isoDay(now) + "T12:00:00")) / DAY);
const cadenceOf = (dates) => {
  if (dates.length < 2) return "";
  const gaps = dates.slice(1).map((d, i) => (Date.parse(d) - Date.parse(dates[i])) / DAY).sort((a, b) => a - b), g = gaps[Math.floor(gaps.length / 2)];
  return g >= 25 && g <= 35 ? "month" : g >= 80 && g <= 100 ? "quarter" : g >= 340 && g <= 390 ? "year" : "";
};

/** Everything → the check. ledger = Money's ledger; notes = the phone's money notifications; emails = read emails / pasted
 *  texts; radar = Deadline Radar's data. → { subs, trials, hikes, overlaps, renewals, perks, now: [act now], perMonth, atStake, count } */
export function overpayCheck({ ledger, notes = [], emails = [], radar, now = Date.now(), done = [], home = "" } = {}) {
  const skip = new Set(done), since = now - 366 * DAY, cur0 = home || (ledger && ledger.currency) || "";
  const ev = [];
  for (const n of notes || []) if ((n.ts || 0) >= since) ev.push(...readSource({ id: n.id, kind: "notification", title: n.title, text: n.text, at: n.ts, app: n.app }, { now }));
  for (const e of emails || []) if ((e.at || now) >= since) ev.push(...readSource(e, { now }));
  // Money's payments → charges of known services, or steady monthly payments to the same merchant
  for (const t of ((ledger && ledger.txns) || [])) {
    if (!t || t.type !== "expense" || !(t.amount > 0) || !t.date || Date.parse(t.date) < since) continue;
    const name = serviceOf(t.note) || (SUBS.test(t.note || "") ? titleCase(merchantOf(t.note)) : "");
    ev.push({ type: "charge", service: name, merchant: titleCase(merchantOf(t.note)), amount: t.amount, currency: t.currency || cur0, cadence: "", date: t.date,
      src: { id: t.id, kind: "payment", at: Date.parse(t.date + "T12:00:00"), title: t.note || "", text: t.note || "" } });
  }
  // charges by service (a merchant that is not a known service counts only when paid 3+ months with steady amounts)
  const by = new Map();
  for (const e of ev.filter((x) => x.type === "charge")) {
    const k = (e.service || e.merchant || "").toLowerCase(); if (!k) continue;
    const list = by.get(k) || by.set(k, []).get(k);
    if (!list.some((x) => Math.abs(x.amount - e.amount) < 0.01 && Math.abs(Date.parse(x.date) - Date.parse(e.date)) <= 3 * DAY)) list.push(e);   // the bank AND the email: once
  }
  const subs = [];
  for (const [k, list] of by) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const known = list.some((e) => e.service), last = list[list.length - 1], dates = list.map((e) => e.date);
    let cad = cadenceOf(dates) || last.cadence || list.find((e) => e.cadence)?.cadence || (known ? "month" : "");
    if (!known) {   // the same amount (±10%) every month — the last one may have gone up (a price rise)
      const before = list.slice(0, -1), base = before[0] ? before[0].amount : 0;
      const steady = list.length >= 3 && before.every((e) => Math.abs(e.amount - base) <= base * 0.1) && last.amount >= base * 0.9 && last.amount <= base * 1.5;
      if (!steady || cadenceOf(dates) !== "month") continue;
    }
    if (!cad) continue;
    const next = addDays(last.date, CAD_DAYS[cad]);
    if (daysTo(next, now) < -20) continue;   // stopped: no charge when the next one was due
    const name = last.service || last.merchant || titleCase(k), prev = list.length > 1 ? list[list.length - 2] : null;
    subs.push({ id: "sub:" + k, name, amount: last.amount, currency: last.currency || cur0, cadence: cad, perMonth: r2(last.amount / MONTHS[cad]), last: last.date, next,
      since: list[0].date, count: list.length, prev: prev && prev.currency === last.currency ? prev.amount : 0, groups: groupsOf(name), src: last.src, history: list.map((e) => ({ date: e.date, amount: e.amount, src: e.src })) });
  }
  const subOf = (name) => subs.find((s) => s.name.toLowerCase() === String(name || "").toLowerCase());

  // trials: from emails/notifications and Deadline Radar (still to come)
  const trials = [], seenT = new Set();
  const radarItems = ((radar && radar.items) || []).filter((x) => x.status !== "done");
  for (const t of [...ev.filter((e) => e.type === "trial"), ...radarItems.filter((x) => x.kind === "trial").map((x) => ({ service: serviceOf(x.title) || x.title, date: x.date, amount: x.amount || 0, currency: x.currency || "", src: { id: x.id, kind: "radar", at: x.created || now, title: x.title, text: x.note || "" } }))]) {
    const left = daysTo(t.date, now), key = (t.service || "").toLowerCase();
    if (left < 0 || seenT.has(key)) continue; seenT.add(key);
    trials.push({ id: "trial:" + key + ":" + t.date, kind: "trial", name: t.service || "A free trial", date: t.date, days: left, amount: t.amount, currency: t.currency || cur0, groups: groupsOf(t.service || ""), src: t.src });
  }
  // price rises: a "new price" message, else the last two charges
  const hikes = [], seenH = new Set();
  for (const h of ev.filter((e) => e.type === "hike").sort((a, b) => b.src.at - a.src.at)) {
    const key = (h.service || "").toLowerCase(); if (seenH.has(key)) continue; seenH.add(key);
    const s = subOf(h.service), cad = (s && s.cadence) || h.cadence;
    hikes.push({ id: "hike:" + key + ":" + h.to, kind: "hike", name: h.service, from: h.from, to: h.to, currency: h.currency || cur0, cadence: cad, pct: Math.round(((h.to - h.from) / h.from) * 1000) / 10, perYear: r2((h.to - h.from) * 12 / MONTHS[cad]), src: h.src, charged: s ? s.src : null });
  }
  for (const s of subs) if (s.prev && s.amount >= s.prev * 1.03 && !seenH.has(s.name.toLowerCase()))
    hikes.push({ id: "hike:" + s.name.toLowerCase() + ":" + s.amount, kind: "hike", name: s.name, from: s.prev, to: s.amount, currency: s.currency, cadence: s.cadence, pct: Math.round(((s.amount - s.prev) / s.prev) * 1000) / 10, perYear: r2((s.amount - s.prev) * 12 / MONTHS[s.cadence]), src: s.src });
  // overlaps: two or more paid services (or a trial about to turn paid) doing the same job
  const overlaps = [];
  for (const [g, label] of GROUPS) {
    const items = [...subs.filter((s) => s.groups.includes(g)), ...trials.filter((t) => t.groups.includes(g) && !subOf(t.name)).map((t) => ({ ...t, perMonth: t.amount, trial: true }))];
    if (items.length < 2) continue;
    const byCur = {}; for (const i of items) byCur[i.currency] = (byCur[i.currency] || 0) + i.perMonth;
    const top = items.reduce((a, i) => (i.perMonth > a.perMonth && i.currency === a.currency ? i : a), items[0]);
    const save = items.filter((i) => i !== top && i.currency === top.currency).reduce((a, i) => a + i.perMonth, 0);
    overlaps.push({ id: "overlap:" + g + ":" + items.map((i) => i.name).sort().join("+"), kind: "overlap", group: g, label, items, perMonth: byCur, perYear: r2(save * 12), currency: top.currency });
  }
  // renewals: a yearly or quarterly plan renewing in the next 45 days, and Deadline Radar's renewals
  const renewals = [], seenR = new Set();
  for (const s of subs) if (s.cadence !== "month" && daysTo(s.next, now) >= 0 && daysTo(s.next, now) <= 45) { seenR.add(s.name.toLowerCase()); renewals.push({ id: "renew:" + s.name.toLowerCase() + ":" + s.next, kind: "renewal", name: s.name, date: s.next, days: daysTo(s.next, now), amount: s.amount, currency: s.currency, cadence: s.cadence, src: s.src }); }
  for (const r of [...ev.filter((e) => e.type === "renewal"), ...radarItems.filter((x) => x.kind === "renewal").map((x) => ({ service: serviceOf(x.title) || x.title, date: x.date, amount: x.amount || 0, currency: x.currency || "", src: { id: x.id, kind: "radar", at: x.created || now, title: x.title, text: x.note || "" } }))]) {
    const key = (r.service || "").toLowerCase(), left = daysTo(r.date, now);
    if (seenR.has(key) || left < 0 || left > 45) continue; seenR.add(key);
    renewals.push({ id: "renew:" + key + ":" + r.date, kind: "renewal", name: r.service, date: r.date, days: left, amount: r.amount, currency: r.currency || cur0, src: r.src });
  }
  // perks: newest first, one per service, not expired
  const perks = [], seenP = new Set();
  for (const p of ev.filter((e) => e.type === "perk").sort((a, b) => b.src.at - a.src.at)) {
    const key = (p.service || p.what).toLowerCase(); if (seenP.has(key) || (p.src.at || 0) < now - 120 * DAY) continue; seenP.add(key);
    perks.push({ id: "perk:" + key + ":" + (p.src.id || ""), kind: "perk", name: p.service || "A perk", what: p.what, value: p.value, currency: p.currency || cur0, points: p.points, expires: p.expires, days: p.expires ? daysTo(p.expires, now) : null, src: p.src });
  }
  const keep = (x) => !skip.has(x.id);
  const R = { subs: subs.sort((a, b) => b.perMonth - a.perMonth), trials: trials.filter(keep).sort((a, b) => a.days - b.days), hikes: hikes.filter(keep).sort((a, b) => b.perYear - a.perYear),
    overlaps: overlaps.filter(keep).sort((a, b) => b.perYear - a.perYear), renewals: renewals.filter(keep).sort((a, b) => a.days - b.days), perks: perks.filter(keep) };
  // what you pay a month, per currency (no guessed exchange rates)
  R.perMonth = {}; for (const s of R.subs) R.perMonth[s.currency] = r2((R.perMonth[s.currency] || 0) + s.perMonth);
  // a year at stake: rises + overlaps + trials that would turn paid, per currency
  R.atStake = {};
  const stake = (c, n) => { if (n > 0) R.atStake[c] = r2((R.atStake[c] || 0) + n); };
  R.hikes.forEach((h) => stake(h.currency, h.perYear)); R.overlaps.forEach((o) => stake(o.currency, o.perYear)); R.trials.forEach((t) => stake(t.currency, t.amount * 12));
  // act now: a trial ending within a week, a price rise of the last 60 days, a renewal within a week
  R.now = [...R.trials.filter((t) => t.days <= 7), ...R.hikes.filter((h) => (h.src.at || 0) >= now - 60 * DAY), ...R.renewals.filter((r) => r.days <= 7)];
  R.count = R.trials.length + R.hikes.length + R.overlaps.length + R.renewals.length + R.perks.length;
  return R;
}

// ---- month by month ----------------------------------------------------------------------------------------------------------------
export const OP_KEY = "attune:overpay:v1";
export const loadOverpay = (store = typeof localStorage !== "undefined" ? localStorage : null) => { try { const j = JSON.parse((store && store.getItem(OP_KEY)) || "null"); return j && typeof j === "object" ? { emails: [], snaps: {}, done: [], monthly: false, ...j } : { emails: [], snaps: {}, done: [], monthly: false }; } catch (e) { return { emails: [], snaps: {}, done: [], monthly: false }; } };
export const saveOverpay = (o, store = typeof localStorage !== "undefined" ? localStorage : null) => { try { store && store.setItem(OP_KEY, JSON.stringify(o)); } catch (e) {} return o; };
/** New emails in (the same message twice: once), newest 600 kept. */
export function addEmails(o, list) {
  const have = new Set((o.emails || []).map((e) => e.id)), add = (list || []).filter((e) => e && e.id && !have.has(e.id) && (have.add(e.id), true));
  return { ...o, emails: [...(o.emails || []), ...add].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 600), added: add.length };
}
/** Keep this month's totals; → { ...o, snaps } and the change since the month before, per currency. */
export function snapshot(o, R, now = Date.now()) {
  const mo = isoDay(now).slice(0, 7), snaps = { ...(o.snaps || {}), [mo]: { perMonth: R.perMonth, subs: R.subs.length, at: now } };
  const prevKey = Object.keys(snaps).filter((k) => k < mo).sort().pop(), prev = prevKey ? snaps[prevKey] : null, change = {};
  if (prev) for (const c of Object.keys(R.perMonth)) if (prev.perMonth && prev.perMonth[c]) change[c] = Math.round(((R.perMonth[c] - prev.perMonth[c]) / prev.perMonth[c]) * 1000) / 10;
  return { o: { ...o, snaps }, change, prevMonth: prevKey || "" };
}
/** The reminder on the 1st of every month at 9:00 (Reminders' "monthly" repeat). */
export function monthlyReminder(now = Date.now()) {
  const d = new Date(now), at = new Date(d.getFullYear(), d.getMonth() + 1, 1, 9, 0, 0).getTime();
  return { id: "overpay-monthly", at, title: "Your monthly overpaying check", body: "Subscriptions, trials, price rises and perks — on this phone.", repeat: "monthly" };
}
/** What the person did with a finding, for the Guardian's honest counter: a cancelled trial or overlap counts its monthly cost. */
export function savedFinding(f) {
  const amount = f.kind === "trial" ? f.amount : f.kind === "overlap" ? f.perYear / 12 : f.kind === "hike" ? f.perYear / 12 : f.kind === "renewal" ? f.amount / (f.cadence === "quarter" ? 3 : 12) : f.value || 0;
  return { id: f.id, kind: f.kind === "perk" ? "fees" : "subs", monthly: r2(amount), amount: r2(amount), title: f.name };
}

/* ---- v9.4 New agents (Ali, 5 Nov 2026: "G1 ok but make the option to schedule a message — send this contact this message at 5 pm
   tomorrow and it does that; G2–G7 ok. The most important thing: an easy, interactive, visually appealing, smooth interface, consistent
   across all agents; global, so it works in most countries; smooth, accurate, and results easy to use").
   One sentence starts each, like every other agent (agents.js parseAgent calls parseMore first):
     G1 reply   — "who is waiting for my reply?"            · scheduled message — "send Ahmed 'I'm late' at 5 pm tomorrow"
     G2 slot    — "watch the Spain visa appointments"        (VFS / US visa / any booking page pasted; checked every 15–60 min)
     G3 restock — "tell me before I run out of things"       (learns from Money what you buy again and again)
     G4 protect — "I bought AirPods Pro 2 for 9,450 on Amazon" (watches the price for the return window)
     G5 clinic  — "a dermatologist in Nasr City under 500"   (Vezeeta, Doctolib, Doctoralia, Doktortakvimi, Practo — Google Maps everywhere)
     G6 trip    — "my flight MS 753 tomorrow at 10:40 to Madrid" (check-in opens, leave by, gate changes from the airline's notifications)
     G7 how much an agent may do by itself — a rule like any other: "only tell me", "ask me first", "do it by itself under 7,500"
   Pure; tests: tests/unit/v940agents.test.mjs. Nothing here sends, books or pays. */
import { appIn, repeatIn } from "./msgsched.js";
import { parseTime } from "./actions.js";
import { airportOf, cityName } from "./agent.js";

const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const fold = (s) => latin(s).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه");
const enc = encodeURIComponent;
const DAY = 864e5;

// ---- G1 Reply helper -----------------------------------------------------------------------------------------------------------------
/** The chats waiting for you: the newest message of each person (not a group), not opened since, older than `hours`.
 *  items: ChatInbox.kt's list [{key, app, pkg, who, group, text, ts, canReply, seen}] → [{key, who, app, pkg, text, ts, canReply, waited}] oldest wait first. */
export function waitingChats(items, { now = Date.now(), hours = 3 } = {}) {
  const last = new Map();
  for (const x of items || []) if (x && !x.group && x.key && (!last.has(x.key) || x.ts > last.get(x.key).ts)) last.set(x.key, x);
  return [...last.values()].filter((x) => !x.seen && now - x.ts >= hours * 36e5)
    .map((x) => ({ key: x.key, who: x.who, app: x.app, pkg: x.pkg || "", text: x.text, ts: x.ts, canReply: !!x.canReply, waited: now - x.ts }))
    .sort((a, b) => a.ts - b.ts);
}
/** What the model is asked to write — short, in the language the message was written in, never inventing facts. */
export const draftPrompt = (x, me = "") => "Write a short, friendly reply (1–2 sentences) to this message from " + x.who + ". Reply in the same language and dialect as the message. "
  + "Do not promise anything specific or invent facts; if a decision is needed, say you'll confirm. Only the reply text." + (me ? " The reply is from " + me + "." : "") + "\nMessage: " + String(x.text || "").slice(0, 400);
/** Quick replies when there is no model (or to start from). */
export const QUICK = ["On my way", "I'll call you later", "Yes 👍", "Sorry, I'm busy now — I'll get back to you", "Can we talk tomorrow?"];

/** "send Ahmed 'I'm running late' at 5 pm tomorrow" · "message Mama tomorrow at 9: happy birthday" · «ابعت لأحمد بكرة الساعة ٥: انا متأخر»
 *  → { kind: "send", who, text, at } | { kind: "send", ask } | null */
export function parseScheduled(text, { now = Date.now() } = {}) {
  const t0 = String(text || "").trim(), t = fold(t0);
  const lead = /^(?:please\s+)?(?:schedule\s+(?:a\s+)?(?:message|text|whatsapp)\s+(?:to\s+)?|send\s+(?:a\s+)?(?:message|text|whatsapp)?\s*(?:to\s+)?|(?:message|text|whatsapp)\s+(?:to\s+)?|remind\s+(?=\S+\s+(?:at|on|tomorrow))|ابعت\s+(?:رساله\s+|رسالة\s+|مسج\s+|واتس\s+)?(?:ل|الي\s+)|ابعتلي\s+ل|ارسل\s+(?:رساله\s+|رسالة\s+)?(?:ل|الي\s+)|راسل\s+)/i.exec(t);
  if (!lead) return null;
  const when = parseTime(t0, now);
  if (!when || !when.said || !when.said.time) return null;   // a message with no time is just a message, not a schedule
  // the words: in quotes, or after ":" / "saying" / "that" / «قوله» / «إن»
  const q = /["“«]([^"”»]{1,500})["”»]/.exec(t0) || /['‘](.{1,500}?)['’](?=\s+(?:at|on|tomorrow|today|tonight|in)\b|\s*[.!]?\s*$)/i.exec(t0)
    || /(?::|\bsaying\b|\btelling (?:him|her|them)\b|\bthat\b|قوله|قولها|وقوله|يقول)\s*(.{1,500})$/i.exec(t0);
  let words = q ? q[1].trim() : "";
  // who: the first words after the lead, before the time / the words
  const rest = t0.slice(lead[0].length).replace(/^ل(?=\S)/, "");
  const who = (rest.split(/\s+(?:at|on|tomorrow|today|tonight|in|saying|that|بكره|بكرة|النهارده|النهاردة|الساعه|الساعة|يوم|بعد|قوله|قولها)(?![\p{L}])|[:"“«'‘,،]|\s+[\d٠-٩]/iu)[0] || "").trim().replace(/^(?:to|ل)\s*/i, "").slice(0, 40);
  if (!who) return { kind: "send", ask: "To whom?" };
  if (!words) return { kind: "send", who, at: when.at, ask: "What should the message say?" };
  if (when.at <= now) return { kind: "send", who, text: words, ask: "That time has passed — when should it go?" };
  // v9.7 Messages: which app ("sms Ahmed…", «على تليجرام») and how it repeats ("every year", «كل شهر»)
  return { kind: "send", who, text: words.slice(0, 1000), at: when.at, app: appIn(t0), repeat: repeatIn(t0) };
}
/** The chat to send it into: the person's newest one-to-one chat Attune has seen (its key → sent by itself through that chat's Reply). */
export function chatFor(who, items) {
  const w = fold(who).replace(/\s+/g, " ").trim(); if (!w) return null;
  const mine = (items || []).filter((x) => x && !x.group && x.key && fold(x.who).includes(w)).sort((a, b) => b.ts - a.ts);
  return mine[0] || null;
}

// ---- G2 Visa / appointment slots ---------------------------------------------------------------------------------------------------------
const ISO3 = { EG: "egy", SA: "sau", AE: "are", MA: "mar", DZ: "dza", TN: "tun", JO: "jor", LB: "lbn", KW: "kwt", QA: "qat", BH: "bhr", OM: "omn", IN: "ind", PK: "pak", BD: "bgd",
  NG: "nga", KE: "ken", GH: "gha", ZA: "zaf", TR: "tur", ID: "idn", MY: "mys", PH: "phl", TH: "tha", VN: "vnm", CN: "chn", RU: "rus", UA: "ukr", IR: "irn", IQ: "irq",
  ES: "esp", IT: "ita", FR: "fra", DE: "deu", NL: "nld", BE: "bel", AT: "aut", CH: "che", PT: "prt", GR: "grc", GB: "gbr", IE: "irl", SE: "swe", NO: "nor", DK: "dnk",
  FI: "fin", PL: "pol", CZ: "cze", HU: "hun", MT: "mlt", CA: "can", AU: "aus", NZ: "nzl", US: "usa", JP: "jpn", KR: "kor" };
const DEST = [["ES", "spain|spanish|اسبانيا|اسباني"], ["IT", "italy|italian|ايطاليا"], ["FR", "france|french|فرنسا"], ["DE", "germany|german|المانيا"], ["NL", "netherlands|holland|هولندا"],
  ["BE", "belgium|بلجيكا"], ["AT", "austria|النمسا"], ["CH", "switzerland|سويسرا"], ["PT", "portugal|البرتغال"], ["GR", "greece|اليونان"], ["GB", "uk|united kingdom|britain|british|england|بريطانيا|انجلترا"],
  ["US", "usa|us|united states|american|america|امريكا"], ["CA", "canada|كندا"], ["AU", "australia|استراليا"], ["SE", "sweden|السويد"], ["MT", "malta|مالطا"], ["IE", "ireland|ايرلندا"],
  ["PL", "poland|بولندا"], ["CZ", "czech|التشيك"], ["HU", "hungary|المجر"], ["NO", "norway|النرويج"], ["DK", "denmark|الدنمارك"], ["FI", "finland|فنلندا"], ["JP", "japan|اليابان"]];
/** The booking pages a person in `from` uses for a visa to `dest` — the official ones whose address follows a known pattern; any
 *  other page can be pasted. → [{ name, url, note }] */
export function slotSites(dest, from = "EG") {
  const f = ISO3[String(from).toUpperCase()] || "", d = ISO3[String(dest).toUpperCase()] || "", out = [];
  if (dest === "US") out.push({ name: "U.S. visa (AIS)", url: "https://ais.usvisa-info.com/en-" + String(from).toLowerCase() + "/niv/users/sign_in", note: "Log in once in Attune's browser" });
  if (f && d && dest !== "US") out.push({ name: "VFS Global", url: "https://visa.vfsglobal.com/" + f + "/en/" + d + "/", note: "The official centre for many countries" });
  if (["FR", "DE", "BE", "CH", "IT"].includes(dest)) out.push({ name: "TLScontact", url: "https://visas-" + String(dest).toLowerCase() + ".tlscontact.com/", note: "Some countries book here" });
  if (["ES", "PT", "IT"].includes(dest)) out.push({ name: "BLS International", url: "https://www.blsinternational.com/", note: "Spain and others in many countries — paste your BLS page" });
  return out;
}
/** What an appointment page's words say. → { state: "open" | "none" | "login" | "unknown", dates: ["2026-12-15", …] } */
const NO_SLOT = /no (?:appointment|slot|date)s? (?:are )?(?:currently )?available|no availability|fully booked|currently no (?:dates|slots)|no open (?:appointments|slots)|try again later|aucun (?:rendez-vous|créneau)|pas de (?:rendez-vous|créneau)|no hay (?:citas|turnos|fechas)|keine (?:termine|freien termine)|nessun appuntamento|sem (?:vagas|horários)|randevu (?:bulunmamaktadır|yok)|لا توجد مواعيد|لا يوجد مواعيد|مفيش مواعيد|لا تتوفر مواعيد|غير متاح/i;
const LOGIN = /\b(?:log ?in|sign ?in|password|captcha|forgot your password)\b|تسجيل الدخول|كلمه المرور|كلمة المرور/i;
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function slotState(text, { now = Date.now() } = {}) {
  const t = latin(text).replace(/\s+/g, " ");
  if (!t.trim()) return { state: "unknown", dates: [] };
  if (NO_SLOT.test(t)) return { state: "none", dates: [] };
  if (LOGIN.test(t.slice(0, 1500)) && t.length < 2500) return { state: "login", dates: [] };
  const y0 = new Date(now).getFullYear(), dates = new Set(), pad = (n) => String(n).padStart(2, "0");
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) dates.add(m[1] + "-" + m[2] + "-" + m[3]);
  for (const m of t.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/g)) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; if (+m[2] <= 12 && +m[1] <= 31) dates.add(y + "-" + pad(m[2]) + "-" + pad(m[1])); }
  for (const m of t.matchAll(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?/gi)) dates.add((m[3] || y0) + "-" + pad(MON[m[2].toLowerCase().slice(0, 3)]) + "-" + pad(m[1]));
  const today = new Date(now).toISOString().slice(0, 10);
  const future = [...dates].filter((d) => d >= today).sort();
  if (future.length && /available|book|select|appointment|slot|موعد|متاح|احجز|disponible|verfügbar|disponibil/i.test(t)) return { state: "open", dates: future.slice(0, 6) };
  return { state: "unknown", dates: future.slice(0, 6) };
}
/** "watch the Spain visa appointments" · «راقب مواعيد فيزا اسبانيا» · a pasted booking page → a slot agent. */
export function parseSlot(text, { country = "EG" } = {}) {
  const t = fold(text);
  if (!/\b(visa|appointment|appointments|slot|slots|embassy|consulate|vfs|bls|tlscontact)\b|فيزا|تاشيره|تأشيره|مواعيد|ميعاد|سفاره|قنصليه/.test(t)) return null;
  if (!/\b(watch|tell me|notify|alert|check|monitor|find|when)\b|راقب|نبهني|قولي|عرفني|تابع|دور/.test(t) && !/https:\/\//.test(text)) return null;
  const url = (/https:\/\/\S+/.exec(String(text)) || [])[0] || "";
  const d = (DEST.find(([, re]) => new RegExp("(?<![\\p{L}])(?:" + re + ")(?![\\p{L}])", "iu").test(t)) || [])[0] || "";
  const sites = d ? slotSites(d, country) : [];
  const every = +((/every\s+(\d{2,3})\s*(?:min|minutes)/i.exec(t) || /كل\s+(\d{2,3})\s*دقيقه/.exec(t) || [])[1] || 30);
  const site = url ? (url.replace(/^https:\/\/(www\.)?/, "").split("/")[0]) : sites[0] ? sites[0].name : "";
  const title = "Visa appointments" + (d ? " · " + d : "");
  if (!url && !sites.length) return { kind: "slot", dest: d, sites, title, ask: "Paste the booking page link (open it once in Attune and log in)" };
  return { kind: "slot", dest: d, url: url || sites[0].url, site, sites, every: Math.max(15, Math.min(240, every)), title };
}

// ---- G3 Restock --------------------------------------------------------------------------------------------------------------------------
const normItem = (s) => fold(s).replace(/[\d.,]+\s*(?:kg|g|gm|l|ml|lt|pcs|x|×|egp|le|جنيه|كيلو|لتر|جرام)?/g, " ").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
/** What you buy again and again (Money's entries) → [{ item, every (days), last (iso), due (iso), daysLeft, price }] due within `soon` days first. */
export function restockDue(ledger, { now = Date.now(), soon = 3, min = 3 } = {}) {
  const by = new Map();
  for (const x of (ledger && ledger.txns) || []) {
    if (!x || x.type !== "expense" || !x.note || !x.date) continue;
    const k = normItem(x.note); if (k.length < 3 || k.split(" ").length > 4) continue;
    if (!by.has(k)) by.set(k, { item: (k.charAt(0).toUpperCase() + k.slice(1)).slice(0, 40), dates: [], prices: [] });
    const g = by.get(k); g.dates.push(x.date); g.prices.push(+x.amount || 0);
  }
  const out = [];
  for (const g of by.values()) {
    const ds = [...new Set(g.dates)].sort(); if (ds.length < min) continue;
    const gaps = ds.slice(1).map((d, i) => Math.round((Date.parse(d) - Date.parse(ds[i])) / DAY)).filter((x) => x > 0).sort((a, b) => a - b);
    if (gaps.length < min - 1) continue;
    const every = gaps[Math.floor(gaps.length / 2)]; if (every < 2 || every > 60) continue;
    const spread = gaps[gaps.length - 1] - gaps[0]; if (spread > every * 1.5) continue;   // not regular enough
    const last = ds[ds.length - 1], due = new Date(Date.parse(last) + every * DAY).toISOString().slice(0, 10);
    const daysLeft = Math.round((Date.parse(due) - Date.parse(new Date(now).toISOString().slice(0, 10))) / DAY);
    const ps = g.prices.filter((p) => p > 0).sort((a, b) => a - b);
    out.push({ item: g.item, every, last, due, daysLeft, price: ps[Math.floor(ps.length / 2)] || 0 });
  }
  return out.filter((x) => x.daysLeft <= soon).sort((a, b) => a.daysLeft - b.daysLeft);
}
export const isRestock = (text) => /\b(restock|run(?:ning)? out|before i run out|what i buy (?:regularly|often)|reorder)\b|يخلص|قبل ما يخلص|اللي بشتريه كل|بخلص/.test(fold(text));

// ---- G4 Price protection ----------------------------------------------------------------------------------------------------------------
/** Days a store usually takes a return / price adjustment (checked before you ask — the agent says "about"). */
export function returnDays(site = "", country = "EG") {
  const s = String(site).toLowerCase(), c = String(country).toUpperCase();
  if (/amazon/.test(s)) return ["US", "GB", "DE", "FR", "IT", "ES", "CA", "AU", "JP"].includes(c) ? 30 : 15;
  if (/noon/.test(s)) return 15;
  if (/jumia/.test(s)) return 15;
  if (/apple/.test(s)) return 14;
  return 14;
}
/** "I bought AirPods Pro 2 for 9,450 on Amazon" · «اشتريت سماعات بـ 9450 من أمازون» → { kind: "protect", what, paid, site, days } | null */
export function parseProtect(text, { country = "EG", now = Date.now() } = {}) {
  const t0 = latin(String(text || "")), t = fold(t0);
  let m = /\b(?:i\s+)?(?:bought|purchased|ordered|got)\s+(?:a\s+|an\s+|the\s+)?(.{2,60}?)\s+(?:for|at)\s+(?:egp|le|usd|\$|€|£|sar|aed)?\s*([\d][\d,.]*)\s*(k)?\s*(?:egp|le|usd|sar|aed|pounds?)?\s*(?:(?:on|from|at)\s+([\w.\- ]{2,20}))?/i.exec(t0)
    || /(?:اشتريت|جبت|طلبت)\s+(.{2,60}?)\s+(?:ب|بـ|بسعر)\s*([\d][\d,.]*)\s*(الف|ألف)?\s*(?:جنيه)?\s*(?:(?:من|على)\s+(\S{2,20}))?/.exec(t0);
  // "protect the price of the iPhone I bought from Amazon for 45000" — the thing first, then where and how much
  const m2 = /\b(?:on|of|for)\s+(?:my\s+|the\s+|a\s+|an\s+)?(.{2,60}?)\s+(?:that\s+|which\s+)?i\s+(?:bought|purchased|ordered|got)\s+(?:(?:on|from|at)\s+([\w.\-]{2,20})\s+)?(?:for|at)\s+(?:egp|le|usd|\$|€|£|sar|aed)?\s*([\d][\d,.]*)\s*(k)?/i.exec(t0);
  if (m2 && (!m || /^(?:on|from|at)\s/i.test(m[1]))) m = [m2[0], m2[1], m2[3], m2[4], m2[2]];
  if (!m) return null;
  const paid = Math.round(parseFloat(m[2].replace(/,/g, "")) * (m[3] ? 1000 : 1));
  if (!(paid > 0)) return null;
  const site = (m[4] || "").trim().replace(/^(?:امازون|أمازون)$/, "Amazon").replace(/^نون$/, "noon").replace(/^جوميا$/, "Jumia");
  return { kind: "protect", what: m[1].trim().slice(0, 80), paid, site, days: returnDays(site, country), bought: now };
}
/** The price today against what you paid → { drop, back, daysLeft, message } (message = what to send the store). */
export function protectState(a, price, { now = Date.now() } = {}) {
  const until = (a.bought || a.created || now) + (a.days || 14) * DAY, daysLeft = Math.max(0, Math.ceil((until - now) / DAY));
  const back = price > 0 && a.paid > 0 ? Math.round(a.paid - price) : 0, drop = back > 0 && back >= a.paid * 0.03;
  const d = new Date(a.bought || a.created || now).toISOString().slice(0, 10), cur = a.currency ? a.currency + " " : "";
  return { drop, back: drop ? back : 0, daysLeft, message: "Hello, I bought " + (a.what || a.title || "this item") + " on " + d + " for " + cur + a.paid + ". The same item is now " + cur + price + ". Could you refund the difference (" + cur + back + "), or should I return it and buy it again?" };
}

// ---- G5 Clinics ------------------------------------------------------------------------------------------------------------------------
// [key, words (EN + Egyptian Arabic + the main languages), slugs: { vez (Vezeeta, EN), fr, de, es, pt, it, tr, practo }]
const SPEC = [
  ["dermatologist", "dermatolog|skin doctor|dermatology|جلديه|جلدية|دكتور جلد", { vez: "dermatology", fr: "dermatologue", de: "hautarzt", es: "dermatologo", pt: "dermatologista", it: "dermatologo", tr: "dermatoloji", practo: "dermatologist" }],
  ["dentist", "dentist|dental|اسنان|أسنان|دكتور سنان", { vez: "dentistry", fr: "dentiste", de: "zahnarzt", es: "dentista", pt: "dentista", it: "dentista", tr: "dis-hekimi", practo: "dentist" }],
  ["pediatrician", "pediatric|paediatric|child doctor|اطفال|أطفال", { vez: "pediatrics-and-new-born", fr: "pediatre", de: "kinderarzt", es: "pediatra", pt: "pediatra", it: "pediatra", tr: "cocuk-sagligi-ve-hastaliklari", practo: "pediatrician" }],
  ["gynecologist", "gyn|gynaecolog|obstetric|نسا|نساء|توليد", { vez: "gynaecology-and-infertility", fr: "gynecologue", de: "frauenarzt", es: "ginecologo", pt: "ginecologista", it: "ginecologo", tr: "kadin-hastaliklari-ve-dogum", practo: "gynecologist" }],
  ["cardiologist", "cardiolog|heart doctor|قلب", { vez: "cardiology-and-vascular-disease", fr: "cardiologue", de: "kardiologe", es: "cardiologo", pt: "cardiologista", it: "cardiologo", tr: "kardiyoloji", practo: "cardiologist" }],
  ["orthopedist", "orthop|bone doctor|عظام", { vez: "orthopedics", fr: "chirurgien-orthopediste", de: "orthopaede", es: "traumatologo", pt: "ortopedista", it: "ortopedico", tr: "ortopedi-ve-travmatoloji", practo: "orthopedist" }],
  ["ophthalmologist", "ophthalm|eye doctor|عيون", { vez: "ophthalmology", fr: "ophtalmologue", de: "augenarzt", es: "oftalmologo", pt: "oftalmologista", it: "oculista", tr: "goz-hastaliklari", practo: "ophthalmologist" }],
  ["ent", "\\bent\\b|ear nose|otolaryng|انف واذن|أنف وأذن", { vez: "ear-nose-and-throat", fr: "orl-oto-rhino-laryngologie", de: "hno-arzt", es: "otorrinolaringologo", pt: "otorrinolaringologista", it: "otorinolaringoiatra", tr: "kulak-burun-bogaz-hastaliklari", practo: "ent-specialist" }],
  ["neurologist", "neurolog|مخ واعصاب|أعصاب|اعصاب", { vez: "neurology", fr: "neurologue", de: "neurologe", es: "neurologo", pt: "neurologista", it: "neurologo", tr: "noroloji", practo: "neurologist" }],
  ["psychiatrist", "psychiatr|psycholog|therapist|نفسي|نفسيه", { vez: "psychiatry", fr: "psychiatre", de: "psychiater", es: "psiquiatra", pt: "psiquiatra", it: "psichiatra", tr: "ruh-sagligi-ve-hastaliklari", practo: "psychiatrist" }],
  ["internist", "internist|internal medicine|باطنه|باطنة", { vez: "internal-medicine", fr: "medecin-generaliste", de: "internist", es: "medico-internista", pt: "clinico-geral", it: "internista", tr: "ic-hastaliklari", practo: "internal-medicine" }],
  ["urologist", "urolog|مسالك", { vez: "urology", fr: "urologue", de: "urologe", es: "urologo", pt: "urologista", it: "urologo", tr: "uroloji", practo: "urologist" }],
  ["nutritionist", "nutrition|dietitian|تغذيه|تغذية", { vez: "nutrition", fr: "dieteticien", de: "ernaehrungsberater", es: "nutricionista", pt: "nutricionista", it: "nutrizionista", tr: "beslenme-ve-diyet", practo: "dietitian-nutritionist" }],
  ["physiotherapist", "physio|physical therap|علاج طبيعي", { vez: "physiotherapy", fr: "kinesitherapeute", de: "physiotherapeut", es: "fisioterapeuta", pt: "fisioterapeuta", it: "fisioterapista", tr: "fizik-tedavi-ve-rehabilitasyon", practo: "physiotherapist" }],
  ["general practitioner", "general practitioner|\\bgp\\b|family doctor|ممارس عام|دكتور عام", { vez: "general-practice", fr: "medecin-generaliste", de: "allgemeinmediziner", es: "medico-general", pt: "clinico-geral", it: "medico-di-base", tr: "aile-hekimligi", practo: "general-physician" }],
];
const slug = (s) => fold(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** The booking sites for a specialty in a city, by country — always ending with Google Maps (works everywhere). */
export function clinicSites(spec, city, country = "EG") {
  const s = SPEC.find((x) => x[0] === spec) || SPEC[0], c = String(country).toUpperCase(), cs = slug(city), out = [];
  if (["EG", "SA", "AE", "JO", "LB", "KE", "NG"].includes(c)) out.push({ site: "Vezeeta", url: "https://www.vezeeta.com/en/doctor/" + s[2].vez + "/" + (cs || "cairo") });
  if (c === "FR") out.push({ site: "Doctolib", url: "https://www.doctolib.fr/" + s[2].fr + "/" + cs });
  if (c === "DE") out.push({ site: "Doctolib", url: "https://www.doctolib.de/" + s[2].de + "/" + cs });
  if (c === "IT") out.push({ site: "Doctolib", url: "https://www.doctolib.it/" + s[2].it + "/" + cs });
  if (["ES", "MX", "BR", "PT", "CO", "AR", "CL", "PE", "PL"].includes(c)) { const dom = { ES: "doctoralia.es", MX: "doctoralia.com.mx", BR: "doctoralia.com.br", PT: "doctoralia.pt", CO: "doctoralia.co", AR: "doctoralia.com.ar", CL: "doctoralia.cl", PE: "doctoralia.pe", PL: "znanylekarz.pl" }[c];
    out.push({ site: "Doctoralia", url: "https://www." + dom + "/" + (c === "BR" || c === "PT" ? s[2].pt : s[2].es) + "/" + cs }); }
  if (c === "TR") out.push({ site: "Doktortakvimi", url: "https://www.doktortakvimi.com/" + s[2].tr + "/" + cs });
  if (c === "IN") out.push({ site: "Practo", url: "https://www.practo.com/" + cs + "/" + s[2].practo });
  out.push({ site: "Google Maps", url: "https://www.google.com/maps/search/" + enc(s[0] + " in " + city) });
  return out;
}
/** "a dermatologist in Nasr City under 500 this week" · «دكتور جلدية في مدينة نصر أقل من 500» → { kind: "clinic", spec, city, below, tries } | null */
export function parseClinic(text, { country = "EG" } = {}) {
  const t0 = latin(String(text || "")), t = fold(t0);
  const s = SPEC.find(([, re]) => new RegExp(re, "i").test(t));
  if (!s || !/\b(doctor|dr|clinic|appointment|book|find|need)\b|دكتور|دكتوره|عياده|عيادة|كشف|ميعاد/.test(t + " " + s[0])) return null;
  const cm = /\b(?:in|near|around)\s+([\p{L}][\p{L}\s.'-]{1,40}?)(?=\s+(?:under|below|less|this|next|tomorrow|today|for|with)\b|[,.]|$)/iu.exec(t0) || /(?:في|جنب|قريب من)\s+([\p{L}][\p{L}\s]{1,30}?)(?=\s+(?:اقل|أقل|تحت|بكره|بكرة|الاسبوع|النهارده)|[,.،]|$)/u.exec(t0);
  const city = cm ? cm[1].trim() : "";
  const lim = /\b(?:under|below|less than|max|up to)\s*([\d][\d,]*)/i.exec(t0) || /(?:اقل من|أقل من|تحت|في حدود)\s*([\d][\d,]*)/.exec(t0);
  const d = { kind: "clinic", spec: s[0], city, below: lim ? +lim[1].replace(/,/g, "") : 0, title: s[0].replace(/^\w/, (c) => c.toUpperCase()) + (city ? " · " + city : "") };
  if (!city) return { ...d, ask: "In which city or area?" };
  return { ...d, tries: clinicSites(s[0], city, country) };
}

// ---- G6 Travel day ----------------------------------------------------------------------------------------------------------------------
/** "my flight MS 753 tomorrow at 10:40 to Madrid" · «طيارتي MS753 بكرة الساعة ١٠:٤٠ لمدريد» → { kind: "trip", flight, at, to, intl } | null */
export function parseTrip(text, { now = Date.now(), country = "EG" } = {}) {
  const t0 = latin(String(text || ""));
  const fm = /\b([A-Z][A-Z0-9]|[A-Z0-9][A-Z])\s?(\d{2,4})\b/.exec(t0.toUpperCase());
  if (!fm || !/\b(flight|flying|fly|plane)\b|طياره|طيارة|طيارتي|رحلتي|رحلة/i.test(t0)) return null;
  const when = parseTime(t0, now);
  const tm = /\bto\s+([\p{L}][\p{L}\s]{1,30}?)(?=\s+(?:on|at|tomorrow|today|from)\b|[,.]|$)/iu.exec(t0) || /(?:^|\s)ل([\p{L}]{2,20})/u.exec(t0);
  const to = tm ? airportOf(tm[1]) : "";
  const d = { kind: "trip", flight: fm[1] + " " + fm[2], to, toName: to ? cityName(to) : (tm ? tm[1].trim() : ""), title: "Flight " + fm[1] + " " + fm[2] + (tm ? " · " + (to ? cityName(to) : tm[1].trim()) : "") };
  if (!when || !when.said || !when.said.time) return { ...d, ask: "When does it leave? (e.g. tomorrow at 10:40)" };
  return { ...d, at: when.at, intl: true };
}
/** The day plan: check-in opens 24 h before; be at the airport 3 h before an international flight (2 h domestic); leave earlier by the
 *  drive (`drive` minutes). Gate / delay / boarding from the airline's notifications. → { checkIn, atAirport, leaveBy, gate, status, lines } */
export function tripPlan(a, notes = [], { now = Date.now(), drive = 60 } = {}) {
  const at = a.at, buf = (a.intl === false ? 2 : 3) * 36e5;
  const checkIn = at - DAY, atAirport = at - buf, leaveBy = atAirport - drive * 6e4;
  const fl = String(a.flight || "").replace(/\s+/g, "");
  let gate = "", status = "";
  for (const n of [...(notes || [])].sort((x, y) => x.ts - y.ts)) {
    const tx = String((n.title || "") + " " + (n.text || ""));
    if (fl && !new RegExp(fl.replace(/(\D+)(\d+)/, "$1\\s?$2"), "i").test(tx) && !/boarding|gate|delay|بوابه|بوابة|تأخير|الصعود/i.test(tx)) continue;
    const g = /\bgate(?:\s+(?:has\s+)?(?:changed|moved))?(?:\s+(?:to|is|now))?\s*:?\s*([A-Z]?\d{1,3}[A-Z]?)\b|بواب[هة](?:\s+(?:رقم|اتغيرت\s+ل|تغيرت\s+الي))?\s*([A-Z]?\d{1,3})/i.exec(tx); if (g) gate = (g[1] || g[2]).toUpperCase();
    if (/delay|delayed|تأخير|متأخر/i.test(tx)) status = "delayed"; else if (/boarding|الصعود/i.test(tx)) status = "boarding"; else if (/cancel|ألغي|الغاء/i.test(tx)) status = "cancelled";
  }
  return { checkIn, atAirport, leaveBy, gate, status, checkInOpen: now >= checkIn && now < at, leaveSoon: now >= leaveBy - 30 * 6e4 && now < at };
}

// ---- G7 How much an agent may do by itself -----------------------------------------------------------------------------------------------
/** "only tell me" → "notify" · "ask me first" → "ask" · "do it by itself under 7,500" / «اشتري لوحدك لو أقل من 7500» → { auto: 7500 } | null */
export function autonomyIn(text) {
  const t = fold(text);
  if (/\bonly (?:tell|notify|alert) me\b|\bjust (?:tell|notify) me\b|قولي بس|نبهني بس|بلغني بس/.test(t)) return "notify";
  if (/\bask me (?:first|before)\b|\balways ask\b|اسالني الاول|اسألني الأول|اسالني قبل/.test(t)) return "ask";
  const m = /\b(?:by (?:it|your)self|on (?:its|your) own|automatically|without asking)\b.*?\b(?:under|below|less than|up to)\s*([\d][\d,]*)\s*(k)?/.exec(t) || /\b(?:under|below|less than|up to)\s*([\d][\d,]*)\s*(k)?\b.*?\b(?:by (?:it|your)self|on (?:its|your) own|automatically|without asking)\b/.exec(t)
    || /(?:لوحدك|من غير ما تسالني|من غير ما تسألني|تلقائي).*?(?:اقل من|أقل من|تحت)\s*([\d][\d,]*)\s*(الف|ألف)?/.exec(t) || /(?:اقل من|أقل من|تحت)\s*([\d][\d,]*)\s*(الف|ألف)?.*?(?:لوحدك|من غير ما تسالني|تلقائي)/.exec(t);
  if (m) return { auto: Math.round(parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1)) };
  return null;
}
/** Should the agent go ahead by itself with this offer? Only under the limit, and only with a store it has used before. */
export function mayAct(rules, offer, usedSites = []) {
  const a = rules && rules.autonomy;
  if (!a || typeof a !== "object" || !(a.auto > 0) || !offer || !(offer.price > 0)) return false;
  return offer.price <= a.auto && usedSites.map((x) => String(x).toLowerCase()).includes(String(offer.site || "").toLowerCase());
}

/** All of the above, tried before the older agents (agents.js parseAgent). */
export function parseMore(text, opts = {}) {
  const t = fold(text), now = opts.now || Date.now(), country = (opts.country || "EG").toUpperCase();
  if (/\b(who(?:'s| is)? waiting for (?:my|a) (?:reply|answer)|reply helper|unanswered|i haven'?t (?:replied|answered))\b|مين مستني|مين مستنيني|ماردتش|مارديتش|اللي مستني رد/.test(t)) return { kind: "reply", title: "Reply helper" };
  const sc = parseScheduled(text, { now }); if (sc) return sc;
  const tr = parseTrip(text, { now, country }); if (tr) return tr;
  const sl = parseSlot(text, { country }); if (sl) return sl;
  const pr = parseProtect(text, { country, now }); if (pr) return pr;
  const cl = parseClinic(text, { country }); if (cl) return cl;
  if (isRestock(text)) return { kind: "restock", title: "Restock" };
  return null;
}

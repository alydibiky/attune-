import { tr } from "./i18n.js";
/* ---- v6.40 Message alerts (Ali: "I tell the app: if X sends me a message tell me — from Gmail or any email notification").
   "tell me when Ahmed messages me", "notify me if HR emails me", "alert me when I get an email from CIB about the statement",
   «لو أحمد بعتلي قولي», «نبهني لما ماما تكلمني على الواتس», «لو جالي إيميل من البنك عرفني», «أي رسالة فيها كلمة ونش نبهني» → a rule
   { who: [names], app, words: [], once, label }. The phone checks every new notification against the rules (WatchMatch.kt, with
   Notification access) and alerts with Attune's own loud notification. Pure; tests/unit/v740watch.test.mjs.                     */
export const WATCH_KEY = "attune:watch:v1";
const APP_WORDS = [
  ["whatsapp", /\b(whats ?app|wa)\b|واتس ?اب|الواتس|واتساب|الواتساب|ع الواتس|على الواتس/i],
  ["gmail", /\bgmail\b|جيميل|الجيميل/i],
  ["email", /\b(e-?mails?|mail|inbox|outlook)\b|ايميل|إيميل|الايميل|الإيميل|ميل|بريد|البريد|اوتلوك/i],
  ["telegram", /\btelegram\b|تليجرام|التليجرام/i],
  ["messenger", /\bmessenger\b|ماسنجر|الماسنجر/i],
  ["instagram", /\b(instagram|insta)\b|انستا|انستجرام|الانستا/i],
  ["sms", /\bsms\b|رساله عاديه|رسالة عادية|مسدج عادي|ماسدج عادي|الرسايل العاديه|الرسايل العادية/i],   // only works with the SMS switch on
];
const ASK_EN = /\b(tell|notify|alert|ping|let)\s+me\b|\bwarn me\b|\bgive me a (heads[- ]up|shout)\b/i;
const ASK_AR = /(قولي|قول لي|نبهني|نبّهني|عرفني|عرّفني|بلغني|ابعتلي اشعار|ابعتلي إشعار|نبهيني|فكرني|ولّعلي|خليني اعرف|خليني أعرف)/;
const ASK_FR = /\b(2oly|2olly|olly|nabbehny|nabehny|3arrafny|3arafny)\b/i;

/** "tell me when Ahmed messages me" → { who, app, words, once, label } | null */
export function parseWatch(text) {
  const t = String(text || "").replace(/[“”«»"']/g, " ").replace(/\s+/g, " ").trim();
  if (!t || t.length > 300) return null;
  if (!(ASK_EN.test(t) || ASK_AR.test(t) || ASK_FR.test(t))) return null;
  const msgEN = /\b(messages?|texts?|writes?|emails?|mails?|sends? me|replies|replied|reply|contacts? me|calls? me back|dms?|whatsapps?)\b/i;
  const msgAR = /(بعت|بعتت|بعتلي|بعتتلي|يبعت|تبعت|يبعتلي|تبعتلي|كلمني|كلمتني|يكلمني|تكلمني|راسلني|يراسلني|رد|ترد|يرد|رسالة|رساله|مسج|ماسدج|ايميل|إيميل|جالي|جاتلي|وصلني|وصلتني)/;
  if (!(msgEN.test(t) || msgAR.test(t) || /\b(b3t|b3tly|ba3at|ba3atly|kalemny|kallemny|ba3atetly)\b/i.test(t))) return null;
  let app = "any";
  for (const [id, re] of APP_WORDS) if (re.test(t)) { app = id; break; }
  const who = []; const add = (n) => { n = String(n || "").replace(/^(from|من|mr\.?|ms\.?|dr\.?|د\.?|أستاذ|استاذ|الأستاذ|الاستاذ)\s+/i, "").replace(/[.,!?؟،]+$/, "").trim();
    if (n && n.length >= 2 && n.length <= 60 && !/^(me|my|any|anyone|someone|a|an|the|اي|أي|حد|اي حد|أي حد)$/i.test(n)) who.push(n); };
  let m;
  // English: "when Ahmed (Samir) messages me", "if HR emails me", "an email from CIB", "from hr@x.com"
  if ((m = /\b(?:from)\s+([\w.@+-]+@[\w.-]+\.\w+|[A-Z][\w'&.-]*(?:\s+[A-Z][\w'&.-]*){0,3})/.exec(t))) add(m[1]);
  else if ((m = /\b(?:when|if|once|whenever|next time|the next time)\s+([A-Z][\w'&.-]*(?:\s+[A-Z][\w'&.-]*){0,3}|my\s+\w+)\s+(?:messages?|texts?|writes?|emails?|mails?|sends?|replies|calls?|whatsapps?|dms?)\b/.exec(t))) add(m[1].replace(/^my\s+/i, ""));
  // Arabic: «لو أحمد بعتلي», «لما ماما تكلمني», «إيميل من البنك», «رسالة من أحمد»
  if (!who.length && (m = /من\s+([؀-ۿA-Za-z0-9@._-]+(?:\s+[؀-ۿA-Za-z]+)?)/.exec(t))) add(m[1].replace(/\s+(قولي|نبهني|عرفني|بلغني|على|ع|في|فيه|فيها|عن)$/, ""));
  if (!who.length && (m = /(?:^|\s)(?:لو|لما|اول ما|أول ما|اما)\s+([؀-ۿ]+(?:\s+[؀-ۿ]+)?)\s+(?:بعت|بعتت|بعتلي|بعتتلي|يبعت|تبعت|يبعتلي|تبعتلي|كلمني|كلمتني|يكلمني|تكلمني|راسلني|يراسلني|رد|ترد|يرد)/.exec(t))) add(m[1].replace(/^(ال)?(اول|أول)\s+/, ""));
  // Franco: "law ahmed b3tly 2oly"
  if (!who.length && (m = /\b(?:law|lama|lamma)\s+([a-z]+)\s+(?:b3t|ba3at|b3tly|ba3atly|kalemny|kallemny)/i.exec(t))) add(m[1]);
  // words: "about the statement", «فيها كلمة ونش», "that says urgent"
  const words = [];
  if ((m = /\b(?:about|mentioning|that (?:says|mentions)|with the word)\s+(?:the\s+)?([\w؀-ۿ-]+(?:\s+[\w؀-ۿ-]+)?)/i.exec(t))) words.push(m[1]);
  if ((m = /(?:فيها|فيه|بكلمة|كلمة|عن)\s+(?:كلمة\s+)?([؀-ۿA-Za-z0-9-]+)/.exec(t))) { const w = m[1].replace(/^(ال)?(كلمة)$/, ""); if (w && !/^(قولي|نبهني|عرفني)$/.test(w)) words.push(w); }
  if (!who.length && !words.length) return null;
  const once = /\b(once|next time|the next)\b|المرة الجاية|مرة واحدة|اول ما|أول ما/i.test(t);
  return { who, app, words, once, label: t.slice(0, 120) };
}

const AP = { sms: ["SMS", "الرسايل العادية"], any: ["any app", "أي أبلكيشن"], whatsapp: ["WhatsApp", "الواتساب"], gmail: ["Gmail", "الجيميل"], email: ["email", "الإيميل"], telegram: ["Telegram", "التليجرام"], messenger: ["Messenger", "الماسنجر"], instagram: ["Instagram", "الانستجرام"] };
/** One line about a rule: "Ahmed · WhatsApp" / «أحمد · الواتساب · فيها: ونش». */
export function ruleText(r, ar = false) {
  const a = AP[r.app] || AP.any;
  return [r.who.length ? r.who.join(ar ? " أو " : tr(" or ")) : (ar ? "أي حد" : tr("anyone")), ar ? a[1] : tr(a[0]), r.words.length ? (ar ? "فيها: " : tr("with: ")) + r.words.join(", ") : "", r.once ? (ar ? "مرة واحدة" : tr("once")) : ""].filter(Boolean).join(" · ");
}
export function loadWatch(s = typeof localStorage !== "undefined" ? localStorage : null) { try { const v = JSON.parse((s && s.getItem(WATCH_KEY)) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
/** Saves the rules here and hands them to the phone (watchSave) — the phone checks them even when Attune is closed. */
export function saveWatch(list, lang = "en", s = typeof localStorage !== "undefined" ? localStorage : null) {
  try { s && s.setItem(WATCH_KEY, JSON.stringify(list)); } catch (e) {}
  try { const N = typeof window !== "undefined" && window.AttuneNative; if (N && N.watchSave) N.watchSave(JSON.stringify({ rules: list, lang })); } catch (e) {}
  return list;
}
export const newRule = (p, now = Date.now()) => ({ id: "w" + now.toString(36), on: true, created: now, ...p });

/* ---- v9.7 Messages (Ali, 6 Nov 2026: "I want the scheduling agent to be like the Auto Text app, with my interface" — picked M3 +
   S1 + S2 + S3, MOCKUPS.md, https://claude.ai/artifact/EJoWBPbPS2J5B5EsCEnmxj). Auto Text (com.hnib.smslater) is closed source; the
   auto-reply idea (answer through the chat notification's own Reply) is the one Watomatic (GPL-3.0) uses — the idea only, no code.
   This file is the pure part:
     · a scheduled message: { app, who, phone, email, subject, text, at, repeat, ask, auto } — app = whatsapp | wab | sms | telegram | email
     · nextAt: the next time a repeating message goes (the same rule as Reminders.kt next(), + yearly)
     · linkFor: the link that opens that app at that person with the words written (the "one tap" way)
     · auto-reply rules: { id, name, text, on, mode: now | silent | hours, from, to, apps, who: all | only | except, list, groups, once }
       ruleFits (the page's preview; AutoReply.kt does the same on the phone) and the sentence → rule reader
   Tests: tests/unit/v970messages.test.mjs. */

export const APPS = [
  { id: "whatsapp", label: "WhatsApp", pkg: "com.whatsapp", short: "W", col: "#25D366" },
  { id: "wab", label: "WA Business", pkg: "com.whatsapp.w4b", short: "B", col: "#128C7E" },
  { id: "sms", label: "SMS", pkg: "", short: "S", col: "#4C7DD9" },
  { id: "telegram", label: "Telegram", pkg: "org.telegram.messenger", short: "T", col: "#2AA3DF" },
  { id: "email", label: "Email", pkg: "", short: "@", col: "#9AA0A6" },
];
export const appOf = (id) => APPS.find((a) => a.id === id) || APPS[0];
export const REPEATS = ["none", "daily", "weekly", "monthly", "yearly"];
const digits = (p) => String(p || "").replace(/[^\d]/g, "");

/** The next time after `after` (repeat "none" → null once it passed). Months keep the day (31st → the month's last day). */
export function nextAt(at, repeat, after = Date.now()) {
  if (!at) return null;
  if (!repeat || repeat === "none") return at > after ? at : null;
  const d = new Date(at), day = d.getDate();
  let guard = 0;
  while (d.getTime() <= after && guard++ < 5000) {
    if (repeat === "daily") d.setDate(d.getDate() + 1);
    else if (repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (repeat === "monthly" || repeat === "yearly") {
      const y = d.getFullYear() + (repeat === "yearly" ? 1 : 0), m = d.getMonth() + (repeat === "monthly" ? 1 : 0);
      const last = new Date(y, m + 1, 0).getDate(); d.setFullYear(y, m, Math.min(day, last));
    } else return null;
  }
  return d.getTime();
}

/** The link that opens the app at that person with the words written — the person presses Send (or the phone does, in the full build). */
export function linkFor(m) {
  const t = encodeURIComponent(String(m.text || "")), p = digits(m.phone);
  switch (m.app) {
    case "sms": return p ? "smsto:" + p + "?body=" + t : "";
    case "telegram": return p ? "tg://resolve?phone=" + p + "&text=" + t : "tg://msg?text=" + t;
    case "email": return m.email ? "mailto:" + encodeURIComponent(m.email) + "?subject=" + encodeURIComponent(m.subject || "") + "&body=" + t : "";
    default: return p ? "https://wa.me/" + p + "?text=" + t : "";   // whatsapp / wab (the package picks which)
  }
}

/** What a scheduled message needs before it can be saved: [] when ready, else the English lines to show. */
export function missing(m, now = Date.now()) {
  const out = [];
  if (!String(m.who || "").trim() && !digits(m.phone) && !m.email) out.push("To whom?");
  if (!String(m.text || "").trim()) out.push("What should the message say?");
  if (m.app === "email" && !/@/.test(m.email || "")) out.push("Their email address");
  if (m.app === "sms" && !digits(m.phone)) out.push("Their phone number");
  if (!(m.at > now) && (!m.repeat || m.repeat === "none")) out.push("That time has passed — when should it go?");
  return out;
}

/** "Yearly · 3 Feb · 9:00" — the line under a scheduled message (English for tr(); the page formats the date). */
export const REPEAT_LINE = { none: "Once", daily: "Every day", weekly: "Every week", monthly: "Every month", yearly: "Every year" };

// ---- auto-reply ------------------------------------------------------------------------------------------------------------
export const RULE_PRESETS = [
  { id: "driving", name: "Driving", icon: "🚗", text: "I'm driving now — I'll call you when I arrive.", textAr: "بسوق دلوقتي، هكلمك أول ما أوصل", mode: "now" },
  { id: "busy", name: "In a meeting / praying", icon: "🕌", text: "I'm in a meeting — I'll answer you shortly.", textAr: "في اجتماع، هرد عليك بعد شوية", mode: "silent" },
  { id: "night", name: "Night", icon: "🌙", text: "I'll answer you in the morning.", textAr: "هرد عليك الصبح إن شاء الله", mode: "hours", from: "23:00", to: "07:00" },
];
export function newRule(p = {}, now = Date.now()) {
  return { id: p.id && !/^(driving|busy|night)$/.test(p.id) ? p.id : "ar" + now.toString(36), name: p.name || "Auto-reply", icon: p.icon || "💬", text: p.text || "", on: p.on !== false,
    mode: p.mode || "now", from: p.from || "23:00", to: p.to || "07:00", apps: p.apps || ["whatsapp", "wab", "sms", "telegram"], who: p.who || "all", list: p.list || [],
    groups: !!p.groups, once: p.once !== false };
}
const mins = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "")); return m ? +m[1] * 60 + +m[2] : null; };
/** Is the time inside from–to (a span over midnight works: 23:00–07:00)? */
export function inHours(from, to, d = new Date()) {
  const a = mins(from), b = mins(to), x = d.getHours() * 60 + d.getMinutes(); if (a == null || b == null) return false;
  return a <= b ? x >= a && x < b : x >= a || x < b;
}
const norm = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
/** Would this rule answer this message? msg = { app, who, group }; st = { now, silent, replied: { "<rule>|<key>": day } } */
export function ruleFits(r, msg, st = {}) {
  if (!r || !r.on || !String(r.text || "").trim() || !msg) return false;
  if (msg.group && !r.groups) return false;
  if ((r.apps || []).length && !(r.apps || []).includes(msg.app)) return false;
  const w = norm(msg.who), inList = (r.list || []).some((n) => norm(n) && (w === norm(n) || w.includes(norm(n))));
  if (r.who === "only" && !inList) return false;
  if (r.who === "except" && inList) return false;
  if (r.mode === "silent" && !st.silent) return false;
  if (r.mode === "hours" && !inHours(r.from, r.to, new Date(st.now || Date.now()))) return false;
  if (r.once) { const day = new Date(st.now || Date.now()).toDateString(); if ((st.replied || {})[r.id + "|" + (msg.key || msg.who)] === day) return false; }
  return true;
}

/** A sentence → a scheduled message: "send Mama every year on 3 Feb at 9 'happy birthday'", "sms Ahmed tomorrow at 5 …".
 *  Uses the existing reader for who / when / words (agents2.js parseScheduled) and adds the app and how it repeats. */
export function appIn(text) {
  const t = String(text || "").toLowerCase();
  if (/\b(sms|text message)\b|رساله نصيه|رسالة نصية|اس ام اس/.test(t)) return "sms";
  if (/\btelegram\b|تليجرام|تلجرام/.test(t)) return "telegram";
  if (/\b(e-?mail|gmail)\b|ايميل|إيميل|بريد/.test(t)) return "email";
  if (/whatsapp business|wa business|واتس بيزنس|واتساب بيزنس/.test(t)) return "wab";
  return "whatsapp";
}
export function repeatIn(text) {
  const t = String(text || "").toLowerCase();
  if (/\bevery (year|birthday)\b|\byearly\b|\bannually\b|كل سنه|كل سنة|سنويا/.test(t)) return "yearly";
  if (/\bevery month\b|\bmonthly\b|كل شهر|شهريا/.test(t)) return "monthly";
  if (/\bevery week\b|\bweekly\b|كل اسبوع|كل أسبوع|اسبوعيا/.test(t)) return "weekly";
  if (/\bevery day\b|\bdaily\b|كل يوم|يوميا/.test(t)) return "daily";
  return "none";
}

/** The Sent tab: the phone's log (scheduled sends + auto-replies), newest first, with how each went. */
export const HOW = { reply: "Sent by itself (chat reply)", auto: "Sent by itself", sms: "Sent by itself (SMS)", opened: "Opened — you pressed Send", asked: "Waiting for your OK", autoreply: "Auto-reply", failed: "Not sent" };
export function sentList(log) {
  return (Array.isArray(log) ? log : []).filter((x) => x && x.at).sort((a, b) => b.at - a.at).slice(0, 200);
}

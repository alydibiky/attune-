/* ---- v9.9.3 W2 (Ali picked: "open apps straight to the right screen — ask which Ahmed if it doesn't know and I can choose the
   contact; most important: it must not affect whether Google Play accepts Attune"). A sentence → the app opened at the right place
   with the words written; the person presses the last button (Send / Call / Request). Only links the apps themselves offer:
   wa.me, sms:, tel: (the DIALER — no CALL_PHONE), mailto:, Uber's ride link, Google Maps directions. No Accessibility, no contacts
   permission (a contact comes from Android's own picker, one at a time), nothing sent by itself.
   readOpen(text) → { kind: "msg"|"call"|"email"|"ride"|"maps", who?, text?, app?, dest?, subject? } | null
   whoFor(name, dir) → { card } (sure, with a number) | { ask: [cards with that name] } — "Which Ahmed?" (+ Pick from contacts)
   linkOf(x, phone) → the link. Pure; tests: tests/unit/v993applinks.test.mjs. */
import { mentions } from "./entities.js";

const digits = (p) => String(p || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
/** An Egyptian 01x number → 201x for wa.me; others as written. */
export const intl = (p) => { const d = digits(p); return /^01\d{9}$/.test(d) ? "2" + d : /^00/.test(d) ? d.slice(2) : d; };
const strip = (s) => String(s || "").replace(/^[\s"“«'‘]+|[\s"”»'’.!]+$/g, "").trim();

export function readOpen(text) {
  const t = String(text || "").trim(); if (!t || t.length > 300) return null;
  let m;
  // a message now (a time → it is a scheduled message, Messages' job): "send Ahmed 'I'm on my way' on WhatsApp", «ابعت لأحمد إني جاي»
  if ((m = /^(?:please\s+)?(?:send|message|text|whatsapp|telegram|sms)\s+(?:a\s+(?:message|text)\s+)?(?:to\s+)?(.+)$/i.exec(t)) || (m = /^(?:ابعت|ابعتلي|ابعتي|راسل|كلم ع الواتس|قول)\s+(?:رسالة\s+|رساله\s+)?(?:ل|لـ)?\s*(.+)$/.exec(t))) {
    if (/\b(at|tomorrow|tonight|on (mon|tue|wed|thu|fri|sat|sun)|every)\b|بكره|بكرة|الساعه|الساعة|كل يوم|كل اسبوع/i.test(t)) return null;
    const rest = m[1];
    const q = /["“«]([^"”»]{1,500})["”»]/.exec(rest) || /(?:^|\s)['‘](.{1,500}?)['’](?=\s|[.!?]?$)/.exec(rest) || /(?::|\bsaying\b|\bthat\b|قوله|قولها|إن|ان)\s*(.{1,500})$/i.exec(rest);
    const words = q ? strip(q[1]) : "";
    const who = strip(rest.split(/\s+(?:saying|that|on|via|in|قوله|قولها|على|ع|إن|ان)(?![\p{L}])|[:"“«,،]|\s['‘]/iu)[0]).replace(/^ل(?=\S)/, "");
    const app = /\btelegram\b|تليجرام/i.test(t) ? "telegram" : /\bsms\b|رسالة عادية|رساله عاديه/i.test(t) ? "sms" : "whatsapp";
    if (!who) return null;
    return { kind: "msg", who, text: words, app };
  }
  if ((m = /^(?:please\s+)?(?:call|ring|dial|phone)\s+(.{2,40})$/i.exec(t)) || (m = /^(?:كلم|كلملي|اتصل ب|اتصل على|رن على|رنلي على)\s*(.{2,40})$/.exec(t))) {
    // v9.9.17 (the hard run): "phone cover 800" is a purchase, not a call; "call Ahmed tomorrow at 5" is a reminder (Messages / reminders' job)
    if (/^\s*phone\s/i.test(t) && /\d/.test(m[1]) && !/\d{7,}/.test(m[1].replace(/[\s-]/g, ""))) return null;
    if (/\b(at \d|tomorrow|tonight|on (mon|tue|wed|thu|fri|sat|sun)|every|in \d+ (min|hour))\b|بكره|بكرة|الساعه|الساعة|كل يوم|كمان|بعد /i.test(t)) return null;
    return { kind: "call", who: strip(m[1]).replace(/^ب(?=\S)/, "").replace(/\s+now$/i, "") };
  }
  if ((m = /^(?:please\s+)?(?:e-?mail|mail)\s+(.{2,40}?)(?:\s+(?:about|re|subject)\s+(.{1,120}))?$/i.exec(t)) || (m = /^(?:ابعت|ابعتلي)\s+(?:ايميل|إيميل|ميل)\s+(?:ل|لـ)?\s*(.{2,40}?)(?:\s+عن\s+(.{1,120}))?$/.exec(t))) return { kind: "email", who: strip(m[1]), subject: strip(m[2] || "") };
  if ((m = /^(?:please\s+)?(?:(?:get|book|order|call)\s+(?:me\s+)?(?:an?\s+)?)?(uber|careem|indrive|a ride|a taxi|a car)\s+(?:to|for)\s+(.{2,80})$/i.exec(t)) || (m = /^(?:اطلبلي|اطلب)\s+(اوبر|أوبر|كريم|عربيه|عربية|تاكسي)\s+(?:ل|لـ|على|الى|إلى)\s*(.{2,80})$/.exec(t))) {
    const app = /careem|كريم/i.test(m[1]) ? "careem" : /indrive/i.test(m[1]) ? "indrive" : "uber";
    return { kind: "ride", app, dest: strip(m[2]) };
  }
  if ((m = /^(?:please\s+)?(?:directions|navigate|take me|drive me|route)\s+(?:to\s+)?(.{2,80})$/i.exec(t)) || (m = /^(?:وديني|خدني|الطريق|وصلني)\s+(?:ل|لـ|على|الى|إلى)?\s*(.{2,80})$/.exec(t))) return { kind: "maps", dest: strip(m[1]) };
  return null;
}

/** The person: sure (one card with a number) or "Which Ahmed?" (every card with that name, and Pick from contacts). */
export function whoFor(name, dir) {
  const items = (dir && dir.items) || [], ms = mentions(name, dir) || [];
  const ids = ms.length ? ms[0].ids : [];
  const cards = ids.map((id) => items.find((p) => p.id === id)).filter(Boolean);
  const withPhone = cards.filter((c) => c.contact && c.contact.phone);
  if (withPhone.length === 1 && cards.length === 1) return { card: withPhone[0] };
  // one learnt pick for this name ("Ahmed" = Ahmed Salah, from "Which Ahmed?" before) wins when it has a number
  const best = withPhone.slice().sort((a, b) => ((b.picks || {})["__name:" + name.toLowerCase()] || 0) - ((a.picks || {})["__name:" + name.toLowerCase()] || 0))[0];
  if (best && ((best.picks || {})["__name:" + name.toLowerCase()] || 0) > 0) return { card: best };
  return { ask: withPhone, name };
}
export const rememberPick = (dir, id, name) => ({ ...dir, items: dir.items.map((p) => (p.id === id ? { ...p, picks: { ...(p.picks || {}), ["__name:" + String(name).toLowerCase()]: ((p.picks || {})["__name:" + String(name).toLowerCase()] || 0) + 1 } } : p)) });

/** The link that opens the app there. */
export function linkOf(x, phone = "") {
  const e = encodeURIComponent;
  if (x.kind === "msg") return x.app === "sms" ? "sms:" + digits(phone) + (x.text ? "?body=" + e(x.text) : "") : x.app === "telegram" ? "" : "https://wa.me/" + intl(phone) + (x.text ? "?text=" + e(x.text) : "");
  if (x.kind === "call") return "tel:" + digits(phone);
  if (x.kind === "email") return "mailto:" + (phone && /@/.test(phone) ? phone : "") + (x.subject ? "?subject=" + e(x.subject) : "");
  if (x.kind === "ride") return x.app === "uber" ? "https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=" + e(x.dest) : "https://www.google.com/maps/dir/?api=1&destination=" + e(x.dest);
  if (x.kind === "maps") return "https://www.google.com/maps/dir/?api=1&destination=" + e(x.dest);
  return "";
}
export const PKG = { whatsapp: "com.whatsapp", telegram: "org.telegram.messenger", uber: "com.ubercab", careem: "com.careem.acma", indrive: "sinet.startup.inDriver", maps: "com.google.android.apps.maps" };
export const needsPerson = (x) => x && (x.kind === "msg" || x.kind === "call");

// v9.9.17 (the hard run: "open Money", "go to Agents", «افتح الفلوس» went to the AI): a page of Attune by its name → its id (attune-open)
const PAGES = [["money", /^(?:the )?money$|^(?:ال)?فلوس$|^(?:ال)?مصاريف$/i], ["agents", /^(?:the |my )?agents$|^(?:ال)?وكلاء$|^(?:ال)?وكلا$/i], ["reminders", /^(?:the |my )?reminders$|^(?:ال)?تذكيرات$|^تذكيراتي$/i], ["recall", /^recall$/i],
  ["radar", /^(?:the |my )?dates$|^(?:ال)?مواعيد$/i], ["timeline", /^(?:the |my )?timeline$/i], ["guide", /^how to use$|^(?:the )?guide$|^help$|^ازاي استخدم$/i], ["privacy", /^privacy$|^(?:ال)?خصوصية$/i], ["travel", /^travel$|^(?:ال)?سفر$/i],
  ["translate", /^translate$|^(?:ال)?ترجمة$/i], ["tools", /^(?:the )?tools$|^(?:ال)?ادوات$|^(?:ال)?أدوات$/i], ["home", /^home$|^(?:ال)?رئيسية$/i]];
/** "open Money" / "go to Agents" / «افتح الفلوس» → the page's id, or "". */
export function pageOf(text) {
  const m = /^\s*(?:please\s+)?(?:open|go to|show me|take me to|show)\s+(.{2,30}?)\s*[.!]?\s*$/i.exec(String(text || "")) || /^\s*(?:افتح|افتحلي|روح على|وديني على|وريني)\s+(.{2,30}?)\s*$/.exec(String(text || ""));
  if (!m) return ""; const name = m[1].trim(); const hit = PAGES.find(([, re]) => re.test(name)); return hit ? hit[0] : "";
}

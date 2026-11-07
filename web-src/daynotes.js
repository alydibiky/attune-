/* ---- v9.3 Notifications → your day (Ali, 5 Nov 2026: "if the app does not read all notifications it won't be very useful … WhatsApp
   messages, YouTube, Instagram, SMS notifications — it will help in planning my day or knowing everything about my day … make sure
   it happens offline and there are no privacy issues").
   The phone already keeps the notifications the person gets (RecallLog.kt — on the phone only, never one-time codes, SMS only with
   the SMS switch on). This reads them, ON THE PHONE, into the day:
     · who wrote to you today (chats, SMS, email) — newest first, how many messages, the last line;
     · what someone asked for at a time ("can we meet tomorrow at 5?", «تعالى بكرة الساعة ٥») → one tap makes it a reminder;
     · what arrives today (deliveries, rides, orders);
     · everything else counted by kind (Instagram, YouTube, …), so the day's picture is complete without being noisy.
   Each app can be left out (Settings → Your day). Nothing leaves the phone; no model is needed (pure code). Tests:
   tests/unit/v930daynotes.test.mjs.                                                                                                */
import { understandNote } from "./notifmeaning.js";
import { parseTime } from "./actions.js";

const P = (s) => new Set(s.split(" "));
export const APP_KINDS = {
  chat: P("com.whatsapp com.whatsapp.w4b org.telegram.messenger org.telegram.messenger.web org.thunderdog.challegram com.facebook.orca com.facebook.mlite org.thoughtcrime.securesms com.viber.voip jp.naver.line.android com.imo.android.imoim com.discord com.microsoft.teams com.Slack com.google.android.apps.dynamite"),
  sms: P("com.google.android.apps.messaging com.samsung.android.messaging com.android.mms com.android.messaging com.hihonor.mms com.huawei.message com.miui.mms com.oneplus.mms com.coloros.mms com.vivo.message"),
  email: P("com.google.android.gm com.google.android.gm.lite com.microsoft.office.outlook com.samsung.android.email.provider com.yahoo.mobile.client.android.mail ch.protonmail.android com.huawei.email com.android.email com.readdle.spark me.bluemail.mail com.easilydo.mail"),
  social: P("com.instagram.android com.facebook.katana com.facebook.lite com.zhiliaoapp.musically com.ss.android.ugc.trill com.twitter.android com.snapchat.android com.linkedin.android com.reddit.frontpage com.pinterest"),
  video: P("com.google.android.youtube com.netflix.mediaclient com.google.android.apps.youtube.music com.spotify.music com.anghami com.shahid.app com.osn.go com.watchit"),
  shop: P("com.amazon.mShop.android.shopping in.amazon.mShop.android.shopping com.noon.buyerapp com.talabat com.jumia.android com.aramex.mobile com.ubercab com.ubercab.eats com.careem.acma com.careem.adma ee.mtakso.client com.instashop.android com.breadfast com.rabbitmart com.swvl.rider com.indriver"),
  calendar: P("com.google.android.calendar com.samsung.android.calendar com.microsoft.office.outlook.calendar"),
};
const KIND_OF = new Map(Object.entries(APP_KINDS).flatMap(([k, set]) => [...set].map((p) => [p, k])));
/** The kind of an app: chat · sms · email · social · video · shop · calendar · other (by its package, else by its name). */
export function kindOf(pkg = "", app = "") {
  if (KIND_OF.has(pkg)) return KIND_OF.get(pkg);
  const a = String(app || pkg).toLowerCase();
  if (/messag|sms|mms|رسائل/.test(a)) return "sms";
  if (/mail|بريد/.test(a)) return "email";
  if (/whatsapp|telegram|signal|chat/.test(a)) return "chat";
  if (/instagram|facebook|tiktok|snapchat|twitter|threads/.test(a)) return "social";
  if (/youtube|netflix|spotify|music/.test(a)) return "video";
  if (/calendar|تقويم/.test(a)) return "calendar";
  return "other";
}
const PEOPLE = new Set(["chat", "sms", "email"]);
const SUMMARY = /^\d+\s+(new\s+)?messages?\b|\b\d+\s+(new\s+)?messages?\s+from\s+\d+\s+chats?\b|^\d+\s+رسائل|^\d+\s+رساله|رسائل جديدة/i;
const ASKY = /\b(meet|meeting|appointment|call|visit|come|pick (?:me|you|up)|dinner|lunch|interview|deadline|due|class|lesson|doctor|dentist|session|match|party|wedding|event|reservation|booking|flight|check-?in|remind)\b|\?|نتقابل|نتقابلوا|ميعاد|معاد|موعد|اجتماع|كلمني|اتصل|تعالي|تعالى|هاجي|هنروح|نروح|عزومه|عزومة|فرح|خطوبه|خطوبة|حفله|حفلة|درس|سكشن|محاضره|محاضرة|دكتور|امتحان|تسليم|حجز|طياره|طيارة|؟/iu;
const DELIVERY = /\b(out for delivery|arriving today|arrives today|will be delivered|on (?:its|the) way|delivered|your (?:order|package|parcel|shipment)|driver is|captain is|is arriving|has arrived|picked up)\b|في الطريق|خرج للتوصيل|هيوصلك|هيوصل|وصل طلبك|طلبك|الشحنه|الشحنة|المندوب|الكابتن/iu;
const EVENING = /\b(dinner|supper|tonight|evening|night|pm|p\.m\.)\b|عشا|عشاء|نتعشي|نتعشى|العشا|بالليل|الليله|الليلة|المسا|مساء|مساءا/iu;
const money = /\b(debited|credited|purchase|payment|transfer|otp)\b|خصم|ايداع|إيداع|تحويل|رصيد/i;

const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** The sender of a chat notification: "Ahmed", "Family: Ahmed" → the group and the person; email "Name <x@y>" → Name. */
export function senderOf(n) {
  let t = String((n && n.title) || "").replace(/\s*\(\d+\s*(?:messages?|رسائل|رساله|رسالة)\)\s*$/i, "").trim();
  const g = /^(.+?)\s*[:：@]\s*(.+)$/.exec(t);
  if (g && n && kindOf(n.pkg, n.app) === "chat") return { who: g[2].trim(), group: g[1].trim() };
  t = t.replace(/\s*<[^>]+>\s*$/, "").trim();
  return { who: t || String((n && n.app) || ""), group: "" };
}

/** The notifications → the day. notes: [{ id, pkg, app, title, text, ts }] (RecallLog, newest first or any order).
 *  → { people: [{ who, group, app, kind, n, last, at }], asks: [{ id, who, app, text, at (when it is for), from (ms the message came) }],
 *      arriving: [{ app, text, at }], counts: { social: n, video: n, email: n, … }, total, apps: [{ app, n }] (the other apps, most first) } */
export function dayFromNotes(notes, { now = Date.now(), offApps = [], asksDays = 3 } = {}) {
  const off = new Set(offApps || []), today = startOfDay(now), askFrom = now - asksDays * 864e5;
  const list = (notes || []).filter((n) => n && n.ts && n.ts <= now + 60e3 && !off.has(n.pkg) && !SUMMARY.test(String(n.text || "")) && !SUMMARY.test(String(n.title || "")))
    .sort((a, b) => b.ts - a.ts);
  const people = new Map(), asks = [], arriving = [], counts = {}, seenAsk = new Set(), apps = new Map();
  let total = 0;
  for (const n of list) {
    const kind = kindOf(n.pkg, n.app), text = String(n.text || "").trim(), isToday = n.ts >= today;
    if (isToday) { total++; counts[kind] = (counts[kind] || 0) + 1; if (!PEOPLE.has(kind)) apps.set(n.app || n.pkg, (apps.get(n.app || n.pkg) || 0) + 1); }
    if (PEOPLE.has(kind) && isToday && !money.test(text)) {
      const s = senderOf(n), key = (s.group || s.who) + "|" + kind;
      const p = people.get(key);
      if (!p) people.set(key, { who: s.who, group: s.group, app: n.app || "", pkg: n.pkg || "", kind, n: 1, last: text.slice(0, 140), at: n.ts });
      else p.n++;
    }
    if (PEOPLE.has(kind) && n.ts >= askFrom && ASKY.test(text) && !money.test(text)) {
      const t = parseTime(text, n.ts);
      // «الساعة ٨ نتعشى» / "dinner at 8": an evening word and no am/pm said → the evening, not 8 in the morning
      if (t && t.said && t.said.time && new Date(t.at).getHours() < 12 && EVENING.test(text) && !/\b(am|a\.m\.)\b|الصبح|صباحا|ص(?![\p{L}])/iu.test(text)) t.at += 12 * 36e5;
      if (t && t.at > now && t.at - now < 21 * 864e5 && t.said && t.said.time) {
        const s = senderOf(n), k = s.who + "|" + Math.round(t.at / 6e4);
        if (!seenAsk.has(k)) { seenAsk.add(k); asks.push({ id: String(n.id || n.ts), who: s.who, group: s.group, app: n.app || "", text: text.slice(0, 160), at: t.at, from: n.ts }); }
      }
    }
    if ((kind === "shop" || kind === "sms" || kind === "email" || kind === "other") && isToday && DELIVERY.test(text + " " + (n.title || "")) && !money.test(text) && arriving.length < 5 && (() => { try { return understandNote(n).kind !== "promo"; } catch (e) { return true; } })())   // (v9.8: "300 EGP OFF … delivered in 15 minutes" is an offer)
      arriving.push({ app: n.app || "", text: (n.title ? n.title + " — " : "") + text.slice(0, 120), at: n.ts });
  }
  return { people: [...people.values()].sort((a, b) => b.at - a.at), asks: asks.sort((a, b) => a.at - b.at), arriving, counts, total,
    apps: [...apps.entries()].map(([app, n]) => ({ app, n })).sort((a, b) => b.n - a.n) };
}

/** A reminder made from something asked in a message ("Ahmed: can we meet tomorrow at 5?") — the person taps Add. */
export function reminderFromAsk(a) {
  const words = String(a.text || "").replace(/\s+/g, " ").trim();
  return { id: "ask-" + Math.round(a.at / 6e4).toString(36) + "-" + String(a.who || "").slice(0, 12).replace(/\W+/g, ""), at: a.at, title: (a.who ? a.who + ": " : "") + (words.length > 70 ? words.slice(0, 67) + "…" : words), body: a.app || "", repeat: "none" };
}

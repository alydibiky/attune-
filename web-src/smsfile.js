/* ---- v8.7 (Ali, 29 Oct: "fix that — but don't remove the feature"): the old bank SMS WITHOUT the SMS permission.
   Google Play Protect blocks an APK installed from a file that asks for READ_SMS, so Attune reads a BACKUP FILE of the SMS
   instead: the person saves their messages once with a free SMS backup app (SMS Backup & Restore makes an .xml; others a
   .json), picks the file in Money, and Attune keeps only the bank and wallet messages of the last 12 months — never a
   one-time code — which then wait in Money's review list like the payment notifications (paylog.js reads each one).
     parseSmsBackup(text)       → [{ who, text, ts, inbox }]   (SMS Backup & Restore XML; a JSON list of {address, body, date})
     moneySms(list, { now })    → the review list's items [{ id, pkg: "sms", app: "SMS", title, text, ts }]
   Pure; tests: tests/unit/v870smsfile.test.mjs.                                                                          */
import { readNotification } from "./paylog.js";

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unent = (s) => String(s || "").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()]));
const attrs = (s) => { const o = {}; for (const m of String(s).matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) o[m[1].toLowerCase()] = unent(m[2]); return o; };

/** A backup file's text → every message in it. */
export function parseSmsBackup(text) {
  const t = String(text || "").trim(), out = [];
  if (t.startsWith("<") || /<sms\b/i.test(t.slice(0, 5000))) {
    for (const m of t.matchAll(/<sms\b([^>]*?)\/?>/gi)) {
      const a = attrs(m[1]);
      if (!a.body) continue;
      // type 1 = received (2 = sent, 3 = draft …)
      out.push({ who: a.contact_name && a.contact_name !== "(Unknown)" ? a.contact_name : a.address || "", text: a.body, ts: +a.date || 0, inbox: !a.type || a.type === "1" });
    }
    return out;
  }
  try {
    const j = JSON.parse(t), list = Array.isArray(j) ? j : j.messages || j.sms || j.smses || [];
    for (const x of list) {
      const body = x.body || x.text || x.message || ""; if (!body) continue;
      const ts = typeof x.date === "number" ? x.date : Date.parse(x.date || x.time || x.timestamp || "") || +x.date || 0;
      out.push({ who: x.contact_name || x.name || x.address || x.sender || x.from || "", text: body, ts, inbox: x.type == null || String(x.type) === "1" || /inbox|received/i.test(String(x.type || x.folder || "")) });
    }
  } catch (e) {}
  return out;
}

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
/** The bank / wallet messages received in the last `days` (one-time codes, adverts and balance-only messages are dropped by
 *  the same reader as the notifications), newest first, at most 1500. */
export function moneySms(list, { now = Date.now(), days = 366, opts } = {}) {
  const since = now - days * 864e5, out = [];
  for (const m of list || []) {
    if (!m.inbox || !m.ts || m.ts < since || m.ts > now + 864e5) continue;
    const n = { id: "smsf:" + hash(m.who + "|" + m.ts + "|" + m.text.slice(0, 120)), pkg: "sms", app: "SMS", title: m.who, text: m.text, ts: m.ts };
    if (readNotification(n, opts)) out.push(n);
  }
  return out.sort((a, b) => b.ts - a.ts).slice(0, 1500);
}

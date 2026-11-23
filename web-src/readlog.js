/* ---- v10.9.3 "Read from your messages" (Ali, 23 Nov 2026, his note on BK1: "make me able to see the message or the notifications that
   were saved and saved to what"; then OK-BK on docs/mockups/quick-input-combined.html — BK2 a live line on Money, BK3 a phone
   notification if reading stops).
   Pure logic, three parts:
     readLog()   every bank SMS / notification Attune read, newest first: the full message, and where it went (Money · category · shop ·
                 amount) — or, greyed, why it was left alone (a one-time code, only a balance, an offer, declined, a chat …);
     liveLine()  the one line at the top of Money: green "Reading bank messages · N today · last HH:MM", amber the moment Android
                 paused the reader, notification access is off or the SMS switch is off;
     stopAlert() BK3 — must the phone say "Attune stopped reading bank messages"? The SAME rule is in ReadWatch.kt (keep the two equal;
                 tests/readlog/gen.mjs runs 10,000 composed timelines on this copy).
   Inputs are plain data (the ledger, NativeBridge.payQueue(), NativeBridge.smsDiag()). Nothing here writes anything. */
import { readNotification, alreadyIn } from "./paylog.js";

const H = 3600e3, D = 24 * H;
/** Silent this long while the phone is in use → the reader counts as stopped (the same as bankcheck.js QUIET_H). */
export const SILENT_H = 6;
/** At most one "stopped" notification a day. */
export const ALERT_GAP_H = 24;
/** No "stopped" notification at night (local hours: from 23:00 to 08:00). */
export const NIGHT = [23, 8];

/** Why a message was left alone — the words the page shows (English; the page passes them through tr()). */
export const WHY = {
  code: "A one-time code — never kept",
  balance: "Only a balance — no money moved",
  notyet: "Not paid yet — a bill or a renewal that is coming",
  offer: "An offer or an advert",
  failed: "Declined or failed — no money moved",
  person: "From a person's number, not a bank",
  post: "A post or a video, not a payment",
  price: "A price, not a payment",
  scam: "Looks like a scam — left alone",
  chat: "A chat — people talk about money there, it isn't a payment",
  taught: "You told Attune to leave this sender alone",
  notmoney: "Not about your money",
  unsure: "Attune couldn't be sure of the amount — not added",
  empty: "No words in it",
  hidden: "Your SMS app hid the words (“1 new message”)",
  twice: "The same payment, sent twice — kept once",
  already: "Already in Money — you added it yourself",
  waiting: "Waiting for your OK",
};

const when = (t) => +(t && (t.created || t.at || t.ts)) || Date.parse(String((t && t.date) || "") + "T12:00:00") || 0;
const evOf = (t) => (t && t.evidence) || {};

/** → [{ key, ts, kind: saved | waiting | already | twice | left, text, from, app, why?, txn?, entry? }], newest first. */
export function readLog({ ledger = {}, queue = [], diag = {}, now = Date.now(), days = 30, opts } = {}) {
  const since = now - days * D, out = [];
  const txns = ((ledger && ledger.txns) || []).filter((t) => t && t.source === "notification" && Number(t.amount) > 0);
  const saved = new Map();
  for (const t of txns) {
    const ts = when(t); if (ts < since) continue;
    const e = evOf(t);
    const it = { key: "t:" + t.id, ts, kind: "saved", text: String(e.text || ""), from: String(e.from || ""), app: String(e.app || ""),
      txn: { id: t.id, type: t.type, amount: Number(t.amount), cat: t.cat || "other", note: String(t.note || ""), date: t.date, currency: t.currency || "" } };
    out.push(it); saved.set(t.id, it);
  }
  const seenPay = [];
  for (const n of [...(queue || [])].filter((x) => x && +x.ts >= since).sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
    const why = {}; let e = null; try { e = readNotification(n, opts, why); } catch (x) { e = null; }
    const text = String((e && e.full) || [n.title, n.text].filter(Boolean).join(" — ") || ""), base = { ts: +n.ts || 0, text, from: String(n.title || ""), app: String(n.app || n.pkg || "") };
    if (!e) { out.push({ key: "q:" + n.id, kind: "left", why: why.r || "unsure", ...base }); continue; }
    // already in Money: read from this very notification (its id, or the same words) — the saved row is that message, nothing to add
    const mine = txns.find((t) => (t.nid && t.nid === n.id) || (evOf(t).text && evOf(t).text === e.full && Math.abs(when(t) - e.ts) < 10 * 60000));
    if (mine) { const s = saved.get(mine.id); if (s && !s.text) Object.assign(s, { text, from: base.from, app: base.app }); continue; }
    const hit = alreadyIn(e, ledger);
    if (hit && hit.source === "notification") { const s = saved.get(hit.id); if (s && !s.text) Object.assign(s, { text, from: base.from, app: base.app }); if (s) continue; }
    if (seenPay.some((x) => x.direction === e.direction && Math.abs(x.amount - e.amount) < 0.005 && Math.abs(x.ts - e.ts) < 10 * 60000)) { out.push({ key: "q:" + n.id, kind: "twice", why: "twice", ...base, entry: e }); continue; }
    seenPay.push(e);
    if (hit) { out.push({ key: "q:" + n.id, kind: "already", why: "already", ...base, entry: e, txn: { id: hit.id, type: hit.type, amount: Number(hit.amount), cat: hit.cat || "other", note: String(hit.note || ""), date: hit.date } }); continue; }
    out.push({ key: "q:" + n.id, kind: "waiting", why: "waiting", ...base, entry: e });
  }
  // the SMS trace (never the words): a one-time code, or an SMS whose words the Messages app hid — unless that message is listed already
  for (const s of (Array.isArray(diag && diag.sms) ? diag.sms : [])) {
    if (!s || !(+s.ts >= since) || !(s.otp || s.hidden)) continue;
    const from = String(s.from || "");
    if (out.some((x) => Math.abs(x.ts - s.ts) < 2 * 60000 && x.from && x.from === from)) continue;
    out.push({ key: "s:" + s.ts + ":" + from, ts: +s.ts, kind: "left", why: s.otp ? "code" : "hidden", text: "", from, app: String(s.pkg || "") });
  }
  return out.sort((a, b) => b.ts - a.ts).slice(0, 300);
}

/** How many were saved to Money today (local day) and the last one's time. */
export function todayCount(ledger, now = Date.now()) {
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  let n = 0, last = 0;
  for (const t of ((ledger && ledger.txns) || [])) if (t && t.source === "notification" && Number(t.amount) > 0) { const w = when(t); if (w >= +d0 && w <= now + 60000) n++; if (w > last && w <= now + 60000) last = w; }
  return { n, last };
}

/** BK2 — the line at the top of Money. → null (nothing to say: a computer with nothing read on the phone) or
 *  { tone: ok | warn, state: ok | asleep | off | smsoff | phone, n, last } — `phone` = this device has no reader (the computer): what the
 *  phone read, from the synced Money. */
export function liveLine({ reader = true, access = false, diag = {}, ledger = {}, now = Date.now() } = {}) {
  const { n, last } = todayCount(ledger, now);
  if (!reader) return last ? { tone: "ok", state: "phone", n, last } : null;
  if (!access) return { tone: "warn", state: "off", n, last };
  const d = diag || {};
  if (d.smsSwitch === false) return { tone: "warn", state: "smsoff", n, last };
  const seen = Math.max(+d.seen || 0, +d.conn || 0, +d.rescan || 0);
  if (d.live === false || (seen > 0 && now - seen > SILENT_H * H)) return { tone: "warn", state: "asleep", n, last, seen };
  return { tone: "ok", state: "ok", n, last };
}

const inNight = (hour) => (NIGHT[0] > NIGHT[1] ? hour >= NIGHT[0] || hour < NIGHT[1] : hour >= NIGHT[0] && hour < NIGHT[1]);
/** BK3 — should the phone say that reading stopped? (ReadWatch.kt runs the same rule every hour.)
 *  in: { was: notification access was on once, access, seen, conn (ms), now, hour (local 0–23), interactive (the screen is on now),
 *        lastAlert (ms), sms: [{ ts, money, otp, sw }] (SmsDiag) }
 *  → null, or why: off (access was turned off) · smsoff (a money SMS came while the SMS switch is off) · silent (nothing for 6 h while
 *  the phone is in use). At most one a day, never at night. */
export function stopAlert({ was = false, access = false, seen = 0, conn = 0, now = Date.now(), hour = 12, interactive = true, lastAlert = 0, sms = [] } = {}) {
  if (!was) return null;   // the person never turned it on — the Set up step asks, not a notification
  if (lastAlert && now - lastAlert < ALERT_GAP_H * H) return null;
  if (inNight(hour) || !interactive) return null;
  if (!access) return "off";
  if ((sms || []).some((s) => s && s.sw === false && s.money && !s.otp && now - +s.ts >= 0 && now - +s.ts <= SILENT_H * H)) return "smsoff";
  const last = Math.max(+seen || 0, +conn || 0);
  if (last > 0 && now - last >= SILENT_H * H) return "silent";
  return null;
}

/** The notification's words for each reason (English; the page sends them translated to ReadWatch.kt). */
export const ALERT = {
  off: { t: "Attune stopped reading bank messages", d: "Notification access was turned off. Tap Fix it now to turn it on again." },
  smsoff: { t: "A bank SMS came, but SMS reading is off", d: "Tap Fix it now — Attune turns it on and reads it." },
  silent: { t: "Attune stopped reading bank messages", d: "Android paused it. Tap Fix it now — Attune reconnects and reads what is still on your screen." },
  fix: "Fix it now", later: "Not now",
  again: { t: "Attune is reading again ✓", d: "Tap to see what was read and where it went." },
};

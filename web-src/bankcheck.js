/* ---- v10.4 the bank-messages check (Ali, 18 Nov 2026: "I can't press allow or tick, it does not do anything" + "fix the SMS
   notification for good"). Before: once notification access was on, Set up your life said "Allowed ✓ — waiting for the first message"
   with no button, for ever — whether the bank SMS were waiting in Money for a tap (Free saves nothing by itself), Android had paused
   the reader, the SMS switch was off, the Messages app hid the words ("1 new message"), or no bank SMS had come at all.
   Now one pure reader looks at everything the phone knows and says WHICH of these it is, with the one button that fixes it:
     unavailable · off · done · waiting (n read, waiting for an OK → "Add them to Money") · smsoff · asleep (→ "Fix it now": reconnect +
     read the shade again) · hidden (the SMS app hides the words) · notpay (money words, but a balance / offer / code / declined) ·
     notbank (SMS arrive, none from a bank yet) · nosms (nothing arrived since the reader started).
   Inputs (all plain data): reader = this build reads notifications; access = notification access on; diag = NativeBridge.smsDiag()
   { seen, conn, rescan, live, smsSwitch, sms: [{ ts, pkg, from, hidden, money, otp, sw }] }; queue = payQueue(); old = the old SMS
   read from a backup file; done = ids already added / dismissed; ledger = Money. Tests: tests/bankcheck/gen.mjs (10,000 composed,
   HARD) + heldout.mjs + tests/unit/v1040fixes.test.mjs. */
import { inbox, alreadyIn } from "./paylog.js";

const H = 3600e3;
/** How long without a single notification before the reader counts as paused by Android (a phone in use gets many an hour). */
export const QUIET_H = 6;
/** Only the last week of SMS traces counts. */
export const SMS_DAYS = 7;

/** A payment read from a notification is already in Money (the step's own test, setup.js). */
export const hasNotifPayment = (ledger) => ((ledger && ledger.txns) || []).some((t) => t && t.source === "notification" && Number(t.amount) > 0);

/** → { state, n, add, entries, from, at } — `add` = the waiting payments that are not already in Money (what "Add them" saves). */
export function bankCheck({ reader = true, access = false, diag = {}, queue = [], old = [], done = [], ledger = {}, now = Date.now(), opts } = {}) {
  const out = (state, x = {}) => ({ state, n: 0, add: [], entries: [], from: "", at: 0, ...x });
  if (!reader) return out("unavailable");
  if (!access) return out("off");
  /* v10.9.1 (Ali, 23 Nov: "I don't even know still if bank messages are being read still"): done is no longer a dead end — it says
     how many were read this week, the last one, and whether the reader is still awake (Android can pause it after the step was done) */
  if (hasNotifPayment(ledger)) {
    const d = diag || {}, mine = ((ledger && ledger.txns) || []).filter((t) => t && t.source === "notification" && Number(t.amount) > 0);
    const when = (t) => +t.at || +t.ts || +t.created || Date.parse(String(t.date || "") + "T12:00:00") || 0;
    const lastT = mine.slice().sort((a, b) => when(b) - when(a))[0] || null, week = mine.filter((t) => now - when(t) <= 7 * 24 * H).length;
    const seen = Math.max(+d.seen || 0, +d.conn || 0, +d.rescan || 0);
    const asleep = d.live === false || (seen > 0 && now - seen > QUIET_H * H), smsoff = d.smsSwitch === false;
    return out("done", { n: week, at: lastT ? when(lastT) : 0, last: lastT ? { amount: Number(lastT.amount), note: String(lastT.note || ""), date: String(lastT.date || ""), type: lastT.type } : null, asleep, smsoff });
  }
  let entries = [];
  try { entries = inbox([...(queue || []), ...(old || [])], done || [], opts); } catch (e) { entries = []; }
  if (entries.length) { const add = entries.filter((e) => !alreadyIn(e, ledger)); return out("waiting", { n: entries.length, add, entries }); }
  const d = diag || {};
  if (d.smsSwitch === false) return out("smsoff");
  const last = Math.max(+d.seen || 0, +d.conn || 0, +d.rescan || 0);
  if (d.live === false || (last > 0 && now - last > QUIET_H * H)) return out("asleep", { at: last });
  const sms = (Array.isArray(d.sms) ? d.sms : []).filter((x) => x && +x.ts > 0 && now - +x.ts <= SMS_DAYS * 24 * H && !x.otp).sort((a, b) => b.ts - a.ts);
  if (!sms.length) return out("nosms", { at: last });
  const top = sms.slice(0, 3), hiddenN = top.filter((x) => x.hidden).length;
  if (top[0].hidden && (hiddenN >= 2 || sms.length === 1 || hiddenN === top.length)) return out("hidden", { from: String(top[0].from || ""), at: +top[0].ts });
  const m = sms.find((x) => x.money && !x.hidden);
  if (m) return out("notpay", { from: String(m.from || ""), at: +m.ts });
  return out("notbank", { from: String(top[0].from || ""), at: +top[0].ts });
}

/** The words for each state (English — the page passes them through tr()) and the buttons, in order. Action ids: allow · add ·
 *  review · fix · smson · check. */
export const SAY = {
  unavailable: { t: "This copy of Attune can't read notifications.", d: "Install the full Attune APK — it reads your bank SMS and wallet messages.", a: [] },
  off: { t: "Allow Attune to read notifications — then each bank SMS goes to Money by itself.", d: "Never one-time codes; nothing leaves the phone.", a: ["allow"] },
  done: { t: "Done — your bank messages reach Money.", d: "", a: [] },
  waiting: { t: "{n} bank payments were read and are waiting for your OK.", d: "Add them and this step is done.", a: ["add", "review"] },
  smsoff: { t: "Reading SMS is switched off.", d: "Turn it on and bank SMS go to Money (never one-time codes).", a: ["smson"] },
  asleep: { t: "Android paused Attune's notification reader.", d: "Tap Fix it now — Attune reconnects and reads the bank messages still on your screen.", a: ["fix", "allow"] },
  nosms: { t: "Working — no SMS has arrived since Attune started reading.", d: "The next bank SMS ticks this by itself. Nothing more to do.", a: ["check"] },
  hidden: { t: "Your SMS app hides the words in its notifications (“1 new message”), so Attune can't read them.", d: "In your Messages app: Settings → Notifications → show the message text (also on the lock screen). Then the next bank SMS ticks this by itself.", a: ["check"] },
  notpay: { t: "A message from {f} had money in it, but it wasn't a payment (a balance, an offer, a code or a declined card).", d: "The next real payment SMS ticks this by itself.", a: ["check"] },
  notbank: { t: "SMS arrive (the last from {f}) — none was a bank payment yet.", d: "The next bank SMS ticks this by itself. Nothing more to do.", a: ["check"] },
};
/** The button labels (English, through tr()). */
export const BTN = { allow: "Allow", add: "Add them to Money", review: "Review in Money", fix: "Fix it now", smson: "Turn SMS on", check: "Check now" };

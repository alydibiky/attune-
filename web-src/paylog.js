/* ---- v6.27 "Money tracks itself" (ROADMAP_2026-10-13.md) — the page side of PayListener.kt ------------------------------------
   The phone keeps the notifications that look like money (banks, InstaPay, wallets). Here each one is read with
   paytext.js — the same reader as a bank message shared to Attune — into an entry; one-time codes, balances-only and
   unreadable texts are dropped; the same payment notified twice (an update, or the bank AND InstaPay) is kept once.
   The entries are listed in Money to confirm; confirmed ones go to Money (Yusr) through the bridge ("add-txns").
   Pure logic; tests: tests/unit/v727paylog.test.mjs.                                                                         */
import { parsePayment } from "./yusr/paytext.js";

const OTP = /\b(otp|one[- ]time|verification code|passcode|pin)\b|رمز التحقق|كود التفعيل|كلمة المرور لمرة|رمز التفعيل/i;
const BALANCE_ONLY = /^(?=.*\b(balance|available|رصيدك|الرصيد)\b)(?!.*\b(debited|credited|charged|purchase|paid|received|transfer|withdraw|deposit|خصم|إيداع|ايداع|تحويل|سحب|شراء|استلام)\b)/i;
const PROMO = /\b(offer|discount|win|cashback offer|promo|sale|% off)\b|عرض|خصم \d+%|اربح|كاش باك/i;

/** One stored notification {id, pkg, app, title, text, ts} → an entry, or null when it isn't a payment. */
export function readNotification(n) {
  const text = [n.title, n.text].filter(Boolean).join(" — ").trim();
  if (!text || OTP.test(text) || BALANCE_ONLY.test(text) || (PROMO.test(text) && !/\b(debited|charged|received|تم خصم|تم تحويل|تم استلام)\b/i.test(text))) return null;
  const p = parsePayment(text, n.ts ? new Date(n.ts) : undefined);
  if (!p || !p.ok || !(p.amount > 0) || !p.direction || p.confidence === "low") return null;
  return { id: n.id, app: n.app || n.pkg || "", amount: p.amount, currency: p.currency || "", direction: p.direction, party: p.party || "",
    ts: n.ts || p.date || Date.now(), text: text.slice(0, 300), confidence: p.confidence };
}

/** All stored notifications → entries, newest first; the same payment twice (same direction and amount within
 *  10 minutes) is kept once; `done` = ids already added or dismissed. */
export function inbox(queue, done = []) {
  const skip = new Set(done), out = [];
  for (const n of [...(queue || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
    if (skip.has(n.id)) continue;
    const e = readNotification(n); if (!e) continue;
    if (out.some((x) => x.direction === e.direction && Math.abs(x.amount - e.amount) < 0.005 && Math.abs(x.ts - e.ts) < 10 * 60000)) continue;
    out.push(e);
  }
  return out;
}

/** The entries to hand Money: { type: expense|income, amount, currency, note, date (YYYY-MM-DD) } — note says where it came from. */
export function toTxns(entries) {
  const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  return (entries || []).filter((e) => e.amount > 0).slice(0, 50).map((e) => ({
    type: e.direction === "in" ? "income" : "expense", amount: Math.round(e.amount * 100) / 100, currency: e.currency || "",
    note: [e.party, e.app].filter(Boolean).join(" · ").slice(0, 80) || "Payment", date: iso(e.ts), source: "notification" }));
}

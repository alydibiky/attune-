/* ---- v6.27 "Money tracks itself" (ROADMAP_2026-10-13.md) — the page side of PayListener.kt ------------------------------------
   The phone keeps the notifications that look like money (banks, InstaPay, wallets). Here each one is read with
   paytext.js — the same reader as a bank message shared to Attune — into an entry; one-time codes, balances-only and
   unreadable texts are dropped; the same payment notified twice (an update, or the bank AND InstaPay) is kept once.
   The entries are listed in Money to confirm; confirmed ones go to Money (Yusr) through the bridge ("add-txns").
   Pure logic; tests: tests/unit/v727paylog.test.mjs.                                                                         */
import { parsePayment } from "./yusr/paytext.js";
import { catOf } from "./yusr/logtext.js";

// merchants Money's own words don't know yet (Egypt first; add more per country) → its categories
const MERCHANTS = [
  [/wataniya|وطنية|total ?energies|misr ?petroleum|mobil|chill ?out|emarat ?misr|shell|taqa|petrol|fuel|بنزين/i, "transport"],
  [/seoudi|سعودي|spinneys|hyper ?one|kazyon|كازيون|oscar|metro market|gourmet|lulu|bim\b|panda|kheir zaman|خير زمان|fathalla|فتح الله|ragab|رجب/i, "groceries"],
  [/swvl|careem|indrive|didi|bolt|metro|مترو/i, "transport"],
  [/elmenus|breadfast|instashop|mrsool|noon food|kfc|mcdonald|hardee|buffalo|koshary|كشري|abou ?tarek|عبو طارق/i, "food"],
  [/amazon|noon|jumia|b\.?tech|2b\b|raya|ikea|h&m|zara|defacto|lc ?waikiki|max fashion/i, "shopping"],
  [/ezaby|العزبي|seif|سيف|misr pharmac|roshdy|clinic|hospital|vezeeta|فيزيتا|lab\b|معمل/i, "health"],
  [/vodafone|orange|etisalat|e&|\bwe\b|telecom egypt|fawry|فوري|electricity|كهرباء|water|مياه|gas|غاز|netflix|shahid|spotify|osn|watch it/i, "bills"],
  [/salary|payroll|راتب|مرتب/i, "salary"],
];
/** The category of a payment from its party / note (merchants first, then Money's own words), else "other". */
export function categorise(text, direction) {
  const t = String(text || "");
  for (const [re, c] of MERCHANTS) if (re.test(t)) return direction === "in" && c !== "salary" ? "other" : c;
  const c = catOf(t);
  return c && c !== "other" && !(direction === "in" && c !== "salary") ? c : "other";
}

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
    type: e.direction === "in" ? "income" : "expense", amount: Math.round(e.amount * 100) / 100, currency: e.currency || "", cat: categorise([e.party, e.text].join(" "), e.direction),
    note: [e.party, e.app].filter(Boolean).join(" · ").slice(0, 80) || "Payment", date: iso(e.ts), source: "notification" }));
}

/** v6.27 "by itself": only what the reader is sure of is added without a tap (high confidence, a direction, an amount). */
export const autoPick = (entries) => (entries || []).filter((e) => e.confidence === "high" && e.amount > 0 && (e.direction === "in" || e.direction === "out"));

/** The same as Money's own "add-txns" (yusr/index.new.html): each entry into the first account of its currency (else the
 *  first account), id, date, note — used when Money isn't open, so its ledger is written directly. → { ledger, ids } */
export function appendToLedger(ledger, txns, now = Date.now()) {
  if (!ledger || !Array.isArray(ledger.txns) || !Array.isArray(ledger.accounts) || !ledger.accounts.length) return { ledger, ids: [] };
  const L = { ...ledger, txns: [...ledger.txns] }, ids = [];
  for (const t of (txns || []).slice(0, 50)) {
    const a = parseFloat(t.amount);
    if (!(a > 0 && a < 1e9) || (t.type !== "expense" && t.type !== "income")) continue;
    const acc = L.accounts.find((x) => t.currency && x.currency === t.currency) || L.accounts[0];
    const id = "n" + now.toString(36) + Math.random().toString(36).slice(2, 6) + ids.length;
    L.txns.push({ id, type: t.type, amount: Math.round(a * 100) / 100, cat: /^[a-z_]{2,20}$/.test(t.cat || "") ? t.cat : "other", account: acc.id, date: /^\d{4}-\d{2}-\d{2}$/.test(t.date || "") ? t.date : new Date(now).toISOString().slice(0, 10), note: String(t.note || "").slice(0, 80) });
    ids.push(id);
  }
  return { ledger: L, ids };
}

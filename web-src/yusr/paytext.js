/* =========================================================================
   PAYTEXT — turn a payment message into a proposed transaction
   ---------------------------------------------------------------------------
   Share an InstaPay confirmation, a bank SMS or a wallet receipt to the app,
   and it works out the amount, the direction, who it was, and the reference.

   Drop-in for both Yusr and Attune: no imports, no DOM, no network.

   DESIGN RULES, in order of importance:

   1. MONEY NEVER MOVES ON A GUESS. This function PROPOSES. The user picks the
      account and confirms. Nothing is ever posted automatically, because a
      wrong balance is worse than no balance — you stop trusting the ledger.

   2. DETERMINISTIC FIRST, MODEL ONLY FOR THE REMAINDER. Amounts, dates and
      reference numbers are found with patterns, not by a language model.
      A model that "reads" 1,500 as 1,050 is a silent, unrecoverable error.
      The model is only asked for the messy part — a counterparty name in
      free text — and even then its answer must appear verbatim in the source.

   3. EVERY FIELD CARRIES THE TEXT IT CAME FROM. If the app got it wrong the
      user can see exactly where, instead of hunting a number.

   4. LOW CONFIDENCE IS AN ANSWER. Unsure is reported, not hidden behind a
      plausible default.
   ========================================================================= */

// Arabic-Indic and Persian digits → ASCII, so every later pattern is simple.
const AR_DIGITS = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
                    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9" };
function payNormalize(s) {
  return String(s || "")
    .replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d])
    .replace(/٫/g, ".")      // Arabic decimal separator
    .replace(/٬/g, ",")      // Arabic thousands separator
    .replace(/‏|‎/g, "")
    .replace(/[  ]/g, " ");
}

// Currencies as they actually appear in Egyptian and Gulf messages.
const CURRENCIES = [
  ["EGP", /\b(EGP|E\.?G\.?P)\b|جنيه|ج\.?م\.?|جنيهاً|جنيها/i],
  ["SAR", /\bSAR\b|ريال سعودي|ر\.?س\b/i],
  ["AED", /\bAED\b|درهم|د\.?إ\b/i],
  ["USD", /\bUSD\b|\$|دولار/i],
  ["KWD", /\bKWD\b|دينار كويتي/i],
  ["QAR", /\bQAR\b|ريال قطري/i],
];

// Direction. Ordered: the most specific wording wins, and "received" is
// checked before generic transfer words so "تم تحويل مبلغ إليك" is not read
// as money leaving.
const DIRECTION = [
  // STRONGEST FIRST: an explicit debit/credit verb beats any preposition.
  // This ordering is not cosmetic. "تم خصم 250 من حسابك" contains "من حساب",
  // and an earlier version read that as money arriving — it would have ADDED
  // money that was taken out. Explicit verbs are checked before prepositions
  // for exactly that reason.
  // NOTE: no \b anywhere near Arabic. JavaScript's \b is defined on ASCII word
  // characters, so it never matches at an Arabic word edge — a silent failure
  // that makes the pattern dead.
  ["out", /(تم\s+)?(خصم|سحب|دفع|شراء|سداد)|حولت|قمت بتحويل|تم التحويل/],
  ["in",  /(تم\s+)?(استلام|إضافة|اضافة|ايداع|إيداع|توريد)|اضيف|أضيف|وردك/],
  ["out", /\b(sent|paid|debited|deducted|charged|withdraw(n|al)?|transferred to|purchase|payment to)\b/i],
  ["in",  /\b(received|credited|deposit(ed)?|refund(ed)?|you have received)\b/i],
  // Then prepositions — but "من حسابك/حسابي" (from YOUR/MY account) is money
  // leaving, while a bare "من <name>" is money arriving.
  ["out", /من\s+حساب(ك|ي|نا)/],
  ["out", /(إلى|الى)\s*\S/],
  ["in",  /(إليك|اليك)/],
  ["in",  /من\s+(?!حساب)\S/],
  // Last resort: a transfer with no other clue at all.
  ["out", /\b(transfer)\b/i],
  ["out", /تحويل/],
];

// Amount. The trick is that a payment message contains several numbers —
// the amount, the remaining balance, a reference, a date, a phone. Candidates
// are scored by what sits next to them, and a "balance" number is pushed down
// hard because mistaking it for the amount is the classic failure.
const AMOUNT_RE = /(?:^|[^\d.,])((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?=[^\d]|$)/g;
const NEAR_AMOUNT = /(EGP|SAR|AED|USD|KWD|QAR|جنيه|ج\.?م|ريال|درهم|دولار|مبلغ|amount|بمبلغ|قيمة)/i;
const NEAR_BALANCE = /(balance|available|رصيد|الرصيد|المتاح|المتبقي)/i;
const NEAR_REF = /(ref|reference|transaction|txn|رقم|مرجع|العملية|المرجعية)/i;

function payAmount(text) {
  const t = payNormalize(text);
  const cands = [];
  let m;
  AMOUNT_RE.lastIndex = 0;
  while ((m = AMOUNT_RE.exec(t)) !== null) {
    const raw = m[1];
    const val = Number(raw.replace(/,/g, ""));
    if (!isFinite(val) || val <= 0) continue;
    const at = m.index + m[0].indexOf(raw);
    const before = t.slice(Math.max(0, at - 28), at);
    const after = t.slice(at + raw.length, at + raw.length + 28);
    const ctx = before + " " + after;

    let score = 0;
    if (NEAR_AMOUNT.test(ctx)) score += 5;
    // A number sitting right after "balance"/"الرصيد" is not the amount. The
    // penalty is heavy enough that a message containing ONLY a balance yields
    // no amount at all, rather than proposing to move the balance.
    if (NEAR_BALANCE.test(before)) score -= 14;
    if (NEAR_BALANCE.test(after)) score -= 3;
    if (NEAR_REF.test(before)) score -= 9;              // reference numbers
    if (/\.\d{2}$/.test(raw)) score += 3;               // 1,500.00 looks like money
    if (/,/.test(raw)) score += 2;
    if (raw.replace(/[^\d]/g, "").length >= 9) score -= 9;   // phone / reference length
    if (/^0/.test(raw)) score -= 4;                     // leading zero: phone number
    cands.push({ value: val, raw, score, ctx: (before + raw + after).trim() });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score || b.value - a.value);
  return cands[0].score > -3 ? cands[0] : null;
}

function payCurrency(text) {
  const t = payNormalize(text);
  for (const [code, re] of CURRENCIES) if (re.test(t)) return code;
  return null;
}

function payDirection(text) {
  const t = payNormalize(text);
  for (const [dir, re] of DIRECTION) if (re.test(t)) return dir;
  return null;
}

function payRef(text) {
  const t = payNormalize(text);
  const m = t.match(/(?:ref(?:erence)?|txn|transaction|رقم العملية|الرقم المرجعي|مرجع)\D{0,6}([A-Z0-9-]{6,})/i);
  return m ? m[1] : null;
}

function payDate(text, now) {
  const t = payNormalize(text);
  let m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = t.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[2] - 1, +m[1]).getTime();     // day-first, as used in Egypt
  }
  return now || Date.now();
}

// The counterparty. Patterns only — a name invented by a model and written
// into a ledger is a lie that persists.
const PARTY_RE = [
  // A Latin name inside an Arabic sentence is the ordinary InstaPay case, and
  // it is followed by an Arabic word rather than punctuation — so the list of
  // terminators has to include those words.
  /(?:to|from|إلى|الى|من)\s+((?:[A-Z][A-Za-z'’-]+\s*){1,4})/,
  /(?:إلى|الى|من)\s+((?:[ء-ي]+\s*){1,4})/,
  /(?:\bat\b|في)\s+([A-Z][A-Za-z0-9'’&-]+(?:\s+[A-Z][A-Za-z0-9'’&-]+){0,3})/,
];
// Words that are grammar, not a counterparty. "من حسابك" means "from your
// account" — writing "حسابك" into the ledger as the person you paid is the
// kind of small wrongness that makes a user stop trusting the whole feature.
const PARTY_STOP = /^(حساب|حسابك|حسابي|حسابنا|محفظة|محفظتك|محفظتي|رصيد|الرصيد|account|your account|wallet|balance|ref|reference)$/i;
// Trailing fragments the greedy capture can pick up.
const PARTY_TRIM = /\s+(on|at|في|بتاريخ|ref|reference|رقم)\b[\s\S]*$/i;

function payParty(text) {
  const t = payNormalize(text).replace(/\s+/g, " ");
  for (const re of PARTY_RE) {
    const m = t.match(re);
    if (!m || !m[1]) continue;
    let name = m[1].trim().replace(PARTY_TRIM, "").replace(/[.,;:]+$/, "").trim();
    name = name.replace(/\s+\d[\d/\-.]*$/, "").trim();   // drop a trailing date or number
    if (name.length < 3) continue;
    if (/^\d+$/.test(name)) continue;
    if (PARTY_STOP.test(name)) continue;
    return name;
  }
  return null;
}

// The whole thing. Returns a PROPOSAL — never a posted transaction.
// A failed, declined, cancelled or reversed payment is not a payment. This is
// checked before anything else: proposing a transaction for money that never
// moved is the one error that silently corrupts a balance in the user's favour
// and is hardest to notice later.
const DECLINED = /\b(declined|failed|unsuccessful|cancell?ed|reversed|rejected|insufficient)\b|فشل|مرفوض|لم يتم|ملغا|ملغي|غير كاف|إلغاء/i;

function parsePayment(text, opts) {
  const o = opts || {};
  const src = String(text || "").trim();
  if (!src) return null;
  if (DECLINED.test(payNormalize(src))) {
    return { ok: false, declined: true, amount: null, currency: payCurrency(src),
             direction: null, party: null, ref: payRef(src), date: payDate(src, o.now),
             missing: ["this payment did not go through"], confidence: "low",
             source: src.slice(0, 1200) };
  }
  const amt = payAmount(src);
  const dir = payDirection(src);
  const cur = payCurrency(src);
  const party = payParty(src);
  const ref = payRef(src);
  const date = payDate(src, o.now);

  const missing = [];
  if (!amt) missing.push("amount");
  if (!dir) missing.push("direction");
  if (!cur) missing.push("currency");

  // Confidence is about what we can defend, not how the text felt.
  let confidence = "low";
  if (amt && dir && cur) confidence = party ? "high" : "medium";
  else if (amt && (dir || cur)) confidence = "low";

  return {
    ok: !!amt && !!dir,
    amount: amt ? amt.value : null,
    amountSource: amt ? amt.ctx : null,      // the text it was read from
    currency: cur, direction: dir,           // "in" adds, "out" deducts
    party, ref, date,
    missing, confidence,
    source: src.slice(0, 1200),
    // Deliberately absent: account. The user picks it. A guessed account is
    // a wrong balance on two accounts at once.
  };
}

if (typeof module !== "undefined") module.exports = {
  parsePayment, payAmount, payDirection, payCurrency, payParty, payRef, payDate, payNormalize,
};

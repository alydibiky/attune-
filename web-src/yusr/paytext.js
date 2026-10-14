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

// Currencies as they actually appear in messages (v6.27: worldwide). Order matters: the most specific first ("R$" before
// "$", "د.ك" before "د"); codes are checked before symbols. A bare "$", "kr", "¥" or "Rs" is ambiguous — opts.home
// (the person's own currency) decides when it is one of that family.
const CURRENCIES = [
  ["EGP", /\b(EGP|E\.?G\.?P)\b|جنيه|ج\.?م\.?|جنيهاً|جنيها/i],
  ["EGP", /(?<=\d\s?)L\.?E\b|\bL\.?E\.?(?=\s?\d)/],
  ["SAR", /\bSAR\b|ريال سعودي|ر\.?س\b/i],
  ["AED", /\bAED\b|درهم إماراتي|د\.?إ\b/i],
  ["KWD", /\bKWD\b|دينار كويتي|د\.ك/i],
  ["QAR", /\bQAR\b|ريال قطري|ر\.ق/i],
  ["BHD", /\bBHD\b|دينار بحريني/i],
  ["OMR", /\bOMR\b|ريال عماني|ر\.ع/i],
  ["JOD", /\bJOD\b|دينار أردني|دينار اردني/i],
  ["MAD", /\bMAD\b|درهم مغربي|(?<=\d\s?)DHS?\b|\bDHS?(?=\s?\d)/],
  ["TND", /\bTND\b|دينار تونسي/i],
  ["DZD", /\bDZD\b|دينار جزائري|(?<=\d\s?)DA\b/],
  ["IQD", /\bIQD\b|دينار عراقي/i],
  ["LBP", /\bLBP\b|ليرة لبنانية/i],
  ["BRL", /\bBRL\b|R\$/],
  ["CAD", /\bCAD\b|C\$|CA\$/],
  ["AUD", /\bAUD\b|A\$|AU\$/],
  ["NZD", /\bNZD\b|NZ\$/],
  ["MXN", /\bMXN\b|MX\$/],
  ["SGD", /\bSGD\b|S\$/],
  ["HKD", /\bHKD\b|HK\$/],
  ["USD", /\bUSD\b|US\$|دولار/i],
  ["EUR", /\bEUR\b|€|euros?\b|يورو/i],
  ["GBP", /\bGBP\b|£|ج\.إ\.س|جنيه إسترليني/i],
  ["INR", /\bINR\b|₹|\bRs\.?(?=\s?\d)|रु/],
  ["PKR", /\bPKR\b/],
  ["BDT", /\bBDT\b|৳|Tk\.?(?=\s?\d)/],
  ["LKR", /\bLKR\b/],
  ["NPR", /\bNPR\b/],
  ["IDR", /\bIDR\b|\bRp\.?(?=\s?\d)/],
  ["MYR", /\bMYR\b|\bRM(?=\s?\d)/],
  ["PHP", /\bPHP\b|₱/],
  ["THB", /\bTHB\b|฿|บาท/],
  ["VND", /\bVND\b|₫/],
  ["KRW", /\bKRW\b|₩|(?<=\d\s?)원/],
  ["CNY", /\b(CNY|RMB)\b|(?<=\d\s?)元/],
  ["JPY", /\bJPY\b|(?<=\d\s?)円/],
  ["TRY", /\bTRY\b|₺|(?<=\d\s?)TL\b|\bTL(?=\s?\d)/],
  ["RUB", /\bRUB\b|₽|руб/i],
  ["UAH", /\bUAH\b|₴|грн/i],
  ["PLN", /\bPLN\b|zł/i],
  ["CZK", /\bCZK\b|Kč/],
  ["HUF", /\bHUF\b|(?<=\d\s?)Ft\b/],
  ["RON", /\bRON\b|(?<=\d\s?)lei\b/],
  ["CHF", /\bCHF\b/],
  ["SEK", /\bSEK\b/],
  ["NOK", /\bNOK\b/],
  ["DKK", /\bDKK\b/],
  ["ZAR", /\bZAR\b/],
  ["NGN", /\bNGN\b|₦/],
  ["KES", /\bKES\b|\bKsh(?=\s?\d)/i],
  ["GHS", /\bGHS\b|GH₵|₵/],
  ["ILS", /\bILS\b|₪/],
  ["CLP", /\bCLP\b/],
  ["COP", /\bCOP\b/],
  ["ARS", /\bARS\b/],
  ["PEN", /\bPEN\b|S\/\s?\d/],
];
// the ambiguous signs and the currencies they can mean (the first is the default)
const AMBIGUOUS = [
  [/\$/, ["USD", "CAD", "AUD", "NZD", "MXN", "SGD", "HKD", "CLP", "COP", "ARS"]],
  [/¥|￥/, ["JPY", "CNY"]],
  [/\bkr\.?(?=\s?\d)|\d\s?kr\b|\bkr\b/i, ["SEK", "NOK", "DKK"]],
  [/\bRs\.?(?=\s?\d)/, ["INR", "PKR", "LKR", "NPR"]],
  [/\bR\s?(?=\d)/, ["ZAR"]],
  [/ريال/, ["SAR", "QAR", "OMR"]],
  [/درهم/, ["AED", "MAD"]],
  [/دينار/, ["KWD", "JOD", "BHD", "TND", "DZD", "IQD"]],
  [/جنيه/, ["EGP"]],
];
// currencies written with 3 decimals (fils / millimes): "12.500 KWD" is twelve and a half
const THREE_DEC = /^(KWD|BHD|OMR|JOD|TND|LYD|IQD)$/;

// Direction. Ordered: the most specific wording wins, and "received" is
// checked before generic transfer words so "تم تحويل مبلغ إليك" is not read
// as money leaving.
// v6.27: the same verbs in the world's common banking languages. Words are matched with letter-aware edges (JavaScript's
// \b only knows ASCII, so "débité\b" would never match).
const W = (words, flags = "iu") => new RegExp("(?<![\\p{L}])(?:" + words + ")(?![\\p{L}])", flags);
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
  // "payment received" in other languages before their "payment" (out) words
  ["in",  W("payment received|received a payment|paiement reçu|virement reçu|pago recibido|transferencia recibida|pagamento recebido|transferência recebida|pix recebido|zahlung erhalten|zahlungseingang|überweisung erhalten|ödeme alındı|gelen (?:havale|eft|fast)|pembayaran diterima|transfer masuk|dana masuk|pagamento ricevuto|bonifico ricevuto|betaling ontvangen")],
  ["out", /\b(sent|paid|debited|deducted|charged|withdraw(n|al)?|transferred to|purchase|payment to|spent|you made a|transaction (?:with|at)|payment of)\b/i],
  ["in",  /\b(received|credited|deposit(ed)?|refund(ed)?|you have received)\b/i],
  ["out", W("débité|débitée|payé|paiement|achat|prélèvement|retrait|virement émis|cargo|cargado|pagado|pagaste|compra|retiro|débito|debitado|pago con|pagamento|saque|pix enviado|transferência enviada|belastet|bezahlt|zahlung an|abbuchung|lastschrift|abgehoben|kartenzahlung|harcama|ödeme|çekildi|tahsil edildi|gönderildi|pembayaran|pembelian|tarik tunai|transfer keluar|addebitato|addebito|pagato|acquisto|prelievo|afgeschreven|betaald|списан[оа]?|оплата|покупка|снятие|zapłacono|płatność|obciążenie|支付|付款|消费|支出|결제|출금|支払|ご利用")],
  ["in",  W("crédité|créditée|reçu|remboursement|dépôt|abonado|recibido|recibiste|abono|depósito|reembolso|creditado|recebido|recebeu|estorno|gutgeschrieben|erhalten|eingang|gutschrift|rückerstattung|yatırıldı|alındı|iade|diterima|masuk|pengembalian dana|accreditato|ricevuto|rimborso|bijgeschreven|ontvangen|зачислен[оа]?|поступление|получен[оа]?|возврат|wpłata|uznanie|收到|入账|到账|退款|입금|入金|返金")],
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
// v6.27: every common way of writing a number — 1,500.00 · 1.500,00 · 1 500,00 · 1'500.00 · 1,23,456.00 (India) · 12,50
const AMOUNT_RE = /(?:^|[^\d.,])((?:\d{1,2}(?:,\d{2})+,\d{3}|\d{1,3}(?:,\d{3})+|\d{1,3}(?:\.\d{3})+|\d{1,3}(?:[ '’]\d{3})+|\d+)(?:[.,]\d{1,3})?)(?=[^\d]|$)/g;
const NEAR_AMOUNT = /(\b[A-Z]{3}\b|[$€£¥₹₺₽₩₦₱฿₫৳₪₴₵]|R\$|zł|Kč|جنيه|ج\.?م|ريال|درهم|دولار|دينار|يورو|مبلغ|amount|bedrag|montant|importe|monto|valor|betrag|tutar|jumlah|nominal|importo|сумма|kwota|金额|금액|金額|بمبلغ|قيمة)/i;
const NEAR_BALANCE = /(balance|available|avl\.? ?bal|\bbal\b|solde|saldo|disponible|disponível|disponibile|kontostand|verfügbar|bakiye|kullanılabilir|остаток|доступно|余额|잔액|残高|رصيد|الرصيد|المتاح|المتبقي)/i;
const NEAR_REF = /(ref|reference|transaction|txn|réf|referencia|referência|referenz|riferimento|işlem no|no\.? ?ref|рнн|номер|رقم|مرجع|العملية|المرجعية)/i;

/** "1.500,00" → 1500 · "12,50" → 12.5 · "1,23,456" → 123456 · "150.000" → 150000 — but "12.500" KWD → 12.5 (3 decimals). */
function payNumber(raw, cur) {
  const s = String(raw).replace(/[ '’]/g, "");
  const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (last < 0) return Number(s);
  const sep = s[last], tail = s.length - last - 1, once = s.indexOf(sep) === last;
  let dec = tail <= 2;
  if (tail === 3) dec = once && sep === "." && !!cur && THREE_DEC.test(cur) && !/,/.test(s.slice(0, last));
  if (dec) return Number(s.slice(0, last).replace(/[.,]/g, "") + "." + s.slice(last + 1));
  return Number(s.replace(/[.,]/g, ""));
}

function payAmount(text, home) {
  const t = payNormalize(text), cur = payCurrency(text, home);
  const cands = [];
  let m;
  AMOUNT_RE.lastIndex = 0;
  while ((m = AMOUNT_RE.exec(t)) !== null) {
    const raw = m[1];
    const val = payNumber(raw, cur);
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
    if (/[.,]\d{2}$/.test(raw)) score += 3;            // 1,500.00 / 12,50 look like money
    if (/[,. '’]\d{3}/.test(raw)) score += 2;
    if (raw.replace(/[^\d]/g, "").length >= 9 && !/[,. '’]\d{3}/.test(raw)) score -= 9;   // phone / reference length (not 1,250,000.00)
    if (/^(19|20)\d{2}$/.test(raw) && /[\/.-]\s*$|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*$/i.test(before)) score -= 8;   // a year
    if (/^0/.test(raw)) score -= 4;                     // leading zero: phone number
    cands.push({ value: val, raw, score, ctx: (before + raw + after).trim() });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score || b.value - a.value);
  return cands[0].score > -3 ? cands[0] : null;
}

function payCurrency(text, home) {
  const t = payNormalize(text);
  for (const [code, re] of CURRENCIES) if (re.test(t)) return code;
  for (const [re, family] of AMBIGUOUS) if (re.test(t)) return home && family.includes(home) ? home : family[0];
  return null;
}

function payDirection(text) {
  const t = payNormalize(text);
  for (const [dir, re] of DIRECTION) if (re.test(t)) return dir;
  // v6.10 — a plain note: "+250 EGP from my cousin", "-80 EGP to the shop". Strict on purpose: a phone number
  // ("+20 100 123 4567"), a sum ("… + 14% VAT"), "Convert 500 USD to EGP" or "at 9 to call Ahmed" are NOT payments.
  if (/^\s*\+(?:\d{1,3}(?:,\d{3})+|\d{1,9})(?:\.\d+)?(?![\d%])(?!(?:\s+\d+){2,})(?!\s*%)/.test(t)) return "in";
  if (/^\s*[-−–](?:\d{1,3}(?:,\d{3})+|\d{1,9})(?:\.\d+)?(?![\d%])(?!\s*%)/.test(t) && payCurrency(text)) return "out";
  // from / to count only right after the amount (and a currency): "250 EGP from …", "80 جنيه إلى …"
  const CUR_OR_LANG = "(?:[A-Z]{3}\\b|dollars?|pounds?|euros?|arabic|english|french|turkish|german|spanish)";
  if (payCurrency(text)) {
    if (new RegExp("\\d[\\d,.]*\\s*(?:[A-Za-z]{3}|جنيه|دولار|ريال|درهم|[$€£₹¥₺₽₩])?\\s+(?:from|من)\\s+(?!" + CUR_OR_LANG + ")\\S", "i").test(t)) return "in";
    if (new RegExp("\\d[\\d,.]*\\s*(?:[A-Za-z]{3}|جنيه|دولار|ريال|درهم|[$€£₹¥₺₽₩])?\\s+(?:to|إلى|الى)\\s+(?!" + CUR_OR_LANG + ")\\S", "i").test(t)) return "out";
  }
  return null;
}

function payRef(text) {
  const t = payNormalize(text);
  const m = t.match(/(?:ref(?:erence)?|txn|transaction|رقم العملية|الرقم المرجعي|مرجع)\D{0,6}([A-Z0-9-]{6,})/i);
  return m ? m[1] : null;
}

// v6.27: day-first unless the person's region writes month-first (US, Philippines…) — or the numbers say so (13/02 is
// day-first anywhere, 02/13 month-first anywhere).
function payDate(text, now, order) {
  const t = payNormalize(text);
  let m = t.match(/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = t.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    let d = +m[1], mo = +m[2];
    if (mo > 12 || (order === "mdy" && d <= 12)) { d = +m[2]; mo = +m[1]; }
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return new Date(y, mo - 1, d).getTime();
  }
  return now || Date.now();
}

// The counterparty. Patterns only — a name invented by a model and written
// into a ledger is a lie that persists.
// v6.10 — "from my cousin Youssef", "to my brother Ahmed", "من ابن عمي يوسف": the person is the party,
// the relation is kept for the note (the user picks gift / repayment / loan — it is not guessed).
const REL_EN = "cousin|brother|sister|father|dad|mother|mom|mum|uncle|aunt|friend|neighbou?r|boss|colleague|son|daughter|wife|husband|partner|client|customer";
const REL_AR = "ابن عمي|ابن عمتي|ابن خالي|ابن خالتي|بنت عمي|بنت خالتي|اخويا|أخويا|اختي|أختي|أبويا|ابويا|امي|أمي|عمي|خالي|خالتي|عمتي|صاحبي|جاري|زميلي|صديقي|مراتي|جوزي|ابني|بنتي|عميلي";
const REL_RE = [
  new RegExp("(?:to|from)\\s+my\\s+(" + REL_EN + ")\\s+([A-Z][A-Za-z'’-]+(?:\\s+[A-Z][A-Za-z'’-]+)?)", "i"),
  new RegExp("(?:إلى|الى|ل|من)\\s*(" + REL_AR + ")\\s+([ء-ي]+|[A-Z][A-Za-z'’-]+)"),
];
function payRelation(text) {
  const t = payNormalize(text).replace(/\s+/g, " ");
  for (const re of REL_RE) {
    const m = t.match(re);
    if (m && m[2] && m[2].length >= 2 && !PARTY_STOP.test(m[2])) {
      const name = m[2].replace(/^[a-z]/, (c) => c.toUpperCase());
      return { party: name, relation: m[1].toLowerCase() };
    }
  }
  return null;
}

const PARTY_RE = [
  /\b(?:chez|bei|presso|bij)\s+([A-Z][A-Za-z0-9'’&-]+(?:\s+[A-Z][A-Za-z0-9'’&-]+){0,3})/,
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
const PARTY_STOP = /^(egp|usd|eur|sar|aed|gbp|kwd|qar|arabic|english|حساب|حسابك|حسابي|حسابنا|محفظة|محفظتك|محفظتي|رصيد|الرصيد|account|your account|wallet|balance|ref|reference)$/i;
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
const DECLINED = /\b(declined|failed|unsuccessful|cancell?ed|reversed|rejected|insufficient)\b|فشل|مرفوض|لم يتم|ملغا|ملغي|غير كاف|إلغاء|(?<![\p{L}])(refusée?|échouée?|annulée?|rechazad[oa]|fallid[oa]|cancelad[oa]|recusad[oa]|negad[oa]|abgelehnt|fehlgeschlagen|storniert|reddedildi|başarısız|ditolak|gagal|dibatalkan|rifiutat[oa]|annullat[oa]|отклонен[оа]?|失败|拒绝|거절|실패)(?![\p{L}])/iu;

function parsePayment(text, opts) {
  const o = opts || {};
  const src = String(text || "").trim();
  if (!src) return null;
  if (DECLINED.test(payNormalize(src))) {
    return { ok: false, declined: true, amount: null, currency: payCurrency(src),
             direction: null, party: null, ref: payRef(src), date: payDate(src, o.now, o.order),
             missing: ["this payment did not go through"], confidence: "low",
             source: src.slice(0, 1200) };
  }
  const amt = payAmount(src, o.home);
  const dir = payDirection(src);
  const cur = payCurrency(src, o.home);
  const rel = payRelation(src);
  const party = rel ? rel.party : payParty(src);
  const ref = payRef(src);
  const date = payDate(src, o.now, o.order);

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
    party, relation: rel ? rel.relation : null, ref, date,
    missing, confidence,
    source: src.slice(0, 1200),
    // Deliberately absent: account. The user picks it. A guessed account is
    // a wrong balance on two accounts at once.
  };
}

if (typeof module !== "undefined") module.exports = {
  parsePayment, payAmount, payDirection, payCurrency, payParty, payRef, payDate, payNormalize, payNumber,
};

/* ---- v10.9.12 REPAIR P1 (the money audit of 28 Nov): "is this the same payment as that one?" was decided in 6 places (paylog.inbox,
   paylog.alreadyIn, autopilot.inLedger, guardian "charged twice", overpay's `same`, firstmin) — most by the AMOUNT alone, so two
   different InstaPay transfers of 500 (to Ahmed and to Mona) became one and a payment was lost, "You sent EGP 20" and "charged USD 20"
   were one, and two Claude accounts were "charged twice". This is the ONE place that decides it now.
     viewOf(p)            any reader's payment (a notification entry, a Money entry, a typed one, an email charge) → one shape
     samePayment(a, b, o) the same payment seen twice (the bank's SMS and the shop's email, a notification and what was typed)?
   Two are NOT the same when any of these differ (each only when BOTH sides know it): the direction, the amount, the currency, the
   email account, the payee (by name: "SEOUDI MARKET" = "Seoudi"; "Ahmed Ali" ≠ "Mona Samir"; InstaPay / a bank / "payment" = no name),
   or the time (minutes apart when both have a time — o.within, default 10 minutes; otherwise the same day).
   Pure. Tests: tests/unit/v10912dedupe.test.mjs, tests/dedupe/gen.mjs (10,000 HARD pairs).                                         */

const DAY = 864e5;
const isoDay = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// words that are never the payee: the channel (InstaPay, a wallet, a bank, a card network), the kind of message, the place words
const NOT_PAYEE = /\b(?:instapay|insta pay|vodafone cash|orange cash|etisalat cash|we pay|fawry|meeza|valu|paymob|paypal|apple pay|google pay|visa|mastercard|master card|card|debit|credit|pos|atm|online|purchase|payment|transfer|transaction|txn|ref|egypt|eg|cairo|giza|maadi|branch|store|market|mkt|co|llc|ltd|inc|s\.?a\.?e|the|cib|nbe|qnb|hsbc|aaib|adib|banque misr|bank|banque|al ahly|ahly|alex bank|cash|wallet|account|acc|a\/c|from|to|at|for|in|via|by)\b/gi;
const NOT_PAYEE_AR = /(?<![\p{L}])(?:انستاباي|إنستاباي|فودافون كاش|اورنج كاش|فوري|ميزة|بطاقة|بطاقتك|حساب|حسابك|حسابكم|البنك|بنك|الأهلي|الاهلي|مصر|كاش|محفظة|محفظتك|تحويل|تم|إلى|الى|الي|من|لصالح|عملية|شراء|دفع|بنجاح|مبلغ|بمبلغ|جنيه|رقم)(?![\p{L}])/gu;
/** A payee name → its comparable words ("" when it names no one). */
export function payeeOf(s) {
  const t = String(s || "").split(/ · | - |—|\*|\|/)[0].toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة(?=\s|$)/g, "ه")
    .replace(NOT_PAYEE, " ").replace(NOT_PAYEE_AR, " ").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return t.length >= 2 ? t : "";
}
// a name's consonants, the same in Arabic and Latin letters (and Franco digits): «سعودي» = "Seoudi" = sd · «كارفور» = "Carrefour" = krfr ·
// «أحمد علي» = "Ahmed Ali" = hmd l — so the bank's Arabic SMS and the shop's English email name the same payee
const AR = { "ب": "b", "ت": "t", "ط": "t", "ث": "s", "س": "s", "ص": "s", "ج": "g", "ح": "h", "ه": "h", "خ": "k", "د": "d", "ض": "d", "ذ": "z", "ز": "z", "ظ": "z", "ر": "r", "ش": "sh", "غ": "g", "ف": "f", "ق": "k", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ة": "" };
export function skeleton(s) {
  return String(s || "").toLowerCase().split(/\s+/).map((w) => {
    let out = "";
    for (const ch of w) out += /[\u0600-\u06FF]/.test(ch) ? (AR[ch] != null ? AR[ch] : "") : ch;
    return out.replace(/ph/g, "f").replace(/kh/g, "k").replace(/gh/g, "g").replace(/th/g, "t").replace(/ou|oo/g, "u").replace(/c(?=[eiy])/g, "s").replace(/c|q/g, "k").replace(/x/g, "ks").replace(/v/g, "f").replace(/p/g, "b").replace(/[2357]/g, (d) => ({ 2: "", 3: "", 5: "k", 7: "h" })[d])
      .replace(/[^a-z]/g, "").replace(/(?!^)h(?=$)/, "").replace(/[aeiouyw]/g, "").replace(/(.)\1+/g, "$1");
  }).filter(Boolean).join(" ");
}
/** Do two payee names name the same one? ("seoudi market" / "seoudi" yes; "ahmed ali" / "mona samir" no; unknown → yes) */
// what is set aside before comparing: a branch / area / mall the bank adds ("BR 3", "#1204", "ZAMALEK", "CITY STARS") and the words a person
// types around a name ("mona groceries", «نتفليكس lunch»)
const AROUND = /^(?:br|branch|zamalek|maadi|dokki|mohandessin|heliopolis|nasr|city|stars|mall|october|zayed|sheikh|tagamoa|new|cairo|giza|alex|alexandria|downtown|mall of|arabia|festival|of|the|pharmacy|pharmacies|supermarket|hypermarket|market|restaurant|restaurants|cafe|store|shop|clinic|eg|egy|lunch|dinner|breakfast|groceries|grocery|food|coffee|taxi|fuel|gift|rent|tip|snacks|order|trip|ride|fees|share|half|loan|back|غدا|غداء|عشا|عشاء|فطار|بقالة|اكل|أكل|قهوة|تاكسي|بنزين|هدية|ايجار|إيجار|سلفة|طلب|مشوار|الزمالك|المعادي|الدقي|المهندسين|مصر الجديدة|مدينة نصر|التجمع)$/;
export function samePayee(a, b) {
  const x = payeeOf(a), y = payeeOf(b);
  if (!x || !y) return true;
  if (x === y) return true;
  const ar = (w) => /[\u0600-\u06FF]/.test(w);
  const words = (t) => t.split(" ").map((w) => w.replace(/^(?:ال|el|al)(?=\S{2,})/, "")).filter((w) => w.length >= 2 && !AROUND.test(w));
  const wx = words(x), wy = words(y);
  if (!wx.length || !wy.length) return true;
  // one name written as one word or two: "ELEZABY" = "El Ezaby", "SPINNEYS" = "Spin neys"
  const jx = x.replace(/\s+/g, ""), jy = y.replace(/\s+/g, "");
  if (jx.length >= 5 && jy.length >= 5 && (jx.includes(jy) || jy.includes(jx) || jx.startsWith(wy.join("")) || jy.startsWith(wx.join("")))) return true;
  // two words name the same: the same letters, one the start of the other ("seoudi" / "seoudis"), or — across two scripts only — the same
  // consonants («سعودي» / "Seoudi"; "Omar" ≠ "Amr")
  const one = (w, v) => w === v || (w.length >= 4 && v.length >= 4 && (v.startsWith(w) || w.startsWith(v))) || (ar(w) !== ar(v) && !!skeleton(w) && skeleton(w) === skeleton(v) && opens(w) === opens(v));
  // (…and the same kind of first sound: «عمر» / "Omar" open on a vowel, «مروة» / "Marwa" on m — "Omar" ≠ «مروة»)
  function opens(t) { return /^[\u0600-\u06FF]/.test(t) ? /^[اأإآعءئؤ]/.test(t) : /^[aeiou]/i.test(t); }
  // the name's first word must match; a second name word on BOTH sides (a family name: "Ahmed Ali" / "Ahmed Hassan") must match too
  if (!one(wx[0], wy[0]) && !(wx.length === 1 && wy.some((v) => one(wx[0], v))) && !(wy.length === 1 && wx.some((w) => one(w, wy[0])))) return false;
  if (wx.length >= 2 && wy.length >= 2 && one(wx[0], wy[0]) && !wx.slice(1).some((w) => wy.slice(1).some((v) => one(w, v)))) return false;
  return true;
}

/** Any reader's payment → { dir, amount, cur, at, day, payee, acct, src }. Understands paylog entries ({direction, party, ts, currency,
 *  acct}), Money entries ({type, note, date, created, currency, evidence.acct}), overpay charges ({amount, currency, date, src, acct}). */
export function viewOf(p, ledger = null) {
  if (!p) return null;
  const dir = p.direction === "in" || p.type === "income" ? "in" : p.direction === "out" || p.type === "expense" || p.type === "charge" ? "out" : "";
  let cur = String(p.currency || p.cur || "").toUpperCase();
  if (!cur && ledger && p.account) { const a = (ledger.accounts || []).find((x) => x.id === p.account); if (a && a.currency) cur = String(a.currency).toUpperCase(); }
  const at = +(p.ts || p.created || p.at || (p.evidence && p.evidence.ts) || (p.src && p.src.at && p.src.kind !== "payment" ? p.src.at : 0)) || 0;
  const day = /^\d{4}-\d{2}-\d{2}/.test(p.date || "") ? String(p.date).slice(0, 10) : at ? isoDay(at) : "";
  const payee = p.party != null && p.party !== "" ? p.party : p.service || p.merchant || p.note || p.title || "";
  const acct = String(p.acct || (p.evidence && p.evidence.acct) || (p.src && p.src.acct) || "").toLowerCase();
  return { dir, amount: Math.abs(Number(p.amount) || 0), cur, at, day, payee, acct, src: p.source || (p.src && p.src.kind) || "" };
}

/** A Money entry's currency: its own, else its account's, else the book's, else `fallback` (v10.9.12: the Guardian and the subscription
 *  check used the home currency for every entry — a $9.99 Netflix in a USD account became "9.99 EGP"). */
export function txnCurrency(t, ledger, fallback = "") {
  if (t && /^[A-Z]{3}$/i.test(t.currency || "")) return String(t.currency).toUpperCase();
  const a = ledger && t && (ledger.accounts || []).find((x) => x.id === t.account);
  return (a && a.currency) || (ledger && ledger.currency) || fallback || "";
}
/** The same payment seen twice? o.within = how far apart two TIMED ones may be (ms; default 10 minutes); o.days = how many days apart
 *  two may be when one has no time (default 0: the same day; the overpay check gives 3 — a receipt email can come days later). */
export function samePayment(a0, b0, o = {}) {
  const a = a0 && a0.dir !== undefined && a0.payee !== undefined ? a0 : viewOf(a0, o.ledger), b = b0 && b0.dir !== undefined && b0.payee !== undefined ? b0 : viewOf(b0, o.ledger);
  if (!a || !b) return false;
  if (a.dir && b.dir && a.dir !== b.dir) return false;
  if (Math.abs(a.amount - b.amount) > 0.01) return false;
  if (a.cur && b.cur && a.cur !== b.cur) return false;
  if (a.acct && b.acct && a.acct !== b.acct) return false;
  if (!o.ignorePayee && !samePayee(a.payee, b.payee)) return false;   // (o.ignorePayee: a note a person typed is not a payee name — "groceries", «حاجات»)
  const within = o.within == null ? 10 * 60000 : o.within, days = o.days || 0;
  if (a.at && b.at && within > 0 && !o.byDay) return Math.abs(a.at - b.at) <= within;
  if (!a.day || !b.day) return false;
  return Math.abs(Date.parse(a.day + "T12:00:00") - Date.parse(b.day + "T12:00:00")) <= days * DAY;
}

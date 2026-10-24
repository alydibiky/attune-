/* ---- v6.27 "Money tracks itself" (ROADMAP_2026-10-13.md) — the page side of PayListener.kt ------------------------------------
   The phone keeps the notifications that look like money (banks, InstaPay, wallets). Here each one is read with
   paytext.js — the same reader as a bank message shared to Attune — into an entry; one-time codes, balances-only and
   unreadable texts are dropped; the same payment notified twice (an update, or the bank AND InstaPay) is kept once.
   The entries are listed in Money to confirm; confirmed ones go to Money (Yusr) through the bridge ("add-txns").
   Pure logic; tests: tests/unit/v727paylog.test.mjs.                                                                         */
import { parsePayment } from "./yusr/paytext.js";
import { catOf } from "./yusr/logtext.js";
import { merchantOf } from "./guardian.js";   // v7.9 the shop a payment was made to (alreadyIn)

// merchants Money's own words don't know yet → its categories. v6.27: worldwide chains first, then by region
// (Egypt, the Gulf, Europe, the Americas, South & South-East Asia, Africa). Add more freely: one regex per category.
const MERCHANTS = [
  [/wataniya|وطنية|total ?energies|misr ?petroleum|mobil|chill ?out|emarat ?misr|shell|taqa|petrol|fuel|بنزين|\bbp\b|exxon|chevron|texaco|esso|aral|repsol|galp|eni\b|q8|adnoc|enoc|aramco|petronas|pertamina|indian ?oil|bharat ?petroleum|hp ?petrol|ipiranga|pemex|circle ?k|7-?eleven fuel|gas station|tankstelle|station[- ]service|gasolinera|posto/i, "transport"],
  [/seoudi|سعودي|spinneys|hyper ?one|kazyon|كازيون|oscar|metro market|gourmet|lulu|bim\b|panda|kheir zaman|خير زمان|fathalla|فتح الله|ragab|رجب|carrefour|walmart|target|costco|kroger|safeway|whole ?foods|trader ?joe|publix|aldi|lidl|tesco|sainsbury|asda|morrisons|waitrose|rewe|edeka|kaufland|netto|penny|leclerc|auchan|intermarch|monoprix|mercadona|dia\b|eroski|esselunga|coop\b|conad|albert ?heijn|jumbo|migros|a101|şok|sok market|bim market|magnit|пятёрочка|пятерочка|перекрёсток|biedronka|żabka|othaim|danube|tamimi|al ?meera|big ?bazaar|dmart|reliance fresh|blinkit|zepto|bigbasket|alfamart|indomaret|giant|fairprice|tops\b|lotus|big ?c|woolworths|coles|countdown|loblaws|sobeys|metro inc|soriana|chedraui|oxxo|pão de açúcar|atacad[aã]o|assa[ií]|shoprite|pick ?n ?pay|checkers|naivas|quickmart|7-?eleven|family ?mart|lawson|supermarket|supermarch|supermercado|grocer/i, "groceries"],
  [/swvl|careem|indrive|didi|bolt|metro|مترو|uber(?! ?eats)|lyft|grab(?! ?food)|gojek|ola\b|rapido|cabify|99 ?app|yandex ?go|free ?now|blablacar|lime\b|tier\b|transit|tfl|mta\b|sncf|renfe|trenitalia|deutsche ?bahn|\bdb\b|irctc|amtrak|parking|parkplatz|stationnement|estacionamiento|toll|peaje|péage|maut|airline|airways|emirates|qatar airways|ryanair|easyjet|lufthansa|air france|indigo|airasia|flydubai|egyptair/i, "transport"],
  [/elmenus|breadfast|instashop|mrsool|noon food|kfc|mcdonald|hardee|buffalo|koshary|كشري|abou ?tarek|عبو طارق|talabat|طلبات|deliveroo|doordash|uber ?eats|grub ?hub|just ?eat|glovo|rappi|ifood|swiggy|zomato|grab ?food|foodpanda|wolt|getir|yemeksepeti|jahez|hungerstation|careem food|starbucks|costa|tim hortons|dunkin|subway|burger ?king|domino|pizza ?hut|papa john|wendy|taco bell|chipotle|five guys|shake shack|nando|pret\b|greggs|café|cafe|coffee|restaurant|restaurante|ristorante|bistro|bakery|boulangerie|panader/i, "food"],
  [/amazon|noon|jumia|b\.?tech|2b\b|raya|ikea|h&m|zara|defacto|lc ?waikiki|max fashion|ebay|aliexpress|temu|shein|etsy|walmart\.com|best ?buy|apple store|apple\.com\/shop|currys|argos|john lewis|primark|uniqlo|mango|bershka|pull ?& ?bear|decathlon|fnac|darty|mediamarkt|saturn|otto\b|zalando|el corte ingl|mercado ?libre|shopee|lazada|tokopedia|bukalapak|flipkart|myntra|meesho|trendyol|hepsiburada|ozon|wildberries|allegro|takealot|jd\.com|taobao|tmall|rakuten|coupang|namshi|centrepoint|sharaf dg|extra\b|jarir|home ?centre|ace hardware|home ?depot|lowe'?s|b&q|leroy merlin|bauhaus|obi\b/i, "shopping"],
  [/ezaby|العزبي|seif|سيف|misr pharmac|roshdy|clinic|hospital|vezeeta|فيزيتا|lab\b|معمل|pharmacy|pharmacie|farmacia|farmácia|apotheke|eczane|apotek|chemist|cvs|walgreens|rite ?aid|boots|superdrug|watsons|guardian pharmacy|apollo pharmacy|netmeds|1mg|nahdi|al ?dawaa|aster|dentist|dental|doctor|médecin|médico|arzt|optician|physio/i, "health"],
  [/vodafone|orange|etisalat|e&|\bwe\b|telecom egypt|fawry|فوري|electricity|كهرباء|water|مياه|gas|غاز|netflix|shahid|spotify|osn|watch it|at&t|verizon|t-mobile|sprint|comcast|xfinity|spectrum|\bee\b|o2\b|three|bt\b|sky\b|virgin media|telekom|telefónica|movistar|vivo\b|claro|tim\b|free mobile|bouygues|sfr\b|jio|airtel|vi\b|bsnl|turkcell|türk telekom|stc\b|mobily|zain|du\b|ooredoo|safaricom|mtn\b|glo\b|telkomsel|indosat|globe|smart\b|ais\b|dtac|singtel|starhub|optus|telstra|rogers|bell\b|telus|utility|utilities|edf|engie|iberdrola|endesa|enel|e\.on|british gas|octopus|con ?ed|pg&e|duke energy|internet|broadband|wifi|disney|hulu|hbo|max\b|paramount|prime video|apple\.com\/bill|itunes|google play|youtube|deezer|tidal|anghami|crunchyroll|xbox|playstation|nintendo|microsoft|adobe|dropbox|icloud|google one|chatgpt|openai|canva|notion|duolingo|audible|kindle|linkedin|patreon|onlyfans|tinder|bumble|insurance|assurance|seguro|versicherung|sigorta|rent\b|loyer|alquiler|aluguel|miete|kira/i, "bills"],
  [/salary|payroll|راتب|مرتب|salaire|salario|salário|gehalt|lohn|maaş|gaji|stipendio|salaris|зарплата|wynagrodzenie|工资|월급|給与/i, "salary"],
];
/** The category of a payment from its party / note (merchants first, then Money's own words), else "other". */
export function categorise(text, direction) {
  const t = String(text || "");
  for (const [re, c] of MERCHANTS) if (re.test(t)) return direction === "in" && c !== "salary" ? "other" : c;
  const c = catOf(t);
  return c && c !== "other" && !(direction === "in" && c !== "salary") ? c : "other";
}

// v6.27: one-time codes, balance-only messages and adverts in the world's common languages
const OTP = /\b(otp|one[- ]time|verification code|security code|passcode|pin|2fa)\b|رمز التحقق|كود التفعيل|كلمة المرور لمرة|رمز التفعيل|(?<![\p{L}])(code de (?:vérification|sécurité|confirmation)|código de (?:verificación|seguridad|verificação|confirmação)|bestätigungscode|sicherheitscode|tan\b|doğrulama kodu|şifre|kode (?:otp|verifikasi)|codice (?:di verifica|otp)|verificatiecode|код подтверждения|验证码|인증번호|認証コード)/iu;
const BALANCE_ONLY = /^(?=.*(?<![\p{L}])(balance|available|solde|saldo|kontostand|bakiye|остаток|余额|잔액|رصيدك|الرصيد)(?![\p{L}]))(?!.*(?<![\p{L}])(debited|credited|charged|purchase|paid|received|transfer|withdraw|deposit|spent|débité|crédité|paiement|cargo|abono|compra|pago|pagamento|zahlung|gutschrift|harcama|ödeme|pembayaran|списан|зачислен|خصم|إيداع|ايداع|تحويل|سحب|شراء|استلام)(?![\p{L}]))/iu;
const PROMO = /\b(offer|discount|win|cashback offer|promo|sale|% off|deal of the day|coupon)\b|عرض|خصم \d+%|اربح|كاش باك|(?<![\p{L}])(offre|promotion|soldes|oferta|descuento|promoción|promoção|desconto|angebot|rabatt|gutschein|kampanya|indirim|fırsat|diskon|promo|sconto|offerta|aanbieding|korting|скидка|акция|优惠|할인|セール)(?![\p{L}])/iu;

// v6.27: a charge that has NOT happened yet (a trial ending, a renewal, an upcoming bill) is the Deadline Radar's, not a payment
const FUTURE = /\b(will be (?:charged|billed|debited|renewed)|you'?ll be (?:charged|billed)|will renew|renews on|auto-?renew|upcoming (?:payment|charge|bill)|payment (?:is )?due|due on|due date|free trial|trial (?:ends|period)|reminder)\b|سيتم خصم|سيتم التجديد|تنتهي الفترة التجريبية|الفترة التجريبية|تاريخ الاستحقاق|(?<![\p{L}])(sera (?:débité|prélevé|facturé)|se renouvelle|essai gratuit|será (?:cobrado|cargado|debitado|renovad[oa])|se renovará|prueba gratuita|teste grátis|wird (?:abgebucht|belastet|verlängert)|probemonat|testphase|verrà addebitat[oa]|si rinnova|prova gratuita|tahsil edilecek|yenilenecek|ücretsiz deneme|akan (?:ditagih|didebit)|uji coba)(?![\p{L}])/iu;
/** One stored notification {id, pkg, app, title, text, ts} → an entry, or null when it isn't a payment. */
export function readNotification(n, opts) {
  const text = [n.title, n.text].filter(Boolean).join(" — ").trim();
  if (!text || OTP.test(text) || BALANCE_ONLY.test(text) || FUTURE.test(text) || (PROMO.test(text) && !/\b(debited|charged|received|paid)\b|تم خصم|تم تحويل|تم استلام/i.test(text))) return null;
  const p = parsePayment(text, { ...(opts || {}), now: n.ts || undefined });
  if (!p || !p.ok || !(p.amount > 0) || !p.direction || p.confidence === "low") return null;
  return { id: n.id, app: n.app || n.pkg || "", amount: p.amount, currency: p.currency || "", direction: p.direction, party: p.party || "",
    ts: n.ts || p.date || Date.now(), text: text.slice(0, 300), confidence: p.confidence };
}

/** All stored notifications → entries, newest first; the same payment twice (same direction and amount within
 *  10 minutes) is kept once; `done` = ids already added or dismissed. */
export function inbox(queue, done = [], opts) {
  const skip = new Set(done), out = [];
  for (const n of [...(queue || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
    if (skip.has(n.id)) continue;
    const e = readNotification(n, opts); if (!e) continue;
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
    note: [e.party, e.app].filter(Boolean).join(" · ").slice(0, 80) || "Payment", date: iso(e.ts), source: "notification", ts: e.ts || undefined }));
}

/** v7.9 (Ali: a 599 "charged twice" that was one payment): is this notification already in Money? The same amount and day, and
 *  either typed by hand / logged from the box (no notification behind it), or a notification minutes apart, or the same shop
 *  when there are no times. Such an entry is never added by itself — it waits in the list as "Already in Money?". */
export function alreadyIn(entry, ledger) {
  if (!entry || !(entry.amount > 0) || !ledger || !Array.isArray(ledger.txns)) return null;
  const type = entry.direction === "in" ? "income" : "expense", day = toTxns([entry])[0].date, shop = merchantOf(entry.party || "");
  return ledger.txns.find((t) => t && t.type === type && t.date === day && Math.abs((Number(t.amount) || 0) - entry.amount) < 0.005
    && (t.source !== "notification" ? true : (t.created && entry.ts) ? Math.abs(t.created - entry.ts) <= 10 * 60000 : !!shop && merchantOf(t.note) === shop)) || null;
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
    L.txns.push({ id, type: t.type, amount: Math.round(a * 100) / 100, cat: /^[a-z_]{2,20}$/.test(t.cat || "") ? t.cat : "other", account: acc.id, date: /^\d{4}-\d{2}-\d{2}$/.test(t.date || "") ? t.date : new Date(now).toISOString().slice(0, 10), note: String(t.note || "").slice(0, 80), created: typeof t.ts === "number" ? t.ts : now, ...(t.source === "notification" ? { source: "notification" } : {}) });
    ids.push(id);
  }
  return { ledger: L, ids };
}

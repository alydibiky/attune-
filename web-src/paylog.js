/* ---- v6.27 "Money tracks itself" (ROADMAP_2026-10-13.md) — the page side of PayListener.kt ------------------------------------
   The phone keeps the notifications that look like money (banks, InstaPay, wallets). Here each one is read with
   paytext.js — the same reader as a bank message shared to Attune — into an entry; one-time codes, balances-only and
   unreadable texts are dropped; the same payment notified twice (an update, or the bank AND InstaPay) is kept once.
   The entries are listed in Money to confirm; confirmed ones go to Money (Yusr) through the bridge ("add-txns").
   Pure logic; tests: tests/unit/v727paylog.test.mjs.                                                                         */
import { catFor, loadCatRules } from "./catlearn.js";
import { labelOf, notMoney, countsAsMoney, understandNote as readMeaning } from "./notelabels.js";   // v9.9.11 what the person taught
import { notAPayment } from "./notifwords.js";   // v9.9.17 one list for all four readers
import { loadTeach } from "./noteteach.js";
import { parsePayment } from "./yusr/paytext.js";
import { payOpts } from "./locale.js";
import { WORLD_MONEY_SRC } from "./countrypack.js";   // v9.9.16 every bank / wallet of the 30 countries
import { catOf } from "./yusr/logtext.js";
import { merchantOf } from "./guardian.js";
import { digitsOf } from "./moneyunits.js";   // v9.9.18 each currency's decimals   // v7.9 the shop a payment was made to (alreadyIn)

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
const BALANCE_ONLY = /^(?=.*(?<![\p{L}])(balance|available|solde|saldo|kontostand|bakiye|остаток|余额|잔액|رصيدك|الرصيد)(?![\p{L}]))(?!.*(?<![\p{L}])(debited|credited|charged|purchase|paid|received|transfer|withdraw|deposit|spent|débité|crédité|paiement|cargo|abono|compra|pago|pagamento|zahlung|gutschrift|harcama|ödeme|pembayaran|списан|зачислен|خصم|إيداع|ايداع|تحويل|سحب|شراء|استلام|استلمت|استقبلت|وصلك|اتحولك|حولت|دفعت|تم دفع|total|virement|re[cç]u|achat|havale|eft|gelmi[sş]tir|al[ıi][sş]veri[sş]|didebet|debet|menerima|pembelian|kartenzahlung|erhalten|überweisung|accredito|addebito|bonifico|pagou|recebeu|pix|recibiste|recibido|transferencia|debit|credit|dr|cr|amt|betaald|ontvangen|حوالة|حواله|withdrawal|withdrawn|deposited|purchased|transferred|refunded|pos)(?![\p{L}]))/iu;   // v9.0: «استلمت 300 ج.م … رصيدك» is money received, not a balance
const PROMO = /\b(offer|discount|win|cashback offer|promo|sale|% off|deal of the day|coupon)\b|عرض|خصم \d+%|اربح|كاش باك|(?<![\p{L}])(offre|promotion|soldes|oferta|descuento|promoción|promoção|desconto|angebot|rabatt|gutschein|kampanya|indirim|fırsat|diskon|promo|sconto|offerta|aanbieding|korting|скидка|акция|优惠|할인|セール)(?![\p{L}])/iu;

// v6.27: a charge that has NOT happened yet (a trial ending, a renewal, an upcoming bill) is the Deadline Radar's, not a payment
const FUTURE = /\b(will be (?:charged|billed|debited|renewed)|you'?ll be (?:charged|billed)|will renew|renews on|auto-?renew|upcoming (?:payment|charge|bill)|payment (?:is )?due|due on|due date|free trial|trial (?:ends|period)|reminder)\b|سيتم خصم|سيتم التجديد|تنتهي الفترة التجريبية|الفترة التجريبية|تاريخ الاستحقاق|(?<![\p{L}])(sera (?:débité|prélevé|facturé)|se renouvelle|essai gratuit|será (?:cobrado|cargado|debitado|renovad[oa])|se renovará|prueba gratuita|teste grátis|wird (?:abgebucht|belastet|verlängert)|probemonat|testphase|verrà addebitat[oa]|si rinnova|prova gratuita|tahsil edilecek|yenilenecek|ücretsiz deneme|akan (?:ditagih|didebit)|uji coba)(?![\p{L}])/iu;
// v9.9.9 (Ali, 10 Nov: "a WhatsApp group about work was talking about money and it was added to my income — what the hell?"):
// people TALK about money in chat apps («غفره بليل ٤٥٠ جنيه+١٠٠جنيه اعاشه» in a wages group) — that is never a payment.
// Payments come from banks, InstaPay, wallets and bank SMS (the Messages app stays).
export const CHAT_APP = /whatsapp|telegram|messenger|com\.facebook\.orca|instagram|thoughtcrime\.securesms|org\.signal|signal|viber|slack|microsoft\.teams|\bteams\b|discord|imo\.android|\bimo\b|botim|wechat|tencent\.mm|jp\.naver\.line|\bline\b|snapchat|skype|zoom|kakao|tiktok/i;
export const isChatApp = (n) => !!n && CHAT_APP.test([n.pkg, n.app].filter(Boolean).join(" "));
/** Entries already in Money that were read from a chat app's notification (to offer removing them). */
export const fromChats = (ledger, kept = []) => (((ledger && ledger.txns) || []).filter((t) => t && t.source === "notification" && !kept.includes(t.id)
  && (CHAT_APP.test(String((t.evidence && t.evidence.app) || "")) || / · (whatsapp|telegram|messenger|signal|viber|instagram)$/i.test(String(t.note || "")))));

/** One stored notification {id, pkg, app, title, text, ts} → an entry, or null when it isn't a payment. */
export function readNotification(n, opts) {
  // v9.9.11 what the person taught about this source: "work talk" / "not money" / "ads" / "ignore" → never money; "my money" /
  // "my bank" → it counts as a money source (a chat too — the person said so)
  let lab = null; try { lab = labelOf(n, opts && opts.teach !== undefined ? opts.teach : loadTeach()); } catch (e) {}
  if (lab && notMoney(lab)) return null;
  if (isChatApp(n) && !countsAsMoney(lab)) return null;
  const text = [n.title, n.text].filter(Boolean).join(" — ").trim();
  if (!text || OTP.test(text) || BALANCE_ONLY.test(text) || FUTURE.test(text) || (PROMO.test(text) && !/\b(debited|charged|received|paid)\b|تم خصم|تم تحويل|تم استلام/i.test(text))) return null;
  // v9.9.17 (the 10,000-notification run): a code that names its purchase, a declined / failed payment, a bill that is only due, a
  // fine, "you will be billed", an offer, a price moving, a prize text, an SMS from a person's number — none of them is money that
  // moved (what the person taught as "my bank / my money" is still read); a video's title or an advert is never a payment
  if (!countsAsMoney(lab)) { if (notAPayment(text, n)) return null; let m = null; try { m = readMeaning(n); } catch (e) {} if (m && m.sure && (m.meaning === "ads" || m.meaning === "notmoney")) return null; }
  // v9.9.16: the person's own currency decides what "$", "Rs", «دينار», «ريال» mean (a Canadian's $ is CAD, a Jordanian's دينار JOD)
  let home = {}; try { home = payOpts() || {}; } catch (e) {}
  const p = parsePayment(text, { ...home, ...(opts || {}), now: n.ts || undefined });
  // v9.9.30 "Payment received: EGP 1,879 for your stay at Hilton" / "we received your payment" — the shop received YOUR money: out
  if (p && p.direction === "in" && /(?:payment|we) received(?: your payment)?:?[^.\n]{0,40}\bfor your (?:stay|order|booking|reservation|trip|ticket|purchase|subscription)|received your payment/i.test(text)) p.direction = "out";
  // a bank / wallet that names no currency ("A/C X1234 debited by 450.0") speaks in the person's own — kept when the sender is a
  // money source; from anyone else a message with no currency is still too little to go on
  const known = MONEY_SRC.test(String(n.app || "") + " " + String(n.title || ""));
  // v9.9.17 (the held-out check): a bank app's short notice "💸 £8.50 at Pret A Manger" has no verb — from a money source, an amount "at" a shop was spent
  if (p && p.amount > 0 && !p.direction && known && /^[^\p{L}\d]*[$€£]?\s?[\d.,]+\s*(?:[A-Z]{3}\s+)?(?:at|@)\s+\S/iu.test(String(n.text || ""))) { p.direction = "out"; p.ok = true; if (p.confidence === "low") p.confidence = "medium"; }
  if (!p || !p.ok || !(p.amount > 0) || !p.direction || (p.confidence === "low" && !(known && !p.currency && home.home))) return null;
  if (!p.currency && home.home) p.currency = home.home;
  // v9.9.17: a shop's own "Payment received: EGP 1,879 for your stay" / "We've received your payment" is money the person PAID
  if (p.direction === "in" && !known && /payment (?:was |has been )?received|received your payment|payment of (?:[^.\n]|\.\d){0,40} received|تم استلام (?:دفعتك|مدفوعاتك)/i.test(text)) p.direction = "out";
  // full / from: the complete message as it arrived and who sent it — kept with the payment as its evidence (Ali, 25 Oct)
  return { id: n.id, app: n.app || n.pkg || "", amount: p.amount, currency: p.currency || "", direction: p.direction, party: p.party || "",
    ts: n.ts || p.date || Date.now(), text: text.slice(0, 300), full: String(n.text || "").slice(0, 2000), from: String(n.title || "").slice(0, 200), confidence: p.confidence,
    ...(countsAsMoney(lab) ? { trusted: true } : {}) };
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
    note: [e.party, e.app].filter(Boolean).join(" · ").slice(0, 80) || "Payment", date: iso(e.ts), source: "notification", ts: e.ts || undefined,
    evidence: evidenceOf(e) }));
}
/** The proof kept on a payment read from a notification: the complete message as it arrived, who sent it, the app, the time. */
export function evidenceOf(e) {
  const text = String((e && (e.full || e.text)) || "").slice(0, 2000);
  return text ? { text, from: String(e.from || "").slice(0, 200), app: String(e.app || "").slice(0, 80), ts: e.ts || 0 } : undefined;
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

/* v9.9.10 (Ali: "an AI model should assess the notifications so it knows what everything is about, and it should have asked me
   before it was added to Money if it was not sure"). "By itself" now needs ALL of:
     1. the code is sure: high confidence, an amount, a direction;
     2. it came from a money source: a bank / wallet / InstaPay app, or an SMS whose sender is a bank or wallet;
     3. it says the money MOVED (debited / credited / تم خصم / تم تحويل / استلمت …) — not "300 for the night guard";
     4. when a model is loaded: the model read the message and agrees (a real payment of THIS person, same amount and direction).
   Anything else waits in Money for one tap ("Is this yours?") — never added on a guess. */
const MONEY_SRC0 = /bank|banque|banco|\bcib\b|commercial international|\bnbe\b|al ?ahly|الأهلي|الاهلي|banque misr|بنك مصر|\bqnb\b|hsbc|\baaib\b|\badib\b|alex ?bank|faisal|emirates ?nbd|mashreq|\bfab\b|\bcae\b|credit agricole|\bsaib\b|\bnbk\b|\bbdc\b|instapay|انستاباي|\bipn\b|wallet|محفظ|vodafone ?cash|vf-?cash|فودافون كاش|orange ?(cash|money)|etisalat ?cash|e& ?cash|we ?pay|fawry|فوري|\bvalu\b|meeza|ميزة|paymob|telda|khazna|sympl|souhoola|\bhalan\b|\bcontact\b(?! us)|\baman\b|masary|bee\b|paypal|revolut|\bwise\b|payoneer|\bstripe\b|apple ?pay|google ?(pay|wallet)|samsung ?(pay|wallet)|\bvisa\b|mastercard|\bamex\b|stc ?pay|urpay|\bmada\b|\bbenefit(?:pay)?\b|\bgpay\b|phonepe|paytm|\bupi\b|\bpix\b|nubank|mercado ?pago|m-?pesa|\bchase\b|wells ?fargo|\bciti(?:bank)?\b|barclays|lloyds|santander|monzo|starling|n26|\bing\b|bnp|soci[eé]t[eé] g[eé]n[eé]rale|deutsche ?bank|sparkasse|garanti|akbank|i[sş] ?bankas[iı]|ziraat|yap[iı] ?kredi|sberbank|tinkoff|alfa-?bank|icici|hdfc|\bsbi\b|\baxis\b|kotak|bca\b|mandiri|\bbri\b|maybank|cimb|dbs|ocbc|kasikorn|scb\b/i;
const MONEY_SRC = { test: (x) => MONEY_SRC0.test(x) || WORLD_MONEY_SRC.test(x) };
const SMS_APP = /messag|\bsms\b|mms|com\.android\.mms|samsung\.android\.messaging|google\.android\.apps\.messaging|رسائل/i;
const MOVED = /سحب صراف|سحب نقدي|شراء عبر|نقاط البيع|عملية شراء|\b(debited|credited|charged|purchase[d]?|paid|payment (?:of|to|from)|received|transferr?ed|transfer (?:of|to|from)|withdrawn?|withdrawal|deposit(?:ed)?|spent|refund(?:ed)?|sent you|you sent)\b|تم (?:خصم|تحويل|استلام|إيداع|ايداع|سحب|شراء|دفع|سداد)|خصم مبلغ|إيداع مبلغ|ايداع مبلغ|استلمت|استقبلت|وصلك|اتحولك|حولت|دفعت|سحبت|عملية شراء|(?<![\p{L}])(débit[ée]|crédit[ée]|paiement|achat|virement|cargo|abono|compra|pago|transferencia|pagamento|transferência|zahlung|gutschrift|überweisung|abbuchung|ödeme|harcama|havale|pembayaran|списан|зачислен|оплата|перевод)(?![\p{L}])/iu;
/** Did this entry come from a money source? (the app, or an SMS whose sender is a bank / wallet) */
export function fromMoneySource(e) {
  if (e && e.trusted) return true;   // v9.9.11 the person taught: this source is their bank / their money
  const app = String((e && (e.app || "")) || ""), from = String((e && e.from) || "");
  if (CHAT_APP.test(app)) return false;
  if (SMS_APP.test(app)) return MONEY_SRC.test(from) || /^[A-Z][A-Za-z0-9 .-]{1,14}$/.test(from.trim()) && !/^\+?\d/.test(from.trim());   // SMS: a named sender ("CIB", "NBE", "VF-Cash"), not a person's number
  return MONEY_SRC.test(app + " " + from);
}
/** A raw notification from a money app / a bank's SMS sender (v9.9.11: such money is checked as a payment, not asked about). */
export const moneySourceNote = (n) => !!n && fromMoneySource({ app: n.app || n.pkg || "", from: n.title || "" });
/** The code alone is sure: steps 1–3 above. */
/* v9.9.30 (Ali: "really smart, not keep asking"): "medium" (no payee name — «تم خصم مبلغ ٥٬٦٨٠ ج.م من حسابك مقابل أمازون», "Salary of
   EGP 27,181 has been credited to your account", an ATM withdrawal) is sure too when it says the money moved AND names the person's own
   account / card — the bank's own words about YOUR account. Chats, people's numbers and unknown senders still never count. */
const OWN_ACC = /\b(your (?:account|a\/?c|card|wallet)|account (?:ending|no\.?|number|\*|x)|a\/?c\s*(?:no\.?|x|\*|\d)|card(?: ending| no\.?|:)?\s*[*x#]?\s*\d{3,4}|ending (?:in )?\d{3,4}|xxx\d{3,4}|\*{2,}\d{3,4})\b|حسابك|حساب رقم|بطاقتك|بطاقة:?\s*\d|كارت رقم|محفظتك/iu;
export const codeSure = (e) => !!e && (e.confidence === "high" || (e.confidence === "medium" && OWN_ACC.test(String(e.full || e.text || "")))) && e.amount > 0 && (e.direction === "in" || e.direction === "out") && fromMoneySource(e) && MOVED.test(String(e.full || e.text || ""));
/** v6.27 "by itself" — v9.9.10: only what the code is sure of (codeSure); the model's check comes on top (judged). */
export const autoPick = (entries) => (entries || []).filter(codeSure);

/** The question for the small model: one line of JSON back. */
export const judgePrompt = (e) => `A notification arrived on the phone of the person you work for. Decide if it reports money that ALREADY moved in or out of THIS person's own account or wallet.
NOT a payment: people chatting about money, wages or prices; offers; reminders; bills not yet paid; one-time codes; balances only; other people's money.
App: ${String(e.app || "").slice(0, 60)}
From: ${String(e.from || "").slice(0, 80)}
Message: ${String(e.full || e.text || "").replace(/\s+/g, " ").slice(0, 600)}
Answer with ONE line of JSON only: {"payment": true or false, "direction": "in" or "out" or "", "amount": number or 0}`;
/** The model's answer → "yes" (a real payment that matches the code: same direction, same amount) | "no" | "unsure". */
export function readJudge(out, e) {
  const m = /\{[^{}]*\}/.exec(String(out || "")); if (!m) return "unsure";
  let j = null; try { j = JSON.parse(m[0]); } catch (x) { return "unsure"; }
  if (j.payment === false || j.payment === "false") return "no";
  if (!(j.payment === true || j.payment === "true")) return "unsure";
  const amt = Number(String(j.amount).replace(/[^\d.]/g, "")) || 0;
  return j.direction === e.direction && Math.abs(amt - e.amount) < 0.01 ? "yes" : "unsure";
}
/** Code-sure entries → { add: the model agreed (or no model), wait: [{ ...e, doubt: "no"|"unsure" }] }. judge(prompt) → text, or null. */
export async function judged(entries, judge) {
  if (!judge) return { add: entries, wait: [] };
  const add = [], wait = [];
  for (const e of entries) {
    let v = "unsure"; try { v = readJudge(await judge(judgePrompt(e)), e); } catch (x) {}
    if (v === "yes") add.push(e); else wait.push({ ...e, doubt: v });
  }
  return { add, wait };
}

/** The same as Money's own "add-txns" (yusr/index.new.html): each entry into the first account of its currency (else the
 *  first account), id, date, note — used when Money isn't open, so its ledger is written directly. → { ledger, ids } */
export function appendToLedger(ledger, txns, now = Date.now()) {
  if (!ledger || !Array.isArray(ledger.txns) || !Array.isArray(ledger.accounts) || !ledger.accounts.length) return { ledger, ids: [] };
  const L = { ...ledger, txns: [...ledger.txns] }, ids = [], CR = loadCatRules();
  for (const t of (txns || []).slice(0, 50)) {
    const a = parseFloat(t.amount);
    if (!(a > 0 && a < 1e9) || (t.type !== "expense" && t.type !== "income")) continue;
    const acc = (t.account && L.accounts.find((x) => x.id === t.account)) || L.accounts.find((x) => t.currency && x.currency === t.currency) || L.accounts[0];   // v9.9.14: the account chosen for it first
    const id = "n" + now.toString(36) + Math.random().toString(36).slice(2, 6) + ids.length;
    const dg = digitsOf(acc.currency || t.currency || "EGP");   // v9.9.18: KWD / BHD / OMR / JOD / TND keep 3 decimals, JPY none
    L.txns.push({ id, ...(t.nid ? { nid: String(t.nid).slice(0, 80) } : {}), type: t.type, amount: Math.round(a * 10 ** dg) / 10 ** dg, cat: catFor(CR.rules, { note: t.note, cat: /^[a-z_]{2,20}$/.test(t.cat || "") ? t.cat : "other" }) /* v9.9.18 M5: "always put Seoudi in Groceries" */, account: acc.id, date: /^\d{4}-\d{2}-\d{2}$/.test(t.date || "") ? t.date : new Date(now).toISOString().slice(0, 10), note: String(t.note || "").slice(0, 80), created: typeof t.ts === "number" ? t.ts : now, ...(t.source === "notification" ? { source: "notification" } : {}) , ...(t.evidence && t.evidence.text ? { evidence: { text: String(t.evidence.text).slice(0, 2000), from: String(t.evidence.from || "").slice(0, 200), app: String(t.evidence.app || "").slice(0, 80), ts: +t.evidence.ts || 0 } } : {}) });
    ids.push(id);
  }
  return { ledger: L, ids };
}

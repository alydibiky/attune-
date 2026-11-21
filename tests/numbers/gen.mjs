// v10.8 (found reading every line of the 18 languages, 21 Nov 2026): the app's example lines say "Ahmed me debe 12.000" (Spanish),
// "12 000" (French), «৪০,০০০» (Bengali), "5万" (Japanese) — and the sentence readers took "12.000" as 12, ignored Bengali digits, didn't know
// 万 / लाख / triệu / тыс / mila, and multiplied "1.500 kenara" (Turkish) by a thousand. 10,000 sentences COMPOSED from parts in random
// order — who, what, the amount, a time — in all 20 languages, the amount written every way people write it, then hardened
// (tests/lib/hard.mjs). Truth written HERE: the amount. Checked: amountsIn (life.js — Money, Follow-ups) finds it and never a ×1000 /
// ×1,000,000 of it; amountIn (braindump.js — "Tell Attune") returns it.
//   node tests/numbers/gen.mjs        (N=2500 for the unit test; HELD=1 for the held-out set written after the fixes)
import { amountsIn } from "../../web-src/life.js";
import { amountIn } from "../../web-src/braindump.js";
import { harden, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
const N = +(process.env.N || 10000), HELD = !!process.env.HELD;
let seed = 4421 + (HELD ? 7717 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], maybe = (p, s) => (rnd() < p ? s : "");
const NATIVE = { ar: "٠١٢٣٤٥٦٧٨٩", arb: "٠١٢٣٤٥٦٧٨٩", fa: "۰۱۲۳۴۵۶۷۸۹", ur: "۰۱۲۳۴۵۶۷۸۹", hi: "०१२३४५६७८९", bn: "০১২৩৪৫৬৭৮৯", th: "๐๑๒๓๔๕๖๗๘๙" };
const nat = (L, s) => (NATIVE[L] ? String(s).replace(/\d/g, (d) => NATIVE[L][d]) : String(s));
const fw = (s) => String(s).replace(/\d/g, (d) => String.fromCharCode(0xff10 + +d)).replace(/,/g, "，");
const group = (n, sep) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
const indian = (n) => { const s = String(n); if (s.length <= 3) return s; const last = s.slice(-3), rest = s.slice(0, -3); return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last; };
const DOT = new Set(["de", "es", "pt", "it", "tr", "id", "vi"]);
// the ways each language writes the amount n (whole numbers; a few with cents) → [text, value]
function written(L, n) {
  const k = n % 1000 === 0 ? n / 1000 : null, opts = [[String(n), n]];
  if (n >= 1000) {
    if (L === "en" || L === "sw" || ["hi", "ur", "bn", "th", "zh", "ja", "ko", "fa", "ar", "arb"].includes(L)) opts.push([group(n, ","), n], [group(n, ","), n]);
    if (DOT.has(L)) opts.push([group(n, "."), n], [group(n, "."), n], [group(n, ".") + ",00", n]);
    if (L === "fr" || L === "ru") opts.push([group(n, " "), n], [group(n, " "), n], [group(n, " "), n]);
    if (["hi", "ur", "bn"].includes(L) && n >= 100000) opts.push([indian(n), n], [indian(n), n]);
    if (NATIVE[L]) opts.push([nat(L, group(n, L === "fa" || L === "ar" || L === "arb" ? pick([",", "٬"]) : ",")), n], [nat(L, String(n)), n]);
    if (L === "zh" || L === "ja") opts.push([fw(group(n, ",")), n]);
  }
  if (k && k < 1000) {   // "3000 thousand" / «2000 ألف» is not how anyone writes 3 million (an unrealistic case of the first run — the generator's fault)
    const W = { en: ["k", " thousand", "k"], ar: [" ألف", " الف"], arb: [" ألف"], es: [" mil"], pt: [" mil"], fr: [" mille"], de: [" Tausend"], it: [" mila"], tr: [" bin"],
      id: [" ribu", " rb"], ru: [" тыс", " тысяч", " тыс."], hi: [" हज़ार", " हजार"], ur: [" ہزار"], fa: [" هزار"], bn: [" হাজার"], vi: [" nghìn", " ngàn"], th: [" พัน"], ja: ["千"], zh: ["千"], ko: ["천"], sw: [] };
    for (const w of W[L] || []) opts.push([(NATIVE[L] && rnd() < 0.4 ? nat(L, k) : String(k)) + w, n]);
    if (L === "sw") opts.push(["elfu " + k, n]);
  }
  if (n % 10000 === 0 && ["zh", "ja", "ko"].includes(L)) { const w = L === "ko" ? "만" : pick(["万", "万", "萬"]); opts.push([n / 10000 + w, n], [n / 10000 + " " + w, n]); }
  if (n % 100000 === 0 && ["hi", "ur", "bn"].includes(L)) { const w = { hi: " लाख", ur: " لاکھ", bn: " লাখ" }[L]; opts.push([String(n / 100000) + w, n]); }
  // «1 millones» is not Spanish ("1 millón") — the generator's fault in the first run
  if (n % 1000000 === 0 && (n > 1e6 || L === "en" || !/^(es|fr|de|it|pt|tr)$/.test(L))) { const w = { en: "m", vi: " triệu", ru: " млн", th: " ล้าน", es: " millones", fr: " millions", de: " Millionen", it: " milioni", tr: " milyon", id: " juta", ar: " مليون", fa: " میلیون" }[L]; if (w) opts.push([n / 1e6 + w, n]); }
  return pick(opts);
}
// sentence parts per language: [who, verb-before-amount, after-amount, time] — composed in a few word orders
const P = {
  en: { who: ["Ahmed", "my brother", "Sara", "the landlord", "Omar"], v: ["owes me", "lent me", "paid me back", "sent", "wants"], spend: ["spent", "paid", "I paid", "bought a phone for", "rent is"], tail: ["", " for the trip", " cash", " EGP", " pounds"], when: ["", " tomorrow", " on Friday", " at 5", " next week", " this month"] },
  ar: { who: ["أحمد", "أخويا", "سارة", "صاحب الشقة"], v: ["عليه", "سلفني", "رجعلي", "بعت", "عايز"], spend: ["دفعت", "صرفت", "اشتريت موبايل بـ", "الإيجار"], tail: ["", " جنيه", " كاش", " للرحلة"], when: ["", " بكرة", " يوم الجمعة", " الساعة ٥", " الشهر ده"] },
  arb: { who: ["أحمد", "أخي", "سارة"], v: ["يدين لي بـ", "أقرضني", "أعاد لي"], spend: ["دفعت", "أنفقت", "الإيجار"], tail: ["", " جنيه", " نقدًا"], when: ["", " غدًا", " يوم الجمعة", " هذا الشهر"] },
  es: { who: ["Ahmed", "mi hermano", "Sara", "el casero"], v: ["me debe", "me prestó", "me devolvió", "mandó"], spend: ["gasté", "pagué", "el alquiler es", "compré un móvil por"], tail: ["", " euros", " en efectivo", " para el viaje"], when: ["", " mañana", " el viernes", " a las 5", " este mes"] },
  fr: { who: ["Ahmed", "mon frère", "Sara", "le propriétaire"], v: ["me doit", "m'a prêté", "m'a rendu", "a envoyé"], spend: ["j'ai dépensé", "j'ai payé", "le loyer est de", "acheté un téléphone pour"], tail: ["", " €", " euros", " en liquide"], when: ["", " demain", " vendredi", " à 17 h", " ce mois-ci"] },
  de: { who: ["Ahmed", "mein Bruder", "Sara", "der Vermieter"], v: ["schuldet mir", "hat mir geliehen", "hat mir zurückgezahlt", "schickte"], spend: ["ausgegeben", "bezahlt", "die Miete ist", "Handy gekauft für"], tail: ["", " Euro", " €", " bar"], when: ["", " morgen", " am Freitag", " um 17 Uhr", " diesen Monat"] },
  pt: { who: ["Ahmed", "meu irmão", "Sara", "o proprietário"], v: ["me deve", "me emprestou", "me devolveu", "mandou"], spend: ["gastei", "paguei", "o aluguel é", "comprei um celular por"], tail: ["", " reais", " em dinheiro", " para a viagem"], when: ["", " amanhã", " na sexta", " às 17h", " este mês"] },
  it: { who: ["Ahmed", "mio fratello", "Sara", "il padrone di casa"], v: ["mi deve", "mi ha prestato", "mi ha ridato", "ha mandato"], spend: ["ho speso", "ho pagato", "l'affitto è", "comprato un telefono per"], tail: ["", " euro", " in contanti"], when: ["", " domani", " venerdì", " alle 17", " questo mese"] },
  ru: { who: ["Ахмед", "мой брат", "Сара", "хозяин квартиры"], v: ["должен мне", "одолжил мне", "вернул мне", "отправил"], spend: ["потратил", "заплатил", "аренда", "купил телефон за"], tail: ["", " руб", " ₽", " наличными"], when: ["", " завтра", " в пятницу", " в 17:00", " в этом месяце"] },
  tr: { who: ["Ahmet", "kardeşim", "Sara", "ev sahibi"], v: ["bana borçlu", "bana ödünç verdi", "geri ödedi", "gönderdi"], spend: ["harcadım", "ödedim", "kira", "telefon aldım"], tail: ["", " TL", " lira", " nakit", " kenara koydum"], when: ["", " yarın", " cuma günü", " saat 17'de", " bu ay"] },
  id: { who: ["Ahmed", "kakak saya", "Sara", "pemilik kos"], v: ["berutang", "meminjamkan", "mengembalikan", "mengirim"], spend: ["habis", "bayar", "sewa", "beli HP"], tail: ["", " rupiah", " tunai", " kepada saya", " hari ini"], when: ["", " besok", " hari Jumat", " jam 5", " bulan ini"] },
  vi: { who: ["Ahmed", "anh tôi", "Sara", "chủ nhà"], v: ["nợ tôi", "cho tôi mượn", "trả lại", "gửi"], spend: ["đã tiêu", "đã trả", "tiền thuê là", "mua điện thoại"], tail: ["", " đồng", " tiền mặt"], when: ["", " ngày mai", " thứ Sáu", " lúc 5 giờ", " tháng này"] },
  sw: { who: ["Ahmed", "kaka yangu", "Sara", "mwenye nyumba"], v: ["ananidai", "alinikopesha", "alinirudishia", "alituma"], spend: ["nilitumia", "nililipa", "kodi ni", "nilinunua simu kwa"], tail: ["", " shilingi", " taslimu"], when: ["", " kesho", " Ijumaa", " saa 5", " mwezi huu"] },
  hi: { who: ["अहमद", "मेरा भाई", "सारा", "मकान मालिक"], v: ["पर मेरे", "ने उधार दिए", "ने लौटाए", "ने भेजे"], spend: ["खर्च किए", "दिए", "किराया", "फ़ोन लिया"], tail: ["", " रुपये", " नकद"], when: ["", " कल", " शुक्रवार को", " 5 बजे", " इस महीने"] },
  ur: { who: ["احمد", "میرا بھائی", "سارہ", "مالک مکان"], v: ["پر میرے", "نے ادھار دیے", "نے واپس کیے", "نے بھیجے"], spend: ["خرچ کیے", "دیے", "کرایہ", "فون لیا"], tail: ["", " روپے", " نقد"], when: ["", " کل", " جمعہ کو", " 5 بجے", " اس مہینے"] },
  fa: { who: ["احمد", "برادرم", "سارا", "صاحبخانه"], v: ["به من بدهکار است", "به من قرض داد", "پس داد", "فرستاد"], spend: ["خرج کردم", "پرداختم", "اجاره", "گوشی خریدم"], tail: ["", " تومان", " ریال", " نقد"], when: ["", " فردا", " جمعه", " ساعت ۵", " این ماه"] },
  bn: { who: ["আহমেদ", "আমার ভাই", "সারা", "বাড়িওয়ালা"], v: ["আমার কাছে", "ধার দিল", "ফেরত দিল", "পাঠাল"], spend: ["খরচ করেছি", "দিয়েছি", "ভাড়া", "ফোন কিনেছি"], tail: ["", " টাকা", " নগদ", "-এর নিচে"], when: ["", " কাল", " শুক্রবার", " ৫টায়", " এই মাসে"] },
  th: { who: ["อาเหม็ด", "พี่ชายฉัน", "ซาร่า", "เจ้าของบ้าน"], v: ["ติดเงินฉัน", "ให้ฉันยืม", "คืนเงิน", "โอนมา"], spend: ["จ่ายไป", "ใช้ไป", "ค่าเช่า", "ซื้อโทรศัพท์"], tail: ["", " บาท", "บาท", " เงินสด"], when: ["", " พรุ่งนี้", " วันศุกร์", " ตอน 5 โมง", " เดือนนี้"] },
  zh: { who: ["艾哈迈德", "我哥", "萨拉", "房东"], v: ["欠我", "借给我", "还了我", "转了"], spend: ["花了", "付了", "房租", "买手机花了"], tail: ["", "元", " 块", "现金"], when: ["", "明天", "周五", "5点", "这个月"] },
  ja: { who: ["アハメド", "兄", "サラ", "大家さん"], v: ["に貸している", "が貸してくれた", "が返してくれた", "が送った"], spend: ["使った", "払った", "家賃は", "スマホを買った"], tail: ["", "円", " 円", "現金で"], when: ["", "明日", "金曜日に", "5時に", "今月"] },
  ko: { who: ["아메드", "형", "사라", "집주인"], v: ["가 나한테", "가 빌려줬다", "가 갚았다", "가 보냈다"], spend: ["썼다", "냈다", "월세", "폰 샀다"], tail: ["", "원", " 원", " 현금"], when: ["", " 내일", " 금요일에", " 5시에", " 이번 달"] },
};
const LANGS = Object.keys(P);
const AMOUNTS = [1500, 2000, 2500, 3000, 4500, 6000, 6500, 8000, 9000, 12000, 15000, 18500, 20000, 25000, 30000, 38000, 40000, 50000, 60000, 75000, 100000, 120000, 150000, 200000, 250000, 500000, 1000000, 2000000, 3000000];
const HELD_AMOUNTS = [1750, 2200, 3300, 4000, 7000, 11000, 13500, 16000, 22000, 35000, 45000, 70000, 80000, 90000, 110000, 300000, 400000, 600000, 700000, 5000000];
function one() {
  const L = pick(LANGS), p = P[L], n = pick(HELD ? HELD_AMOUNTS : AMOUNTS), [amt, value] = written(L, n);
  const lend = rnd() < 0.5, who = pick(p.who), v = lend ? pick(p.v) : pick(p.spend), tail = pick(p.tail), when = pick(p.when);
  const sp = /^(zh|ja|th)$/.test(L) ? pick(["", " "]) : " ";
  const orders = lend ? [[who, v, amt + tail, when], [who, v, amt + tail], [when.trim(), who, v, amt + tail], [who, amt + tail, v, when]]
    : [[v, amt + tail, when], [when.trim(), v, amt + tail], [amt + tail, v, when], [v, amt + tail]];
  // no space in Chinese / Japanese / Thai — but nobody glues a time's digits onto the amount's («200,0005時に» was the generator's fault)
  let text = pick(orders).filter((x) => x && x.trim()).map((x) => x.trim()).reduce((a, x) => a + (a && (sp || /^\d/.test(x)) ? " " : "") + x, "");
  text = maybe(0.15, pick(["btw ", "ok ", "note: ", "💸 ", "✔ "])) + text + maybe(0.3, pick([".", "!", " 🙏", " ✅", "?"]));
  return { L, value, text: harden(text, rnd, { lang: L, human: true, keep: amt }), amt };
}
const cases = Array.from({ length: N }, one);
let ok = 0; const fails = [], byL = {};
for (const c of cases) {
  const all = amountsIn(c.text).map((a) => a.value), first = amountIn(c.text);
  const good = all.includes(c.value) && !all.some((v) => v === c.value * 1000 || v === c.value * 1e6) && first === c.value;
  (byL[c.L] = byL[c.L] || [0, 0])[1]++;
  if (good) { ok++; byL[c.L][0]++; } else if (fails.length < 60) fails.push(`[${c.L}] ${JSON.stringify(c.text)} want ${c.value} · amountsIn ${JSON.stringify(all)} · amountIn ${first}`);
}
const sh = shapeReport(cases.map((c) => c.text));
console.log(`${HELD ? "held-out" : "generated"} ${N}: ${ok}/${N} = ${(100 * ok / N).toFixed(2)} % · shapes ${(100 * sh.share).toFixed(1)} % (bar ${SHAPE_BAR * 100} %)`);
console.log(Object.entries(byL).map(([l, [a, b]]) => `${l} ${(100 * a / b).toFixed(0)}%`).join(" · "));
if (fails.length) console.log(fails.slice(0, +(process.env.SHOW || 25)).join("\n"));
export const RESULT = { ok, n: N, share: sh.share };

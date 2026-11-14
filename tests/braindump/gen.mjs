// v9.9.21 T1 — exactly 10,000 brain-dump paragraphs (2–6 clauses) in the 20 languages + Franco: shopping, reminders with a time,
// payments due on a day of the month, money already spent, plain to-dos, each with a day (today / tomorrow / a weekday / none).
// The oracle is written here: the expected type, date, time, amount and the things to buy for EVERY clause.
// node tests/braindump/gen.mjs [n] → pass rate (+ report.md at 10,000).
import fs from "fs";
const B = await import(process.env.BRAINDUMP || "../../web-src/braindump.js");
const N = +(process.argv[2] || 10000), now = Date.parse("2026-11-12T10:00:00");   // a Thursday
let seed = 11 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 2147483648), pick = (l) => l[Math.floor(rnd() * l.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const DAY = 864e5, noon = Date.parse("2026-11-12T12:00:00");
const L = {
  en: { buy: ["buy", "get"], and: "and", items: ["milk", "bread", "eggs", "rice", "sugar", "coffee"], call: ["call", "phone"], who: ["the bank", "Ahmed", "the dentist"], at: (h) => "at " + h, pay: "pay", bill: ["the rent", "the internet bill"], nth: (n) => "on the " + n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"), spent: "paid", for: "for", things: ["taxi", "lunch", "parking"], tasks: ["finish the report", "clean the kitchen", "send the CV"], today: "today", tomorrow: "tomorrow", then: ["and then", "also"] },
  ar: { buy: ["اشتري", "هات"], and: "و", items: ["لبن", "عيش", "بيض", "رز", "سكر", "قهوة"], call: ["كلم", "اتصل ب"], who: ["البنك", "أحمد", "دكتور الأسنان"], at: (h) => "الساعة " + h, pay: "ادفع", bill: ["الإيجار", "فاتورة النت"], nth: (n) => "يوم " + n, spent: "دفعت", for: "", things: ["تاكسي", "غدا", "باركينج"], tasks: ["خلص التقرير", "نضف المطبخ", "ابعت السي في"], today: "النهاردة", tomorrow: "بكرة", then: ["وبعدين", "وكمان"] },
  arb: { buy: ["اشترِ"], and: "و", items: ["حليب", "خبز", "بيض", "أرز"], call: ["اتصل ب"], who: ["البنك", "أحمد"], at: (h) => "الساعة " + h, pay: "ادفع", bill: ["الإيجار", "فاتورة الكهرباء"], nth: (n) => "يوم " + n, spent: "دفعت", for: "", things: ["سيارة أجرة", "الغداء"], tasks: ["أنهِ التقرير", "رتّب المكتب"], today: "اليوم", tomorrow: "غدًا", then: ["ثم"] },
  es: { buy: ["comprar", "compra"], and: "y", items: ["leche", "pan", "huevos", "arroz"], call: ["llamar a", "llama a"], who: ["el banco", "Ahmed", "el dentista"], at: (h) => "a las " + h, pay: "pagar", bill: ["el alquiler", "la factura de internet"], nth: (n) => "el día " + n, spent: "pagué", for: "por", things: ["el taxi", "la comida"], tasks: ["terminar el informe", "limpiar la cocina"], today: "hoy", tomorrow: "mañana", then: ["y luego", "también"] },
  fr: { buy: ["acheter"], and: "et", items: ["lait", "pain", "œufs", "riz"], call: ["appeler"], who: ["la banque", "Ahmed", "le dentiste"], at: (h) => "à " + h + "h", pay: "payer", bill: ["le loyer", "la facture internet"], nth: (n) => "le " + n, spent: "j'ai payé", for: "pour", things: ["le taxi", "le déjeuner"], tasks: ["finir le rapport", "ranger la cuisine"], today: "aujourd'hui", tomorrow: "demain", then: ["et puis", "aussi"] },
  de: { buy: ["kaufen", "besorgen"], and: "und", items: ["Milch", "Brot", "Eier", "Reis"], call: ["anrufen"], who: ["die Bank", "Ahmed", "den Zahnarzt"], at: (h) => "um " + h + " Uhr", pay: "bezahlen", bill: ["die Miete", "die Internetrechnung"], nth: (n) => "am " + n + ".", spent: "bezahlt", for: "für", things: ["Taxi", "Mittagessen"], tasks: ["den Bericht fertig machen", "die Küche putzen"], today: "heute", tomorrow: "morgen", then: ["und dann", "außerdem"], order: "de" },
  pt: { buy: ["comprar"], and: "e", items: ["leite", "pão", "ovos", "arroz"], call: ["ligar para"], who: ["o banco", "Ahmed", "o dentista"], at: (h) => "às " + h, pay: "pagar", bill: ["o aluguel", "a conta de internet"], nth: (n) => "dia " + n, spent: "paguei", for: "pelo", things: ["táxi", "almoço"], tasks: ["terminar o relatório", "limpar a cozinha"], today: "hoje", tomorrow: "amanhã", then: ["e depois", "também"] },
  it: { buy: ["comprare"], and: "e", items: ["latte", "pane", "uova", "riso"], call: ["chiamare"], who: ["la banca", "Ahmed", "il dentista"], at: (h) => "alle " + h, pay: "pagare", bill: ["l'affitto", "la bolletta"], nth: (n) => "il " + n, spent: "ho pagato", for: "per", things: ["il taxi", "il pranzo"], tasks: ["finire il rapporto", "pulire la cucina"], today: "oggi", tomorrow: "domani", then: ["e poi", "anche"] },
  ru: { buy: ["купить"], and: "и", items: ["молоко", "хлеб", "яйца", "рис"], call: ["позвонить"], who: ["в банк", "Ахмеду", "стоматологу"], at: (h) => "в " + h, pay: "оплатить", bill: ["аренду", "счёт за интернет"], nth: (n) => n + "-го", spent: "заплатил", for: "за", things: ["такси", "обед"], tasks: ["закончить отчёт", "убрать кухню"], today: "сегодня", tomorrow: "завтра", then: ["а потом", "также"] },
  tr: { buy: ["satın al"], and: "ve", items: ["süt", "ekmek", "yumurta", "pirinç"], call: ["ara"], who: ["bankayı", "Ahmet'i", "dişçiyi"], at: (h) => "saat " + h, pay: "öde", bill: ["kira", "internet faturası"], nth: (n) => "ayın " + n + "'i", spent: "ödedim", for: "", things: ["taksi", "öğle yemeği"], tasks: ["raporu bitir", "mutfağı temizle"], today: "bugün", tomorrow: "yarın", then: ["sonra", "ayrıca"] },
  id: { buy: ["beli"], and: "dan", items: ["susu", "roti", "telur", "beras"], call: ["telepon"], who: ["bank", "Ahmad", "dokter gigi"], at: (h) => "jam " + h, pay: "bayar", bill: ["sewa", "tagihan internet"], nth: (n) => "tanggal " + n, spent: "sudah bayar", for: "untuk", things: ["taksi", "makan siang"], tasks: ["selesaikan laporan", "bersihkan dapur"], today: "hari ini", tomorrow: "besok", then: ["lalu", "juga"] },
  hi: { buy: ["खरीदना"], and: "और", items: ["दूध", "ब्रेड", "अंडे", "चावल"], call: ["फ़ोन"], who: ["बैंक को", "अहमद को"], at: (h) => h + " बजे", pay: "भुगतान", bill: ["किराया", "बिजली बिल"], nth: (n) => n + " तारीख", spent: "दिए", for: "", things: ["टैक्सी", "खाना"], tasks: ["रिपोर्ट पूरी करना", "रसोई साफ़ करना"], today: "आज", tomorrow: "कल", then: ["फिर"] },
  ur: { buy: ["خریدنا"], and: "اور", items: ["دودھ", "ڈبل روٹی", "انڈے", "چاول"], call: ["فون"], who: ["بینک کو", "احمد کو"], at: (h) => h + " بجے", pay: "ادا کرنا", bill: ["کرایہ", "بجلی کا بل"], nth: (n) => n + " تاریخ", spent: "دیے", for: "", things: ["ٹیکسی", "کھانا"], tasks: ["رپورٹ مکمل کرنا", "باورچی خانہ صاف کرنا"], today: "آج", tomorrow: "کل", then: ["پھر"] },
  fa: { buy: ["بخر"], and: "و", items: ["شیر", "نان", "تخم‌مرغ", "برنج"], call: ["زنگ"], who: ["بانک", "احمد"], at: (h) => "ساعت " + h, pay: "پرداخت", bill: ["اجاره", "قبض برق"], nth: (n) => n + " ام", spent: "پرداختم", for: "", things: ["تاکسی", "ناهار"], tasks: ["گزارش را تمام کن", "آشپزخانه را تمیز کن"], today: "امروز", tomorrow: "فردا", then: ["بعد"] },
  bn: { buy: ["কিনতে"], and: "আর", items: ["দুধ", "রুটি", "ডিম", "চাল"], call: ["ফোন"], who: ["ব্যাংকে", "আহমেদকে"], at: (h) => h + " টায়", pay: "পরিশোধ", bill: ["ভাড়া", "বিদ্যুৎ বিল"], nth: (n) => n + " তারিখ", spent: "দিয়েছি", for: "", things: ["ট্যাক্সি", "দুপুরের খাবার"], tasks: ["রিপোর্ট শেষ করা", "রান্নাঘর পরিষ্কার করা"], today: "আজ", tomorrow: "আগামীকাল", then: ["তারপর"] },
  sw: { buy: ["nunua"], and: "na", items: ["maziwa", "mkate", "mayai", "mchele"], call: ["piga simu"], who: ["benki", "Ahmed"], at: (h) => "saa " + h, pay: "lipa", bill: ["kodi", "bili ya umeme"], nth: (n) => "tarehe " + n, spent: "nimelipa", for: "kwa", things: ["teksi", "chakula cha mchana"], tasks: ["maliza ripoti", "safisha jikoni"], today: "leo", tomorrow: "kesho", then: ["kisha", "pia"] },
  th: { buy: ["ซื้อ"], and: "และ", items: ["นม", "ขนมปัง", "ไข่", "ข้าวสาร"], call: ["โทร"], who: ["หาธนาคาร", "หาอาเหม็ด"], at: (h) => "เวลา " + h, pay: "จ่าย", bill: ["ค่าเช่า", "ค่าไฟ"], nth: (n) => "วันที่ " + n, spent: "จ่ายแล้ว", for: "ค่า", things: ["แท็กซี่", "อาหารกลางวัน"], tasks: ["ทำรายงานให้เสร็จ", "ทำความสะอาดครัว"], today: "วันนี้", tomorrow: "พรุ่งนี้", then: ["แล้วก็"] },
  vi: { buy: ["mua"], and: "và", items: ["sữa", "bánh mì", "trứng", "gạo"], call: ["gọi"], who: ["ngân hàng", "anh Ahmed"], at: (h) => "lúc " + h + " giờ", pay: "trả", bill: ["tiền nhà", "hóa đơn điện"], nth: (n) => "ngày " + n, spent: "đã trả", for: "tiền", things: ["taxi", "bữa trưa"], tasks: ["làm xong báo cáo", "dọn bếp"], today: "hôm nay", tomorrow: "ngày mai", then: ["rồi", "còn"] },
  zh: { buy: ["买"], and: "和", items: ["牛奶", "面包", "鸡蛋", "大米"], call: ["给银行打电话", "给艾哈迈德打电话"], who: [""], at: (h) => h + "点", pay: "交", bill: ["房租", "电费"], nth: (n) => n + "号", spent: "花了", for: "", things: ["打车", "午饭"], tasks: ["写完报告", "打扫厨房"], today: "今天", tomorrow: "明天", then: ["然后", "还有"], cjk: 1 },
  ja: { buy: ["買う"], and: "と", items: ["牛乳", "パン", "卵", "米"], call: ["銀行に電話", "アフメドに電話"], who: [""], at: (h) => h + "時", pay: "払う", bill: ["家賃", "電気代"], nth: (n) => n + "日", spent: "払った", for: "", things: ["タクシー", "ランチ"], tasks: ["レポートを仕上げる", "台所を掃除する"], today: "今日", tomorrow: "明日", then: ["それから"], cjk: 1 },
  ko: { buy: ["사기"], and: "하고", items: ["우유", "빵", "계란", "쌀"], call: ["전화"], who: ["은행에", "아메드에게"], at: (h) => h + "시", pay: "납부", bill: ["월세", "전기 요금"], nth: (n) => n + "일", spent: "냈다", for: "", things: ["택시", "점심"], tasks: ["보고서 끝내기", "부엌 청소"], today: "오늘", tomorrow: "내일", then: ["그리고"] },
  franco: { buy: ["eshtery", "hat"], and: "w", items: ["laban", "3eish", "beid", "ruz"], call: ["kalem"], who: ["el bank", "Ahmed"], at: (h) => "el sa3a " + h, pay: "edfa3", bill: ["el egar", "fatoora el net"], nth: (n) => "yom " + n, spent: "dafa3t", for: "", things: ["taxi", "el ghada"], tasks: ["khalas el report", "nadaf el matbakh"], today: "elnaharda", tomorrow: "bokra", then: ["w ba3dein", "w kaman"] },
};
const LOC = { franco: "en", arb: "ar" };
const wdName = (lang, i) => { const loc = LOC[lang] || lang; try { return new Intl.DateTimeFormat(loc, { weekday: "long" }).format(new Date(2026, 10, 1 + i)); } catch (e) { return ""; } };
const nextWd = (i) => { const d = new Date(noon), add = (i - d.getDay() + 7) % 7; return iso(noon + add * DAY); };
const nth = (n) => { const d = new Date(noon); if (d.getDate() > n) d.setMonth(d.getMonth() + 1, 1); d.setDate(n); return iso(d.getTime()); };
function clause(lang, carried) {
  const w = L[lang], kind = pick(["list", "list", "reminder", "payment", "spent", "todo"]);
  let day = null, dayTxt = "";
  const dk = carried ? "none" : pick(["none", "today", "tomorrow", "wd"]);
  if (dk === "today") { day = iso(noon); dayTxt = w.today; } else if (dk === "tomorrow") { day = iso(noon + DAY); dayTxt = w.tomorrow; }
  else if (dk === "wd" && lang !== "franco") { const i = int(0, 6); day = nextWd(i); dayTxt = wdName(lang, i); }
  const sp = w.cjk ? "" : " ";
  const put = (core) => (dayTxt ? (w.cjk || rnd() < 0.5 ? dayTxt + sp + core : core + sp + dayTxt) : core);
  if (kind === "list") { const its = [...w.items].sort(() => rnd() - 0.5).slice(0, int(1, 3)), list = its.length === 1 ? its[0] : its.slice(0, -1).join(w.cjk ? "、" : ", ") + sp + w.and + sp + its[its.length - 1];
    const core = lang === "ja" ? list + "を買う" : w.cjk ? pick(w.buy) + list : lang === "de" ? list + " " + pick(w.buy) : lang === "hi" || lang === "ur" || lang === "bn" || lang === "ko" || lang === "tr" ? list + " " + pick(w.buy) : pick(w.buy) + " " + list;
    return { text: put(core), want: { type: "list", date: day, time: null, amount: null, items: its } }; }
  if (kind === "reminder") { const h = int(7, 11), who = pick(w.who), c = pick(w.call);
    const core = w.cjk ? c + w.at(h).replace(/^/, "") : lang === "hi" || lang === "ur" || lang === "bn" || lang === "ko" || lang === "tr" ? who + " " + w.at(h) + " " + c : c + " " + who + " " + w.at(h);
    return { text: put(core.replace(/\s+/g, sp || " ").trim()), want: { type: "reminder", date: day, time: String(h).padStart(2, "0") + ":00", amount: null } }; }
  if (kind === "payment") { const n = int(1, 28), amt = int(3, 300) * 50, bill = pick(w.bill);
    const core = w.cjk ? w.nth(n) + w.pay + bill + amt : lang === "hi" || lang === "ur" || lang === "bn" || lang === "ko" || lang === "tr" ? w.nth(n) + " " + bill + " " + amt + " " + w.pay : w.pay + " " + bill + " " + amt + " " + w.nth(n);
    return { text: core, want: { type: "payment", date: nth(n), time: null, amount: amt } }; }
  if (kind === "spent") { const amt = int(1, 900) * 5, th = pick(w.things);
    const core = w.cjk ? th + w.spent + amt : lang === "hi" || lang === "ur" || lang === "bn" || lang === "ko" ? th + " " + amt + " " + w.spent : w.spent + " " + amt + (w.for ? " " + w.for : "") + " " + th;
    return { text: core, want: { type: "spent", date: iso(noon), time: null, amount: amt } }; }
  const t = pick(w.tasks); return { text: put(t), want: { type: "todo", date: day, time: null, amount: null } };
}
const cases = [];
for (let i = 0; i < N; i++) {
  const lang = pick(Object.keys(L)), w = L[lang], n = int(2, 6), parts = [], want = [];
  for (let k = 0; k < n; k++) { const c = clause(lang, false); parts.push(c.text); want.push(c.want); }
  let text = parts[0];
  for (let k = 1; k < n; k++) { const j = rnd(); text += w.cjk ? (j < 0.5 ? "，" : "。") + (j < 0.25 ? pick(w.then) : "") + parts[k] : j < 0.4 ? ", " + parts[k] : j < 0.7 ? ". " + parts[k] : j < 0.85 ? " " + pick(w.then) + " " + parts[k] : "\n" + parts[k]; }
  cases.push({ i, lang, text, want });
}
let pass = 0; const miss = {}, ex = {};
for (const c of cases) {
  let got, why = "";
  try { got = B.organise(c.text, { now }); } catch (e) { why = "crash " + e.message; }
  if (!why && got.length !== c.want.length) why = "clauses " + got.length + " ≠ " + c.want.length;
  if (!why) for (let k = 0; k < c.want.length; k++) { const g = got[k], w = c.want[k];
    if (g.type !== w.type) { why = "type " + w.type + "→" + g.type; break; }
    if ((g.date || null) !== (w.date || null)) { why = w.type + " date " + w.date + "→" + g.date; break; }
    if (w.time && g.time !== w.time) { why = "time " + w.time + "→" + g.time; break; }
    if (w.amount != null && g.amount !== w.amount) { why = w.type + " amount " + w.amount + "→" + g.amount; break; }
    if (w.items && JSON.stringify(g.items.map((x) => x.toLowerCase())) !== JSON.stringify(w.items.map((x) => x.toLowerCase()))) { why = "items " + w.items.join("/") + "→" + g.items.join("/"); break; } }
  if (!why) pass++; else { const k = c.lang + ": " + why.replace(/\d{4}-\d\d-\d\d/g, "D").replace(/\d+/g, "N").slice(0, 70); (miss[k] = miss[k] || []).push(c.i); ex[k] = ex[k] || c.text; }
}
const pct = (100 * pass / cases.length).toFixed(2);
const rep = ["# Brain dump — " + cases.length + " paragraphs", "", "Passed: **" + pass + " / " + cases.length + " (" + pct + "%)**", "", ...Object.entries(miss).sort((x, y) => y[1].length - x[1].length).slice(0, 60).map(([k, l]) => "- " + k + " — " + l.length + "  e.g. «" + ex[k].slice(0, 140).replace(/\n/g, " / ") + "»")].join("\n");
if (N === 10000) fs.writeFileSync(new URL(+process.env.SEED_SHIFT ? "../onemillion/B-braindump-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), rep + "\n");
console.log(rep.split("\n").slice(0, +(process.env.LINES || 40)).join("\n"));

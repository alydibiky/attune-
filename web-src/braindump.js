/* ---- v9.9.21 T1 Brain dump (Ali picked A + his note "NOT voice only: a typed / pasted brainstorm paragraph is organised the same way";
   combined screen OK'd 12 Nov — https://claude.ai/artifact/HeHrRSrz3BNcDa9vwZhGNU). Pure: organise(text, { now, lang }) → items:
     { type: "todo" | "reminder" | "list" | "payment" | "spent" | "note", text, date: "YYYY-MM-DD" | null, time: "HH:MM" | null,
       amount: number | null, items: [..] (a list), src: the clause as written }
   A paragraph is cut into clauses (sentence ends, new lines, ";", and each language's "and then / also"); a comma cuts too, but a piece
   with no action word that follows a shopping clause is one more thing to buy ("buy milk, bread and eggs"). A day said once with a
   colon ("tomorrow: …") carries to the clauses after it. Every clause is kept — anything not understood is a "note", never dropped.
   Word tables for the 20 languages + Franco; weekday names come from Intl, so every language has them. Nothing is saved here: the
   screen shows the items and saves only the ones ticked.
   Tests: tests/braindump/gen.mjs (10,000 paragraphs in 20 languages + Franco) + tests/unit/v9921braindump.test.mjs.            */
const DAY = 864e5;
const DIG = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9, "۰": 0, "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5, "۶": 6, "۷": 7, "۸": 8, "۹": 9 };
const SCRIPTS = ["०", "০", "๐"];   // Devanagari, Bengali, Thai zero — each script's digits run on from its zero
export function latinDigits(s) {
  let t = String(s || "").replace(/[٠-٩۰-۹]/g, (d) => DIG[d]);
  for (const z of SCRIPTS) { const base = z.charCodeAt(0); t = t.replace(new RegExp("[" + z + "-" + String.fromCharCode(base + 9) + "]", "g"), (d) => String(d.charCodeAt(0) - base)); }
  return t.replace(/٫/g, ".").replace(/[٬،](?=\d{3}\b)/g, ",");
}
const ALT = (l) => l.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
// a word as a word: no letter right before or after (Arabic-script words may carry و / ف / ب / ل in front)
const W = (l, pre = "") => new RegExp("(?:^|[^\\p{L}\\p{M}])" + pre + "(?:" + ALT(l) + ")(?=$|[^\\p{L}\\p{M}])", "iu");
// CJK / Thai have no spaces: plain contains
const C = (l) => new RegExp("(?:" + ALT(l) + ")", "u");

// ---- the word tables (one per idea; every language) -------------------------------------------------------------------------------
const T = {
  spent: { en: ["paid", "spent", "i paid", "i spent"], ar: ["دفعت", "صرفت", "اديت"], arb: ["دفعت", "أنفقت", "صرفت"], es: ["pagué", "gasté"], fr: ["payé", "dépensé"], de: ["bezahlt", "ausgegeben"],
    pt: ["paguei", "gastei"], it: ["pagato", "speso"], ru: ["заплатил", "заплатила", "потратил", "потратила"], tr: ["ödedim", "harcadım"], id: ["sudah bayar", "udah bayar", "menghabiskan"],
    hi: ["दिए", "खर्च किए", "चुकाए"], ur: ["دیے", "خرچ کیے", "ادا کیے"], fa: ["پرداختم", "خرج کردم"], bn: ["দিয়েছি", "খরচ করেছি"], sw: ["nimelipa", "nimetumia"],
    th: ["จ่ายไปแล้ว", "จ่ายแล้ว"], vi: ["đã trả", "đã tiêu"], zh: ["花了", "付了"], ja: ["払った", "使った"], ko: ["냈다", "썼다", "결제했다"], franco: ["dafa3t", "saraft", "dafaat"] },
  pay: { en: ["pay", "transfer"], ar: ["ادفع", "هدفع", "حول", "أدفع"], arb: ["ادفع", "سدد", "حوّل"], es: ["pagar", "paga"], fr: ["payer", "régler"], de: ["bezahlen", "zahlen", "überweisen"],
    pt: ["pagar", "paga"], it: ["pagare", "paga"], ru: ["оплатить", "заплатить"], tr: ["öde", "ödemek"], id: ["bayar", "membayar"], hi: ["भुगतान", "चुकाना", "भरना"], ur: ["ادا کرنا", "ادائیگی", "بھرنا"],
    fa: ["پرداخت", "بپرداز"], bn: ["পরিশোধ", "বিল দিতে"], sw: ["lipa", "kulipa"], th: ["จ่าย", "ชำระ"], vi: ["trả", "thanh toán", "đóng"], zh: ["付", "交", "支付"], ja: ["払う", "支払い", "振り込む"],
    ko: ["내기", "납부", "결제", "송금"], franco: ["edfa3", "adfa3", "hadfa3"] },
  bill: { en: ["rent", "bill", "instalment", "installment", "gam'eya", "school fees", "subscription"], ar: ["الإيجار", "الايجار", "فاتورة", "قسط", "الجمعية", "جمعية", "المصاريف"], arb: ["الإيجار", "فاتورة", "قسط", "اشتراك"],
    es: ["alquiler", "factura", "cuota"], fr: ["loyer", "facture"], de: ["miete", "rechnung", "rate"], pt: ["aluguel", "aluguer", "conta", "fatura"], it: ["affitto", "bolletta", "rata"],
    ru: ["аренду", "счёт", "счет", "взнос"], tr: ["kira", "fatura", "taksit"], id: ["sewa", "tagihan", "cicilan"], hi: ["किराया", "बिल", "किस्त"], ur: ["کرایہ", "بل", "قسط"], fa: ["اجاره", "قبض", "قسط"],
    bn: ["ভাড়া", "বিল", "কিস্তি"], sw: ["kodi", "bili"], th: ["ค่าเช่า", "บิล", "ค่างวด"], vi: ["tiền nhà", "hóa đơn"], zh: ["房租", "账单", "分期"], ja: ["家賃", "請求", "ローン"], ko: ["월세", "요금", "할부"], franco: ["el egar", "fatoora"] },
  buy: { en: ["buy", "get", "pick up"], ar: ["اشتري", "اشترى", "هات", "جيب", "نشتري"], arb: ["اشترِ", "اشتر", "اشتري", "أحضر"], es: ["comprar", "compra"], fr: ["acheter", "achète", "prendre"],
    de: ["kaufen", "kauf", "besorgen"], pt: ["comprar", "compra"], it: ["comprare", "compra"], ru: ["купить", "купи"], tr: ["satın al", "almak", "alınacak"], id: ["beli", "membeli"], hi: ["खरीदना", "खरीदो", "लाना"],
    ur: ["خریدنا", "خریدو", "لانا"], fa: ["بخر", "خریدن"], bn: ["কিনতে", "কেনা", "কিনো"], sw: ["nunua", "kununua"], th: ["ซื้อ"], vi: ["mua"], zh: ["买", "购买"], ja: ["買う", "買って", "買い"],
    ko: ["사기", "사다", "사야", "구매"], franco: ["eshtery", "ishtiri", "hat", "gib"] },
  outof: { en: ["out of", "we're out of", "we need"], ar: ["مفيش"], arb: ["نفد", "نفدت"], es: ["se acabó", "se acabaron", "no queda"], fr: ["il n'y a plus de", "on n'a plus de", "il manque"], de: ["ist alle", "sind alle", "nicht mehr da"],
    pt: ["acabou", "acabaram"], it: ["è finito", "sono finite", "manca"], ru: ["закончился", "закончилось", "кончился"], tr: ["bitti"], id: ["habis"], hi: ["खत्म हो गया", "खत्म हो गई"], ur: ["ختم ہو گیا", "ختم ہو گئی"], fa: ["تمام شد", "تموم شد"],
    bn: ["ফুরিয়ে গেছে"], sw: ["imeisha", "zimeisha"], th: ["หมด"], vi: ["hết"], zh: ["没了", "用完"], ja: ["切れた", "なくなった"], ko: ["떨어졌", "다 썼"], franco: ["khelset"] },
  call: { en: ["call", "phone", "ring", "remind me", "text", "message"], ar: ["كلم", "اتصل", "رن على", "فكرني", "ابعت ل", "ابعتله", "ابعتلها", "ابعت رسالة"], arb: ["اتصل", "كلّم", "ذكّرني", "ذكرني"], es: ["llamar", "llama", "recuérdame"],
    fr: ["appeler", "appelle", "rappelle-moi"], de: ["anrufen", "ruf", "erinnere mich"], pt: ["ligar", "liga", "lembra-me", "me lembre"], it: ["chiamare", "chiama", "ricordami"], ru: ["позвонить", "позвони", "напомни"],
    tr: ["ara", "aramak", "hatırlat"], id: ["telepon", "telpon", "ingatkan"], hi: ["फ़ोन", "फोन", "कॉल", "याद दिलाना"], ur: ["فون", "کال", "یاد دلانا"], fa: ["زنگ", "تماس", "یادم بنداز"],
    bn: ["ফোন", "কল", "মনে করিয়ে"], sw: ["piga simu", "nikumbushe"], th: ["โทร", "เตือน"], vi: ["gọi", "nhắc"], zh: ["打电话", "提醒"], ja: ["電話", "リマインド"], ko: ["전화", "알려줘"], franco: ["kalem", "fakarni", "etasel"] },
  gift: { en: ["gift", "present"], ar: ["هدية", "هديه"], arb: ["هدية"], es: ["regalo"], fr: ["cadeau"], de: ["geschenk"], pt: ["presente"], it: ["regalo"], ru: ["подарок"], tr: ["hediye"], id: ["hadiah", "kado"],
    hi: ["तोहफ़ा", "उपहार"], ur: ["تحفہ"], fa: ["هدیه", "کادو"], bn: ["উপহার"], sw: ["zawadi"], th: ["ของขวัญ"], vi: ["quà"], zh: ["礼物"], ja: ["プレゼント"], ko: ["선물"], franco: ["hedeya"] },
  today: { en: ["today", "tonight"], ar: ["النهاردة", "النهارده", "انهاردة"], arb: ["اليوم", "الليلة"], es: ["hoy"], fr: ["aujourd'hui", "ce soir"], de: ["heute"], pt: ["hoje"], it: ["oggi", "stasera"], ru: ["сегодня"], tr: ["bugün"],
    id: ["hari ini", "nanti malam"], hi: ["आज"], ur: ["آج"], fa: ["امروز", "امشب"], bn: ["আজ"], sw: ["leo"], th: ["วันนี้", "คืนนี้"], vi: ["hôm nay", "tối nay"], zh: ["今天", "今晚"], ja: ["今日", "今夜"], ko: ["오늘"], franco: ["elnaharda", "el naharda"] },
  tomorrow: { en: ["tomorrow"], ar: ["بكرة", "بكره", "بكرا"], arb: ["غدًا"], es: ["mañana"], fr: ["demain"], de: ["morgen"], pt: ["amanhã"], it: ["domani"], ru: ["завтра"], tr: ["yarın"], id: ["besok"],
    hi: ["कल"], ur: ["کل"], fa: ["فردا"], bn: ["আগামীকাল", "কাল"], sw: ["kesho"], th: ["พรุ่งนี้"], vi: ["ngày mai"], zh: ["明天"], ja: ["明日"], ko: ["내일"], franco: ["bokra"] },
  after: { en: ["day after tomorrow"], ar: ["بعد بكرة", "بعد بكره"], arb: ["بعد غد"], es: ["pasado mañana"], fr: ["après-demain"], de: ["übermorgen"], pt: ["depois de amanhã"], it: ["dopodomani"], ru: ["послезавтра"],
    tr: ["öbür gün"], id: ["lusa"], hi: ["परसों"], ur: ["پرسوں"], fa: ["پس‌فردا", "پس فردا"], bn: ["পরশু"], sw: ["kesho kutwa"], th: ["มะรืนนี้"], vi: ["ngày kia"], zh: ["后天"], ja: ["明後日"], ko: ["모레"], franco: ["ba3d bokra"] },
  morning: { en: ["morning"], ar: ["الصبح", "صباحا"], arb: ["صباحًا", "الصباح"], es: ["por la mañana"], fr: ["matin"], de: ["früh", "vormittag"], pt: ["de manhã"], it: ["mattina"], ru: ["утром"], tr: ["sabah"], id: ["pagi"],
    hi: ["सुबह"], ur: ["صبح"], fa: ["صبح"], bn: ["সকালে"], sw: ["asubuhi"], th: ["ตอนเช้า"], vi: ["sáng"], zh: ["上午", "早上"], ja: ["朝", "午前"], ko: ["아침", "오전"], franco: ["el sob7"] },
  evening: { en: ["evening", "tonight"], ar: ["بالليل", "المسا", "بليل"], arb: ["مساءً", "المساء"], es: ["por la tarde", "por la noche"], fr: ["soir"], de: ["abend", "abends"], pt: ["à noite", "de tarde"], it: ["sera"], ru: ["вечером"],
    tr: ["akşam"], id: ["malam", "sore"], hi: ["शाम"], ur: ["شام"], fa: ["عصر", "شب"], bn: ["সন্ধ্যায়"], sw: ["jioni"], th: ["ตอนเย็น"], vi: ["tối"], zh: ["晚上", "下午"], ja: ["夜", "夕方"], ko: ["저녁"], franco: ["bel leil"] },
  // "and then / also" — cut a paragraph into clauses
  then: { en: ["and then", "then", "also", "and also"], ar: ["وبعدين", "وكمان", "بعدين", "كمان"], arb: ["ثم", "وأيضًا", "وكذلك"], es: ["y luego", "luego", "también"], fr: ["et puis", "puis", "aussi"],
    de: ["und dann", "dann", "außerdem"], pt: ["e depois", "depois", "também"], it: ["e poi", "poi", "anche"], ru: ["а потом", "потом", "ещё", "также"], tr: ["sonra", "ayrıca"], id: ["lalu", "terus", "juga"],
    hi: ["फिर", "और भी"], ur: ["پھر", "اور بھی"], fa: ["بعد", "همچنین"], bn: ["তারপর"], sw: ["kisha", "pia"], th: ["แล้วก็"], vi: ["rồi", "còn"], zh: ["然后", "还有", "另外"], ja: ["それから", "あと"], ko: ["그리고", "그 다음"],
    franco: ["w ba3dein", "w kaman"] },
  // "and" between things to buy
  and: { en: ["and", "&"], ar: ["و"], arb: ["و"], es: ["y"], fr: ["et"], de: ["und"], pt: ["e"], it: ["e"], ru: ["и"], tr: ["ve"], id: ["dan"], hi: ["और"], ur: ["اور"], fa: ["و"], bn: ["আর", "ও"], sw: ["na"],
    th: ["และ", "กับ"], vi: ["và"], zh: ["和"], ja: ["と"], ko: ["와", "과", "하고"], franco: ["w"] },
};
// a heading before a colon that is not a day: "This week:", «الأسبوع ده:», "To do:", "Cette semaine :" …
const HEADER = /^(this week|this weekend|next week|to ?do|todo|today's list|الأسبوع ده|الاسبوع ده|هذا الأسبوع|مهام|المهام|esta semana|cette semaine|à faire|diese woche|zu tun|esta semana|questa settimana|на этой неделе|bu hafta|minggu ini|इस हफ़्ते|اس ہفتے|این هفته|এই সপ্তাহে|wiki hii|สัปดาห์นี้|tuần này|本周|这周|今週|이번 주)$/iu;
const NOSPACE = new Set(["zh", "ja", "th"]);
const ALL = (k) => Object.values(T[k]).flat();
const RX = {};
for (const k of Object.keys(T)) { const sp = ALL(k).filter((w) => !/[\u3040-\u30ff\u4e00-\u9fff\u0e00-\u0e7f\uac00-\ud7af]/.test(w)), ns = ALL(k).filter((w) => /[\u3040-\u30ff\u4e00-\u9fff\u0e00-\u0e7f]/.test(w)), ko = ALL(k).filter((w) => /[\uac00-\ud7af]/.test(w));
  RX[k] = [sp.length ? W(sp, k === "buy" || k === "call" || k === "pay" ? "(?:[وفل])?" : "") : null, ns.length ? C(ns) : null, ko.length ? C(ko) : null].filter(Boolean); }
// any action word at all (a piece without one, right after a shopping clause, is one more thing to buy)
const ACTION = (x) => ["spent", "pay", "buy", "outof", "call", "gift"].some((k) => has(k, x)) || TASKV.test(x) || TASKC.test(x);
// common task verbs in every language (a piece that has one is its own to-do, never one more thing to buy)
const TASKV = new RegExp("(?:^|[^\\p{L}])(?:" + ["finish", "clean", "send", "write", "book", "fix", "make", "prepare", "check", "read", "study", "wash", "cook", "visit", "take", "bring", "renew", "cancel", "order",
  "خلص", "نضف", "ابعت", "اكتب", "احجز", "صلح", "اعمل", "جهز", "راجع", "اقرا", "اغسل", "اطبخ", "روح", "زور", "جدد", "الغي", "اطلب", "أنهِ", "أنه", "رتّب", "رتب", "نظف", "أرسل",
  "terminar", "limpiar", "enviar", "mandar", "finir", "ranger", "nettoyer", "envoyer", "fertig", "putzen", "schicken", "aufräumen", "limpar", "finire", "pulire", "mandare", "inviare",
  "закончить", "убрать", "отправить", "bitir", "temizle", "gönder", "selesaikan", "bersihkan", "kirim", "पूरी", "साफ़", "भेज", "مکمل", "صاف", "بھیج", "تمام", "تمیز", "بفرست",
  "শেষ", "পরিষ্কার", "পাঠা", "maliza", "safisha", "tuma", "khalas", "nadaf", "ebaat"].join("|") + ")(?![\\p{L}])", "iu");
const TASKC = /(?:ทำรายงาน|ทำความสะอาด|ส่ง|làm xong|dọn|gửi|写完|打扫|发送|仕上げ|掃除|送る|끝내|청소|보내)/u;
const THEN_WORDS = new Set(ALL("then").map((w) => w.toLowerCase()));
const OUT_AR = /(?:^|[^\p{L}])(?:خلص|خلصت|خلصو|خلصوا|khalas|khelset)\s+(?:ال)?(?:سكر|زيت|لبن|عيش|رز|بيض|شاي|قهوة|صابون|مية|غاز|جبنة|زبدة|مكرونة|دقيق|ملح|شامبو|مناديل|sokkar|zeit|laban|3eish|ruz|beid|shay|2ahwa)(?![\p{L}])/iu;
const has = (k, s) => RX[k].some((re) => re.test(s));
const strip = (k, s) => RX[k].reduce((x, re) => x.replace(new RegExp(re.source, re.flags + "g"), (m) => (/^[^\p{L}\p{M}]/u.test(m) ? m[0] : "")), s);

// ---- weekdays: Intl names in every language (long + short), plus Egyptian Arabic forms ------------------------------------------
const LOCS = ["en", "ar", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko"];
const WD = [];   // [regex, weekday]
(() => {
  const seen = new Map();
  for (const l of LOCS) for (const style of ["long", "short"]) { let f; try { f = new Intl.DateTimeFormat(l, { weekday: style }); } catch (e) { continue; }
    for (let i = 0; i < 7; i++) { const n = f.format(new Date(2026, 10, 1 + i)).toLowerCase().replace(/\.$/, ""); if (n.length >= 2 && !seen.has(n)) seen.set(n, i); } }
  const EG = { "الحد": 0, "الأحد": 0, "الاحد": 0, "الاتنين": 1, "الإثنين": 1, "الاثنين": 1, "التلات": 2, "الثلاثاء": 2, "التلاتاء": 2, "الاربع": 3, "الأربع": 3, "الأربعاء": 3, "الاربعاء": 3, "الخميس": 4, "الجمعة": 5, "الجمعه": 5, "السبت": 6,
    "sun": 0, "mon": 1, "tue": 2, "tues": 2, "wed": 3, "thu": 4, "thur": 4, "thurs": 4, "fri": 5, "sat": 6, "el 7ad": 0, "el etnein": 1, "el talat": 2, "el arba3": 3, "el khamis": 4, "el gom3a": 5, "el sabt": 6 };
  for (const [k, v] of Object.entries(EG)) if (!seen.has(k)) seen.set(k, v);
  // Korean / Japanese / Chinese / Thai short names (one letter) are too short to find safely in free text — only the long ones count
  for (const [n, i] of [...seen.entries()].sort((a, b) => b[0].length - a[0].length)) {
    if (/^[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]$/.test(n) || (!/[\u3040-\u30ff\u4e00-\u9fff\u0e00-\u0e7f\uac00-\ud7af]/.test(n) && n.length < 3)) continue;
    const cjk = /[\u3040-\u30ff\u4e00-\u9fff\u0e00-\u0e7f\uac00-\ud7af]/.test(n);
    WD.push([cjk ? C([n]) : W([n], "(?:[بلو]|ي?وم\\s|on\\s)?"), i, n]);
  }
})();
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const mid = (t) => { const d = new Date(t); d.setHours(12, 0, 0, 0); return d.getTime(); };
/** The day said in a clause → "YYYY-MM-DD" (a weekday = the next one, today counts), the text without it. */
export function dayIn(s, now = Date.now()) {
  let t = s, date = null;
  const take = (re) => { t = t.replace(new RegExp(re.source, re.flags + "g"), (m) => (/^[^\p{L}\p{M}\d]/u.test(m) ? m[0] : "")); };
  if (has("after", t)) { date = iso(mid(now) + 2 * DAY); for (const re of RX.after) take(re); }
  else if (has("tomorrow", t)) { date = iso(mid(now) + DAY); for (const re of RX.tomorrow) take(re); }
  else if (has("today", t)) { date = iso(mid(now)); for (const re of RX.today) take(re); }
  if (!date) for (const [re, i] of WD) if (re.test(t)) { const d = new Date(mid(now)), add = (i - d.getDay() + 7) % 7; date = iso(d.getTime() + add * DAY); take(re); break; }
  if (!date) {   // the Nth of the month: "on the 1st", «يوم 1», "el día 5", "le 3", "am 1.", "dia 1", "tanggal 1", "1 तारीख", "1号", "1日", "1일" …
    const m = /(?<![\p{L}])(?:on the |the |يوم |yom |el día |el |le |am |dia |il |tanggal |tarehe |ngày |วันที่ |ayın )(\d{1,2})(?:st|nd|rd|th|\.|'?[iıuü])?(?!\d|[.,:]\d)/iu.exec(t) || /(?<![\d.,])(\d{1,2})(?:(?:st|nd|rd|th| तारीख| تاریخ| তারিখ|-го|-e| ام)(?![\p{L}\d])|(?:号|日|일)(?!\d))/iu.exec(t);
    if (m && +m[1] >= 1 && +m[1] <= 31) { const d = new Date(mid(now)); if (d.getDate() > +m[1]) d.setMonth(d.getMonth() + 1, 1); d.setDate(Math.min(+m[1], new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); date = iso(d.getTime()); t = t.replace(m[0], " "); }
  }
  return { date, rest: t };
}
/** A clock time → "HH:MM": "at 9", "9:30", "9 pm", «الساعة 9», "à 15h", "um 9 Uhr", "alle 9", "в 9", "saat 9", "jam 9", "9 बजे", "9時", "9시"… */
export function timeIn(s) {
  const t = latinDigits(s);
  let m = /(?<![\p{L}])(?:at|@|الساعة|الساعه|ساعة|el sa3a|sa3a|à|um|alle|às|a las|a la|в|saat|jam|pukul|ساعت|lúc|saa|เวลา)\s*(\d{1,2})(?:[:h.](\d{2}))?\s*(am|pm|ص|م|uhr|h|ظهرا|مساء|العصر)?/iu.exec(t)
    || /(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(t) || /(\d{1,2})\s*(am|pm)\b/i.exec(t) || /(\d{1,2})\s*(?:बजे|بجے|টায়|時|点|시|โมง|giờ)/u.exec(t);
  if (!m) return { time: null, rest: s };
  let h = +m[1], mi = m[2] && /^\d{2}$/.test(m[2]) ? +m[2] : 0; const ap = String((m[2] && !/^\d/.test(m[2]) ? m[2] : m[3]) || "").toLowerCase();
  if (h > 23 || mi > 59) return { time: null, rest: s };
  if ((ap === "pm" || ap === "م" || ap === "مساء" || ap === "العصر") && h < 12) h += 12; if ((ap === "am" || ap === "ص") && h === 12) h = 0;
  // "at 5" with no am / pm and no minutes-past-midnight sense: 1–6 is the afternoon (people say «الساعة 5» for 5 pm); 7–11 stays morning
  if (!ap && !m[2] && h >= 1 && h <= 6) h += 12;
  return { time: String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0"), rest: s.replace(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\d/g, "[\\d٠-٩۰-۹०-९০-৯๐-๙]")), " ") };
}
const MULT = [[/(\d)\s*(?:k|thousand|ألف|الف|آلاف|mil|mille|tausend|тыс\.?|тысяч|bin|ribu|हज़ार|हजार|ہزار|هزار|হাজার|elfu|พัน|nghìn|ngàn|千|천)(?![\p{L}])/iu, 1e3], [/(\d)\s*(?:万|만)/u, 1e4], [/(\d)\s*(?:m|million|مليون|millón|millions?|millionen|млн|juta|लाख)(?![\p{L}])/iu, 1e6]];
/** The money in a clause (the first amount that isn't a time, a date or a count of days). */
export function amountIn(s) {
  const t = latinDigits(s);
  const re = /(?<![\d:/A-Za-z])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,3}))?(?![\d:/]|[A-Za-z][A-Za-z\d])/gu; let m;
  while ((m = re.exec(t))) {
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 12), before = t.slice(Math.max(0, m.index - 12), m.index);
    if (/^\s*(?:st|nd|rd|th|am|pm|:|h\b|uhr|بجے|बजे|時|点|시|โมง|giờ|号|日|일|तारीख|تاریخ|তারিখ|nights?|ليالي|days?|أيام|ايام|pages?|صفحة|min|minutes?|دقيقة|hours?|ساعات|kg|كيلو|km|كم|%)/iu.test(after)) continue;
    if (/(?<![\p{L}])(?:at|@|الساعة|الساعه|sa3a|à|um|alle|às|a las|в|saat|jam|pukul|lúc|saa|เวลา|يوم|yom|on the|the|le|am|dia|il|tanggal|tarehe|ngày|วันที่)\s*$/iu.test(before)) continue;
    let v = parseFloat(m[1].replace(/[,\s]/g, "") + (m[2] ? "." + m[2] : ""));
    for (const [mr, k] of MULT) { const mm = new RegExp("^" + mr.source.replace("(\\d)", ""), mr.flags).exec(after.replace(/^\s*/, "")); if (mm) { v *= k; break; } }
    if (v > 0 && v < 1e10) return v;
  }
  return null;
}
const SENT = /\s*(?:\n+|[.!?](?=\s|$)|[。！？]|;|؛|\u061f(?=\s|$))\s*/u;
/** A paragraph → its clauses (each with the day said before a colon carried). */
export function clauses(text, withSentence = false) {
  const out = []; let si = -1;
  for (const sent of String(text || "").split(SENT)) {
    si++;
    if (!sent || !sent.trim()) continue;
    // "and then / also" in every language
    let parts = [sent];
    for (const re of RX.then) parts = parts.flatMap((p) => p.split(new RegExp("\\s*" + re.source.replace("(?:^|[^\\p{L}\\p{M}])", "(?:^|[\\s,،、，])").replace("(?=$|[^\\p{L}\\p{M}])", "(?=\\s|$)"), re.flags + "g")).filter((x) => x && x.trim() && !THEN_WORDS.has(x.trim().toLowerCase())));
    for (const p of parts) for (const c of p.split(/\s*[,،，]\s*/u)) if (c.trim()) out.push(withSentence ? { c: c.trim(), si } : c.trim());
  }
  return out;
}
const tidy = (s) => s.replace(/\s+/g, " ").replace(/^[\s,،:;\-–—·+&و]+|[\s,،:;\-–—·+&]+$/gu, "").replace(/^(?:and|then|also|و|y|et|und|e|и|ve|dan|और|اور|na)\s+/iu, "").trim();
const ART = /^(?:the|some|a|an|du|de la|de l'|des|le|la|les|l'|el|los|las|un|una|unos|unas|une|il|lo|gli|i|o|os|as|um|uma|der|die|das|ein|eine|einen|شوية|حبة)\s+/iu;
const splitItems = (s) => s.split(/\s*(?:\+|,|،|、|，|\s(?:and|&|و|w|y|et|und|e|и|ve|dan|और|اور|আর|na|และ|và|및)\s|\sو(?=\S)|和|と|하고)\s*/u).map((x) => tidy(tidy(x).replace(ART, "")).replace(/(?<=[\u3040-\u30ff\u4e00-\u9fff])[をがはも]$|(?<=[\uac00-\ud7af])\s*(?:을|를)$/u, "")).filter((x) => x && x.length <= 40);
/** The paragraph → the items. */
export function organise(text, { now = Date.now() } = {}) {
  const items = []; let carry = null, lastSi = -1;
  const all = clauses(text, true);
  for (let i = all.length - 2; i >= 0; i--) { const a = all[i], b = all[i + 1];
    const w = b.c.trim().split(/\s+/), verbLast = has("buy", w[w.length - 1]) && !has("buy", w[0]);
    const before = i > 0 && all[i - 1].si === a.si && has("buy", all[i - 1].c) && !verbLast;
    if (a.si === b.si && !before && has("buy", b.c) && !ACTION(a.c) && amountIn(a.c) == null && !timeIn(a.c).time && !(dayIn(a.c).date && dayIn(b.c).date) && dayIn(a.c).rest.trim().split(/\s+/).length <= 3 && !has("buy", b.c.split(/\s+/)[0])) { b.c = a.c + ", " + b.c; all.splice(i, 1); } }
  const raw = all.map((x) => x.c);
  for (let i = 0; i < raw.length; i++) {
    let src = raw[i];
    if (all[i].si !== lastSi) { carry = null; lastSi = all[i].si; }   // a day carried stops at the end of its sentence
    // "tomorrow: …" / «بكرة: …» — the day before a colon is carried to what follows
    const colon = /^([^:：]{2,25})[:：]\s*(.*)$/u.exec(src);
    if (colon) { const d = dayIn(colon[1], now); if (d.date && !tidy(d.rest)) { carry = d.date; src = colon[2]; if (!src.trim()) continue; } else if (!d.date && (HEADER.test(colon[1].trim()) || (colon[1].trim().split(/\s+/).length <= 2 && !ACTION(colon[1]) && colon[2].trim()))) src = colon[2]; }
    const d = dayIn(src, now), tm = timeIn(d.rest), amount = amountIn(tm.rest);
    let date = d.date || carry, time = tm.time, body = tm.rest;
    if (has("morning", body)) { time = time || "10:00"; for (const re of RX.morning) body = body.replace(new RegExp(re.source, re.flags + "g"), (m) => (/^[^\p{L}]/u.test(m) ? m[0] : "")); }
    else if (has("evening", body) && !time) { time = "19:00"; for (const re of RX.evening) body = body.replace(new RegExp(re.source, re.flags + "g"), (m) => (/^[^\p{L}]/u.test(m) ? m[0] : "")); }
    let type;
    if (amount != null && has("spent", src)) type = "spent";
    else if (amount != null && (has("pay", src) || has("bill", src))) type = "payment";
    else if (has("buy", src) && !(amount != null || has("gift", src))) type = "list";
    else if (has("outof", src) || OUT_AR.test(src)) type = "list";
    else if (has("call", src) || time) type = "reminder";
    else if (tidy(body).split(/\s+/).filter(Boolean).length >= 1 && tidy(body).length >= 3) type = "todo";
    else type = "note";
    // a piece with no action word right after a shopping clause = one more thing to buy ("buy milk, bread and eggs")
    const prev = items[items.length - 1];
    if (type === "todo" && prev && prev.type === "list" && prev.src === raw[i - 1] && all[i - 1].si === all[i].si && !time && amount == null && !ACTION(src) && !(d.date && prev.date) && tidy(d.rest).split(/\s+/).length <= 4) {
      prev.items.push(...splitItems(d.rest)); prev.text = prev.items.join(", "); prev.src = raw[i]; if (d.date && !prev.date) prev.date = d.date; continue; }
    if (type === "spent" && !date) date = iso(mid(now));   // money already spent is logged on the day it is written
    const it = { type, text: "", date: date || null, time: time || null, amount: amount == null ? null : amount, items: [], src: raw[i] };
    if (type === "list") { let what = body.replace(/(?:^|[^\p{L}])(?:خلص|خلصت|خلصو|خلصوا|khalas|khelset)(?![\p{L}])/giu, " "); for (const k of ["buy", "outof"]) what = strip(k, what); it.items = splitItems(what); it.text = it.items.join(", "); if (!it.items.length) { it.type = "todo"; it.text = tidy(body); } }
    else it.text = tidy(body.replace(/(\d[\d,.\s]*)(?:\s*(?:k|thousand|ألف|الف|جنيه|ج\.م|egp|pounds?|sar|ريال|aed|usd|\$|€|£|ر\.س))?/giu, (m, n) => (amount != null && amountIn(m) === amount ? " " : m)).replace(/\s+(?:by|before|on|under|below|less than|max|قبل|يوم|أقل من|اقل من|تحت|el|le|am|menos de|moins de|unter|sotto|до|altında|di bawah)\s*$/iu, "")) || tidy(src);
    items.push(it);
  }
  return items;
}

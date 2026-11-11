/* ---- v9.9.18 AU1 "When … do …" for everything (Ali picked A, 11 Nov 2026: "I want the most functions possible … it understands every
   free text and if it does not understand it asks me" — AUTOMATION_PLAN.md). One sentence in any of Attune's 20 languages (and
   Franco) → { when, if, do, ask }. Triggers: a time / repeat, arriving at or leaving a place, a Bluetooth device, Wi-Fi, charging, money
   in (a salary, a transfer from someone), money out, a message or call from someone, an app's notification. Checks: weekdays / the
   weekend, before / after an hour, more / less than an amount. Actions: remind, read my to-dos, show a list, add a to-do, add to a
   list, log money, put money in a fund (% or amount), open an app or page, message / call someone, silence the phone, start a timer,
   tell me. Names (people, places, devices, apps, funds) are matched against the person's OWN ones; anything not clear becomes a
   question with choices in `ask` — never a guess. Day and month names come from Intl for every language (no word lists to forget).
   Pure; tests: tests/rules (10,000 sentences in 20 languages) + tests/unit/v9918rules.test.mjs.                                    */

export const LANGS = ["en", "ar", "arb", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko"];
const NOSPACE = /[฀-๿぀-ヿ一-鿿가-힯]/;   // Thai, Japanese, Chinese, Korean: no word gaps to rely on

// ---- digits of every script → 0-9 ----------------------------------------------------------------------------------------------
const DIGITS = ["٠١٢٣٤٥٦٧٨٩", "۰۱۲۳۴۵۶۷۸۹", "०१२३४५६७८९", "০১২৩৪৫৬৭৮৯", "๐๑๒๓๔๕๖๗๘๙", "０１２３４５６７８９"];
export const latinDigits = (s) => String(s || "").replace(/[٠-٩۰-۹०-९০-৯๐-๙０-９]/g, (c) => { for (const d of DIGITS) { const i = d.indexOf(c); if (i >= 0) return String(i); } return c; }).replace(/[٫]/g, ".").replace(/[٬،](?=\d{3})/g, ",");
const fold = (s) => latinDigits(s).toLowerCase().normalize("NFKC").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[.,!?؟،])/g, "ه").replace(/\s+/g, " ").trim();

// ---- the words of each idea, in every language (folded: Arabic ة→ه at word end, أإآ→ا) -------------------------------------------
const W = {
  // what starts a rule
  when: { en: ["when", "whenever", "every time", "each time", "if", "once", "as soon as", "after"], ar: ["لما", "لو", "اول ما", "كل ما", "كل مره", "بعد ما", "اما"], arb: ["عندما", "حين", "حينما", "اذا", "كلما", "بمجرد"],
    es: ["cuando", "si", "cada vez que", "en cuanto", "apenas"], fr: ["quand", "lorsque", "si", "chaque fois que", "des que", "dès que"], de: ["wenn", "sobald", "falls", "jedes mal wenn"], pt: ["quando", "se", "sempre que", "assim que"],
    it: ["quando", "se", "ogni volta che", "appena"], ru: ["когда", "если", "как только", "каждый раз когда"], tr: ["ne zaman", "eger", "eğer"], id: ["ketika", "saat", "jika", "kalau", "setiap kali", "begitu"],
    hi: ["जब", "अगर", "जैसे ही", "जब भी"], ur: ["جب", "اگر", "جیسے ہی", "جب بھی"], fa: ["وقتي", "وقتی", "هر وقت", "اگر", "به محض"], bn: ["যখন", "যদি", "যখনই"], sw: ["ninapo", "wakati", "kama", "kila"],
    th: ["เมื่อ", "ถ้า", "ทุกครั้งที่"], vi: ["khi", "nếu", "mỗi khi", "mỗi lần"], zh: ["当", "如果", "每当", "一旦"], ja: ["たら", "とき", "時", "ときに"], ko: ["때", "하면", "면"] },
  every: { en: ["every", "each", "daily", "weekly", "monthly"], ar: ["كل", "يوميا", "اسبوعيا", "شهريا"], arb: ["كل", "يوميا", "اسبوعيا", "شهريا"], es: ["cada", "todos los", "todas las", "diario"], fr: ["chaque", "tous les", "toutes les"],
    de: ["jeden", "jede", "jedes", "täglich", "taglich"], pt: ["todo", "toda", "todos os", "todas as", "cada"], it: ["ogni", "tutti i"], ru: ["каждый", "каждую", "каждое", "ежедневно"], tr: ["her"], id: ["setiap", "tiap"],
    hi: ["हर", "रोज़", "रोज"], ur: ["ہر", "روزانہ"], fa: ["هر"], bn: ["প্রতি", "প্রত্যেক"], sw: ["kila"], th: ["ทุก"], vi: ["mỗi", "hằng", "hàng"], zh: ["每"], ja: ["毎"], ko: ["매"] },
  // triggers
  arrive: { en: ["arrive at", "arrive", "get to", "reach", "i'm at", "i am at", "get home", "at"], ar: ["اوصل", "وصلت", "اكون في", "ادخل", "اروح"], arb: ["اصل الى", "وصلت الى", "اكون في"], es: ["llegue a", "llego a", "esté en", "este en", "llegar a"],
    fr: ["arrive à", "arrive a", "suis à", "suis a", "j'arrive"], de: ["ankomme", "bei ankomme", "in ankomme", "zu hause ankomme", "da bin"], pt: ["chegar a", "chegar ao", "chegar em", "chego", "estiver em"], it: ["arrivo a", "arrivo in", "arrivo al", "sono a"],
    ru: ["приеду", "доберусь", "буду в", "прихожу"], tr: ["vardığımda", "vardigimda", "geldiğimde", "geldigimde", "ulaştığımda"], id: ["sampai di", "tiba di", "sampai ke", "tiba"], hi: ["पहुँचूँ", "पहुंचूं", "पहुँचूं", "पहुंचू"], ur: ["پہنچوں", "پہنچ جاؤں"],
    fa: ["برسم", "رسیدم"], bn: ["পৌঁছালে", "পৌঁছাই", "পৌঁছব"], sw: ["nikifika", "ninapofika", "nifikapo"], th: ["ถึง"], vi: ["đến", "tới"], zh: ["到了", "到达", "到"], ja: ["着いたら", "到着したら", "着いた"], ko: ["도착하면", "도착할 때"] },
  leave: { en: ["leave", "get out of", "go out of", "left"], ar: ["امشي من", "اخرج من", "اسيب", "اطلع من", "امشي"], arb: ["اغادر", "اخرج من"], es: ["salga de", "salgo de", "me vaya de"], fr: ["quitte", "pars de", "sors de"],
    de: ["verlasse", "losfahre", "gehe aus"], pt: ["sair de", "sair do", "saio de"], it: ["esco da", "esco dal", "lascio"], ru: ["уйду из", "выйду из", "уезжаю из", "уйду с"], tr: ["çıktığımda", "ciktigimda", "ayrıldığımda"], id: ["keluar dari", "meninggalkan", "pergi dari"],
    hi: ["निकलूँ", "निकलूं", "छोड़ूँ"], ur: ["نکلوں", "چھوڑوں"], fa: ["بیرون بیام", "خارج بشم", "ترک کنم"], bn: ["বের হলে", "ছাড়লে"], sw: ["nikiondoka", "ninapoondoka"], th: ["ออกจาก"], vi: ["rời", "ra khỏi"], zh: ["离开"], ja: ["出たら", "離れたら"], ko: ["떠나면", "나가면"] },
  bt: { en: ["connect to", "connects to", "connected to", "connects", "is connected", "bluetooth", "pair with"], ar: ["اوصل ب", "اتوصل ب", "يتوصل ب", "البلوتوث", "بلوتوث", "اركب"], arb: ["اتصل ب", "يتصل ب", "البلوتوث"], es: ["me conecte a", "conecte a", "bluetooth", "me conecto a"],
    fr: ["connecte à", "connecte a", "bluetooth", "me connecte"], de: ["verbinde mit", "verbunden mit", "bluetooth"], pt: ["conectar ao", "conectar a", "conecto ao", "bluetooth"], it: ["mi collego a", "collego a", "bluetooth"], ru: ["подключусь к", "подключится к", "bluetooth", "блютуз"],
    tr: ["bağlandığımda", "baglandigimda", "bluetooth"], id: ["terhubung ke", "tersambung ke", "bluetooth"], hi: ["कनेक्ट", "ब्लूटूथ"], ur: ["کنیکٹ", "بلوٹوتھ"], fa: ["وصل بشم", "بلوتوث"], bn: ["কানেক্ট", "ব্লুটুথ"], sw: ["nikiunganisha", "bluetooth"],
    th: ["เชื่อมต่อ", "บลูทูธ"], vi: ["kết nối", "bluetooth"], zh: ["连接", "蓝牙"], ja: ["接続したら", "ブルートゥース", "bluetooth"], ko: ["연결되면", "블루투스"] },
  wifi: { en: ["wifi", "wi-fi"], ar: ["الواي فاي", "واي فاي", "الوايفاي", "وايفاي"], arb: ["الواي فاي", "شبكة"], es: ["wifi"], fr: ["wifi"], de: ["wlan", "wifi"], pt: ["wifi"], it: ["wifi"], ru: ["wi-fi", "вайфай", "wifi"], tr: ["wifi"], id: ["wifi"],
    hi: ["वाईफाई", "wifi"], ur: ["وائی فائی"], fa: ["وای فای"], bn: ["ওয়াইফাই"], sw: ["wifi"], th: ["ไวไฟ", "wifi"], vi: ["wifi"], zh: ["wifi", "无线网"], ja: ["wi-fi", "wifi"], ko: ["와이파이"] },
  charge: { en: ["charging", "plug in", "plugged in", "on the charger", "charge"], ar: ["اشحن", "الشاحن", "يشحن", "على الشحن"], arb: ["اشحن", "الشاحن"], es: ["cargando", "lo cargue", "al cargador"], fr: ["en charge", "branche", "chargeur"],
    de: ["lädt", "ladt", "ladegerät", "anstecke"], pt: ["carregando", "carregador"], it: ["in carica", "caricatore"], ru: ["заряжается", "зарядк", "на зарядке"], tr: ["şarja", "sarja", "şarj"], id: ["mengisi daya", "dicas", "cas"],
    hi: ["चार्ज"], ur: ["چارج"], fa: ["شارژ"], bn: ["চার্জ"], sw: ["chaji"], th: ["ชาร์จ"], vi: ["sạc"], zh: ["充电"], ja: ["充電"], ko: ["충전"] },
  salary: { en: ["salary", "paycheck", "payday", "wage"], ar: ["المرتب", "مرتب", "الراتب", "راتب", "mortab"], arb: ["الراتب", "راتب"], es: ["sueldo", "salario", "nómina", "nomina"], fr: ["salaire", "paie"], de: ["gehalt", "lohn"], pt: ["salário", "salario"],
    it: ["stipendio"], ru: ["зарплата", "зарплату", "зарплаты"], tr: ["maaş", "maas"], id: ["gaji"], hi: ["सैलरी", "तनख्वाह", "वेतन"], ur: ["تنخواہ"], fa: ["حقوق"], bn: ["বেতন"], sw: ["mshahara"], th: ["เงินเดือน"], vi: ["lương"], zh: ["工资", "薪水"], ja: ["給料"], ko: ["월급", "급여"] },
  moneyIn: { en: ["arrives", "comes in", "lands", "transfer from", "sends me", "pays me", "i receive", "i get paid"], ar: ["ينزل", "يوصل", "يجي", "يجيلي", "تحويل من", "يبعتلي", "بعتلي", "يدفعلي"], arb: ["يصل", "يودع", "تحويل من", "يرسل لي"],
    es: ["llegue", "llega", "entre", "transferencia de", "me pague", "me envíe", "me envie"], fr: ["arrive", "tombe", "virement de", "me paie", "m'envoie"], de: ["eingeht", "ankommt", "überweisung von", "mir schickt", "mir zahlt"], pt: ["cair", "chegar", "transferência de", "me pagar", "me mandar"],
    it: ["arriva", "bonifico da", "mi paga", "mi manda"], ru: ["придёт", "придет", "поступит", "перевод от", "пришлёт", "пришлет"], tr: ["yattığında", "yattiginda", "geldiğinde", "gonderdiginde", "gönderdiğinde"], id: ["masuk", "transfer dari", "mengirim"],
    hi: ["आए", "आती है", "भेजे"], ur: ["آئے", "بھیجے"], fa: ["واریز", "بیاد", "بفرسته"], bn: ["আসলে", "পাঠালে"], sw: ["ukiingia", "ukifika", "akinitumia"], th: ["เข้า", "โอนมา"], vi: ["về", "chuyển cho tôi"], zh: ["到账", "转给我"], ja: ["入ったら", "振り込まれたら"], ko: ["들어오면", "입금되면"] },
  moneyOut: { en: ["i pay", "i spend", "i buy", "i'm charged", "a payment"], ar: ["ادفع", "اصرف", "اشتري", "يتخصم"], arb: ["ادفع", "انفق", "اشتري"], es: ["pague", "gaste", "compre"], fr: ["paie", "dépense", "depense", "achète"], de: ["bezahle", "ausgebe", "kaufe"],
    pt: ["pagar", "gastar", "comprar"], it: ["pago", "spendo", "compro"], ru: ["заплачу", "потрачу", "куплю"], tr: ["ödediğimde", "odedigimde", "harcadığımda"], id: ["bayar", "belanja"], hi: ["खर्च", "भुगतान"], ur: ["خرچ", "ادائیگی"], fa: ["پرداخت", "خرج"],
    bn: ["খরচ", "পেমেন্ট"], sw: ["nikilipa", "nikitumia"], th: ["จ่าย"], vi: ["trả", "chi"], zh: ["付款", "花钱"], ja: ["払ったら", "支払ったら"], ko: ["결제하면", "쓰면"] },
  moneyWord: { en: ["money", "transfer", "payment", "pays me", "sends me money"], ar: ["فلوس", "تحويل", "مبلغ"], arb: ["تحويلا", "تحويل", "مالا", "مبلغ"], es: ["dinero", "transferencia", "pago"], fr: ["argent", "virement", "paiement"], de: ["geld", "überweisung", "uberweisung", "zahlung"],
    pt: ["dinheiro", "transferência", "transferencia", "pix"], it: ["soldi", "bonifico", "pagamento"], ru: ["деньги", "перевод"], tr: ["para gönder", "para gonder", "para yatır", "para yatir", "para gel", "para attı", "havale"], id: ["uang", "transfer"], hi: ["पैसे", "पैसा"], ur: ["پیسے", "رقم"], fa: ["پول", "واریز"], bn: ["টাকা"], sw: ["pesa"],
    th: ["เงิน", "โอน"], vi: ["tiền", "chuyển cho tôi", "chuyển tiền"], zh: ["钱", "转账", "转给我"], ja: ["振り込", "お金", "送金"], ko: ["입금", "돈", "송금"] },
  msg: { en: ["messages me", "messaged me", "texts me", "texted me", "writes to me", "emails me", "sends me a message", "message from", "messages"], ar: ["يبعتلي", "تبعتلي", "بعتتلي", "يكلمني على الواتس", "رساله من", "يراسلني", "بعتلي", "بعتلي رساله"], arb: ["يرسل لي", "ترسل لي", "رساله من", "يراسلني"],
    es: ["me escriba", "me mande un mensaje", "mensaje de"], fr: ["m'écrit", "m'ecrit", "message de", "m'envoie un message"], de: ["mir schreibt", "nachricht von"], pt: ["me mandar mensagem", "me escrever", "mensagem de"], it: ["mi scrive", "messaggio da"],
    ru: ["напишет", "сообщение от"], tr: ["mesaj attığında", "mesaj attiginda", "yazdığında"], id: ["mengirim pesan", "pesan dari", "chat aku", "pesan"], hi: ["मैसेज करे", "संदेश"], ur: ["میسج کرے", "پیغام"], fa: ["پیام بده", "پیام از"], bn: ["মেসেজ করলে", "বার্তা"],
    sw: ["akinitumia ujumbe", "ujumbe kutoka", "ujumbe"], th: ["ส่งข้อความ"], vi: ["nhắn tin", "tin nhắn từ"], zh: ["发消息", "给我发消息", "消息"], ja: ["メッセージが来たら", "連絡が来たら"], ko: ["메시지 보내면", "문자 오면"] },
  call: { en: ["calls me", "calls", "called me", "phones me", "missed call", "rings me"], ar: ["يتصل", "تتصل", "اتصل", "اتصلت", "يكلمني", "تكلمني", "كلمني", "كلمتني", "رن عليا", "رنت عليا", "رنلي", "مكالمه فايته"], arb: ["يتصل بي", "تتصل بي", "مكالمه فائته"], es: ["me llame", "llamada perdida"], fr: ["m'appelle", "appel manqué", "appel manque"],
    de: ["mich anruft", "anruft", "verpasster anruf"], pt: ["me ligar", "ligar", "ligou", "me liga", "chamada perdida"], it: ["mi chiama", "chiamata persa"], ru: ["позвонит", "пропущенный"], tr: ["aradığında", "aradiginda", "cevapsız"], id: ["menelepon", "panggilan tak terjawab"],
    hi: ["कॉल करे", "फोन करे"], ur: ["کال کرے", "فون کرے"], fa: ["زنگ بزنه", "تماس"], bn: ["কল করলে", "ফোন করলে"], sw: ["akinipigia"], th: ["โทรมา"], vi: ["gọi"], zh: ["打电话", "来电"], ja: ["電話が来たら", "電話したら"], ko: ["전화하면", "전화 오면"] },
  notifFrom: { en: ["notification from", "notifies me", "alert from"], ar: ["اشعار من", "إشعار من", "نوتيفيكيشن"], arb: ["اشعار من", "تنبيه من"], es: ["notificación de", "notificacion de"], fr: ["notification de"], de: ["benachrichtigung von"], pt: ["notificação de", "notificacao de"],
    it: ["notifica da"], ru: ["уведомление от"], tr: ["bildirim"], id: ["notifikasi dari"], hi: ["नोटिफिकेशन"], ur: ["نوٹیفکیشن"], fa: ["اعلان"], bn: ["নোটিফিকেশন"], sw: ["arifa kutoka"], th: ["แจ้งเตือนจาก"], vi: ["thông báo từ"], zh: ["通知"], ja: ["通知"], ko: ["알림"] },
  // checks
  weekdays: { en: ["on weekdays", "weekdays", "work days", "workdays"], ar: ["ايام الشغل", "في ايام الشغل", "ايام العمل"], arb: ["ايام العمل"], es: ["entre semana", "días laborables", "dias laborables"], fr: ["en semaine", "jours ouvrés", "jours ouvres"], de: ["werktags", "an werktagen"],
    pt: ["dias úteis", "dias uteis"], it: ["giorni feriali", "nei giorni lavorativi"], ru: ["по будням", "в будни"], tr: ["hafta içi", "hafta ici"], id: ["hari kerja"], hi: ["कामकाजी दिनों", "वीकडे"], ur: ["کام کے دنوں"], fa: ["روزهای کاری"], bn: ["কর্মদিবসে"], sw: ["siku za kazi"],
    th: ["วันทำงาน"], vi: ["ngày thường", "ngày làm việc"], zh: ["工作日"], ja: ["平日"], ko: ["평일"] },
  weekend: { en: ["on the weekend", "weekends", "at the weekend"], ar: ["في الاجازه", "الويك اند", "في الويك اند", "يوم الاجازه"], arb: ["في عطله نهايه الاسبوع", "العطله"], es: ["fin de semana", "los fines de semana"], fr: ["le week-end", "le weekend"], de: ["am wochenende"],
    pt: ["fim de semana", "fins de semana"], it: ["nel weekend", "fine settimana"], ru: ["по выходным", "в выходные"], tr: ["hafta sonu"], id: ["akhir pekan"], hi: ["वीकेंड"], ur: ["ویک اینڈ"], fa: ["آخر هفته"], bn: ["সপ্তাহান্তে"], sw: ["wikendi"], th: ["วันหยุดสุดสัปดาห์"],
    vi: ["cuối tuần"], zh: ["周末"], ja: ["週末"], ko: ["주말"] },
  before: { en: ["before"], ar: ["قبل"], arb: ["قبل"], es: ["antes de las", "antes de"], fr: ["avant"], de: ["vor"], pt: ["antes das", "antes de"], it: ["prima delle", "prima di"], ru: ["до"], tr: ["önce", "once"], id: ["sebelum"], hi: ["से पहले"], ur: ["سے پہلے"], fa: ["قبل از"],
    bn: ["আগে"], sw: ["kabla ya"], th: ["ก่อน"], vi: ["trước"], zh: ["之前"], ja: ["前"], ko: ["전"] },
  after: { en: ["after"], ar: ["بعد"], arb: ["بعد"], es: ["después de las", "despues de"], fr: ["après", "apres"], de: ["nach"], pt: ["depois das", "depois de"], it: ["dopo le", "dopo"], ru: ["после"], tr: ["sonra"], id: ["setelah"], hi: ["के बाद"], ur: ["کے بعد"], fa: ["بعد از"],
    bn: ["পরে"], sw: ["baada ya"], th: ["หลัง"], vi: ["sau"], zh: ["之后"], ja: ["後"], ko: ["후"] },
  more: { en: ["more than", "over", "above", "bigger than"], ar: ["اكتر من", "اكبر من", "فوق"], arb: ["اكثر من", "اكبر من"], es: ["más de", "mas de", "mayor de"], fr: ["plus de", "supérieur à"], de: ["mehr als", "über", "uber"], pt: ["mais de", "acima de"],
    it: ["più di", "piu di", "sopra"], ru: ["больше", "свыше"], tr: ["fazla", "üstünde"], id: ["lebih dari", "di atas"], hi: ["से ज़्यादा", "से ज्यादा"], ur: ["سے زیادہ"], fa: ["بیشتر از"], bn: ["এর বেশি", "বেশি"], sw: ["zaidi ya"], th: ["มากกว่า", "เกิน"],
    vi: ["hơn", "trên"], zh: ["超过", "多于"], ja: ["以上", "超え"], ko: ["이상", "넘으면"] },
  less: { en: ["less than", "under", "below"], ar: ["اقل من", "تحت"], arb: ["اقل من"], es: ["menos de"], fr: ["moins de"], de: ["weniger als", "unter"], pt: ["menos de", "abaixo de"], it: ["meno di", "sotto"], ru: ["меньше"], tr: ["az"], id: ["kurang dari"],
    hi: ["से कम"], ur: ["سے کم"], fa: ["کمتر از"], bn: ["এর কম"], sw: ["chini ya"], th: ["น้อยกว่า"], vi: ["dưới", "ít hơn"], zh: ["少于", "低于"], ja: ["未満", "以下"], ko: ["미만", "이하"] },
  // actions
  remind: { en: ["remind me to", "remind me", "remind me about"], ar: ["فكرني", "ذكرني"], arb: ["ذكرني", "ذكرني ب", "نبهني"], es: ["recuérdame", "recuerdame"], fr: ["rappelle-moi", "rappelle moi"], de: ["erinnere mich an", "erinnere mich"], pt: ["me lembre de", "lembre-me de", "me lembra de"],
    it: ["ricordami di", "ricordami"], ru: ["напомни мне", "напомни"], tr: ["hatırlat", "hatirlat"], id: ["ingatkan aku", "ingatkan saya", "ingatkan"], hi: ["याद दिलाना", "याद दिला दो", "याद दिलाओ"], ur: ["یاد دلانا", "یاد دلاؤ"], fa: ["یادم بنداز", "یادآوری کن"],
    bn: ["মনে করিয়ে দিও", "মনে করিয়ে দাও"], sw: ["nikumbushe"], th: ["เตือนฉัน", "เตือน"], vi: ["nhắc tôi", "nhắc"], zh: ["提醒我"], ja: ["リマインド", "思い出させて", "知らせて"], ko: ["알려줘", "리마인드"] },
  tell: { en: ["tell me", "notify me", "let me know", "alert me"], ar: ["قولي", "بلغني", "عرفني", "نبهني"], arb: ["اخبرني", "ابلغني", "نبهني"], es: ["avísame", "avisame", "dime", "notifícame"], fr: ["préviens-moi", "previens-moi", "dis-moi", "avertis-moi"], de: ["sag mir", "benachrichtige mich", "gib mir bescheid"],
    pt: ["me avise", "me diga", "me notifique"], it: ["avvisami", "dimmi"], ru: ["сообщи мне", "скажи мне", "уведоми меня"], tr: ["haber ver", "bildir"], id: ["beri tahu aku", "kabari aku", "beritahu saya"], hi: ["मुझे बताना", "बता देना"], ur: ["مجھے بتانا", "بتا دینا"], fa: ["بهم بگو", "خبرم کن"],
    bn: ["আমাকে জানাও", "জানিও"], sw: ["niambie", "nijulishe"], th: ["บอกฉัน", "แจ้งฉัน"], vi: ["báo tôi", "cho tôi biết"], zh: ["告诉我", "通知我"], ja: ["教えて", "通知して"], ko: ["알려 줘", "말해 줘"] },
  read: { en: ["read me", "read out", "read my"], ar: ["اقرالي", "اقرأ لي", "اقرا لي"], arb: ["اقرأ لي"], es: ["léeme", "leeme"], fr: ["lis-moi", "lis moi"], de: ["lies mir", "vorlesen"], pt: ["leia para mim", "lê para mim"], it: ["leggimi"], ru: ["прочитай мне", "зачитай"],
    tr: ["oku"], id: ["bacakan"], hi: ["पढ़कर सुनाओ", "पढ़ के सुनाओ"], ur: ["پڑھ کر سناؤ"], fa: ["برام بخون"], bn: ["পড়ে শোনাও"], sw: ["nisomee"], th: ["อ่านให้ฟัง", "อ่าน"], vi: ["đọc cho tôi"], zh: ["读给我"], ja: ["読み上げて"], ko: ["읽어 줘", "읽어줘"] },
  todos: { en: ["to-dos", "to do list", "tasks", "to-do list", "my todos"], ar: ["المهام", "مهام", "مهامي"], arb: ["المهام", "مهامي"], es: ["tareas", "pendientes"], fr: ["tâches", "taches", "à faire"], de: ["aufgaben", "to-dos"], pt: ["tarefas"], it: ["attività", "cose da fare"],
    ru: ["задачи", "дела"], tr: ["görevler", "yapılacaklar", "yapilacaklar"], id: ["tugas", "daftar tugas"], hi: ["मेरे काम", "टू-डू", "कामों"], ur: ["میرے کام", "ٹو ڈو", "کاموں"], fa: ["کارها", "کارهام"], bn: ["কাজ"], sw: ["kazi zangu", "orodha ya kazi"], th: ["งานที่ต้องทำ", "สิ่งที่ต้องทำ", "งาน"], vi: ["việc cần làm", "công việc"], zh: ["待办", "任务"], ja: ["やること", "タスク"], ko: ["할 일"] },
  show: { en: ["show me", "show", "open my", "pull up"], ar: ["وريني", "اعرضلي", "افتحلي"], arb: ["اعرض لي", "اظهر لي"], es: ["muéstrame", "muestrame", "enséñame"], fr: ["montre-moi", "affiche"], de: ["zeig mir", "zeige mir"], pt: ["me mostre", "mostre"], it: ["mostrami"], ru: ["покажи"],
    tr: ["göster", "goster"], id: ["tunjukkan", "tampilkan"], hi: ["दिखाओ", "दिखाना"], ur: ["دکھاؤ"], fa: ["نشون بده", "نشان بده"], bn: ["দেখাও"], sw: ["nionyeshe"], th: ["แสดง"], vi: ["cho tôi xem", "hiện"], zh: ["显示", "给我看"], ja: ["見せて", "表示して"], ko: ["보여줘", "보여 줘"] },
  list: { en: ["shopping list", "list", "grocery list"], ar: ["قايمه المشتريات", "قايمه السوق", "ليسته", "قايمه", "لسته"], arb: ["قائمه المشتريات", "قائمه"], es: ["lista de la compra", "lista de compras", "lista"], fr: ["liste de courses", "liste"], de: ["einkaufsliste", "liste"],
    pt: ["lista de compras", "lista"], it: ["lista della spesa", "lista"], ru: ["список покупок", "список"], tr: ["alışveriş listesi", "liste"], id: ["daftar belanja", "daftar"], hi: ["शॉपिंग लिस्ट", "लिस्ट", "सूची"], ur: ["شاپنگ لسٹ", "لسٹ", "فہرست"], fa: ["لیست خرید", "لیست"],
    bn: ["শপিং লিস্ট", "তালিকা"], sw: ["orodha ya ununuzi", "orodha"], th: ["รายการซื้อของ", "รายการ"], vi: ["danh sách mua sắm", "danh sách"], zh: ["购物清单", "清单"], ja: ["買い物リスト", "リスト"], ko: ["장보기 목록", "목록"] },
  addTo: { en: ["add", "put"], ar: ["ضيف", "حط", "زود"], arb: ["اضف", "ضع"], es: ["añade", "anade", "agrega", "pon"], fr: ["ajoute", "mets"], de: ["füge", "fuge", "setze"], pt: ["adicione", "coloque", "põe"], it: ["aggiungi", "metti"], ru: ["добавь", "положи"], tr: ["ekle"], id: ["tambahkan", "masukkan"],
    hi: ["जोड़ो", "डालो"], ur: ["شامل کرو", "ڈالو"], fa: ["اضافه کن", "بذار"], bn: ["যোগ করো"], sw: ["ongeza", "weka"], th: ["เพิ่ม"], vi: ["thêm"], zh: ["添加", "加"], ja: ["追加", "入れて"], ko: ["추가", "넣어"] },
  pot: { en: ["fund", "pot", "savings", "save", "put", "move"], ar: ["صندوق", "حوش", "حط", "حول", "التوفير", "وفر"], arb: ["صندوق", "ادخر", "حول", "ضع"], es: ["fondo", "ahorro", "ahorra", "pon", "mueve"], fr: ["fonds", "épargne", "epargne", "mets", "mets de côté"], de: ["topf", "sparen", "spare", "lege", "schiebe"],
    pt: ["fundo", "poupança", "poupanca", "guarde", "coloque"], it: ["fondo", "risparmio", "metti", "sposta"], ru: ["копилк", "отложи", "переведи в", "фонд"], tr: ["kumbara", "birikim", "ayır", "ayir", "aktar"], id: ["tabungan", "simpan", "pindahkan", "dana"],
    hi: ["फंड", "बचत", "डालो"], ur: ["فنڈ", "بچت", "ڈالو"], fa: ["صندوق", "پس انداز", "بذار"], bn: ["ফান্ড", "সঞ্চয়"], sw: ["akiba", "mfuko", "weka"], th: ["ออม", "กองทุน"], vi: ["quỹ", "tiết kiệm", "chuyển"], zh: ["存", "基金", "储蓄"], ja: ["貯金", "積立", "入れて"], ko: ["저금", "적금", "모아"] },
  log: { en: ["log it", "record it", "add it to money", "log"], ar: ["سجلها", "سجله", "سجل"], arb: ["سجلها", "سجل"], es: ["regístralo", "registralo", "anótalo"], fr: ["enregistre", "note-le"], de: ["buche es", "trag es ein"], pt: ["registre", "anote"], it: ["registralo", "annotalo"],
    ru: ["запиши"], tr: ["kaydet"], id: ["catat"], hi: ["दर्ज करो", "लिख लो"], ur: ["درج کرو"], fa: ["ثبت کن"], bn: ["লিখে রাখো"], sw: ["rekodi"], th: ["บันทึก"], vi: ["ghi lại"], zh: ["记录", "记下"], ja: ["記録して"], ko: ["기록해"] },
  open: { en: ["open"], ar: ["افتح", "افتحلي"], arb: ["افتح"], es: ["abre"], fr: ["ouvre"], de: ["öffne", "offne"], pt: ["abra", "abre"], it: ["apri"], ru: ["открой"], tr: ["aç"], id: ["buka"], hi: ["खोलो"], ur: ["کھولو"], fa: ["باز کن"], bn: ["খোলো"], sw: ["fungua"], th: ["เปิด"], vi: ["mở"],
    zh: ["打开"], ja: ["開いて"], ko: ["열어"] },
  send: { en: ["send", "message", "text", "whatsapp"], ar: ["ابعت", "ابعتلها", "ابعتله", "راسل"], arb: ["ارسل", "راسل"], es: ["envía", "envia", "manda"], fr: ["envoie"], de: ["schick", "sende"], pt: ["envie", "mande"], it: ["invia", "manda"], ru: ["отправь", "напиши"], tr: ["gönder", "gonder"],
    id: ["kirim"], hi: ["भेजो"], ur: ["بھیجو"], fa: ["بفرست"], bn: ["পাঠাও"], sw: ["tuma"], th: ["ส่ง"], vi: ["gửi"], zh: ["发", "发送"], ja: ["送って"], ko: ["보내"] },
  callDo: { en: ["call"], ar: ["كلم", "اتصل ب", "رن على"], arb: ["اتصل ب"], es: ["llama a"], fr: ["appelle"], de: ["ruf an", "anrufen"], pt: ["ligue para", "liga para"], it: ["chiama"], ru: ["позвони"], tr: ["ara"], id: ["telepon"], hi: ["कॉल करो"], ur: ["کال کرو"], fa: ["زنگ بزن"], bn: ["কল করো"],
    sw: ["mpigie"], th: ["โทรหา"], vi: ["gọi cho"], zh: ["打给"], ja: ["電話して"], ko: ["전화해"] },
  silent: { en: ["silence", "silent", "mute", "do not disturb", "dnd"], ar: ["صامت", "سايلنت", "اسكت التليفون", "اقفل الصوت"], arb: ["صامت", "عدم الازعاج"], es: ["silencio", "silencia", "no molestar"], fr: ["silencieux", "ne pas déranger"], de: ["lautlos", "nicht stören", "stumm"],
    pt: ["silencioso", "não perturbe"], it: ["silenzioso", "non disturbare"], ru: ["беззвучный", "не беспокоить"], tr: ["sessize", "rahatsız etme"], id: ["senyap", "jangan ganggu"], hi: ["साइलेंट"], ur: ["سائلنٹ"], fa: ["بی صدا", "سایلنت"], bn: ["সাইলেন্ট"], sw: ["kimya"],
    th: ["ปิดเสียง", "เงียบ"], vi: ["im lặng", "không làm phiền"], zh: ["静音", "勿扰"], ja: ["マナーモード", "サイレント", "おやすみモード"], ko: ["무음", "방해 금지"] },
  timer: { en: ["timer", "start a timer"], ar: ["تايمر", "مؤقت"], arb: ["مؤقت"], es: ["temporizador"], fr: ["minuteur"], de: ["timer"], pt: ["temporizador", "timer"], it: ["timer"], ru: ["таймер"], tr: ["zamanlayıcı", "zamanlayici"], id: ["timer"], hi: ["टाइमर"], ur: ["ٹائمر"], fa: ["تایمر"],
    bn: ["টাইমার"], sw: ["kipima muda"], th: ["ตั้งเวลา"], vi: ["hẹn giờ"], zh: ["计时器", "定时"], ja: ["タイマー"], ko: ["타이머"] },
  percent: { en: ["percent", "%"], ar: ["%", "٪", "في الميه", "في المية", "بالميه"], arb: ["%", "٪", "بالمئه", "في المئه"], es: ["%", "por ciento"], fr: ["%", "pour cent"], de: ["%", "prozent"], pt: ["%", "por cento"], it: ["%", "per cento"], ru: ["%", "процент"], tr: ["%", "yüzde"],
    id: ["%", "persen"], hi: ["%", "प्रतिशत"], ur: ["%", "فیصد"], fa: ["%", "٪", "درصد"], bn: ["%", "শতাংশ"], sw: ["%", "asilimia"], th: ["%", "เปอร์เซ็นต์"], vi: ["%", "phần trăm"], zh: ["%", "百分之"], ja: ["%", "パーセント"], ko: ["%", "퍼센트"] },
  car: { en: ["car", "my car"], ar: ["العربيه", "عربيه", "العربية"], arb: ["السياره", "سيارتي", "سياره"], es: ["coche", "carro", "auto"], fr: ["voiture"], de: ["auto"], pt: ["carro"], it: ["macchina", "auto"], ru: ["машин"], tr: ["araba"], id: ["mobil"], hi: ["कार", "गाड़ी"], ur: ["گاڑی", "کار"], fa: ["ماشین"],
    bn: ["গাড়ি"], sw: ["gari"], th: ["รถ"], vi: ["xe"], zh: ["车"], ja: ["車"], ko: ["차"] },
  home: { en: ["home"], ar: ["البيت", "بيت"], arb: ["المنزل", "البيت"], es: ["casa"], fr: ["maison", "chez moi"], de: ["zuhause", "zu hause", "nach hause"], pt: ["casa"], it: ["casa"], ru: ["дом"], tr: ["eve", "ev"], id: ["rumah"], hi: ["घर"], ur: ["گھر"], fa: ["خونه", "خانه"], bn: ["বাড়ি"],
    sw: ["nyumbani"], th: ["บ้าน"], vi: ["nhà"], zh: ["家"], ja: ["家"], ko: ["집"] },
  work: { en: ["office", "work"], ar: ["الشغل", "المكتب"], arb: ["العمل", "المكتب"], es: ["oficina", "trabajo"], fr: ["bureau", "travail"], de: ["büro", "buro", "arbeit"], pt: ["escritório", "escritorio", "trabalho"], it: ["ufficio", "lavoro"], ru: ["офис", "работ"], tr: ["ofis", "iş", "işe"],
    id: ["kantor"], hi: ["ऑफिस", "दफ्तर"], ur: ["دفتر", "آفس"], fa: ["دفتر", "سر کار"], bn: ["অফিস"], sw: ["ofisini", "kazini"], th: ["ที่ทำงาน", "ออฟฟิศ"], vi: ["văn phòng", "chỗ làm"], zh: ["公司", "办公室"], ja: ["会社", "職場"], ko: ["회사", "사무실"] },
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RX = {};
// languages that add endings to a word (Turkish «maaşım», Persian «کارهامو», Bengali «ফান্ডে», Russian «зарплату», Arabic «صامتا»):
// their words of 4+ letters may be followed by more letters
const SUFFIXED = new Set(["tr", "fa", "ur", "hi", "bn", "sw", "ko", "ar", "arb", "ru", "id"]);
for (const [k, by] of Object.entries(W)) {
  const strict = new Set(), loose = new Set(), tight = new Set();
  for (const [L, list] of Object.entries(by)) for (const w0 of list) { const w = fold(w0); if (NOSPACE.test(w)) tight.add(w); else if (SUFFIXED.has(L) && w.length >= 4 && !/^[a-z]+$/.test(w)) loose.add(w); else strict.add(w); }
  const by_len = (set) => [...set].sort((a, b) => b.length - a.length).map(esc).join("|");
  const parts = [];
  if (strict.size) parts.push("(?<![\\p{L}\\p{M}])(?:و|ف)?(?:" + by_len(strict) + ")(?![\\p{L}\\p{M}])");
  if (loose.size) parts.push("(?<![\\p{L}\\p{M}])(?:و|ف|ب|ل|ال)?(?:" + by_len(loose) + ")");
  if (tight.size) parts.push("(?:" + by_len(tight) + ")");
  RX[k] = new RegExp(parts.join("|") || "(?!)", "u");
}
export const has = (k, t) => RX[k].test(t);
export const which = (k, t) => { const m = RX[k].exec(t); return m ? m[0] : null; };
const find = (k, t) => { const m = RX[k].exec(t); return m ? { at: m.index, end: m.index + m[0].length, w: m[0] } : null; };

// ---- days, months and times in every language (Intl) ----------------------------------------------------------------------------
const LOCALES = { en: "en", ar: "ar-EG", arb: "ar", es: "es", fr: "fr", de: "de", pt: "pt", it: "it", ru: "ru", tr: "tr", id: "id", hi: "hi", ur: "ur", fa: "fa", bn: "bn", sw: "sw", th: "th", vi: "vi", zh: "zh", ja: "ja", ko: "ko" };
let DAYS = null;
function dayNames() {
  if (DAYS) return DAYS; DAYS = [];
  for (const loc of Object.values(LOCALES)) for (const style of ["long", "short"]) {
    try { const f = new Intl.DateTimeFormat(loc, { weekday: style, timeZone: "UTC" }); for (let d = 0; d < 7; d++) { const n = fold(f.format(new Date(Date.UTC(2026, 10, 1 + d)))).replace(/[.,]$/, ""); if (n.length >= (style === "short" ? 4 : 2) || (NOSPACE.test(n) && n.length >= 2)) DAYS.push([n, d]); /* never one character: «水» is water, «金» money */  } } catch (e) {}
  }
  // the everyday forms the formatter doesn't give
  for (const [n, d] of [["الحد", 0], ["الاحد", 0], ["الاتنين", 1], ["التلات", 2], ["الاربع", 3], ["الخميس", 4], ["الجمعه", 5], ["السبت", 6], ["حد", 0], ["احد", 0], ["اتنين", 1], ["تلات", 2], ["اربع", 3], ["جمعه", 5], ["سبت", 6], ["خميس", 4]]) DAYS.push([n, d]);
  DAYS.sort((a, b) => b[0].length - a[0].length);
  return DAYS;
}
export function daysIn(t) { const out = new Set(); let s = t; for (const [n, d] of dayNames()) { const re = NOSPACE.test(n) ? new RegExp(esc(n)) : new RegExp("(?<![\\p{L}\\p{M}])" + esc(n) + "(?![\\p{L}\\p{M}])", "u"); if (re.test(s)) { out.add(d); s = s.replace(re, " "); } } return [...out].sort(); }
const PM = /\b(pm|p\.m\.)\b|مساء|بالليل|بليل|العصر|المغرب|soir|tarde|noche|abend|nachmittag|sera|pomeriggio|вечер|дня|akşam|aksam|sore|malam|शाम|رات|شام|عصر|شب|সন্ধ্যা|রাত|jioni|usiku|เย็น|ค่ำ|tối|chiều|晚上|下午|午後|夜|저녁|오후/u;
const AM = /\b(am|a\.m\.)\b|الصبح|صباحا|صباحاً|matin|mañana|morgen|mattina|утр|sabah|pagi|सुबह|صبح|সকাল|asubuhi|เช้า|sáng|早上|上午|午前|朝|아침|오전/u;
/** "7", "7:30", "19h", «الساعة 7 الصبح», "下午3点", "7時", "7시" → { h, m } */
export function timeIn(t) {
  const m = /(?:^|[^\d])(\d{1,2})(?:\s*[:.h時시点點]\s*(\d{2}))?\s*(?:o'?clock|uhr|h|horas?|heures?|ore|час\w*|saat|jam|बजे|بجے|ساعت|টায়|โมง|giờ|点|時|시)?/u.exec(t.replace(/\d{3,}|\d+\s*%/g, " "));
  if (!m) return null; let h = +m[1], mi = m[2] ? +m[2] : 0; if (h > 23 || mi > 59) return null;
  if (h < 12 && PM.test(t)) h += 12; if (h === 12 && AM.test(t) && !PM.test(t)) h = 0;
  return { h, m: mi };
}
const amountsIn = (t) => [...t.replace(/(\d)[,٬](\d{3})/g, "$1$2").matchAll(/(\d+(?:\.\d+)?)\s*(k(?![\p{L}])|الف|ألف|thousand|mil(?![\p{L}])|bin(?![\p{L}])|ribu|हज़ार|هزار|千|万|천|만)?/gu)].map((m) => { let v = +m[1]; const u = m[2] || ""; if (/^(k|الف|ألف|thousand|mil|bin|ribu|हज़ार|هزار|千|천)$/i.test(u)) v *= 1000; if (/^(万|만)$/.test(u)) v *= 10000; return { v, at: m.index, end: m.index + m[0].trimEnd().length }; });

// ---- names: the person's own ------------------------------------------------------------------------------------------------------
/** ctx: { people:[{id,name,aka:[]}], places:[{id,name,aka:[]}], devices:[{id,name}], apps:[{id,name,aka:[]}], pots:[{id,name}], lists:[{id,name}] } */
// a person saved with a role (People & plans "role") is also found by that role's word in every language
const ROLE = { mother: ["mum", "mom", "mother", "mama", "ماما", "امي", "مامتي", "والدتي", "maman", "mère", "mamá", "madre", "mutter", "mama", "mãe", "mamãe", "mamma", "madre", "мама", "мать", "annem", "anne", "ibu", "mama", "माँ", "मां", "मम्मी", "امی", "ماں", "مامان", "مادرم", "মা", "আম্মু", "mama", "แม่", "mẹ", "妈妈", "母亲", "お母さん", "母", "엄마", "어머니"],
  father: ["dad", "father", "baba", "بابا", "ابويا", "والدي", "papa", "père", "papá", "padre", "vater", "papai", "pai", "папа", "отец", "babam", "baba", "ayah", "bapak", "पापा", "पिताजी", "ابو", "ابا", "بابام", "পাপা", "বাবা", "baba", "พ่อ", "bố", "ba", "爸爸", "父亲", "お父さん", "父", "아빠", "아버지"],
  wife: ["wife", "مراتي", "زوجتي", "femme", "esposa", "mujer", "frau", "mulher", "moglie", "жена", "karım", "istri", "पत्नी", "बीवी", "بیوی", "زنم", "همسرم", "স্ত্রী", "mke", "ภรรยา", "vợ", "老婆", "妻子", "妻", "아내"],
  husband: ["husband", "جوزي", "زوجي", "mari", "esposo", "marido", "mann", "marito", "муж", "kocam", "suami", "पति", "شوہر", "شوهرم", "স্বামী", "mume", "สามี", "chồng", "老公", "丈夫", "夫", "남편"] };
function namesIn(t, items = []) {
  const out = [];
  for (const it of items || []) if (it && it.role && ROLE[it.role]) { for (const w of ROLE[it.role]) { const f = fold(w); const re = NOSPACE.test(f) ? new RegExp(esc(f)) : new RegExp("(?<![\\p{L}\\p{M}])(?:ل|ب|ال)?" + esc(f) + "(?:['’]?\\p{L}{0,3})(?![\\p{L}\\p{M}])", "u"); const m = re.exec(t); if (m) { out.push({ it, at: m.index }); break; } } }
  for (const it of items || []) for (const n of [it.name, ...(it.aka || [])].filter(Boolean)) { const f = fold(n); if (f.length < 2) continue;
    // a name in a language without word gaps (中文 / 日本語 / ไทย / 한국어), or a Latin name inside such text: only Latin letters are its edge
    const re = NOSPACE.test(f) ? new RegExp(esc(f)) : NOSPACE.test(t) && /^[\x00-\x7F]+$/.test(f) ? new RegExp("(?<![A-Za-z])" + esc(f) + "(?![A-Za-z])", "u") : new RegExp("(?<![\\p{L}\\p{M}])(?:ل|ب|ال|لل|بال)?" + esc(f) + "(?![\\p{L}\\p{M}])", "u");
    let m = re.exec(t);
    if (!m && !NOSPACE.test(f) && f.length >= 3) m = new RegExp("(?<![\\p{L}\\p{M}])" + esc(f) + "(?:['’]?\\p{L}{1,4})(?![\\p{L}\\p{M}])", "u").exec(t);   // a name with an ending: «annem», «karim'den», «карима»
    if (m) { out.push({ it, at: m.index }); break; } }
  // the same name for two people → both (ask which); in the order they are said
  const seen = new Set(); return out.filter((x) => (seen.has(x.it.id) ? false : seen.add(x.it.id))).sort((a, b) => a.at - b.at);
}
const APPS = [["whatsapp", "WhatsApp", ["whatsapp", "واتساب", "واتس", "الواتس", "ватсап", "وٹس ایپ", "واتس‌اپ"]], ["gmail", "Gmail", ["gmail", "جيميل", "email", "e-mail", "ايميل", "الايميل"]], ["talabat", "talabat", ["talabat", "طلبات"]], ["uber", "Uber", ["uber", "اوبر"]],
  ["careem", "Careem", ["careem", "كريم"]], ["instapay", "InstaPay", ["instapay", "انستاباي"]], ["telegram", "Telegram", ["telegram", "تليجرام", "تلغرام"]], ["youtube", "YouTube", ["youtube", "يوتيوب"]], ["maps", "Maps", ["maps", "google maps", "الخرايط", "الخريطه", "خرائط"]], ["spotify", "Spotify", ["spotify", "سبوتيفاي"]]];

/** One sentence → a rule, or null when it is not a rule. */
export function parseRule(text0, ctx = {}) {
  const raw = String(text0 || "").trim(); if (!raw || raw.length > 400) return null;
  const t = fold(raw);
  const startsWhen = new RegExp("^(?:" + [...new Set(Object.values(W.when).flat().map(fold))].filter((w) => !NOSPACE.test(w)).sort((a, b) => b.length - a.length).map(esc).join("|") + ")(?![\\p{L}])", "u").test(t)
    || /^(?:当|如果|每当|一旦|เมื่อ|ถ้า)/.test(t) || /(?:たら|とき|時|ときに|면|때)[、,\s]/.test(t) || /(?:dığında|diginda|dığımda|digimda|ğında)/.test(t);
  const people = namesIn(t, ctx.people), places = namesIn(t, ctx.places), devices = namesIn(t, ctx.devices), pots = namesIn(t, ctx.pots);
  const apps = namesIn(t, [...(ctx.apps || []), ...APPS.map(([id, name, aka]) => ({ id, name, aka }))]);
  const days = daysIn(t), time = timeIn(t), money = amountsIn(t);
  const ask = [];
  // ---- the trigger -----------------------------------------------------------------------------------------------------------------
  let when = null;
  const hasEvery = has("every", t) || days.length > 0;
  const btWord = /bluetooth|بلوتوث|البلوتوث|блютуз|ब्लूटूथ|بلوٹوتھ|ব্লুটুথ|บลูทูธ|蓝牙|ブルートゥース|블루투스/u.test(t);
  if (btWord) when = { type: "bluetooth", device: devices[0] ? devices[0].it.id : has("car", t) ? "car" : null };
  else if (has("salary", t)) when = { type: "money_in", what: "salary" };
  else if (has("msg", t) && !has("moneyWord", t)) when = { type: "message", who: people[0] ? people[0].it.id : null, app: apps[0] ? apps[0].it.id : "any" };
  else if (has("call", t) && !has("callDo", t.slice(0, 6)) && !has("moneyWord", t)) when = { type: "call", who: people[0] ? people[0].it.id : null, missed: /missed|فايته|فائته|perdida|manqué|manque|verpasst|persa|пропущ|cevapsız|tak terjawab/u.test(t) };
  else if (has("moneyWord", t) && (has("moneyIn", t) || startsWhen || /(?:たら|면|时|時)/u.test(t))) when = { type: "money_in", who: people[0] ? people[0].it.id : null, from: true };
  else if (has("notifFrom", t)) when = { type: "notification", app: apps[0] ? apps[0].it.id : null };
  else if ((has("bt", t) && !has("call", t)) || (has("car", t) && /اركب|get in|ride|monte|steige|entro|сяду|bin/u.test(t))) when = { type: "bluetooth", device: devices[0] ? devices[0].it.id : has("car", t) ? "car" : null };
  else if (has("wifi", t)) when = { type: "wifi", net: devices[0] ? devices[0].it.id : null };
  else if (has("charge", t)) when = { type: "charging" };
  else if (has("leave", t)) when = { type: "leave", place: places[0] ? places[0].it.id : has("home", t) ? "home" : has("work", t) ? "work" : null };
  else if ((has("arrive", t) && (places.length || has("home", t) || has("work", t) || startsWhen)) ) when = { type: "arrive", place: places[0] ? places[0].it.id : has("home", t) ? "home" : has("work", t) ? "work" : null };
  else if (has("moneyOut", t) && startsWhen) when = { type: "money_out" };
  else if (hasEvery && (time || days.length || /day|يوم|día|jour|tag|dia|giorno|день|gün|hari|दिन|روز|দিন|siku|วัน|ngày|天|日|날|month|شهر|mes|mois|monat|mês|mese|месяц|ay|bulan|महीने|ماه|মাস|mwezi|เดือน|tháng|月|달/u.test(t))) {
    when = { type: "time", at: time || { h: 9, m: 0 }, days: days.length ? days : null, monthly: /month|شهر|شهريا|mes|mois|monat|mês|mese|месяц|ay\b|bulan|महीने|ماه|মাস|mwezi|เดือน|tháng|月|달/u.test(t) && !days.length, dom: null };
    const dom = /(?:on the|يوم|el día|le|am|no dia|il|число|ayın|tanggal|तारीख|تاریخ|তারিখ|tarehe|วันที่|ngày)\s*(\d{1,2})(?:st|nd|rd|th|\.|er)?/u.exec(t); if (when.monthly && dom) when.dom = +dom[1];
  }
  if (!when) { if (!startsWhen) return null; ask.push({ field: "when", q: "When should this happen?", choices: ["time", "arrive", "leave", "bluetooth", "charging", "money_in", "message", "call"] }); }
  // who / where / which, when it wasn't said or is one of two
  if (when && ["money_in", "message", "call"].includes(when.type)) {
    const named = people.map((p) => p.it.id), same = (ctx.people || []).filter((p) => people.some((q) => fold(q.it.name) === fold(p.name)));
    if (same.length > 1) ask.push({ field: "who", q: "Which {n}?", v: { n: same[0].name }, choices: same.map((p) => p.id) });
    else if (!when.who && (when.type !== "money_in" || when.from)) ask.push({ field: "who", q: "From whom?", choices: [...(ctx.people || []).slice(0, 6).map((p) => p.id), "anyone"] });
    if (named.length && !when.who) when.who = named[0];
  }
  if (when && ["arrive", "leave"].includes(when.type) && !when.place) ask.push({ field: "place", q: "Which place?", choices: [...(ctx.places || []).slice(0, 5).map((p) => p.id), "new"] });
  if (when && when.type === "bluetooth" && (!when.device || (when.device === "car" && (ctx.devices || []).length > 1 && !devices.length))) ask.push({ field: "device", q: "Which Bluetooth device?", choices: (ctx.devices || []).map((d) => d.id) });
  // ---- the checks ----------------------------------------------------------------------------------------------------------------
  const ifs = [];
  if (has("weekdays", t)) ifs.push({ type: "weekdays" }); else if (has("weekend", t)) ifs.push({ type: "weekend" });
  const bf = find("before", t), af = find("after", t);
  const around = (p) => { const a = /^\s*(\D{0,10})\d/u.exec(t.slice(p.end, p.end + 20)), b = /\d[^\d]{0,8}$/u.exec(t.slice(Math.max(0, p.at - 16), p.at));
    const MIN = /^\s*\d{1,3}\s*(?:min|minutes?|minutos|minuten|minuti|минут|dakika|menit|मिनट|منٹ|دقیقه|دقيقه|মিনিট|นาที|phút|分|분)/u;
    const da = a && !MIN.test(t.slice(p.end, p.end + 16).replace(/^\D{0,10}(?=\d)/u, "")) ? a[1].length : 99, db = b ? b[0].length - 1 : 99;   // the hour written next to the word, on the nearer side — never "10 minutes"
    if (da === 99 && db === 99) return null;
    return db < da ? timeIn(t.slice(Math.max(0, p.at - 16), p.at)) : timeIn(t.slice(p.end, p.end + 20)) || timeIn(t.slice(Math.max(0, p.at - 16), p.at)); };   // "before 9" · «9点之前» · «11 টার আগে»
  if (bf && when && when.type !== "time") { const tm = around(bf); if (tm) ifs.push({ type: "before", at: tm }); }
  if (af && when && when.type !== "time") { const tm = around(af); if (tm) ifs.push({ type: "after", at: tm }); }
  const mo = find("more", t), le = find("less", t);
  const MINS = /^\s*(?:min|minutes?|minutos|minuten|minuti|минут|dakika|menit|मिनट|منٹ|دقیقه|دقيقه|মিনিট|นาที|phút|分|분)/u;
  const amountAfter = (p) => { const a = money.find((x) => x.at >= p.end && x.at - p.end < 6 && !MINS.test(t.slice(x.end)) && !/^\s*(?:%|٪)/u.test(t.slice(x.end))), b = money.filter((x) => x.end <= p.at && p.at - x.end < 8).slice(-1)[0];   // «1000 से ज़्यादा», «500以上»
    return a && b ? (a.at - p.end <= p.at - b.end ? a : b) : a || b; };
  if (mo && amountAfter(mo)) ifs.push({ type: "more", amount: amountAfter(mo).v }); if (le && amountAfter(le)) ifs.push({ type: "less", amount: amountAfter(le).v });
  // ---- the actions ---------------------------------------------------------------------------------------------------------------
  const dos = [];
  const pc = money.find((x) => /^\s*(?:%|٪|percent|في الميه|في المية|بالميه|بالمئه|por ciento|pour cent|prozent|por cento|per cento|процент|persen|प्रतिशत|فیصد|درصد|শতাংশ|asilimia|เปอร์เซ็นต์|phần trăm|パーセント|퍼센트)/u.test(t.slice(x.end, x.end + 14)) || /(?:%|٪|yüzde|yuzde|百分之|asilimia|persen|percent of)\s*$/u.test(t.slice(Math.max(0, x.at - 10), x.at)));
  const used = new Set(ifs.filter((x) => x.amount != null).map((x) => x.amount));
  if (has("pot", t) && (pc || pots.length || /صندوق|fund|fonds|fondo|topf|fundo|копилк|kumbara|tabungan|फंड|فنڈ|پس انداز|ফান্ড|akiba|กองทุน|quỹ|基金|貯金|적금/u.test(t)) && (pc || money.some((x) => !used.has(x.v)) || (when && when.type === "money_in"))) {
    const fixed = pc ? null : money.filter((x) => !used.has(x.v)).slice(-1)[0];
    // money arriving with no amount said for the fund ("… put it in the university fund") = all of it
    dos.push({ type: "pot", pct: pc ? pc.v : fixed ? null : 100, amount: fixed ? fixed.v : null, pot: pots[0] ? pots[0].it.id : null });
    if (!pots.length) ask.push({ field: "pot", q: "Which fund?", choices: [...(ctx.pots || []).slice(0, 5).map((p) => p.id), "new"] });
    if (pc && (pc.v <= 0 || pc.v > 100)) ask.push({ field: "pct", q: "What percent?", choices: [] });
  }
  if (has("read", t) && has("todos", t)) dos.push({ type: "read", what: "todos" });
  else if (has("show", t) && has("list", t)) dos.push({ type: "show", what: "list", list: (namesIn(t, ctx.lists)[0] || {}).it ? namesIn(t, ctx.lists)[0].it.id : "shopping" });
  else if (has("show", t) && has("todos", t)) dos.push({ type: "show", what: "todos" });
  if (has("addTo", t) && has("list", t) && !dos.some((d) => d.type === "pot")) dos.push({ type: "list_add", list: (namesIn(t, ctx.lists)[0] || {}).it ? namesIn(t, ctx.lists)[0].it.id : "shopping", items: itemsOf(raw) });
  else if (has("addTo", t) && has("todos", t)) dos.push({ type: "todo_add", text: restAfter(raw, "addTo") });
  if (has("log", t) && !dos.length) dos.push({ type: "log" });
  if (has("silent", t)) dos.push({ type: "silent" });
  if (has("timer", t)) { const mins = /(?:dakika|minuti|phút)\s*(\d{1,3})(?!\d)|(\d{1,3})\s*(?:min|دقيقه|دقايق|minutos|minutes|minuten|minuti|минут|dakika|menit|मिनट|منٹ|دقیقه|মিনিট|dakika|นาที|phút|分钟|分|분)/u.exec(t); dos.push({ type: "timer", minutes: mins ? +(mins[1] || mins[2]) : null }); if (!mins) ask.push({ field: "minutes", q: "A timer for how many minutes?", choices: [5, 10, 25, 60] }); }
  if (has("open", t) && !dos.some((d) => d.type === "show")) { const a = apps.find((x) => x.it.id !== (when && when.app)); if (a) dos.push({ type: "open", app: a.it.id }); }
  if (has("callDo", t) && !(when && when.type === "call")) { const who = people.find((p) => !when || p.it.id !== when.who); if (who) dos.push({ type: "call", who: who.it.id }); }
  const after = (k) => { const re = new RegExp(RX[k].source, "gu"); let m, last = -1; while ((m = re.exec(t))) last = m.index; return last; };
  const trigEnd = when ? Math.max(...["moneyWord", "moneyIn", "msg", "call", "salary", "arrive", "leave", "bt", "charge"].map((k) => { const m = find(k, t); return m ? m.end : -1; })) : -1;
  if (has("send", t) && after("send") > trigEnd && people.length && !(when && when.type === "message" && people.length < 2)) { const who = people.find((p) => !when || p.it.id !== when.who) || people[0]; dos.push({ type: "message", who: who.it.id, app: apps[0] ? apps[0].it.id : "whatsapp", text: quoted(raw) }); }
  if (has("remind", t)) dos.push({ type: "remind", text: restAfter(raw, "remind") });
  if ((has("tell", t) || (!dos.length && when)) && !dos.some((d) => d.type === "remind")) dos.push({ type: "tell", text: has("tell", t) ? restAfter(raw, "tell") : "" });
  if (!dos.length || (dos.length === 1 && dos[0].type === "tell" && !has("tell", t) && !startsWhen)) { if (!when) return null; if (!dos.length) ask.push({ field: "do", q: "What should I do then?", choices: ["remind", "tell", "list_add", "pot", "read", "silent", "open"] }); }
  if (when && when.type === "time" && !time && !days.length && !when.monthly) ask.push({ field: "at", q: "At what time?", choices: ["08:00", "09:00", "18:00", "21:00"] });
  return { when, if: ifs, do: dos, ask, text: raw };
}
function restAfter(raw, k) { const t = fold(raw), m = find(k, t); if (!m) return ""; let s = t.slice(m.end).replace(/^\s*(?:to|that|about|ان|إن|ب|de|à|a|an|di|о|ki|untuk|को|که|কে|kwamba|ว่า|rằng)\s+/iu, "").trim(); s = s.replace(/[.!?؟]+$/, ""); return s.slice(0, 120); }
function itemsOf(raw) { const t = fold(raw); const m = find("addTo", t); if (!m) return []; const part = t.slice(m.end).split(RX.list)[0]; return part.split(/\s*(?:,|،|、|\band\b|\bو(?=\S)|\bet\b|\by\b|\bund\b|\be\b|\bи\b|\bve\b|\bdan\b|और|اور|و|এবং|na|และ|và|和|と|와|과)\s*/u).map((x) => x.replace(/^(?:to|on|في|على|a|à|zu|para|in|в|ke|को|به|তে|kwenye|ใน|vào|到|に|에)\s+/u, "").replace(/\s+(?:to|on|في|على|a|à|zu|para|in|в|ke|को|به|তে|kwenye|ใน|vào|到|に|에)$/u, "").trim()).filter((x) => x.length >= 2).slice(0, 12); }
const quoted = (raw) => { const m = /["“«]([^"”»]{1,200})["”»]/.exec(raw); return m ? m[1] : ""; };

/** The rule in words (for the card): "When you connect to My car · weekdays · → read today's to-dos". */
export function ruleWords(r, nameOf = (k, id) => id) {
  if (!r || !r.when) return "";
  const w = r.when, W2 = { time: "at {t}", arrive: "you arrive at {p}", leave: "you leave {p}", bluetooth: "you connect to {d}", wifi: "you join Wi-Fi {d}", charging: "you start charging", money_in: "money arrives{f}", money_out: "you pay", message: "{n} messages you", call: "{n} calls", notification: "{a} notifies you" };
  return W2[w.type] || w.type;
}

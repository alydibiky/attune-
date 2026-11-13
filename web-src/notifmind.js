/* ---- v9.9.31 Attune understands every notification (Ali, 13 Nov 2026: "I want it to comprehend and understand every notification —
   like you would. I don't care how, but make the models smarter and the coding smarter and cover everything possible, no less").
   One notification {app, pkg, title, text, ts} → what a person reading it over your shoulder would know:
     cat      what it is — one of CATS (chat, bank, bill, delivery, school, work, government, security, news …)
     intent   why it was sent — info · request · question · invite · reminder · confirm · change · cancel · alert · offer · greeting
     from     who sent it — { name, type: person · group · company · bank · gov · school · app · unknown }
     action   what YOU have to do — none · reply · pay · attend · pickup · call_back · check · verify · renew · update_payment · submit · travel · read
     due      by when — { date: "2026-11-15", time: "18:00" } (or null)
     amount   { value, cur, dir: in · out · due · price } (or null)
     ref      an order / booking / case number; place; urgency (high · normal · low); summary (one line)
     sure     code is sure of cat + intent (+ the details it read); otherwise the on-device model reads it (mindPrompt → readMind,
              every number / date the model gives must be in the notification) and merge() keeps the best of both.
   Code first (fast, offline, the same answer every time), the model for what code can't place — never the other way round.
   Pure; tests: tests/notifmind/gen.mjs (10,000 notifications, 34 kinds × 11 intents × 9 languages) + heldout.mjs + unit. */
import { understandNote as meaningOf } from "./notifmeaning.js";
import { notAPayment, isScam, CODE_W } from "./notifwords.js";

export const CATS = ["chat", "call", "bank", "wallet", "receipt", "bill", "subscription", "delivery", "food", "ride", "travel", "appointment",
  "health", "work", "school", "government", "security", "code", "promo", "news", "social", "media", "game", "system", "smart_home",
  "weather", "sports", "markets", "job", "marketplace", "charity", "email", "calendar", "other"];
export const INTENTS = ["info", "request", "question", "invite", "reminder", "confirm", "change", "cancel", "alert", "offer", "greeting"];
export const ACTIONS = ["none", "do", "reply", "pay", "attend", "pickup", "call_back", "check", "verify", "renew", "update_payment", "submit", "travel", "read"];
export const FROM_TYPES = ["person", "group", "company", "bank", "gov", "school", "app", "unknown"];

const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/٫/g, ".").replace(/٬/g, ",");
const fold = (s) => latin(s).toLowerCase().normalize("NFKC").replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/[\u200e\u200f\u061c\u202a-\u202e]/g, "");
const pad = (n) => String(n).padStart(2, "0");
const isoOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
// a word / phrase list → one test that only matches whole words (Arabic and accented letters too)
// (Arabic words take their article and endings: «الاجتماع», «وبكرة», «رفعها», «معزومين»)
const AR_LETTER = /[\u0600-\u06FF]/;
const words = (list) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + list.map((w) => { const f = fold(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return AR_LETTER.test(f) ? "(?:و|ف|ب|ل|ال|وال|بال|لل|فال)?" + (f.length >= 6 ? f.replace(/^ال/, "(?:ال)?") : f) + "(?:ها|ه|هم|هن|ك|كم|ي|نا|ين|ون|ات|ة|ه)?" : f; }).join("|") + ")(?![\\p{L}])", "u");

// ---- 1. the app → what it is (the package name and the app's label; for an SMS / an email, the sender) ---------------------------
const APPCAT = [
  ["call", /dialer|incallui|\btelecom\b|android\.phone|contacts|truecaller|\bphone\b/, "app"],
  ["chat", /whatsapp|telegram|messenger|com\.facebook\.orca|org\.signal|securesms|viber|\bimo\b|botim|wechat|tencent\.mm|naver\.line|kakao|zalo|\bline\b/, "person"],
  ["work", /slack|microsoft\.teams|\bteams\b|zoom|webex|jira|atlassian|asana|trello|monday\.com|clickup|github|gitlab|bitbucket|notion|linear|confluence|basecamp|hubspot|salesforce|odoo|workday|bamboohr|lark/, "company"],
  ["calendar", /calendar|com\.google\.android\.apps\.tachyon|meet\b|timetree/, "app"],
  ["bank", /\bbank\b|banque|banco|\bcib\b|\bnbe\b|banquemisr|bank ?misr|\bqnb\b|hsbc|alahly|al ?ahli|ahlibank|alexbank|\baaib\b|faisal|\badib\b|\bfab\b|emiratesnbd|emirates ?nbd|mashreq|\bcbq\b|doha ?bank|alrajhi|al ?rajhi|\bsnb\b|riyad ?bank|\bsabb\b|alinma|albilad|\bnbk\b|\bkfh\b|\bnbb\b|\badcb\b|\bdib\b|barclays|chase|bofa|bankofamerica|wellsfargo|citi(?:bank)?\b|\bhdfc\b|icici|\bsbi\b|axis ?bank|\bbca\b|mandiri|garanti|akbank|isbank|ziraat|santander|bbva|\bing\b|deutsche ?bank|commerzbank|bnp|societe ?generale|monzo|revolut|n26/, "bank"],
  ["wallet", /instapay|vodafone ?cash|vf-?cash|fawry|\bvalu\b|paymob|telda|paypal|\bwise\b|stc ?pay|apple ?pay|google ?wallet|samsung ?wallet|etisalat ?cash|orange ?cash|we ?pay|\bmeeza\b|sympl|souhoola|contact ?credit|aman\b|khazna|halan ?wallet|paytm|phonepe|gopay|\bovo\b|dana\b|venmo|cash ?app|zelle/, "company"],
  ["delivery", /amazon|\bnoon\b|jumia|shein|temu|aliexpress|aramex|\bdhl\b|fedex|\bups\b|bosta|mylerz|smsa|naqel|\bj&t\b|ikea|trendyol|hepsiburada|etsy|ebay|lazada|shopee|tokopedia|flipkart|myntra|zara|h&m|lc ?waikiki|max ?fashion|namshi|ounass|centrepoint/, "company"],
  ["food", /talabat|elmenus|breadfast|deliveroo|ubereats|uber ?eats|hungerstation|jahez|mrsool|careem ?food|instashop|rabbit|glovo|doordash|grubhub|zomato|swiggy|foodpanda|yemeksepeti|getir|keeta|noon ?food|chefaa|otlob|mcdonald|kfc|pizza|starbucks|costa/, "company"],
  ["ride", /\buber\b|careem|indrive|indriver|\bdidi\b|\bbolt\b|\bswvl\b|\blyft\b|\bhalan\b|\bgrab\b|\bola\b|yango|bitaksi/, "company"],
  ["travel", /egyptair|emirates|qatar ?airways|qatarairways|saudia|flydubai|air ?arabia|airarabia|flynas|flyadeal|turkish ?airlines|pegasus|lufthansa|british ?airways|klm|air ?france|etihad|booking\.com|\bbooking\b|airbnb|agoda|expedia|skyscanner|wego|almosafer|tajawal|trip\.com|hotels\.com|kayak|trivago|marriott|hilton|accor|ihg|\bvisa ?(?:center|centre)|vfs ?global|tlscontact/, "company"],
  ["charity", /بنك الطعام|food ?bank|57357|resala|رسالة للأعمال|misr ?el ?kheir|مصر الخير|unicef|red ?crescent|الهلال الأحمر|charity|donat/, "company"],
  ["appointment", /vezeeta|altibbi|tbibi|doctoranytime|practo|zocdoc|doctolib|booksy|fresha|\bclinic ?booking/, "company"],
  ["health", /seha|\bclinic|hospital|\blab\b|alborg|almokhtabar|\bpharmacy|chefaa|el ?ezaby|seif|19011|medicine|doctor|dr\.? |fitbit|samsung ?health|google ?fit|strava|garmin|flo\b|clue\b|myfitnesspal|cronometer|healthifyme|huawei ?health|mi ?fitness|zepp/, "company"],
  ["school", /classroom|moodle|canvas|blackboard|edmodo|seesaw|toddle|schoology|teams ?for ?education|\bschool\b|madrasa|مدرس|academy|university|\buni\b|college|\bacademy\b|nafs|edu\b|madrasati|noor\b|duolingo|coursera|udemy|khan/, "school"],
  ["government", /digital ?egypt|مصر الرقمية|absher|abshir|tawakkalna|nafath|uae ?pass|\bicp\b|mygov|\bgov\b|ministry|وزارة|traffic|المرور|tax ?authority|zakat|\bmoi\b|\bnadra\b|e-?devlet|aadhaar|digilocker|ird\b|irs\b|hmrc|social ?insurance|التأمينات|الضرائب|الجوازات|passport ?office|civil ?registry|السجل المدني/, "gov"],
  ["security", /authenticator|google ?account|apple ?id|microsoft ?account|\bsecurity\b|2fa|\bduo\b|okta|1password|bitwarden|lastpass|find ?my/, "app"],
  ["social", /facebook|instagram|tiktok|musical\.ly|twitter|\bx\.com\b|com\.twitter|snapchat|linkedin|reddit|pinterest|threads|tumblr|quora|nextdoor|bereal|vk\.com|\bvk\b/, "app"],
  ["media", /youtube|netflix|spotify|anghami|shahid|watch ?it|osn|disney|prime ?video|apple ?(?:tv|music)|deezer|soundcloud|twitch|podcast|audible|kindle|wattpad|starzplay|tod\b|yango ?play|vlc|mx ?player/, "app"],
  ["game", /pubg|free ?fire|clash|roblox|candy ?crush|minecraft|fortnite|genshin|efootball|pes\b|fifa|fc ?mobile|ea ?sports|steam|playstation|xbox|nintendo|supercell|garena|mobile ?legends|call ?of ?duty|royal ?match|8 ?ball|ludo|chess\.com|lichess|subway ?surfers/, "app"],
  ["system", /^android$|android ?system|com\.android\.(?!phone|mms|contacts|dialer)|systemui|settings|google ?play ?(?:store|services)|com\.android\.vending|gms\b|samsung ?(?:members|account|cloud)|one ?ui|miui|coloros|huawei ?(?:mobile ?services|appgallery)|software ?update|battery|device ?care|digital ?wellbeing|files ?by ?google|google ?photos|gallery|backup|google ?drive|onedrive|dropbox|icloud/, "app"],
  ["smart_home", /smartthings|google ?home|alexa|mi ?home|xiaomi ?home|tuya|smart ?life|ring\b|ezviz|imou|hikvision|tapo|philips ?hue|nest\b|arlo|eufy|wyze/, "app"],
  ["weather", /weather|accuweather|طقس|meteo|windy/, "app"],
  ["sports", /kooora|yallakora|fotmob|sofascore|livescore|espn|onefootball|bein|365 ?scores|flashscore|forza ?football|nba\b|premier ?league|la ?liga/, "app"],
  ["markets", /binance|bybit|okx|coinbase|kraken|tradingview|thndr|investing\.com|\bstocks\b|yahoo ?finance|robinhood|etoro|plus500|webull|derayah|\begx\b|gold ?price|اسعار الذهب|البورصة/, "app"],
  ["job", /wuzzuf|bayt|indeed|forasna|naukri|glassdoor|jobs?\b|recruit|hiring|كارير|وظائف/, "company"],
  ["marketplace", /olx|dubizzle|opensooq|haraj|aqarmap|property ?finder|bayut|hatla2ee|contactcars|facebook ?marketplace|sahibinden|letgo|carousell|kijiji|craigslist/, "app"],
  ["charity", /بنك الطعام|food ?bank|57357|resala|رسالة للأعمال|misr ?el ?kheir|مصر الخير|unicef|red ?crescent|الهلال الأحمر|charity|donat/, "company"],
  ["news", /news|cnn|bbc|aljazeera|al ?jazeera|youm7|masrawy|reuters|sky ?news|\bnyt\b|guardian|alarabiya|العربية|اليوم السابع|مصراوي|الشروق|المصري اليوم|cairo24|elwatan|ahram|الأهرام|euronews|france ?24|bloomberg|cnbc|google ?news|flipboard|squid|inshorts/, "app"],
  ["email", /com\.google\.android\.gm\b|gmail|outlook|yahoo\.mobile\.client\.android\.mail|proton\.?mail|samsung\.android\.email|\bmail\b|spark|bluemail|edison/, "unknown"],
  ["bill", /my ?vodafone|ana ?vodafone|my ?orange|my ?etisalat|my ?we\b|\bwe\b|telecom ?egypt|stc\b|\bdu\b|zain|mobily|\bjio\b|airtel|electric|كهرباء|\bwater\b|مياه|natural ?gas|بتروتريد|town ?gas|internet|dewa|sewa|addc|kahramaa/, "company"],
];
const SMS_APP = /messag|\bsms\b|mms|com\.android\.mms|samsung\.android\.messaging|google\.android\.apps\.messaging|رسائل/;
const MAIL_APP = /com\.google\.android\.gm\b|gmail|outlook|yahoo\.mobile\.client\.android\.mail|proton\.?mail|samsung\.android\.email|\bmail\b|spark|bluemail|edison/;
const CHAT_APP = /whatsapp|telegram|messenger|com\.facebook\.orca|org\.signal|securesms|viber|\bimo\b|botim|wechat|tencent\.mm|naver\.line|kakao|zalo/;
const PHONE_NO = /^\s*(?:\+|00)?\d[\d\s-]{6,}\d\s*$/;

/** Where it comes from → { cat, type, name } from the app, or for an SMS / an email from the sender. */
export function sourceKind(n) {
  const pkg = fold(n && n.pkg), app = fold(n && n.app), title = String((n && n.title) || "").trim();
  const viaSender = SMS_APP.test(pkg + " " + app) || MAIL_APP.test(pkg + " " + app);
  const sender = viaSender ? fold(title.split(/[:\-–|]/)[0]) : "";
  const look = (s) => { for (const [cat, rx, type] of APPCAT) if (cat !== "email" && rx.test(s)) return { cat, type }; return null; };
  if (CHAT_APP.test(pkg + " " + app)) { const grp = /^[^:]{1,60}:\s/.test(title) || /\(\d+\s*(?:messages|رسائل|رسالة)\)/.test(title) || /group|جروب|مجموعة|جماعة/i.test(title);
    return { cat: "chat", type: grp ? "group" : "person", name: (grp ? title.split(":")[0] : title).replace(/\s*\(\d+.*\)\s*$/, "").trim(), via: "app" }; }
  if (viaSender) {
    if (!sender || PHONE_NO.test(title)) return { cat: SMS_APP.test(pkg + " " + app) ? "chat" : "email", type: "person", name: title, via: "sender" };
    const s = look(sender); if (s) return { ...s, name: title.split(/[:\-–|]/)[0].trim(), via: "sender" };
    // an SMS sender written as a short name ("VF-Cash", "CIB", "Fawry") is a company; an email's sender is a company unless it reads like a person
    if (SMS_APP.test(pkg + " " + app)) return { cat: "", type: /^[A-Z0-9 .&_-]{2,15}$/.test(title) ? "company" : "unknown", name: title, via: "sender" };
    return { cat: "email", type: /^[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}$/.test(title) ? "person" : "company", name: title, via: "sender" };
  }
  const s = look(pkg + " " + app); if (s) return { ...s, name: String((n && n.app) || "").trim(), via: "app" };
  return { cat: "", type: "app", name: String((n && n.app) || "").trim(), via: "app" };
}

// ---- 2. what the text says, in nine languages (English, Egyptian + Modern Standard Arabic, French, Spanish, German, Portuguese,
//         Italian, Turkish, Indonesian); the model reads the other eleven and anything the lists miss -----------------------------
const W = {
  request: words(["law sam7t", "lw sm7t", "law samaht", "eb3at", "eb3atli", "eb3atly", "eb3atlo", "hatli", "hatly", "kalemni", "kalemny", "matensash", "matnsash", "momken t", "ya rait", "yarait", "3ayzak", "3ayzek", "kindly", "would you mind", "plz", "can u", "could u", "merci de", "veuillez", "por favor", "bitte", "lütfen", "mohon", "please send", "send me", "can you send", "could you send", "please bring", "bring me", "can you", "could you", "please call", "call me", "pls", "please", "don't forget", "dont forget", "remember to", "make sure", "need you to", "i need", "pick me up", "pick up",
    "ابعتلي", "ابعت", "هاتلي", "هات", "كلمني", "اتصل بي", "اتصل", "متنساش", "ما تنساش", "لو سمحت", "من فضلك", "ممكن", "عايزك", "محتاجك", "محتاج", "يا ريت", "ياريت", "خلي بالك", "رجاء", "الرجاء", "يرجى", "نرجو", "برجاء", "أرسل", "ارسل", "أرسلي", "حول لي", "حولي",
    "s'il te plaît", "s'il vous plaît", "envoie-moi", "envoyez", "peux-tu", "pouvez-vous", "n'oublie pas", "por favor", "envíame", "mándame", "puedes", "podrías", "no olvides", "bitte", "schick mir", "kannst du", "könntest du", "vergiss nicht",
    "por favor", "manda", "envia", "pode", "não esqueça", "per favore", "mandami", "puoi", "non dimenticare", "lütfen", "gönder", "gönderir misin", "unutma", "tolong", "kirimkan", "kirim", "bisa", "jangan lupa", "mohon"]),
  ask: /(?<![\p{L}])(?:\p{L}+(?:ir|ır|ur|ür|er|ar) m[iıuü]s[iıuü]n|ring me|give me a call|me liga|liga pra mim|ruf mich an|rappelle-moi|llámame|chiamami|beni ara|telepon aku|can you|could you|would you|will you please|was assigned to you|assigned you|هل يمكنك|هل تستطيع|ممكن ت\p{L}+|تقدر ت\p{L}+|peux-tu|pouvez-vous|tu peux|puedes|podrías|podrias|kannst du|könntest du|können sie|könnten sie|você pode|pode me|podes|puoi|potresti|può|\p{L}+(?:ebilir|abilir) mis[iı]n|\p{L}+(?:ebilir|abilir) misiniz|bisa tolong|bisa|tolong)(?![\p{L}])/iu,
  question: /\?|؟|(?<![\p{L}])(?:fein|feen|fen|emta|imta|leh|ezay|ezzay|kam|meen|mein|هل|ايه|إيه|امتى|إمتى|فين|ليه|ازاي|إزاي|كام|مين|متى|أين|لماذا|كيف|what|when|where|why|how|who|which|are you|did you|do you|have you|will you|quand|où|pourquoi|comment|est-ce que|cuándo|dónde|por qué|cómo|qué|wann|wo|warum|wie|was|quando|onde|porque|como|perché|dove|ne zaman|nerede|neden|nasıl|kapan|dimana|di mana|kenapa|bagaimana|apa)(?![\p{L}])/iu,
  invite: words(["invités", "invitées", "davetlisiniz", "davetlisin", "convidados", "invitati", "تعالوا", "تعالو", "اتغدوا", "اتعشوا", "نتغدى", "نتعشى", "عازمكم", "عازمك", "عازمينكم", "مستنيينكم", "مستنياكم", "you're invited", "you are invited", "invitation", "invite you", "join us", "join me", "would you like to come", "rsvp", "party", "wedding", "birthday party", "dinner at", "lunch at", "meet up", "let's meet", "lets meet", "accepted your invitation",
    "معزوم", "معزومين", "عزومة", "عزومه", "دعوة", "دعوه", "تعالى", "تعالي", "تيجي", "هتيجي", "فرح", "خطوبة", "حفلة", "حفله", "نتقابل", "يلا نخرج", "ندعوكم", "يسعدنا دعوتكم", "تشرفنا",
    "invitation", "invité", "venez", "rejoins-nous", "invitación", "invitado", "ven a", "einladung", "eingeladen", "komm", "convite", "convidado", "invito", "invitato", "vieni", "davet", "davetlisin", "gel", "undangan", "diundang", "datang"]),
  reminder: words(["reminder", "don't forget", "dont forget", "remember", "is tomorrow", "is today", "starts in", "starting in", "in 30 minutes", "in 15 minutes", "in 1 hour", "due today", "due tomorrow", "coming up", "upcoming", "last day", "deadline", "expires", "expiring", "will expire", "ends soon",
    "تذكير", "تذكرة", "متنساش", "ما تنساش", "بكرة", "غدا", "النهارده", "اليوم", "آخر يوم", "اخر يوم", "آخر ميعاد", "اخر ميعاد", "هتنتهي", "سينتهي", "تنتهي", "باقي", "بعد ساعة", "بعد نص ساعة",
    "rappel", "n'oubliez pas", "recordatorio", "no olvides", "erinnerung", "nicht vergessen", "lembrete", "promemoria", "hatırlatma", "hatırlatıcı", "pengingat", "jangan lupa"]),
  confirm: words(["confermata", "confermato", "confirmada", "bestätigt", "onaylandı", "renewed", "has been renewed", "تم تجديد", "renouvelé", "renovada", "renovado", "verlängert", "rinnovato", "yenilendi", "diperpanjang", "confirmed", "is confirmed", "has been confirmed", "booked", "successful", "successfully", "completed", "approved", "accepted", "received", "has been received", "we received", "thank you for your order", "order placed", "registered", "you're all set", "all set", "done",
    "تم تأكيد", "تم التأكيد", "تم الحجز", "تم بنجاح", "بنجاح", "تمت", "تم استلام", "تم الاستلام", "تمت الموافقة", "تم قبول", "تم التسجيل", "تم الدفع", "تم السداد", "اتأكد", "اتحجز", "خلاص",
    "confirmé", "confirmée", "réservé", "réussi", "confirmado", "confirmada", "reservado", "bestätigt", "gebucht", "erfolgreich", "confermato", "prenotato", "onaylandı", "başarılı", "dikonfirmasi", "berhasil"]),
  change: words(["reportée", "reprogramada", "verlegt", "spostata", "ritardo", "in ritardo", "nuovo orario", "nouvel horaire", "nueva hora", "neue zeit", "novo horário", "yeni saat", "jam baru", "changed", "has changed", "rescheduled", "moved to", "new time", "new date", "updated", "delayed", "postponed", "gate changed", "schedule change", "now at", "instead of",
    "تغيير", "تم تغيير", "اتغير", "اتغيّر", "تأجيل", "اتأجل", "تأخير", "متأخر", "الموعد الجديد", "بدل", "بدلاً من", "تعديل", "تم تعديل",
    "modifié", "reporté", "retardé", "cambiado", "reprogramado", "retrasado", "geändert", "verschoben", "verspätet", "alterado", "adiado", "spostato", "rinviato", "değişti", "ertelendi", "rötar", "diubah", "ditunda"]),
  cancel: words(["annullata", "annullato", "annulée", "cancelada", "cancelado", "cancelled", "canceled", "cancellation", "has been cancelled", "called off", "won't happen", "no longer", "refunded",
    "تم إلغاء", "تم الغاء", "إلغاء", "الغاء", "اتلغى", "اتلغت", "ملغي", "ملغى", "مش هيحصل",
    "annulé", "annulée", "cancelado", "cancelada", "storniert", "abgesagt", "annullato", "iptal", "dibatalkan"]),
  alert: words(["is closed", "closed tomorrow", "closed today", "closed due to", "no school", "classes suspended", "someone is trying", "approve sign-in", "trying to sign in", "مغلقة", "تعطيل الدراسة", "battery low", "running low", "someone is at", "motion detected", "door opened", "door is open", "smoke", "water leak", "alarm", "intruder", "فيه حد عند", "الباب مفتوح", "البطارية ضعيفة", "declined", "rejected", "تم رفض", "رفض", "اترفض", "refusée", "refusé", "rechazada", "rechazado", "abgelehnt", "recusado", "recusada", "rifiutata", "rifiutato", "reddedildi", "ditolak", "alert", "warning", "urgent", "important", "suspicious", "unusual", "security alert", "new sign-in", "new login", "someone tried", "password changed", "low balance", "low battery", "emergency", "failed", "declined", "overdue", "late", "final notice", "action required", "immediately", "asap",
    "تنبيه", "تحذير", "عاجل", "ضروري", "مهم", "هام", "حالا", "حالاً", "فورا", "فوراً", "طوارئ", "الحقني", "الحقوني", "تسجيل دخول", "محاولة", "فشل", "مرفوض", "متأخرات", "إنذار", "انذار",
    "alerte", "urgent", "avertissement", "alerta", "urgente", "aviso", "warnung", "dringend", "achtung", "avviso", "uyarı", "acil", "peringatan", "darurat", "penting"]),
  offer: /(?<![\p{L}])(?:\d+\s*%\s*(?:off|discount|خصم)|off\b|sale|discount|deal|deals|offer|offers|promo|promocode|coupon|cashback|limited time|free shipping|buy 1|save up to|for only|starting from|just for you|عرض|عروض|خصم\s*\d|تخفيض|تخفيضات|كوبون|كاش باك|اشتري|وفر|لفترة محدودة|promotion|soldes|réduction|oferta|descuento|rebaja|angebot|rabatt|desconto|promoção|offerta|sconto|indirim|kampanya|fırsat|diskon|promo|potongan)(?![\p{L}])/iu,
  greeting: words(["عيد ميلاد سعيد", "سنة سعيدة", "good morning", "good night", "good evening", "happy birthday", "happy new year", "eid mubarak", "ramadan kareem", "congratulations", "congrats", "miss you", "love you", "how are you", "thank you", "thanks", "hi", "hello", "hey",
    "صباح الخير", "مساء الخير", "تصبح على خير", "كل سنة وانت طيب", "كل سنه وانت طيب", "عيد سعيد", "عيد مبارك", "رمضان كريم", "مبروك", "الف مبروك", "وحشتني", "بحبك", "عامل ايه", "عاملة ايه", "ازيك", "شكرا", "شكراً", "تسلم", "ربنا يخليك", "السلام عليكم", "اهلا", "أهلا",
    "bonjour", "bonsoir", "joyeux anniversaire", "merci", "buenos días", "buenas noches", "feliz cumpleaños", "gracias", "guten morgen", "gute nacht", "alles gute", "danke", "bom dia", "boa noite", "parabéns", "obrigado", "buongiorno", "buonanotte", "auguri", "grazie", "günaydın", "iyi geceler", "doğum günün kutlu olsun", "teşekkürler", "selamat pagi", "selamat malam", "selamat ulang tahun", "terima kasih"]),
};
// what the words ask of you
const ACT = {
  pay: words(["pay", "payment due", "due", "amount due", "please pay", "pay now", "pay before", "outstanding", "balance due", "installment", "invoice", "bill", "fees", "fine", "ادفع", "سدد", "سداد", "مستحق", "مستحقة", "فاتورة", "فاتوره", "قسط", "مصاريف", "رسوم", "غرامة", "مخالفة", "حول", "حوّل", "payer", "pagar", "zahlen", "pagare", "öde", "bayar"]),
  attend: words(["visit", "your visit", "زيارة", "meeting", "appointment", "interview", "exam", "class", "lecture", "session", "webinar", "event", "starts", "starts in", "ميعاد", "معاد", "موعد", "اجتماع", "مقابلة", "امتحان", "حصة", "محاضرة", "كشف", "réunion", "rendez-vous", "reunión", "cita", "termin", "besprechung", "reunião", "riunione", "appuntamento", "toplantı", "randevu", "rapat", "janji"]),
  pickup: words(["at your address", "receive your order", "at your door", "استلم طلبك", "خرج للتوصيل", "في الطريق اليك", "ready for pickup", "ready for pick-up", "ready to collect", "pick up", "collect your", "waiting for you", "arrived at", "out for delivery", "driver has arrived", "your driver", "at the door", "جاهز للاستلام", "استلم", "تعالى خد", "المندوب", "المندوب وصل", "وصل", "تحت البيت", "على الباب", "prêt à retirer", "listo para recoger", "abholbereit", "pronto para retirada", "teslim almaya hazır", "siap diambil"]),
  call_back: words(["ring me", "ring me back", "give me a call", "phone me", "call me back", "missed call", "call me", "call me back", "call back", "please call", "كلمني", "اتصل بي", "اتصل بيا", "رن عليا", "مكالمة فائتة", "مكالمه فائته", "rappelle-moi", "llámame", "ruf mich an", "me liga", "chiamami", "beni ara", "telepon aku"]),
  verify: words(["verify", "confirm it's you", "was this you", "is this you", "review the activity", "check activity", "secure your account", "تحقق", "أكد هويتك", "هل هذا أنت", "هل أنت", "vérifiez", "verifica", "bestätige", "verifique", "doğrula", "verifikasi"]),
  renew: words(["renew", "renewal", "expires", "expiring", "will expire", "has expired", "expired", "تجديد", "جدد", "هتنتهي", "سينتهي", "انتهت", "منتهي", "renouveler", "renovar", "erneuern", "rinnovare", "yenile", "perpanjang"]),
  update_payment: /couldn'?t (?:charge|process|renew)|could not (?:charge|process)|payment (?:failed|declined|method)|update (?:your )?(?:payment|card|billing)|card (?:was )?declined|فشل (?:الدفع|التجديد)|تحديث (?:طريقة|بيانات) الدفع|حدث (?:بيانات )?الكارت/i,
  submit: words(["submit", "upload", "fill in", "fill out", "complete your", "send your documents", "missing documents", "required documents", "assignment", "homework", "due by", "قدم", "ارفع", "املأ", "استكمل", "المستندات", "الأوراق", "الورق", "الواجب", "واجب", "soumettre", "devoir", "enviar documentos", "tarea", "einreichen", "hausaufgabe", "enviar", "tarefa", "compito", "ödev", "tugas", "unggah"]),
  travel: words(["check-in is open", "online check-in", "boarding", "gate", "departure", "your flight", "flight", "رحلتك", "الرحلة", "بوابة", "الصعود", "الإقلاع", "vol", "embarquement", "vuelo", "embarque", "flug", "boarding", "voo", "volo", "uçuş", "biniş", "penerbangan"]),
  reply: words(["reply", "let me know", "tell me", "answer", "waiting for your reply", "what do you think", "your opinion", "رد", "ردي", "رد عليا", "قولي", "قوللي", "عرفني", "بلغني", "رأيك", "réponds", "dis-moi", "responde", "dime", "antworte", "sag mir", "responda", "rispondi", "dimmi", "cevap ver", "söyle", "balas", "kabari"]),
};
const INVITE_STRONG = words(["invited", "invite you", "invitation", "join us", "you're invited", "you are invited", "rsvp", "معزوم", "معزومين", "مدعو", "مدعوين", "عزومة", "دعوة", "ندعوكم", "تعالوا", "invité", "invités", "invitation", "invitado", "invitados", "invitación", "einladung", "eingeladen", "convite", "convidado", "invito", "invitati", "davet", "davetlisiniz", "undangan", "diundang"]);
const DO_W = words(["eb3at", "eb3atli", "eb3atly", "hat", "hatli", "eshtery", "grab", "fetch", "collect", "drop off", "sign", "make", "alır", "getirir", "gönderir", "belikan", "belikan", "send", "bring", "buy", "get", "transfer", "pick", "take", "fix", "book", "order", "print", "ابعت", "ابعتلي", "هات", "هاتلي", "اشتري", "اشتريلي", "جيب", "حول", "حوّل", "خد", "احجز", "اطلب", "اطبع", "صلح", "أرسل", "ارسل", "envoie", "apporte", "achète", "manda", "envía", "trae", "compra", "schick", "bring", "kauf", "envia", "traz", "manda", "porta", "compra", "gönder", "getir", "al", "kirim", "bawa", "beli"]);
const RENEW_DUE = words(["expira", "expirará", "caduca", "expire", "expirera", "آخر موعد", "اخر موعد", "expires", "expiring", "will expire", "is due", "due", "تنتهي", "هتنتهي", "ستنتهي", "سينتهي", "مستحقة", "مستحق", "آخر ميعاد", "expire", "vence", "läuft ab", "fällig", "scade", "doluyor", "son ödeme", "berakhir", "jatuh tempo", "à payer", "à rendre", "entrega", "consegna", "teslim"]);
const CONFIRM_STRONG = words(["is confirmed", "has been confirmed", "confirmed for", "تم تأكيد", "تم التأكيد", "est confirmé", "est confirmée", "está confirmada", "está confirmado", "ist bestätigt", "está confirmada", "è confermato", "onaylandı", "dikonfirmasi"]);
const SUBMIT_START = /(?<![\p{L}])(?:upload|unggah|yükle|caric|soumet|einreich|subir|envoyer les|enviar documentos|ارفع|رفع|ترفع|يرجى رفع|قدم|املأ|استكمل)/u;
const IMPERATIVE = /(?:^|[.!,;:\n]\s*|\b(?:and|then|also|before you leave(?: today)?|when you get (?:home|here),?)\s+)(?:please\s+)?(?:print|send|bring|buy|get|grab|pick up|take|leave|call|book|order|pay|transfer|fix|prepare|check|review|finish|sign|email|forward|share|drop|collect)\s+(?:the|this|that|these|those|my|your|our|a|an|me|him|her|them|it|\d)/i;
// (pairs that go together and are not a doubt: "please confirm the reminder", "the meeting is changed — reminder")
const COMPATIBLE = [["request", "reminder"], ["confirm", "reminder"], ["change", "reminder"], ["cancel", "confirm"], ["request", "greeting"], ["invite", "greeting"], ["alert", "reminder"], ["change", "confirm"]];
const DO_START = /(?<![\p{L}])(?:envi|envoi|mand|manda|tra[eéz]|trag|porta|apport|enví|envía|relir|relire|alır|beli|grab|fetch|schick|bring|mitbring|gönder|getir|kirim|baw|bel[ií]|compr|achet|kauf|revis|relis|riv|prüf|controll|kontrol|cek|check|review|fix|prepar|share|update|send|buy|book|print|تراجع|تجيب|تبعت|تحول|تجهز|تشتري|تصلح|تحضر|ابعت|هات|اشتر|جيب|حضر|راجع|صلح|جهز|أرسل|ارسل|أحضر|احضر|مراجعة|إصلاح|اصلاح)/u;
const PAY_REQ = /(?<![\p{L}])(?:transfer|rent|pay|حول|حوّل|ادفع|سدد|الإيجار|الايجار|إيجار|ايجار|loyer|pagar|paga|alquiler|miete|zahl|aluguel|affitto|pagare|kira|öde|bayar|sewa|payer)/iu;
const RECEIPT_W = /receipt|you paid|payment (?:of [^.]{0,30})?(?:was |is )?(?:successful|confirmed|complete)|total charged|paid online|تم الدفع بنجاح|تمت عملية الدفع|إيصال|paiement de [^.]{0,30} (?:a été )?confirmé|pago de [^.]{0,30} (?:se ha )?confirmado|zahlung von [^.]{0,30} war erfolgreich|pagamento de [^.]{0,30} foi confirmado|pagamento di [^.]{0,30} è confermato|ödemeniz başarılı|pembayaran [^.]{0,30} berhasil/i;
const SUB_W = /subscription|membership|اشتراك|abonnement|suscripción|suscripcion|\babo\b|assinatura|abbonamento|abonel|langganan/i;
const URGENT = words(["urgent", "asap", "immediately", "emergency", "right now", "now!", "final notice", "action required", "عاجل", "ضروري", "حالا", "حالاً", "فورا", "فوراً", "طوارئ", "الحقني", "الحقوني", "ضروري جدا", "urgence", "urgente", "dringend", "sofort", "acil", "hemen", "darurat", "segera"]);

// ---- 3. the details: money, when, the reference --------------------------------------------------------------------------------
const CUR = "egp|e£|le|l\\.e\\.?|usd|us\\$|\\$|sar|aed|qar|kwd|bhd|omr|jod|eur|€|£|gbp|try|tl|ytl|₺|inr|₹|rs\\.?|idr|rp|pkr|myr|rm|jpy|¥|cny|krw|₩|ngn|₦|kes|ksh|mad|dh|dhs|tnd|lbp|iqd|جنيه|جنيها|ج\\.م\\.?|جم|ريال|ر\\.س|درهم|د\\.إ|دينار|د\\.ك|ليرة|روبية";
const MONEY_RX = new RegExp("(?<![\\p{L}])(" + CUR + ")\\s*([\\d][\\d,]*(?:\\.\\d+)?)|([\\d][\\d,]*(?:\\.\\d+)?)\\s*(" + CUR + ")(?![\\p{L}])", "iu");
const CURNAME = { "e£": "EGP", le: "EGP", "l.e": "EGP", "l.e.": "EGP", "جنيه": "EGP", "جنيها": "EGP", "ج.م": "EGP", "ج.م.": "EGP", "جم": "EGP", "$": "USD", "us$": "USD", "€": "EUR", "£": "GBP", "ريال": "SAR", "ر.س": "SAR", "درهم": "AED", "د.إ": "AED", "د.ك": "KWD", "₺": "TRY", tl: "TRY", ytl: "TRY", "₹": "INR", "rs": "INR", "rs.": "INR", "rp": "IDR", "rm": "MYR", "¥": "JPY", "₩": "KRW", "₦": "NGN", "ksh": "KES", "dh": "MAD", "dhs": "AED" };
export function amountIn(text) {
  const t = latin(text).replace(/[\u200e\u200f\u061c\u202a-\u202e]/g, ""), m = MONEY_RX.exec(t); if (!m) return null;
  const c = (m[1] || m[4] || "").toLowerCase(), v = parseFloat(String(m[2] || m[3]).replace(/,/g, "")); if (!(v > 0)) return null;
  return { value: v, cur: CURNAME[c] || c.toUpperCase().replace(/\.$/, "") };
}
const MON = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  "يناير": 0, "فبراير": 1, "مارس": 2, "ابريل": 3, "مايو": 4, "يونيو": 5, "يوليو": 6, "اغسطس": 7, "سبتمبر": 8, "اكتوبر": 9, "نوفمبر": 10, "ديسمبر": 11,
  janvier: 0, "février": 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, "août": 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, "décembre": 11, decembre: 11,
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  januar: 0, februar: 1, "märz": 2, maerz: 2, juni: 5, juli: 6, oktober: 9, dezember: 11, janeiro: 0, fevereiro: 1, "março": 2, maio: 4, junho: 5, julho: 6, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
  gennaio: 0, febbraio: 1, aprile: 3, maggio: 4, giugno: 5, luglio: 6, settembre: 8, ottobre: 9, dicembre: 11, ocak: 0, "şubat": 1, subat: 1, mart: 2, nisan: 3, "mayıs": 4, mayis: 4, haziran: 5, temmuz: 6, "ağustos": 7, agustos: 7, "eylül": 8, eylul: 8, ekim: 9, "kasım": 10, kasim: 10, "aralık": 11, aralik: 11,
  januari: 0, februari: 1, maret: 2, mei: 4, agustus: 7, desember: 11 };
const DAYW = [[0, ["sunday", "الاحد", "الحد", "dimanche", "domingo", "sonntag", "domenica", "pazar", "minggu"]], [1, ["monday", "الاثنين", "الاتنين", "lundi", "lunes", "montag", "segunda", "lunedì", "lunedi", "pazartesi", "senin"]],
  [2, ["tuesday", "tue", "tues", "الثلاثاء", "التلات", "mardi", "martes", "dienstag", "terça", "terca", "martedì", "martedi", "salı", "sali", "selasa"]], [3, ["wednesday", "wed", "الاربعاء", "الاربع", "mercredi", "miércoles", "miercoles", "mittwoch", "quarta", "mercoledì", "mercoledi", "çarşamba", "carsamba", "rabu"]],
  [4, ["thursday", "thu", "thur", "thurs", "الخميس", "jeudi", "jueves", "donnerstag", "quinta", "giovedì", "giovedi", "perşembe", "persembe", "kamis"]], [5, ["friday", "fri", "الجمعة", "الجمعه", "vendredi", "viernes", "freitag", "sexta", "venerdì", "venerdi", "cuma", "jumat"]],
  [6, ["saturday", "السبت", "samedi", "sábado", "sabado", "samstag", "sabato", "cumartesi", "sabtu"]]];
const TODAY = words(["enaharda", "ennaharda", "el naharda", "today", "tonight", "this evening", "this morning", "النهارده", "النهاردة", "انهارده", "اليوم", "الليلة", "الليله", "aujourd'hui", "ce soir", "hoy", "esta noche", "heute", "heute abend", "hoje", "esta noite", "oggi", "stasera", "bugün", "bu akşam", "hari ini", "malam ini"]);
const TOMORROW = words(["bokra", "bukra", "bokrah", "tomorrow", "بكرة", "بكره", "غدا", "غداً", "غدًا", "demain", "mañana", "morgen", "amanhã", "amanha", "domani", "yarın", "yarin", "besok"]);
const IN_MIN = /(?:in|within|خلال|بعد|dans|en|en|in|em|tra|içinde|dalam)\s*(\d{1,3})\s*(min(?:ute)?s?|دقيقة|دقايق|دقائق|hours?|ساعة|ساعات|heures?|horas?|stunden?|ore|saat|jam)/iu;
/** By when: { date, time } from "tomorrow at 6 pm", «يوم الخميس الساعة ٨», "15 Nov", "15/11", "in 30 minutes" — else null. */
export function whenIn(text, now = Date.now()) {
  const t = fold(text), base = new Date(now); let d = null, time = "";
  const im = IN_MIN.exec(t); if (im) { const x = new Date(now + (+im[1]) * (/^(?:h|ساع|heu|hor|stu|ore|saat|jam)/.test(im[2]) ? 36e5 : 6e4)); return { date: isoOf(x), time: pad(x.getHours()) + ":" + pad(x.getMinutes()) }; }
  if (TOMORROW.test(t)) { d = new Date(base); d.setDate(d.getDate() + 1); } else if (TODAY.test(t)) d = new Date(base);
  if (!d) { const names = Object.keys(MON).sort((a, b) => b.length - a.length).map((x) => x.replace(/\./g, "\\.")).join("|");
    const a = new RegExp("(?<![\\d])(\\d{1,2})(?:st|nd|rd|th|er|º)?\\s*(?:de\\s+|of\\s+)?(" + names + ")\\.?(?:\\s*,?\\s*(\\d{4}))?(?![\\p{L}])", "iu").exec(t)
      || (() => { const b = new RegExp("(?<![\\p{L}])(" + names + ")\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?(?![\\d])", "iu").exec(t); return b ? [b[0], b[2], b[1], b[3]] : null; })();
    if (a) { const day = +a[1], mo = MON[a[2].toLowerCase()]; if (mo != null && day >= 1 && day <= 31) { d = new Date(a[3] ? +a[3] : base.getFullYear(), mo, day); if (!a[3] && d.getTime() < now - 864e5 * 60) d.setFullYear(d.getFullYear() + 1); } } }
  if (!d) { const n = /(?<![\d/.])(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?![\d/.])/.exec(t.replace(/\d{1,2}:\d{2}/g, " "));
    if (n && +n[2] >= 1 && +n[2] <= 12 && +n[1] >= 1 && +n[1] <= 31) { const y = n[3] ? (+n[3] < 100 ? 2000 + +n[3] : +n[3]) : base.getFullYear(); d = new Date(y, +n[2] - 1, +n[1]); if (!n[3] && d.getTime() < now - 864e5 * 60) d.setFullYear(y + 1); } }
  if (!d) for (const [wd, list] of DAYW) { if (words(list).test(t)) { d = new Date(base); d.setDate(d.getDate() + ((wd - d.getDay() + 7) % 7 || 7)); break; } }
  const tm = /(?<![\d.,])([01]?\d|2[0-3])[:.]([0-5]\d)(?![\d])\s*(am|pm|a\.m\.|p\.m\.|ص|م|صباحا|مساء|مساءً|الصبح|بالليل)?/iu.exec(t)
    || /(?:at|الساعة|الساعه|الساعة|à|a las|um|às|alle|saat|jam|pukul)\s*(\d{1,2})(?![\d:])\s*(am|pm|ص|م|صباحا|مساء|الصبح|بالليل|h|uhr)?/iu.exec(t)
    || /(?<![\d])(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)(?![\p{L}])/iu.exec(t);
  if (tm) { let h = +tm[1]; const mi = tm[2] && /^\d+$/.test(tm[2]) ? +tm[2] : 0, ap = String((/^\d+$/.test(tm[2] || "") ? tm[3] : tm[2]) || "").toLowerCase();
    if (/^(pm|p\.m\.|م|مساء|مساءً|بالليل)$/.test(ap) && h < 12) h += 12; if (/^(am|a\.m\.|ص|صباحا|الصبح)$/.test(ap) && h === 12) h = 0;
    if (!ap && h >= 1 && h <= 6 && /الساعة|الساعه/.test(t) && !/الصبح|صباح/.test(t)) h += 12;   // «الساعة ٥» in a chat means 5 pm
    if (h <= 23 && mi <= 59) time = pad(h) + ":" + pad(mi); }
  if (!d && time) d = new Date(base);
  return d ? { date: isoOf(d), time } : null;
}
const REF = /(?:order|booking|reservation|confirmation|ticket|case|reference|ref|tracking|pnr|invoice|request|application|رقم الطلب|رقم الحجز|رقم الشكوى|رقم الفاتورة|رقم التتبع|كود|رقم الطلب|commande|pedido|reserva|bestellung|buchung|ordine|sipariş|pesanan)\s*(?:no\.?|number|#|n[°º]|nr\.?|:|رقم)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,19})/iu;

// ---- 4. putting it together -----------------------------------------------------------------------------------------------------
const KIND2CAT = { delivery: "delivery", bank: "bank", call: "call", ride: "ride", flight: "travel", appointment: "appointment", bill: "bill", security: "security", promo: "promo", news: "news" };
const CAT_ACTION = { bill: "pay", appointment: "attend", calendar: "attend", security: "verify", code: "none", promo: "none", news: "read", social: "none", media: "none", game: "none", system: "none", weather: "none", sports: "none", markets: "none" };
/** Code's reading of one notification (see the top of the file). opts.now — the moment it arrived (for "tomorrow"). */
export function comprehend(n, { now } = {}) {
  if (!n) return null;
  const at = now || n.ts || Date.now();
  const title = String(n.title || ""), text = String(n.text || ""), all = (title + " \n " + text).trim(), t = fold(all);
  const src = sourceKind(n), mean = (() => { try { return meaningOf(n) || {}; } catch (e) { return {}; } })(), why = notAPayment(all, n);
  let cat = src.cat, intent = "", action = "none", sure = true, urgency = "normal";
  // what it is: the code words first, then the app, then what the reader of meanings found
  if (src.cat === "chat" && /(?<![\p{L}])(?:news|channel|قناة|قناه|أخبار|اخبار|عاجل|breaking|actualités|noticias|nachrichten|notizie|haber|berita)(?![\p{L}])/iu.test(title)) cat = "news";
  if (CODE_W.test(all)) cat = "code";
  else if (isScam(all)) { cat = src.cat === "chat" ? "chat" : "promo"; intent = "alert"; }
  else if (src.cat === "email" || src.cat === "" || (src.cat === "chat" && src.via === "sender")) { const k = KIND2CAT[mean.kind]; if (k) cat = k; else if (src.cat === "") cat = mean.kind === "message" ? "chat" : mean.kind === "email" ? "email" : "other"; }
  if (cat === "bank" && /receipt|you paid|thank you for your (?:order|purchase)|order (?:confirmed|placed)|payment (?:of [^.]{0,30})?(?:was )?successful|total charged|paid online|إيصال|تم الدفع بنجاح/i.test(all) && !SMS_APP.test(fold(n.pkg + " " + n.app)) && src.cat !== "bank" && src.cat !== "wallet") cat = "receipt";
  if (cat === "email" && mean.kind === "bank") cat = /receipt|you paid|charged|successful/i.test(all) ? "receipt" : "bank";
  if (!/^(?:chat|call|bank|wallet|code)$/.test(cat) && RECEIPT_W.test(all) && amountIn(all) && !/subscription|اشتراك|abonnement|suscripción|abo\b|assinatura|abbonamento|abonelik|langganan|donat|تبرع|don de|donación|spende|doação|donazione|bağış|donasi/i.test(all)) cat = "receipt";
  if (!/^(?:chat|call|bank|wallet|code|charity)$/.test(cat) && SUB_W.test(all) && amountIn(all)) cat = "subscription";
  if (cat === "other" && /\b(order|package|parcel|shipment|delivery|courier)\b|طلبك|شحنتك|الشحنة|الطلب/i.test(all)) cat = "delivery";
  if (/^(?:system|other|email|social)$/.test(cat) && /new sign-?in|signed in|was this you|is this you|someone (?:tried|has your)|password (?:was )?changed|unusual activity|suspicious|security alert|login attempt|تسجيل دخول جديد|محاولة تسجيل|هل هذا أنت|تغيير كلمة المرور|نشاط غير معتاد/i.test(all)) cat = "security";
  if (cat === "health" && (mean.kind === "appointment" || ACT.attend.test(t))) cat = "appointment";
  if (/^(?:social|email|other)$/.test(cat) && /\b(?:interview|job offer|your application|recruiter|hiring)\b|مقابلة شغل|مقابلة عمل|عرض عمل|entretien|entrevista|vorstellungsgespräch|colloquio|mülakat|wawancara/i.test(all)) cat = "job";
  if (cat === "government" && /\b(?:bill|invoice)\b|فاتورة|فاتوره|facture|factura|rechnung|fatura|bolletta|tagihan/i.test(all) && amountIn(all)) cat = "bill";
  // why it was sent
  if (!intent) {
    if (cat === "code") intent = "info";
    else if (W.cancel.test(t)) intent = "cancel";
    else if (W.change.test(t) && !/^(?:promo|news)$/.test(cat)) intent = "change";
    else if (cat === "promo" || (W.offer.test(all) && !/^(?:chat|call|bank|wallet|receipt|markets|news|sports|weather)$/.test(cat) && !W.confirm.test(t))) { intent = "offer"; if (/^(?:other|email|delivery|food|ride|travel|marketplace|media|subscription|game)$/.test(cat)) cat = "promo"; }
    else if (W.alert.test(t) && /^(?:security|bank|wallet|system|smart_home|government|health|weather|chat|call|other|email|school|work)$/.test(cat)) intent = "alert";
    else if ((W.invite.test(t) || /(?<![\p{L}])عازم\p{L}*/u.test(t)) && !(W.question.test(all) && !INVITE_STRONG.test(t) && !/عازم/.test(t))) intent = "invite";
    else if (/^(?:government|bill|subscription|school)$/.test(cat) && RENEW_DUE.test(t)) intent = "reminder";
    else if (/^(?:appointment|calendar|bill|subscription|delivery|travel|food|ride|health)$/.test(cat) && W.reminder.test(t) && !CONFIRM_STRONG.test(t)) intent = "reminder";
    else if ((W.request.test(t) || W.ask.test(t) || (cat === "chat" && ACT.call_back.test(t))) && !/^(?:news|media|game|social|promo|weather|sports|markets)$/.test(cat)) intent = "request";
    else if (/^(?:chat|email|work)$/.test(cat) && (IMPERATIVE.test(all) || (W.reminder.test(t) && (ACT.pay.test(t) || PAY_REQ.test(t) || DO_START.test(t))))) intent = "request";
    else if (CONFIRM_STRONG.test(t)) intent = "confirm";
    else if (/^(?:news|weather|sports|markets|media|social|game|system)$/.test(cat)) intent = W.alert.test(t) && cat !== "news" ? "alert" : "info";
    else if (W.reminder.test(t) || /(?:due|starts|expires?|ينتهي|مستحق)/i.test(all) && whenIn(all, at)) intent = "reminder";
    else if (W.confirm.test(t)) intent = "confirm";
    else if (W.question.test(all) && /^(?:chat|email|work|school|other|marketplace|job)$/.test(cat)) intent = "question";
    else if (W.greeting.test(t) && /^(?:chat|email|other|social)$/.test(cat)) intent = "greeting";
    else if (cat === "call") intent = "alert";
    else intent = "info";
  }
  if (cat === "receipt" && intent === "info") intent = "confirm";
  if (/^(?:delivery|food|ride)$/.test(cat) && intent === "request") intent = "info";
  if (/^(?:system|media|game)$/.test(cat) && intent === "change") intent = "info";
  if (/^(?:bank|wallet)$/.test(cat) && (intent === "confirm" || intent === "request") && amountIn(all) && !W.cancel.test(t)) intent = "info";
  if (cat === "call" && /missed|فائت|لم يرد|manqué|perdida|verpasst|perdida|persa|cevapsız|tak terjawab/i.test(all)) intent = "alert";
  // what YOU have to do
  if (intent === "request") action = ACT.call_back.test(t) ? "call_back" : (ACT.pay.test(t) || PAY_REQ.test(t)) && !/^(?:work|school|government)$/.test(cat) ? "pay" : (ACT.submit.test(t) || SUBMIT_START.test(t)) && cat !== "chat" ? "submit" : ACT.pickup.test(t) ? "pickup" : DO_W.test(t) || DO_START.test(t) || /was assigned to you|assigned you/i.test(all) ? "do" : "reply";
  else if (intent === "question") action = "reply";
  else if (intent === "invite") action = "reply";
  else if (cat === "call" && intent === "alert") action = "call_back";
  else if (intent === "offer" || cat === "code" || intent === "greeting") action = intent === "greeting" && src.type === "person" ? "none" : "none";
  else if (ACT.update_payment.test(all) && !/^(?:bank|wallet)$/.test(cat)) { action = "update_payment"; if (intent === "info" || intent === "confirm") intent = "alert"; }
  else if (cat === "security" || (intent === "alert" && ACT.verify.test(t))) action = "verify";
  else if (/^(?:delivery|food)$/.test(cat) && ACT.pickup.test(t) && !/delivered|تم التوصيل|تم توصيل|اتسلم/i.test(all)) action = "pickup";
  else if (cat === "ride" && /arrived|has arrived|وصل|is here|en route|on the way/i.test(all)) action = "pickup";
  else if (cat === "travel" && ACT.travel.test(t) && /check-?in (?:is )?open|boarding|gate|الصعود|بوابة|online check/i.test(all)) action = "travel";
  else if ((cat === "bill" || intent === "reminder") && ACT.pay.test(t) && amountIn(all) && why !== "failed") action = "pay";
  else if (ACT.renew.test(t) && (RENEW_DUE.test(t) || /expir|ينتهي|تنتهي|هتنتهي|سينتهي|انتهت|renew/i.test(all)) && !/renewed|تم التجديد|تم تجديد/i.test(all)) action = "renew";
  else if ((ACT.submit.test(t) || SUBMIT_START.test(t)) && (cat === "school" || cat === "government" || cat === "work" || cat === "job")) action = "submit";
  else if ((ACT.attend.test(t) && /^(?:appointment|calendar|work|school|chat|email|job|health|government|other)$/.test(cat) || /^(?:appointment|calendar)$/.test(cat)) && (intent === "reminder" || intent === "confirm" || intent === "change" || cat === "appointment" || cat === "calendar")) action = intent === "cancel" ? "none" : "attend";
  else action = CAT_ACTION[cat] || "none";
  if (intent === "cancel") action = cat === "bank" || cat === "receipt" ? "check" : "none";
  if (intent === "alert" && /^(?:bank|wallet|smart_home)$/.test(cat) && action === "none") action = "check";
  // the details
  const amt = amountIn(all);
  const amount = amt ? { ...amt, dir: why === "price" || why === "offer" || intent === "offer" || cat === "markets" || cat === "marketplace" ? "price"
    : action === "pay" || why === "notyet" || cat === "bill" ? "due" : /credited|deposit|received|refund|استلمت|تم إيداع|تم ايداع|إيداع|ايداع|وصلك|اتحولك/i.test(all) && !/received your payment|we received|payment received/i.test(all) ? "in"
    : /debited|charged|paid|purchase|spent|withdraw|خصم|سحب|شراء|دفعت|تم الدفع|you sent|transferred to/i.test(all) || cat === "receipt" ? "out" : "price" } : null;
  const when = intent === "greeting" || cat === "news" ? null : whenIn(all, at);
  const ref = (REF.exec(latin(all)) || [])[1] || "";
  if (URGENT.test(t) || cat === "security" && intent === "alert" || action === "update_payment" || (when && when.date === isoOf(new Date(at)) && action !== "none")) urgency = "high";
  else if (/^(?:promo|news|social|media|game|sports|markets|weather|system)$/.test(cat) || intent === "greeting" || intent === "offer") urgency = "low";
  // how sure code is: the app or the sender says what it is AND a word says why — or it's a kind with only one reason to exist
  const strongCat = cat === "news" && src.cat === "chat" || cat === "security" || src.via === "app" && src.cat && src.cat !== "email" || src.via === "sender" && src.cat && src.cat !== "chat" && src.cat !== "email" || cat === "code" || /^(?:delivery|bank|call|ride|travel|appointment|bill|security|promo|news)$/.test(KIND2CAT[mean.kind] || "");
  const strongIntent = intent !== "info" || /^(?:news|media|game|system|weather|sports|markets|social|code|bank|wallet|receipt|delivery|ride|travel|health|smart_home)$/.test(cat);
  const fits = ["request", "invite", "reminder", "confirm", "change", "cancel", "alert", "greeting"].filter((k) => k === "request" ? W.request.test(t) || W.ask.test(t) || IMPERATIVE.test(all) : W[k].test(t));
  const clash = fits.length >= 2 && !COMPATIBLE.some(([a, b]) => fits.length === 2 && fits.includes(a) && fits.includes(b)) && /^(?:chat|email|work|school|other)$/.test(cat);
  sure = !!(strongCat && strongIntent) && !(cat === "chat" && intent === "info") && cat !== "other" && cat !== "email" && !clash && !(cat === "chat" && /[\u0400-\u04FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F]/.test(all));
  const fromType = cat === "news" ? "company" : cat === "bank" || cat === "wallet" ? (src.type === "person" ? "person" : "bank") : cat === "government" ? "gov" : cat === "school" && src.type !== "person" ? "school" : src.type;
  const who = src.type === "person" || src.type === "group" ? src.name : "";
  return { v: 1, id: String(n.id || ""), cat, intent, action, from: { name: src.name, type: fromType }, who, due: when, amount, ref, urgency,
    summary: summaryOf({ cat, intent, action, from: src.name, who, amount, when, text: text || title }), sure, by: "code" };
}

// a short line a person would say — code's version; the model writes a better one when it runs
const CAT_WORD = { chat: "Message", call: "Call", bank: "Bank", wallet: "Wallet", receipt: "Receipt", bill: "Bill", subscription: "Subscription", delivery: "Delivery", food: "Food order",
  ride: "Ride", travel: "Travel", appointment: "Appointment", health: "Health", work: "Work", school: "School", government: "Government", security: "Security", code: "Login code",
  promo: "Offer", news: "News", social: "Social", media: "Media", game: "Game", system: "Phone", smart_home: "Home device", weather: "Weather", sports: "Sports", markets: "Markets",
  job: "Job", marketplace: "Marketplace", charity: "Charity", email: "Email", calendar: "Calendar", other: "Notification" };
const ACT_WORD = { do: "do what's asked", reply: "reply", pay: "pay", attend: "be there", pickup: "pick it up", call_back: "call back", check: "check it", verify: "check it's you", renew: "renew",
  update_payment: "update the card", submit: "send what's asked", travel: "get ready to travel", read: "" };
function summaryOf({ cat, intent, action, from, amount, when, text }) {
  const bits = [CAT_WORD[cat] || "Notification", from ? "from " + from : ""].filter(Boolean).join(" ");
  const what = String(text || "").replace(/\s+/g, " ").trim().slice(0, 90);
  const todo = ACT_WORD[action] ? " — " + ACT_WORD[action] + (when ? " by " + when.date + (when.time ? " " + when.time : "") : "") : "";
  const amt = amount && amount.dir !== "price" ? " (" + amount.value.toLocaleString("en-US") + " " + amount.cur + ")" : "";
  return (bits + ": " + what + amt + todo).slice(0, 180);
}

// ---- 5. the model, for what code is not sure of -------------------------------------------------------------------------------
/** The messages for the on-device model: one notification → one line of JSON. */
export function mindPrompt(n, { lang = "en", now = Date.now() } = {}) {
  const day = new Date(now), d = isoOf(day) + " (" + ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.getDay()] + ")";
  return [{ role: "system", content: "You read ONE phone notification for the person who owns the phone and say what it means, the way a smart assistant would. Today is " + d + ".\n"
    + "Answer with ONE line of JSON and nothing else:\n"
    + "{\"cat\": one of " + JSON.stringify(CATS) + ",\n \"intent\": one of " + JSON.stringify(INTENTS) + ",\n \"action\": what the PERSON must do, one of " + JSON.stringify(ACTIONS) + ",\n"
    + " \"from_type\": one of " + JSON.stringify(FROM_TYPES) + ", \"who\": the person's name if a person wrote it, else \"\",\n"
    + " \"due\": \"YYYY-MM-DD\" or \"YYYY-MM-DD HH:MM\" if it gives a day / time, else \"\",\n \"amount\": the number of money in it or 0, \"cur\": its currency code or \"\", \"dir\": one of [\"in\",\"out\",\"due\",\"price\",\"\"],\n"
    + " \"urgency\": one of [\"high\",\"normal\",\"low\"], \"summary\": one short sentence in the language code \"" + lang + "\" saying what it is and what to do}\n"
    + "Rules: never invent a number, a date or a name that is not in the notification. An offer or a price is never money that moved. People chatting about money is not the person's money. A one-time code is cat \"code\"." },
    { role: "user", content: "App: " + String(n.app || n.pkg || "").slice(0, 60) + "\nTitle: " + String(n.title || "").slice(0, 120) + "\nText: " + String(n.text || "").replace(/\s+/g, " ").slice(0, 700) }];
}
// a day word in any of Attune's 20 languages: today / tomorrow, and every weekday name the phone's own date formatter knows
const DAYWORDS = ["today", "tomorrow", "tonight", "بكرة", "بكره", "غدا", "النهارده", "اليوم", "الليلة", "bokra", "aujourd'hui", "demain", "hoy", "mañana", "heute", "morgen", "hoje", "amanhã", "oggi", "domani", "bugün", "yarın", "hari ini", "besok",
  "сегодня", "завтра", "आज", "कल", "آج", "کل", "امروز", "فردا", "আজ", "আগামীকাল", "leo", "kesho", "วันนี้", "พรุ่งนี้", "hôm nay", "ngày mai", "今天", "明天", "今日", "明日", "오늘", "내일"];
const TODAY_ANY = ["today", "tonight", "النهارده", "اليوم", "الليلة", "aujourd'hui", "hoy", "heute", "hoje", "oggi", "bugün", "hari ini", "сегодня", "आज", "آج", "امروز", "আজ", "leo", "วันนี้", "hôm nay", "今天", "今日", "오늘"];
const TOMORROW_ANY = ["tomorrow", "بكرة", "بكره", "غدا", "bokra", "demain", "mañana", "morgen", "amanhã", "domani", "yarın", "besok", "завтра", "कल", "کل", "فردا", "আগামীকাল", "kesho", "พรุ่งนี้", "ngày mai", "明天", "明日", "내일"];
let WEEKDAY_ANY = null;
/** Does the date fit the day words in the text? "tomorrow" → tomorrow, "today" → today, a weekday name → that weekday within a week. */
function dayFits(text, date, now) {
  const t = String(text || "").toLowerCase(), base = new Date(now), d = new Date(date + "T12:00:00"), diff = Math.round((d - new Date(isoOf(base) + "T12:00:00")) / 864e5);
  if (TOMORROW_ANY.some((w) => t.includes(w))) return diff === 1;
  if (TODAY_ANY.some((w) => t.includes(w))) return diff === 0;
  if (!WEEKDAY_ANY) { WEEKDAY_ANY = [];
    for (const loc of ["en", "ar", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko"]) for (const style of ["long", "short"]) {
      try { const f = new Intl.DateTimeFormat(loc, { weekday: style, timeZone: "UTC" }); for (let k = 0; k < 7; k++) { const x = f.format(new Date(Date.UTC(2026, 10, 1 + k))).toLowerCase().replace(/[.,]$/, ""); if (x.length >= 3) WEEKDAY_ANY.push([x, k]); } } catch (e) {} }
    WEEKDAY_ANY.sort((a, b) => b[0].length - a[0].length); }
  const w = WEEKDAY_ANY.find(([x]) => t.includes(x)); return !!w && d.getDay() === w[1] && diff >= 0 && diff <= 7;
}
const DIGITS_OF = (s) => (latin(s).replace(/(\d),(?=\d{3})/g, "$1").match(/\d+(?:\.\d+)?/g) || []).map((x) => +x);
/** The model's answer → the fields it got right (checked against the notification), or null when it is not JSON. */
export function readMind(out, n) {
  const m = /\{[\s\S]*\}/.exec(String(out || "")); if (!m) return null;
  let j = null; try { j = JSON.parse(m[0]); } catch (e) { try { j = JSON.parse(m[0].replace(/,\s*}/g, "}").replace(/'/g, "\"")); } catch (x) { return null; } }
  if (!j || typeof j !== "object") return null;
  const all = String(n.title || "") + " " + String(n.text || ""), nums = DIGITS_OF(all), r = {};
  if (CATS.includes(j.cat)) r.cat = j.cat; if (INTENTS.includes(j.intent)) r.intent = j.intent; if (ACTIONS.includes(j.action)) r.action = j.action;
  if (FROM_TYPES.includes(j.from_type)) r.fromType = j.from_type;
  if (j.who && typeof j.who === "string" && fold(all).includes(fold(j.who).slice(0, Math.max(3, Math.min(8, fold(j.who).length))))) r.who = j.who.trim().slice(0, 60);
  const a = +j.amount; if (a > 0 && nums.some((x) => Math.abs(x - a) < 0.006)) r.amount = { value: a, cur: String(j.cur || "").toUpperCase().slice(0, 4), dir: ["in", "out", "due", "price"].includes(j.dir) ? j.dir : "price" };
  // a day the model gives must be readable from the words too (code finds a day, or the day-of-month is written)
  const dm = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(String(j.due || "").trim());
  if (dm) { const code = whenIn(all, n.ts || Date.now()), got = dm[1] + "-" + dm[2] + "-" + dm[3];
    if (code ? code.date === got : nums.includes(+dm[3]) || dayFits(all, got, n.ts || Date.now()))
    r.due = { date: dm[1] + "-" + dm[2] + "-" + dm[3], time: dm[4] ? dm[4] + ":" + dm[5] : (code && code.time) || "" }; }
  if (["high", "normal", "low"].includes(j.urgency)) r.urgency = j.urgency;
  if (j.summary && typeof j.summary === "string") { const s = j.summary.trim().slice(0, 200); const bad = DIGITS_OF(s).filter((x) => x > 31 && !nums.some((y) => Math.abs(y - x) < 0.006)); if (!bad.length) r.summary = s; }
  return r;
}
/** Code + model → one reading: what code is sure of stays; the model fills and corrects the rest (but never makes a chat money). */
export function merge(code, model) {
  if (!model) return code;
  const out = { ...code, by: "code+model" };
  if (!code.sure) { for (const k of ["cat", "intent", "action", "urgency"]) if (model[k]) out[k] = model[k]; if (model.fromType) out.from = { ...code.from, type: model.fromType }; out.sure = !!(model.cat && model.intent); }
  if (!out.who && model.who) out.who = model.who;
  if (!out.due && model.due) out.due = model.due;
  if (!out.amount && model.amount && !(out.cat === "chat" && (model.amount.dir === "in" || model.amount.dir === "out"))) out.amount = model.amount;
  if (model.summary) out.summary = model.summary;
  return out;
}
/** Words for search and for Chat's context ("who asked me to send something?", "what do I have to pay this week?"). */
export function mindWords(m) {
  if (!m) return "";
  const A = { request: "asked request asks wants طلب عايز", question: "question asked سؤال بيسأل", invite: "invite invitation party عزومة دعوة", reminder: "reminder due تذكير", confirm: "confirmed done تم", change: "changed moved new time اتغير",
    cancel: "cancelled اتلغى", alert: "alert warning urgent تنبيه", offer: "offer sale عرض", greeting: "greeting wishes تهنئة", info: "" };
  const B = { reply: "reply answer رد", pay: "pay payment due ادفع", attend: "attend meeting appointment ميعاد", pickup: "pick up collect استلم", call_back: "call back كلمه", verify: "verify security", renew: "renew expires تجديد", update_payment: "card failed payment", submit: "submit send documents ورق", travel: "flight travel سفر", check: "check", read: "", none: "" };
  return [m.cat, CAT_WORD[m.cat] || "", A[m.intent] || "", B[m.action] || "", m.who || "", m.from && m.from.name || "", m.ref || "", m.urgency === "high" ? "urgent important مهم" : "", m.summary || ""].filter(Boolean).join(" ");
}

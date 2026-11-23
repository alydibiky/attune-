/* ---- v10.1 F1 + F3 (Ali, 16 Nov 2026: "a lot of things we added as features when we added the bulk features — I don't know how to
   find each one"; he picked F1 "Find a feature" in the side menu and F3 "where is …" in the Home box). Every feature, where it lives
   (the path you'd tap), what it does, and the words people use for it (English, Egyptian Arabic, Franco — and its name in the
   app's language at search time, so all 20 languages find it by its name).
   · find(query, t) → [{ f, score }] best first (F1 shows them as you type).
   · whereAsk(text, t) → the one feature a "where is / how do I / فين / ازاي" question means, or null (F3). A question about a THING
     you own or put somewhere ("where is my passport?", "where did I put the keys") is not about a feature → null (Mind answers it).
   · openFeature(f) opens its page (and what inside it: Things in Follow-ups, a panel). Pure except openFeature.
   Tests: tests/features/gen.mjs (10,000 questions) + tests/unit/v1010features.test.mjs; a unit test fails when a page of the app
   has no line here. */
const P = (...xs) => xs;   // a place: menu steps (each a line the app translates)
export const FEATURES = [
  // Home
  { id: "autopilot", open: "home", name: "Autopilot", place: P("Home"), does: "Shopping list from your chats, Done for you, Kept quietly", words: "autopilot done for you kept quietly chats shopping talabat الطلبات اوتوبايلوت" },
  { id: "habits", open: "habits", name: "Habits", place: P("Home"), does: "Tick a habit each day — streaks and this week's dots on Home", words: "habit habits streak daily routine عاده عادات العادات 3ada" },
  { id: "countdowns", open: "countdowns", name: "Countdowns", place: P("Home"), does: "Days left to a wedding, a trip, Ramadan — chips under the Home box", words: "countdown countdowns days left until عد تنازلي العد التنازلي فاضل كام يوم" },
  { id: "braindump", open: "braindump", name: "Organise this", place: P("Home"), does: "Write or say everything on your mind — Attune sorts it into to-dos, reminders, lists and money", words: "organise organize brain dump braindump sort my thoughts everything on my mind رتب رتبلي افكاري دماغي" },
  { id: "focus", open: "focus", name: "Focus", place: P("Home"), does: "A full-screen timer for one task; the time is kept per task", words: "focus timer pomodoro concentrate تركيز ركز تايمر مؤقت" },
  { id: "missions", open: "missions", name: "Missions", place: P("Home"), does: "A goal with a date — Attune works on it every day and shows your real chance", words: "mission missions goal goals target هدف اهداف مهمه" },
  { id: "recall", open: "recall", name: "Recall", place: P("Home"), does: "Find anything on your phone by meaning — screenshots, notifications, chats, notes", words: "recall search phone screenshots notifications find anything ابحث افتكر سكرينشوت الاشعارات" },
  { id: "voice", open: "voice", name: "Ya Attune (voice)", place: P("Home"), does: "Talk to Attune hands-free", words: "voice talk speak wake word ya attune صوت يا اتيون اتكلم" },
  // To-dos & lists
  { id: "lists", open: "lists", name: "To-dos & lists", place: P("To-dos & lists"), does: "Lists that come back to Home until every box is ticked", words: "list lists todo todos to-do checklist shopping list قايمه قائمه ليسته مهام" },
  { id: "weekplan", open: "weekplan", name: "Week plan", place: P("To-dos & lists", "Plan my week"), does: "Tasks with hours and a deadline — Attune finds the time around your day", words: "week plan schedule my week calendar blocks time plan خطه الاسبوع اخطط جدول" },
  { id: "tables", open: "tables", name: "Tables", place: P("To-dos & lists", "Tables"), does: "A table from one sentence — books, workouts, anything to track", words: "table tables track spreadsheet columns جدول جداول" },
  { id: "widget", open: "lists", name: "Pin to the widget", place: P("To-dos & lists", "Open a list"), does: "Put a list on your phone's home screen", words: "widget home screen pin ويدجت الشاشه الرئيسيه" },
  // Money
  { id: "money", open: "money", name: "Money", place: P("Money"), does: "Your accounts, what you spent and safe to spend", words: "money spending expenses budget balance safe to spend فلوس الفلوس مصاريف صرفت" },
  { id: "planner", open: "planner", name: "Month plan", place: P("Money", "Plans"), does: "Plans your month: bills, savings goals, everyday spending — and what's free", words: "month plan monthly budget plan my month خطه الشهر ميزانيه" },
  { id: "salary", open: "salary", name: "Salary plan", place: P("Money", "More"), does: "Where your salary goes, every month", words: "salary plan pay day مرتب المرتب الراتب" },
  { id: "split", open: "split", name: "Split with anyone", place: P("Money", "More"), does: "A trip or a flat: who paid what, and who pays whom", words: "split bill share costs settle up who owes who قسم الحساب نقسم مين عليه" },
  { id: "automations", open: "automations", name: "Automations", place: P("Money", "More"), does: "Say what should happen — and it runs by itself", words: "automation automations rule rules when then trigger اتمته قاعده قواعد تلقائي لوحده" },
  { id: "aijobs", open: "automations", name: "AI jobs at night", place: P("Money", "More", "Automations"), does: "Jobs the AI does while the phone charges at night", words: "ai jobs night jobs scheduled ai overnight شغل بالليل مهام الذكاء" },
  { id: "donelog", open: "automations", name: "Done for you", place: P("Money", "More", "Automations"), does: "Everything Attune did by itself, with Undo", words: "done for you log undo what did attune do history اتعمل لوحده تراجع سجل" },
  { id: "deal", open: "deal", name: "Deal Check", place: P("Money"), does: "Before you pay or sign", words: "deal check contract before signing good deal صفقه عقد" },
  // Follow-ups
  { id: "timeline", open: "timeline", name: "Follow-ups", place: P("Follow-ups"), does: "Everything coming up — reminders, dates, payments, promises — on one list", words: "follow ups followups coming up upcoming due متابعات المتابعات" },
  { id: "things", open: "things", name: "Things I own", place: P("Follow-ups", "Things I own"), does: "Receipts and warranties, each price linked to its payment in Money", words: "things i own my things receipt receipts warranty warranties guarantee serial حاجاتي فاتوره فواتير ضمان الضمان" },
  { id: "life", open: "life", name: "People & plans", place: P("Follow-ups", "People & plans"), does: "Debts, installments, savings circles, bills — a checkbox for every payment", words: "debts debt installment installments loan owe owes subscription subscriptions payer دين ديون قسط اقساط جمعيه سلف اشتراك اشتراكات" },
  { id: "reminders", open: "reminders", name: "Reminders", place: P("Follow-ups", "Reminders"), does: "Alarms and reminders — once, or until done", words: "reminder reminders alarm remind nag important تذكير فكرني منبه" },
  { id: "radar", open: "radar", name: "Deadline Radar", place: P("Follow-ups", "Dates"), does: "Free trials, renewals, returns, warranties and documents — a warning before each one", words: "dates deadline deadlines expiry expires passport id card bank card scan papers renewal trial مواعيد ميعاد انتهاء الباسبور البطاقه اوراق" },
  { id: "errands", open: "errands", name: "Errands", place: P("Follow-ups", "Errands"), does: "Licences, fines, bills, IDs, inspections — told before each is due", words: "errands licence license renewal fines car inspection مشاوير رخصه مخالفات" },
  { id: "upkeep", open: "errands", name: "Upkeep", place: P("Follow-ups", "Errands"), does: "Car service, AC filters, water filters — when each is due", words: "upkeep maintenance service filter oil change صيانه تغيير زيت فلتر" },
  { id: "guardian", open: "guardian", name: "Money Guardian", place: P("Follow-ups", "Guardian"), does: "Finds money in your payments: late debts, double charges, price rises, subscriptions", words: "guardian overpaying double charge price rise scam check حارس نصب احتيال" },
  // Health
  { id: "care", open: "care", name: "Family health", place: P("Health"), does: "Medicines and reminders for the family, lab results over time", words: "health medicine medicines pills lab results doctor صحه دوا ادويه تحاليل" },
  { id: "emergency", open: "care", name: "Emergency card", place: P("Health", "Emergency"), does: "Blood type, allergies and who to call — also on the lock screen", words: "emergency card blood type allergies طوارئ فصيله الدم حساسيه" },
  { id: "school", open: "care", name: "Kids & school", place: P("Health", "School"), does: "A child's school, homework and what the class group said", words: "kids school children homework class group مدرسه الاولاد واجب" },
  { id: "family", open: "family", name: "Family", place: P("Health", "Family"), does: "One shopping list, who paid what for the house, reminders for the parents", words: "family shared list parents العيله الاسره" },
  // Agents
  { id: "agents", open: "agents", name: "Agents", place: P("Agents"), does: "Watch a price, track a delivery, order your usual, open any app", words: "agent agents price watch buy cheapest track order delivery hotel flight وكيل سعر ارخص اطلب طلب" },
  { id: "messages", open: "agents", name: "Scheduled messages", place: P("Agents", "Messages"), does: "Send a message later, or reply by itself", words: "scheduled message send later auto reply رساله مجدوله ابعت بعدين رد تلقائي" },
  // My things (Documents · People · Mind)
  { id: "booklib", open: "booklib", name: "Documents", place: P("My things", "Documents"), does: "Your books and files — ask all of them at once, or one", words: "documents books pdf files library ask a pdf مستندات كتب ملفات" },
  { id: "people", open: "people", name: "People", place: P("My things", "People"), does: "Your people, places and things — everything about each one", words: "people person contacts who is ناس الناس شخص" },
  { id: "keepintouch", open: "people", name: "Keep in touch", place: P("My things", "People"), does: "Who you haven't talked to in a while", words: "keep in touch call friends haven't talked تواصل اكلم" },
  { id: "occasions", open: "people", name: "Occasions", place: P("My things", "People"), does: "Birthdays and anniversaries, with a wish on the day", words: "occasions birthday birthdays anniversary عيد ميلاد اعياد مناسبات" },
  { id: "memory", open: "memory", name: "Mind", place: P("My things", "Mind"), does: "Everything you keep — it files itself", words: "mind notes memory saved كل حاجه ملاحظات" },
  { id: "groups", open: "groups", name: "WhatsApp groups", place: P("My things"), does: "Your WhatsApp groups and exported chats, read by Attune", words: "whatsapp groups export chat history جروبات واتساب" },
  { id: "projects", open: "projects", name: "Projects", place: P("Tools", "Projects"), does: "A piece of work: tasks, dates, money and people together", words: "project projects work folder مشروع مشاريع" },
  // Go
  { id: "travel", open: "travel", name: "Travel", place: P("Go", "Travel"), does: "Your trips from your bookings, with their money and papers", words: "travel trip trips booking bookings flight day سفر رحله حجز" },
  { id: "map", open: "map", name: "Maps", place: P("Go", "Maps"), does: "Offline places", words: "map maps directions خريطه" },
  { id: "metro", open: "metro", name: "Metro", place: P("Go", "Metro"), does: "Cairo Metro — line, direction, stops, ticket", words: "metro subway train مترو" },
  // Students · Daily · Tools
  { id: "coach", open: "coach", name: "Homework Coach", place: P("Students"), does: "Snap the homework — taught step by step", words: "homework coach study tutor واجب مذاكره" },
  { id: "learn", open: "learn", name: "Learn daily", place: P("Daily"), does: "A lesson a day, with quizzes", words: "learn lesson daily quiz اتعلم درس" },
  { id: "translate", open: "translate", name: "Translate", place: P("Tools"), does: "Text, photos and documents — any language", words: "translate translation translator ترجم ترجمه المترجم" },
  { id: "convert", open: "convert", name: "File Converter", place: P("Tools", "Files & Converter"), does: "PDF, Word, PowerPoint, Excel, photos — and edit a PDF", words: "convert converter conversion docx word excel powerpoint compress merge حول تحويل" },
  { id: "write", open: "write", name: "Writing", place: P("Tools", "Writing"), does: "Improve, shorten or humanize any text", words: "writing write improve rewrite email اكتب كتابه" },
  { id: "assistants", open: "assistants", name: "Assistants", place: P("Tools", "Projects", "Your assistants"), does: "Experts that follow your instructions", words: "assistant assistants expert gem persona مساعد مساعدين" },
  { id: "skills", open: "skills", name: "Skills", place: P("Tools", "Projects", "Your skills"), does: "Your own recipes for the AI — create, import, share", words: "skill skills recipe prompt recipes مهارات وصفات" },
  { id: "artifacts", open: "artifacts", name: "Artifacts", place: P("Tools", "Projects"), does: "Saved pages, documents & programs", words: "artifacts saved pages saved documents محفوظات" },
  { id: "slides", open: "slides", name: "Slides & Reports", place: P("Students"), does: "A designed PowerPoint or a full report from one sentence", words: "slides presentation powerpoint report deck عرض شرائح بوربوينت تقرير" },
  { id: "cv", open: "cv", name: "CV / Resume", place: P("Students"), does: "Build, tailor and export a CV — English or Arabic", words: "cv resume job سيره ذاتيه" },
  { id: "code", open: "code", name: "Code", place: P("Tools"), does: "Programs tested on your phone", words: "code program programming script كود برمجه" },
  { id: "news", open: "news", name: "Daily news", place: P("Daily", "News"), does: "Topics you follow, every morning", words: "news headlines اخبار الاخبار" },
  { id: "shelf", open: "shelf", name: "Shelf", place: P("My things", "Shelf"), does: "Your notes, in books", words: "shelf notebook notes books رف نوت" },
  { id: "remember", open: "remember", name: "Remember", place: P("My things", "Shelf"), does: "Books, articles, the news — ask Chat about them", words: "remember article articles افتكر مقال" },
  { id: "pdfchat", open: "pdfchat", name: "Ask a PDF", place: P("Tools", "Ask a PDF"), does: "Read a PDF or book and chat with it — every answer shows its page", words: "ask a pdf chat with pdf read pdf اسال الملف" },
  { id: "cycle", open: "cycle", name: "Cycle", place: P("Health", "Cycle"), does: "Period tracker", words: "cycle period tracker الدوره" },
  { id: "video", open: "video", name: "Video Downloader", place: P("Tools", "Video Downloader"), does: "Paste a video link, pick the quality, save it to your phone", words: "video download downloader youtube تحميل فيديو" },
  { id: "lifeask", open: "lifeask", name: "Ask your life", place: P("Home"), does: "One question about your money, people, health and deadlines — answered from your own data", words: "ask your life question my data اسال حياتي" },
  // Settings
  { id: "setup", open: "setup", name: "Set up your life", place: P("Settings", "Set up your life"), does: "Eight steps that make Attune work for you", words: "set up setup start onboarding steps ابدأ رتب حياتي" },
  { id: "sync", open: "panel:backup", name: "Sync", place: P("Backup", "Sync"), does: "Phone and computer together — over Wi-Fi or Google Drive", words: "sync phone computer laptop wifi google drive مزامنه الكمبيوتر اللابتوب" },
  { id: "backup", open: "panel:backup", name: "Backup", place: P("Backup"), does: "Save and restore everything", words: "backup restore export نسخه احتياطيه" },
  { id: "settings", open: "settings", name: "Settings", place: P("Settings"), does: "Language, colours, country", words: "settings language theme colour color country اعدادات اللغه" },
  { id: "privacy", open: "privacy", name: "Privacy", place: P("Settings", "Privacy"), does: "What Attune reads, and the lock", words: "privacy lock vault خصوصيه قفل" },
  { id: "guide", open: "guide", name: "How to use Attune", place: P("How to use"), does: "Every tool in three steps", words: "how to use guide help tutorial مساعده شرح ازاي استخدم" },
];

// ---- matching ---------------------------------------------------------------------------------------------------------------
const fold = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
// a word's stem: English plural / -ing / -ed / -ion, the Arabic article and a possessive ending («رحلتي» → «رحله»)
const strip = (w0) => { let w = w0.replace(/^(?:ال|وال|بال|لل)(?=\S{2,})/, "");
  if (/^[\u0600-\u06ff]+$/.test(w)) { if (w.length >= 4) w = w.replace(/(?:ي|ك|ها|نا|هم|كم)$/, ""); return w.replace(/ت$/, "ه"); }
  return w.replace(/(?<=\p{L}{4})(?:ies)$/u, "y").replace(/(?<=\p{L}{3})s$/u, "").replace(/(?<=\p{L}{5})(?:ing|ed)$/u, "").replace(/(?<=\p{L}{4})(\p{L})\1$/u, "$1"); };
// words that ask, not what is asked about
const STOP = new Set(("where is are was the a an my me i do does can how to find open show go page feature thing app attune in on of for with " +
  // the question's frame, not its subject ("help me find …", "can you tell me where … is", "where in the app", «ممكن اعرف … فين في التطبيق»)
  "help tell look looking you your should shall could any some one whereabouts application screen setting located location " +
  "fel ma3lesh momken a3raf 3ayz ممكن اعرف التطبيق الابليكيشن لو سمحت " +
  "what which section tab button menu use using get see seen please pls want need there it this that has have had would could should shows when whose ya fen fein feen ezay ezzay 3ayez 3awez 3ayza efta7 a3mel a3ml 3amel elly ely safhet safha ala2y mawgood mawgoud " +
  "فين فيين ازاي إزاي الاقي القي هلاقي ألاقي موجود موجوده صفحة صفحه اعمل اعمله ازاي ايه مكان المكان صفحه زرار عايز عاوز عايزه افتح افتحلي وريني فين ال في من على يا اتيون " +
  // the other 18 languages' "where is / how do I find" words
  "où ou est sont trouver trouve comment le la les mes mon ma dónde donde está esta están encuentro encontrar cómo como el los las mis mi wo ist sind finde ich wie der die das meine mein " +
  "onde fica encontro dove trova trovo come il lo gli miei где найти как мой мои nerede bulurum nasıl benim di mana dimana bagaimana saya कहाँ कहां कैसे मेरा मेरे है کہاں کیسے میرا ہے " +
  "کجا چطور است من কোথায় কীভাবে আমার wapi vipi yangu iko ที่ไหน อย่างไร ของฉัน ở đâu làm sao của tôi 哪里 在哪 在哪里 怎么 我的 どこ どうやって 私の 어디 어떻게 내").split(" ").map((w) => fold(w)));
// (a word is dropped as a question word BEFORE its plural is cut: "things" stays, "thing" goes)
const toks = (s) => fold(s).split(" ").filter((w) => w.length >= 2 && !STOP.has(w)).map(strip).filter((w) => w.length >= 2);
// (the 10,000 run: "checklist" is not "check" — Deal Check; "book" is not "booking") a word that starts another counts only when they
// differ by 2 letters at most; two long words that share most of their start are the same word ("automatic" · "automation", "expire" · "expiry")
const pre = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const near = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && Math.abs(a.length - b.length) <= 2 && (a.startsWith(b) || b.startsWith(a)))
  || (a.length >= 6 && b.length >= 6 && pre(a, b) >= Math.max(5, Math.ceil(0.75 * Math.min(a.length, b.length))));
// how rare a word is across the features: "reminder" is said of many, "birthday" of one — the rare word decides
let DF = null;
const df = (w) => { if (!DF) { DF = new Map(); for (const f of FEATURES) for (const x of new Set([...toks(f.name), ...toks(f.words), ...toks(f.does)])) DF.set(x, (DF.get(x) || 0) + 1); }
  let n = 0; for (const [x, c] of DF) if (near(w, x)) n = Math.max(n, c); return n; };
// (a word no feature uses — «التلاجه», "fridge" — is usually the thing, not the feature: it counts a little)
const weight = (w) => { const n = df(w); return n ? 1 / (1 + Math.log(n)) : 0.35; };
/** Every feature for a query, best first → [{ f, score }] (score 0–1: how much of the query it explains). t = the app's tr(). */
export function find(query, t = (s) => s) {
  const q = toks(query), fq = " " + fold(query) + " ";
  const out = [];
  for (const f of FEATURES) {
    // its whole name said (also in languages written without spaces — 习惯在哪里, ที่ไหน): the strongest sign
    const nm = [f.name, t(f.name)].map(fold).filter((x) => x.length >= 2);
    // (only when the name is ALL that is asked — "birthday reminders" is about birthdays, not the Reminders page)
    const whole = nm.find((x) => fq.includes(" " + x + " ") || (/[\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(x) && fq.includes(x)));
    // (Japanese / Chinese put a particle and "where" right after the name: 旅行はどこ？ · 习惯在哪里)
    if (whole && !toks(fq.replace(whole, " ").replace(/[はがをのにでへもどこすかあるいまにありますか在哪里儿呢吗是的]/g, "")).length) { out.push({ f, named: 1, score: 1.1 + 0.001 * whole.length }); continue; }
    if (!q.length) continue;
    const nameW = new Set([...toks(f.name), ...toks(t(f.name))]), allW = new Set([...nameW, ...toks(f.words), ...toks(f.does), ...toks(t(f.does))]);
    let hit = 0, named = 0, said = 0, tot = 0; const own = new Set(toks(f.words));
    for (const w of q) { const k = weight(w); tot += k;
      // its name counts most, then the words people use for it, then its description
      if ([...nameW].some((x) => near(w, x))) { hit += k; named++; } else if ([...own].some((x) => near(w, x))) { hit += 0.8 * k; said++; } else if ([...allW].some((x) => near(w, x))) hit += 0.6 * k; }
    if (!hit) continue;
    // (a tie — "warranty" is in Things I own and in Dates — goes to the one whose own words say it, not only its description)
    out.push({ f, named, said, score: Math.min(1, hit / tot) + (named ? 0.05 : 0) + (named === q.length ? 0.05 : 0) + said * 0.01 });
  }
  return out.sort((a, b) => b.score - a.score);
}
// "where is / how do I / فين / ازاي" — a question about the app
const ASK = new RegExp("\\b(?:where(?:'s| is| are| do i| can i| would i)?|how (?:do|can) i|how to|find|is there|can attune|does attune|show me where|which page|fen|fein|feen|ezay|ezzay|ala2y|ala2i)\\b" +
  "|(?:^|\\s|[¿¡])(?:فين|فيين|ازاي|إزاي|هلاقي|القي|ألاقي|الاقي|ممكن ازاي|ينفع|où|comment trouver|dónde|donde|cómo encuentro|wo|wie finde|onde|dove|где|как найти|nerede|nasıl|di ?mana|bagaimana|کجا|کہاں|কোথায়|wapi|ở đâu|làm sao)(?=[\\s?؟,.!]|$)" +
  "|कहाँ|कहां|ที่ไหน|哪里|在哪|どこ|어디", "iu");
// "where" itself (in the 20 languages) — a "how to" without it needs an app verb or the feature's name
const WHERE = /\bwhere\b|(?:^|\s|[¿¡])(?:فين|فيين|موجود|où|dónde|donde|wo|onde|dove|где|nerede|di ?mana|dimana|کجا|کہاں|কোথায়|wapi|ở đâu)(?=[\s?؟,.!]|$)|\b(?:fen|fein|feen)\b|कहाँ|कहां|ที่ไหน|哪里|在哪|どこ|어디/iu;
const APPV = /\b(?:open|find|get to|use|see|turn on|switch on|set up|add|go to|reach|is there|which page|show me|look for|in the app)\b|(?:^|\s)(?:افتح|الاقي|ألاقي|هلاقي|القي|استخدم|اوصل)(?=\s|$)|\b(?:efta7|ala2y|ala2i|aw2al)\b/i;
// a THING you own / put somewhere — Mind's "where did I put …", never a feature
const THING = /\bwhere did i\b|\b(?:did i (?:put|leave|keep|park)|i (?:put|left|kept|parked)\b|where(?:'s| is| are) my (?:keys?|wallet|glasses|phone charger|car|car keys|passport|id card|bag|jacket|charger|kids?|son|daughter|wife|husband)\b|\bparked\b)|(?:^|\s)(?:حطيت|سبت|ركنت|مفاتيحي|المفاتيح|محفظتي|نضارتي|الشاحن)(?=\s|$)/i;
/** F3: the feature a "where is …" question means → { f, score } (sure) · { options: [f, f, f] } (2–3 close ones to tap — never a guess
 *  shown as the answer) · null (not a question about the app, or nothing near). */
export function whereAsk(text, t = (s) => s) {
  const s = String(text || "").trim(); if (!s || s.length > 120 || !ASK.test(s) || THING.test(s)) return null;
  // (the full test run: "What is the capacity of an LTM 1100? How much does it cost? Where is it made?" got a feature) several
  // questions in one message, or a long one, are for the AI — never this
  if ((s.match(/[?؟]/g) || []).length > 1 || /[?؟!]\s+\S/.test(s) || /\.\s+[A-Z\u0600-\u06ff]/.test(s) || s.split(/\s+/).length > 14) return null;
  // "how do I / how to …" is about the app only when it names a feature or asks to open / find / use something ("how to change a tyre"
  // is a question about the world)
  const where = WHERE.test(s), appVerb = APPV.test(s);
  const r = find(s, t); if (!r.length) return null;
  if (!where && !appVerb && !r[0].named) return null;
  // (a feature named in a longer phrase — "split with friends", "the habit tracker" — counts when nothing else comes close)
  const top = r[0], gap = top.score - (r[1] ? r[1].score : 0);
  const sure = (top.score >= 0.6 || (top.score >= 0.55 && gap >= 0.1) || ((top.named || top.said) && top.score >= 0.5 && gap >= 0.075))
    && !(r[1] && r[1].score >= top.score - 0.001 && r[1].f.open !== top.f.open && !(top.score >= 1.05));   // two equally likely → don't guess
  if (sure) return top;
  // not sure: the closest 2–3 (each a real candidate), for one tap — only for a "where is …", and when one is a fair match
  if (!(where || appVerb) || top.score < 0.35) return null;
  const opts = []; for (const x of r) { if (x.score < Math.max(0.25, top.score * 0.55) || opts.length >= 3) break; if (!opts.some((o) => o.open === x.f.open && placeLine(o) === placeLine(x.f))) opts.push(x.f); }
  return opts.length ? { options: opts, score: top.score } : null;
}
/** The place as one line in the app's language: "Money → More → Automations". */
export const placeLine = (f, t = (s) => s) => f.place.map((x) => t(x)).join(" → ");
/** Open a feature where it lives. */
export function openFeature(f, navTo) {
  if (!f) return;
  try { if (f.open === "things") { localStorage.setItem("attune:fu:things", "1"); window.dispatchEvent(new CustomEvent("attune-fu-things")); } } catch (e) {}   // (v10.9.5: Follow-ups is kept between visits — tell it to unfold)
  const mode = f.open === "things" ? "timeline" : f.open;
  if (mode.startsWith("panel:")) { try { window.dispatchEvent(new CustomEvent("attune-panel", { detail: mode.slice(6) })); } catch (e) {} return; }
  if (navTo) navTo(mode); else try { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode } })); } catch (e) {}
}

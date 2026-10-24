/* ---- v7.9 (Ali, 24 Oct 2026: "I want the how to get most from the app guide to have everything that can be done in the app to make
   life easier"; he picked design A "by life area, with a checklist" + C's list of every feature): every feature of the app sits in
   one life area, with what you say and what you get. "Tried" = the person has opened it (kept on the phone only). Pure, so it is
   unit-tested (tests/unit/v900guide.test.mjs) — the test fails when a page of the app has no area or no example here.          */
const S = (en, ar) => [en, ar];

export const AREAS = [
  { id: "money", icon: "💰", title: S("Money", "الفلوس"), ids: ["money", "guardian", "life", "reminders", "radar", "timeline", "deal", "automations", "xray"] },
  { id: "health", icon: "🥗", title: S("Health & food", "الصحة والأكل"), ids: ["health", "fit", "care", "cycle"] },
  { id: "everyday", icon: "☀️", title: S("Every day", "كل يوم"), ids: ["home", "chat", "lifeask", "translate", "instant", "missions", "scout", "shelf", "map", "metro", "travel", "privacy"] },
  { id: "learn", icon: "📚", title: S("Learning & study", "التعلّم والمذاكرة"), ids: ["learn", "coach", "convert", "pdfchat", "slides", "cv", "memory", "remember", "recall", "news"] },
  { id: "work", icon: "💼", title: S("Work & business", "الشغل والبيزنس"), ids: ["business", "fleet", "field", "crane", "tools", "improve", "compress", "humanize", "copilot", "library", "video", "ask"] },
  { id: "create", icon: "✨", title: S("Create", "اعمل حاجة"), ids: ["assistants", "skills", "artifacts", "studio", "code", "projects"] },
];

/** What you say (or do) → what you get, for every feature. */
export const SAY = {
  home: [S("“lunch 150, taxi 60”", "«غدا 150، تاكسي 60»"), S("Both logged in Money at once — Undo if wrong", "الاتنين اتسجلوا في الفلوس على طول — وفيه تراجع")],
  chat: [S("“Compare these two cars for a family of five” + two photos", "«قارنلي العربيتين دول لعيلة من 5» + صورتين"), S("A clear answer that reads the photos — on your phone", "إجابة واضحة بتقرا الصور — على موبايلك")],
  lifeask: [S("“How much did I spend on food this month vs last month?”", "«صرفت كام على الأكل الشهر ده مقارنة باللي فات؟»"), S("The two numbers from your own records, by code", "الرقمين من سجلاتك انت، بالكود")],
  translate: [S("Hold the mic and speak Arabic to a taxi driver in Istanbul", "دوس على المايك واتكلم عربي مع سواق تاكسي في إسطنبول"), S("He hears it in Turkish; his answer comes back in Arabic", "بيسمعها تركي؛ ورده بيرجعلك عربي")],
  instant: [S("Share a long WhatsApp message to Attune", "شيّر رسالة واتساب طويلة لـ Attune"), S("A short summary, a reply, or the date added to your calendar", "ملخص قصير، أو رد، أو الميعاد يتضاف للتقويم")],
  missions: [S("“Lose 6 kg before 20 January”", "«أخس 6 كيلو قبل 20 يناير»"), S("Your chance in %, and one step a day to keep it on track", "فرصتك بالنسبة المئوية، وخطوة كل يوم")],
  scout: [S("“Hyundai Tucson 2022 used under 1.5M”", "«هيونداي توسان 2022 مستعمل أقل من 1.5 مليون»"), S("Real ads from many sites, checked and compared — told when a good one appears", "إعلانات حقيقية من مواقع كتير، متراجعة ومتقارنة — وتتبلغ أول ما يظهر واحد كويس")],
  shelf: [S("Save a book, an article or a podcast", "احفظ كتاب أو مقالة أو بودكاست"), S("A shelf of everything to read or watch, with where you stopped", "رف فيه كل حاجة عايز تقراها أو تشوفها، ووقفت فين")],
  map: [S("Search “pharmacy” with no internet", "دوّر على «صيدلية» من غير نت"), S("The nearest ones on the offline map, and the way there", "الأقرب على الخريطة اللي من غير نت، والطريق ليها")],
  metro: [S("“From Maadi to Attaba”", "«من المعادي للعتبة»"), S("The lines, where to change, stations and minutes", "الخطوط، تغيّر فين، المحطات والدقايق")],
  travel: [S("“A week in Istanbul in March, 2 people”", "«أسبوع في إسطنبول في مارس، فردين»"), S("A day-by-day plan, the visa for your passport, and a packing list", "خطة يوم بيوم، والفيزا على جوازك، وشنطة السفر")],
  privacy: [S("Open Privacy", "افتح الخصوصية"), S("What stayed on your phone this week, and a PIN for any part", "إيه اللي فضل على موبايلك الأسبوع ده، ورقم سري لأي جزء")],
  money: [S("“Spent 85 on koshary”", "«صرفت 85 على كشري»"), S("In Money, with safe to spend today and where it all went", "في الفلوس، ومعاه تقدر تصرف كام النهارده وراحت فين")],
  guardian: [S("Nothing — it reads your payments by itself", "ولا حاجة — بيقرا مدفوعاتك لوحده"), S("A double charge, a price rise or a forgotten subscription, with what to do", "خصم مرتين، أو سعر زاد، أو اشتراك ناسيه، ومعاه تعمل إيه")],
  life: [S("«الشغالة كل سبت 600»", "«الشغالة كل سبت 600»"), S("A tick every Saturday — ticked goes into Money by itself", "علامة كل سبت — لما تعلّم بتتسجل في الفلوس لوحدها")],
  reminders: [S("“Remind me at 5 to pay the electricity”", "«فكّرني الساعة 5 أدفع الكهربا»"), S("A reminder at 5 — on the phone, no internet needed", "تنبيه الساعة 5 — على الموبايل، من غير نت")],
  radar: [S("A free trial or a warranty in your messages", "تجربة مجانية أو ضمان في رسايلك"), S("The date kept, a warning before it ends, and how to cancel", "الميعاد يتحفظ، وتنبيه قبل ما يخلص، وإزاي تلغي")],
  timeline: [S("Open Follow-ups → Timeline", "افتح المتابعات ← الخط الزمني"), S("Every bill, dose, promise and date of the week in one list", "كل فاتورة وجرعة ووعد وميعاد في الأسبوع في قايمة واحدة")],
  deal: [S("“iPhone 16, 60,000 cash or 3,000 a month for 24 months?”", "«آيفون 16، 60 ألف كاش ولا 3000 في الشهر 24 شهر؟»"), S("Which is cheaper in today's money, and by how much", "أنهي أرخص بفلوس النهارده، وبكام")],
  automations: [S("“When my salary arrives, put 20% in the car fund”", "«لما المرتب ينزل، حط 20% في فلوس العربية»"), S("Done every month by itself, and you're told", "بيتعمل كل شهر لوحده، وبيقولك")],
  xray: [S("Share a WhatsApp chat", "شيّر محادثة واتساب"), S("Every promise, date and amount in it — and who keeps their word", "كل وعد وميعاد ومبلغ فيها — ومين بيوفي بكلامه")],
  health: [S("“Took my insulin”", "«خدت الإنسولين»"), S("The dose ticked, and your health on one calm page", "الجرعة اتعلّمت، وصحتك في صفحة واحدة هادية")],
  fit: [S("A photo of your plate", "صورة طبقك"), S("The dish named, its calories and macros — one tap to add", "اسم الأكلة، وسعراتها والماكروز — ضغطة وتتضاف")],
  care: [S("A photo of a prescription", "صورة روشتة"), S("Each medicine with its times, reminders, and when it runs out", "كل دوا بمواعيده، وتنبيهات، وإمتى هيخلص")],
  cycle: [S("“My period started today”", "«الدورة نزلت النهارده»"), S("Next dates and fertile days, kindly, kept private", "المواعيد الجاية والأيام الخصبة، بلطف، وسرّي")],
  learn: [S("“Turkish from zero”", "«تركي من الصفر»"), S("A five-minute lesson every day with a quiz, and a streak", "درس 5 دقايق كل يوم باختبار، وأيام متتالية")],
  coach: [S("A photo of a math question", "صورة مسألة رياضة"), S("Hints step by step — the answer only when you ask, checked by code", "تلميحات خطوة بخطوة — والحل لما تطلب بس، ومتراجع بالكود")],
  convert: [S("A PDF of your report", "PDF بتاع تقريرك"), S("A Word file with the same layout, made on the phone", "ملف Word بنفس الشكل، معمول على الموبايل")],
  pdfchat: [S("“What's the penalty in this contract?” + the PDF", "«الشرط الجزائي في العقد ده إيه؟» + الـ PDF"), S("The answer with the page it came from", "الإجابة ومعاها الصفحة اللي جت منها")],
  slides: [S("“10 slides on VGG for my seminar”", "«10 شرايح عن VGG للسيمينار»"), S("A deck you can edit and save as PowerPoint", "عرض تقدر تعدّله وتحفظه PowerPoint")],
  cv: [S("Paste a job ad", "الزق إعلان الوظيفة"), S("Your CV fitted to it, and a mock interview", "السي في بتاعك متظبط عليه، ومقابلة تجريبية")],
  memory: [S("“Keep this: the plumber's number 0100…”", "«احفظ: رقم السباك 0100…»"), S("Kept in Mind; found again by asking", "اتحفظ في عقلي؛ وتلاقيه تاني لما تسأل")],
  remember: [S("Add a book or today's news", "ضيف كتاب أو أخبار النهارده"), S("“What happens in chapter 3?” answered from the book itself", "«إيه اللي بيحصل في الفصل 3؟» من الكتاب نفسه")],
  recall: [S("“That photo of the warranty card”", "«صورة كارت الضمان»"), S("Found by what it meant, even if you never named it", "بتتلاقي بمعناها، حتى لو عمرك ما سمّيتها")],
  news: [S("Pick your topics once", "اختار مواضيعك مرة واحدة"), S("Only those, summed up every morning", "هي بس، ملخّصة كل يوم الصبح")],
  business: [S("“Invoice Nile Bakery: 2 deliveries, 500 each”", "«فاتورة لنايل بيكري: توصيلتين، 500 كل واحدة»"), S("A real invoice with VAT, in your books, and who owes you", "فاتورة حقيقية بالضريبة، في حساباتك، ومين عليه فلوس")],
  fleet: [S("Your team's site reports", "تقارير الموقع بتاعة فريقك"), S("Which machine needs attention this week", "أنهي معدة محتاجة اهتمام الأسبوع ده")],
  field: [S("Say what happened on site", "قول اللي حصل في الموقع"), S("An incident or maintenance report as a PDF", "تقرير حادثة أو صيانة PDF")],
  crane: [S("“50 t crane, 22 m radius, 4 t load”", "«ونش 50 طن، نصف قطر 22 متر، حمل 4 طن»"), S("Safe or not from the load chart, and the lift plan", "آمن ولا لأ من جدول الأحمال، وخطة الرفع")],
  tools: [S("Open Work → Tools", "افتح الشغل ← الأدوات"), S("Writing, files, video — every tool in one place", "الكتابة والملفات والفيديو — كل الأدوات في مكان واحد")],
  improve: [S("“write me an email to my landlord” (rough)", "«اكتبلي إيميل لصاحب الشقة» (على السريع)"), S("A clear prompt that gets a far better answer", "طلب واضح بيجيب إجابة أحسن بكتير")],
  compress: [S("Paste a long text", "الزق نص طويل"), S("The same meaning in half the words", "نفس المعنى في نص الكلام")],
  humanize: [S("Paste text that sounds like a robot", "الزق كلام شكله كلام آلي"), S("The same text in a natural voice", "نفس الكلام بأسلوب طبيعي")],
  copilot: [S("Write anywhere with the Attune keyboard", "اكتب في أي حتة بكيبورد Attune"), S("Improve, translate or reply in one tap — offline", "حسّن أو ترجم أو رد بضغطة — من غير نت")],
  library: [S("Save a prompt that worked", "احفظ طلب نفع معاك"), S("Your own library to reuse it any time", "مكتبتك انت تستعمله أي وقت")],
  video: [S("Paste a video link", "الزق لينك فيديو"), S("Pick the quality and save it to your phone", "اختار الجودة واحفظه على موبايلك")],
  ask: [S("Ask a quick question the classic way", "اسأل سؤال سريع بالطريقة القديمة"), S("A short answer on one screen", "إجابة قصيرة في شاشة واحدة")],
  assistants: [S("“A tutor that only answers in Turkish”", "«مدرّس بيرد تركي بس»"), S("Your own assistant that keeps to it and learns", "مساعد بتاعك بيلتزم بكده وبيتعلّم")],
  skills: [S("Turn on “Contract checker”", "شغّل «مراجعة العقود»"), S("Chat gets that skill whenever it's needed", "الشات بياخد المهارة دي كل ما يحتاجها")],
  artifacts: [S("“Make me a budget table”", "«اعملي جدول ميزانية»"), S("A page you can open, edit and share", "صفحة تقدر تفتحها وتعدّلها وتشاركها")],
  studio: [S("“A watercolour of a felucca on the Nile”", "«لوحة ألوان مائية لفلوكة في النيل»"), S("A picture drawn on your phone's own chip", "صورة اترسمت على شريحة موبايلك")],
  code: [S("“A program that splits a bill between friends with the tip”", "«برنامج يقسم الحساب على الصحاب بالبقشيش»"), S("Written, tested and fixed on your phone", "اتكتب واتجرّب واتصلّح على موبايلك")],
  projects: [S("Make a project “Thesis”", "اعمل مشروع «الرسالة»"), S("Its chats and files together; decisions and dates kept", "شاتاته وملفاته مع بعض؛ والقرارات والمواعيد محفوظة")],
};

/** Where every feature's area is; null for a feature in no area. */
export const areaOf = (id) => (AREAS.find((a) => a.ids.includes(id)) || {}).id || null;

// ---- tried: the features the person has opened (only the ids, on this phone) ---------------------------------------------------
export const TRIED_KEY = "attune:guide:tried";
export function loadTried(store = typeof localStorage !== "undefined" ? localStorage : null) { try { const v = JSON.parse((store && store.getItem(TRIED_KEY)) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
const ALL = new Set(AREAS.flatMap((a) => a.ids));
/** A page was opened: remember it (once). */
export function markTried(id, store = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!ALL.has(id)) return false;
  const t = loadTried(store); if (t.includes(id)) return false;
  try { store.setItem(TRIED_KEY, JSON.stringify([...t, id])); } catch (e) { return false; }
  return true;
}
/** { tried, total } for an area (or everything), counting only the features this device has (`has`). */
export function progress(tried, areaId = null, has = () => true) {
  const ids = (areaId ? (AREAS.find((a) => a.id === areaId) || { ids: [] }).ids : [...ALL]).filter(has);
  return { tried: ids.filter((id) => tried.includes(id)).length, total: ids.length };
}

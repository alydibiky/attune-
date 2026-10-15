/* ---- v6.29 the privacy policy (Google Play needs one: health, location, microphone, notifications, payments).
   One text, shown in the app (mode "privacy", privacy-ui.jsx; also opened by Health Connect's "why this app reads your data")
   and published as docs/privacy-policy.html for the Play listing. Keep it TRUE: change it whenever what leaves the phone changes. */
export const PRIVACY_UPDATED = "15 October 2026";
export const PRIVACY = {
  en: [
    ["In one line", "Attune runs its AI on your device. There is no Attune account, no sign-in and no Attune server: your chats, money records, health data, notes and files stay on your device. We never sell or share your data."],
    ["What stays on your device", "Chats, the money ledger, debts and bills, medicines and lab results, food and workouts, period data, notes, documents you open, Scout goals and everything you type. The AI model runs on the phone or computer itself, so what you ask it is not sent anywhere."],
    ["When something leaves your device — only when you use these features", "Web lookup (Auto, you can switch it off in Engine): the search words go to a search engine (DuckDuckGo, Bing, Mojeek or Google News), and the pages found are read. Scout searches public ad sites the same way. Maps and places: the place you look for goes to the map and place search services. Exchange rates and food data: the currency or product you look up goes to those services. Downloads (AI models, maps, knowledge and food packs) come from Hugging Face and GitHub. These services receive the request like any website visit (your IP address); they do not receive your Attune data."],
    ["Health data (Health Connect, Huawei Health)", "If you allow it, Attune READS steps, calories burned, distance, heart rate and workouts to show them in Fit & Food. It never writes health data, never sends it off the device and never uses it for advertising. You can remove access at any time in Health Connect."],
    ["Payment notifications (optional)", "If you turn on \"Read my payment notifications\", Attune reads notifications from banking and wallet apps on the device to add payments to Money. Notifications that are not payments, and one-time codes (OTP), are ignored. Nothing is sent anywhere. You can switch it off at any time in Android's settings."],
    ["Microphone, camera, location", "The microphone is used only while you speak to Attune; the camera only when you take a photo for it; location only for Maps and Travel. None of them is recorded or sent in the background."],
    ["Purchases", "Pro and Business are bought through Google Play. Google handles the payment; Attune only learns which product you own."],
    ["Backups", "Android may back up the app's data to your own Google account (Google's backup), and Attune can save a backup file where you choose. Attune has no copy."],
    ["Children", "Attune is not directed at children under 13."],
    ["Deleting your data", "Delete any chat or record in the app, or uninstall Attune to remove everything from the device."],
    ["Changes and contact", "If this policy changes, the new version is shown here with its date. Questions: contact the developer through the address on Attune's Google Play page."],
  ],
  ar: [
    ["باختصار", "يعمل الذكاء الاصطناعي في Attune على جهازك. لا يوجد حساب في Attune ولا تسجيل دخول ولا خادم لـ Attune: محادثاتك وسجلات أموالك وبياناتك الصحية وملاحظاتك وملفاتك تبقى على جهازك. لا نبيع بياناتك ولا نشاركها أبدًا."],
    ["ما يبقى على جهازك", "المحادثات، ودفتر المال، والديون والفواتير، والأدوية ونتائج التحاليل، والطعام والتمارين، وبيانات الدورة، والملاحظات، والملفات التي تفتحها، وأهداف الكشّاف، وكل ما تكتبه. يعمل نموذج الذكاء الاصطناعي على الهاتف أو الحاسوب نفسه، فلا يُرسَل ما تسأله إلى أي مكان."],
    ["متى يخرج شيء من جهازك — فقط عند استخدام هذه الميزات", "البحث في الويب (تلقائي، ويمكن إيقافه من المحرك): تُرسَل كلمات البحث إلى محرك بحث (DuckDuckGo أو Bing أو Mojeek أو Google News) وتُقرأ الصفحات الناتجة. والكشّاف يبحث في مواقع الإعلانات العامة بالطريقة نفسها. الخرائط والأماكن: يُرسَل المكان الذي تبحث عنه إلى خدمات الخرائط والبحث عن الأماكن. أسعار العملات وبيانات الطعام: تُرسَل العملة أو المنتج الذي تبحث عنه. التنزيلات (نماذج الذكاء الاصطناعي والخرائط وحزم المعرفة والطعام) تأتي من Hugging Face وGitHub. تتلقى هذه الخدمات الطلب مثل أي زيارة لموقع (عنوان IP الخاص بك)، ولا تتلقى بياناتك في Attune."],
    ["البيانات الصحية (Health Connect وHuawei Health)", "إذا سمحت بذلك، يقرأ Attune الخطوات والسعرات المحروقة والمسافة ونبض القلب والتمارين لعرضها في اللياقة والطعام. لا يكتب بيانات صحية أبدًا، ولا يرسلها خارج الجهاز، ولا يستخدمها للإعلانات. يمكنك إلغاء الإذن في أي وقت من Health Connect."],
    ["إشعارات الدفع (اختياري)", "إذا فعّلت «قراءة إشعارات الدفع»، يقرأ Attune إشعارات تطبيقات البنوك والمحافظ على الجهاز لإضافة المدفوعات إلى المال. ويتجاهل الإشعارات التي ليست مدفوعات، ورموز التحقق لمرة واحدة (OTP). لا يُرسَل شيء إلى أي مكان. يمكنك إيقافها في أي وقت من إعدادات أندرويد."],
    ["الميكروفون والكاميرا والموقع", "يُستخدم الميكروفون فقط أثناء حديثك إلى Attune، والكاميرا فقط عند التقاط صورة له، والموقع فقط للخرائط والسفر. لا يُسجَّل أي منها ولا يُرسَل في الخلفية."],
    ["المشتريات", "يُشترى Pro والأعمال عبر Google Play. تتولى Google الدفع، ولا يعرف Attune إلا المنتج الذي تملكه."],
    ["النسخ الاحتياطي", "قد ينسخ أندرويد بيانات التطبيق احتياطيًا إلى حسابك في Google، ويمكن لـ Attune حفظ ملف نسخة احتياطية حيث تختار. لا توجد نسخة لدى Attune."],
    ["الأطفال", "Attune ليس موجّهًا للأطفال دون 13 عامًا."],
    ["حذف بياناتك", "احذف أي محادثة أو سجل من التطبيق، أو أزل تثبيت Attune لحذف كل شيء من الجهاز."],
    ["التغييرات والتواصل", "إذا تغيّرت هذه السياسة، تظهر النسخة الجديدة هنا مع تاريخها. للأسئلة: تواصل مع المطوّر عبر العنوان المذكور في صفحة Attune على Google Play."],
  ],
};

/* ---- v8.7 (Ali, 29 Oct: "some of the zakat settings were removed … and the other zakat calculators, restore them all"):
   the ledger's own "More Zakāt calculators" (camels, cattle, sheep, crops, trade goods, buried treasure, Zakāt al-Fiṭr) brought
   into Attune's Money. The rulings are the ledger's (web-src/yusr/index.new.html camelDue / cattleDue / sheepDue / runCalc),
   copied here unchanged — Attune shows them; it never decides a ruling itself.
   calc(kind, inputs, { nisab }) → { due: true|false, lines: [[n, key]…][] (livestock) | amount | kg, rate?, need? }
   Pure; tests: tests/unit/v870zakatcalc.test.mjs.                                                                            */
function bestCombo(n, big, small, bigName, smallName) {
  let best = -1, opts = [];
  for (let h = 0; h * big <= n; h++) for (let l = 0; h * big + l * small <= n; l++) { const cov = h * big + l * small; if (cov > best) { best = cov; opts = [[h, l]]; } else if (cov === best && !opts.some((o) => o[0] === h && o[1] === l)) opts.push([h, l]); }
  return opts.slice(0, 2).map(([h, l]) => { const r = []; if (h) r.push([h, bigName]); if (l) r.push([l, smallName]); return r; }).filter((r) => r.length);
}
export function camelDue(n) {
  if (n < 5) return null; if (n < 10) return [[1, "shah"]]; if (n < 15) return [[2, "shah"]]; if (n < 20) return [[3, "shah"]]; if (n < 25) return [[4, "shah"]];
  if (n < 36) return [[1, "bintMakhad"]]; if (n < 46) return [[1, "bintLabun"]]; if (n < 61) return [[1, "hiqqah"]]; if (n < 76) return [[1, "jadhaah"]];
  if (n < 91) return [[2, "bintLabun"]]; if (n < 121) return [[2, "hiqqah"]]; return bestCombo(n, 50, 40, "hiqqah", "bintLabun");
}
export function cattleDue(n) { if (n < 30) return null; if (n < 40) return [[1, "tabi"]]; if (n < 60) return [[1, "musinnah"]]; return bestCombo(n, 40, 30, "musinnah", "tabi"); }
export function sheepDue(n) { if (n < 40) return null; if (n < 121) return [[1, "shah"]]; if (n < 201) return [[2, "shah"]]; if (n < 400) return [[3, "shah"]]; return [[Math.floor(n / 100), "shah"]]; }

/** The names of what is given, as the ledger says them. */
export const ANIMALS = {
  shah: ["a sheep or goat", "شاة"], bintMakhad: ["a she-camel in her 2nd year (bint makhāḍ)", "بنت مخاض"], bintLabun: ["a she-camel in her 3rd year (bint labūn)", "بنت لبون"],
  hiqqah: ["a she-camel in her 4th year (ḥiqqah)", "حِقّة"], jadhaah: ["a she-camel in her 5th year (jadhaʿah)", "جذعة"],
  tabi: ["a one-year-old calf (tabīʿ)", "تبيع"], musinnah: ["a two-year-old cow (musinnah)", "مُسِنّة"],
};
export const KINDS = [
  ["camels", "🐪", "Camels", "الإبل"], ["cattle", "🐄", "Cattle", "البقر"], ["sheep", "🐑", "Sheep & goats", "الغنم"], ["crops", "🌾", "Crops & fruit", "الزروع والثمار"],
  ["trade", "🏪", "Trade goods", "عروض التجارة"], ["rikaz", "💎", "Buried treasure (rikāz)", "الركاز"], ["fitr", "🌙", "Zakāt al-Fiṭr", "زكاة الفطر"],
];
const n0 = (v) => { const x = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(x) ? x : 0; };
/** One calculator. inputs: livestock { head }; crops { kg, rain: true|false, nisabKg = 612 }; trade { stock, cash, owedToYou, youOwe };
 *  rikaz { value }; fitr { people, perPerson }. nisab = the money niṣāb today (the ledger's, from the gold / silver price). */
export function calc(kind, i = {}, { nisab = 0 } = {}) {
  if (kind === "camels" || kind === "cattle" || kind === "sheep") {
    const res = { camels: camelDue, cattle: cattleDue, sheep: sheepDue }[kind](Math.floor(n0(i.head)));
    if (!res) return { due: false };
    return { due: true, options: Array.isArray(res[0]) && Array.isArray(res[0][0]) ? res : [res] };
  }
  if (kind === "crops") {
    const kg = n0(i.kg), rate = i.rain === false ? 5 : 10, nis = n0(i.nisabKg) || 612;
    if (kg < nis) return { due: false, need: nis - kg, unit: "kg" };
    return { due: true, kg: Math.round(kg * rate) / 100, rate };
  }
  if (kind === "trade") {
    const net = n0(i.stock) + n0(i.cash) + n0(i.owedToYou) - n0(i.youOwe);
    if (!(nisab > 0)) return { due: false, noPrice: true };
    if (net < nisab) return { due: false, need: nisab - net, net };
    return { due: true, amount: Math.round(net * 2.5) / 100, rate: 2.5, net };
  }
  if (kind === "rikaz") return n0(i.value) > 0 ? { due: true, amount: Math.round(n0(i.value) * 20) / 100, rate: 20 } : { due: false, empty: true };   // no niṣāb, no year
  if (kind === "fitr") return n0(i.people) * n0(i.perPerson) > 0 ? { due: true, amount: Math.round(n0(i.people) * n0(i.perPerson) * 100) / 100 } : { due: false, empty: true };
  return { due: false };
}

/* v8.8 (Ali: "I want the Zakāt rulings for everything, like in the old app"): what the old ledger showed — each calculator's
   conditions, and for every ruling its evidence (the hadith / verse in Arabic, its meaning, and the source: Islamweb, Ibn Baz,
   al-Durar al-Saniyya) — copied from web-src/yusr/index.new.html EVID / *Note, unchanged; the English meanings added. */
export const NOTES = {
  camels: ["Conditions: they must be free-grazing (sāʾimah) for most of the year, held a full lunar year, and not working animals.", "الشروط: أن تكون سائمة ترعى أكثر الحول، ومضي الحول عليها، وألا تكون عاملة."],
  cattle: ["Conditions: they must be free-grazing (sāʾimah) for most of the year, held a full lunar year, and not working animals.", "الشروط: أن تكون سائمة ترعى أكثر الحول، ومضي الحول عليها، وألا تكون عاملة."],
  sheep: ["Conditions: they must be free-grazing (sāʾimah) for most of the year, held a full lunar year, and not working animals.", "الشروط: أن تكون سائمة ترعى أكثر الحول، ومضي الحول عليها، وألا تكون عاملة."],
  crops: ["No lunar year needed — due on harvest day. Each crop type counts on its own.", "لا يُشترط الحول — تجب يوم الحصاد. وكل صنف يُحسب وحده."],
  trade: ["Valued at today's selling price on your Zakāt date. Niṣāb is the same as gold; rate 2.5%.", "تُقوّم بسعر البيع يوم الزكاة. النصاب كنصاب الذهب والمقدار ٢٫٥٪."],
  rikaz: ["Pre-Islamic buried treasure (rikāz): 20%, with no niṣāb and no waiting year.", "الركاز (دفين الجاهلية): الخُمس ٢٠٪، بلا نصاب ولا حول."],
  fitr: ["One ṣāʿ (about 2.5–3 kg) of staple food per person, paid before the Eid prayer, for yourself and those you support.", "صاع (نحو ٢٫٥–٣ كجم) من قوت البلد عن كل فرد، تُخرج قبل صلاة العيد، عنك وعمن تعول."],
};
/** [key, en title, ar title, the text (Arabic, as the source has it), its meaning in English, the source (Arabic), the source in English] */
export const EVIDENCE = [
  ["nisab", "Niṣāb of gold & silver", "نصاب الذهب والفضة", "«لَيْسَ فِيمَا دُونَ خَمْسِ أَوَاقٍ صَدَقَةٌ»", "“There is no zakāh on less than five awāq (of silver).”",
    "متفق عليه. وخمس أواق = 200 درهم فضة ≈ 595 جم، ونصاب الذهب 20 مثقالاً ≈ 85 جم. (إسلام ويب، ابن باز)", "Bukhārī and Muslim. Five awāq = 200 silver dirhams ≈ 595 g; the gold niṣāb is 20 mithqāl ≈ 85 g. (Islamweb, Ibn Baz)"],
  ["hawl", "The lunar year (ḥawl)", "الحول", "«لَا زَكَاةَ فِي مَالٍ حَتَّى يَحُولَ عَلَيْهِ الْحَوْلُ»", "“No zakāh is due on wealth until a year has passed over it.”",
    "رواه أبو داود وابن ماجه. ويبدأ الحول من يوم بلوغ المال النصاب، ويُحسب بالأشهر القمرية. (إسلام ويب)", "Abū Dāwūd and Ibn Mājah. The year starts the day your wealth reaches the niṣāb and is counted in lunar months. (Islamweb)"],
  ["rate", "The rate: 2.5%", "المقدار: ربع العشر", "«فِي الرِّقَةِ رُبْعُ الْعُشْرِ»", "“On silver (money), one quarter of a tenth.”", "رواه البخاري. وربع العشر = 2.5%.", "Bukhārī. A quarter of a tenth = 2.5%."],
  ["camels", "Camels", "الإبل", "«لَيْسَ فِيمَا دُونَ خَمْسِ ذَوْدٍ صَدَقَةٌ» — وفي كتاب الصدقة: في خمسٍ شاة، وفي عشرٍ شاتان، وفي خمس عشرة ثلاث، وفي عشرين أربع، وفي خمسٍ وعشرين بنت مخاض…",
    "“There is no zakāh on fewer than five camels.” And in the Book of Ṣadaqah: for five, a sheep; for ten, two sheep; for fifteen, three; for twenty, four; for twenty-five, a bint makhāḍ…",
    "رواه البخاري من حديث أنس. والجدول عن الإمام النووي في المنهاج، نقله إسلام ويب (فتوى 31056).", "Bukhārī, from Anas. The table is Imam al-Nawawī's in al-Minhāj, quoted by Islamweb (fatwa 31056)."],
  ["cattle", "Cattle", "البقر", "أمر النبي ﷺ معاذًا أن يأخذ «مِنْ كُلِّ ثَلَاثِينَ بَقَرَةً تَبِيعًا أَوْ تَبِيعَةً، وَمِنْ كُلِّ أَرْبَعِينَ مُسِنَّةً»",
    "The Prophet ﷺ told Muʿādh to take “for every thirty cattle a one-year-old calf, and for every forty a two-year-old.”", "رواه أحمد وأصحاب السنن. (إسلام ويب، ابن باز)", "Aḥmad and the Sunan. (Islamweb, Ibn Baz)"],
  ["sheep", "Sheep & goats", "الغنم", "«فِي أَرْبَعِينَ شَاةً شَاةٌ… فَإِذَا زَادَتْ عَلَى مِائَةٍ وَعِشْرِينَ فَشَاتَانِ… فَإِذَا زَادَتْ عَلَى مِائَتَيْنِ فَثَلَاثُ شِيَاهٍ»",
    "“For forty sheep, one sheep… above one hundred and twenty, two… above two hundred, three.”", "رواه البخاري. ثم في كل مائة شاة. (الدرر السنية)", "Bukhārī. Then one for every hundred. (al-Durar al-Saniyya)"],
  ["saimah", "Grazing condition", "شرط السوم", "يُشترط أن تكون سائمة ترعى أكثر الحول، وأن يحول عليها الحول، وألا تكون عاملة.", "They must graze freely most of the year, be held a full year, and not be working animals.",
    "إسلام ويب (فتوى 31056). وخالف المالكية في العاملة فأوجبوا فيها الزكاة.", "Islamweb (fatwa 31056). The Mālikīs differ on working animals and make zakāh due on them."],
  ["crops", "Crops & fruit", "الزروع والثمار", "«فِيمَا سَقَتِ السَّمَاءُ وَالْعُيُونُ أَوْ كَانَ عَثَرِيًّا الْعُشْرُ، وَفِيمَا سُقِيَ بِالنَّضْحِ نِصْفُ الْعُشْرِ» — و«لَيْسَ فِيمَا دُونَ خَمْسَةِ أَوْسُقٍ صَدَقَةٌ»",
    "“What is watered by the sky and springs, or by itself: a tenth; what is watered by irrigation: half a tenth.” And “there is no zakāh on less than five awsuq.”",
    "رواه البخاري ومسلم. والخمسة أوسق = 300 صاع ≈ 612–672 كجم. ولا يُشترط الحول، بل تجب يوم الحصاد. (إسلام ويب)", "Bukhārī and Muslim. Five awsuq = 300 ṣāʿ ≈ 612–672 kg. No year is needed; it is due on harvest day. (Islamweb)"],
  ["trade", "Trade goods", "عروض التجارة", "«كَانَ رَسُولُ اللَّهِ ﷺ يَأْمُرُنَا أَنْ نُخْرِجَ الصَّدَقَةَ مِنَ الَّذِي نُعِدُّهُ لِلْبَيْعِ»", "“The Messenger of Allah ﷺ commanded us to pay zakāh on what we prepare for sale.”",
    "رواه أبو داود. وتُقوَّم بسعر السوق يوم وجوب الزكاة، ونصابها نصاب الذهب، ومقدارها 2.5%.", "Abū Dāwūd. Valued at the market price on the day zakāh is due; its niṣāb is gold's, and the rate 2.5%."],
  ["rikaz", "Buried treasure (rikāz)", "الركاز", "«وَفِي الرِّكَازِ الْخُمُسُ»", "“On buried treasure, one fifth.”", "متفق عليه. ولا يُشترط فيه نصاب ولا حول.", "Bukhārī and Muslim. No niṣāb and no year are required."],
  ["fitr", "Zakāt al-Fiṭr", "زكاة الفطر", "«فَرَضَ رَسُولُ اللَّهِ ﷺ زَكَاةَ الْفِطْرِ صَاعًا مِنْ تَمْرٍ أَوْ صَاعًا مِنْ شَعِيرٍ عَلَى الْعَبْدِ وَالْحُرِّ وَالذَّكَرِ وَالْأُنْثَى»",
    "“The Messenger of Allah ﷺ made Zakāt al-Fiṭr obligatory: a ṣāʿ of dates or a ṣāʿ of barley, on the slave and the free, male and female.”", "متفق عليه. والصاع ≈ 2.5–3 كجم، وتُخرج قبل صلاة العيد.", "Bukhārī and Muslim. A ṣāʿ ≈ 2.5–3 kg, paid before the Eid prayer."],
  ["asnaf", "The eight recipients", "مصارف الزكاة الثمانية", "﴿إِنَّمَا الصَّدَقَاتُ لِلْفُقَرَاءِ وَالْمَسَاكِينِ وَالْعَامِلِينَ عَلَيْهَا وَالْمُؤَلَّفَةِ قُلُوبُهُمْ وَفِي الرِّقَابِ وَالْغَارِمِينَ وَفِي سَبِيلِ اللَّهِ وَابْنِ السَّبِيلِ﴾",
    "“Zakāh is only for the poor, the needy, those who collect it, those whose hearts are to be reconciled, freeing captives, those in debt, in the cause of Allah, and the traveller.”", "سورة التوبة: 60", "Sūrat al-Tawbah 9:60"],
  ["jewelry", "Worn jewellery", "الحلي الملبوس", "اختلف العلماء: فالحنفية يوجبون الزكاة في حلي الذهب والفضة ولو كان للاستعمال، والجمهور (المالكية والشافعية والحنابلة) لا يوجبونها في الحلي المباح المُعدّ للُّبس.",
    "Scholars differ: the Ḥanafīs make zakāh due on gold and silver jewellery even when worn; the majority (Mālikīs, Shāfiʿīs, Ḥanbalīs) do not, for permitted jewellery kept for wearing.", "إسلام ويب. واختيار المذهب في الإعدادات يضبط هذا.", "Islamweb. Your school in Zakāt settings sets this."],
  ["dip", "Dropping below the niṣāb", "النقص عن النصاب أثناء الحول", "إذا نقص المال عن النصاب في أثناء الحول انقطع الحول، فإذا بلغ النصاب مرة أخرى استُؤنف حول جديد.",
    "If your wealth drops below the niṣāb during the year, the year is broken; when it reaches the niṣāb again, a new year starts.", "قول جمهور العلماء، وهو المفتى به عند إسلام ويب.", "The majority view, and Islamweb's fatwa."],
];
/** Which rulings each calculator rests on. */
export const EVIDENCE_OF = { camels: ["camels", "saimah", "hawl"], cattle: ["cattle", "saimah", "hawl"], sheep: ["sheep", "saimah", "hawl"], crops: ["crops"], trade: ["trade", "nisab", "rate", "hawl"], rikaz: ["rikaz"], fitr: ["fitr"] };

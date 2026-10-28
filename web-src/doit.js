/* ---- v6.28 "Do it from Home" — type (or say) it once, it happens in the right tool (Ali: "when I'm too lazy to do anything I just
   type on the Home page 'I ate that for breakfast' and it happens in the food app — apply this for the whole app").
   CODE reads the sentence with each tool's own reader (no new guessing): food → Fit & Food (fitread.readMealText), money → Money
   (yusr/logtext.readLocal), a reminder / alarm / timer (actions.quickAction), a debt or installment → People & plans (life.parseLife),
   a deadline → Deadline Radar (deadlines.chatDeadlineIntent), water / weight / a workout → Fit, a dose taken / blood sugar → Family
   health, a period → Cycle, a note → Mind, a question about your own data → Ask your life. One sentence can do two things
   ("koshary for lunch, 80 pounds" → Fit AND Money). Anything else goes to Chat, as before.
   understand(text, ctx) → { actions: [{ kind, ... }], ask?: answer, chat?: true }   (pure)
   apply(action, stores, ctx) → { stores: { key: newValue }, done: { en, ar }, open }   (pure; the page writes the keys, keeps the old
   values for Undo, and does what code can't do alone: schedule a reminder, file a note in Mind, log a period).
   Tests: tests/unit/v731doit.test.mjs, tests/e2e_v731doit.py.                                                                    */
import { readMealText } from "./fitread.js";
import { readLocal, CAT_WORDS } from "./yusr/logtext.js";
import { quickAction, looksLikeAction } from "./actions.js";
import { chatLifeIntent, addCommitment, scheduleOf, payAmount, togglePaid, progressOf } from "./life.js";
import { chatDeadlineIntent, addDeadline } from "./deadlines.js";
import { EXERCISES, burned, today as fitToday } from "./fit.js";
import { markTaken, addGlucose, isInsulin, isoDay } from "./care.js";
import { appendToLedger } from "./paylog.js";
import { chatAsk, askLife } from "./lifeask.js";
import { homeCurrency } from "./locale.js";
import { savedCountry } from "./country.js";

const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/٫/g, ".");
const fold = (s) => latin(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه").toLowerCase();
const num = (v) => (Math.round(v * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });

// ---- the words ----------------------------------------------------------------------------------------------------------------------
const QUESTION = /[?؟]\s*$|^(how|what|who|when|which|where|why|is|are|did|do|does|can|should|show|list|tell me)\b|^(كام|ايه|إيه|مين|امتى|إمتى|امتي|فين|هل|ليه|ازاي|إزاي)(?![؀-ۿ])/i;
const EAT = /\b(ate|eat|eaten|had|have|having|breakfast|lunch|dinner|supper|snack|drank|ate for)\b|اكلت|أكلت|كلت|فطرت|اتغديت|اتعشيت|فطار|فطاري|غدا|غدايا|عشا|عشايا|سناك|تصبيره/i;
const MEAL_OF = [["breakfast", /\bbreakfast\b|فطار|فطرت|الصبح/i], ["lunch", /\blunch\b|غدا|اتغديت|الضهر|الظهر/i], ["dinner", /\b(dinner|supper)\b|عشا|اتعشيت|بالليل/i], ["snacks", /\bsnacks?\b|سناك|تصبيره/i]];
const MONEY_VERB = /\b(spent|spend|paid|pay|bought|buy|cost|costs|received|got paid|got|earned|salary|refund|sold|transferred|sent|da3et|dafa3t|dafa3et|saraft|sraft|shtaret|eshtaret|2abadt|abadt)\b|صرفت|دفعت|اشتريت|بكام|قبضت|المرتب|مرتبي|استلمت|حولت|بعت فلوس|اخدت فلوس/i;
const CURRENCY = /\b(egp|le|l\.e|pounds?|usd|dollars?|eur|euros?|sar|riyals?|aed|dirhams?|kd|qr)\b|\$|€|£|جنيه|جنية|ج\.م|ريال|درهم|دولار|يورو/i;
const WATER = /(\d+(?:\.\d+)?|a|an|one|two|three|four|five|half|كوبايه|كوبايتين|كوب|كاسه|ازازه|نص|واحد|اتنين|تلاته|اربعه|خمسه)?\s*(glass(?:es)?|cups?|bottles?|litres?|liters?|l|ml|كوب|كوبايه|كوبايات|كوبايتين|كاسات|كاسه|ازازه|ازايز|لتر|مل)?\s*(?:of\s+)?(water|(?<![ء-ي])(?:و|ال|بال|وال)?(?:مي[هة]|مياه|ماء)(?![ء-ي]))/i;   // («طعمية» is not water — persona 9)
const WEIGHT = /\b(weigh|weighs|weighed|weight|scale)\b|وزني|وزنت|الميزان/i;
const WORKOUT = [["walk-brisk", /\b(brisk walk|power walk)\b|مشي سريع/i], ["walk", /\b(walk|walked|walking|steps)\b|مشيت|مشي|اتمشيت/i], ["run-8", /\b(ran|run|running|jog|jogged|jogging)\b|جريت|جري/i],
  ["cycle", /\b(cycled|cycling|bike ride|biked)\b|عجله|عجلة|بسكلته/i], ["swim", /\b(swam|swim|swimming)\b|عومت|سباحه|عوم/i], ["football", /\b(football|soccer)\b|كوره|ماتش/i], ["padel", /\b(padel|tennis)\b|بادل|تنس/i],
  ["yoga", /\byoga\b|يوجا/i], ["hiit", /\b(hiit|circuit|crossfit)\b|كروس فيت/i], ["rope", /\b(jump rope|skipping)\b|نط الحبل/i], ["weights", /\b(gym|weights|lifted|lifting|worked out|workout|training|trained)\b|جيم|حديد|اتمرنت|تمرين/i]];
const DOSE = /\b(took|taken|take|had)\b[^.]{0,30}\b(pills?|tablets?|meds?|medicine|medication|dose|insulin|shot|injection)\b|\b(took|taken)\s+my\b|خدت|اخدت|أخدت|خدت الدوا|اخدت الحقنه|ضربت الحقنه|خدت الانسولين|خدت الإنسولين/i;
const SUGAR = /\b(blood sugar|glucose|sugar(?: level| reading| was| is)?)\b|سكري|السكر|قست السكر|نسبه السكر/i;
const NOTE = /^(note|remember|keep in mind|save this|write down)\b[:\s]|^(افتكر|خلي في بالك|احفظ|سجل ملاحظه|ملاحظه)\s*[:\s]/i;
const EVENT = /\b(meeting|appointment|dentist|doctor'?s?|interview|call with|call|visit|pick up|collect|meet|class|lesson|exam|flight|match)\b|اتصل|كلم|اكلم|زياره|زيارة|اقابل|اجيب|اروح|ميعاد|موعد|معاد|اجتماع|دكتور|الدكتور|امتحان|مقابله|مقابلة|درس|طياره|طيارة/i;
// v8.6: «سكر 110», "sugar 140 this morning" — a reading, not 110 g of sugar (no grams / spoons after the number)
const SUGAR_N = /(^|\s)(سكر|sugar)\s*[:=]?\s*\d{2,3}(?:\.\d)?(?!\s*(?:g\b|gm|gr|grams?|جم|جرام|معلق|spoons?|tsp|tbsp|cubes?|مكعب))/i;
// v8.6: "milk tomorrow", «فراخ بكرة» — something for later is not eaten now
const FUTURE = /\b(tomorrow|tonight|next (week|month)|later|need to buy|to buy)\b|بكره|بكرة|بعدين|الاسبوع الجاي|الأسبوع الجاي|محتاج اشتري|لازم اشتري/i;
const PERIOD = /\b(period|menstruation|my cycle)\b|الدوره|الدورة|البيريود/i;

function minutesIn(t) {
  const s = fold(t);
  if (/نص ساعه|half (an )?hour|30 ?min/.test(s)) return 30;
  if (/ربع ساعه|quarter (of an )?hour/.test(s)) return 15;
  if (/ساعه ونص|an hour and a half|1\.5 ?h/.test(s)) return 90;
  let m = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|ساعه|ساعات|ساعتين)/.exec(s); if (m) return Math.round(+m[1] * 60);
  if (/ساعتين|two hours/.test(s)) return 120;
  if (/(^|\s)(an? hour|one hour|ساعه)(\s|$)/.test(s)) return 60;
  m = /(\d+)\s*(m|min|mins|minutes?|دقيقه|دقايق|دقائق)/.exec(s); if (m) return +m[1];
  m = /(\d+(?:\.\d+)?)\s*(km|كيلو)/.exec(s); if (m) return null;   // a distance: worked out by the caller
  return null;
}
function mealOf(t, now) {
  for (const [m, re] of MEAL_OF) if (re.test(t)) return m;
  const h = new Date(now).getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 22 ? "dinner" : "snacks";
}
function waterMl(t) {
  const m = WATER.exec(fold(t)); if (!m) return 0;
  const W = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5, "نص": 0.5, "واحد": 1, "اتنين": 2, "تلاته": 3, "اربعه": 4, "خمسه": 5, "كوبايتين": 2 };
  const q = m[1] == null ? 1 : W[m[1]] != null ? W[m[1]] : +m[1] || 1;
  const unit = m[2] || (m[1] === "كوبايتين" ? "كوب" : "glass");
  if (/^(l|litres?|liters?|لتر)$/.test(unit)) return Math.round(q * 1000);
  if (/^(ml|مل)$/.test(unit)) return Math.round(q);
  if (/^(bottles?|ازازه|ازايز)$/.test(unit)) return Math.round(q * 500);
  return Math.round((m[1] === "كوبايتين" ? 2 : q) * 250);
}

/** Persona 9 (a year of daily use, 28 Oct): "vegetables 460", «خضار 415», "koshari 85" were logged as a 300 g mahshi, a vegetable
    soup, a 450 g koshari — the number thrown away. When the food reader can't use the number (not the grams it took — a "count" of 460 vegetables is not one),
    the number is the price. "rice 200" (200 g taken) stays food. */
function numLost(t) {
  const n = +latin(t).replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0];
  if (!(n >= 20)) return false;
  const items = readMealText(t).items.filter((x) => x.kcal != null);
  return items.length > 0 && !items.some((x) => Math.abs((x.grams || 0) - n) < 1);
}
/** What the sentence asks Attune to do. ctx: { now, stores } */
export function understand(text, { now = Date.now(), stores = {} } = {}) {
  const t = String(text || "").trim();
  if (!t) return { actions: [] };
  // a question: about your own data → answered here; otherwise → Chat
  if (QUESTION.test(t) && !looksLikeAction(t)) {
    const a = chatAsk(t, stores, { now }) || (() => { const r = askLife(t, stores, { now }); return r && r.kind !== "search" ? r : null; })();
    return a ? { actions: [], ask: a } : { actions: [], chat: true };
  }
  if (NOTE.test(t)) return { actions: [{ kind: "note", text: t.replace(NOTE, "").trim() || t }] };
  // a reminder / alarm / timer
  if (looksLikeAction(t) && /remind|alarm|wake me|timer|فكرني|ذكرني|صحيني|منبه|تايمر|نبهني/i.test(t)) {
    const a = quickAction(t, now);
    if (a && ["reminder", "alarm", "timer"].includes(a.kind) && !a.problems.length) return { actions: [{ kind: "reminder", action: a }] };
    return { actions: [], chat: true };
  }
  // v8.6 (the whole-app test): "meeting with Ali Tuesday 3pm", «ميعاد الدكتور بكرة الساعة 5» — an appointment with a day and a time
  // is a reminder even without "remind me" (it did nothing before)
  if (EVENT.test(t) && /\d/.test(latin(t)) && !MONEY_VERB.test(t) && !/\b(last|yesterday|ago|was)\b|امبارح|اللي فات|من يومين/i.test(t) && (/\b(today|tonight|tomorrow|mon|tue|wed|thu|fri|sat|sun)\w*\b|\d{1,2}\s*(am|pm|:\d{2})|الساعه|الساعة|النهارده|بكره|بكرة|السبت|الحد|الاحد|الاتنين|التلات|الاربع|الخميس|الجمعه|الجمعة/i.test(t))) {
    const a = quickAction((/[\u0600-\u06ff]/.test(t) ? "فكرني " : "remind me ") + t, now);
    if (a && a.kind === "reminder" && !a.problems.length) return { actions: [{ kind: "reminder", action: a }] };
  }
  if (PERIOD.test(t)) return { actions: [{ kind: "period", text: t }] };
  // blood sugar
  if ((SUGAR.test(t) || SUGAR_N.test(latin(t))) && !/hba1c|a1c|التراكمي/i.test(t)) {
    const m = /(\d+(?:\.\d+)?)\s*(mmol|mg)?/i.exec(latin(t));
    if (m) { const v = +m[1], unit = /mmol/i.test(t) || (v < 35 && !/mg/i.test(t)) ? "mmol/L" : "mg/dL"; if ((unit === "mg/dL" && v >= 20 && v <= 600) || (unit === "mmol/L" && v >= 1 && v <= 33)) return { actions: [{ kind: "sugar", value: v, unit }] }; }
  }
  // a dose taken
  if (DOSE.test(t)) {
    const meds = ((stores.care && stores.care.meds) || []).filter((m) => !m.stopped);
    const f = fold(t);
    const med = meds.find((m) => f.includes(fold(m.name).split(/\s+/)[0])) || (/insulin|انسولين|الحقنه/.test(f) ? meds.find(isInsulin) : null) || (meds.length === 1 ? meds[0] : null);
    if (med) return { actions: [{ kind: "dose", medId: med.id, name: med.name }] };
  }
  // weight
  if (WEIGHT.test(t)) {
    const m = /(\d{2,3}(?:\.\d+)?)/.exec(latin(t));
    // v8.6: "I weigh 200 lbs" was saved as 200 kg; "weight 920" became a 920 EGP expense
    const lbs = /\b(lbs?|pounds?)\b|رطل/i.test(t) && !/(egp|جنيه)/i.test(t), kg = m ? Math.round((lbs ? +m[1] * 0.4536 : +m[1]) * 10) / 10 : 0;
    if (m && kg > 25 && kg < 400) return { actions: [{ kind: "weight", kg }] };
    if (m) return { actions: [], ask: { kind: "check", en: `${m[1]}${lbs ? " lb" : " kg"} doesn't look like a body weight — write it again (e.g. "weight 92.5" or "200 lbs").`, ar: `${m[1]} مش شكل وزن — اكتبه تاني (مثلًا «وزني 92.5»).` } };
  }
  const actions = [];
  // water (it can come with food: "eggs and 2 glasses of water")
  // (a water BILL is money, not a drink — «دفعت فاتورة المية 200», "water bill 300")
  const ml = /\b(bill|bills)\b|فاتور|فواتير/i.test(t) ? 0 : waterMl(t);
  // a workout
  const w = WORKOUT.find(([, re]) => re.test(t));
  if (w && !EAT.test(t)) {
    let min = minutesIn(t);
    const km = /(\d+(?:\.\d+)?)\s*(km|كيلو)/i.exec(latin(t));
    if (!min && km) min = Math.round(+km[1] * (w[0] === "walk" || w[0] === "walk-brisk" ? 12 : w[0] === "cycle" ? 3 : 7.5));
    if (min && min > 0 && min <= 600) return { actions: [{ kind: "workout", id: w[0], minutes: min }, ...(ml ? [{ kind: "water", ml }] : [])] };
  }
  // v8.6 (the 2-month test): "Ahmed paid me back 1000" / «أحمد رجعلي 1000» — the money comes in AND Ahmed's debt goes down
  { const lifeItems = (stores.life && stores.life.items) || [], first = (s) => fold(s || "").split(/\s+/)[0];
    const mo = /^\s*(?:i\s+)?(?:paid|gave|returned|paid back)\s+(?:back\s+)?(?:([\d٠-٩][\d٠-٩,.]*)\s+(?:egp\s+|le\s+|pounds?\s+)?to\s+(?:the\s+|my\s+)?([\p{L}]+)|(?:the\s+|my\s+)?([\p{L}]+)\s+([\d٠-٩][\d٠-٩,.]*))|^\s*(?:سددت|رجعت|دفعت)\s+(?:ل|لـ)\s*([\p{L}]+)\s+([\d٠-٩][\d٠-٩,.]*)/iu.exec(t);
    if (mo) { const who = mo[2] || mo[3] || mo[5], amt = +latin(mo[1] || mo[4] || mo[6] || "0").replace(/,/g, "");
      const c = lifeItems.find((x) => x.dir !== "in" && first(x.person || x.title) === first(who));
      if (c && amt) return { actions: [{ kind: "repay", id: c.id, who: c.person || who, amount: amt }, { kind: "money", items: [{ type: "expense", amount: amt, cat: "other", note: (c.person || who) + (/[\u0600-\u06ff]/.test(t) ? " — سداد" : " — paid back"), date: isoDay(now) }] }] }; }
    const mi = /^\s*([\p{L}]+)\s+(?:paid|gave me|sent me|transferred)\s+(?:me\s+)?([\d٠-٩][\d٠-٩,.]*)/iu.exec(t);
    if (mi && !/^(i|we|you)$/i.test(mi[1])) { const c = lifeItems.find((x) => x.dir === "in" && first(x.person || x.title) === first(mi[1]));
      if (c) { const amt = +latin(mi[2]).replace(/,/g, ""); return { actions: [{ kind: "repay", id: c.id, who: c.person || mi[1], amount: amt }, { kind: "money", items: [{ type: "income", amount: amt, cat: "other", note: (c.person || mi[1]) + " paid back", date: isoDay(now) }] }] }; } } }
  { const m = /^\s*([\p{L}]+(?:\s[\p{L}]+)?)\s+(?:paid me back|paid back|returned|gave me back|settled|رجعلي|رجّعلي|سددلي|سدد|دفعلي|ادالي|اداني)\s*([\d٠-٩][\d٠-٩,.]*)?/iu.exec(t);
    if (m) { const who = m[1].trim(), amt = m[2] ? +latin(m[2]).replace(/,/g, "") : 0;
      const items = ((stores.life && stores.life.items) || []).filter((c) => c.dir === "in" && fold(c.person || c.title || "").split(/\s+/)[0] === fold(who).split(/\s+/)[0]);
      if (items.length || amt) return { actions: [...(items.length ? [{ kind: "repay", id: items[0].id, who, amount: amt }] : []), ...(amt ? [{ kind: "money", items: [{ type: "income", amount: amt, cat: "other", note: who + (/[\u0600-\u06ff]/.test(t) ? " رجّع" : " paid back"), date: isoDay(now) }] }] : [])] }; } }
  // v8.6 (the 2-month test: "electricity bill 650 due on the 10th" became a 10 EGP expense): a bill with its due day is a bill to
  // pay — every month on that day, in People & plans — and its amount is the money, not the day
  { const due = /\b(?:due|by)\b(?:\s+on)?(?:\s+the)?\s+(\d{1,2})(?:st|nd|rd|th)?\b|(?:يستحق|ميعاده|ميعادها|بتتدفع)\s*(?:يوم)?\s*([\d٠-٩]{1,2})/i.exec(latin(t));
    if (due && /\b(bill|electricity|water|internet|phone|gas|rent|school|fees|subscription|insurance)\b|فاتور|كهربا|ميه|مياه|نت|غاز|ايجار|إيجار|مصاريف|اشتراك|تأمين/i.test(t)) {
      const day = +(due[1] || latin(due[2] || "")), amt = Math.max(0, ...latin(t).replace(due[0], " ").match(/\d[\d,]*(?:\.\d+)?/g)?.map((x) => +x.replace(/,/g, "")) || [0]);
      if (amt > 0 && day >= 1 && day <= 31) { const c = chatLifeIntent(latin(t).replace(due[0], " ").replace(/\s+/g, " ").trim() + " every month on the " + day + "th"); if (c) return { actions: [{ kind: "life", c: { ...c, amount: amt } }] }; }
    } }
  // a debt / installment / savings circle — and a deadline
  const life = chatLifeIntent(t);
  // persona 9 (a year of daily use): "netflix 250" typed every month made 12 Netflix subscriptions (Safe to spend took all 12 off).
  // A subscription that is already there is paid this month: the money goes out, the plan's payment is ticked.
  if (life && life.kind === "subscription") {
    const nm = (c) => fold(String(c.person || c.title || c.name || "")).trim();
    const same = ((stores.life && stores.life.items) || []).find((c) => c.kind === "subscription" && nm(c) && nm(c) === nm(life));
    if (same) { const amt = life.amount || same.amount || 0, who = same.person || same.title || same.name;
      return { actions: [{ kind: "repay", id: same.id, who, amount: amt, plan: true }, ...(amt ? [{ kind: "money", items: [{ type: "expense", amount: amt, cat: "bills", note: who, date: isoDay(now) }] }] : [])] }; }
  }
  if (life) return { actions: [{ kind: "life", c: life }] };
  const dl = chatDeadlineIntent(t, { now });
  if (dl) return { actions: [{ kind: "deadline", d: dl }] };
  // v8.6 (the 2-month test: "fuel 500" was logged as FOOD — ful medames — and "maid 400" went to Chat): a spending word or just
  // "something + an amount" is money, unless it was eaten ("ate", «اكلت») — the food reader must not take "fuel" for «فول»
  { const hasNum = /\d/.test(latin(t)), catHit = Object.entries(CAT_WORDS).some(([k, re]) => !["food", "groceries", "coffee", "salary"].includes(k) && re.test(t));
    const short = /^\s*[\p{L}][\p{L}\s'’-]{1,30}\s+[\d٠-٩][\d٠-٩,.]*\s*(?:egp|le|pounds?|جنيه|ج)?\s*$|^\s*[\d٠-٩][\d٠-٩,.]*\s*(?:egp|le|pounds?|جنيه|ج)?\s+[\p{L}][\p{L}\s'’-]{1,30}$/iu.test(t);
    if (hasNum && !EAT.test(t) && !ml && !WEIGHT.test(t) && !/شربت|drank/.test(t) && (catHit || (short && !readMealText(t).items.some((x) => x.kcal != null && !/^(ful|ful-sandwich)$/.test(x.id) || false)) || (short && numLost(t)))) {
      const r = readLocal(t, { today: isoDay(now) }); const lost = short && numLost(t);
      const items = r.items.filter((x) => x.amount >= 1).map((x) => (lost && x.cat === "other" ? { ...x, cat: "food" } : x));
      if (items.length) return { actions: [{ kind: "money", items }] };
    } }
  // food (and money spent on it)
  // (the water phrase is taken out first — "2 glasses of water" is water, not food: "glasses" read as molasses)
  const rest = ml ? fold(t).replace(WATER, " ") : t;
  // v6.43 (Ali's "I had koshari for lunch and paid 85 pounds"): the part about money is not food — the food reader reads only
  // the other parts (it said "Not found: paid pounds")
  const parts = rest.split(/\s*(?:,|،|;|\band then\b|\bthen\b|\band\b|\s+و(?=\s*(?:دفعت|صرفت|اشتريت|بـ?\d))|\s+و\s+)\s*/i).filter(Boolean);
  const isMoney = (x) => MONEY_VERB.test(x) || (CURRENCY.test(x) && /\d/.test(latin(x)));
  const foodText = parts.length > 1 && parts.some(isMoney) && parts.some((x) => !isMoney(x)) ? parts.filter((x) => !isMoney(x)).join(", ") : rest;
  const meal = readMealText(foodText);
  const foods = (meal.items || []).filter((x) => x.kcal != null);
  const money = MONEY_VERB.test(rest) || CURRENCY.test(rest);
  const today = isoDay(now);
  if (foods.length && FUTURE.test(t) && !EAT.test(t)) return { actions: [], chat: true };
  if (foods.length && (EAT.test(t) || !money)) {
    // the eaten foods are counted; a price said with them ("80 pounds") is the money part
    actions.push({ kind: "food", meal: mealOf(t, now), items: foods, unknown: meal.unknown || [] });
    if (money) { const r = readLocal(t, { today }); const it = r.items.filter((x) => x.amount >= 1)[0];
      // (the expense is named after what was eaten: "Koshari", not "paid 85 pounds")
      const named = foods.map((x) => x.name.replace(/\s*\(.*\)$/, "")).slice(0, 3).join(", ");
      // v8.6 ("spent 200 on lunch and 50 on coffee and 30 tip" kept only the 200): every amount said is its own expense
      const all = r.items.filter((x) => x.amount >= 1);
      if (all.length > 1) actions.push({ kind: "money", items: all.map((x) => ({ ...x, cat: x.cat === "other" && x === all[0] ? "food" : x.cat })) });
      else if (it) actions.push({ kind: "money", items: [{ ...it, amount: it.amount, cat: it.cat === "other" ? "food" : it.cat, note: foodText !== rest && named ? named : it.note }] }); }
  } else if (money || Object.entries(CAT_WORDS).some(([k, re]) => k !== "food" && re.test(rest))) {
    const r = readLocal(rest, { today });
    const items = r.items.filter((x) => x.amount >= 1);
    if (items.length) actions.push({ kind: "money", items });
  }
  if (ml && !actions.some((a) => a.kind === "water")) actions.push({ kind: "water", ml });
  return actions.length ? { actions } : { actions: [], chat: true };
}

// ---- doing it ------------------------------------------------------------------------------------------------------------------------
const MEAL_AR = { breakfast: "الفطار", lunch: "الغداء", dinner: "العشاء", snacks: "السناكس" };
const EMPTY_DAY = { meals: {}, water: 0, workouts: [] };
/** The same empty money book Money (Yusr) makes on its first open — Yusr fills in the rest of its settings when it loads it. */
export function starterLedger(now = Date.now()) {
  const cur = homeCurrency(null), c = (savedCountry() || "").toUpperCase();
  return { lang: "en", premium: { active: false }, theme: "midnight", ui: { accent: "", fs: "m", tabs: { trends: 1, accounts: 1, goals: 1, notes: 1, zakat: 1, bills: 1 }, title: "Yusr", period: "month", dec: 1, wk: "mon" },
    country: c, currency: cur, pin: null, accounts: [{ id: "a" + now.toString(36), name: "Cash", emoji: "💵", currency: cur, start: 0 }], txns: [], budgets: { overall: 0, cats: {} },
    recurring: [], customCats: [], goals: [], debts: [], projects: [] };
}
/** Apply one action to the stores → { stores: { key: value }, done: { en, ar }, open, need?: "reminder" | "note" | "period" | "money-setup" } */
export function apply(a, stores, { now = Date.now() } = {}) {
  const day = fitToday(new Date(now));
  const fit = stores.fit || { profile: null, days: {}, weights: [] };
  const fitDay = (fn) => ({ ...fit, days: { ...(fit.days || {}), [day]: fn({ ...EMPTY_DAY, ...((fit.days || {})[day] || {}) }) } });
  switch (a.kind) {
    case "food": {
      const items = a.items.map(({ alts, box, readBase, ...x }) => ({ ...x, t: now }));   // v8.6: no swap lists kept (storage)
      const kcal = Math.round(items.reduce((s, x) => s + (x.kcal || 0), 0));
      const names = items.map((x) => x.name), namesAr = items.map((x) => x.ar || x.name);
      const left = a.unknown && a.unknown.length ? a.unknown.join(", ") : "";
      return { stores: { "attune:fit:v1": fitDay((d) => ({ ...d, meals: { ...d.meals, [a.meal]: [...((d.meals || {})[a.meal] || []), ...items] } })) }, open: "fit",
        done: { en: `Logged for ${a.meal}: ${names.join(", ")} — ${kcal} kcal.${left ? ` Not found: ${left} (add it in Fit & Food).` : ""}${fit.profile ? "" : " Set up Fit & Food once to see it against your goal."}`, ar: `سُجّل في ${MEAL_AR[a.meal]}: ${namesAr.join("، ")} — ${kcal} سعر.${left ? ` لم يُعرف: ${left} (أضفه في اللياقة والطعام).` : ""}${fit.profile ? "" : " أعدّ اللياقة والطعام مرة واحدة لترى هدفك."}` } };
    }
    case "water": {
      const nd = fitDay((d) => ({ ...d, water: (d.water || 0) + a.ml }));
      return { stores: { "attune:fit:v1": nd }, open: "fit", done: { en: `Water +${a.ml} ml — ${(nd.days[day].water / 1000).toFixed(2).replace(/0$/, "")} L today.`, ar: `ماء +${a.ml} مل — ${(nd.days[day].water / 1000).toFixed(2).replace(/0$/, "")} لتر اليوم.` } };
    }
    case "weight":
      return { stores: { "attune:fit:v1": { ...fit, weights: [...(fit.weights || []).filter((x) => x.d !== day), { d: day, kg: a.kg }], profile: fit.profile ? { ...fit.profile, kg: a.kg } : fit.profile } }, open: "fit",
        done: { en: `Weight saved: ${a.kg} kg.`, ar: `حُفظ الوزن: ${a.kg} كجم.` } };
    case "workout": {
      const ex = EXERCISES.find((e) => e.id === a.id) || EXERCISES[0];
      const kg = (fit.profile && fit.profile.kg) || 70, kcal = burned(ex.met, kg, a.minutes);
      return { stores: { "attune:fit:v1": fitDay((d) => ({ ...d, workouts: [...(d.workouts || []), { name: ex.en, min: a.minutes, kcal, t: now }] })) }, open: "fit",
        done: { en: `Workout logged: ${ex.en}, ${a.minutes} min — about ${kcal} kcal burned.`, ar: `سُجّل التمرين: ${ex.ar}، ${a.minutes} دقيقة — حرقت نحو ${kcal} سعر.` } };
    }
    case "money": {
      // v8.6 (the first-day test: "spent 250 on lunch" on Home opened Money and recorded NOTHING — the money book only exists after
      // Money is opened once): a new person's first entry starts the book here, with one Cash account in their own currency
      const ledger = stores.ledger || starterLedger(now);
      const r = appendToLedger(ledger, a.items, now);
      const sum = a.items.reduce((s, x) => s + x.amount, 0), cur = ledger.currency || "";
      const out = a.items.every((x) => x.type === "expense");
      return { stores: { "ledger.v3": r.ledger }, open: "money",
        done: { en: `${out ? "Expense" : "Money"} added: ${num(sum)} ${cur} — ${a.items.map((x) => x.note || x.cat).join(", ")}.`, ar: `${out ? "أُضيف مصروف" : "أُضيف مبلغ"}: ${num(sum)} ${cur} — ${a.items.map((x) => x.note || x.cat).join("، ")}.` } };
    }
    case "repay": {
      // the amount goes against what is still owed (life.js payAmount on the first unpaid payment; the rest is worked out again)
      const life = stores.life || { items: [] }, c = (life.items || []).find((x) => x.id === a.id);
      if (!c) return { stores: {}, done: { en: "", ar: "" } };
      const s = scheduleOf(c, now), nx = s.find((x) => !x.paid); if (!nx) return { stores: {}, open: "life", done: { en: `${a.who} had nothing left to pay.`, ar: `${a.who} مكانش عليه حاجة.` } };
      const next = a.amount ? payAmount(life, c.id, nx.i, a.amount) : togglePaid(life, c.id, nx.i);
      const left = progressOf(next.items.find((x) => x.id === c.id), now).left;
      if (a.plan) return { stores: { "attune:life:v1": next }, open: "life", done: { en: `${a.who}: this month's ${num(a.amount || c.amount || 0)} paid.`, ar: `${a.who}: اتدفع ${num(a.amount || c.amount || 0)} بتوع الشهر ده.` } };
      return { stores: { "attune:life:v1": next }, open: "life", done: { en: `${a.who}: ${a.amount ? num(a.amount) + " paid back" : "paid"}${left != null ? ` — ${num(left)} still owed` : ""}.`, ar: `${a.who}: رجّع ${a.amount ? num(a.amount) : ""}${left != null ? ` — فاضل ${num(left)}` : ""}.` } };
    }
    case "dose": {
      const care = stores.care || { meds: [], taken: {} }, m = (care.meds || []).find((x) => x.id === a.medId);
      if (!m) return { stores: {}, done: { en: "That medicine isn't in Family health.", ar: "هذا الدواء غير موجود في صحة العائلة." }, open: "care" };
      const d = new Date(now), hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, dayKey = isoDay(now);
      const open = (m.times || []).filter((x) => !(care.taken || {})[`${m.id}|${dayKey}|${x}`]);
      const t = open.sort((x, y) => Math.abs(toMin(x) - toMin(hhmm)) - Math.abs(toMin(y) - toMin(hhmm)))[0];
      if (!t) return { stores: {}, open: "care", done: { en: `Every ${m.name} dose today is already ticked.`, ar: `كل جرعات ${m.name} اليوم مُعلَّمة بالفعل.` } };
      return { stores: { "attune:care:v1": markTaken(care, `${m.id}|${dayKey}|${t}`, now) }, open: "care", done: { en: `Ticked: ${m.name} (the ${t} dose).`, ar: `عُلّمت: ${m.name} (جرعة ${t}).` } };
    }
    case "sugar": {
      const care = stores.care || { members: [], meds: [], labs: [], taken: {} };
      const me = (care.members || [])[0];
      const n = addGlucose(care, me ? me.id : "", a.value, a.unit, now);
      const low = (a.unit === "mmol/L" ? a.value * 18 : a.value) < 70;
      return { stores: { "attune:care:v1": n }, open: "care", low,
        done: low ? { en: `Saved ${a.value} ${a.unit} — LOW. Take 15 g of fast sugar now (½ cup of juice or 1 tablespoon of honey) and check again in 15 minutes.`, ar: `حُفظت ${a.value} ${a.unit} — منخفضة. تناول ١٥ جرامًا من سكر سريع الآن (نصف كوب عصير أو ملعقة عسل) وقِس بعد ١٥ دقيقة.` }
          : { en: `Blood sugar saved: ${a.value} ${a.unit}.`, ar: `حُفظت قراءة السكر: ${a.value} ${a.unit}.` } };
    }
    case "life": {
      const life = stores.life || { v: 1, items: [] };
      const r = addCommitment(life, a.c, now), c = a.c;
      const amt = c.amount ? `${num(c.amount)} ${c.currency || ""}${c.every ? " / " + c.every : ""}` : "";
      return { stores: { "attune:life:v1": r }, open: "life", done: { en: `Saved in People & plans: ${[c.person, c.title || c.kind, amt].filter(Boolean).join(" · ")}.`, ar: `حُفظ في الأشخاص والالتزامات: ${[c.person, c.title || c.kind, amt].filter(Boolean).join(" · ")}.` } };
    }
    case "deadline": {
      const r = addDeadline(stores.radar || { items: [], seen: [] }, { ...a.d, source: "home" }, now);
      return { stores: r.dup ? {} : { "attune:radar:v1": r.data }, open: "radar", item: r.item, done: r.dup ? { en: `Already in Deadline Radar: ${r.item.title} (${r.item.date}).`, ar: `موجود بالفعل في رادار المواعيد: ${r.item.title} (${r.item.date}).` } : { en: `Deadline Radar will remind you: ${r.item.title} — ${r.item.date}.`, ar: `سيذكّرك رادار المواعيد: ${r.item.title} — ${r.item.date}.` } };
    }
    case "reminder": {
      const x = a.action, when = x.at ? new Date(x.at) : null;
      const at = when ? when.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
      return { stores: {}, need: "reminder", open: "reminders", done: { en: `${x.kind === "alarm" ? "Alarm" : x.kind === "timer" ? "Timer" : "Reminder"} set: ${x.title}${at ? " — " + at : ""}.`, ar: `${x.kind === "alarm" ? "ضُبط المنبه" : x.kind === "timer" ? "ضُبط المؤقت" : "ضُبط التذكير"}: ${x.title}${at ? " — " + at : ""}.` } };
    }
    case "note": return { stores: {}, need: "note", open: "memory", done: { en: "Kept in Mind — searchable any time.", ar: "حُفظ في عقلي — يمكنك البحث عنه في أي وقت." } };
    case "period": return { stores: {}, need: "period", open: "cycle", done: { en: "Logged in Cycle.", ar: "سُجّل في الدورة." } };
    default: return { stores: {}, done: { en: "", ar: "" } };
  }
}
const toMin = (hm) => { const [h, m] = String(hm).split(":").map(Number); return h * 60 + (m || 0); };

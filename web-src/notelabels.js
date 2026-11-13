/* ---- v9.9.11 Teach Attune what a notification is (Ali picked A1 A2 A4 L, 10 Nov 2026: "it should be interactive and ask me, I tell
   it what it is and it understands, so next time it knows"; "integrate them in a good way and make sure it's smart and understands
   anything I type"). The brain for all four:
     sourceOf(n)        → where a notification comes from: a chat / group ("WhatsApp · ما يخص المرتبات"), an SMS sender, or an app
     labelOf(n, teach)  → what the person taught about that source (or null)
     readAnswer(text, src) → what the answer means: { kind: "label", meaning, … } | { kind: "who", … } (a person — noteteach.js)
                          | { kind: "ask", choices } when it can't tell — then the AI (aiPrompt / readAi), then the choices
     asksFrom(notes, teach) → what Attune should ask about (money it isn't sure of, a source it never saw), newest first, once each
     applyLabel / undoLabel / learned(teach) → saved in noteteach's rules (kind "label"); the "What Attune learned" list
   What a label does: notmoney / work / ads / ignore → never read as money (paylog.js) and never asked again; ignore / ads → hidden
   in Recall; mymoney / bank → that source counts as a money source (the payment still needs "the money moved" + the AI's yes);
   bill / delivery / family / important → how it is described. Nothing is saved before "I understood … — Save".
   Pure; tests: tests/unit/v999notelabels.test.mjs. */
import { readTeach, ROLES } from "./noteteach.js";
import { notAPayment, isScam, OFFER_W } from "./notifwords.js";   // v9.9.17
import { understandNote as kindOf } from "./notifmeaning.js";   // v9.9.30
const ROLE_AR = Object.fromEntries(ROLES.map((r) => [r[0], r[2]]));

const CHAT = /whatsapp|telegram|messenger|com\.facebook\.orca|instagram|securesms|org\.signal|signal|viber|slack|teams|discord|imo|botim|wechat|tencent\.mm|naver\.line|snapchat|skype/i;
const SMS = /messag|\bsms\b|mms|samsung\.android\.messaging|google\.android\.apps\.messaging|رسائل/i;
const MAIL = /com\.google\.android\.gm\b|gmail|outlook|com\.microsoft\.office\.outlook|yahoo\.mobile\.client\.android\.mail|ymail|proton\.?mail|com\.samsung\.android\.email|android\.email|\bmail\b|spark|bluemail|edison/i;
const fold = (s) => String(s || "").toLowerCase().normalize("NFKC").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const appName = (n) => String((n && (n.app || n.pkg)) || "").trim();

/** Where it comes from → { key, kind: "chat" | "sms" | "app", name, app }. A chat's name is the group / person (the title before
 *  ": sender" and without "(3 messages)"); an SMS's is its sender; an app's is the app. */
export function sourceOf(n) {
  if (!n) return null;
  const app = appName(n), both = app + " " + String(n.pkg || "");
  const title = String(n.title || "").replace(/\s*\(\d+\s*(?:messages?|رسائل|رسالة|new)[^)]*\)\s*$/i, "").trim();
  if (CHAT.test(both)) { const name = title.split(/:\s/)[0].replace(/\s*@\s*.*$/, "").trim() || app; return { key: "chat:" + fold(app).split(" ")[0] + ":" + fold(name), kind: "chat", name, app, pkg: String(n.pkg || "") }; }
  if (MAIL.test(both)) { const name = title.replace(/\s*<[^>]*>\s*$/, "").trim() || app; return { key: "mail:" + fold(name), kind: "mail", name, app, pkg: String(n.pkg || "") }; }   // v9.9.12: an email's source is its sender, never "Gmail" as a whole
  if (SMS.test(both)) { const name = title || app; return { key: "sms:" + fold(name), kind: "sms", name, app, pkg: String(n.pkg || "") }; }
  return { key: "app:" + fold(n.pkg || app), kind: "app", name: app, app, pkg: String(n.pkg || "") };
}

// what a source can be — [meaning, English, Egyptian Arabic]
export const MEANINGS = [
  ["work", "Work talk — not my money", "كلام شغل — مش فلوسي"],
  ["notmoney", "Not money — just talk", "مش فلوس — كلام بس"],
  ["mymoney", "My money — count it", "فلوسي — احسبها"],
  ["bank", "My bank / wallet", "بنكي / محفظتي"],
  ["bill", "A bill or installment", "فاتورة أو قسط"],
  ["delivery", "Deliveries and orders", "طلبات وتوصيل"],
  ["family", "Family", "العيلة"],
  ["important", "Important — tell me", "مهم — بلغني"],
  ["ads", "Ads and offers — ignore", "إعلانات وعروض — تجاهلها"],
  ["ignore", "Ignore it", "تجاهله"],
];
export const meaningOf = (k) => MEANINGS.find((m) => m[0] === k) || null;
const NOT_MONEY = new Set(["work", "notmoney", "ads", "ignore", "delivery", "family"]);
export const notMoney = (lab) => !!lab && NOT_MONEY.has(lab.meaning);
export const countsAsMoney = (lab) => !!lab && (lab.meaning === "mymoney" || lab.meaning === "bank");
export const hiddenBy = (lab) => !!lab && (lab.meaning === "ignore" || lab.meaning === "ads");

// the words of an answer → a meaning. Order matters: "not mine" before "mine", "work" before "money".
const W = (s) => new RegExp(s, "iu");
const RULES = [
  ["ignore", W("(?<![\\p{L}])(ignore|mute|hide|don'?t show|dont show|never show|stop showing|not important|doesn'?t matter|تجاهل|تجاهله|تجاهلها|اتجاهل|متعرضش|ماتعرضش|اخفي|اخفيه|إخفاء|مش مهم|مش مهمه|ملهوش لازمه|سيبك منه|سيبك منها|ignore it|tgahel|mesh mohem)(?![\\p{L}])")],
  ["ads", W("(?<![\\p{L}])(ads?|advert\\w*|spam|offers?|promo\\w*|marketing|إعلان|اعلان|إعلانات|اعلانات|عروض|سبام|تسويق|e3lan|e3lanat)(?![\\p{L}])")],
  ["work", W("(?<![\\p{L}])(work|job|office|company|colleagues?|team|staff|wages|salaries|payroll|accountant|employees?|workers?|site|شغل|الشغل|شغلي|العمل|عملي|الشركه|الشركة|شركتي|المكتب|زملاء|زمايلي|الموظفين|موظفين|العمال|عمال|المرتبات|مرتبات|الرواتب|رواتب|المحاسب|محاسب|الموقع|sho3l|shoghl)(?![\\p{L}])")],
  ["notmoney", W("(not (?:my )?money|not mine|isn'?t mine|not a payment|no payment|not real|just talk(?:ing)?|only talk|chat(?:ting)? about|مش فلوسي|مش فلوس|دي مش فلوس|مش بتاعي|مش بتاعتي|مش ليا|مش ليه|مش دفع|كلام بس|مجرد كلام|بيتكلموا|mesh feloosy|mesh flousy)")],
  ["bank", W("(?<![\\p{L}])(my bank|bank|banque|wallet|instapay|my account|بنكي|البنك|بنك|محفظتي|المحفظه|المحفظة|محفظه|انستاباي|إنستاباي|حسابي|bnky|banky)(?![\\p{L}])")],
  ["bill", W("(?<![\\p{L}])(bill|bills|installment|instalment|loan|subscription|rent|قسط|اقساط|أقساط|فاتوره|فاتورة|فواتير|اشتراك|ايجار|إيجار|قرض|2est|qest)(?![\\p{L}])")],
  ["mymoney", W("(?<![\\p{L}])(mine|my money|my income|my salary|it'?s mine|count it|record it|add it|real payment|فلوسي|بتاعي|بتاعتي|ليا|دخلي|مرتبي|راتبي|احسبها|احسبه|سجلها|سجله|ضيفها|ضيفه|feloosy|flousy|beta3y)(?![\\p{L}])")],
  ["delivery", W("(?<![\\p{L}])(deliver\\w*|orders?|shipping|shipment|parcel|courier|توصيل|الطلب|طلبات|اوردر|أوردر|شحنه|شحنة|الشحن|المندوب|delivery)(?![\\p{L}])")],
  ["family", W("(?<![\\p{L}])(family|relatives|my parents|العيله|العيلة|عيلتي|اهلي|أهلي|قرايبي|3ela)(?![\\p{L}])")],
  ["important", W("(?<![\\p{L}])(important|urgent|tell me|notify me|let me know|always show|مهم|مهمه|مهمة|ضروري|بلغني|قولي|عرفني|خليني اعرف|mohem)(?![\\p{L}])")],
];
const NEG_MONEY = /(not (?:my )?money|not mine|isn'?t mine|مش فلوسي|مش بتاعي|مش ليا|مش فلوس)/i;

/** The person's answer about a source → { kind: "label", meaning, note } | { kind: "who", … } | { kind: "ask", choices }. */
export function readAnswer(text, src = null, { dir = { items: [] }, name = "" } = {}) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  // a quick answer button sends its meaning key
  if (meaningOf(raw)) return { kind: "label", meaning: raw, note: "", src };
  // about a person ("Nada is my wife", «دي مراتي») → the People card (noteteach.js)
  const who = readTeach(raw, dir, { name: name || (src && src.kind === "chat" ? src.name : "") });
  const hits = RULES.filter(([, re]) => re.test(raw)).map(([k]) => k);
  // a person AND what their messages mean ("that's my brother, he sends me money every month") → both, approved together
  if (who && who.kind === "who") {
    const m2 = NEG_MONEY.test(raw) ? "notmoney" : /(sends? me|transfers? me|pays? me|gives? me|بيبعتلي|بيحولي|بيحولّي|بيديني|بيدفعلي)/i.test(raw) || hits.includes("mymoney") ? "mymoney" : "";
    return m2 && src ? { kind: "label", meaning: m2, note: raw.slice(0, 120), src, also: who } : who;
  }
  let m = hits[0] || "";
  if (NEG_MONEY.test(raw)) m = hits.includes("work") ? "work" : hits.includes("ignore") ? "ignore" : hits.includes("ads") ? "ads" : "notmoney";
  else if (hits.includes("work") && hits.includes("mymoney") && /\b(salary|مرتبي|راتبي)\b/i.test(raw)) m = "mymoney";   // "it's my salary from work" = mine
  if (!m) return { kind: "ask", choices: MEANINGS.map((x) => x[0]), src, said: raw };
  return { kind: "label", meaning: m, note: raw.slice(0, 120), src };
}

/** The AI's turn when the words didn't say it clearly: one line of JSON with a meaning from the list (or "unclear"). */
export const aiPrompt = (text, src, sample = "") => `The person is teaching their phone assistant what notifications from one source mean.
Source: ${src ? `${src.kind} "${src.name}" in ${src.app}` : "unknown"}
Example notification: ${String(sample || "").replace(/\s+/g, " ").slice(0, 300)}
What the person wrote: ${String(text || "").slice(0, 300)}
Pick the ONE meaning that fits what they wrote: ${MEANINGS.map((m) => m[0] + " (" + m[1] + ")").join(", ")}, or unclear.
Answer with ONE line of JSON only: {"meaning": "..."}`;
export function readAi(out, src, text) {
  const m = /\{[^{}]*\}/.exec(String(out || "")); if (!m) return null;
  let j = null; try { j = JSON.parse(m[0]); } catch (e) { return null; }
  return meaningOf(j.meaning) ? { kind: "label", meaning: j.meaning, note: String(text || "").slice(0, 120), src, byAi: true } : null;
}

/** "I understood: …" — the line approved before saving. */
export function understoodLabel(x, { ar = false, tr = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v || {})[k]) } = {}) {
  if (!x || x.kind !== "label") return "";
  const src = x.src || {}, where = src.kind === "chat" ? (ar ? `رسايل «${src.name}» (${src.app})` : tr("messages in “{n}” ({a})", { n: src.name, a: src.app })) : src.kind === "sms" ? (ar ? `رسايل ${src.name}` : tr("messages from {n}", { n: src.name })) : src.kind === "mail" ? (ar ? `إيميلات ${src.name}` : tr("emails from {n}", { n: src.name })) : (ar ? `إشعارات ${src.name}` : tr("{n} notifications", { n: src.name }));
  const mean = meaningOf(x.meaning), what = mean ? (ar ? mean[2] : tr(mean[1])) : String(x.meaning || "");   // v9.9.15: an unknown meaning (an older / synced rule) shows as its word, never a crash
  const after = notMoney(x) ? (ar ? " — عمري ما هحسبها فلوس ولا هسألك عنها تاني" : tr(" — never counted as money, and I won't ask again"))
    : countsAsMoney(x) ? (ar ? " — الفلوس اللي بتتحرك فيها هتتحسب" : tr(" — money that moves in them counts"))
    : x.meaning === "important" ? (ar ? " — هبلغك بيها" : tr(" — I'll tell you about them")) : "";
  const also = x.also ? " · " + (ar ? `${x.also.name} = ${(ROLE_AR[x.also.role] || x.also.role)}` : tr("{n} = {r}", { n: x.also.name, r: tr("your " + x.also.role) })) : "";
  return (ar ? where + " = " : where.charAt(0).toUpperCase() + where.slice(1) + " = ") + what + after + also;
}

// ---- saved in noteteach's rules (kind "label"), so one "What Attune learned" list holds everything --------------------------------
export function labelOf(n, teach) {
  const s = sourceOf(n); if (!s) return null;
  return ((teach && teach.rules) || []).find((r) => r.kind === "label" && r.on !== false && r.key === s.key) || null;
}
export function applyLabel(x, teach, now = Date.now()) {
  if (!x || x.kind !== "label" || !x.src) return teach;
  const rule = { id: "l" + now.toString(36), kind: "label", on: true, created: now, key: x.src.key, src: x.src, meaning: x.meaning, note: x.note || "" };
  return { ...teach, rules: [...((teach && teach.rules) || []).filter((r) => !(r.kind === "label" && r.key === rule.key)), rule], asked: [...new Set([...((teach && teach.asked) || []), x.src.key])] };
}
/** Undo: the rule goes, and the source may be asked about again (it is no longer "asked"). */
export function undoLabel(teach, id) {
  const r = ((teach && teach.rules) || []).find((x) => x.id === id), key = r && r.key;
  return { ...teach, rules: ((teach && teach.rules) || []).filter((x) => x.id !== id), asked: ((teach && teach.asked) || []).filter((k) => k !== key) };
}
export const skipSource = (teach, key) => ({ ...teach, skip: [...new Set([...((teach && teach.skip) || []), key])] });

/** Everything Attune learned, newest first: labels, people's roles (from the People cards) and the other rules (hide / alerts). */
export function learned(teach, dir = { items: [] }) {
  const rules = ((teach && teach.rules) || []).filter((r) => r.on !== false).map((r) => ({ id: r.id, type: r.kind, rule: r, ts: r.created || 0 }));
  const people = ((dir && dir.items) || []).filter((p) => p.kind === "person" && p.role).map((p) => ({ id: "p:" + p.id, type: "who", person: p, ts: p.created || 0 }));
  return [...rules, ...people].sort((a, b) => b.ts - a.ts);
}

// ---- v9.9.12 understand the message itself before asking (Ali, 10 Nov: "Follow-ups is not logical — how does it not understand these
// notifications?": it asked "What is this?" about an Uber invite-a-friend offer, a talabat "206 instead of 295" offer, a YouTube video
// title with "$250,000" and a Google Play receipt). Code reads each MESSAGE first:
//   an offer / advert → "ads" (sure, never asked) · a video / post / news app → not money (sure, never asked)
//   a receipt that says you were charged → "paid" (asked as "You paid … — add it to Money?", never "what is this?")
//   a chat whose name or sender says work / wages → "work" as a GUESS (the card opens on "I think: …" — Save / Change)
// Nothing is saved without the person's tap; the sure ones are only left out of the questions.
const AD = /(invite (?:a |your )?friends?|refer (?:a |your )?friends?|get (?:[^.\n]|\.\d){0,24}\boff\b|\d+(?:[.,]\d+)?\s?%\s?off|\binstead of\b|\bonly (?:for|today|this)\b|\bfor [^.\n]{0,20}\bonly\b|treat yourself|don'?t miss|limited[- ]time|hurry|last chance|flash sale|\bsale\b|\bdeals?\b|\boffers?\b|discount|promo\w*|coupon|voucher|use (?:the )?code|free delivery|free shipping|cashback|save up to|lowest price|new arrivals|order now|shop now|book now|\bwin\b|giveaway|sponsored|new collection|\bfrom (?:egp|\$|usd|€|£|ج\.م\.?)\s?[\d٠-٩]|buy (?:1|one) get|get (?:1|one) free|special offer|new arrivals|(?:plans?|prices?|items?|starting|installments? starting) (?:from|at)\b|starting (?:from |at )?(?:egp|\$|usd|€)|watch now|visit [a-z0-9-]+\.(?:com|eg|net)|bonus|اشترك (?:في|ف)|واحصل|احصل على|بـ? ?[\d٠-٩][\d٠-٩,.٬٫]* ?جنيه بس|بس بـ|بدل(?:ا|اً)? من|بدل ما|خصم|عرض|عروض|كوبون|كود الخصم|استخدم كود|وفر|توصيل مجاني|لفترة محدودة|متفوتش|الحق(?:ه|ها)?|هدية|اطلب دلوقتي|اطلب الآن|ادعي صاحبك|ادعُ صديق|اكسب|تخفيضات|لحق نفسك)/iu;
const MOVED = /(تم دفع|total charged|paid online|charged (?:egp|usd|sar|aed|\$|€|£)\s?[\d٠-٩]|you'?ve been charged|amount charged|received your payment|has been renewed|you were charged|has been charged|was charged|we charged|charged to your|billed to|debited|credited|total paid|(?:\$|egp|usd|€)\s?[\d.,]+ paid|\bpaid (?:successfully|with|by|on)\b|payment of (?:[^.\n]|\.\d){0,40} (?:was|is) successful|تم تجديد|تم الدفع|payment (?:received|successful|confirmed|complete[d]?)|payment of (?:[^.\n]|\.\d){0,40} received|paid successfully|you paid|you sent|you received|refund(?:ed)?|تم (?:خصم|تحويل|استلام|إيداع|ايداع|سحب|شراء|دفع|سداد)|استلمت|وصلك مبلغ)/iu;
const RECEIPT = /(receipt|بنجاح|total charged|paid online|you paid|received your payment|amount charged|has been renewed|تم سداد|billed to|total paid|invoice|payment of (?:[^.\n]|\.\d){0,40} (?:was|is) successful|رقم العملية|you'?ve been charged|you were charged|has been charged|was charged|we charged|payment (?:received|successful|confirmed|complete[d]?)|payment of (?:[^.\n]|\.\d){0,40} received|paid successfully|thanks? (?:you )?for your (?:payment|purchase|order)|invoice (?:paid|#|no)|order (?:number|no\.?|#)|subscription (?:continues|renewed|has been renewed|is renewed)|إيصال|ايصال|تم الدفع|تم خصم|تم سداد|فاتورة مدفوعة|تم تجديد اشتراكك|رقم الطلب)/iu;
const FUTURE = /(will be (?:charged|billed|debited|renewed)|you'?ll be (?:charged|billed)|will renew|renews on|payment (?:is )?due|due on|free trial|trial ends|سيتم خصم|سيتم التجديد|الفترة التجريبية)/iu;
const MEDIA = /youtube|tiktok|musically|zhiliaoapp|netflix|spotify|twitch|reddit|twitter|com\.x\.android|\bx\.com\b|pinterest|facebook\.katana|\bfacebook\b(?!.*orca)|threads|tumblr|shahid|anghami|watch ?it|osn|disney|primevideo|prime video|hbo|crunchyroll|soundcloud|deezer|podcast|castbox|\bnews\b|bbc|cnn|aljazeera|youm7|masrawy|almasryalyoum|google\.android\.apps\.magazines|quora|medium|linkedin|duolingo|\bgames?\b|supercell|pubg|tencent\.ig|freefire|dts\.freefire|roblox|king\.candycrush|steam|epicgames|chess|9gag|imdb|kick\.com|vimeo|dailymotion|snapchat/i;
const NEWS_FROM = /substack|medium|digest|newsletter|quora|linkedin|coursera|udemy|kickstarter|reddit|youtube|property ?finder|job alerts?|upwork|indeed|wuzzuf|glassdoor|pinterest|tiktok|facebook|twitter|\bx\b/i;
const WORKY = /(work|office|company|staff|wages|salar(?:y|ies)|payroll|accountant|accounts|hr\b|site|workers|employees|team|شغل|الشغل|شركه|شركة|الشركة|المكتب|مرتبات|المرتبات|رواتب|الرواتب|محاسب|المحاسب|حسابات|الموظفين|العمال|عمال|الموقع|الورشه|الورشة|الادارة|الإدارة)/iu;
/** What one notification is, read by code → { meaning, sure, why } or null (not clear — ask). Pure. */
export function understandNote(n) {
  if (!n) return null;
  const s = sourceOf(n), text = String(n.title || "") + " \n " + String(n.text || ""), app = appName(n) + " " + String(n.pkg || "");
  // v9.9.17 (the 10,000-notification run): a prize / "verify here" text is left out like an advert; "you will be billed", "payment
  // declined", a code are not receipts; a video title that says "I spent $342,142" is still a video; a newsletter, a price moving
  // ("BTC is up 3% — now $86,186") and "shared a reel" are not the person's money
  const why0 = notAPayment(text), receipt = RECEIPT.test(text) && !["failed", "notyet", "code"].includes(why0);
  if (s.kind !== "chat" && isScam(text)) return { meaning: "ads", sure: true, why: "scam" };
  const moved = MOVED.test(text) && !FUTURE.test(text) && !["failed", "notyet", "code"].includes(why0);
  if (s.kind === "app" && MEDIA.test(app) && !(moved && receipt)) return { meaning: "notmoney", sure: true, why: "media" };
  if (s.kind === "mail" && NEWS_FROM.test(s.name) && !(moved && receipt)) return { meaning: "notmoney", sure: true, why: "newsletter" };
  if (why0 === "post" || (why0 === "price" && s.kind !== "chat")) return { meaning: "notmoney", sure: true, why: why0 };
  if (moved && receipt) return { meaning: "paid", sure: true, why: "receipt" };
  if ((s.kind !== "chat" || /sponsored|إعلان ممول|ممول/i.test(text)) && (AD.test(text) || OFFER_W.test(text)) && !moved) return { meaning: "ads", sure: true, why: "offer" };
  if (s.kind === "chat" && WORKY.test(s.name + " " + String(n.title || ""))) return { meaning: "work", sure: false, why: "work-chat" };
  return null;
}

// ---- what to ask about ------------------------------------------------------------------------------------------------------------
const MONEYISH = /[\d٠-٩][\d٠-٩,.٬٫]*\s*(?:جنيه|جنيها|ج\.م|جم|egp|le\b|l\.e|\$|usd|eur|sar|aed|ريال|درهم|دولار)|(?<![a-z])(?:egp|le|l\.e|\$|usd|ج\.م\.?|€|£)[\s\u200e\u200f]*[\d٠-٩]|(?:حولتلك|حولتلكم|بعتلك|بعتتلك|حولت|حولتلي|بعتلي|sent you|transferred(?: you)?|i sent)\s*[\d٠-٩]{3,}/i;   // v9.9.13: «حولتلك ٣٠٠٠» with no currency is money too
/** Notifications Attune should ask about, once per source: money in a chat / an unknown app (never a known label, never twice).
 *  → [{ id, src, n, why: "money" }] newest first, at most `max`. A bank app's money is NOT asked here (the payment check handles it). */
/* v9.9.30 (Ali, 13 Nov: "I want Attune to understand notifications very well, not keep asking like a stupid … I want it really smart").
   Of 10,000 notifications Attune asked 1,875 questions — 588 about things that are not money at all ("Adobe renews on 15 Nov",
   "we couldn't process your payment", a gold-price channel, "arriving in 25 min · cash on delivery", a ride estimate, an appointment
   fee, "Hi mum, I lost my phone"), and asked about bills / subscriptions / receipts it had ALREADY made a card for. Now a question is
   left for what it can't work out alone: money that may have moved, from a source it doesn't know, that nothing else handles. A chat
   is never asked about (chat talk is never added to Money anyway); a receipt is added by Autopilot itself (with Undo). */
const NOT_ASKED_KINDS = new Set(["delivery", "ride", "calendar", "appointment", "travel", "flight", "call", "security", "media", "promo", "news", "system", "code"]);
export function asksFrom(notes = [], teach = { rules: [], asked: [], skip: [] }, { max = 3, bankish = () => false, payOf = () => null, now = Date.now(), handled = () => false, teach: teaching = false } = {}) {
  const done = new Set([...(teach.asked || []), ...(teach.skip || [])]), seen = new Set(), out = [];
  for (const n of [...notes].sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
    if ((n.ts || 0) < now - 14 * 864e5) continue;
    const s = sourceOf(n); if (!s || seen.has(s.key) || done.has(s.key) || labelOf(n, teach)) continue;
    const text = String(n.title || "") + " " + String(n.text || "");
    if (!MONEYISH.test(text) || bankish(n)) continue;
    if ((s.kind === "chat" && !teaching) || notAPayment(text, n) || handled(n)) continue;   // (teaching = the person asked to teach: Chat «علمني اشعاراتي»)
    { const k = (() => { try { return kindOf(n) || {}; } catch (e) { return {}; } })(); if (NOT_ASKED_KINDS.has(k.kind)) continue; }
    // v9.9.12: read the message first — offers and videos are never asked; a receipt is asked as "You paid … — add it?"
    const u = understandNote(n);
    if (u && u.sure && u.meaning !== "paid") continue;
    if (u && u.meaning === "paid") { const e = payOf(n); if (!e) continue; if (seen.has("pay:" + n.id)) continue; seen.add("pay:" + n.id); out.push({ id: "pay:" + n.id, src: s, n, why: "paid", pay: e }); }
    else { seen.add(s.key); out.push({ id: "ask:" + s.key, src: s, n, why: "money", ...(u && u.meaning ? { guess: u.meaning } : {}) }); }
    if (out.length >= max) break;
  }
  return out;
}

/** A2: what the phone must never ask about — the chats already taught ([{ pkg, name }]). */
export const phoneKnown = (teach) => ((teach && teach.rules) || []).filter((r) => r.kind === "label" && r.on !== false && r.src && r.src.kind === "chat" && r.src.pkg).map((r) => ({ pkg: r.src.pkg, name: r.src.name }));

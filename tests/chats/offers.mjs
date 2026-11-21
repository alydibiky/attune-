// v10.8 (Ali, 21 Nov 2026: "any notification is to do even if it's not that important" — a shop's WhatsApp advert «📷 تخيل بوكس فيه
// كل اللي ممكن تحتاجه … عليه خصم ٥٠٪» became a late to-do). 10,000 one-to-one chat messages COMPOSED from parts in random order
// (Arabic, English, Franco), hardened (tests/lib/hard.mjs), three kinds — truth written HERE:
//   ad       — a shop / a page advertising (a discount, a code, "limited time", "order now" + "free delivery"…) → kept quietly, never a to-do
//   request  — a person asking YOU to do something (some mention a discount: "it's 30% off — can you get it?") → a to-do
//   chatter  — a person telling you something, nothing asked ("you might need a jacket", "I got 50% off my shoes") → kept, no to-do
//   node tests/chats/offers.mjs            (N=2500 for the unit test; HELD=1 for the held-out set written after the fixes)
import { decide } from "../../web-src/autopilot2.js";
import { harden, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
const N = +(process.env.N || 10000), HELD = !!process.env.HELD;
let seed = 9137 + (HELD ? 5003 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], maybe = (p, s) => (rnd() < p ? s : "");
const arDig = (s) => (rnd() < 0.4 ? String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]) : String(s));
const SHOPS = HELD ? ["Barber Lab", "Glow Clinic", "B.Tech", "Spinneys Egypt", "Cairo Kitchen", "Nadi Gym", "أوكازيون", "مطعم الشبراوي"] : ["Mr.Beard", "Seoudi Market", "Zara Egypt", "Mo's Kitchen", "Gold's Gym Zayed", "صيدلية العزبي", "حلواني العبد", "Noon Deals", "Sephora ME", "Lulu Hypermarket"];
const PEOPLE = HELD ? ["Hanan", "Tarek", "خالد", "Basma 🌷", "Uncle Samir", "Youssef Shehawy"] : ["Mama", "Noudy", "Ahmed Salah", "Sara", "أحمد", "ماما", "Omar.K", "Karim (work)", "Dina"];
const PRODUCT = { ar: ["بوكس العناية بالذقن", "كل المنيو", "الاشتراك السنوي", "الجزم الشتوي", "العطور", "البيتزا الكبيرة", "منتجات البشرة", "الكحك والبسكويت", "زيت الشعر", "الساعات الذكية", "الموبايلات", "كورس الانجليزي", "جلسات الليزر", "اللحوم الطازة"], en: ["the beard care box", "all winter jackets", "the annual membership", "every pizza", "skincare", "all perfumes", "the full menu", "our new hoodies", "smart watches", "phones and tablets", "the English course", "laser sessions", "fresh meat", "kids' toys"], fr: ["el box", "kol el menu", "el eshterak el sanawy", "el gezam", "el perfumes", "el sa3at", "el mobilat", "korsat el english"] };
const HOOK = { ar: ["تخيل بوكس فيه كل اللي ممكن تحتاجه", "جهز نفسك للشتا", "مستني ايه؟", "فرصة متتعوضش", "الحق قبل ما يخلص", "عشان انت تستاهل", "جديدنا وصل"], en: ["Imagine everything you need in one box", "Winter is here", "Don't miss out", "Treat yourself", "Big news", "Last chance", "You deserve it"], fr: ["el fors dy mesh hatet3awad", "el7a2 2abl ma ykhlas", "gdedna wesel", "mestany eh?"] };
const DEAL = { ar: [(p) => "عليه خصم " + arDig(p) + "٪", (p) => "خصم " + arDig(p) + "% على " + pick(PRODUCT.ar), (p) => "وفر " + arDig(p) + "٪ النهارده", () => "استخدم كود الخصم BEARD" + Math.floor(rnd() * 90 + 10), () => "عرض خاص لفترة محدودة", () => "اشتري " + arDig(2) + " وخد " + arDig(1) + " ببلاش", (p) => "تخفيضات لحد " + arDig(p) + "%"],
  en: [(p) => p + "% off " + pick(PRODUCT.en), (p) => "Save " + p + "% this weekend", (p) => "up to " + p + "% discount", () => "Use promo code WINTER" + Math.floor(rnd() * 90 + 10), () => "Limited time offer", () => "Buy 2 get 1 free", (p) => "flat " + p + "% sale"],
  fr: [(p) => "5asm " + p + "% 3ala " + pick(PRODUCT.fr), (p) => "takhfeed " + p + "%", () => "promo code BOX" + Math.floor(rnd() * 90 + 10)] };
const CTA = { ar: ["اطلب الآن", "اطلب دلوقتي", "للطلب كلمنا على الواتساب", "توصيل مجاني لحد باب البيت", "العرض ساري لحد الخميس", "احجز الآن", "متوفر الآن في كل الفروع"], en: ["Order now", "Shop now", "Free delivery on all orders", "Offer ends Sunday", "Book now", "DM us to order", "Now available in all branches"], fr: ["etlob delwa2ty", "free delivery", "DM us"] };
const EMO = ["🔥", "🎁", "🛍️", "💥", "✨", "😍", "🎉", "👌", "💯", "⏰", "", "", ""];
const PRICE = { ar: (n) => pick(["بـ " + arDig(n) + " جنيه بس", "السعر " + arDig(n) + " ج", "بدل " + arDig(n * 2) + " بقى " + arDig(n)]), en: (n) => pick(["only EGP " + n, "now " + n + " LE", "was " + n * 2 + ", now " + n]), fr: (n) => pick(["b " + n + " bas", "el se3r " + n]) };
const PLACE = { ar: ["في كل الفروع", "فرع التجمع", "اونلاين بس", "في الشيخ زايد"], en: ["at all branches", "in New Cairo", "online only", "this Friday only"], fr: ["fe kol el feroo3", "online bas"] };
function ad() { const L = pick(["ar", "ar", "en", "en", "fr"]), p = pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80]);
  const parts = [maybe(0.5, pick(HOOK[L])), pick(DEAL[L])(p), maybe(0.6, pick(CTA[L])), maybe(0.4, pick(PRODUCT[L])), maybe(0.35, PRICE[L](pick([99, 150, 249, 399, 450, 799, 1200, 2499]))), maybe(0.3, pick(PLACE[L])), maybe(0.2, pick(CTA[L]))].filter(Boolean);
  for (let i = parts.length - 1; i > 1; i--) { const j = 1 + Math.floor(rnd() * i); [parts[i], parts[j]] = [parts[j], parts[i]]; }   // the deal is never first-only: order shuffled after the hook
  return (maybe(0.3, pick(["📷 ", "🎥 ", "📢 ", ""])) + parts.map((x) => x + maybe(0.15, " " + pick(EMO))).join(pick([" ", " — ", "\n", "! ", " • ", "، ", ". "])) + " " + pick(EMO)).trim(); }
const ASK = { ar: [["ممكن تجيبلي", "ممكن تبعتلي", "ابعتلي", "هاتلي", "لو سمحت ابعت", "متنساش تدفع", "كلمني بخصوص", "حوّلي"], ["العيش", "اللوكيشن", "الفاتورة", "فلوس الجمعية", "الورق بتاع العربية", "الشنطة السودا", "رقم السباك"]],
  en: [["can you send me", "could you bring", "please pay", "can you pick up", "don't forget to transfer", "can you call me about", "please send"], ["the contract", "the invoice", "the kids from school", "the rent", "the car papers", "the keys", "the location"]],
  fr: [["eb3atly", "momken tegebly", "hatly", "matnsash tedfa3", "kalemny 3an"], ["el location", "el 3eesh", "el fatora", "el wara2", "el mofta7"]] };
const WHEN = { ar: ["", " بكرة", " النهارده", " قبل الساعة ٥", " يوم الخميس"], en: ["", " tomorrow", " today", " before 5", " by Thursday"], fr: ["", " bokra", " ennaharda"] };
const DISC_ASK = { ar: [(p) => "خصم " + arDig(p) + "٪ على " + pick(["الكحك", "الشامبو", "اللبن", "الجزم"]) + "، ممكن تعدي تجيب " + pick(["اتنين", "واحد", "كرتونة"]) + pick(["؟", " بكرة؟", ""]), (p) => "في عرض " + arDig(p) + "% في " + pick(["سعودي", "كارفور", "خير زمان"]) + "، هاتلي " + pick(["زيت", "رز", "سكر"]) + " وانت جاي"],
  en: [(p) => "the jackets are " + p + "% off, can you pick one up for " + pick(["Omar", "me", "the kids"]) + pick(["?", " tomorrow?", ""]), (p) => pick(["Spinneys", "Carrefour", "Seoudi"]) + " has " + p + "% off " + pick(["coffee", "diapers", "rice"]) + ", please get " + pick(["two", "a box", "some"]) + " on your way"] };
const CHAT = { ar: ["خد الجاكيت معاك ممكن تحتاجه", "ممكن تكون الطريق زحمة النهارده", "انا جبت الجزمة بخصم ٥٠٪ 😂", "الجو حلو اوي النهارده", "ممكن تعجبك الحلقة الجديدة", "وصلت البيت الحمد لله"], en: ["you might need an umbrella later", "I got 50% off on my shoes today haha", "the traffic is crazy on the ring road", "we landed, all good", "that movie was great"], fr: ["wesselt el beet", "el gaw helw awy", "gebt el gazma b 5asm 50% 😂"] };
function request() { const L = pick(["ar", "en", "fr", "ar", "en"]);
  if (rnd() < 0.3 && DISC_ASK[L]) return pick(DISC_ASK[L])(pick([20, 30, 40, 50]));
  const [v, o] = ASK[L]; return (pick(OPEN) + maybe(0.2, pick(["yalla ", "please ", "لو سمحت ", ""])) + pick(v) + " " + pick(o) + pick(WHEN[L]) + maybe(0.25, pick([" عشان محتاجينه", " because the guy is waiting", " عشان الراجل مستني", " we need it"])) + maybe(0.3, pick([" ?", "؟", " 🙏", " plz"]))).trim(); }
const OFFER_HELP = { ar: [(p) => "في خصم " + arDig(p) + "٪ على المنظفات، تحب اجيب اتنين؟", (p) => "الجاكيتات عليها " + arDig(p) + "%، عايز واحدة؟"], en: [(p) => "Carrefour has " + p + "% off the detergent — should I get two?", (p) => "there's a " + p + "% sale at Zara, do you want me to get the blue one?"] };
const OPEN = ["", "", "btw ", "يا علي ", "Ali, ", "على فكرة ", "lol ", "اه صحيح "];
const chatter = () => { const L = pick(["ar", "en", "fr"]); if (rnd() < 0.3 && OFFER_HELP[L]) return pick(OPEN) + pick(OFFER_HELP[L])(pick([15, 20, 30, 40, 50]));
  return (pick(OPEN) + pick(CHAT[L]) + maybe(0.3, pick([" 😂", " ❤️", "!", " الحمد لله", " haha"]))).trim(); };
const bad = {}, texts = []; let pass = 0, made = 0;
while (made < N) {
  const r = rnd(), kind = r < 0.45 ? "ad" : r < 0.8 ? "request" : "chatter";
  let text = kind === "ad" ? ad() : kind === "request" ? request() : chatter();
  text = harden(text, rnd, { human: kind !== "ad", allowCut: kind === "ad", keep: /[\d٠-٩]+\s*[%٪]|code|كود|خصم/i });
  const who = kind === "ad" ? pick(SHOPS) : pick(PEOPLE);
  const n = { id: "o" + made, app: pick(["WhatsApp", "WhatsApp Business"]), pkg: "com.whatsapp", title: who, text, ts: 1763700000000 + made * 60000 };
  const d = decide(n, {}); made++; texts.push(text);
  const got = !d ? "nothing" : d.kind;
  const want = kind === "request" ? "todo" : "keep";
  if (got === want) { pass++; continue; }
  const k = kind + " → " + got; (bad[k] = bad[k] || []).push(text.slice(0, 110));
}
const sh = shapeReport(texts);
console.log(`offers${HELD ? " (held-out)" : ""}: ${pass}/${N} right (${(100 * pass / N).toFixed(2)}%) · ${sh.shapes} shapes (${(100 * sh.share).toFixed(1)}% different${sh.share >= SHAPE_BAR ? "" : " — below the 60% bar"})`);
for (const [k, v] of Object.entries(bad)) console.log(`  ${k}: ${v.length} — e.g. «${v[0]}»` + (v[1] ? ` · «${v[1]}»` : ""));
export const result = { pass, N, share: sh.share };

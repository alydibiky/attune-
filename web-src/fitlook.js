// v6.18 — Fit & Food's three looks (Ali: "all 3 optional in the settings, the default is A"), the nutrition facts shown
// while a photo is read, and where the labels and arrows go on the photo (Ali: "the image I uploaded to have an arrow to
// each food and its calories inside the image").
//
// The app is styled with Tailwind 4, whose colours are CSS variables (bg-slate-800 = var(--color-slate-800)). A look
// redefines the palette for the page while Fit is open (`body:has(.fit-look-<id>)`: Attune's own wrapper behind Fit
// too — v6.18 screenshot: it stayed dark and the light cards turned grey over it), so every Fit screen — today's and later ones — takes it
// without touching hundreds of class names. Light looks turn the slate scale around (950 = the page, white = the ink).

export const LOOKS = [
  { id: "fresh", en: "Fresh", ar: "منعش", hint: { en: "Light and green, big calorie ring", ar: "فاتح وأخضر، بحلقة سعرات كبيرة" }, swatch: ["#F7FAF8", "#1F8A5B", "#12241B"] },
  { id: "night", en: "Night", ar: "ليلي", hint: { en: "Dark, easy on the eyes at night", ar: "داكن ومريح للعين ليلًا" }, swatch: ["#0B1220", "#2DD4BF", "#E8EEF7"] },
  { id: "bold", en: "Bold", ar: "جريء", hint: { en: "White, orange and big numbers", ar: "أبيض وبرتقالي وأرقام كبيرة" }, swatch: ["#FFFFFF", "#F25C2A", "#1B1F3B"] },
];
export const DEFAULT_LOOK = "fresh";
export const lookOf = (st) => (LOOKS.some((l) => l.id === (st && st.look)) ? st.look : DEFAULT_LOOK);
export const isLight = (id) => id === "fresh" || id === "bold";

// The light looks: the slate scale turned around, then the accents darkened so they read on white (4.5:1 for text).
export const LIGHT_BASE = (ink, page, card, input, line, line2, muted, soft) => `
  --color-slate-950:${page};--color-slate-900:${card};--color-slate-800:${input};--color-slate-700:${line};--color-slate-600:${line2};
  --color-slate-500:${muted};--color-slate-400:${soft};--color-slate-300:${soft};--color-slate-200:${ink};--color-slate-100:${ink};--color-slate-50:${ink};
  --color-white:${ink};
  --color-sky-100:#075985;--color-sky-200:#075985;--color-sky-300:#0369A1;--color-sky-400:#0284C7;--color-sky-700:#0369A1;--color-sky-800:#BAE6FD;--color-sky-900:#BAE6FD;--color-sky-950:#E0F2FE;
  --color-amber-100:#92400E;--color-amber-200:#92400E;--color-amber-300:#B45309;--color-amber-800:#FCD9A8;--color-amber-900:#FCD9A8;--color-amber-950:#FFF7E6;
  --color-rose-100:#9F1239;--color-rose-200:#9F1239;--color-rose-300:#BE123C;--color-rose-800:#FECDD3;--color-rose-900:#FECDD3;--color-rose-950:#FFF1F2;
  --color-violet-200:#5B21B6;--color-violet-300:#6D28D9;--color-violet-800:#DDD6FE;--color-violet-900:#DDD6FE;--color-violet-950:#F5F3FF;
  --color-teal-200:#115E59;--color-teal-300:#0F766E;--color-lime-300:#4D7C0F;--color-orange-300:#C2410C;--color-yellow-300:#A16207;--color-red-300:#B91C1C;
  --color-blue-300:#1D4ED8;--color-indigo-300:#4338CA;--color-pink-300:#BE185D;--color-cyan-300:#0E7490;--color-green-300:#15803D;--color-fuchsia-300:#A21CAF;`;
// a filled button keeps white writing (white is the ink in a light look)
export const ON_FILL = (sel) => ["emerald-500", "emerald-600", "emerald-700", "sky-500", "sky-600", "sky-700", "rose-600", "amber-600", "violet-600", "red-600"]
  .map((c) => `${sel} .bg-${c}`).join(",") + "{color:#FFFFFF}";

export const LOOK_CSS = `
body:has(.fit-look-fresh),.fit-look-fresh{${LIGHT_BASE("#12241B", "#F2F6F3", "#FFFFFF", "#EAF1EC", "#D3E0D7", "#B9CBBF", "#5E7166", "#43574B")}
  --color-emerald-100:#145C3B;--color-emerald-200:#1A6B45;--color-emerald-300:#1F7A50;--color-emerald-400:#22915F;--color-emerald-500:#1F8A5B;--color-emerald-600:#1F8A5B;--color-emerald-700:#176B46;
  --color-emerald-800:#BFE3CF;--color-emerald-900:#CFEBDB;--color-emerald-950:#E7F6EE;color-scheme:light}
${ON_FILL(".fit-look-fresh")}
body:has(.fit-look-bold),.fit-look-bold{${LIGHT_BASE("#1B1F3B", "#FFFFFF", "#F6F6F9", "#ECECF2", "#DCDCE6", "#C4C5D4", "#5F6278", "#44475E")}
  --color-emerald-100:#9A3412;--color-emerald-200:#9A3412;--color-emerald-300:#C2410C;--color-emerald-400:#EA580C;--color-emerald-500:#F25C2A;--color-emerald-600:#E2501F;--color-emerald-700:#C2410C;
  --color-emerald-800:#FED7C3;--color-emerald-900:#FFE4D6;--color-emerald-950:#FFF1EA;color-scheme:light}
${ON_FILL(".fit-look-bold")}
.fit-look-bold .text-2xl,.fit-look-bold .text-3xl,.fit-look-bold .text-4xl{font-weight:800;letter-spacing:-.01em}
body:has(.fit-look-night),.fit-look-night{--color-slate-950:#0B1220;--color-slate-900:#121C30;--color-slate-800:#1E2C47;--color-slate-700:#2A3B5C;
  --color-emerald-300:#5EEAD4;--color-emerald-400:#2DD4BF;--color-emerald-500:#2DD4BF;--color-emerald-600:#0D9488;--color-emerald-700:#0F766E;color-scheme:dark}
@keyframes fitScan{0%{transform:translateY(0)}50%{transform:translateY(calc(var(--h,256px) - 4px))}100%{transform:translateY(0)}}
@keyframes fitPop{0%{opacity:0;transform:translateY(12px) scale(.97)}100%{opacity:1;transform:none}}
@keyframes fitPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.4);opacity:0}}
@keyframes fitSpin{to{transform:rotate(360deg)}}
@keyframes fitBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.fit-breathe{animation:fitBreathe 1.8s ease-in-out infinite}
.fit-scan{animation:fitScan 2.6s ease-in-out infinite}.fit-pop{animation:fitPop .45s ease-out both}
.fit-pulse{animation:fitPulse 1.6s ease-out infinite}.fit-spin{animation:fitSpin 1.4s linear infinite}
@media (prefers-reduced-motion:reduce){.fit-scan,.fit-pulse,.fit-spin,.fit-pop,.fit-breathe{animation:none}}
`;
/** The page behind Fit (outside its own boxes), so a light look fills the whole screen. */
export const PAGE_BG = { fresh: "#F2F6F3", night: "#0B1220", bold: "#FFFFFF" };

// ---- nutrition facts while the photo is read: well-established findings, each with where it comes from ----
export const FACTS = [
  { en: "Your body uses about 20–30% of the calories in protein just to digest it — far more than for carbohydrate (5–10%) or fat (0–3%).",
    ar: "يستهلك جسمك نحو 20–30% من سعرات البروتين لهضمه وحده — أكثر بكثير من الكربوهيدرات (5–10%) والدهون (0–3%).", src: { en: "Thermic effect of food", ar: "التأثير الحراري للطعام" } },
  { en: "A gram of fat holds about 9 calories — more than twice a gram of protein or carbohydrate (about 4).",
    ar: "يحتوي غرام الدهون على نحو 9 سعرات — أكثر من ضعف غرام البروتين أو الكربوهيدرات (نحو 4).", src: { en: "Atwater energy factors", ar: "معاملات أتواتر للطاقة" } },
  { en: "WHO advises adults to eat less than 5 g of salt a day — about one level teaspoon.",
    ar: "توصي منظمة الصحة العالمية البالغين بأقل من 5 غرامات من الملح يوميًا — نحو ملعقة صغيرة مستوية.", src: { en: "World Health Organization", ar: "منظمة الصحة العالمية" } },
  { en: "WHO advises keeping free sugars below 10% of your daily calories — and below 5% for extra benefit.",
    ar: "توصي منظمة الصحة العالمية بأن تبقى السكريات الحرة أقل من 10% من سعراتك اليومية — وأقل من 5% لفائدة أكبر.", src: { en: "World Health Organization", ar: "منظمة الصحة العالمية" } },
  { en: "WHO recommends at least 400 g of fruit and vegetables a day — about five portions.",
    ar: "توصي منظمة الصحة العالمية بـ400 غرام على الأقل من الفاكهة والخضار يوميًا — نحو خمس حصص.", src: { en: "World Health Organization", ar: "منظمة الصحة العالمية" } },
  { en: "Adults are advised about 25 g of fibre a day; beans, lentils, vegetables and whole grains are rich in it.",
    ar: "يُنصح البالغون بنحو 25 غرامًا من الألياف يوميًا؛ والفول والعدس والخضار والحبوب الكاملة غنية بها.", src: { en: "European Food Safety Authority", ar: "الهيئة الأوروبية لسلامة الأغذية" } },
  { en: "One tablespoon of olive oil is about 120 calories — oil is the easiest calorie to miss on a plate.",
    ar: "ملعقة كبيرة من زيت الزيتون فيها نحو 120 سعرًا — والزيت أسهل سعرات تُنسى في الطبق.", src: { en: "USDA FoodData Central", ar: "قاعدة بيانات وزارة الزراعة الأمريكية" } },
  { en: "One large egg has about 6 g of high-quality protein and roughly 70–80 calories.",
    ar: "في البيضة الكبيرة نحو 6 غرامات من البروتين عالي الجودة ونحو 70–80 سعرًا.", src: { en: "USDA FoodData Central", ar: "قاعدة بيانات وزارة الزراعة الأمريكية" } },
  { en: "The reference protein intake for adults is about 0.83 g per kilogram of body weight a day.",
    ar: "المرجع لاحتياج البالغين من البروتين نحو 0.83 غرام لكل كيلوغرام من وزن الجسم يوميًا.", src: { en: "WHO / EFSA", ar: "منظمة الصحة العالمية / الهيئة الأوروبية" } },
  { en: "WHO recommends 150–300 minutes of moderate activity a week for adults, such as brisk walking.",
    ar: "توصي منظمة الصحة العالمية البالغين بـ150–300 دقيقة أسبوعيًا من النشاط المعتدل، مثل المشي السريع.", src: { en: "World Health Organization", ar: "منظمة الصحة العالمية" } },
  { en: "Water makes up roughly 50–60% of an adult's body weight.",
    ar: "يشكّل الماء نحو 50–60% من وزن جسم الشخص البالغ.", src: { en: "Human physiology", ar: "علم وظائف الأعضاء" } },
  { en: "WHO advises getting less than 1% of your daily calories from trans fat — it is often in fried and baked snacks.",
    ar: "توصي منظمة الصحة العالمية بأن تكون الدهون المتحولة أقل من 1% من سعراتك اليومية — وتوجد غالبًا في المقليات والمخبوزات الجاهزة.", src: { en: "World Health Organization", ar: "منظمة الصحة العالمية" } },
];
/** A shuffled order of the facts (a different one each photo), from a seed. */
export function factOrder(seed = Date.now()) {
  const idx = FACTS.map((_, i) => i); let s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  for (let i = idx.length - 1; i > 0; i--) { s = (s * 48271) % 2147483647; const j = s % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

// ---- where each food's label goes on the photo ----
/**
 * items → { marks: [{ i, x, y, side, ly }], loose: [i…] }   (all in 0..1 of the photo)
 *   x, y   the food's centre (from the photo reader's box), where the arrow points
 *   side   "l" | "r": the label sits on the nearer edge;   ly: the label's height, spread so labels never overlap
 *   loose  foods with no place on the photo (the fast look only names the dish) — shown as chips, no arrow
 * One food and no box: it is the whole plate — its arrow points at the middle.
 */
export function placeMarks(items, { gap = 0.13 } = {}) {
  const list = (items || []).map((x, i) => ({ x, i })).filter((o) => o.x && (o.x.grams > 0 || o.x.kcal != null));
  const boxed = list.filter((o) => Array.isArray(o.x.box) && o.x.box.length === 4);
  const marks = [], loose = [];
  if (!boxed.length && list.length === 1) marks.push({ i: list[0].i, x: 0.5, y: 0.5 });
  else {
    for (const o of list) {
      if (!boxed.includes(o)) { loose.push(o.i); continue; }
      const [bx, by, bw, bh] = o.x.box.map(Number);
      marks.push({ i: o.i, x: clamp01(bx + bw / 2), y: clamp01(by + bh / 2) });
    }
  }
  for (const side of ["l", "r"]) {
    const col = marks.filter((m) => (m.x < 0.5 ? "l" : "r") === side).sort((a, b) => a.y - b.y);
    let prev = -1;
    for (const m of col) { m.side = side; m.ly = Math.max(m.y, prev + gap, 0.08); prev = m.ly; }
    // pushed off the bottom: slide the whole column up
    const over = col.length ? col[col.length - 1].ly - 0.92 : 0;
    if (over > 0) for (const m of col) m.ly = Math.max(0.06, m.ly - over);
  }
  return { marks, loose };
}
const clamp01 = (v) => Math.max(0.02, Math.min(0.98, Number(v) || 0.5));

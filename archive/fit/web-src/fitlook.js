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
  // v6.27 (Ali: "i loved the 3 interfaces, make them optional"): three looks that also change how the Diary is laid out
  { id: "meals", en: "Colour per meal", ar: "لون لكل وجبة", hint: { en: "Light; each meal its own colour", ar: "فاتح؛ لكل وجبة لونها" }, swatch: ["#F6F7FB", "#F59E0B", "#22C55E", "#6366F1"] },
  { id: "rings", en: "Rings", ar: "الحلقات", hint: { en: "Dark; a ring for each nutrient", ar: "داكن؛ حلقة لكل عنصر غذائي" }, swatch: ["#0E1116", "#0EA5E9", "#8B5CF6", "#FB7185"] },
  { id: "tiles", en: "Pastel tiles", ar: "مربعات هادئة", hint: { en: "Soft colours, big tiles", ar: "ألوان ناعمة ومربعات كبيرة" }, swatch: ["#FFE7C2", "#E3F7E8", "#E6E8FF", "#FFE4EC"] },
];
// the Diary layout each look uses ("classic" = the ring card and one list of meals)
export const layoutOf = (id) => (id === "meals" || id === "rings" || id === "tiles" ? id : "classic");
// each meal's colour and sign in the new looks
export const MEAL_STYLE = { breakfast: { col: "#F59E0B", soft: "#FEF3C7", em: "🌅" }, lunch: { col: "#22C55E", soft: "#DCFCE7", em: "☀️" }, dinner: { col: "#6366F1", soft: "#E0E7FF", em: "🌙" }, snacks: { col: "#EC4899", soft: "#FCE7F3", em: "🍎" } };
export const DEFAULT_LOOK = "fresh";
export const lookOf = (st) => (LOOKS.some((l) => l.id === (st && st.look)) ? st.look : DEFAULT_LOOK);
export const isLight = (id) => id === "fresh" || id === "bold" || id === "meals" || id === "tiles";

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

// v6.32 (Ali: "the colour and text to be contrast so it's more visible"): darker secondary text (about 7:1 on the page),
// firmer lines and a deeper green in the light looks; lighter grey text and lines in the dark ones
export const LOOK_CSS = `
/* v7.1: a look's own palette applies in light mode only — in dark, Fit follows the app's Quiet Atelier dark (no light strips) */
html.att-light body:has(.fit-look-fresh):not(.att-modal-open),html.att-light .fit-look-fresh{${LIGHT_BASE("#16201C", "#F4F7F5", "#FFFFFF", "#EEF3F0", "#DCE5E0", "#B5C4BC", "#46534D", "#33413A")}
  --color-emerald-100:#0E4A2F;--color-emerald-200:#11563A;--color-emerald-300:#157A52;--color-emerald-400:#178A5C;--color-emerald-500:#1E9E6A;--color-emerald-600:#178A5C;--color-emerald-700:#157A52;
  --color-emerald-800:#BFE3CF;--color-emerald-900:#CFEBDB;--color-emerald-950:#E3F4EC;color-scheme:light}
/* v6.43 design A: Nunito (rounded, friendly — bundled, OFL), Arabic in IBM Plex Sans Arabic */
.fit-look-fresh,.fit-look-fresh button,.fit-look-fresh input,.fit-look-fresh textarea,.fit-look-fresh select{font-family:"Nunito","IBM Plex Sans Arabic",ui-sans-serif,system-ui,sans-serif}
.fit-design-a [data-testid=fit-today] .divide-slate-800>*+*{border-color:#EEF2F0}
/* every other Fit card takes design A's card too: white, no outline, a soft shadow, rounder */
.fit-design-a .bg-slate-900\\/70,.fit-design-a .bg-slate-900\\/60{background:#FFFFFF;border-color:transparent;box-shadow:0 1px 3px rgba(16,32,28,.08)}
.fit-design-a .rounded-2xl.bg-slate-900\\/70,.fit-design-a .rounded-2xl.bg-slate-900\\/60{border-radius:1.5rem}
${ON_FILL(".fit-look-fresh")}
html.att-light body:has(.fit-look-bold):not(.att-modal-open),html.att-light .fit-look-bold{${LIGHT_BASE("#11142B", "#FFFFFF", "#F4F4F8", "#E8E8F0", "#C9CAD8", "#A3A5BA", "#45485E", "#2E3147")}
  --color-emerald-100:#9A3412;--color-emerald-200:#9A3412;--color-emerald-300:#C2410C;--color-emerald-400:#EA580C;--color-emerald-500:#F25C2A;--color-emerald-600:#E2501F;--color-emerald-700:#C2410C;
  --color-emerald-800:#FED7C3;--color-emerald-900:#FFE4D6;--color-emerald-950:#FFF1EA;color-scheme:light}
${ON_FILL(".fit-look-bold")}
html.att-light body:has(.fit-look-meals):not(.att-modal-open),html.att-light .fit-look-meals{${LIGHT_BASE("#111827", "#F3F5FA", "#FFFFFF", "#E8ECF3", "#CBD2DE", "#A5AFC0", "#475268", "#2F394D")}
  --color-emerald-100:#14532D;--color-emerald-200:#166534;--color-emerald-300:#15803D;--color-emerald-400:#16A34A;--color-emerald-500:#22C55E;--color-emerald-600:#16A34A;--color-emerald-700:#15803D;
  --color-emerald-800:#BBF7D0;--color-emerald-900:#DCFCE7;--color-emerald-950:#F0FDF4;color-scheme:light}
${ON_FILL(".fit-look-meals")}
html.att-light body:has(.fit-look-rings):not(.att-modal-open),html.att-light .fit-look-rings{--color-slate-950:#0E1116;--color-slate-900:#161B22;--color-slate-800:#222A35;--color-slate-700:#3A4658;--color-slate-600:#56647A;--color-slate-500:#A3B0C2;--color-slate-400:#C9D3E0;--color-slate-300:#E2E8F0;
  --color-emerald-300:#7DD3FC;--color-emerald-400:#38BDF8;--color-emerald-500:#0EA5E9;--color-emerald-600:#0284C7;--color-emerald-700:#0369A1;color-scheme:dark}
html.att-light body:has(.fit-look-tiles):not(.att-modal-open),html.att-light .fit-look-tiles{${LIGHT_BASE("#1E1915", "#FFFDF8", "#FFFFFF", "#F4ECE0", "#E3D6C4", "#C7B49B", "#5A4B3C", "#3F3428")}
  --color-emerald-100:#9A3412;--color-emerald-200:#9A3412;--color-emerald-300:#C2410C;--color-emerald-400:#EA580C;--color-emerald-500:#F97316;--color-emerald-600:#EA580C;--color-emerald-700:#C2410C;
  --color-emerald-800:#FED7AA;--color-emerald-900:#FFEDD5;--color-emerald-950:#FFF7ED;color-scheme:light}
${ON_FILL(".fit-look-tiles")}
.fit-look-tiles .text-2xl,.fit-look-tiles .text-3xl{font-weight:800}
.fit-look-bold .text-2xl,.fit-look-bold .text-3xl,.fit-look-bold .text-4xl{font-weight:800;letter-spacing:-.01em}
html.att-light body:has(.fit-look-night):not(.att-modal-open),html.att-light .fit-look-night{--color-slate-950:#0B1220;--color-slate-900:#121C30;--color-slate-800:#1E2C47;--color-slate-700:#3A4F78;--color-slate-600:#566B94;--color-slate-500:#A3B3CC;--color-slate-400:#C9D4E5;--color-slate-300:#E2E8F0;
  --color-emerald-300:#5EEAD4;--color-emerald-400:#2DD4BF;--color-emerald-500:#2DD4BF;--color-emerald-600:#0D9488;--color-emerald-700:#0F766E;color-scheme:dark}
body.att-modal-open [data-testid=fit-nav]{display:none}
.fit-min [data-testid=fit-ring] .text-slate-800{color:var(--color-slate-700)}.fit-min [data-testid=fit-ring] .bg-slate-800,.fit-min [data-testid=fit-water] .bg-slate-800{background:var(--color-slate-700)}
.fit-min [data-testid=fit-ring] .text-slate-400{color:var(--color-slate-300)}
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
export const PAGE_BG = { fresh: "#F4F7F5", night: "#0B1220", bold: "#FFFFFF", meals: "#F6F7FB", rings: "#0E1116", tiles: "#FFFDF8" };

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

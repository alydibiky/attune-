/* ---- v6.12: Auto — the chat picks the model, the web search and the thinking for each question --------------------------------
   Ali: "the chat should detect the best engine for this question if I downloaded more than one, and whether it needs web search
   or thinking". Pure logic; the chat calls it before answering. Tests: tests/unit/v710router.test.mjs.
   - The kind of question: photo, code, maths, reasoning, a long report / document, a translation, or a quick question.
   - The model: switching costs 10–30 s, so a quick question keeps whatever is loaded; a hard one moves to the strongest model
     that runs smoothly on this phone when it is clearly better (≥ 1 quality step); a photo needs a model that sees.
   - The web: only when fresh facts are needed (prices, specs, news, scores, "latest", this year), never for personal data,
     maths, code or writing tasks.
   - Thinking: for puzzles, maths, proofs and code on a model that can think; never for quick questions (slower, hotter).   */

// How good each model is at hard work (measured max-test scores and size order, HANDOFF §5.37–5.39). Higher = better.
export const QUALITY = { "moe-xl-long": 10, "moe-xl": 9.8, ultra: 9.5, "moe-lg": 9, max: 8.6, xl: 8, lg: 7, "md-hi": 6.6, "fast-e4b": 6.4, md: 6.2, "md-lo": 6, "fast-e2b": 5, sm: 4, xs: 2 };
export const qualityOf = (t) => (t && QUALITY[t.id] != null ? QUALITY[t.id] : t && /(\d+(?:\.\d+)?)B/.test(String(t.params || "")) ? Math.min(9, 2 + Math.log2(parseFloat(RegExp.$1) + 1) * 2) : 3);

const CODE = /```|\b(code|function|script|python|javascript|typescript|java|c\+\+|kotlin|sql|regex|api|bug|debug|compile|stack ?trace|exception|website|html|css|react|app that|program)\b|كود|برنامج|دالة|موقع ويب/i;
const MATH = /\d\s*[-+*/×÷^%]\s*\d|\b(calculate|solve|equation|integral|derivative|probability|percent(age)?|how many|how much will|total cost|interest|loan|vat)\b|احسب|معادلة|نسبة|كام في المية|فايدة|قرض/i;
const REASON = /\b(puzzle|riddle|logic|prove|proof|why does|explain why|step by step|deduce|which (one|is true)|if .* then|seating|arrangement|paradox|strategy|plan for|compare .* and)\b|لغز|فزورة|منطق|استنتج|ليه بيحصل|خطوة بخطوة/i;
const REPORT = /\b(report|proposal|business plan|essay|article|presentation|slides|cv|resume|cover letter|contract|detailed|in detail|full analysis)\b|تقرير|عرض تقديمي|خطة عمل|مقال|عقد|بالتفصيل/i;
const TRANSLATE = /\b(translate|translation)\b|ترجم/i;
const FRESH = /\b(latest|newest|today|tonight|yesterday|this (week|month|year)|news|current(ly)?|right now|price|prices|cost of|how much (is|are|does)|release[ds]?|launch(ed)?|specs?|specifications?|trims?|versions? of|who won|score|results?|weather|exchange rate|stock|share price|schedule|opening hours|open now|near me|20[2-3]\d)\b|أحدث|احدث|أخبار|اخبار|النهارده|انهارده|امبارح|سعر|أسعار|اسعار|بكام|مواصفات|فئات|نزل امتى|الطقس|الجو|مواعيد|نتيجة|سعر الصرف/i;
const PERSONAL = /\b(my|mine|me|i spent|i paid|i have)\b.*\b(expenses?|notes?|money|period|cycle|meals?|calories|tasks?|reminders?|files?)\b|مصاريفي|ملاحظاتي|فلوسي|دورتي|أكلي|مهامي/i;

/** What kind of question this is. */
export function taskOf(text, { photo = false, file = false } = {}) {
  const t = String(text || "");
  if (photo) return "photo";
  if (CODE.test(t)) return "code";
  if (MATH.test(t) && /\d/.test(t)) return "math";
  if (REASON.test(t)) return "reason";
  if (TRANSLATE.test(t)) return "translate";
  if (REPORT.test(t) || t.length > 600 || file) return "report";
  return "quick";
}
const HARD = new Set(["code", "math", "reason", "report"]);

/** Does this question need the web? (auto mode) */
export function wantsWeb(text, task = taskOf(text)) {
  const t = String(text || "");
  if (t.trim().length < 8 || PERSONAL.test(t)) return false;
  if (task === "code" || task === "math" || task === "translate") return false;
  if (/^(write|draft|rewrite|summari[sz]e|translate|fix|improve|make it|اكتب|لخص|ترجم|صلح|حسّن)/i.test(t.trim())) return false;
  return FRESH.test(t);
}

/** Should the model think first? (auto mode) */
export function wantsThink(text, task = taskOf(text), canThink = true) {
  return !!canThink && (task === "math" || task === "reason" || (task === "code" && String(text || "").length > 60));
}

/**
 * The model for this question. installed: [{ id, tier }] (tier = the catalogue entry), active: the loaded id, ramGB: the phone's.
 * → { id, switch: bool, why } — `switch` false means: keep the loaded model.
 */
export function pickModel(task, installed, { active = null, ramGB = 8 } = {}) {
  const list = (installed || []).filter((m) => m && m.tier);
  const cur = list.find((m) => m.id === active) || null;
  const fits = (m) => !m.tier.smoothRam || m.tier.smoothRam <= ramGB + 0.5;   // runs smoothly on this phone
  const usable = list.filter(fits);
  if (!usable.length) return { id: active, switch: false, why: "keep" };
  if (task === "photo") {
    if (cur && cur.tier.vision) return { id: cur.id, switch: false, why: "keep" };
    const v = usable.filter((m) => m.tier.vision).sort((a, b) => qualityOf(b.tier) - qualityOf(a.tier))[0];
    return v ? { id: v.id, switch: true, why: "photo" } : { id: active, switch: false, why: "keep" };
  }
  if (!HARD.has(task)) {
    if (cur) return { id: cur.id, switch: false, why: "keep" };
    const fast = [...usable].sort((a, b) => (b.tier.engine === "litert") - (a.tier.engine === "litert") || qualityOf(b.tier) - qualityOf(a.tier))[0];
    return { id: fast.id, switch: true, why: "quick" };
  }
  const best = [...usable].sort((a, b) => qualityOf(b.tier) - qualityOf(a.tier))[0];
  if (!cur) return { id: best.id, switch: true, why: task };
  if (best.id !== cur.id && qualityOf(best.tier) - qualityOf(cur.tier) >= 1) return { id: best.id, switch: true, why: task };
  return { id: cur.id, switch: false, why: "keep" };
}

/** The words shown while the model changes. */
export function switchLine(tierLabel, why, ar = false) {
  const w = { code: ["code", "الكود"], math: ["maths", "الحسابات"], reason: ["reasoning", "التفكير المنطقي"], report: ["long, detailed answers", "الإجابات الطويلة المفصّلة"], photo: ["photos", "الصور"], quick: ["quick answers", "الإجابات السريعة"] }[why] || ["this", "ده"];
  return ar ? `بنقل لـ ${tierLabel} — الأقوى في ${w[1]} على موبايلك…` : `Switching to ${tierLabel} — your best model for ${w[0]}…`;
}

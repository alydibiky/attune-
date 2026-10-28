/* ---- v8.7 (Ali picked persona 3's point 6 and P3-A): what the person used Pro for, counted on the phone ---------------------
   "2 days of Pro left — you used it for 12 meals by photo, 3 agents and 2 deal checks" sells better than any list. Each Pro
   thing adds one here; Home shows it from day 5 of the trial, and once when the trial ends. Nothing leaves the phone.         */
const KEY = "attune:pro-use";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } };
/** kind: "photo" (a meal read from a photo) | "agent" | "deal" | "xray" | "report" | "research" */
export function noteProUse(kind) { try { const u = read(); u[kind] = (u[kind] || 0) + 1; localStorage.setItem(KEY, JSON.stringify(u)); } catch (e) {} }
const WORDS = { photo: ["1 meal by photo", "{n} meals by photo", "{n} وجبة بالصورة"], agent: ["1 agent", "{n} agents", "{n} وكيل"],
  deal: ["1 deal check", "{n} deal checks", "{n} فحص صفقة"], xray: ["1 chat X-ray", "{n} chat X-rays", "{n} فحص محادثة"],
  report: ["1 report or slides", "{n} reports and slides", "{n} تقرير وعرض"], research: ["1 deep research", "{n} deep researches", "{n} بحث متعمق"] };
/** "12 meals by photo, 3 agents and 2 deal checks" (or "" when nothing Pro was used). */
export function usedLine(lang = "en", u = read()) {
  const ar = lang === "ar", parts = Object.keys(WORDS).filter((k) => u[k] > 0).map((k) => WORDS[k][ar ? 2 : u[k] === 1 ? 0 : 1].replace("{n}", u[k]));
  if (!parts.length) return "";
  return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(ar ? "، " : ", ") + (ar ? " و" : " and ") + parts[parts.length - 1];
}
/** What Home shows: {kind: "ending", left, used} from day 5 (2 days or fewer left), {kind: "ended", used} once after it ends, else null. */
export function trialNote({ left, started, pro, seenEnd }, lang = "en") {
  if (pro || !started) return null;
  if (left > 0 && left <= 2) return { kind: "ending", left, used: usedLine(lang) };
  if (left <= 0 && !seenEnd) return { kind: "ended", used: usedLine(lang) };
  return null;
}

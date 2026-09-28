/* ---- v5.32: "where is the nearest …" → the map ------------------------------------------------
   Ali in Instant: "I want to go to fuel up and I am at Emerald Park compound, what shall I do"
   → the answer "Go to the nearest fuel station" helps nobody. A phone model can't know what is
   near you; the map can. So a request about a place nearby becomes one tap to Google Maps,
   searched for that kind of place near where the person said they are.
   Pure; tests in tests/unit/v532.test.mjs.                                                      */

const KINDS = [
  [/\b(fuel|petrol|gas station|gasoline|refuel|fill (?:up|the tank)|diesel)\b|بنزين|بنزينة|محطة (?:بنزين|وقود)|وقود|أفوّل|افول|أموّن|اموّن/i, "gas station", "محطة بنزين"],
  [/\b(pharmacy|chemist|drugstore)\b|صيدلية|صيدليه|اجزخانة/i, "pharmacy", "صيدلية"],
  [/\b(hospital|emergency room|clinic|doctor near)\b|مستشفى|مستشفي|طوارئ|عيادة/i, "hospital", "مستشفى"],
  [/\b(atm|cash machine|bank near)\b|ماكينة (?:فلوس|صراف|ATM)|صراف|بنك/i, "ATM", "ماكينة صراف"],
  [/\b(restaurant|food near|eat nearby|somewhere to eat)\b|مطعم|مطاعم|اكل قريب/i, "restaurant", "مطعم"],
  [/\b(cafe|coffee shop|coffee near)\b|كافيه|قهوة قريبة/i, "cafe", "كافيه"],
  [/\b(supermarket|grocery|groceries)\b|سوبر ?ماركت|بقالة|هايبر/i, "supermarket", "سوبرماركت"],
  [/\b(mechanic|car repair|tyre|tire shop|car wash)\b|ميكانيكي|ورشة|كاوتش|غسيل عربيات/i, "car repair", "ورشة عربيات"],
  [/\b(mosque|prayer)\b|مسجد|جامع/i, "mosque", "مسجد"],
  [/\b(ev charg\w*|charging station|charger)\b|شاحن عربيات|محطة شحن/i, "EV charging station", "محطة شحن"],
  [/\b(parking|car park|park (?:my|the) car)\b|\bwhere (?:can|do|should) i park\b|ركنة|اركن|أركن|جراج|باركينج/i, "parking", "جراج"],
];
const NEARBY = /\b(near(?:est|by)?|close(?:st)?|around (?:here|me)|where (?:can|do|should) i|i am at|i'm at|i am in|i'm in|go to|find)\b|أقرب|اقرب|قريب|فين|انا في|أنا في|انا عند|أنا عند|عايز أروح|عايز اروح/i;

/** A place request → {what, near, url, label} or null. */
export function placeFor(text) {
  const t = String(text || "").trim();
  if (t.length < 6 || t.length > 400) return null;
  const k = KINDS.find(([re]) => re.test(t));
  if (!k || !NEARBY.test(t)) return null;
  const ar = /[؀-ۿ]/.test(t);
  const at = t.match(/\b(?:i am at|i'm at|i am in|i'm in|near|from)\s+(?:the\s+)?([A-Za-z0-9][\w'&\- ]{2,50}?)(?=\s*(?:now|right now|and|,|\.|\?|what|so|$))/i)
    || t.match(/(?:انا|أنا)\s+(?:في|عند)\s+([^\s،.؟?][^،.؟?\n]{2,40}?)(?=\s*(?:دلوقتي|،|\.|؟|\?|$)|\s+و)/);   // «و» only as its own word («كمبوند» has a و inside)
  const near = at ? at[1].trim() : "";
  const what = ar ? k[2] : k[1];
  const q = near ? what + (ar ? " قريب من " : " near ") + near : what + (ar ? " قريبة" : " near me");
  return { what, near, query: q, url: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q) };
}

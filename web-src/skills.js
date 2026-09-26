/* ---- Skills: answer recipes for a small model (v5.15) ------------------------------------
   A 2–4B model on a phone can't be made to KNOW more by code — its weights are fixed.
   What code can do is ask better. Small models follow a concrete recipe far more
   reliably than a general "be helpful": told exactly how a good comparison, how-to or
   email is built, they produce it; left to choose, they write one vague line.

   So each question is matched to at most ONE recipe (English and Egyptian Arabic
   patterns), and the recipe — a few dozen tokens — is added under the question.
   It goes in the user turn, not the system prompt, so the system prompt stays the
   same from question to question and the engine's prompt cache keeps working (speed).
   Pure logic, unit-tested in tests/unit/v515.test.mjs.                                  */

const R = (id, test, recipe) => ({ id, test, recipe });

// Order matters: the first match wins (the most specific shapes first).
export const SKILLS = [
  R("translate",
    /^\s*translate\b|(^|\s)(ترجم|ترجملي|ترجمة)(?=\s|$|[؟?،,.:!])|\b(in|into|to) (english|arabic|turkish|french|german)\s*[:?]?\s*$|بالانجليزي|بالإنجليزي|بالعربي|بالتركي/i,
    "Give ONLY the translation, ready to copy. Keep names, numbers and units exactly. If a phrase has no direct equivalent, add one short note at the end in brackets."),
  R("email",
    /\b(write|draft|reply|compose)\b.{0,40}\b(email|e-mail|message|letter|whatsapp|reply|post|caption)\b|\b(email|letter|message) (to|for)\b|اكتب(لي)?\s+(ايميل|إيميل|رسالة|جواب|خطاب|بوست|رد)|رد على/i,
    "Write the finished text first, ready to send: (subject line if it is an email), greeting, 2–4 short paragraphs, a clear request or next step, sign-off. Match the tone asked (formal by default for clients). No explanation before it; at most one line of notes after it."),
  R("compare",
    /\b(vs\.?|versus|compare|comparison|difference between|differences|better than|which (one )?is better|same as|or the)\b|الفرق بين|قارن|مقارنة|أحسن من|احسن من|ولا\s+\S+\s*[؟?]\s*$|نفس ال/i,
    "Recipe: line 1 = the verdict in **bold** (e.g. **No — they are different models.**). Then a table | Point | A | B | with 4–7 rows of CONCRETE differences (size, capacity, price class, features, best use). Then one line: \"Choose A if …; choose B if …\". Only facts you are sure of — write \"not sure\" in a cell rather than guess."),
  R("steps",
    /^\s*(how (do|can|should) (i|we|you)|how to|steps to|guide to|procedure)\b|\bstep by step\b|(^|\s)(ازاي|إزاي|اعمل ايه|أعمل إيه|خطوات|طريقة|خطوة بخطوة)(?=\s|$|[؟?،,.:!])/i,
    "Recipe: one line saying what the result will be. Then numbered steps, each starting with a verb, one action per step, with the exact value/setting where it matters. Put ⚠️ before any safety warning. End with how to check it worked."),
  R("explain",
    /^\s*(explain|what is|what are|what's|why (is|does|do|are)|how does|how do .* work|define|meaning of)\b|(^|\s)(اشرح|اشرحلي|يعني ايه|يعني إيه|ايه هو|إيه هو|ايه هي|إيه هي|ليه|لماذا|ما هو|ما هي)(?=\s|$|[؟?،,.:!])/i,
    "Recipe: line 1 = a one-sentence answer in **bold**. Then \"How it works\" as 3–6 short numbered points, each cause → effect. Then one concrete example with real numbers. Give technical terms as English (Arabic) when the user writes Arabic or asks for both. No filler."),
  R("list",
    /\b(list|give me \d+|top \d+|best \d*|ideas for|suggest|recommend|options for)\b|اقترح|اقترحلي|أفضل \d*|افضل \d*|أمثلة|امثلة|أفكار|افكار/i,
    "Recipe: a numbered list of 3–7 items. Each item: **name** — why it fits, in one line, with a concrete detail (number, price range, spec). Best option first. End with one line on how to choose."),
  R("plan",
    /\b(plan|schedule|timetable|itinerary|roadmap|routine|program for)\b|خطة|جدول|برنامج (يومي|اسبوعي|أسبوعي)/i,
    "Recipe: one line with the goal and total time. Then a table | When | What | Detail | (days, weeks or steps in order). Then 2–3 bullets of tips or risks. Keep every row actionable."),
  R("summary",
    /^\s*(summari[sz]e|summary|tl;?dr|sum up)\b|^\s*(لخص|لخصلي|ملخص|اختصر)(?=\s|$|[؟?،,.:!])/i,
    "Recipe: 3–5 bullets with the key points, keeping every number, name and date exactly. Then one line in **bold**: the bottom line / what to do."),
];

/** The recipe for a message, or null. → { id, block } */
export function skillFor(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 2000) return null;          // a pasted document: its own request shapes it
  for (const s of SKILLS) if (s.test.test(t)) return { id: s.id, block: "\n\n(How to answer well: " + s.recipe + ")" };
  return null;
}

/* ---- Tips and tricks that make every model smarter and more accurate (v5.26) --------------
   Ali: "give them lines of code that make them smarter and more accurate — the tips and
   tricks — and focus on maximising the SMALL models". Each trick is a known, measured way
   to get more out of the same model; none needs a bigger download:

   1. SAMPLING per model family and task. Qwen and Gemma publish their own best settings;
      facts / maths / code want a tight, low-temperature pick, stories a looser one. Small
      models get it even tighter plus min_p, which cuts the rare junk tokens that turn
      "1,200 Nm" into "1,2,00 Nm" — the thing small models get wrong most.
   2. A SHORT system prompt for small models: a 0.8B–2B model follows six clear rules and
      one example far better than twenty rules (and the phone starts answering sooner).
   3. HONESTY without the web: never invent specs, prices, dates or names; mark estimates
      and say they may be out of date. Stops the confident made-up car specs.
   4. RE-READING (the "RE2" trick): the question is shown a second time at the end on
      reasoning and maths questions — measurably fewer slips, especially on small models.
   5. EVERY PART: a message with several questions gets a numbered checklist, so a small
      model doesn't answer the first and forget the rest.
   6. SANDWICH: with a long document the question goes before AND after it, so it isn't
      lost behind 10,000 words.
   7. JSON MODE: Business designs, queries and forms are locked to valid JSON by the engine
      itself (with a safe retry without it if an engine ever refuses).
   Pure functions; unit-tested in tests/unit/v526.test.mjs.                                 */

/** "qwen" | "gemma" | "other" from a model tier */
export function familyOf(tier) {
  const s = String((tier && (tier.label + " " + (tier.repo || "") + " " + (tier.url || ""))) || "").toLowerCase();
  return /qwen/.test(s) ? "qwen" : /gemma/.test(s) ? "gemma" : "other";
}

const CREATIVE = /\b(story|poem|poetry|song|lyrics|slogan|tagline|caption|joke|creative|brainstorm|ideas? for|names? for|imagine|fiction|rap|limerick)\b|قصة|قصيدة|شعر|أغنية|اغنية|نكتة|أفكار|افكار|اسم ل|أسماء|اسماء|شعار/i;
const PRECISE = /\d|\b(calculate|compute|how (much|many)|total|price|cost|spec|specs|specifications?|capacity|torque|horsepower|hp|formula|equation|convert|translate|code|python|javascript|sql|excel|function|bug|error|date|year|when|exact|define|definition|law|tax|vat|dose|chart)\b|احسب|كام|سعر|مواصفات|ترجم|معادلة|ضريبة|قانون|كود|تاريخ|امتى|إمتى/i;

/** "precise" | "creative" | "chat" — what the user's message needs from the sampler */
export function taskKind(text) {
  const t = String(text || "");
  if (CREATIVE.test(t)) return "creative";
  if (PRECISE.test(t)) return "precise";
  return "chat";
}

/**
 * The sampler settings for one answer. level 1–5 (power.js); kind from taskKind.
 * → { temperature, top_p, top_k, min_p }
 */
export function samplingFor(family, level, kind) {
  const small = (level || 3) <= 2;
  const T = { precise: 0.3, chat: 0.6, creative: 0.85 }[kind] ?? 0.5;
  const s = family === "gemma"
    ? { temperature: T, top_p: 0.95, top_k: 64, min_p: 0.05 }      // Gemma's own top_k/top_p
    : family === "qwen"
      ? { temperature: T, top_p: 0.8, top_k: 20, min_p: 0.05 }      // Qwen's own non-thinking settings
      : { temperature: T, top_p: 0.9, top_k: 40, min_p: 0.05 };
  if (small) {                                                     // small models: tighter
    s.temperature = Math.round(s.temperature * (kind === "creative" ? 0.9 : 0.7) * 100) / 100;
    s.min_p = kind === "creative" ? 0.05 : 0.1;
    s.top_k = Math.min(s.top_k, 20);
  }
  return s;
}

/** Shown to every model without the web: don't invent. */
export const HONESTY_RULE = `KNOWLEDGE HONESTY (when the message gives you no PASSAGES or file to answer from):
- Never invent specifications, prices, dates, names, statistics, quotes, laws or links. If you are not sure of a figure, say "about" and give a range, or say you don't know.
- Prices, "latest" models and anything that changes: say your information may be out of date and suggest turning on Web for current figures.`;

/**
 * The short system prompt for small models (levels 1–2): six rules and one example of the
 * answer shape — small models copy an example far better than they follow a rule.
 */
export function compactSystem(today) {
  return `You are Attune, a helpful assistant on the user's phone.
Rules:
1. Answer in the user's language (Egyptian Arabic if they write it).
2. Start with the direct answer in **bold**, then 2–5 short bullets. Short questions get short answers.
3. Sums: write each step on its own line, then the total in **bold**. Never guess a number.
4. Never invent facts, prices, specs or names. If unsure, say so.
5. Write the answer once. No preamble, no repeating yourself.
6. Plain maths (3 × 4, x²), never LaTeX.
Today is ${today}.

Example:
User: How long does it take to boil an egg?
Assistant: **About 9–12 minutes for a hard-boiled egg.**
- Soft (runny yolk): 6–7 minutes
- Medium: 8 minutes
- Start timing when the water boils, then cool the egg in cold water.`;
}

/** Re-reading (RE2): the question once more at the end. Only for reasoning/maths. */
export function reread(content, question) {
  const q = String(question || "").trim();
  if (!q || q.length > 1200) return content;
  return content + "\n\nRead the question again: " + q;
}

/** The separate questions in one message (2+), or [] when it is a single one. */
export function partsOf(text) {
  const t = String(text || "").trim();
  if (t.length > 1500) return [];
  // numbered / bulleted asks on their own lines
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const listed = lines.filter((l) => /^(\d+[.)]|[-*•])\s+\S/.test(l));
  if (listed.length >= 2) return listed.map((l) => l.replace(/^(\d+[.)]|[-*•])\s+/, "")).slice(0, 8);
  // several questions in running text
  const qs = t.split(/(?<=[?؟])\s+/).map((s) => s.trim()).filter((s) => /[?؟]$/.test(s) && s.length > 6);
  return qs.length >= 2 ? qs.slice(0, 8) : [];
}

/** A checklist so every part gets answered, in order. */
export function everyPart(parts) {
  if (!parts || parts.length < 2) return "";
  return "\n\n(This message has " + parts.length + " parts. Answer EVERY one, in order, each under its own number:\n" + parts.map((p, i) => (i + 1) + ") " + p.slice(0, 160)).join("\n") + ")";
}

/** A long document with the question before AND after it (so it isn't lost). */
export function sandwich(question, name, body) {
  return `QUESTION: ${question}\n\nThe user attached the file "${name}":\n<<<\n${body}\n>>>\n\nNow answer the question, using the file: ${question}`;
}

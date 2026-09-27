/* ---- v5.32: writing rules checked by CODE ---------------------------------------------------
   Ali: "Write a four-sentence pitch. Do not use the letter 'e'. Every sentence must contain
   exactly eight words. No numbers or symbols." — a model can't see letters (it reads tokens),
   so it can't check itself; the phone can. The rules are read from the request, the answer is
   checked, and the model is told EXACTLY what broke ("sentence 2 has 9 words; 'the' has an e")
   and writes it again — the best try is kept. Pure; tests in tests/unit/v532.test.mjs.         */

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
const num = (w) => (/^\d+$/.test(w) ? +w : NUM_WORDS[String(w).toLowerCase()] || 0);

/** The checkable rules in a request → {noLetters:[], wordsPerSentence, sentences, noDigits, noSymbols, maxWords} or null. */
export function rulesOf(text) {
  const t = String(text || "");
  const r = {};
  const letters = [...t.matchAll(/(?:do not|don't|never|without|avoid)\s+(?:use\s+|using\s+)?(?:the\s+)?letters?\s+['"“‘]?([a-z])['"”’]?(?:\s*(?:or|and|,)\s*['"“‘]?([a-z])['"”’]?)?/gi)];
  if (letters.length) r.noLetters = [...new Set(letters.flatMap((m) => [m[1], m[2]]).filter(Boolean).map((x) => x.toLowerCase()))];
  const wps = t.match(/(?:each|every)\s+sentence\s+(?:must\s+)?(?:contains?|has|have|be|is)?\s*(?:exactly\s+)?(\d+|[a-z]+)\s+words/i);
  if (wps && num(wps[1])) r.wordsPerSentence = num(wps[1]);
  const sn = t.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[- ]sentences?\b/i) || t.match(/\bexactly\s+(\d+|[a-z]+)\s+sentences\b/i);
  if (sn && num(sn[1])) r.sentences = num(sn[1]);
  if (/(?:no|do not (?:include|use)|without|don't (?:include|use))\s+(?:any\s+)?(?:numbers|digits|numerals)/i.test(t)) r.noDigits = true;
  if (/(?:no|do not (?:include|use)|without|don't (?:include|use))\s+(?:any\s+)?(?:numbers\s+or\s+)?symbols/i.test(t)) r.noSymbols = true;
  const mx = t.match(/\b(?:under|at most|no more than|maximum(?: of)?)\s+(\d+)\s+words\b/i);
  if (mx) r.maxWords = +mx[1];
  return Object.keys(r).length ? r : null;
}

const sentencesOf = (s) => String(s).replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=\S)/).map((x) => x.trim()).filter((x) => /[\p{L}\p{N}]/u.test(x));
const wordsOf = (s) => String(s).split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean);

/** The answer's text without a leading title / quote marks / markdown. */
export function bodyOf(answer) {
  return String(answer || "").replace(/\*\*|__|`/g, "").split("\n").map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim()).filter(Boolean).join(" ").replace(/^["“]|["”]$/g, "").trim();
}

/** Every rule the answer breaks, in plain words (empty = all good). */
export function violations(answer, rules) {
  if (!rules) return [];
  const body = bodyOf(answer), out = [];
  const sents = sentencesOf(body);
  if (rules.noLetters) for (const L of rules.noLetters) {
    const bad = [...new Set(wordsOf(body).filter((w) => w.toLowerCase().includes(L)))];
    if (bad.length) out.push(`the letter "${L}" appears in: ${bad.slice(0, 12).join(", ")}`);
  }
  if (rules.sentences && sents.length !== rules.sentences) out.push(`it has ${sents.length} sentences, not ${rules.sentences}`);
  if (rules.wordsPerSentence) sents.forEach((s, i) => { const n = wordsOf(s).length; if (n !== rules.wordsPerSentence) out.push(`sentence ${i + 1} has ${n} words, not ${rules.wordsPerSentence}: "${s}"`); });
  if (rules.noDigits && /\d/.test(body)) out.push("it contains digits");
  if (rules.noSymbols) { const sy = body.match(/[^\p{L}\p{N}\s.,!?'’]/gu); if (sy) out.push("it contains symbols: " + [...new Set(sy)].join(" ")); }
  if (rules.maxWords && wordsOf(body).length > rules.maxWords) out.push(`it has ${wordsOf(body).length} words, over ${rules.maxWords}`);
  return out;
}

/** The message that asks for a corrected version. */
export function fixMessage(request, answer, broken) {
  return `REQUEST:\n${request}\n\nYOUR ANSWER:\n${answer}\n\nA program checked it and it breaks these rules:\n- ${broken.join("\n- ")}\n\nWrite a corrected version that follows EVERY rule of the request. Replace each word that breaks a rule with a different word (a synonym that fits). Count the words of each sentence before you finish. Reply with ONLY the corrected text.`;
}

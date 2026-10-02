/* ---- v5.32: writing rules checked by CODE ---------------------------------------------------
   Ali: "Write a four-sentence pitch. Do not use the letter 'e'. Every sentence must contain
   exactly eight words. No numbers or symbols." — a model can't see letters (it reads tokens),
   so it can't check itself; the phone can. The rules are read from the request, the answer is
   checked, and the model is told EXACTLY what broke ("sentence 2 has 9 words; 'the' has an e")
   and writes it again — the best try is kept. Pure; tests in tests/unit/v532.test.mjs.         */

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
const tidy = (w) => String(w).replace(/['’-]+$/, "").toLowerCase();
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
  // v6.10 — the whole answer: "exactly 17 words", "a 17-word response" (not "each sentence … 8 words")
  if (!wps) {
    const tw = t.match(/\b(?:exactly|precisely)\s+(\d+|[a-z]+)\s+words\b/i) || t.match(/\b(\d+)[- ]words?\s+(?:response|answer|text|paragraph|message|sentence|reply)\b/i);
    if (tw && num(tw[1]) && !/each|every/i.test(t.slice(Math.max(0, tw.index - 30), tw.index))) r.totalWords = num(tw[1]);
  }
  // "The 17th (last) word must be 'seventeen'", "the last word must be X", "the first word must be X"
  const nth = t.match(/\b(?:the\s+)?(\d+)(?:st|nd|rd|th)(?:\s*\((?:last|final)\))?\s+word\s+(?:must|should|has to|needs to|is to|will)\s+be\s+['"“‘]?([\p{L}][\p{L}'’-]*)/iu);
  const lastW = t.match(/\b(?:the\s+)?(?:last|final)\s+word\s+(?:must|should|has to|needs to|is to|will)\s+be\s+['"“‘]?([\p{L}][\p{L}'’-]*)/iu);
  const firstW = t.match(/\b(?:the\s+)?first\s+word\s+(?:must|should|has to|needs to|is to|will)\s+be\s+['"“‘]?([\p{L}][\p{L}'’-]*)/iu);
  if (nth) r.nthWord = { n: +nth[1], word: tidy(nth[2]) };
  if (lastW) r.lastWord = tidy(lastW[1]);
  else if (nth && r.totalWords && +nth[1] === r.totalWords) r.lastWord = tidy(nth[2]);
  if (firstW) r.firstWord = tidy(firstW[1]);
  const sw = t.match(/\b(?:start|begin)s?\s+with\s+(?:the\s+(?:word|phrase)\s+)?['"“‘]([^'"”’]{1,40})['"”’]/i);
  if (sw) r.startsWith = sw[1].trim().toLowerCase();
  const ew = t.match(/\bends?\s+with\s+(?:the\s+(?:word|phrase)\s+)?['"“‘]([^'"”’]{1,40})['"”’]/i);
  if (ew) r.endsWith = ew[1].trim().toLowerCase();
  const pg = t.match(/\b(?:exactly\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+paragraphs?\b/i);
  if (pg && num(pg[1])) r.paragraphs = num(pg[1]);
  const bl = t.match(/\b(?:exactly\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:bullet(?:ed)?\s+points?|bullets)\b/i);
  if (bl && num(bl[1])) r.bullets = num(bl[1]);
  // "Output strictly as a Markdown table" / "only a table" / "respond with just a JSON object": nothing else around it
  if (/\b(?:strictly|only|just|exclusively)\s+(?:as\s+|in\s+|with\s+)?(?:a\s+|the\s+)?(?:markdown\s+)?table\b/i.test(t) || /\bmarkdown\s+table\s+only\b/i.test(t) || /\bno\s+(?:text|prose|sentences?)\s+(?:before|outside|around)\s+(?:or\s+after\s+)?the\s+table\b/i.test(t)) r.onlyTable = true;
  const ch = t.match(/\bexactly\s+(\d+)\s+characters\b/i);
  if (ch) r.characters = +ch[1];
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
  const ws = wordsOf(body), low = (w) => String(w || "").toLowerCase();
  if (rules.totalWords && ws.length !== rules.totalWords) out.push(`it has ${ws.length} words, it needs exactly ${rules.totalWords}`);
  if (rules.nthWord && low(ws[rules.nthWord.n - 1]) !== rules.nthWord.word) out.push(`word ${rules.nthWord.n} is "${ws[rules.nthWord.n - 1] || "(missing)"}", it must be "${rules.nthWord.word}"`);
  if (rules.lastWord && low(ws[ws.length - 1]) !== rules.lastWord) out.push(`the last word is "${ws[ws.length - 1] || "(missing)"}", it must be "${rules.lastWord}"`);
  if (rules.firstWord && low(ws[0]) !== rules.firstWord) out.push(`the first word is "${ws[0] || "(missing)"}", it must be "${rules.firstWord}"`);
  if (rules.startsWith && !low(body).startsWith(rules.startsWith)) out.push(`it must start with "${rules.startsWith}"`);
  if (rules.endsWith && !low(body).replace(/[^\p{L}\p{N}]+$/u, "").endsWith(rules.endsWith)) out.push(`it must end with "${rules.endsWith}"`);
  const raw = String(answer || "").trim();
  if (rules.paragraphs) { const n = raw.split(/\n\s*\n/).filter((x) => x.trim()).length; if (n !== rules.paragraphs) out.push(`it has ${n} paragraphs, not ${rules.paragraphs}`); }
  if (rules.bullets) { const n = raw.split("\n").filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l)).length; if (n !== rules.bullets) out.push(`it has ${n} bullet points, not ${rules.bullets}`); }
  if (rules.onlyTable) { const out2 = String(answer || "").split("\n").filter((l) => l.trim() && !/^\s*\|?.*\|.*$/.test(l)); if (out2.length) out.push(`it has text outside the table: "${out2[0].trim().slice(0, 60)}"`); }
  if (rules.characters && body.length !== rules.characters) out.push(`it has ${body.length} characters, not ${rules.characters}`);
  return out;
}

/** The message that asks for a corrected version. */
export function fixMessage(request, answer, broken) {
  return `REQUEST:\n${request}\n\nYOUR ANSWER:\n${answer}\n\nA program checked it and it breaks these rules:\n- ${broken.join("\n- ")}\n\nWrite a corrected version that follows EVERY rule of the request. Replace each word that breaks a rule with a different word (a synonym that fits). Count the words of each sentence before you finish. Reply with ONLY the corrected text.`;
}


const PAD = ["truly", "really", "quite", "simply", "always", "still", "just", "very"];
/** v6.10 — the last resort when the model keeps missing an exact word count: make the text right by code.
 *  Only touches "exactly N words" / "Nth / last / first word must be X"; trims from the middle (the last word stays),
 *  or adds harmless adverbs before the last word. Returns the text unchanged when no such rule applies. */
export function enforce(answer, rules) {
  if (rules && rules.onlyTable) {
    const rows = String(answer || "").split("\n").filter((l) => /^\s*\|?.*\|.*$/.test(l) && l.trim());
    if (rows.length >= 2) return rows.map((l) => l.trim()).join("\n");   // the table, nothing around it
  }
  if (!rules || !(rules.totalWords || rules.lastWord || rules.firstWord || rules.nthWord)) return answer;
  let ws = wordsOf(bodyOf(answer));
  if (!ws.length) return answer;
  const N = rules.totalWords || ws.length;
  const last = rules.lastWord || (rules.nthWord && rules.nthWord.n === N ? rules.nthWord.word : null);
  if (last) { if (ws[ws.length - 1].toLowerCase() !== last) ws.push(last); }
  if (ws.length > N) { const tail = last ? [ws[ws.length - 1]] : []; ws = ws.slice(0, N - tail.length).concat(tail); }
  let i = 0;
  while (ws.length < N) { ws.splice(Math.max(1, ws.length - (last ? 1 : 0)), 0, PAD[i++ % PAD.length]); }
  if (rules.firstWord) ws[0] = rules.firstWord;
  if (rules.nthWord && rules.nthWord.n <= ws.length && !(last && rules.nthWord.n === ws.length)) ws[rules.nthWord.n - 1] = rules.nthWord.word;
  let out = ws.join(" ");
  if (rules.firstWord || /^[a-z]/.test(out)) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out + ".";
}

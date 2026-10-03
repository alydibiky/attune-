/* ---- v6.10: YOUR Skills — small text recipes you create, import, share and switch on or off -------------------------
   A skill is a name, when to use it, instructions and an optional example. NOTHING RUNS: a matched skill only adds its
   instructions under the question, exactly like the built-in recipes (skills.js) — so it is safe, free, works offline
   and helps small models. Matched by a /command at the start of a message ("/quote 50 t crane for 3 days"), or
   automatically from the "when to use it" words. Skills live on this phone (localStorage); sharing is a text file.
   Pure logic; tests in tests/unit/v614skills.test.mjs.                                                              */

const KEY = "attune:skills:v1";
export const LIMITS = { name: 60, command: 24, when: 300, instructions: 2000, example: 600, max: 60, blockChars: 1600 };

export const load = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
export const save = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMITS.max))); return true; } catch (e) { return false; } };

/** "/Quote" → "/quote"; anything that is not 2–20 letters, digits, - or _ → "". */
export function normCommand(c) {
  const t = String(c || "").trim().replace(/^\/+/, "").toLowerCase();
  return /^[a-z0-9_-]{2,20}$/.test(t) ? "/" + t : "";
}
const clip = (s, n) => String(s || "").replace(/\r/g, "").trim().slice(0, n);
let seq = 0;
/** A clean skill from loose input. Throws Error with a plain message when it cannot be one. */
export function makeSkill(o, { source = "mine" } = {}) {
  const name = clip(o.name, LIMITS.name).replace(/\s+/g, " ");
  const instructions = clip(o.instructions, LIMITS.instructions);
  if (!name) throw new Error("A skill needs a name");
  if (instructions.length < 15) throw new Error("Write what the skill should do (at least a sentence)");
  const command = normCommand(o.command);
  if (o.command && !command) throw new Error("A command is 2–20 letters, digits, - or _ (like /quote)");
  return { id: o.id || "u" + Date.now().toString(36) + (seq++).toString(36), name, command, when: clip(o.when, LIMITS.when), instructions, example: clip(o.example, LIMITS.example), on: o.on !== false, source: o.source || source, ts: o.ts || Date.now() };
}

// ---- words: the same plain matching for English and Arabic ----------------------------------------------------------
const AR_NORM = (s) => s.replace(/[ً-ٰٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
const STOP = new Set(("the a an and or of to in on for with from by at is are was be it this that my me i you we they as about into please can could would should how what when where which who write make give need want help do does " +
  "ال في على من الى إلى عن مع هذا هذه ده دي دا انا انت هو هي هم لو او أو ان إن كان ممكن عايز عاوز اعمل اكتب لي لى ليا بتاع").split(/\s+/));
export function words(text) {
  return AR_NORM(String(text || "").toLowerCase()).split(/[^a-z0-9؀-ۿ]+/).filter((w) => w.length >= 3 && !STOP.has(w));
}
const stem = (w) => (/^[a-z]+$/.test(w) ? w.replace(/(ing|ed|es|s)$/, "") : w.replace(/^(ال|وال|بال|لل)/, ""));
const same = (a, b) => { const x = stem(a), y = stem(b); return x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x))); };

/** The skills that fit a message. An explicit /command always wins and is cut out of the question.
 *  → { via: "command"|"auto", matches: [skill], stripped: string|null } or null. */
export function matchSkills(text, skills, { max = 2 } = {}) {
  const t = String(text || "");
  const on = (skills || []).filter((s) => s && s.on !== false);
  if (!t.trim() || !on.length) return null;
  const c = /^\s*(\/[a-z0-9_-]{2,20})(?=\s|$)/i.exec(t);
  if (c) {
    const sk = on.find((s) => s.command && s.command === c[1].toLowerCase());
    if (sk) return { via: "command", matches: [sk], stripped: t.slice(c[0].length).trim() };
    return null;
  }
  if (t.length > 1200) return null;                       // a pasted document is its own request
  const q = words(t);
  if (!q.length) return null;
  const scored = [];
  for (const s of on) {
    const kw = [...new Set(words((s.when || "") + " " + s.name))];
    if (!kw.length) continue;
    const hit = kw.filter((k) => q.some((w) => same(w, k)));
    // enough of the skill's own words appear: 2 words, or 1 when the skill is described in just one or two words
    const need = kw.length <= 2 ? 1 : 2;
    if (hit.length >= need) scored.push({ s, score: hit.length / Math.sqrt(kw.length) + hit.length * 0.2 });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return { via: "auto", matches: scored.slice(0, max).map((x) => x.s), stripped: null };
}

/** The text added under the question. Short on purpose (a phone model reads every token). */
export function skillBlock(matches) {
  if (!matches || !matches.length) return "";
  let out = "";
  for (const s of matches) {
    const part = `\n- Skill “${s.name}”: ${s.instructions.replace(/\s*\n\s*/g, " ")}${s.example ? ` Example of a good answer: ${s.example.replace(/\s*\n\s*/g, " ")}` : ""}`;
    if ((out + part).length > LIMITS.blockChars) break;
    out += part;
  }
  return out ? "\n\n(Your saved skills — follow them for this answer:" + out + ")" : "";
}

// ---- sharing: one small text file, easy to read before it is trusted --------------------------------------------------
export function toFile(s) {
  return ["---", `name: ${s.name}`, s.command ? `command: ${s.command}` : null, s.when ? `when: ${s.when.replace(/\n/g, " ")}` : null, "---", s.instructions, s.example ? `\n## Example\n${s.example}` : ""].filter((x) => x !== null).join("\n").trim() + "\n";
}
/** Read a shared skill: the text format above, or JSON {name, command, when, instructions, example}. Never runs anything. */
export function fromFile(text) {
  const t = String(text || "").trim();
  if (!t) throw new Error("That file is empty");
  if (t.length > 20000) throw new Error("That file is too big to be a skill");
  if (t.startsWith("{")) { let j; try { j = JSON.parse(t); } catch (e) { throw new Error("That is not a skill file"); } return makeSkill(j, { source: "imported" }); }
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(t);
  if (!m) throw new Error("That is not a skill file (it should start with --- name: …)");
  const meta = {};
  for (const line of m[1].split("\n")) { const k = /^\s*([a-z]+)\s*:\s*(.*)$/i.exec(line); if (k) meta[k[1].toLowerCase()] = k[2].trim(); }
  let body = m[2].trim(), example = "";
  const ex = /\n##\s*Example\s*\n([\s\S]*)$/i.exec("\n" + body);
  if (ex) { example = ex[1].trim(); body = body.slice(0, body.length - ex[0].length + 1).trim(); }
  return makeSkill({ name: meta.name, command: meta.command, when: meta.when, instructions: body, example }, { source: "imported" });
}

// ---- "write a skill for me": the phone's own model drafts it, the person reviews it before it is saved ------------------
export function draftMessages(description) {
  return [
    { role: "system", content: "You write short instruction recipes (\"skills\") that another AI follows when answering. Reply with ONLY JSON: {\"name\":\"2-5 words\",\"when\":\"when to use it, in plain words and the main keywords, one sentence\",\"instructions\":\"3-6 concrete sentences: the structure of the answer, what to ask if something is missing, the tone, the language to use\",\"example\":\"\"}. Same language as the request. No extra text." },
    { role: "user", content: String(description || "").slice(0, 600) },
  ];
}
export function parseDraft(raw) {
  const s = String(raw || ""); const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("The model did not return a skill — try describing it again");
  let j; try { j = JSON.parse(s.slice(a, b + 1)); } catch (e) { throw new Error("The model's answer was not readable — try again"); }
  return { name: clip(j.name, LIMITS.name), when: clip(j.when, LIMITS.when), instructions: clip(j.instructions, LIMITS.instructions), example: clip(j.example, LIMITS.example) };
}

// ---- a starter catalogue (all text; add one and edit it) ------------------------------------------------------------------
const C = (id, name, command, when, instructions, example = "") => ({ id, name, command, when, instructions, example });
export const CATALOGUE = [
  C("crane-quote", "Crane rental quote", "/quote", "crane rental quote price offer lifting job عرض سعر ونش تأجير",
    "Write a professional crane-rental quotation: a short title, the client and job (site, what is lifted, weight, height, radius), the crane (type, capacity in tonnes, boom), duration, the rate basis (hour, day or month) with the amount, mobilisation and demobilisation, operator and rigger included or not, fuel, insurance, VAT 14%, payment terms and validity (7 days). If the weight, radius, duration or site is missing, ask for it in one short line first. Use clear numbered items and EGP. Answer in the language of the request (Egyptian Arabic if they write Arabic)."),
  C("reply-ar", "Customer reply in Egyptian Arabic", "/reply", "reply customer whatsapp polite رد على عميل رسالة واتساب",
    "Write a short, polite WhatsApp-style reply in natural Egyptian Arabic: greet, answer exactly what was asked, give the number or date if known, one clear next step, a warm closing. No more than 5 lines. Never invent prices or dates that were not given."),
  C("pay-reminder", "Polite payment reminder", "/dues", "payment reminder overdue invoice collect money تذكير سداد فاتورة متأخرة",
    "Write a payment reminder in Egyptian Arabic. Level 1 (default): friendly and short. Level 2 (if they say again or second reminder): firm, with the invoice number, amount and a date to pay by. Level 3 (final): formal, mentions the next step. Always keep it respectful, include the amount and invoice number if given, and never threaten."),
  C("turkish", "Turkish tutor", "/turkish", "turkish practice learn tutor correct تركي تعلم تصحيح",
    "Act as a patient Turkish tutor for an Arabic speaker. Reply in simple Turkish (short sentences), then the Arabic translation under it. If the learner wrote Turkish, first correct it: show the corrected sentence and explain the mistake in one line, especially tense and suffix mistakes. End with one new useful word and one easy question to keep the conversation going."),
  C("cv-bullets", "Stronger CV bullet points", "/cvbullets", "cv resume bullet points experience improve سيرة ذاتية",
    "Rewrite each experience line as a strong CV bullet: start with an action verb, add a number or result if one is given (never invent one — ask if a number would help), at most 20 words, no 'I', no filler. Keep the same language as the input. Return only the bullets."),
  C("minutes", "Meeting minutes", "/minutes", "meeting minutes notes summary action items محضر اجتماع",
    "Turn the notes into minutes: Date and attendees if given; Decisions (bullets); Action items as a table | Task | Owner | Deadline | (write 'not set' when missing); Open questions. Keep every name, number and date exactly. Same language as the notes."),
  C("proofread", "Proofreader", "/proof", "proofread correct grammar spelling fix text تصحيح لغوي إملائي",
    "Correct the spelling, grammar and punctuation without changing the meaning or the writer's voice. First give the corrected text only, then a short list of what you changed (max 6 items). Do not add new ideas. Keep names, numbers and links exactly as written. Same language as the text."),
  C("product", "Product listing", "/listing", "product description sell listing marketplace وصف منتج بيع إعلان",
    "Write a marketplace listing: a clear title with brand and model, 4–6 bullet points (condition, key specs with numbers, what is included, why it is a good buy), and a short honest paragraph. Put the price as the given amount or 'price: ask'. Do not exaggerate or invent specs. Egyptian Arabic if the request is in Arabic."),
  C("interview", "Interview practice", "/interview", "interview practice job questions مقابلة شخصية تدريب",
    "Be a job interviewer. Ask ONE question at a time, wait for the answer, then give a score out of 10, one thing that was good, one thing to improve, and a better version of the answer in two sentences. Then ask the next question. Start by asking the role being interviewed for."),
  C("eli5", "Explain simply", "/simple", "explain simply easy beginner like I'm twelve اشرح ببساطة",
    "Explain it for a smart twelve-year-old: one sentence answer first, then an everyday analogy, then a tiny example with real numbers, then the one thing people usually get wrong. No jargon; if a technical term is needed, explain it in brackets. Give the term in English and Arabic when the topic is technical."),
  C("formal-email", "Formal business email", "/formal", "formal email business letter professional ايميل رسمي خطاب",
    "Write a formal business email: subject line, greeting, one short paragraph with the purpose, the key details as bullets if there are 3 or more, a clear request and deadline, polite closing. Under 150 words. Same language as the request; formal Modern Standard Arabic for Arabic."),
  C("toolbox", "Safety toolbox talk", "/toolbox", "safety toolbox talk briefing lifting crane site hazards سلامة اجتماع قبل العمل",
    "Write a 5-minute toolbox talk for the work described: the task in one line, the 4–6 main hazards, the control for each (concrete: exclusion zone, signalman, outrigger mats, wind limit, tag lines), what to stop work for, and 3 questions to ask the crew to check they understood. Short sentences. English with Egyptian Arabic terms where useful."),
];

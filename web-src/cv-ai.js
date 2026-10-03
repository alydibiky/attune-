/* ---- v6.10: the CV page's AI helpers — wording only, checked by code ----------------------------------------------------------
   The phone's model is asked to improve WORDING (bullets, summary, grammar, translation, a tailored version, a cover letter,
   structuring a pasted CV). It must not invent: every number, date and name in a suggestion has to appear in what the person
   wrote (`onlyKnown`), or the suggestion is refused. Pure prompt builders and parsers; the screens call the model.
   Tests: tests/unit/v616cvai.test.mjs.                                                                                    */
import { cvText, fmtRange, SECTION_TYPES } from "./cv.js";

const JSON_ONLY = "Reply with ONLY the JSON. No extra text, no markdown.";
const langName = (l) => (l === "ar" ? "Arabic (natural, professional)" : "English");
const NO_INVENT = "Use ONLY facts in the input. Never invent a number, date, employer, title or result. If a bullet has no number, do not add one.";

// ---- the numbers rule ---------------------------------------------------------------------------------------------------------
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/٫/g, ".");
/** Every number in a text, as written (Arabic digits read as Latin): "18%", "12", "2021". */
export const numbersIn = (s) => (toLatin(s).match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(/,/g, ""));
/** True when every number in `suggestion` also appears in `source` (so nothing was invented). */
export function onlyKnown(suggestion, source) {
  const known = new Set(numbersIn(source));
  return numbersIn(suggestion).every((n) => known.has(n));
}

// ---- bullets ----------------------------------------------------------------------------------------------------------------------
export function improveBulletsMessages(job, lang) {
  return [
    { role: "system", content: `You improve CV bullet points for a ${job.role || "job"}${job.company ? " at " + job.company : ""}. Start each bullet with a strong action verb, make it specific and concise (at most 22 words), no "I", no filler. ${NO_INVENT} Keep the same number of bullets and the same order. Language: ${langName(lang)}. ${JSON_ONLY} Format: {"bullets":["…","…"]}` },
    { role: "user", content: JSON.stringify({ bullets: (job.bullets || []).filter((x) => String(x).trim()) }) },
  ];
}
/** → { bullets: [improved…] } where any suggestion that adds a number is replaced by the original. */
export function parseBullets(raw, original) {
  const j = jsonOf(raw), arr = Array.isArray(j.bullets) ? j.bullets.map((x) => String(x).trim()) : null;
  const orig = (original || []).filter((x) => String(x).trim());
  if (!arr || arr.length !== orig.length) throw new Error("The model's answer did not match the bullets — try again");
  const src = orig.join(" ");
  const refused = [];
  const out = arr.map((x, i) => { if (!x || !onlyKnown(x, orig[i] + " " + src)) { refused.push(i); return orig[i]; } return x; });
  return { bullets: out, refused };
}

// ---- summary ---------------------------------------------------------------------------------------------------------------------
export function summaryMessages(cv) {
  return [
    { role: "system", content: `Write a professional CV summary of 2–3 sentences (at most 55 words) for this person. Lead with their title and years of experience only if the dates show it, then their strongest relevant skills and one achievement from the input. ${NO_INVENT} Language: ${langName(cv.lang)}. ${JSON_ONLY} Format: {"summary":"…"}` },
    { role: "user", content: cvText(cv).slice(0, 3500) },
  ];
}
export function parseSummary(raw, cv) {
  const j = jsonOf(raw), s = String(j.summary || "").trim();
  if (s.length < 20) throw new Error("The summary came back empty — try again");
  if (!onlyKnown(s, cvText(cv))) throw new Error("The model added a number that is not in your CV, so the summary was refused — try again");
  return s;
}

// ---- grammar -------------------------------------------------------------------------------------------------------------------------
export function grammarMessages(text, lang) {
  return [
    { role: "system", content: `Fix spelling, grammar and punctuation. Keep the meaning, names, numbers and the writer's voice. Do not add anything. Language: ${langName(lang)}. ${JSON_ONLY} Format: {"text":"…"}` },
    { role: "user", content: String(text).slice(0, 1500) },
  ];
}
export function parseGrammar(raw, original) {
  const t = String(jsonOf(raw).text || "").trim();
  if (!t) throw new Error("Nothing came back — try again");
  if (!onlyKnown(t, original) || numbersIn(original).some((n) => !numbersIn(t).includes(n))) throw new Error("The numbers changed, so the correction was refused");
  return t;
}

// ---- translate the whole CV ----------------------------------------------------------------------------------------------------------
/** The pieces of wording to translate, with how to put each back. Names, companies, schools, emails, numbers stay. */
export function collectTexts(cv) {
  const list = [];
  const add = (get, set) => { const v = get(); if (String(v || "").trim()) list.push({ text: String(v), set }); };
  add(() => cv.basics.title, (v) => { cv.basics.title = v; });
  for (const s of cv.sections) for (const it of s.items) {
    if (s.type === "summary" || s.type === "custom") add(() => it.text, (v) => { it.text = v; });
    if (s.type === "experience") { add(() => it.role, (v) => { it.role = v; }); (it.bullets || []).forEach((b, i) => add(() => b, (v) => { it.bullets[i] = v; })); }
    if (s.type === "education") { add(() => it.degree, (v) => { it.degree = v; }); add(() => it.note, (v) => { it.note = v; }); }
    if (s.type === "skills") { add(() => it.name, (v) => { it.name = v; }); (it.items || []).forEach((b, i) => add(() => b, (v) => { it.items[i] = v; })); }
    if (s.type === "languages") { add(() => it.name, (v) => { it.name = v; }); add(() => it.level, (v) => { it.level = v; }); }
    if (s.type === "projects") (it.bullets || []).forEach((b, i) => add(() => b, (v) => { it.bullets[i] = v; }));
  }
  return list;
}
export function translateMessages(texts, to) {
  return [
    { role: "system", content: `Translate each string of the JSON array into ${langName(to)}. Keep names, companies, schools, products, numbers, dates and abbreviations exactly. Keep the same order and the same number of items. ${JSON_ONLY} Format: {"t":["…","…"]}` },
    { role: "user", content: JSON.stringify({ t: texts }) },
  ];
}
/** Apply a translation to a COPY of the CV; the section titles switch to the target language's standard names. */
export function applyTranslation(cv, to, raw) {
  const c = JSON.parse(JSON.stringify(cv)), items = collectTexts(c), j = jsonOf(raw);
  if (!Array.isArray(j.t) || j.t.length !== items.length) throw new Error("The translation did not match the CV — try again");
  items.forEach((x, i) => { if (!numbersIn(x.text).every((n) => numbersIn(j.t[i]).includes(n))) return; x.set(String(j.t[i])); });   // a line whose numbers changed stays as it was
  c.lang = to; if (to === "ar" && c.font === "sans") c.font = "naskh"; if (to === "en" && c.font === "naskh") c.font = "sans";
  c.sections.forEach((s) => { if (SECTION_TYPES[s.type]) s.title = SECTION_TYPES[s.type][to === "ar" ? "ar" : "en"]; });
  return c;
}

// ---- tailor to a job ad ---------------------------------------------------------------------------------------------------------------
export function tailorMessages(cv, ad) {
  return [
    { role: "system", content: `You compare a CV with a job advert. List the advert's key requirements (max 12 short keywords), which the CV already shows (from the CV text only), which are missing, and up to 4 rewrites of existing bullets that use the advert's wording. ${NO_INVENT} Never claim a skill the CV does not show: missing keywords are only listed, not added. Language: ${langName(cv.lang)}. ${JSON_ONLY} Format: {"keywords":["…"],"covered":["…"],"missing":["…"],"rewrites":[{"old":"exact existing bullet","new":"rewritten bullet"}]}` },
    { role: "user", content: "JOB ADVERT:\n" + String(ad).slice(0, 2500) + "\n\nCV:\n" + cvText(cv).slice(0, 3000) },
  ];
}
export function parseTailor(raw, cv) {
  const j = jsonOf(raw), txt = cvText(cv);
  const list = (a) => (Array.isArray(a) ? a.map((x) => String(x).trim()).filter(Boolean).slice(0, 14) : []);
  const bulletsAll = cv.sections.flatMap((s) => s.items.flatMap((it) => it.bullets || []));
  const rewrites = (Array.isArray(j.rewrites) ? j.rewrites : []).map((r) => ({ old: String(r.old || "").trim(), new: String(r.new || "").trim() }))
    .filter((r) => r.new && bulletsAll.some((b) => b.trim() === r.old) && onlyKnown(r.new, r.old + " " + txt)).slice(0, 4);
  return { keywords: list(j.keywords), covered: list(j.covered), missing: list(j.missing), rewrites };
}
/** Replace an existing bullet by its rewrite (on a copy). */
export function applyRewrite(cv, r) {
  const c = JSON.parse(JSON.stringify(cv));
  for (const s of c.sections) for (const it of s.items) if (it.bullets) { const i = it.bullets.findIndex((b) => b.trim() === r.old); if (i >= 0) { it.bullets[i] = r.new; return c; } }
  return cv;
}

// ---- a cover letter ---------------------------------------------------------------------------------------------------------------------
export function coverLetterMessages(cv, ad, to = {}) {
  return [
    { role: "system", content: `Write a one-page cover letter (about 180–230 words) for this person applying to the job. Opening: the role and why they fit in one sentence; middle: 2 short paragraphs linking real things from the CV to the advert; closing: a polite request for an interview. ${NO_INVENT} ${to.company ? "Company: " + to.company + "." : ""} Language: ${langName(cv.lang)}. ${JSON_ONLY} Format: {"letter":"…"}` },
    { role: "user", content: "JOB ADVERT:\n" + String(ad).slice(0, 2000) + "\n\nCV:\n" + cvText(cv).slice(0, 3000) },
  ];
}
export function parseLetter(raw, cv) {
  const t = String(jsonOf(raw).letter || "").trim();
  if (t.length < 80) throw new Error("The letter came back too short — try again");
  if (!onlyKnown(t, cvText(cv))) throw new Error("The letter used a number that is not in your CV, so it was refused — try again");
  return t;
}

// ---- import a CV you already have (pasted text) ----------------------------------------------------------------------------------------
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/, PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/;
/** What can be read without the model: email, phone, first line as the name. */
export function extractContact(text) {
  const t = String(text || ""), lines = t.split("\n").map((x) => x.trim()).filter(Boolean);
  return { email: (EMAIL.exec(t) || [""])[0], phone: ((PHONE.exec(t) || [""])[0] || "").trim(), name: lines[0] && lines[0].length <= 50 && !EMAIL.test(lines[0]) ? lines[0] : "" };
}
export function importMessages(text) {
  return [
    { role: "system", content: `Read this CV text and put it into JSON. Keep every word of the person's own wording; do not rewrite, shorten, translate or invent. Dates as YYYY-MM when the month is known, else YYYY. If a job is still held, "current":true and "end":"". ${JSON_ONLY} Format: {"basics":{"name":"","title":"","email":"","phone":"","city":""},"summary":"","experience":[{"role":"","company":"","location":"","start":"","end":"","current":false,"bullets":[""]}],"education":[{"degree":"","school":"","start":"","end":"","note":""}],"skills":["…"],"languages":[{"name":"","level":""}],"certs":[{"name":"","issuer":"","year":""}]}` },
    { role: "user", content: String(text).slice(0, 7000) },
  ];
}
/** The imported JSON → CV content (merged into `cv`, which keeps its look). Contact details from the text win over the model's. */
export function applyImport(cv, raw, text) {
  const j = jsonOf(raw), c = JSON.parse(JSON.stringify(cv)), ex = extractContact(text);
  const b = j.basics || {};
  c.basics = { ...c.basics, name: String(b.name || ex.name || "").trim(), title: String(b.title || "").trim(), email: ex.email || String(b.email || "").trim(), phone: ex.phone || String(b.phone || "").trim(), city: String(b.city || "").trim() };
  const sec = (type) => c.sections.find((s) => s.type === type) || (c.sections.push({ id: "s" + Math.random().toString(36).slice(2, 8), type, title: SECTION_TYPES[type][c.lang === "ar" ? "ar" : "en"], visible: true, items: [] }), c.sections[c.sections.length - 1]);
  const str = (x) => String(x == null ? "" : x).trim();
  if (str(j.summary)) sec("summary").items = [{ text: str(j.summary) }];
  if (Array.isArray(j.experience)) sec("experience").items = j.experience.map((e) => ({ role: str(e.role), company: str(e.company), location: str(e.location), start: str(e.start), end: str(e.end), current: !!e.current, bullets: (Array.isArray(e.bullets) ? e.bullets : []).map(str).filter(Boolean) }));
  if (Array.isArray(j.education)) sec("education").items = j.education.map((e) => ({ degree: str(e.degree), school: str(e.school), start: str(e.start), end: str(e.end), note: str(e.note) }));
  if (Array.isArray(j.skills) && j.skills.length) sec("skills").items = [{ name: "", items: j.skills.map(str).filter(Boolean) }];
  if (Array.isArray(j.languages)) sec("languages").items = j.languages.map((l) => ({ name: str(l.name), level: str(l.level) })).filter((l) => l.name);
  if (Array.isArray(j.certs)) sec("certs").items = j.certs.map((x) => ({ name: str(x.name), issuer: str(x.issuer), year: str(x.year) })).filter((x) => x.name);
  return c;
}

function jsonOf(raw) {
  const s = String(raw || ""), a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("The model did not return a readable answer — try again");
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { throw new Error("The model's answer was cut off — try again"); }
}

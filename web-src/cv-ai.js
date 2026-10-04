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
  const j = raw && typeof raw === "object" ? raw : jsonOf(raw), c = JSON.parse(JSON.stringify(cv)), ex = extractContact(text);
  const b = j.basics || {};
  c.basics = { ...c.basics, name: String(b.name || ex.name || "").trim(), title: String(b.title || "").trim(), email: ex.email || String(b.email || "").trim(), phone: ex.phone || String(b.phone || "").trim(), city: String(b.city || "").trim() };
  const sec = (type) => c.sections.find((s) => s.type === type) || (c.sections.push({ id: "s" + Math.random().toString(36).slice(2, 8), type, title: SECTION_TYPES[type][c.lang === "ar" ? "ar" : "en"], visible: true, items: [] }), c.sections[c.sections.length - 1]);
  const str = (x) => String(x == null ? "" : x).trim();
  if (str(j.summary)) sec("summary").items = [{ text: str(j.summary) }];
  if (Array.isArray(j.experience)) sec("experience").items = j.experience.map((e) => ({ role: str(e.role), company: str(e.company), location: str(e.location), start: str(e.start), end: str(e.end), current: !!e.current, bullets: (Array.isArray(e.bullets) ? e.bullets : []).map(str).filter(Boolean) }));
  if (Array.isArray(j.education)) sec("education").items = j.education.map((e) => ({ degree: str(e.degree), school: str(e.school), start: str(e.start), end: str(e.end), note: str(e.note) }));
  if (Array.isArray(j.skills) && j.skills.length) {
    if (j.skills.every((x) => x && typeof x === "object" && Array.isArray(x.items))) sec("skills").items = j.skills.map((g) => ({ name: str(g.name), items: g.items.map(str).filter(Boolean) })).filter((g) => g.items.length);   // groups kept (a revise)
    else sec("skills").items = [{ name: "", items: j.skills.map(str).filter(Boolean) }];
  }
  if (Array.isArray(j.languages)) sec("languages").items = j.languages.map((l) => ({ name: str(l.name), level: str(l.level) })).filter((l) => l.name);
  if (Array.isArray(j.certs)) sec("certs").items = j.certs.map((x) => ({ name: str(x.name), issuer: str(x.issuer), year: str(x.year) })).filter((x) => x.name);
  if (Array.isArray(j.projects) && j.projects.length) sec("projects").items = j.projects.map((x) => ({ name: str(x.name), link: str(x.link), bullets: (Array.isArray(x.bullets) ? x.bullets : []).map(str).filter(Boolean) })).filter((x) => x.name || x.bullets.length);
  return c;
}

function jsonOf(raw) {
  const s = String(raw || ""), a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("The model did not return a readable answer — try again");
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { throw new Error("The model's answer was cut off — try again"); }
}

// ---- edit with a sentence + make it professional ---------------------------------------------------------------------------------
/** The CV's content as the same JSON shape the import reads. */
export function cvToJson(cv) {
  const get = (t) => ((cv.sections.find((s) => s.type === t) || {}).items) || [];
  const b = cv.basics || {};
  return {
    basics: { name: b.name || "", title: b.title || "", email: b.email || "", phone: b.phone || "", city: b.city || "" },
    summary: (get("summary")[0] || {}).text || "",
    experience: get("experience").map((e) => ({ role: e.role, company: e.company, location: e.location, start: e.start, end: e.end, current: !!e.current, bullets: (e.bullets || []).filter(Boolean) })),
    education: get("education").map((e) => ({ degree: e.degree, school: e.school, start: e.start, end: e.end, note: e.note })),
    skills: get("skills").map((s) => ({ name: s.name || "", items: s.items || [] })),
    languages: get("languages").map((l) => ({ name: l.name, level: l.level })),
    certs: get("certs").map((c) => ({ name: c.name, issuer: c.issuer, year: c.year })),
  };
}
/** instruction: what the person wants changed or added ("" = just polish). polish: also reword for a professional tone. */
export function reviseMessages(cv, instruction, polish) {
  const ar = cv.lang === "ar";
  return [
    { role: "system", content: `You edit a CV given as JSON and return the WHOLE JSON again in the same shape (basics, summary, experience, education, skills, languages, certs). Write in ${ar ? "Arabic" : "English"}. ${NO_INVENT} Apply the person's request exactly${polish ? ", and make every bullet and the summary clearer and more professional: strong action verb first, one idea per bullet, no filler, no first person, past tense for past jobs" : ", and change nothing else"}. Keep every job, school and certificate unless asked to remove it. New facts may come ONLY from the request. Reply with the JSON only.` },
    { role: "user", content: `CV:\n${JSON.stringify(cvToJson(cv))}\n\nRequest: ${String(instruction || "").trim() || "(none — only improve the wording)"}` },
  ];
}
/** → { cv, changed } or throws when the answer invents numbers or loses content. */
export function parseRevise(raw, cv, instruction) {
  const j = jsonOf(raw);
  const next = applyImport(cv, JSON.stringify(j), "");
  const src = cvText(cv) + "\n" + String(instruction || "");
  const out = cvText(next);
  if (!onlyKnown(out, src)) throw new Error("The AI invented a number that is not in your CV or your request — nothing was changed");
  const before = (cv.sections.find((s) => s.type === "experience") || { items: [] }).items.length;
  const after = (next.sections.find((s) => s.type === "experience") || { items: [] }).items.length;
  const removing = /remov|delet|drop|احذف|شيل|امسح/i.test(String(instruction));
  if (after < before && !removing) throw new Error("The AI dropped a job — nothing was changed");
  for (const t of ["education", "languages", "certs"]) {
    const a = ((cv.sections.find((s) => s.type === t) || { items: [] }).items || []).length, z = ((next.sections.find((s) => s.type === t) || { items: [] }).items || []).length;
    if (z < a && !removing) throw new Error("The AI dropped something from your CV — nothing was changed");
  }
  // applyImport rewrote contact details from text (none given): keep the originals
  next.basics = { ...next.basics, email: next.basics.email || cv.basics.email, phone: next.basics.phone || cv.basics.phone };
  return { cv: next, changed: out.trim() !== src.replace(String(instruction || ""), "").trim() };
}

// ---- v6.12: read a CV by code (always works, keeps every word) ------------------------------------------------------------------
// The model import failed on long CVs (its JSON was cut off at the token limit) and on phones where the model was asleep, so the
// import now starts from this reader: it finds the section headings (English and Arabic), splits jobs and schools on date lines,
// and keeps every line. The model, when it answers in time, only improves the split (`mergeImport`).
const HEADS = [
  ["summary", /^(professional\s+)?(summary|profile|about( me)?|objective|career objective|personal statement|overview)$|^(نبذة|الملخص|ملخص|نبذة مهنية|الهدف( الوظيفي)?|عني)$/i],
  ["experience", /^((work|professional|employment|relevant)\s+)?(experience|history|employment)( history)?$|^(career|internships?|work)$|^(الخبرات?( العملية| المهنية)?|الخبرة( العملية)?|الخبرات العملية|التدريب|الوظائف( السابقة)?)$/i],
  ["education", /^(education|academic( background| qualifications)?|qualifications|studies)$|^(التعليم|المؤهلات?( الدراسية| العلمية)?|الدراسة)$/i],
  ["skills", /^((key|core|technical|soft|hard|professional)\s+)?(skills|competenc(e|ies)|expertise|strengths)( (&|and) (tools|abilities|competencies))?$|^(المهارات|مهارات|القدرات)$/i],
  ["languages", /^languages?$|^(اللغات|لغات)$/i],
  ["certs", /^(certifications?|certificates?|licen[cs]es?( (&|and) certifications?)?|courses|training|awards?( (&|and) certifications?)?)$|^(الشهادات( والدورات)?|الدورات( التدريبية)?|الجوائز)$/i],
  ["projects", /^(projects|key projects|selected projects|portfolio)$|^(المشاريع|مشاريع)$/i],
];
const headOf = (line) => {
  const t = line.replace(/^[#*\-–•\s]+|[:：\s]+$/g, "").replace(/\*\*/g, "").trim();
  if (!t || t.length > 48) return "";
  for (const [k, re] of HEADS) if (re.test(t)) return k;
  return "";
};
const DATE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}|present|current|now|حتى الآن|الآن|حاليا/i;
const RANGE = /(((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d{2}))\s*(?:[-–—]|to|until|إلى|الى|-)\s*(((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d{2})|present|current|now|today|حتى الآن|الآن|حاليا)/i;
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const ym = (mon, yr) => { const m = mon && MON[mon.trim().toLowerCase().replace(/\.$/, "").slice(0, mon.trim().toLowerCase().startsWith("sept") ? 4 : 3)]; return m ? `${yr}-${String(m).padStart(2, "0")}` : yr; };
const BULLET = /^[•\-–*·▪●◦»]\s*/;
/** Split a block of lines into entries: a new entry starts at a line with a date range, or a non-bullet line after bullets. */
function entries(lines) {
  const out = []; let cur = null;
  for (const l of lines) {
    const isB = BULLET.test(l), hasR = RANGE.test(l);
    if (!cur || (hasR && cur.range) || (!isB && cur.bul.length && !hasR)) { cur = { head: [], bul: [], range: null }; out.push(cur); }
    if (hasR && !cur.range) { const m = RANGE.exec(l); cur.range = m; const rest = l.replace(m[0], "").replace(/[|,·•()\s–-]+$/g, "").replace(/^[|,·•()\s–-]+/g, "").trim(); if (rest) cur.head.push(rest); }
    else if (isB) cur.bul.push(l.replace(BULLET, "").trim());
    else if (cur.bul.length === 0 && cur.head.length < 3) cur.head.push(l);
    else cur.bul.push(l);
  }
  return out;
}
const splitHead = (h) => { const a = h.split(/\s+(?:at|@|[|–—]|-)\s+|\s*[|–—]\s*|,\s+|،\s*|\s+في\s+/).map((x) => x.trim()).filter(Boolean); return a; };
const dates = (r) => {
  if (!r) return { start: "", end: "", current: false };
  const cur = /present|current|now|today|حتى الآن|الآن|حاليا/i.test(r[4] || "");
  return { start: ym(r[2], r[3]), end: cur ? "" : ym(r[5], r[6]), current: cur };
};
/** The CV text → the same JSON shape the model import returns. Never throws, never drops a line. */
export function parseCVText(text) {
  const raw = String(text || "").replace(/\r/g, "").split("\n").map((x) => x.replace(/\s+$/, ""));
  const lines = raw.map((x) => x.trim()).filter(Boolean);
  const ex = extractContact(text);
  const parts = { top: [] }; let key = "top";
  for (const l of lines) { const h = headOf(l); if (h) { key = h; parts[key] = parts[key] || []; continue; } (parts[key] = parts[key] || []).push(l); }
  const top = parts.top || [];
  const contactish = (l) => EMAIL.test(l) || PHONE.test(l) || /linkedin|github|https?:|www\.|\+\d{2}/i.test(l);
  const title = top.slice(1).find((l) => !contactish(l) && l.length <= 70 && !/[.!?]$/.test(l)) || "";
  const cityLine = top.slice(1).find((l) => contactish(l) && /,|\|/.test(l)) || "";
  const city = (cityLine.split(/[|•·]/).map((x) => x.trim()).find((x) => x && !EMAIL.test(x) && !PHONE.test(x) && !/https?:|www\.|linkedin|github|\d{4,}/i.test(x)) || "");
  const restTop = top.slice(1).filter((l) => l !== title && !contactish(l));
  const j = { basics: { name: ex.name, title, email: ex.email, phone: ex.phone, city }, summary: [...restTop, ...(parts.summary || [])].join(" ").trim(), experience: [], education: [], skills: [], languages: [], certs: [], projects: [] };
  j.experience = entries(parts.experience || []).map((e) => { const h = splitHead(e.head[0] || ""); const second = e.head[1] || ""; return { role: h[0] || "", company: h[1] || second, location: h.slice(2).join(", ") || (h.length > 1 ? second : (e.head[2] || "")), ...dates(e.range), bullets: [...(h.length > 1 ? e.head.slice(2) : e.head.slice(3)), ...e.bul].filter(Boolean) }; });
  j.education = entries(parts.education || []).map((e) => { const h = splitHead(e.head[0] || ""); const d = dates(e.range); return { degree: h[0] || "", school: h.slice(1).join(", ") || e.head[1] || "", start: d.start, end: d.end, note: [...e.head.slice(h.length > 1 ? 1 : 2), ...e.bul].join("; ") }; });
  j.skills = (parts.skills || []).flatMap((l) => l.replace(BULLET, "").split(/\s*[,;•·|،]\s*/)).map((x) => x.trim()).filter(Boolean);
  j.languages = (parts.languages || []).flatMap((l) => { const s = l.replace(BULLET, ""); const m = /^(.+?)\s*[:(–-]\s*(.+?)\)?$/.exec(s); return m && !/[,،]/.test(s) ? [{ name: m[1].trim(), level: m[2].trim() }] : s.split(/\s*[,;•·|،]\s*|\s{2,}/).flatMap((x) => (x.split(/\s+/).length > 1 && x.split(/\s+/).every((w) => /^[A-Z؀-ۿ][a-z]*$/.test(w) && !/^(Native|Fluent|Basic|Intermediate|Advanced)$/i.test(w)) ? x.split(/\s+/) : [x])).filter(Boolean).map((n) => ({ name: n.trim(), level: "" })); });
  j.certs = (parts.certs || []).map((l) => { const s = l.replace(BULLET, ""); const y = /(19|20)\d{2}/.exec(s); return { name: s.replace(/\s*[(,–-]?\s*(19|20)\d{2}\)?\s*$/, "").trim(), issuer: "", year: y ? y[0] : "" }; }).filter((x) => x.name);
  j.projects = entries(parts.projects || []).map((e) => ({ name: e.head[0] || "", link: "", bullets: [...e.head.slice(1), ...e.bul] }));
  return j;
}
/** Words of a CV JSON (for a "did the model keep everything?" check). */
const wordsOf = (o) => new Set(String(JSON.stringify(o) || "").toLowerCase().match(/[a-z؀-ۿ0-9]{3,}/g) || []);
/** How much of the source text's wording the model's JSON kept (0..1). */
export function coverage(j, text) { const w = wordsOf(j), src = [...(String(text).toLowerCase().match(/[a-z؀-ۿ0-9]{3,}/g) || [])]; if (!src.length) return 1; return src.filter((x) => w.has(x)).length / src.length; }
/** Read the model's answer even when it was cut off (close the open strings, arrays and objects). */
export function jsonLoose(raw) {
  const s = String(raw || ""), a = s.indexOf("{");
  if (a < 0) return null;
  let t = s.slice(a), b = t.lastIndexOf("}");
  try { return JSON.parse(t.slice(0, b + 1)); } catch (e) {}
  // repair: walk the text, track the open brackets, cut back to the last complete value, then close everything
  const st = []; let inS = false, esc = false, lastOk = -1;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inS) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') inS = true; else if (c === "{" || c === "[") st.push(c); else if (c === "}" || c === "]") { st.pop(); lastOk = i; } else if (c === ",") lastOk = i - 1;
  }
  for (let cut = lastOk; cut > 0; cut--) {
    const head = t.slice(0, cut + 1).replace(/,\s*$/, "");
    const open = []; let s2 = false, e2 = false;
    for (const c of head) { if (s2) { if (e2) e2 = false; else if (c === "\\") e2 = true; else if (c === '"') s2 = false; continue; } if (c === '"') s2 = true; else if (c === "{" || c === "[") open.push(c); else if (c === "}" || c === "]") open.pop(); }
    if (s2) continue;
    const close = open.reverse().map((c) => (c === "{" ? "}" : "]")).join("");
    try { return JSON.parse(head + close); } catch (e) {}
    if (lastOk - cut > 4000) break;
  }
  return null;
}
/** The model's split where it is complete, the code's split where the model dropped or cut something. */
export function mergeImport(codeJ, modelJ, text) {
  if (!modelJ || typeof modelJ !== "object") return codeJ;
  const out = { ...codeJ, basics: { ...codeJ.basics } };
  for (const k of ["name", "title", "email", "phone", "city"]) if (!out.basics[k] && modelJ.basics && modelJ.basics[k]) out.basics[k] = String(modelJ.basics[k]);
  if (modelJ.basics && modelJ.basics.title && codeJ.basics.title && String(text).includes(modelJ.basics.title)) out.basics.title = modelJ.basics.title;
  for (const k of ["summary", "experience", "education", "skills", "languages", "certs"]) {
    const m = modelJ[k], c = codeJ[k];
    const empty = (v) => (Array.isArray(v) ? v.length === 0 : !String(v || "").trim());
    if (empty(m)) continue;
    if (empty(c) || coverage({ x: m }, JSON.stringify(c)) >= 0.85) out[k] = m;
  }
  return out;
}

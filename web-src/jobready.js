/* ---- v6.27 Job ready — from your CV to a job, inside CV / Resume (a "Job ready" tab, no new tool). All CODE:
   · roleOf / skillsCheck: the job you want → the skills employers usually ask for, which your CV already shows and which it
     doesn't (each missing one can start a Learn daily course).
   · questions / feedback: interview practice — common and role questions, said aloud; your spoken answer checked for length,
     filler words, a clear story (situation → action → result) and a number in the result. A model may add advice, labelled.
   · jobLinks: the job sites people use in your country, searched for the role and city.
   Tests: tests/unit/v727job.test.mjs.                                                                                       */

// role → [words that name it, skills (each: shown name | words that count as having it)]
export const ROLES = {
  developer: ["software|developer|programmer|engineer \\(software\\)|web developer|frontend|backend|full[- ]?stack|مطور|مبرمج", ["JavaScript|javascript|js|typescript", "Python|python", "SQL|sql|database", "Git|git|github", "APIs|api|rest", "Testing|testing|unit test|jest|pytest", "Cloud|aws|azure|gcp|cloud", "React|react|vue|angular"]],
  data: ["data analyst|data scientist|business analyst|bi analyst|محلل بيانات", ["Excel|excel|spreadsheets", "SQL|sql", "Python|python|pandas", "Power BI / Tableau|power bi|tableau|looker", "Statistics|statistics|regression|a\\/b test", "Dashboards|dashboard|reporting", "Communication|presented|stakeholder|communication"]],
  accountant: ["accountant|accounting|bookkeeper|auditor|محاسب|مراجع حسابات", ["Excel|excel", "Bookkeeping|bookkeeping|journal|ledger", "Tax / VAT|tax|vat|ضريب", "Financial statements|financial statements|balance sheet|p&l|income statement", "Reconciliation|reconcil", "ERP software|sap|oracle|odoo|quickbooks|xero|erp", "IFRS / GAAP|ifrs|gaap"]],
  sales: ["sales|account manager|business development|مبيعات|مندوب", ["Targets met|target|quota|exceeded", "CRM|crm|salesforce|hubspot", "Negotiation|negotiat", "Lead generation|lead|prospect|cold call", "Client relationships|client|customer relationship", "Presentations|present|pitch"]],
  marketing: ["marketing|digital marketing|social media|content|brand|تسويق", ["Social media|social media|instagram|facebook|tiktok|linkedin", "SEO|seo", "Paid ads|google ads|meta ads|ppc|paid", "Analytics|analytics|ga4|metrics", "Content writing|content|copywrit", "Email marketing|email|newsletter|mailchimp", "Campaigns|campaign"]],
  support: ["customer service|customer support|call center|help desk|خدمة العملاء|كول سنتر", ["Communication|communication|communicat", "Problem solving|resolv|solved|problem", "CRM / ticketing|zendesk|freshdesk|crm|ticket", "Patience under pressure|calm|pressure|difficult customer", "Languages|english|arabic|french|bilingual", "Typing / systems|typing|system"]],
  nurse: ["nurse|nursing|ممرض|تمريض", ["Patient care|patient care|patients", "Medication administration|medication|administer", "Vital signs|vital signs|vitals", "BLS / ACLS|bls|acls|cpr", "Records|documentation|records|charting", "Infection control|infection control|hygiene"]],
  teacher: ["teacher|tutor|instructor|lecturer|مدرس|معلم", ["Lesson planning|lesson plan|curriculum", "Classroom management|classroom management|behaviour|behavior", "Assessment|assessment|grading|exam", "Differentiation|differentiat|special needs|sen", "Technology in class|google classroom|teams|edtech|smartboard", "Parent communication|parent"]],
  pm: ["project manager|project management|program manager|scrum master|product manager|مدير مشروع|مدير مشروعات", ["Planning|planning|schedule|timeline", "Budget|budget", "Stakeholders|stakeholder", "Risk|risk", "Agile / Scrum|agile|scrum|kanban", "Tools|jira|ms project|primavera|asana|trello", "Delivery|delivered|on time|launch"]],
  designer: ["designer|graphic design|ui|ux|مصمم", ["Figma|figma", "Adobe tools|photoshop|illustrator|indesign|adobe", "Portfolio|portfolio|behance|dribbble", "Typography|typograph", "User research|user research|usability|interview", "Branding|brand"]],
  hr: ["hr|human resources|recruiter|talent|موارد بشرية|توظيف", ["Recruitment|recruit|hiring|sourcing", "Onboarding|onboarding", "Labour law|labour law|labor law|قانون العمل", "Payroll|payroll", "HR systems|hris|workday|bamboo|sap hr", "Employee relations|employee relations|engagement"]],
  engineer: ["civil engineer|mechanical engineer|electrical engineer|site engineer|مهندس", ["AutoCAD|autocad|cad", "Site supervision|site|supervis", "Safety|safety|hse|osha", "Quantity / cost|quantity|boq|cost", "Standards|code|standard|iso|astm", "Software|revit|solidworks|etabs|sap2000|primavera|matlab"]],
  driver: ["driver|delivery driver|chauffeur|سائق", ["Licence|licen[cs]e|رخصة", "Clean record|clean record|no accidents", "Routes / navigation|route|navigation|gps", "Vehicle checks|vehicle check|maintenance", "Customer service|customer"]],
  crane: ["crane operator|rigger|lifting|ونش|كرين", ["Certification|certif|nccco|cpcs|licen", "Load charts|load chart", "Rigging|rigging|slings", "Safety|safety|hse|lift plan", "Equipment types|mobile crane|tower crane|crawler"]],
  chef: ["chef|cook|kitchen|طباخ|شيف", ["Food safety|food safety|haccp|hygiene", "Menu|menu", "Cost control|cost|waste", "Cuisine|cuisine|pastry|grill", "Team|team|kitchen staff"]],
  admin: ["administrative|admin assistant|secretary|office manager|receptionist|سكرتير|إداري|استقبال", ["MS Office|word|excel|outlook|office", "Scheduling|schedul|calendar", "Filing / records|filing|records", "Communication|communication|phone", "Organisation|organi[sz]"]],
};
const rx = (s) => new RegExp("(?<![\\p{L}])(?:" + s + ")", "iu");

export function roleOf(title) {
  const t = String(title || "");
  for (const [k, [names]] of Object.entries(ROLES)) if (rx(names).test(t)) return k;
  return "";
}
/** The CV's text against the role's skills: have / missing (shown names). */
export function skillsCheck(cvText, title) {
  const role = roleOf(title); if (!role) return { role: "", have: [], missing: [] };
  const t = String(cvText || "");
  const have = [], missing = [];
  for (const s of ROLES[role][1]) { const [name, words] = s.split(/\|(.*)/s); (rx(words).test(t) ? have : missing).push(name); }
  return { role, have, missing, score: Math.round((have.length / (have.length + missing.length)) * 100) };
}

const COMMON = [
  ["Tell me about yourself.", "حدثني عن نفسك."],
  ["Why do you want this job?", "لماذا تريد هذه الوظيفة؟"],
  ["Tell me about a problem you solved at work.", "حدثني عن مشكلة حللتها في العمل."],
  ["What is your biggest strength — with an example?", "ما أكبر نقاط قوتك — مع مثال؟"],
  ["Tell me about a time you made a mistake. What did you do?", "حدثني عن خطأ ارتكبته. ماذا فعلت؟"],
  ["Where do you see yourself in three years?", "أين ترى نفسك بعد ثلاث سنوات؟"],
  ["Do you have any questions for us?", "هل لديك أي أسئلة لنا؟"],
];
const BY_ROLE = {
  developer: [["Walk me through a project you built. What was hardest?", "اشرح لي مشروعًا بنيته. ما أصعب جزء فيه؟"], ["How do you make sure your code works?", "كيف تتأكد أن الكود يعمل؟"]],
  data: [["Tell me about an analysis that changed a decision.", "حدثني عن تحليل غيّر قرارًا."], ["How do you check that data is correct?", "كيف تتحقق من صحة البيانات؟"]],
  accountant: [["How do you close the month?", "كيف تُقفل الشهر المالي؟"], ["Tell me about a reconciliation that didn't match.", "حدثني عن تسوية لم تتطابق."]],
  sales: [["Tell me about your best month. What did you do differently?", "حدثني عن أفضل شهر لك. ماذا فعلت بشكل مختلف؟"], ["How do you handle a client who says it's too expensive?", "كيف تتعامل مع عميل يقول إن السعر مرتفع؟"]],
  marketing: [["Tell me about a campaign and its results.", "حدثني عن حملة ونتائجها."], ["How do you decide where to spend the budget?", "كيف تقرر أين تنفق الميزانية؟"]],
  support: [["Tell me about an angry customer you helped.", "حدثني عن عميل غاضب ساعدته."], ["What do you do when you don't know the answer?", "ماذا تفعل عندما لا تعرف الإجابة؟"]],
  nurse: [["Tell me about a time a patient's condition changed quickly.", "حدثني عن مرة تغيرت فيها حالة مريض بسرعة."]],
  teacher: [["How do you help a student who is falling behind?", "كيف تساعد طالبًا متأخرًا عن زملائه؟"]],
  pm: [["Tell me about a project that was late. What did you do?", "حدثني عن مشروع تأخر. ماذا فعلت؟"]],
  designer: [["Walk me through a design from brief to final.", "اشرح لي تصميمًا من الفكرة إلى الشكل النهائي."]],
  hr: [["How do you find good candidates for a hard role?", "كيف تجد مرشحين جيدين لوظيفة صعبة؟"]],
  engineer: [["Tell me about a site problem you solved.", "حدثني عن مشكلة في الموقع حللتها."]],
  driver: [["What do you do if a delivery can't be completed?", "ماذا تفعل إن تعذّر إكمال التوصيل؟"]],
  crane: [["How do you plan a lift near the chart's limit?", "كيف تخطط لرفعة قريبة من حد جدول الأحمال؟"]],
  chef: [["How do you keep quality during a rush?", "كيف تحافظ على الجودة وقت الزحام؟"]],
  admin: [["How do you handle many urgent tasks at once?", "كيف تتعامل مع مهام عاجلة كثيرة في وقت واحد؟"]],
};
/** The practice set: the role's own questions first, then the common ones. */
export function questions(title, lang = "en") {
  const role = roleOf(title), i = lang === "ar" ? 1 : 0;
  return [...(BY_ROLE[role] || []), ...COMMON].map((q) => q[i]);
}

const FILLERS = /(?<![\p{L}])(?:um+|uh+|erm|like|you know|i mean|basically|actually|sort of|kind of|يعني|اه+|امم+|طيب يعني|بص|زي ما تقول)(?![\p{L}])/giu;
const STORY = { situation: /(?<![\p{L}])(when|at my|in my last|at \w+ i|there was|the problem|we had|عندما|لما|في شغلي|كان فيه|المشكلة)(?![\p{L}])/iu,
  action: /(?<![\p{L}])(i (?:decided|built|led|made|created|fixed|organi[sz]ed|called|wrote|trained|changed|found|set up)|so i|i then|قمت|عملت|قررت|بنيت|نظمت|اتصلت|حليت)(?![\p{L}])/iu,
  result: /(?<![\p{L}])(as a result|so that|which led|resulted|in the end|we (?:saved|grew|cut|reached|won)|increased|reduced|النتيجة|وبالتالي|زادت|قلت|وفرنا|وصلنا)(?![\p{L}])/iu };
/** Code's feedback on one spoken or typed answer. */
export function feedback(answer, { cvText = "", lang = "en" } = {}) {
  const a = String(answer || "").trim(), ar = lang === "ar";
  const words = a ? a.split(/\s+/).filter(Boolean).length : 0;
  const fillers = (a.match(FILLERS) || []).length;
  const hasNum = /\d|[٠-٩]|percent|٪|%/.test(a);
  const story = { situation: STORY.situation.test(a), action: STORY.action.test(a), result: STORY.result.test(a) };
  const cvWords = new Set(String(cvText).toLowerCase().match(/\p{L}{5,}/gu) || []);
  const fromCV = (a.toLowerCase().match(/\p{L}{5,}/gu) || []).filter((w) => cvWords.has(w)).length;
  const good = [], fix = [];
  const T = (en, arT) => (ar ? arT : en);
  if (words < 40) fix.push(T(`Too short (${words} words) — aim for 60–150: say what happened, what you did, and the result.`, `قصيرة جدًا (${words} كلمة) — استهدف 60–150: ماذا حدث، وماذا فعلت، وما النتيجة.`));
  else if (words > 220) fix.push(T(`Long (${words} words) — keep it under 2 minutes; cut the background.`, `طويلة (${words} كلمة) — اجعلها أقل من دقيقتين؛ اختصر المقدمة.`));
  else good.push(T(`A good length (${words} words).`, `طول مناسب (${words} كلمة).`));
  if (fillers >= 3) fix.push(T(`${fillers} filler words (um, like, you know…) — pause instead.`, `${fillers} كلمات حشو (يعني، اه…) — توقف لحظة بدلًا منها.`));
  if (story.situation && story.action && story.result) good.push(T("A clear story: what happened → what you did → the result.", "قصة واضحة: ماذا حدث ← ماذا فعلت ← النتيجة."));
  else fix.push(T("Tell it as a story: " + ["what happened", "what YOU did", "the result"].filter((_, i) => !Object.values(story)[i]).join(", ") + " is missing.", "احكها كقصة: ينقصها " + ["ماذا حدث", "ماذا فعلت أنت", "النتيجة"].filter((_, i) => !Object.values(story)[i]).join("، ") + "."));
  if (hasNum) good.push(T("A number makes the result believable.", "الرقم يجعل النتيجة مقنعة."));
  else if (words >= 25) fix.push(T("Add a number to the result (how many, how much, how fast).", "أضف رقمًا للنتيجة (كم، بكم، بأي سرعة)."));
  if (fromCV >= 2) good.push(T("It matches what your CV says.", "تتوافق مع ما في سيرتك الذاتية."));
  return { words, fillers, story, hasNum, good, fix, score: Math.max(0, Math.min(100, 40 + good.length * 15 - fix.length * 10)) };
}

const slug = (s) => String(s || "").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
const q = (s) => encodeURIComponent(String(s || "").trim());
const INDEED = { US: "www.indeed.com", GB: "uk.indeed.com", CA: "ca.indeed.com", IN: "in.indeed.com", AE: "ae.indeed.com", SA: "sa.indeed.com", AU: "au.indeed.com", DE: "de.indeed.com", FR: "fr.indeed.com", ES: "es.indeed.com", IT: "it.indeed.com", NL: "nl.indeed.com", IE: "ie.indeed.com", SG: "sg.indeed.com", MY: "malaysia.indeed.com", PH: "ph.indeed.com", ZA: "za.indeed.com", NG: "ng.indeed.com", PK: "pk.indeed.com", TR: "tr.indeed.com", MX: "mx.indeed.com", BR: "br.indeed.com" };
/** The job sites people use in the country, searched for the role (and city). */
export function jobLinks(role, city = "", country = "") {
  const C = String(country || "").toUpperCase(), r = String(role || "").trim(); if (!r) return [];
  const out = [{ label: "LinkedIn Jobs", url: `https://www.linkedin.com/jobs/search/?keywords=${q(r)}${city ? "&location=" + q(city) : ""}`, app: "com.linkedin.android" }];
  if (INDEED[C]) out.push({ label: "Indeed", url: `https://${INDEED[C]}/jobs?q=${q(r)}${city ? "&l=" + q(city) : ""}`, app: "com.indeed.android.jobsearch" });
  if (C === "EG") out.push({ label: "Wuzzuf", url: `https://wuzzuf.net/search/jobs/?q=${q(r)}` });
  if (["EG", "AE", "SA", "KW", "QA", "BH", "OM", "JO", "LB", "MA", "TN", "DZ"].includes(C)) out.push({ label: "Bayt", url: `https://www.bayt.com/en/international/jobs/${slug(r)}-jobs/` });
  if (C === "IN") out.push({ label: "Naukri", url: `https://www.naukri.com/${slug(r)}-jobs` });
  if (C === "GB") out.push({ label: "Reed", url: `https://www.reed.co.uk/jobs/${slug(r)}-jobs` });
  if (C === "AU") out.push({ label: "SEEK", url: `https://www.seek.com.au/${slug(r)}-jobs` });
  if (C === "DE") out.push({ label: "StepStone", url: `https://www.stepstone.de/jobs/${slug(r)}` });
  if (["MY", "SG", "PH", "ID"].includes(C)) out.push({ label: "JobStreet", url: `https://www.jobstreet.com/${slug(r)}-jobs` });
  out.push({ label: "Google", url: `https://www.google.com/search?q=${q(r + " jobs" + (city ? " " + city : ""))}&ibp=htl;jobs` });
  return out;
}
/** A model's interview advice (optional, labelled): only about this answer, no invented facts. */
export function coachPrompt(question, answer, lang = "en") {
  return [{ role: "system", content: `You are an interview coach. In ${lang === "ar" ? "simple Arabic" : "English"}, give 2 short, specific improvements to this answer, then one better first sentence. Don't invent facts about the person.` },
    { role: "user", content: `Question: ${question}\nAnswer: ${String(answer).slice(0, 2500)}` }];
}

/* ---- v6.41 (upgrade S5) — a scored mock interview: 5 questions asked aloud, each answer scored by code on structure (what
   happened → what you did → the result), filler words, speed and confidence (hedging), and a better version of the answer
   written by the model from the person's OWN facts only. */
const HEDGE = /(?<![\p{L}])(?:i think|i guess|maybe|probably|i'?m not sure|kind of|sort of|i hope|hopefully|i would say|perhaps|ممكن|يمكن|تقريبا|تقريبًا|مش متأكد|أظن|اظن|حاجة زي كده|على ما أعتقد|غالبا|غالبًا)(?![\p{L}])/giu;
/** Speaking speed: words a minute and what it means (110–170 is easy to follow). */
export function pace(words, secs) {
  if (!secs || secs < 5 || !words) return { wpm: null, verdict: "unknown" };
  const wpm = Math.round(words / (secs / 60));
  return { wpm, verdict: wpm < 100 ? "slow" : wpm > 180 ? "fast" : "good" };
}
/** One answer → four scores 0–100 and the total (structure counts most). */
export function scoreAnswer(answer, secs, opts = {}) {
  const f = feedback(answer, opts);
  const parts = Object.values(f.story).filter(Boolean).length;
  const structure = Math.round((parts / 3) * 80 + (f.hasNum ? 20 : 0));
  const per100 = f.words ? (f.fillers / f.words) * 100 : 0;
  const fillers = f.words ? Math.max(0, Math.round(100 - per100 * 15)) : 0;
  const p = pace(f.words, secs);
  const paceS = p.wpm == null ? null : p.verdict === "good" ? 100 : Math.max(20, 100 - Math.abs(p.wpm - (p.wpm < 110 ? 110 : 170)) * 1.5);
  const hedges = (String(answer || "").match(HEDGE) || []).length;
  const confidence = f.words ? Math.max(0, 100 - hedges * 20 - (f.words < 40 ? 25 : 0)) : 0;
  const parts4 = [structure * 2, fillers, confidence, ...(paceS == null ? [] : [Math.round(paceS)])];
  const total = Math.round(parts4.reduce((a, b) => a + b, 0) / (parts4.length + 1));
  return { ...f, structure, fillersScore: fillers, pace: p, paceScore: paceS == null ? null : Math.round(paceS), hedges, confidence, total };
}
/** The whole interview → averages and the one thing to work on first. */
export function scorecard(rows, lang = "en") {
  const done = (rows || []).filter((r) => r && r.score);
  if (!done.length) return null;
  const avg = (k) => { const v = done.map((r) => r.score[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const c = { total: avg("total"), structure: avg("structure"), fillers: avg("fillersScore"), pace: avg("paceScore"), confidence: avg("confidence"), n: done.length };
  const weak = [["structure", c.structure], ["fillers", c.fillers], ["confidence", c.confidence], ["pace", c.pace]].filter(([, v]) => v != null).sort((a, b) => a[1] - b[1])[0];
  const ar = lang === "ar";
  const TIP = { structure: ar ? "احكي كل إجابة كقصة: إيه اللي حصل، إنت عملت إيه، والنتيجة برقم." : "Tell every answer as a story: what happened, what YOU did, and the result with a number.",
    fillers: ar ? "بدل «يعني» و«اه» — سكتة صغيرة. السكوت ثانية أحسن من الحشو." : "Replace “um” and “like” with a short pause — a second of silence sounds more confident.",
    confidence: ar ? "قول «عملت» و«نجحت» بدل «أظن» و«ممكن»." : "Say “I did” and “it worked” instead of “I think” and “maybe”.",
    pace: ar ? "خلي سرعتك متوسطة: 110–170 كلمة في الدقيقة." : "Keep a steady pace: 110–170 words a minute." };
  return { ...c, weakest: weak ? weak[0] : null, tip: weak ? TIP[weak[0]] : "" };
}
/** The better answer: the same facts, told as a clear story — nothing invented. */
export function betterAnswerPrompt(question, answer, lang = "en") {
  return [{ role: "system", content: `Rewrite this interview answer so it is clear and strong: what happened → what the person did → the result (with any number they gave). Keep it under 120 words, first person, ${lang === "ar" ? "in simple Egyptian Arabic" : "in English"}. Use ONLY facts in their answer — never add numbers, companies or events they didn't say; where a number would help but is missing, write [number]. Reply with the answer only.` },
    { role: "user", content: `Question: ${question}\nTheir answer: ${String(answer).slice(0, 2500)}` }];
}

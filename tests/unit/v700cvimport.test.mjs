// v6.12 — CV import by code: always works (no model, cut-off model JSON), keeps every line, English and Arabic.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const V = await import("../../web-src/cv.js");
const A = await import("../../web-src/cv-ai.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };
const en = `Aly Aldibiki
Business Administration Student | Operations
Cairo, Egypt | aly@example.com | +20 100 123 4567

Profile
Analytical business student running operations at a 150-employee crane company.

Experience
Operations Assistant — Adrighem and Aldibiki, Cairo
Jun 2023 – Present
• Scheduled 40+ crane jobs a month
Accountant | Aldibiki Logistics
2021 - 2023
- Calculated financial transactions in Microsoft Access

Education
BBA, German International University (GIU)
2022 – 2026
Major: Management

Skills
Competitive Analysis (Porter’s Five Forces)
Lean Startup Methodology & MVP Development

Languages
English Arabic French
German Turkish`;
const j = A.parseCVText(en);
ok(j.basics.name === "Aly Aldibiki" && j.basics.email === "aly@example.com" && j.basics.city === "Cairo, Egypt", "contact details read");
ok(j.experience.length === 2 && j.experience[0].current && j.experience[0].start === "2023-06" && j.experience[0].company === "Adrighem and Aldibiki", "jobs split on date lines, Present = current");
ok(j.experience[1].end === "2023" && j.experience[1].bullets[0].startsWith("Calculated"), "end year and bullets kept");
ok(j.education[0].school.includes("German International") && j.education[0].end === "2026" && j.education[0].note === "Major: Management", "education read");
ok(j.skills.length === 2 && j.languages.map((l) => l.name).join() === "English,Arabic,French,German,Turkish", "skills and languages read");
ok(A.coverage(j, en) > 0.93, "no line lost (coverage " + A.coverage(j, en).toFixed(2) + ")");
const ar = `علي الديبكي
محاسب
القاهرة | ali@x.com | 01001234567
الخبرات العملية
محاسب - شركة أدريجم والديبكي
2021 - حتى الآن
• إعداد الفواتير الشهرية
اللغات
العربية: اللغة الأم`;
const k = A.parseCVText(ar);
ok(k.experience[0].current && k.experience[0].company.includes("أدريجم") && k.languages[0].level === "اللغة الأم", "Arabic CV read");
// a cut-off model answer is still read
const cut = A.jsonLoose('{"basics":{"name":"Aly"},"experience":[{"role":"Ops","bullets":["a","b');
ok(cut && cut.basics.name === "Aly" && cut.experience[0].role === "Ops", "a cut-off JSON answer is repaired");
ok(A.jsonLoose("sorry, I cannot") === null, "no JSON → null, no throw");
// the model dropping jobs never wins over the code's full reading
const m = A.mergeImport(j, { experience: [{ role: "Operations Assistant", company: "Adrighem", bullets: [] }], summary: "" }, en);
ok(m.experience.length === 2, "a model answer that drops a job is ignored for that section");
const c = A.applyImport(V.newCV("en"), j, en);
ok(c.sections.find((s) => s.type === "experience").items.length === 2 && c.basics.name === "Aly Aldibiki", "applied to a CV");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");

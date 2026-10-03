// v6.10 — the CV page's logic: both looks from one content, English and Arabic, the Word blocks, the checker.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const V = await import("../../web-src/cv.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };

const cv = V.newCV("en", "Site supervisor");
cv.basics = { name: "Ahmed Ali", title: "Site Supervisor", email: "a@mail.com", phone: "+20 100 000 0000", city: "Cairo", links: [{ label: "LinkedIn", url: "linkedin.com/in/ahmed" }] };
cv.sections[0].items = [{ text: "Supervisor with 8 years on heavy-lift sites." }];
cv.sections[1].items = [
  { role: "Site Supervisor", company: "Orascom", location: "Cairo", start: "2021-03", end: "", current: true, bullets: ["Led 12 lifts a week with zero incidents", "Reduced idle crane time by 18%"] },
  { role: "Rigger", company: "Arab Contractors", location: "Giza", start: "2016-01", end: "2019-12", current: false, bullets: ["Responsible for rigging", ""] },
];
cv.sections[2].items = [{ degree: "BSc Mechanical Engineering", school: "Cairo University", start: "2011", end: "2016", note: "" }];
cv.sections[3].items = [{ name: "Lifting", items: ["Rigging", "Load charts"] }, { name: "", items: ["Excel"] }];
cv.sections[4].items = [{ name: "Arabic", level: "Native" }, { name: "English", level: "Fluent" }];

// ---- the page
const h = V.cvHtml(cv);
ok(h.includes("Ahmed Ali") && h.includes("Site Supervisor") && h.includes("Orascom") && h.includes("Mar 2021 – Present"), "the ATS page has the name, the role, the company and «Mar 2021 – Present»");
ok(/dir="ltr"/.test(h) && !h.includes('class="cols"'), "English is left-to-right, single column");
ok(!h.includes("<h2>Certificates</h2>") && !h.includes("<h2>Projects</h2>"), "empty sections are left out");
ok(h.includes("<h2>Experience</h2>") && h.indexOf("Experience") < h.indexOf("Education"), "sections come in your order");
const m = V.cvHtml({ ...cv, layout: "modern", showPhoto: false });
ok(m.includes('class="cols"') && m.includes('class="side"') && m.indexOf('class="side"') < m.indexOf("Skills") && m.indexOf('class="main"') < m.indexOf("<h2>Experience"), "the modern look puts skills and languages in the sidebar and experience in the main column");
ok(V.cvHtml({ ...cv, page: "Letter" }).includes("215.9mm 279.4mm"), "Letter size is honoured");
ok(V.cvHtml({ ...cv, theme: "burgundy" }).includes("#9f1239"), "the colour theme is applied");
const ar = V.newCV("ar"); ar.basics = { name: "أحمد علي", title: "مشرف موقع", email: "a@mail.com", phone: "", city: "القاهرة", links: [] };
ar.sections[1].items = [{ role: "مشرف موقع", company: "أوراسكوم", location: "", start: "2021-03", end: "2024-05", current: false, bullets: ["أشرفت على ١٢ رفعة أسبوعيًا"] }];
const ah = V.cvHtml(ar);
ok(/dir="rtl"/.test(ah) && ah.includes("مارس 2021 – مايو 2024") && ah.includes("<h2>الخبرات العملية</h2>"), "Arabic is right-to-left, with Arabic months and section titles");
ok(V.cvHtml({ ...ar, layout: "modern" }).includes("row-reverse"), "the modern look mirrors for Arabic (sidebar on the right)");
ok(!V.cvHtml({ ...cv, basics: { ...cv.basics, name: "<b>x</b>" } }).includes("<b>x</b>"), "text is escaped");

// ---- text and Word
const t = V.cvText(cv);
ok(t.startsWith("Ahmed Ali\nSite Supervisor\na@mail.com | +20 100") && t.includes("EXPERIENCE") && t.includes("- Led 12 lifts a week with zero incidents") && !/- \n/.test(t), "plain text for pasting into an ATS form");
const bl = V.cvBlocks(cv);
ok(bl[0].type === "title" && bl.some((b) => b.type === "h2" && b.text === "Experience") && bl.filter((b) => b.type === "li").length === 3 && !bl.some((b) => b.type === "table"), "Word blocks: a title, headings, bullets, and no tables (ATS-safe)");
const C = await import("../../web-src/convert.js");
const z = await C.unzip(C.docxFromBlocks(bl, "CV")), doc = new TextDecoder().decode(z.get("word/document.xml"));
ok(doc.includes("Ahmed Ali") && doc.includes("Orascom"), "the blocks make a real .docx");

// ---- the checker
const c1 = V.checkCV(cv);
ok(c1.some((x) => /Responsible for/.test(x.en) || /action verb/.test(x.en) && x.where === "Rigger"), "a bullet starting «Responsible for» is flagged");
ok(c1.some((x) => /gap of about/.test(x.en)), "a gap between the 2019 and 2021 jobs is noticed (14 months)");
ok(!c1.some((x) => x.where === "Site Supervisor" && /add a number/.test(x.en)), "bullets with numbers are fine");
ok(V.checkCV(V.newCV("en")).some((x) => x.level === "warn" && /name/.test(x.en)) && V.checkCV(V.newCV("en")).some((x) => /email or a phone/.test(x.en)), "an empty CV is told what to add first");
const bad = V.newCV("en"); bad.sections[1].items = [{ role: "X", company: "Y", start: "2022-05", end: "2021-01", current: false, bullets: ["Did things"] }];
ok(V.checkCV(bad).some((x) => /before the start/.test(x.en)), "an end date before the start date is a warning");
ok(V.checkCV(cv).every((x) => x.ar && x.en), "every finding has English and Arabic text");

// ---- editing helpers
const moved = V.moveSection(cv, cv.sections[1].id, -1);
ok(moved.sections[0].type === "experience" && moved.sections[1].type === "summary", "a section moves up");
ok(V.moveSection(cv, cv.sections[0].id, -1) === cv, "the first section cannot move up");
const cp = V.copyFor(cv, "Orascom");
ok(cp.id !== cv.id && cp.name === "Site supervisor — Orascom" && cp.sections[1].items[0].role === "Site Supervisor", "a copy for another job keeps the content, with a new id and name");
ok(V.addSection(cv, "projects").sections.length === cv.sections.length + 1, "a section can be added");
ok(V.fitScale(300, 297, 1) === 0.99 && V.fitScale(250, 297, 1) === 1 && V.fitScale(900, 297, 1) === 0.72, "fit-to-pages scale: shrinks a little, never below 72 %");
ok(V.fmtDate("2021-03", "en") === "Mar 2021" && V.fmtDate("2021") === "2021" && V.fmtDate("") === "", "dates read well");
V.saveAll([cv, ar]); ok(V.loadAll().length === 2, "several CVs are kept on the phone");

if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); } else console.log("\nALL PASSED");

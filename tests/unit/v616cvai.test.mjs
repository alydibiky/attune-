// v6.10 — CV AI helpers: the model may reword, but never invent a number, a skill or a date.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const V = await import("../../web-src/cv.js");
const A = await import("../../web-src/cv-ai.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };
const throws = (fn, part) => { try { fn(); return false; } catch (e) { return !part || String(e.message).includes(part); } };

const cv = V.newCV("en");
cv.basics = { name: "Ahmed Ali", title: "Site Supervisor", email: "a@mail.com", phone: "", city: "Cairo", links: [] };
cv.sections[1].items = [{ role: "Site Supervisor", company: "Orascom", location: "Cairo", start: "2021-03", end: "", current: true, bullets: ["Led 12 lifts a week", "Cut idle time by 18%", "did safety talks"] }];
cv.sections[3].items = [{ name: "", items: ["Rigging", "Load charts"] }];

// ---- numbers
ok(A.numbersIn("Cut idle time by 18% in 2021, 1,200 t") .join(",") === "18,2021,1200" && A.numbersIn("١٢ رفعة").join() === "12", "numbers are read in Latin and Arabic digits");
ok(A.onlyKnown("Reduced idle time by 18%", "Cut idle time by 18%") && !A.onlyKnown("Reduced idle time by 25%", "Cut idle time by 18%"), "a suggestion with a new number is detected");

// ---- bullets
const orig = cv.sections[1].items[0].bullets;
const good = A.parseBullets('{"bullets":["Led 12 lifts every week","Reduced idle time by 18%","Delivered safety talks to the crew"]}', orig);
ok(good.bullets[0] === "Led 12 lifts every week" && good.refused.length === 0, "good rewrites are accepted");
const bad = A.parseBullets('{"bullets":["Led 12 lifts every week","Reduced idle time by 40%","Delivered safety talks"]}', orig);
ok(bad.bullets[1] === orig[1] && bad.refused.join() === "1", "a rewrite that invents 40% keeps the original line");
ok(throws(() => A.parseBullets('{"bullets":["only one"]}', orig), "did not match"), "a wrong number of bullets is refused");
ok(A.improveBulletsMessages({ role: "Rigger", company: "X", bullets: orig }, "en")[0].content.includes("Never invent"), "the prompt forbids inventing");

// ---- summary
ok(A.parseSummary('{"summary":"Site supervisor with extensive lifting experience, leading 12 lifts a week."}', cv).includes("12 lifts"), "a summary using a number from the CV is accepted");
ok(throws(() => A.parseSummary('{"summary":"Supervisor with 15 years of experience leading lifting teams."}', cv), "not in your CV"), "«15 years» is refused: not in the CV");

// ---- grammar
ok(A.parseGrammar('{"text":"Led 12 lifts a week."}', "led 12 lifts a wek") === "Led 12 lifts a week.", "grammar fix accepted");
ok(throws(() => A.parseGrammar('{"text":"Led 15 lifts a week."}', "led 12 lifts a wek"), "numbers changed"), "grammar fix that changes a number is refused");

// ---- translate
const items = A.collectTexts(JSON.parse(JSON.stringify(cv)));
ok(items.some((x) => x.text === "Site Supervisor") && !items.some((x) => x.text === "Orascom" || x.text === "Ahmed Ali"), "company and name are not sent for translation");
const raw = JSON.stringify({ t: items.map((x) => ({ "Site Supervisor": "مشرف موقع", "Led 12 lifts a week": "أشرفت على 12 رفعة أسبوعيًا", "Cut idle time by 18%": "خفضت وقت التعطل بنسبة 18%", "did safety talks": "قدمت محاضرات سلامة", Rigging: "الرافعات", "Load charts": "جداول الأحمال" }[x.text] || x.text)) });
const arCv = A.applyTranslation(cv, "ar", raw);
ok(arCv.lang === "ar" && arCv.basics.title === "مشرف موقع" && arCv.sections[1].items[0].company === "Orascom" && arCv.sections[1].title === "الخبرات العملية" && arCv.font === "naskh", "translation: wording, section titles and font switch; company stays");
ok(cv.lang === "en" && cv.basics.title === "Site Supervisor", "the original CV is untouched (a copy is translated)");
const drift = JSON.stringify({ t: items.map((x) => (x.text === "Cut idle time by 18%" ? "خفضت وقت التعطل بنسبة 30%" : x.text)) });
ok(A.applyTranslation(cv, "ar", drift).sections[1].items[0].bullets[1] === "Cut idle time by 18%", "a translated line whose number changed stays as the original");
ok(throws(() => A.applyTranslation(cv, "ar", '{"t":["x"]}'), "did not match"), "a translation with the wrong length is refused");

// ---- tailor
const tr = A.parseTailor(JSON.stringify({ keywords: ["rigging", "safety", "crane"], covered: ["rigging"], missing: ["crane", "NEBOSH"], rewrites: [{ old: "Led 12 lifts a week", new: "Led 12 crane lifts a week" }, { old: "Led 12 lifts a week", new: "Led 40 crane lifts a week" }, { old: "a bullet that does not exist", new: "x" }] }), cv);
ok(tr.missing.includes("NEBOSH") && tr.rewrites.length === 1 && tr.rewrites[0].new === "Led 12 crane lifts a week", "tailoring keeps only rewrites of real bullets that add no number");
ok(A.applyRewrite(cv, tr.rewrites[0]).sections[1].items[0].bullets[0] === "Led 12 crane lifts a week" && cv.sections[1].items[0].bullets[0] === "Led 12 lifts a week", "a rewrite is applied to a copy");

// ---- letter
ok(throws(() => A.parseLetter('{"letter":"Dear team, I have 20 years of experience in lifting and I would love to join you for this role at your company."}', cv), "not in your CV"), "a cover letter with an invented number is refused");
ok(A.parseLetter('{"letter":"' + "Dear hiring team, I am a site supervisor who led 12 lifts a week at Orascom. ".repeat(3) + '"}', cv).length > 80, "a cover letter from CV facts is accepted");

// ---- import
const ex = A.extractContact("Ahmed Ali\nCairo\n+20 100 123 4567  ahmed@mail.com\nSite supervisor");
ok(ex.email === "ahmed@mail.com" && /100 123 4567/.test(ex.phone) && ex.name === "Ahmed Ali", "email, phone and name are read without the model");
const imp = A.applyImport(V.newCV("en"), JSON.stringify({ basics: { name: "Ahmed A.", title: "Supervisor", email: "wrong@x.com" }, summary: "Experienced.", experience: [{ role: "Supervisor", company: "Orascom", start: "2021-03", end: "", current: true, bullets: ["Led lifts"] }], education: [{ degree: "BSc", school: "Cairo Univ" }], skills: ["Rigging"], languages: [{ name: "Arabic", level: "Native" }] }), "Ahmed Ali\nahmed@mail.com\n+20 100 123 4567");
ok(imp.basics.email === "ahmed@mail.com" && imp.basics.name === "Ahmed A." && imp.sections.find((s) => s.type === "experience").items[0].current === true && imp.sections.find((s) => s.type === "skills").items[0].items[0] === "Rigging", "an imported CV fills the sections; contact details come from the text itself");

if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); } else console.log("\nALL PASSED");

// ---- v6.18: edit with a sentence / make it professional ----
{
  const V = await import("../../web-src/cv.js"), A = await import("../../web-src/cv-ai.js");
  let cv = V.newCV("en", "T"); cv.basics.name = "Ali"; cv.basics.email = "a@b.com";
  cv.sections.find((s) => s.type === "experience").items = [{ role: "Supervisor", company: "Adrighem", location: "", start: "2019", end: "2022", current: false, bullets: ["did lifts for 12 sites"] }];
  const good = JSON.stringify({ ...A.cvToJson(cv), experience: [{ role: "Site Supervisor", company: "Adrighem", start: "2019", end: "2022", bullets: ["Led crane lifts across 12 sites"] }, { role: "Operator", company: "XCMG", start: "2016", end: "2019", bullets: ["Operated 50 t cranes"] }] });
  const r = A.parseRevise(good, cv, "add Operator at XCMG 2016-2019 on 50 t cranes");
  console.log(r.cv.sections.find((s) => s.type === "experience").items.length === 2 && r.cv.basics.email === "a@b.com" ? "PASS revise adds a job from the request and keeps contact details" : "FAIL revise add");
  let threw = ""; try { A.parseRevise(JSON.stringify({ ...A.cvToJson(cv), summary: "Cut costs by 40%" }), cv, ""); } catch (e) { threw = e.message; }
  console.log(/invented a number/.test(threw) ? "PASS revise refuses an invented number" : "FAIL revise invented");
  threw = ""; try { A.parseRevise(JSON.stringify({ ...A.cvToJson(cv), experience: [] }), cv, "make it better"); } catch (e) { threw = e.message; }
  console.log(/dropped a job/.test(threw) ? "PASS revise refuses to lose a job" : "FAIL revise drop");
}

// ---- v6.18 review fixes ----
{
  const V = await import("../../web-src/cv.js"), A = await import("../../web-src/cv-ai.js");
  let cv = V.newCV("en", "T"); cv.basics.name = "Ali";
  cv.sections.find((s) => s.type === "skills").items = [{ name: "Technical", items: ["Crane planning", "Excel"] }, { name: "Soft", items: ["Leadership"] }];
  cv.sections.find((s) => s.type === "education").items = [{ degree: "BSc", school: "GIU", start: "2020", end: "2024", note: "" }];
  const j = A.cvToJson(cv);
  const r = A.parseRevise(JSON.stringify(j), cv, "");
  const g = r.cv.sections.find((s) => s.type === "skills").items;
  console.log(g.length === 2 && g[0].name === "Technical" && g[1].items[0] === "Leadership" ? "PASS a revise keeps the skill groups" : "FAIL skill groups " + JSON.stringify(g));
  let threw = ""; try { A.parseRevise(JSON.stringify({ ...j, education: [] }), cv, "polish"); } catch (e) { threw = e.message; }
  console.log(/dropped something/.test(threw) ? "PASS a revise cannot lose a school" : "FAIL education drop");
  cv.lang = 'x"><img src=x onerror=alert(1)>'; cv.fontSize = "9;}</style><script>alert(1)</script>"; cv.margin = "1};x{";
  const h = V.cvHtml(cv);
  console.log(!h.includes("onerror") && !h.includes("<script>alert") && h.includes('lang="en"') ? "PASS odd lang / numbers cannot inject into the CV page" : "FAIL cv injection");
}

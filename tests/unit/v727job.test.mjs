// v6.27 Job ready (jobready.js): the role, the skills a CV shows and lacks, interview questions, code feedback, job links.
import * as J from "../../web-src/jobready.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
ok(J.roleOf("Junior Data Analyst") === "data" && J.roleOf("Senior Accountant") === "accountant" && J.roleOf("Full-stack developer") === "developer" && J.roleOf("مهندس مدني") === "engineer" && J.roleOf("محاسب") === "accountant", "roles from a job title, English and Arabic");
ok(J.roleOf("Astronaut") === "", "an unknown role is not guessed");
const CV = "Data analyst at Fawry. Built Power BI dashboards for 12 regions; wrote SQL queries; cleaned data in Excel. Presented results to stakeholders.";
const s = J.skillsCheck(CV, "Data Analyst");
ok(s.have.includes("SQL") && s.have.includes("Excel") && s.have.includes("Power BI / Tableau") && s.have.includes("Dashboards") && s.have.includes("Communication"), "shows: SQL, Excel, Power BI, dashboards, communication: " + s.have.join(", "));
ok(s.missing.includes("Python") && s.missing.includes("Statistics") && s.score === 71, "missing: Python, Statistics (71%): " + s.missing.join(", ") + " " + s.score);
ok(J.skillsCheck("I know javascripting", "Developer").have.includes("JavaScript") === true, "a skill is found by its words");
ok(J.questions("Sales executive")[0].includes("best month") && J.questions("Sales executive").length === 9, "sales questions first, then the 7 common ones");
ok(J.questions("محاسب", "ar")[0].includes("الشهر"), "…in Arabic");
// feedback
const weak = J.feedback("um I am like good at, you know, um, working with people");
ok(weak.fix.some((x) => /Too short/.test(x)) && weak.fix.some((x) => /filler/.test(x)) && weak.fix.some((x) => /story/.test(x)), "a short, filler-heavy answer: too short, fillers, no story");
const strong = J.feedback("When I joined Fawry the regional sales reports took three days every month and managers kept asking for numbers. I decided to build a Power BI dashboard connected to our SQL database, and I trained the six regional managers to use it. As a result the report now takes ten minutes instead of three days, and the managers used it to cut stock-outs by 18 percent in the first quarter.", { cvText: CV });
ok(strong.good.some((x) => /clear story/.test(x)) && strong.hasNum && !strong.fix.length && strong.score >= 80, "a strong answer: a clear story with a number, matches the CV (" + strong.score + "): " + strong.fix.join(" | "));
ok(J.feedback("يعني يعني اه أنا شاطر يعني", { lang: "ar" }).fix.some((x) => /حشو/.test(x)), "Arabic fillers are counted");
// links
const eg = J.jobLinks("Data Analyst", "Cairo", "EG").map((l) => l.label);
ok(eg.includes("LinkedIn Jobs") && eg.includes("Wuzzuf") && eg.includes("Bayt") && eg.includes("Google") && !eg.includes("Indeed"), "Egypt: LinkedIn, Wuzzuf, Bayt, Google: " + eg.join(", "));
const uk = J.jobLinks("Nurse", "Leeds", "GB");
ok(uk.some((l) => l.label === "Indeed" && /uk\.indeed\.com\/jobs\?q=Nurse&l=Leeds/.test(l.url)) && uk.some((l) => l.label === "Reed" && /reed\.co\.uk\/jobs\/nurse-jobs/.test(l.url)), "UK: Indeed UK and Reed with the role and city");
ok(J.jobLinks("", "Cairo", "EG").length === 0, "no role → no links");
console.log(bad ? bad + " FAILED" : "v727job ok");

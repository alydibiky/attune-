// Unit tests for v5.20: deep web research helpers.
import { checkNotes, cleanQuery, pagesFor, notesMessages, missingMessages } from "../../web-src/research.js";
import { rankPassages } from "../../web-src/webrank.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const page = "Lynk & Co 900 Ultra | 845 hp | 1,200 Nm | CNY 369,900\nCLTC range 1,400 km. Launched April 28, 2025.";
const notes = "- Ultra: 845 hp, 1,200 Nm, CNY 369,900\n- Range 1,400 km (CLTC)\n- Launched July 20205\n* Max: 9000 hp\nNONE";
const r = checkNotes(notes, page);
eq([r.kept, r.dropped], [2, 2], "notes with numbers not on the page are dropped (20205, 9000)");
eq(r.text.includes("CNY 369,900") && !r.text.includes("20205"), true, "…the right ones are kept exactly");
eq(checkNotes("- Price 369900", page).kept, 1, "a number written without its comma still matches");
eq(checkNotes("- It is a flagship SUV", page).kept, 1, "a note without numbers is kept");
eq(checkNotes("NONE", page).kept, 0, "NONE → nothing");
eq([cleanQuery("NONE"), cleanQuery('"Lynk & Co 900 Ultra price Egypt"'), cleanQuery("Query: 900 Max torque")], ["", "Lynk & Co 900 Ultra price Egypt", "900 Max torque"], "the follow-up query is cleaned (or none)");
eq([pagesFor("Lynk & Co 900 all trims with specs"), pagesFor("who won yesterday")], [8, 5], "detail-hungry questions read 8 pages, simple ones 5");
eq(pagesFor("مواصفات لينك اند كو 900 كل الفئات"), 8, "…Arabic too");
const m = notesMessages("all trims", { title: "T", url: "u", text: "x".repeat(9000) });
eq(m[1].content.length < 7000 && m[0].content.includes("copy digits exactly"), true, "one page at a time, within what the phone model can read");
eq(missingMessages("q", "n")[0].content.includes("NONE"), true, "the missing-check can say NONE");

// ---- Wikipedia is not treated as a reliable source (Ali): it comes last ----
const W = { title: "Lynk & Co 900 - Wikipedia", url: "https://en.wikipedia.org/wiki/Lynk_%26_Co_900", text: "Lynk & Co 900 Ultra has 845 hp and costs CNY 369,900. Lynk & Co 900 trims: Pro, Max, Ultra." };
const O = { title: "Lynk & Co 900 review", url: "https://carnews.example/900", text: "The Lynk & Co 900 Ultra makes 845 hp; price CNY 369,900. Trims: Pro, Max, Ultra with specs." };
const rr = rankPassages("Lynk & Co 900 trims price hp", [W, O]);
eq(rr.map((h) => /wikipedia/.test(h.url)), [false, true], "a Wikipedia page is placed after the other sources");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);

// Unit tests for the v5.13 fixes: arithmetic slips, money word problems,
// Business designs as simple lines, the closest template, odd .xls files.
import { arithmeticSlips, looksLikeMathProblem, verifyMath } from "../../web-src/verify.js";
import { specFromLines, guessTemplate, systemFromSpec, designLinesMessages } from "../../web-src/erp.js";
import { FILE_PRELUDE, profileCode, analyzeFile } from "../../web-src/reason.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

(async () => {
// ---- arithmetic slips (Ali's crane-rent screenshot) ----
const rent = "عدد الأيام:\n5 - 1 = 4 أيام\nEGP 25,000/يوم × 4 أيام = **EGP 10,000**\nEGP 10,000 × 0.04% = **40 EGP**\nEGP 100,000 + 40 EGP = **10,0400 EGP**";
const s = arithmeticSlips(rent);
eq(s.length, 3, "the three wrong sums in the rent answer are caught");
eq(s[0].right, 100000, "25,000 × 4 is recomputed as 100,000");
eq(s[1].right, 4, "10,000 × 0.04% is recomputed as 4");
eq(arithmeticSlips("25,000 × 5 = 125,000\n125,000 × 14% = 17,500\n125,000 + 17,500 = **142,500 EGP**\n3 x 4 = 12\n1/3 = 0.33\nspeed = 60 km/h\nseason 2024-2025 = two years"), [], "right sums, units and years are left alone");
eq(arithmeticSlips("```python\ntotal = 5 * 3 = 1\n```"), [], "code is not judged");
eq(arithmeticSlips("Total: 12.5 × 8 = 100 hours").length, 0, "decimals: 12.5 × 8 = 100 is right");
eq(arithmeticSlips("Average = (60 + 30) / 2 = 50").length, 0, "brackets are not judged (too clever to parse safely)");

// ---- money questions go to the checked route ----
eq(looksLikeMathProblem("A crane rents for 25,000 EGP a day. A job runs from 1 October to 5 October, both days included. How much is the rent, and how much with 14% VAT?"), true, "the rent + VAT question is a word problem");
eq(looksLikeMathProblem("ونش إيجاره 25000 جنيه في اليوم لمدة 5 أيام، الإجمالي كام مع ضريبة 14%؟"), true, "the same in Arabic");
eq(looksLikeMathProblem("What is the latest stable version of Android and when was it released?"), false, "a news question is not");

// verifyMath warms Python up and reports the program growing
{
  const steps = []; let warmed = 0;
  const prog = "```python\nd = 5\nrate = 25000\nprint(d*rate)\nprint('ANSWER: 125000 EGP')\n```";
  const r = await verifyMath({ question: "rent?", warm: () => warmed++, onStep: (x) => steps.push(x),
    llm: async (m, o) => { if (o.onToken) { o.onToken("```python\na\nb\nc\nd"); } return m[0].content.includes("explain") ? "**125,000 EGP**" : prog; },
    runPy: async () => ({ ok: true, stdout: "125000\nANSWER: 125000 EGP" }) });
  eq([r.ok, r.answer, warmed], [true, "125000 EGP", 1], "verifyMath: Python is started while the program is written");
  eq(steps.includes("Writing the program…"), true, "the screen says the program is being written (not one frozen line)");
}

// ---- Business: the design as simple lines ----
const lines = "Here is the design:\n**TABLE Customers**\n- Name: text\n- Phone: phone\nTABLE Cranes\n1. Code: auto\n2. Model: text\n3. Status: choice (Available, On hire, Maintenance)\nTABLE Jobs\n- Customer: link Customers\n- Crane: link Cranes\n- Days: number\n- Daily rate: money\n- Total: formula [Days] * [Daily rate]";
const sp = specFromLines(lines, "Crane co");
eq(sp.tables.map((t) => t.name), ["Customers", "Cranes", "Jobs"], "tables read from the line format");
eq(sp.tables[1].fields[2], { name: "Status", type: "choice", options: ["Available", "On hire", "Maintenance"] }, "choice options read");
eq(sp.tables[2].fields[4].formula, "[Days] * [Daily rate]", "formula read");
const sys = systemFromSpec(sp);
eq(sys.tables[2].fields.filter((f) => f.type === "link").length, 2, "links become real links");
eq(specFromLines("Sorry, I can't."), null, "nothing usable → null");
eq(guessTemplate("We rent mobile cranes (20-500 t) with operators in Egypt. We track customers, jobs per site").id, "cranes", "Ali's description → the crane template");
eq(guessTemplate("مطعم وكافيه بنبيع قهوة وأكل").id, "restaurant", "Arabic description → restaurant");
eq(guessTemplate("hello"), null, "no idea → no template");
eq(/TABLE/.test(designLinesMessages("x")[0].content), true, "the line-format prompt shows the format");

// ---- files: the loader comes first, errors say something ----
eq(/def load_sheets/.test(FILE_PRELUDE) && /<table/.test(FILE_PRELUDE) && /xlrd/.test(FILE_PRELUDE), true, "the loader reads HTML-as-xls, text-as-xls and real xls");
eq(/load_sheets\(name\)/.test(profileCode("a.xls")), true, "the profile uses the loader");
{
  const runs = [];
  const r = await analyzeFile({ question: "total?", file: { name: "حضور يوليو-1.xls", b64: "" }, llm: async () => "x",
    runPy: async (code) => { runs.push(code); return { ok: false, error: "Traceback (most recent call last):\n  File \"main.py\", line 3\nValueError: Excel file format cannot be determined\n" }; } });
  eq(r.why, "Could not open the file: ValueError: Excel file format cannot be determined", "the error's last REAL line is shown (not an empty one)");
  eq(runs[0].startsWith("import pandas as pd"), true, "every run on a file starts with the loader");
}

if (fails.length) { console.log(fails.length + " FAILED"); process.exit(1); } else console.log("ALL PASSED");
})();

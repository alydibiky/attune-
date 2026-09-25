// Unit tests for web-src/reason.js — voting, the checker, and file answers.
import { looksLikeReasoning, finalOf, normFinal, vote, reasonVote, presentable, analyzeFile, DATA_EXT, checkCorrection, readVerdict, numbersAgree } from "../../web-src/reason.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

(async () => {
eq(looksLikeReasoning("I have an empty glass on the kitchen counter. I place a marble inside it, turn the glass upside down, and carry it to the coffee table. Where is the marble? Walk through the physical steps."), true, "Ali's marble question is a reasoning question");
eq(looksLikeReasoning("What's the weather like in Cairo in March?"), false, "a plain question is not");
eq(finalOf("1. a\n2. b\nFINAL: On the kitchen counter."), "On the kitchen counter.", "the FINAL line is read");
eq(normFinal("On the kitchen counter."), "kitchen counter.", "finals are normalised (case, filler words)");
eq(vote(["On the kitchen counter", "the coffee table", "It stays on the counter in the kitchen"]), { best: 0, votes: 2, total: 3 }, "two of three agree (different words, same answer)");
eq(vote(["4 hours", "16 hours", "4 hours (in parallel)"]).votes, 2, "numeric answers agree by their numbers");
eq(vote(["the red box", "a blue bag", "one green cup"]).votes, 1, "all different → no majority");

// the pipeline with a scripted model
const wrong = "1. Put the marble in.\n2. Turn it over.\n3. Carry it.\nFINAL: on the coffee table";
const right = "1. Put the marble in.\n2. Turning the glass over, the marble falls out onto the counter.\n3. The empty glass is carried.\nFINAL: on the kitchen counter";
{
  const q = [right, right, "CORRECT"]; const asked = [];
  const r = await reasonVote({ question: "marble?", llm: async (m, o) => { asked.push(o.temperature); return q.shift(); } });
  eq([r.checked, r.votes, r.total, r.final], ["agreed", 2, 2, "on the kitchen counter"], "two agreeing tries stop early; the checker confirms");
  eq(r.text.startsWith("**on the kitchen counter**"), true, "the answer is shown first, in bold");
}
{
  const q = [wrong, wrong, right];
  const r = await reasonVote({ question: "marble?", llm: async () => q.shift() });
  eq([r.checked, r.final], ["corrected", "on the kitchen counter"], "a wrong majority is caught and corrected by the strict checker");
}
{
  const q = ["FINAL: A", "FINAL: B", "FINAL: C", "1. weigh\nFINAL: B"];
  const r = await reasonVote({ question: "x", llm: async () => q.shift() });
  eq([r.checked, r.total, r.final], ["judged", 3, "B"], "three different answers → weighed against each other");
}
eq(presentable("steps\nFINAL: 42"), "**42**\n\nsteps", "presentable: bold answer, then the steps");

// files
eq(["rfq.xlsx", "data.csv", "notes.txt", "a.json", "photo.jpg"].map((n) => DATA_EXT.test(n)), [true, true, true, true, false], "which files are analysed with Python");
{
  const calls = [];
  const runPy = async (code, files) => { calls.push({ code, files: files.map((f) => f.name) });
    if (code.includes("SHEET")) return { ok: true, stdout: "SHEET 'RFQ': 3 rows x 3 columns\nRFQ  Value  Status" };
    return code.includes("['valu']") ? { ok: false, error: "KeyError: 'valu'" } : { ok: true, stdout: "open value 250000\nANSWER: 250,000 EGP open" }; };
  const q = ["```python\nimport pandas as pd\ndf=pd.read_excel('rfq.xlsx')\nprint(df['valu'].sum())\n```",
             "```python\nimport pandas as pd\ndf=pd.read_excel('rfq.xlsx')\nprint('open value', df[df.Status=='Open']['Value'].sum())\nprint('ANSWER: 250,000 EGP open')\n```",
             "**250,000 EGP** is still open."];
  const asked = [];
  const r = await analyzeFile({ question: "total value of open RFQs?", file: { name: "rfq.xlsx", b64: "AA==" }, llm: async (m) => { asked.push(m); return q.shift(); }, runPy });
  eq([r.ok, r.answer], [true, "250,000 EGP open"], "a spreadsheet question is answered by a program run on the file");
  eq(asked[0][1].content.includes("SHEET 'RFQ'"), true, "…the model is shown the file's real sheets and columns first");
  eq(asked[1][asked[1].length - 1].content.includes("KeyError: 'valu'"), true, "…a wrong column name comes back as the real error and is fixed");
  eq(calls.every((c) => c.files[0] === "rfq.xlsx"), true, "…and every run gets the file");
}

// corrections are checked before they are learned
eq(readVerdict("VERDICT: **WRONG**\nREASON: The marble falls out.\nANSWER: kitchen counter"), { verdict: "wrong", reason: "The marble falls out.", answer: "kitchen counter" }, "a verdict is read");
eq([numbersAgree("250000 EGP", "It's 250,000"), numbersAgree("4 hours", "16 hours"), numbersAgree("impossible", "5")], [true, false, null], "computed vs corrected numbers");
{
  const q = ["VERDICT: WRONG\nREASON: Turned over, the marble falls out on the counter.\nANSWER: on the kitchen counter", "VERDICT: WRONG\nREASON: It falls out.\nANSWER: kitchen counter"];
  const r = await checkCorrection({ question: "marble?", was: "on the kitchen counter", corrected: "on the coffee table", llm: async () => q.shift() });
  eq([r.verdict, r.save, q.length], ["wrong", false, 0], "a wrong correction is NOT learned (two checks agree it is wrong)");
}
{
  const q = ["VERDICT: RIGHT\nREASON: ok\nANSWER: 12", "VERDICT: WRONG\nREASON: no\nANSWER: 8", "VERDICT: RIGHT\nREASON: A cube has 12 edges.\nANSWER: 12"];
  const r = await checkCorrection({ question: "cube edges?", was: "8", corrected: "12", llm: async () => q.shift() });
  eq([r.verdict, r.save, r.reason], ["right", true, "ok"], "checks disagree → a third decides; a right correction is learned");
}
{
  const r = await checkCorrection({ question: "what do I call it?", was: "outrigger pad", corrected: "crane mat", llm: async () => "VERDICT: PREFERENCE\nREASON: Your own naming.\nANSWER: crane mat" });
  eq([r.verdict, r.save], ["preference", true], "the person's own wording/facts are theirs to decide");
}
{
  const math = async () => ({ ok: true, answer: "40 km/h", code: "print('ANSWER: 40 km/h')" });
  const llm = async () => { throw new Error("should not be asked"); };
  const a = await checkCorrection({ question: "average speed?", was: "45 km/h", corrected: "40 km/h", llm, mathCheck: math });
  const b = await checkCorrection({ question: "average speed?", was: "40 km/h", corrected: "it's 45", llm, mathCheck: math });
  eq([a.verdict, a.how, a.save, b.verdict, b.save], ["right", "computed", true, "wrong", false], "maths corrections are checked by running a program");
}
console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
})();

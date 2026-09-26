// Unit tests for v5.14: follow-up detection, Assistants, Projects (knowledge
// matching), Artifacts (detection, versions), Themes (CSS variables).
import * as S from "../../web-src/spaces.js";
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- follow-ups (Ali: "What model" with Web on found dictionary pages) ----
eq(["What model", "how much?", "and in 2024?", "Is it better than the Grove one?", "طيب الموديل ده سعره كام؟"].map(S.looksLikeFollowUp), [true, true, true, true, true], "short or pointing-back messages are follow-ups");
eq(S.looksLikeFollowUp("What is the maximum lifting capacity of a Liebherr LTM 1100-4.2 at 20 metres radius"), false, "a complete question is searched as it is");

// ---- assistants ----
eq(S.loadAssistants().length >= 5 && S.loadAssistants().some((a) => a.id === "a-crane"), true, "built-in assistants are there");
const mine = S.upsertAssistant({ name: "Tender writer", instructions: "Formal clauses.", starters: ["Draft clause 1", ""] });
eq([S.loadAssistants()[0].name, mine.starters], ["Tender writer", ["Draft clause 1"]], "a custom assistant is saved first, empty starters dropped");
S.upsertAssistant({ ...mine, name: "Tender writer 2" });
eq(S.loadAssistants().filter((a) => a.id === mine.id).map((a) => a.name), ["Tender writer 2"], "editing keeps one copy");
S.deleteAssistant(mine.id);
eq(S.loadAssistants().some((a) => a.id === mine.id), false, "deleting removes it");
eq(S.isBuiltinAssistant("a-crane"), true, "built-ins can't be deleted (they are copied to edit)");

// ---- projects: only the matching knowledge goes to the model ----
const filler = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} about site safety meetings, toolbox talks and weekly inspections of rigging gear number ${i}.`).join("\n\n");
const p = S.upsertProject({ name: "Port Said", instructions: "Prices in EGP.", knowledge: [{ name: "notes.txt", text: filler }, { name: "rates.txt", text: "Rate card: LTM 1100 costs 18,000 EGP per day including operator and fuel." }] });
const k = S.knowledgeFor(p, "What is our daily rate for the LTM 1100?", 600);
eq(k[0] && k[0].doc, "rates.txt", "the passage that matches the question is picked from a large project");
eq(k.reduce((n, c) => n + c.text.length, 0) <= 600, true, "…within the budget");
const block = S.spaceBlock({ assistant: S.loadAssistants().find((a) => a.id === "a-crane"), project: p, question: "LTM 1100 daily rate" });
eq([block.includes('you are "Crane expert"'), block.includes("Prices in EGP."), block.includes("18,000 EGP per day")], [true, true, true], "the system block has the role, the project instructions and the knowledge");
eq(S.knowledgeFor({ knowledge: [{ name: "a", text: "short note" }] }, "anything").length, 1, "a small project is sent whole");
eq(S.chunks("a".repeat(2000), 900).length, 3, "long text without breaks is still split");

// ---- artifacts ----
const page = "Here:\n```html\n<!doctype html><html><head><title>Crane Simulator</title></head><body><h1>Hi</h1><script>1</script></body></html>\n```";
eq(S.detectArtifact(page) && [S.detectArtifact(page).kind, S.detectArtifact(page).title], ["html", "Crane Simulator"], "a web page in an answer is an artifact, titled from <title>");
eq(S.detectArtifact("```python\nprint(1)\n```"), null, "a short snippet is not");
eq(S.detectArtifact("```python\n" + Array.from({ length: 20 }, (_, i) => `x${i} = ${i}`).join("\n") + "\n```").kind, "code", "a real program is");
const doc = "# Lift plan\n\n## Scope\n" + "Lifting the generator onto the roof. ".repeat(30) + "\n\n## Steps\n1. Set up\n2. Rig\n3. Lift\n\n| Item | Weight |\n|---|---|\n| Generator | 12 t |\n";
eq(S.detectArtifact(doc) && [S.detectArtifact(doc).kind, S.detectArtifact(doc).title], ["doc", "Lift plan"], "a long structured answer is a document");
eq(S.detectArtifact("Yes, **18,000 EGP** per day."), null, "an ordinary answer is not an artifact");
const a1 = S.saveArtifact({ kind: "html", lang: "html", title: "Crane Simulator", content: "<p>1</p>" });
const a2 = S.saveArtifact({ id: a1.id, kind: "html", lang: "html", title: "Crane Simulator", content: "<p>2</p>" });
eq([a2.id === a1.id, a2.versions.length, S.latest(a2)], [true, 2, "<p>2</p>"], "saving again adds a version");
eq(S.saveArtifact({ id: a1.id, kind: "html", title: "Crane Simulator", content: "<p>2</p>" }).versions.length, 2, "an unchanged save adds nothing");
eq(S.fileNameFor({ title: "Crane Simulator", kind: "html" }), "Crane-Simulator.html", "a file name from the title");
eq(S.fileNameFor({ title: "خطة الرفع", kind: "doc" }), "خطة-الرفع.md", "…Arabic titles too");

// ---- themes ----
eq(Object.keys(S.themeVars({ accent: "teal", bg: "slate" })).length, 0, "the default theme changes nothing");
const v = S.themeVars({ accent: "violet", bg: "slate" });
eq(v["--color-teal-500"], S.PALETTES.violet["500"], "an accent theme points teal at the new colour");
const L = S.themeVars({ accent: "teal", bg: "light" });
eq([L["--color-slate-950"], L["--color-slate-100"], L["--color-teal-300"]], [S.PALETTES.slate["50"], S.PALETTES.slate["900"], S.PALETTES.teal["700"]], "light flips the scales: dark surfaces → light, light text → dark, accents deepen");
eq(S.themeVars({ bg: "black" })["--color-slate-950"], "#000000", "Black (OLED) makes the background truly black");
S.saveTheme({ accent: "rose", bg: "stone" });
eq(S.loadTheme(), { accent: "rose", bg: "stone" }, "the theme is remembered");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);

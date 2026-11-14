// tests/onemillion/REPORT.md from each part's own report (run.sh writes them). Every number comes from those files.
import fs from "fs";
const H = new URL("./", import.meta.url), S = process.env.SEED_SHIFT || "1";
const read = (f) => { try { return fs.readFileSync(new URL(f, H), "utf8"); } catch (e) { return ""; } };
const first = (t) => (t.split("\n")[0] || "").replace(/^#\s*/, "");
// [part, file, how many cases it is worth in the million, regex → [total, right]]
const P = [
  ["A1 · 100,000 hard sentences (new seed)", "A1-mega-s" + S + ".md", /—\s*(\d+) sentences, (\d+) right/],
  ["A2 · 100,000 chat orders (new seed)", "A2-chat-s" + S + ".md", /—\s*(\d+) orders, (\d+) right/],
  ["A3 · 100,000 sentences in 20 languages + Franco", fs.existsSync(new URL("A3-langs-s" + S + ".md", H)) ? "A3-langs-s" + S + ".md" : "A3-langs.md", /—\s*(\d+) sentences in 20 languages \+ Franco, (\d+) right/],
  ["B · every feature's own generator (new seed)", "B-features-s" + S + ".md", /: (\d+) of (\d+) right/, true],
  ["C · UI and UX checks", "C-uiux.md", /, (\d+) checks, (\d+) right/],
  ["D · answers by code vs the truth", fs.existsSync(new URL("D-answers-s" + S + ".md", H)) ? "D-answers-s" + S + ".md" : "D-answers.md", /—\s*(\d+) answers by code against the truth worked out separately: (\d+) right/],
  ["E · journeys in the real page", "E-flows.md", /—\s*(\d+) journeys in the real page, (\d+) right/],
];
let tot = 0, ok = 0, rows = "";
for (const [name, f, re, swap] of P) {
  const t = read(f), m = re.exec(first(t)); if (!m) { rows += `| ${name} | — | — | — | not run (${f}) |\n`; continue; }
  let [n, r] = [+m[1], +m[2]]; if (swap) [n, r] = [r, n];
  tot += n; ok += r; rows += `| ${name} | ${n.toLocaleString("en-US")} | ${r.toLocaleString("en-US")} | ${(100 * r / n).toFixed(3)}% | [${f}](${f}) |\n`;
}
const held = first(read("A3-langs-heldout" + (fs.existsSync(new URL("A3-langs-heldout-s" + S + ".md", H)) ? "-s" + S : "") + ".md"));
const model = first(read("../trials/langs-model.md"));
let md = `# The 1,000,000-case test — ${tot.toLocaleString("en-US")} cases, ${ok.toLocaleString("en-US")} right (${(100 * ok / Math.max(1, tot)).toFixed(3)}%)\n\n`;
md += `Every case is different and checked against an expectation written in the test (never "it didn't crash"). Each part's own report has every failure class with examples.\n\n| part | cases | right | % | report |\n|---|---|---|---|---|\n${rows}\n`;
md += `**Held-out** (phrasings written after the fixes): ${held || "not run"}\n\n**The AI model** (what code leaves to it, a real model on this machine): ${model || "see tests/trials/"}\n\n`;
md += read("FIXED.md");
fs.writeFileSync(new URL("REPORT.md", H), md);
console.log(md.split("\n\n**Held")[0]);

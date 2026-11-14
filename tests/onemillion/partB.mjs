// 1M test part B (TEST_1M.md): every feature's own generator run again with NEW cases (SEED_SHIFT moves each generator's seed, so
// none of these cases is one the feature was tuned on). Each generator checks its own details; this runner collects "right of total"
// from what it prints (JSON {pass, N} or its "x / y" line) and writes tests/onemillion/B-features.md.
//     SEED_SHIFT=1 node tests/onemillion/partB.mjs [parallel=3]
import { spawn } from "child_process";
import fs from "fs";
const SHIFT = process.env.SEED_SHIFT || "1", PAR = +(process.argv[2] || 3);
const root = new URL("../", import.meta.url).pathname;
const gens = fs.readdirSync(root).filter((d) => fs.existsSync(root + d + "/gen.mjs") && !["scenarios"].includes(d)).sort();
const run = (d) => new Promise((res) => { const t0 = Date.now(); let out = "";
  const p = spawn("node", [root + d + "/gen.mjs", d === "nag" ? "10000" : ""].filter(Boolean), { cwd: root + "..", env: { ...process.env, SEED_SHIFT: SHIFT } });
  p.stdout.on("data", (b) => (out += b)); p.stderr.on("data", (b) => (out += b));
  p.on("close", (code) => res({ d, code, out, s: Math.round((Date.now() - t0) / 1000) })); });
function score(out) {
  { const j0 = out.indexOf("{\n"); if (j0 >= 0) { try { const j = JSON.parse(out.slice(j0, out.lastIndexOf("}") + 1)); if (typeof j.pass === "number" && typeof j.N === "number") return { pass: j.pass, N: j.N, bad: j.bad }; } catch {} } }   // JSON over several lines (ainight)
  for (const line of out.trim().split("\n").reverse()) { try { const j = JSON.parse(line); if (j && typeof j.pass === "number" && typeof j.N === "number") return { pass: j.pass, N: j.N, bad: j.bad }; } catch {} }
  // "# Groups run — 10000 groups, 10000 right (100.00%)" · "300 saved agents, 300 without a fault" · "notifications 10000 · all right 9896"
  { const x = /(\d[\d,]*)\s+[\p{L}\s/-]{2,40}?,\s*(\d[\d,]*)\s+(?:right|without a fault|correct|pass(?:ed)?)\b/u.exec(out) || /(\d[\d,]*)\s*·\s*all right\s*(\d[\d,]*)/.exec(out);
    if (x) { const N = +x[1].replace(/,/g, ""), pass = +x[2].replace(/,/g, ""); if (N >= 1000 && pass <= N) return { pass, N }; } }
  // several groups, each "x / y" on its own "- **group**:" line (b5): their sum
  { const g = [...out.matchAll(/^- \*\*[^*]+\*\*:\s*(\d[\d,]*)\s*\/\s*(\d[\d,]*)/gm)].map((y) => [+y[1].replace(/,/g, ""), +y[2].replace(/,/g, "")]);
    if (g.length > 1) return { pass: g.reduce((a, y) => a + y[0], 0), N: g.reduce((a, y) => a + y[1], 0) }; }
  const m = [...out.matchAll(/(\d[\d,]*)\s*(?:\/|of)\s*(\d[\d,]*)\s*(?:right|pass|ok|correct|cases)?/gi)].map((x) => [+x[1].replace(/,/g, ""), +x[2].replace(/,/g, "")]).filter(([a, b]) => b >= 1000 && a <= b);
  if (m.length) { const [pass, N] = m.sort((x, y) => y[1] - x[1])[0]; return { pass, N }; }
  return null;
}
const results = []; let i = 0;
await Promise.all(Array.from({ length: PAR }, async () => { while (i < gens.length) { const d = gens[i++]; const r = await run(d); r.sc = score(r.out); results.push(r);
  console.log(d.padEnd(12), r.sc ? `${r.sc.pass}/${r.sc.N}` : "?? (code " + r.code + ")", r.s + "s"); } }));
results.sort((a, b) => a.d.localeCompare(b.d));
const tot = results.reduce((a, r) => a + (r.sc ? r.sc.N : 0), 0), ok = results.reduce((a, r) => a + (r.sc ? r.sc.pass : 0), 0);
let md = `# 1M part B — ${results.length} feature generators with new cases (SEED_SHIFT=${SHIFT}): ${ok} of ${tot} right (${(100 * ok / tot).toFixed(3)}%)\n\n| feature | cases | right | % | exit | seconds |\n|---|---|---|---|---|---|\n`;
for (const r of results) md += `| ${r.d} | ${r.sc ? r.sc.N : "?"} | ${r.sc ? r.sc.pass : "?"} | ${r.sc ? (100 * r.sc.pass / r.sc.N).toFixed(2) : "?"} | ${r.code} | ${r.s} |\n`;
md += "\n## Generators with anything wrong (their own words)\n";
for (const r of results) if (!r.sc || r.sc.pass < r.sc.N || r.code) md += `\n### ${r.d}\n\`\`\`\n${(r.sc && r.sc.bad ? JSON.stringify(r.sc.bad, null, 1) : r.out).slice(-2500)}\n\`\`\`\n`;
fs.writeFileSync(new URL("./B-features-s" + SHIFT + ".md", import.meta.url), md);
console.log(md.split("\n## Gen")[0]);

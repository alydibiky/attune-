// v9.0 (Ali: "at least 99 percent accurate — always testing it and fixing it"): the accuracy scoreboard. Every sentence of
// tests/bank/*.json goes through the same readers Chat uses (tests/bank/route.mjs); per area: right by code, left to the phone's
// model (the right kind is among its choices), wrong. node tools/accuracy.mjs [--show]
import fs from "fs";
import { route, grade } from "../tests/bank/route.mjs";
const DIR = new URL("../tests/bank/", import.meta.url).pathname, show = process.argv.includes("--show");
let all = { right: 0, model: 0, wrong: 0 };
const rows = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
  const bank = JSON.parse(fs.readFileSync(DIR + f, "utf8"));
  for (const [want, list] of Object.entries(bank)) {
    const c = { right: 0, model: 0, wrong: 0 }, wrong = [];
    for (const t of list) { const r = route(t), g = grade(r, want); c[g]++; all[g]++; if (g !== "right") wrong.push([g, t, r]); }
    rows.push([f.replace(".json", "") + " · " + want, c, wrong]);
  }
}
const pct = (c) => Math.round(((c.right + c.model) / Math.max(1, c.right + c.model + c.wrong)) * 1000) / 10;
for (const [k, c, w] of rows) { console.log(`${k.padEnd(26)} ${String(pct(c)).padStart(5)}%   code ${c.right} · model ${c.model} · wrong ${c.wrong}`);
  if (show) for (const [g, t, r] of w) console.log(`    ${g === "wrong" ? "✗" : "?"} ${t}  → ${JSON.stringify(r)}`); }
const n = all.right + all.model + all.wrong;
console.log(`\nALL ${n} sentences: ${pct(all)}% can be right · ${Math.round((all.right / n) * 1000) / 10}% right by code alone · ${all.wrong} wrong`);

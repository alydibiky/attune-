// v9.9.15: the scenario run (tests/scenarios/gen.mjs — sentences a person could type, through the mirror of Chat's decision order)
// stays above its mark. The full 10,000: bash tests/scenarios/run.sh
import { execFileSync } from "child_process";
const out = execFileSync("node", [new URL("../scenarios/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const m = /(\d+) sentences, (\d+) right \(([\d.]+)%\)/.exec(out) || [], pct = +m[3] || 0;
const row = (g) => { const r = new RegExp("\\| " + g + " \\| (\\d+) \\| (\\d+) \\|").exec(out); return r ? +r[2] : -1; };
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
ok(pct >= 94, "2,500 generated sentences: " + pct + "% handled right (the mark: 94%)");
for (const g of ["debt_en", "debt_ar", "income", "remind_en", "remind_ar", "calc", "questions_with_amounts", "spend_ar", "typos", "plan"]) ok(row(g) === 0, g + ": none wrong (" + row(g) + ")");

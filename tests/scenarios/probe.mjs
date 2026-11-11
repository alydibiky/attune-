// node tests/scenarios/probe.mjs "sentence" ["another"…] — what the mirror of Chat does with each sentence (for fixing misses)
import { classify, setCountry } from "./brain.mjs";
setCountry("EG");
for (const s of process.argv.slice(2)) { const r = classify(s, { both: true }); console.log(JSON.stringify(s), "→", r.k, r.only ? "only=" + r.only : "", r.unsure ? "unsure" : "", r.sub || "", r.pay ? JSON.stringify({ a: r.pay.amount, d: r.pay.direction }) : "", r.parts ? JSON.stringify(r.parts) : ""); }

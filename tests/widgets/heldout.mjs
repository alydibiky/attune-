// v10.5 the held-out run, written after the fixes: 10,000 more widget situations with other seeds (other days, hours, parts, orders).
import { run } from "./gen.mjs";
let right = 0, total = 0;
for (const s of [11, 12]) { const r = run(5000, s, { quiet: true }); right += r.right; total += r.total; for (const w of r.wrong.slice(0, 5)) console.log("  WRONG", JSON.stringify(w).slice(0, 400)); }
console.log(`widgets held-out: ${right} / ${total} (${(100 * right / total).toFixed(2)} %)`);

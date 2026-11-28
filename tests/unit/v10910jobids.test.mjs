// v10.9.10 (the Android audit of 28 Nov): BgRunJob.AGENTS was given 0x5c0b1 — AiNightJob's id. JobScheduler ids are one list per app:
// scheduling one replaced / stopped the other, and AiNight's cancel() cancelled the agents' round. Every job id must be different.
import { readFileSync, readdirSync } from "fs";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const dir = new URL("../../app/src/main/java/com/aldibiki/attune/", import.meta.url).pathname, seen = new Map();
for (const f of readdirSync(dir).filter((x) => x.endsWith(".kt"))) {
  const src = readFileSync(dir + f, "utf8");
  if (!/JobService|JobInfo\.Builder/.test(src)) continue;
  for (const m of src.matchAll(/(?:val|const val)\s+(\w+)\s*=\s*(0x[0-9a-fA-F]+|\d{4,})/g)) {
    const v = Number(m[2]); if (!/ID|AGENTS|SCOUT|JOB/.test(m[1])) continue;
    ok(!seen.has(v), `${f} ${m[1]} = ${m[2]}` + (seen.has(v) ? " — the same as " + seen.get(v) : "")); seen.set(v, f + " " + m[1]);
  }
}
ok(seen.size >= 6, "found the job ids: " + seen.size);
console.log(fail ? fail + " FAILED" : "ALL PASSED"); process.exit(fail ? 1 : 0);

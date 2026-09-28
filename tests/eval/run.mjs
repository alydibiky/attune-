// Scores the code reader (no model) and the repair of bad model answers against the measuring set.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
const F = { ...(await import("../../web-src/fit.js")), ...(await import("../../web-src/fitread.js")) };
const { MEALS, BAD_MODEL } = await import("./meals.mjs");
const verbose = process.argv.includes("-v");
function score(got, expect) {
  const used = new Set(); let found = 0, gramsOk = 0; const miss = [];
  for (const [ids, lo, hi] of expect) {
    const alts = ids.split("|");
    const k = got.findIndex((x, i) => !used.has(i) && alts.includes(x.id));
    if (k < 0) { miss.push(ids); continue; }
    used.add(k); found++;
    if (got[k].grams >= lo && got[k].grams <= hi) gramsOk++; else miss.push(`${ids} ${got[k].grams}g∉[${lo},${hi}]`);
  }
  const extra = got.filter((_, i) => !used.has(i)).map((x) => x.id || x.name);
  return { found, gramsOk, n: expect.length, extra, miss };
}
let F1 = 0, G = 0, N = 0, X = 0, perfect = 0; const bad = [];
for (const [text, expect] of MEALS) {
  const got = F.readMealText ? F.readMealText(text).items : F.quickParse(text);
  const s = score(got, expect);
  F1 += s.found; G += s.gramsOk; N += s.n; X += s.extra.length;
  if (s.gramsOk === s.n && !s.extra.length) perfect++; else bad.push(`${text}  →  ${got.map((x) => `${x.id || x.name}:${x.grams}`).join(", ") || "(nothing)"}   ✗ ${[...s.miss, ...s.extra.map((e) => "extra " + e)].join("; ")}`);
}
console.log(`CODE READER: ${MEALS.length} meals · foods found ${F1}/${N} (${Math.round(F1 / N * 100)}%) · right amount ${G}/${N} (${Math.round(G / N * 100)}%) · extra ${X} · fully right ${perfect}/${MEALS.length} (${Math.round(perfect / MEALS.length * 100)}%)`);
if (verbose) console.log(bad.join("\n"));
let bm = 0; const bmBad = [];
for (const c of BAD_MODEL) {
  const got = F.parseMealChecked ? F.parseMealChecked(c.raw) : F.parseMeal(c.raw);
  const s = score(got, c.expect);
  const ok = s.gramsOk === s.n && !s.extra.length && (!c.flagged || got.some((x) => x.flag));
  if (ok) bm++; else bmBad.push(`${c.what}: ${got.map((x) => `${x.id || x.name}:${x.grams}${x.flag ? "⚑" : ""}`).join(", ")} ✗ ${s.miss.join("; ")} ${s.extra.join(",")}`);
}
console.log(`BAD MODEL ANSWERS repaired: ${bm}/${BAD_MODEL.length}`);
if (verbose) console.log(bmBad.join("\n"));
const result = { found: F1 / N, grams: G / N, perfect: perfect / MEALS.length, bad: bm / BAD_MODEL.length };
// ---- the held-out set (never used for tuning) ----
const { HOLDOUT } = await import("./holdout.mjs");
let hf = 0, hg = 0, hn = 0, hp = 0; const hbad = [];
for (const [text, expect] of HOLDOUT) {
  const got = F.readMealText(text).items; const s = score(got, expect);
  hf += s.found; hg += s.gramsOk; hn += s.n;
  if (s.gramsOk === s.n && !s.extra.length) hp++; else hbad.push(`${text}  →  ${got.map((x) => `${x.id}:${x.grams}`).join(", ") || "(nothing)"}   ✗ ${[...s.miss, ...s.extra.map((e) => "extra " + e)].join("; ")}`);
}
console.log(`HELD-OUT (unseen): ${HOLDOUT.length} meals · foods found ${Math.round(hf / hn * 100)}% · right amount ${Math.round(hg / hn * 100)}% · fully right ${hp}/${HOLDOUT.length} (${Math.round(hp / HOLDOUT.length * 100)}%)`);
if (verbose) console.log(hbad.join("\n"));
result.holdout = hp / HOLDOUT.length;
export { result };
// ---- the third, blind set (v6.4) ----
const { BLIND } = await import("./blind.mjs");
let bp = 0, bf2 = 0, bn = 0; const bbad = [];
for (const [text, expect] of BLIND) {
  const got = F.readMealText(text).items; const s = score(got, expect);
  bf2 += s.found; bn += s.n;
  if (s.gramsOk === s.n && !s.extra.length) bp++; else bbad.push(`${text}  →  ${got.map((x) => `${x.id}:${x.grams}`).join(", ") || "(nothing)"}   ✗ ${[...s.miss, ...s.extra.map((e) => "extra " + e)].join("; ")}`);
}
console.log(`BLIND (v6.4): ${BLIND.length} meals · foods found ${Math.round(bf2 / bn * 100)}% · fully right ${bp}/${BLIND.length} (${Math.round(bp / BLIND.length * 100)}%)`);
if (verbose) console.log(bbad.join("\n"));
result.blind = bp / BLIND.length;
// ---- the fourth, fresh set (v6.4, written after the blind set was tuned) ----
const { FRESH } = await import("./fresh.mjs");
let fp = 0; const fbad = [];
for (const [text, expect] of FRESH) {
  const got = F.readMealText(text).items; const s = score(got, expect);
  if (s.gramsOk === s.n && !s.extra.length) fp++; else fbad.push(`${text}  →  ${got.map((x) => `${x.id}:${x.grams}`).join(", ") || "(nothing)"}   ✗ ${[...s.miss, ...s.extra.map((e) => "extra " + e)].join("; ")}`);
}
console.log(`FRESH (v6.4): ${FRESH.length} meals · fully right ${fp}/${FRESH.length} (${Math.round(fp / FRESH.length * 100)}%)`);
if (verbose) console.log(fbad.join("\n"));
result.fresh = fp / FRESH.length;

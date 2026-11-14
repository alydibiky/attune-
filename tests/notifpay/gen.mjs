// v9.9.18 AU7 — 10,000 sequences of taps on payment notifications (Paid · balance · Tomorrow · In 1 hour · Undo; double taps,
// unknown balances, the app opening in the middle), checked against an independent state machine: Money gets each payment EXACTLY
// once, from the balance tapped (or the only one), and Undo takes it out. All 30 countries' currencies.
import fs from "fs";
import { payButtons, applyTaps } from "../../web-src/notifpay.js";
import { COUNTRIES } from "../../web-src/country.js";
const N = +(process.argv[2] || 10000);
let seed = 20261113 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const CC = Object.keys(COUNTRIES), ACC = [["cash", "Cash"], ["cib", "CIB"], ["vfc", "Vodafone Cash"], ["nbe", "NBE"], ["stc", "STC Pay"]];
let ok = 0; const bad = {};
for (let i = 0; i < N; i++) {
  const cc = pick(CC), cur = COUNTRIES[cc].cur, nR = int(1, 3), pays = {}, rids = [];
  for (let k = 0; k < nR; k++) { const rid = "b" + i + "-" + k; rids.push(rid); const accs = ACC.slice(0, int(1, 4)).map(([id, name]) => ({ id, name }));
    pays[rid] = payButtons({ amount: pick([45, 320, 1200, 2500, 6240, 99.5, 0]), currency: cur, note: "Bill " + k, cat: "bills" }, accs); }
  // random taps
  const taps = []; let tid = 0, t0 = Date.parse("2026-11-11T09:00:00");
  for (let s = 0, S = int(1, 8); s < S; s++) {
    const rid = pick(rids), p = pays[rid], act = pick(["paid", "paid", "acct", "acct", "undo", "tomorrow", "hour", "dup"]);
    if (act === "dup" && taps.length) { taps.push({ ...pick(taps) }); continue; }
    const a = act === "dup" ? "paid" : act;
    taps.push({ id: "t" + (tid++), rid, act: a, acct: a === "acct" ? (rnd() < 0.85 ? pick(p.accounts).id : "ghost") : undefined, at: t0 + s * 60000 });
  }
  // the page opens between taps 0–3 times: apply in chunks, carrying the state
  let st = { seen: {}, paid: {} }, ledger = new Map(); const cut = new Set(Array.from({ length: int(0, 3) }, () => int(1, taps.length)));
  let chunk = [];
  const flush = () => { const r = applyTaps(chunk, pays, st, t0); st = r.state; for (const x of r.add) ledger.set(x.id, x); for (const x of r.remove) ledger.delete(x); chunk = []; };
  taps.forEach((t, j) => { chunk.push(t); if (cut.has(j + 1)) flush(); }); flush();
  // the oracle
  const seen = new Set(), paid = {}, waiting = {};
  for (const t of taps) { if (seen.has(t.id)) continue; seen.add(t.id); const p = pays[t.rid];
    if (t.act === "paid") { if (p.accounts.length <= 1) { if (!paid[t.rid] && p.amount > 0) paid[t.rid] = p.accounts[0].id; } else waiting[t.rid] = 1; }
    else if (t.act === "acct") { if (p.accounts.some((a) => a.id === t.acct) && !paid[t.rid] && p.amount > 0) paid[t.rid] = t.acct; }
    else if (t.act === "undo") delete paid[t.rid]; }
  const got = {}; for (const x of ledger.values()) { const rid = x.id.split("-").slice(1, 3).join("-"); got[rid] = got[rid] ? "TWICE" : x.account; if (x.currency !== cur) got[rid] = "CURRENCY"; if (x.amount !== pays[rid].amount) got[rid] = "AMOUNT"; }
  const why = JSON.stringify(Object.keys(paid).sort().map((k) => k + ":" + paid[k])) === JSON.stringify(Object.keys(got).sort().map((k) => k + ":" + got[k])) ? "" : "Money " + JSON.stringify(got) + " ≠ " + JSON.stringify(paid);
  if (why) (bad[why.replace(/b\d+-/g, "b-")] = bad[why.replace(/b\d+-/g, "b-")] || []).push(JSON.stringify(taps.map((t) => t.act + (t.acct ? ":" + t.acct : "") + "@" + t.rid.slice(-1)))); else ok++;
}
const s = `# Notification buttons run — ${N} tap sequences, ${ok} right (${(100 * ok / N).toFixed(2)}%)\n` + Object.entries(bad).slice(0, 12).map(([k, v]) => `\n- ✗ ${k} × ${v.length}: ${v[0]}`).join("") + "\n";
if (N === 10000) fs.writeFileSync(new URL(+process.env.SEED_SHIFT ? "../onemillion/B-notifpay-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), s);
console.log(s);

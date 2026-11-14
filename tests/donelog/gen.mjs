// v9.9.18 AU8 "Done for you" — 10,000 days of automatic actions with limits, Undo, Edit and "remember", checked against an independent
// model: the limits are never passed, Undo marks exactly that action, an edit changes only the editable fields, and a remembered change
// is applied ONLY to the same kind of action from the same source — in Arabic, English and the other 18 languages' shop / person names.
import fs from "fs";
import * as D from "../../web-src/donelog.js";
const N = +(process.argv[2] || 10000);
let seed = 20261114 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const SRC = ["talabat", "Talabat", "TALABAT ", "Seoudi", "سعودي", "سعودى", "Carrefour", "Uber", "أوبر", "Vodafone Cash", "Şok Market", "Мираторг", "Tokopedia", "Swiggy", "美团", "メルカリ", "쿠팡", "Grab", "Jumia", "Noon"];
const KINDS = ["money", "pot", "reminder", "close"], CATS = ["food", "groceries", "transport", "bills", "fun", "late food"], ACC = ["cash", "cib", "vfc"];
const same = (a, b) => String(a).toLowerCase().normalize("NFKC").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").trim() === String(b).toLowerCase().normalize("NFKC").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").trim();
let ok = 0; const bad = {};
const fail = (k, x) => { (bad[k] = bad[k] || []).push(x); };
for (let i = 0; i < N; i++) {
  let st = D.setLimits(D.empty(), { money: pick([500, 1000, 2000, 5000]), perDay: int(1, 12) }); const day = Date.parse("2026-11-11T08:00:00") + int(0, 300) * 864e5;
  let err = "", learnedModel = {};
  for (let s = 0, S = int(1, 25); s < S && !err; s++) {
    const now = day + s * 20 * 60000, op = pick(["do", "do", "do", "undo", "edit", "edit"]);
    if (op === "do") {
      const a0 = { kind: pick(KINDS), source: pick(SRC), amount: pick([45, 185, 600, 1500, 2500, 7000]), cat: pick(CATS), account: pick(ACC), what: "x" };
      const a = D.withLearned(st, a0);
      // the model: the learned change for exactly this kind + same source, nothing else
      const lk = Object.keys(learnedModel).find((k) => k.split("|")[0] === a0.kind && same(k.split("|")[1], a0.source));
      const want = lk ? { ...a0, ...learnedModel[lk] } : a0;
      if (["cat", "account", "note"].some((f) => (a[f] || "") !== (want[f] || ""))) { err = "a remembered change went to the wrong action"; break; }
      if (a.amount !== a0.amount) { err = "a remembered change touched the amount"; break; }
      const can = D.canDoAlone(st, a, now), used = st.log.filter((x) => !x.undone && new Date(x.at).toDateString() === new Date(now).toDateString()).length;
      const may = a.amount <= st.limits.money && used < st.limits.perDay;
      if (can.ok !== may) { err = "the limit check was wrong"; break; }
      if (can.ok) st = D.record(st, a, now).st;
    } else if (op === "undo") {
      const live = st.log.filter((x) => !x.undone); if (!live.length) continue; const e = pick(live);
      const r = D.undo(st, e.id); if (!r.entry || r.entry.id !== e.id || r.st.log.filter((x) => x.undone).length !== st.log.filter((x) => x.undone).length + 1) { err = "Undo marked the wrong thing"; break; } st = r.st;
      if (D.undo(st, e.id).entry) { err = "Undo twice did something"; break; }
    } else {
      const live = st.log.filter((x) => !x.undone); if (!live.length) continue; const e = pick(live);
      const patch = pick([{ cat: pick(CATS) }, { account: pick(ACC) }, { amount: e.amount + 10 }, { cat: pick(CATS), amount: 99 }, { id: "hack", at: 1 }]);
      const r = D.edit(st, e.id, patch), ne = r.st.log.find((x) => x.id === e.id);
      if (ne.id !== e.id || ne.at !== e.at) { err = "an edit changed the id or the time it was done"; break; }
      st = r.st;
      if (r.ask && rnd() < 0.7) { st = D.remember(st, e, r.remember); const k = e.kind + "|" + e.source; const lk = Object.keys(learnedModel).find((x) => x.split("|")[0] === e.kind && same(x.split("|")[1], e.source)) || k; learnedModel[lk] = { ...(learnedModel[lk] || {}), ...r.remember }; }
      if (r.remember && "amount" in r.remember) { err = "the amount was offered to remember"; break; }
    }
  }
  if (err) fail(err, i); else ok++;
}
const s = `# Done-for-you run — ${N} days, ${ok} right (${(100 * ok / N).toFixed(2)}%)\n` + Object.entries(bad).map(([k, v]) => `\n- ✗ ${k} × ${v.length}`).join("") + "\n";
if (N === 10000) fs.writeFileSync(new URL(process.env.SEED_SHIFT ? "../onemillion/B-donelog-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), s);
console.log(s);

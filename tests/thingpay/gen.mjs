// v10.1 T1 (Ali, 16 Nov 2026: "My things … can be linked to Money") — EXACTLY 10,000 things (a receipt's price, date, shop, name)
// over a made-up Money book with look-alikes: the same amount on another day, an amount 2% off, an income of that amount, a payment
// another thing already took, two purchases of the same price on the same day at different shops, a receipt with no date.
// Truth written HERE: the id of the payment that IS this purchase, or "" (not in Money / can't be sure — then nothing is linked).
//     node tests/thingpay/gen.mjs [n]      HELDOUT=1 → other shops, currencies and timings written after the code (heldout.mjs)
import fs from "fs";
const T = await import("../../web-src/things.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 7373 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 41 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const SHOPS = H ? H.shops : ["B.TECH", "Raya", "2B", "Carrefour", "Amazon", "noon", "Jumia", "Tradeline", "Spinneys", "Dream 2000"];
const THINGS = H ? H.things : ["Samsung TV 55", "Tornado washer", "Sharp fridge", "iPhone 15", "Philips air fryer", "Dell laptop", "Sony headphones", "Toshiba microwave"];
const NOW = Date.parse("2026-11-16T12:00:00"), iso = (t) => new Date(t).toISOString().slice(0, 10), D = 864e5;
const bad = {}; let pass = 0, made = 0; const kinds = {};
while (made < N) {
  const price = pick([int(800, 90000), int(800, 90000) + 0.99, Math.round(int(800, 90000) / 100) * 100 - 1]), bought = NOW - int(0, 300) * D, shop = pick(SHOPS), name = pick(THINGS);
  const kind = pick(["exact", "posted-later", "not-in-money", "lookalikes", "two-same-day", "no-date", "taken", "rounded"]);
  const txns = [], taken = []; let want = ""; let id = 0; const tx = (o) => { const x = { id: "t" + id++, type: "expense", cat: "other", note: "", ...o }; txns.push(x); return x; };
  for (let i = 0; i < int(3, 25); i++) tx({ amount: int(20, 5000), date: iso(NOW - int(0, 360) * D), note: pick(["lunch", "fuel", "Talabat", "pharmacy", "Uber"]) });
  const t = { name, store: shop, price, date: iso(bought) };
  if (kind === "exact") want = tx({ amount: price, date: iso(bought), note: pick([shop, "", "POS " + shop.toUpperCase()]) }).id;
  else if (kind === "posted-later") want = tx({ amount: price, date: iso(bought + int(1, 3) * D), note: pick(["CIB card", "", shop]) }).id;
  else if (kind === "rounded") want = tx({ amount: Math.round(price), date: iso(bought), note: shop }).id;
  else if (kind === "not-in-money") { tx({ amount: price, date: iso(bought + int(10, 60) * D), note: shop }); tx({ amount: Math.round(price * 1.03), date: iso(bought), note: shop }); tx({ type: "income", amount: price, date: iso(bought) }); }
  else if (kind === "lookalikes") { want = tx({ amount: price, date: iso(bought), note: pick([shop, name.split(" ")[0]]) }).id; tx({ amount: price, date: iso(bought + int(8, 90) * D), note: shop }); tx({ amount: Math.round(price * 0.97), date: iso(bought), note: shop }); tx({ type: "transfer", amount: price, date: iso(bought) }); }
  else if (kind === "two-same-day") { const other = pick(SHOPS.filter((s) => s !== shop)); const a = tx({ amount: price, date: iso(bought), note: other }), b = tx({ amount: price, date: iso(bought), note: shop }); want = b.id; if (rnd() < 0.3) { b.note = ""; a.note = ""; want = ""; } }
  else if (kind === "no-date") { t.date = ""; const d0 = NOW - int(1, 50) * D; if (rnd() < 0.6) want = tx({ amount: price, date: iso(d0), note: "" }).id; else { tx({ amount: price, date: iso(d0), note: "" }); tx({ amount: price, date: iso(d0 - int(1, 9) * D), note: "" }); } }
  else if (kind === "taken") { const a = tx({ amount: price, date: iso(bought), note: shop }); taken.push(a.id); if (rnd() < 0.5) want = tx({ amount: price, date: iso(bought + D), note: shop }).id; }
  // the shuffled book
  for (let i = txns.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [txns[i], txns[j]] = [txns[j], txns[i]]; }
  made++; kinds[kind] = (kinds[kind] || 0) + 1;
  const got = T.paymentFor(t, txns, taken, NOW);
  const why = got === want ? "" : !want ? "linked a payment that isn't this purchase" : !got ? "missed the real payment" : "linked the WRONG payment";
  if (why) { const k = why + " · " + kind; (bad[k] = bad[k] || []).push(JSON.stringify({ t, want, got })); } else pass++;
}
const md = `# My things ↔ Money — ${N} things, ${pass} right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""}\n\n` + Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(" · ") + "\n\n" + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 20).map(([k, v]) => `- **${k}** × ${v.length} — e.g. ${v[0].slice(0, 300)}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 4000));

// v9.9.33 (Ali's screenshot: "Huawei FreeClip 2 · Found one under your price: EGP 120" with a limit of 8,400; "I don't want Search now only —
// check while I am away … use much more websites, not just Amazon"). EXACTLY 10,000 different saved agents, each checked:
//   - a saved find / best / best-3 that is an accessory, or under 30 % of the limit, or under the gadget floor, is dropped on load
//   - a believable one is NEVER dropped
//   - a general search made with fewer stores gets every store of its country (10 in Egypt, Google Shopping last); a search tied to
//     one store keeps that store; a hotel window's dated tries are never touched
//   - the conversation names the store of each priced check and never sends the person to "Check now" any more
//     node tests/agents33/gen.mjs [count]
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const A = await import("../../web-src/agents.js");
const { storeTries } = await import("../../web-src/agent.js");
const TOTAL = +(process.argv[2] || 10000);
let seed = 33 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const PROD = [["Huawei FreeClip 2", 8400], ["iPhone 16 Pro", 75000], ["Samsung Galaxy S24", 45000], ["AirPods Pro 2", 12000], ["PS5 Slim", 30000], ["Kindle Paperwhite", 9000], ["JBL Flip 6", 7000], ["Xiaomi Redmi Note 13", 14000], ["Dyson V15", 40000], ["Apple Watch Series 10", 25000]];
const CUR = [["EGP", "EG", 1], ["SAR", "SA", 0.075], ["AED", "AE", 0.075]];
const ACC = ["case", "cover", "screen protector", "charger", "cable", "strap", "ear tips", "جراب"];
const seen = new Set(); let bad = 0, n = 0; const why = {};
const fail = (k, s) => { bad++; (why[k] = why[k] || []).push(s); };
while (n < TOTAL) {
  const [what, lim0] = pick(PROD), [cur, cc, k] = pick(CUR), below = Math.round(lim0 * k * (0.8 + rnd() * 0.5));
  const kind = pick(["ok", "ok", "acc", "cheap", "none"]), real = Math.round(below * (0.6 + rnd() * 0.5));
  const price = kind === "acc" ? Math.round(below * (0.4 + rnd() * 0.5)) : kind === "cheap" ? Math.max(1, Math.round(below * rnd() * 0.25)) : real;
  const name = kind === "acc" ? what + " " + pick(ACC) : what + pick(["", " (black)", " – 256GB", " original", " 2025"]);
  const all = storeTries(what, cc, "").map((l) => ({ url: l.url, site: l.site }));
  const tied = rnd() < 0.2, few = tied ? storeTries(what, cc, all[0].site) : all.slice(0, int(2, Math.min(3, all.length - 1)));
  const hotel = rnd() < 0.1;
  const tries = hotel ? [{ url: "https://www.booking.com/x", site: "Booking", checkin: "2026-12-01", checkout: "2026-12-05" }] : few.map((l) => ({ url: l.url, site: l.site }));
  const sid = what + cur + below + kind + price + name + tries.length + tied + hotel;
  if (seen.has(sid)) continue; seen.add(sid); n++;
  const a = { id: "ag" + n, kind: "watch", what, said: what, below, currency: cur, tries, ...(kind === "none" ? {} : { found: { price, at: 1, name }, best3: [{ price, name, site: "noon" }, { price: real, name: what, site: "B.TECH" }] }),
    checks: [{ at: 1, price: real, site: "B.TECH" }, { at: 2, blocked: true }, { at: 3, blocked: true }] };
  const b = A.recheckSaved(a), shouldDrop = kind === "acc" || kind === "cheap";
  if (kind !== "none") {
    if (shouldDrop && b.found) fail("kept a wrong find (" + kind + ")", name + " " + price + " of " + below);
    if (!shouldDrop && !b.found) fail("dropped a believable find", name + " " + price + " of " + below + " " + cur);
    if (shouldDrop && (b.best3 || []).some((o) => o.price === price && o.name === name)) fail("kept a wrong best-3 offer", name);
    if (!(b.best3 || []).some((o) => o.price === real)) fail("dropped the real offer from best-3", what + " " + real);
  }
  if (hotel && JSON.stringify(b.tries) !== JSON.stringify(a.tries)) fail("touched a hotel window's dated tries", what);
  if (!hotel && tied && b.tries.length !== a.tries.length) fail("a search tied to one store got more stores", what);
  if (!hotel && !tied && b.tries.length !== all.length) fail("a general search did not get every store", cc + " " + b.tries.length + "/" + all.length);
  if (!hotel && !tied && b.tries[b.tries.length - 1].site !== "Google Shopping") fail("Google Shopping is not last", cc);
  const chat = A.agentChat(b).map((m) => (m.T ? m.T[0] : m.text)).join("\n");
  if (/Check now/.test(chat)) fail("the conversation still says Check now", what);
  const priced = A.agentChat(b).find((m) => m.T && /^Checked: cheapest/.test(m.T[0]));
  if (priced && !/B\.TECH/.test(priced.T[1].d || "")) fail("a priced check does not name its store", JSON.stringify(priced.T));
}
console.log(`# Agents v9.9.33 — ${n} saved agents, ${n - bad} without a fault (${(100 * (n - bad) / n).toFixed(2)}%)`);
for (const [k, v] of Object.entries(why)) console.log(`- ${k} × ${v.length}: ${v.slice(0, 3).join(" · ")}`);
export const RESULT = { n, bad };

// v9.9.39 (Ali's phone, 14 Nov: "the agents page is still the same" — his Huawei FreeClips 2 BUY agent still searched "Amazon · noon"
// and said "Found one under your price: EGP 120" with a limit of 8,400): a saved buy agent gets the country's full store list and
// loses a too-cheap / accessory find, like the watch agents (v9.9.33).
const A = await import("../../web-src/agents.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const a = { id: "x", kind: "buy", on: true, what: "Huawei FreeClips 2", below: 8400, currency: "EGP", url: "https://www.amazon.eg/s?k=x", site: "Amazon · noon",
  tries: [{ url: "https://www.amazon.eg/s?k=Huawei+FreeClips+2", site: "Amazon" }, { url: "https://www.noon.com/egypt-en/search/?q=Huawei+FreeClips+2", site: "noon" }], step: "confirm",
  pending: { name: "Silicone case for Huawei FreeClip 2", price: 120, currency: "EGP" }, found: { price: 120, name: "Huawei FreeClip 2 case", at: 1 }, nearest: { name: "case", price: 120 }, checks: [{ at: 1, price: 120 }] };
const b = A.recheckSaved(a), sites = b.tries.map((x) => x.site);
ok(b.tries.length >= 8 && ["Amazon", "noon", "Jumia", "B.TECH", "2B"].every((s) => sites.includes(s)), "Egypt's whole list: " + sites.join(", "));
ok(b.site === b.tries.length + " stores", "the card says “" + b.site + "”");
ok(!b.found && !b.pending && !b.nearest && b.step === "search", "the EGP 120 'find' (a case) is gone and the agent keeps searching");
const st = { agents: [a] }; const c = A.loadAgents({ getItem: () => JSON.stringify(st) }).agents[0];
ok(c.tries.length === b.tries.length && !c.found, "…every time the agents load");
// a real offer under the limit stays; an agent tied to one store keeps it
const good = A.recheckSaved({ ...a, pending: { name: "HUAWEI FreeClip 2 Open-ear earbuds", price: 7900, currency: "EGP" }, found: undefined, nearest: undefined });
ok(good.pending && good.pending.price === 7900 && good.step === "confirm", "a real FreeClip 2 at EGP 7,900 stays waiting for your OK");
const one = A.recheckSaved({ ...a, site: "Amazon", tries: [{ url: "https://www.amazon.eg/s?k=x", site: "Amazon", checkin: true }] });
ok(one.tries.length === 1, "an agent you tied to one store keeps that store");
// a new buy agent with many stores
const d = A.parseAgent("buy me Huawei FreeClips 2 under 8400", { country: "EG" });
ok(d && d.kind === "buy" && /^\d+ stores$/.test(d.site) && d.tries.length >= 8, "a new buy agent: " + (d && d.site));
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);

// v6.16 — the public Knowledge packs install by themselves, and a newer published build replaces the old one.
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const K = await import("../../web-src/knowledge.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const kn = K.createKnowledge(K.memoryStore());
let built = "2026-10-10", asked = [];
const shard = (rows) => rows.map((r) => JSON.stringify(r)).join("\n");
const files = (b) => ({
  "know-world-v1": { "manifest.json": JSON.stringify({ id: "world", name: "World facts", built: b, license: "Public domain", shards: [{ name: "world-001.jsonl" }] }),
                     "world-001.jsonl": shard([{ t: "Egypt — Economy", x: "Egypt's currency is the Egyptian pound (EGP). Main exports include natural gas and cotton." }]) },
});
const packText = async (tag, name) => { asked.push(tag + "/" + name); const f = (files(built)[tag] || {})[name]; if (f == null) throw new Error("404"); return f; };
let got = await K.autoInstallPacks(kn, packText);
ok(got.map((c) => c.id).join() === "world", "a published pack installs by itself; one not published yet is skipped quietly");
const hits = await kn.find("What is Egypt's currency?");
ok(hits.length && /Egyptian pound/.test(hits[0].chunk.text), "and Chat's lookup finds the fact in it");
asked = []; got = await K.autoInstallPacks(kn, packText);
ok(got.length === 0 && !asked.some((a) => a.endsWith(".jsonl")), "an up-to-date pack is not downloaded again");
built = "2026-11-01"; got = await K.autoInstallPacks(kn, packText);
const srcs = (await kn.sources()).filter((s) => s.pack === "world");
ok(got.length === 1 && srcs.length === 1 && JSON.parse(mem["attune:knowledge:pack:world"]).built === "2026-11-01", "a newer build replaces the old one (no duplicates)");
console.log(fail ? `${fail} FAILED` : "v723knowauto ok");
process.exit(fail ? 1 : 0);

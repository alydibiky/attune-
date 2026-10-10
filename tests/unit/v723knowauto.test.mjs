// v6.16 — the public Knowledge packs: installed on the phone by themselves, newer builds replace old ones, the old in-page
// copies are removed, and a question is answered from your own sources and the packs ranked together.
const K = await import("../../web-src/knowledge.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const kn = K.createKnowledge(K.memoryStore());

// a phone with nothing installed; "numbers" and "quran" are published, the rest not yet
let phone = [], published = { numbers: "2026-10-10", quran: "2026-10-10", world: "2026-10-10" }, installs = [];
const native = {
  list: async () => phone.map((p) => ({ ...p })),
  remote: async (id) => { if (!published[id]) throw new Error("404"); return { id, built: published[id] }; },
  install: async (id) => { installs.push(id); phone = phone.filter((p) => p.id !== id).concat([{ id, built: published[id] }]); return { id }; },
};
// an old in-page copy of World facts (v6.16 before the phone packs)
await kn.store.putSource({ id: "pack:world:1", kind: "pack", pack: "world", title: "World facts · 1/1", added: 1, bytes: 10, chunks: 1 },
  [{ id: "pack:world:1#0", src: "pack:world:1", title: "Egypt — Economy", text: "Egypt's currency is the Egyptian pound.", kind: "pack" }]);
let got = await K.autoInstallPacks(kn, native);
ok(got.map((c) => c.id).sort().join() === "numbers,quran,world", "the published packs install by themselves; unpublished ones are skipped quietly: " + got.map((c) => c.id));
ok(!(await kn.sources()).some((s) => s.pack === "world"), "the old in-page copy of a pack is removed once the phone has it (no memory used twice)");
installs = []; got = await K.autoInstallPacks(kn, native);
ok(got.length === 0 && installs.length === 0, "an up-to-date pack is not downloaded again");
published.numbers = "2026-11-10"; got = await K.autoInstallPacks(kn, native);
ok(installs.join() === "numbers", "a newer monthly build replaces the old one");

// on mobile data a big pack waits for Wi-Fi
published.math = "2026-10-10"; const rem0 = native.remote;
native.remote = async (id) => (id === "math" ? { id, built: "2026-10-10", files: [{ bytes: 24e6 }] } : rem0(id));
installs = []; await K.autoInstallPacks(kn, native, { bigOk: false });
ok(!installs.includes("math"), "on mobile data a 24 MB pack waits for Wi-Fi");
installs = []; await K.autoInstallPacks(kn, native, { bigOk: true });
ok(installs.includes("math"), "on Wi-Fi it is fetched");

// a pack the app no longer offers (the old general "science" pack) leaves the phone
let removed = []; phone.push({ id: "science", built: "2026-10-10" }); native.remove = async (id) => { removed.push(id); phone = phone.filter((p) => p.id !== id); };
await K.autoInstallPacks(kn, native, { bigOk: true });
ok(removed.join() === "science" && !phone.some((p) => p.id === "science"), "a retired pack is removed from the phone (its subjects have their own packs now)");

// asking: your own note and the packs together
await kn.add({ kind: "text", title: "My crane notes", text: "Our Liebherr LTM 1100 needs its hook block inspected every month. The oil change is at 12,500 hours." });
let asked = [];
kn.packSearch = async (q) => { asked.push(q); return [
  { id: "numbers:7", pack: "numbers", title: "Japan — key figures (World Bank)", text: "Japan — latest figures from the World Bank: population: 124.0 million (2024); GDP: US$ 4.20 trillion (2023); inflation (consumer prices): 2.7% (2024).", url: "x" },
  { id: "health:3", pack: "health", title: "Health — Anemia", text: "Anemia is a condition in which you lack enough healthy red blood cells.", url: "y", notice: "General health information, not medical advice.", notice_ar: "معلومات صحية عامة." }]; };
let h = await kn.find("What is the population of Japan?");
ok(h.length && /124\.0 million/.test(h[0].chunk.text) && h[0].chunk.pack === "numbers", "a general question is answered from the phone's packs: " + (h[0] ? h[0].chunk.title : "nothing"));
h = await kn.find("when is the oil change for the Liebherr?");
ok(h.length && /12,500/.test(h[0].chunk.text), "your own notes still win for your own questions");
h = await kn.find("what is anemia?");
ok(h.length && h[0].chunk.note && /not medical advice/.test(K.factsBlock(h, "what is anemia?")), "a health passage carries its 'not medical advice' line into the answer");
ok(asked.length === 3, "the packs are searched on the phone for each lookup");
console.log(fail ? `${fail} FAILED` : "v723knowauto ok");
process.exit(fail ? 1 : 0);

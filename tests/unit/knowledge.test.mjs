// Knowledge (web-src/knowledge.js): store, chunking, retrieval, the prompt block, citation checking, adapters, packs.
import assert from "node:assert/strict";
import * as K from "../../web-src/knowledge.js";
import { FACTS } from "../trials/factpack-data.mjs";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// ---- chunking
const long = Array.from({ length: 30 }, (_, i) => `Paragraph ${i}. The pump number ${i} runs at ${100 + i} litres per minute and is serviced every ${i + 2} months.`).join("\n\n");
const parts = K.chunkSource({ text: long });
ok(parts.length > 3 && parts.every((p) => p.text.length <= 900), "long text is cut into passages of a few hundred characters");
ok(parts.map((p) => p.text).join(" ").includes("pump number 29"), "nothing is lost when cutting");
const pg = K.chunkSource({ pages: [{ n: 3, text: "Page three says the fee is 2%." }, { n: 4, text: "Page four is about insurance." }] });
ok(pg.length === 2 && pg[0].page === 3 && pg[1].page === 4, "PDF passages keep their page");
const sent = K.chunkSource({ text: "A".repeat(10) + ". " + "word ".repeat(400) + "end." });
ok(sent.length >= 2, "one very long paragraph is cut at sentence ends / size");

// ---- store + retrieval
const st = K.memoryStore();
let mind = [{ id: 1, ts: 5, title: "Car service", text: "The Toyota is serviced at Abu Ghaly garage every 10,000 km; the last service cost 3,400 EGP." },
            { id: 2, ts: 6, kind: "chat", title: "chat", text: "q", output: "an answer the app wrote" }];
const kn = K.createKnowledge(st, { adapters: [K.mindAdapter(() => mind, (r) => (r.output ? "answer" : "note"))] });
const src = await kn.add({ kind: "text", title: "Villa rules", text: "The villa pool opens at 8 am and closes at 10 pm.\n\nThe gate code for the villa is 4471. Guests must park in bay 12." });
ok(src.chunks >= 1 && src.bytes > 50 && src.id, "a pasted text is stored with its size and passage count");
ok((await kn.sources()).length === 1, "it is listed");
let h = await kn.find("What is the villa gate code?");
ok(h.length >= 1 && /4471/.test(h[0].chunk.text) && h[0].tag === "K1" && h[0].chunk.title === "Villa rules", "the right passage is found, with its source title and tag");
h = await kn.find("How much did the last car service cost?");
ok(h.length && /3,400/.test(h[0].chunk.text) && h[0].chunk.kind === "mind", "Mind notes are searched live through the adapter");
ok(!(await kn.find("an answer the app wrote")).some((x) => /app wrote/.test(x.chunk.text)), "the app's own chat answers are not treated as the person's facts");
mind = mind.concat([{ id: 3, ts: 7, title: "Dentist", text: "Dr Samir's clinic is on Road 9 in Maadi, phone 0100 555 1212." }]);
ok((await kn.find("Where is Dr Samir's clinic?")).some((x) => /Road 9/.test(x.chunk.text)), "a new Mind note is found without a manual rebuild");
ok((await kn.find("hi")).length === 0 && (await kn.find("thanks!")).length === 0, "chit-chat gets no facts");
ok((await kn.find("write me a poem about the sea")).length === 0, "a writing request gets no facts");
ok((await kn.find("What is the capital of France?")).length === 0, "an unrelated question gets nothing");
ok((await kn.find("ايه كود البوابة بتاع الفيلا؟")).length === 0 || true, "Arabic question over English text may miss (needs the embedder) — no crash");
await kn.remove(src.id);
ok((await kn.sources()).length === 0 && (await kn.find("What is the villa gate code?")).length === 0, "removing a source removes its passages from search");

// Arabic source, Arabic question
const ar = await kn.add({ title: "ملاحظات العمارة", text: "اجتماع اتحاد الملاك يوم الخميس الساعة ٨ مساءً في الدور الأرضي.\n\nاشتراك الأسانسير الشهري ٢٥٠ جنيه للشقة." });
h = await kn.find("اشتراك الأسانسير كام في الشهر؟");
ok(h.length && /٢٥٠/.test(h[0].chunk.text), "Arabic question finds an Arabic note (normalised words)");
await kn.remove(ar.id);

// ---- the 104-question fact set: retrieval quality and speed
const kf = K.createKnowledge(K.memoryStore());
const pack = [...new Set(FACTS.map((f) => f[1]))];
for (const [i, p] of pack.entries()) await kf.add({ id: "f" + i, title: "", text: p });
await kf.ensure();
let hit = 0, worst = 0;
for (const [, p, q, re] of FACTS) { const t = performance.now(); const r = await kf.find(q); worst = Math.max(worst, performance.now() - t); if (r.some((x) => x.chunk.text === p || re.test(x.chunk.text))) hit++; }
ok(hit >= 78, `the word index finds the right passage for most of the 104 questions (${hit})`);
ok(worst < 100, `each lookup takes well under 100 ms (${worst.toFixed(1)} ms)`);

// ---- prompt block
const hits = [{ tag: "K1", chunk: { title: "Villa rules", page: 0, text: "The gate code for the villa is 4471.", src: "s1" } }, { tag: "K2", chunk: { title: "Contract", page: 2, text: "Late fee is 2% per month.", src: "s2" } }];
const blk = K.factsBlock(hits, "gate code?");
ok(/Facts from your Knowledge/.test(blk) && /\[K1\] \(Villa rules\)/.test(blk) && /\[K2\] \(Contract, p\. 2\)/.test(blk), "the block lists every passage with its tag and source");
ok(/answer from them only/.test(blk) && /doesn't cover it/.test(blk) && /Question: $/.test(blk), "…says to use only these facts, to say when they don't answer, and ends before the question");
ok(K.factsBlock([], "x") === "", "no facts → no block");
ok(/معرفتك/.test(K.factsBlock(hits, "كود البوابة كام؟")), "an Arabic question gets the Arabic 'not covered' phrase");

// ---- citation checking
let c = K.checkFacts("The gate code is 4471 [K1]. The fee is 5% [K2]. Parking is free [K7].", hits);
ok(c.chips.length === 1 && c.chips[0].tag === "K1" && c.chips[0].title === "Villa rules", "only a claim its passage supports gets a chip (5% ≠ 2%)");
ok(!/\[K/.test(c.text) && c.removed === 1 && /4471/.test(c.text), "tags are taken out of the text; an invented tag is counted as removed");
c = K.checkFacts("The late fee is 2% per month [K1, K2].", hits);
ok(c.chips.map((x) => x.tag).join() === "K2", "a combined tag gives a chip only to the passage that matches");
c = K.checkFacts("The code to open the gate is 4471.", hits);
ok(c.chips.length === 1 && c.chips[0].tag === "K1", "no tags written: a sentence that clearly repeats a passage still gets its chip");
c = K.checkFacts("I don't know about that, sorry.", hits);
ok(c.chips.length === 0, "an answer that uses nothing gets no chip");
ok(K.supports("Pool opens at 8 am", { text: "The villa pool opens at 8 am" }), "supports(): shared number");

// ---- packs
const man = { id: "t", name: "Test pack", license: "CC BY-SA 4.0", shards: [{ name: "t-000.jsonl.gz" }, { name: "t-001.jsonl.gz" }] };
const files = { "t-000.jsonl.gz": JSON.stringify({ t: "Aswan High Dam", x: "The Aswan High Dam was completed in 1970.", u: "https://en.wikipedia.org/wiki/Aswan_Dam" }) + "\nnot json\n",
                "t-001.jsonl.gz": JSON.stringify({ t: "Suez Canal", x: "The Suez Canal opened in 1869 and is 193 km long." }) + "\n" };
const kp = K.createKnowledge(K.memoryStore()); let got = 0;
await K.installKnowPack(kp, { manifest: man, getText: async (nm) => { got++; return files[nm]; } });
ok((await kp.sources()).length === 2 && (await kp.sources()).every((s) => s.pack === "t" && s.license === "CC BY-SA 4.0"), "a pack installs one source per shard, with its licence");
h = await kp.find("When was the Aswan High Dam completed?");
ok(h.length && h[0].chunk.title === "Aswan High Dam", "pack passages are searched with their article title");
await K.installKnowPack(kp, { manifest: man, getText: async (nm) => { got++; return files[nm]; } });
ok(got === 2, "installing again skips shards already there (resumable)");
await K.removeKnowPack(kp, "t");
ok((await kp.sources()).length === 0, "a pack is removed as a whole");
ok(["world", "egy-laws", "numbers", "cities", "science", "health", "cranes", "quran", "fiqh", "hadith", "cars", "math", "physics", "chemistry", "biology", "history", "geography", "coding"].every((id) => K.CATALOG.some((p) => p.id === id)) && K.CATALOG.every((p) => p.name_ar && p.license && p.license_ar && p.size), "the catalogue: the 18 public packs, each with Arabic name, size and licence");
ok(!/wiki/i.test(JSON.stringify(K.CATALOG)), "no pack in the catalogue comes from Wikipedia (Ali's rule)");
ok(!/[A-Za-z]/.test(K.CATALOG.map((p) => p.name_ar + p.about_ar + p.license_ar + (p.notice_ar || "") + p.size_ar).join("")), "the catalogue's Arabic text has no Latin letters");

// the laws pack's warning travels with its passages, into the prompt and under the chips
const lawMan = { id: "egy-laws", name: "Egyptian laws (Arabic)", license: "MIT", shards: [{ name: "l-000.jsonl.gz" }] };
const kl = K.createKnowledge(K.memoryStore());
await K.installKnowPack(kl, { manifest: lawMan, getText: async () => JSON.stringify({ t: "قانون الإيجار — مادة 5", x: "قانون الإيجار — مادة 5: مدة الإنذار بالإخلاء ثلاثة أشهر قبل نهاية العقد." }) + "\n" });
h = await kl.find("مدة الإنذار بالإخلاء في قانون الإيجار كام؟");
ok(h.length && h[0].chunk.note && /official gazette/.test(h[0].chunk.note), "a laws passage carries the 'not legal advice' notice");
ok(/end the answer with this line: ليست استشارة قانونية/.test(K.factsBlock(h, "مدة الإنذار كام؟")), "the facts block asks the answer to end with the notice (in Arabic for an Arabic question)");
c = K.checkFacts("مدة الإنذار ثلاثة أشهر قبل نهاية العقد [K1].", h);
ok(c.chips.length === 1 && /official gazette/.test(c.chips[0].note), "the chip carries the notice so Chat shows it under the answer");

console.log(`knowledge: ${n} checks passed`);

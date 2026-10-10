// v6.16 — "Teach your model": chats, Markdown files, a folder or a .zip of notes become a named private pack that Chat looks
// things up in; a pack can be switched off, removed, and shared as one file another phone imports.
import { deflateRawSync } from "node:zlib";
const K = await import("../../web-src/knowledge.js");
const T = await import("../../web-src/teach.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const kn = K.createKnowledge(K.memoryStore());

// a chat → Q&A pages (tags and reasoning removed)
const chat = { id: "c1", title: "Crane maintenance", messages: [
  { role: "user", text: "How often do we change the hydraulic oil on the Liebherr LTM 1100?" },
  { role: "assistant", text: "<think>let me see</think>Every 2,000 operating hours or once a year, whichever comes first [K1]." },
  { role: "user", text: "And the hook block?" },
  { role: "assistant", text: "Inspect the hook block every month and replace it if the throat opening grew more than 5% [K2]." }] };
const cs = T.chatToSource(chat, "Crane workshop");
ok(cs.kind === "chat" && cs.pages.length === 2 && cs.pages[0].text.startsWith("Q: How often") && /A: Every 2,000 operating hours/.test(cs.pages[0].text) && !/\[K1\]|<think>/.test(cs.pages[0].text),
   "a chat becomes question-and-answer pages (tags and reasoning left out)");

// files: Markdown, a folder path, a .zip of notes, an unknown file
const file = (name, text, rel) => ({ name, webkitRelativePath: rel || "", text: async () => text, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
const zipOf = (entries) => {   // a tiny zip writer (deflated entries) for the test
  const parts = [], central = []; let off = 0;
  for (const [n, t] of entries) {
    const name = Buffer.from(n), raw = Buffer.from(t), data = deflateRawSync(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    parts.push(lh, name, data);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, name); off += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  const all = Buffer.concat([...parts, cd, end]);
  return { name: "notes.zip", arrayBuffer: async () => all.buffer.slice(all.byteOffset, all.byteOffset + all.length) };
};
const { sources, skipped } = await T.filesToSources([
  file("tadano.md", "# Tadano GR-1000 checklist\n\nCheck the outrigger pads before every lift. The max load at 10 m radius is 25.3 t."),
  file("notes.txt", "Site Zayed: gate code 4471, crane pad on the north side.", "My notes/site/notes.txt"),
  zipOf([["Workshop/oil.md", "# Oil schedule\n\nEngine oil every 500 hours."], ["Workshop/.DS_Store", "x"], ["__MACOSX/Workshop/._oil.md", "x"], ["Workshop/photo.jpg", "binary"]]),
  file("scan.pdf", "%PDF"),
], "Crane workshop");
ok(sources.length === 3 && sources[0].title === "Tadano GR-1000 checklist" && sources.some((s) => s.title === "Oil schedule" && s.file === "Workshop/oil.md") && sources.some((s) => s.file === "My notes/site/notes.txt"),
   "many files, a folder and a .zip of notes are read (titles from the Markdown heading); hidden files left out: " + sources.map((s) => s.title));
ok(skipped.includes("Workshop/photo.jpg") && skipped.includes("scan.pdf"), "files that aren't text are reported, not silently lost (a PDF goes to the page's own reader)");

// teach → one pack, then Chat finds it
let r = await T.teach(kn, [cs, ...sources]);
ok(r.added === 4 && r.passages >= 4, "four sources taught: " + JSON.stringify(r));
let packs = await T.myPacks(kn);
ok(packs.length === 1 && packs[0].name === "Crane workshop" && packs[0].chats === 1 && packs[0].files === 3, "the pack is listed with its chats and files");
let h = await kn.find("how often do we change the hydraulic oil on the LTM 1100?");
ok(h.length && /2,000 operating hours/.test(h[0].chunk.text), "Chat finds the answer from a taught chat");
h = await kn.find("what is the gate code at site Zayed?");
ok(h.length && /4471/.test(h[0].chunk.text), "…and from a taught file");
r = await T.teach(kn, [T.chatToSource(chat, "Crane workshop")]);
ok((await kn.sources()).filter((s) => s.kind === "chat").length === 1, "teaching the same chat again replaces it (no duplicates)");

// switch off, share, remove
kn.offPacks = new Set(["Crane workshop"]); kn.invalidate();
ok((await kn.find("what is the gate code at site Zayed?")).length === 0, "a switched-off pack is not looked up");
kn.offPacks = new Set(); kn.invalidate();
const shared = await T.exportPack(kn, "Crane workshop");
ok(shared.format === "attune-knowledge-1" && shared.sources.length === 4 && shared.sources.some((s) => s.kind === "chat" && s.pages.length === 2), "a pack is exported as one file");
const other = K.createKnowledge(K.memoryStore());
const imp = T.importPack(JSON.stringify(shared));
await T.teach(other, imp.sources);
ok((await T.myPacks(other))[0].name === "Crane workshop" && /4471/.test(((await other.find("what is the gate code at site Zayed?"))[0] || { chunk: {} }).chunk.text || ""), "another phone imports it and can ask it");
let threw = false; try { T.importPack("{\"hello\":1}"); } catch (e) { threw = /isn't an Attune knowledge pack/.test(e.message); }
ok(threw, "a wrong file is refused with a clear message");
await T.removePack(kn, "Crane workshop");
ok((await T.myPacks(kn)).length === 0 && (await kn.find("what is the gate code at site Zayed?")).length === 0, "removing a pack removes all of it");
console.log(fail ? `${fail} FAILED` : "v727teach ok");
process.exit(fail ? 1 : 0);

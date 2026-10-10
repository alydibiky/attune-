// v6.16 — "Teach your model" (Ali): people give the app their own material — their chats, Markdown / text files, a folder or a
// .zip of notes — and it becomes a private knowledge pack on the phone that Chat looks things up in, like the public packs.
// Nothing retrains the model's weights (too heavy for a phone, and it makes models forget or invent); the model reads the
// person's material at answer time, the way "your files" work in the big assistants. A pack is a named collection of
// sources; it can be switched off, removed, or shared as one file another phone imports.
import { unzip } from "./convert.js";

const T = (s) => String(s || "");
/** Strip what isn't knowledge from an answer: the [K1] tags, "(stopped)", reasoning blocks. */
const cleanAnswer = (s) => T(s).replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\s?\[\s*K\d+(?:\s*,\s*K?\d+)*\s*\]/g, "").replace(/\s*…\(stopped\)$/, "").trim();

/**
 * A chat → a knowledge source: each question with its answer is one "page", so a lookup never finds half an answer.
 * chat: { id, title, messages: [{ role: "user" | "assistant", text }] }
 */
export function chatToSource(chat, collection = "") {
  const pages = []; let q = null, n = 0;
  for (const m of (chat && chat.messages) || []) {
    const text = m.role === "assistant" ? cleanAnswer(m.text) : T(m.text).trim();
    if (!text) continue;
    if (m.role === "user") { if (q) pages.push({ n: ++n, text: "Q: " + q }); q = text; }
    else if (m.role === "assistant") { pages.push({ n: ++n, text: (q ? "Q: " + q + "\n\n" : "") + "A: " + text }); q = null; }
  }
  if (q) pages.push({ n: ++n, text: "Q: " + q });
  return { id: "chat:" + (chat && chat.id ? chat.id : Date.now().toString(36)), kind: "chat", title: T(chat && chat.title) || "Chat", pages, collection };
}

const TEXT_EXT = /\.(md|markdown|txt|text|csv|json|ya?ml|html?|rst|org|tex|log|py|js|ts|jsx|tsx|kt|java|c|cpp|h|cs|go|rs|rb|php|sql|sh)$/i;
/** A Markdown file's title: its first "# heading", else the file name. */
export const mdTitle = (name, text) => { const m = /^\s*#\s+(.+)$/m.exec(T(text)); return (m ? m[1].trim() : T(name).split("/").pop().replace(/\.[^.]+$/, "")) || "Note"; };

/**
 * Many files at once (several picked, a whole folder, or a .zip of notes) → sources. Text-like files are read here; any other
 * file (PDF, Word…) goes to `readOther` (the Knowledge page's own reader). Each file is one source in the collection.
 * files: [{ name, text?() , arrayBuffer?(), webkitRelativePath? }]
 */
export async function filesToSources(files, collection = "", readOther = null) {
  const out = [], skipped = [];
  for (const f of files || []) {
    const name = T(f.webkitRelativePath || f.name);
    if (/(^|\/)\.|__MACOSX/.test(name)) continue;                       // hidden files and Mac zip leftovers
    try {
      if (/\.zip$/i.test(name)) {
        const entries = await unzip(new Uint8Array(await f.arrayBuffer()));
        for (const [n, bytes] of entries) {
          if (/\/$/.test(n) || /(^|\/)\.|__MACOSX/.test(n) || !TEXT_EXT.test(n)) { if (!/\/$/.test(n)) skipped.push(n); continue; }
          const text = new TextDecoder("utf-8").decode(bytes);
          if (text.trim()) out.push({ id: "file:" + collection + ":" + n, kind: "file", title: mdTitle(n, text), text, collection, file: n });
        }
      } else if (TEXT_EXT.test(name)) {
        const text = await f.text();
        if (text.trim()) out.push({ id: "file:" + collection + ":" + name, kind: "file", title: mdTitle(name, text), text, collection, file: name });
      } else if (readOther) {
        const s = await readOther(f);
        if (s) out.push({ ...s, id: "file:" + collection + ":" + name, collection, file: name });
      } else skipped.push(name);
    } catch (e) { skipped.push(name); }
  }
  return { sources: out, skipped };
}

/** Adds sources to Knowledge in one collection; a source with the same id (the same file or chat again) is replaced. */
export async function teach(K, sources, onProgress) {
  const have = new Set((await K.sources()).map((s) => s.id));
  let added = 0, passages = 0;
  for (const [i, s] of (sources || []).entries()) {
    if (have.has(s.id)) await K.remove(s.id);
    try { const r = await K.add(s); added++; passages += r.chunks || 0; } catch (e) { /* empty file: skipped */ }
    if (onProgress) onProgress(i + 1, sources.length);
  }
  return { added, passages };
}

/** The person's own packs (collections) with their sizes, newest first. */
export async function myPacks(K) {
  const by = new Map();
  for (const s of await K.sources()) {
    if (!s.collection) continue;
    const p = by.get(s.collection) || { name: s.collection, sources: 0, chunks: 0, bytes: 0, chats: 0, files: 0, added: 0 };
    p.sources++; p.chunks += s.chunks || 0; p.bytes += s.bytes || 0; p.added = Math.max(p.added, s.added || 0);
    if (s.kind === "chat") p.chats++; else p.files++;
    by.set(s.collection, p);
  }
  return [...by.values()].sort((a, b) => b.added - a.added);
}

export async function removePack(K, name) {
  for (const s of await K.sources()) if (s.collection === name) await K.remove(s.id);
}

/** A pack as one shareable file: { format: "attune-knowledge-1", name, sources: [{ title, kind, text | pages }] }. */
export async function exportPack(K, name) {
  const srcs = (await K.sources()).filter((s) => s.collection === name);
  const all = await K.store.chunks();
  const sources = srcs.map((s) => {
    const parts = all.filter((c) => c.src === s.id).sort((a, b) => Number(a.id.split("#")[1]) - Number(b.id.split("#")[1]));
    return s.kind === "chat" || s.pages ? { title: s.title, kind: s.kind, pages: parts.map((c, i) => ({ n: c.page || i + 1, text: c.text })) }
      : { title: s.title, kind: s.kind, text: parts.map((c) => c.text).join("\n\n") };
  });
  return { format: "attune-knowledge-1", name, made: new Date().toISOString().slice(0, 10), sources };
}

/** A shared pack file → its sources, ready for teach(); a wrong file says so. */
export function importPack(json, asName = "") {
  let j; try { j = typeof json === "string" ? JSON.parse(json) : json; } catch (e) { throw new Error("That isn't an Attune knowledge pack file."); }
  if (!j || j.format !== "attune-knowledge-1" || !Array.isArray(j.sources)) throw new Error("That isn't an Attune knowledge pack file.");
  const name = T(asName || j.name || "Shared pack").slice(0, 60);
  return { name, sources: j.sources.filter((s) => s && (s.text || (s.pages && s.pages.length))).map((s, i) => ({
    id: "shared:" + name + ":" + i, kind: s.kind === "chat" ? "chat" : "file", title: T(s.title) || "Note", collection: name,
    ...(s.pages ? { pages: s.pages.map((p, k) => ({ n: p.n || k + 1, text: T(p.text) })) } : { text: T(s.text) }) })) };
}

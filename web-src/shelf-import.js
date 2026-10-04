/* ---- v6.12: bring notes from another notes app into Shelf, easily ---------------------------------------------------------
   Ali: "make me import notebook notes into shelf easily". The phone's Notebook app shares a note as text, as a document or
   as a picture; Google Keep exports .json/.html (Takeout); Evernote exports .enex; many apps export a .zip of .txt/.md.
   This reads all of them into plain notes { title, text, created } — the screen turns them into Shelf notes.
   Pure logic (zip/docx readers are passed in); tests: tests/unit/v705shelfimport.test.mjs.                               */

const clean = (s) => String(s || "").replace(/\r\n?/g, "\n").replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const baseName = (n) => String(n || "").split("/").pop().replace(/\.[a-z0-9]+$/i, "");
const unhtml = (h) => clean(String(h || "")
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
  .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li|tr|en-todo)>/gi, "\n").replace(/<li[^>]*>/gi, "- ")
  .replace(/<en-todo[^>]*checked="true"[^>]*\/?>/gi, "[x] ").replace(/<en-todo[^>]*\/?>/gi, "[ ] ")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&"))
  .replace(/^\[( |x)\] /gm, (m, x) => `- [${x}] `);
/** A title from the first line when the note has none (cut at 60 characters). */
export function titleOf(text, fallback = "") {
  const first = clean(text).split("\n").find((l) => l.trim()) || "";
  const t = first.replace(/^#+\s*/, "").replace(/^[-*]\s+(\[[ x]\]\s*)?/, "").trim();
  return (t.length > 60 ? t.slice(0, 57).replace(/\s+\S*$/, "") + "…" : t) || fallback;
}

/** A note whose title is its first line: the line is not repeated in the body. */
const firstLineNote = (p, fallbackTitle) => {
  const lines = clean(p).split("\n"), first = (lines[0] || "").replace(/^#+\s*/, "").trim();
  if (first && first.length <= 60 && lines.length > 1) return { title: first, text: clean(lines.slice(1).join("\n")) };
  return { title: titleOf(p, fallbackTitle), text: clean(p) };
};
/**
 * Pasted or shared text → notes. Several notes are told apart by "## heading" sections, or by separator lines
 * (---, ***, ===, ___), or by 3+ empty lines; otherwise it is ONE note (its first line is the title).
 */
export function notesFromText(text, fallbackTitle = "") {
  const t = clean(String(text || "").replace(/\r\n?/g, "\n").replace(/\n[ \t]*\n[ \t]*\n[ \t]*\n+/g, "\n\n---\n\n"));
  if (!t) return [];
  const heads = t.split(/^##\s+/m);
  if (heads.length > 1) {
    const out = [];
    const lead = clean(heads[0].replace(/^#\s+.*\n?/, ""));
    if (lead) out.push(firstLineNote(lead, fallbackTitle));
    for (const p of heads.slice(1)) { const [h, ...rest] = p.split("\n"); out.push({ title: h.trim(), text: clean(rest.join("\n")) }); }
    return out;
  }
  const parts = t.split(/^\s*(?:-{3,}|\*{3,}|={3,}|_{3,})\s*$/m).map(clean).filter(Boolean);
  if (parts.length > 1) return parts.map((p) => firstLineNote(p, fallbackTitle));
  const one = t.replace(/^#\s+(.+)\n+/, "");
  const h1 = /^#\s+(.+)/.exec(t);
  if (h1) return [{ title: h1[1].trim(), text: clean(one) }];
  return [fallbackTitle && t.length > 400 ? { title: fallbackTitle, text: t } : firstLineNote(t, fallbackTitle)];
}

/** Google Keep (Takeout) note JSON → a note, or null for a trashed one. */
export function keepJson(j, name = "") {
  if (!j || typeof j !== "object" || j.isTrashed) return null;
  const list = Array.isArray(j.listContent) ? j.listContent.map((x) => `- [${x.isChecked ? "x" : " "}] ${x.text || ""}`).join("\n") : "";
  const text = clean([j.textContent || "", list].filter(Boolean).join("\n\n"));
  if (!text && !j.title) return null;
  const created = j.createdTimestampUsec ? Math.round(+j.createdTimestampUsec / 1000) : j.userEditedTimestampUsec ? Math.round(+j.userEditedTimestampUsec / 1000) : undefined;
  return { title: String(j.title || "").trim() || titleOf(text, baseName(name)), text, ...(created ? { created } : {}), ...(Array.isArray(j.labels) && j.labels.length ? { tags: j.labels.map((l) => l.name).filter(Boolean) } : {}) };
}

/** Evernote .enex → notes. */
export function enexNotes(xml) {
  const out = [];
  for (const m of String(xml || "").matchAll(/<note>([\s\S]*?)<\/note>/g)) {
    const n = m[1], title = ((/<title>([\s\S]*?)<\/title>/.exec(n) || [])[1] || "").trim();
    const content = (/<content>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/content>/.exec(n) || [])[1] || "";
    const c = /<created>(\d{8})T(\d{6})Z<\/created>/.exec(n);
    const created = c ? Date.UTC(+c[1].slice(0, 4), +c[1].slice(4, 6) - 1, +c[1].slice(6, 8), +c[2].slice(0, 2), +c[2].slice(2, 4), +c[2].slice(4, 6)) : undefined;
    const text = unhtml(content.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, ""));
    if (title || text) out.push({ title: unhtml(title) || titleOf(text), text, ...(created ? { created } : {}) });
  }
  return out;
}

/** A web page / Keep .html note → a note. */
export function htmlNote(html, name = "") {
  const h = String(html || "");
  const keepTitle = (/<div class="title">([\s\S]*?)<\/div>/.exec(h) || [])[1];
  const keepBody = (/<div class="content">([\s\S]*?)<\/div>\s*(?:<div class="(?:labels|attachments|listitem)|<\/div>\s*<\/body>|$)/.exec(h) || [])[1];
  const title = unhtml(keepTitle || (/<title>([\s\S]*?)<\/title>/i.exec(h) || [])[1] || (/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(h) || [])[1] || "");
  const body = unhtml(keepBody != null ? keepBody : ((/<body[^>]*>([\s\S]*)<\/body>/i.exec(h) || [])[1] || h));
  if (!body && !title) return null;
  return { title: title || titleOf(body, baseName(name)), text: body.replace(new RegExp("^" + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\n"), "") };
}

export const IMPORT_ACCEPT = ".txt,.md,.markdown,.html,.htm,.json,.enex,.docx,.pdf,.rtf,.odt,.zip,text/plain,text/markdown,text/html,application/json,application/pdf,application/zip,image/*";
export const isImage = (name, type = "") => /^image\//.test(type) || /\.(jpe?g|png|webp|heic|gif)$/i.test(String(name || ""));

/**
 * One file → notes. bytes: Uint8Array. tools: { unzip(bytes) → Map(name → Uint8Array), docxRead, blocksToText, odtToBlocks, rtfToText, pdfText(b64) }.
 * Pictures are not read here (the screen keeps each as a note with the photo).
 */
export async function notesFromFile(name, bytes, tools = {}, depth = 0) {
  const n = String(name || "").toLowerCase(), dec = (b) => new TextDecoder("utf-8").decode(b);
  if (/\.zip$/.test(n) && tools.unzip && depth < 2) {
    const z = await tools.unzip(bytes), out = [];
    for (const [k, v] of z) { if (/\/$|__MACOSX|\.DS_Store/.test(k) || !v || !v.length) continue; if (isImage(k)) continue; try { out.push(...(await notesFromFile(k, v, tools, depth + 1))); } catch (e) {} }
    return out;
  }
  if (/\.json$/.test(n)) { try { const j = JSON.parse(dec(bytes)); const arr = Array.isArray(j) ? j : Array.isArray(j.notes) ? j.notes : [j]; return arr.map((x) => keepJson(x, name)).filter(Boolean); } catch (e) { return []; } }
  if (/\.enex$/.test(n)) return enexNotes(dec(bytes));
  if (/\.html?$/.test(n)) { const x = htmlNote(dec(bytes), name); return x ? [x] : []; }
  if (/\.docx$/.test(n) && tools.docxRead) { const rd = await tools.docxRead(bytes); const t = tools.blocksToText(rd.blocks); return notesFromText(t, baseName(name)).map((x, i, a) => (a.length === 1 ? { ...x, title: x.title || baseName(name) } : x)); }
  if (/\.odt$/.test(n) && tools.odtToBlocks) return notesFromText(tools.blocksToText(await tools.odtToBlocks(bytes)), baseName(name));
  if (/\.rtf$/.test(n) && tools.rtfToText) return notesFromText(tools.rtfToText(dec(bytes)), baseName(name));
  if (/\.pdf$/.test(n)) {
    if (!tools.pdfText) throw new Error("PDFs are read in the Android app");
    let b = ""; for (let i = 0; i < bytes.length; i += 0x8000) b += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const r = await tools.pdfText(btoa(b)); const t = clean((r.pages || []).map((p) => p.text).join("\n\n"));
    return t ? [{ title: baseName(name), text: t }] : [];
  }
  if (/\.(txt|md|markdown|text)$/.test(n) || !/\.[a-z0-9]{2,5}$/.test(n)) return notesFromText(dec(bytes).replace(/^﻿/, ""), baseName(name));
  return [];
}

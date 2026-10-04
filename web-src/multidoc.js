/* ---- v6.12: several files and photos in one chat message -------------------------------------------------------------------
   Ali: "make me attach more than 1 pdf or file or photo to the chats". The chat held one photo and one file.
   - Photos: up to MAX_PHOTOS; the model gets ONE picture — the photos side by side, each with its number — so it works on
     every engine (both engines take one picture per message); the chat shows each photo.
   - Files: every document is read into pages ("contract.pdf p. 3"); when they fit the model's window they go in whole,
     otherwise the passages that match the question are picked (docqa.js), each with its file and page; a summary of
     something too big is read in parts by the chat's long-read path.
   Pure logic + small browser helpers; tests: tests/unit/v704multidoc.test.mjs.                                          */
import * as Q from "./docqa.js";

export const MAX_PHOTOS = 6;
export const MAX_FILES = 8;

/** Where pages come from: each document's pages, one global list with labels. docs = [{ name, pages:[{n, text}] }] */
export function globalPages(docs) {
  const out = [];
  for (const d of docs || []) for (const p of d.pages || []) if (String(p.text || "").trim()) out.push({ n: out.length + 1, text: String(p.text), file: d.name, page: p.n, label: `${d.name}${(d.pages || []).length > 1 ? ` p. ${p.n}` : ""}` });
  return out;
}

/**
 * The files → the text the model reads with the question.
 *   { text, picked } — `picked` true when only the passages matching the question were kept (the rest did not fit).
 * Each part starts with a header the model can cite: "[contract.pdf p. 3]".
 */
export function docsContext(docs, question, budget = 9000) {
  const pages = globalPages(docs);
  const whole = pages.map((p) => `[${p.label}]\n${p.text.trim()}`).join("\n\n");
  const names = (docs || []).map((d) => d.name);
  const head = `The user attached ${names.length} file${names.length === 1 ? "" : "s"}: ${names.map((n) => `"${n}"`).join(", ")}.`;
  if (whole.length <= budget || Q.intent(question || "") !== "find") return { text: `${head}\n\n${whole}`, picked: false, pages: pages.length };
  const index = Q.buildIndex(pages.map((p) => ({ n: p.n, text: p.text })));
  const r = Q.retrieve(index, question, { budget: budget - head.length - 400, k: 12 });
  const byN = new Map(pages.map((p) => [p.n, p]));
  const body = r.excerpts.map((e) => `[${(byN.get(e.page) || {}).label || "p. " + e.page}]\n${e.text}`).join("\n\n---\n\n");
  return { text: `${head} Only the parts that match the question are below (the files are longer).\n\n${body || "(no passage matched the question)"}`, picked: true, pages: pages.length };
}

/** How the photos are laid out in one picture: cols × rows for n photos. */
export function gridOf(n) {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  return { cols: 3, rows: 2 };
}

/** Several photos (data: URLs) → one JPEG data URL, each photo fitted in its cell with its number in the corner. */
export function collage(urls, { size = 1280, doc = typeof document !== "undefined" ? document : null } = {}) {
  return new Promise((ok, bad) => {
    if (!doc) return bad(new Error("no document"));
    const list = (urls || []).slice(0, MAX_PHOTOS);
    if (list.length === 1) return ok(list[0]);
    const { cols, rows } = gridOf(list.length);
    const cw = Math.floor(size / cols), ch = Math.floor((size * (rows === 1 ? 0.6 : 1)) / rows);
    const c = doc.createElement("canvas"); c.width = cw * cols; c.height = ch * rows;
    const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
    let left = list.length;
    list.forEach((u, i) => {
      const im = new Image();
      im.onload = () => {
        const x = (i % cols) * cw, y = Math.floor(i / cols) * ch, k = Math.min((cw - 8) / im.width, (ch - 8) / im.height);
        const w = im.width * k, h = im.height * k;
        g.drawImage(im, x + (cw - w) / 2, y + (ch - h) / 2, w, h);
        const r = Math.max(18, Math.round(cw / 14));
        g.fillStyle = "#e11d48"; g.beginPath(); g.arc(x + r + 6, y + r + 6, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffffff"; g.font = `bold ${Math.round(r * 1.2)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(i + 1), x + r + 6, y + r + 7);
        if (--left === 0) ok(c.toDataURL("image/jpeg", 0.88));
      };
      im.onerror = () => { if (--left === 0) ok(c.toDataURL("image/jpeg", 0.88)); };
      im.src = u;
    });
  });
}

/** What the model is told about a picture made of several photos. */
export const photosNote = (n) => (n > 1 ? `\n\n(The picture holds ${n} photos side by side, numbered 1–${n} in their corners. Refer to them by number.)` : "");

/** Is this file a document to read (not a spreadsheet for the sandbox)? */
export const isDoc = (name) => /\.(pdf|docx|pptx|odt|epub|html?|rtf|txt|md|json)$/i.test(String(name || ""));
export const isSheet = (name) => /\.(csv|tsv|xlsx|xlsm|xls)$/i.test(String(name || ""));

/** A file (bytes as base64) → pages [{n, text}]. readers: { pdfText(b64) → {pages:[{n,text}]}, C (convert.js) } */
export async function readPages(file, { pdfText, C } = {}) {
  const name = String(file.name || "").toLowerCase();
  const bytes = () => { const b = atob(file.b64 || ""); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const text = () => (file.text != null ? file.text : new TextDecoder("utf-8").decode(bytes()));
  const split = (t) => { const parts = String(t || "").split(/\n\s*\n/); const out = []; let cur = ""; for (const p of parts) { if (cur && (cur + "\n\n" + p).length > 2500) { out.push(cur); cur = p; } else cur = cur ? cur + "\n\n" + p : p; } if (cur.trim()) out.push(cur); return out.map((x, i) => ({ n: i + 1, text: x.trim() })); };
  if (/\.pdf$/.test(name)) { if (!pdfText) throw new Error("PDFs are read in the Android app"); const r = await pdfText(file.b64); return (r.pages || []).map((p, i) => ({ n: p.n || i + 1, text: String(p.text || "") })); }
  if (!C) return split(text());
  if (/\.pptx$/.test(name)) { const bl = await C.pptxToBlocks(bytes()); const by = new Map(); for (const b of bl) { const k = b.slide || 1; if (!by.has(k)) by.set(k, []); by.get(k).push(b); } return [...by.keys()].sort((a, b) => a - b).map((k) => ({ n: k, text: C.blocksToText(by.get(k)) })); }
  if (/\.docx$/.test(name)) return split(C.blocksToText((await C.docxRead(bytes())).blocks));
  if (/\.odt$/.test(name)) return split(C.blocksToText(await C.odtToBlocks(bytes())));
  if (/\.epub$/.test(name)) return split(C.blocksToText(await C.epubToBlocks(bytes())));
  if (/\.html?$/.test(name)) return split(C.blocksToText(C.htmlToBlocks(text())));
  if (/\.rtf$/.test(name)) return split(C.rtfToText(text()));
  return split(text());
}

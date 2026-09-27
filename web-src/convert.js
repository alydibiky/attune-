/* ---- v5.36 — File Converter: Word, Excel, CSV and text, built and read on the phone ----------
   Ali: "a feature that converts files like PDF to Word". Online converters upload your contracts
   and invoices to someone's server; this doesn't. Word (.docx) and Excel (.xlsx) are zip files of
   XML, so they are written and read here in plain JavaScript (the zip is unpacked with the
   browser's own DecompressionStream). PDFs are read and made by Android itself (NativeBridge:
   pdfText / pdfImages / makePdf). Scanned pages and photos of paper are read by the AI model.
   Pure functions (plus async unzip); tests in tests/unit/v536.test.mjs.                         */

// ---- zip ------------------------------------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder("utf-8").decode(b);

/** files [{name, data: Uint8Array|string}] → a zip (stored, no compression — Word and Excel accept it). */
export function zipStore(files) {
  const parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const name = enc(f.name), data = typeof f.data === "string" ? enc(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(12, 0x21, true);   // date 1 Jan 1980 (a zero month upsets strict readers)
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((n, p) => n + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

async function inflate(data) {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A zip → Map(name → Uint8Array) (stored and deflated entries). */
export async function unzip(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("That file isn't a Word / Excel file (not a zip).");
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
  const out = new Map();
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const name = dec(b.subarray(p + 46, p + 46 + nlen));
    const lnlen = v.getUint16(lo + 26, true), lxlen = v.getUint16(lo + 28, true);
    const data = b.subarray(lo + 30 + lnlen + lxlen, lo + 30 + lnlen + lxlen + csize);
    out.set(name, method === 0 ? data : method === 8 ? await inflate(data) : new Uint8Array());
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

// ---- blocks: the common shape between formats ------------------------------------------------
// [{ type: "h1"|"h2"|"h3"|"p"|"li"|"table", text, rows? }]
const isAr = (s) => /[؀-ۿ]/.test(s);

/** Plain text / Markdown → blocks (headings, bullets, tables as "a | b" rows, paragraphs). */
export function textToBlocks(text) {
  const out = []; let para = [], table = [];
  const flushP = () => { if (para.length) { out.push({ type: "p", text: para.join(" ").trim() }); para = []; } };
  const flushT = () => { if (table.length) { out.push({ type: "table", rows: table }); table = []; } };
  for (const raw of String(text || "").replace(/\r/g, "").split("\n")) {
    const l = raw.trim();
    if (/^\|?\s*:?-{2,}/.test(l) && l.includes("-") && !/[\p{L}\d]/u.test(l.replace(/-/g, ""))) continue;   // markdown table rule
    if (l.includes(" | ") || /^\|.*\|$/.test(l)) { flushP(); table.push(l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim())); continue; }
    flushT();
    if (!l) { flushP(); continue; }
    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flushP(); out.push({ type: "h" + h[1].length, text: h[2].replace(/\*\*/g, "") }); continue; }
    const li = l.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (li) { flushP(); out.push({ type: "li", text: li[1].replace(/\*\*/g, "") }); continue; }
    para.push(l.replace(/\*\*/g, ""));
  }
  flushP(); flushT();
  return out;
}

/**
 * v5.41 — PDF pages with layout (Android sends each line's position, size, boldness and its column spans)
 * → blocks with real structure: headings (bigger / bold short lines), paragraphs (wrapped lines joined),
 * numbered and bulleted lists (with their wrapped lines), and tables (2+ lines whose spans line up in
 * columns). Ali's GUC assignment came out with the title glued to the text, tables as plain lines and
 * the question numbers lost.
 * pages: [{ lines: [{y, x, s, b, sp: [[x, text, size]]}], text }] → blocks
 */
export function pdfLinesToBlocks(pages) {
  // superscript pieces next to each other are one: ^(−ΔΔ)^(Ct) → ^(−ΔΔCt)
  const sup = (t) => String(t).replace(/\)\^\(/g, "");
  const all = pages.flatMap((p, pi) => (p.lines || []).map((l) => ({ ...l, page: pi, sp: l.sp.map((x) => [x[0], sup(x[1]), x[2], x[3]]), text: sup(l.sp.map((x) => x[1]).join(" ")).replace(/\s+/g, " ").trim() }))).filter((l) => l.text);
  if (!all.length) return [];
  // the body text size: the size most of the characters are written in
  const bySize = new Map();
  for (const l of all) { const k = Math.round(l.s * 2) / 2; bySize.set(k, (bySize.get(k) || 0) + l.text.length); }
  const body = [...bySize].sort((a, b) => b[1] - a[1])[0][0];
  const maxS = Math.max(...all.map((l) => l.s));
  const LIST = /^\s*(?:(\d{1,2}|[a-z]|[ivx]{1,4})[.)]|[•●▪◦\-–*])\s*/i;
  const isHead = (l) => l.text.length <= 110 && !LIST.test(l.text) && (l.s >= body * 1.18 || (l.b && l.text.length <= 90 && !/[.,;]$/.test(l.text)));
  const cols = (l) => l.sp.length;
  const out = [];
  let para = null, item = null, i = 0;
  const flush = () => { if (para) { out.push({ type: "p", text: para.text }); para = null; } item = null; };
  while (i < all.length) {
    const l = all[i];
    // a table: this line and the next ones split into 2+ columns that line up
    // (a bold header row counts too: it lines up with the rows under it)
    if (cols(l) >= 2) {
      const rows = [l]; let j = i + 1;
      while (j < all.length && cols(all[j]) >= 2 && all[j].page === l.page && all[j].y - rows[rows.length - 1].y < rows[rows.length - 1].s * 3.2) {
        const xs = rows[0].sp.map((x) => x[0]);
        const lined = all[j].sp.filter((x) => xs.some((c) => Math.abs(c - x[0]) < 40)).length;
        if (lined < 2) break;
        rows.push(all[j]); j++;
      }
      if (rows.length >= 2) {
        flush();
        // columns: the starting x of every span, merged when close
        // columns come from the body rows (a header's titles often sit a little left of the numbers under them)
        const bodyRows = rows.length > 2 || !rows[0].b ? rows.slice(rows[0].b ? 1 : 0) : rows;
        const mid = (x, t, sz) => x + String(t).length * (sz || body) * 0.26;   // a text's centre, from its length
        const anchors = [], centres = [];
        for (const r of bodyRows) for (const [x, t, sz] of r.sp) if (!anchors.some((a) => Math.abs(a - x) < 24)) { anchors.push(x); centres.push(mid(x, t, sz)); }
        const ord = anchors.map((a, k) => k).sort((p, q) => anchors[p] - anchors[q]);
        const A = ord.map((k) => anchors[k]), Cn = ord.map((k) => centres[k]);
        anchors.length = 0; anchors.push(...A); centres.length = 0; centres.push(...Cn);
        const cell = (r) => {
          const row = anchors.map(() => "");
          const near = (x, t, sz) => { const m = mid(x, t, sz); let k = 0, best = Infinity; centres.forEach((a, c) => { const d = Math.abs(a - m); if (d < best) { best = d; k = c; } }); return k; };
          // a header with fewer cells than columns ("Control Stimulated" in one span): word by word
          const split = r.sp.length < anchors.length && r.sp.some((x) => Array.isArray(x[3]) && x[3].length > 1);
          for (const sp of r.sp) {
            const parts = split && Array.isArray(sp[3]) && sp[3].length > 1 ? sp[3].map(([wx, wt]) => [wx, wt]) : [[sp[0], sp[1]]];
            for (const [x, t] of parts) { const k = near(x, t, sp[2]); row[k] = row[k] ? row[k] + " " + t : t; }
          }
          return row;
        };
        out.push({ type: "table", rows: rows.map(cell) });
        i = j; continue;
      }
    }
    const prev = all[i - 1];
    const gap = prev && prev.page === l.page ? l.y - prev.y : Infinity;
    if (isHead(l)) {
      flush();
      const last = out[out.length - 1];
      // a heading that wraps onto a second line of the same size
      if (last && /^h/.test(last.type) && prev && gap < l.s * 1.6 && Math.abs(prev.s - l.s) < 0.6 && isHead(prev)) { last.text += " " + l.text; i++; continue; }
      out.push({ type: l.s >= maxS - 0.5 && l.s >= body * 1.35 ? "h1" : l.s >= body * 1.18 ? "h2" : "h3", text: l.text });
      i++; continue;
    }
    const m = l.text.match(LIST);
    if (m) {
      flush();
      const num = m[1] && /^\d+$/.test(m[1]) ? m[1] : m[1] ? m[1] : "";
      item = { type: "li", text: l.text.slice(m[0].length).trim(), x: l.x, ...(num ? { num } : {}) };
      out.push(item); i++; continue;
    }
    // a wrapped line of the list item above (same size, close below, not starting a new item)
    if (item && gap < l.s * 1.7 && Math.abs(l.s - body) < 1.5) { item.text += " " + l.text; i++; continue; }
    item = null;
    if (para && gap < l.s * 1.75 && Math.abs(l.s - para.s) < 1) { para.text += (/-$/.test(para.text) && !/\s-$/.test(para.text) ? "" : " ") + l.text; para.text = para.text.replace(/(\w)- (\w)/g, "$1-$2"); i++; continue; }
    flush();
    para = { text: l.text, s: l.s }; i++;
  }
  flush();
  return out.map(({ x, ...b }) => b);
}

/** Blocks → plain text (Markdown-style headings and bullets). */
export function blocksToText(blocks) {
  return blocks.map((b) => b.type === "table" ? b.rows.map((r) => r.join(" | ")).join("\n")
    : b.type === "li" ? "- " + b.text : /^h\d$/.test(b.type) ? "#".repeat(+b.type[1]) + " " + b.text : b.text).join("\n\n");
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Blocks → a Word document (.docx bytes). Arabic paragraphs are right-to-left.
 *  v5.40 (reports): also "title", "subtitle", "caption", "pagebreak" and "image" ({b64 PNG, w, h}) blocks,
 *  and o.accent (a hex colour for the headings). */
export function docxFromBlocks(blocks, title = "Document", o = {}) {
  const imgs = [];
  const run1 = (t, bold, sup) => {
    const rtl = isAr(t);
    return `<w:r><w:rPr>${bold ? "<w:b/>" : ""}${rtl ? "<w:rtl/>" : ""}${sup ? '<w:vertAlign w:val="superscript"/>' : ""}</w:rPr>${String(t).split("\n").map((x, i) => (i ? "<w:br/>" : "") + `<w:t xml:space="preserve">${esc(x)}</w:t>`).join("")}</w:r>`;
  };
  // v5.41: "2^(−ΔΔCt)" (a superscript read from a PDF) is written as a real superscript
  const run = (t, bold) => String(t).split(/\^\(([^()]{1,40})\)/).map((x, i) => (x ? run1(x, bold, i % 2 === 1) : "")).join("");
  const para = (t, style) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${isAr(t) ? "<w:bidi/>" : ""}</w:pPr>${run(t)}</w:p>`;
  const body = blocks.map((b) => {
    if (b.type === "table") {
      const w = Math.max(...b.rows.map((r) => r.length));
      return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join("")}</w:tblBorders></w:tblPr><w:tblGrid>${Array(w).fill(`<w:gridCol w:w="${Math.floor(9638 / w)}"/>`).join("")}</w:tblGrid>` +
        b.rows.map((r, ri) => `<w:tr>${Array.from({ length: w }, (_, ci) => `<w:tc><w:p><w:pPr>${isAr(r[ci] || "") ? "<w:bidi/>" : ""}</w:pPr>${run(r[ci] || "", ri === 0)}</w:p></w:tc>`).join("")}</w:tr>`).join("") + `</w:tbl><w:p/>`;
    }
    if (b.type === "pagebreak") return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    if (b.type === "image" && b.b64) {
      const n = imgs.push(b.b64), cx = 6120000, cy = Math.round(cx * (b.h || 1) / (b.w || 1));
      return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Chart ${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="chart${n}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
    if (b.type === "title") return para(b.text, "Title");
    if (b.type === "subtitle") return para(b.text, "Subtitle");
    if (b.type === "caption") return para(b.text, "Caption");
    if (b.type === "li") return para((b.num ? b.num + ".\t" : "•\t") + b.text, "ListBullet");
    if (/^h[1-3]$/.test(b.type)) return para(b.text, "Heading" + b.type[1]);
    return para(b.text);
  }).join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"${imgs.length ? ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' : ""}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const style = (id, name, size, bold, extra = "", color = /^Heading/.test(id) ? o.accent : null) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:pPr>${extra.includes("<w:spacing") ? "" : `<w:spacing w:before="${bold ? 240 : 0}" w:after="120"/>`}${extra}</w:pPr><w:rPr>${bold ? "<w:b/>" : ""}${color ? `<w:color w:val="${color}"/>` : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` + style("Heading1", "heading 1", 32, true) + style("Heading2", "heading 2", 28, true) + style("Heading3", "heading 3", 24, true) +
    style("ListBullet", "List Bullet", 22, false, `<w:ind w:left="720" w:hanging="360"/>`) +
    style("Title", "Title", 56, true, `<w:spacing w:before="2400" w:after="240"/>`, o.accent) + style("Subtitle", "Subtitle", 30, false, `<w:spacing w:after="480"/>`, "595959") + style("Caption", "caption", 18, false, `<w:jc w:val="center"/>`, "595959") + `<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>`;
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imgs.length ? '<Default Extension="png" ContentType="image/png"/>' : ""}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: "word/_rels/document.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${imgs.map((_, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/chart${i + 1}.png"/>`).join("")}</Relationships>` },
    { name: "word/document.xml", data: doc },
    { name: "word/styles.xml", data: styles },
    { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title><dc:creator>Attune</dc:creator></cp:coreProperties>` },
    ...imgs.map((b64, i) => ({ name: `word/media/chart${i + 1}.png`, data: b64ToBytes(b64) })),
  ];
  return zipStore(files);
}

const unxml = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function paraText(p) {
  let t = "";
  for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g)) t += m[1] != null ? unxml(m[1]) : /tab/.test(m[0]) ? "\t" : "\n";
  return t;
}

/** A Word document (.docx bytes) → blocks. */
export async function docxToBlocks(bytes) {
  const z = await unzip(bytes);
  const xml = z.get("word/document.xml");
  if (!xml) throw new Error("That file isn't a Word document.");
  const body = dec(xml);
  const out = [];
  // tables and paragraphs in order
  for (const m of body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g)) {
    const x = m[0];
    if (x.startsWith("<w:tbl>")) {
      const rows = [...x.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map((r) => [...r[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((c) => [...c[0].matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((p) => paraText(p[0])).join("\n").trim()));
      if (rows.length) out.push({ type: "table", rows });
      continue;
    }
    const text = paraText(x).trim();
    if (!text) continue;
    const st = (x.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || "";
    const hl = st.match(/^(?:Heading|heading|Title)\s?(\d)?/);
    if (hl) out.push({ type: "h" + Math.min(3, +(hl[1] || 1)), text });
    else if (/<w:numPr>|List/i.test(x.slice(0, 400))) out.push({ type: "li", text });
    else out.push({ type: "p", text });
  }
  return out;
}

// ---- Excel / CSV -----------------------------------------------------------------------------
const colName = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/** Rows (arrays) → an Excel workbook (.xlsx bytes), one sheet; numbers stay numbers. */
export function xlsxFromRows(rows, sheet = "Sheet1") {
  const data = rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
    const ref = colName(ci) + (ri + 1), s = v == null ? "" : String(v);
    if (s !== "" && /^-?\d+(\.\d+)?$/.test(s) && s.length < 16 && !/^0\d/.test(s)) return `<c r="${ref}"${ri === 0 ? ' s="1"' : ""}><v>${s}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(s)}</t></is></c>`;
  }).join("") + `</row>`).join("");
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(String(sheet).slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>` },
    { name: "xl/worksheets/sheet1.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${data}</sheetData></worksheet>` },
  ];
  return zipStore(files);
}

/** An Excel workbook (.xlsx bytes) → the first sheet's rows. */
export async function xlsxToRows(bytes) {
  const z = await unzip(bytes);
  const ssx = z.get("xl/sharedStrings.xml");
  const shared = ssx ? [...dec(ssx).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => unxml(t[1])).join("")) : [];
  const sheetName = [...z.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  if (!sheetName) throw new Error("That file isn't an Excel workbook.");
  const rows = [];
  for (const r of dec(z.get(sheetName)).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], inner = c[2] || "";
      const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1];
      const col = ref ? [...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : row.length;
      const t = (attrs.match(/t="([^"]+)"/) || [])[1];
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let val = t === "s" ? shared[+v] : t === "inlineStr" ? [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => unxml(x[1])).join("") : v != null ? unxml(v) : "";
      while (row.length < col) row.push("");
      row[col] = val == null ? "" : String(val);
    }
    rows.push(row);
  }
  return rows;
}

/** CSV text → rows (quotes, commas / semicolons / tabs). */
export function csvParse(text) {
  const t = String(text || "").replace(/^﻿/, "");
  const first = t.split("\n")[0] || "";
  const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur.replace(/\r$/, "")); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ""));
}

/** Rows → CSV text (with a BOM so Excel opens Arabic correctly). */
export function csvStringify(rows) {
  return "﻿" + rows.map((r) => r.map((v) => { const s = v == null ? "" : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\r\n");
}

// ---- v5.37: more formats — PowerPoint, OpenDocument, e-books, web pages, RTF, JSON, subtitles ----
const numOf = (k) => +((k.match(/(\d+)\.xml$/) || [])[1] || 0);

/** A PowerPoint (.pptx bytes) → blocks: a heading per slide, its text, bullets and tables, then the speaker notes. */
export async function pptxToBlocks(bytes) {
  const z = await unzip(bytes);
  const slides = [...z.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => numOf(a) - numOf(b));
  if (!slides.length) throw new Error("That file isn't a PowerPoint (.pptx) file.");
  const paras = (x) => [...x.matchAll(/<a:p>[\s\S]*?<\/a:p>|<a:p\s[^>]*>[\s\S]*?<\/a:p>/g)].map((p) => [...p[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:br\/>/g)].map((t) => (t[1] != null ? unxml(t[1]) : "\n")).join("").trim()).filter(Boolean);
  const out = [];
  slides.forEach((name, i) => {
    const x = dec(z.get(name));
    let title = "";
    const body = [];
    for (const m of x.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>|<a:tbl>[\s\S]*?<\/a:tbl>/g)) {
      const sp = m[0];
      if (sp.startsWith("<a:tbl>")) {
        const rows = [...sp.matchAll(/<a:tr[\s>][\s\S]*?<\/a:tr>/g)].map((r) => [...r[0].matchAll(/<a:tc[\s>][\s\S]*?<\/a:tc>|<a:tc\/>/g)].map((c) => paras(c[0]).join("\n")));
        if (rows.length) body.push({ type: "table", rows });
        continue;
      }
      const ph = (sp.match(/<p:ph\b[^>]*>/) || [""])[0];
      const ps = paras(sp);
      if (!ps.length) continue;
      if (/type="(ctrTitle|title)"/.test(ph) && !title) { title = ps.join(" "); continue; }
      const bullets = ph && !/type="(subTitle|dt|ftr|sldNum)"/.test(ph);
      if (/type="(dt|ftr|sldNum)"/.test(ph)) continue;
      for (const t of ps) body.push({ type: bullets ? "li" : "p", text: t });
    }
    out.push({ type: "h2", text: title ? `${i + 1}. ${title}` : `Slide ${i + 1}` }, ...body);
    const rels = z.get(name.replace("slides/", "slides/_rels/") + ".rels");
    const nref = rels && (dec(rels).match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/) || [])[1];
    const notes = nref && z.get("ppt/notesSlides/" + nref);
    if (notes) {
      const nx = dec(notes);
      const sp = [...nx.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)].find((m) => /<p:ph\b[^>]*type="body"/.test(m[0]));
      const t = sp ? paras(sp[0]).join("\n") : "";
      if (t) out.push({ type: "p", text: "Notes: " + t });
    }
  });
  return out;
}

// OpenDocument (LibreOffice) — .odt text and .ods sheets
function odText(x) {
  return unxml(String(x).replace(/<text:s(?:\s+text:c="(\d+)")?\s*\/>/g, (_, n) => " ".repeat(+(n || 1))).replace(/<text:tab\s*\/>/g, "\t").replace(/<text:line-break\s*\/>/g, "\n")
    .replace(/<text:note\b[\s\S]*?<\/text:note>/g, "").replace(/<[^>]+>/g, "")).trim();
}
function odBody(z) {
  const c = z.get("content.xml");
  if (!c) throw new Error("That file isn't an OpenDocument (LibreOffice) file.");
  const x = dec(c);
  return (x.match(/<office:body>([\s\S]*)<\/office:body>/) || [, x])[1];
}
/** An OpenDocument text (.odt bytes) → blocks. */
export async function odtToBlocks(bytes) {
  const body = odBody(await unzip(bytes));
  const out = [];
  for (const m of body.matchAll(/<table:table\s[\s\S]*?<\/table:table>|<text:list[\s>][\s\S]*?<\/text:list>|<text:h\s[^>]*>[\s\S]*?<\/text:h>|<text:p(?:\s[^>]*)?>[\s\S]*?<\/text:p>/g)) {
    const x = m[0];
    if (x.startsWith("<table:table")) {
      const rows = [...x.matchAll(/<table:table-row(?:\s[^>]*)?>([\s\S]*?)<\/table:table-row>/g)].map((r) => [...r[1].matchAll(/<table:table-cell(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/table:table-cell>)/g)].map((c) => odText((c[1] || "").replace(/<\/text:p>/g, "\n"))));
      if (rows.length) out.push({ type: "table", rows });
    } else if (x.startsWith("<text:list")) {
      for (const it of x.matchAll(/<text:list-item(?:\s[^>]*)?>([\s\S]*?)<\/text:list-item>/g)) { const t = odText(it[1]); if (t) out.push({ type: "li", text: t }); }
    } else if (x.startsWith("<text:h")) {
      const t = odText(x); if (t) out.push({ type: "h" + Math.min(3, +((x.match(/text:outline-level="(\d)"/) || [])[1] || 1)), text: t });
    } else { const t = odText(x); if (t) out.push({ type: "p", text: t }); }
  }
  return out;
}
/** An OpenDocument spreadsheet (.ods bytes) → the first sheet's rows. */
export async function odsToRows(bytes) {
  const body = odBody(await unzip(bytes));
  const t = (body.match(/<table:table\s[\s\S]*?<\/table:table>/) || [])[0];
  if (!t) throw new Error("That file has no sheet.");
  const rows = [];
  for (const r of t.matchAll(/<table:table-row(\s[^>]*)?(?:\/>|>([\s\S]*?)<\/table:table-row>)/g)) {
    const row = [];
    for (const c of (r[2] || "").matchAll(/<table:(?:covered-)?table-cell(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g)) {
      const a = c[1] || "";
      const v = /office:value-type="(float|percentage|currency)"/.test(a) ? (a.match(/office:value="([^"]*)"/) || [])[1] : null;
      const val = v != null ? v : odText((c[2] || "").replace(/<\/text:p>\s*<text:p/g, "</text:p>\n<text:p"));
      const n = Math.min(+((a.match(/table:number-columns-repeated="(\d+)"/) || [])[1] || 1), 500);
      for (let k = 0; k < n; k++) row.push(val);
    }
    while (row.length && row[row.length - 1] === "") row.pop();
    const n = Math.min(+(((r[1] || "").match(/table:number-rows-repeated="(\d+)"/) || [])[1] || 1), 500);
    for (let k = 0; k < n; k++) rows.push([...row]);
  }
  while (rows.length && !rows[rows.length - 1].length) rows.pop();
  return rows;
}
const ODF_NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';
function odfZip(mime, content, styles = "") {
  return zipStore([
    { name: "mimetype", data: mime },
    { name: "META-INF/manifest.xml", data: `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${mime}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>` },
    { name: "content.xml", data: `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${ODF_NS} office:version="1.2">${styles}<office:body>${content}</office:body></office:document-content>` },
  ]);
}
/** Blocks → an OpenDocument text (.odt bytes). */
export function odtFromBlocks(blocks) {
  const para = (t, st) => `<text:p${st ? ` text:style-name="${st}"` : ""}>${esc(t).replace(/\n/g, "<text:line-break/>")}</text:p>`;
  const body = blocks.map((b) => {
    if (b.type === "table") { const w = Math.max(...b.rows.map((r) => r.length)); return `<table:table table:name="Table"><table:table-column table:number-columns-repeated="${w}"/>${b.rows.map((r) => `<table:table-row>${Array.from({ length: w }, (_, i) => `<table:table-cell office:value-type="string">${para(r[i] || "")}</table:table-cell>`).join("")}</table:table-row>`).join("")}</table:table>`; }
    if (b.type === "li") return `<text:list><text:list-item>${para(b.text)}</text:list-item></text:list>`;
    if (/^h[1-3]$/.test(b.type)) return `<text:h text:outline-level="${b.type[1]}" text:style-name="H${b.type[1]}">${esc(b.text)}</text:h>`;
    return para(b.text, isAr(b.text) ? "RTL" : "");
  }).join("");
  const st = `<office:automatic-styles>${[1, 2, 3].map((n) => `<style:style style:name="H${n}" style:family="paragraph"><style:text-properties fo:font-size="${[0, 16, 14, 12][n]}pt" fo:font-weight="bold"/></style:style>`).join("")}<style:style style:name="RTL" style:family="paragraph"><style:paragraph-properties style:writing-mode="rl-tb"/></style:style></office:automatic-styles>`;
  return odfZip("application/vnd.oasis.opendocument.text", `<office:text>${body}</office:text>`, st);
}
/** Rows → an OpenDocument spreadsheet (.ods bytes); numbers stay numbers. */
export function odsFromRows(rows, sheet = "Sheet1") {
  const cell = (v) => { const s = v == null ? "" : String(v); return s !== "" && /^-?\d+(\.\d+)?$/.test(s) && s.length < 16 && !/^0\d/.test(s) ? `<table:table-cell office:value-type="float" office:value="${s}"><text:p>${s}</text:p></table:table-cell>` : `<table:table-cell office:value-type="string"><text:p>${esc(s)}</text:p></table:table-cell>`; };
  return odfZip("application/vnd.oasis.opendocument.spreadsheet", `<office:spreadsheet><table:table table:name="${esc(String(sheet).slice(0, 31))}">${rows.map((r) => `<table:table-row>${r.map(cell).join("")}</table:table-row>`).join("")}</table:table></office:spreadsheet>`);
}

// web pages / e-books
const ENT = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", reg: "®", deg: "°", times: "×", laquo: "«", raquo: "»", bull: "•", middot: "·", euro: "€", pound: "£" };
const deEnt = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
const inl = (s) => deEnt(String(s).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").trim();
/** A web page / e-book chapter (HTML text) → blocks. */
export function htmlToBlocks(html) {
  let h = String(html || "").replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|head|nav|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, "");
  const b = h.match(/<body\b[^>]*>([\s\S]*)<\/body>/i); if (b) h = b[1];
  const out = [];
  for (const m of h.matchAll(/<table\b[\s\S]*?<\/table>|<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>|<li\b[^>]*>([\s\S]*?)<\/li>|<(p|div|blockquote|pre|dt|dd|figcaption|td|th|caption|section|article)\b[^>]*>((?:(?!<(?:p|div|table|h[1-6]|ul|ol|li|section|article|blockquote)\b)[\s\S])*?)(?=<\/?(?:p|div|table|h[1-6]|ul|ol|li|section|article|blockquote|body)\b|$)/gi)) {
    if (/^<table/i.test(m[0])) {
      const rows = [...m[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((r) => [...r[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => inl(c[1])));
      if (rows.some((r) => r.length)) out.push({ type: "table", rows: rows.filter((r) => r.length) });
    } else if (m[1]) { const t = inl(m[2]); if (t) out.push({ type: "h" + Math.min(3, +m[1]), text: t }); }
    else if (m[3] != null) { const t = inl(m[3].replace(/<(ul|ol)\b[\s\S]*$/i, "")); if (t) out.push({ type: "li", text: t }); }
    else { const t = inl(m[5] || ""); if (t) out.push({ type: "p", text: t }); }
  }
  if (!out.length) { const t = inl(h.replace(/<\/(p|div|h\d|li|tr)>/gi, "\n\n")); return textToBlocks(t); }
  return out;
}
/** An e-book (.epub bytes) → blocks, chapters in reading order. */
export async function epubToBlocks(bytes) {
  const z = await unzip(bytes);
  const cont = z.get("META-INF/container.xml");
  const opfPath = cont ? (dec(cont).match(/full-path="([^"]+)"/) || [])[1] : [...z.keys()].find((k) => k.endsWith(".opf"));
  if (!opfPath || !z.get(opfPath)) throw new Error("That file isn't an e-book (.epub).");
  const opf = dec(z.get(opfPath)), dir = opfPath.includes("/") ? opfPath.replace(/[^/]+$/, "") : "";
  const items = {};
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) { const id = (m[0].match(/\bid="([^"]+)"/) || [])[1], href = (m[0].match(/\bhref="([^"]+)"/) || [])[1]; if (id && href) items[id] = href; }
  const order = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => items[m[1]]).filter(Boolean);
  const out = [];
  for (const href of order) {
    const path = (dir + decodeURIComponent(href.split("#")[0])).replace(/[^/]+\/\.\.\//g, "");
    const f = z.get(path); if (f) out.push(...htmlToBlocks(dec(f)));
  }
  return out;
}
/** Blocks → a web page (HTML; opens in any browser; Arabic runs right-to-left). */
export function blocksToHtml(blocks, title = "Document") {
  let body = "", list = false;
  for (const b of blocks) {
    if (b.type === "li" && !list) { body += "<ul>"; list = true; }
    if (b.type !== "li" && list) { body += "</ul>"; list = false; }
    const t = esc(b.text || "").replace(/\n/g, "<br>");
    if (b.type === "table") body += `<table>${b.rows.map((r, i) => `<tr>${r.map((c) => `<${i ? "td" : "th"} dir="auto">${esc(c).replace(/\n/g, "<br>")}</${i ? "td" : "th"}>`).join("")}</tr>`).join("")}</table>`;
    else if (b.type === "li") body += `<li dir="auto">${t}</li>`;
    else if (/^h[1-3]$/.test(b.type)) body += `<${b.type} dir="auto">${t}</${b.type}>`;
    else body += `<p dir="auto">${t}</p>`;
  }
  if (list) body += "</ul>";
  return `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:820px;margin:32px auto;padding:0 16px;line-height:1.55;color:#1a1a1a}table{border-collapse:collapse;margin:12px 0}th,td{border:1px solid #999;padding:6px 10px;text-align:start}th{background:#f1f1f1}</style></head><body>\n${body}\n</body></html>\n`;
}
/** Blocks → Markdown (tables with a header rule). */
export function blocksToMarkdown(blocks) {
  return blocks.map((b) => b.type === "table" ? b.rows.map((r, i) => "| " + r.map((c) => String(c).replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ") + " |" + (i === 0 ? "\n|" + r.map(() => " --- |").join("") : "")).join("\n")
    : b.type === "li" ? "- " + b.text : /^h\d$/.test(b.type) ? "#".repeat(+b.type[1]) + " " + b.text : b.text).join("\n\n") + "\n";
}

/** Rich Text (.rtf) → plain text (Arabic code pages and \u characters kept, tables as "a | b" rows). */
export function rtfToText(rtf) {
  const s = String(rtf || "");
  if (!/^\s*\{\\rtf/.test(s)) throw new Error("That file isn't a Rich Text (.rtf) file.");
  const cp = +((s.match(/\\ansicpg(\d+)/) || [])[1] || 1252);
  let codec; try { codec = new TextDecoder("windows-" + cp); } catch (e) { codec = new TextDecoder("windows-1252"); }
  const SKIP = /^(fonttbl|colortbl|stylesheet|info|pict|header|footer|headerl|headerr|footerl|footerr|object|themedata|colorschememapping|latentstyles|datastore|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|mmathPr|fldinst)$/;
  let out = "", bytes = [], skip = false, uc = 1, pendingSkip = 0;
  const stack = [];
  const flush = () => { if (bytes.length) { out += codec.decode(new Uint8Array(bytes)); bytes = []; } };
  const emit = (t) => { if (skip) return; flush(); out += t; };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") { stack.push({ skip, uc }); if (s[i + 1] === "\\" && s[i + 2] === "*") skip = true; continue; }
    if (ch === "}") { const st = stack.pop() || { skip: false, uc: 1 }; if (!st.skip && skip) flush(); skip = st.skip; uc = st.uc; continue; }
    if (ch === "\\") {
      const n = s[i + 1];
      if (n === "\\" || n === "{" || n === "}") { if (pendingSkip) pendingSkip--; else emit(n); i++; continue; }
      if (n === "'") { const b = parseInt(s.substr(i + 2, 2), 16); i += 3; if (pendingSkip) { pendingSkip--; continue; } if (!skip && !isNaN(b)) bytes.push(b); continue; }
      if (n === "~") { emit(" "); i++; continue; }
      if (n === "*") { i++; continue; }
      const m = s.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (!m) { i++; continue; }
      i += m[0].length;
      const w = m[1], arg = m[2];
      if (SKIP.test(w)) { skip = true; continue; }
      if (w === "uc") { uc = +arg; continue; }
      if (w === "u") { let c = +arg; if (c < 0) c += 65536; emit(String.fromCharCode(c)); pendingSkip = uc; continue; }
      if (w === "par" || w === "line" || w === "sect" || w === "page") emit("\n");
      else if (w === "tab") emit("\t");
      else if (w === "cell") emit(" | ");
      else if (w === "row") emit("\n");
      else if (w === "emdash") emit("—"); else if (w === "endash") emit("–"); else if (w === "bullet") emit("• ");
      else if (w === "lquote") emit("‘"); else if (w === "rquote") emit("’"); else if (w === "ldblquote") emit("“"); else if (w === "rdblquote") emit("”");
      continue;
    }
    if (ch === "\r" || ch === "\n") continue;
    if (pendingSkip) { pendingSkip--; continue; }
    if (!skip) { flush(); out += ch; }
  }
  flush();
  return out.split("\n").map((l) => l.replace(/\s*\|\s*$/, "").replace(/[ \t]+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** JSON text → rows (a list of records becomes a sheet with a column per field). */
export function jsonToRows(text) {
  let d; try { d = JSON.parse(String(text || "").replace(/^﻿/, "")); } catch (e) { throw new Error("That JSON file has a mistake in it — it can't be read."); }
  if (d && !Array.isArray(d) && typeof d === "object") { const arr = Object.values(d).find((v) => Array.isArray(v) && v.length && typeof v[0] === "object"); if (arr) d = arr; }
  const cell = (v) => v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (Array.isArray(d)) {
    if (d.every((r) => Array.isArray(r))) return d.map((r) => r.map(cell));
    if (d.every((r) => r && typeof r === "object")) { const keys = [...new Set(d.flatMap((r) => Object.keys(r)))]; return [keys, ...d.map((r) => keys.map((k) => cell(r[k])))]; }
    return [["value"], ...d.map((v) => [cell(v)])];
  }
  if (d && typeof d === "object") return [["key", "value"], ...Object.entries(d).map(([k, v]) => [k, cell(v)])];
  return [["value"], [cell(d)]];
}
/** Rows → JSON text (first row = field names; numbers stay numbers). */
export function rowsToJson(rows) {
  if (!rows.length) return "[]\n";
  const head = rows[0].map((h, i) => String(h || "").trim() || "column" + (i + 1));
  const val = (s) => (s !== "" && /^-?\d+(\.\d+)?$/.test(s) && s.length < 16 && !/^-?0\d/.test(s) ? +s : s == null ? "" : s);
  return JSON.stringify(rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, val(r[i] == null ? "" : String(r[i]))]))), null, 2) + "\n";
}

/** Subtitles (.srt or .vtt) → cues [{start, end, text}] in milliseconds. */
export function subsParse(text) {
  const t = (s) => { const m = s.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/); return m ? ((+(m[1] || 0) * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4].padEnd(3, "0") : null; };
  const cues = [];
  for (const block of String(text || "").replace(/^﻿/, "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n"); const k = lines.findIndex((l) => l.includes("-->"));
    if (k < 0) continue;
    const [a, b] = lines[k].split("-->"); const start = t(a), end = t(b.trim().split(/\s/)[0]);
    const txt = lines.slice(k + 1).join("\n").trim();
    if (start != null && end != null && txt) cues.push({ start, end, text: txt });
  }
  if (!cues.length) throw new Error("No subtitles were found in that file.");
  return cues;
}
const ts = (ms, sep) => { const p = (n, w = 2) => String(n).padStart(w, "0"); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${sep}${p(ms % 1000, 3)}`; };
export const srtFromCues = (c) => c.map((x, i) => `${i + 1}\n${ts(x.start, ",")} --> ${ts(x.end, ",")}\n${x.text}`).join("\n\n") + "\n";
export const vttFromCues = (c) => "WEBVTT\n\n" + c.map((x) => `${ts(x.start, ".")} --> ${ts(x.end, ".")}\n${x.text}`).join("\n\n") + "\n";
export const cuesToText = (c) => c.map((x) => x.text.replace(/<[^>]+>/g, "")).join("\n");

/** "1-3, 5, 8-" → [1,2,3,5,8,…count] (page numbers typed by a person). */
export function pageList(s, count) {
  const out = [];
  for (const part of String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).split(/[,،;\s]+/)) {
    const m = part.match(/^(\d+)?\s*[-–]\s*(\d+)?$/) || part.match(/^(\d+)$/);
    if (!m) continue;
    if (m.length === 2 || m[0] === m[1]) { out.push(+m[1]); continue; }
    const a = +(m[1] || 1), b = +(m[2] || count || a);
    for (let i = Math.min(a, b); i <= Math.max(a, b) && out.length < 5000; i++) out.push(i);
  }
  return [...new Set(out)].filter((n) => n >= 1 && (!count || n <= count));
}

// ---- v5.39: translate a document, keeping its shape ------------------------------------------
// Every paragraph, heading, bullet and table cell is one "unit". Units are sent to the model in
// numbered batches ([[1]] …) and put back in place by number, so the structure never depends on the
// model. Numbers-only cells (prices, dates, codes) are not sent at all.
const needsWords = (t) => /[\p{L}]{2,}/u.test(String(t || ""));
/** blocks → [{b, r?, c?, text}] — the pieces to translate, in order. */
export function translateUnits(blocks) {
  const u = [];
  blocks.forEach((b, bi) => {
    if (b.type === "table") b.rows.forEach((row, ri) => row.forEach((cell, ci) => { if (needsWords(cell)) u.push({ b: bi, r: ri, c: ci, text: String(cell) }); }));
    else if (needsWords(b.text)) u.push({ b: bi, text: String(b.text) });
  });
  return u;
}
/** Units → batches of indexes, each under maxChars (a long paragraph goes alone). */
export function batchUnits(units, maxChars = 1500) {
  const out = []; let cur = [], n = 0;
  units.forEach((x, i) => {
    const len = x.text.length + 8;
    if (cur.length && n + len > maxChars) { out.push(cur); cur = []; n = 0; }
    cur.push(i); n += len;
  });
  if (cur.length) out.push(cur);
  return out;
}
/** The prompt for one batch. Line breaks inside a unit travel as " <br> ". */
export function translateMessages(texts, language) {
  const body = texts.map((t, i) => `[[${i + 1}]] ${String(t).replace(/\n/g, " <br> ")}`).join("\n");
  return [
    { role: "system", content: `You are a professional translator. Translate into ${language}. Keep every number, date, amount, unit, code, e-mail, link and product/model name exactly as written. Keep "<br>" where it is. Translate meaning naturally (not word by word), in the tone of the original. Reply ONLY with the numbered lines, in the same order, each starting with its marker [[n]] — no notes.` },
    { role: "user", content: body },
  ];
}
/** The model's reply → n translations (null where one is missing). */
export function parseTranslated(reply, n) {
  const out = Array(n).fill(null);
  const parts = String(reply || "").split(/\[\[(\d+)\]\]/);
  for (let i = 1; i < parts.length; i += 2) {
    const k = +parts[i] - 1, t = parts[i + 1].trim().replace(/\s*<br>\s*/gi, "\n");
    if (k >= 0 && k < n && t && out[k] == null) out[k] = t;
  }
  if (n === 1 && out[0] == null && String(reply || "").trim() && !/\[\[/.test(reply)) out[0] = String(reply).trim().replace(/\s*<br>\s*/gi, "\n");
  return out;
}
/** Puts the translations back → new blocks (the originals are untouched). */
export function applyTranslations(blocks, units, texts) {
  const nb = blocks.map((b) => (b.type === "table" ? { ...b, rows: b.rows.map((r) => [...r]) } : { ...b }));
  units.forEach((u, i) => { const t = texts[i]; if (t == null) return; if (u.r != null) nb[u.b].rows[u.r][u.c] = t; else nb[u.b].text = t; });
  return nb;
}

// ---- what can become what ----------------------------------------------------------------------
export const KINDS = {
  pdf: { ext: /\.pdf$/i, mime: /pdf/, targets: ["docx", "translate", "txt", "images", "xlsx", "html", "md", "odt", "split", "pick", "rotate"] },
  docx: { ext: /\.docx$/i, mime: /wordprocessingml/, targets: ["pdf", "translate", "txt", "html", "md", "odt"] },
  pptx: { ext: /\.pptx$/i, mime: /presentationml/, targets: ["pdf", "translate", "docx", "txt", "md", "html"] },
  odt: { ext: /\.odt$/i, mime: /opendocument\.text/, targets: ["docx", "translate", "pdf", "txt", "html", "md"] },
  epub: { ext: /\.epub$/i, mime: /epub/, targets: ["pdf", "translate", "docx", "txt", "html", "md"] },
  html: { ext: /\.x?html?$/i, mime: /html/, targets: ["pdf", "translate", "docx", "txt", "md", "odt"] },
  rtf: { ext: /\.rtf$/i, mime: /rtf/, targets: ["docx", "translate", "pdf", "txt", "odt"] },
  image: { ext: /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i, mime: /^image\//, targets: ["pdf", "jpg", "png", "webp", "docx", "txt", "translate"] },
  text: { ext: /\.(txt|md|markdown)$/i, mime: /^text\/(plain|markdown)/, targets: ["docx", "translate", "pdf", "html", "odt", "md"] },
  xlsx: { ext: /\.xlsx$/i, mime: /spreadsheetml/, targets: ["csv", "pdf", "json", "ods", "docx", "html"] },
  ods: { ext: /\.ods$/i, mime: /opendocument\.spreadsheet/, targets: ["xlsx", "csv", "pdf", "json", "html"] },
  csv: { ext: /\.(csv|tsv)$/i, mime: /csv|tab-separated/, targets: ["xlsx", "pdf", "json", "ods", "docx", "html"] },
  json: { ext: /\.json$/i, mime: /json/, targets: ["xlsx", "csv", "ods", "pdf"] },
  srt: { ext: /\.srt$/i, mime: /subrip/, targets: ["vtt", "translate", "txt"] },
  vtt: { ext: /\.vtt$/i, mime: /vtt/, targets: ["srt", "translate", "txt"] },
};
/** Several files picked together: photos → one PDF (or each converted), PDFs → merged. */
export const MULTI = { image: { kind: "images", targets: ["pdf", "jpg", "png", "webp", "docx", "txt", "translate"] }, pdf: { kind: "pdfs", targets: ["merge"] } };
export function kindOf(name, mime) {
  for (const [k, v] of Object.entries(KINDS)) if (v.ext.test(name || "")) return k;
  for (const [k, v] of Object.entries(KINDS)) if (mime && v.mime.test(mime)) return k;
  return null;
}
export const MIME = { docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf", txt: "text/plain", csv: "text/csv", zip: "application/zip",
  html: "text/html", md: "text/markdown", json: "application/json", odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet", srt: "application/x-subrip", vtt: "text/vtt", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** The prompt that copies the text of a scanned page / photo (the AI's eyes). */
export function readPageMessages(n, total) {
  return [{ role: "user", content: `Copy ALL the text in this ${total > 1 ? `page (${n} of ${total})` : "image"} exactly as written, in reading order. Keep the language (Arabic stays Arabic). Headings as "# ", bullet points as "- ", tables as rows "cell | cell | cell". Numbers, names and dates exactly. No comments, no summary — only the text.` }];
}

export const b64ToBytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
export const bytesToB64 = (u) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

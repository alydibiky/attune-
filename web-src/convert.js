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

/** v6.8: Markdown emphasis → runs: **bold** / __bold__, *italic* / _italic_ (not inside snake_case), `code`. */
function mdRuns(line) {
  const out = []; const re = /(\*\*|__)(?=\S)([\s\S]*?\S)\1|(?<![\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)|(?<![\w_])_(?=\S)([^_\n]*?\S)_(?![\w_])|`([^`\n]+)`/g;
  let last = 0, m;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index), b: false, i: false, c: null });
    if (m[2] != null) { const inner = mdRuns(m[2]); (inner.runs || [{ t: inner.text, b: false, i: false, c: null }]).forEach((r) => out.push({ ...r, b: true })); }
    else if (m[3] != null || m[4] != null) out.push({ t: m[3] != null ? m[3] : m[4], b: false, i: true, c: null });
    else out.push({ t: m[5], b: false, i: false, c: null, font: "Courier New" });
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ t: line.slice(last), b: false, i: false, c: null });
  const text = out.map((r) => r.t).join("");
  return { text, runs: out.some((r) => r.b || r.i || r.font) ? out.filter((r) => r.t) : null };
}
/** Plain text / Markdown → blocks (headings, bullets, tables as "a | b" rows, paragraphs; v6.8: **bold** and
 *  *italic* kept as the words' look, not dropped). */
export function textToBlocks(text) {
  const out = []; let para = [], table = [];
  const md = (blk, raw) => { const r = mdRuns(raw); blk.text = r.text.trim(); if (r.runs) { blk.runs = r.runs; blk.runs[0].t = blk.runs[0].t.replace(/^\s+/, ""); blk.runs[blk.runs.length - 1].t = blk.runs[blk.runs.length - 1].t.replace(/\s+$/, ""); } return blk; };
  const flushP = () => { if (para.length) { out.push(md({ type: "p" }, para.join(" ").trim())); para = []; } };
  const flushT = () => { if (table.length) { out.push({ type: "table", rows: table }); table = []; } };
  for (const raw of String(text || "").replace(/\r/g, "").split("\n")) {
    const l = raw.trim();
    if (/^\|?\s*:?-{2,}/.test(l) && l.includes("-") && !/[\p{L}\d]/u.test(l.replace(/-/g, ""))) continue;   // markdown table rule
    if (l.includes(" | ") || /^\|.*\|$/.test(l)) { flushP(); table.push(l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim().replace(/^\*\*([\s\S]*)\*\*$/, "$1"))); continue; }
    flushT();
    if (!l) { flushP(); continue; }
    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flushP(); out.push(md({ type: "h" + h[1].length }, h[2])); continue; }
    const li = l.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (li) { flushP(); out.push(md({ type: "li" }, li[1])); continue; }
    para.push(l);
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
 * v6.8 — Ali: "not just convert but with formatting and spacing and everything, like from PDF to Word".
 * Each block now also keeps what the page showed: the words' bold / italic / colour (runs), the
 * alignment (centred, right, justified — from where the lines sit between the margins), indents,
 * the space before it and the line spacing, the font and its size, right-to-left lines, pictures in
 * their place, a table's column widths, and where the PDF's pages begin. "1. Summary" in a big font
 * is a heading, not a list item, and Word's Symbol-font bullets (private-use characters) are bullets.
 * pages: [{ w, h, imgs?: [{x, y, w, h, b64}], lines: [{y, x, e?, s, b, i?, r?, f?, c?, sp: [[x, text, size, words?: [[x, t, b?, i?, c?]]]]}] }]
 */
const MARK = /^(?:[•●▪◦‣∙·○■□◆◇►▶✓✔*\-–—]|[\uF000-\uF0FF])$/;
const NUM_MARK = /^(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)]$/i;
const FONT_MAP = { liberationserif: "Times New Roman", tinos: "Times New Roman", timesnewroman: "Times New Roman", times: "Times New Roman", timesroman: "Times New Roman",
  liberationsans: "Arial", arimo: "Arial", helvetica: "Arial", arial: "Arial", liberationmono: "Courier New", cousine: "Courier New", courier: "Courier New", couriernew: "Courier New",
  dejavusans: "DejaVu Sans", dejavuserif: "DejaVu Serif", dejavusansmono: "DejaVu Sans Mono", symbol: null, wingdings: null, opensymbol: null };
/** "BAAAAA+TimesNewRomanPS-BoldMT" → "Times New Roman" (null for symbol fonts). */
export function fontFamily(name) {
  let f = String(name || "").replace(/^[A-Z]{6}\+/, "").replace(/[-,](?:Bold|Italic|Oblique|Regular|Roman|Book|Medium|Light|Semi[Bb]old|Black|Heavy|It|Bd|BdIt|BoldIt)\w*$/i, "").replace(/(?:PSMT|PS|MT)$/, "").replace(/-$/, "");
  const key = f.replace(/[\s_-]/g, "").toLowerCase();
  if (key in FONT_MAP) return FONT_MAP[key];
  return f ? f.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").trim() : null;
}
/** 0xC00000 → "C00000"; black / near-black → null. */
const hexOf = (c) => { c = +c || 0; const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return r < 64 && g < 64 && b < 64 ? null : [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase(); };

export function pdfLinesToBlocks(pages) {
  // superscript pieces next to each other are one: ^(−ΔΔ)^(Ct) → ^(−ΔΔCt)
  const sup = (t) => String(t).replace(/\)\^\(/g, "");
  const all = [];
  pages.forEach((p, pi) => {
    for (const l0 of p.lines || []) {
      let sp = l0.sp.map((x) => [x[0], sup(x[1]), x[2], x[3]]);
      // a lone bullet / number before the text is the list's marker, not a table column (v6.8)
      let mark = null;
      if (sp.length >= 2 && (MARK.test(sp[0][1].trim()) || NUM_MARK.test(sp[0][1].trim()))) { mark = sp[0][1].trim(); sp = sp.slice(1); }
      else if (sp.length && /^[\uF000-\uF0FF]\s*/.test(sp[0][1])) { mark = "•"; sp = [[sp[0][0], sp[0][1].replace(/^[\uF000-\uF0FF]\s*/, ""), sp[0][2], (sp[0][3] || []).filter((w) => !/^[\uF000-\uF0FF]$/.test(w[1]))], ...sp.slice(1)]; }
      if (mark && /^[\uF000-\uF0FF]$/.test(mark)) mark = "•";
      // the line is measured without its marker (a right-to-left bullet sits past the right margin)
      let lx = l0.x, le = l0.e;
      if (mark && sp.length) { if (l0.r && le != null) le = sp[0][0]; else if (!l0.r) lx = sp[0][0]; }
      const body = sup(sp.map((x) => x[1]).join(" ")).replace(/\s+/g, " ").trim();
      const text = mark ? (NUM_MARK.test(mark) ? mark + " " : "• ") + body : body;
      // the words with their look (new readers send [x, text, bold, italic, colour, xEnd]; older ones only
      // the line's); a word touching the one before it ("2026" + "." in another font) gets no space
      const words = sp.flatMap((x) => (Array.isArray(x[3]) && x[3].length ? x[3].map((w, k, ws) => ({ t: sup(w[1]), b: w[2] != null ? !!w[2] : !!l0.b, i: w[3] != null ? !!w[3] : !!l0.i, c: w[4] != null ? hexOf(w[4]) : hexOf(l0.c),
        glue: k > 0 && ws[k - 1][5] != null && (l0.r ? ws[k - 1][5] - w[0] : w[0] - ws[k - 1][5]) < (x[2] || l0.s) * 0.12, v: w[6] === 1 || w[6] === -1 ? w[6] : 0 })) : [{ t: x[1], b: !!l0.b, i: !!l0.i, c: hexOf(l0.c) }]))
        .filter((w) => w.t && !/^[\uF000-\uF0FF]$/.test(w.t));
      if (text) all.push({ ...l0, x: lx, e: le, mark, markX: mark ? (l0.r ? l0.e : l0.x) : null, page: pi, sp, text, words, top: l0.y - l0.s });
    }
    for (const im of p.imgs || []) if (im && im.b64) all.push({ img: true, page: pi, top: im.y, y: im.y + im.h, x: im.x, e: im.x + im.w, w: im.w, h: im.h, b64: im.b64, s: 0 });
  });
  if (!all.some((l) => !l.img)) return all.filter((l) => l.img).map((l) => ({ type: "image", b64: l.b64, w: l.w, h: l.h }));
  all.sort((a, b) => a.page - b.page || a.top - b.top);
  // v6.8: a running header / footer — the same line (its numbers aside) at the same place at the top or
  // bottom of most pages — becomes the Word file's header / footer (its page number a live PAGE field)
  // instead of text repeated inside the pages
  const running = [];
  if (pages.length >= 2 && pages.every((p) => p.h)) {
    const zone = (l) => (l.y < pages[l.page].h * 0.1 ? "header" : l.top > pages[l.page].h * 0.9 ? "footer" : null);
    const key = (l) => l.text.replace(/\d+/g, "#").trim();
    // (and it stands apart: a clear gap between it and the page's text — the first line of a page's text
    // can repeat word for word on two pages)
    const apart = (l) => { const ls = all.filter((m) => !m.img && m.page === l.page && m !== l); const next = zone(l) === "header" ? ls.filter((m) => m.y > l.y).sort((a, b) => a.y - b.y)[0] : ls.filter((m) => m.y < l.y).sort((a, b) => b.y - a.y)[0]; return !next || Math.abs(next.y - l.y) > Math.max(l.s, next.s) * 1.9; };
    const cand = all.filter((l) => !l.img && zone(l) && l.text.length <= 150 && apart(l));
    for (const l of cand) {
      if (l.run) continue;
      const same = cand.filter((m) => zone(m) === zone(l) && key(m) === key(l) && Math.abs(m.y - l.y) < 8);
      const onPages = new Set(same.map((m) => m.page)).size;
      if (onPages < Math.max(2, Math.ceil(pages.length * 0.5))) continue;
      const num = /#/.test(key(l)) && same.every((m) => (m.text.match(/\d+/g) || []).includes(String(m.page + 1)));
      same.forEach((m) => { m.run = true; });
      running.push({ line: l, kind: zone(l), num });
    }
    for (let k = all.length - 1; k >= 0; k--) if (all[k].run) all.splice(k, 1);
  }
  const lines = all.filter((l) => !l.img);
  // the body text size: the size most of the characters are written in
  const bySize = new Map();
  for (const l of lines) { const k = Math.round(l.s * 2) / 2; bySize.set(k, (bySize.get(k) || 0) + l.text.length); }
  const body = [...bySize].sort((a, b) => b[1] - a[1])[0][0];
  const maxS = Math.max(...lines.map((l) => l.s));
  // the page's text area: where the lines start and end
  const geo = pages.map((p, pi) => {
    const ls = lines.filter((l) => l.page === pi);
    if (!ls.length) return null;
    const hasE = ls.every((l) => l.e != null);
    const L = Math.min(...ls.map((l) => l.x)), R = hasE ? Math.max(...ls.map((l) => l.e)) : null;
    // a mostly right-to-left page: its lines end on the right margin but often never reach the left one —
    // that margin is taken as the mirror of the right one
    const rtl = ls.filter((l) => l.r).length * 2 > ls.length;
    return { L: rtl && R != null && p.w ? Math.min(L, p.w - R) : L, R };
  });
  // the usual distance between two lines of one paragraph, per text size (the most common gap)
  const pitchBy = new Map();
  for (let k = 1; k < lines.length; k++) {
    const a = lines[k - 1], b = lines[k];
    if (a.page !== b.page || Math.abs(a.s - b.s) > 0.5) continue;
    const g = Math.round((b.y - a.y) * 2) / 2;
    if (g <= 0 || g > b.s * 3) continue;
    const key = Math.round(b.s);
    if (!pitchBy.has(key)) pitchBy.set(key, new Map());
    pitchBy.get(key).set(g, (pitchBy.get(key).get(g) || 0) + 1);
  }
  // (the smallest gap that comes back — lines inside a paragraph are the tightest; the most common gap can
  // be the one between paragraphs when a page is lists and one-line paragraphs, and they then ran together)
  const pitch = (s) => {
    const m = pitchBy.get(Math.round(s)); if (!m) return s * 1.2;
    const g = [...m].sort((a, b) => a[0] - b[0]);
    const rep = g.filter(([v, c]) => c >= 2 || g.some(([w, d]) => w !== v && Math.abs(w - v) <= 0.6));
    const best = (rep.length ? rep : g)[0][0];
    return Math.min(Math.max(best, s * 1.0), s * 2.6);
  };
  const LIST = /^\s*(?:(\d{1,2}|[a-z]|[ivx]{1,4})[.)]|[•●▪◦\-–*])\s+/i;
  // v6.8: a numbered line in a bigger font ("1. Summary") is a heading, not a list item
  const isHead = (l) => l.text.length <= 110 && (l.s >= body * 1.18 || (l.b && !LIST.test(l.text) && l.text.length <= 90 && !/[.,;:،]$/.test(l.text)));
  const cols = (l) => l.sp.length;
  const alignOf = (l) => {
    const g = geo[l.page];
    if (!g || g.R == null || l.e == null) return null;
    const left = l.x - g.L, right = g.R - l.e, width = g.R - g.L;
    if (left > 12 && right > 12 && Math.abs(left - right) < Math.max(12, width * 0.05)) return "center";
    if (right <= 3) return left > 24 ? "right" : "full";   // a justified line reaches both margins
    return left < 4 || !l.r ? "left" : "full";
  };
  // a line's words → runs (neighbours with the same look joined)
  const runsOf = (ws) => {
    const out = [];
    for (const w of ws) {
      const last = out[out.length - 1];
      const gap = w.glue ? "" : " ";
      if (last && last.b === w.b && last.i === w.i && last.c === w.c && (last.v || 0) === (w.v || 0)) last.t += gap + w.t;
      else out.push({ t: (last ? gap : "") + w.t, b: w.b, i: w.i, c: w.c, ...(w.v ? { v: w.v } : {}) });
    }
    return out;
  };
  const plain = (runs) => runs.every((r) => !r.b && !r.i && !r.c && !r.v);
  const out = [];
  for (const r of running) {
    const l = r.line, al = alignOf(l), runs = runsOf(l.words);
    const blk = { type: r.kind, text: l.text, size: Math.round(l.s * 2) / 2, align: al === "full" || !al ? (l.r ? "right" : "left") : al, ...(plain(runs) ? {} : { runs }), ...(r.num ? { page: String(l.page + 1) } : {}), at: Math.round(r.kind === "header" ? l.top : pages[l.page].h - l.y - 2) };
    const fam = fontFamily(l.f); if (fam) blk.font = fam;
    if (l.r) blk.rtl = true;
    out.push(blk);
  }
  let para = null, item = null, i = 0, lastLine = null;
  // the block's look from its lines (alignment, indents, spacing, size, font, direction)
  const finish = (blk, ls) => {
    const first = ls[0], rtl = ls.filter((l) => l.r).length * 2 > ls.length;
    const g = geo[first.page];
    blk.size = Math.round(first.s * 2) / 2;
    const fam = fontFamily(first.f); if (fam) blk.font = fam;
    if (rtl) blk.rtl = true;
    const al = ls.map(alignOf);
    if (al[0]) {
      if (ls.length >= 2 && al.slice(0, -1).every((a) => a === "full")) blk.align = "justify";
      else if (ls.every((a, k) => al[k] === "center")) blk.align = "center";
      else if (al[0] === "right" || (al[0] === "full" && rtl)) blk.align = "right";
      else if (al[0] === "center" && ls.length === 1) blk.align = "center";
      else blk.align = rtl ? "right" : "left";
      // indents, from the start side
      if (g && g.R != null && blk.align !== "center") {
        const off = (l) => (rtl ? g.R - l.e : l.x - g.L);
        const rest = ls.length > 1 ? Math.min(...ls.slice(1).map(off)) : off(first);
        const ind = rest > 3 ? Math.round(rest) : 0, fl = Math.round(off(first) - ind);
        if (ind && !(blk.align === (rtl ? "left" : "right"))) blk.ind = ind;
        if (Math.abs(fl) > 3 && ls.length > 1) blk.first = fl;
      }
    }
    if (ls.length > 1) { const gaps = ls.slice(1).map((l, k) => l.y - ls[k].y).filter((x) => x > 0).sort((a, b) => a - b); const pt = gaps[Math.floor(gaps.length / 2)]; if (pt) blk.line = Math.round(pt * 10) / 10; }
    if (lastLine && lastLine.page === first.page) { const gap = first.y - lastLine.y - pitch(first.s); if (gap > 1.5) blk.before = Math.min(72, Math.round(gap)); }
    else if (lastLine && lastLine.page !== first.page) blk.pageBreak = true;
    lastLine = ls[ls.length - 1];
    return blk;
  };
  const flush = () => {
    if (para) { const r = runsOf(para.words); out.push(finish({ type: "p", text: para.text, ...(plain(r) ? {} : { runs: r }) }, para.ls)); para = null; }
    if (item) { const r = runsOf(item.words); Object.assign(item.blk, finish(item.blk, item.ls), plain(r) ? {} : { runs: r }); item = null; }
  };
  while (i < all.length) {
    const l = all[i];
    if (l.img) {
      flush();
      const g = geo[l.page], blk = { type: "image", b64: l.b64, w: l.w, h: l.h };
      if (g && g.R != null) { const left = l.x - g.L, right = g.R - l.e; blk.align = Math.abs(left - right) < 12 && left > 12 ? "center" : right < 6 && left > 24 ? "right" : "left"; if (blk.align === "left" && left > 6) blk.ind = Math.round(left); }
      if (lastLine && lastLine.page !== l.page) blk.pageBreak = true;
      else if (lastLine) { const gap = l.top - lastLine.y - 3; if (gap > 1.5) blk.before = Math.min(72, Math.round(gap)); }
      out.push(blk); lastLine = { ...l, y: l.y, s: 0 };
      i++; continue;
    }
    // a table: this line and the next ones split into 2+ columns that line up
    // (a bold header row counts too: it lines up with the rows under it)
    if (cols(l) >= 2) {
      const rows = [l]; let j = i + 1;
      const cont = new Map();   // a row → its wrapped lines (a cell's text on 2+ lines: "Slew bearing / grease")
      while (j < all.length && !all[j].img && all[j].page === l.page && all[j].y - rows[rows.length - 1].y < rows[rows.length - 1].s * 3.2) {
        const xs = rows[0].sp.map((x) => x[0]);
        const lastRow = rows[rows.length - 1], lastY = cont.has(lastRow) ? cont.get(lastRow).slice(-1)[0].y : lastRow.y;
        // a line of one or two pieces, each starting where a column starts, right under the row: wrapped cell text
        if (rows.length >= 1 && cols(all[j]) < xs.length && all[j].sp.every((x) => xs.some((c) => Math.abs(c - x[0]) < 6)) && all[j].y - lastY < pitch(all[j].s) * 1.25 && Math.abs(all[j].s - lastRow.s) < 1) {
          if (!cont.has(lastRow)) cont.set(lastRow, []);
          cont.get(lastRow).push(all[j]); j++; continue;
        }
        if (cols(all[j]) < 2) break;
        const lined = all[j].sp.filter((x) => xs.some((c) => Math.abs(c - x[0]) < 40)).length;
        if (lined < 2) break;
        rows.push(all[j]); j++;
      }
      if (rows.length >= 2) {
        flush();
        const rtl = rows.filter((r) => r.r).length * 2 > rows.length;
        // columns: the starting x of every span, merged when close
        // columns come from the body rows (a header's titles often sit a little left of the numbers under them)
        const bodyRows = rows.length > 2 || !rows[0].b ? rows.slice(rows[0].b ? 1 : 0) : rows;
        // a text's centre, from its length (a right-to-left span's x is its right edge)
        const mid = (x, t, sz) => x + (rtl ? -1 : 1) * String(t).length * (sz || body) * 0.26;
        const anchors = [], centres = [];
        for (const r of bodyRows) for (const [x, t, sz] of r.sp) if (!anchors.some((a) => Math.abs(a - x) < 24)) { anchors.push(x); centres.push(mid(x, t, sz)); }
        const ord = anchors.map((a, k) => k).sort((p, q) => centres[p] - centres[q]);
        const A = ord.map((k) => anchors[k]), Cn = ord.map((k) => centres[k]);
        anchors.length = 0; anchors.push(...A); centres.length = 0; centres.push(...Cn);
        const bold = [];
        const cellGeo = [];       // per row: each cell's text start / end (for centred or right-aligned columns)
        const cell = (r) => {
          const row = anchors.map(() => ""), rb = anchors.map(() => null), gx = anchors.map(() => null);
          const near = (x, t, sz) => { const m = mid(x, t, sz); let k = 0, best = Infinity; centres.forEach((a, c) => { const d = Math.abs(a - m); if (d < best) { best = d; k = c; } }); return k; };
          // a header with fewer cells than columns ("Control Stimulated" in one span): word by word
          const split = r.sp.length < anchors.length && r.sp.some((x) => Array.isArray(x[3]) && x[3].length > 1);
          for (const sp of r.sp) {
            const parts = split && Array.isArray(sp[3]) && sp[3].length > 1 ? sp[3].map((w) => [w[0], w[1], w[2]]) : [[sp[0], sp[1], Array.isArray(sp[3]) && sp[3].length ? sp[3].every((w) => w[2] != null ? w[2] : r.b) : r.b]];
            const wend = Array.isArray(sp[3]) && sp[3].length && sp[3][sp[3].length - 1][5] != null ? sp[3][sp[3].length - 1][5] : sp[0] + String(sp[1]).length * (sp[2] || body) * 0.5;
            for (const [x, t, b] of parts) { const k = near(x, t, sp[2]); row[k] = row[k] ? row[k] + " " + t : t; rb[k] = rb[k] == null ? !!b : rb[k] && !!b; gx[k] = gx[k] ? [Math.min(gx[k][0], sp[0]), Math.max(gx[k][1], wend)] : [sp[0], wend]; }
          }
          bold.push(rb.map((x) => !!x));
          cellGeo.push(gx);
          return row;
        };
        let trows = rows.map((r) => {
          const row = cell(r);
          for (const c of cont.get(r) || []) { const more = cell(c); bold.pop(); cellGeo.pop(); more.forEach((t, k) => { if (t) row[k] = row[k] ? row[k] + " " + t : t; }); }
          return row;
        });
        // left to right on the page → reading order (a right-to-left table's first column is on the right)
        if (rtl) { trows = trows.map((x) => [...x].reverse()); bold.forEach((x) => x.reverse()); }
        const blk = { type: "table", rows: trows, bold };
        if (rtl) blk.rtl = true;
        // column widths (points), from where the columns start
        const tl = Math.min(...rows.map((r) => r.x)), tr = rows.every((r) => r.e != null) ? Math.max(...rows.map((r) => r.e)) : null;
        if (tr != null && anchors.length >= 2) {
          const edges = rtl ? [...anchors].sort((a, b) => b - a) : [...anchors].sort((a, b) => a - b);
          const w = edges.map((a, k) => (rtl ? a - (k + 1 < edges.length ? edges[k + 1] : tl - 6) : (k + 1 < edges.length ? edges[k + 1] : tr + 6) - a));
          // the last column ends where its longest text ends, not at the table's border: at least as
          // wide as the others on average (within the page)
          const others = w.slice(0, -1), avg = others.reduce((a, x) => a + x, 0) / others.length, g0 = geo[l.page];
          const room = g0 && g0.R != null ? g0.R - g0.L - others.reduce((a, x) => a + x, 0) : Infinity;
          if (w[w.length - 1] < avg) w[w.length - 1] = Math.min(avg, Math.max(w[w.length - 1], room));
          if (w.every((x) => x > 8)) blk.widths = w.map((x) => Math.round(x));
        }
        const g = geo[l.page];
        const lastRowLine = cont.has(rows[rows.length - 1]) ? cont.get(rows[rows.length - 1]).slice(-1)[0] : rows[rows.length - 1];
        const rc = (pages[l.page] && pages[l.page].rects) || [];
        // v6.10: the table's real box, its rules and its shaded rows come from what the page draws (rectangles and lines).
        // The table starts where its border starts — not where its (often centred) text starts — and never leaves the margins.
        const top = rows[0].top - 8, bot = lastRowLine.y + 8;
        const near1 = (r) => r[1] <= bot && r[1] + r[3] >= top;
        const rules = rc.filter((r) => ((r[3] <= 1.6 && r[2] >= 30) || (r[2] <= 1.6 && r[3] >= 6)) && near1(r));
        const hor = rules.filter((r) => r[3] <= 1.6), ver = rules.filter((r) => r[2] <= 1.6);
        if (g && !rtl && (hor.length >= 2 || (hor.length >= 1 && ver.length >= 2))) {
          const bx0 = Math.min(...rules.map((r) => r[0])), bx1 = Math.max(...rules.map((r) => r[0] + r[2]));
          blk.ind = Math.max(0, Math.round(bx0 - g.L));
          const inner = [...new Set(ver.filter((r) => r[0] > bx0 + 4 && r[0] < bx1 - 4).map((r) => Math.round(r[0] * 2) / 2))].sort((a, b) => a - b);
          const nCols = Math.max(...trows.map((r) => r.length));
          let edges = null;
          if (inner.length === nCols - 1) edges = [bx0, ...inner, bx1];
          else if (blk.widths && blk.widths.length === nCols) { const tot = blk.widths.reduce((a, x) => a + x, 0); edges = [bx0]; blk.widths.forEach((x) => edges.push(edges[edges.length - 1] + x * (bx1 - bx0) / tot)); }
          if (edges) blk.widths = edges.slice(1).map((e, k) => Math.round(e - edges[k]));
          const rc0 = hor[0] || ver[0];
          blk.border = { c: ([(rc0[4] >> 16) & 255, (rc0[4] >> 8) & 255, rc0[4] & 255].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase()), sz: Math.max(2, Math.round(Math.min(rc0[2], rc0[3]) * 8)) };
          // each column: text centred in its cell, or against its right edge
          if (edges) {
            const al = edges.slice(1).map((e, k) => {
              const a = edges[k], w = e - a, c = a + w / 2; let ce = 0, ri = 0, n = 0;
              for (const gx of cellGeo) { const q = gx[k]; if (!q) continue; n++; const mid = (q[0] + q[1]) / 2; if (Math.abs(mid - c) < w * 0.12) ce++; else if (e - q[1] < 8 && q[0] - a > w * 0.25) ri++; }
              return n && ce >= n * 0.6 ? "center" : n && ri >= n * 0.6 ? "right" : "left";
            });
            if (al.some((x) => x !== "left")) blk.align = al;
          }
        } else if (g && !rtl && tl - g.L > 12) blk.ind = Math.round(tl - g.L - 5);
        // shaded rows: a filled rectangle behind a row's text, as wide as most of the table
        const fills = rc.filter((r) => r[4] >= 0 && r[4] !== 0xFFFFFF && r[3] > 3 && r[2] > 40 && near1(r));
        if (fills.length) {
          const shade = rows.map((r) => { const f = fills.find((q) => q[1] <= r.y - r.s * 0.3 && q[1] + q[3] >= r.y - r.s * 0.3 && q[2] >= (blk.widths ? blk.widths.reduce((a, x) => a + x, 0) * 0.6 : 100)); return f ? [(f[4] >> 16) & 255, (f[4] >> 8) & 255, f[4] & 255].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase() : null; });
          if (shade.some(Boolean)) blk.shade = shade;
        }
        blk.size = Math.round(bodyRows[0].s * 2) / 2;
        if (lastLine && lastLine.page === l.page) { const gap = l.y - lastLine.y - pitch(l.s); if (gap > 1.5) blk.before = Math.min(72, Math.round(gap)); }
        else if (lastLine) blk.pageBreak = true;
        lastLine = lastRowLine;
        out.push(blk);
        i = j; continue;
      }
    }
    const prev = i > 0 ? all[i - 1] : null;
    const gap = prev && !prev.img && prev.page === l.page ? l.y - prev.y : Infinity;
    const near = gap <= pitch(l.s) * 1.3 + 0.5;
    // v6.10: a bold line that the next line CONTINUES (same size, close below, starting in lower case) is a bold paragraph's
    // first line, not a heading ("Substrate decreases → … → product / continues accumulating …")
    const nx = all[i + 1], boldWraps = l.b && l.s < body * 1.18 && nx && !nx.img && nx.page === l.page && nx.y - l.y <= pitch(l.s) * 1.3 + 0.5 && Math.abs(nx.s - l.s) < 0.6 && /^\p{Ll}/u.test(nx.text);
    if (isHead(l) && !boldWraps) {
      const lastH = !para && !item && out[out.length - 1];
      // a heading that wraps onto a second line of the same size
      if (lastH && /^h/.test(lastH.type) && prev && !prev.img && near && Math.abs(prev.s - l.s) < 0.6 && isHead(prev)) { lastH.text += " " + l.text; if (lastH.runs) lastH.runs.push(...runsOf(l.words).map((r, k) => (k ? r : { ...r, t: " " + r.t.trim() }))); lastLine = l; i++; continue; }
      flush();
      const type = l.s >= maxS - 0.5 && l.s >= body * 1.35 ? "h1" : l.s >= body * 1.18 ? "h2" : "h3";
      const r = runsOf(l.words);
      out.push(finish({ type, text: l.text, ...(r.some((x) => x.i || x.c || !x.b) ? { runs: r } : {}) }, [l]));
      i++; continue;
    }
    const m = l.text.match(LIST);
    // v6.10: a bold "a." / "1." label at the margin ("a. Calculate …") is the paragraph's own label, not a list with a
    // tab and a hanging indent: Word shows it as written (a bold label, then the text)
    const g0 = geo[l.page];
    const labelled = m && m[1] && !l.mark && !/[•●▪◦\-–*]/.test(m[0]) && l.words.length && l.words[0].b && g0 && (l.r ? g0.R != null && l.e != null && g0.R - l.e < 4 : l.x - g0.L < 4);
    if (labelled) { flush(); para = { text: l.text, s: l.s, words: [...l.words], ls: [l], label: true }; i++; continue; }
    if (m) {
      flush();
      const num = m[1] || "";
      const words = [...l.words]; if (!l.mark && words.length && LIST.test(words[0].t + " ")) words.shift();
      const blk = { type: "li", text: l.text.slice(m[0].length).trim(), ...(num ? { num } : {}) };
      if (l.markX != null) Object.defineProperty(blk, "markX", { value: l.markX, enumerable: false });
      out.push(blk);
      item = { blk, ls: [l], words, x: l.x, e: l.e };
      i++; continue;
    }
    // a wrapped line of the list item above (same size, close below, not starting a new item, starting
    // where the item's text starts — not back at the margin)
    if (item && near && Math.abs(l.s - body) < 1.5 && (l.r ? l.e == null || item.e == null || l.e < item.e - 3 : l.x > item.x + 3)) {
      item.blk.text += " " + l.text; item.words.push(...l.words); item.ls.push(l); i++; continue;
    }
    if (item) flush();
    const lastPara = para && para.ls[para.ls.length - 1];
    // v6.10: the line above ended well short of the margin — the next word would have fitted on it — so that paragraph ended
    // there ("Product A: …" / "Product B: …" were run together)
    const endedShort = (() => {
      if (!para || !lastPara) return false;
      const g = geo[lastPara.page]; if (!g || g.R == null) return false;
      const w0 = (l.sp[0] && Array.isArray(l.sp[0][3]) && l.sp[0][3][0]) ? Math.abs((l.sp[0][3][0][5] ?? l.sp[0][3][0][0]) - l.sp[0][3][0][0]) : 0;
      const word = Math.max(w0, Math.min(l.text.split(" ")[0].length, 14) * l.s * 0.45) + l.s * 0.5;
      const room = lastPara.r ? lastPara.x - g.L : g.R - lastPara.e;
      return room > word + 6 && alignOf(lastPara) !== "center" && alignOf(l) !== "center";
    })();
    // the same paragraph: close below, same size, and (after its first two lines) starting where they start
    if (para && near && !endedShort && Math.abs(l.s - para.s) < 1 && !(para.ls.length >= 2 && !l.r && Math.abs(l.x - lastPara.x) > 6 && alignOf(l) !== "center") && !(para.ls.length >= 2 && l.r && l.e != null && lastPara.e != null && Math.abs(l.e - lastPara.e) > 6 && alignOf(l) !== "center")) {
      para.text += (/-$/.test(para.text) && !/\s-$/.test(para.text) ? "" : " ") + l.text; para.text = para.text.replace(/(\w)- (\w)/g, "$1-$2");
      para.words.push(...l.words); para.ls.push(l); i++; continue;
    }
    flush();
    para = { text: l.text, s: l.s, words: [...l.words], ls: [l] }; i++;
  }
  flush();
  // nested lists: a bullet further in than the list's first bullets is one level down (up to 3 levels)
  for (let k = 0; k < out.length; ) {
    if (out[k].type !== "li") { k++; continue; }
    let e = k; while (e < out.length && out[e].type === "li") e++;
    const xs = out.slice(k, e).map((b) => b.markX).filter((x) => x != null);
    if (xs.length) {
      const rtl = out[k].rtl, base = rtl ? Math.max(...xs) : Math.min(...xs);
      for (let q = k; q < e; q++) { const b = out[q]; if (b.markX == null) continue; const lv = Math.min(2, Math.round(Math.abs(b.markX - base) / 18)); if (lv) { b.level = lv; delete b.ind; } }
    }
    k = e;
  }
  return out;
}

/** v6.8: the Word page for a PDF — its size, its margins (where the text sits) and the body font. */
export function pdfDocOptions(pages) {
  // the margins come from the page's own text: a running header / footer sits in the margin
  const hfb = pdfLinesToBlocks(pages).filter((b) => b.type === "header" || b.type === "footer").map((b) => b.text.replace(/\d+/g, "#"));
  const ls = pages.flatMap((p) => (p.lines || []).map((l) => ({ ...l, p }))).filter((l) => !hfb.includes(l.sp.map((x) => x[1]).join(" ").replace(/\s+/g, " ").trim().replace(/\d+/g, "#")));
  const p0 = pages.find((p) => p.w && p.h);
  if (!ls.length || !p0) return {};
  const sizes = new Map(), fonts = new Map();
  for (const l of ls) { const n = l.sp.reduce((a, x) => a + String(x[1]).length, 0); sizes.set(Math.round(l.s * 2) / 2, (sizes.get(Math.round(l.s * 2) / 2) || 0) + n); const f = fontFamily(l.f); if (f) fonts.set(f, (fonts.get(f) || 0) + n); }
  const top = Math.min(...ls.map((l) => l.y - l.s)), bottom = Math.max(...ls.map((l) => l.y));
  const left = Math.min(...ls.map((l) => l.x)), right = ls.every((l) => l.e != null) ? Math.max(...ls.map((l) => l.e)) : p0.w - left;
  const clamp = (x, a, b) => Math.round(Math.min(b, Math.max(a, x)));
  return { page: { w: p0.w, h: p0.h, top: clamp(top - 4, 18, 144), bottom: clamp(p0.h - bottom - 8, 18, 108), left: clamp(left, 18, 144), right: clamp(p0.w - right - 2, 18, 144) },
    body: [...sizes].sort((a, b) => b[1] - a[1])[0][0], font: fonts.size ? [...fonts].sort((a, b) => b[1] - a[1])[0][0] : null, exact: true };
}

/** Blocks → plain text (Markdown-style headings and bullets). */
export function blocksToText(blocks) {
  return blocks.filter((b) => !["header", "footer", "image", "pagebreak"].includes(b.type)).map((b) => b.type === "table" ? b.rows.map((r) => r.join(" | ")).join("\n")
    : b.type === "li" ? "- " + b.text : /^h\d$/.test(b.type) ? "#".repeat(+b.type[1]) + " " + b.text : b.text).join("\n\n");
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Blocks → a Word document (.docx bytes). Arabic paragraphs are right-to-left.
 *  v5.40 (reports): also "title", "subtitle", "caption", "pagebreak" and "image" ({b64 PNG, w, h}) blocks,
 *  and o.accent (a hex colour for the headings).
 *  v6.8: everything a block carries from a PDF is written — runs (bold / italic / colour per word),
 *  align, ind / first (indents, pt), before (space above, pt), line (line pitch, pt), size (pt), font,
 *  rtl, pageBreak; tables with rtl, widths (pt) and bold cells; pictures at their size and place.
 *  o.page {w, h, top, right, bottom, left} (pt) sets the page, o.body / o.font the normal text, and
 *  o.exact drops Word's own paragraph spacing so the PDF's spacing is what shows.
 *  Arabic bold / italic / size use Word's complex-script tags (bCs, iCs, szCs) — without them a bold
 *  Arabic word shows plain. */
export function docxFromBlocks(blocks, title = "Document", o = {}) {
  const imgs = [];
  const tw = (pt) => Math.round(pt * 20);
  const run1 = (t, f = {}, sup0) => {
    const sup = sup0 || f.v === 1, sub = f.v === -1;
    const rtl = isAr(t);
    const fontX = f.font ? `<w:rFonts w:ascii="${esc(f.font)}" w:hAnsi="${esc(f.font)}" w:cs="${esc(f.font)}"/>` : "";
    const sz = f.size ? `<w:sz w:val="${Math.round(f.size * 2)}"/><w:szCs w:val="${Math.round(f.size * 2)}"/>` : "";
    return `<w:r><w:rPr>${fontX}${f.b ? "<w:b/><w:bCs/>" : f.offB ? '<w:b w:val="0"/><w:bCs w:val="0"/>' : ""}${f.i ? "<w:i/><w:iCs/>" : ""}${f.c ? `<w:color w:val="${f.c}"/>` : ""}${sz}${rtl ? "<w:rtl/>" : ""}${sup ? '<w:vertAlign w:val="superscript"/>' : sub ? '<w:vertAlign w:val="subscript"/>' : ""}</w:rPr>${String(t).split("\n").map((x, i) => (i ? "<w:br/>" : "") + `<w:t xml:space="preserve">${esc(x)}</w:t>`).join("")}</w:r>`;
  };
  // v5.41: "2^(−ΔΔCt)" (a superscript read from a PDF) is written as a real superscript
  const run = (t, f) => String(t).split(/\^\(([^()]{1,40})\)/).map((x, i) => (x ? run1(x, f, i % 2 === 1) : "")).join("");
  const runs = (b, base = {}) => (b.runs && b.runs.length ? b.runs.map((r) => run(r.t, { ...base, b: r.b || base.b, i: r.i || base.i, c: r.c || base.c, ...(r.v ? { v: r.v } : {}) })).join("") : run(b.text, base));
  // paragraph properties: direction, alignment (a right-to-left paragraph's start is its right side —
  // Word reads "left"/"right" there the other way round), indents, spacing, a new page before it
  const pPr = (b, style, bullet, text) => {
    const rtl = b.rtl || isAr(text || b.text || "");
    const jc = !b.align ? "" : b.align === "center" ? "center" : b.align === "justify" ? "both" : rtl ? (b.align === "left" ? "right" : "") : (b.align === "right" ? "right" : "");
    const jcX = jc ? `<w:jc w:val="${jc}"/>` : "";
    // (in a right-to-left paragraph Word's "left" indent is the start side, like jc above)
    const ind = b.ind || b.first ? `<w:ind w:left="${tw(b.ind || 0)}"${b.first > 0 ? ` w:firstLine="${tw(b.first)}"` : b.first < 0 ? ` w:hanging="${tw(-b.first)}"` : ""}/>` : "";
    const sp = b.before != null || b.line || o.exact ? `<w:spacing w:before="${tw(b.before || 0)}" w:after="0"${b.line && b.size && b.line > b.size * 1.2 ? ` w:line="${Math.round(240 * b.line / (b.size * 1.16))}" w:lineRule="auto"` : ""}/>` : "";
    return `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${b.pageBreak ? "<w:pageBreakBefore/>" : ""}${bullet ? `<w:numPr><w:ilvl w:val="${b.level || 0}"/><w:numId w:val="1"/></w:numPr>` : ""}${sp}${bullet ? "" : b.level && !b.ind ? `<w:ind w:left="${720 * (b.level + 1)}" w:hanging="360"/>` : ind}${rtl ? "<w:bidi/>" : ""}${jcX}</w:pPr>`;
  };
  const fmt = (b) => ({ ...(b.size ? { size: b.size } : {}), ...(b.font ? { font: b.font } : {}) });
  // bullets are a real Word list (numbering.xml); numbered items keep the source's own numbers ("3.")
  // (a heading style is bold: a heading the PDF shows plain says so)
  const para = (t, style, bullet, b = { text: t }) => { const f = { ...fmt(b), ...(b.runs && /^(Heading|Title)/.test(style || "") ? { offB: true } : {}) }; return `<w:p>${pPr(b, style, bullet, t)}${b.runs ? runs(b, f) : run(t, f)}</w:p>`; };
  const hf = { header: blocks.find((b) => b.type === "header"), footer: blocks.find((b) => b.type === "footer") };
  // a header / footer paragraph; its page number is Word's PAGE field (it counts in the Word file too)
  const hfXml = (b, tag) => {
    const f = fmt(b), parts = b.page ? String(b.text).split(new RegExp("(?<!\\d)" + b.page + "(?!\\d)")) : [b.text];
    const inner = parts.map((x, k) => (k ? `<w:fldSimple w:instr=" PAGE "><w:r><w:rPr>${f.size ? `<w:sz w:val="${Math.round(f.size * 2)}"/>` : ""}</w:rPr><w:t>${b.page}</w:t></w:r></w:fldSimple>` : "") + (x ? run(x, f) : "")).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p>${pPr({ ...b, before: 0 }, null, false, b.text)}${inner}</w:p></w:${tag}>`;
  };
  const body = blocks.filter((b) => b.type !== "header" && b.type !== "footer").map((b) => {
    if (b.type === "table") {
      const w = Math.max(...b.rows.map((r) => r.length));
      const rtl = b.rtl || b.rows.some((r) => r.some((c) => isAr(c || "")));
      let widths = b.widths && b.widths.length === w ? b.widths.map(tw) : Array(w).fill(Math.floor(9638 / w));
      // v6.10: a table never leaves the page: its indent plus its width fit the text area (scaled down if not)
      { const room = (o.page ? (o.page.w - o.page.left - o.page.right) : 480) * 20 - tw(b.ind || 0), sum = widths.reduce((a, x) => a + x, 0); if (b.widths && sum > room && room > 600) widths = widths.map((x) => Math.floor(x * room / sum)); }
      const cf = fmt(b);
      // the space above a table (a table has none of its own): an empty paragraph exactly that tall
      return (b.pageBreak || b.before ? `<w:p><w:pPr>${b.pageBreak ? "<w:pageBreakBefore/>" : ""}<w:spacing w:before="0" w:after="0" w:line="${Math.max(20, tw(b.before || 1))}" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>` : "") +
        `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>${rtl ? "<w:bidiVisual/>" : ""}<w:tblW w:w="${b.widths ? widths.reduce((a, x) => a + x, 0) : 0}" w:type="${b.widths ? "dxa" : "auto"}"/>${b.ind ? `<w:tblInd w:w="${tw(b.ind)}" w:type="dxa"/>` : ""}<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="${b.border ? b.border.sz : 4}" w:space="0" w:color="${b.border ? b.border.c : "999999"}"/>`).join("")}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths.map((x) => `<w:gridCol w:w="${x}"/>`).join("")}</w:tblGrid>` +
        b.rows.map((r, ri) => `<w:tr>${Array.from({ length: w }, (_, ci) => `<w:tc><w:tcPr><w:tcW w:w="${widths[ci]}" w:type="dxa"/>${b.shade && b.shade[ri] ? `<w:shd w:val="clear" w:color="auto" w:fill="${b.shade[ri]}"/>` : ""}</w:tcPr><w:p><w:pPr>${o.exact ? '<w:spacing w:before="0" w:after="0"/>' : ""}${isAr(r[ci] || "") || rtl ? "<w:bidi/>" : ""}${Array.isArray(b.align) && b.align[ci] && b.align[ci] !== "left" ? `<w:jc w:val="${b.align[ci]}"/>` : ""}</w:pPr>${run(r[ci] || "", { ...cf, b: b.bold ? !!(b.bold[ri] && b.bold[ri][ci]) : ri === 0 })}</w:p></w:tc>`).join("")}</w:tr>`).join("") + `</w:tbl>` + (o.exact ? "" : "<w:p/>");
    }
    if (b.type === "pagebreak") return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    if (b.type === "image" && b.b64) {
      // v6.8: a picture keeps its size (points) and place; JPEG or PNG
      const ext = /^data:image\/jpe?g/i.test(b.b64) ? "jpeg" : "png";
      const n = imgs.push({ b64: b.b64, ext }), maxW = o.page ? (o.page.w - o.page.left - o.page.right) * 12700 : 6120000;
      const cx = b.w && o.page ? Math.min(Math.round(b.w * 12700), maxW) : 6120000, cy = Math.round(cx * (b.h || 1) / (b.w || 1));
      return `<w:p>${pPr({ ...b, align: b.align || (o.page ? "left" : "center") }, null, false, "")}<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="image${n}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
    if (b.type === "title") return para(b.text, "Title", false, b);
    if (b.type === "subtitle") return para(b.text, "Subtitle", false, b);
    if (b.type === "caption") return para(b.text, "Caption", false, b);
    if (b.type === "li") return b.num ? para(b.num + ".\t" + b.text, "ListBullet", false, b.runs ? { ...b, runs: [{ t: b.num + ".\t" }, ...b.runs] } : { ...b, text: b.num + ".\t" + b.text }) : para(b.text, "ListBullet", true, b);
    if (/^h[1-3]$/.test(b.type)) return para(b.text, "Heading" + b.type[1], false, b);
    return para(b.text, null, false, b);
  }).join("");
  const hfRefs = (hf.header ? '<w:headerReference w:type="default" r:id="rIdHdr"/>' : "") + (hf.footer ? '<w:footerReference w:type="default" r:id="rIdFtr"/>' : "");
  const pg = o.page ? `${hfRefs}<w:pgSz w:w="${tw(o.page.w)}" w:h="${tw(o.page.h)}"${o.page.w > o.page.h ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${tw(o.page.top)}" w:right="${tw(o.page.right)}" w:bottom="${tw(o.page.bottom)}" w:left="${tw(o.page.left)}" w:header="${tw(hf.header ? Math.max(12, hf.header.at || 24) : 18)}" w:footer="${tw(hf.footer ? Math.max(12, hf.footer.at || 24) : 18)}" w:gutter="0"/>`
    : `<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"${imgs.length || hfRefs ? ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' : ""}><w:body>${body}<w:sectPr>${pg}</w:sectPr></w:body></w:document>`;
  const style = (id, name, size, bold, extra = "", color = /^Heading/.test(id) ? o.accent : null) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${/^Heading/.test(id) ? '<w:next w:val="Normal"/>' : ""}<w:pPr>${/^Heading/.test(id) ? "<w:keepNext/>" : ""}${extra.includes("<w:spacing") ? "" : o.exact ? "" : `<w:spacing w:before="${bold ? 240 : 0}" w:after="120"/>`}${extra}${/^Heading(\d)/.test(id) ? `<w:outlineLvl w:val="${+id.slice(-1) - 1}"/>` : ""}</w:pPr><w:rPr>${bold ? "<w:b/><w:bCs/>" : ""}${color ? `<w:color w:val="${color}"/>` : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
  const bodySz = o.body ? Math.round(o.body * 2) : 22, font = o.font ? esc(o.font) : "Calibri";
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${o.font ? font : "Arial"}"/><w:sz w:val="${bodySz}"/><w:szCs w:val="${bodySz}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>${o.exact ? '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>' : '<w:spacing w:after="120" w:line="276" w:lineRule="auto"/>'}</w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` + style("Heading1", "heading 1", 32, true) + style("Heading2", "heading 2", 28, true) + style("Heading3", "heading 3", 24, true) +
    style("ListBullet", "List Bullet", bodySz, false, `<w:ind w:left="720" w:hanging="360"/>`) +
    style("Title", "Title", 56, true, `<w:spacing w:before="2400" w:after="240"/>`, o.accent) + style("Subtitle", "Subtitle", 30, false, `<w:spacing w:after="480"/>`, "595959") + style("Caption", "caption", 18, false, `<w:jc w:val="center"/>`, "595959") + `<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>`;
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imgs.some((x) => x.ext === "png") ? '<Default Extension="png" ContentType="image/png"/>' : ""}${imgs.some((x) => x.ext === "jpeg") ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : ""}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${hf.header ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ""}${hf.footer ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ""}</Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: "word/_rels/document.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${imgs.map((x, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${o.page ? "image" : "chart"}${i + 1}.${x.ext}"/>`).join("")}${hf.header ? '<Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : ""}${hf.footer ? '<Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : ""}</Relationships>` },
    { name: "word/document.xml", data: doc },
    { name: "word/styles.xml", data: styles },
    { name: "word/numbering.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${["•", "◦", "▪"].map((c, k) => `<w:lvl w:ilvl="${k}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${c}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (k + 1)}" w:hanging="360"/></w:pPr></w:lvl>`).join("")}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>` },
    { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title><dc:creator>Attune</dc:creator></cp:coreProperties>` },
    ...(hf.header ? [{ name: "word/header1.xml", data: hfXml(hf.header, "hdr") }] : []), ...(hf.footer ? [{ name: "word/footer1.xml", data: hfXml(hf.footer, "ftr") }] : []),
    ...imgs.map((x, i) => ({ name: `word/media/${o.page ? "image" : "chart"}${i + 1}.${x.ext}`, data: b64ToBytes(String(x.b64).replace(/^data:[^,]*,/, "")) })),
  ];
  return zipStore(files);
}

/** v6.8: a PDF (the phone's pages with their layout) → a Word file that looks like it. */
export function pdfToDocx(pages, title = "Document") {
  return docxFromBlocks(pdfLinesToBlocks(pages), title, pdfDocOptions(pages));
}

const unxml = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function paraText(p) {
  let t = "";
  for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g)) t += m[1] != null ? unxml(m[1]) : /tab/.test(m[0]) ? "\t" : "\n";
  return t;
}

/** A Word document (.docx bytes) → blocks. */
export async function docxToBlocks(bytes) {
  return (await docxRead(bytes)).blocks;
}

/**
 * v6.8 — a Word document read with its look (Ali: "all file converters … with formatting and spacing and
 * everything"): each word's bold / italic / underline / colour / size / font (runs), the paragraph's
 * alignment (as seen: a right-to-left paragraph's "left" is its start), indents, space before / after and
 * line spacing, headings (their style's size), bullets and numbers (the real "3." or "b)" Word shows, list
 * levels), tables (column widths, merged cells, bold cells, right-to-left), pictures at their size, page
 * breaks, the page size and margins, the header / footer (a PAGE field kept as the page number) and the
 * document's font and size. Empty paragraphs are not blocks — their height becomes the next one's space.
 * → { blocks, opts } (opts as pdfDocOptions: page, body, font, exact)
 */
export async function docxRead(bytes) {
  const z = await unzip(bytes);
  const xml = z.get("word/document.xml");
  if (!xml) throw new Error("That file isn't a Word document.");
  const body = dec(xml);
  const attr = (x, tag, a = "val") => { const m = String(x || "").match(new RegExp(`<w:${tag}\\b[^>]*?\\bw:${a}="([^"]*)"`)); return m ? m[1] : null; };
  const has = (x, tag) => { const m = String(x || "").match(new RegExp(`<w:${tag}(?:\\s[^>]*?)?/?>`)); return m ? !/w:val="(?:0|false|none)"/.test(m[0]) : null; };
  const inner = (x, tag) => { const m = String(x || "").match(new RegExp(`<w:${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</w:${tag}>`)); return m ? m[1] : ""; };
  const tw = (v) => (v == null ? null : +v / 20);   // twips → points
  // ---- styles: each style's paragraph and run look, with what it is based on ----
  const stylesXml = z.get("word/styles.xml") ? dec(z.get("word/styles.xml")) : "";
  // theme fonts ("+Headings" / "+Body")
  const themeXml = [...z.keys()].filter((k) => /^word\/theme\/theme\d*\.xml$/.test(k)).map((k) => dec(z.get(k)))[0] || "";
  const themeFont = { major: ((themeXml.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]*)"/) || [])[1]) || null, minor: ((themeXml.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]*)"/) || [])[1]) || null };
  const rPrOf = (x) => { const r = inner(x, "rPr"); if (!r) return {}; const o = {};
    const th = attr(r, "rFonts", "asciiTheme") || attr(r, "rFonts", "hAnsiTheme"); if (th) { const f = /^major/.test(th) ? themeFont.major : themeFont.minor; if (f) o.font = f; } const b = has(r, "b"); if (b != null) o.b = b; const i = has(r, "i"); if (i != null) o.i = i; const u = attr(r, "u"); if (u && u !== "none") o.u = true;
    const sz = attr(r, "sz") || attr(r, "szCs"); if (sz) o.size = +sz / 2; const c = attr(r, "color"); if (c && c !== "auto" && /^[0-9A-Fa-f]{6}$/.test(c)) o.c = c.toUpperCase(); const f = attr(r, "rFonts", "ascii") || attr(r, "rFonts", "hAnsi"); if (f) o.font = f; return o; };
  const pPrOf = (x) => { const p = inner(x, "pPr"); if (!p) return {}; const o = {}; const jc = attr(p, "jc"); if (jc) o.jc = jc; if (has(p, "bidi")) o.bidi = true;
    const ind = (p.match(/<w:ind\b[^>]*>/) || [""])[0]; const L = attr(ind, "ind", "left") || attr(ind, "ind", "start"), R = attr(ind, "ind", "right") || attr(ind, "ind", "end"), F = attr(ind, "ind", "firstLine"), H = attr(ind, "ind", "hanging");
    if (L) o.ind = tw(L); if (R) o.indR = tw(R); if (F) o.first = tw(F); if (H) o.first = -tw(H);
    const sp = (p.match(/<w:spacing\b[^>]*>/) || [""])[0]; const B = attr(sp, "spacing", "before"), A = attr(sp, "spacing", "after"), Ln = attr(sp, "spacing", "line"), LR = attr(sp, "spacing", "lineRule");
    if (B != null) o.before = tw(B); if (A != null) o.after = tw(A); if (Ln) o.lineV = +Ln, o.lineRule = LR || "auto";
    const ol = attr(p, "outlineLvl"); if (ol != null) o.outline = +ol; if (has(p, "pageBreakBefore")) o.pageBreak = true; if (has(p, "contextualSpacing")) o.ctx = true;
    const num = inner(p, "numPr"); if (num) { o.numId = attr(num, "numId"); o.ilvl = +(attr(num, "ilvl") || 0); } return o; };
  const styles = new Map();
  for (const m of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const id = (m[1].match(/w:styleId="([^"]+)"/) || [])[1]; if (!id) continue;
    styles.set(id, { name: attr(m[2], "name") || id, based: attr(m[2], "basedOn"), p: pPrOf(m[2]), r: rPrOf(m[2]), type: (m[1].match(/w:type="([^"]+)"/) || [])[1] });
  }
  const dflt = inner(stylesXml, "docDefaults");
  const baseR = { size: 10, ...rPrOf(inner(dflt, "rPrDefault")) }, baseP = pPrOf(inner(dflt, "pPrDefault"));
  const normal = [...styles.entries()].find(([id, s]) => s.type === "paragraph" && /^Normal$/i.test(s.name)) || [null, null];
  const chain = (id, seen = new Set()) => { const s = id && styles.get(id); if (!s || seen.has(id)) return []; seen.add(id); return [...chain(s.based, seen), s]; };
  const styleLook = (id) => { const c = chain(id || normal[0]); return { p: Object.assign({}, baseP, ...c.map((s) => s.p)), r: Object.assign({}, baseR, ...c.map((s) => s.r)), name: (c[c.length - 1] || {}).name || "" }; };
  // ---- numbering: what Word shows before each item ----
  const numXml = z.get("word/numbering.xml") ? dec(z.get("word/numbering.xml")) : "";
  const abstract = new Map();
  for (const m of numXml.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
    const lv = new Map();
    for (const l of m[2].matchAll(/<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g)) lv.set(+l[1], { fmt: attr(l[2], "numFmt") || "decimal", text: attr(l[2], "lvlText") || "", start: +(attr(l[2], "start") || 1) });
    abstract.set(m[1], lv);
  }
  const nums = new Map();
  for (const m of numXml.matchAll(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g)) nums.set(m[1], attr(m[2], "abstractNumId"));
  const counters = new Map();
  const roman = (n) => { const r = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]; let s = ""; for (const [v, t] of r) while (n >= v) { s += t; n -= v; } return s; };
  const fmtNum = (n, f) => (f === "lowerLetter" ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : f === "upperLetter" ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : f === "lowerRoman" ? roman(n) : f === "upperRoman" ? roman(n).toUpperCase() : f === "arabicAbjad" || f === "arabicAlpha" ? "أبجدهوزحطيكلمنسعفصقرشتثخذضظغ"[(n - 1) % 28] : String(n));
  const marker = (numId, ilvl) => {
    const lv = abstract.get(nums.get(numId)); const L = lv && lv.get(ilvl);
    if (!L || L.fmt === "none") return null;
    if (L.fmt === "bullet") return { bullet: true };
    const key = numId + ":" + ilvl, c = counters.get(numId) || [];
    c[ilvl] = (c[ilvl] || (L.start - 1)) + 1; for (let k = ilvl + 1; k < 9; k++) c[k] = 0; counters.set(numId, c);
    const txt = L.text.replace(/%(\d)/g, (_, d) => { const k = +d - 1, LL = lv.get(k); return fmtNum(c[k] || (LL ? LL.start : 1), LL ? LL.fmt : "decimal"); });
    return { num: txt.replace(/[.)]\s*$/, ""), sep: (txt.match(/[.)]\s*$/) || ["."])[0].trim() || "." };
  };
  // ---- pictures ----
  const relsOf = (path) => { const r = z.get(path) ? dec(z.get(path)) : ""; const m = new Map(); for (const x of r.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) m.set(x[1], x[2]); for (const x of r.matchAll(/<Relationship\b[^>]*Target="([^"]+)"[^>]*Id="([^"]+)"/g)) m.set(x[2], x[1]); return m; };
  const rels = relsOf("word/_rels/document.xml.rels");
  const picture = (dr) => {
    const id = (dr.match(/r:embed="([^"]+)"/) || [])[1], ext = dr.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
    const t = id && rels.get(id); if (!t) return null;
    const file = z.get("word/" + t.replace(/^\.?\//, "").replace(/^\/word\//, ""));
    if (!file || file.length > 8e6) return null;
    const mime = /\.jpe?g$/i.test(t) ? "image/jpeg" : /\.png$/i.test(t) ? "image/png" : /\.gif$/i.test(t) ? "image/gif" : null;
    if (!mime) return null;
    return { type: "image", b64: `data:${mime};base64,` + bytesToB64(file), ...(ext ? { w: +ext[1] / 12700, h: +ext[2] / 12700 } : {}) };
  };
  // ---- one paragraph → a block (and the pictures in it) ----
  const runsIn = (x, look) => {
    const out = [], pics = []; let pageAfter = false;
    // (a PAGE field as one element: its shown number inside it is not text)
    for (const m of x.matchAll(/<w:fldSimple\b[^>]*w:instr="\s*PAGE\b[^"]*"[^>]*(?:\/>|>[\s\S]*?<\/w:fldSimple>)|<w:r\b[\s\S]*?<\/w:r>/g)) {
      const r = m[0];
      if (r.startsWith("<w:fldSimple")) { out.push({ t: "\u0000PAGE\u0000", ...look }); continue; }
      const rs = { ...look, ...(inner(r, "rStyle") ? {} : {}), ...rPrOf(r) };
      if (/<w:instrText[^>]*>\s*PAGE\b/.test(r)) { out.push({ t: "\u0000PAGE\u0000", ...rs, field: true }); continue; }
      let t = "";
      for (const k of r.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\b[^>]*\/>|<w:cr\/>|<w:drawing>[\s\S]*?<\/w:drawing>/g)) {
        if (k[1] != null) t += unxml(k[1]);
        else if (/^<w:tab/.test(k[0])) t += "\t";
        else if (/^<w:drawing/.test(k[0])) { const p = picture(k[0]); if (p) pics.push(p); }
        else if (/w:type="page"/.test(k[0])) pageAfter = true;
        else t += "\n";
      }
      if (t) out.push({ t, ...rs });
    }
    // a PAGE field written as begin / instrText / separate / result / end: its result ("1") is dropped
    const clean = []; let skip = false;
    for (const r of out) { if (r.field) { clean.push(r); skip = true; continue; } if (skip && /^\d+$/.test(r.t.trim())) { skip = false; continue; } skip = false; clean.push(r); }
    return { runs: clean, pics, pageAfter };
  };
  const blocks = [];
  let pendingSpace = 0, pageBreakNext = false, lastStyle = null, lastBlk = null;
  const para = (x) => {
    const pp = pPrOf(x), sid = attr(inner(x, "pPr"), "pStyle"), st = styleLook(sid);
    const P = { ...st.p, ...pp }, R = st.r;
    const { runs, pics, pageAfter } = runsIn(x, {});
    const text = runs.map((r) => r.t).join("");
    const rtl = !!P.bidi || /[؀-ۿ]/.test(text) && !/[A-Za-z]/.test(text);
    const lineH = (R.size || 11) * 1.16;
    if (!text.trim() && !pics.length) { pendingSpace += (P.before || 0) + lineH + (P.after || 0); if (pageAfter || P.pageBreak) pageBreakNext = true; return; }
    // the look of the paragraph
    const hn = st.name.match(/^heading (\d)$/i) || (/^Title$/i.test(st.name) ? [0, "1"] : null) || (P.outline != null && P.outline < 3 ? [0, String(P.outline + 1)] : null);
    const jc = P.jc, align = !jc || jc === "start" || (rtl && jc === "left") ? (rtl ? "right" : "left") : jc === "end" || (rtl && jc === "right") ? (rtl ? "left" : "right") : jc === "center" ? "center" : jc === "both" || jc === "distribute" ? "justify" : !rtl && jc === "right" ? "right" : "left";
    let type = hn ? "h" + Math.min(3, +hn[1] || 1) : "p", mk = null;
    if (P.numId && P.numId !== "0") { mk = marker(P.numId, P.ilvl || 0); if (mk && !hn) type = "li"; }
    else if (!hn && /List/i.test(st.name)) type = "li";
    const blk = { type, text: text.replace(/\u0000PAGE\u0000/g, "#").replace(/^\s+|\s+$/g, "") };
    if (mk && mk.num != null) { if (hn) blk.text = mk.num + mk.sep + " " + blk.text; else blk.num = mk.num; }
    if (type === "li" && P.ilvl) blk.level = Math.min(2, P.ilvl);
    // runs: each word's look over the paragraph style's
    const rr = runs.filter((r) => r.t).map((r) => ({ t: r.t.replace(/\u0000PAGE\u0000/g, "#"), b: !!(r.b != null ? r.b : R.b), i: !!(r.i != null ? r.i : R.i), c: r.c || R.c || null, ...((r.u != null ? r.u : R.u) ? { u: true } : {}), ...(r.size && r.size !== R.size ? { size: r.size } : {}), ...(r.font && r.font !== R.font ? { font: r.font } : {}) }));
    if (rr.length) { rr[0].t = rr[0].t.replace(/^\s+/, ""); rr[rr.length - 1].t = rr[rr.length - 1].t.replace(/\s+$/, ""); }
    if (rr.some((r) => r.b || r.i || r.c || r.u || r.size || r.font) || (hn && rr.some((r) => !r.b))) blk.runs = rr;
    blk.size = R.size || 11; if (R.font) blk.font = R.font;
    blk.align = align; if (rtl) blk.rtl = true;
    if (P.ind && type !== "li") blk.ind = rtl && P.indR && !P.ind ? P.indR : P.ind;
    if (P.first && type !== "li") blk.first = P.first;
    // "don't add space between paragraphs of the same style" (lists): no space between them
    const same = P.ctx && lastBlk && lastStyle === (sid || "") && !pendingSpace;
    if (same) delete lastBlk.after;
    const before = (same ? 0 : P.before || 0) + pendingSpace; if (before > 0.5) blk.before = Math.round(before * 10) / 10;
    if (P.after) blk.after = P.after;
    lastStyle = sid || ""; lastBlk = blk;
    if (P.lineV) blk.line = P.lineRule === "auto" ? Math.round(blk.size * 1.16 * P.lineV / 240 * 10) / 10 : Math.round(P.lineV / 20 * 10) / 10;
    if (P.pageBreak || pageBreakNext) blk.pageBreak = true;
    pendingSpace = 0; pageBreakNext = false;
    if (blk.text) blocks.push(blk);
    for (const p of pics) { p.align = align; blocks.push(p); }
    if (pageAfter) pageBreakNext = true;
  };
  const table = (x) => {
    const tblPr = inner(x, "tblPr"), grid = [...inner(x, "tblGrid").matchAll(/<w:gridCol\b[^>]*w:w="(\d+)"/g)].map((m) => +m[1] / 20);
    const rows = [], bold = [], spans = [];
    // (a nested table's rows are not this table's rows)
    const rowsXml = []; { let depth = 0, start = -1; const re = /<w:tbl>|<\/w:tbl>|<w:tr\b[^>]*>|<\/w:tr>/g; let m; while ((m = re.exec(x))) { if (m[0] === "<w:tbl>") depth++; else if (m[0] === "</w:tbl>") depth--; else if (depth === 1 && m[0].startsWith("<w:tr")) start = m.index; else if (depth === 1 && m[0] === "</w:tr>" && start >= 0) { rowsXml.push(x.slice(start, m.index + 7)); start = -1; } } }
    for (const r of rowsXml) {
      const row = [], rb = [], rs = [];
      for (const c of r.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)) {
        const span = +(attr(inner(c[0], "tcPr"), "gridSpan") || 1), cont = /<w:vMerge\s*\/>|<w:vMerge w:val="continue"/.test(c[0]);
        const ps = [...c[0].matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((p) => runsIn(p[0], {}).runs);
        const t = cont ? "" : ps.map((rr) => rr.map((q) => q.t).join("")).join("\n").trim();
        const st = styleLook(null).r;
        const allB = ps.flat().filter((q) => q.t.trim()).length > 0 && ps.flat().filter((q) => q.t.trim()).every((q) => (q.b != null ? q.b : st.b));
        row.push(t); rb.push(!!allB); rs.push(span);
        for (let k = 1; k < span; k++) { row.push(""); rb.push(false); rs.push(0); }
      }
      rows.push(row); bold.push(rb); spans.push(rs);
    }
    if (!rows.length) return;
    const blk = { type: "table", rows, bold };
    if (spans.some((r) => r.some((s) => s !== 1))) blk.spans = spans;
    if (grid.length === Math.max(...rows.map((r) => r.length))) blk.widths = grid.map((w) => Math.round(w));
    if (has(tblPr, "bidiVisual")) blk.rtl = true;
    const ti = attr(tblPr, "tblInd", "w"); if (ti && +ti > 0) blk.ind = tw(ti);
    blk.size = styleLook(null).r.size || 11;
    if (pendingSpace > 0.5) blk.before = Math.round(pendingSpace * 10) / 10;
    if (pageBreakNext) blk.pageBreak = true;
    pendingSpace = 0; pageBreakNext = false;
    blocks.push(blk);
  };
  // the body in order (tables at the top level only; content controls unwrapped)
  const b = inner(body, "body").replace(/<w:sdtContent>|<\/w:sdtContent>|<w:sdt>[\s\S]*?<w:sdtContent>|<\/w:sdt>/g, "");
  { let i = 0; const re = /<w:tbl>|<w:p\b[^>]*\/>|<w:p[\s>]/g; let m;
    while ((re.lastIndex = i, m = re.exec(b))) {
      if (m[0] === "<w:tbl>") { let depth = 0, j = m.index; const t = /<w:tbl>|<\/w:tbl>/g; t.lastIndex = m.index; let q; while ((q = t.exec(b))) { depth += q[0] === "<w:tbl>" ? 1 : -1; if (!depth) { j = q.index + 8; break; } } table(b.slice(m.index, j)); i = j; }
      else if (m[0].endsWith("/>")) { para(m[0]); i = m.index + m[0].length; }
      else { const e = b.indexOf("</w:p>", m.index); if (e < 0) break; para(b.slice(m.index, e + 6)); i = e + 6; }
    } }
  // the page, from the last section
  const sect = (body.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g) || []).pop() || "";
  const pg = (sect.match(/<w:pgSz\b[^>]*>/) || [""])[0], mar = (sect.match(/<w:pgMar\b[^>]*>/) || [""])[0];
  const opts = { body: baseR.size && styleLook(null).r.size, font: styleLook(null).r.font || null, exact: true };
  if (pg) { const W = attr(pg, "pgSz", "w"), H = attr(pg, "pgSz", "h"); if (W && H) opts.page = { w: tw(W), h: tw(H), top: tw(attr(mar, "pgMar", "top") || 1440), bottom: tw(attr(mar, "pgMar", "bottom") || 1440), left: tw(attr(mar, "pgMar", "left") || 1440), right: tw(attr(mar, "pgMar", "right") || 1440) }; }
  // header / footer (the default ones)
  for (const kind of ["header", "footer"]) {
    const id = (sect.match(new RegExp(`<w:${kind}Reference\\b[^>]*w:type="default"[^>]*r:id="([^"]+)"`)) || sect.match(new RegExp(`<w:${kind}Reference\\b[^>]*r:id="([^"]+)"`)) || [])[1];
    const t = id && rels.get(id), hx = t && z.get("word/" + t);
    if (!hx) continue;
    const ps = [...dec(hx).matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((p) => ({ x: p[0], r: runsIn(p[0], {}).runs }));
    const p = ps.find((q) => q.r.some((r) => r.t.trim()));
    if (!p) continue;
    const txt = p.r.map((r) => r.t).join("").trim(), look = styleLook(attr(inner(p.x, "pPr"), "pStyle")), P = { ...look.p, ...pPrOf(p.x) };
    const rtl = !!P.bidi, jc = P.jc;
    blocks.unshift({ type: kind, text: txt.replace(/\u0000PAGE\u0000/g, "1"), ...(/\u0000PAGE\u0000/.test(txt) ? { page: "1" } : {}), size: (p.r.find((r) => r.size) || {}).size || look.r.size || 11, align: jc === "center" ? "center" : (jc === "right" && !rtl) || (jc === "left" && rtl) ? (rtl ? "left" : "right") : rtl ? "right" : "left", ...(rtl ? { rtl: true } : {}), at: tw(attr(sect.match(/<w:pgMar\b[^>]*>/)?.[0] || "", "pgMar", kind) || 708) });
  }
  return { blocks, opts };
}

// ---- Excel / CSV -----------------------------------------------------------------------------
const colName = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/** Rows (arrays) → an Excel workbook (.xlsx bytes), one sheet; numbers stay numbers. */
// v6.8: "18,000" / "1,250.50" / "14%" are numbers Excel can add up, shown the same way (styles 2–5)
export function sheetNumber(s) {
  const t = String(s).trim();
  if (/^-?\d+(\.\d+)?$/.test(t) && t.length < 16 && !/^-?0\d/.test(t)) return { v: t, st: 0 };
  let m = t.match(/^(-?\d{1,3}(?:,\d{3})+)(\.\d+)?$/);
  if (m) return { v: m[1].replace(/,/g, "") + (m[2] || ""), st: m[2] ? 3 : 2 };
  m = t.match(/^(-?\d+(?:\.\d+)?)\s?%$/);
  if (m) return { v: String(+(+m[1] / 100).toFixed(10)), st: /\./.test(m[1]) ? 5 : 4 };
  return null;
}
export function xlsxFromRows(rows, sheet = "Sheet1") {
  const head = rows.length > 1 && rows[0].length > 1 && rows[0].every((v) => v != null && String(v).trim() && !sheetNumber(v));
  const data = rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
    const ref = colName(ci) + (ri + 1), s = v == null ? "" : String(v), n = s !== "" ? sheetNumber(s) : null;
    if (n) return `<c r="${ref}"${ri === 0 && head ? ' s="1"' : n.st ? ` s="${n.st}"` : ""}><v>${n.v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${ri === 0 && head ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(s)}</t></is></c>`;
  }).join("") + `</row>`).join("");
  // columns as wide as their text (Arabic letters a little wider), the header row frozen, an Arabic sheet right-to-left
  const ncol = Math.max(0, ...rows.map((r) => r.length));
  const widths = Array.from({ length: ncol }, (_, c) => Math.min(60, Math.max(8, ...rows.slice(0, 500).map((r) => String(r[c] == null ? "" : r[c]).split("\n").reduce((a, l) => Math.max(a, l.length * (isAr(l) ? 1.2 : 1.05)), 0) + 2))));
  const ar = rows.slice(0, 200).flat().filter((v) => isAr(String(v || ""))).length * 2 > rows.slice(0, 200).flat().filter((v) => /[A-Za-z\u0600-\u06FF]/.test(String(v || ""))).length;
  const view = `<sheetViews><sheetView workbookViewId="0"${ar ? ' rightToLeft="1"' : ""}>${head ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ""}</sheetView></sheetViews>`;
  const cols = ncol ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.round(w * 10) / 10}" customWidth="1"/>`).join("")}</cols>` : "";
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(String(sheet).slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="6"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="3" applyNumberFormat="1"/><xf numFmtId="4" applyNumberFormat="1"/><xf numFmtId="9" applyNumberFormat="1"/><xf numFmtId="10" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    { name: "xl/worksheets/sheet1.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${view}${cols}<sheetData>${data}</sheetData></worksheet>` },
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
  // v6.8: the built-in number formats (#,##0 / #,##0.00 / 0% / 0.00%) shown as Excel shows them
  const stx = z.get("xl/styles.xml") ? dec(z.get("xl/styles.xml")) : "";
  const xfs = [...(stx.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/) || [""])[0].matchAll(/<xf\b([^>]*)/g)].map((m) => +((m[1].match(/numFmtId="(\d+)"/) || [])[1] || 0));
  const show = (v, s) => { const f = xfs[+s] || 0, x = +v; if (!isFinite(x) || v === "") return v; if (f === 3) return Math.round(x).toLocaleString("en-US"); if (f === 4) return x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); if (f === 9) return Math.round(x * 100) + "%"; if (f === 10) return (x * 100).toFixed(2) + "%"; return v; };
  const rows = [];
  for (const r of dec(z.get(sheetName)).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], inner = c[2] || "";
      const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1];
      const col = ref ? [...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : row.length;
      const t = (attrs.match(/t="([^"]+)"/) || [])[1];
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      const sId = (attrs.match(/\bs="(\d+)"/) || [])[1];
      let val = t === "s" ? shared[+v] : t === "inlineStr" ? [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => unxml(x[1])).join("") : v != null ? show(unxml(v), sId) : "";
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

/**
 * v6.8 — a PowerPoint (.pptx bytes) → a print page with one page per slide that looks like the slide
 * (NativeBridge.htmlToPdf prints it): the slide size, backgrounds (colour / gradient / picture), theme
 * colours and fonts, every shape where it sits (placeholders take their place from the layout / master),
 * fills, outlines, rounded / oval shapes, text with its font, size, bold / italic / underline / colour,
 * alignment, top / middle / bottom anchoring, bullets and numbers by level, "shrink text on overflow",
 * pictures, groups, and tables. → { html, w, h } (points)
 */
export async function pptxToSlidesHtml(bytes) {
  const z = await unzip(bytes);
  const get = (p) => (z.get(p) ? dec(z.get(p)) : "");
  const pres = get("ppt/presentation.xml");
  if (!pres) throw new Error("That file isn't a PowerPoint (.pptx) file.");
  const EMU = 12700, pt = (v) => (+v || 0) / EMU;
  const sz = pres.match(/<p:sldSz\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/) || [0, 9144000, 6858000];
  const W = pt(sz[1]), H = pt(sz[2]);
  const relsOf = (part) => { const p = part.replace(/([^/]+)$/, "_rels/$1.rels"); const m = new Map(); for (const x of get(p).matchAll(/<Relationship\b([^>]*)\/?>/g)) { const id = (x[1].match(/\bId="([^"]+)"/) || [])[1], t = (x[1].match(/\bTarget="([^"]+)"/) || [])[1], ty = (x[1].match(/\bType="([^"]+)"/) || [])[1] || ""; if (id && t) m.set(id, { t, type: ty.split("/").pop() }); } return m; };
  const resolve = (from, target) => { if (target.startsWith("/")) return target.slice(1); const parts = from.split("/"); parts.pop(); for (const s of target.split("/")) { if (s === "..") parts.pop(); else if (s !== ".") parts.push(s); } return parts.join("/"); };
  const presRels = relsOf("ppt/presentation.xml");
  const slideParts = [...pres.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((m) => presRels.get(m[1])).filter(Boolean).map((r) => resolve("ppt/presentation.xml", r.t));
  const esc2 = (s) => esc(s);
  const media = (part, id) => { const r = relsOf(part).get(id); if (!r) return null; const p = resolve(part, r.t), b = z.get(p); if (!b || b.length > 8e6) return null; const mime = /\.png$/i.test(p) ? "image/png" : /\.jpe?g$/i.test(p) ? "image/jpeg" : /\.gif$/i.test(p) ? "image/gif" : /\.svg$/i.test(p) ? "image/svg+xml" : null; return mime ? `data:${mime};base64,` + bytesToB64(b) : null; };
  // the first element with this tag (balanced — shapes nest)
  const block = (x, tag, from = 0) => { const re = new RegExp(`<${tag}(?=[\\s>/])[^>]*?(/?)>`, "g"); re.lastIndex = from; const m = re.exec(x); if (!m) return null; if (m[1] === "/") return { s: m.index, e: m.index + m[0].length, x: m[0] }; const t = new RegExp(`<${tag}(?=[\\s>/])[^>]*?/?>|</${tag}>`, "g"); t.lastIndex = m.index; let depth = 0, q; while ((q = t.exec(x))) { if (q[0].startsWith("</")) depth--; else if (!q[0].endsWith("/>")) depth++; if (!depth) return { s: m.index, e: q.index + q[0].length, x: x.slice(m.index, q.index + q[0].length) }; } return null; };
  const children = (x, tags) => { const out = []; const inner0 = x.replace(/^<[^>]*>/, ""); const re = new RegExp(`<(${tags.join("|")})(?=[\\s>/])`, "g"); let m, pos = 0; while ((re.lastIndex = pos, m = re.exec(inner0))) { const b = block(inner0, m[1], m.index); if (!b) break; out.push({ tag: m[1], x: b.x }); pos = b.e; } return out; };
  const attr = (x, name) => { const m = String(x || "").match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : null; };
  // ---- theme ----
  const firstSlide = slideParts[0] || "";
  const layoutOf = (sp) => { const r = [...relsOf(sp).values()].find((v) => v.type === "slideLayout"); return r ? resolve(sp, r.t) : null; };
  const masterOf = (lp) => { const r = lp && [...relsOf(lp).values()].find((v) => v.type === "slideMaster"); return r ? resolve(lp, r.t) : null; };
  const themeOf = (mp) => { const r = mp && [...relsOf(mp).values()].find((v) => v.type === "theme"); return r ? resolve(mp, r.t) : null; };
  const themes = new Map();
  const themeData = (mp) => {
    const tp = themeOf(mp); if (themes.has(tp)) return themes.get(tp);
    const tx = get(tp || ""), clr = {};
    const scheme = (tx.match(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/) || [""])[0];
    for (const k of ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]) { const b = (scheme.match(new RegExp(`<a:${k}>([\\s\\S]*?)</a:${k}>`)) || [])[1] || ""; clr[k] = (b.match(/srgbClr val="([0-9A-Fa-f]{6})"/) || b.match(/lastClr="([0-9A-Fa-f]{6})"/) || [0, k === "lt1" ? "FFFFFF" : "000000"])[1].toUpperCase(); }
    const font = { major: (tx.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]*)"/) || [])[1] || "Calibri Light", minor: (tx.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]*)"/) || [])[1] || "Calibri" };
    const shadow = [...((tx.match(/<a:effectStyleLst>[\s\S]*?<\/a:effectStyleLst>/) || [""])[0]).matchAll(/<a:effectStyle>[\s\S]*?<\/a:effectStyle>|<a:effectStyle\/>/g)].map((m) => /<a:outerShdw\b/.test(m[0]));
    const t = { clr, font, shadow }; themes.set(tp, t); return t;
  };
  // ---- colours ----
  const mix = (hex, fn) => { const n = parseInt(hex, 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; [r, g, b] = fn(r, g, b); return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase(); };
  const colorIn = (x, ctx) => {
    if (!x) return null;
    const m = x.match(/<a:(srgbClr|schemeClr|sysClr|prstClr)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:\1>)/);
    if (!m) return null;
    let hex = null; const v = attr(m[2], "val");
    if (m[1] === "srgbClr") hex = v; else if (m[1] === "sysClr") hex = attr(m[2], "lastClr") || (v === "window" ? "FFFFFF" : "000000");
    else if (m[1] === "prstClr") hex = { black: "000000", white: "FFFFFF", red: "FF0000", blue: "0000FF", green: "008000", gray: "808080" }[v] || "000000";
    else { const map = ctx.map || {}; const k = { bg1: map.bg1 || "lt1", tx1: map.tx1 || "dk1", bg2: map.bg2 || "lt2", tx2: map.tx2 || "dk2", phClr: ctx.ph || "accent1" }[v] || v; hex = /^[0-9A-F]{6}$/i.test(k) ? k : ctx.theme.clr[k] || "000000"; }
    if (!hex) return null;
    const mods = m[3] || "";
    const lm = +(mods.match(/lumMod val="(\d+)"/) || [])[1] || 0, lo = +(mods.match(/lumOff val="(\d+)"/) || [])[1] || 0, tint = +(mods.match(/tint val="(\d+)"/) || [])[1] || 0, shade = +(mods.match(/shade val="(\d+)"/) || [])[1] || 0;
    // as Office does it: tint / shade in linear light (black at tint 75 % is #898989), lumMod / lumOff on the HSL lightness
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }, srgb = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
    if (tint) hex = mix(hex, (r, g, b) => [r, g, b].map((c) => srgb(lin(c) * tint / 1e5 + (1 - tint / 1e5))));
    if (shade) hex = mix(hex, (r, g, b) => [r, g, b].map((c) => srgb(lin(c) * shade / 1e5)));
    if (lm || lo) hex = mix(hex, (r, g, b) => {
      r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, sat = 0, l = (mx + mn) / 2;
      if (mx !== mn) { const d = mx - mn; sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
      l = Math.min(1, Math.max(0, l * (lm ? lm / 1e5 : 1) + lo / 1e5));
      const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p2 = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p2 + (q - p2) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p2 + (q - p2) * (2 / 3 - t) * 6 : p2; };
      return sat ? [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255] : [l * 255, l * 255, l * 255];
    });
    const alpha = +(mods.match(/alpha val="(\d+)"/) || [])[1];
    return alpha && alpha < 1e5 ? { hex: hex.toUpperCase(), a: alpha / 1e5 } : hex.toUpperCase();
  };
  const css = (c) => (!c ? null : typeof c === "string" ? "#" + c : `rgba(${parseInt(c.hex.slice(0, 2), 16)},${parseInt(c.hex.slice(2, 4), 16)},${parseInt(c.hex.slice(4), 16)},${c.a})`);
  const fillOf = (spPr, ctx, part) => {
    if (!spPr) return undefined;
    if (/<a:noFill\/>/.test(spPr.replace(/<a:ln\b[\s\S]*?<\/a:ln>/g, ""))) return "none";
    const s = spPr.replace(/<a:ln\b[\s\S]*?<\/a:ln>/g, "");
    const sf = (s.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/) || [])[1]; if (sf) return css(colorIn(sf, ctx));
    const gf = s.match(/<a:gradFill\b[\s\S]*?<\/a:gradFill>/); if (gf) { const stops = [...gf[0].matchAll(/<a:gs pos="(\d+)">([\s\S]*?)<\/a:gs>/g)].map((g) => `${css(colorIn(g[2], ctx))} ${+g[1] / 1000}%`); const ang = +(gf[0].match(/<a:lin ang="(\d+)"/) || [])[1] || 0; if (stops.length) return `linear-gradient(${Math.round(ang / 60000) + 90}deg, ${stops.join(", ")})`; }
    const bf = s.match(/<a:blipFill\b[\s\S]*?r:embed="([^"]+)"/); if (bf && part) { const u = media(part, bf[1]); if (u) return `url("${u}") center / cover no-repeat`; }
    return undefined;
  };
  // ---- the three parts a slide inherits from ----
  const phKey = (sp) => { const ph = (sp.match(/<p:ph\b[^>]*\/?>/) || [])[0]; if (!ph) return null; return { type: attr(ph, "type") || "body", idx: attr(ph, "idx") }; };
  const phIndex = (part) => { const x = get(part); const tree = block(x, "p:spTree"); const out = []; if (tree) for (const c of children(tree.x, ["p:sp", "p:pic", "p:graphicFrame", "p:grpSp"])) { const k = phKey(c.x); if (k) out.push({ k, x: c.x }); } return out; };
  const findPh = (list, k) => { const tt = (t) => (t === "ctrTitle" ? "title" : t === "subTitle" || t === "obj" ? "body" : t); return list.find((p) => k.idx != null && p.k.idx === k.idx) || list.find((p) => p.k.type === k.type) || list.find((p) => tt(p.k.type) === tt(k.type)); };
  const xfrmOf = (x) => { const m = (x || "").match(/<(?:a|p):xfrm\b([^>]*)>[\s\S]*?<a:off x="(-?\d+)" y="(-?\d+)"\/>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"\/>/); return m ? { x: pt(m[2]), y: pt(m[3]), w: pt(m[4]), h: pt(m[5]), rot: +(attr(m[1], "rot") || 0) / 60000, flipH: attr(m[1], "flipH") === "1" } : null; };
  // text defaults by level: the slide's own list style, then the layout's and master's placeholder, then the master's text styles
  const lvlProps = (lst, lvl) => { const m = (lst || "").match(new RegExp(`<a:lvl${lvl}pPr\\b([^>]*)(?:/>|>([\\s\\S]*?)</a:lvl${lvl}pPr>)`)); if (!m) return null; const inner = m[2] || "", d = (inner.match(/<a:defRPr\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:defRPr>)/) || []); return { rtl: attr(m[1], "rtl"), algn: attr(m[1], "algn"), marL: attr(m[1], "marL"), indent: attr(m[1], "indent"), sz: attr(d[1], "sz"), b: attr(d[1], "b"), i: attr(d[1], "i"), color: d[2] ? (d[2].match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/) || [])[1] : null, font: d[2] ? attr((d[2].match(/<a:latin\b[^>]*>/) || [])[0], "typeface") : null, spcBef: (inner.match(/<a:spcBef><a:spcPts val="(\d+)"/) || [])[1] ? { pts: +inner.match(/<a:spcBef><a:spcPts val="(\d+)"/)[1] } : (inner.match(/<a:spcBef><a:spcPct val="(\d+)"/) || [])[1] ? { pct: +inner.match(/<a:spcBef><a:spcPct val="(\d+)"/)[1] } : null, bu: /<a:buNone\/>/.test(inner) ? "none" : (inner.match(/<a:buChar char="([^"]*)"/) || [])[1] ? { char: inner.match(/<a:buChar char="([^"]*)"/)[1] } : /<a:buAutoNum\b/.test(inner) ? { auto: attr((inner.match(/<a:buAutoNum\b[^>]*>/) || [])[0], "type") } : null, lnSpc: +(inner.match(/<a:lnSpc><a:spcPct val="(\d+)"/) || [])[1] || null }; };
  const slidesOut = [];
  for (const part of slideParts) {
    const sx = get(part); if (!sx) continue;
    const lp = layoutOf(part), mp = masterOf(lp), theme = themeData(mp);
    const lx = get(lp || ""), mx = get(mp || "");
    const cm = (mx.match(/<p:clrMap\b[^>]*>/) || [""])[0], ov = (lx.match(/<a:overrideClrMapping\b[^>]*>/) || [""])[0] || cm;
    const map = {}; for (const k of ["bg1", "tx1", "bg2", "tx2"]) map[k] = attr(ov, k) || attr(cm, k);
    const ctx = { theme, map };
    if (/<p:sld\b[^>]*show="0"/.test(sx)) continue;   // a hidden slide isn't printed
    const layPh = phIndex(lp || ""), masPh = phIndex(mp || "");
    const txStyles = { title: (mx.match(/<p:titleStyle>([\s\S]*?)<\/p:titleStyle>/) || [])[1] || "", body: (mx.match(/<p:bodyStyle>([\s\S]*?)<\/p:bodyStyle>/) || [])[1] || "", other: (mx.match(/<p:otherStyle>([\s\S]*?)<\/p:otherStyle>/) || [])[1] || "" };
    // background: the slide's, else the layout's, else the master's
    let bg = "#FFFFFF";
    for (const [x, p] of [[sx, part], [lx, lp], [mx, mp]]) {
      const b = (x.match(/<p:bg>([\s\S]*?)<\/p:bg>/) || [])[1]; if (!b) continue;
      const bp = (b.match(/<p:bgPr>([\s\S]*?)<\/p:bgPr>/) || [])[1];
      if (bp) { const f = fillOf("<a:x>" + bp + "</a:x>", ctx, p); if (f && f !== "none") { bg = f; break; } }
      const br = b.match(/<p:bgRef\b[^>]*>([\s\S]*?)<\/p:bgRef>/); if (br) { const c = colorIn(br[1], ctx); if (c) { bg = css(c); break; } }
    }
    let html = "";
    // shapes from the master and layout that show on every slide (not placeholders): logos, bands
    const deco = (x, p) => { if (!x || /<p:sld\b[^>]*showMasterSp="0"/.test(sx)) return; const tree = block(x, "p:spTree"); if (!tree) return; for (const c of children(tree.x, ["p:sp", "p:pic", "p:grpSp", "p:cxnSp"])) if (!phKey(c.x)) html += shape(c, p, { dx: 0, dy: 0, sx: 1, sy: 1 }, true); };
    function textBody(tb, kind, inh, scale, fontColor = null) {
      const bodyPr = (tb.match(/<a:bodyPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:bodyPr>)/) || [""])[0];
      const fs = +(bodyPr.match(/<a:normAutofit fontScale="(\d+)"/) || [])[1] || 1e5, ls = +(bodyPr.match(/lnSpcReduction="(\d+)"/) || [])[1] || 0;
      const own = (tb.match(/<a:lstStyle>([\s\S]*?)<\/a:lstStyle>/) || [])[1] || "";
      const styles = [own, ...inh.map((x) => (x.match(/<a:lstStyle>([\s\S]*?)<\/a:lstStyle>/) || [])[1] || ""), kind === "title" ? txStyles.title : kind === "body" ? txStyles.body : txStyles.other];
      const prop = (lvl, k) => { for (const s of styles) { const p = lvlProps(s, lvl); if (p && p[k] != null) return p[k]; } return null; };
      let out = "", num = [];
      for (const pm of tb.matchAll(/<a:p>[\s\S]*?<\/a:p>|<a:p\s[^>]*>[\s\S]*?<\/a:p>|<a:p\/>/g)) {
        const p = pm[0], pPr = (p.match(/<a:pPr\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:pPr>)/) || []);
        const lvl = +(attr(pPr[1], "lvl") || 0) + 1, pin = pPr[2] || "";
        const algn = attr(pPr[1], "algn") || prop(lvl, "algn") || "l";
        const marL = pt(attr(pPr[1], "marL") || prop(lvl, "marL") || 0), ind = pt(attr(pPr[1], "indent") || prop(lvl, "indent") || 0);
        const bu = /<a:buNone\/>/.test(pin) ? "none" : (pin.match(/<a:buChar char="([^"]*)"/) || [])[1] ? { char: pin.match(/<a:buChar char="([^"]*)"/)[1] } : /<a:buAutoNum\b/.test(pin) ? { auto: attr((pin.match(/<a:buAutoNum\b[^>]*>/) || [])[0], "type") } : prop(lvl, "bu");
        const lnSpc = +(pin.match(/<a:lnSpc><a:spcPct val="(\d+)"/) || [])[1] || prop(lvl, "lnSpc") || 1e5;
        const sb = (pin.match(/<a:spcBef><a:spcPts val="(\d+)"/) || [])[1] ? { pts: +pin.match(/<a:spcBef><a:spcPts val="(\d+)"/)[1] } : (pin.match(/<a:spcBef><a:spcPct val="(\d+)"/) || [])[1] ? { pct: +pin.match(/<a:spcBef><a:spcPct val="(\d+)"/)[1] } : prop(lvl, "spcBef");
        const defSz = +(prop(lvl, "sz") || (kind === "title" ? 4400 : 1800)) / 100;
        let runs = "", text = "", first = null;
        for (const r of p.matchAll(/<a:r>[\s\S]*?<\/a:r>|<a:fld\b[\s\S]*?<\/a:fld>|<a:br\b[^>]*\/>|<a:br>[\s\S]*?<\/a:br>/g)) {
          if (/^<a:br/.test(r[0])) { runs += "<br>"; continue; }
          const rPr = (r[0].match(/<a:rPr\b([^>]*?)(?:\/>|>([\s\S]*?)<\/a:rPr>)/) || []);
          let t = [...r[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((x) => unxml(x[1])).join("");
          if (/type="slidenum"/.test(r[0])) t = String(slidesOut.length + 1);
          if (!t) continue;
          const size = (+(attr(rPr[1], "sz") || 0) / 100 || defSz) * fs / 1e5;
          const b = attr(rPr[1], "b") != null ? attr(rPr[1], "b") === "1" : prop(lvl, "b") === "1";
          const it = attr(rPr[1], "i") != null ? attr(rPr[1], "i") === "1" : prop(lvl, "i") === "1";
          const u = attr(rPr[1], "u") && attr(rPr[1], "u") !== "none";
          const fill = (rPr[2] || "").match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/);
          const col = fill ? css(colorIn(fill[1], ctx)) : fontColor || (prop(lvl, "color") ? css(colorIn(prop(lvl, "color"), ctx)) : css(colorIn(`<a:schemeClr val="tx1"/>`, ctx)));
          let fam = attr(((rPr[2] || "").match(/<a:latin\b[^>]*>/) || [])[0], "typeface") || prop(lvl, "font");
          if (!fam || fam === "+mn-lt") fam = theme.font.minor; if (fam === "+mj-lt") fam = theme.font.major;
          if (kind === "title" && !attr(((rPr[2] || "").match(/<a:latin\b[^>]*>/) || [])[0], "typeface") && !prop(lvl, "font")) fam = theme.font.major;
          if (first == null) first = { size, col, fam, b };
          runs += `<span style="font-size:${Math.round(size * 10) / 10}pt;color:${col};font-family:${cssFont(fam)}${b ? ";font-weight:700" : ""}${it ? ";font-style:italic" : ""}${u ? ";text-decoration:underline" : ""}">${esc2(t)}</span>`;
          text += t;
        }
        const rtl = (attr(pPr[1], "rtl") || prop(lvl, "rtl")) === "1";
        if (!text) { const es = (+(((p.match(/<a:endParaRPr\b[^>]*>/) || [])[0] || "").match(/sz="(\d+)"/) || [])[1] || 0) / 100 || defSz; out += `<p style="margin:0;font-size:${es * fs / 1e5}pt;line-height:${1.2 * lnSpc / 1e5 * (1 - ls / 1e5)}">&nbsp;</p>`; num[lvl] = 0; continue; }
        let mark = "";
        if (bu && bu !== "none" && kind !== "title") {
          if (bu.char) mark = bu.char.replace(/[\uF000-\uF0FF]/, "•");
          else if (bu.auto) { num[lvl] = (num[lvl] || 0) + 1; for (let k = lvl + 1; k < 10; k++) num[k] = 0; const n = num[lvl]; mark = /alphaLc/.test(bu.auto) ? String.fromCharCode(96 + n) : /alphaUc/.test(bu.auto) ? String.fromCharCode(64 + n) : /romanLc/.test(bu.auto) ? ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"][n - 1] || n : String(n); mark += /ParenR/.test(bu.auto) ? ")" : "."; }
        }
        const f = first || { size: defSz, col: "#000" };
        const ta = { l: "left", ctr: "center", r: "right", just: "justify", dist: "justify" }[algn] || "left";
        const startSide = rtl ? "right" : "left";
        const spcB = !sb || !out ? 0 : sb.pts ? sb.pts / 100 : f.size * 1.2 * sb.pct / 1e5;   // (not above the first line)
        out += `<p dir="${rtl ? "rtl" : "ltr"}" style="margin:0;${spcB ? `padding-top:${Math.round(spcB * 10) / 10}pt;` : ""}text-align:${rtl && ta === "left" ? "right" : ta};padding-${startSide}:${Math.round(marL * 10) / 10}pt;text-indent:${Math.round(ind * 10) / 10}pt;line-height:${Math.round(1.2 * lnSpc / 1e5 * (1 - ls / 1e5) * 100) / 100}">` +
          (mark ? `<span style="display:inline-block;min-width:${Math.max(0, -ind)}pt;padding-inline-end:0.3em;text-indent:0;font-size:${f.size}pt;color:${f.col}">${esc2(mark)}</span>` : "") + runs + "</p>";
      }
      return { html: out, bodyPr };
    }
    function shape(c, p, tf, isDeco) {
      const x = c.x;
      if (c.tag === "p:grpSp") {
        const g = (x.match(/<p:grpSpPr>[\s\S]*?<\/p:grpSpPr>/) || [""])[0];
        const m = g.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"\/>[\s\S]*?<a:chOff x="(-?\d+)" y="(-?\d+)"\/>[\s\S]*?<a:chExt cx="(\d+)" cy="(\d+)"\/>/);
        const k = m ? { sx: (+m[3] || 1) / (+m[7] || 1), sy: (+m[4] || 1) / (+m[8] || 1) } : { sx: 1, sy: 1 };
        const inner = m ? { dx: tf.dx + tf.sx * (pt(m[1]) - pt(m[5]) * k.sx), dy: tf.dy + tf.sy * (pt(m[2]) - pt(m[6]) * k.sy), sx: tf.sx * k.sx, sy: tf.sy * k.sy } : tf;
        return children(x, ["p:sp", "p:pic", "p:grpSp", "p:graphicFrame", "p:cxnSp"]).map((cc) => shape(cc, p, inner, isDeco)).join("");
      }
      const key = phKey(x);
      const inh = key && !isDeco ? [findPh(layPh, key), findPh(masPh, key)].filter(Boolean).map((q) => q.x) : [];
      let xf = xfrmOf((x.match(/<p:spPr\b[\s\S]*?<\/p:spPr>|<p:xfrm\b[\s\S]*?<\/p:xfrm>/) || [""])[0]);
      for (const q of inh) if (!xf) xf = xfrmOf((q.match(/<p:spPr\b[\s\S]*?<\/p:spPr>/) || [""])[0]);
      if (!xf) return "";
      const L = tf.dx + xf.x * tf.sx, T = tf.dy + xf.y * tf.sy, Wd = xf.w * tf.sx, Ht = xf.h * tf.sy;
      const box = `position:absolute;left:${n2(L)}pt;top:${n2(T)}pt;width:${n2(Wd)}pt;height:${n2(Ht)}pt;${xf.rot ? `transform:rotate(${xf.rot}deg);` : ""}`;
      if (c.tag === "p:pic") {
        const id = (x.match(/<a:blip\b[^>]*r:embed="([^"]+)"/) || [])[1], u = id && media(p, id);
        return u ? `<img src="${u}" style="${box}object-fit:fill">` : "";
      }
      if (c.tag === "p:graphicFrame") {
        const tbl = (x.match(/<a:tbl>[\s\S]*?<\/a:tbl>/) || [])[0];
        if (!tbl) return "";
        const grid = [...tbl.matchAll(/<a:gridCol w="(\d+)"/g)].map((g) => pt(g[1]) * tf.sx);
        const tp = (tbl.match(/<a:tblPr\b[^>]*>/) || [""])[0], firstRow = attr(tp, "firstRow") === "1", band = attr(tp, "bandRow") === "1";
        const acc = "#" + theme.clr.accent1, light = css(colorIn('<a:schemeClr val="accent1"><a:tint val="40000"/></a:schemeClr>', ctx)), lighter = css(colorIn('<a:schemeClr val="accent1"><a:tint val="20000"/></a:schemeClr>', ctx));
        const rows = [...tbl.matchAll(/<a:tr\b([^>]*)>([\s\S]*?)<\/a:tr>/g)];
        const trs = rows.map((r, ri) => `<tr style="height:${n2(pt(attr(r[1], "h")) * tf.sy)}pt">` + [...r[2].matchAll(/<a:tc\b([^>]*)>([\s\S]*?)<\/a:tc>|<a:tc\/>/g)].map((tc) => {
          if (/hMerge="1"|vMerge="1"/.test(tc[1] || "")) return "";
          const tcPr = ((tc[2] || "").match(/<a:tcPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:tcPr>)/) || [""])[0];
          const own = fillOf("<a:x>" + tcPr.replace(/<a:ln[LRTB]\b[\s\S]*?<\/a:ln[LRTB]>/g, "") + "</a:x>", ctx, p);
          const head = firstRow && ri === 0, fill = own && own !== "none" ? own : head ? acc : band ? (ri % 2 ? light : lighter) : null;
          const t = textBody((tc[2] || "").match(/<a:txBody>[\s\S]*?<\/a:txBody>/)?.[0] || "", "other", [], 1e5);
          const span = attr(tc[1], "gridSpan"), rspan = attr(tc[1], "rowSpan");
          return `<td${span ? ` colspan="${span}"` : ""}${rspan ? ` rowspan="${rspan}"` : ""} style="padding:3.6pt 7.2pt;border:1pt solid #fff;vertical-align:${{ ctr: "middle", b: "bottom" }[attr(tcPr, "anchor")] || "top"};${fill ? `background:${fill};` : ""}${head ? "color:#fff;font-weight:700;" : ""}">${head ? t.html.replace(/color:#[0-9A-F]{6}/g, "color:#FFFFFF").replace(/font-size:/g, "font-weight:700;font-size:") : t.html}</td>`;
        }).join("") + "</tr>").join("");
        return `<table style="position:absolute;left:${n2(L)}pt;top:${n2(T)}pt;width:${n2(grid.reduce((a, v) => a + v, 0) || Wd)}pt;border-collapse:collapse;table-layout:fixed"><colgroup>${grid.map((g) => `<col style="width:${n2(g)}pt">`).join("")}</colgroup>${trs}</table>`;
      }
      // a shape: its fill and outline (its own, else the theme style it points to), its form, its text
      const spPr = (x.match(/<p:spPr\b[\s\S]*?<\/p:spPr>|<p:spPr\/>/) || [""])[0];
      const style = (x.match(/<p:style>[\s\S]*?<\/p:style>/) || [""])[0];
      let fill = fillOf(spPr, ctx, p);
      if (fill === undefined) for (const q of inh) { const f = fillOf((q.match(/<p:spPr\b[\s\S]*?<\/p:spPr>/) || [""])[0], ctx, p); if (f !== undefined) { fill = f; break; } }
      if (fill === undefined && style) { const fr = style.match(/<a:fillRef idx="(\d+)"[^>]*>([\s\S]*?)<\/a:fillRef>/); if (fr && +fr[1] > 0) fill = css(colorIn(fr[2], ctx)); }
      const ln = (spPr.match(/<a:ln\b[^>]*(?:\/>|>[\s\S]*?<\/a:ln>)/) || [""])[0];
      let stroke = null;
      if (ln && !/<a:noFill\/>/.test(ln)) { const lc = (ln.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/) || [])[1]; if (lc) stroke = `${n2(pt(attr(ln, "w") || 12700))}pt solid ${css(colorIn(lc, ctx))}`; }
      if (!stroke && !/<a:noFill\/>/.test(ln) && style) { const lr = style.match(/<a:lnRef idx="(\d+)"[^>]*>([\s\S]*?)<\/a:lnRef>/); if (lr && +lr[1] > 0 && !key) stroke = `${lr[1] > 1 ? 2 : 1}pt solid ${css(colorIn(lr[2], ctx))}`; }
      const geom = attr((spPr.match(/<a:prstGeom\b[^>]*>/) || [])[0], "prst") || "rect";
      const radius = geom === "ellipse" ? "50%" : geom === "roundRect" ? `${n2(Math.min(Wd, Ht) * 0.1667)}pt` : 0;
      if (c.tag === "p:cxnSp") return stroke ? `<div style="${box}border-top:${stroke};height:0"></div>` : "";
      const tb = (x.match(/<p:txBody>[\s\S]*?<\/p:txBody>/) || [""])[0];
      const kind = key ? (/title/i.test(key.type) ? "title" : /^(body|subTitle|obj)$/.test(key.type) || key.idx ? "body" : "other") : "other";
      if (key && /^(dt|ftr|sldNum)$/.test(key.type) && !/<a:t>[^<]/.test(tb)) return "";
      const fref = style.match(/<a:fontRef\b[^>]*>([\s\S]*?)<\/a:fontRef>/), fcol = fref ? css(colorIn(fref[1], ctx)) : null;
      const t = tb ? textBody(tb, kind, inh.map((q) => (q.match(/<p:txBody>[\s\S]*?<\/p:txBody>/) || [""])[0]), 1e5, fcol) : { html: "", bodyPr: "" };
      const er = style.match(/<a:effectRef idx="(\d+)"/), shadowed = !/<a:effectLst\/>/.test(spPr) && (/<a:outerShdw\b/.test(spPr) || (er && theme.shadow[+er[1] - 1]));
      const bp = t.bodyPr + (inh.map((q) => (q.match(/<a:bodyPr\b[^>]*>/) || [""])[0]).join(""));
      const anchor = attr(t.bodyPr, "anchor") || attr(bp, "anchor") || (kind === "title" ? "ctr" : "t");
      const ins = (k, d) => n2(pt(attr(t.bodyPr, k) || attr(bp, k) || d));
      const vert = attr(t.bodyPr, "vert");
      return `<div style="${box}${fill && fill !== "none" ? `background:${fill};` : ""}${stroke ? `border:${stroke};` : ""}${radius ? `border-radius:${radius};` : ""}${shadowed && fill && fill !== "none" ? "box-shadow:1.5pt 2pt 3pt rgba(0,0,0,.35);" : ""}box-sizing:border-box;display:flex;flex-direction:column;justify-content:${{ ctr: "center", b: "flex-end" }[anchor] || "flex-start"};padding:${ins("tIns", 45720)}pt ${ins("rIns", 91440)}pt ${ins("bIns", 45720)}pt ${ins("lIns", 91440)}pt;overflow:visible;${vert === "vert" ? "writing-mode:vertical-rl;" : vert === "vert270" ? "writing-mode:vertical-rl;transform:rotate(180deg);" : ""}">${t.html}</div>`;
    }
    const n2 = (v) => Math.round(v * 100) / 100;
    deco(mx, mp); deco(lx, lp);
    const tree = block(sx, "p:spTree");
    if (tree) for (const c of children(tree.x, ["p:sp", "p:pic", "p:grpSp", "p:graphicFrame", "p:cxnSp"])) html += shape(c, part, { dx: 0, dy: 0, sx: 1, sy: 1 }, false);
    slidesOut.push(`<section style="position:relative;width:${Math.round(W * 100) / 100}pt;height:${Math.round(H * 100) / 100}pt;overflow:hidden;background:${bg};break-after:page">${html}</section>`);
  }
  const page = `@page{size:${Math.round(W * 100) / 100}pt ${Math.round(H * 100) / 100}pt;margin:0}html,body{margin:0;padding:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}section:last-child{break-after:auto}p{white-space:pre-wrap}`;
  return { html: `<!doctype html>\n<html><head><meta charset="utf-8"><style>${page}</style></head><body>${slidesOut.join("\n")}</body></html>\n`, w: W, h: H, slides: slidesOut.length };
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
  const body = blocks.filter((b) => !["header", "footer", "image", "pagebreak"].includes(b.type)).map((b) => {
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
/** v6.8: inline HTML → runs (bold / italic / underline / colour), or null when it's all plain. */
function inlRuns(s) {
  const out = []; const st = [{}];
  const colorOf = (css) => { const m = String(css || "").match(/(?:^|;)\s*color\s*:\s*#([0-9a-f]{6}|[0-9a-f]{3})\b/i); if (!m) return null; const c = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1]; return /^(0{6}|1{6}|2{6})$/.test(c) ? null : c.toUpperCase(); };
  for (const m of String(s).replace(/<br\s*\/?>/gi, "\n").matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>|([^<]+)/gi)) {
    if (m[4] != null) { const t = deEnt(m[4]).replace(/[ \t\u00a0]+/g, " "); if (t) { const f = st[st.length - 1]; const last = out[out.length - 1]; if (last && last.b === !!f.b && last.i === !!f.i && last.u === !!f.u && last.c === (f.c || null)) last.t += t; else out.push({ t, b: !!f.b, i: !!f.i, u: !!f.u, c: f.c || null }); } continue; }
    const tag = m[2].toLowerCase(), close = !!m[1];
    if (!/^(b|strong|i|em|u|ins|span|font|a|mark|small|sub|sup|code|q|cite)$/.test(tag)) continue;
    if (close) { if (st.length > 1) st.pop(); continue; }
    const f = { ...st[st.length - 1] }, css = (m[3].match(/style="([^"]*)"/i) || [])[1] || "";
    if (/^(b|strong)$/.test(tag) || /font-weight\s*:\s*(bold|[6-9]00)/i.test(css)) f.b = true;
    if (/^(i|em|cite)$/.test(tag) || /font-style\s*:\s*italic/i.test(css)) f.i = true;
    if (/^(u|ins)$/.test(tag) || /text-decoration[^;]*underline/i.test(css)) f.u = true;
    const c = colorOf(css) || (tag === "font" ? ((m[3].match(/color="#?([0-9a-f]{6})"/i) || [])[1] || "").toUpperCase() || null : null); if (c) f.c = c;
    st.push(f);
  }
  const clean = out.map((r) => ({ ...r, t: r.t.replace(/ *\n */g, "\n") })).filter((r) => r.t);
  if (clean.length) { clean[0].t = clean[0].t.replace(/^\s+/, ""); clean[clean.length - 1].t = clean[clean.length - 1].t.replace(/\s+$/, ""); }
  return clean.some((r) => r.b || r.i || r.u || r.c) ? clean.map(({ u, ...r }) => (u ? { ...r, u } : r)) : null;
}
/** A web page / e-book chapter (HTML text) → blocks (v6.8: with bold / italic / colour, alignment, pictures). */
export function htmlToBlocks(html, pictureOf = null) {
  let h = String(html || "").replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|head|nav|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, "");
  const b = h.match(/<body\b[^>]*>([\s\S]*)<\/body>/i); if (b) h = b[1];
  const out = [];
  // the look a block element carries: alignment, direction; and the pictures inside it
  const alignOf = (open) => { const a = (String(open).match(/text-align\s*:\s*(left|right|center|justify)/i) || String(open).match(/\balign="(left|right|center|justify)"/i) || [])[1]; return a ? a.toLowerCase() : null; };
  const pics = (x) => [...String(x).matchAll(/<img\b[^>]*>/gi)].map((im) => { const src = (im[0].match(/\bsrc="([^"]+)"/i) || [])[1] || ""; const b64 = /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src) ? src : pictureOf ? pictureOf(src) : null; if (!b64) return null; const w = +((im[0].match(/\bwidth="(\d+)/i) || [])[1] || 0), hh = +((im[0].match(/\bheight="(\d+)/i) || [])[1] || 0); return { type: "image", b64, ...(w ? { w: w * 0.75, h: (hh || w * 0.6) * 0.75 } : {}) }; }).filter(Boolean);
  const add = (blk, open, inner) => { const a = alignOf(open); if (a) blk.align = a; if (/\bdir="rtl"/i.test(open)) blk.rtl = true; const r = inlRuns(inner); if (r) blk.runs = r; out.push(blk); };
  for (const m of h.matchAll(/<table\b[\s\S]*?<\/table>|<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>|<li\b[^>]*>([\s\S]*?)<\/li>|<(p|div|blockquote|pre|dt|dd|figcaption|td|th|caption|section|article|figure)\b[^>]*>((?:(?!<(?:p|div|table|h[1-6]|ul|ol|li|section|article|blockquote)\b)[\s\S])*?)(?=<\/?(?:p|div|table|h[1-6]|ul|ol|li|section|article|blockquote|body)\b|$)/gi)) {
    const open = (m[0].match(/^<[^>]*>/) || [""])[0];
    if (/^<table/i.test(m[0])) {
      const rows = [...m[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((r) => [...r[0].matchAll(/<t([hd])\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)]);
      const keep = rows.filter((r) => r.length);
      if (keep.length) out.push({ type: "table", rows: keep.map((r) => r.map((c) => inl(c[2]))), bold: keep.map((r) => r.map((c) => c[1].toLowerCase() === "h" || /^\s*<(b|strong)\b[\s\S]*<\/\1>\s*$/i.test(c[2]))), ...(/\bdir="rtl"/i.test(open) ? { rtl: true } : {}) });
    } else if (m[1]) { const t = inl(m[2]); if (t) add({ type: "h" + Math.min(3, +m[1]), text: t }, open, m[2]); }
    else if (m[3] != null) { const inner = m[3].replace(/<(ul|ol)\b[\s\S]*$/i, ""); const t = inl(inner); if (t) add({ type: "li", text: t }, open, inner); }
    else { const t = inl(m[5] || ""); if (t) add({ type: "p", text: t }, open, m[5] || ""); out.push(...pics(m[5] || "")); }
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
    const base = path.replace(/[^/]+$/, "");
    const pic = (src) => { const p = (base + decodeURIComponent(String(src).split("#")[0])).replace(/[^/]+\/\.\.\//g, ""), b = z.get(p); const mime = /\.png$/i.test(p) ? "image/png" : /\.jpe?g$/i.test(p) ? "image/jpeg" : /\.gif$/i.test(p) ? "image/gif" : null; return b && mime && b.length < 6e6 ? `data:${mime};base64,` + bytesToB64(b) : null; };
    const f = z.get(path); if (f) out.push(...htmlToBlocks(dec(f), pic));
  }
  return out;
}
/** Blocks → a web page (HTML; opens in any browser; Arabic runs right-to-left). */
export function blocksToHtml(blocks, title = "Document") {
  let body = "", list = false;
  for (const b of blocks.filter((x) => x.type !== "header" && x.type !== "footer")) {
    if (b.type === "li" && !list) { body += "<ul>"; list = true; }
    if (b.type !== "li" && list) { body += "</ul>"; list = false; }
    // v6.8: the words' bold / italic / colour and the paragraph's alignment, indent and picture come along
    const t = b.runs ? b.runs.map((r) => { let h = esc(r.t).replace(/\n/g, "<br>"); if (r.b) h = `<b>${h}</b>`; if (r.i) h = `<i>${h}</i>`; if (r.c) h = `<span style="color:#${r.c}">${h}</span>`; return h; }).join("") : esc(b.text || "").replace(/\n/g, "<br>");
    const st = [b.align && b.align !== "left" ? `text-align:${b.align}` : "", b.ind ? `margin-inline-start:${b.ind}pt` : "", b.size && b.type === "p" ? `font-size:${b.size}pt` : ""].filter(Boolean).join(";");
    const sa = st ? ` style="${st}"` : "";
    if (b.type === "table") body += `<table${b.rtl ? ' dir="rtl"' : ""}>${b.rows.map((r, i) => `<tr>${r.map((c, ci) => { const th = b.bold ? b.bold[i] && b.bold[i][ci] : !i; return `<${th ? "th" : "td"} dir="auto">${esc(c).replace(/\n/g, "<br>")}</${th ? "th" : "td"}>`; }).join("")}</tr>`).join("")}</table>`;
    else if (b.type === "image" && b.b64) body += `<p${sa}><img src="${esc(b.b64)}" alt="" style="max-width:100%${b.w ? `;width:${Math.round(b.w)}pt` : ""}"></p>`;
    else if (b.type === "li") body += `<li dir="auto"${sa}>${t}</li>`;
    else if (/^h[1-3]$/.test(b.type)) body += `<${b.type} dir="auto"${sa}>${t}</${b.type}>`;
    else if (b.type !== "pagebreak") body += `<p dir="auto"${sa}>${t}</p>`;
  }
  if (list) body += "</ul>";
  return `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:820px;margin:32px auto;padding:0 16px;line-height:1.55;color:#1a1a1a}table{border-collapse:collapse;margin:12px 0}th,td{border:1px solid #999;padding:6px 10px;text-align:start}th{background:#f1f1f1}</style></head><body>\n${body}\n</body></html>\n`;
}
/**
 * v6.8 — blocks → a web page laid out for printing (the phone's own Chrome engine prints it to PDF:
 * NativeBridge.htmlToPdf). Everything the blocks carry is kept: the page size and margins (@page), the
 * header / footer in the page margins with a live page number, each word's bold / italic / underline /
 * colour / size / font, alignment, indents, space before / after, line spacing, bullets and numbers with
 * their levels, tables (column widths, merged cells, bold cells, right-to-left, a bold first row repeated
 * on every page), pictures at their size, page breaks. Arabic is shaped by the browser.
 * o: { page: {w, h, top, right, bottom, left} (pt), body (pt), font, sheet (a spreadsheet: small, fitted) }
 */
const CSS_FONTS = { "times new roman": '"Times New Roman", Tinos, "Liberation Serif", "Noto Serif", serif', arial: 'Arial, Arimo, "Liberation Sans", Roboto, "Noto Sans", sans-serif',
  calibri: 'Calibri, Carlito, "Noto Sans", Roboto, sans-serif', cambria: 'Cambria, Caladea, "Noto Serif", serif', "courier new": '"Courier New", Cousine, "Liberation Mono", monospace',
  "liberation serif": '"Liberation Serif", "Times New Roman", Tinos, "Noto Serif", serif', "liberation sans": '"Liberation Sans", Arial, Arimo, Roboto, sans-serif', georgia: 'Georgia, "Noto Serif", serif', verdana: 'Verdana, "DejaVu Sans", sans-serif', tahoma: 'Tahoma, "DejaVu Sans", sans-serif' };
// (single quotes: these go inside style="…" attributes)
const cssFont = (f) => (f ? (CSS_FONTS[String(f).toLowerCase()] || `"${String(f).replace(/["'<>&]/g, "")}", sans-serif`).replace(/"/g, "'") : null);
export function blocksToPrintHtml(blocks, title = "Document", o = {}) {
  const pg = o.page || { w: 595.3, h: 841.9, top: 56.7, right: 56.7, bottom: 56.7, left: 56.7 };
  const body = o.body || 11, n = (x) => Math.round(x * 100) / 100;
  const h = (s) => esc(s).replace(/\t/g, "&emsp;").replace(/\n/g, "<br>");
  const span = (r, base) => {
    const st = [r.b ? "font-weight:700" : base.headingPlain ? "font-weight:400" : "", r.i ? "font-style:italic" : "", r.u ? "text-decoration:underline" : "", r.c ? `color:#${r.c}` : "", r.size ? `font-size:${r.size}pt` : "", r.font ? `font-family:${cssFont(r.font)}` : ""].filter(Boolean).join(";");
    const t = r.v === 1 ? `<sup>${h(r.t)}</sup>` : r.v === -1 ? `<sub>${h(r.t)}</sub>` : h(r.t);
    return st ? `<span style="${st}">${t}</span>` : t;
  };
  const inner = (b) => (b.runs ? b.runs.map((r) => span(r, { headingPlain: /^h/.test(b.type) })).join("") : h(b.text || "")).replace(/\^\(([^()]{1,40})\)/g, "<sup>$1</sup>");
  const look = (b, extra = []) => {
    // (Word adds one paragraph's space after to the next one's space before: padding, which never collapses)
    const st = ["margin:0", b.before ? `padding-top:${n(b.before)}pt` : "", b.after ? `padding-bottom:${n(b.after)}pt` : "", b.align && b.align !== (b.rtl ? "right" : "left") ? `text-align:${b.align}` : "",
      b.ind ? `margin-inline-start:${n(b.ind)}pt` : "", b.first ? `text-indent:${n(b.first)}pt` : "", b.size ? `font-size:${b.size}pt` : "", b.font ? `font-family:${cssFont(b.font)}` : "",
      b.line ? `line-height:${n(b.line)}pt` : "", b.pageBreak ? "break-before:page" : "", ...extra].filter(Boolean).join(";");
    return ` style="${st}"${b.rtl ? ' dir="rtl"' : ' dir="auto"'}`;
  };
  // the header / footer: in the page's margin boxes, "#" (or the page) is the page number
  const box = (b, where) => {
    if (!b) return "";
    const side = b.align === "center" ? "center" : (b.align === "right") ? "right" : "left";
    const parts = b.page ? String(b.text).split(new RegExp("(?<!\\d)" + b.page + "(?!\\d)")) : [b.text];
    const content = parts.map((x) => JSON.stringify(x)).join(" counter(page) ");
    return `@${where}-${side}{content:${content};font-size:${b.size || 9}pt;${b.font ? `font-family:${cssFont(b.font)};` : ""}vertical-align:${where === "top" ? "bottom" : "top"};${b.rtl ? "direction:rtl;" : ""}}`;
  };
  const hd = blocks.find((b) => b.type === "header"), ft = blocks.find((b) => b.type === "footer");
  let out = "", list = null;
  for (const b of blocks) {
    if (b.type === "header" || b.type === "footer") continue;
    if (b.type === "pagebreak") { out += '<div style="break-before:page"></div>'; continue; }
    if (b.type === "image" && b.b64) {
      const w = b.w ? Math.min(b.w, pg.w - pg.left - pg.right) : null;
      out += `<p${look({ ...b, size: null }, ["line-height:0"])}><img src="${esc(b.b64)}" alt="" style="${w ? `width:${n(w)}pt;height:${n(w * (b.h || 1) / (b.w || 1))}pt` : "max-width:100%"}"></p>`;
      continue;
    }
    if (b.type === "table") {
      const w = Math.max(...b.rows.map((r) => r.length)), sheet = o.sheet;
      const num = (t) => /^[-+]?[\d,.\s]+%?$/.test(String(t).trim()) && /\d/.test(t);
      const cols = b.widths && b.widths.length === w ? `<colgroup>${b.widths.map((x) => `<col style="width:${n(x)}pt">`).join("")}</colgroup>` : "";
      const head = b.bold ? b.bold[0] && b.bold[0].every(Boolean) : !!sheet;
      const cell = (r, ri, ci) => {
        const sp = b.spans ? b.spans[ri] && b.spans[ri][ci] : 1;
        if (sp === 0) return "";
        const bold = b.bold ? b.bold[ri] && b.bold[ri][ci] : ri === 0;
        const tag = ri === 0 && head ? "th" : "td";
        return `<${tag}${sp > 1 ? ` colspan="${sp}"` : ""}${b.rtl ? "" : ' dir="auto"'} style="${bold ? "font-weight:700" : "font-weight:400"};${sheet && ri > 0 && num(r[ci] || "") ? "text-align:end" : ""}">${h(r[ci] || "")}</${tag}>`;
      };
      const rows = b.rows.map((r, ri) => `<tr>${Array.from({ length: w }, (_, ci) => cell(r, ri, ci)).join("")}</tr>`);
      out += `<table${b.rtl ? ' dir="rtl"' : ""} style="border-collapse:collapse;${cols ? `table-layout:fixed;width:${n(b.widths.reduce((a, x) => a + x, 0))}pt;` : "width:100%;"}${b.ind ? `margin-inline-start:${n(b.ind)}pt;` : ""}${b.before ? `margin-top:${n(b.before)}pt;` : ""}${b.after ? `margin-bottom:${n(b.after)}pt;` : ""}${b.pageBreak ? "break-before:page;" : ""}font-size:${b.size || (sheet ? 8.5 : body)}pt">${cols}${head ? `<thead>${rows[0]}</thead><tbody>${rows.slice(1).join("")}</tbody>` : `<tbody>${rows.join("")}</tbody>`}</table>`;
      continue;
    }
    if (b.type === "li") {
      const lv = b.level || 0, mark = b.num != null ? esc(b.num) + "." : ["•", "◦", "▪"][lv] || "•";
      out += `<p${look({ ...b, ind: null, first: null }, [`margin-inline-start:${18 * (lv + 1) + (b.ind || 0)}pt`, "text-indent:-18pt"])}><span style="display:inline-block;width:18pt;text-indent:0">${mark}</span>${inner(b)}</p>`;
      continue;
    }
    const tag = /^h[1-3]$/.test(b.type) ? b.type : b.type === "title" ? "h1" : "p";
    out += `<${tag}${look(b, tag !== "p" ? [b.runs ? "font-weight:400" : "font-weight:700", "break-after:avoid"] : [])}>${inner(b)}</${tag}>`;
  }
  const css = `@page{size:${n(pg.w)}pt ${n(pg.h)}pt;margin:${n(pg.top)}pt ${n(pg.right)}pt ${n(pg.bottom)}pt ${n(pg.left)}pt;${box(hd, "top")}${box(ft, "bottom")}}` +
    `html,body{margin:0;padding:0}body{font-family:${cssFont(o.font) || 'Calibri, Carlito, "Noto Sans", Roboto, sans-serif'};font-size:${body}pt;line-height:1.16;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
    `p,h1,h2,h3{margin:0;orphans:2;widows:2}h1,h2,h3{font-size:inherit}img{display:inline-block}table{margin:0}th,td{border:0.5pt solid #7f7f7f;padding:1pt 5.4pt;vertical-align:top;text-align:start}thead{display:table-header-group}tr{break-inside:avoid}`;
  return `<!doctype html>\n<html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>\n${out}\n</body></html>\n`;
}
/** Blocks → Markdown (tables with a header rule). */
export function blocksToMarkdown(blocks) {
  return blocks.filter((b) => !["header", "footer", "image", "pagebreak"].includes(b.type)).map((b) => b.type === "table" ? b.rows.map((r, i) => "| " + r.map((c) => String(c).replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ") + " |" + (i === 0 ? "\n|" + r.map(() => " --- |").join("") : "")).join("\n")
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
  // some runtimes decode windows-1252 as plain Latin-1: fix the 0x80-0x9F block (€ ‘ ’ “ ” – — …) ourselves
  const W1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";
  if (cp === 1252) { const dec = codec; codec = { decode: (u) => dec.decode(u).replace(/[\u0080-\u009f]/g, (c) => W1252[c.charCodeAt(0) - 128]) }; }
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
  // (a translated paragraph can't keep per-word bold / colour — the words move — so it keeps the
  // paragraph's own look: bold when all of it was bold)
  units.forEach((u, i) => { const t = texts[i]; if (t == null) return; if (u.r != null) nb[u.b].rows[u.r][u.c] = t; else { const b = nb[u.b]; b.text = t; if (b.runs) { const allB = b.runs.every((r) => r.b || !r.t.trim()), c = b.runs[0].c; b.runs = allB || (c && b.runs.every((r) => r.c === c)) ? [{ t, b: allB, i: false, c: b.runs.every((r) => r.c === c) ? c : null }] : null; if (!b.runs) delete b.runs; } if (/[\u0600-\u06FF]/.test(t) !== !!b.rtl) { delete b.rtl; if (b.align === "left" || b.align === "right") delete b.align; } } });
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

/* ---- Converter → Edit a PDF (v6.32): the editor's pure logic, no screen code ---------------------------------
   Everything is kept in page fractions (0..1, top-left origin, the page as it is shown), the same units as
   pdfWords and the reader's highlights. The phone (DocTools.kt "edit") and the computer (desktop/lib/pdf.js "edit")
   draw the result into the PDF itself: a changed line is covered with the page's own colour and the new text
   is written on top in the same size; highlights, drawings and the signature are drawn on the page;
   the pages are put in the new order, turned or left out. The original file is never changed. */

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/** Text the PDF's built-in font (Helvetica, WinAnsi) can write as real, selectable text. Anything else
 * (Arabic, Chinese, emoji…) is drawn as a sharp picture of the text instead. */
export function plainLatin(s) { return /^[\x20-\x7E -ÿ–—‘’“”•…€]*$/.test(String(s || "")); }

/** pdfWords' words [x, y, w, h, text] → lines [{x, y, w, h, size, base, text, rtl}] (top to bottom). A wide gap
 * (a table column) starts a new line, so tapping a cell changes only that cell. */
export function linesOf(words) {
  const ws = (words || []).filter((w) => w && String(w[4] || "").trim()).map((w) => ({ x: +w[0], y: +w[1], w: +w[2], h: +w[3], t: String(w[4]) }));
  ws.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x);
  const rows = [];
  for (const w of ws) {
    const cy = w.y + w.h / 2;
    const r = rows.find((r) => Math.abs(r.cy - cy) <= Math.min(r.h, w.h) * 0.45);
    if (r) { r.ws.push(w); r.h = Math.max(r.h, w.h); } else rows.push({ cy, h: w.h, ws: [w] });
  }
  const out = [];
  for (const r of rows) {
    r.ws.sort((a, b) => a.x - b.x);
    let cur = null;
    for (const w of r.ws) {
      if (cur && w.x - (cur.x1) > Math.max(w.h, cur.h) * 1.6) { out.push(cur); cur = null; }
      if (!cur) cur = { x: w.x, x1: w.x + w.w, y: w.y, y1: w.y + w.h, h: w.h, ws: [w] };
      else { cur.ws.push(w); cur.x1 = Math.max(cur.x1, w.x + w.w); cur.y = Math.min(cur.y, w.y); cur.y1 = Math.max(cur.y1, w.y + w.h); cur.h = Math.max(cur.h, w.h); }
    }
    if (cur) out.push(cur);
  }
  return out.map((c) => {
    const rtl = c.ws.filter((w) => ARABIC.test(w.t)).length * 2 > c.ws.length;
    const hs = c.ws.map((w) => w.h).sort((a, b) => a - b), h = hs[hs.length >> 1];
    const size = h / 1.08;    // pdfWords: h = size × 1.08, y = baseline − size × 0.82
    const bs = c.ws.map((w) => w.y + (w.h / 1.08) * 0.82).sort((a, b) => a - b);
    const text = (rtl ? [...c.ws].reverse() : c.ws).map((w) => w.t).join(" ");
    return { x: c.x, y: c.y, w: c.x1 - c.x, h: c.y1 - c.y, size, base: bs[bs.length >> 1], text, rtl, words: c.ws };
  }).sort((a, b) => a.y - b.y || a.x - b.x);
}

/** The line under a tap (a little room around it), or null. */
export function hitLine(lines, fx, fy) {
  let best = null, bd = 1e9;
  for (const l of lines || []) {
    const px = l.h * 0.6, py = l.h * 0.35;
    if (fx < l.x - px || fx > l.x + l.w + px || fy < l.y - py || fy > l.y + l.h + py) continue;
    const d = Math.abs(fy - (l.y + l.h / 2));
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

/** The edit (text, signature) under a tap, newest first. */
export function hitEdit(edits, page, fx, fy, ar = 0.707) {
  for (let i = (edits || []).length - 1; i >= 0; i--) {
    const e = edits[i]; if (e.page !== page) continue;
    const b = boxOf(e, ar); if (!b) continue;
    if (fx >= b.x - 0.01 && fx <= b.x + b.w + 0.01 && fy >= b.y - 0.006 && fy <= b.y + b.h + 0.006) return e;
  }
  return null;
}

/** About how wide a text is, as a fraction of the page width (Helvetica's average letter is ~0.52 em). */
export function textWidth(text, size, ar = 0.707, bold = false) { return String(text || "").length * size * (bold ? 0.58 : 0.52) / Math.max(0.2, ar); }

/** Where an edit sits on the page (for taps and for the picture of a non-Latin text). */
export function boxOf(e, ar = 0.707) {
  if (e.kind === "image") return { x: e.x, y: e.y, w: e.w, h: e.h };
  if (e.kind === "text" || e.kind === "retext") {
    const w = Math.max(e.kind === "retext" ? e.rect.w : 0, textWidth(e.text, e.size, ar, e.bold));
    const x = e.rtl ? e.x + (e.kind === "retext" ? e.rect.w : 0) - w : e.x;
    return { x, y: e.base - e.size * 0.9, w, h: e.size * 1.15 };
  }
  return null;
}

/** Words picked by dragging from (x0, y0) to (x1, y1): every word from the start word to the end word in reading
 * order, as one rectangle per line (what a highlighter does). */
export function selectRects(words, x0, y0, x1, y1) {
  const flat = [];
  linesOf(words).forEach((l, li) => { for (const w of l.words) flat.push({ ...w, li }); });
  if (!flat.length) return [];
  const near = (x, y) => { let k = -1, bd = 1e9; flat.forEach((w, i) => { const dx = x < w.x ? w.x - x : x > w.x + w.w ? x - w.x - w.w : 0; const dy = y < w.y ? w.y - y : y > w.y + w.h ? y - w.y - w.h : 0; const d = dx * dx + dy * dy * 4; if (d < bd) { bd = d; k = i; } }); return bd < 0.004 ? k : -1; };
  let a = near(x0, y0), b = near(x1, y1);
  if (a < 0 || b < 0) return [];
  if (a > b) [a, b] = [b, a];
  const byLine = new Map();
  for (const w of flat.slice(a, b + 1)) { const r = byLine.get(w.li); if (!r) byLine.set(w.li, { x: w.x, y: w.y, x1: w.x + w.w, y1: w.y + w.h }); else { r.x = Math.min(r.x, w.x); r.y = Math.min(r.y, w.y); r.x1 = Math.max(r.x1, w.x + w.w); r.y1 = Math.max(r.y1, w.y + w.h); } }
  return [...byLine.values()].map((r) => [r.x, r.y, r.x1 - r.x, r.y1 - r.y]);
}

/** A new order: page `from` (an index in the order) moved to `to`. */
export function movePage(order, from, to) {
  const o = [...order]; if (from < 0 || from >= o.length || to < 0 || to >= o.length || from === to) return o;
  const [p] = o.splice(from, 1); o.splice(to, 0, p); return o;
}

/** Has anything changed (so leaving asks first, and Save is offered)? */
export function changed(edits, order, count) {
  if ((edits || []).length) return true;
  if (!order || order.length !== count) return true;
  return order.some((p, i) => p.n !== i + 1 || (p.rot || 0) % 360 !== 0);
}

/**
 * The editor's state → what the phone / computer draws: {items, order}.
 * `picture(edit)` makes a picture of a text the PDF's font can't write ({png (base64), x, y, w, h}); without it
 * such a text is left out.
 */
export async function buildOps(edits, order, picture) {
  const items = [];
  for (const e of edits || []) {
    if (e.kind === "retext") items.push({ page: e.page, kind: "cover", x: e.rect.x, y: e.rect.y, w: e.rect.w, h: e.rect.h, color: e.bg || "#ffffff" });
    if (e.kind === "text" || e.kind === "retext") {
      if (!String(e.text || "").trim()) continue;
      if (plainLatin(e.text) && !e.rtl) items.push({ page: e.page, kind: "text", x: e.x, base: e.base, size: e.size, text: e.text, color: e.color || "#000000", bold: !!e.bold });
      else if (picture) { const p = await picture(e); if (p && p.png) items.push({ page: e.page, kind: "image", ...p }); }
    } else if (e.kind === "highlight") items.push({ page: e.page, kind: "highlight", rects: e.rects, color: e.color || "#ffd54a" });
    else if (e.kind === "ink") { if ((e.pts || []).length > 1) items.push({ page: e.page, kind: "ink", pts: e.pts, color: e.color || "#1e3a8a", width: e.width || 0.004 }); }
    else if (e.kind === "image") items.push({ page: e.page, kind: "image", png: e.png, x: e.x, y: e.y, w: e.w, h: e.h });
  }
  return { items, order: (order || []).map((p) => ({ n: p.n || 0, rot: ((p.rot || 0) % 360 + 360) % 360 })) };
}

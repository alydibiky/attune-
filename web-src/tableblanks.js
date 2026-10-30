/* ---- v6.38 (Ali: "the research still leaves blanks") — the "—" cells in an answer's tables are filled from the pages that were
   read, by code: for a blank cell, the spec is the column (or the row) that names one (power, price, 0–100 …, factsheet.js
   ATTRS) and the version is the other; a source sentence that mentions that version AND gives that spec's value fills it,
   with the source's number [n]. A column (or row) that NO source fills is dropped; what is still unknown after that is
   written "not published" instead of a bare dash. Pure; tests/unit/v740tableblanks.test.mjs.                               */
import { tr } from "./i18n.js";
import { ATTRS } from "./factsheet.js";

const BLANK = /^\s*(?:—|–|-|\?|n\/?a|na|tbd|tba|unknown|not (?:stated|given|available|listed|found)|غير متوفر|غير معروف|غير مذكور)?\s*$/i;
export const isBlank = (c) => BLANK.test(String(c == null ? "" : c).replace(/\*\*/g, ""));
const cellsOf = (row) => { const c = row.trim().replace(/^\||\|$/g, "").split("|").map((x) => x.trim()); return c; };
const isSep = (row) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(row);
const attrOf = (label) => { const l = String(label || "").replace(/\*\*/g, ""); const a = ATTRS.find(([, , , key]) => key.test(l)); return a || null; };
const fold = (s) => String(s || "").toLowerCase().replace(/\*\*/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The value of spec `attr` for version `name` in the sources → { value, n } | null. */
export function findValue(sources, name, attr) {
  const want = fold(name).split(" ").filter((w) => w.length >= 2 && !/^(the|and|with|version|trim|model)$/.test(w));
  if (!want.length) return null;
  const [, , , key, val] = attr;
  for (let i = 0; i < (sources || []).length; i++) {
    for (const line of String(sources[i].text || "").split("\n")) {
      // the sentence that names the version, and the one after it ("The 900 EM-P has … Prices start at …")
      const sents = line.split(/(?<=[.!?;])\s+/);
      for (let s = 0; s < sents.length; s++) {
        if (sents[s].length > 500) continue;
        const f = new Set(fold(sents[s]).split(" "));
        if (!want.every((w) => f.has(w))) continue;
        for (const p of [sents[s], sents[s + 1] || ""]) {
          // the next sentence counts only when it names no other version
          if (p !== sents[s] && /\b\d{2,4}\s?[A-Z][\w-]*\b/.test(p) && !want.every((w) => fold(p).split(" ").includes(w)) && /\b(trim|version|max|pro|plus|ultra)\b/i.test(p)) continue;
          const k = p.search(key); if (k < 0) continue;
          const m = p.slice(k, k + 110).match(val) || p.slice(Math.max(0, k - 40), k + 20).match(val);
          if (m) return { value: m[0].trim().replace(/\s+/g, " "), n: i + 1 };
        }
      }
    }
  }
  return null;
}

/** Fill / prune every markdown table in `md`. → { md, filled, dropped, left } */
export function fillBlanks(md, sources, { ar = false } = {}) {
  const lines = String(md || "").split("\n"); let filled = 0, dropped = 0, left = 0;
  const NP = ar ? "مش منشور" : tr("not published");
  const out = [];
  for (let i = 0; i < lines.length; ) {
    if (!(lines[i].includes("|") && i + 1 < lines.length && isSep(lines[i + 1]))) { out.push(lines[i++]); continue; }
    const head = cellsOf(lines[i]); const rows = []; let j = i + 2;
    while (j < lines.length && lines[j].includes("|") && lines[j].trim()) rows.push(cellsOf(lines[j++]));
    const W = head.length;
    for (const r of rows) while (r.length < W) r.push("");
    // fill
    for (const r of rows) for (let c = 1; c < W; c++) {
      if (!isBlank(r[c])) continue;
      const colA = attrOf(head[c]), rowA = attrOf(r[0]);
      const hit = colA && !rowA ? findValue(sources, r[0], colA) : rowA && !colA ? findValue(sources, head[c], rowA) : null;
      if (hit) { r[c] = `${hit.value} [${hit.n}]`; filled++; }
    }
    // a column / row nobody could fill goes
    const keepCol = head.map((h, c) => c === 0 || rows.some((r) => !isBlank(r[c])));
    dropped += keepCol.filter((k) => !k).length;
    const rows2 = rows.filter((r) => r.some((x, c) => c > 0 && keepCol[c] && !isBlank(x)));
    dropped += rows.length - rows2.length;
    if (!rows2.length || keepCol.filter(Boolean).length < 2) { j > i && out.push(...lines.slice(i, j)); i = j; continue; }
    const fmt = (cs) => "| " + cs.filter((_, c) => keepCol[c]).join(" | ") + " |";
    out.push(fmt(head), fmt(head.map(() => "---")));
    for (const r of rows2) out.push(fmt(r.map((x, c) => (c > 0 && isBlank(x) ? (left++, NP) : x))));
    i = j;
  }
  return { md: out.join("\n"), filled, dropped, left };
}

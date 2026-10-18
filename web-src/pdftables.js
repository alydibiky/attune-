/* ---- v6.40 (upgrade S3) — Doc chat that calculates. The tables of a PDF are rebuilt BY CODE from where each word sits on the
   page (pdfWords: [x, y, w, h, text] as fractions of the page): words → lines → cells (a wide gap starts a new cell) → a run
   of 3+ lines with the same columns is a table; its first line is the header when it has no numbers; a table that goes on
   over several pages (the same header) is one table. Then:
     - "total of the amount column", "average price", "highest balance", "how many rows", «إجمالي المبلغ», «متوسط السعر»
       are answered by code over every row — exact, with the rows and pages counted;
     - every table can be saved as one Excel file (a sheet each).
   Pure; tests/unit/v740pdftables.test.mjs.                                                                                 */
const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");
/** "1,234.50" "(1,200)" "EGP 3,000" "12%" "-45" → number | null */
export function numOf(s) {
  const t = latin(s).replace(/\s/g, "");
  if (!/\d/.test(t) || /[a-zA-Z؀-ۿ]{4,}/.test(t.replace(/(EGP|USD|EUR|SAR|AED|LE|جنيه|ج\.م|ريال)/gi, ""))) return null;
  const neg = /^\(.*\)$/.test(t) || /^-/.test(t.replace(/^[^\d-]+/, ""));
  const m = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/.exec(t);
  if (!m) return null;
  const v = parseFloat(m[0].replace(/,/g, ""));
  return neg ? -v : v;
}
const isNum = (c) => numOf(c) != null && /^[\s(\-+]*[^\s\d]{0,4}\s?[\d.,٠-٩٫٬]+[\s)%]*[^\s\d]{0,4}\s*$/.test(String(c).trim());

/** One page's words → its lines → cells: [{ y, cells: [{ x, x2, text }] }] */
export function linesOf(words, gap = 0.018) {
  const ws = [...(words || [])].filter((w) => w && String(w[4] || "").trim()).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const lines = [];
  for (const w of ws) {
    const l = lines.find((x) => Math.abs(x.y - w[1]) < Math.max(0.004, w[3] * 0.5));
    if (l) l.words.push(w); else lines.push({ y: w[1], words: [w] });
  }
  return lines.sort((a, b) => a.y - b.y).map((l) => {
    const sorted = l.words.sort((a, b) => a[0] - b[0]), cells = [];
    for (const w of sorted) {
      const c = cells[cells.length - 1];
      if (c && w[0] - c.x2 < gap) { c.text += " " + w[4]; c.x2 = w[0] + w[2]; } else cells.push({ x: w[0], x2: w[0] + w[2], text: String(w[4]) });
    }
    return { y: l.y, cells };
  });
}

/** pages [{ n, words }] → tables [{ pages: [n…], head: [..], rows: [[..]] }] */
export function tablesOf(pages) {
  const found = [];
  for (const pg of pages || []) {
    const lines = linesOf(pg.words);
    let run = [];
    const close = () => {
      // (a short run is still a table when it goes on from the last page's table, with the same header)
      const last = found[found.length - 1];
      const goesOn = run.length >= 2 && last && last.pages[last.pages.length - 1] === pg.n - 1 && run[0].cells.map((c) => c.text).join("|").toLowerCase() === last.head.join("|").toLowerCase();
      if ((run.length >= 3 && run.filter((l) => l.cells.some((c) => isNum(c.text))).length >= 2) || goesOn) {
        // the columns: the x-starts of the line with the most cells; every cell goes to the nearest column
        const ref = run.reduce((a, l) => (l.cells.length > a.cells.length ? l : a), run[0]);
        const cols = ref.cells.map((c) => (c.x + c.x2) / 2);
        const grid = run.map((l) => { const row = cols.map(() => ""); for (const c of l.cells) { const mid = (c.x + c.x2) / 2; let k = 0; for (let i = 1; i < cols.length; i++) if (Math.abs(cols[i] - mid) < Math.abs(cols[k] - mid)) k = i; row[k] = row[k] ? row[k] + " " + c.text : c.text; } return row; });
        const headIsText = grid[0].every((c) => !isNum(c)) && grid[0].filter(Boolean).length >= 2;
        const head = headIsText ? grid[0] : cols.map((_, i) => "Column " + (i + 1));
        const rows = (headIsText ? grid.slice(1) : grid).filter((r) => r.some((c) => c));
        found.push({ pages: [pg.n], head, rows });
      }
      run = [];
    };
    for (const l of lines) {
      const n = l.cells.length;
      if (n >= 2 && (!run.length || Math.abs(n - run[run.length - 1].cells.length) <= 1)) run.push(l);
      else { close(); if (n >= 2) run.push(l); }
    }
    close();
  }
  // a table that goes on to the next page with the same header is one table
  const out = [];
  for (const t of found) {
    const prev = out[out.length - 1];
    if (prev && prev.head.join("|").toLowerCase() === t.head.join("|").toLowerCase() && !/^Column 1$/.test(t.head[0]) && t.pages[0] === prev.pages[prev.pages.length - 1] + 1) { prev.rows.push(...t.rows); prev.pages.push(...t.pages); }
    else out.push({ ...t, rows: [...t.rows] });
  }
  return out;
}

const OPS = [
  ["sum", /\b(total|sum|add up|altogether|in total)\b|اجمالي|إجمالي|مجموع|المجموع|جمع|كام كله|كله كام/i],
  ["avg", /\b(average|mean|avg)\b|متوسط|المتوسط|معدل/i],
  ["max", /\b(highest|largest|biggest|maximum|max|most)\b|اعلى|أعلى|اكبر|أكبر|اكتر|أكتر/i],
  ["min", /\b(lowest|smallest|minimum|min|least)\b|اقل|أقل|اصغر|أصغر/i],
  ["count", /\b(how many (rows|items|lines|entries|records)|count|number of (rows|items|lines|entries))\b|عدد|كام صف|كام بند/i],
];
const fold = (s) => latin(s).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة\b/g, "ه").replace(/^ال/, "").replace(/\s+ال/g, " ").replace(/[^\p{L}\p{N}%]+/gu, " ").trim();
/** "total of the amount column over all pages" → { op, column, rows, pages, value, table } | null (not a table question) */
export function tableAnswer(question, tables) {
  const q = String(question || "");
  const op = (OPS.find(([, re]) => re.test(q)) || [])[0];
  if (!op || !(tables || []).length) return null;
  const fq = " " + fold(q) + " ";
  // the column the question names (its header, whole words), else "column 3"
  let best = null;
  const colNo = /\b(?:column|col)\s*(\d{1,2})\b|العمود\s*(\d{1,2})/i.exec(latin(q));
  for (const t of tables) t.head.forEach((h, i) => {
    const fh = fold(h); if (!fh) return;
    const hit = fq.includes(" " + fh + " ") ? 3 : fh.split(" ").filter((w) => w.length >= 3 && fq.includes(" " + w + " ")).length;
    const num = t.rows.filter((r) => numOf(r[i]) != null).length;
    if (hit && num && (!best || hit > best.hit || (hit === best.hit && num > best.num))) best = { t, i, hit, num };
  });
  if (!best && colNo) { const k = +(colNo[1] || colNo[2]) - 1; const t = tables.find((x) => x.head.length > k); if (t) best = { t, i: k }; }
  if (!best) return null;
  const vals = best.t.rows.map((r) => numOf(r[best.i])).filter((v) => v != null);
  if (!vals.length && op !== "count") return null;
  const r2 = (v) => Math.round(v * 100) / 100;
  const value = op === "sum" ? r2(vals.reduce((a, b) => a + b, 0)) : op === "avg" ? r2(vals.reduce((a, b) => a + b, 0) / vals.length) : op === "max" ? Math.max(...vals) : op === "min" ? Math.min(...vals) : best.t.rows.length;
  const at = op === "max" || op === "min" ? best.t.rows.find((r) => numOf(r[best.i]) === value) : null;
  return { op, column: best.t.head[best.i], value, rows: op === "count" ? best.t.rows.length : vals.length, pages: best.t.pages, row: at ? at.filter(Boolean).join(" · ") : "" };
}
/** The answer as one sentence (English / Egyptian Arabic). */
export function answerText(a, ar = false) {
  const v = a.value.toLocaleString("en-US", { maximumFractionDigits: 2 }), pg = a.pages.length > 1 ? `${a.pages[0]}–${a.pages[a.pages.length - 1]}` : String(a.pages[0]);
  const W = { sum: ["The total of", "إجمالي"], avg: ["The average of", "متوسط"], max: ["The highest", "أعلى"], min: ["The lowest", "أقل"], count: ["The rows in the table with", "عدد صفوف الجدول اللي فيه"] }[a.op];
  if (ar) return `${W[1]} «${a.column}»: **${v}** — اتحسب بالكود من ${a.rows} صف في صفحة ${pg} [p. ${a.pages[0]}].${a.row ? " الصف: " + a.row : ""}`;
  return `${W[0]} “${a.column}”: **${v}** — calculated by code from ${a.rows} rows on page${a.pages.length > 1 ? "s" : ""} ${pg} [p. ${a.pages[0]}].${a.row ? " Row: " + a.row : ""}`;
}

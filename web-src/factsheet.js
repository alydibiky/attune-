/* ---- v5.34: the facts sheet — figures copied from the web by CODE ---------------------------
   Ali: "the web search is still shit — make it a beast". The weak link was never the search: it
   was a small phone model re-typing dozens of figures from long pages ("1.2.93-metres",
   "600kWkW", "0–1000 km/h"). So the figures no longer go through the model at all:
     - for every spec people ask about (power, torque, price, range, battery, 0–100, top speed,
       size, weight, seats, lifting capacity, boom, storage …) code finds, on every source, the
       value written next to it — in "Spec | Value" table rows, "Spec: value" lines and sentences;
     - values found on 2+ sites are marked ✓ (confirmed); when sites disagree both are shown;
     - multi-column tables on the pages (trims, versions, load charts) are copied as written.
   The model writes the direct answer and what it means; the sheet under it is exact, cited, and
   can't be garbled. Pure functions; tests in tests/unit/v534.test.mjs.                          */

const N = "(\\d{1,3}(?:[,.]\\d{3})+(?:\\.\\d+)?|\\d+(?:[.,]\\d+)?)";
const CUR = "(?:EGP|LE|L\\.E\\.?|E£|US\\$|USD|\\$|€|EUR|£|GBP|CNY|RMB|yuan|AED|SAR|جنيه|دولار|يورو|يوان|ريال|درهم)";
const V = (unit) => new RegExp(N + "\\s?-?(?:" + unit + ")(?![a-z])", "i");
const PRICE_V = new RegExp("(?:" + CUR + "\\s?" + N + "(?:\\s?(?:k|million|m|ألف|مليون))?|" + N + "(?:\\s?(?:k|million|ألف|مليون))?\\s?" + CUR + ")", "i");

// [id, English label, Arabic label, key words, value pattern]
export const ATTRS = [
  ["price", "Price", "السعر", /\b(price[sd]?|cost|priced|starts? (at|from)|msrp|sells? for)\b|سعر|بسعر|يبدأ من|بكام/i, PRICE_V],
  ["power", "Power", "القوة", /\b(power|output|horsepower|hp|bhp|ps)\b|القوة|قوة|قدرة|حصان/i, V("hp|bhp|ps|kw|حصان")],
  ["torque", "Torque", "العزم", /\btorque\b|عزم/i, V("nm|n·m|n\\.m|lb-?ft|نيوتن")],
  ["battery", "Battery", "البطارية", /\bbatter(y|ies)\b|بطارية/i, V("kwh|mah")],
  ["range", "Range", "المدى", /\b(range|wltp|cltc|epa|nedc)\b|المدى|مدى|مسافة السير/i, V("km|kilomet(?:er|re)s?|miles|mi|كم")],
  ["accel", "0–100 km/h", "من 0 لـ100", /\b(0\s?[-–]\s?100|0\s?to\s?100|0\s?[-–]\s?60|acceleration|accelerates)\b|تسارع/i, V("s|sec|seconds|ثانية|ثواني")],
  ["top", "Top speed", "السرعة القصوى", /\b(top speed|max(imum)? speed)\b|السرعة القصوى|سرعة قصوى/i, V("km\\/h|kph|kmh|mph|كم\\/س")],
  ["engine", "Engine", "المحرك", /\b(engine|displacement)\b|محرك|سعة المحرك/i, V("l|litre|liter|cc|cm3")],
  ["charge", "Charging", "الشحن", /\bcharg(e|ing|er)\b|شحن/i, V("kw|w|minutes|min")],
  ["length", "Length", "الطول", /\blength\b|الطول/i, V("mm|metres?|meters?|m|cm|مم|متر")],
  ["width", "Width", "العرض", /\bwidth\b|العرض/i, V("mm|metres?|meters?|m|cm|مم|متر")],
  ["height", "Height", "الارتفاع", /\bheight\b|الارتفاع/i, V("mm|metres?|meters?|m|cm|مم|متر")],
  ["wheelbase", "Wheelbase", "قاعدة العجلات", /\bwheelbase\b|قاعدة العجلات/i, V("mm|metres?|meters?|m|cm|مم")],
  ["weight", "Weight", "الوزن", /\b(weight|kerb|curb|weighs)\b|الوزن|وزن/i, V("kg|t|tonnes?|tons?|lbs?|كجم|طن")],
  ["seats", "Seats", "المقاعد", /\b(seats?|seater|seating)\b|مقاعد|ركاب/i, /(\d{1,2})\s?-?(?:seats?|seater|مقاعد|راكب)/i],
  ["capacity", "Capacity", "الحمولة", /\b(capacity|payload|lifting|max(imum)? load)\b|حمولة|سعة|رفع/i, V("t|tons?|tonnes?|kg|l|litres?|liters?|طن")],
  ["boom", "Boom", "الذراع", /\b(boom|jib)\b|ذراع|البوم/i, V("m|metres?|meters?|ft|متر")],
  ["storage", "Storage", "التخزين", /\b(storage|rom)\b|تخزين/i, V("gb|tb|جيجا")],
  ["ram", "RAM", "الرام", /\b(ram|memory)\b|رام|الذاكرة/i, V("gb|جيجا")],
  ["screen", "Screen", "الشاشة", /\b(screen|display)\b|شاشة/i, V("-?inch(?:es)?|″|\"|in|بوصة")],
  ["camera", "Camera", "الكاميرا", /\bcamera\b|كاميرا/i, V("mp|megapixels?|ميجا")],
  ["fuel", "Fuel use", "استهلاك الوقود", /\b(consumption|fuel economy|economy)\b|استهلاك/i, V("l\\/100\\s?km|km\\/l|mpg|لتر")],
  ["motor", "Motor", "الموتور", /\bmotor\b|موتور/i, V("w|kw")],
];

const norm = (v) => String(v).toLowerCase().replace(/[\s,]/g, "").replace(/litres?|liters?/g, "l").replace(/kilomet(er|re)s?/g, "km").replace(/seconds?|sec/g, "s");
const cells = (row) => row.split("|").map((c) => c.trim()).filter((c, i, a) => c || (i > 0 && i < a.length - 1));

/** Every (spec, value) found in one source's text. */
export function factsIn(text) {
  const out = [];
  const lines = String(text || "").split(/\n|(?<=[.!?;])\s+(?=[A-Z0-9؀-ۿ])/);
  for (const raw of lines) {
    const line = raw.replace(/^\[[^\]]{1,80}\]\s*/, "").trim();   // the ranker's "[heading] " prefix
    if (!/\d/.test(line) || line.length > 600) continue;
    const cs = line.includes("|") ? cells(line) : null;
    for (const [id, , , key, val] of ATTRS) {
      let v = null;
      if (cs && cs.length === 2) {
        // "Spec | Value" rows (spec sheets)
        if (key.test(cs[0]) && /\d/.test(cs[1])) { const m = cs[1].match(val); v = m ? m[0] : cs[1].slice(0, 40); }
      } else if (!cs) {
        const k = line.search(key);
        if (k < 0) continue;
        // the value right after the spec word (or just before it: "598 hp of power")
        const after = line.slice(k, k + 110).match(val);
        const before = !after ? line.slice(Math.max(0, k - 40), k + 20).match(val) : null;
        v = after ? after[0] : before ? before[0] : null;
      }
      if (v) out.push({ id, value: v.trim().replace(/\s+/g, " ") });
    }
  }
  return out;
}

/** Multi-column tables on a page ("Trim | Power | Torque | Price"), as written. */
export function tablesIn(text, maxRows = 9, maxCols = 6) {
  const rows = String(text || "").split("\n").map((l) => l.replace(/^\[[^\]]{1,80}\]\s*/, "").trim());
  const out = []; let cur = [];
  const flush = () => { if (cur.length >= 3 && cur.some((r) => /\d/.test(r.join(" ")))) out.push(cur.slice(0, maxRows)); cur = []; };
  for (const l of rows) {
    const cs = l.includes(" | ") ? cells(l) : null;
    if (cs && cs.length >= 3) { if (cur.length && Math.abs(cs.length - cur[0].length) > 1) flush(); cur.push(cs.slice(0, maxCols)); }
    else flush();
  }
  flush();
  return out;
}

/**
 * The facts sheet for a question from the ranked sources → { md, rows, tables } (md "" when
 * too little was found to be worth showing).
 */
export function factSheet(question, sources, ar = false) {
  const q = String(question || "");
  const found = new Map();           // id → Map(norm → { shown, srcs:Set })
  (sources || []).forEach((h, i) => {
    for (const f of factsIn((h && h.text) || "")) {
      if (!found.has(f.id)) found.set(f.id, new Map());
      const m = found.get(f.id), k = norm(f.value);
      if (!m.has(k)) m.set(k, { shown: f.value, srcs: new Set() });
      m.get(k).srcs.add(i + 1);
    }
  });
  // what the question asks about comes first
  const asked = new Set(ATTRS.filter(([, en, arl, key]) => key.test(q)).map(([id]) => id));
  const rows = [];
  for (const [id, en, arl] of ATTRS) {
    const m = found.get(id); if (!m) continue;
    const vals = [...m.values()].sort((a, b) => b.srcs.size - a.srcs.size).slice(0, 3);
    const cite = (s) => [...s].sort((a, b) => a - b).slice(0, 4).map((n) => "[" + n + "]").join("");
    const cell = vals.map((v, j) => (j ? (ar ? "أو " : "or ") : "") + v.shown + (v.srcs.size >= 2 ? " ✓" : "") + " " + cite(v.srcs)).join(" · ");
    rows.push({ id, label: ar ? arl : en, cell, asked: asked.has(id), confirmed: vals[0].srcs.size >= 2 });
  }
  rows.sort((a, b) => (b.asked - a.asked) || (b.confirmed - a.confirmed));
  const keepRows = rows.slice(0, 14);
  // tables that match the question or carry the specs (trims, versions, load charts)
  const qWords = (q.toLowerCase().match(/[a-z؀-ۿ]{3,}|\d{2,}/g) || []);
  const tables = [];
  (sources || []).forEach((h, i) => {
    for (const t of tablesIn((h && h.text) || "")) {
      const head = t[0].join(" ").toLowerCase();
      const hit = ATTRS.some(([, , , key]) => key.test(head)) || qWords.some((w) => head.includes(w));
      if (hit && tables.length < 2) tables.push({ src: i + 1, site: siteOf(h.url), rows: t });
    }
  });
  if (keepRows.length < 2 && !tables.length) return { md: "", rows: keepRows, tables };
  let md = "";
  if (keepRows.length >= 2) {
    md += (ar ? "### الأرقام من المصادر (منقولة بالحرف)\n" : "### Key figures (copied exactly from the sources)\n") +
      (ar ? "| البند | القيمة | \n| --- | --- |\n" : "| Spec | Value |\n| --- | --- |\n") +
      keepRows.map((r) => "| " + r.label + " | " + r.cell.replace(/\|/g, "/") + " |").join("\n") + "\n" +
      (keepRows.some((r) => /✓/.test(r.cell)) ? (ar ? "\n✓ = الرقم نفسه في موقعين أو أكثر.\n" : "\n✓ = the same figure on 2 or more sites.\n") : "");
  }
  for (const t of tables) {
    const w = Math.max(...t.rows.map((r) => r.length));
    const pad = (r) => { const c = r.map((x) => String(x || "—").replace(/\|/g, "/")); while (c.length < w) c.push("—"); return c; };
    md += "\n" + (ar ? "#### جدول من " : "#### Table from ") + (t.site || "source") + " [" + t.src + "]\n" +
      "| " + pad(t.rows[0]).join(" | ") + " |\n|" + Array(w).fill(" --- ").join("|") + "|\n" +
      t.rows.slice(1).map((r) => "| " + pad(r).join(" | ") + " |").join("\n") + "\n";
  }
  return { md: md.trim(), rows: keepRows, tables };
}

function siteOf(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }

/** Tell the model the sheet exists, so it writes the meaning and the few key figures only. */
export const SHEET_NOTE = "\n\n(The app adds a table of the exact figures copied from the sources under your answer. So: give the direct answer first, then what matters — the key 3–6 points, comparisons and what they mean for the person — citing sources. Quote only the most important figures.)";

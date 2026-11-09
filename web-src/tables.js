/* ---- v9.9.6 N1 (Ali OK'd: "tables from one sentence, like Notion databases — 'track my cranes: name, tonnage, next inspection' makes
   the table; Table · Board · Calendar; a date column becomes reminders; rows added by talking; it lives in Lists").
     parseTrack(text)            → { name, cols: [{ id, name, type: text|number|date|status }] } | null
     parseRow(table, text)       → "add Grove GMK, 100 tons, inspection 4 Dec" → { name: table, cells } | null (each value to its column)
     addRow / setCell / delRow   → the store, pure
     dueReminders(table, now)    → a reminder the day before each future date cell, 9:00 ({ id, at, title })
     board(table) / calendar(table, month) → the two other views
   Store: TABLES_KEY = { v: 1, tables: [{ id, name, cols, rows: [{ id, cells: { colId: value } }], created }] }. Tests: v996tables. */
import { dateIn } from "./lists.js";

export const TABLES_KEY = "attune:tables:v1";
const ls = () => (typeof localStorage !== "undefined" ? localStorage : null);
export const empty = () => ({ v: 1, tables: [] });
export function loadTables(st = ls()) { try { const v = JSON.parse((st && st.getItem(TABLES_KEY)) || "null"); return v && Array.isArray(v.tables) ? v : empty(); } catch (e) { return empty(); } }
export function saveTables(t, st = ls()) { try { st && st.setItem(TABLES_KEY, JSON.stringify(t)); } catch (e) {} try { window.dispatchEvent(new CustomEvent("attune-tables")); } catch (e) {} return t; }
const nid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const fold = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
const AR_D = "٠١٢٣٤٥٦٧٨٩", latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d));

const DATE_COL = /\b(date|day|due|expir\w*|renew\w*|inspection|deadline|next|birthday|starts?|ends?|when|appointment)\b|تاريخ|موعد|ميعاد|معاد|تجديد|انتهاء|فحص|عيد ميلاد/i;
const NUM_COL = /\b(tons?|tonnage|price|amount|cost|qty|quantity|count|km|hours?|age|year|capacity|weight|salary|rent)\b|طن|حمولة|حموله|سعر|مبلغ|تكلفة|عدد|كم|ساعات|سن|سنة|سنه|مرتب|ايجار/i;
const STATUS_COL = /\b(status|state|stage|condition)\b|الحالة|الحاله|حالة|حاله|مرحلة/i;
export const typeOf = (name) => (STATUS_COL.test(name) ? "status" : DATE_COL.test(name) ? "date" : NUM_COL.test(name) ? "number" : "text");

const TRACK = /^\s*(?:please\s+)?(?:track|keep track of|make (?:me )?a table (?:of|for)|table of|log)\s+(?:my|our|the)?\s*(.{2,40}?)\s*[:\-–]\s*(.+)$/i;
const TRACK_AR = /^\s*(?:تابع|تابعلي|اعمل(?:لي)? جدول|جدول)\s+(?:ل|لل|بال)?\s*(.{2,30}?)\s*[:\-–]\s*(.+)$/;
export function parseTrack(text) {
  const t = String(text || "").trim(); const m = TRACK.exec(t) || TRACK_AR.exec(t); if (!m) return null;
  const names = m[2].split(/\s*(?:,|،|;|\band\b| و(?=\S))\s*/).map((x) => x.trim().replace(/[.!]+$/, "")).filter((x) => x.length >= 2).slice(0, 12);
  if (names.length < 2) return null;
  const name = m[1].replace(/^(my|our|the)\s+/i, "").trim();
  return { name: name.charAt(0).toUpperCase() + name.slice(1), cols: names.map((n) => ({ id: nid("c"), name: n.charAt(0).toUpperCase() + n.slice(1), type: typeOf(n) })) };
}
export function makeTable(p, now = Date.now()) { return { id: nid("t"), name: p.name, cols: p.cols, rows: [], created: now }; }

const MONTHS = [["jan", "يناير"], ["feb", "فبراير"], ["mar", "مارس"], ["apr", "ابريل"], ["may", "مايو"], ["jun", "يونيو"], ["jul", "يوليو"], ["aug", "اغسطس"], ["sep", "سبتمبر"], ["oct", "اكتوبر"], ["nov", "نوفمبر"], ["dec", "ديسمبر"]];
const pad = (n) => String(n).padStart(2, "0");
/** "4 Dec" / "Dec 4" / "4 December 2026" / «٤ ديسمبر» / "4/12" / "Thursday" / "tomorrow" → "YYYY-MM-DD" (the next such day), or "". */
export function dateOf(s, now = Date.now()) {
  const t = latin(s).toLowerCase(); const d0 = new Date(now);
  const mi = MONTHS.findIndex(([en, ar]) => new RegExp("\\b" + en + "[a-z]*\\b").test(t) || t.includes(ar.replace(/[أإآ]/g, "ا")) || t.includes(ar));
  if (mi >= 0) {
    const day = +((/\b(\d{1,2})(?:st|nd|rd|th)?\b/.exec(t.replace(/\b\d{4}\b/, "")) || [])[1] || 1), y0 = /\b(20\d{2})\b/.exec(t);
    let y = y0 ? +y0[1] : d0.getFullYear(); let iso = y + "-" + pad(mi + 1) + "-" + pad(day);
    if (!y0 && iso < d0.toISOString().slice(0, 10)) iso = (y + 1) + "-" + pad(mi + 1) + "-" + pad(day);
    return day >= 1 && day <= 31 ? iso : "";
  }
  return dateIn(s, now);
}
const numOf = (s) => { const m = /([\d][\d,]*(?:\.\d+)?)\s*(k|الف|ألف)?/i.exec(latin(s)); if (!m) return null; const v = +m[1].replace(/,/g, ""); return m[2] ? v * 1000 : v; };

const ADD = /^\s*(?:please\s+)?(?:add|new|put|log)\s+(.+?)(?:\s+(?:to|in|into)\s+(?:my\s+|the\s+)?([\p{L}][\p{L} ]{1,30}))?\s*$/iu;
const ADD_AR = /^\s*(?:ضيف|زود|سجل)\s+(.+?)(?:\s+(?:في|ل|على)\s+(?:جدول\s+)?([\p{L}][\p{L} ]{1,30}))?\s*$/u;
/** "add Grove GMK, 100 tons, inspection 4 Dec" (to the table named, or the one table whose columns fit) → { table, cells } */
export function parseRow(store, text, now = Date.now()) {
  const t = String(text || "").trim(); const m = ADD.exec(t) || ADD_AR.exec(t); if (!m) return null;
  let parts = m[1], tname = m[2] || "";
  const tables = (store && store.tables) || []; if (!tables.length) return null;
  let tb = tname ? tables.find((x) => fold(x.name).includes(fold(tname)) || fold(tname).includes(fold(x.name).replace(/s$/, ""))) : null;
  if (tname && !tb) return null;   // "add milk to my shopping list": a list, not a table
  if (!tb && tables.length === 1) tb = tables[0];
  if (!tb) { tb = tables.find((x) => fold(parts).includes(fold(x.name).replace(/s$/, ""))) || null; }
  if (!tb) return null;
  const vals = parts.split(/\s*(?:,|،|;)\s*/).map((x) => x.trim()).filter(Boolean);
  const cells = {}, used = new Set(), done = new Set();
  const valFor = (c, v) => (c.type === "date" ? dateOf(v, now) : c.type === "number" ? numOf(v) : v);
  const words = (s) => fold(s).split(" ").filter((w) => w.length >= 3);
  // 1. a value that names its column ("inspection 4 Dec", "100 tons" → Tonnage) → that column
  vals.forEach((v, k) => {
    const c = tb.cols.find((col) => !used.has(col.id) && col.type !== "text" && words(v).some((w) => words(col.name).some((cw) => cw.startsWith(w) || w.startsWith(cw.replace(/s$/, "")) || (w.length >= 3 && cw.startsWith(w.slice(0, 3))))));
    if (!c) return; const val = valFor(c, v); if (val == null || val === "") return;
    cells[c.id] = val; used.add(c.id); done.add(k);
  });
  // 2. the rest by kind: a date → the first empty date column, a number → the first empty number column, words → the first text column
  vals.forEach((v, k) => {
    if (done.has(k)) return;
    const lv = latin(v).trim(), dv = dateOf(v, now), nv = numOf(v);
    const hasMonth = MONTHS.some(([en, ar]) => new RegExp("\\b" + en + "[a-z]*\\b", "i").test(lv) || lv.includes(ar));
    const want = dv && (hasMonth || !/^[\d.,]+\s*[\p{L}]*$/u.test(lv)) ? "date" : nv != null && /^[\d.,]+\s*(k|tons?|km|hours?|طن|كم|ساعه|ساعة)?$/iu.test(lv) ? "number" : "text";
    const free = (ty) => tb.cols.find((col) => !used.has(col.id) && col.type === ty);
    const nameUsed = used.has((tb.cols.find((x) => x.type === "text") || {}).id);
    // words after the name fill the status first ("waiting"); a number with no number column goes to a text one (a phone)
    const c = want === "date" ? free("date") : want === "number" ? free("number") || free("text") : (nameUsed ? free("status") || free("text") : free("text") || free("status"));
    if (!c) return;
    cells[c.id] = want === "date" ? dv : want === "number" && c.type === "number" ? nv : v; used.add(c.id); done.add(k);
  });
  // (strict, M1: with no table named, a row needs 2+ values that fit — "add milk" stays a list item)
  if (!tname && (vals.length < 2 || Object.keys(cells).length < 2)) return null;
  return Object.keys(cells).length ? { table: tb.id, cells } : null;
}
export const addRow = (store, tableId, cells) => ({ ...store, tables: store.tables.map((t) => (t.id === tableId ? { ...t, rows: [...t.rows, { id: nid("r"), cells: { ...cells } }] } : t)) });
export const setCell = (store, tableId, rowId, colId, value) => ({ ...store, tables: store.tables.map((t) => (t.id !== tableId ? t : { ...t, rows: t.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r)) })) });
export const delRow = (store, tableId, rowId) => ({ ...store, tables: store.tables.map((t) => (t.id !== tableId ? t : { ...t, rows: t.rows.filter((r) => r.id !== rowId) })) });
export const delTable = (store, tableId) => ({ ...store, tables: store.tables.filter((t) => t.id !== tableId) });

/** The row's name (its first text column). */
export const rowName = (t, r) => { const c = t.cols.find((x) => x.type === "text") || t.cols[0]; return String((r.cells || {})[c.id] || "").trim() || "—"; };
/** A reminder the day before each future date, 9:00: "Grove GMK — Next inspection tomorrow". */
export function dueReminders(t, now = Date.now()) {
  const out = [];
  for (const c of t.cols.filter((x) => x.type === "date")) for (const r of t.rows) {
    const d = (r.cells || {})[c.id]; if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ""))) continue;
    const at = Date.parse(d + "T09:00:00") - 864e5; if (at <= now) continue;
    out.push({ id: "tbl-" + t.id + "-" + r.id + "-" + c.id, at, title: rowName(t, r) + " — " + c.name, body: d, repeat: "none", source: "table" });
  }
  return out;
}
/** Board: the rows grouped by the status column (or the first text column after the name). */
export function board(t) {
  const c = t.cols.find((x) => x.type === "status") || t.cols.filter((x) => x.type === "text")[1]; if (!c) return null;
  const groups = new Map();
  for (const r of t.rows) { const k = String((r.cells || {})[c.id] || "").trim() || "—"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  return { col: c, groups: [...groups.entries()].map(([k, rows]) => ({ key: k, rows })) };
}
/** Calendar: { "YYYY-MM-DD": [{ row, col }] } for the date columns. */
export function calendar(t) {
  const out = {};
  for (const c of t.cols.filter((x) => x.type === "date")) for (const r of t.rows) { const d = (r.cells || {})[c.id]; if (/^\d{4}-\d{2}-\d{2}$/.test(String(d || ""))) (out[d] = out[d] || []).push({ row: r, col: c }); }
  return out;
}

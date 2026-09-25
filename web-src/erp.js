/* ---- Business: a small ERP that the owner can reshape, like Microsoft Access -------------
   A "system" is a set of tables (Customers, Equipment, Jobs, Invoices…). Each
   table has fields (columns) of a type, and records (rows). Everything is kept
   by id, not by name, so renaming a column never loses data — the same idea
   as Access's Design view.

   The AI designs the first version from a description of the business (or a
   template is used offline) and can change it later from a sentence ("add the
   driver's phone to Jobs"), but every change is a plain operation that is
   shown before it is applied and can be undone.

   Pure logic, no React — unit tested in tests/unit/erp.test.mjs.            */

// ---- field types ------------------------------------------------------------------------
export const FIELD_TYPES = {
  text: "Text", longtext: "Long text", number: "Number", money: "Money", date: "Date", bool: "Yes / No",
  choice: "Choice", link: "Link to another table", phone: "Phone", email: "Email", auto: "Auto number", formula: "Formula",
};
const TYPE_ALIASES = {
  string: "text", str: "text", varchar: "text", name: "text", short: "text", shorttext: "text", url: "text",
  textarea: "longtext", memo: "longtext", note: "longtext", notes: "longtext", long: "longtext", description: "longtext",
  int: "number", integer: "number", float: "number", decimal: "number", double: "number", qty: "number", quantity: "number", numeric: "number",
  currency: "money", price: "money", amount: "money", cost: "money",
  datetime: "date", time: "date", timestamp: "date", day: "date",
  boolean: "bool", yesno: "bool", checkbox: "bool", flag: "bool", "yes/no": "bool",
  enum: "choice", select: "choice", list: "choice", status: "choice", option: "choice", options: "choice", dropdown: "choice", lookup: "choice",
  relation: "link", reference: "link", foreign: "link", fk: "link", relationship: "link", ref: "link",
  tel: "phone", mobile: "phone", mail: "email", autonumber: "auto", autoincrement: "auto", serial: "auto", id: "auto",
  calc: "formula", calculated: "formula", computed: "formula", expression: "formula",
};
export function normType(t) {
  const k = String(t || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (FIELD_TYPES[k]) return k;
  return TYPE_ALIASES[k] || TYPE_ALIASES[String(t || "").toLowerCase()] || "text";
}
const NUMERIC = new Set(["number", "money", "auto", "formula"]);

export const FREE_ROWS = 30;             // records per table before a system must be activated
export const MAX_TABLES = 20, MAX_FIELDS = 40;

let _n = 0;
export const uid = (p) => p + Date.now().toString(36) + (_n++).toString(36) + Math.random().toString(36).slice(2, 6);
const clone = (x) => JSON.parse(JSON.stringify(x));
const clean = (s, n = 60) => String(s == null ? "" : s).replace(/[\u0000-\u001f\[\]{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const key = (s) => String(s || "").toLowerCase().replace(/[ً-ْ]/g, "").replace(/[إأآ]/g, "ا").replace(/ة\b/g, "ه").replace(/[^\p{L}\p{N}]+/gu, "");

// ---- finding things by name (for the AI's operations and for people) -------------------
export function findTable(sys, ref) {
  if (!ref) return null;
  const k = key(ref);
  return sys.tables.find((t) => t.id === ref) || sys.tables.find((t) => key(t.name) === k)
    || sys.tables.find((t) => key(t.name).replace(/s$/, "") === k.replace(/s$/, "")) || null;
}
export function findField(table, ref) {
  if (!table || !ref) return null;
  const k = key(ref);
  return table.fields.find((f) => f.id === ref) || table.fields.find((f) => key(f.name) === k) || null;
}
function uniqueName(list, name, self) {
  const base = clean(name) || "Untitled";
  let n = base, i = 2;
  while (list.some((x) => x !== self && key(x.name) === key(n))) n = `${base} ${i++}`;
  return n;
}

// ---- a system from a spec (what templates and the AI produce: everything by name) -----
/** spec = { name, business?, currency?, tables: [{ name, fields: [{ name, type, options?, link?, formula?, required?, prefix? }] }] } */
export function normalizeSpec(spec) {
  const s = spec && typeof spec === "object" ? spec : {};
  const tables = (Array.isArray(s.tables) ? s.tables : []).slice(0, MAX_TABLES).map((t) => ({
    name: clean(t && (t.name || t.table || t.title)),
    fields: (Array.isArray(t && (t.fields || t.columns)) ? (t.fields || t.columns) : []).slice(0, MAX_FIELDS).map((f) => {
      if (typeof f === "string") return { name: clean(f), type: "text" };
      const type = normType(f && (f.type || f.kind));
      const o = { name: clean(f && (f.name || f.field || f.column || f.title)), type };
      const opts = f && (f.options || f.choices || f.values);
      if (type === "choice") o.options = (Array.isArray(opts) ? opts : String(opts || "").split(/[,،|]/)).map((x) => clean(x, 40)).filter(Boolean).slice(0, 30);
      if (type === "link") o.link = clean(f.link || f.table || f.references || f.target || f.to);
      if (type === "formula") o.formula = String(f.formula || f.expression || f.expr || "").slice(0, 300);
      if (type === "auto" && f.prefix) o.prefix = clean(f.prefix, 8);
      if (f && f.required) o.required = true;
      return o;
    }).filter((f) => f.name),
  })).filter((t) => t.name && t.fields.length);
  return { name: clean(s.name || s.system || s.title, 80) || "My business", business: clean(s.business || s.description, 300), currency: clean(s.currency, 6) || "EGP", tables };
}

export function systemFromSpec(spec, { now = Date.now() } = {}) {
  const sp = normalizeSpec(spec);
  const sys = { v: 1, id: uid("S"), name: sp.name, business: sp.business, currency: sp.currency, created: now, updated: now,
    licence: null, tables: [], rows: {}, history: [] };
  for (const t of sp.tables) {
    const table = { id: uid("t"), name: uniqueName(sys.tables, t.name), fields: [] };
    sys.tables.push(table); sys.rows[table.id] = [];
  }
  // fields second, so links can point at any table
  sp.tables.forEach((t, i) => {
    const table = sys.tables[i];
    for (const f of t.fields) addFieldTo(sys, table, f);
    if (!table.fields.some((f) => f.type !== "formula")) addFieldTo(sys, table, { name: "Name", type: "text" });
  });
  // formulas last (they may name fields listed after them)
  sp.tables.forEach((t, i) => {
    const table = sys.tables[i];
    for (const f of table.fields) if (f.type === "formula" && f._src != null) {
      const r = formulaToIds(f._src, table);
      f.formula = r.ok ? r.expr : ""; if (!r.ok) f.broken = r.error; delete f._src;
    }
  });
  return sys;
}

function addFieldTo(sys, table, f) {
  if (table.fields.length >= MAX_FIELDS) return { error: "A table can have at most " + MAX_FIELDS + " fields." };
  const type = normType(f.type);
  const field = { id: uid("f"), name: uniqueName(table.fields, f.name), type };
  if (type === "choice") field.options = [...new Set((f.options || []).map((x) => clean(x, 40)).filter(Boolean))];
  if (type === "link") {
    const target = findTable(sys, f.link);
    if (!target) { field.type = "text"; } else field.link = target.id;
  }
  if (type === "formula") field._src = String(f.formula || "");
  if (type === "auto") { field.prefix = clean(f.prefix || "", 8); field.pad = 4; }
  if (f.required) field.required = true;
  table.fields.push(field);
  return { field };
}

// ---- formulas: Access style, [Field] * [Other field] -----------------------------------
/** "[Days] * [Daily rate]" → "{fid1} * {fid2}" (names → ids, so renames are safe) */
export function formulaToIds(expr, table) {
  let error = null;
  const out = String(expr || "").replace(/\[([^\]]+)\]/g, (m, name) => {
    const f = findField(table, name.trim());
    if (!f) { error = error || `There is no field called "${name.trim()}" in ${table.name}.`; return m; }
    return `{${f.id}}`;
  });
  if (error) return { ok: false, error };
  const test = parseFormula(out);
  return test.ok ? { ok: true, expr: out } : { ok: false, error: test.error };
}
/** "{fid1} * {fid2}" → "[Days] * [Daily rate]" (what people see and edit) */
export function formulaToNames(expr, table) {
  return String(expr || "").replace(/\{([^}]+)\}/g, (m, id) => { const f = table.fields.find((x) => x.id === id); return f ? `[${f.name}]` : "[?]"; });
}

const FUNCS = {
  ROUND: (a, n) => (a == null ? null : Number(Math.round(Number(a + "e" + (n || 0))) + "e-" + (n || 0))),
  DAYS: (a, b) => (a == null || b == null ? null : a - b),
  MIN: (...a) => { const v = a.filter((x) => x != null); return v.length ? Math.min(...v) : null; },
  MAX: (...a) => { const v = a.filter((x) => x != null); return v.length ? Math.max(...v) : null; },
  ABS: (a) => (a == null ? null : Math.abs(a)),
  IFEMPTY: (a, b) => (a == null ? b : a),
};

/** Parse once into a tree (numbers, {field ids}, + - * /, brackets, a few functions). */
export function parseFormula(src) {
  const toks = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|\{([^}]+)\}|([A-Za-z]+)|(.))/gy;
  let m; const s = String(src || "");
  while (re.lastIndex < s.length && (m = re.exec(s))) {
    if (m[1]) toks.push({ k: "n", v: Number(m[1]) });
    else if (m[2]) toks.push({ k: "f", v: m[2] });
    else if (m[3]) toks.push({ k: "id", v: m[3].toUpperCase() });
    else if (m[4] && m[4].trim()) toks.push({ k: "op", v: m[4] });
  }
  let i = 0;
  const peek = () => toks[i], take = () => toks[i++];
  const expect = (v) => { const t = take(); if (!t || t.v !== v) throw new Error(`Expected "${v}"`); };
  function expr() { let a = term(); while (peek() && (peek().v === "+" || peek().v === "-")) { const op = take().v; a = { op, a, b: term() }; } return a; }
  function term() { let a = factor(); while (peek() && (peek().v === "*" || peek().v === "/")) { const op = take().v; a = { op, a, b: factor() }; } return a; }
  function factor() {
    const t = take();
    if (!t) throw new Error("The formula ends too early");
    if (t.v === "-") return { op: "neg", a: factor() };
    if (t.k === "n") return { n: t.v };
    if (t.k === "f") return { f: t.v };
    if (t.v === "(") { const e = expr(); expect(")"); return e; }
    if (t.k === "id") {
      if (!FUNCS[t.v]) throw new Error(`Unknown function ${t.v} (use ROUND, DAYS, MIN, MAX, ABS, IFEMPTY)`);
      expect("("); const args = [];
      if (peek() && peek().v !== ")") { args.push(expr()); while (peek() && peek().v === ",") { take(); args.push(expr()); } }
      expect(")"); return { fn: t.v, args };
    }
    throw new Error(`Unexpected "${t.v}"`);
  }
  try {
    if (!toks.length) return { ok: false, error: "The formula is empty" };
    const tree = expr();
    if (i < toks.length) throw new Error(`Unexpected "${toks[i].v}"`);
    return { ok: true, tree };
  } catch (e) { return { ok: false, error: e.message }; }
}

const dayNum = (s) => { const d = Date.parse(String(s).slice(0, 10) + "T00:00:00Z"); return isNaN(d) ? null : Math.round(d / 86400000); };

function evalTree(node, get) {
  if (node.n != null) return node.n;
  if (node.f) return get(node.f);
  if (node.fn) return FUNCS[node.fn](...node.args.map((a) => evalTree(a, get)));
  if (node.op === "neg") { const a = evalTree(node.a, get); return a == null ? null : -a; }
  const a = evalTree(node.a, get), b = evalTree(node.b, get);
  if (a == null || b == null) return null;
  if (node.op === "+") return a + b;
  if (node.op === "-") return a - b;
  if (node.op === "*") return a * b;
  if (node.op === "/") return b === 0 ? null : a / b;
  return null;
}

/** A field's value as a number (for formulas and totals). */
function numOf(field, v) {
  if (v == null || v === "") return null;
  if (field.type === "date") return dayNum(v);
  if (field.type === "bool") return v ? 1 : 0;
  if (field.type === "auto") { const m = String(v).match(/\d+/); return m ? Number(m[0]) : null; }
  const n = Number(v); return isNaN(n) ? null : n;
}

export function computeRow(table, row) {
  const out = { ...row };
  const byId = Object.fromEntries(table.fields.map((f) => [f.id, f]));
  const cache = {}, busy = new Set();
  const get = (fid) => {
    const f = byId[fid]; if (!f) return null;
    if (f.type !== "formula") return numOf(f, row[fid]);
    if (fid in cache) return cache[fid];
    if (busy.has(fid)) return null;                   // a formula that uses itself
    busy.add(fid);
    const p = f.formula ? parseFormula(f.formula) : null;
    let v = null; try { v = p && p.ok ? evalTree(p.tree, get) : null; } catch (e) { v = null; }
    if (v != null && !isFinite(v)) v = null;
    busy.delete(fid);
    return (cache[fid] = v == null ? null : Math.round(v * 1e6) / 1e6);
  };
  for (const f of table.fields) if (f.type === "formula") out[f.id] = get(f.id);
  return out;
}

// ---- values ------------------------------------------------------------------------------
const AR_DIG = /[٠-٩۰-۹]/g;
const toLatin = (s) => String(s).replace(AR_DIG, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d) >= 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(d) : "۰۱۲۳۴۵۶۷۸۹".indexOf(d)]);

/** Turn what a person (or a CSV, or the AI) typed into a stored value. → { ok, value, error? } */
export function coerce(field, raw, sys) {
  if (raw == null || (typeof raw === "string" && raw.trim() === "")) return { ok: true, value: field.type === "bool" ? false : null };
  const s = typeof raw === "string" ? toLatin(raw.trim()) : raw;
  switch (field.type) {
    case "number": case "money": {
      const n = typeof s === "number" ? s : Number(String(s).replace(/[,\s٬]/g, "").replace(/٫/g, ".").replace(/^(EGP|USD|\$|£|€|ج\.?م\.?)\s*/i, "").replace(/\s*(EGP|USD|ج\.?م\.?|جنيه)$/i, ""));
      return isNaN(n) ? { ok: false, error: `"${raw}" is not a number` } : { ok: true, value: n };
    }
    case "date": {
      if (typeof s === "number" && s > 20000 && s < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + s * 86400000); return { ok: true, value: d.toISOString().slice(0, 10) }; } // Excel serial
      let m = String(s).match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (m) return okDate(+m[1], +m[2], +m[3], raw);
      m = String(s).match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);                // day first, as in Egypt
      if (m) return okDate(+m[3], +m[2], +m[1], raw);
      const t = Date.parse(s); return isNaN(t) ? { ok: false, error: `"${raw}" is not a date` } : { ok: true, value: new Date(t).toISOString().slice(0, 10) };
    }
    case "bool": return { ok: true, value: typeof s === "boolean" ? s : /^(y|yes|true|1|✓|✔|نعم|اه|آه|ايوه|أيوه|صح)$/i.test(String(s)) };
    case "choice": {
      const opt = (field.options || []).find((o) => key(o) === key(s));
      return opt ? { ok: true, value: opt } : { ok: false, error: `"${raw}" is not one of: ${(field.options || []).join(", ")}`, newOption: clean(raw, 40) };
    }
    case "email": return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s)) ? { ok: true, value: String(s) } : { ok: false, error: `"${raw}" is not an email address` };
    case "phone": { const p = String(s).replace(/[^\d+]/g, ""); return p.length >= 5 ? { ok: true, value: p } : { ok: false, error: `"${raw}" is not a phone number` }; }
    case "link": {
      if (!sys) return { ok: true, value: String(s) };
      const target = sys.tables.find((t) => t.id === field.link); if (!target) return { ok: false, error: "The linked table is gone" };
      const rows = sys.rows[target.id] || [];
      const texts = target.fields.filter((f) => f.type === "text" || f.type === "auto" || f.type === "phone" || f.type === "email");
      const hit = rows.find((r) => r._id === s) || rows.find((r) => key(displayOf(target, r)) === key(s))
        || rows.find((r) => texts.some((f) => r[f.id] != null && key(r[f.id]) === key(s)));
      return hit ? { ok: true, value: hit._id } : { ok: false, error: `No record "${raw}" in ${target.name}` };
    }
    case "formula": case "auto": return { ok: true, value: raw };
    case "longtext": return { ok: true, value: String(raw).slice(0, 5000) };
    default: return { ok: true, value: String(raw).slice(0, 500) };
  }
}
function okDate(y, mo, d, raw) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? { ok: true, value: dt.toISOString().slice(0, 10) } : { ok: false, error: `"${raw}" is not a real date` };
}

/** The name a record is known by (its first text-like field). */
export function displayOf(table, row) {
  if (!row) return "";
  const has = (x) => row[x.id] != null && row[x.id] !== "";
  const f = table.fields.find((x) => (x.type === "text" || x.type === "auto") && has(x))
    || table.fields.find((x) => has(x) && x.type !== "bool" && x.type !== "link");
  if (!f) return "(empty)";
  // "EQ-0001 · LTM 1100": a number alone says little, so the name comes with it
  const name = f.type === "auto" && table.fields.find((x) => x.type === "text" && has(x));
  return name ? `${row[f.id]} · ${row[name.id]}` : String(row[f.id]);
}

/** A value as text, for the grid, CSV and the AI. */
export function show(sys, field, v, { currency } = {}) {
  if (v == null || v === "") return "";
  if (field.type === "bool") return v ? "Yes" : "No";
  if (field.type === "money") return Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }) + (currency ? " " + currency : "");
  if (field.type === "number" || field.type === "formula") return typeof v === "number" ? Number(v).toLocaleString("en-US", { maximumFractionDigits: 4 }) : String(v);
  if (field.type === "link") { const t = sys.tables.find((x) => x.id === field.link); const r = t && (sys.rows[t.id] || []).find((x) => x._id === v); return r ? displayOf(t, r) : "(deleted)"; }
  return String(v);
}

// ---- records -----------------------------------------------------------------------------
export function isActive(sys) { return !!(sys && sys.licence && sys.licence.ok); }
export function canAddRow(sys, tid) { return isActive(sys) || (sys.rows[tid] || []).length < FREE_ROWS; }

function nextAuto(sys, table, field) {
  const max = (sys.rows[table.id] || []).reduce((m, r) => Math.max(m, numOf(field, r[field.id]) || 0), 0);
  return (field.prefix ? field.prefix : "") + String(max + 1).padStart(field.prefix ? field.pad || 4 : 1, "0");
}

/** values by field id OR name. → { sys, row, errors: [{ field, error }] } — nothing is saved if a value is wrong. */
export function addRow(sys, tid, values = {}, { now = Date.now() } = {}) {
  const table = sys.tables.find((t) => t.id === tid);
  if (!table) return { sys, errors: [{ error: "No such table" }] };
  if (!canAddRow(sys, tid)) return { sys, errors: [{ error: `The free version keeps ${FREE_ROWS} records per table. Activate this system to add more.`, limit: true }] };
  const row = { _id: uid("r"), _ts: now };
  const r = fillRow(sys, table, row, values, true);
  if (r.errors.length) return { sys, errors: r.errors };
  const next = { ...sys, rows: { ...sys.rows, [tid]: [...(sys.rows[tid] || []), r.row] }, updated: now };
  return { sys: next, row: r.row, errors: [] };
}
export function updateRow(sys, tid, rowId, values = {}, { now = Date.now() } = {}) {
  const table = sys.tables.find((t) => t.id === tid);
  const old = table && (sys.rows[tid] || []).find((r) => r._id === rowId);
  if (!old) return { sys, errors: [{ error: "That record is gone" }] };
  const r = fillRow(sys, table, { ...old }, values, false);
  if (r.errors.length) return { sys, errors: r.errors };
  return { sys: { ...sys, rows: { ...sys.rows, [tid]: sys.rows[tid].map((x) => (x._id === rowId ? r.row : x)) }, updated: now }, row: r.row, errors: [] };
}
function fillRow(sys, table, row, values, isNew) {
  const errors = [];
  for (const [k, raw] of Object.entries(values)) {
    const f = findField(table, k); if (!f || f.type === "formula" || f.type === "auto") continue;
    const c = coerce(f, raw, sys);
    if (!c.ok) errors.push({ field: f.id, name: f.name, error: c.error }); else row[f.id] = c.value;
  }
  for (const f of table.fields) {
    if (f.type === "auto" && isNew && (row[f.id] == null || row[f.id] === "")) row[f.id] = nextAuto(sys, table, f);
    if (f.required && (row[f.id] == null || row[f.id] === "") && f.type !== "bool") errors.push({ field: f.id, name: f.name, error: `${f.name} is required` });
  }
  return { row, errors };
}
/** Links that point at a record (so deleting it can be warned about). */
export function usedBy(sys, tid, rowId) {
  let n = 0;
  for (const t of sys.tables) for (const f of t.fields) if (f.type === "link" && f.link === tid) n += (sys.rows[t.id] || []).filter((r) => r[f.id] === rowId).length;
  return n;
}
export function deleteRow(sys, tid, rowId, { now = Date.now() } = {}) {
  return { ...sys, rows: { ...sys.rows, [tid]: (sys.rows[tid] || []).filter((r) => r._id !== rowId) }, updated: now };
}

// ---- viewing -----------------------------------------------------------------------------
export function viewRows(sys, tid, { search = "", sort = null, filter = null } = {}) {
  const table = sys.tables.find((t) => t.id === tid); if (!table) return [];
  let rows = (sys.rows[tid] || []).map((r) => computeRow(table, r));
  if (filter && filter.field && filter.value != null && filter.value !== "") {
    const f = table.fields.find((x) => x.id === filter.field);
    if (f) rows = rows.filter((r) => key(show(sys, f, r[f.id])) === key(f.type === "link" ? show(sys, f, filter.value) : filter.value) || r[f.id] === filter.value);
  }
  const q = key(search);
  if (q) rows = rows.filter((r) => table.fields.some((f) => key(show(sys, f, r[f.id])).includes(q)));
  if (sort && sort.field) {
    const f = table.fields.find((x) => x.id === sort.field);
    if (f) {
      const val = (r) => (NUMERIC.has(f.type) || f.type === "date" || f.type === "bool" ? numOf(f.type === "formula" ? { type: "number" } : f, r[f.id]) : show(sys, f, r[f.id]).toLowerCase());
      rows.sort((a, b) => { const x = val(a), y = val(b); if (x == null || x === "") return 1; if (y == null || y === "") return -1; return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "desc" ? -1 : 1); });
    }
  }
  return rows;
}
export function totals(table, rows) {
  const out = {};
  for (const f of table.fields) if (f.type === "number" || f.type === "money" || f.type === "formula") {
    const v = rows.map((r) => r[f.id]).filter((x) => typeof x === "number");
    if (v.length) out[f.id] = Math.round(v.reduce((a, b) => a + b, 0) * 100) / 100;
  }
  return out;
}
/** Sum (or count) of a column by the values of another: "Total by Customer". */
export function summary(sys, tid, groupFid, sumFid) {
  const table = sys.tables.find((t) => t.id === tid); if (!table) return [];
  const g = table.fields.find((f) => f.id === groupFid); const s = sumFid && table.fields.find((f) => f.id === sumFid);
  if (!g) return [];
  const m = new Map();
  for (const r of viewRows(sys, tid)) {
    const k = show(sys, g, r[g.id]) || "(empty)";
    const cur = m.get(k) || { group: k, count: 0, sum: 0 };
    cur.count++; if (s && typeof r[s.id] === "number") cur.sum += r[s.id];
    m.set(k, cur);
  }
  return [...m.values()].map((x) => ({ ...x, sum: Math.round(x.sum * 100) / 100 })).sort((a, b) => (s ? b.sum - a.sum : b.count - a.count));
}

// ---- changing the design (Access "Design view") ----------------------------------------
/* Every change is an operation — the same shape whether a person tapped it or
   the AI proposed it — so it can be listed, previewed, applied and undone.   */
export const OPS = ["addTable", "renameTable", "deleteTable", "addField", "renameField", "deleteField", "changeType", "setOptions", "moveField", "setRequired", "setFormula"];

function snapshot(sys, what) {
  const { history, ...rest } = sys;
  return [{ ts: Date.now(), what, before: JSON.stringify(rest) }, ...(history || [])].slice(0, 15);
}
export function undo(sys) {
  const h = sys.history || [];
  if (!h.length) return null;
  const before = JSON.parse(h[0].before);
  return { sys: { ...before, licence: sys.licence, history: h.slice(1), updated: Date.now() }, what: h[0].what };
}

/** Apply operations. → { sys, done: [text], errors: [text] } (the ones that can't be done are skipped, the rest still apply) */
export function applyOps(sys0, ops, { label } = {}) {
  let sys = clone(sys0);
  const done = [], errors = [];
  for (const o of Array.isArray(ops) ? ops : [ops]) {
    try { const r = applyOne(sys, o || {}); if (r) done.push(r); } catch (e) { errors.push(e.message); }
  }
  if (done.length) { sys.history = snapshot(sys0, label || done.join("; ")); sys.updated = Date.now(); }
  else sys = sys0;
  return { sys, done, errors };
}

function applyOne(sys, o) {
  const op = o.op;
  const T = () => { const t = findTable(sys, o.table); if (!t) throw new Error(`No table called "${o.table}"`); return t; };
  const F = (t) => { const f = findField(t, o.field); if (!f) throw new Error(`No field called "${o.field}" in ${t.name}`); return f; };
  switch (op) {
    case "addTable": {
      if (sys.tables.length >= MAX_TABLES) throw new Error(`A system can have at most ${MAX_TABLES} tables`);
      if (findTable(sys, o.table || o.name) && key(findTable(sys, o.table || o.name).name) === key(o.table || o.name)) throw new Error(`There is already a table called "${o.table || o.name}"`);
      const t = { id: uid("t"), name: uniqueName(sys.tables, o.table || o.name), fields: [] };
      sys.tables.push(t); sys.rows[t.id] = [];
      for (const f of o.fields || [{ name: "Name", type: "text" }]) addFieldTo(sys, t, typeof f === "string" ? { name: f, type: "text" } : f);
      for (const f of t.fields) if (f.type === "formula" && f._src != null) { const r = formulaToIds(f._src, t); f.formula = r.ok ? r.expr : ""; delete f._src; }
      if (!t.fields.length) addFieldTo(sys, t, { name: "Name", type: "text" });
      return `Added the table ${t.name} (${t.fields.map((f) => f.name).join(", ")})`;
    }
    case "renameTable": { const t = T(); const old = t.name; t.name = uniqueName(sys.tables, o.to, t); return `Renamed the table ${old} → ${t.name}`; }
    case "deleteTable": {
      const t = T();
      // Links to it become plain text, so nothing that pointed at it turns blank.
      for (const other of sys.tables) for (const f of other.fields) if (f.type === "link" && f.link === t.id) {
        for (const r of sys.rows[other.id] || []) { const hit = (sys.rows[t.id] || []).find((x) => x._id === r[f.id]); r[f.id] = hit ? displayOf(t, hit) : null; }
        f.type = "text"; delete f.link;
      }
      sys.tables = sys.tables.filter((x) => x !== t); delete sys.rows[t.id];
      return `Deleted the table ${t.name}`;
    }
    case "addField": {
      const t = T();
      if (findField(t, o.name || o.field) && key(findField(t, o.name || o.field).name) === key(o.name || o.field)) throw new Error(`${t.name} already has a field called "${o.name || o.field}"`);
      const r = addFieldTo(sys, t, { name: o.name || o.field, type: o.type, options: o.options, link: o.link, formula: o.formula, prefix: o.prefix, required: o.required });
      if (r.error) throw new Error(r.error);
      const f = r.field;
      if (f.type === "formula") { const x = formulaToIds(f._src, t); delete f._src; if (!x.ok) { t.fields.pop(); throw new Error(x.error); } f.formula = x.expr; }
      if (f.type === "auto") (sys.rows[t.id] || []).forEach((row, i) => { row[f.id] = (f.prefix || "") + String(i + 1).padStart(f.prefix ? 4 : 1, "0"); });
      if (normType(o.type) === "link" && f.type !== "link") return `Added ${f.name} to ${t.name} as text (no table called "${o.link}")`;
      return `Added the field ${f.name} (${FIELD_TYPES[f.type]}) to ${t.name}`;
    }
    case "renameField": { const t = T(); const f = F(t); const old = f.name; f.name = uniqueName(t.fields, o.to, f); return `Renamed ${t.name} › ${old} → ${f.name}`; }
    case "deleteField": {
      const t = T(); const f = F(t);
      const users = t.fields.filter((x) => x.type === "formula" && String(x.formula).includes(`{${f.id}}`));
      if (users.length) throw new Error(`${f.name} is used by the formula ${users.map((x) => x.name).join(", ")} — change that first`);
      t.fields = t.fields.filter((x) => x !== f);
      for (const r of sys.rows[t.id] || []) delete r[f.id];
      return `Deleted the field ${t.name} › ${f.name}`;
    }
    case "changeType": {
      const t = T(); const f = F(t); const to = normType(o.type);
      if (to === f.type) return null;
      const rows = sys.rows[t.id] || [];
      const was = { ...f };
      const shown = rows.map((r) => (r[f.id] == null ? null : show(sys, was, r[f.id])));
      f.type = to; delete f.options; delete f.link; delete f.formula; delete f.prefix;
      if (to === "choice") f.options = [...new Set([...(o.options || []), ...shown.filter(Boolean)].map((x) => clean(x, 40)))].slice(0, 50);
      if (to === "link") { const target = findTable(sys, o.link); if (!target) { Object.assign(f, was); throw new Error(`No table called "${o.link}" to link to`); } f.link = target.id; }
      if (to === "formula") { const x = formulaToIds(o.formula || "", t); if (!x.ok) { Object.keys(f).forEach((k) => delete f[k]); Object.assign(f, was); throw new Error(x.error); } f.formula = x.expr; }
      if (to === "auto") { f.prefix = clean(o.prefix || "", 8); f.pad = 4; }
      let lost = 0;
      rows.forEach((r, i) => {
        if (to === "formula") { delete r[f.id]; return; }
        if (to === "auto") { if (r[f.id] == null || r[f.id] === "") r[f.id] = (f.prefix || "") + String(i + 1).padStart(f.prefix ? 4 : 1, "0"); return; }
        if (shown[i] == null || shown[i] === "") { r[f.id] = to === "bool" ? false : null; return; }
        const c = coerce(f, was.type === "bool" ? (r[f.id] ? "yes" : "no") : shown[i], sys);
        if (c.ok) r[f.id] = c.value; else { r[f.id] = null; lost++; }
      });
      return `Changed ${t.name} › ${f.name} to ${FIELD_TYPES[to]}` + (lost ? ` (${lost} value${lost > 1 ? "s" : ""} could not be converted and were cleared)` : "");
    }
    case "setOptions": {
      const t = T(); const f = F(t);
      if (f.type !== "choice") throw new Error(`${f.name} is not a Choice field`);
      const add = (o.add || []).map((x) => clean(x, 40)).filter(Boolean), remove = new Set((o.remove || []).map(key));
      f.options = [...new Set([...(o.options ? o.options.map((x) => clean(x, 40)) : f.options.filter((x) => !remove.has(key(x)))), ...add])].filter(Boolean);
      return `${t.name} › ${f.name} choices: ${f.options.join(", ")}`;
    }
    case "moveField": {
      const t = T(); const f = F(t); const i = t.fields.indexOf(f);
      const j = o.to != null ? Math.max(0, Math.min(t.fields.length - 1, Number(o.to))) : i + (o.dir === "up" ? -1 : 1);
      if (j < 0 || j >= t.fields.length || j === i) return null;
      t.fields.splice(i, 1); t.fields.splice(j, 0, f);
      return `Moved ${f.name} ${j < i ? "up" : "down"} in ${t.name}`;
    }
    case "setRequired": { const t = T(); const f = F(t); f.required = !!o.required; return `${t.name} › ${f.name} is ${f.required ? "required" : "optional"}`; }
    case "setFormula": {
      const t = T(); const f = F(t); if (f.type !== "formula") throw new Error(`${f.name} is not a Formula field`);
      const x = formulaToIds(o.formula, t); if (!x.ok) throw new Error(x.error);
      f.formula = x.expr; return `${t.name} › ${f.name} = ${o.formula}`;
    }
    default: throw new Error(`Unknown change "${op}"`);
  }
}

// ---- a plain description (what the AI reads) --------------------------------------------
export function describe(sys) {
  return sys.tables.map((t) => `${t.name} (${(sys.rows[t.id] || []).length} records): ` + t.fields.map((f) =>
    `${f.name} [${f.type}${f.type === "choice" ? ": " + (f.options || []).join("/") : ""}${f.type === "link" ? " → " + ((sys.tables.find((x) => x.id === f.link) || {}).name || "?") : ""}${f.type === "formula" ? " = " + formulaToNames(f.formula, t) : ""}]`).join(", ")).join("\n");
}

// ---- CSV in and out (Excel opens it; Arabic kept by the BOM) -----------------------------
const csvCell = (s) => (/[",\n\r]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));
export function toCSV(sys, tid) {
  const table = sys.tables.find((t) => t.id === tid);
  const rows = viewRows(sys, tid);
  return "﻿" + [table.fields.map((f) => csvCell(f.name)).join(","),
    ...rows.map((r) => table.fields.map((f) => csvCell(f.type === "bool" ? (r[f.id] ? "Yes" : "No") : f.type === "money" || f.type === "number" || f.type === "formula" ? (r[f.id] ?? "") : show(sys, f, r[f.id]))).join(","))].join("\r\n");
}
export function parseCSV(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const sep = (s.split("\n")[0].match(/\t/g) || []).length > (s.split("\n")[0].match(/,/g) || []).length ? "\t" : (s.split("\n")[0].match(/;/g) || []).length > (s.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
}

/** Guess each column's type from its values (for a new table made from a spreadsheet). */
export function guessType(name, values) {
  const v = values.map((x) => (x == null ? "" : toLatin(String(x).trim()))).filter(Boolean);
  const n = /price|cost|amount|value|total|salary|rate|سعر|تكلفة|مبلغ|قيمة|اجمالي|إجمالي|راتب/i.test(name);
  if (!v.length) return { type: "text" };
  if (v.every((x) => /^-?[\d,]+(\.\d+)?$/.test(x))) return { type: n ? "money" : "number" };
  if (v.every((x) => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(x) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(x))) return { type: "date" };
  if (v.every((x) => /^(yes|no|true|false|y|n|نعم|لا)$/i.test(x))) return { type: "bool" };
  if (v.every((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))) return { type: "email" };
  if (/phone|mobile|tel|هاتف|تليفون|موبايل/i.test(name) && v.every((x) => /^[+\d\s()-]{5,}$/.test(x))) return { type: "phone" };
  const distinct = [...new Set(v)];
  if (v.length >= 4 && distinct.length <= Math.min(10, Math.ceil(v.length / 2)) && distinct.every((x) => x.length <= 30)) return { type: "choice", options: distinct };
  return { type: v.some((x) => x.length > 80) ? "longtext" : "text" };
}

/** A whole new table from a header + rows (CSV / Excel import). → { sys, table, added, errors } */
export function tableFromData(sys0, name, header, rows) {
  const cols = header.map((h, i) => ({ name: clean(h) || `Column ${i + 1}`, ...guessType(h, rows.map((r) => r[i])) }));
  const r = applyOps(sys0, [{ op: "addTable", table: name, fields: cols }], { label: `Imported ${name}` });
  if (!r.done.length) return { sys: sys0, errors: r.errors };
  const table = r.sys.tables[r.sys.tables.length - 1];
  const imp = importRows(r.sys, table.id, header, rows);
  return { ...imp, table };
}
/** Rows into an existing table; columns matched by name. */
export function importRows(sys, tid, header, rows) {
  const table = sys.tables.find((t) => t.id === tid);
  const map = header.map((h) => findField(table, h));
  let added = 0; const errors = [];
  for (const [i, r] of rows.entries()) {
    const vals = {};
    map.forEach((f, j) => { if (f) vals[f.id] = r[j]; });
    const x = addRow(sys, tid, vals);
    if (x.errors.length) { if (x.errors[0].limit) { errors.push(x.errors[0].error); break; } errors.push(`Row ${i + 2}: ` + x.errors.map((e) => e.error).join("; ")); continue; }
    sys = x.sys; added++;
  }
  return { sys, added, errors: errors.slice(0, 20), matched: map.filter(Boolean).length };
}

// ---- the AI: design a system, change it, fill a record ----------------------------------
export function jsonFrom(text) {
  const t = String(text || "").replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let s = t.slice(a, b + 1);
  for (let k = 0; k < 3; k++) {
    try { return JSON.parse(s); } catch (e) {
      if (k === 0) s = s.replace(/,\s*([}\]])/g, "$1");                              // trailing commas
      else if (k === 1) s = s.replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":').replace(/'([^'"\n]*)'/g, '"$1"');   // bare keys, single quotes
    }
  }
  return null;
}

const TYPES_HELP = "text, longtext, number, money, date, bool, choice (give \"options\"), link (give \"link\": the other table's name), phone, email, auto (a running number; optional \"prefix\" like \"INV-\"), formula (give \"formula\" using [Field name] and + - * / ( ), ROUND(x,2), DAYS([End],[Start]))";

export function designMessages(description, { currency = "EGP" } = {}) {
  return [
    { role: "system", content: `You design the database of a small business's ERP system, like an expert Microsoft Access developer. Reply with JSON only, no other text:
{"name": "<short system name>", "currency": "${currency}", "tables": [{"name": "<table>", "fields": [{"name": "<field>", "type": "<type>", ...}]}]}
Field types: ${TYPES_HELP}.
Rules: 4 to 8 tables covering what this business really tracks (customers, what it sells or rents, orders or jobs, invoices and payments, stock, staff, expenses — only the ones that fit). 4 to 10 fields per table, most important first; the first field is the record's name or number. Use link fields to connect tables (an order links to its customer). Use choice for statuses with realistic options. Use formula for totals. Field and table names in the language of the description.
Example: {"name":"Bakery","currency":"EGP","tables":[{"name":"Products","fields":[{"name":"Product","type":"text"},{"name":"Price","type":"money"}]},{"name":"Orders","fields":[{"name":"Order no","type":"auto","prefix":"ORD-"},{"name":"Product","type":"link","link":"Products"},{"name":"Qty","type":"number"},{"name":"Unit price","type":"money"},{"name":"Total","type":"formula","formula":"[Qty] * [Unit price]"},{"name":"Status","type":"choice","options":["New","Paid","Delivered"]}]}]}` },
    { role: "user", content: String(description || "").trim().slice(0, 2000) },
  ];
}

export function changeMessages(sys, request) {
  return [
    { role: "system", content: `You change the design of a business database, like a Microsoft Access developer. Reply with JSON only: {"ops": [ ... ]}. Each op is one of:
{"op":"addTable","table":"<name>","fields":[{"name":..,"type":..}]}
{"op":"renameTable","table":"<name>","to":"<new>"}
{"op":"deleteTable","table":"<name>"}
{"op":"addField","table":"<table>","name":"<field>","type":"<type>", "options"|"link"|"formula"|"prefix" when needed}
{"op":"renameField","table":"<table>","field":"<field>","to":"<new>"}
{"op":"deleteField","table":"<table>","field":"<field>"}
{"op":"changeType","table":"<table>","field":"<field>","type":"<type>", "options"|"link"|"formula" when needed}
{"op":"setOptions","table":"<table>","field":"<field>","add":["..."],"remove":["..."]}
{"op":"setFormula","table":"<table>","field":"<field>","formula":"[A] * [B]"}
{"op":"moveField","table":"<table>","field":"<field>","dir":"up"|"down"}
{"op":"setRequired","table":"<table>","field":"<field>","required":true|false}
Types: ${TYPES_HELP}.
Use the exact table and field names below. Do only what was asked. If the request is not a design change, reply {"ops": []}.

The database now:
${describe(sys)}` },
    { role: "user", content: String(request || "").trim().slice(0, 1500) },
  ];
}

export function recordMessages(sys, tid, text, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const t = sys.tables.find((x) => x.id === tid);
  const fields = t.fields.filter((f) => f.type !== "formula" && f.type !== "auto");
  return [
    { role: "system", content: `Fill in one record of the table "${t.name}" from what the user says. Reply with JSON only: an object whose keys are exactly these field names, leaving out anything not mentioned:
${fields.map((f) => `- ${f.name} (${f.type}${f.type === "choice" ? ": one of " + (f.options || []).join(" / ") : ""}${f.type === "link" ? ": the name of a record in " + ((sys.tables.find((x) => x.id === f.link) || {}).name || "?") : ""}${f.type === "date" ? ": YYYY-MM-DD" : ""})`).join("\n")}
Today is ${today}. Numbers as plain numbers.` },
    { role: "user", content: String(text || "").trim().slice(0, 1000) },
  ];
}

// ---- templates (work with no model at all) ----------------------------------------------
export const TEMPLATES = [
  { id: "cranes", title: "Crane & equipment rental", blurb: "Customers, fleet, jobs, invoices, maintenance, crew", spec: {
    name: "Crane rental", currency: "EGP", tables: [
      { name: "Customers", fields: [{ name: "Name", type: "text", required: true }, { name: "Company", type: "text" }, { name: "Phone", type: "phone" }, { name: "Email", type: "email" }, { name: "City", type: "text" }, { name: "Notes", type: "longtext" }] },
      { name: "Equipment", fields: [{ name: "Code", type: "auto", prefix: "EQ-" }, { name: "Model", type: "text", required: true }, { name: "Brand", type: "choice", options: ["Liebherr", "XCMG", "Sany", "Zoomlion", "Grove", "Terex", "Demag", "Tadano", "Hitachi"] }, { name: "Capacity (t)", type: "number" }, { name: "Year", type: "number" }, { name: "Status", type: "choice", options: ["Available", "On hire", "Maintenance", "Out of service"] }, { name: "Daily rate", type: "money" }] },
      { name: "Jobs", fields: [{ name: "Job no", type: "auto", prefix: "JOB-" }, { name: "Customer", type: "link", link: "Customers" }, { name: "Crane", type: "link", link: "Equipment" }, { name: "Site", type: "text" }, { name: "Start", type: "date" }, { name: "End", type: "date" }, { name: "Days", type: "formula", formula: "DAYS([End], [Start]) + 1" }, { name: "Daily rate", type: "money" }, { name: "Total", type: "formula", formula: "[Days] * [Daily rate]" }, { name: "Status", type: "choice", options: ["Quoted", "Confirmed", "Running", "Done", "Invoiced"] }] },
      { name: "Invoices", fields: [{ name: "Invoice no", type: "auto", prefix: "INV-" }, { name: "Customer", type: "link", link: "Customers" }, { name: "Job", type: "link", link: "Jobs" }, { name: "Date", type: "date" }, { name: "Amount", type: "money" }, { name: "Paid", type: "money" }, { name: "Balance", type: "formula", formula: "[Amount] - IFEMPTY([Paid], 0)" }, { name: "Status", type: "choice", options: ["Unpaid", "Partly paid", "Paid"] }] },
      { name: "Maintenance", fields: [{ name: "Crane", type: "link", link: "Equipment" }, { name: "Date", type: "date" }, { name: "Work done", type: "longtext" }, { name: "Cost", type: "money" }, { name: "Next due", type: "date" }] },
      { name: "Crew", fields: [{ name: "Name", type: "text", required: true }, { name: "Role", type: "choice", options: ["Operator", "Rigger", "Driver", "Mechanic", "Site supervisor", "Office"] }, { name: "Phone", type: "phone" }, { name: "Licence expiry", type: "date" }] },
    ] } },
  { id: "shop", title: "Shop & stock", blurb: "Products, stock, sales, customers, suppliers", spec: {
    name: "Shop", currency: "EGP", tables: [
      { name: "Products", fields: [{ name: "Product", type: "text", required: true }, { name: "SKU", type: "auto", prefix: "P-" }, { name: "Category", type: "choice", options: ["General"] }, { name: "Cost", type: "money" }, { name: "Price", type: "money" }, { name: "Margin", type: "formula", formula: "[Price] - [Cost]" }, { name: "In stock", type: "number" }, { name: "Reorder at", type: "number" }] },
      { name: "Customers", fields: [{ name: "Name", type: "text", required: true }, { name: "Phone", type: "phone" }, { name: "Address", type: "text" }] },
      { name: "Sales", fields: [{ name: "Sale no", type: "auto", prefix: "S-" }, { name: "Date", type: "date" }, { name: "Customer", type: "link", link: "Customers" }, { name: "Product", type: "link", link: "Products" }, { name: "Qty", type: "number" }, { name: "Unit price", type: "money" }, { name: "Total", type: "formula", formula: "[Qty] * [Unit price]" }, { name: "Payment", type: "choice", options: ["Cash", "Card", "InstaPay", "Wallet", "On credit"] }] },
      { name: "Suppliers", fields: [{ name: "Supplier", type: "text", required: true }, { name: "Phone", type: "phone" }, { name: "Supplies", type: "text" }] },
      { name: "Purchases", fields: [{ name: "Date", type: "date" }, { name: "Supplier", type: "link", link: "Suppliers" }, { name: "Product", type: "link", link: "Products" }, { name: "Qty", type: "number" }, { name: "Unit cost", type: "money" }, { name: "Total", type: "formula", formula: "[Qty] * [Unit cost]" }] },
    ] } },
  { id: "services", title: "Contracting & services", blurb: "Clients, projects, quotes, invoices, expenses", spec: {
    name: "Projects", currency: "EGP", tables: [
      { name: "Clients", fields: [{ name: "Client", type: "text", required: true }, { name: "Contact", type: "text" }, { name: "Phone", type: "phone" }, { name: "Email", type: "email" }] },
      { name: "Projects", fields: [{ name: "Project", type: "text", required: true }, { name: "Client", type: "link", link: "Clients" }, { name: "Start", type: "date" }, { name: "Deadline", type: "date" }, { name: "Budget", type: "money" }, { name: "Status", type: "choice", options: ["Lead", "Quoted", "Active", "On hold", "Done"] }] },
      { name: "Quotes", fields: [{ name: "Quote no", type: "auto", prefix: "Q-" }, { name: "Project", type: "link", link: "Projects" }, { name: "Date", type: "date" }, { name: "Amount", type: "money" }, { name: "Status", type: "choice", options: ["Sent", "Accepted", "Rejected"] }] },
      { name: "Invoices", fields: [{ name: "Invoice no", type: "auto", prefix: "INV-" }, { name: "Project", type: "link", link: "Projects" }, { name: "Date", type: "date" }, { name: "Amount", type: "money" }, { name: "Paid", type: "bool" }] },
      { name: "Expenses", fields: [{ name: "Date", type: "date" }, { name: "Project", type: "link", link: "Projects" }, { name: "What", type: "text" }, { name: "Category", type: "choice", options: ["Materials", "Labour", "Transport", "Equipment", "Other"] }, { name: "Amount", type: "money" }] },
    ] } },
  { id: "restaurant", title: "Restaurant & café", blurb: "Menu, orders, ingredients, staff", spec: {
    name: "Restaurant", currency: "EGP", tables: [
      { name: "Menu", fields: [{ name: "Item", type: "text", required: true }, { name: "Category", type: "choice", options: ["Starters", "Mains", "Drinks", "Desserts"] }, { name: "Price", type: "money" }, { name: "Available", type: "bool" }] },
      { name: "Orders", fields: [{ name: "Order no", type: "auto", prefix: "ORD-" }, { name: "Date", type: "date" }, { name: "Item", type: "link", link: "Menu" }, { name: "Qty", type: "number" }, { name: "Price", type: "money" }, { name: "Total", type: "formula", formula: "[Qty] * [Price]" }, { name: "Type", type: "choice", options: ["Dine in", "Takeaway", "Delivery"] }] },
      { name: "Ingredients", fields: [{ name: "Ingredient", type: "text", required: true }, { name: "Unit", type: "choice", options: ["kg", "g", "l", "piece"] }, { name: "In stock", type: "number" }, { name: "Reorder at", type: "number" }, { name: "Unit cost", type: "money" }] },
      { name: "Staff", fields: [{ name: "Name", type: "text", required: true }, { name: "Role", type: "choice", options: ["Chef", "Waiter", "Cashier", "Delivery", "Manager"] }, { name: "Phone", type: "phone" }] },
    ] } },
  { id: "blank", title: "Blank", blurb: "Start from one empty table", spec: { name: "My business", tables: [{ name: "Table 1", fields: [{ name: "Name", type: "text" }, { name: "Notes", type: "longtext" }] }] } },
];

// ---- licences: each system is paid for once --------------------------------------------
/* A system is free to design and try (FREE_ROWS records per table). To use it
   for real it is activated with a code bound to that one system: the owner
   sends the system's request code, pays, and gets back an activation code
   signed with the seller's private key (tools/erp-licence.mjs). The app only
   holds the PUBLIC key, so it can check a code but never make one.          */
export const LICENCE_PUBLIC_KEY = { kty: "EC", crv: "P-256", x: "FuyClSl4NiGx1oaL5794bmZAK4aTEBz_xoN6IOMMKzM", y: "cUzZVXuqZnS9__ct8fZvVvH8yPY9Lu6jo3PQvFQw6LI" };
export const SELLER = { price: "", contact: "" };   // filled in by the seller (see HANDOFF.md)

const b64u = (s) => { const b = atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
export function requestCode(sys) { return "ERP-" + sys.id.slice(1).toUpperCase(); }

/** "ATT1.<payload>.<signature>" → { ok, plan, issued } for THIS system only. */
export async function checkLicence(sys, code, { publicKey = LICENCE_PUBLIC_KEY, subtle = (globalThis.crypto || {}).subtle } = {}) {
  const parts = String(code || "").trim().replace(/\s+/g, "").split(".");
  if (parts.length !== 3 || parts[0] !== "ATT1") return { ok: false, error: "That is not an activation code." };
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(b64u(parts[1]))); } catch (e) { return { ok: false, error: "That code is damaged — copy it again." }; }
  if (payload.s !== requestCode(sys)) return { ok: false, error: "That code is for a different system." };
  if (!subtle) return { ok: false, error: "This phone can't check codes." };
  try {
    const k = await subtle.importKey("jwk", { ...publicKey, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, b64u(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
    return ok ? { ok: true, plan: payload.p || "full", issued: payload.i || 0, code } : { ok: false, error: "That code is not valid." };
  } catch (e) { return { ok: false, error: "That code is not valid." }; }
}

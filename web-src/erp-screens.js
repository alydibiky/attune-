/* ---- v6.18 Business: the screens of a system (Ali: "step by step … then design for mobile and desktop interfaces",
   "an AI chat inside Business where I ask the AI to change the design … and it transforms the app as I instruct") ----
   Until now a system was only its tables; how it looked was fixed. `sys.ui` now holds the look and the screens, and every
   change to it is an op like the table changes (erp.js applyOps → undo, history, the AI's proposals shown first):
     color      the accent (a name from COLORS or a #hex)          menu      computer layout: "left" | "top"
     density    "comfortable" | "compact"                          home      what the home screen shows, in order
     kpis       the key numbers on the home screen [{ table, field?, agg: count|sum|avg, label }]
     lists      per table: the columns a list shows, in order        forms     per table: the form's fields, in order
     hidden     per table: fields kept out of lists and forms        sections  per table: form section titles before a field
   Pure functions only (unit-tested in tests/unit/erp-screens.test.mjs); erp-ui.jsx draws them, erp-app.js exports them. */

export const COLORS = { blue: "#1D4ED8", green: "#15803D", teal: "#0F766E", orange: "#C2410C", red: "#B91C1C", purple: "#6D28D9", pink: "#BE185D", black: "#0F172A", brown: "#92400E", navy: "#1E3A8A" };
export const COLORS_AR = { blue: "أزرق", green: "أخضر", teal: "تركوازي", orange: "برتقالي", red: "أحمر", purple: "بنفسجي", pink: "وردي", black: "أسود", brown: "بني", navy: "كحلي" };
export const HOME_PARTS = { kpis: "Key numbers", latest: "Latest records", chart: "Chart", alerts: "Alerts", tables: "Tables", ask: "Ask a question" };
export const HOME_PARTS_AR = { kpis: "الأرقام الرئيسية", latest: "أحدث السجلات", chart: "رسم بياني", alerts: "تنبيهات", tables: "الجداول", ask: "اسأل سؤالًا" };
const DEFAULT = { color: "blue", menu: "left", density: "comfortable", home: ["kpis", "latest", "tables"], kpis: [], lists: {}, forms: {}, hidden: {}, sections: {} };

const k = (s) => String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " ");
const findT = (sys, ref) => sys.tables.find((t) => t.id === ref) || sys.tables.find((t) => k(t.name) === k(ref)) || sys.tables.find((t) => k(t.name).startsWith(k(ref)) && k(ref).length > 2);
const findF = (t, ref) => t.fields.find((f) => f.id === ref) || t.fields.find((f) => k(f.name) === k(ref)) || t.fields.find((f) => k(f.name).startsWith(k(ref)) && k(ref).length > 2);

/** The system's screens with every default filled in (never mutates). */
export function uiOf(sys) {
  const u = { ...DEFAULT, ...((sys && sys.ui) || {}) };
  for (const key of ["lists", "forms", "hidden", "sections"]) u[key] = { ...((sys && sys.ui && sys.ui[key]) || {}) };
  u.home = Array.isArray(u.home) ? u.home.filter((p) => HOME_PARTS[p]) : DEFAULT.home;
  if (!u.kpis.length && sys && sys.tables) u.kpis = defaultKpis(sys);
  return u;
}
/** The accent as a colour. */
export const colorOf = (sys) => { const c = uiOf(sys).color; return COLORS[c] || (/^#[0-9a-f]{6}$/i.test(c) ? c : COLORS.blue); };

/** The home screen's numbers when none were chosen: a count of the first table and the first money total. */
export function defaultKpis(sys) {
  const out = [];
  const t0 = sys.tables[0]; if (t0) out.push({ table: t0.id, agg: "count", label: t0.name });
  for (const t of sys.tables) { const f = t.fields.find((x) => x.type === "money"); if (f) { out.push({ table: t.id, field: f.id, agg: "sum", label: `${f.name} (${t.name})` }); break; } }
  if (sys.tables[1]) out.push({ table: sys.tables[1].id, agg: "count", label: sys.tables[1].name });
  return out.slice(0, 3);
}
/** A key number's value. */
export function kpiValue(sys, kp) {
  const rows = (sys.rows && sys.rows[kp.table]) || [];
  if (kp.agg === "count" || !kp.field) return rows.length;
  const vals = rows.map((r) => Number(r[kp.field])).filter((v) => isFinite(v));
  if (!vals.length) return 0;
  const s = vals.reduce((a, b) => a + b, 0);
  return kp.agg === "avg" ? Math.round((s / vals.length) * 100) / 100 : Math.round(s * 100) / 100;
}

/** The fields a list of `t` shows, in order (chosen, else the first four that are not hidden). */
export function listFields(sys, t) {
  const u = uiOf(sys), hid = new Set(u.hidden[t.id] || []);
  const chosen = (u.lists[t.id] || []).map((id) => t.fields.find((f) => f.id === id)).filter(Boolean);
  return chosen.length ? chosen : t.fields.filter((f) => !hid.has(f.id)).slice(0, 4);
}
/** The fields the form of `t` shows, in order, with the section that starts before each (Access-style form). */
export function formFields(sys, t) {
  const u = uiOf(sys), hid = new Set(u.hidden[t.id] || []), order = u.forms[t.id] || [];
  const seen = new Set(), out = [];
  for (const id of order) { const f = t.fields.find((x) => x.id === id); if (f && !hid.has(f.id)) { out.push(f); seen.add(f.id); } }
  for (const f of t.fields) if (!seen.has(f.id) && !hid.has(f.id)) out.push(f);
  const sec = u.sections[t.id] || {};
  return out.map((f) => ({ field: f, section: sec[f.id] || "" }));
}

/** A plain description of the screens (what the AI reads, after the tables). */
export function describeScreens(sys) {
  const u = uiOf(sys), name = (t, id) => (t.fields.find((f) => f.id === id) || {}).name;
  const lines = [`Colour: ${u.color}. Computer menu: ${u.menu}. Density: ${u.density}.`, `Home screen shows (in order): ${u.home.join(", ")}.`,
    `Key numbers: ${u.kpis.map((x) => x.label).join("; ") || "none"}.`];
  for (const t of sys.tables) {
    const l = listFields(sys, t).map((f) => f.name), fo = formFields(sys, t).map((x) => (x.section ? `[${x.section}] ` : "") + x.field.name), hid = (u.hidden[t.id] || []).map((id) => name(t, id)).filter(Boolean);
    lines.push(`${t.name}: list shows ${l.join(", ")}; form: ${fo.join(", ")}${hid.length ? "; hidden: " + hid.join(", ") : ""}.`);
  }
  return lines.join("\n");
}
export const SCREEN_OPS_HELP = `{"op":"setColor","color":"blue|green|teal|orange|red|purple|pink|black|brown|navy|#RRGGBB"}
{"op":"setMenu","position":"left"|"top"}   (the computer layout's menu)
{"op":"setDensity","density":"comfortable"|"compact"}
{"op":"setHome","parts":["kpis","latest","chart","alerts","tables","ask"]}   (the home screen, in order)
{"op":"addKpi","table":"<table>","agg":"count"|"sum"|"avg","field":"<number or money field, for sum/avg>","label":"<short label>"}
{"op":"removeKpi","label":"<label>"}
{"op":"setListColumns","table":"<table>","fields":["<field>", ...]}   (the columns its list shows)
{"op":"setFormOrder","table":"<table>","fields":["<field>", ...]}   (the order of its form)
{"op":"hideField","table":"<table>","field":"<field>"} / {"op":"showField","table":"<table>","field":"<field>"}
{"op":"setSection","table":"<table>","field":"<first field of the section>","title":"<section title>"}   (a heading in the form)
{"op":"renameSystem","to":"<new name>"}`;

/** One screen change (called by erp.js applyOne for ops it doesn't know). → a sentence, or undefined when not a screen op. */
export function applyScreenOp(sys, o) {
  const op = o.op;
  const ui = () => { sys.ui = uiOf(sys); return sys.ui; };
  const T = () => { const t = findT(sys, o.table); if (!t) throw new Error(`No table called "${o.table}"`); return t; };
  const F = (t, ref = o.field) => { const f = findF(t, ref); if (!f) throw new Error(`No field called "${ref}" in ${t.name}`); return f; };
  switch (op) {
    case "setColor": {
      const c = k(o.color).replace(/^#/, "#");
      const name = COLORS[c] ? c : Object.keys(COLORS).find((n) => k(COLORS_AR[n]) === c) || (/^#[0-9a-f]{6}$/i.test(c) ? c : null);
      if (!name) throw new Error(`Unknown colour "${o.color}" — use ${Object.keys(COLORS).join(", ")} or #RRGGBB`);
      ui().color = name; return `The colour is now ${name}`;
    }
    case "setMenu": { const p = k(o.position) === "top" ? "top" : "left"; ui().menu = p; return `On a computer the menu is on the ${p}`; }
    case "setDensity": { const d = k(o.density) === "compact" ? "compact" : "comfortable"; ui().density = d; return `Spacing: ${d}`; }
    case "setHome": {
      const parts = (Array.isArray(o.parts) ? o.parts : []).map(k).filter((p) => HOME_PARTS[p]);
      if (!parts.length) throw new Error("The home screen needs at least one part: " + Object.keys(HOME_PARTS).join(", "));
      ui().home = [...new Set(parts)]; return `The home screen shows: ${ui().home.map((p) => HOME_PARTS[p]).join(", ")}`;
    }
    case "addKpi": {
      const t = T(), agg = ["sum", "avg"].includes(k(o.agg)) ? k(o.agg) : "count";
      let fid = null;
      if (agg !== "count") { const f = F(t); if (!["number", "money", "formula"].includes(f.type)) throw new Error(`${f.name} is not a number`); fid = f.id; }
      const label = String(o.label || (agg === "count" ? t.name : `${agg === "sum" ? "Total" : "Average"} ${(t.fields.find((f) => f.id === fid) || {}).name}`)).slice(0, 40);
      const u = ui(); u.kpis = [...u.kpis.filter((x) => k(x.label) !== k(label)), { table: t.id, field: fid, agg, label }].slice(-6);
      if (!u.home.includes("kpis")) u.home = ["kpis", ...u.home];
      return `Added the key number “${label}”`;
    }
    case "removeKpi": {
      const u = ui(), before = u.kpis.length; u.kpis = u.kpis.filter((x) => k(x.label) !== k(o.label) && !k(x.label).startsWith(k(o.label)));
      if (u.kpis.length === before) throw new Error(`No key number called "${o.label}"`);
      return `Removed the key number “${o.label}”`;
    }
    case "setListColumns": case "setFormOrder": {
      const t = T(), ids = [];
      for (const n of Array.isArray(o.fields) ? o.fields : []) { const f = F(t, n); if (!ids.includes(f.id)) ids.push(f.id); }
      if (!ids.length) throw new Error("Name at least one field");
      const u = ui(), key = op === "setListColumns" ? "lists" : "forms";
      u[key] = { ...u[key], [t.id]: ids };
      if (op === "setListColumns") u.hidden = { ...u.hidden, [t.id]: (u.hidden[t.id] || []).filter((x) => !ids.includes(x)) };
      return `${t.name}: the ${op === "setListColumns" ? "list shows" : "form goes"} ${ids.map((id) => t.fields.find((f) => f.id === id).name).join(", ")}`;
    }
    case "hideField": case "showField": {
      const t = T(), f = F(t), u = ui(), cur = new Set(u.hidden[t.id] || []);
      if (op === "hideField") cur.add(f.id); else cur.delete(f.id);
      u.hidden = { ...u.hidden, [t.id]: [...cur] };
      return `${t.name} › ${f.name} is ${op === "hideField" ? "hidden from lists and forms" : "shown again"}`;
    }
    case "setSection": {
      const t = T(), f = F(t), u = ui(), title = String(o.title || "").trim().slice(0, 40);
      const s = { ...(u.sections[t.id] || {}) }; if (title) s[f.id] = title; else delete s[f.id];
      u.sections = { ...u.sections, [t.id]: s };
      return title ? `${t.name}: the form has a section “${title}” from ${f.name}` : `${t.name}: removed the section before ${f.name}`;
    }
    case "renameSystem": { const to = String(o.to || "").trim().slice(0, 80); if (!to) throw new Error("Give the new name"); const old = sys.name; sys.name = to; return `Renamed the system ${old} → ${to}`; }
    default: return undefined;
  }
}

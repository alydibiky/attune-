/* ---- Business → a standalone app (v5.17) ---------------------------------------------------
   Ali: "make a ready app from the ERP so people can use it outside Attune; when they
   need something hard changed, they bring the app (with its data) back to Attune,
   ask the AI, and send the new app out again."

   buildApp(sys)  → ONE .html file: the whole system (design + every record) inside a
                    <script type="application/json" id="attune-erp">, plus a small
                    runtime that works in any browser, offline, with no Attune:
                    tables as tabs, search, add / edit / delete records, auto numbers,
                    formulas, links, totals, CSV export, and "Save a copy with my data"
                    (a new .html with the current records inside — the file people send back).
   readApp(html)  → the system from such a file (or null), ready to open in Attune.

   The runtime is a normal function here, embedded with Function.toString(), so it is
   bundled, minified and unit-tested like the rest (tests/unit/v517.test.mjs).     */

export const APP_MARK = "attune-erp";

const esc = (s) => String(s).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export function buildApp(sys, { freeRows = null } = {}) {
  // a system still on trial keeps its trial limit outside Attune too
  const data = { attuneErp: 1, exported: new Date().toISOString(), ...sys, history: [], freeRows };
  const title = String(sys.name || "My business").replace(/[<>&"]/g, "");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--text:#18202a;--muted:#6b7280;--line:#e5e7eb;--accent:#0d9488;--accent2:#ccfbf1}
@media (prefers-color-scheme:dark){:root{--bg:#0b1220;--card:#111a2b;--text:#e5e7eb;--muted:#94a3b8;--line:#243044;--accent:#2dd4bf;--accent2:#134e4a}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",sans-serif;background:var(--bg);color:var(--text)}
header{position:sticky;top:0;background:var(--card);border-bottom:1px solid var(--line);padding:12px 14px;z-index:2}
h1{font-size:18px;margin:0 0 8px}.tabs{display:flex;gap:6px;overflow-x:auto}.tab{border:1px solid var(--line);background:none;color:var(--text);border-radius:999px;padding:6px 12px;font-size:13px;white-space:nowrap}
.tab.on{background:var(--accent);border-color:var(--accent);color:#fff}main{padding:12px 14px 90px}
.bar{display:flex;gap:8px;margin-bottom:10px}input,select,textarea{width:100%;font:inherit;font-size:15px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text)}
button.p{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:9px 14px;font-weight:600;font-size:14px;white-space:nowrap}button.g{background:none;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:9px 14px;font-size:14px}
.grid{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)}table{border-collapse:collapse;min-width:100%;font-size:13px}
th,td{padding:9px 10px;text-align:start;white-space:nowrap;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:600}tr.r:active{background:var(--accent2)}td.n{text-align:end;font-variant-numeric:tabular-nums}
tfoot td{font-weight:700}.muted{color:var(--muted);font-size:12px}label{display:block;margin:10px 0}label span{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
.foot{position:fixed;bottom:0;left:0;right:0;background:var(--card);border-top:1px solid var(--line);padding:10px 14px;display:flex;gap:8px;flex-wrap:wrap}
.ro{padding:9px 10px;border-radius:10px;background:var(--bg)}.err{color:#dc2626;font-size:12px}
</style></head>
<body><div id="app"></div>
<script type="application/json" id="${APP_MARK}">${esc(JSON.stringify(data))}</script>
<script>(${runtime.toString()})();</script>
</body></html>`;
}

/** The system inside an exported app file, or null. Accepts the .html, or its JSON. */
export function readApp(text) {
  const s = String(text || "");
  let json = null;
  const m = s.match(new RegExp('<script type="application/json" id="' + APP_MARK + '">([\\s\\S]*?)</script>'));
  try { json = JSON.parse(m ? m[1] : s); } catch (e) { return null; }
  if (!json || json.attuneErp !== 1 || !Array.isArray(json.tables) || typeof json.rows !== "object") return null;
  const { attuneErp, exported, freeRows, ...sys } = json;
  sys.history = sys.history || [];
  return sys;
}

/* ---- the runtime (runs inside the exported file, in any browser) ------------------------
   Self-contained: it may not use anything outside this function.                          */
function runtime() {
  var SRC = document.getElementById("attune-erp");
  var sys = JSON.parse(SRC.textContent);
  var KEY = "attune-app:" + sys.id;
  // The records people add live in this browser; a newer copy wins.
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved && (saved.updated || 0) > (sys.updated || 0)) sys = saved; } catch (e) {}
  var tid = sys.tables[0] && sys.tables[0].id, q = "", editing = null;
  var H = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var T = function (id) { return sys.tables.filter(function (t) { return t.id === id; })[0]; };
  var save = function () { sys.updated = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(sys)); } catch (e) { alertBox("This browser's storage is full."); } };
  var alertBox = function (m) { var d = document.createElement("div"); d.textContent = m; d.style.cssText = "position:fixed;left:14px;right:14px;bottom:80px;background:#111;color:#fff;padding:10px 12px;border-radius:10px;z-index:9"; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2500); };
  var num = function (f, v) {
    if (v == null || v === "") return null;
    if (f.type === "date") { var t = Date.parse(v); return isNaN(t) ? null : Math.round(t / 86400000); }
    if (f.type === "bool") return v ? 1 : 0;
    if (f.type === "auto") { var m = String(v).match(/(\d+)\s*$/); return m ? +m[1] : null; }
    var n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, "")); return isNaN(n) ? null : n;
  };
  // formulas: numbers, {field ids}, + - * / ( ), ROUND DAYS MIN MAX ABS IFEMPTY
  var FN = { ROUND: function (a, n) { return a == null ? null : Math.round(a * Math.pow(10, n || 0)) / Math.pow(10, n || 0); }, DAYS: function (a, b) { return a == null || b == null ? null : a - b; },
    MIN: function () { var v = [].slice.call(arguments).filter(function (x) { return x != null; }); return v.length ? Math.min.apply(null, v) : null; },
    MAX: function () { var v = [].slice.call(arguments).filter(function (x) { return x != null; }); return v.length ? Math.max.apply(null, v) : null; },
    ABS: function (a) { return a == null ? null : Math.abs(a); }, IFEMPTY: function (a, b) { return a == null ? b : a; } };
  var calc = function (table, row, expr, depth) {
    var toks = [], re = /\s*(?:(\d+(?:\.\d+)?)|\{([^}]+)\}|([A-Za-z]+)|(.))/g, m;
    while ((m = re.exec(expr)) && m[0].length) toks.push(m[1] ? { n: +m[1] } : m[2] ? { f: m[2] } : m[3] ? { w: m[3].toUpperCase() } : { o: m[4] });
    var i = 0;
    var val = function (fid) { var f = table.fields.filter(function (x) { return x.id === fid; })[0]; if (!f) return null;
      if (f.type === "formula") return depth > 8 ? null : calc(table, row, f.formula || "", depth + 1); return num(f, row[fid]); };
    var atom = function () { var t = toks[i++]; if (!t) return null;
      if (t.n != null) return t.n; if (t.f) return val(t.f);
      if (t.o === "-") { var a = atom(); return a == null ? null : -a; }
      if (t.o === "(") { var v = expr0(); i++; return v; }
      if (t.w && FN[t.w]) { i++; var args = []; if (!(toks[i] && toks[i].o === ")")) { args.push(expr0()); while (toks[i] && toks[i].o === ",") { i++; args.push(expr0()); } } i++; return FN[t.w].apply(null, args); }
      return null; };
    var term = function () { var a = atom(); while (toks[i] && (toks[i].o === "*" || toks[i].o === "/")) { var op = toks[i++].o, b = atom(); a = a == null || b == null ? null : op === "*" ? a * b : b ? a / b : null; } return a; };
    var expr0 = function () { var a = term(); while (toks[i] && (toks[i].o === "+" || toks[i].o === "-")) { var op = toks[i++].o, b = term(); a = a == null || b == null ? null : op === "+" ? a + b : a - b; } return a; };
    try { var r = expr0(); return r == null || !isFinite(r) ? null : Math.round(r * 100) / 100; } catch (e) { return null; }
  };
  var label = function (table, row) { if (!row) return ""; var f = table.fields.filter(function (x) { return (x.type === "text" || x.type === "auto") && row[x.id]; })[0] || table.fields.filter(function (x) { return row[x.id] != null && row[x.id] !== "" && x.type !== "link"; })[0]; return f ? String(row[f.id]) : "(empty)"; };
  var fmt = function (table, f, row) {
    var v = f.type === "formula" ? calc(table, row, f.formula || "", 0) : row[f.id];
    if (v == null || v === "") return "";
    if (f.type === "bool") return v ? "✓" : "";
    if (f.type === "link") { var lt = T(f.link); var r = lt && (sys.rows[lt.id] || []).filter(function (x) { return x._id === v; })[0]; return r ? label(lt, r) : "(deleted)"; }
    if (f.type === "money" || f.type === "number" || f.type === "formula") { var n = Number(v); return isNaN(n) ? String(v) : n.toLocaleString("en-US", { maximumFractionDigits: 2 }) + (f.type === "money" && sys.currency ? " " + sys.currency : ""); }
    return String(v);
  };
  var nextAuto = function (table, f) { var max = (sys.rows[table.id] || []).reduce(function (m, r) { return Math.max(m, num(f, r[f.id]) || 0); }, 0); return (f.prefix || "") + String(max + 1).padStart(f.prefix ? 4 : 1, "0"); };
  var root = document.getElementById("app");
  var draw = function () {
    var table = T(tid); if (!table) { root.innerHTML = "<main>No tables.</main>"; return; }
    var head = '<header><h1>' + H(sys.name) + '</h1><div class="tabs">' + sys.tables.map(function (t) { return '<button class="tab' + (t.id === tid ? " on" : "") + '" data-t="' + t.id + '">' + H(t.name) + " " + (sys.rows[t.id] || []).length + "</button>"; }).join("") + "</div></header>";
    if (editing) { root.innerHTML = head + form(table); bindForm(table); bindTabs(); return; }
    var rows = (sys.rows[table.id] || []).filter(function (r) { if (!q) return true; var k = q.toLowerCase(); return table.fields.some(function (f) { return fmt(table, f, r).toLowerCase().indexOf(k) >= 0; }); });
    var shown = table.fields.slice(0, 10);
    var sums = shown.map(function (f) { if (!/^(number|money|formula)$/.test(f.type)) return null; var s = 0, any = false; rows.forEach(function (r) { var v = f.type === "formula" ? calc(table, r, f.formula || "", 0) : num(f, r[f.id]); if (v != null) { s += v; any = true; } }); return any ? s : null; });
    root.innerHTML = head + '<main><div class="bar"><input id="q" placeholder="Search ' + H(table.name) + '" value="' + H(q) + '"><button class="p" id="add">+ Record</button></div>' +
      '<div class="grid"><table><thead><tr>' + shown.map(function (f) { return "<th>" + H(f.name) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return '<tr class="r" data-r="' + r._id + '">' + shown.map(function (f) { return '<td class="' + (/^(number|money|formula)$/.test(f.type) ? "n" : "") + '">' + H(fmt(table, f, r)) + "</td>"; }).join("") + "</tr>"; }).join("") +
      (rows.length ? "" : '<tr><td colspan="' + shown.length + '" class="muted" style="text-align:center;padding:24px">No records yet — tap + Record</td></tr>') + "</tbody>" +
      (rows.length > 1 && sums.some(function (x) { return x != null; }) ? "<tfoot><tr>" + sums.map(function (s, i) { return '<td class="n">' + (s != null ? s.toLocaleString("en-US", { maximumFractionDigits: 2 }) : i === 0 ? "Total" : "") + "</td>"; }).join("") + "</tr></tfoot>" : "") +
      '</table></div><p class="muted">' + rows.length + ' records · made with Attune — to change the design, open this file in Attune and ask.</p></main>' +
      '<div class="foot"><button class="g" id="csv">Export CSV</button><button class="p" id="copy">Save a copy with my data</button></div>';
    bindTabs();
    var qi = document.getElementById("q"); qi.oninput = function () { q = qi.value; var pos = qi.selectionStart; draw(); var n = document.getElementById("q"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} };
    document.getElementById("add").onclick = function () {
      if (sys.freeRows && (sys.rows[table.id] || []).length >= sys.freeRows) { alertBox("This trial keeps " + sys.freeRows + " records per table — activate the system in Attune for more."); return; }
      editing = "new"; draw(); };
    [].forEach.call(root.querySelectorAll("tr.r"), function (tr) { tr.onclick = function () { editing = tr.getAttribute("data-r"); draw(); }; });
    document.getElementById("csv").onclick = function () {
      var lines = [table.fields.map(function (f) { return f.name; })].concat(rows.map(function (r) { return table.fields.map(function (f) { return fmt(table, f, r).replace(new RegExp(" " + (sys.currency || "@@") + "$"), ""); }); }));
      download(table.name + ".csv", "\ufeff" + lines.map(function (l) { return l.map(function (c) { return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\n"), "text/csv");
    };
    document.getElementById("copy").onclick = function () {
      var html = document.documentElement.outerHTML;
      var json = JSON.stringify(Object.assign({}, sys, { attuneErp: 1, exported: new Date().toISOString() })).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
      html = html.replace(/(<script type="application\/json" id="attune-erp">)[\s\S]*?(<\/script>)/, function (m, a, b) { return a + json + b; });
      download(sys.name + ".html", "<!doctype html>\n" + html, "text/html");
    };
  };
  var bindTabs = function () { [].forEach.call(root.querySelectorAll(".tab"), function (b) { b.onclick = function () { tid = b.getAttribute("data-t"); editing = null; q = ""; draw(); }; }); };
  var form = function (table) {
    var row = editing === "new" ? {} : (sys.rows[table.id] || []).filter(function (r) { return r._id === editing; })[0] || {};
    return "<main><button class=\"g\" id=\"back\">← " + H(table.name) + "</button>" + table.fields.map(function (f) {
      var v = row[f.id], id = "f_" + f.id, inp;
      if (f.type === "formula") inp = '<div class="ro">' + H(editing === "new" ? "—" : fmt(table, f, row)) + "</div>";
      else if (f.type === "auto") inp = '<div class="ro">' + H(v || "(given when saved)") + "</div>";
      else if (f.type === "bool") inp = '<select id="' + id + '"><option value="">No</option><option value="1"' + (v ? " selected" : "") + ">Yes</option></select>";
      else if (f.type === "choice") inp = '<select id="' + id + '"><option value=""></option>' + (f.options || []).map(function (o) { return "<option" + (o === v ? " selected" : "") + ">" + H(o) + "</option>"; }).join("") + "</select>";
      else if (f.type === "link") { var lt = T(f.link); inp = '<select id="' + id + '"><option value=""></option>' + (lt ? (sys.rows[lt.id] || []).map(function (r) { return '<option value="' + r._id + '"' + (r._id === v ? " selected" : "") + ">" + H(label(lt, r)) + "</option>"; }).join("") : "") + "</select>"; }
      else if (f.type === "longtext") inp = '<textarea id="' + id + '" rows="3">' + H(v) + "</textarea>";
      else inp = '<input id="' + id + '" type="' + (f.type === "date" ? "date" : f.type === "number" || f.type === "money" ? "text\" inputmode=\"decimal" : f.type === "phone" ? "tel" : f.type === "email" ? "email" : "text") + '" value="' + H(v) + '">';
      return "<label><span>" + H(f.name) + (f.required ? " *" : "") + "</span>" + inp + "</label>";
    }).join("") + '<p class="err" id="err"></p><div class="bar"><button class="p" id="ok">Save</button>' + (editing !== "new" ? '<button class="g" id="del">Delete</button>' : "") + "</div></main>";
  };
  var bindForm = function (table) {
    document.getElementById("back").onclick = function () { editing = null; draw(); };
    var del = document.getElementById("del");
    if (del) del.onclick = function () { if (del.textContent !== "Tap again to delete") { del.textContent = "Tap again to delete"; return; } sys.rows[table.id] = (sys.rows[table.id] || []).filter(function (r) { return r._id !== editing; }); save(); editing = null; draw(); };
    document.getElementById("ok").onclick = function () {
      var rows = sys.rows[table.id] = sys.rows[table.id] || [];
      var row = editing === "new" ? { _id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), _ts: Date.now() } : rows.filter(function (r) { return r._id === editing; })[0];
      var bad = "";
      table.fields.forEach(function (f) {
        if (f.type === "formula") return;
        if (f.type === "auto") { if (!row[f.id]) row[f.id] = nextAuto(table, f); return; }
        var el = document.getElementById("f_" + f.id); if (!el) return;
        var v = el.value.trim();
        if (f.required && !v) bad = bad || f.name + " is required";
        if (f.type === "number" || f.type === "money") { if (v === "") row[f.id] = null; else { var n = parseFloat(v.replace(/,/g, "")); if (isNaN(n)) bad = bad || f.name + " must be a number"; else row[f.id] = n; } }
        else if (f.type === "bool") row[f.id] = !!v;
        else row[f.id] = v || null;
      });
      if (bad) { document.getElementById("err").textContent = bad; return; }
      if (editing === "new") rows.push(row);
      save(); editing = null; draw();
    };
  };
  var download = function (name, text, mime) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name.replace(/[\\/:*?"<>|]/g, "_"); document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); };
  draw();
}

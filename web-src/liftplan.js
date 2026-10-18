/* ---- v6.40 (upgrade W2) — the lift plan document. One form → every check of the Crane toolkit together (crane.js: the load
   chart, the outrigger ground pressure, the slings, the wind) and ONE verdict: GO / CRITICAL LIFT (needs sign-off) / STOP;
   then a printable PDF with the job, the crane and configuration, each check with its numbers, the site checklist and three
   signatures (lift planner, supervisor, operator). Arithmetic only, the cautious side every time. Pure;
   tests/unit/v740liftplan.test.mjs. A planning aid — the crane's LMI, its manuals and a competent person decide.            */
import { liftCheck, outriggerPressure, slingTension, windCheck, GROUNDS, CHECKLIST, DEFAULT_LIMITS, num } from "./crane.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n = (v, d = 2) => (v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: d }));

/** → { checks: [{ id, title, level: ok|plan|caution|stop|missing, lines: [..] }], overall, gross } */
export function liftPlan(p = {}) {
  const limits = p.limits || DEFAULT_LIMITS, checks = [];
  const lift = liftCheck({ load: p.load, hook: p.hook, rigging: p.rig, other: p.other, capacity: num(p.capacity), limits });
  checks.push({ id: "chart", title: "Load chart", level: lift.level === "missing" ? "missing" : lift.level,
    lines: lift.level === "missing" ? [lift.why] : [`Gross load ${n(lift.gross)} t (load + hook + rigging + other)`, `Chart capacity ${n(num(p.capacity))} t at ${n(num(p.radius), 1)} m radius${p.boom ? ", " + n(num(p.boom), 1) + " m boom" : ""}`,
      `${n(lift.pct, 1)} % of the chart — plan above ${limits.plan} %, stop above ${limits.stop} %`] });
  const gross = lift.gross || num(p.load) || 0;
  const soil = GROUNDS.find((g) => g[0] === p.soil);
  const allowable = num(p.allowable) > 0 ? num(p.allowable) : soil ? soil[2] : NaN;
  if (num(p.force) > 0 || num(p.craneMass) > 0) {
    const o = outriggerPressure({ force: p.force, craneMass: p.craneMass, counterweight: p.counterweight, gross, matL: p.matL, matW: p.matW, allowable });
    const lv = o.why ? "missing" : o.ok === false ? "stop" : o.ok ? (o.ratio > 0.8 ? "caution" : "ok") : "missing";
    checks.push({ id: "ground", title: "Ground under the outriggers", level: lv, lines: o.why ? [o.why] : [
      `Heaviest outrigger ${n(o.forceT, 1)} t (${n(o.forceKN, 0)} kN)${o.estimated ? " — estimated: 75 % of crane + counterweight + load" : ""}`,
      o.area ? `Mat ${n(num(p.matL))} × ${n(num(p.matW))} m = ${n(o.area)} m² → ${n(o.pressure, 0)} kN/m²` : "Mat size not given",
      isFinite(allowable) ? `Ground allows ${n(allowable, 0)} kN/m²${soil && !(num(p.allowable) > 0) ? " (" + soil[1] + ", a typical value — get the site's figure)" : ""}${o.needSide ? `; a square mat needs at least ${n(o.needSide)} m a side` : ""}` : "Ground bearing value not given"] });
  }
  if (num(p.legs) >= 1 && num(p.angle) >= 0 && p.angle !== "" && p.angle != null) {
    const s = slingTension({ load: num(p.load) + (num(p.rigBelow) || 0), legs: p.legs, angle: p.angle });
    const swl = num(p.swl);
    const lv = s.why ? "missing" : s.level === "stop" || (swl > 0 && s.perLeg > swl) ? "stop" : s.level === "caution" ? "caution" : "ok";
    checks.push({ id: "slings", title: "Slings", level: lv, lines: s.why ? [s.why] : [
      `${num(p.legs)} legs at ${n(num(p.angle), 0)}° from vertical (${n(s.included, 0)}° between legs) — ${s.carrying} counted as carrying`,
      `Each leg carries ${n(s.perLeg)} t (× ${n(s.factor, 3)} for the angle)${swl > 0 ? ` — rated ${n(swl)} t per leg: ${s.perLeg <= swl ? "OK" : "TOO WEAK"}` : ""}`] });
  }
  if (num(p.vChart) > 0 && num(p.area) > 0) {
    const w = windCheck({ vChart: p.vChart, mass: gross, area: p.area, cw: p.cw || 1.2, vNow: p.vNow === "" ? undefined : p.vNow });
    const lv = w.why ? "missing" : w.ok === false ? "stop" : w.reduced ? "caution" : "ok";
    checks.push({ id: "wind", title: "Wind", level: lv, lines: w.why ? [w.why] : [
      `Load wind area ${n(w.windArea)} m² (${n(w.perTonne)} m² per tonne; the chart assumes 1.2)`,
      `Highest wind for this lift ${n(w.vAllowed, 1)} m/s${w.reduced ? " — lower than the chart's " + n(num(p.vChart), 1) + " m/s because the load catches the wind" : ""}`,
      w.forceKN != null ? `Wind now ${n(num(p.vNow), 1)} m/s → ${n(w.forceKN)} kN on the load — ${w.ok ? "within the limit" : "STOP: over the limit"}` : "Measure the wind at the boom tip before lifting"] });
  }
  const levels = checks.map((c) => c.level);
  const overall = levels.includes("stop") ? "stop" : levels.includes("missing") ? "incomplete" : levels.includes("plan") ? "plan" : levels.includes("caution") ? "caution" : "go";
  return { checks, overall, gross };
}

const VERDICT = { go: ["GO — within every limit", "#047857"], caution: ["GO WITH CARE — read the cautions", "#b45309"], plan: ["CRITICAL LIFT — a signed lift plan is required", "#b45309"],
  stop: ["STOP — do not lift as planned", "#b91c1c"], incomplete: ["INCOMPLETE — fill the missing checks", "#6b7280"] };
/** The printable plan (A4 HTML for the phone's PDF maker). */
export function planHtml(p, r = liftPlan(p), brandColor = "#0f766e") {
  const [vt, vc] = VERDICT[r.overall];
  const row = (k, v) => v ? `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>` : "";
  const lvl = { ok: "✓ OK", caution: "! Caution", plan: "! Critical", stop: "✗ STOP", missing: "… Missing" };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;margin:28px}h1{font-size:18pt;margin:0;color:${brandColor}}h2{font-size:12pt;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
table{border-collapse:collapse;width:100%}td{padding:3px 6px;vertical-align:top}td.k{color:#555;width:34%}.v{margin:12px 0;padding:10px;border:2px solid ${vc};color:${vc};font-weight:bold;font-size:13pt}
.c{margin:6px 0 10px}.c b{display:inline-block;min-width:86px}.sig{display:flex;gap:18px;margin-top:22px}.sig div{flex:1;border-top:1px solid #333;padding-top:4px;font-size:9.5pt;color:#444}
ul{margin:4px 0 0 18px;padding:0}li{margin:1px 0}.small{font-size:8.5pt;color:#666;margin-top:16px}</style></head><body>
<h1>Lift plan</h1><div>${esc(p.job || "")}${p.site ? " · " + esc(p.site) : ""}${p.date ? " · " + esc(p.date) : ""}</div>
<div class="v">${esc(vt)}</div>
<h2>The lift</h2><table>${row("Crane", [p.crane, p.config].filter(Boolean).join(" — "))}${row("Load", p.loadName ? p.loadName + " — " + n(num(p.load)) + " t" : n(num(p.load)) + " t")}${row("Gross load", n(r.gross) + " t")}${row("Radius / boom", [p.radius ? n(num(p.radius), 1) + " m radius" : "", p.boom ? n(num(p.boom), 1) + " m boom" : ""].filter(Boolean).join(", "))}${row("Lift planner", p.planner)}</table>
<h2>Checks</h2>${r.checks.map((c) => `<div class="c"><b>${esc(lvl[c.level] || c.level)}</b> <strong>${esc(c.title)}</strong><ul>${c.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`).join("")}
<h2>Before the lift</h2>${CHECKLIST.map(([g, items]) => `<div><strong>${esc(g)}</strong><ul>${items.map((i) => `<li>☐ ${esc(i)}</li>`).join("")}</ul></div>`).join("")}
<div class="sig"><div>Lift planner — name, signature, date</div><div>Site supervisor — name, signature, date</div><div>Crane operator — name, signature, date</div></div>
<p class="small">Planning aid made with Attune: arithmetic only, the cautious side every time. The crane's own load chart and rated capacity limiter (LMI), the manufacturer's manuals and a competent lift planner always decide.</p>
</body></html>`;
}

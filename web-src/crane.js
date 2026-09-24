/* ---- crane toolkit: the calculations ------------------------------------------
   Deterministic arithmetic only — no model involved, so the same inputs give
   the same answer every time, on any phone, with no signal.

   These are PLANNING AIDS. The crane's own load chart and computer (LMI/RCL),
   the manufacturer's manuals and a competent lift planner always govern.
   Every rule below takes the cautious side when it has to choose.

   Units: tonnes (t) for mass, metres, seconds; forces shown in kN
   (1 t of mass weighs 9.81 kN); pressure in kN/m² (= kPa).                     */

export const G = 9.81;
export const CRANE_KEY = "attune:crane:v1";

const num = (x) => { const n = parseFloat(String(x ?? "").replace(/,/g, ".").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))); return isFinite(n) ? n : NaN; };
export { num };
const r2 = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

// ---- 1. load charts -------------------------------------------------------------------
/**
 * A chart pasted from the manufacturer's table (CSV/TSV/spaces):
 *   first row  = boom lengths (m); the first cell may be a label ("m", "R\\L")
 *   first col  = working radius (m)
 *   cells      = capacity (t); empty or "-" = not permitted
 * Returns { booms:[…], radii:[…], cap:[[…]] , problems:[…] }.
 */
export function parseChart(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const split = (l) => l.split(/\t|;|,(?=\s*[\d-])|\s{1,}/).map((c) => c.trim()).filter((c) => c !== "");
  const problems = [];
  if (lines.length < 2) return { booms: [], radii: [], cap: [], problems: ["Paste at least a header row of boom lengths and one row of capacities."] };
  let head = split(lines[0]);
  if (isNaN(num(head[0]))) head = head.slice(1);
  const booms = head.map(num);
  if (booms.some(isNaN) || !booms.length) problems.push("The first row must be boom lengths in metres.");
  const radii = [], cap = [];
  for (const l of lines.slice(1)) {
    const cells = split(l);
    const r = num(cells[0]);
    if (isNaN(r)) { problems.push("Skipped a row that doesn't start with a radius: " + l.slice(0, 30)); continue; }
    radii.push(r);
    cap.push(booms.map((_, i) => { const v = cells[i + 1]; if (v == null || /^[-–—x*]$|^n\/?a$/i.test(v)) return null; const n = num(v); return isNaN(n) ? null : n; }));
  }
  for (let i = 1; i < radii.length; i++) if (radii[i] <= radii[i - 1]) { problems.push("Radii must go up from top to bottom."); break; }
  for (let i = 1; i < booms.length; i++) if (booms[i] <= booms[i - 1]) { problems.push("Boom lengths must go up from left to right."); break; }
  return { booms, radii, cap, problems };
}

/**
 * Chart capacity at a radius and boom length — the cautious reading:
 *  - never interpolate: a radius between two rows uses BOTH rows, a boom
 *    between two columns uses BOTH columns, and the SMALLEST of those cells
 *    is the answer (so an in-between point can never read higher than any
 *    chart value around it);
 *  - outside the chart, or next to an empty cell = not permitted.
 * Returns { cap, cells:[{r,L,v}], why }.
 */
export function chartCapacity(chart, radius, boom) {
  const { booms, radii, cap } = chart || {};
  if (!booms || !booms.length || !radii || !radii.length) return { cap: null, why: "No chart for this crane." };
  if (!(radius > 0) || !(boom > 0)) return { cap: null, why: "Give the radius and the boom length." };
  const bracket = (arr, x) => {
    if (x < arr[0] - 1e-9 || x > arr[arr.length - 1] + 1e-9) return null;
    const i = arr.findIndex((v) => Math.abs(v - x) < 1e-9);
    if (i >= 0) return [i];
    const hi = arr.findIndex((v) => v > x);
    return [hi - 1, hi];
  };
  const ri = bracket(radii, radius);
  if (!ri) return { cap: null, why: radius < radii[0] ? "Closer than the chart's smallest radius — check the chart." : "Beyond the chart's largest radius — not permitted." };
  const bi = bracket(booms, boom);
  if (!bi) return { cap: null, why: "This boom length is outside the chart." };
  const cells = [];
  for (const i of ri) for (const j of bi) cells.push({ r: radii[i], L: booms[j], v: cap[i] ? cap[i][j] : null });
  if (cells.some((c) => c.v == null)) return { cap: null, cells, why: "The chart has no value there — the crane may not lift at this radius with this boom." };
  return { cap: Math.min(...cells.map((c) => c.v)), cells, why: cells.length > 1 ? "Between chart points — the lowest surrounding value is used." : "" };
}

// ---- 2. the lift: how much of the chart is used ---------------------------------------------
export const DEFAULT_LIMITS = { plan: 75, stop: 90 };   // % of chart: written lift plan above 75 %, replan above 90 %

/**
 * Everything the crane lifts counts: the load plus hook block, slings,
 * shackles, spreader/beam, and anything else below the boom tip.
 */
export function liftCheck({ load, hook = 0, rigging = 0, other = 0, capacity, limits = DEFAULT_LIMITS }) {
  const gross = [load, hook, rigging, other].map((x) => (isNaN(num(x)) ? 0 : num(x))).reduce((a, b) => a + b, 0);
  if (!(num(load) > 0)) return { ok: false, level: "missing", why: "Enter the load's weight." };
  if (!(capacity > 0)) return { ok: false, level: "missing", gross: r2(gross), why: "No chart capacity for this radius/boom." };
  const pct = (gross / capacity) * 100;
  const level = pct > 100 ? "over" : pct > limits.stop ? "stop" : pct > limits.plan ? "plan" : "ok";
  return { ok: level === "ok" || level === "plan", level, gross: r2(gross), pct: r2(pct, 1), spare: r2(capacity - gross) };
}

// ---- 3. outriggers on the ground ---------------------------------------------------------------
// Typical presumed bearing values (kN/m²) — for a first look only, the low end
// of commonly published ranges. A site-specific figure from a geotechnical
// engineer always replaces these.
export const GROUNDS = [
  ["soft_clay", "Soft clay / made ground", 50],
  ["firm_clay", "Firm clay", 100],
  ["stiff_clay", "Stiff clay", 150],
  ["loose_sand", "Loose sand", 75],
  ["dense_sand", "Medium-dense sand", 150],
  ["dense_gravel", "Dense gravel / compacted crushed stone", 300],
  ["concrete", "Sound reinforced concrete slab (check design)", 500],
  ["rock", "Weathered rock", 600],
];

/**
 * Pressure under one outrigger pad or mat.
 *  force: the heaviest outrigger's load in tonnes — best taken from the
 *    manufacturer's outrigger-force calculator for THIS lift. If not known,
 *    `estimate` gives a cautious rule of thumb: 75 % of crane + counterweight
 *    + gross load on one corner (the load slewed over it).
 */
export function outriggerPressure({ force, craneMass, counterweight = 0, gross = 0, matL, matW, allowable }) {
  let F = num(force), estimated = false;
  if (!(F > 0)) {
    const total = [craneMass, counterweight, gross].map((x) => (isNaN(num(x)) ? 0 : num(x))).reduce((a, b) => a + b, 0);
    if (!(total > 0)) return { why: "Give the outrigger force, or the crane mass and load to estimate it." };
    F = 0.75 * total; estimated = true;
  }
  const kN = F * G;
  const L = num(matL), W = num(matW);
  const area = L > 0 && W > 0 ? L * W : NaN;
  const out = { forceT: r2(F, 1), forceKN: r2(kN, 0), estimated };
  if (area > 0) { out.area = r2(area); out.pressure = r2(kN / area, 0); }
  const q = num(allowable);
  if (q > 0) {
    out.needArea = r2(kN / q);
    out.needSide = r2(Math.sqrt(kN / q), 2);            // a square mat of this side
    if (out.pressure != null) { out.ratio = r2(out.pressure / q, 2); out.ok = out.pressure <= q; }
  }
  return out;
}

// ---- 4. slings ----------------------------------------------------------------------------------
/**
 * Tension in each sling leg.
 *  angle: measured FROM THE VERTICAL (0° = straight down). The included angle
 *         between two legs is twice this.
 *  legs:  1–4. With 3 or 4 legs, only 2 are counted as carrying the load
 *         unless `allLegs` is set (standard practice: a 3/4-leg bridle is
 *         rarely shared evenly; rate it as a 2-leg).
 */
export function slingTension({ load, legs = 2, angle = 0, allLegs = false }) {
  const W = num(load), n = Math.round(num(legs)), a = num(angle);
  if (!(W > 0)) return { why: "Enter the load." };
  if (!(n >= 1 && n <= 4)) return { why: "Legs: 1 to 4." };
  if (!(a >= 0 && a < 90)) return { why: "The angle from vertical must be 0–89°." };
  const carrying = n >= 3 && !allLegs ? 2 : n;
  const factor = 1 / Math.cos((a * Math.PI) / 180);
  const perLeg = W / carrying * (n === 1 ? 1 : factor);
  const level = a > 60 ? "stop" : a > 45 ? "caution" : "ok";
  return { perLeg: r2(perLeg), factor: r2(factor, 3), carrying, included: r2(2 * a, 0), level };
}

// ---- 5. wind ------------------------------------------------------------------------------------
/** Wind speed at another height (power law, open country: α = 0.14). */
export function windAtHeight(v, hMeasured, hTarget, alpha = 0.14) {
  const V = num(v), h1 = num(hMeasured), h2 = num(hTarget);
  if (!(V >= 0) || !(h1 > 0) || !(h2 > 0)) return NaN;
  return V * Math.pow(h2 / h1, alpha);
}

/**
 * Wind on the load, and the highest wind this lift allows.
 * Load charts give a maximum wind speed that assumes a "normal" load: about
 * 1.2 m² of wind area per tonne. A big light load (panels, formwork, a
 * rotor blade) catches far more, so the permitted wind drops:
 *    v_allowed = v_chart × √(1.2 × m / (A × cw))        (never above v_chart)
 * m = hoist load in t, A = the load's largest face in m², cw = drag
 * coefficient (1.2 for a flat panel / box as the usual cautious value).
 * Wind force on the load: F = A × cw × v² / 1.6  (N; v in m/s).
 */
export function windCheck({ vChart, mass, area, cw = 1.2, vNow }) {
  const vc = num(vChart), m = num(mass), A = num(area), c = num(cw);
  if (!(vc > 0) || !(m > 0) || !(A > 0) || !(c > 0)) return { why: "Enter the chart's wind limit, the load mass and its largest face area." };
  const Aw = A * c;
  const ratio = (1.2 * m) / Aw;
  const vAllowed = Math.min(vc, vc * Math.sqrt(ratio));
  const out = { windArea: r2(Aw), vAllowed: r2(vAllowed, 1), reduced: ratio < 1, perTonne: r2(Aw / m, 2) };
  const v = num(vNow);
  if (v >= 0) { out.forceKN = r2((Aw * v * v) / 1.6 / 1000, 2); out.ok = v <= vAllowed; out.margin = r2(vAllowed - v, 1); }
  return out;
}

export function beaufort(v) {
  const t = [0.5, 1.5, 3.3, 5.5, 7.9, 10.7, 13.8, 17.1, 20.7, 24.4, 28.4, 32.6];
  const i = t.findIndex((x) => v < x);
  return i < 0 ? 12 : i;
}

// ---- 6. pre-lift checklist ------------------------------------------------------------------
export const CHECKLIST = [
  ["Planning", [
    "Load weight confirmed (drawing, weighbridge or manufacturer) — not guessed",
    "Radius and boom length checked on the load chart for the exact configuration (counterweight, outrigger spread)",
    "Lift plan / method statement approved; critical lifts (> 75 % of chart) signed off",
    "Permit to work issued where required",
  ]],
  ["Crane", [
    "Daily inspection done; defects reported and cleared",
    "LMI / rated capacity limiter set for the actual configuration and tested",
    "Wire ropes, hook, safety latch and sheaves in good condition",
    "Crane level within the manufacturer's limit",
  ]],
  ["Ground and outriggers", [
    "Ground bearing capacity known; no services, voids or fresh backfill under the pads",
    "Outriggers fully extended as the chart requires, pins locked",
    "Mats of the right size and strength, centred under each pad",
  ]],
  ["Rigging", [
    "Slings, shackles and spreader rated for the load and angle; tags legible",
    "Sling angle within limits (not more than 60° from vertical)",
    "Sharp edges protected; load secured and balanced; tag lines fitted",
  ]],
  ["Area and people", [
    "Exclusion zone set up; nobody under the load or in the swing path",
    "Overhead power lines: minimum clearance kept (spotter if near)",
    "Banksman / signaller appointed and competent",
  ]],
  ["Weather and communication", [
    "Wind at boom-tip height below the limit for this load's size",
    "Visibility and light adequate",
    "Radio check done; signals agreed; stop signal understood by all",
  ]],
];

// ---- stored data: the fleet's charts and settings ------------------------------------------
export function loadCraneData() {
  try { const v = JSON.parse(localStorage.getItem(CRANE_KEY) || "null"); if (v && Array.isArray(v.cranes)) return v; } catch (e) {}
  return { cranes: [], limits: { ...DEFAULT_LIMITS }, checklist: {} };
}
export function saveCraneData(d) { try { localStorage.setItem(CRANE_KEY, JSON.stringify(d)); } catch (e) {} return d; }

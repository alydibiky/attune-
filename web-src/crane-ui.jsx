/* ---- More → Crane toolkit ----------------------------------------------------------
   Lift check against your own load charts, ground pressure under outriggers,
   sling tension, wind, and a pre-lift checklist. Pure arithmetic (crane.js),
   works with no model and no signal. The gross load from "Lift" carries over
   to the other tabs so the same lift is checked end to end.                  */
import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Trash2, Share2, Save, Info } from "lucide-react";
import { tr, fmtNum } from "./i18n.js";
import {
  num, parseChart, chartCapacity, liftCheck, outriggerPressure, slingTension, windCheck, windAtHeight, beaufort,
  GROUNDS, CHECKLIST, loadCraneData, saveCraneData, DEFAULT_LIMITS,
} from "./crane.js";

const TABS = [["lift", "Lift"], ["ground", "Ground"], ["slings", "Slings"], ["wind", "Wind"], ["check", "Checklist"], ["charts", "Charts"]];
const field = "w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500";
const n = (x, d = 2) => fmtNum(x, { maximumFractionDigits: d });

function Num({ label, value, set, unit, testid, hint }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-slate-400 mb-1">{tr(label)}{unit ? <span className="text-slate-600"> ({tr(unit)})</span> : null}</span>
      <input inputMode="decimal" dir="ltr" value={value} onChange={(e) => set(e.target.value)} className={field} data-testid={testid} />
      {hint ? <span className="block text-[10px] text-slate-600 mt-0.5">{tr(hint)}</span> : null}
    </label>
  );
}

function Verdict({ tone, children, testid }) {
  const c = tone === "ok" ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-200" : tone === "warn" ? "border-amber-700/60 bg-amber-500/10 text-amber-200"
    : tone === "bad" ? "border-rose-700/60 bg-rose-500/10 text-rose-200" : "border-slate-800 bg-slate-950 text-slate-300";
  const Icon = tone === "ok" ? CheckCircle2 : tone === "none" ? Info : AlertTriangle;
  return <div className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${c}`} data-testid={testid}><Icon size={16} className="mt-0.5 shrink-0" /><div className="min-w-0">{children}</div></div>;
}

export function CraneToolkit({ flash, share, remember }) {
  const [data, setDataRaw] = useState(loadCraneData);
  const setData = (d) => setDataRaw(saveCraneData(d));
  const [tab, setTab] = useState("lift");
  // the lift, shared by every tab
  const [craneId, setCraneId] = useState((data.cranes[0] || {}).id || "");
  const [radius, setRadius] = useState(""); const [boom, setBoom] = useState("");
  const [manualCap, setManualCap] = useState("");
  const [load, setLoad] = useState(""); const [hook, setHook] = useState(""); const [rig, setRig] = useState(""); const [other, setOther] = useState("");
  const crane = data.cranes.find((c) => c.id === craneId);
  const chartRes = crane ? chartCapacity(crane.chart, num(radius), num(boom)) : null;
  const capacity = crane ? (chartRes && chartRes.cap) : num(manualCap);
  const limits = data.limits || DEFAULT_LIMITS;
  const lift = liftCheck({ load, hook, rigging: rig, other, capacity, limits });
  const gross = lift.gross || (num(load) > 0 ? num(load) : "");

  return (
    <div className="mt-3 space-y-3" data-testid="crane-toolkit">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-[11px] text-slate-400 flex gap-2">
        <Info size={14} className="shrink-0 mt-0.5 text-slate-500" />
        <span>{tr("Planning aid only. The crane's own load chart and computer (LMI), the manufacturer's manuals and a competent lift planner always decide. Every rule here takes the cautious side.")}</span>
      </div>
      <div className="flex gap-1 overflow-x-auto att-tabs bg-slate-900 border border-slate-800 rounded-xl p-1">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} data-testid={"ctab-" + id}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm ${tab === id ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400"}`}>{tr(label)}</button>
        ))}
      </div>

      {tab === "lift" ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
          <label className="block">
            <span className="block text-[11px] text-slate-400 mb-1">{tr("Crane")}</span>
            <select value={craneId} onChange={(e) => setCraneId(e.target.value)} className={field} data-testid="lift-crane">
              {data.cranes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="">{tr("No chart — type the capacity")}</option>
            </select>
          </label>
          {crane ? (
            <div className="grid grid-cols-2 gap-2">
              <Num label="Radius" unit="m" value={radius} set={setRadius} testid="lift-radius" />
              <Num label="Boom length" unit="m" value={boom} set={setBoom} testid="lift-boom" />
            </div>
          ) : (
            <Num label="Chart capacity at this radius" unit="t" value={manualCap} set={setManualCap} testid="lift-cap" hint="From the crane's load chart for the exact configuration." />
          )}
          {crane && chartRes ? (
            <p className="text-[12px] text-slate-300" data-testid="lift-chart">
              {chartRes.cap != null ? <>{tr("Chart capacity")}: <b dir="ltr">{n(chartRes.cap)} t</b>{crane.config ? " · " + crane.config : ""}</> : <span className="text-amber-300">{tr(chartRes.why)}</span>}
              {chartRes.cap != null && chartRes.why ? <span className="block text-[11px] text-slate-500">{tr(chartRes.why)}</span> : null}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Num label="Load" unit="t" value={load} set={setLoad} testid="lift-load" />
            <Num label="Hook block" unit="t" value={hook} set={setHook} testid="lift-hook" />
            <Num label="Slings, shackles, spreader" unit="t" value={rig} set={setRig} testid="lift-rig" />
            <Num label="Anything else under the tip" unit="t" value={other} set={setOther} hint="e.g. jib stowed on the boom, if the chart says to add it" />
          </div>
          {lift.level === "missing" ? <Verdict tone="none">{tr(lift.why)}</Verdict> : (
            <Verdict tone={lift.level === "ok" ? "ok" : lift.level === "plan" ? "warn" : "bad"} testid="lift-verdict">
              <p className="font-semibold" dir="auto">{tr("{g} t of {c} t = {p}% of the chart", { g: n(lift.gross), c: n(capacity), p: n(lift.pct, 1) })}</p>
              <div className="h-2 rounded-full bg-slate-800 mt-2 overflow-hidden"><div className={`h-full ${lift.level === "ok" ? "bg-emerald-400" : lift.level === "plan" ? "bg-amber-400" : "bg-rose-500"}`} style={{ width: Math.min(100, lift.pct) + "%" }} /></div>
              <p className="mt-2 text-[13px]">{tr({ ok: "Within the chart with margin.", plan: "Critical lift: over {a}% — needs a written lift plan and sign-off.", stop: "Over {b}%: too close to the limit — replan (shorter radius, bigger crane, lighter rigging).", over: "OVER THE CHART — this lift is not allowed." }[lift.level], { a: limits.plan, b: limits.stop })}</p>
              {lift.spare > 0 ? <p className="text-[11px] opacity-80">{tr("Spare: {s} t", { s: n(lift.spare) })}</p> : null}
            </Verdict>
          )}
          <details className="text-[11px] text-slate-500">
            <summary>{tr("Company limits")}</summary>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Num label="Lift plan above" unit="%" value={String(limits.plan)} set={(v) => setData({ ...data, limits: { ...limits, plan: num(v) || DEFAULT_LIMITS.plan } })} />
              <Num label="Stop above" unit="%" value={String(limits.stop)} set={(v) => setData({ ...data, limits: { ...limits, stop: num(v) || DEFAULT_LIMITS.stop } })} />
            </div>
          </details>
        </div>
      ) : null}

      {tab === "ground" ? <GroundTab gross={gross} /> : null}
      {tab === "slings" ? <SlingTab gross={gross} /> : null}
      {tab === "wind" ? <WindTab gross={gross} /> : null}
      {tab === "check" ? <ChecklistTab data={data} setData={setData} share={share} remember={remember} flash={flash} lift={{ crane: crane && crane.name, radius, boom, gross, pct: lift.pct }} /> : null}
      {tab === "charts" ? <ChartsTab data={data} setData={setData} flash={flash} onPick={(id) => { setCraneId(id); setTab("lift"); }} /> : null}
    </div>
  );
}

function GroundTab({ gross }) {
  const [force, setForce] = useState(""); const [mass, setMass] = useState(""); const [cw, setCw] = useState(""); const [g, setG] = useState(String(gross || ""));
  const [L, setL] = useState("1.5"); const [W, setW] = useState("1.5");
  const [soil, setSoil] = useState("dense_gravel"); const [custom, setCustom] = useState("");
  const allowable = custom ? num(custom) : (GROUNDS.find((x) => x[0] === soil) || [])[2];
  const r = outriggerPressure({ force, craneMass: mass, counterweight: cw, gross: g, matL: L, matW: W, allowable });
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3" data-testid="ground-tab">
      <Num label="Heaviest outrigger force" unit="t" value={force} set={setForce} testid="g-force" hint="Best: from the manufacturer's outrigger calculator for this lift. Leave empty to estimate." />
      {!(num(force) > 0) ? (
        <div className="grid grid-cols-3 gap-2">
          <Num label="Crane mass" unit="t" value={mass} set={setMass} testid="g-mass" />
          <Num label="Counterweight" unit="t" value={cw} set={setCw} testid="g-cw" />
          <Num label="Gross load" unit="t" value={g} set={setG} testid="g-gross" />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Num label="Mat length" unit="m" value={L} set={setL} testid="g-L" />
        <Num label="Mat width" unit="m" value={W} set={setW} testid="g-W" />
      </div>
      <label className="block">
        <span className="block text-[11px] text-slate-400 mb-1">{tr("Ground")}</span>
        <select value={soil} onChange={(e) => { setSoil(e.target.value); setCustom(""); }} className={field} data-testid="g-soil">
          {GROUNDS.map(([k, label, q]) => <option key={k} value={k}>{tr(label)} · {q} kN/m²</option>)}
        </select>
      </label>
      <Num label="Or the allowable pressure from a site investigation" unit="kN/m²" value={custom} set={setCustom} testid="g-custom" hint="Typical values are the low end of published ranges — a geotechnical figure always wins." />
      {r.why ? <Verdict tone="none">{tr(r.why)}</Verdict> : (
        <Verdict tone={r.ok == null ? "none" : r.ok ? "ok" : "bad"} testid="g-verdict">
          <p>{tr("Outrigger force: {t} t = {k} kN", { t: n(r.forceT, 1), k: n(r.forceKN, 0) })}{r.estimated ? <span className="block text-[11px] opacity-80">{tr("Estimated as 75% of crane + counterweight + load on one corner — cautious; use the real figure when you have it.")}</span> : null}</p>
          {r.pressure != null ? <p className="font-semibold mt-1">{tr("Pressure on the ground: {p} kN/m² (allowed {q})", { p: n(r.pressure, 0), q: n(allowable, 0) })}</p> : null}
          {r.needArea ? <p className="text-[13px] mt-1">{tr("Mat needed: at least {a} m² — e.g. {s} × {s} m", { a: n(r.needArea), s: n(r.needSide) })}</p> : null}
          <p className="text-[11px] opacity-80 mt-1">{tr("The mat must be stiff enough to spread the load over its whole area (timber or steel mats of the right thickness).")}</p>
        </Verdict>
      )}
    </div>
  );
}

function SlingTab({ gross }) {
  const [w, setW] = useState(String(gross || "")); const [legs, setLegs] = useState(2); const [angle, setAngle] = useState(30); const [all, setAll] = useState(false);
  const r = slingTension({ load: w, legs, angle, allLegs: all });
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3" data-testid="sling-tab">
      <Num label="Load (with spreader, if any)" unit="t" value={w} set={setW} testid="s-load" />
      <div className="flex gap-1.5">{[1, 2, 3, 4].map((k) => (
        <button key={k} onClick={() => setLegs(k)} data-testid={"s-legs-" + k} className={`flex-1 py-2 rounded-lg border text-sm ${legs === k ? "border-teal-600 bg-teal-500/10 text-teal-200" : "border-slate-800 text-slate-400"}`}>{tr("{n} leg", { n: k })}</button>
      ))}</div>
      {legs > 1 ? (
        <label className="block">
          <span className="block text-[11px] text-slate-400 mb-1">{tr("Angle of each leg from vertical: {a}° (between legs: {b}°)", { a: angle, b: angle * 2 })}</span>
          <input type="range" min="0" max="75" step="5" value={angle} onChange={(e) => setAngle(+e.target.value)} className="w-full" data-testid="s-angle" />
        </label>
      ) : null}
      {legs >= 3 ? (
        <label className="flex items-center gap-2 text-[12px] text-slate-400"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />{tr("All legs share the load (engineered, balanced lift only)")}</label>
      ) : null}
      {r.why ? <Verdict tone="none">{tr(r.why)}</Verdict> : (
        <Verdict tone={r.level === "ok" ? "ok" : r.level === "caution" ? "warn" : "bad"} testid="s-verdict">
          <p className="font-semibold">{tr("Each leg carries {t} t", { t: n(r.perLeg) })}</p>
          {legs > 1 ? <p className="text-[13px]">{tr("Angle factor ×{f} · counted as {c} legs carrying", { f: n(r.factor, 3), c: r.carrying })}</p> : null}
          {legs >= 3 && !all ? <p className="text-[11px] opacity-80">{tr("3- and 4-leg slings are rated as if only 2 legs carry the load — they rarely share it evenly.")}</p> : null}
          {r.level === "caution" ? <p className="text-[12px] mt-1">{tr("Above 45° the tension rises fast — use longer slings or a spreader beam.")}</p> : null}
          {r.level === "stop" ? <p className="text-[12px] mt-1">{tr("More than 60° from vertical is not allowed — longer slings or a spreader beam.")}</p> : null}
          <p className="text-[11px] opacity-80 mt-1">{tr("Choose slings whose rated load (WLL) is at least this, for the way they are used (straight, choke, basket).")}</p>
        </Verdict>
      )}
    </div>
  );
}

function WindTab({ gross }) {
  const [vChart, setVChart] = useState("9.8"); const [vNow, setVNow] = useState(""); const [hMeas, setHMeas] = useState("10"); const [hTip, setHTip] = useState("");
  const [mass, setMass] = useState(String(gross || "")); const [area, setArea] = useState(""); const [cw, setCw] = useState("1.2");
  const vTip = num(hTip) > 0 && num(vNow) >= 0 ? windAtHeight(vNow, hMeas, Math.max(num(hTip), num(hMeas))) : num(vNow);
  const r = windCheck({ vChart, mass, area, cw, vNow: isFinite(vTip) ? vTip : "" });
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3" data-testid="wind-tab">
      <div className="grid grid-cols-2 gap-2">
        <Num label="Chart's wind limit" unit="m/s" value={vChart} set={setVChart} testid="w-vchart" hint="Printed on the load chart (often 9.8 m/s)." />
        <Num label="Wind now" unit="m/s" value={vNow} set={setVNow} testid="w-vnow" hint="3-second gust from the crane's anemometer or a meter." />
        <Num label="Measured at height" unit="m" value={hMeas} set={setHMeas} />
        <Num label="Boom tip height" unit="m" value={hTip} set={setHTip} testid="w-htip" hint="Wind is stronger higher up." />
        <Num label="Load mass" unit="t" value={mass} set={setMass} testid="w-mass" />
        <Num label="Load's largest face" unit="m²" value={area} set={setArea} testid="w-area" />
      </div>
      <label className="block">
        <span className="block text-[11px] text-slate-400 mb-1">{tr("Load shape (drag coefficient)")}</span>
        <select value={cw} onChange={(e) => setCw(e.target.value)} className={field}>
          <option value="0.8">{tr("Round (pipe, tank) · 0.8")}</option>
          <option value="1.2">{tr("Box or panel · 1.2 (usual)")}</option>
          <option value="1.6">{tr("Open steel / complex shape · 1.6")}</option>
        </select>
      </label>
      {isFinite(vTip) && num(hTip) > num(hMeas) ? <p className="text-[12px] text-slate-300">{tr("Wind at the boom tip: about {v} m/s (Beaufort {b})", { v: n(vTip, 1), b: beaufort(vTip) })}</p> : null}
      {r.why ? <Verdict tone="none">{tr(r.why)}</Verdict> : (
        <Verdict tone={r.ok == null ? (r.reduced ? "warn" : "none") : r.ok ? "ok" : "bad"} testid="w-verdict">
          <p className="font-semibold">{tr("Highest wind for this lift: {v} m/s", { v: n(r.vAllowed, 1) })}</p>
          <p className="text-[13px]">{r.reduced ? tr("Reduced from the chart's {c} m/s: this load catches {p} m² of wind per tonne (charts assume 1.2).", { c: n(num(vChart), 1), p: n(r.perTonne) }) : tr("The chart's limit applies — the load is compact enough.")}</p>
          {r.ok != null ? <p className="text-[13px] mt-1">{r.ok ? tr("Now: OK, {m} m/s in hand.", { m: n(r.margin, 1) }) : tr("Now: TOO WINDY for this load — wait, or lift a smaller face into the wind.")} {tr("Wind force on the load ≈ {f} kN.", { f: n(r.forceKN) })}</p> : null}
        </Verdict>
      )}
    </div>
  );
}

function ChecklistTab({ data, setData, share, remember, flash, lift }) {
  const state = data.checklist || {};
  const all = CHECKLIST.flatMap(([, items]) => items);
  const done = all.filter((i) => state[i]).length;
  const toggle = (i) => setData({ ...data, checklist: { ...state, [i]: !state[i] } });
  const text = () => [tr("Pre-lift checklist") + " · " + new Date().toLocaleString(),
    lift.crane ? tr("Crane") + ": " + lift.crane + (lift.radius ? ` · R ${lift.radius} m` : "") + (lift.boom ? ` · L ${lift.boom} m` : "") : "",
    lift.gross ? tr("Gross load") + `: ${lift.gross} t` + (lift.pct ? ` (${lift.pct}%)` : "") : "",
    ...CHECKLIST.flatMap(([g, items]) => ["", tr(g) + ":", ...items.map((i) => (state[i] ? "☑ " : "☐ ") + tr(i))]),
  ].filter((x) => x !== "").join("\n");
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3" data-testid="check-tab">
      <div className="flex items-center justify-between"><span className="text-sm text-slate-200">{tr("{d} of {t} checked", { d: done, t: all.length })}</span>
        <button onClick={() => setData({ ...data, checklist: {} })} className="text-[12px] text-slate-500">{tr("Start again")}</button></div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-teal-400" style={{ width: (done / all.length) * 100 + "%" }} /></div>
      {CHECKLIST.map(([g, items]) => (
        <div key={g}>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{tr(g)}</p>
          {items.map((i) => (
            <label key={i} className="flex items-start gap-2 py-1 text-[13px] text-slate-200">
              <input type="checkbox" checked={!!state[i]} onChange={() => toggle(i)} className="mt-1" data-testid="chk" />
              <span className={state[i] ? "text-slate-500 line-through" : ""}>{tr(i)}</span>
            </label>
          ))}
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => share(text())} className="flex-1 flex items-center justify-center gap-1.5 border border-slate-700 rounded-xl py-2 text-sm text-slate-200" data-testid="chk-share"><Share2 size={15} />{tr("Share")}</button>
        <button onClick={() => { remember({ kind: "note", title: tr("Pre-lift checklist") + (lift.crane ? " · " + lift.crane : ""), text: text(), output: "", tags: ["crane", "checklist"] }); flash(tr("Saved to Memory")); }}
          className="flex-1 flex items-center justify-center gap-1.5 bg-teal-500 text-slate-950 font-semibold rounded-xl py-2 text-sm"><Save size={15} />{tr("Save to Memory")}</button>
      </div>
    </div>
  );
}

function ChartsTab({ data, setData, flash, onPick }) {
  const [name, setName] = useState(""); const [config, setConfig] = useState(""); const [text, setText] = useState("");
  const parsed = text.trim() ? parseChart(text) : null;
  const add = () => {
    if (!name.trim()) return flash(tr("Give the crane a name"));
    if (!parsed || !parsed.radii.length || !parsed.booms.length) return flash(tr("Paste the load chart first"));
    const c = { id: "c" + Date.now().toString(36), name: name.trim(), config: config.trim(), chart: { booms: parsed.booms, radii: parsed.radii, cap: parsed.cap }, added: Date.now() };
    setData({ ...data, cranes: [...data.cranes, c] });
    setName(""); setConfig(""); setText(""); flash(tr("Chart saved"));
  };
  return (
    <div className="space-y-3" data-testid="charts-tab">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-2">
        <p className="text-sm text-slate-200">{tr("Your cranes' load charts")}</p>
        {data.cranes.length === 0 ? <p className="text-[12px] text-slate-500">{tr("None yet. Add each crane's chart once — copy it from the manufacturer's table (PDF or the crane's manual).")}</p> : null}
        {data.cranes.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2" data-testid="crane-item">
            <button onClick={() => onPick(c.id)} className="flex-1 min-w-0 text-start">
              <span className="block text-sm text-slate-100 truncate" dir="auto">{c.name}</span>
              <span className="block text-[11px] text-slate-500 truncate">{c.config ? c.config + " · " : ""}{tr("{r} radii × {b} boom lengths", { r: c.chart.radii.length, b: c.chart.booms.length })}</span>
            </button>
            <button onClick={() => setData({ ...data, cranes: data.cranes.filter((x) => x.id !== c.id) })} className="p-2 text-slate-500" aria-label={tr("Delete")}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{tr("Add a chart")}</p>
        <input dir="auto" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Crane, e.g. Liebherr LTM 1100-4.2 · unit 3")} className={field} data-testid="ch-name" />
        <input dir="auto" value={config} onChange={(e) => setConfig(e.target.value)} placeholder={tr("Configuration, e.g. 22 t counterweight · outriggers 7.0 × 7.0 m · 360°")} className={field} data-testid="ch-config" />
        <textarea dir="ltr" value={text} onChange={(e) => setText(e.target.value)} rows={6} data-testid="ch-text"
          placeholder={"m\t12\t20\t30\n3\t60\t45\t-\n5\t42\t38\t30\n10\t20\t19\t17"} className={field + " font-mono text-[12px] resize-none"} />
        <p className="text-[11px] text-slate-500">{tr("First row: boom lengths (m). Each next row: radius (m), then the capacity (t) for each boom length. “-” where the chart has no value. One chart per configuration.")}</p>
        {parsed ? (
          <div className="rounded-lg border border-slate-800 p-2 overflow-x-auto" data-testid="ch-preview">
            {parsed.problems.map((p) => <p key={p} className="text-[11px] text-amber-300">{tr(p)}</p>)}
            <table className="text-[11px] text-slate-300" dir="ltr"><tbody>
              <tr><td className="pe-2 text-slate-500">R \ L</td>{parsed.booms.map((b, i) => <td key={i} className="px-1.5 text-teal-300">{b}</td>)}</tr>
              {parsed.radii.map((r, i) => <tr key={i}><td className="pe-2 text-teal-300">{r}</td>{parsed.cap[i].map((v, j) => <td key={j} className="px-1.5">{v == null ? "–" : v}</td>)}</tr>)}
            </tbody></table>
          </div>
        ) : null}
        <button onClick={add} className="w-full flex items-center justify-center gap-1.5 bg-teal-500 text-slate-950 font-semibold rounded-xl py-2.5 text-sm" data-testid="ch-add"><Plus size={16} />{tr("Save chart")}</button>
        <p className="text-[11px] text-slate-600">{tr("Check the preview against the printed chart before relying on it. Charts are kept on this phone and in your backups.")}</p>
      </div>
    </div>
  );
}

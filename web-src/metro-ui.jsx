/* ---- v6.42 (Ali, 19 Oct: "put [the metro] in the tab next to maps"): Cairo Metro, its own tab in Daily after Maps. From / To
   (English, Arabic, Franco, squares), the route by code from metro.js (which line, which direction, stops, where to change,
   minutes, ticket), and the three lines to browse — tap a station to use it. Offline; nothing leaves the phone. */
import React, { useState, useMemo } from "react";
import { tr, getLang } from "./i18n.js";
import { LINES, FARES, findStation, route } from "./metro.js";
import { TrainFront, ArrowUpDown, X } from "lucide-react";

const card = "rounded-[22px] border border-[var(--c-ln)] bg-[var(--c-surf)]";
const KEY = "attune:metro:last";
const lineOf = (id) => LINES.find((l) => l.id === id);

export function MetroPage() {
  const ar = getLang() === "ar";
  const [ft, setFt] = useState(() => { try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return { from: v.from || "", to: v.to || "" }; } catch (e) { return { from: "", to: "" }; } });
  const [show, setShow] = useState(null);       // a line id open in the list
  const [pick, setPick] = useState("from");     // which box a tapped station fills
  const set = (v) => { setFt(v); try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  const A = useMemo(() => findStation(ft.from), [ft.from]), B = useMemo(() => findStation(ft.to), [ft.to]);
  const r = useMemo(() => (A && B ? route(A, B) : null), [A, B]);
  const nm = (en) => { if (!ar) return en; for (const l of LINES) for (const s of l.stations) if (s[0] === en) return s[1]; return en; };
  const names = useMemo(() => { const m = new Set(); for (const l of LINES) for (const s of l.stations) m.add(ar ? s[1] : s[0]); return [...m]; }, [ar]);
  const box = (k, label) => {
    const st = k === "from" ? A : B, v = ft[k];
    return (
      <div className="space-y-0.5">
        <div className={`flex items-center gap-2 bg-[var(--c-bg)] border rounded-xl px-3 ${pick === k ? "border-[var(--c-acc)]" : "border-[var(--c-ln)]"}`}>
          <span className="text-[11px] text-[var(--c-mut)] w-10 shrink-0">{label}</span>
          <input value={v} list="metro-stations" dir="auto" data-testid={"metro-" + k} onFocus={() => setPick(k)} onChange={(e) => set({ ...ft, [k]: e.target.value })}
            placeholder={k === "from" ? tr("e.g. Maadi, التحرير, Ramses") : tr("e.g. Attaba, Cairo University")} className="flex-1 bg-transparent py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-mut)] focus:outline-none" />
          {v ? <button onClick={() => set({ ...ft, [k]: "" })} className="text-[var(--c-mut)]" aria-label={tr("Clear")}><X size={15} /></button> : null}
        </div>
        {v && !st ? <p className="text-[11px] text-[var(--c-warn)] ps-1">{tr("No station by that name — pick one from the list below")}</p>
          : st && v.trim() !== st.en && v.trim() !== st.ar ? <p className="text-[11px] text-[var(--c-mut)] ps-1">→ {ar ? st.ar : st.en}</p> : null}
      </div>
    );
  };

  return (
    <div className="space-y-3" data-testid="metro-page">
      <div className={card + " p-3 space-y-2"}>
        <p className="text-[var(--c-ink)] font-medium flex items-center gap-2"><TrainFront size={18} className="text-[var(--c-acc)]" />{tr("Cairo Metro")}</p>
        <datalist id="metro-stations">{names.map((n) => <option key={n} value={n} />)}</datalist>
        {box("from", tr("From"))}
        <div className="flex justify-center -my-1">
          <button onClick={() => set({ from: ft.to, to: ft.from })} data-testid="metro-swap" aria-label={tr("Swap")} className="p-1.5 rounded-full border border-[var(--c-ln)] text-[var(--c-ink)]"><ArrowUpDown size={14} /></button>
        </div>
        {box("to", tr("To"))}
      </div>

      {r ? (
        <div className={card + " p-3 space-y-2.5"} data-testid="metro-route">
          {!r.legs.length ? <p className="text-sm text-[var(--c-ink)]">{tr("You're already there")}</p> : (
            <>
              <div className="flex gap-2 text-center">
                <div className="flex-1 rounded-xl bg-[var(--c-bg)] py-2"><p className="text-lg text-[var(--c-ink)] font-semibold">{r.minutes}</p><p className="text-[10px] text-[var(--c-mut)]">{tr("min (about)")}</p></div>
                <div className="flex-1 rounded-xl bg-[var(--c-bg)] py-2"><p className="text-lg text-[var(--c-ink)] font-semibold">{r.stops}</p><p className="text-[10px] text-[var(--c-mut)]">{tr("stops")}</p></div>
                <div className="flex-1 rounded-xl bg-[var(--c-bg)] py-2"><p className="text-lg text-[var(--c-ink)] font-semibold" data-testid="metro-fare">{r.fare}</p><p className="text-[10px] text-[var(--c-mut)]">{tr("EGP ticket")}</p></div>
              </div>
              <ol className="space-y-2">
                {r.legs.map((l, i) => {
                  const L = lineOf(l.line);
                  return (
                    <li key={i} className="flex gap-2.5" data-testid="metro-leg">
                      <span className="w-1.5 rounded-full shrink-0" style={{ background: L.color }} />
                      <div className="text-sm text-[var(--c-ink)] space-y-0.5">
                        {i ? <p className="text-[11px] text-[var(--c-warn)]">{tr("Change at {s}", { s: nm(l.from) })}</p> : null}
                        <p><b style={{ color: L.color }}>{ar ? L.ar : L.name}</b> · {tr("toward {s}", { s: nm(l.toward) })}</p>
                        <p className="text-[12px] text-[var(--c-mut)]">{nm(l.from)} → {nm(l.to)} · {l.stops === 1 ? tr("1 stop") : tr("{n} stops", { n: l.stops })}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="text-[10px] text-[var(--c-mut)]">{tr("Ride the train whose sign shows the “toward” station. Fares as of {d} — check at the window; they change.", { d: FARES.asOf })}</p>
            </>
          )}
        </div>
      ) : null}

      <div className={card + " p-3 space-y-2"}>
        <p className="text-[11px] text-[var(--c-mut)]">{tr("The lines — tap a station to put it in “{b}”", { b: pick === "from" ? tr("From") : tr("To") })}</p>
        <div className="flex gap-1.5">
          {LINES.filter((l, i, a) => a.findIndex((x) => x.id === l.id) === i).map((l) => (
            <button key={l.id} onClick={() => setShow(show === l.id ? null : l.id)} data-testid={"metro-line-" + l.id}
              className={`text-[12px] px-3 py-1 rounded-full border ${show === l.id ? "text-[var(--c-ink)]" : "text-[var(--c-ink)] border-[var(--c-ln)]"}`} style={show === l.id ? { background: l.color, borderColor: l.color } : null}>{ar ? l.ar : l.name}</button>
          ))}
        </div>
        {show ? (
          <div className="flex flex-wrap gap-1.5">
            {[...new Map(LINES.filter((l) => l.id === show).flatMap((l) => l.stations).map((s) => [s[0], s])).values()].map((s) => (
              <button key={s[0]} onClick={() => { const v = { ...ft, [pick]: ar ? s[1] : s[0] }; set(v); if (pick === "from" && !v.to) setPick("to"); }} data-testid="metro-station"
                className="text-[12px] px-2 py-1 rounded-lg bg-[var(--c-bg)] border border-[var(--c-ln)] text-[var(--c-ink)]">{ar ? s[1] : s[0]}</button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---- v6.32: "Plan my day" around the prayers — on the Reminders page (prayer.js does the work, by code) ---------------------- */
import React, { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { CITIES, zoneOffset } from "./fitplus.js";
import { prayerTimes, methodFor, parseTasks, planDay } from "./prayer.js";
import { card, btnP, btnS, inp, area } from "./ui-kit.jsx";

const KEY = "attune:prayer:v1";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch (e) { return {}; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
const NAMES = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha", jumuah: "Jumu'ah", iftar: "Iftar", taraweeh: "Taraweeh" };
/** Today is in Ramadan (the Umm al-Qura calendar on the phone). */
export function isRamadan(d = new Date()) { try { return +new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric" }).format(d) === 9; } catch (e) { return false; } }
function defaultCity() {
  let z = ""; try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  return Object.keys(CITIES).find((k) => CITIES[k].tz === z) || "cairo";
}

export function PrayerPlanner({ onSchedule, flash }) {
  const [st, setSt] = useState(() => ({ city: defaultCity(), asr: 1, ...load() }));
  const [text, setText] = useState("");
  const [res, setRes] = useState(null);
  const put = (p) => { const v = { ...st, ...p }; setSt(v); save(v); setRes(null); };
  const c = CITIES[st.city] || CITIES.cairo, now = new Date();
  const times = prayerTimes(now, c.lat, c.lon, zoneOffset(now, c.tz), { method: methodFor(c.tz), asr: st.asr });
  const ramadan = isRamadan(now), friday = now.getDay() === 5;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const plan = () => {
    const tasks = parseTasks(text); if (!tasks.length) { flash && flash(tr("Write what you want to do, e.g. “study 2 hours, gym 1h, call mum 15 min”")); return; }
    setRes(planDay(tasks, times, { start: Math.max(8 * 60, nowMin), end: 23 * 60, friday, ramadan }));
  };
  const addAll = () => {
    const day = new Date(); day.setSeconds(0, 0); let n = 0;
    for (const p of res.plan) { const at = new Date(day); at.setHours(Math.floor(p.from / 60), p.from % 60, 0, 0); if (at.getTime() > Date.now()) { onSchedule({ id: "plan-" + at.getTime().toString(36) + n, at: at.getTime(), title: p.title, body: "", repeat: "none", created: Date.now(), source: "planner" }); n++; } }
    flash && flash(n ? tr("{n} reminders set", { n }) : tr("Nothing left to remind today"));
  };
  const field = inp;
  const ar = getLang() === "ar";
  return (
    <div className={"calm " + card + " p-4 space-y-3"} data-testid="prayer-planner">
      <div className="flex items-center gap-2">
        <p className="m-0 text-[15px] font-extrabold flex items-center gap-2 flex-1 min-w-0 whitespace-nowrap"><CalendarDays size={16} className="text-[var(--c-acc)] shrink-0" />{tr("Plan my day")}{ramadan ? " · " + tr("Ramadan") : ""}</p>
        <select value={st.city} onChange={(e) => put({ city: e.target.value })} className={field + " !w-auto shrink-0 max-w-[48%] !min-h-[40px] !h-10 text-[13px]"} aria-label={tr("City")} data-testid="prayer-city">
          {Object.entries(CITIES).map(([k, v]) => <option key={k} value={k}>{ar ? v.ar : v.en}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-5 gap-1 text-center" data-testid="prayer-times">
        {["fajr", "dhuhr", "asr", "maghrib", "isha"].map((k) => (
          <div key={k} className={"rounded-[12px] py-1.5 " + (times[k] != null && times[k] > nowMin && !["fajr", "dhuhr", "asr", "maghrib", "isha"].some((j) => times[j] > nowMin && times[j] < times[k]) ? "bg-[var(--c-soft)] text-[var(--c-acc)] border border-[var(--c-acc)]/40" : "bg-[var(--c-bg)] text-[var(--c-mut)] border border-[var(--c-ln)]")}>
            <div className="text-[10.5px] opacity-80">{tr(friday && k === "dhuhr" ? "Jumu'ah" : NAMES[k])}</div><div className="text-[13px] font-extrabold tabular-nums" dir="ltr">{times[k + "At"]}</div></div>))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} dir="auto" data-testid="prayer-tasks" className={area + " resize-none"}
        placeholder={tr("What do you want to do today? “study 2 hours, gym 1h, call mum 15 min”")} />
      <div className="flex gap-2 items-center">
        <button onClick={plan} disabled={!text.trim()} className={btnP} data-testid="prayer-plan">{tr("Plan it around the prayers")}</button>
        <label className="min-h-[44px] text-[12px] text-[var(--c-mut)] flex items-center gap-1.5"><input type="checkbox" checked={st.asr === 2} onChange={(e) => put({ asr: e.target.checked ? 2 : 1 })} />{tr("Hanafi Asr")}</label>
      </div>
      {res ? (
        <div className="space-y-1.5" data-testid="prayer-result">
          {[...res.plan.map((p) => ({ ...p, task: true })), ...res.blocks.filter((b) => b.to > Math.max(8 * 60, nowMin)).map((b) => ({ ...b, title: tr(NAMES[b.name]) }))].sort((a, b) => a.from - b.from).map((x, i) => (
            <div key={i} className={"flex items-center gap-2 rounded-[12px] px-3 py-2 text-[13px] " + (x.task ? "bg-[var(--c-surf-2)] text-[var(--c-ink)] font-semibold" : "text-[var(--c-mut)]")} data-testid={x.task ? "plan-task" : "plan-prayer"}>
              <span className="w-24 shrink-0 text-[12px] tabular-nums" dir="ltr">{x.fromAt}–{x.toAt}</span><span className="flex-1 truncate" dir="auto">{x.title}</span>
              {x.moved ? <span className="text-[11px] font-bold text-[var(--c-warn)]">{tr("moved after the prayer")}</span> : null}</div>))}
          {res.left.length ? <p className="m-0 text-[12.5px] text-[var(--c-warn)]">{tr("Didn't fit today: {t}", { t: res.left.map((x) => x.title).join(", ") })}</p> : null}
          {res.plan.length ? <button onClick={addAll} className={btnS + " w-full"} data-testid="prayer-remind"><Plus size={15} />{tr("Remind me of each one")}</button> : null}
        </div>) : null}
    </div>);
}

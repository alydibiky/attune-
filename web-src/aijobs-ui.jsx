/* ---- v9.9.25 B8 AU4 scheduled AI jobs screens (Ali picked A: Automations → Jobs + the result on Home in the morning). Logic: jobs.js.
   The runner: due jobs run when the model is ready (the night run while charging needs the phone part — until then a job whose time
   passed runs when the app is next open); every answer is checked against the person's data — a number that isn't in it is flagged. */
import React, { useEffect, useState } from "react";
import { tr, getLang, dateLocale } from "./i18n.js";
import { makeJob, nextRun, dueJobs, checkNumbers, jobData } from "./aijobs.js";
import { loadStores } from "./lifeask.js";
import { btnP, btnS, inp, label } from "./ui-kit.jsx";
const KEY = "attune:aijobs:v1";   // (attune:jobs:v1 belongs to the "/" command queue)
export const loadJobs = () => { try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); return j && Array.isArray(j.jobs) ? { results: [], ...j } : { jobs: [], results: [] }; } catch (e) { return { jobs: [], results: [] }; } };
const saveJobs = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} try { window.dispatchEvent(new CustomEvent("attune-aijobs")); } catch (e) {} return s; };
const when = (t) => { try { return new Date(t).toLocaleString(dateLocale() || "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
export function JobsSection({ flash }) {
  const [s, setS] = useState(loadJobs), [text, setText] = useState(""), [err, setErr] = useState("");
  useEffect(() => { const f = () => setS(loadJobs()); window.addEventListener("attune-aijobs", f); return () => window.removeEventListener("attune-aijobs", f); }, []);
  const add = () => { const j = makeJob(text); if (!j) { setErr(tr("When should it run? e.g. “every Sunday 9 pm”, “on the 25th”, “every day at 7”")); return; }
    setS(saveJobs({ ...s, jobs: [...s.jobs, j] })); setText(""); setErr(""); flash && flash(tr("Job saved — next: {t}", { t: when(j.next) })); };
  return <div className="space-y-2" data-testid="jobs">
    <p className={label + " m-0"}>{tr("Jobs")} · {s.jobs.length}</p>
    <div className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} dir="auto" placeholder={tr("e.g. every Sunday 9 pm plan my week")} className={inp} data-testid="jobs-text" />
      <button className={btnP} disabled={!text.trim()} onClick={add} data-testid="jobs-add">{tr("Add")}</button></div>
    {err ? <p className="m-0 text-[12.5px] c-warn" data-testid="jobs-err">{err}</p> : null}
    {s.jobs.map((j) => <div key={j.id} className="flex items-center gap-2 min-h-[48px] border-t border-[var(--c-ln)] first:border-t-0" data-testid="jobs-row">
      <span className="flex-1 min-w-0"><b className="block text-[14px] truncate" dir="auto">{j.text}</b><span className="text-[12px] c-sub">{tr("next {t}", { t: when(j.next) })}</span></span>
      <button className="text-[12px] font-bold c-sub min-h-[40px] px-2" onClick={() => setS(saveJobs({ ...s, jobs: s.jobs.filter((x) => x.id !== j.id) }))} data-testid="jobs-delete">{tr("Delete")}</button></div>)}
    <p className="m-0 text-[12px] c-sub">{tr("Each job runs at its time with the AI on this phone; the answer waits on Home. Any number that isn't in your own data is marked.")}</p>
  </div>;
}
/** Runs the due jobs once the model is ready (in App). ask(messages) → text */
export function JobsRunner({ ask, ready }) {
  useEffect(() => { if (!ready || !ask) return; let stop = false;
    (async () => { const s = loadJobs(), due = dueJobs(s.jobs); if (!due.length) return;
      for (const j of due) { if (stop) return;
        const data = jobData(loadStores()), lang = getLang();
        let out = ""; try { out = String(await ask([{ role: "system", content: "You are Attune. Do the person's job using ONLY the facts below — never invent a number, a name or a date. Answer in the language code \"" + lang + "\", short, as a few lines.\n\nFacts:\n" + (data || "(none)") }, { role: "user", content: j.text }]) || "").trim(); } catch (e) { return; }
        const chk = checkNumbers(out, data, j.text), cur = loadJobs();
        saveJobs({ ...cur, jobs: cur.jobs.map((x) => (x.id === j.id ? { ...x, next: nextRun(x.schedule, Date.now()), last: Date.now() } : x)), results: [{ id: j.id + "-" + Date.now(), job: j.id, title: j.text, at: Date.now(), text: out, unknown: chk.unknown }, ...cur.results].slice(0, 30) }); }
    })(); return () => { stop = true; }; }, [ready]);
  return null;
}
/** Home: what was made since yesterday evening. */
export function JobsHomeCard({ open }) {
  const [s, setS] = useState(loadJobs);
  useEffect(() => { const f = () => setS(loadJobs()); window.addEventListener("attune-aijobs", f); return () => window.removeEventListener("attune-aijobs", f); }, []);
  const fresh = s.results.filter((r) => r.at > Date.now() - 18 * 36e5 && !r.seen); if (!fresh.length) return null;
  const r = fresh[0];
  return <div className="rounded-[16px] p-3 space-y-1" style={{ background: "var(--c-soft)" }} data-testid="jobs-home">
    <p className={label + " m-0"}>{tr("Made for you · {t}", { t: when(r.at) })}</p>
    <b className="block text-[14.5px]" dir="auto">{r.title}</b>
    <p className="m-0 text-[13.5px] whitespace-pre-line" dir="auto" data-testid="jobs-home-text">{r.text}</p>
    {r.unknown && r.unknown.length ? <p className="m-0 text-[12px] font-bold c-warn" data-testid="jobs-home-flag">{tr("Check: {n} isn't in your data", { n: r.unknown.map((x) => (+x).toLocaleString("en-US")).join(", ") })}</p> : null}
    <button className={btnS + " h-9! min-h-[36px]!"} onClick={() => { setS(saveJobs({ ...s, results: s.results.map((x) => (x.id === r.id ? { ...x, seen: true } : x)) })); }} data-testid="jobs-home-ok">{tr("OK")}</button>
  </div>;
}

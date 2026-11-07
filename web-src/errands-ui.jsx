/* ---- v9.8 N3 Errands (Ali: "do N3 … best way possible … without any mistakes"): one box to add in your words, "Needs you" with
   the papers to bring, Open the official page (Attune's browser — your details filled; it reads what is due once you are through
   the login / code), Done · paid / renewed. The logic is errands.js (tested). Lives in Follow-ups (amber area). */
import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Check, Trash2, ChevronDown, Loader2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as E from "./errands.js";
import * as U from "./ui-kit.jsx";

const T = (k, v) => tr(k, v);
const when = (t) => { try { return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } };
const WHY = { due: "Due now", late: "Late", expires: "Coming up", check: "Time to check" };

export function ErrandsPage({ nativeCall, flash, profile = {} }) {
  const ar = getLang() === "ar";
  const [list, setListRaw] = useState(E.loadErrands);
  const [text, setText] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(""), [open, setOpen] = useState(""), [newDate, setNewDate] = useState("");
  useEffect(() => { const f = () => setListRaw(E.loadErrands()); window.addEventListener("attune:errands", f); return () => window.removeEventListener("attune:errands", f); }, []);
  const put = (l) => setListRaw(E.saveErrands(l));
  const due = useMemo(() => E.dueList(list), [list]);
  const add = () => { const p = E.parseErrand(text); if (!p) { setErr(tr("Say what it is and its date — “car licence expires 3 Feb 2027, plate أ ب ج 1234”")); return; }
    if (!p.date && !p.every) { setErr(tr("When is it due? Add the date — “… expires 3 Feb 2027”")); return; }
    put([...list, E.makeErrand(p)]); setText(""); setErr(""); flash && flash(tr("Errand saved — Attune tells you before it is due")); };
  // the official page, in Attune's browser: details filled; what it says is read once you are through (nothing is paid)
  const openPage = async (e) => {
    if (!nativeCall) { try { window.open(e.url || E.DIGITAL_EGYPT, "_blank"); } catch (x) {} return; }
    setBusy(e.id);
    try { const r = await nativeCall("agentOpen", { url: e.url || E.DIGITAL_EGYPT, title: E.nameOf(e, ar, tr), profile, rules: {}, search: false, slot: true });
      const read = r && r.slot ? E.readPortal(r.slot) : null;
      put(E.loadErrands().map((x) => (x.id === e.id ? E.afterCheck(x, read) : x)));
      flash && flash(read ? (read.none ? tr("Nothing due — checked") : T("Due: {a}", { a: read.amount.toLocaleString("en-US") })) : tr("I couldn't read an amount on that page — mark it yourself if something is due"));
    } catch (x) {} finally { setBusy(""); }
  };
  const done = (e) => { put(list.map((x) => (x.id === e.id ? E.markDone(x, { newDate: e.every ? "" : newDate }) : x))); setOpen(""); setNewDate(""); flash && flash(tr("Done")); };
  const remove = (e) => put(list.filter((x) => x.id !== e.id));
  const papers = (e) => ar ? (((E.KINDS[e.kind] || E.KINDS.other).papers || {}).ar || []) : (((E.KINDS[e.kind] || E.KINDS.other).papers || {}).en || []).map((x) => tr(x));
  return (
    <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="errands-page">
      <U.Head title={tr("Errands")} sub={tr("Licences, fines, bills, IDs, inspections — added once. Attune tells you before each is due, with the papers to bring.")} />
      <form onSubmit={(ev) => { ev.preventDefault(); add(); }} className={U.card + " p-2 flex gap-2"} data-testid="errands-box">
        <input value={text} onChange={(ev) => setText(ev.target.value)} dir="auto" placeholder={tr("e.g. car licence expires 3 Feb 2027, plate أ ب ج 1234")} className="flex-1 min-w-0 bg-transparent px-2.5 text-[15px] focus:outline-none" data-testid="errands-input" />
        <button type="submit" disabled={!text.trim()} className="min-h-[44px] px-4 rounded-[12px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] font-extrabold text-[13.5px] disabled:opacity-40" data-testid="errands-add">{tr("Add")}</button>
      </form>
      {err ? <p className="m-0 text-[12.5px] text-[var(--c-warn)]" data-testid="errands-err">{err}</p> : null}
      {due.length ? <section className={U.card + " p-3.5 space-y-1"} style={{ borderColor: "color-mix(in srgb, var(--c-neg) 40%, var(--c-ln))" }} data-testid="errands-due">
        <p className="m-0 text-[12px] font-extrabold tracking-[0.06em] uppercase" style={{ color: "var(--c-neg)" }}>{T("Needs you · {n}", { n: due.length })}</p>
        {due.map(({ e, why, date, days, amount }) => <div key={e.id} className="py-2 border-t first:border-t-0 border-[var(--c-ln)] space-y-2" data-testid="errand-due">
          <button onClick={() => setOpen(open === e.id ? "" : e.id)} className="w-full flex items-center gap-2 text-start" aria-expanded={open === e.id}>
            <span className="flex-1 min-w-0"><b className="block text-[14px] truncate" dir="auto">{E.nameOf(e, ar, tr)}</b>
              <span className={"block text-[12px] " + (why === "late" || why === "due" ? "c-neg" : "c-sub")}>{tr(WHY[why])} · {amount ? T("{a} to pay", { a: amount.toLocaleString("en-US") }) : why === "check" ? when(date) : days < 0 ? T("{n} days late", { n: -days }) : T("in {n} days · {d}", { n: days, d: when(date) })}</span></span>
            <ChevronDown size={16} className={"c-sub shrink-0 transition " + (open === e.id ? "rotate-180" : "")} /></button>
          {open === e.id ? <div className="space-y-2" data-testid="errand-open">
            {papers(e).length ? <div><p className="m-0 text-[11.5px] font-extrabold c-sub uppercase tracking-[0.05em]">{tr("Bring")}</p>
              <ul className="m-0 ps-5 text-[13px] space-y-0.5" data-testid="errand-papers">{papers(e).map((p) => <li key={p} dir="auto">{p}</li>)}</ul></div> : null}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openPage(e)} disabled={busy === e.id} className="min-h-[40px] px-3.5 rounded-[12px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[13px] font-extrabold inline-flex items-center gap-1.5" data-testid="errand-page">
                {busy === e.id ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}{tr("Open the official page")}</button>
              {!e.every ? <input type="date" value={newDate} onChange={(ev) => setNewDate(ev.target.value)} aria-label={tr("New expiry date")} className="min-h-[40px] rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-2 text-[13px]" data-testid="errand-newdate" /> : null}
              <button onClick={() => done(e)} disabled={!e.every && !newDate} className="min-h-[40px] px-3.5 rounded-[12px] border border-[var(--c-ln)] text-[13px] font-extrabold inline-flex items-center gap-1.5 disabled:opacity-40" data-testid="errand-done"><Check size={14} />{e.every ? tr("Paid") : tr("Renewed")}</button>
            </div>
            <p className="m-0 text-[11.5px] c-sub">{tr("The page may ask for your ID or a code first — Attune never pays; you press Pay.")}</p>
          </div> : null}
        </div>)}
      </section> : <p className={U.card + " p-3.5 m-0 text-[13.5px] c-sub"} data-testid="errands-nothing">{list.length ? tr("Nothing due — Attune tells you before anything is.") : tr("Add your car licence, driving licence, passport, meters or a crane's inspection — once.")}</p>}
      {list.length ? <section className={U.card + " p-3.5"} data-testid="errands-all">
        <p className="m-0 mb-1 text-[12px] font-extrabold tracking-[0.06em] uppercase c-sub">{T("All errands · {n}", { n: list.length })}</p>
        {list.map((e) => <div key={e.id} className="flex items-center gap-2 py-2 border-t first:border-t-0 border-[var(--c-ln)]" data-testid="errand-row">
          <span className="flex-1 min-w-0"><b className="block text-[13.5px] truncate" dir="auto">{E.nameOf(e, ar, tr)}</b>
            <span className="block text-[11.5px] c-sub">{e.every ? T("every {n} month(s)", { n: e.every }) + (e.last ? " · " + (e.last.none ? tr("nothing due") : T("{a} due", { a: (e.last.amount || 0).toLocaleString("en-US") })) : "") : e.date ? T("until {d}", { d: when(Date.parse(e.date + "T12:00:00")) }) : ""}</span></span>
          <button onClick={() => remove(e)} aria-label={tr("Delete")} className="w-9 h-9 grid place-items-center c-sub" data-testid="errand-remove"><Trash2 size={14} /></button></div>)}
      </section> : null}
    </div>);
}

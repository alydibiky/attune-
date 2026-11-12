/* ---- v9.9.24 B6 X6 Kids & school (Ali picked A+B combined — the child's page + "found in the class group" to tick, everything editable;
   OK'd 12 Nov). Family health → Family → a child → School: "Found in the class group" (messages Recall kept from the group whose name
   you set, or one you paste) — each found thing ticked when sure, an unclear one (which Thursday? no day? how much?) unticked with its
   question in yellow and its fields to fill; "Add N" saves the ticked ones to the child's school list + a reminder on the day; the week
   under it, every item editable or deletable. Reader: schoolmsg.js. */
import React, { useMemo, useState } from "react";
import { tr, dateLocale } from "./i18n.js";
import { readClassMessage } from "./schoolmsg.js";
import { newReminderId } from "./actions.js";
import { btnP, btnS, inp, label } from "./ui-kit.jsx";
const KIND = { exam: "Exam", fee: "Fee", trip: "Trip", bring: "Bring", holiday: "Holiday", meeting: "Meeting" };
const ASK = { which: "Which day — this one or next week?", day: "When?", amount: "How much?" };
const day = (s) => { try { return s ? new Date(s + "T12:00:00").toLocaleDateString(dateLocale() || "en-GB", { weekday: "short", day: "numeric", month: "short" }) : ""; } catch (e) { return s; } };
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
function kept() { try { const N = window.AttuneNative; return N && N.recallNotes ? JSON.parse(N.recallNotes() || "[]") : []; } catch (e) { return []; } }
export function SchoolPanel({ member, save, close, flash }) {
  const sch = member.school || { group: "", items: [], seen: [] };
  const [group, setGroup] = useState(sch.group || ""), [paste, setPaste] = useState(""), [found, setFound] = useState(null), [ed, setEd] = useState(null);
  const put = (s) => save({ ...member, school: { ...sch, ...s } });
  const msgs = useMemo(() => (group.trim() ? kept().filter((n) => String(n.title || "").toLowerCase().includes(group.trim().toLowerCase()) && !(sch.seen || []).includes(String(n.id || n.ts))) : []), [group, sch.seen]);
  const read = (texts, ids) => { const out = []; for (const t of texts) for (const x of readClassMessage(t)) out.push({ ...x, on: !x.ask }); setFound({ items: out, ids }); };
  const add = () => { const on = found.items.filter((x) => x.on), list = [...(sch.items || [])];
    for (const x of on) { const it = { id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: x.kind, title: x.title, date: x.date, amount: x.amount };
      if (!list.some((y) => y.kind === it.kind && y.date === it.date && y.title === it.title)) { list.push(it);
        if (it.date && window.__attuneAddReminder) window.__attuneAddReminder({ id: newReminderId(), at: Date.parse(it.date + "T07:00:00"), title: member.name + " · " + tr(KIND[it.kind]) + (it.amount ? " · " + it.amount : ""), body: it.title, repeat: "none", created: Date.now(), source: "school", done: false }); } }
    put({ group, items: list, seen: [...new Set([...(sch.seen || []), ...(found.ids || [])])].slice(-300) }); setFound(null); setPaste("");
    flash && flash(on.length === 1 ? tr("Added 1 — with a reminder on its day") : tr("Added {n} — each with a reminder on its day", { n: on.length })); };
  const week = (sch.items || []).filter((x) => !x.date || (x.date >= iso(Date.now()) && x.date <= iso(Date.now() + 14 * 864e5))).sort((a, b) => String(a.date || "9").localeCompare(String(b.date || "9")));
  return <div className="space-y-2" data-testid="school">
    <div className="flex items-center gap-2"><button className={btnS} onClick={close} aria-label={tr("Back")} data-testid="school-back">‹</button><b className="text-[16px] flex-1">{member.name} · {tr("School")}</b></div>
    <div className="rounded-[16px] p-3 space-y-2" style={{ background: "var(--c-soft)" }}>
      <p className={label + " m-0"}>{tr("Class group")}</p>
      <input value={group} onChange={(e) => setGroup(e.target.value)} onBlur={() => group !== sch.group && put({ group })} placeholder={tr("Its name in WhatsApp, e.g. Grade 5 B parents")} className={inp} dir="auto" data-testid="school-group" />
      {msgs.length ? <button className={btnP} onClick={() => read(msgs.map((n) => n.text || ""), msgs.map((n) => String(n.id || n.ts)))} data-testid="school-read-kept">{tr("Read {n} new messages from the group", { n: msgs.length })}</button> : null}
      <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} dir="auto" placeholder={tr("…or paste a message from the class group")} className={inp + " !h-auto py-2"} data-testid="school-paste" />
      <button className={btnS} disabled={!paste.trim()} onClick={() => read([paste], [])} data-testid="school-read">{tr("Find what's in it")}</button>
    </div>
    {found ? <div className="rounded-[16px] p-3 space-y-1.5" style={{ background: "var(--c-amber, #FBF0DC)" }} data-testid="school-found">
      <p className={label + " m-0"}>{found.items.length === 1 ? tr("Found 1 thing") : tr("Found {n} things", { n: found.items.length })}</p>
      {found.items.map((x, i) => <div key={i} className="flex items-start gap-2" data-testid="school-found-item" data-kind={x.kind} data-ask={x.ask || ""}>
        <input type="checkbox" checked={x.on} onChange={() => setFound({ ...found, items: found.items.map((y, k) => (k === i ? { ...y, on: !y.on } : y)) })} className="w-6 h-6 mt-1 accent-[var(--c-acc)] shrink-0" data-testid="school-tick" />
        <div className="flex-1 min-w-0 space-y-1"><b className="block text-[13.5px]" dir="auto">{tr(KIND[x.kind])} · {x.title}</b>
          {x.ask ? <p className="m-0 text-[12.5px] font-bold c-warn" data-testid="school-ask">{tr(ASK[x.ask])}</p> : null}
          <div className="flex gap-2"><input type="date" value={x.date || ""} onChange={(e) => setFound({ ...found, items: found.items.map((y, k) => (k === i ? { ...y, date: e.target.value, ask: y.ask === "amount" ? "amount" : null, on: true } : y)) })} className={inp + " h-10! min-h-[40px]!"} data-testid="school-date" />
            {x.kind === "fee" ? <input inputMode="decimal" value={x.amount == null ? "" : x.amount} onChange={(e) => setFound({ ...found, items: found.items.map((y, k) => (k === i ? { ...y, amount: e.target.value === "" ? null : +e.target.value, ask: y.ask === "amount" ? null : y.ask, on: true } : y)) })} placeholder={tr("Amount")} className={inp + " w-28! h-10! min-h-[40px]!"} data-testid="school-amount" /> : null}</div></div></div>)}
      <div className="flex gap-2 pt-1"><button className={btnP} disabled={!found.items.some((x) => x.on)} onClick={add} data-testid="school-add">{tr("Add {n}", { n: found.items.filter((x) => x.on).length })}</button><button className={btnS} onClick={() => setFound(null)}>{tr("Cancel")}</button></div>
    </div> : null}
    <div className="rounded-[16px] border p-3" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }} data-testid="school-week">
      <p className={label + " m-0 mb-1"}>{tr("The next two weeks")}</p>
      {week.map((x) => ed && ed.id === x.id ? <div key={x.id} className="space-y-1.5 py-1.5" data-testid="school-edit">
          <input value={ed.title} onChange={(e) => setEd({ ...ed, title: e.target.value })} className={inp} dir="auto" data-testid="school-edit-title" />
          <div className="flex gap-2"><input type="date" value={ed.date || ""} onChange={(e) => setEd({ ...ed, date: e.target.value })} className={inp} data-testid="school-edit-date" />
            {x.kind === "fee" ? <input inputMode="decimal" value={ed.amount == null ? "" : ed.amount} onChange={(e) => setEd({ ...ed, amount: e.target.value === "" ? null : +e.target.value })} className={inp + " w-28!"} /> : null}</div>
          <div className="flex gap-2"><button className={btnP} onClick={() => { put({ items: sch.items.map((y) => (y.id === x.id ? ed : y)) }); setEd(null); }} data-testid="school-edit-save">{tr("Save")}</button>
            <button className={btnS} onClick={() => { put({ items: sch.items.filter((y) => y.id !== x.id) }); setEd(null); }} data-testid="school-delete">{tr("Delete")}</button></div></div>
        : <button key={x.id} onClick={() => setEd({ ...x })} className="w-full text-start flex items-center gap-2 min-h-[44px] border-t border-[var(--c-ln)] first:border-t-0" data-testid="school-item">
          <span className="flex-1 min-w-0"><b className="block truncate text-[13.5px]" dir="auto">{tr(KIND[x.kind])} · {x.title}</b><span className="text-[12px] c-sub">{[day(x.date), x.amount ? x.amount.toLocaleString("en-US") : ""].filter(Boolean).join(" · ")}</span></span>
          <span className="text-[12px] font-bold c-acc">{tr("Edit")}</span></button>)}
      {!week.length ? <p className="m-0 text-[13px] c-sub">{tr("Nothing in the next two weeks.")}</p> : null}
    </div>
  </div>;
}

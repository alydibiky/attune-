/* ---- v9.9.21 T1 Brain dump screen (Ali picked A + "not voice only"; combined screen OK'd 12 Nov — "Organise this"). Write, paste or say a
   paragraph in the Home box → "Organise this" → the things found, each with its type, day, time and amount, ticked; tap one to fix it;
   "Save N" saves only the ticked ones, each where it belongs: a to-do / note in Mind, a reminder (on the phone too), a shopping list,
   a payment to remember on its day, money already spent into Money. Reader: braindump.js (10,000 paragraphs, 20 languages + Franco). */
import React, { useEffect, useState } from "react";
import { tr, dateLocale } from "./i18n.js";
import { organise } from "./braindump.js";
import { newReminderId } from "./actions.js";
import * as LISTS from "./lists.js";
import { loadLedger } from "./myledger.js";
import { appendToLedger } from "./paylog.js";
import { btnP, btnS, inp, chip, label } from "./ui-kit.jsx";
const TYPES = [["todo", "To-do"], ["reminder", "Reminder"], ["list", "Shopping list"], ["payment", "Payment"], ["spent", "Spent"], ["note", "Note"]];
const typeName = (k) => tr((TYPES.find((x) => x[0] === k) || [k, k])[1]);
const wd = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return d; } };
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
/** Worth offering "Organise this" in the box: 2+ things in what was written. */
export const worthOrganising = (text) => { try { return String(text || "").trim().length >= 12 && organise(text).length >= 2; } catch (e) { return false; } };
/** Save one item where it belongs. → true when saved. */
export function saveItem(it, now = Date.now()) {
  const W = typeof window !== "undefined" ? window : {};
  const at = (date, time) => { const d = date || iso(now); const t = time || "10:00"; let ms = Date.parse(d + "T" + t + ":00"); if (!date && ms < now) ms += 864e5; return ms; };
  if (it.type === "todo") return W.__attuneAddTodo ? W.__attuneAddTodo(it.text + (it.date ? " · " + wd(it.date) : "") + (it.amount != null ? " · " + it.amount.toLocaleString() : "")) : false;
  if (it.type === "note") return W.__attuneAddNote ? W.__attuneAddNote(it.text) : false;
  if (it.type === "reminder" || it.type === "payment") {
    const title = it.type === "payment" ? it.text + (it.amount != null ? " · " + it.amount.toLocaleString() : "") : it.text;
    const r = { id: newReminderId(), at: at(it.date, it.time), title, body: "", repeat: "none", created: now, source: "braindump", done: false };
    return W.__attuneAddReminder ? W.__attuneAddReminder(r) : false;
  }
  if (it.type === "list") {
    const st = LISTS.loadLists(), name = tr("Shopping"), res = LISTS.applyListCommand(st, { op: "add", name, items: it.items.length ? it.items : [it.text] }, now);
    if (!res) return false; LISTS.saveLists(res.st); return true;
  }
  if (it.type === "spent") {
    const led = loadLedger(); if (!led || !(it.amount > 0)) return false;
    const r = appendToLedger(led, [{ type: "expense", amount: it.amount, note: it.text, date: it.date || iso(now), cat: "" }], now);
    if (!r.ids.length) return false; try { localStorage.setItem("ledger.v3", JSON.stringify(r.ledger)); } catch (e) {} return true;
  }
  return false;
}
export function BrainDumpHost({ flash }) {
  const [text, setText] = useState(null);
  useEffect(() => { const f = (e) => setText((e && e.detail && e.detail.text) || ""); window.addEventListener("attune-braindump", f); return () => window.removeEventListener("attune-braindump", f); }, []);
  return text != null ? <BrainDump text={text} close={() => setText(null)} flash={flash} /> : null;
}
function BrainDump({ text: text0, close, flash }) {
  const [text, setText] = useState(text0), [items, setItems] = useState(() => organise(text0).map((x) => ({ ...x, on: true }))), [fix, setFix] = useState(-1);
  const n = items.filter((x) => x.on).length;
  const save = () => { let ok = 0, bad = 0; for (const it of items.filter((x) => x.on)) { if (saveItem(it)) ok++; else bad++; }
    flash && flash(bad ? tr("Saved {n} — {b} couldn't be saved (open Money once first for spending)", { n: ok, b: bad }) : ok === 1 ? tr("Saved 1 thing") : tr("Saved {n} things", { n: ok })); close(); };
  const line = (x) => [x.type === "list" ? x.items.join(", ") : "", x.date ? wd(x.date) : "", x.time || "", x.amount != null ? x.amount.toLocaleString() : ""].filter(Boolean).join(" · ");
  return <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--c-bg)", color: "var(--c-ink)" }} data-testid="braindump">
    <div className="max-w-2xl mx-auto p-4 pb-16 space-y-3">
      <div className="flex items-center gap-2"><button onClick={close} className={btnS} aria-label={tr("Back")} data-testid="braindump-back">‹</button><h2 className="text-[20px] font-black m-0 flex-1">{tr("Organise this")}</h2></div>
      <div className="rounded-[16px] p-3" style={{ background: "var(--c-soft)" }}>
        <p className={label + " m-0"}>{tr("You wrote")}</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} dir="auto" rows={3} className={inp + " !h-auto py-2 mt-1"} data-testid="braindump-text" />
        <button onClick={() => setItems(organise(text).map((x) => ({ ...x, on: true })))} className={btnS + " mt-2"} data-testid="braindump-again">{tr("Organise again")}</button>
      </div>
      <p className={label + " m-0"} data-testid="braindump-count">{items.length === 1 ? tr("I found 1 thing") : tr("I found {n} things", { n: items.length })}</p>
      <div className="rounded-[20px] border divide-y" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }}>
        {items.map((x, i) => <div key={i} className="flex items-start gap-3 p-3" data-testid="braindump-item" data-type={x.type}>
          <input type="checkbox" checked={x.on} onChange={() => setItems(items.map((y, k) => (k === i ? { ...y, on: !y.on } : y)))} className="w-6 h-6 mt-0.5 accent-[var(--c-acc)] shrink-0" aria-label={x.text} data-testid="braindump-tick" />
          <button onClick={() => setFix(i)} className="flex-1 min-w-0 text-start" data-testid="braindump-open">
            <b className="block text-[14px] leading-snug" dir="auto">{x.type === "list" ? tr("Shopping") : x.text}</b>
            <span className="flex flex-wrap items-center gap-1.5 mt-1"><span className="text-[11px] font-extrabold rounded-full px-2 py-0.5" style={{ background: "var(--c-soft)", color: "var(--c-acc)" }} data-testid="braindump-tag">{typeName(x.type)}</span>
              <span className="text-[12.5px] c-sub" dir="auto">{line(x)}</span></span></button>
        </div>)}
        {!items.length ? <p className="m-0 p-3 text-[13.5px] c-sub">{tr("Nothing to organise yet — write a few things, one after the other.")}</p> : null}
      </div>
      <div className="flex gap-2"><button onClick={save} disabled={!n} className={btnP + " flex-1"} data-testid="braindump-save">{n === 1 ? tr("Save 1") : tr("Save {n}", { n })}</button>
        <button onClick={close} className={btnS}>{tr("Cancel")}</button></div>
      <p className="m-0 text-[12px] c-sub">{tr("Nothing is saved until you tap Save. Tap a line to fix it.")}</p>
    </div>
    {fix >= 0 && items[fix] ? <FixSheet it={items[fix]} close={() => setFix(-1)} save={(y) => { setItems(items.map((z, k) => (k === fix ? { ...y, on: true } : z))); setFix(-1); }} /> : null}
  </div>;
}
function FixSheet({ it, close, save }) {
  const [y, setY] = useState({ ...it, itemsText: (it.items || []).join(", ") });
  return <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(0,0,0,.35)" }} onClick={close}>
    <div className="w-full max-w-[520px] rounded-t-[24px] p-5 space-y-3" style={{ background: "var(--c-surf)", color: "var(--c-ink)" }} onClick={(e) => e.stopPropagation()} data-testid="braindump-fix">
      <div className="flex flex-wrap gap-1.5">{TYPES.map(([k, l]) => <button key={k} onClick={() => setY({ ...y, type: k })} aria-pressed={y.type === k} className={chip(y.type === k)} data-testid={"braindump-type-" + k}>{tr(l)}</button>)}</div>
      {y.type === "list" ? <input dir="auto" value={y.itemsText} onChange={(e) => setY({ ...y, itemsText: e.target.value })} className={inp} placeholder={tr("milk, bread, eggs")} data-testid="braindump-fix-items" />
        : <input dir="auto" value={y.text} onChange={(e) => setY({ ...y, text: e.target.value })} className={inp} data-testid="braindump-fix-text" />}
      <div className="flex gap-2"><input type="date" value={y.date || ""} onChange={(e) => setY({ ...y, date: e.target.value || null })} className={inp} data-testid="braindump-fix-date" />
        {y.type === "reminder" || y.type === "payment" ? <input type="time" value={y.time || ""} onChange={(e) => setY({ ...y, time: e.target.value || null })} className={inp} data-testid="braindump-fix-time" /> : null}</div>
      {y.type === "payment" || y.type === "spent" || y.type === "todo" ? <input type="number" inputMode="decimal" value={y.amount == null ? "" : y.amount} onChange={(e) => setY({ ...y, amount: e.target.value === "" ? null : +e.target.value })} placeholder={tr("Amount")} className={inp} data-testid="braindump-fix-amount" /> : null}
      <button onClick={() => save({ ...y, items: y.type === "list" ? y.itemsText.split(/\s*[,،、]\s*/).map((s) => s.trim()).filter(Boolean) : [], text: y.type === "list" ? y.itemsText : y.text })} className={btnP + " w-full"} data-testid="braindump-fix-save">{tr("Done")}</button>
      <button onClick={close} className="w-full h-10 c-sub text-[13px] font-bold">{tr("Cancel")}</button>
    </div></div>;
}

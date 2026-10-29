/* ---- v8.0 (Ali, 25 Oct 2026: "Money redirects me to the old app — I don't want that at all"): every Money screen is Attune's own
   now. These sheets and pages add / change / delete accounts, bills, goals, debts, Zakāt payments and settings, transactions and
   the ledger's settings — and hand each change to Yusr (hidden underneath, the engine) through the bridge's "do" message, which
   fills Yusr's OWN form and presses Yusr's OWN Save: balances, debts moving money and the Zakāt engine stay exactly Yusr's.
   Zakāt: the person records what they paid and changes the calculation's inputs; what is due is still Yusr's alone.
   run(op, args) → Promise<{ok, error}> (attune.jsx wires it to bridge.doIt and its "done" answer). */
import React, { useMemo, useState } from "react";
import { X, Plus, Trash2, Check, Search, ChevronRight, ChevronUp, ChevronDown, Download, Upload, RefreshCw } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { fmt } from "./money-calm.js";
import { sheetCats } from "./money-pages.js";
import { isoDay } from "./money-report.js";
import * as U from "./ui-kit.jsx";
import { REGION_CUR } from "./locale.js";
import * as ZC from "./zakatcalc.js";

const ar = () => getLang() === "ar";
const amt = (n, cur) => fmt(n) + (cur ? " " + cur : "");
const dayLabel = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(ar() ? "ar-EG-u-nu-latn" : undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return iso; } };
const pill = (on) => "min-h-[40px] px-3.5 rounded-full border text-[13px] font-bold whitespace-nowrap transition-colors duration-150 " + (on ? "bg-[var(--c-soft)] text-[var(--c-acc)] border-[var(--c-acc)]" : "bg-[var(--c-bg)] border-[var(--c-ln)] text-[var(--c-ink)]");
const cashAccounts = (L) => ((L && L.accounts) || []).filter((a) => !["gold", "silver", "camels", "cattle", "sheep"].includes(a.kind));
const accName = (L, id) => { const a = ((L && L.accounts) || []).find((x) => x.id === id); return a ? (a.emoji || "") + " " + a.name : ""; };
export const ASNAF = [["fuqara", "The poor", "الفقراء"], ["masakin", "The needy", "المساكين"], ["amilin", "Zakāt workers", "العاملين عليها"], ["muallafah", "Hearts to be reconciled", "المؤلفة قلوبهم"],
  ["riqab", "Freeing captives", "في الرقاب"], ["gharimin", "People in debt", "الغارمين"], ["sabilillah", "In the way of Allah", "في سبيل الله"], ["ibnsabil", "The stranded traveller", "ابن السبيل"]];

/** The frame every sheet uses: a bottom sheet on a phone, a window on a computer. */
export function Sheet({ title, onClose, children, testid, danger }) {
  return <div className="calm fixed inset-0 z-[85] bg-black/55 flex flex-col justify-end lg:items-center lg:justify-center" onClick={onClose} data-testid={testid}>
    <div onClick={(e) => e.stopPropagation()} className="bg-[var(--c-surf)] text-[var(--c-ink)] rounded-t-[20px] lg:rounded-[20px] w-full lg:max-w-lg max-h-[92vh] overflow-y-auto p-4 pb-6 space-y-3.5 shadow-[0_-8px_30px_rgba(0,0,0,0.3)]" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-2"><p className="flex-1 text-[18px] font-black m-0">{title}</p>{danger}
        <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 rounded-full grid place-items-center c-sub" data-testid="sheet-close"><X size={18} /></button></div>
      {children}
    </div></div>;
}
const Field = ({ label, children }) => <label className="block"><span className={U.label + " block mb-1.5"}>{label}</span>{children}</label>;
const Pills = ({ items, value, onChange, testid }) => <div className="flex flex-wrap gap-1.5" data-testid={testid}>{items.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)} className={pill(value === v)} data-testid={testid ? testid + "-" + v : undefined}>{l}</button>)}</div>;
function useSave(run, onClose) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const go = async (op, args, okMsg) => {
    setBusy(true); setErr("");
    let r = { ok: false }; try { r = await run(op, args); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    setBusy(false);
    if (r && r.ok) { onClose(okMsg); return true; }
    setErr(r && r.error === "edit-elsewhere" ? tr("This entry belongs to a debt, a goal or Zakāt — change it there.") : tr("Nothing was changed — check the amount and the name."));
    return false;
  };
  return { busy, err, go };
}
const SaveBtn = ({ busy, onClick, label, testid = "sheet-save" }) => <button onClick={onClick} disabled={busy} className={U.btnP + " w-full"} data-testid={testid}><Check size={17} />{label || tr("Save")}</button>;
const Err = ({ err }) => (err ? <p className="m-0 text-[13px] font-bold text-[var(--c-neg)]" data-testid="sheet-err">{err}</p> : null);
const Del = ({ onClick, testid = "sheet-delete" }) => <button onClick={onClick} className="w-10 h-10 rounded-full grid place-items-center text-[var(--c-neg)]" aria-label={tr("Delete")} data-testid={testid}><Trash2 size={17} /></button>;
const confirmDel = (what) => { try { return window.confirm(tr("Delete {w}?", { w: what })); } catch (e) { return true; } };

// ---- an account --------------------------------------------------------------------------------------------------------------------
const EMOJI_ACC = ["💵", "🏦", "💳", "👛", "📱", "🪙", "🥈", "💼", "🏠", "🐪"];
export function AccountSheet({ L, id, run, onClose }) {
  const a = id ? (L.accounts || []).find((x) => x.id === id) : null;
  const [kind, setKind] = useState(a ? a.kind || "cash" : "cash");
  const [name, setName] = useState(a ? a.name : "");
  const [emoji, setEmoji] = useState(a ? a.emoji || "💵" : "💵");
  const [currency, setCur] = useState(a ? a.currency || L.currency : L.currency || "EGP");
  const [start, setStart] = useState(a ? String(a.start || 0) : "");
  const [karat, setKarat] = useState(a ? String(a.karat || 24) : "24");
  const s = useSave(run, onClose);
  const save = () => s.go("acct-save", { id: id || undefined, kind, name: name.trim(), emoji, currency, start: parseFloat(start) || 0, karat: parseInt(karat) || 24 }, tr("Saved"));
  return <Sheet title={a ? tr("Edit account") : tr("New account")} onClose={() => onClose()} testid="money-account-sheet"
    danger={a && (L.accounts || []).length > 1 ? <Del onClick={() => confirmDel(a.name) && s.go("acct-delete", { id }, tr("Deleted"))} /> : null}>
    {!a ? <Field label={tr("Kind")}><Pills value={kind} onChange={setKind} testid="acc-kind" items={[["cash", tr("Money")], ["gold", tr("Gold")], ["silver", tr("Silver")], ["camels", tr("Camels")], ["cattle", tr("Cattle")], ["sheep", tr("Sheep & goats")]]} /></Field> : null}
    <Field label={tr("Name")}><input value={name} onChange={(e) => setName(e.target.value)} dir="auto" className={U.inp} placeholder={tr("e.g. CIB, Cash, Vodafone Cash")} data-testid="acc-name" /></Field>
    <div className="flex flex-wrap gap-1.5">{EMOJI_ACC.map((e) => <button key={e} type="button" onClick={() => setEmoji(e)} className={"w-11 h-11 rounded-[12px] text-[20px] border " + (emoji === e ? "border-[var(--c-acc)] bg-[var(--c-soft)]" : "border-[var(--c-ln)]")}>{e}</button>)}</div>
    {kind === "cash" ? <Field label={tr("Currency")}><input value={currency} onChange={(e) => setCur(e.target.value.toUpperCase().slice(0, 3))} className={U.inp + " uppercase"} dir="ltr" data-testid="acc-currency" /></Field> : null}
    {kind === "gold" ? <Field label={tr("Karat")}><Pills value={karat} onChange={setKarat} items={[["24", "24"], ["21", "21"], ["18", "18"]]} /></Field> : null}
    <Field label={["camels", "cattle", "sheep"].includes(kind) ? tr("How many head") : ["gold", "silver"].includes(kind) ? tr("Grams you have") : tr("Starting balance")}>
      <input value={start} onChange={(e) => setStart(e.target.value)} inputMode="decimal" dir="ltr" className={U.inp} placeholder="0" data-testid="acc-start" /></Field>
    <Err err={s.err} /><SaveBtn busy={s.busy} onClick={save} />
  </Sheet>;
}

// ---- a bill (repeats by itself) -------------------------------------------------------------------------------------------------------
export function BillSheet({ L, id, run, onClose }) {
  const r = id ? (L.recurring || []).find((x) => x.id === id) : null;
  const accs = (L.accounts || []);
  const [type, setType] = useState(r ? r.type : "expense");
  const [amount, setAmount] = useState(r ? String(r.amount) : "");
  const [cat, setCat] = useState(r ? r.cat : "bills");
  const [account, setAccount] = useState(r ? r.account : (accs[0] || {}).id);
  const [freq, setFreq] = useState(r ? r.freq : "monthly");
  const [next, setNext] = useState(r ? r.nextDate : isoDay(Date.now()));
  const [note, setNote] = useState(r ? String(r.note || "").replace(" ↻", "") : "");
  const cats = useMemo(() => sheetCats(L, type, ar()), [L, type]);
  const s = useSave(run, onClose);
  const save = () => s.go("rec-save", { id: id || undefined, type, amount: parseFloat(amount), cat, account, freq, nextDate: next, note: note.trim() }, tr("Saved"));
  return <Sheet title={r ? tr("Edit bill") : tr("New bill")} onClose={() => onClose()} testid="money-bill-sheet" danger={r ? <Del onClick={() => confirmDel(r.note || tr("this bill")) && s.go("rec-delete", { id }, tr("Deleted"))} /> : null}>
    <Pills value={type} onChange={(t) => { setType(t); setCat(t === "income" ? "salary" : "bills"); }} items={[["expense", tr("A bill I pay")], ["income", tr("Money I receive")]]} testid="bill-type" />
    <Field label={tr("What is it?")}><input value={note} onChange={(e) => setNote(e.target.value)} dir="auto" className={U.inp} placeholder={tr("e.g. Rent, Internet, School fees")} data-testid="bill-note" /></Field>
    <Field label={tr("Amount")}><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" className={U.inp} placeholder="0" data-testid="bill-amount" /></Field>
    <Field label={tr("How often")}><Pills value={freq} onChange={setFreq} items={[["daily", tr("Every day")], ["weekly", tr("Every week")], ["monthly", tr("Every month")], ["yearly", tr("Every year")]]} testid="bill-freq" /></Field>
    <Field label={tr("Next time")}><input type="date" value={next} onChange={(e) => setNext(e.target.value)} className={U.inp} dir="ltr" data-testid="bill-next" /></Field>
    <Field label={tr("Account")}><Pills value={account} onChange={setAccount} items={accs.map((a) => [a.id, (a.emoji || "") + " " + a.name])} testid="bill-account" /></Field>
    <Field label={tr("Category")}><div className="flex flex-wrap gap-1.5">{cats.map((c) => <button key={c.id} type="button" onClick={() => setCat(c.id)} className={pill(cat === c.id)}><span className="me-1">{c.emoji}</span>{c.name}</button>)}</div></Field>
    <Err err={s.err} /><SaveBtn busy={s.busy} onClick={save} />
  </Sheet>;
}

// ---- a transaction: change it, see its message, delete it -------------------------------------------------------------------------------
export function TxSheet({ L, id, run, onClose }) {
  const t = (L.txns || []).find((x) => x.id === id) || {};
  const editable = ["expense", "income", "transfer"].includes(t.type);
  const [amount, setAmount] = useState(String(t.amount || ""));
  const [cat, setCat] = useState(t.cat || "other");
  const [account, setAccount] = useState(t.account);
  const [date, setDate] = useState(t.date || isoDay(Date.now()));
  const [note, setNote] = useState(t.note || "");
  const cats = useMemo(() => sheetCats(L, t.type === "income" ? "income" : "expense", ar()), [L, t.type]);
  const s = useSave(run, onClose);
  const ev = t.evidence;
  const title = t.type === "income" ? tr("Income") : t.type === "transfer" ? tr("Transfer") : t.type === "zakat" ? tr("Zakāt") : t.type === "debt" ? tr("Debt") : tr("Expense");
  return <Sheet title={title} onClose={() => onClose()} testid="money-tx-sheet" danger={editable ? <Del onClick={() => confirmDel(t.note || title) && s.go("tx-delete", { id }, tr("Deleted"))} testid="tx-delete" /> : null}>
    {editable ? <>
      <div className="flex items-baseline gap-2 border-b-2 border-[var(--c-acc)] pb-1"><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" className="flex-1 min-w-0 bg-transparent font-black tabular-nums focus:outline-none" style={{ fontSize: 30 }} data-testid="tx-amount" />
        <span className="text-[15px] font-bold c-sub">{(((L.accounts || []).find((a) => a.id === account)) || {}).currency || ""}</span></div>
      {t.type !== "transfer" ? <Field label={tr("Category")}><div className="flex flex-wrap gap-1.5">{cats.map((c) => <button key={c.id} type="button" onClick={() => setCat(c.id)} className={pill(cat === c.id)}><span className="me-1">{c.emoji}</span>{c.name}</button>)}</div></Field> : null}
      <Field label={t.type === "transfer" ? tr("From") : tr("Account")}><Pills value={account} onChange={setAccount} items={cashAccounts(L).map((a) => [a.id, (a.emoji || "") + " " + a.name])} /></Field>
      <div className="grid grid-cols-[auto_1fr] gap-2"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={U.inp + " !w-auto"} dir="ltr" data-testid="tx-date" />
        {t.type !== "transfer" ? <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Note (optional)")} className={U.inp} dir="auto" data-testid="tx-note" /> : <span />}</div>
    </> : <p className="m-0 text-[15px]" dir="auto"><b className="tabular-nums" dir="ltr">{amt(t.amount, (L.currency || ""))}</b> · {dayLabel(t.date)}{t.person ? " · " + t.person : ""}{t.to ? " · " + t.to : ""}<br /><span className="text-[13px] c-sub">{tr("This entry belongs to a debt, a goal or Zakāt — change it there.")}</span></p>}
    {ev && ev.text ? <div className="rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-3" data-testid="tx-evidence">
      <p className="m-0 text-[11.5px] font-extrabold c-sub">{tr("The message as it arrived")}{ev.from ? " · " + ev.from : ""}{ev.app ? " · " + ev.app : ""}</p>
      <p className="m-0 mt-1 text-[14px] leading-snug whitespace-pre-wrap select-text" dir="auto">{ev.text}</p></div> : null}
    <Err err={s.err} />
    {editable ? <SaveBtn busy={s.busy} onClick={() => s.go("tx-edit", { id, amount: parseFloat(amount), cat, account, date, note: note.trim() }, tr("Saved"))} /> : null}
  </Sheet>;
}

// ---- every entry: search, by month, tap to change -------------------------------------------------------------------------------
export function TxListPane({ L, cats, onOpen, account, back, Head }) {
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const months = useMemo(() => [...new Set((L.txns || []).map((t) => String(t.date || "").slice(0, 7)).filter(Boolean))].sort().reverse().slice(0, 18), [L]);
  const rows = useMemo(() => {
    const f = q.trim().toLowerCase();
    return (L.txns || []).filter((t) => (!month || String(t.date).startsWith(month)) && (!account || t.account === account || t.toAccount === account)
      && (!f || [t.note, t.person, t.to, (cats[t.cat] || {}).name, accName(L, t.account), String(t.amount)].join(" ").toLowerCase().includes(f)))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.created || 0) - (a.created || 0)).slice(0, 300);
  }, [L, q, month, account, cats]);
  const sign = (t) => (t.type === "income" || (t.type === "debt" && (t.flow === "borrow" || t.flow === "collect")) ? "+" : t.type === "transfer" ? "⇄ " : "−");
  return <div className="space-y-3" data-testid="money-list">
    <Head title={account ? accName(L, account) : tr("All entries")} back={back} />
    <div className={U.card + " flex items-center gap-2 px-3"}><Search size={16} className="c-sub" /><input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" placeholder={tr("Search a shop, a note, an amount…")} className="flex-1 min-w-0 min-h-[46px] bg-transparent outline-none text-[15px]" data-testid="money-list-search" /></div>
    <div className="flex gap-1.5 overflow-x-auto pb-1"><button onClick={() => setMonth("")} className={pill(!month)}>{tr("All")}</button>{months.map((m) => <button key={m} onClick={() => setMonth(m)} className={pill(month === m)}>{m}</button>)}</div>
    <div className={U.card + " px-3"}>
      {rows.map((t) => <button key={t.id} onClick={() => onOpen(t.id)} className="w-full text-start flex items-center gap-3 min-h-[60px] py-2 border-t border-[var(--c-ln)] first:border-t-0" data-testid="money-list-row">
        <span className="w-10 h-10 rounded-[12px] grid place-items-center bg-[var(--c-bg)] border border-[var(--c-ln)] shrink-0 text-[17px]">{t.type === "zakat" ? "☪" : t.type === "transfer" ? "⇄" : t.type === "debt" ? "🤝" : (cats[t.cat] || {}).emoji || "•"}</span>
        <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-bold truncate" dir="auto">{t.note || t.person || t.to || (cats[t.cat] || {}).name || tr("Entry")}</span>
          <span className="block text-[12px] c-sub truncate">{dayLabel(t.date)} · {accName(L, t.account)}{t.evidence ? " · 📩" : ""}</span></span>
        <b className={"tabular-nums text-[14.5px] shrink-0 " + (sign(t) === "+" ? "text-[var(--c-pos)]" : "")} dir="ltr">{sign(t)}{fmt(t.amount)}</b>
        <ChevronRight size={16} className="c-sub rtl:rotate-180" /></button>)}
      {!rows.length ? <p className="text-[13px] c-sub m-0 py-4">{tr("Nothing here.")}</p> : null}
    </div>
  </div>;
}

// ---- goals and debts ---------------------------------------------------------------------------------------------------------------
export function GoalsPane({ L, run, flash, Head, Card }) {
  const [sheet, setSheet] = useState(null);   // {k: "goal"|"add"|"debt"|"pay", id}
  const cur = L.currency || "";
  const goals = L.goals || [], debts = (L.debts || []).filter((d) => !d.settled);
  const paid = (d) => (d.payments || []).reduce((s, p) => s + (+p.amount || 0), 0);
  const close = (msg) => { setSheet(null); if (msg && flash) flash(msg); };
  return <div className="space-y-3" data-testid="money-goals">
    <Head title={tr("Goals & debts")} right={<button className={U.btnS + " h-10! min-h-[40px]!"} onClick={() => setSheet({ k: "goal" })} data-testid="money-goals-add"><Plus size={15} />{tr("Goal")}</button>} />
    <Card title={tr("Saving for")} testid="goals-list">
      {goals.map((g) => { const pct = g.target ? Math.min(100, Math.round(((g.saved || 0) / g.target) * 100)) : 0;
        return <div key={g.id} className="py-2.5 border-t border-[var(--c-ln)] first:border-t-0" data-testid="goal-row">
          <div className="flex items-center gap-2"><button onClick={() => setSheet({ k: "goal", id: g.id })} className="flex-1 min-w-0 text-start"><span className="text-[14.5px] font-bold" dir="auto">{g.emoji} {g.name}</span>
            <span className="block text-[12px] c-sub tabular-nums" dir="ltr">{amt(g.saved || 0, cur)} / {amt(g.target, cur)} · {pct}%</span></button>
            <button onClick={() => setSheet({ k: "add", id: g.id })} className={U.btnS + " h-10! min-h-[40px]!"} data-testid="goal-add-money"><Plus size={14} />{tr("Add")}</button></div>
          <div className="c-bar mt-1.5"><i style={{ width: pct + "%" }} /></div></div>; })}
      {!goals.length ? <p className="text-[13px] c-sub m-0 py-2">{tr("No goal yet — a car, a trip, an emergency fund…")}</p> : null}
    </Card>
    <Card title={tr("Debts")} right={<button className={U.btnS + " h-10! min-h-[40px]!"} onClick={() => setSheet({ k: "debt" })} data-testid="money-debt-add"><Plus size={14} />{tr("Lend / borrow")}</button>} testid="debts-list">
      {debts.map((d) => <div key={d.id} className="flex items-center gap-2 py-2.5 border-t border-[var(--c-ln)] first:border-t-0" data-testid="debt-row">
        <button onClick={() => setSheet({ k: "debt", id: d.id })} className="flex-1 min-w-0 text-start"><span className="text-[14.5px] font-bold" dir="auto">{d.person}</span>
          <span className="block text-[12px] c-sub">{d.type === "owed_to_me" ? tr("Owes you") : tr("You owe")} · <b className="tabular-nums" dir="ltr">{amt(Math.max(0, d.amount - paid(d)), cur)}</b> {tr("left")}</span></button>
        <button onClick={() => setSheet({ k: "pay", id: d.id })} className={U.btnS + " h-10! min-h-[40px]!"} data-testid="debt-pay">{d.type === "owed_to_me" ? tr("Got paid") : tr("I paid")}</button></div>)}
      {!debts.length ? <p className="text-[13px] c-sub m-0 py-2">{tr("No open debts.")}</p> : null}
    </Card>
    {sheet && sheet.k === "goal" ? <GoalSheet L={L} id={sheet.id} run={run} onClose={close} /> : null}
    {sheet && sheet.k === "add" ? <AmountSheet title={tr("Add to the goal")} run={run} onClose={close} op="goal-add" id={sheet.id} testid="goal-add-sheet" /> : null}
    {sheet && sheet.k === "debt" ? <DebtSheet L={L} id={sheet.id} run={run} onClose={close} /> : null}
    {sheet && sheet.k === "pay" ? <DebtPaySheet L={L} id={sheet.id} run={run} onClose={close} /> : null}
  </div>;
}
export function GoalSheet({ L, id, run, onClose }) {
  const g = id ? (L.goals || []).find((x) => x.id === id) : null;
  const [name, setName] = useState(g ? g.name : ""), [target, setTarget] = useState(g ? String(g.target) : ""), [emoji, setEmoji] = useState(g ? g.emoji || "🎯" : "🎯");
  const s = useSave(run, onClose);
  return <Sheet title={g ? tr("Edit goal") : tr("New goal")} onClose={() => onClose()} testid="money-goal-sheet" danger={g ? <Del onClick={() => confirmDel(g.name) && s.go("goal-delete", { id }, tr("Deleted"))} /> : null}>
    <Field label={tr("Saving for")}><input value={name} onChange={(e) => setName(e.target.value)} dir="auto" className={U.inp} placeholder={tr("e.g. A car, Umrah, Emergency fund")} data-testid="goal-name" /></Field>
    <div className="flex flex-wrap gap-1.5">{["🎯", "🚗", "🕋", "🏠", "✈️", "🎓", "💍", "🛟"].map((e) => <button key={e} type="button" onClick={() => setEmoji(e)} className={"w-11 h-11 rounded-[12px] text-[20px] border " + (emoji === e ? "border-[var(--c-acc)] bg-[var(--c-soft)]" : "border-[var(--c-ln)]")}>{e}</button>)}</div>
    <Field label={tr("Target")}><input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" dir="ltr" className={U.inp} placeholder="0" data-testid="goal-target" /></Field>
    <Err err={s.err} /><SaveBtn busy={s.busy} onClick={() => s.go("goal-save", { id: id || undefined, name: name.trim(), target: parseFloat(target), emoji }, tr("Saved"))} />
  </Sheet>;
}
function AmountSheet({ title, run, onClose, op, id, testid }) {
  const [a, setA] = useState(""); const s = useSave(run, onClose);
  return <Sheet title={title} onClose={() => onClose()} testid={testid}>
    <input value={a} onChange={(e) => setA(e.target.value)} inputMode="decimal" dir="ltr" autoFocus className={U.inp} placeholder="0" data-testid="amount-input" />
    <Err err={s.err} /><SaveBtn busy={s.busy} onClick={() => s.go(op, { id, amount: parseFloat(a) }, tr("Saved"))} />
  </Sheet>;
}
export function DebtSheet({ L, id, run, onClose }) {
  const d = id ? (L.debts || []).find((x) => x.id === id) : null;
  const accs = cashAccounts(L);
  const [type, setType] = useState(d ? d.type : "owed_to_me");
  const [person, setPerson] = useState(d ? d.person : ""), [amount, setAmount] = useState(d ? String(d.amount) : ""), [account, setAccount] = useState(d ? d.account || "" : (accs[0] || {}).id || "");
  const [note, setNote] = useState(d ? d.note || "" : ""), [doubtful, setDoubtful] = useState(d ? !!d.doubtful : false);
  const s = useSave(run, onClose);
  return <Sheet title={d ? tr("Edit debt") : tr("Lend / borrow")} onClose={() => onClose()} testid="money-debt-sheet" danger={d ? <Del onClick={() => confirmDel(d.person) && s.go("debt-delete", { id }, tr("Deleted"))} /> : null}>
    {!d ? <Pills value={type} onChange={setType} items={[["owed_to_me", tr("I lent (money out)")], ["i_owe", tr("I borrowed (money in)")]]} testid="debt-type" /> : null}
    <Field label={tr("Person")}><input value={person} onChange={(e) => setPerson(e.target.value)} dir="auto" className={U.inp} data-testid="debt-person" /></Field>
    <Field label={tr("Amount")}><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" className={U.inp} placeholder="0" data-testid="debt-amount" /></Field>
    {!d ? <Field label={type === "owed_to_me" ? tr("Money out of account") : tr("Money into account")}><Pills value={account} onChange={setAccount} items={[...accs.map((a) => [a.id, (a.emoji || "") + " " + a.name]), ["", tr("No account (record only)")]]} testid="debt-account" /></Field> : null}
    <Field label={tr("Note (optional)")}><input value={note} onChange={(e) => setNote(e.target.value)} dir="auto" className={U.inp} /></Field>
    {type === "owed_to_me" ? <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" checked={doubtful} onChange={(e) => setDoubtful(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[var(--c-acc)]" />{tr("Doubtful — may not be repaid (not counted in Zakāt until received)")}</label> : null}
    <Err err={s.err} /><SaveBtn busy={s.busy} onClick={() => s.go("debt-save", { id: id || undefined, type, person: person.trim(), amount: parseFloat(amount), account: account || null, note: note.trim(), doubtful }, tr("Saved"))} />
  </Sheet>;
}
export function DebtPaySheet({ L, id, run, onClose }) {
  const d = (L.debts || []).find((x) => x.id === id) || {};
  const accs = cashAccounts(L);
  const left = Math.max(0, (d.amount || 0) - (d.payments || []).reduce((s, p) => s + (+p.amount || 0), 0));
  const [amount, setAmount] = useState(String(left || "")), [account, setAccount] = useState(d.account || (accs[0] || {}).id || ""), [date, setDate] = useState(isoDay(Date.now()));
  const s = useSave(run, onClose);
  return <Sheet title={d.type === "owed_to_me" ? tr("{p} paid you back", { p: d.person || "" }) : tr("You paid {p}", { p: d.person || "" })} onClose={() => onClose()} testid="money-debtpay-sheet">
    <p className="m-0 text-[13px] c-sub">{tr("Left")}: <b className="tabular-nums" dir="ltr">{amt(left, L.currency)}</b></p>
    <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" className={U.inp} data-testid="debtpay-amount" />
    <Field label={tr("Account")}><Pills value={account} onChange={setAccount} items={[...accs.map((a) => [a.id, (a.emoji || "") + " " + a.name]), ["", tr("No account (record only)")]]} /></Field>
    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={U.inp} dir="ltr" />
    <Err err={s.err} /><SaveBtn busy={s.busy} onClick={() => s.go("debt-pay", { id, amount: parseFloat(amount), account, date }, tr("Saved"))} />
  </Sheet>;
}

// ---- Zakāt: the person's own payment record, and the calculation's inputs -----------------------------------------------------
export function ZakatPaySheet({ L, run, onClose }) {
  const accs = cashAccounts(L);
  const [amount, setAmount] = useState(""), [cat, setCat] = useState("fuqara"), [to, setTo] = useState(""), [date, setDate] = useState(isoDay(Date.now())), [account, setAccount] = useState((accs[0] || {}).id || "");
  const s = useSave(run, onClose);
  return <Sheet title={tr("Record a Zakāt payment")} onClose={() => onClose()} testid="money-zakatpay-sheet">
    <Field label={tr("Amount you paid")}><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" className={U.inp} placeholder="0" data-testid="zpay-amount" /></Field>
    <Field label={tr("To whom (category)")}><select value={cat} onChange={(e) => setCat(e.target.value)} className={U.inp} data-testid="zpay-cat">{ASNAF.map(([k, en, a]) => <option key={k} value={k}>{ar() ? a : tr(en)}</option>)}</select></Field>
    <Field label={tr("Recipient (optional)")}><input value={to} onChange={(e) => setTo(e.target.value)} dir="auto" className={U.inp} data-testid="zpay-to" /></Field>
    <Field label={tr("Pay from")}><Pills value={account} onChange={setAccount} items={[...accs.map((a) => [a.id, (a.emoji || "") + " " + a.name]), ["", tr("No account (record only)")]]} /></Field>
    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={U.inp} dir="ltr" />
    <Err err={s.err} /><SaveBtn busy={s.busy} onClick={() => s.go("zakat-pay", { amount: parseFloat(amount), cat, to: to.trim(), date, account }, tr("Recorded — may Allah accept it"))} />
  </Sheet>;
}
const ZSec = ({ title, sub, children, testid }) => <section className="rounded-[18px] border border-[var(--c-ln)] bg-[var(--c-surf-2,transparent)] p-3.5 space-y-3" data-testid={testid}>
    <div><p className="m-0 text-[15px] font-black">{title}</p>{sub ? <p className="m-0 mt-0.5 text-[12px] c-sub leading-snug">{sub}</p> : null}</div>{children}</section>;
const ZCheck = ({ on, set, label, testid }) => <label className="flex items-center gap-2.5 min-h-[44px] text-[14px] font-bold"><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="w-5 h-5 accent-[var(--c-acc)] shrink-0" data-testid={testid} />{label}</label>;
const ZNum = ({ value, set, testid, ph }) => <input value={value} onChange={(e) => set(e.target.value)} inputMode="decimal" dir="ltr" className={U.inp} placeholder={ph || "0"} data-testid={testid} />;
export function ZakatSetSheet({ L, run, onClose }) {
  // v8.7 (Ali: "some of the zakat settings were removed, like worn jewelry — restore them all"): every input the ledger's own
  // Zakāt sheet has — the country (its live gold price), worn jewellery, gold and silver you own, the year's start, debts…
  const z = L.zakat || {}, ex = new Set(z.excluded || []);
  const [country, setCountry] = useState(() => { if (L.country) return L.country; try { const c = (localStorage.getItem("attune:country") || "").toUpperCase(); return REGION_CUR[c] ? c : ""; } catch (e) { return ""; } }), [premium, setPrem] = useState(String(z.goldPremium || ""));
  const [goldPrice, setGP] = useState(String(z.goldPrice || "")), [madhhab, setM] = useState(z.madhhab || "jumhur"), [basis, setB] = useState(z.nisabBasis || "gold"), [mode, setMode] = useState(z.mode || "combined");
  const [nisabCarat, setNC] = useState(String(z.nisabCarat || 24));
  const [jew, setJew] = useState(!!z.jewelryZakat), [jewG, setJewG] = useState(String(z.jewelryGrams || "")), [jewK, setJewK] = useState(String(z.jewelryKarat || 21));
  const [goldG, setGoldG] = useState(String(z.goldGrams || "")), [goldK, setGoldK] = useState(String(z.goldKarat || 24));
  const [silverP, setSP] = useState(String(z.silverPrice || "")), [silverG, setSG] = useState(String(z.silverGrams || ""));
  const [anniv, setAnniv] = useState(z.anniversary || ""), [recv, setRecv] = useState(!!z.includeReceivables);
  const [debt, setDebt] = useState(z.debtPolicy || ""), [debtYear, setDebtYear] = useState(String(z.debtYearAmount || ""));
  const [excluded, setEx] = useState(ex);
  const [fetching, setFetching] = useState(false), [fetched, setFetched] = useState("");
  const s = useSave(run, onClose);
  const accs = (L.accounts || []);
  const names = (() => { try { return new Intl.DisplayNames([ar() ? "ar" : "en"], { type: "region" }); } catch (e) { return null; } })();
  const countries = Object.entries(REGION_CUR).map(([c, cur]) => [c, ((names && names.of(c)) || c) + " · " + cur]).sort((a, b) => a[1].localeCompare(b[1]));
  const cur = (country && REGION_CUR[country]) || L.currency || "";
  const n = (v) => parseFloat(String(v).replace(/,/g, "")) || 0;
  const KAR = [["24", "24"], ["22", "22"], ["21", "21"], ["18", "18"]];
  // today's price for the country, from the ledger's own live sources (gold-api.com, goldprice.org + today's exchange rate)
  const fetchNow = async () => {
    setFetching(true); setFetched("");
    try { await run("zakat-set", { country, goldPremium: n(premium) }); await run("gold-fetch", {}); } catch (e) {}
    setTimeout(() => { try { const L2 = JSON.parse(localStorage.getItem("ledger.v3") || "{}"); const p = L2.zakat && L2.zakat.goldPrice; if (p) { setGP(String(p)); setFetched(tr("Today's price: {p} {c} a gram (24k) — updates by itself twice a day", { p: p.toLocaleString(), c: L2.currency || cur })); } else setFetched(tr("Couldn't fetch the price — type it in")); } catch (e) {} setFetching(false); }, 2500);
  };
  const upd = z.goldPriceUpdated ? new Date(z.goldPriceUpdated).toLocaleString(ar() ? "ar-EG-u-nu-latn" : undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  // v8.7 (Ali: "put the zakat settings in a good way"): five short sections in the order you think of them — today's price,
  // your school, what you own, your Zakāt year, money and debts — and the scholars' fine points folded under "More choices"
  const [more, setMore] = useState(false);
  const MAD = { jumhur: tr("Most scholars"), hanafi: tr("Hanafi"), maliki: tr("Maliki"), shafii: tr("Shafiʿi"), hanbali: tr("Hanbali") };
  const sumLine = [basis === "silver" ? tr("Silver (595 g)") : tr("Gold (85 g)"), nisabCarat === "21" ? "21k" : "24k", mode === "separate" ? tr("Each on its own") : tr("Counted together")].join(" · ");
  return <Sheet title={tr("Zakāt settings")} onClose={() => onClose()} testid="money-zakatset-sheet">
    <ZSec title={tr("1 · Today's gold price")} sub={tr("Pick your country once — the price follows it and updates by itself twice a day.")} testid="zset-sec-price">
      <Field label={tr("Country")}><select value={country} onChange={(e) => setCountry(e.target.value)} className={U.inp} data-testid="zset-country"><option value="">—</option>{countries.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></Field>
      <Field label={tr("1 g of 24k gold") + (cur ? " (" + cur + ")" : "")}>
        <div className="flex gap-2"><ZNum value={goldPrice} set={setGP} testid="zset-gold" />
          <button onClick={fetchNow} disabled={fetching || !country} className={U.btnS + " shrink-0"} data-testid="zset-fetch"><RefreshCw size={15} />{fetching ? tr("Getting…") : tr("Live price")}</button></div>
        <span className="block mt-1 text-[12px] c-sub" data-testid="zset-gold-note">{fetched || (upd ? tr("Updated by itself: {t} · twice a day", { t: upd }) : country ? tr("Tap “Live price” — then it updates by itself twice a day.") : tr("Choose your country first — the price follows it."))}</span></Field>
      <Field label={tr("Shop premium on gold (%)")}><ZNum value={premium} set={setPrem} testid="zset-premium" /></Field>
    </ZSec>
    <ZSec title={tr("2 · Your school")} sub={tr("Choosing it sets the niṣāb and worn jewellery the way that school does. You can still change each one.")} testid="zset-sec-school">
      <Pills value={madhhab} onChange={(m) => { setM(m); if (m === "hanafi") { setB("silver"); setJew(true); } else { setB("gold"); setJew(false); } setMode(m === "shafii" ? "separate" : "combined"); }} items={Object.entries(MAD)} testid="zset-madhhab" />
      <button type="button" onClick={() => setMore(!more)} className="w-full min-h-[44px] flex items-center justify-between gap-2 rounded-[12px] px-3 bg-[var(--c-soft)] text-start" data-testid="zset-more" aria-expanded={more}>
        <span className="min-w-0"><span className="block text-[12px] font-bold c-sub">{tr("Niṣāb")}</span><span className="block text-[13.5px] font-bold truncate">{sumLine}</span></span>
        <span className="text-[13px] font-extrabold text-[var(--c-acc)] shrink-0 flex items-center gap-1">{more ? tr("Done") : tr("Change")}{more ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span></button>
      {more ? <div className="space-y-3">
        <Field label={tr("Niṣāb based on")}><Pills value={basis} onChange={setB} items={[["gold", tr("Gold (85 g)")], ["silver", tr("Silver (595 g)")]]} /></Field>
        <Field label={tr("Niṣāb carat")}><Pills value={nisabCarat} onChange={setNC} items={[["24", tr("24k — Islamweb")], ["21", tr("21k — Dār al-Iftāʾ (Egypt)")]]} /></Field>
        <Field label={tr("Cash, gold and silver")}><Pills value={mode} onChange={setMode} items={[["combined", tr("Counted together")], ["separate", tr("Each on its own")]]} /></Field>
      </div> : null}
    </ZSec>
    <ZSec title={tr("3 · Gold and silver you own")} sub={tr("Put 0 or leave empty what you don't have.")} testid="zset-sec-own">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end"><Field label={tr("Gold you keep (g)")}><ZNum value={goldG} set={setGoldG} testid="zset-goldg" /></Field>
        <Field label={tr("Its carat")}><Pills value={goldK} onChange={setGoldK} items={KAR} /></Field></div>
      <div className="rounded-[14px] bg-[var(--c-soft)] p-3 space-y-2" data-testid="zset-jewelry">
        <ZCheck on={jew} set={setJew} label={tr("Pay Zakāt on worn jewellery")} testid="zset-jew" />
        <p className="m-0 text-[12px] c-sub">{tr("The Hanafi school counts gold you wear; most scholars don't. Your choice is kept.")}</p>
        {jew ? <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end"><Field label={tr("Grams worn")}><ZNum value={jewG} set={setJewG} testid="zset-jewg" /></Field>
          <Field label={tr("Carat")}><Pills value={jewK} onChange={setJewK} items={KAR} /></Field></div> : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("Silver you keep (g)")}><ZNum value={silverG} set={setSG} testid="zset-silverg" /></Field>
        <Field label={tr("Silver price (1 g)")}><ZNum value={silverP} set={setSP} testid="zset-silver" /></Field>
      </div>
    </ZSec>
    <ZSec title={tr("4 · Your Zakāt year")} sub={tr("The day your money first reached the niṣāb (the ḥawl). Zakāt is due one lunar year after it.")} testid="zset-sec-year">
      <input type="date" value={anniv || ""} onChange={(e) => setAnniv(e.target.value)} className={U.inp} dir="ltr" data-testid="zset-anniv" aria-label={tr("Your Zakāt year starts (ḥawl)")} />
    </ZSec>
    <ZSec title={tr("5 · Money and debts")} testid="zset-sec-money">
      <ZCheck on={recv} set={setRecv} label={tr("Count money people owe me")} testid="zset-recv" />
      <Field label={tr("Debts I owe")}><select value={debt} onChange={(e) => setDebt(e.target.value)} className={U.inp} data-testid="zset-debt">
        <option value="">{tr("— not chosen yet (nothing is deducted) —")}</option><option value="none">{tr("Do not deduct debts")}</option><option value="year">{tr("Deduct only what falls due this year")}</option><option value="all">{tr("Deduct the whole debt")}</option></select></Field>
      {debt === "year" ? <Field label={tr("Amount falling due this year")}><ZNum value={debtYear} set={setDebtYear} testid="zset-debtyear" /></Field> : null}
      {accs.length ? <Field label={tr("Accounts counted for Zakāt")}><div className="flex flex-col" data-testid="zset-accounts">{accs.map((a) => <ZCheck key={a.id} on={!excluded.has(a.id)} set={(on) => { const x = new Set(excluded); if (on) x.delete(a.id); else x.add(a.id); setEx(x); }} label={(a.emoji || "") + " " + a.name} />)}</div></Field> : null}
    </ZSec>
    <p className="m-0 text-[12px] c-sub">{tr("These are only the inputs — the Zakāt engine (the rulings and the numbers) is unchanged and works out what is due.")}</p>
    <div className="sticky bottom-0 -mx-4 px-4 pt-2 pb-1 bg-[var(--c-surf)]"><Err err={s.err} /><SaveBtn busy={s.busy} onClick={() => s.go("zakat-set", { country, goldPremium: n(premium), goldPrice: n(goldPrice), madhhab, basis, mode, nisabCarat: +nisabCarat, jewelry: jew, jewelryGrams: n(jewG), jewelryKarat: +jewK,
      goldGrams: n(goldG), goldKarat: +goldK, silverPrice: n(silverP), silverGrams: n(silverG), anniversary: anniv || "", receivables: recv, debtPolicy: debt, debtYearAmount: n(debtYear), excluded: [...excluded] }, tr("Saved"))} /></div>
  </Sheet>;
}

// v8.7 (Ali: "and the other zakat calculators, restore them all"): the ledger's 7 calculators (zakatcalc.js — its rules unchanged)
export function ZakatCalcSheet({ L, kind, onClose, nisab = 0 }) {
  const [v, setV] = useState({ rain: true });
  const k = ZC.KINDS.find((x) => x[0] === kind) || ZC.KINDS[0], cur = L.currency || "";
  const r = ZC.calc(k[0], v, { nisab });
  const inp = (key, label) => <Field label={label}><input value={v[key] || ""} onChange={(e) => setV({ ...v, [key]: e.target.value })} inputMode="decimal" dir="ltr" className={U.inp} data-testid={"zcalc-" + key} /></Field>;
  const money = (x) => (Math.round(x * 100) / 100).toLocaleString(ar() ? "ar-EG-u-nu-latn" : undefined) + " " + cur;
  const animal = (key) => (ar() ? ZC.ANIMALS[key][1] : tr(ZC.ANIMALS[key][0]));
  return <Sheet title={k[1] + " " + (ar() ? k[3] : tr(k[2]))} onClose={() => onClose()} testid="money-zakatcalc-sheet">
    {["camels", "cattle", "sheep"].includes(k[0]) ? inp("head", tr("How many (grazing freely most of the year)")) : null}
    {k[0] === "crops" ? <>{inp("kg", tr("Harvest (kg)"))}<Field label={tr("Watered by")}><Pills value={v.rain === false ? "irr" : "rain"} onChange={(x) => setV({ ...v, rain: x === "rain" })} items={[["rain", tr("Rain or rivers — 10%")], ["irr", tr("Irrigation you pay for — 5%")]]} /></Field></> : null}
    {k[0] === "trade" ? <>{inp("stock", tr("Stock at its selling price"))}{inp("cash", tr("Business cash"))}{inp("owedToYou", tr("Money customers owe you"))}{inp("youOwe", tr("Money you owe suppliers"))}</> : null}
    {k[0] === "rikaz" ? inp("value", tr("What the treasure is worth")) : null}
    {k[0] === "fitr" ? <>{inp("people", tr("People you pay for"))}{inp("perPerson", tr("Amount per person (your country's official figure)"))}</> : null}
    <div className="rounded-[16px] bg-[var(--c-soft)] p-3.5" data-testid="zcalc-result">
      {r.options ? <><p className="m-0 text-[12px] font-bold c-sub">{tr("Due")}</p>{r.options.map((o, i) => <p key={i} className="m-0 text-[17px] font-black">{i ? tr("or") + " " : ""}{o.map(([q, a]) => q + " × " + animal(a)).join(" + ")}</p>)}</>
        : r.noPrice ? <p className="m-0 text-[14px] font-bold">{tr("Add today's gold price in Zakāt settings first — the niṣāb comes from it.")}</p>
        : !r.due ? <p className="m-0 text-[15px] font-black">{tr("Below the niṣāb — nothing is due")}{r.need ? " · " + tr("{n} more to reach it", { n: r.unit === "kg" ? Math.round(r.need).toLocaleString() + " kg" : money(r.need) }) : ""}</p>
        : <><p className="m-0 text-[12px] font-bold c-sub">{tr("Due")}</p><p className="m-0 text-[22px] font-black text-[var(--c-acc)] tabular-nums">{r.kg != null ? r.kg.toLocaleString() + " kg" : money(r.amount)}</p>{r.rate ? <p className="m-0 text-[12px] c-sub">{r.rate}%</p> : null}</>}
    </div>
    <p className="m-0 text-[12px] c-sub">{tr("The rulings are the ledger's Zakāt engine's, unchanged.")}</p>
  </Sheet>;
}

// ---- the ledger's settings, in Attune ---------------------------------------------------------------------------------------------
/** Tabs to show (Ali: it lived in the old ledger's settings): the order of Money's bar and which tabs it shows. Home stays first. */
const TAB_NAMES = [["trends", "Trends"], ["accounts", "Accounts"], ["goals", "Goals"], ["bills", "Bills"], ["zakat", "Zakāt"]];
function TabsCard({ ui, doIt, Card }) {
  const names = Object.fromEntries(TAB_NAMES), all = TAB_NAMES.map((t) => t[0]);
  const order = ui.tabsSet ? [...new Set([...(ui.tabOrder || []).filter((k) => names[k]), ...all])] : all;
  const shown = (k) => !ui.tabsSet || !(ui.tabs && ui.tabs[k] === 0);
  const move = (i, d) => { const o = order.slice(), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; doIt("prefs", { tabOrder: o, tabs: Object.fromEntries(all.map((k) => [k, shown(k) ? 1 : 0])) }); };
  const flip = (k) => doIt("prefs", { tabOrder: order, tabs: Object.fromEntries(all.map((x) => [x, x === k ? !shown(x) : shown(x)]).map(([x, v]) => [x, v ? 1 : 0])) });
  return <Card title={tr("Tabs to show")}>
    <p className="m-0 mb-2 text-[12.5px] c-sub">{tr("The tabs on Money's bar and their order. Home is always first.")}</p>
    <div className="flex flex-col gap-1.5" data-testid="set-tabs">{order.map((k, i) => <div key={k} className={"flex items-center gap-2 " + (shown(k) ? "" : "opacity-60")} data-testid={"set-tab-" + k}>
      <button className="w-9 h-9 rounded-[12px] grid place-items-center border border-[var(--c-ln)] disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={tr("Move up")} data-testid={"set-tab-up-" + k}><ChevronUp size={16} /></button>
      <button className="w-9 h-9 rounded-[12px] grid place-items-center border border-[var(--c-ln)] disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={tr("Move down")} data-testid={"set-tab-down-" + k}><ChevronDown size={16} /></button>
      <span className="flex-1 text-[14px] font-bold">{tr(names[k])}</span>
      <label className="flex items-center gap-2 text-[13px] font-bold"><input type="checkbox" checked={shown(k)} onChange={() => flip(k)} className="w-5 h-5 accent-[var(--c-acc)]" data-testid={"set-tab-show-" + k} />{tr("Show")}</label>
    </div>)}</div>
  </Card>;
}
export function LedgerSettings({ L, run, flash, back, Head, Card }) {
  const ui = L.ui || {};
  const [cat, setCat] = useState({ emoji: "", label: "" });
  const [proj, setProj] = useState("");
  const [budget, setBudget] = useState(String(((L.budgets || {}).overall) || ""));
  const doIt = async (op, args, msg) => { const r = await run(op, args); if (flash) flash(r && r.ok ? msg || tr("Saved") : tr("Nothing was changed")); return r; };
  const fileRef = React.useRef(null);
  return <div className="space-y-3" data-testid="money-settings">
    <Head title={tr("Money settings")} back={back} />
    <Card title={tr("How Money looks")}>
      <Field label={tr("Default period")}><Pills value={ui.period || "month"} onChange={(v) => doIt("prefs", { period: v })} items={[["week", tr("Week")], ["month", tr("Month")], ["year", tr("Year")], ["all", tr("All")]]} testid="set-period" /></Field>
      <div className="h-3" /><Field label={tr("Week starts on")}><Pills value={ui.wk || "mon"} onChange={(v) => doIt("prefs", { wk: v })} items={[["sat", tr("Saturday")], ["sun", tr("Sunday")], ["mon", tr("Monday")]]} testid="set-wk" /></Field>
      <label className="flex items-center gap-2 mt-3 text-[14px] font-bold"><input type="checkbox" checked={!!ui.dec} onChange={(e) => doIt("prefs", { dec: e.target.checked })} className="w-5 h-5 accent-[var(--c-acc)]" data-testid="set-dec" />{tr("Show decimals")}</label>
    </Card>
    <TabsCard ui={ui} doIt={doIt} Card={Card} />
    <Card title={tr("Currency and budget")}>
      <Field label={tr("Default currency")}><input defaultValue={L.currency || ""} onBlur={(e) => { const v = e.target.value.trim().toUpperCase(); if (v && v !== L.currency) doIt("prefs", { currency: v }); }} className={U.inp + " uppercase"} dir="ltr" data-testid="set-currency" /></Field>
      <div className="h-3" /><Field label={tr("Monthly budget (0 = none)")}><div className="flex gap-2"><input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" dir="ltr" className={U.inp} data-testid="set-budget" />
        <button className={U.btnS} onClick={() => doIt("prefs", { budget: parseFloat(budget) || 0 })} data-testid="set-budget-save">{tr("Save")}</button></div></Field>
      <button className={U.btnS + " mt-3"} onClick={() => doIt("rates", {}, tr("Updating exchange rates…"))} data-testid="set-rates"><RefreshCw size={14} />{tr("Update exchange rates")}</button>
    </Card>
    <Card title={tr("Your own categories")}>
      <div className="flex flex-wrap gap-1.5 mb-2">{(L.customCats || []).map((c) => <span key={c.id} className={pill(false)}>{c.e} {ar() ? c.ar : c.en}</span>)}</div>
      <div className="flex gap-2"><input value={cat.emoji} onChange={(e) => setCat({ ...cat, emoji: e.target.value.slice(0, 2) })} placeholder="🙂" className={U.inp + " !w-16 text-center"} />
        <input value={cat.label} onChange={(e) => setCat({ ...cat, label: e.target.value })} placeholder={tr("e.g. Car, Kids, Charity")} dir="auto" className={U.inp} data-testid="set-cat-label" />
        <button className={U.btnS} onClick={async () => { if (!cat.label.trim()) return; const r = await doIt("cat-add", { emoji: cat.emoji || "✦", label: cat.label.trim() }); if (r && r.ok) setCat({ emoji: "", label: "" }); }} data-testid="set-cat-add"><Plus size={15} /></button></div>
    </Card>
    <Card title={tr("Projects / jobs")}>
      <div className="flex flex-wrap gap-1.5 mb-2">{(L.projects || []).map((p) => <span key={p.id} className={pill(false)}>🏗️ {p.name}</span>)}</div>
      <div className="flex gap-2"><input value={proj} onChange={(e) => setProj(e.target.value)} placeholder={tr("e.g. Crane job — Smart Village")} dir="auto" className={U.inp} data-testid="set-proj-name" />
        <button className={U.btnS} onClick={async () => { if (!proj.trim()) return; const r = await doIt("project-add", { name: proj.trim() }); if (r && r.ok) setProj(""); }} data-testid="set-proj-add"><Plus size={15} /></button></div>
    </Card>
    <Card title={tr("Backup")}>
      <p className="m-0 mb-2 text-[12.5px] c-sub">{tr("Your money stays on this phone. Save a backup now and then, or send it to your new phone.")}</p>
      <div className="flex flex-wrap gap-2">
        <button className={U.btnS} onClick={() => doIt("export", { kind: "share" }, tr("Backup ready to send"))} data-testid="set-share"><Upload size={14} />{tr("Send backup")}</button>
        <button className={U.btnS} onClick={() => doIt("export", { kind: "json" }, tr("Backup saved"))} data-testid="set-export"><Download size={14} />{tr("Save backup")}</button>
        <button className={U.btnS} onClick={() => doIt("export", { kind: "csv" }, tr("Saved for Excel"))} data-testid="set-csv"><Download size={14} />{tr("Excel (CSV)")}</button>
        <button className={U.btnS} onClick={() => fileRef.current && fileRef.current.click()} data-testid="set-import">{tr("Restore a backup")}</button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
          if (!window.confirm(tr("Replace the money on this phone with this backup? (The current data is kept aside first.)"))) return;
          const r = new FileReader(); r.onload = () => doIt("import", { json: String(r.result || "") }, tr("Backup restored")); r.readAsText(f); }} />
      </div>
    </Card>
  </div>;
}

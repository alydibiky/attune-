/* ---- v9.9.13 / v9.9.14 "Who pays it?" (Ali, 10 Nov: OK2 on https://claude.ai/artifact/MKnujhxuS8SgLncLadhA1W, then: "I don't want a
   small fix … choose which balance to take from if it's taking from me, and if someone else is paying make me choose who — someone
   Attune knows, from contacts, or nothing … it should remind me whether I am paying or not").
   PayerPicker — one picker used everywhere:  Me → which balance (each Money account with what's in it, or the usual one)
                                              Someone else → a person Attune knows · Pick from contacts · type a name
                                              Nobody — just remind me
   PayerAsk  — a renewing payment Attune added by itself asks once (Follow-ups + People & plans); "Me" takes this payment from the
               chosen account now.
   PayerRow  — on every renewing payment in People & plans: "Paid by: My father · Change".
   Logic (tested): life.js setPayer / payerUnknown / payerLine / peopleChoices / nextReminder, regular.js (Money only when you pay,
   from your account), paylog.js appendToLedger (the chosen account). */
import React, { useState } from "react";
import { Check, Wallet, User, Phone, BellRing, ChevronLeft } from "lucide-react";
import { tr } from "./i18n.js";
import { loadLife, saveLife, setPayer, payerUnknown, payerLine, peopleChoices, nextReminder, hasPayer } from "./life.js";
import { appendToLedger } from "./paylog.js";
import { loadLedger } from "./myledger.js";
import { accountBalance } from "./money-report.js";
import { loadDir } from "./entities.js";
import { loadReminders, saveReminders, syncToPhone } from "./actions.js";

const BTN = "min-h-[44px] px-3.5 rounded-[12px] text-[13px] font-extrabold bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] disabled:opacity-40";
const BTN2 = "min-h-[44px] px-3.5 rounded-[12px] text-[13px] font-extrabold border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)]";
const ROW = "w-full min-h-[48px] px-3 rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] flex items-center gap-2.5 text-start text-[13.5px] font-bold";
const fmt = (v) => { try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v); } catch (e) { return String(v); } };
const N0 = () => (typeof window !== "undefined" ? window.AttuneNative : null);
const call = () => (typeof window !== "undefined" ? window.__attuneNativeCall : null);
/** The commitment's next reminder, set (or moved) on the phone. */
export function remindNext(c) {
  const r = c && nextReminder(c); if (!r) return;
  try { const list = [...loadReminders().filter((x) => x.id !== r.id), { ...r, repeat: "none", created: Date.now(), source: "life" }]; saveReminders(list); syncToPhone(N0(), list); } catch (e) {}
}
/** The Money accounts to pay from, with what's in each. */
export function accountsNow() {
  const L = loadLedger(); if (!L || !Array.isArray(L.accounts)) return [];
  return L.accounts.filter((a) => a && !a.archived && !a.hidden).map((a) => ({ id: a.id, name: a.name || a.id, currency: a.currency || L.currency || "", balance: accountBalance(L, a.id) }));
}

/** Who pays + from which account. onSave(who) gets { payer, ref?, account?, accountName? }. */
export function PayerPicker({ c, onSave, onCancel, testid = "payer-picker" }) {
  const [step, setStep] = useState("who"), [name, setName] = useState(""), [err, setErr] = useState("");
  const accounts = accountsNow(), people = peopleChoices(loadDir(), loadLife());
  const back = <button onClick={() => { setStep("who"); setErr(""); }} className="min-h-[40px] inline-flex items-center gap-1 text-[12.5px] font-extrabold c-sub" data-testid="payer-back"><ChevronLeft size={15} className="rtl:-scale-x-100" />{tr("Back")}</button>;
  const pickContact = async () => {
    setErr("");
    const nc = call(); if (!nc) { setErr(tr("Picking a contact works in the Android app")); return; }
    try { const k = await nc("contactPick", {}); if (k && (k.name || k.phone)) onSave({ payer: k.name || k.phone, ref: { phone: k.phone || "" } }); }
    catch (e) { if (!/cancel/i.test(String(e && e.message))) setErr(String((e && e.message) || e)); }
  };
  return <div className="space-y-2" data-testid={testid}>
    {step === "who" ? <>
      <p className="m-0 text-[13.5px] font-extrabold">{tr("Who pays it?")}</p>
      <button onClick={() => (accounts.length > 1 ? setStep("acct") : onSave({ payer: "me", account: accounts[0] ? accounts[0].id : "", accountName: accounts[0] ? accounts[0].name : "" }))} className={ROW} data-testid="payer-me">
        <Wallet size={17} className="text-[var(--c-acc)] shrink-0" /><span className="flex-1">{tr("Me — take it from my balance")}</span></button>
      <button onClick={() => setStep("other")} className={ROW} data-testid="payer-other">
        <User size={17} className="text-[var(--c-acc)] shrink-0" /><span className="flex-1">{tr("Someone else pays — remind me")}</span></button>
      <button onClick={() => onSave({ payer: "none" })} className={ROW} data-testid="payer-none">
        <BellRing size={17} className="text-[var(--c-acc)] shrink-0" /><span className="flex-1">{tr("Nobody — just remind me")}</span></button>
      {onCancel ? <button onClick={onCancel} className={BTN2} data-testid="payer-cancel">{tr("Cancel")}</button> : null}
    </> : null}
    {step === "acct" ? <>
      {back}
      <p className="m-0 text-[13.5px] font-extrabold">{tr("From which balance?")}</p>
      {accounts.map((a) => <button key={a.id} onClick={() => onSave({ payer: "me", account: a.id, accountName: a.name })} className={ROW} data-testid="payer-account">
        <Wallet size={16} className="text-[var(--c-acc)] shrink-0" /><span className="flex-1 min-w-0 truncate" dir="auto">{a.name}</span>
        <span className="tabular-nums c-sub text-[12.5px]" dir="ltr">{fmt(a.balance)} {a.currency}</span></button>)}
    </> : null}
    {step === "other" ? <>
      {back}
      <p className="m-0 text-[13.5px] font-extrabold">{tr("Who pays it?")}</p>
      {people.length ? <div className="flex flex-wrap gap-1.5" data-testid="payer-people">{people.map((p) => <button key={p.name} onClick={() => onSave({ payer: p.name, ref: p.ref })}
        className="min-h-[40px] px-3 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[13px] font-bold" dir="auto" data-testid="payer-person">{p.name}{p.role ? <span className="c-sub font-semibold"> · {p.role}</span> : null}</button>)}</div> : null}
      <button onClick={pickContact} className={ROW} data-testid="payer-contact"><Phone size={16} className="text-[var(--c-acc)] shrink-0" /><span className="flex-1">{tr("Pick from contacts")}</span></button>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave({ payer: name.trim() }); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} dir="auto" placeholder={tr("Who? e.g. My father")} className="flex-1 min-w-0 min-h-[44px] rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 text-[13.5px]" data-testid="payer-name" />
        <button type="submit" disabled={!name.trim()} className={BTN} data-testid="payer-save"><Check size={14} className="inline -mt-0.5 me-1" />{tr("Save")}</button></form>
    </> : null}
    {err ? <p className="m-0 text-[12.5px] font-bold text-[var(--c-neg)]">{err}</p> : null}
  </div>;
}

/** Saves who pays on commitment `id` (+ its reminder). first = the first answer for a payment Attune added by itself: "me" takes
 *  this payment out of the chosen account now (nothing left Money before the answer). → the line to show */
export function savePayer(id, who, { first = false } = {}) {
  const data = setPayer(loadLife(), id, who); saveLife(data);
  const c = data.items.find((x) => x.id === id); if (!c) return "";
  if (first && who.payer === "me") {
    const led = loadLedger();
    if (led) { const r = appendToLedger(led, [{ type: "expense", amount: c.amount, currency: c.currency || "", cat: "bills", note: c.title || c.person || "", date: c.start || new Date().toISOString().slice(0, 10), ...(c.account ? { account: c.account } : {}) }]);
      if (r.ids.length) try { localStorage.setItem("ledger.v3", JSON.stringify(r.ledger)); } catch (e) {} }
  }
  remindNext(c);
  const t = c.title || c.person || "";
  return who.payer === "me" ? tr("{t}: you pay it — {a} out of your balance each month", { t, a: fmt(c.amount) + " " + (c.currency || "") }) + (c.accountName ? " · " + c.accountName : "")
    : who.payer === "none" ? tr("{t}: nobody set — I'll only remind you on the day", { t })
    : tr("{t}: {p} pays it — not taken from your balance; I'll remind you on the day", { t, p: c.payer });
}

/** A renewing payment Attune added by itself asks once. */
export function PayerAsk({ flash, onDone, max = 2 }) {
  const [v, setV] = useState(0);
  const list = payerUnknown(loadLife()).slice(0, max);
  if (!list.length) return null;
  return <div className="space-y-2" data-testid="payer-asks" data-v={v}>{list.map((c) => <div key={c.id} className="rounded-[18px] bg-[var(--c-soft)] p-3.5 space-y-2" data-testid="payer-ask">
    <p className="m-0 text-[14px] font-extrabold" dir="auto">{tr("Added by itself: {t}", { t: c.title || c.person })}</p>
    <p className="m-0 text-[17px] font-black tabular-nums" dir="auto">{tr("{a} · every month on the {d}", { a: fmt(c.amount) + " " + (c.currency || ""), d: String(+String(c.start || "").slice(8, 10) || "") })}</p>
    <PayerPicker c={c} onSave={(who) => { const m = savePayer(c.id, who, { first: true }); setV(v + 1); flash && flash(m); onDone && onDone(m); }} />
  </div>)}</div>;
}

/** People & plans: who pays a renewing payment, changeable any time. */
export function PayerRow({ c, onChange }) {
  const [open, setOpen] = useState(false);
  if (!hasPayer(c)) return null;
  return <div className="mt-2" data-testid="payer-row">
    {!open ? <div className="flex items-center gap-2 text-[12.5px]">
      <Wallet size={14} className="text-[var(--c-acc)] shrink-0" /><span className="flex-1 min-w-0 truncate font-bold" dir="auto" data-testid="payer-line">{payerLine(c)}</span>
      <button onClick={() => setOpen(true)} className="min-h-[36px] px-2 text-[12.5px] font-extrabold text-[var(--c-acc)]" data-testid="payer-change">{tr("Change")}</button></div>
    : <PayerPicker c={c} onCancel={() => setOpen(false)} onSave={(who) => { savePayer(c.id, who); setOpen(false); onChange && onChange(); }} />}
  </div>;
}

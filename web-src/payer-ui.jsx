/* ---- v9.9.13 "Who pays it?" (Ali, 10 Nov: "something like Google subscription I need it to automatically add it to subscriptions and an
   option whether to deduct from my balance or not, as this subscription is paid by my father but I need to be reminded"; combined page
   OK2 https://claude.ai/artifact/MKnujhxuS8SgLncLadhA1W). A subscription Autopilot added by itself asks once:
     Me → this payment and the next ones come out of Money;  Someone else (a name) → never out of Money, but reminded on the day.
   Logic: life.js setPayer / payerUnknown / nextReminder, regular.js tickRegular (skips Money when someone else pays). */
import React, { useState } from "react";
import { Check } from "lucide-react";
import { tr } from "./i18n.js";
import { loadLife, saveLife, setPayer, payerUnknown, nextReminder } from "./life.js";
import { appendToLedger } from "./paylog.js";
import { loadLedger } from "./myledger.js";
import { loadReminders, saveReminders, syncToPhone } from "./actions.js";

const BTN = "min-h-[42px] px-3.5 rounded-[12px] text-[13px] font-extrabold bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))]";
const BTN2 = "min-h-[42px] px-3.5 rounded-[12px] text-[13px] font-extrabold border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)]";
const fmt = (v) => { try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v); } catch (e) { return String(v); } };
const remindNext = (c) => { const r = c && nextReminder(c); if (!r) return; try { const list = [...loadReminders().filter((x) => x.id !== r.id), { ...r, repeat: "none" }]; saveReminders(list);
  syncToPhone(typeof window !== "undefined" ? window.AttuneNative : null, list); } catch (e) {} };

export function PayerAsk({ flash, onDone, max = 2 }) {
  const [v, setV] = useState(0), [other, setOther] = useState(""), [name, setName] = useState("");
  const list = payerUnknown(loadLife()).slice(0, max);
  if (!list.length) return null;
  const save = (c, payer) => {
    const data = setPayer(loadLife(), c.id, payer); saveLife(data);
    const c2 = data.items.find((x) => x.id === c.id);
    let m = "";
    if (payer === "me") {
      // this month's payment (already ticked when it was added) goes out of Money now
      const led = loadLedger();
      if (led) { const r = appendToLedger(led, [{ type: "expense", amount: c.amount, currency: c.currency || "", cat: "bills", note: c.title, date: c.start || new Date().toISOString().slice(0, 10) }]);
        if (r.ids.length) try { localStorage.setItem("ledger.v3", JSON.stringify(r.ledger)); } catch (e) {} }
      m = tr("{t}: you pay it — {a} out of your balance each month", { t: c.title, a: fmt(c.amount) + " " + (c.currency || "") });
    } else m = tr("{t}: {p} pays it — not taken from your balance; I'll remind you on the day", { t: c.title, p: payer });
    remindNext(c2);
    setOther(""); setName(""); setV(v + 1); flash && flash(m); onDone && onDone(m);
  };
  return <div className="space-y-2" data-testid="payer-asks">{list.map((c) => <div key={c.id} className="rounded-[18px] bg-[var(--c-soft)] p-3.5 space-y-1.5" data-testid="payer-ask">
    <p className="m-0 text-[14px] font-extrabold" dir="auto">{tr("Added by itself: {t}", { t: c.title })}</p>
    <p className="m-0 text-[17px] font-black tabular-nums" dir="auto">{tr("{a} · every month on the {d}", { a: fmt(c.amount) + " " + (c.currency || ""), d: String(+String(c.start || "").slice(8, 10) || "") })}</p>
    <p className="m-0 text-[13px] font-bold pt-1">{tr("Who pays it?")}</p>
    {other !== c.id ? <div className="flex flex-wrap gap-1.5">
      <button onClick={() => save(c, "me")} className={BTN2} data-testid="payer-me">{tr("Me — take it from my balance")}</button>
      <button onClick={() => { setOther(c.id); setName(""); }} className={BTN} data-testid="payer-other">{tr("Someone else pays — remind me")}</button></div>
    : <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save(c, name.trim()); }}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} dir="auto" placeholder={tr("Who? e.g. My father")} className="flex-1 min-w-0 min-h-[42px] rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 text-[13.5px]" data-testid="payer-name" />
      <button type="submit" disabled={!name.trim()} className={BTN + " disabled:opacity-40"} data-testid="payer-save"><Check size={14} className="inline -mt-0.5 me-1" />{tr("Save")}</button></form>}
  </div>)}</div>;
}

/* ---- v9.9.18 M3 Split with anyone (Ali picked A — a group with settle-up). A trip, a flat, friends: the people, who paid what (shared
   by everyone or by the people ticked), the balances, and the FEWEST payments that settle everyone, to the smallest coin of the
   group's currency (groups.js, tested on 10,000 groups of 2–12 people in 30 currencies). "Share on WhatsApp" sends the summary as
   text; "Settled" clears it with a line in the group's history. Opens from Money → More and from "open split" in Chat. */
import React, { useState } from "react";
import { tr } from "./i18n.js";
import { balances, settle } from "./groups.js";
import { COUNTRIES, ALIASES, myCountry } from "./country.js";
const currencyOf = () => { try { const c = myCountry(); return (COUNTRIES[ALIASES[c] || c] || {}).cur || ""; } catch (e) { return ""; } };
import { card as kCard, btnP, btnS, inp, label } from "./ui-kit.jsx";
const card = kCard + " p-4";
export const GR_KEY = "attune:groups:v1";
export const loadGroups = () => { try { const v = JSON.parse(localStorage.getItem(GR_KEY) || "null"); return v && Array.isArray(v.groups) ? v : { groups: [] }; } catch (e) { return { groups: [] }; } };
const saveGroups = (v) => { try { localStorage.setItem(GR_KEY, JSON.stringify(v)); } catch (e) {} return v; };
const pill = (on) => "min-h-[40px] px-3.5 rounded-full border text-[13px] font-bold " + (on ? "bg-[var(--c-soft)] text-[var(--c-acc)] border-[var(--c-acc)]" : "border-[var(--c-ln)]");
const fmt = (n) => (+n).toLocaleString(undefined, { maximumFractionDigits: 3 });
const num = (v) => parseFloat(String(v || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[,\s]/g, ""));
const ME = "me";
const nameOf = (m) => (m === ME ? tr("You") : m);
/** "Karim pays you 2,250" / "You pay Nada 450" / "Omar pays Nada 300" */
export function payLine(p, cur) {
  const a = fmt(p.amount) + (cur ? " " + cur : "");
  return p.to === ME ? tr("{a} pays you {n}", { a: p.from, n: a }) : p.from === ME ? tr("You pay {b} {n}", { b: p.to, n: a }) : tr("{a} pays {b} {n}", { a: p.from, b: p.to, n: a });
}
export function summaryText(g) {
  const tot = g.expenses.reduce((a, e) => a + +e.amount, 0), pays = settle(g);
  return [g.name + " — " + tr("{n} people · total {t}", { n: g.members.length, t: fmt(tot) + " " + g.currency }),
    ...g.expenses.map((e) => "• " + e.what + ": " + fmt(e.amount) + " (" + tr("{p} paid", { p: nameOf(e.paidBy) }) + ")"), "",
    pays.length ? tr("To settle up · {n} payments", { n: pays.length }) : tr("Everyone is even"), ...pays.map((p) => "→ " + payLine(p, g.currency))].join("\n");
}

export function GroupsPage({ flash }) {
  const [st, setSt] = useState(loadGroups), [openId, setOpenId] = useState(null), [form, setForm] = useState(null), [add, setAdd] = useState(null);
  const put = (n) => setSt(saveGroups(n));
  const g = st.groups.find((x) => x.id === openId);
  const upd = (ng) => put({ ...st, groups: st.groups.map((x) => (x.id === ng.id ? ng : x)) });
  if (!g) return (
    <div className="calm space-y-3 text-[var(--c-ink)]" data-testid="groups-page">
      {st.groups.map((x) => { const pays = settle(x); return <button key={x.id} onClick={() => setOpenId(x.id)} className={card + " w-full text-start flex items-center justify-between"} data-testid="group-tile">
        <span><span className="block text-[15px] font-extrabold" dir="auto">{x.name}</span><span className="block text-[12.5px] text-[var(--c-mut)]">{tr("{n} people", { n: x.members.length })} · {pays.length ? tr("{n} payments to settle", { n: pays.length }) : tr("Everyone is even")}</span></span>
        <span className="text-[var(--c-acc)]">›</span></button>; })}
      {!form ? <button className={btnP + " w-full"} onClick={() => setForm({ name: "", people: "", currency: currencyOf() || "EGP" })} data-testid="group-new">{tr("New group")}</button> :
        <div className={card + " space-y-2"} data-testid="group-form">
          <p className={label}>{tr("New group")}</p>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tr("Name (Sahel trip, the flat…)")} className={inp} dir="auto" data-testid="group-name" />
          <input value={form.people} onChange={(e) => setForm({ ...form, people: e.target.value })} placeholder={tr("Who else? Names with commas")} className={inp} dir="auto" data-testid="group-people" />
          <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} className={inp} style={{ width: 96 }} dir="ltr" aria-label={tr("Currency")} data-testid="group-cur" />
          <div className="flex gap-2"><button className={btnP} data-testid="group-create" onClick={() => {
            const ppl = [...new Set(form.people.split(/[,،;\n]| and | و /).map((x) => x.trim()).filter(Boolean))].filter((x) => x !== ME);
            if (!form.name.trim() || !ppl.length) { flash && flash(tr("A name and at least one more person")); return; }
            const ng = { id: "g" + Date.now().toString(36), name: form.name.trim(), currency: form.currency || "EGP", members: [ME, ...ppl], expenses: [], log: [] };
            put({ groups: [ng, ...st.groups] }); setForm(null); setOpenId(ng.id); }}>{tr("Create")}</button>
            <button className={btnS} onClick={() => setForm(null)}>{tr("Cancel")}</button></div></div>}
    </div>);
  const tot = g.expenses.reduce((a, e) => a + +e.amount, 0), pays = settle(g), bal = balances(g);
  return (
    <div className="calm space-y-3 text-[var(--c-ink)]" data-testid="group-page">
      <button className="text-[13.5px] font-extrabold text-[var(--c-acc)] min-h-[40px]" onClick={() => setOpenId(null)}>‹ {tr("All groups")}</button>
      <div className={card + " space-y-1"} data-testid="group-expenses">
        <p className="m-0 text-[17px] font-black" dir="auto">{g.name}</p>
        <p className={label}>{tr("{n} people · total {t}", { n: g.members.length, t: fmt(tot) + " " + g.currency })}</p>
        {g.expenses.map((e) => <div key={e.id} className="flex items-center gap-2 min-h-[44px] border-t border-[var(--c-ln)] first-of-type:border-0" data-testid="group-exp">
          <span className="flex-1"><span className="block text-[14px] font-bold" dir="auto">{e.what}</span><span className="block text-[12px] text-[var(--c-mut)]">{tr("{p} paid", { p: nameOf(e.paidBy) })}{e.shares ? " · " + Object.keys(e.shares).map(nameOf).join(", ") : ""}</span></span>
          <span className="text-[14px] font-bold tabular-nums">{fmt(e.amount)}</span>
          <button className="min-h-[36px] px-2 text-[16px] text-[var(--c-mut)]" aria-label={tr("Delete")} onClick={() => upd({ ...g, expenses: g.expenses.filter((x) => x.id !== e.id) })}>×</button></div>)}
        {!g.expenses.length ? <p className="m-0 text-[13.5px] text-[var(--c-mut)]">{tr("No expenses yet.")}</p> : null}
      </div>
      {add ? <div className={card + " space-y-2"} data-testid="group-addbox">
        <input value={add.what} onChange={(e) => setAdd({ ...add, what: e.target.value })} placeholder={tr("What (villa, food, fuel…)")} className={inp} dir="auto" data-testid="gexp-what" />
        <input value={add.amount} onChange={(e) => setAdd({ ...add, amount: e.target.value })} placeholder={tr("Amount")} inputMode="decimal" className={inp} dir="ltr" data-testid="gexp-amount" />
        <p className={label}>{tr("Who paid")}</p>
        <div className="flex flex-wrap gap-1.5" data-testid="gexp-payer">{g.members.map((m) => <button key={m} type="button" className={pill(add.paidBy === m)} onClick={() => setAdd({ ...add, paidBy: m })}>{nameOf(m)}</button>)}</div>
        <p className={label}>{tr("Shared by")}</p>
        <div className="flex flex-wrap gap-1.5" data-testid="gexp-shared">{g.members.map((m) => { const on = add.who.includes(m); return <button key={m} type="button" className={pill(on)} aria-pressed={on} onClick={() => setAdd({ ...add, who: on ? add.who.filter((x) => x !== m) : [...add.who, m] })}>{nameOf(m)}</button>; })}</div>
        <div className="flex gap-2"><button className={btnP} data-testid="gexp-save" onClick={() => { const a = num(add.amount);
          if (!add.what.trim() || !(a > 0) || !add.who.length) { flash && flash(tr("What, how much and who shares it")); return; }
          const all = add.who.length === g.members.length;
          upd({ ...g, expenses: [...g.expenses, { id: "e" + Date.now().toString(36), what: add.what.trim(), amount: a, paidBy: add.paidBy, ...(all ? {} : { shares: Object.fromEntries(add.who.map((m) => [m, 1])) }), at: Date.now() }] }); setAdd(null); }}>{tr("Add")}</button>
          <button className={btnS} onClick={() => setAdd(null)}>{tr("Cancel")}</button></div></div> :
        <button className={btnS + " w-full"} onClick={() => setAdd({ what: "", amount: "", paidBy: ME, who: [...g.members] })} data-testid="group-add">+ {tr("Add expense")}</button>}
      <div className={card + " space-y-1"} data-testid="group-settle">
        <p className={label}>{pays.length ? tr("To settle up · {n} payments", { n: pays.length }) : tr("Everyone is even")}</p>
        {pays.map((p, i) => <p key={i} className="m-0 min-h-[40px] flex items-center gap-2 text-[14px] border-t border-[var(--c-ln)] first-of-type:border-0" data-testid="group-pay" dir="auto"><span className="text-[var(--c-acc)]">→</span>{payLine(p, g.currency)}</p>)}
        <details className="pt-1"><summary className="text-[12.5px] text-[var(--c-mut)] cursor-pointer">{tr("Balances")}</summary>
          {g.members.map((m) => <p key={m} className="m-0 text-[13px] flex justify-between" data-testid="group-bal"><span>{nameOf(m)}</span><span className="tabular-nums">{bal[m] > 0 ? "+" : ""}{fmt(bal[m])}</span></p>)}</details>
        <div className="flex flex-wrap gap-2 pt-2">
          <a className={btnP} href={"https://wa.me/?text=" + encodeURIComponent(summaryText(g))} target="_blank" rel="noopener" data-testid="group-share">{tr("Share on WhatsApp")}</a>
          {pays.length ? <button className={btnS} data-testid="group-settled" onClick={() => { upd({ ...g, expenses: [], log: [...(g.log || []), { at: Date.now(), text: summaryText(g) }].slice(-20) }); flash && flash(tr("Settled — the group starts fresh")); }}>{tr("Settled")}</button> : null}
        </div>
      </div>
    </div>);
}

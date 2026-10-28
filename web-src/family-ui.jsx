/* ---- v8.7 (persona 4, idea 13): the Family page — the shared list, who paid what (and who owes whom), reminders for the
   parents, and the family file that carries them to the other phones. Logic in family.js.                                    */
import React, { useState } from "react";
import { Users, Plus, Check, Send, Upload, ShoppingCart, Wallet, Bell, Trash2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as F from "./family.js";
import * as U from "./ui-kit.jsx";

const f0 = (n) => (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
const CODE_KEY = "attune:sync:family-code";   // this phone only (attune:sync:* never travels)
const toLocal = (t) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

export function FamilyPage({ flash, cur = "", remind }) {
  const [fam, setFam] = useState(() => F.loadFamily());
  const put = (f) => setFam(F.saveFamily(f));
  const [me, setMeName] = useState("");
  const [code, setCode] = useState(() => { try { return localStorage.getItem(CODE_KEY) || ""; } catch (e) { return ""; } });
  const [item, setItem] = useState("");
  const [amt, setAmt] = useState(""), [what, setWhat] = useState(""), [by, setBy] = useState("");
  const [rWho, setRWho] = useState(""), [rWhat, setRWhat] = useState(""), [rAt, setRAt] = useState(() => toLocal(Date.now() + 3600e3)), [rRep, setRRep] = useState("daily");
  const ar = getLang() === "ar";
  const name = (id) => (fam.members.find((m) => m.id === id) || {}).name || "";
  const list = F.listNow(fam), { moves } = F.balances(fam);

  if (!fam.me) return (
    <div className={U.page + " rounded-2xl p-4 md:p-6 space-y-3.5"} data-testid="family-page" data-view="setup">
      <h2 className={U.h1 + " flex items-center gap-2"}><Users size={20} className="c-acc" />{tr("Family")}</h2>
      <div className={U.cardPad + " space-y-2.5"}>
        <p className={"m-0 text-[13.5px] " + U.muted}>{tr("One shopping list, who paid what for the house, and reminders for your parents — shared with your family's phones only, locked with a family code. No account, no server.")}</p>
        <label className="block text-[13px] font-bold">{tr("Your name in the family")}<input className={U.inp + " mt-1"} value={me} onChange={(e) => setMeName(e.target.value)} placeholder={ar ? "علي" : "Ali"} data-testid="family-me" /></label>
        <button className={U.btnP + " w-full"} disabled={!me.trim()} onClick={() => put(F.setMe(fam, me))} data-testid="family-start">{tr("Start the family space")}</button>
      </div>
    </div>);

  const addItem = () => { const r = F.addItems(fam, item); if (r.added.length) { put(r.f); setItem(""); } };
  const addExp = () => { const f = F.addExpense(fam, { amount: +String(amt).replace(/,/g, ""), what, by: by || fam.me }); if (f !== fam) { put(f); setAmt(""); setWhat(""); } };
  const addRem = () => {
    const at = new Date(rAt).getTime(); if (!rWho.trim() || !rWhat.trim() || !(at > 0)) return;
    const f = F.addFamilyReminder(fam, { who: rWho, title: rWhat, at, repeat: rRep }); put(f);
    const r = f.reminders[f.reminders.length - 1];
    if (remind) remind({ id: "fam-" + r.id, at, title: `${r.forName}: ${r.title}`, body: "", repeat: rRep, created: Date.now(), source: "family" });
    setRWhat(""); flash && flash(tr("Reminder set — it goes to the family with the next file"));
  };
  const saveCode = (c) => { setCode(c); try { localStorage.setItem(CODE_KEY, c); } catch (e) {} };
  const send = async () => {
    if (code.trim().length < 6) { flash && flash(tr("Pick a family code of 6 letters or more first")); return; }
    const text = await F.packFamily(fam, code.trim()), file = "attune-family.attune";
    const call = typeof window !== "undefined" && window.__attuneNativeCall;
    try {
      if (call && window.AttuneNative) { await call("shareFile", { name: file, mime: "application/octet-stream", b64: btoa(unescape(encodeURIComponent(text))), text: tr("Our family list in Attune — open it in Attune with our family code.") }); return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" })); a.download = file; a.click();
    } catch (e) { flash && flash(String(e.message || e)); }
  };
  const open = async (file) => {
    if (!file) return;
    try { const g = await F.takeFamily(fam, await file.text(), code.trim()); put(g); flash && flash(tr("Family updated")); }
    catch (e) { flash && flash(tr(String(e.message || e))); }
  };

  return (
    <div className={U.page + " rounded-2xl p-4 md:p-6 space-y-3.5 lg:space-y-[18px]"} data-testid="family-page" data-view="main">
      <div className="flex items-end justify-between gap-3">
        <h2 className={U.h1 + " flex items-center gap-2"}><Users size={20} className="c-acc" />{tr("Family")}</h2>
        <span className={U.tag("blue")}>{fam.members.map((m) => m.name).join(" · ")}</span>
      </div>
      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:items-start">
        {/* the shared list */}
        <div className={U.cardPad + " space-y-2"} data-testid="family-list">
          <b className="flex items-center gap-1.5 font-extrabold text-[14.5px]"><ShoppingCart size={16} className="c-acc" />{tr("Shopping list")} · <span className="tabular-nums">{list.filter((x) => !x.done).length}</span></b>
          <div className="flex gap-2"><input className={U.inp} value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} placeholder={ar ? "لبن، عيش وبيض" : "milk, bread and eggs"} data-testid="family-item" />
            <button className={U.btnS} onClick={addItem} aria-label={tr("Add")} data-testid="family-item-add"><Plus size={16} /></button></div>
          {list.length ? <ul className="m-0 p-0 list-none space-y-1">{list.map((x) => (
            <li key={x.id}><button className="w-full min-h-[44px] flex items-center gap-2.5 text-start" onClick={() => put(F.tickItem(fam, x.id))} data-testid="family-item-row">
              <span className={"w-6 h-6 rounded-full border grid place-items-center shrink-0 " + (x.done ? "bg-[var(--c-acc)] border-transparent text-[var(--c-on-acc)]" : "border-[var(--c-ln)]")}>{x.done ? <Check size={14} /> : null}</span>
              <span className={"flex-1 text-[14px] font-semibold " + (x.done ? "line-through " + U.muted : "")} dir="auto">{x.what}</span>
              {x.by && x.by !== fam.me ? <span className={"text-[11.5px] " + U.muted}>{name(x.by)}</span> : null}</button></li>))}</ul>
            : <p className={"m-0 text-[13px] " + U.muted}>{tr("Empty — or say «add milk to the family list» in the Home box")}</p>}
          {list.some((x) => x.done) ? <button className={U.btnS + " " + U.muted} onClick={() => put(F.clearDone(fam))} data-testid="family-clear"><Trash2 size={14} />{tr("Clear the ticked")}</button> : null}
        </div>
        {/* who paid what */}
        <div className={U.cardPad + " space-y-2"} data-testid="family-money">
          <b className="flex items-center gap-1.5 font-extrabold text-[14.5px]"><Wallet size={16} className="c-acc" />{tr("House money")}</b>
          {moves.length ? <ul className="m-0 p-0 list-none space-y-1.5">{moves.map((m, i) => (
            <li key={i} className="flex items-center gap-2 text-[13.5px] font-semibold" data-testid="family-move"><span className="flex-1" dir="auto">{tr("{a} owes {b}", { a: m.fromName, b: m.toName })} <b className="tabular-nums">{f0(m.amount)} {cur}</b></span>
              <button className={U.btnS + " h-9! min-h-[36px]!"} onClick={() => put(F.settlePayment(fam, m.from, m.to, m.amount))} data-testid="family-settle">{tr("Paid")}</button></li>))}</ul>
            : <p className={"m-0 text-[13px] " + U.muted}>{fam.expenses.length ? tr("All square — nobody owes anybody.") : tr("Add what you paid for the house; Attune works out who owes whom.")}</p>}
          <div className="grid grid-cols-[1fr_1.4fr] gap-2"><input className={U.inp} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={tr("Amount")} data-testid="family-amount" />
            <input className={U.inp} value={what} onChange={(e) => setWhat(e.target.value)} placeholder={tr("For what")} data-testid="family-what" /></div>
          <div className="flex gap-2"><select className={U.inp} value={by || fam.me} onChange={(e) => setBy(e.target.value)} aria-label={tr("Paid by")} data-testid="family-by">{fam.members.map((m) => <option key={m.id} value={m.id}>{tr("Paid by {n}", { n: m.name })}</option>)}</select>
            <button className={U.btnS} onClick={addExp} data-testid="family-exp-add"><Plus size={16} /></button></div>
          {fam.members.length < 2 ? <p className={"m-0 text-[12.5px] " + U.muted}>{tr("Add the family below (a reminder for someone adds them too), or open a family file from their phone.")}</p> : null}
        </div>
        {/* reminders for the parents */}
        <div className={U.cardPad + " space-y-2"} data-testid="family-reminders">
          <b className="flex items-center gap-1.5 font-extrabold text-[14.5px]"><Bell size={16} className="c-acc" />{tr("Reminders for the family")}</b>
          {fam.reminders.slice(-5).map((r) => <div key={r.id} className="text-[13px] font-semibold" dir="auto">{r.forName}: {r.title} · <span className={U.muted}>{new Date(r.at).toLocaleTimeString(ar ? "ar-EG" : undefined, { hour: "numeric", minute: "2-digit" })}</span></div>)}
          <div className="grid grid-cols-[1fr_1.6fr] gap-2"><input className={U.inp} value={rWho} onChange={(e) => setRWho(e.target.value)} placeholder={ar ? "بابا" : "Dad"} data-testid="family-rem-who" />
            <input className={U.inp} value={rWhat} onChange={(e) => setRWhat(e.target.value)} placeholder={tr("Take the pills")} data-testid="family-rem-what" /></div>
          <div className="flex gap-2"><input type="datetime-local" className={U.inp} value={rAt} onChange={(e) => setRAt(e.target.value)} aria-label={tr("When")} />
            <select className={U.inp + " w-auto!"} value={rRep} onChange={(e) => setRRep(e.target.value)} aria-label={tr("Repeat")}><option value="none">{tr("Once")}</option><option value="daily">{tr("Every day")}</option><option value="weekly">{tr("Every week")}</option></select>
            <button className={U.btnS} onClick={addRem} data-testid="family-rem-add"><Plus size={16} /></button></div>
        </div>
      </div>
      {/* the family file */}
      <div className={U.cardPad + " space-y-2"} data-testid="family-share">
        <b className="font-extrabold text-[14.5px]">{tr("Share with the family")}</b>
        <p className={"m-0 text-[12.5px] " + U.muted}>{tr("The list, the house money and the reminders — nothing else — locked with your family code. Send the file (WhatsApp, anything); on their phone: Family → Open a family file. Each phone keeps both sides.")}</p>
        <input className={U.inp} value={code} onChange={(e) => saveCode(e.target.value)} placeholder={tr("Family code (the same on every phone)")} data-testid="family-code" />
        <div className="flex flex-wrap gap-2">
          <button className={U.btnP} onClick={send} data-testid="family-send"><Send size={15} />{tr("Send to the family")}</button>
          <label className={U.btnS + " cursor-pointer"} data-testid="family-open"><Upload size={15} />{tr("Open a family file")}<input type="file" className="hidden" accept=".attune,application/octet-stream,*/*" onChange={(e) => { open(e.target.files && e.target.files[0]); e.target.value = ""; }} data-testid="family-open-file" /></label>
        </div>
      </div>
    </div>);
}

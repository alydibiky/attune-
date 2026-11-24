/* ---- v10.9.7 the first minute (Ali's OK-FM, 24 Nov 2026 — https://claude.ai/artifact/SRbHba7CwMVSndiLqD7LX7):
   S1 one question, two sources (bank & wallet messages + Gmail, both on) · S2 reading · S3 the month + the yearly subscriptions number,
   every line with where it came from and ✎, "Check this one" for anything not sure · S4 ✎ fixes anything (learned per sender) ·
   S5 what next, after the win. "Not now — let me type" = the Home box's Organise this (Ali: "isn't this already in the app?").
   Gmail is then read by itself every 3 hours (gmail.js gmailDue; Ali: "read automatically"). firstmin.js does the reading. */
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Pencil, Check, Mail, MessageSquare, Loader2 } from "lucide-react";
import { tr, dateLocale } from "./i18n.js";
import * as FM from "./firstmin.js";
import { readGmail, loadGmail } from "./gmail.js";
import { appendToLedger, alreadyIn } from "./paylog.js";
import { markDone, payReader, smsInboxState } from "./paylog-ui.jsx";
import { loadLedger } from "./myledger.js";
import { starterLedger } from "./doit.js";
import { loadRadar, saveRadar, addDeadline, isoDay } from "./deadlines.js";
import { homeCurrency } from "./locale.js";

const DAY = 864e5;
const fmt = (v, cur) => `${(Math.round(v * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${cur || ""}`.trim();
const CATS = ["food", "groceries", "shopping", "transport", "bills", "subscriptions", "health", "other"];
const CAT_EN = { food: "Food", groceries: "Groceries", shopping: "Shopping", transport: "Transport", bills: "Bills", subscriptions: "Subscriptions", health: "Health", other: "Other" };
const SRC = { sms: "SMS", gmail: "Gmail" };
const day = (iso) => { try { return iso ? new Date(iso + "T12:00:00").toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }) : "—"; } catch (e) { return iso || "—"; } };
const btn = "min-h-[48px] rounded-full font-extrabold text-[15.5px] px-5";
const solid = btn + " bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))]";
const ghost = btn + " border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)]";
const card = "rounded-[16px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3.5 space-y-1.5";
const lbl = "block text-[11.5px] font-extrabold uppercase tracking-[0.08em] c-sub";

/** The phone's money messages of the last 31 days: the old SMS (the full APK) + the bank notifications kept since access was given. */
async function phoneMessages(N, askSms) {
  const out = [], seen = new Set(), add = (x) => { if (x && x.id && !seen.has(x.id)) { seen.add(x.id); out.push(x); } };
  if (N && N.smsInboxMoney) {
    let ok = smsInboxState(N).granted;
    if (!ok && askSms) ok = await new Promise((res) => { const on = (e) => { window.removeEventListener("attune-sms-perm", on); res(!!e.detail); }; window.addEventListener("attune-sms-perm", on); try { N.smsInboxAsk(); } catch (e) { window.removeEventListener("attune-sms-perm", on); res(false); } setTimeout(() => res(false), 60000); });
    if (ok) { try { for (const m of JSON.parse(N.smsInboxMoney(31) || "[]")) add({ pkg: "sms", app: "Messages", ...m }); } catch (e) {} }
  }
  if (payReader(N)) { try { for (const m of JSON.parse(N.payQueue() || "[]")) add(m); } catch (e) {} }
  return out;
}

export function MoneyFirstMinute({ native: N, nativeCall, onClose, onType, navTo }) {
  const home = useMemo(() => { try { return homeCurrency(null) || "EGP"; } catch (e) { return "EGP"; } }, []);
  const canSms = !!(N && (N.smsInboxMoney || payReader(N))), canGmail = !!(N && typeof N.gmailRead === "function" && nativeCall);
  const [useSms, setUseSms] = useState(canSms), [useGmail, setUseGmail] = useState(canGmail);
  const [step, setStep] = useState("ask"), [got, setGot] = useState({ sms: [], emails: [], note: "" });
  const [learn, setLearn] = useState(() => FM.loadLearn());
  const [edit, setEdit] = useState(null), [showMsg, setShowMsg] = useState(false), [saved, setSaved] = useState(null);
  const res = useMemo(() => (step === "ask" || step === "reading" ? null : FM.firstMonth({ sms: got.sms, emails: got.emails, now: Date.now(), home, learn, fix: got.fix || {} })), [got, learn, step, home]);
  const putLearn = (l) => { setLearn(l); FM.saveLearn(l); };

  const read = async () => {
    setStep("reading");
    let sms = [], emails = [], note = "";
    if (useSms && canSms) sms = await phoneMessages(N, true);
    if (useGmail && canGmail) { try { const g = await readGmail(nativeCall, { days: loadGmail().last ? 31 : 365, raw: true }); emails = g.emails || []; } catch (e) { note = "gmail"; } }
    setGot({ sms, emails, note }); setStep("month");
  };

  // S3 "All right ✓": this month's sure payments into Money (once — never what Money already has), the plans into Dates as renewals
  const saveAll = () => {
    if (!res) return;
    const before = { led: localStorage.getItem("ledger.v3"), radar: localStorage.getItem("attune:radar:v1") };
    let led = loadLedger() || starterLedger(); const have = new Set((led.txns || []).map((t) => t.nid).filter(Boolean));
    const txns = [];
    for (const l of [...res.spend, ...res.subs]) {
      if (l.unsure || Date.now() - l.ts > 31 * DAY) continue;
      const nid = "fm:" + l.ids.join("+"); if (have.has(nid)) continue;
      const e = { amount: l.amount, currency: l.cur, direction: "out", ts: l.ts, party: l.name, text: l.full || "" };
      try { if (alreadyIn(e, led)) continue; } catch (er) {}
      // (a dollar plan goes into Money in pounds when the person's own rate is known — "Claude · 22.80 USD" — never a pound account holding dollars)
      const inHome = l.cur !== home && l.home != null;
      txns.push({ nid, type: "expense", amount: inHome ? l.home : l.amount, currency: inHome ? home : l.cur, cat: l.cat || "other", note: (inHome ? `${l.name} · ${fmt(l.amount, l.cur)}` : l.name).slice(0, 80), date: isoDay(l.ts), source: "notification", ts: l.ts,
        evidence: { app: l.src.map((x) => SRC[x]).join(" + "), from: (l.from || "").slice(0, 200), text: (l.full || "").slice(0, 2000), at: l.ts } });
    }
    // (W6: a refund this month → income, with the message it came from)
    for (const f of res.refunds || []) { if (Date.now() - f.ts > 31 * DAY) continue; const nid = "fm:" + f.ids.join("+"); if (have.has(nid)) continue;
      txns.push({ nid, type: "income", amount: f.amount, currency: f.cur, cat: "other", note: (f.name + " ↩").slice(0, 80), date: isoDay(f.ts), source: "notification", ts: f.ts,
        evidence: { app: "SMS", from: (f.from || "").slice(0, 200), text: (f.full || "").slice(0, 2000), at: f.ts } }); }
    const r = appendToLedger(led, txns);
    try { localStorage.setItem("ledger.v3", JSON.stringify(r.ledger)); } catch (e) {}
    let radar = loadRadar(), plans = 0;
    for (const s of res.subs) {
      if (s.unsure) continue;
      const next = s.next || isoDay(new Date(s.ts).setMonth(new Date(s.ts).getMonth() + (s.cycle === "year" ? 12 : s.cycle === "quarter" ? 3 : 1)));
      const a = addDeadline(radar, { kind: "renewal", title: s.name, date: next, amount: s.amount, currency: s.cur, source: "firstmin", note: tr("Read from {s}", { s: s.src.map((x) => SRC[x]).join(" + ") }) });
      if (!a.dup) { radar = a.data; plans++; }
    }
    for (const b of res.bills) { const sameAns = learn[b.key] && learn[b.key].billSame; if (sameAns || !b.due) continue;
      const a = addDeadline(radar, { kind: "bill", title: b.name, date: b.due, amount: b.amount, currency: b.cur, source: "firstmin" }); if (!a.dup) radar = a.data; }
    saveRadar(radar);
    try { markDone(N, got.sms.map((m) => m.id)); localStorage.setItem(FM.FM_DONE_KEY, String(Date.now())); } catch (e) {}
    setSaved({ n: r.ids.length, plans, before }); setStep("next");
  };
  const undo = () => { if (!saved) return; try { saved.before.led == null ? localStorage.removeItem("ledger.v3") : localStorage.setItem("ledger.v3", saved.before.led); saved.before.radar == null ? localStorage.removeItem("attune:radar:v1") : localStorage.setItem("attune:radar:v1", saved.before.radar); } catch (e) {} setSaved(null); setStep("month"); };

  const shell = (body, foot) => <div role="dialog" aria-modal="true" className="calm fixed inset-0 z-[61] bg-[var(--c-bg)] flex items-stretch sm:items-center justify-center" data-testid="fm" data-step={step}>
    <div className="calm w-full max-w-lg flex flex-col p-5 pt-[max(20px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] text-[var(--c-ink)] min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">{body}</div>
      {foot ? <div className="pt-3 space-y-2">{foot}</div> : null}
    </div></div>;

  if (step === "ask") return shell(<>
    <h2 className="m-0 text-[26px] font-black leading-tight pt-4">{tr("Let Attune organise your money?")}</h2>
    <p className="m-0 text-[14px] c-sub">{tr("Read on this phone only. Nothing is sent anywhere.")}</p>
    {[["sms", MessageSquare, "Bank & wallet messages", "CIB, InstaPay, Vodafone Cash…", useSms, setUseSms, canSms], ["gmail", Mail, "Gmail receipts & bills", "Google Play, PayPal, Stripe, invoices. Only money emails are kept.", useGmail, setUseGmail, canGmail]].map(([k, I, t, d, on, set, can]) =>
      <button key={k} onClick={() => can && set(!on)} disabled={!can} aria-pressed={on && can} data-testid={"fm-src-" + k} className={card + " w-full text-start flex items-center gap-3 " + (can ? "" : "opacity-60")}>
        <I size={22} className="c-acc shrink-0" /><span className="flex-1 min-w-0"><b className="block text-[15px]">{tr(t)}</b><span className="block text-[12.5px] c-sub">{can ? tr(d) : tr("On your phone, in the Attune app")}</span></span>
        <span className={"text-[13px] font-extrabold " + (on && can ? "text-[var(--c-pos,#2F6B4F)]" : "c-sub")}>{on && can ? "● " + tr("On") : tr("Off")}</span></button>)}
  </>, <>
    <button onClick={read} disabled={!(useSms && canSms) && !(useGmail && canGmail)} className={solid + " w-full disabled:opacity-50"} data-testid="fm-go">{tr("Show my month")}</button>
    <button onClick={onType} className={ghost + " w-full"} data-testid="fm-type">{tr("Not now — let me type")}</button></>);

  if (step === "reading" || !res) return shell(<>
    <h2 className="m-0 text-[24px] font-black leading-tight pt-4">{tr("Reading the last 30 days")}</h2>
    <div className={card}><span className="flex items-center gap-2 text-[14px]"><Loader2 size={16} className="animate-spin c-acc" />{tr("Each amount is read from the message itself and checked against the total, the currency and the date. Anything not sure is shown to you, not saved.")}</span></div>
  </>, null);

  const srcChips = (l) => <span className="inline-flex gap-1 ms-1 align-middle">{l.src.map((x) => <span key={x} className="text-[10px] font-extrabold rounded-md px-1.5 py-[1px] border border-[var(--c-ln)] c-sub">{SRC[x]}</span>)}</span>;
  const row = (l) => <div key={l.id} className="flex items-center gap-2 min-h-[40px]" data-testid="fm-line" data-kind={l.kind}>
    <span className="flex-1 min-w-0 text-[14px] truncate" dir="auto"><b>{l.name}</b>{srcChips(l)}</span>
    <span className="tabular-nums text-[14px] font-bold shrink-0" dir="ltr">{l.cur !== home && l.home != null ? fmt(l.home, home) : fmt(l.amount, l.cur)}</span>
    <button onClick={() => { setEdit({ ...l }); setShowMsg(false); setStep("edit"); }} aria-label={tr("Change")} className="w-10 h-10 grid place-items-center c-acc shrink-0" data-testid="fm-edit"><Pencil size={15} /></button></div>;

  if (step === "edit" && edit) {
    const upd = (p) => setEdit({ ...edit, ...p });
    const save = (extra = {}) => {
      putLearn(FM.fixLine(learn, edit, { name: edit.name, cat: edit.cat, sub: edit.kind === "sub", cycle: edit.kind === "sub" ? edit.cycle || "month" : undefined, ...extra }));
      // a changed amount is the person's — it replaces what was read for this line
      if (edit.amountEdit != null && edit.amountEdit !== "" && +edit.amountEdit > 0) setGot((g) => ({ ...g, fix: { ...(g.fix || {}), [edit.id]: +edit.amountEdit } }));
      setEdit(null); setStep("month"); };
    const field = (t, el) => <label className="block space-y-1"><span className={lbl}>{tr(t)}</span>{el}</label>;
    const inp = "w-full min-h-[46px] rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 text-[15px] font-semibold";
    return shell(<>
      <div className="flex items-center gap-2 pt-1"><button onClick={() => { setEdit(null); setStep("month"); }} aria-label={tr("Back")} className="w-11 h-11 grid place-items-center"><ChevronLeft size={22} className="rtl:rotate-180" /></button><h2 className="m-0 text-[22px] font-black">{tr("Is this right?")}</h2></div>
      {field("Name", <input value={edit.name} onChange={(e) => upd({ name: e.target.value })} className={inp} dir="auto" data-testid="fm-edit-name" />)}
      {field("Amount", <div className="flex gap-2"><input inputMode="decimal" value={edit.amountEdit != null ? edit.amountEdit : String(edit.amount)} onChange={(e) => upd({ amountEdit: e.target.value.replace(/[^\d.]/g, "") })} className={inp + " tabular-nums"} dir="ltr" data-testid="fm-edit-amount" /><span className="min-h-[46px] grid place-items-center px-3 rounded-[12px] border border-[var(--c-ln)] font-bold">{edit.cur}</span></div>)}
      {edit.cur !== home && edit.home != null ? <p className="m-0 text-[12.5px] c-sub" dir="ltr">= {fmt(edit.home, home)}</p> : null}
      {field("Every", <div className="flex gap-1.5 flex-wrap">{[["spend", "Once"], ["month", "Month"], ["year", "Year"], ["week", "Week"]].map(([k, t]) => { const on = k === "spend" ? edit.kind !== "sub" : edit.kind === "sub" && (edit.cycle || "month") === k;
        return <button key={k} onClick={() => upd(k === "spend" ? { kind: "spend" } : { kind: "sub", cycle: k })} aria-pressed={on} className={"min-h-[40px] px-4 rounded-full border text-[13.5px] font-bold " + (on ? "border-[var(--c-acc)] bg-[var(--c-soft)] c-acc" : "border-[var(--c-ln)]")} data-testid={"fm-edit-every-" + k}>{tr(t)}</button>; })}</div>)}
      {edit.kind === "sub" && edit.next ? <p className="m-0 text-[13px] c-sub">{tr("Renews {d}", { d: day(edit.next) })}</p> : null}
      {field("Category", <select value={edit.cat || "other"} onChange={(e) => upd({ cat: e.target.value })} className={inp} data-testid="fm-edit-cat">{CATS.map((c) => <option key={c} value={c}>{tr(CAT_EN[c])}</option>)}</select>)}
      {edit.last4 ? <p className="m-0 text-[13px] c-sub" dir="auto">{tr("Card")} ··{edit.last4}</p> : null}
      <button onClick={() => setShowMsg(!showMsg)} className={ghost + " w-full"} data-testid="fm-edit-show">{edit.src.includes("gmail") ? tr("Show the email it came from") : tr("Show the message it came from")}</button>
      {showMsg ? <pre className="m-0 whitespace-pre-wrap text-[12.5px] rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3 max-h-[220px] overflow-auto" dir="auto" data-testid="fm-edit-msg">{[edit.from, edit.title, edit.full].filter(Boolean).join("\n")}</pre> : null}
      <div className="flex gap-2 flex-wrap">
        {edit.kind === "sub" ? <button onClick={() => save({ sub: false })} className={ghost} data-testid="fm-edit-notsub">{tr("Not a subscription")}</button> : null}
        <button onClick={() => save({ notMine: true })} className={ghost} data-testid="fm-edit-notmine">{tr("Not mine")}</button></div>
      <p className="m-0 text-[12.5px] c-sub">{tr("Attune learns: the next message from the same sender is read the same way.")}</p>
    </>, <button onClick={() => save()} className={solid + " w-full"} data-testid="fm-edit-save">{tr("Save")}</button>);
  }

  if (step === "next") return shell(<>
    <h2 className="m-0 text-[26px] font-black leading-tight pt-4" data-testid="fm-done">{tr("Your month is organised.")}</h2>
    <p className="m-0 text-[14px] c-sub">{saved ? tr("{n} payments in Money · {p} plans in Dates", { n: saved.n, p: saved.plans }) : ""} <button onClick={undo} className="font-extrabold c-acc" data-testid="fm-undo">{tr("Undo")}</button></p>
    <p className="m-0 text-[14px] c-sub">{tr("Want Attune to do one more? (any time later from Home)")}</p>
    {[["life", "🤝", "Who owes me", "Debts and instalments — a tick box on each payment day"], ["radar", "📄", "Papers and their dates", "Passport, ID, car licence — a photo each"], ["passwords", "🔑", "Passwords", "Paste your page, kept locked"]].map(([m, ic, t, d]) =>
      <button key={m} onClick={() => { onClose(); navTo && navTo(m); }} className={card + " w-full text-start flex items-center gap-3"} data-testid={"fm-next-" + m}><span className="text-[24px]">{ic}</span><span className="flex-1 min-w-0"><b className="block text-[15px]">{tr(t)}</b><span className="block text-[12.5px] c-sub">{tr(d)}</span></span></button>)}
  </>, <button onClick={() => { onClose(); navTo && navTo("home"); }} className={ghost + " w-full"} data-testid="fm-home">{tr("Later — take me Home")}</button>);

  // S3 the month
  const ask = res.check, asked = new Set(ask.map((c) => c.with).filter(Boolean));   // (the line a question is about shows once, in the question)
  const subs = res.subs.filter((l) => !asked.has(l.id)), spend = res.spend.filter((l) => !asked.has(l.id)), total = res.total, foreign = Object.entries(res.foreign);
  const answer = (c, a) => {
    if (c.q === "same") { const sib = [...res.spend, ...res.subs].find((x) => x.id === c.with); let l = FM.fixLine(learn, c.line, { billSame: a });
      if (a && sib) l = FM.fixLine(l, sib, { sub: true, cycle: "month" }); putLearn(l); }
    else putLearn(FM.fixLine(learn, c.line, a === "cycle-year" ? { sub: true, cycle: "year" } : a === "cycle-month" ? { sub: true, cycle: "month" } : {}));
  };
  const empty = !spend.length && !subs.length && !res.bills.length;
  return shell(<>
    <div className={card} data-testid="fm-total"><span className={lbl}>{tr("This month so far")}</span>
      <span className="block text-[28px] font-black tabular-nums" dir="ltr">{fmt(total, home)}</span>
      {foreign.length ? <span className="block text-[13px] c-sub" dir="ltr">+ {foreign.map(([c, v]) => fmt(v, c)).join(" + ")}</span> : null}
      <span className="block text-[12.5px] c-sub">{tr("from {s} messages and {e} emails — nothing typed", { s: res.counts.sms, e: res.counts.emails })}{res.counts.joined ? " · " + tr("{n} found in both, counted once", { n: res.counts.joined }) : ""}</span></div>
    {empty ? <div className={card} data-testid="fm-empty"><b className="block text-[15px]">{tr("No payments found in the last 30 days")}</b><span className="block text-[13px] c-sub">{got.note === "gmail" ? tr("Gmail could not be read — you can connect it later from Money.") : tr("New bank messages are read as they arrive, from now on.")}</span></div> : null}
    {ask.map((c) => <div key={c.id} className={card + " border-[#C98A1B] bg-[color-mix(in_srgb,#C98A1B_10%,var(--c-surf))]"} data-testid="fm-check" data-q={c.q}>
      <span className={lbl + " !text-[#9A6A12]"}>{tr("Check this one")}</span>
      {row(c.q === "same" ? [...res.spend, ...res.subs].find((x) => x.id === c.with) || c.line : c.line)}
      <p className="m-0 text-[13.5px]" dir="auto">{c.q === "same" ? tr("{n} also sent an invoice for {a} (due {d}). Is it the same plan?", { n: c.line.name, a: fmt(c.line.amount, c.line.cur), d: day(c.line.due) })
        : c.q === "cycle" ? tr("How often is {n} paid?", { n: c.line.name }) : tr("Is this amount right?")}</p>
      <div className="flex gap-2 flex-wrap">{(c.q === "same" ? [[true, "Yes, same"], [false, "No, two"]] : c.q === "cycle" ? [["cycle-month", "Every month"], ["cycle-year", "Every year"]] : [["ok", "Right ✓"]]).map(([a, t]) =>
        <button key={String(a)} onClick={() => answer(c, a)} className="min-h-[40px] px-4 rounded-full border border-[var(--c-ln)] bg-[var(--c-soft)] c-acc text-[13.5px] font-extrabold" data-testid="fm-check-answer">{tr(t)}</button>)}</div></div>)}
    {subs.length ? <div className={card} data-testid="fm-subs"><span className={lbl}>{tr("Subscriptions · {y} a year", { y: fmt(res.subsYearly, home) })}</span>
      <span className="block text-[12.5px] c-sub">{tr("{m} a month", { m: fmt(res.subsMonthly, home) })}</span>{subs.filter((l) => !l.unsure).map(row)}</div> : null}
    {(res.refunds || []).length ? <div className={card} data-testid="fm-refunds"><span className={lbl}>{tr("Back to you · added to income")}</span>
      {res.refunds.slice(0, 10).map((f) => <div key={f.id} className="flex items-center gap-2 min-h-[40px]" data-testid="fm-refund"><span className="flex-1 min-w-0 truncate font-bold" dir="auto">{f.name}</span><span className="font-extrabold tabular-nums text-[var(--c-pos,#2F6B4F)]" dir="ltr">+{fmt(f.amount, f.cur)}</span></div>)}</div> : null}
    {spend.filter((l) => !l.unsure).length ? <div className={card} data-testid="fm-spend"><span className={lbl}>{tr("Also")}</span>{spend.filter((l) => !l.unsure).slice(0, 30).map(row)}</div> : null}
  </>, <>
    <button onClick={saveAll} disabled={ask.length > 0 || empty} className={solid + " w-full disabled:opacity-50"} data-testid="fm-ok">{ask.length ? tr("Answer the questions above first") : tr("All right ✓")}</button>
    <button onClick={onType} className="min-h-[40px] w-full text-[13.5px] font-bold c-sub" data-testid="fm-skip">{tr("Not now — let me type")}</button></>);
}

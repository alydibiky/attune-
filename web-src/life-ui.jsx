/* ---- v6.27: "People & plans" — the Life layer's page, in design A "Calm" (phone and computer) --------------------------------
   Type it the way you'd say it («أحمد عليه ١٢ ألف، ألف كل شهر لمدة سنة», "Netflix 200 every month", "جمعية ٢٠٠٠ في الشهر…") →
   read by code (life.js parseLife; the phone's model only if the rules can't, and only when one is loaded) → a preview to
   check → saved. Each commitment shows its payments as checkboxes; ticking one offers to add it to Money (the same
   sentence Money reads from a bank message, confirmed there). Tests: tests/e2e_v727life.py.                                    */
import React, { useMemo, useState } from "react";
import { Users, Check, Trash2, Wallet, Sparkles, X, ChevronDown } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { parseLife, progressOf, tickText, loadLife, saveLife, addCommitment, togglePaid, removeCommitment, dueSoon, payAmount, askToday, skipDay, lifeModelPrompt, readLifeModel, nextReminder, isOpenLoan } from "./life.js";
import { fmt } from "./money-calm.js";
import { loadGuardian, saveGuardian, collected } from "./guardian.js";
import { LEFT, RIGHT, DeskEmpty } from "./desk.jsx";
// v6.32: the same box also reads a bill to split, gold/currency you keep, and the car (plans-ui.jsx)
import { parseSplit, splitToCommitments } from "./split.js";
import { parseHolding, loadGold, saveGold, addHolding } from "./gold.js";
import { parseCar, loadCar, saveCar, addCarEntry, carMoneyText } from "./car.js";
import { loadRadar, saveRadar, addDeadline, radarReminder } from "./deadlines.js";
import { PlanDraft, GoldCard, CarCard } from "./plans-ui.jsx";
import { tickRegular } from "./regular.js";
import * as U from "./ui-kit.jsx";

const KIND = { installment: "Installments", debt: "Money between people", circle: "Savings circle", bill: "Bill", rent: "Rent", subscription: "Subscription", regular: "Comes regularly" };
// v6.27 computer layout A: a narrower left panel here, so the commitments on the right fit two cards side by side
const PANES_N = "lg:grid lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:gap-6 lg:items-start";
const EVERY = { month: "a month", week: "a week", year: "a year" };

// v7.2 tick labels: "Oct" for a monthly payment, "Sat 24" for a weekly one; amounts short ("1k")
const tickDay = (d, weekly) => { try { const x = new Date(d + "T12:00:00"); return x.toLocaleDateString(undefined, weekly ? { weekday: "short", day: "numeric" } : { month: "short", year: x.getFullYear() !== new Date().getFullYear() ? "2-digit" : undefined }); } catch (e) { return d.slice(5); } };
const short = (n) => (n >= 1000 && n % 100 === 0 ? (n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "k" : fmt(n));
function describe(c) {
  const per = c.every ? " " + tr(EVERY[c.every]) : "";
  if (c.kind === "installment") return tr("{a} {cur}{per} · {n} payments · {t} in all", { a: fmt(c.amount), cur: c.currency, per, n: c.count, t: fmt(c.total) });
  if (c.kind === "circle") return tr("{a} {cur}{per} · {n} months", { a: fmt(c.amount), cur: c.currency, per, n: c.count }) + (c.myTurn ? " · " + tr("your turn: {k}", { k: c.myTurn }) : "");
  if (c.kind === "debt") return fmt(c.amount) + " " + c.currency;
  if (c.kind === "regular") return tr("{a} {cur} each time · {when}", { a: fmt(c.amount), cur: c.currency, when: c.every === "week" && c.start ? tr("every {d}", { d: new Date(c.start + "T12:00:00").toLocaleDateString(undefined, { weekday: "long" }) }) : tr(EVERY[c.every] || "a week") }) + " · " + tr("tick the day — it goes into Money by itself");
  return fmt(c.amount) + " " + c.currency + per;
}
function heading(c) {
  if (c.kind === "debt" || c.kind === "installment") {
    if (c.person) return c.dir === "in" ? tr("{p} owes you", { p: c.person }) : tr("You owe {p}", { p: c.person });
    return tr(c.title ? c.title[0].toUpperCase() + c.title.slice(1) : KIND[c.kind]) + (c.kind === "installment" ? " · " + tr("installments") : "");
  }
  return (c.title ? c.title[0].toUpperCase() + c.title.slice(1) : tr(KIND[c.kind]));
}

/** "How much did Sheikh pay?" — the amount really paid (prefilled with what was due); the rest is worked out again. */
export function PayBox({ c, ed, setEd, onPay }) {
  return <form onSubmit={(e) => { e.preventDefault(); const v = +String(ed.v).replace(/[^\d.]/g, ""); if (v >= 0) { onPay(c, ed.i, v); setEd(null); } }} className="mt-2.5 rounded-[14px] border border-[var(--c-acc)] bg-[var(--c-soft)] p-2.5 space-y-2" data-testid="life-paybox">
    <p className="m-0 text-[13px] font-bold" dir="auto">{c.dir === "in" ? tr("How much did {p} pay?", { p: c.person }) : tr("How much did you pay {p}?", { p: c.person })}</p>
    <div className="flex gap-2"><input value={ed.v} onChange={(e) => setEd({ ...ed, v: e.target.value })} inputMode="decimal" className={"flex-1 min-w-0 min-h-[44px] rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 text-[15px] tabular-nums"} data-testid="life-pay-amount" autoFocus />
      <button type="submit" className="min-h-[44px] px-4 rounded-[12px] bg-[var(--c-acc)] text-[var(--c-on-acc)] font-extrabold text-[13px]" data-testid="life-pay-go">{tr("Paid")}</button>
      <button type="button" onClick={() => setEd(null)} className="min-h-[44px] px-3 rounded-[12px] border border-[var(--c-ln)] text-[13px] font-bold">{tr("Cancel")}</button></div>
    <p className="m-0 text-[11.5px] text-[var(--c-mut)]">{tr("More or less than due? Type what came — the rest is spread over the payments left.")}</p>
  </form>;
}
const todayIso = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const longDay = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(getLang() === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return iso; } };
// persona 9 (Ali picked H-C 1): Sara borrowed four times — one card for Sara with what she owes in all, her loans inside
const pkey = (c) => String(c.person || "").replace(/[أإآ]/g, "ا").replace(/ة$/, "ه").toLowerCase().trim() + "|" + c.dir;
function byPerson(items) { const m = new Map(); for (const c of items) { const k = c.person ? pkey(c) : c.id; m.set(k, [...(m.get(k) || []), c]); } return [...m.values()]; }
function PersonCard({ list, onTick, onRemove, onPay }) {
  const [open, setOpen] = useState(false);
  const c0 = list[0], left = list.reduce((a, c) => a + (progressOf(c).left || 0), 0);
  return (
    <div className={U.cardPad} data-testid="life-person">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-start gap-3 text-start">
        <span className="w-10 h-10 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><Users size={17} /></span>
        <div className="flex-1 min-w-0"><b className="block font-extrabold text-[14.5px]" dir="auto">{heading(c0)}</b>
          <div className={"text-[12.5px] " + U.muted}>{tr("{n} loans", { n: list.length })} · {open ? tr("Hide them") : tr("See each one")}</div></div>
        <div className="text-end"><span className={U.label}>{tr("Left")}</span><div className="tabular-nums font-black text-[17px]" dir="ltr">{fmt(left)}</div></div>
        <ChevronDown size={16} className={"mt-3 shrink-0 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open ? <div className="mt-3 space-y-2" data-testid="life-person-list">{list.map((c) => <Item key={c.id} c={c} onTick={onTick} onRemove={onRemove} onPay={onPay} />)}</div> : null}
    </div>);
}
function Item({ c, onTick, onRemove, onPay }) {
  const pr = useMemo(() => progressOf(c), [c]);
  // v8.3 (Ali: "write what he actually paid and it reschedules the rest"): a person's payment asks how much came first
  const [ed, setEd] = useState(null);   // { i, v }
  const [open, setOpen] = useState(false);
  const asks = !!(onPay && c.person && ["debt", "installment"].includes(c.kind));
  const tap = (i, paid, amount) => (asks && !paid ? setEd({ i, v: String(amount) }) : onTick(c, i, !paid));
  // a regular (the maid every Saturday): the last few days and the next one — ticked = she came, and it's in Money
  const show = c.kind === "regular" ? pr.schedule.slice(Math.max(0, pr.schedule.length - 6)) : pr.schedule.slice(0, 24);
  return (
    <div className={U.cardPad} data-testid="life-item">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><Users size={17} /></span>
        <div className="flex-1 min-w-0">
          <b className="block font-extrabold text-[14.5px]" dir="auto">{heading(c)}</b>
          <div className={"text-[12.5px] " + U.muted} dir="auto">{describe(c)}{isOpenLoan(c) ? " · " + tr("open — no date") : ""}</div>
        </div>
        {pr.left != null ? <div className="text-end"><span className={U.label}>{tr("Left")}</span><div className="tabular-nums font-black text-[17px]" dir="ltr">{fmt(pr.left)}</div></div> : null}
        <button onClick={() => onRemove(c)} aria-label={tr("Delete")} className={"w-11 h-11 -me-2 -mt-1.5 shrink-0 grid place-items-center rounded-[14px] hover:text-[var(--c-neg)] " + U.muted} data-testid="life-remove"><Trash2 size={15} /></button>
      </div>
      {c.count > 1 && c.kind !== "regular" ? <div className="flex items-center gap-2 mt-2.5" data-testid="life-progress">
        <div className="flex-1 h-2 rounded-full bg-[var(--c-surf-2)] border border-[var(--c-ln)] overflow-hidden"><i className="block h-full rounded-full bg-[var(--c-pos)]" style={{ width: Math.min(100, (pr.paidCount / c.count) * 100) + "%" }} /></div>
        <span className={U.tag("green") + " tabular-nums"}>{tr("{a} / {b} paid", { a: pr.paidCount, b: c.count })}</span></div> : null}
      {c.kind !== "regular" && show.length > 1 ? (
        // v8.3 (Ali: "make each entry openable and put it in a schedule — easier and visually better"): a tap opens the plan as a
        // table — one row per payment: number, date, amount, paid / due / late; a row's tap records it (with the amount that came)
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2.5 w-full min-h-[44px] rounded-[12px] border border-[var(--c-ln)] px-3 flex items-center justify-between text-[13px] font-bold" data-testid="life-open">
          <span>{open ? tr("Hide the schedule") : tr("Open the schedule")}</span><ChevronDown size={16} className={"transition-transform " + (open ? "rotate-180" : "")} /></button>) : null}
      {c.kind !== "regular" && show.length > 1 && open ? (
        <div className="mt-2 rounded-[14px] border border-[var(--c-ln)] overflow-hidden" data-testid="life-schedule">
          <div className={"grid grid-cols-[34px_1fr_auto_auto] gap-x-2 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.05em] bg-[var(--c-surf-2)] " + U.muted}><span>#</span><span>{tr("Date")}</span><span className="text-end">{tr("Amount")}</span><span className="text-end">{tr("Status")}</span></div>
          {pr.schedule.map((s) => { const nx = pr.next && pr.next.i === s.i && !s.paid, late = !s.paid && s.date < todayIso(); return (
            <React.Fragment key={s.i}>
            <button onClick={() => tap(s.i, s.paid, s.amount)} data-testid="life-row" aria-pressed={s.paid}
              className={"w-full grid grid-cols-[34px_1fr_auto_auto] gap-x-2 items-center px-3 min-h-[46px] text-[13px] text-start border-t border-[var(--c-ln)] tabular-nums " + (nx ? "bg-[color-mix(in_srgb,var(--c-warn)_8%,transparent)]" : "")}>
              <span className={"font-bold " + U.muted}>{s.i + 1}</span>
              <span dir="auto">{longDay(s.date)}</span>
              <span className={"text-end font-extrabold " + (s.moved || s.extra ? "text-[var(--c-acc)]" : "")}>{fmt(s.amount)}</span>
              <span className={"text-end text-[11.5px] font-extrabold " + (s.paid ? "text-[var(--c-pos)]" : late ? "text-[var(--c-neg)]" : nx ? "text-[var(--c-warn)]" : U.muted)}>{s.paid ? "✓ " + (s.actual ? tr("Paid") : tr("Paid")) : late ? tr("Late") : nx ? tr("Due") : tr("Later")}</span>
            </button>
            {ed && ed.i === s.i ? <div className="px-2 pb-2"><PayBox c={c} ed={ed} setEd={setEd} onPay={onPay} /></div> : null}
            </React.Fragment>); })}
        </div>) : null}
      {c.kind === "regular" && show.length > 1 ? (
        // v7.2 (Gemini's Area 1): a box per payment with its date and amount — paid green, the next one due amber
        <div className="flex flex-wrap gap-1.5 mt-3">
          {show.map((s) => { const nx = pr.next && pr.next.i === s.i && !s.paid; return (
            <button key={s.i} onClick={() => tap(s.i, s.paid, s.amount)} title={s.date + " · " + fmt(s.amount)} data-testid="life-tick"
              aria-pressed={s.paid} aria-label={tr("Payment {k}", { k: s.i + 1 }) + " · " + s.date}
              className="min-w-[60px] min-h-[44px] px-2 py-1 rounded-[11px] flex flex-col items-center justify-center gap-px text-[11px] font-bold tabular-nums transition-colors duration-150"
              style={{ background: s.paid ? "color-mix(in srgb, var(--c-pos) 14%, transparent)" : nx ? "color-mix(in srgb, var(--c-warn) 14%, transparent)" : "var(--c-surf)",
                border: "1.5px solid " + (s.paid ? "var(--c-pos)" : nx ? "var(--c-warn)" : "var(--c-ln)"), color: s.paid ? "var(--c-pos)" : nx ? "var(--c-warn)" : "var(--c-mut)" }}>
              <span>{tickDay(s.date, c.kind === "regular")}</span><span className="flex items-center gap-0.5">{s.paid ? <Check size={11} /> : null}{nx && !s.paid ? tr("Due") + " " : ""}{short(s.amount)}</span></button>); })}
        </div>) : show.length <= 1 ? (
        <button onClick={() => tap(0, (c.paid || []).includes(0), c.amount)} className={"mt-3 min-h-[44px] flex items-center gap-2 text-[13.5px] font-bold " + U.muted} data-testid="life-tick">
          <span className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: (c.paid || []).includes(0) ? "var(--c-acc)" : "transparent", border: "1.5px solid var(--c-acc)", color: "var(--c-on-acc)" }}>{(c.paid || []).includes(0) ? <Check size={12} /> : null}</span>
          {(c.paid || []).includes(0) ? tr("Settled") : c.dir === "in" ? tr("Mark as paid back") : tr("Mark as paid")}</button>) : null}
      {ed && !open ? <PayBox c={c} ed={ed} setEd={setEd} onPay={onPay} /> : null}
      {pr.next && show.length > 1 ? <div className={"mt-2 text-[12.5px] tabular-nums " + U.muted}>{tr("Next: {d} · {a}", { d: pr.next.date, a: fmt(pr.next.amount) })}</div> : null}
      {pr.schedule.some((x) => x.moved || x.extra) ? <div className="mt-1 text-[12px] text-[var(--c-acc)]" data-testid="life-moved">{tr("The rest is spread again: {n} × {a}", { n: pr.schedule.filter((x) => !x.paid).length, a: fmt(pr.next ? pr.next.amount : 0) })}</div> : null}
    </div>);
}

export function LifePage({ ask, toMoney, flash, remind, unremind }) {
  const [data, setData] = useState(() => loadLife());
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const put = (d) => setData(saveLife(d));
  const [gold, setGold] = useState(() => loadGold());
  const [car, setCar] = useState(() => loadCar());
  const putGold = (d) => setGold(saveGold(d)), putCar = (d) => setCar(saveCar(d));
  // a commitment handed over from Chat ("Save it"): read at once, shown to check
  React.useEffect(() => {
    let t0 = ""; try { t0 = localStorage.getItem("attune:life:ask") || ""; localStorage.removeItem("attune:life:ask"); } catch (e) {}
    if (t0) { setText(t0); const c = parseLife(t0); if (c) setDraft({ ...c, source: t0 }); }
  }, []);
  const read = async () => {
    const t = text.trim(); if (!t) return;
    const sp = parseSplit(t); if (sp) { setDraft({ ...sp, source: t }); return; }
    let c = parseLife(t);
    if (!c) { const h = parseHolding(t); if (h) { setDraft({ kind: "holding", holding: h, source: t }); return; } }
    if (!c) { const e = parseCar(t); if (e) { setDraft({ kind: "car", entry: e, source: t }); return; } }
    if (!c && ask) { setBusy(true); try { c = readLifeModel(await ask(lifeModelPrompt(t))); } catch (e) { c = null; } setBusy(false); }
    if (!c) { flash && flash(tr("I couldn't read an amount and who — try: “Ahmed owes me 12,000, 1,000 a month for a year”")); return; }
    setDraft({ ...c, source: t });
  };
  // v6.27: one reminder per commitment — 9:00 on the day its next payment is due; moved on every tick
  const remindFor = (c) => { const r = c && nextReminder(c); if (r && remind) remind(r); else if (c && unremind) unremind("life-" + c.id); };
  const save = () => {
    if (draft.kind === "split") {
      let d = data; for (const c of splitToCommitments(draft)) { d = addCommitment(d, c); remindFor(d.items[d.items.length - 1]); }
      put(d); setDraft(null); setText(""); flash && flash(draft.debts.length ? tr("Saved — each share is on your list") : tr("Worked out")); return;
    }
    if (draft.kind === "holding") { putGold(addHolding(gold, { ...draft.holding })); setDraft(null); setText(""); flash && flash(tr("Saved in Gold & savings")); return; }
    if (draft.kind === "car") {
      const e = draft.entry;
      if (e.kind === "deadline") { const r = addDeadline(loadRadar(), { ...e.deadline, source: "car" }); saveRadar(r.data || r); const rem = r.item && radarReminder(r.item); if (rem && remind) remind(rem); flash && flash(tr("Added to the Deadline Radar")); }
      else { putCar(addCarEntry(car, e)); flash && flash(tr("Saved for your car")); if (e.amount && toMoney && window.confirm(tr("Add it to Money? {t}", { t: carMoneyText(e) }))) toMoney(carMoneyText(e)); }
      setDraft(null); setText(""); return;
    }
    const d = addCommitment(data, draft); put(d); remindFor(d.items[d.items.length - 1]); setDraft(null); setText(""); flash && flash(tr("Saved — the payments are on your list")); };
  const tick = (c, i, on) => {
    // v6.34 (Ali): the maid, a subscription, a bill, the rent — a tick is "paid", recorded in Money by itself
    if (["regular", "subscription", "bill", "rent"].includes(c.kind) && c.dir === "out") {
      const r = tickRegular(c.id, i, on); setData(r.data); remindFor(r.data.items.find((x) => x.id === c.id));
      if (on && r.recorded) flash && flash(tr("Recorded in Money: {a} {cur} — {t}", { a: fmt(r.recorded), cur: c.currency, t: heading(c) }));
      else if (on && toMoney) toMoney(tickText(c, i));
      else if (!on && r.removed) flash && flash(tr("Taken out of Money"));
      return;
    }
    const d = togglePaid(data, c.id, i); put(d); remindFor(d.items.find((x) => x.id === c.id));
    // the Money Guardian counts a late payment that came back after its reminder as saved
    if (on) { try { const s = progressOf(c).schedule[i]; saveGuardian(collected(loadGuardian(), c.id, i, s ? s.amount : c.amount)); } catch (e) {} }
    if (on && toMoney && window.confirm(tr("Add it to Money? {t}", { t: tickText(c, i) }))) toMoney(tickText(c, i));
  };
  // v8.3: a person's payment with the amount that really came — the rest of the plan is spread again
  const pay = (c, i, v) => {
    const d = payAmount(data, c.id, i, v); put(d); const c2 = d.items.find((x) => x.id === c.id); remindFor(c2);
    if (c.dir === "in") { try { saveGuardian(collected(loadGuardian(), c.id, i, v)); } catch (e) {} }
    const pr = progressOf(c2);
    if (toMoney && window.confirm(tr("Add it to Money? {t}", { t: tickText(c2, i) }))) { toMoney(tickText(c2, i)); return; }
    flash && flash(pr.left > 0.004 ? tr("Recorded {a} — {l} left, next {d}: {n}", { a: fmt(v), l: fmt(pr.left), d: pr.next ? pr.next.date : "—", n: pr.next ? fmt(pr.next.amount) : "—" }) : tr("Recorded {a} — all paid", { a: fmt(v) }));
  };
  const remove = (c) => { if (window.confirm(tr("Delete this?"))) { put(removeCommitment(data, c.id)); unremind && unremind("life-" + c.id); } };
  const soon = dueSoon(data).filter((x) => !(x.c.kind === "regular" && x.c.dir === "out"));   // those are asked above
  const asks = askToday(data);
  const groups = [["People", data.items.filter((c) => c.kind === "debt" || (c.kind === "installment" && c.person))],
    ["Installments", data.items.filter((c) => c.kind === "installment" && !c.person)], ["Savings circles", data.items.filter((c) => c.kind === "circle")],
    ["Bills, rent and subscriptions", data.items.filter((c) => ["bill", "rent", "subscription"].includes(c.kind))], ["Comes regularly", data.items.filter((c) => c.kind === "regular")]].filter((g) => g[1].length);
  return (
    <div className={U.page + " rounded-[22px] p-4 md:p-6 space-y-4"} style={{ minHeight: "70vh" }} data-testid="life-page">
      <div><h2 className={U.h1}>{tr("People & plans")}</h2><p data-intro="" className={"m-0 mt-0.5 text-[13px] lg:max-w-[70ch] " + U.muted}>{tr("Debts, installments, savings circles, bills — with a checkbox for every payment.")}</p></div>
      {/* v6.27 computer layout A: what you type and what's due on the left, the commitments on the right (stacked on a phone) */}
      <div className={PANES_N}><div className={LEFT}>
      <div className={U.cardPad + " focus-within:border-[var(--c-acc)]"}>
        <div className={"text-[11.5px] font-bold mb-1.5 " + U.muted}>{tr("One sentence in any language — Attune builds the schedule:")}</div>
        <div className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} dir="auto" data-testid="life-input"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); read(); } }}
            placeholder={tr("Type it as you'd say it — “Ahmed owes me 12,000, 1,000 a month for a year”")}
            className={U.area + " flex-1 resize-none"} />
          <button className={U.btnP} onClick={read} disabled={busy || !text.trim()} data-testid="life-read">{busy ? "…" : tr("Read")}</button>
        </div>
      </div>
      {draft ? (
        <div className={U.cardPad.replace("border-[var(--c-ln)]", "border-[var(--c-acc)]")} data-testid="life-draft">
          {["split", "holding", "car"].includes(draft.kind) ? <PlanDraft d={draft} /> : <>
          <span className={U.label}>{tr(KIND[draft.kind])}{draft.model ? " · " + tr("read by AI") : ""}</span>
          <div className="mt-1 font-extrabold text-[15px]" dir="auto">{heading(draft)}</div>
          <div className={"text-[12.5px] " + U.muted} dir="auto">{describe(draft)}{draft.start ? " · " + tr("from {d}", { d: draft.start }) : ""}</div></>}
          {/* v8.4: a sentence that could mean either — "22,000 … monthly for 9 months": the whole sum, or each month? one tap */}
          {draft.alt || draft.altOf ? <div className="mt-2.5 rounded-[12px] bg-[var(--c-soft)] px-3 py-2 text-[12.5px]" data-testid="life-alt">
            <span className="font-bold">{tr("Did you mean:")}</span>{" "}
            <button onClick={() => setDraft(draft.alt ? { ...draft.alt, source: draft.source, altOf: { ...draft, alt: undefined } } : { ...draft.altOf, source: draft.source, alt: { ...draft, altOf: undefined } })} className="underline font-extrabold text-[var(--c-acc)]" data-testid="life-alt-pick">
              {draft.alt ? tr("{a} EACH month ({t} in all)", { a: fmt(draft.alt.amount), t: fmt(draft.alt.total) }) : tr("{t} in all ({a} a month)", { t: fmt(draft.altOf.total), a: fmt(draft.altOf.amount) })}</button></div> : null}
          <div className="flex gap-2 mt-3"><button className={U.btnP} onClick={save} data-testid="life-save">{tr("Save")}</button><button className={U.btnS} onClick={() => setDraft(null)}>{tr("Cancel")}</button></div>
        </div>) : null}
      {/* v7.9 (Ali): on their day, a plain question with a real checkbox — ticked = came and paid (in Money by itself) */}
      {asks.map((x) => (
        <div key={x.c.id + ":" + x.i} className={U.cardPad.replace("border-[var(--c-ln)]", "border-[var(--c-acc)]")} data-testid="life-ask-today">
          <b className="block font-extrabold text-[15px]" dir="auto">{tr("{t} — today", { t: heading(x.c) })}</b>
          <label className="flex items-center gap-3 mt-2 min-h-[48px] cursor-pointer">
            <input type="checkbox" checked={false} onChange={() => tick(x.c, x.i, true)} className="w-6 h-6 shrink-0 accent-[var(--c-acc)]" data-testid="life-ask-came" />
            <span className="text-[14px] font-bold" dir="auto">{tr("Came today — paid {a}", { a: fmt(x.amount) + (x.c.currency ? " " + x.c.currency : "") })}</span></label>
          <button onClick={() => { put(skipDay(data, x.c.id, x.i)); flash && flash(tr("Noted — nothing paid today")); }} className={U.btnS + " mt-1 " + U.muted} data-testid="life-ask-skip"><X size={14} />{tr("Didn't come")}</button>
        </div>))}
      {soon.length ? (
        <div className={U.cardPad.replace("border-[var(--c-ln)]", "border-[var(--c-warn)]")} data-testid="life-soon">
          <div className="flex items-center justify-between gap-2"><span className="font-extrabold text-[14.5px]">⏰ {tr("Due this week")}</span>
            <span className={U.tag("amber") + " tabular-nums"}>{tr("{n} items · {a}", { n: soon.length, a: fmt(soon.reduce((a, x) => a + x.amount, 0)) })}</span></div>
          {soon.slice(0, 6).map((x, k) => (
            <div key={k} className="flex items-center gap-2 mt-2"><span className="flex-1 truncate font-semibold" dir="auto">{heading(x.c)}</span>
              <span className={U.tag(x.late ? "red" : "amber")}>{x.late ? tr("Late") : x.date.slice(5)} · <span className="tabular-nums">{fmt(x.amount)}</span></span></div>))}
        </div>) : null}
      {!data.items.length && !draft ? <p className={"flex items-center gap-2 text-[13px] " + U.muted}><Sparkles size={14} className="shrink-0 text-[var(--c-acc)]" />{tr("Try: «جمعية ٢٠٠٠ في الشهر لمدة ١٠ شهور ودوري الرابع» or “Netflix 200 every month”.")}</p> : null}
      </div><div className={groups.length || gold.items.length || car.log.length ? RIGHT : "min-w-0"}>
      {groups.map(([g, items]) => (
        <div key={g} className="space-y-2"><span className={U.label}>{tr(g)}</span>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>{(g === "People" ? byPerson(items) : items.map((c) => [c])).map((list) => (list.length > 1
            ? <PersonCard key={list[0].id} list={list} onTick={tick} onRemove={remove} onPay={pay} />
            : <Item key={list[0].id} c={list[0]} onTick={tick} onRemove={remove} onPay={pay} />))}</div></div>))}
      {gold.items.length || car.log.length ? <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {gold.items.length ? <GoldCard data={gold} put={putGold} flash={flash} /> : null}
        {car.log.length ? <CarCard car={car} put={putCar} /> : null}</div> : null}
      {!groups.length && !gold.items.length && !car.log.length ? <DeskEmpty icon={Users} title={tr("Your people and plans appear here")} testid="life-desk-empty" /> : null}
      </div></div>
    </div>);
}

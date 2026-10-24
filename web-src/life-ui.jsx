/* ---- v6.27: "People & plans" — the Life layer's page, in design A "Calm" (phone and computer) --------------------------------
   Type it the way you'd say it («أحمد عليه ١٢ ألف، ألف كل شهر لمدة سنة», "Netflix 200 every month", "جمعية ٢٠٠٠ في الشهر…") →
   read by code (life.js parseLife; the phone's model only if the rules can't, and only when one is loaded) → a preview to
   check → saved. Each commitment shows its payments as checkboxes; ticking one offers to add it to Money (the same
   sentence Money reads from a bank message, confirmed there). Tests: tests/e2e_v727life.py.                                    */
import React, { useMemo, useState } from "react";
import { Users, Check, Trash2, Wallet, Sparkles } from "lucide-react";
import { tr } from "./i18n.js";
import { parseLife, progressOf, tickText, loadLife, saveLife, addCommitment, togglePaid, removeCommitment, dueSoon, lifeModelPrompt, readLifeModel, nextReminder } from "./life.js";
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

function Item({ c, onTick, onRemove }) {
  const pr = useMemo(() => progressOf(c), [c]);
  // a regular (the maid every Saturday): the last few days and the next one — ticked = she came, and it's in Money
  const show = c.kind === "regular" ? pr.schedule.slice(Math.max(0, pr.schedule.length - 6)) : pr.schedule.slice(0, 24);
  return (
    <div className={U.cardPad} data-testid="life-item">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><Users size={17} /></span>
        <div className="flex-1 min-w-0">
          <b className="block font-extrabold text-[14.5px]" dir="auto">{heading(c)}</b>
          <div className={"text-[12.5px] " + U.muted} dir="auto">{describe(c)}</div>
        </div>
        {pr.left != null ? <div className="text-end"><span className={U.label}>{tr("Left")}</span><div className="tabular-nums font-black text-[17px]" dir="ltr">{fmt(pr.left)}</div></div> : null}
        <button onClick={() => onRemove(c)} aria-label={tr("Delete")} className={"w-11 h-11 -me-2 -mt-1.5 shrink-0 grid place-items-center rounded-[14px] hover:text-[var(--c-neg)] " + U.muted} data-testid="life-remove"><Trash2 size={15} /></button>
      </div>
      {c.count > 1 && c.kind !== "regular" ? <div className="flex items-center gap-2 mt-2.5" data-testid="life-progress">
        <div className="flex-1 h-2 rounded-full bg-[var(--c-surf-2)] border border-[var(--c-ln)] overflow-hidden"><i className="block h-full rounded-full bg-[var(--c-pos)]" style={{ width: Math.min(100, (pr.paidCount / c.count) * 100) + "%" }} /></div>
        <span className={U.tag("green") + " tabular-nums"}>{tr("{a} / {b} paid", { a: pr.paidCount, b: c.count })}</span></div> : null}
      {show.length > 1 ? (
        // v7.2 (Gemini's Area 1): a box per payment with its date and amount — paid green, the next one due amber
        <div className="flex flex-wrap gap-1.5 mt-3">
          {show.map((s) => { const nx = pr.next && pr.next.i === s.i && !s.paid; return (
            <button key={s.i} onClick={() => onTick(c, s.i, !s.paid)} title={s.date + " · " + fmt(s.amount)} data-testid="life-tick"
              aria-pressed={s.paid} aria-label={tr("Payment {k}", { k: s.i + 1 }) + " · " + s.date}
              className="min-w-[60px] min-h-[44px] px-2 py-1 rounded-[11px] flex flex-col items-center justify-center gap-px text-[11px] font-bold tabular-nums transition-colors duration-150"
              style={{ background: s.paid ? "color-mix(in srgb, var(--c-pos) 14%, transparent)" : nx ? "color-mix(in srgb, var(--c-warn) 14%, transparent)" : "var(--c-surf)",
                border: "1.5px solid " + (s.paid ? "var(--c-pos)" : nx ? "var(--c-warn)" : "var(--c-ln)"), color: s.paid ? "var(--c-pos)" : nx ? "var(--c-warn)" : "var(--c-mut)" }}>
              <span>{tickDay(s.date, c.kind === "regular")}</span><span className="flex items-center gap-0.5">{s.paid ? <Check size={11} /> : null}{nx && !s.paid ? tr("Due") + " " : ""}{short(s.amount)}</span></button>); })}
        </div>) : (
        <button onClick={() => onTick(c, 0, !(c.paid || []).includes(0))} className={"mt-3 min-h-[44px] flex items-center gap-2 text-[13.5px] font-bold " + U.muted} data-testid="life-tick">
          <span className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: (c.paid || []).includes(0) ? "var(--c-acc)" : "transparent", border: "1.5px solid var(--c-acc)", color: "var(--c-on-acc)" }}>{(c.paid || []).includes(0) ? <Check size={12} /> : null}</span>
          {(c.paid || []).includes(0) ? tr("Settled") : c.dir === "in" ? tr("Mark as paid back") : tr("Mark as paid")}</button>)}
      {pr.next && show.length > 1 ? <div className={"mt-2 text-[12.5px] tabular-nums " + U.muted}>{tr("Next: {d} · {a}", { d: pr.next.date, a: fmt(pr.next.amount) })}</div> : null}
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
  const remove = (c) => { if (window.confirm(tr("Delete this?"))) { put(removeCommitment(data, c.id)); unremind && unremind("life-" + c.id); } };
  const soon = dueSoon(data);
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
          <div className="flex gap-2 mt-3"><button className={U.btnP} onClick={save} data-testid="life-save">{tr("Save")}</button><button className={U.btnS} onClick={() => setDraft(null)}>{tr("Cancel")}</button></div>
        </div>) : null}
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
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>{items.map((c) => <Item key={c.id} c={c} onTick={tick} onRemove={remove} />)}</div></div>))}
      {gold.items.length || car.log.length ? <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {gold.items.length ? <GoldCard data={gold} put={putGold} flash={flash} /> : null}
        {car.log.length ? <CarCard car={car} put={putCar} /> : null}</div> : null}
      {!groups.length && !gold.items.length && !car.log.length ? <DeskEmpty icon={Users} title={tr("Your people and plans appear here")} testid="life-desk-empty" /> : null}
      </div></div>
    </div>);
}

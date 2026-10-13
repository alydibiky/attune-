/* ---- v6.27: "People & plans" — the Life layer's page, in design A "Calm" (phone and computer) --------------------------------
   Type it the way you'd say it («أحمد عليه ١٢ ألف، ألف كل شهر لمدة سنة», "Netflix 200 every month", "جمعية ٢٠٠٠ في الشهر…") →
   read by code (life.js parseLife; the phone's model only if the rules can't, and only when one is loaded) → a preview to
   check → saved. Each commitment shows its payments as checkboxes; ticking one offers to add it to Money (the same
   sentence Money reads from a bank message, confirmed there). Tests: tests/e2e_v727life.py.                                    */
import React, { useMemo, useState } from "react";
import { Users, Check, Trash2, Wallet, Sparkles } from "lucide-react";
import { tr } from "./i18n.js";
import { parseLife, progressOf, tickText, loadLife, saveLife, addCommitment, togglePaid, removeCommitment, dueSoon, lifeModelPrompt, readLifeModel } from "./life.js";
import { fmt } from "./money-calm.js";

const KIND = { installment: "Installments", debt: "Money between people", circle: "Savings circle", bill: "Bill", rent: "Rent", subscription: "Subscription" };
const EVERY = { month: "a month", week: "a week", year: "a year" };

function describe(c) {
  const per = c.every ? " " + tr(EVERY[c.every]) : "";
  if (c.kind === "installment") return tr("{a} {cur}{per} · {n} payments · {t} in all", { a: fmt(c.amount), cur: c.currency, per, n: c.count, t: fmt(c.total) });
  if (c.kind === "circle") return tr("{a} {cur}{per} · {n} months", { a: fmt(c.amount), cur: c.currency, per, n: c.count }) + (c.myTurn ? " · " + tr("your turn: {k}", { k: c.myTurn }) : "");
  if (c.kind === "debt") return fmt(c.amount) + " " + c.currency;
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
  const show = pr.schedule.slice(0, 24);
  return (
    <div className="c-card" data-testid="life-item">
      <div className="flex items-start gap-3">
        <span className="c-ic"><Users size={16} /></span>
        <div className="flex-1 min-w-0">
          <b className="block" dir="auto">{heading(c)}</b>
          <div className="c-sub" dir="auto">{describe(c)}</div>
        </div>
        {pr.left != null ? <div className="text-end"><span className="c-lbl">{tr("Left")}</span><div className="c-num font-bold">{fmt(pr.left)}</div></div> : null}
        <button onClick={() => onRemove(c)} aria-label={tr("Delete")} className="c-sub ms-1" data-testid="life-remove"><Trash2 size={15} /></button>
      </div>
      {show.length > 1 ? (
        <div className="grid gap-1.5 mt-3" style={{ gridTemplateColumns: "repeat(" + Math.min(12, show.length) + ", minmax(0,1fr))" }}>
          {show.map((s) => (
            <button key={s.i} onClick={() => onTick(c, s.i, !s.paid)} title={s.date + " · " + fmt(s.amount)} data-testid="life-tick"
              aria-pressed={s.paid} aria-label={tr("Payment {k}", { k: s.i + 1 }) + " · " + s.date}
              className="h-8 rounded-lg flex items-center justify-center text-[10.5px] c-num"
              style={{ background: s.paid ? "var(--c-acc)" : "transparent", border: "1.5px solid " + (s.paid || (pr.next && pr.next.i === s.i) ? "var(--c-acc)" : "var(--c-ln)"), color: s.paid ? "#fff" : "var(--c-mut)" }}>
              {s.paid ? <Check size={13} /> : s.date.slice(5)}</button>))}
        </div>) : (
        <button onClick={() => onTick(c, 0, !(c.paid || []).includes(0))} className="mt-3 flex items-center gap-2 c-sub" data-testid="life-tick">
          <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: (c.paid || []).includes(0) ? "var(--c-acc)" : "transparent", border: "1.5px solid var(--c-acc)", color: "#fff" }}>{(c.paid || []).includes(0) ? <Check size={12} /> : null}</span>
          {(c.paid || []).includes(0) ? tr("Settled") : c.dir === "in" ? tr("Mark as paid back") : tr("Mark as paid")}</button>)}
      {pr.next && show.length > 1 ? <div className="c-sub mt-2">{tr("Next: {d} · {a}", { d: pr.next.date, a: fmt(pr.next.amount) })}</div> : null}
    </div>);
}

export function LifePage({ ask, toMoney, flash }) {
  const [data, setData] = useState(() => loadLife());
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const put = (d) => setData(saveLife(d));
  // a commitment handed over from Chat ("Save it"): read at once, shown to check
  React.useEffect(() => {
    let t0 = ""; try { t0 = localStorage.getItem("attune:life:ask") || ""; localStorage.removeItem("attune:life:ask"); } catch (e) {}
    if (t0) { setText(t0); const c = parseLife(t0); if (c) setDraft({ ...c, source: t0 }); }
  }, []);
  const read = async () => {
    const t = text.trim(); if (!t) return;
    let c = parseLife(t);
    if (!c && ask) { setBusy(true); try { c = readLifeModel(await ask(lifeModelPrompt(t))); } catch (e) { c = null; } setBusy(false); }
    if (!c) { flash && flash(tr("I couldn't read an amount and who — try: “Ahmed owes me 12,000, 1,000 a month for a year”")); return; }
    setDraft({ ...c, source: t });
  };
  const save = () => { put(addCommitment(data, draft)); setDraft(null); setText(""); flash && flash(tr("Saved — the payments are on your list")); };
  const tick = (c, i, on) => {
    put(togglePaid(data, c.id, i));
    if (on && toMoney && window.confirm(tr("Add it to Money? {t}", { t: tickText(c, i) }))) toMoney(tickText(c, i));
  };
  const remove = (c) => { if (window.confirm(tr("Delete this?"))) put(removeCommitment(data, c.id)); };
  const soon = dueSoon(data);
  const groups = [["People", data.items.filter((c) => c.kind === "debt" || (c.kind === "installment" && c.person))],
    ["Installments", data.items.filter((c) => c.kind === "installment" && !c.person)], ["Savings circles", data.items.filter((c) => c.kind === "circle")],
    ["Bills, rent and subscriptions", data.items.filter((c) => ["bill", "rent", "subscription"].includes(c.kind))]].filter((g) => g[1].length);
  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="life-page">
      <div><h2 className="text-[22px] font-bold m-0">{tr("People & plans")}</h2><p className="c-sub m-0">{tr("Debts, installments, savings circles, bills — with a checkbox for every payment.")}</p></div>
      <div className="c-card">
        <div className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} dir="auto" data-testid="life-input"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); read(); } }}
            placeholder={tr("Type it as you'd say it — “Ahmed owes me 12,000, 1,000 a month for a year”")}
            className="flex-1 resize-none bg-transparent focus:outline-none text-[15px]" style={{ color: "var(--c-ink)" }} />
          <button className="c-btn" onClick={read} disabled={busy || !text.trim()} data-testid="life-read">{busy ? "…" : tr("Read")}</button>
        </div>
      </div>
      {draft ? (
        <div className="c-card" style={{ borderColor: "var(--c-acc)" }} data-testid="life-draft">
          <span className="c-lbl">{tr(KIND[draft.kind])}{draft.model ? " · " + tr("read by AI") : ""}</span>
          <div className="mt-1 font-bold" dir="auto">{heading(draft)}</div>
          <div className="c-sub" dir="auto">{describe(draft)}{draft.start ? " · " + tr("from {d}", { d: draft.start }) : ""}</div>
          <div className="flex gap-2 mt-3"><button className="c-btn" onClick={save} data-testid="life-save">{tr("Save")}</button><button className="c-sub" onClick={() => setDraft(null)}>{tr("Cancel")}</button></div>
        </div>) : null}
      {soon.length ? (
        <div className="c-card" data-testid="life-soon"><span className="c-lbl">{tr("Due this week")}</span>
          {soon.slice(0, 6).map((x, k) => (
            <div key={k} className="flex items-center mt-2"><span className="flex-1 truncate" dir="auto">{heading(x.c)}</span>
              <span className={"c-pill " + (x.late ? "late" : "due")}>{x.late ? tr("Late") : x.date.slice(5)} · <span className="c-num">{fmt(x.amount)}</span></span></div>))}
        </div>) : null}
      {groups.map(([g, items]) => (
        <div key={g} className="space-y-2"><span className="c-lbl">{tr(g)}</span>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>{items.map((c) => <Item key={c.id} c={c} onTick={tick} onRemove={remove} />)}</div></div>))}
      {!data.items.length && !draft ? <p className="c-sub flex items-center gap-2"><Sparkles size={14} />{tr("Try: «جمعية ٢٠٠٠ في الشهر لمدة ١٠ شهور ودوري الرابع» or “Netflix 200 every month”.")}</p> : null}
    </div>);
}

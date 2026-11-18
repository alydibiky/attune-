/* ---- v9.9.35 "Set up your life" (GD-5 + GW-A + TR-3): the Home card, the Settings page and the interview in Chat.
   The interview runs in the REAL Chat: Attune asks one question as a card, the person answers as they would anyway (so every reader works —
   money plans, reminders, agents, papers, all with their own Undo), and the driver checks the stores; only when the step is really done
   does Attune say ✓ and ask the next one. The salary answer is saved here as a repeating income in Money (Chat alone would save one
   payment). Nothing is marked done by a tap. */
import React, { useEffect, useMemo, useState } from "react";
import { tr } from "./i18n.js";
import * as S from "./setup.js";
import { proNow } from "./plan.js";
import { openPlan } from "./plan-ui.jsx";
import { bankCheck, SAY as BANK_SAY, BTN as BANK_BTN } from "./bankcheck.js";
import { payReader, openAccess, addPaidNow } from "./paylog-ui.jsx";
import { payOpts } from "./locale.js";

const j = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
/** Everything the steps look at, from the stores. */
export function setupData() {
  return { ledger: j("ledger.v3", {}), life: j("attune:life:v1", { items: [] }), radar: j("attune:radar:v1", { items: [] }),
    reminders: (() => { const v = j("attune:reminders:v1", []); return Array.isArray(v) ? v : (v && v.items) || []; })(),
    agents: j("attune:agents:v1", { agents: [] }), backup: j("attune:autobackup:v1", {}) };
}
const RUN = "attune:setup:run", HIDE = "attune:setup:hide";
export const quiet = () => { try { return localStorage.getItem("attune:test:quiet") === "1"; } catch (e) { return false; } };   // the older browser tests
const getRun = () => j(RUN, null);
const setRun = (v) => { try { v ? localStorage.setItem(RUN, JSON.stringify(v)) : localStorage.removeItem(RUN); } catch (e) {} };
const say = (card) => { try { window.dispatchEvent(new CustomEvent("attune-chat-cmd", { detail: { op: "say", card } })); } catch (e) {} };
// v10.0.3 (Ali, 16 Nov: "I do this but nothing happens and it stays unticked"): notification access given, but no bank message has
// come yet — the step says so (it is ticked by itself with the first real message), instead of asking to allow again
const bankAllowed = () => { try { const N = window.AttuneNative; return !!(N && N.payAccess && N.payAccess()); } catch (e) { return false; } };
/* v10.4 (Ali, 18 Nov: "I can't press allow or tick, it does not do anything" + "fix the SMS notification for good"): the bank step says
   exactly what is happening (bankcheck.js) and always has the button that fixes it — Add the payments waiting for an OK, Fix the paused
   reader, Turn SMS on, Allow — on the Set up page AND in Chat's card. */
const rj = (f, d) => { try { const v = JSON.parse(f() || "null"); return v == null ? d : v; } catch (e) { return d; } };
export function bankNow() {
  const N = typeof window !== "undefined" ? window.AttuneNative : null;
  let access = false; try { access = !!(N && N.payAccess && N.payAccess()); } catch (e) {}
  const diag = N && N.smsDiag ? rj(() => N.smsDiag(), {}) : N && N.listenerHealth ? rj(() => N.listenerHealth(), {}) : {};
  return bankCheck({ reader: payReader(N), access, diag, queue: N && N.payQueue ? rj(() => N.payQueue(), []) : [], old: j("attune:sms-old:v1", []),
    done: j("attune:paylog:done", []), ledger: j("ledger.v3", {}), now: Date.now(), opts: (() => { try { return payOpts(); } catch (e) { return undefined; } })() });
}
const bankWords = (c) => { const w = BANK_SAY[c.state] || BANK_SAY.nosms;
  return { t: tr(w.t, { n: c.n, f: c.from || tr("your SMS app") }), d: w.d ? tr(w.d) : "", a: w.a.filter((a) => a !== "add" || c.add.length) }; };
/** Runs one of the bank step's buttons → a short line to show (or ""). */
export function bankAct(a) {
  const N = typeof window !== "undefined" ? window.AttuneNative : null;
  try {
    if (a === "allow") { if (N && N.openPayAccess) openAccess(N); return ""; }
    if (a === "review") { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "money" } })); return ""; }
    if (a === "smson") { N && N.setSmsNotifs && N.setSmsNotifs(true); return tr("SMS reading is on."); }
    if (a === "add") { const c = bankNow(); let n = 0; for (const e of c.add) if (addPaidNow(e, N)) n++; return n ? tr("Added {n} to Money.", { n }) : ""; }
    if (a === "fix" || a === "check") { let r = -1; try { r = N && N.payRescan ? N.payRescan() : -1; } catch (e) {} if (r < 0) try { N && N.listenerHeal && N.listenerHeal(); } catch (e) {}
      return r < 0 ? tr("Reconnecting the reader — check again in a minute.") : tr("Checked."); }
  } catch (e) {}
  return "";
}
const bankWaiting = () => { const c = bankNow(), w = bankWords(c);
  return { tone: "emerald", title: w.t, detail: w.d, setup: "bank",
    actions: [...w.a.map((a) => [tr(BANK_BTN[a]), "setup:bank-" + a]), [tr("Skip this one"), "setup:skip"], [tr("Stop for now"), "setup:stop"]] }; };
const ask = (s, pro) => s.id === "bank" && bankAllowed() ? bankWaiting() : ({ tone: "emerald", title: tr(s.ask), detail: s.eg ? tr("For example: {x}", { x: tr(s.eg) }) : "", setup: s.id,
  actions: [...(s.btn ? [[tr(s.btn), "setup:" + s.id]] : []), [tr("Skip this one"), "setup:skip"], [tr("Stop for now"), "setup:stop"]] });

/** v10.4 under the bank step on the Set up page: what is happening and the button that fixes it. */
export function BankCheckBox({ bump }) {
  const [msg, setMsg] = useState(""), c = bankNow(), w = bankWords(c);
  if (c.state === "done") return null;
  const run = (a) => { const m = bankAct(a); setMsg(m); setTimeout(() => bump && bump(), a === "fix" || a === "check" ? 1500 : 50); };
  return <div className="rounded-[12px] px-3 py-2.5 mb-2 space-y-1.5 border border-[var(--c-ln)]" style={{ background: "var(--c-soft)" }} data-testid="bank-check" data-state={c.state}>
    <p className="m-0 text-[13px] font-bold" dir="auto">{w.t}</p>
    {w.d ? <p className="m-0 text-[12.5px] c-sub" dir="auto">{w.d}</p> : null}
    {c.state === "waiting" ? c.entries.slice(0, 3).map((e) => <p key={e.id} className="m-0 text-[12.5px] tabular-nums" dir="auto">{(e.direction === "in" ? "+" : "−") + e.amount.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + (e.currency || "") + (e.party ? " · " + e.party : "") + (e.from ? " · " + e.from : "")}</p>) : null}
    {w.a.length ? <div className="flex flex-wrap gap-2 pt-0.5">{w.a.map((a, i) => <button key={a} onClick={() => run(a)} className={"h-9 px-3 rounded-full text-[12.5px] font-extrabold " + (i ? "border border-[var(--c-acc)] text-[var(--c-acc)]" : "")}
      style={i ? null : { background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} data-testid={"bank-" + a}>{tr(BANK_BTN[a])}</button>)}</div> : null}
    {msg ? <p className="m-0 text-[12px] font-bold text-[var(--c-acc)]" data-testid="bank-msg" dir="auto">{msg}</p> : null}
  </div>;
}

/** Starts (or continues) the interview in Chat at the first step not done — or at `id`. */
export function startSetup(id = null) {
  const pro = proNow(), p = S.progress(setupData(), pro);
  const step = (id && p.steps.find((s) => s.id === id && !s.locked)) || p.next;
  if (!step) { if (!pro) openPlan(); return; }
  setRun({ id: step.id, skipped: [] });
  try { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "chat" } })); } catch (e) {}
  setTimeout(() => { say({ tone: "emerald", title: tr("Let's set up your life with Attune — one question at a time."), detail: tr("Answer the way you'd say it. Each step counts only when it's really saved."), actions: [] }); say(ask(step, pro)); }, 400);
}
/** Chat asks this first: the salary answer becomes a repeating income in Money. → the card to show, or null. */
export function setupAnswer(text) {
  const run = getRun(); if (!run || run.id !== "salary") return null;
  const s = S.readSalary(text); if (!s) return null;
  const L = j("ledger.v3", null); if (!L) return null;
  const r = S.salaryRecurring(s, Date.now(), (L.accounts && L.accounts[0] && L.accounts[0].id) || "");
  const recurring = [...(L.recurring || []).filter((x) => !(x.type === "income" && x.cat === "salary")), r];
  try { localStorage.setItem("ledger.v3", JSON.stringify({ ...L, recurring })); } catch (e) { return null; }
  return { tone: "emerald", title: tr("Saved: your salary, {a} on the {d} of every month.", { a: s.amount.toLocaleString("en-US"), d: s.day }), detail: tr("Money now counts “safe to spend” until your next salary."), actions: [] };
}

/** Always mounted: follows the interview, says ✓ when a step is really done and asks the next; gives TR-3's 7 days once. */
export function SetupDriver({ trial }) {
  useEffect(() => {
    const act = (e) => {
      const a = String(e.detail || ""), run = getRun(), N = window.AttuneNative;
      if (a === "stop") { setRun(null); say({ tone: "emerald", title: tr("OK — continue any time from Home or Settings → Set up your life."), detail: "", actions: [] }); return; }
      if (a === "skip" && run) { const p = S.progress(setupData(), proNow()); const nx = p.steps.find((s) => !s.done && !s.locked && s.id !== run.id && !(run.skipped || []).includes(s.id));
        if (nx) { setRun({ id: nx.id, skipped: [...(run.skipped || []), run.id] }); say(ask(nx, proNow())); } else { setRun(null); say({ tone: "emerald", title: tr("That's all for now."), detail: "", actions: [] }); } return; }
      if (a.startsWith("bank-")) { const m = bankAct(a.slice(5)); if (m) say({ tone: "emerald", title: m, detail: "", actions: [] });
        if (a === "bank-fix" || a === "bank-check") setTimeout(() => { const r = getRun(); if (r && r.id === "bank" && !S.stepState(setupData()).bank.done) say(bankWaiting()); }, 2500); return; }
      if (a === "bank") { try { N && N.openPayAccess ? N.openPayAccess() : window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "money" } })); } catch (x) {} return; }
      const step = S.STEPS.find((s) => s.id === a); if (step) try { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: step.open } })); } catch (x) {}
    };
    window.addEventListener("attune-setup-act", act);
    const tick = setInterval(() => {
      const run = getRun(), d = setupData(), pro = proNow(), p = S.progress(d, pro);
      // TR-3: 6 of 8 really done during the trial → 7 more days, once
      if (trial && S.bonusDue({ done: p.done, trial, given: !!localStorage.getItem(S.BONUS_FLAG) })) {
        const until = S.bonusEnd(trial.first);
        try { const had = +localStorage.getItem("attune:pro-bonus-until") || 0; localStorage.setItem("attune:pro-bonus-until", String(Math.max(had, until))); localStorage.setItem(S.BONUS_FLAG, String(until)); } catch (e) {}   // referral.js BONUS_KEY
        say({ tone: "emerald", title: tr("You earned 7 more days of Pro."), detail: tr("Your trial now ends on {d}.", { d: new Date(until).toLocaleDateString() }), actions: [] });
      }
      if (!run) return;
      const cur = p.steps.find((s) => s.id === run.id);
      if (cur && !cur.done && run.id === "bank" && !run.told && bankAllowed()) { setRun({ ...run, told: true }); say(bankWaiting()); }
      if (cur && cur.done) {
        const nx = p.steps.find((s) => !s.done && !s.locked && !(run.skipped || []).includes(s.id));
        say({ tone: "emerald", title: tr("✓ {t} — done ({n} of 8).", { t: tr(cur.title), n: p.done }), detail: "", actions: [] });
        if (nx) { setRun({ ...run, id: nx.id }); say(ask(nx, pro)); }
        else { setRun(null); say(!pro && p.done < 8 ? { tone: "emerald", title: tr("Free sets up the first 3 steps. Pro sets up the rest with you."), detail: "", actions: [[tr("See Pro"), "setup:pro"]] } : { tone: "emerald", title: tr("Your life is set up. Attune will check it with you every month."), detail: "", actions: [] }); }
      }
    }, 1500);
    const pro = (e) => { if (e.detail === "pro") openPlan(); };
    window.addEventListener("attune-setup-act", pro);
    return () => { clearInterval(tick); window.removeEventListener("attune-setup-act", act); window.removeEventListener("attune-setup-act", pro); };
  }, [trial && trial.first, trial && trial.left]);
  return null;
}

/** Home: "Set up your life · n of 8" until it's all done (hidden for a day with Later). */
export function SetupHomeCard({ trial }) {
  const [, bump] = useState(0);
  useEffect(() => { const t = setInterval(() => bump((x) => x + 1), 4000); return () => clearInterval(t); }, []);
  const pro = proNow(), p = S.progress(setupData(), pro);
  const hidden = (() => { const v = +j(HIDE, 0); return v > Date.now(); })();
  if (hidden || p.done >= p.total || quiet()) return null;
  const given = (() => { try { return +localStorage.getItem(S.BONUS_FLAG) || 0; } catch (e) { return 0; } })();
  const inTrial = trial && trial.left > 0 && !trial.bought;
  return <div className="c-card space-y-2" style={{ background: "var(--c-soft)" }} data-testid="setup-home" data-done={p.done}>
    <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--c-mut)]">{tr("Set up your life · {n} of {t}", { n: p.done, t: p.total })}</span>
    <div className="h-1.5 rounded-full bg-[var(--c-ln)] overflow-hidden"><i className="block h-full bg-[var(--c-acc)]" style={{ width: (100 * p.done / p.total) + "%" }} /></div>
    {given ? <p className="m-0 text-[13px]" dir="auto"><b className="text-[var(--c-acc)]">{tr("You earned 7 more days of Pro.")}</b> {tr("Your trial now ends on {d}.", { d: new Date(given).toLocaleDateString() })}</p>
      : inTrial ? <p className="m-0 text-[13px] c-sub" dir="auto">{tr("Really finish 6 of 8 and your Pro trial grows by 7 days.")}</p> : null}
    {p.next ? <p className="m-0 text-[13.5px] font-bold" dir="auto">{tr("Next: {t}", { t: tr(p.next.title) })}</p>
      : !pro ? <p className="m-0 text-[13px]" dir="auto">{tr("Free sets up the first 3 steps. Pro sets up the rest with you.")}</p> : null}
    <div className="flex gap-2">{p.next ? <button onClick={() => startSetup()} className="h-10 px-4 rounded-full text-[13.5px] font-extrabold" style={{ background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} data-testid="setup-continue">{p.done ? tr("Continue") : tr("Start")}</button>
      : <button onClick={openPlan} className="h-10 px-4 rounded-full text-[13.5px] font-extrabold" style={{ background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} data-testid="setup-pro">{tr("See Pro")}</button>}
      <button onClick={() => { try { localStorage.setItem(HIDE, String(Date.now() + 86400000)); } catch (e) {} bump((x) => x + 1); }} className="h-10 px-3 c-sub text-[13px]" data-testid="setup-later">{tr("Later")}</button></div>
  </div>;
}

/** Settings → Set up your life: every step with what was found, the monthly check-up (Pro), and the tips to see again. */
export function SetupPage({ back }) {
  const [, bump] = useState(0), [bankOpen, setBankOpen] = useState(true);   // v10.4: the bank check shows at once
  useEffect(() => { const t = setInterval(() => bump((x) => x + 1), 3000); return () => clearInterval(t); }, []);
  const pro = proNow(), d = setupData(), p = S.progress(d, pro), cu = useMemo(() => (pro ? S.checkup(d) : []), [pro, JSON.stringify(d).length]);
  // (v9.9.38, the 1M test: outside .calm the accent was undefined — every "Do it" was white on white, every ✓ invisible)
  return <div className="calm space-y-3 p-4 max-w-[640px] mx-auto" data-testid="setup-page">
    <div className="flex items-center gap-2">{back ? <button onClick={back} className="min-h-[44px] min-w-[44px] px-2 text-[18px]" aria-label={tr("Back")}>‹</button> : null}<h2 className="m-0 text-[20px] font-black">{tr("Set up your life")}</h2></div>
    <div className="c-card space-y-1.5"><b className="block text-[14px]">{tr("Done · {n} of {t}", { n: p.done, t: p.total })}</b>
      <div className="h-1.5 rounded-full bg-[var(--c-ln)] overflow-hidden"><i className="block h-full bg-[var(--c-acc)]" style={{ width: (100 * p.done / p.total) + "%" }} /></div>
      <p className="m-0 text-[12.5px] c-sub" dir="auto">{tr("A step counts only when Attune really has it — a real salary, a real bank message, real papers.")}</p></div>
    <div className="c-card divide-y divide-[var(--c-ln)]">
      {p.steps.map((s) => { const bankOn = s.id === "bank" && !s.locked && !s.done && bankAllowed();
        // v10.4 (Ali: "I can't press allow or tick, it does not do anything"): the box is a button too — the same as the row's button
        const go = s.done ? null : s.locked ? openPlan : bankOn ? () => setBankOpen((v) => !v) : () => startSetup(s.id);
        return <React.Fragment key={s.id}><div className="flex items-center gap-3 min-h-[56px] py-1.5" data-testid="setup-step" data-id={s.id} data-done={s.done ? "1" : "0"}>
        <button disabled={!go} onClick={go || undefined} aria-label={tr(s.title)} className={"w-6 h-6 rounded-[7px] grid place-items-center text-[12px] font-black shrink-0 " + (s.done ? "bg-[var(--c-acc)] text-[var(--c-on-acc,#fff)]" : "border-2 border-[var(--c-ln)]")} data-testid="setup-box">{s.done ? "✓" : s.locked ? "🔒" : ""}</button>
        <span className="flex-1 min-w-0"><b className="block text-[14px]" dir="auto">{tr(s.title)}</b>
          <span className="block text-[12px] c-sub">{s.locked ? "PRO" : s.done ? tr("Done") : s.id === "bank" && bankAllowed() ? tr("Allowed ✓ — waiting for the first message") : s.need > 1 ? tr("{n} of {t}", { n: s.n, t: s.need }) : tr("Not yet")}</span></span>
        {s.done ? null : bankOn ? <button onClick={go} className="h-9 px-3 rounded-full text-[12.5px] font-extrabold border border-[var(--c-acc)] text-[var(--c-acc)]" data-testid="setup-bank-check">{bankOpen ? tr("Hide") : tr("Check")}</button> : s.locked ? <button onClick={openPlan} className="h-9 px-3 rounded-full text-[12.5px] font-extrabold border border-[var(--c-acc)] text-[var(--c-acc)]">{tr("See Pro")}</button>
          : <button onClick={() => startSetup(s.id)} className="h-9 px-3 rounded-full text-[12.5px] font-extrabold" style={{ background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} data-testid="setup-do">{tr("Do it")}</button>}
      </div>{bankOn && bankOpen ? <BankCheckBox bump={() => bump((x) => x + 1)} /> : null}</React.Fragment>; })}
    </div>
    {pro ? <div className="c-card space-y-1.5" data-testid="setup-checkup"><b className="block text-[14px]">{tr("This month's check-up")}</b>
      {cu.length ? cu.slice(0, 6).map((x, i) => <p key={i} className="m-0 text-[13px]" dir="auto">{x.kind === "paper" ? tr("{t} ends in {n} days ({d})", { t: x.title, n: x.days, d: x.date }) : tr("Not set up yet: {t}", { t: tr(x.title) })}</p>)
        : <p className="m-0 text-[13px] c-sub">{tr("All good this month.")}</p>}</div> : null}
    <button onClick={() => { try { localStorage.removeItem("attune:coach:v1"); } catch (e) {} bump((x) => x + 1); }} className="min-h-[44px] px-3 text-[13px] font-bold underline" data-testid="setup-tips-again">{tr("Show the tips again")}</button>
  </div>;
}

/* ---- v9.9.35 GD-5: one-time tips (coach.js) — a small card above the bottom bar on the page where the tip helps. */
import * as C from "./coach.js";
export function CoachHost({ mode, hold = false, inline = false }) {
  // v10.2 T1 + T2 + T3 (Ali OK'd the combined page: "OK-T"): on the PHONE the tip is a soft line inside the page, under its title
  // (inline — never over a card or the chat box); on a COMPUTER a small card in the page's bottom corner; on both a 💡 next to the
  // title (TipBulb) shows the page's tips again. Still one new tip a day at most; "Show the tips again" in Settings starts over.
  const [st, setSt] = useState(() => j(C.COACH_KEY, {})), [more, setMore] = useState(false);
  const [tip, setTip] = useState(null), [asked, setAsked] = useState(0);   // asked = the 💡 was tapped: the page's tips in turn
  useEffect(() => { setAsked(0); if (hold) { setTip(null); return; } const t = setTimeout(() => { const s = j(C.COACH_KEY, {}); setSt(s); setTip(C.tipFor(mode, s, Date.now(), more)); }, 1200); return () => clearTimeout(t); }, [mode, hold, more]);
  useEffect(() => { const on = (e) => { if (!e.detail || e.detail.mode !== mode) return; const all = C.TIPS.filter((x) => x.mode === mode); if (!all.length) return;
      setAsked((n) => { const k = n % all.length; setTip(all[k]); return n + 1; }); };
    window.addEventListener("attune-tip-show", on); return () => window.removeEventListener("attune-tip-show", on); }, [mode]);
  const shown = !!(tip && (asked || !quiet()));
  if (!shown) return null;
  const done = (again) => { const n = C.markSeen(tip.id, st); try { localStorage.setItem(C.COACH_KEY, JSON.stringify(n)); } catch (e) {} setSt(n);
    if (asked && again) { const all = C.TIPS.filter((x) => x.mode === mode); setAsked((k) => { setTip(all[k % all.length]); return k + 1; }); return; }
    setAsked(0); setTip(again ? C.tipFor(mode, n, Date.now(), true) : null); setMore(again); };
  const body = <>
    <b className="text-[12px] uppercase tracking-[0.08em] text-[var(--c-acc)]">{tr("Tip")}</b>{inline ? " · " : null}
    {inline ? <span className="text-[13.5px] leading-snug" dir="auto">{tr(tip.text)}</span> : <p className="m-0 text-[13.5px] leading-snug" dir="auto">{tr(tip.text)}</p>}
    <span className={"flex gap-4 font-extrabold text-[13px] text-[var(--c-acc)] " + (inline ? "mt-1" : "")}><button onClick={() => done(false)} className="min-h-[36px]" data-testid="coach-ok">{tr("Got it")}</button>
      <button onClick={() => done(true)} className="min-h-[36px]" data-testid="coach-more">{tr("Show me more tips")}</button></span></>;
  // the phone: a line in the page (T1)
  if (inline) return <div className="calm rounded-[14px] px-3.5 pt-2.5 pb-1 mb-3 border border-[var(--c-ln)] text-[var(--c-ink)]" style={{ background: "var(--c-soft)" }} data-testid="coach-tip" data-id={tip.id} data-inline="1" role="status">{body}</div>;
  // the computer: a small card in the page's corner (T2)
  return <div className="fixed z-[55] end-6 bottom-6 w-[360px] max-w-[calc(100vw-48px)] rounded-[16px] p-3.5 space-y-1.5 border border-[var(--c-acc)] bg-[var(--c-surf)] text-[var(--c-ink)] shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
    data-testid="coach-tip" data-id={tip.id} role="status">{body}</div>;
}
/** v10.2 T3: the 💡 next to a page's title when the page has tips — a tap shows them (again), one after another. */
export function TipBulb({ mode, className = "" }) {
  if (!C.TIPS.some((x) => x.mode === mode) || quiet()) return null;
  return <button onClick={() => { try { window.dispatchEvent(new CustomEvent("attune-tip-show", { detail: { mode } })); } catch (e) {} }}
    className={"w-9 h-9 rounded-full grid place-items-center border border-[var(--c-ln)] bg-[var(--c-surf)] text-[16px] " + className}
    aria-label={tr("Tips for this page")} title={tr("Tips for this page")} data-testid="tip-bulb">💡</button>;
}

/** v9.9.39 SB-4 (Ali picked it: "the left sidebar is very crowded with the 2 additions"): a slim strip at the top of the sidebar —
 *  "Set up your life · 3 of 7" with its bar — only while setup is unfinished; it goes once every step is done (Settings keeps the way in). */
export function SetupSideStrip({ go }) {
  const pro = proNow(), p = S.progress(setupData(), pro);
  if (p.done >= p.total || quiet()) return null;
  return <button onClick={go} data-testid="side-setup-strip" data-done={p.done}
    className="w-full min-h-[44px] mb-1 text-start rounded-[12px] px-3 py-2 space-y-1.5 border border-[var(--c-ln)]" style={{ background: "var(--c-soft)" }}>
    <span className="flex items-center gap-2 text-[13px] font-extrabold text-[var(--c-ink)]"><span aria-hidden="true">✨</span><span className="flex-1 truncate">{tr("Set up your life · {n} of {t}", { n: p.done, t: p.total })}</span><span aria-hidden="true" className="rtl:-scale-x-100">›</span></span>
    <span className="block h-1.5 rounded-full bg-[var(--c-ln)] overflow-hidden"><span className="block h-full bg-[var(--c-acc)]" style={{ width: Math.round((100 * p.done) / p.total) + "%" }} /></span>
  </button>;
}

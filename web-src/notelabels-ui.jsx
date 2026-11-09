/* ---- v9.9.11 "Attune asks, you tell it, it remembers" (Ali picked A1 A2 A4 L). The logic is notelabels.js (tested); this is the card
   that asks (in Follow-ups and in Chat), the phone-notification answers coming back (A2), and the "What Attune learned" list (L).
   Understanding: your words by code (English, Egyptian Arabic, Franco) → else the AI when a model is loaded → else "Which of
   these?". Nothing is saved before "I understood: … — Save". */
import React, { useEffect, useState } from "react";
import { GraduationCap, Check, X, Undo2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as NL from "./notelabels.js";
import * as NT from "./noteteach.js";
import { loadDir } from "./entities.js";
import { saveTaught } from "./noteteach-ui.jsx";
import { moneySourceNote } from "./paylog.js";
import { payEntryOf, addPaidNow, dismissPaid } from "./paylog-ui.jsx";   // v9.9.12 a receipt → "You paid … — add it to Money?"

const BTN = "min-h-[40px] px-3.5 rounded-[12px] text-[13px] font-extrabold bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] disabled:opacity-40";
const BTN2 = "min-h-[40px] px-3.5 rounded-[12px] text-[13px] font-extrabold border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)]";
const CHIP = "min-h-[36px] px-3 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[12.5px] font-bold";
const readJson = (f) => { try { return JSON.parse(f() || "[]") || []; } catch (e) { return []; } };
const N0 = () => (typeof window !== "undefined" ? window.AttuneNative : null);
const quickAi = () => { try { return (typeof window !== "undefined" && window.__attuneQuickAi) || null; } catch (e) { return null; } };

/** The notifications the phone kept (Recall + the money reader's), newest first, once each. */
export function allNotes(N = N0()) {
  const a = N && N.recallNotes ? readJson(() => N.recallNotes()) : [], b = N && N.payQueue ? readJson(() => N.payQueue()) : [];
  return [...a, ...b].filter((n, i, all) => n && n.id && all.findIndex((x) => x.id === n.id) === i).sort((x, y) => (y.ts || 0) - (x.ts || 0));
}
// A2: sentences typed in "Reply…" on the phone's question wait here until confirmed in Follow-ups
const SAID_KEY = "attune:noteask:said";
const readSaid = () => { try { return JSON.parse(localStorage.getItem(SAID_KEY) || "[]") || []; } catch (e) { return []; } };
const dropSaid = (key) => { try { localStorage.setItem(SAID_KEY, JSON.stringify(readSaid().filter((x) => NL.sourceOf(x.n).key !== key))); } catch (e) {} };
/** What Attune asks about now: a sentence typed on the phone's question first, then money in a chat / an app it doesn't know. */
export function currentAsks(N = N0(), max = 3) {
  const said = readSaid().map((x) => ({ id: "said:" + NL.sourceOf(x.n).key, src: NL.sourceOf(x.n), n: x.n, said: x.said, why: "money" }));
  const keys = new Set(said.map((a) => a.src.key));
  return [...said, ...NL.asksFrom(allNotes(N), NT.loadTeach(), { max, bankish: moneySourceNote, payOf: payEntryOf }).filter((a) => !keys.has(a.src.key))].slice(0, Math.max(max, said.length));
}
/** A2: tell the phone what it knows + the question's words; take the answers given on the phone's question.
 *  A tap (Mine / Not money) is clear → learnt at once; a typed sentence → asked in Follow-ups ("I understood … — Save"). → lines learnt */
export function syncPhone(N = N0()) {
  if (!N) return [];
  try { N.noteAskKnown && N.noteAskKnown(JSON.stringify(NL.phoneKnown(NT.loadTeach()))); } catch (e) {}
  try { N.noteAskWords && N.noteAskWords(JSON.stringify({ title: tr("What is this? I wasn't sure."), mine: tr("Mine"), not: tr("Not money"), reply: tr("Reply…"), hint: tr("…or tell me in your words") })); } catch (e) {}
  const got = N.noteAskTake ? readJson(() => N.noteAskTake()) : [], out = [];
  for (const a of got) {
    const n = a && a.n; if (!n || !n.title) continue;
    const src = NL.sourceOf(n);
    if (a.meaning) { out.push(saveAnswer(NL.readAnswer(a.meaning, src))); continue; }
    if (a.said) { try { localStorage.setItem(SAID_KEY, JSON.stringify([...readSaid().filter((x) => NL.sourceOf(x.n).key !== src.key), { n, said: String(a.said).slice(0, 300) }])); } catch (e) {} }
  }
  return out;
}

/** Saves an approved answer → the line to show. */
export function saveAnswer(x) {
  if (!x) return "";
  if (x.src) dropSaid(x.src.key);
  if (x.kind === "who") return saveTaught(x);
  if (x.also) { try { saveTaught(x.also); } catch (e) {} }   // the person's card too ("that's my brother, he sends me money")
  NT.saveTeach(NL.applyLabel(x, NT.loadTeach(), Date.now()));
  try { const N = N0(); N && N.noteAskKnown && N.noteAskKnown(JSON.stringify(NL.phoneKnown(NT.loadTeach()))); } catch (e) {}
  return getLang() === "ar" ? "اتعلمت: " + NL.understoodLabel(x, { ar: true }) : tr("Learnt: {l}", { l: NL.understoodLabel(x, { tr }) });
}
const understoodOf = (x, ar) => (x.kind === "who" ? NT.understood(x, { ar, tr }) : NL.understoodLabel(x, { ar, tr }));

/** v9.9.12 a receipt (an email / an app said you were charged): "You paid 939.99 EGP — Google Commerce Limited. Add it to Money?" */
const fmtAmt = (e) => { try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(e.amount) + " " + (e.currency || ""); } catch (x) { return e.amount + " " + (e.currency || ""); } };
export function PaidAskCard({ ask, onDone, flash }) {
  const e = ask.pay, n = ask.n || {}, monthly = /\/\s*(month|mo\b)|monthly|شهري|في الشهر|auto-?renew/i.test(String(n.text || ""));
  const add = () => { const ok = addPaidNow(e); const m = ok ? tr("Added to Money: {a} — {p}", { a: fmtAmt(e), p: e.party || e.from || "" }) : tr("Couldn't add it — open Money once, then try again"); flash && flash(m); if (ok) onDone && onDone(m); };
  const no = () => { dismissPaid(e); onDone && onDone(tr("Not added")); };
  return <div className="space-y-2" data-testid="note-paid" data-key={ask.id}>
    <p className="m-0 text-[14.5px] font-bold flex items-center gap-1.5"><Check size={15} className="text-[var(--c-acc)] shrink-0" />{tr("Looks like you paid — add it to Money?")}</p>
    <div className="rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 py-2">
      <p className="m-0 text-[15px] font-extrabold tabular-nums" dir="auto" data-testid="note-paid-amount">{fmtAmt(e)}{monthly ? <span className="text-[12.5px] font-bold c-sub"> · {tr("every month")}</span> : null}</p>
      <p className="m-0 text-[12.5px] c-sub" dir="auto">{[e.party, src0(ask)].filter(Boolean).join(" · ")}</p>
      <p className="m-0 mt-1 text-[12px] c-sub whitespace-pre-wrap line-clamp-3" dir="auto">{String(n.text || "").slice(0, 200)}</p></div>
    <div className="flex flex-wrap gap-1.5">
      <button onClick={add} className={BTN} data-testid="note-paid-add"><Check size={14} className="inline -mt-0.5 me-1" />{tr("Add to Money")}</button>
      <button onClick={no} className={BTN2} data-testid="note-paid-no">{tr("Not mine")}</button></div>
  </div>;
}
const src0 = (a) => (a.src ? (a.src.kind === "mail" ? a.src.name + " (" + a.src.app + ")" : a.src.app) : "");

/** One question about one source: quick answers, your own words, "I understood: …", Save. */
export function NoteAskCard({ ask, onDone, flash }) {
  if (ask && ask.why === "paid" && ask.pay) return <PaidAskCard ask={ask} onDone={onDone} flash={flash} />;
  return <NoteAskInner ask={ask} onDone={onDone} flash={flash} />;
}
function NoteAskInner({ ask, onDone, flash }) {
  const ar = getLang() === "ar", src = ask.src, n = ask.n || {};
  // v9.9.12: when code already has a good guess (a work / wages group), the card opens on "I think: …" — Save or Change
  const [text, setText] = useState(ask.said || ""), [x, setX] = useState(() => (ask.guess && !ask.said ? NL.readAnswer(ask.guess, src) : null)), [busy, setBusy] = useState(false), [all, setAll] = useState(false);
  const read = async (t) => {
    let r = NL.readAnswer(t, src, { dir: loadDir() });
    if (r && r.kind === "ask") { const ai = quickAi(); if (ai) { setBusy(true); try { const a = NL.readAi(await ai(NL.aiPrompt(t, src, n.text)), src, t); if (a) r = a; } catch (e) {} setBusy(false); } }
    setX(r); if (r && r.kind === "ask") setAll(true);
  };
  useEffect(() => { if (ask.said) read(ask.said); }, []);   // A2: what was typed on the phone's question is read at once — then "Save"
  const save = () => { const m = saveAnswer(x); flash && flash(m); onDone && onDone(m); };
  const notNow = () => { dropSaid(src.key); NT.saveTeach(NL.skipSource(NT.loadTeach(), src.key)); onDone && onDone(""); };
  const quick = ["work", "notmoney", "mymoney", "ignore"];
  const label = (k) => { const m = NL.meaningOf(k); return ar ? m[2] : tr(m[1]); };
  return <div className="space-y-2" data-testid="note-ask" data-key={src.key}>
    <p className="m-0 text-[14.5px] font-bold flex items-center gap-1.5"><GraduationCap size={15} className="text-[var(--c-acc)] shrink-0" />{ask.guess && x && x.kind === "label" && x.meaning === ask.guess ? tr("I think I know what this is — right?") : tr("What is this? I wasn't sure.")}</p>
    <div className="rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 py-2">
      <p className="m-0 text-[11.5px] font-extrabold c-sub" dir="auto">{src.app}{src.kind === "chat" || src.kind === "sms" || src.kind === "mail" ? " · " + src.name : ""}</p>
      <p className="m-0 mt-0.5 text-[13px] whitespace-pre-wrap" dir="auto">{String(n.text || n.title || "").slice(0, 400)}</p></div>
    {!x || x.kind === "ask" ? <>
      <div className="flex flex-wrap gap-1.5" data-testid="note-ask-quick">
        {(all ? NL.MEANINGS.map((m) => m[0]) : quick).map((k) => <button key={k} onClick={() => setX(NL.readAnswer(k, src))} className={CHIP} data-testid={"note-ask-" + k}>{label(k)}</button>)}
        {!all ? <button onClick={() => setAll(true)} className={CHIP + " c-sub"} data-testid="note-ask-more">{tr("Something else…")}</button> : null}
        <button onClick={notNow} className={CHIP + " c-sub inline-flex items-center gap-1"} data-testid="note-ask-skip"><X size={13} />{tr("Not now")}</button>
      </div>
      {x && x.kind === "ask" ? <p className="m-0 text-[13px] font-bold" dir="auto" data-testid="note-ask-which">{tr("I didn't get that for sure — which of these is it?")}</p> : null}
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) read(text); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} dir="auto" placeholder={tr("…or tell me in your words")} className="flex-1 min-w-0 min-h-[42px] rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 text-[13.5px]" data-testid="note-ask-input" />
        <button type="submit" disabled={!text.trim() || busy} className={BTN} data-testid="note-ask-go">{busy ? "…" : tr("Tell")}</button></form>
    </> : <div className="rounded-[12px] bg-[var(--c-surf)] border border-[var(--c-acc)] p-2.5 space-y-2" data-testid="note-ask-understood">
      <p className="m-0 text-[13.5px]" dir="auto"><b>{tr("I understood:")}</b> {understoodOf(x, ar)}</p>
      <div className="flex gap-2"><button onClick={save} className={BTN} data-testid="note-ask-save"><Check size={14} className="inline -mt-0.5 me-1" />{tr("Save")}</button>
        <button onClick={() => { setX(null); setText(""); }} className={BTN2} data-testid="note-ask-change">{tr("Change")}</button></div></div>}
  </div>;
}

/** A4: Chat — "teach me your notifications": the questions one after another, inside the conversation. */
export function TeachChat({ flash }) {
  const [asks, setAsks] = useState(() => currentAsks(N0(), 10)), [done, setDone] = useState([]);
  const cur = asks[0];
  if (!cur) return <p className="m-0 text-[14px]" data-testid="teach-chat-done">{done.length ? tr("That's all for now — I learnt {n}. I'll use it everywhere.", { n: done.filter(Boolean).length }) : tr("Nothing I'm unsure about right now. When a notification isn't clear, I'll ask you here or in Follow-ups.")}</p>;
  return <div className="space-y-2" data-testid="teach-chat">
    <p className={"m-0 text-[12.5px] c-sub"}>{tr("{a} of {b}", { a: done.length + 1, b: done.length + asks.length })}</p>
    <NoteAskCard key={cur.id} ask={cur} flash={flash} onDone={(m) => { setDone((d) => [...d, m]); setAsks((a) => a.slice(1)); }} />
  </div>;
}

/** L: everything Attune learned, with Undo. */
export function LearnedList({ flash }) {
  const ar = getLang() === "ar";
  const [v, setV] = useState(0);
  useEffect(() => { const f = () => setV((x) => x + 1); window.addEventListener("attune-noteteach", f); return () => window.removeEventListener("attune-noteteach", f); }, []);
  const t = NT.loadTeach(), items = NL.learned(t, loadDir());
  const line = (i) => i.type === "label" ? NL.understoodLabel({ kind: "label", src: i.rule.src, meaning: i.rule.meaning }, { ar, tr })
    : i.type === "who" ? NT.understood({ kind: "who", name: i.person.name, role: i.person.role }, { ar, tr })
    : NT.understood({ kind: "rule", rule: i.rule }, { ar, tr });
  const undo = (i) => {
    if (i.type === "who") { flash && flash(tr("Change it on {n}'s People card", { n: i.person.name })); return; }
    NT.saveTeach(NL.undoLabel(NT.loadTeach(), i.id)); setV((x) => x + 1); flash && flash(tr("Undone"));
  };
  void v;
  return <div className="space-y-1.5" data-testid="learned-list">
    {!items.length ? <p className="m-0 text-[13px] c-sub">{tr("Nothing yet — when Attune asks about a notification, your answer shows here.")}</p> : null}
    {items.map((i) => <div key={i.id} className="flex items-start gap-2 rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 py-2" data-testid="learned-row" data-type={i.type}>
      <span className="flex-1 min-w-0 text-[13px]" dir="auto">{line(i)}</span>
      {i.type !== "who" ? <button onClick={() => undo(i)} className="shrink-0 min-h-[34px] px-2 text-[12px] font-bold underline c-sub inline-flex items-center gap-1" data-testid="learned-undo"><Undo2 size={12} />{tr("Undo")}</button> : null}
    </div>)}
  </div>;
}
export function LearnedButton({ flash }) {
  const [open, setOpen] = useState(false);
  let n = 0; try { n = NL.learned(NT.loadTeach(), loadDir()).length; } catch (e) {}
  return <>
    <button onClick={() => setOpen(true)} className="min-h-[34px] px-3 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[12px] font-bold text-[var(--c-ink)] inline-flex items-center gap-1.5" data-testid="learned-open"><GraduationCap size={13} />{tr("What Attune learned ({n})", { n })}</button>
    {open ? <div className="fixed inset-0 z-[80] bg-black/60 flex items-end" onClick={() => setOpen(false)}>
      <div className="calm w-full max-h-[80vh] overflow-y-auto bg-[var(--c-surf)] text-[var(--c-ink)] border-t border-[var(--c-ln)] rounded-t-[20px] p-4 space-y-2.5" onClick={(e) => e.stopPropagation()} data-testid="learned-sheet">
        <p className="m-0 text-[16px] font-extrabold">{tr("What Attune learned")}</p>
        <LearnedList flash={flash} />
        <button onClick={() => setOpen(false)} className={BTN2 + " w-full"}>{tr("Close")}</button>
      </div></div> : null}
  </>;
}

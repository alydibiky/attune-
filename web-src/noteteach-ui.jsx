/* ---- v9.9.3 Teach Attune on a notification (L1/L2) and "Who is …?" asked once (L3). The logic is noteteach.js (tested).
   Nothing is saved before the person sees "I understood: …" and taps Save (Ali: "chat with me to understand what I mean and take
   the approval measures"). Saved on the People card (entities.js) — the same card Chat, voice and "Which Ahmed?" use. */
import React, { useState } from "react";
import { GraduationCap, Check, X } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as NT from "./noteteach.js";
import { loadDir, saveDir } from "./entities.js";
import { loadWatch, saveWatch, newRule } from "./watch.js";

const BTN = "min-h-[40px] px-3.5 rounded-[12px] text-[13px] font-extrabold bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] disabled:opacity-40";
const BTN2 = "min-h-[40px] px-3.5 rounded-[12px] text-[13px] font-extrabold border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)]";

/** Saves what the person approved; → the line to show. */
export function saveTaught(x) {
  const ar = getLang() === "ar";
  const r = NT.applyTeach(x, { dir: loadDir(), teach: NT.loadTeach(), now: Date.now() });
  saveDir(r.dir); NT.saveTeach(r.teach);
  if (r.watch) saveWatch([newRule(r.watch), ...loadWatch()], ar ? "ar" : "en");
  return ar ? "اتعلمت: " + NT.understood(x, { ar: true }) : tr("Learnt: {l}", { l: NT.understood(x, { tr }) });
}

export function TeachBox({ note, flash }) {
  const ar = getLang() === "ar", who = NT.personOf(note);
  const [text, setText] = useState(""), [x, setX] = useState(null), [msg, setMsg] = useState("");
  const read = (t) => { const r = NT.readTeach(t, loadDir(), { name: who }); setX(r || { kind: "ask", q: "I didn't get that — try “Nada is my wife”, “tell me when my wife gets home” or “never show Yazio”.", qAr: "مفهمتش — جرّب «نادا مراتي» أو «قولي لما مراتي توصل البيت» أو «ماتورينيش يازيو»." }); setMsg(""); };
  const save = () => { const m = saveTaught(x); setMsg(m); setX(null); setText(""); flash && flash(m); };
  const quick = (role) => { const r = { kind: "who", name: who, role }; setX(r); };
  return <div className="rounded-[16px] border border-[var(--c-ln)] p-3 space-y-2" data-testid="teach-box">
    <p className="m-0 text-[12px] font-extrabold tracking-[0.05em] uppercase text-[var(--c-acc)] flex items-center gap-1.5"><GraduationCap size={14} />{tr("Teach Attune")}</p>
    {who ? <div className="flex flex-wrap gap-1.5" data-testid="teach-quick">
      <span className="text-[12.5px] c-sub self-center">{tr("{n} is…", { n: who })}</span>
      {["wife", "husband", "mother", "father", "brother", "sister", "son", "daughter", "friend", "boss", "colleague"].map((k) => <button key={k} onClick={() => quick(k)} className="min-h-[34px] px-2.5 rounded-full border border-[var(--c-ln)] text-[12px] font-bold" data-testid={"teach-role-" + k}>{ar ? NT.roleOf(k)[2].replace(/ك$/, "ي") : tr(NT.roleOf(k)[1].replace(/^your /, "my "))}</button>)}
    </div> : null}
    <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) read(text); }} className="flex gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} dir="auto" placeholder={who ? tr("e.g. “{n} is my wife”, “tell me when {n} gets home”", { n: who }) : tr("e.g. “never show this app”")} className="flex-1 min-w-0 min-h-[40px] rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 text-[14px]" data-testid="teach-input" />
      <button type="submit" disabled={!text.trim()} className={BTN} data-testid="teach-go">{tr("Teach")}</button>
    </form>
    {x ? (x.kind === "ask" ? <p className="m-0 text-[13px] font-bold" dir="auto" data-testid="teach-ask">{NT.understood(x, { ar, tr })}</p>
      : <div className="rounded-[12px] bg-[var(--c-soft)] p-2.5 space-y-2" data-testid="teach-understood">
        <p className="m-0 text-[13.5px]" dir="auto"><b>{tr("I understood:")}</b> {NT.understood(x, { ar, tr })}</p>
        <div className="flex gap-2"><button onClick={save} className={BTN} data-testid="teach-save"><Check size={14} className="inline -mt-0.5 me-1" />{tr("Save")}</button>
          <button onClick={() => setX(null)} className={BTN2} data-testid="teach-change">{tr("Change")}</button></div></div>) : null}
    {msg ? <p className="m-0 text-[12.5px] font-bold text-[var(--c-pos)]" data-testid="teach-done" dir="auto">{msg}</p> : null}
  </div>;
}

/** L3 on Home: a name seen often, never taught — asked once. */
export function WhoAskCard({ notes, flash, bump }) {
  const ar = getLang() === "ar";
  const q = NT.whoAsk(notes || [], loadDir(), NT.loadTeach(), Date.now());
  if (!q) return null;
  const pick = (role) => { const m = saveTaught({ kind: "who", name: q.name, role }); flash && flash(m); bump && bump(); };
  const skip = () => { NT.saveTeach(NT.skipAsk(NT.loadTeach(), q.name)); bump && bump(); };
  return <div className="rounded-[14px] border border-[var(--c-ln)] p-2.5 space-y-2" data-testid="who-ask">
    <p className="m-0 text-[13px]" dir="auto">{ar ? `بشوف «${q.name}» كتير${q.app ? " في " + q.app : ""}. مين ده/دي؟` : tr("I see “{n}” often{a}. Who is this?", { n: q.name, a: q.app ? " " + tr("in {a}", { a: q.app }) : "" })}</p>
    <div className="flex flex-wrap gap-1.5">
      {["wife", "family", "friend", "colleague"].map((k) => <button key={k} onClick={() => pick(k)} className="min-h-[36px] px-3 rounded-full border border-[var(--c-ln)] text-[12.5px] font-bold" data-testid={"who-ask-" + k}>{ar ? { wife: "مراتي", family: "من العيلة", friend: "صاحب/صاحبة", colleague: "زميل/زميلة" }[k] : tr({ wife: "My wife", family: "Family", friend: "Friend", colleague: "Work" }[k])}</button>)}
      <button onClick={skip} className="min-h-[36px] px-3 rounded-full text-[12.5px] c-sub inline-flex items-center gap-1" data-testid="who-ask-skip"><X size={13} />{tr("Skip")}</button>
    </div>
  </div>;
}

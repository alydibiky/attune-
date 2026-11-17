/* ---- v9.9.40 the new Autopilot on Home (Ali's OK on K1–K6, 14 Nov 2026). One card:
     K1  a new chat → "What I understood" — ✓ Right / ✎ Change (say it in your words → read → shown again → Right) / Not now
     K2  "Shopping · N items" for each list chat (Talabat); "Done for you" / "For you" lines (tap → K4)
     K4  the full message behind any line: chat, who, when, the whole text, what Attune did and why — Undo · Open chat ·
         Never from this chat
     NS-2 "Kept quietly today: N" (tap → by chat, "This mattered" → describe that chat again)
   The logic is chatpilot.js / autopilot2.js / chatroles.js (tested); this file carries out the effects and draws the card. */
import React, { useEffect, useMemo, useState } from "react";
import { Check, Undo2, Zap, ShoppingCart, MessageCircle, BellRing, ListChecks } from "lucide-react";
import { tr } from "./i18n.js";
import * as CP from "./chatpilot.js";
import * as CR from "./chatroles.js";
import * as L from "./lists.js";
import { applyBought, itemsOf } from "./shoplist.js";
import * as SL from "./secondlook.js";   // v9.9.40 K6

const N = () => (typeof window !== "undefined" ? window.AttuneNative : null);
const readNotes = () => { try { const n = N(); return n && n.recallNotes ? JSON.parse(n.recallNotes() || "[]") : []; } catch (e) { return []; } };
const myNames = () => { try { const p = JSON.parse(localStorage.getItem("attune:profile") || "{}"); return [p.name, p.nick, p.nameAr].filter(Boolean).flatMap((x) => [String(x), String(x).split(" ")[0]]); } catch (e) { return []; } };
const T = (o) => (o && o.t ? tr(o.t, o.v) : "");
const hm = (t) => { try { return new Date(t).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
const tomorrow9 = () => { const d = new Date(Date.now() + 864e5); d.setHours(9, 0, 0, 0); return d.getTime(); };
const open = (mode) => { try { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode } })); } catch (e) {} };
const flash = (m) => { try { window.dispatchEvent(new CustomEvent("attune-flash", { detail: m })); } catch (e) {} };
// a list chat's list in To-dos & lists (made the first time an item comes): { …list, chatKey }
const listFor = (st, chatKey, name) => st.lists.find((l) => l.chatKey === chatKey) || null;
const openItems = (l) => (l ? l.items.filter((i) => !i.done).map((i) => i.text) : []);

function Understood({ rule, chat }) {
  return <ul className="m-0 p-0 list-none space-y-0.5" data-testid="cp-understood">{CR.understood(rule, chat).map((x, i) =>
    <li key={i} className="flex gap-1.5 text-[12.5px]" dir="auto"><Check size={13} className="c-pos shrink-0 mt-0.5" /><span>{tr(x.t, x.v)}</span></li>)}</ul>;
}
// v10.2: the kinds to tap when neither the words nor the AI say what a chat is
const PICKS = [["orders", "Orders I bought"], ["shopping", "Shopping list"], ["work", "Work"], ["family", "Family"], ["friends", "Friends"], ["building", "Building"],
  ["person", "One person"], ["courier", "Deliveries"], ["news", "News & offers"], ["quiet", "Not important"], ["other", "Something else — keep my words"]];
function AskCard({ a, done }) {
  const [say, setSay] = useState(""), [mine, setMine] = useState(null), [step, setStep] = useState("");   // step: "" | "model" | "pick"
  // Attune's guess from EVERYTHING this chat has sent so far (not from one message)
  const guess = useMemo(() => { try { const mb = CP.messagesByChat(readNotes()), msgs = (mb.byKey[a.key] || []).map((m) => ({ who: m.who, text: m.text })); const g = CR.guessRole({ chat: a.chat, group: a.group }, msgs); return g && g.role ? g : a.guess; } catch (e) { return a.guess; } }, [a.key]);
  a = { ...a, guess };
  const rule = mine || (a.guess && a.guess.role ? { role: a.guess.role, care: [], whenMe: false, people: [] } : null);
  const save = (r) => { const v = { ...r, ok: true, by: mine ? "you" : "attune", desc: mine ? say : "" }; CR.saveRole(a.key, v);
    if (a.fromExport) CR.saveRole(a.key.replace(/\|[gp]:/, (m) => (m === "|g:" ? "|p:" : "|g:")), v);   // EX-1: both forms of the chat's name
    done(); flash(tr("Got it — {c} is set", { c: a.chat })); };
  return <div className="rounded-[14px] bg-[var(--c-soft)] p-3 space-y-2" data-testid="cp-ask">
    <p className="m-0 text-[11px] font-extrabold tracking-[0.06em] uppercase c-sub">{tr("New chat · {c}", { c: a.chat })}</p>
    <p className="m-0 text-[12.5px] font-extrabold">{tr("What I understood")}</p>
    <Understood rule={rule} chat={a.chat} />
    {a.guess && a.guess.because && !mine ? <p className="m-0 text-[11.5px] c-sub" dir="auto">{T(a.guess.because)}</p> : null}
    <div className="flex gap-2 flex-wrap">
      <button disabled={!rule || !rule.role} onClick={() => save(rule)} className="min-h-[40px] px-3.5 rounded-[10px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[12.5px] font-extrabold disabled:opacity-40" data-testid="cp-right">✓ {tr("Right")}</button>
      <button onClick={() => { CR.saveRole(a.key, { role: "", ok: false }); done(); }} className="min-h-[40px] px-3 rounded-[10px] border border-[var(--c-ln)] text-[12.5px] font-bold" data-testid="cp-later">{tr("Not now")}</button>
    </div>
    {/* v10.2 (Ali: "I don't want a 1 time fix, I want a fix for good"): after Change there is ALWAYS an answer — 1 the words are read
        by code; 2 if not, the phone's AI reads them; 3 if not (or no model), the kinds to tap + "Something else" (his own words kept).
        What he picks for words Attune didn't get is LEARNED: the same words are understood by themselves next time. */}
    {step === "model" ? <p className="m-0 text-[12px] c-sub" data-testid="cp-say-reading">{tr("Reading your words…")}</p> : null}
    {step === "pick" ? <div className="space-y-1.5" data-testid="cp-say-pick">
      <p className="m-0 text-[12px] font-bold" dir="auto">{tr("I didn't get that one — what is {c}?", { c: a.chat })}</p>
      <div className="flex flex-wrap gap-1.5">{PICKS.map(([r, l]) => <button key={r} type="button" onClick={() => { const rule = { role: r, care: [], whenMe: false, people: [], desc: say, by: "you" }; CR.learnDescription(say, rule); setMine(rule); setStep(""); }}
        className="min-h-[36px] px-3 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[12.5px] font-bold" data-testid={"cp-pick-" + r}>{tr(l)}</button>)}</div></div> : null}
    {mine && mine.role && step === "" ? <p className="m-0 text-[12px] c-pos font-bold" data-testid="cp-say-ok">{tr("Got it — check the lines above, then tap Right.")}</p> : null}
    <form onSubmit={async (e) => { e.preventDefault(); const w = say.trim(); if (!w) return;
        const r = CR.readDescription(w), st = CR.nextStep(r, typeof window !== "undefined" && !!window.__attuneDescAi);
        if (st === "code") { setMine({ ...r, desc: w }); setStep(""); return; }
        setMine(null);
        if (st === "model") { setStep("model"); let m = null; try { m = CR.readDescModel(String(await window.__attuneDescAi(CR.descPrompt(w, a.chat)) || "").match(/\{[\s\S]*\}/)?.[0] || ""); } catch (x) { m = null; }
          if (m && m.role) { CR.learnDescription(w, m); setMine({ ...m, desc: w }); setStep(""); return; } }
        setStep("pick"); }} className="flex gap-2" data-testid="cp-say">
      <input value={say} onChange={(e) => { setSay(e.target.value); setMine(null); setStep(""); }} dir="auto" placeholder={tr("Or say what it is, in your words")} aria-label={tr("Or say what it is, in your words")}
        className="flex-1 min-w-0 min-h-[40px] rounded-[10px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 text-[13px]" data-testid="cp-say-input" />
      <button type="submit" disabled={!say.trim() || step === "model"} className="min-h-[40px] px-3 rounded-[10px] border border-[var(--c-acc)] c-acc text-[12.5px] font-extrabold disabled:opacity-40" data-testid="cp-say-go">✎ {tr("Change")}</button>
    </form>
  </div>;
}
const ICON = { items: ShoppingCart, bought: ListChecks, todo: Check, alert: BellRing };
function lineOf(d) {
  if (d.kind === "items") return tr("Added {x} to {l}", { x: (d.items || []).join(", "), l: d.from.chat });
  if (d.kind === "bought") return tr("Took {n} off {l}", { n: (d.undo && d.undo.itemIds ? d.undo.itemIds.length : 0), l: d.from.chat });
  if (d.kind === "todo") return tr("To-do: {t}", { t: d.title || d.from.text });
  return (d.from.who ? d.from.who + " · " : "") + d.from.chat + ": " + String(d.from.text || "").slice(0, 80);
}
function MessageSheet({ d, close, undo, never }) {
  return <div className="fixed inset-0 z-[80] bg-black/50 flex items-end justify-center" onClick={close} data-testid="cp-sheet">
    <div className="w-full max-w-[560px] rounded-t-[22px] bg-[var(--c-surf)] p-4 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="c-card space-y-1"><p className="m-0 text-[11px] font-extrabold tracking-[0.06em] uppercase c-sub" dir="auto">{d.from.chat} · {d.from.app === "whatsapp" ? "WhatsApp" : d.from.app}</p>
        <p className="m-0 text-[12px] c-sub" dir="auto">{d.from.who ? d.from.who + " · " : ""}{hm(d.from.ts || d.at)}</p>
        <p className="m-0 text-[14px] whitespace-pre-wrap" dir="auto" data-testid="cp-full">{d.from.text}</p></div>
      <div className="rounded-[12px] bg-[var(--c-surf-2)] p-3 space-y-1 text-[12.5px]">
        <p className="m-0" dir="auto"><b>{tr("What Attune did")}</b> {d.kind === "alert" ? tr("Showed it to you") : lineOf(d)}</p>
        <p className="m-0" dir="auto"><b>{tr("Why")}</b> {T(d.why)}</p></div>
      <div className="flex gap-2 flex-wrap">
        {d.kind !== "alert" && !d.undone ? <button onClick={() => { undo(d); close(); }} className="min-h-[44px] px-3.5 rounded-[12px] border border-[var(--c-ln)] text-[13px] font-bold inline-flex items-center gap-1.5" data-testid="cp-undo"><Undo2 size={14} />{tr("Undo")}</button> : null}
        <button onClick={() => { const n = N(); try { n && n.openAnyApp && n.openAnyApp(JSON.stringify({ pkg: d.from.app === "telegram" ? "org.telegram.messenger" : "com.whatsapp", url: "" })); } catch (e) {} }} className="min-h-[44px] px-3.5 rounded-[12px] border border-[var(--c-ln)] text-[13px] font-bold inline-flex items-center gap-1.5" data-testid="cp-open-chat"><MessageCircle size={14} />{tr("Open chat")}</button>
        <button onClick={() => { never(d); close(); }} className="min-h-[44px] px-3.5 rounded-[12px] border border-[var(--c-ln)] text-[13px] font-bold" data-testid="cp-never">{tr("Never from this chat")}</button>
      </div>
      <button onClick={close} className="w-full min-h-[44px] rounded-[12px] text-[13px] font-bold c-sub">{tr("Close")}</button>
    </div></div>;
}

/* (Ali, 16 Nov: "why there is 2 autopilot done for you") ONE Autopilot card on Home: `old` carries the money / bills / deliveries
   part (autopilot-ui.jsx: { has, week, top, done }) — its waiting cards go under the chat question, its done lines under the same
   single "Done for you". */
export function ChatPilotCard({ old = null }) {
  const [st, setSt] = useState(CP.loadCP), [slot, setSlot] = useState(0), [sheet, setSheet] = useState(null), [quietOpen, setQuietOpen] = useState(false), [quietChat, setQuietChat] = useState("");
  useEffect(() => { const t = setInterval(() => setSlot((x) => x + 1), 60000); const f = () => setSlot((x) => x + 1); window.addEventListener("attune-lists", f);
    const g = () => { setSt(CP.loadCP()); setSlot((x) => x + 1); }; window.addEventListener("attune-chatpilot", g); window.addEventListener("attune-notifmind", f);
    return () => { clearInterval(t); window.removeEventListener("attune-lists", f); window.removeEventListener("attune-chatpilot", g); }; }, []);
  const put = (x) => setSt(CP.saveCP(x));
  // look at the new chat messages and carry out what was decided
  useEffect(() => {
    // (the first open: the app's reminder path is set up a moment after this card — wait for it, or a to-do would be lost)
    if (!window.__attuneAddReminder) { const t = setTimeout(() => setSlot((x) => x + 1), 300); return () => clearTimeout(t); }
    const roles = CR.loadRoles(); let lists = L.loadLists();
    const minds = (() => { try { return JSON.parse(localStorage.getItem("attune:notifmind:v1") || "{}") || {}; } catch (e) { return {}; } })();   // v9.9.31 the AI's readings
    const { st: s1, effects } = CP.step(readNotes(), st, { roles, me: myNames(), listOf: (k) => openItems(listFor(lists, k)), minds });
    let s2 = s1, changedLists = false;
    for (const e of effects) {
      if (e.type === "addItems") {
        let l = listFor(lists, e.chatKey);
        if (!l) { l = { ...L.makeList({ name: e.list, emoji: "🛒" }), chatKey: e.chatKey }; lists = { ...lists, lists: [...lists.lists, l] }; }
        const have = new Set(openItems(l).map((x) => x.toLowerCase())), add = e.items.filter((x) => !have.has(x.toLowerCase())).map((x) => ({ id: "i" + Math.random().toString(36).slice(2, 10), text: x, done: false, by: e.rec.from.who || "" }));
        if (add.length) { lists = { ...lists, lists: lists.lists.map((x) => (x.id === l.id ? { ...x, items: [...x.items, ...add] } : x)) }; changedLists = true; s2 = CP.record(s2, { ...e.rec, items: add.map((x) => x.text) }, { listId: l.id, itemIds: add.map((x) => x.id), how: "remove" }); }
      } else if (e.type === "bought") {
        const l = listFor(lists, e.chatKey); if (!l) continue;
        const open = l.items.filter((i) => !i.done), { done } = applyBought(e.bought, open.map((i) => i.text)), ids = open.filter((i) => done.includes(i.text)).map((i) => i.id);
        if (ids.length) { lists = { ...lists, lists: lists.lists.map((x) => (x.id === l.id ? { ...x, items: x.items.map((i) => (ids.includes(i.id) ? { ...i, done: true } : i)) } : x)) }; changedLists = true; s2 = CP.record(s2, e.rec, { listId: l.id, itemIds: ids, how: "untick" }); }
      } else if (e.type === "todo") {
        const id = "cp-" + Math.abs(String(e.rec.id).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
        try { window.__attuneAddReminder && window.__attuneAddReminder({ id, at: e.due > Date.now() ? e.due : tomorrow9(), title: e.title, body: e.rec.from.text, repeat: "none", created: Date.now(), source: "chatpilot" }); } catch (x) {}
        s2 = CP.record(s2, e.rec, { reminderId: id });
      } else if (e.type === "alert") s2 = CP.record(s2, e.rec, {});
    }
    if (changedLists) L.saveLists(lists);
    if (JSON.stringify(s2) !== JSON.stringify(st)) put(s2);
  }, [slot]);
  const undo = (d) => {
    const u = d.undo || {};
    if (u.listId) { const ls = L.loadLists(); L.saveLists({ ...ls, lists: ls.lists.map((l) => (l.id !== u.listId ? l : { ...l, items: u.how === "remove" ? l.items.filter((i) => !u.itemIds.includes(i.id)) : l.items.map((i) => (u.itemIds.includes(i.id) ? { ...i, done: false } : i)) })) }); }
    if (u.reminderId) { try { window.__attuneRemoveReminder && window.__attuneRemoveReminder(u.reminderId); } catch (e) {} }
    put(CP.markUndone(st, d.id)); flash(tr("Undone"));
  };
  const never = (d) => { CR.saveRole(d.from.chatKey, { role: "quiet", ok: true, by: "you" }); flash(tr("Nothing more from {c}", { c: d.from.chat })); };
  // v9.9.40 K6: on the computer (bigger AI), the phone's decisions of the week are read again once a day; each fix is done here with
  // Undo and travels back to the phone with sync
  useEffect(() => {
    const n = N(), isDesk = !!(n && n.desktop);
    if (!isDesk || !window.__attuneModelJSON || (st.review && Date.now() - st.review.at < 20 * 3600e3)) return;
    let off = false;
    (async () => {
      const items = SL.toReview(st, Date.now() - 7 * 864e5); if (!items.length) return;
      const roles = CR.loadRoles(), batches = [], results = [];
      for (let i = 0; i < items.length && i < 200; i += 20) { const b = items.slice(i, i + 20); const out = await window.__attuneModelJSON(SL.reviewPrompt(b, roles)); if (off) return; const r = SL.readReview(out, b); if (!r) continue; batches.push(b); results.push(r); }
      if (!results.length) return;
      const rec = SL.reviewRecord(batches, results);
      let s2 = { ...CP.loadCP(), review: rec }, lists = L.loadLists(), changed = false;
      for (const f of rec.fixes) {
        const d = (s2.done || []).find((x) => x.id === f.id);
        if (f.should === "keep" && d && !d.undone) { undo(d); s2 = CP.markUndone(CP.loadCP(), d.id); s2.review = rec; }
        else if (f.should === "items" && f.from.chatKey) { let l = listFor(lists, f.from.chatKey); const its = itemsOf(f.from.text).length ? itemsOf(f.from.text) : [f.from.text];
          if (!l) { l = { ...L.makeList({ name: f.from.chat, emoji: "🛒" }), chatKey: f.from.chatKey }; lists = { ...lists, lists: [...lists.lists, l] }; }
          const add = its.map((x) => ({ id: "i" + Math.random().toString(36).slice(2, 10), text: x, done: false, by: f.from.who || "" }));
          lists = { ...lists, lists: lists.lists.map((x) => (x.id === l.id ? { ...x, items: [...x.items, ...add] } : x)) }; changed = true;
          s2 = CP.record(s2, { id: "rv:" + f.id, kind: "items", at: Date.now(), from: f.from, items: its, why: { t: "the computer checked it: {r}", v: { r: f.reason } } }, { listId: l.id, itemIds: add.map((x) => x.id), how: "remove" }); }
        else if (f.should === "todo") { const id = "cp-rv-" + Math.abs(String(f.id).split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7));
          try { window.__attuneAddReminder && window.__attuneAddReminder({ id, at: tomorrow9(), title: (f.from.who || f.from.chat) + ": " + String(f.from.text).slice(0, 80), body: f.from.text, repeat: "none", created: Date.now(), source: "chatpilot" }); } catch (e) {}
          s2 = CP.record(s2, { id: "rv:" + f.id, kind: "todo", at: Date.now(), from: f.from, title: (f.from.who || f.from.chat) + ": " + String(f.from.text).slice(0, 80), why: { t: "the computer checked it: {r}", v: { r: f.reason } } }, { reminderId: id }); }
        else if (f.should === "alert") s2 = CP.record(s2, { id: "rv:" + f.id, kind: "alert", at: Date.now(), from: f.from, why: { t: "the computer checked it: {r}", v: { r: f.reason } } }, {});
      }
      if (changed) L.saveLists(lists);
      if (!off) put(s2);
    })();
    return () => { off = true; };
  }, [slot]);
  const ask = st.ask[0] || null;
  const doneAsk = () => { put({ ...st, ask: st.ask.slice(1) }); setSlot((x) => x + 1); };   // (looked at again at once: the waiting messages are acted on now)
  const lists = useMemo(() => L.loadLists().lists.filter((l) => l.chatKey && openItems(l).length), [slot, st]);
  const recent = st.done.filter((d) => !d.undone && d.at > Date.now() - 2 * 864e5).slice(0, 5);
  const q = CP.quietToday(st);
  const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const keptOf = (chat) => (st.kept || []).filter((m) => m.from && m.from.chat === chat && m.at >= today0).sort((x, y) => y.at - x.at);
  const mine = !!(ask || lists.length || recent.length || q.total || (st.review && st.review.total));
  if (!mine && !(old && old.has)) return null;
  const week = ((old && old.week) || 0) + st.done.filter((d) => !d.undone && d.kind !== "alert" && d.at > Date.now() - 7 * 864e5).length;
  return <section className="c-card p-3.5" style={{ borderColor: "color-mix(in srgb, var(--c-area-agents, var(--c-acc)) 35%, var(--c-ln))" }} data-testid="autopilot"><div className="space-y-2" data-testid={mine ? "chatpilot" : "autopilot-only"}>
    <div className="flex items-center gap-2"><Zap size={15} style={{ color: "var(--c-area-agents, var(--c-acc))" }} />
      <span className="flex-1 text-[12px] font-extrabold tracking-wide uppercase" style={{ color: "var(--c-area-agents, var(--c-acc))" }}>{tr("Autopilot")}</span>
      {week ? <span className="text-[11.5px] c-sub" data-testid="autopilot-week">{tr("{n} done this week", { n: week })}</span> : null}</div>
    {ask ? <AskCard key={ask.key} a={ask} done={doneAsk} /> : null}
    {old && old.top ? old.top : null}
    {lists.map((l) => { const its = openItems(l); return <button key={l.id} onClick={() => open("lists")} className="w-full flex items-center gap-3 text-start min-h-[48px]" data-testid="cp-shopping">
      <span className="w-9 h-9 rounded-[10px] bg-[var(--c-soft)] grid place-items-center shrink-0"><ShoppingCart size={16} className="c-acc" /></span>
      <span className="flex-1 min-w-0"><b className="block text-[14px]">{its.length === 1 ? tr("Shopping · 1 item") : tr("Shopping · {n} items", { n: its.length })}</b><span className="block c-sub text-[12px] truncate" dir="auto">{l.name} · {its.slice(-3).join(", ")}</span></span>
      <span className="text-[12.5px] font-extrabold c-acc">{tr("Open")}</span></button>; })}
    {recent.length || (old && old.done) ? <p className="m-0 text-[11px] font-extrabold tracking-[0.06em] uppercase c-sub" data-testid="ap-done-title">{tr("Done for you")}</p> : null}
    {recent.length ? <div className="space-y-1" data-testid="cp-done">
      {recent.map((d) => { const I = ICON[d.kind] || Check; return <button key={d.id} onClick={() => setSheet(d)} className="w-full flex items-start gap-2 text-start min-h-[44px] py-1" data-testid="cp-line" data-kind={d.kind}>
        <I size={14} className="c-acc shrink-0 mt-1" /><span className="flex-1 min-w-0"><span className="block text-[13px] font-bold truncate" dir="auto">{lineOf(d)}</span>
          <span className="block text-[11.5px] c-sub truncate" dir="auto">{d.from.chat}{d.from.who ? " · " + d.from.who : ""} · {hm(d.from.ts || d.at)} · {tr("tap for the message")}</span></span></button>; })}
    </div> : null}
    {old && old.done ? old.done : null}
    {st.review && st.review.total ? <div className="rounded-[12px] bg-[var(--c-surf-2)] p-2.5 space-y-1" data-testid="cp-review">
      <p className="m-0 text-[12.5px] font-extrabold">{tr("Computer checked: {n} · {f} fixed", { n: st.review.total, f: st.review.fixes.length })}</p>
      {st.review.fixes.slice(0, 3).map((f) => <p key={f.id} className="m-0 text-[12px] c-sub" dir="auto">“{String(f.from.text).slice(0, 60)}” — {f.reason || tr("fixed")}</p>)}
    </div> : null}
    {q.total ? <div data-testid="cp-quiet">
      <button onClick={() => setQuietOpen((v) => !v)} className="w-full flex items-center gap-2 text-start min-h-[44px]" data-testid="cp-quiet-line">
        <span className="text-[16px]" aria-hidden="true">🤫</span><span className="flex-1 min-w-0"><b className="block text-[13px]">{tr("Kept quietly today: {n}", { n: q.total })}</b>
          <span className="block c-sub text-[11.5px] truncate" dir="auto">{q.byChat.slice(0, 3).map(([c, n]) => c + " " + n).join(" · ")}</span></span><span className="text-[12px] font-bold c-acc">{tr("See")}</span></button>
      {/* v10.0.3 (Ali, 16 Nov: "Kept quietly today: 61 — I want to tap a chat and see the messages before I say it mattered"): a tap on
          a chat's row opens what it kept today, in full */}
      {quietOpen ? <div className="space-y-1 pt-1">{q.byChat.map(([c, n]) => <div key={c} data-testid="cp-quiet-chat"><div className="flex items-center gap-2 text-[12.5px]">
        <button onClick={() => setQuietChat(quietChat === c ? "" : c)} aria-expanded={quietChat === c} className="flex-1 min-w-0 min-h-[40px] text-start flex items-center gap-1.5" data-testid="cp-quiet-row"><span className="truncate font-bold" dir="auto">{c} · {n}</span><span className="c-acc text-[12px] font-bold shrink-0">{quietChat === c ? tr("Hide") : tr("See")}</span></button>
        <button onClick={() => { const k = Object.keys(CR.loadRoles()).find((x) => x.endsWith(":" + c.toLowerCase())) || ""; put({ ...st, ask: [{ key: k || "whatsapp|g:" + c.toLowerCase(), chat: c, group: true, guess: { role: "" }, at: Date.now() }, ...st.ask] }); setQuietOpen(false); }}
          className="min-h-[36px] px-2.5 rounded-[10px] border border-[var(--c-ln)] text-[12px] font-bold shrink-0" data-testid="cp-mattered">{tr("This mattered")}</button></div>
        {quietChat === c ? <div className="rounded-[12px] bg-[var(--c-surf-2)] p-2 mt-1 space-y-1.5 max-h-[320px] overflow-y-auto" data-testid="cp-quiet-msgs">
          {keptOf(c).map((m) => <div key={m.id} className="text-[12.5px]"><span className="block c-sub text-[11px]" dir="auto">{m.from.who ? m.from.who + " · " : ""}{new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
            <span className="block whitespace-pre-wrap break-words" dir="auto">{m.from.text || "—"}</span></div>)}
          {keptOf(c).length < n ? <p className="m-0 text-[11.5px] c-sub">{tr("Only the last 200 kept messages are shown here — all of them are in Recall.")}</p> : null}
        </div> : null}</div>)}</div> : null}
    </div> : null}
    {sheet ? <MessageSheet d={sheet} close={() => setSheet(null)} undo={undo} never={never} /> : null}
  </div></section>;
}

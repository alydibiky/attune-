/* ---- v10.5 the small box over the home screen (Ali OK'd OK-W3 "Tell Attune", OK-A1 "+ Add", OK-W2 "− I spent / + I got").
   QuickBoxActivity opens Attune's page with ?quick=say|voice|list|spend|got&list=<id> in a see-through window: this file draws ONLY
   the box (the app itself is not started). What is typed or said goes through the same reader as the Home box (doit.js
   understandAll → apply), each part is saved with its own Undo, the widgets are refreshed, and a question or anything the box can't
   do opens Chat with the words. Tests: tests/unit/v1050widgets.test.mjs, tests/e2e_v1050widgets.py. */
import React, { useEffect, useRef, useState } from "react";
import { tr, getLang } from "./i18n.js";
import { understandAll, apply as doApply } from "./doit.js";
import { loadStores } from "./lifeask.js";
import * as L from "./lists.js";
import { loadReminders, saveReminders, syncToPhone } from "./actions.js";
import { itemsOf, spendOf } from "./widgets2.js";
import { pushWidgets } from "./widgets-ui.jsx";

const N = () => (typeof window !== "undefined" ? window.AttuneNative : null);
export const quickParams = () => { try { const q = new URLSearchParams(location.search); const m = q.get("quick"); return m ? { mode: m, list: q.get("list") || "" } : null; } catch (e) { return null; } };
const snap = (keys) => Object.fromEntries(keys.map((k) => { try { return [k, localStorage.getItem(k)]; } catch (e) { return [k, null]; } }));
const restore = (s) => { for (const [k, v] of Object.entries(s || {})) try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
const ar = () => /^ar/.test(getLang() || "");
const CATS = [["food", "Food"], ["groceries", "Groceries"], ["transport", "Transport"], ["bills", "Bills"], ["shopping", "Shopping"], ["health", "Health"], ["other", "Other"]];
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

/** Runs one sentence through the Home box's reader. → { lines: [{ text, undo }], chat: bool } (chat = the box can't do it here). */
export function runSay(text, { now = Date.now(), native = N() } = {}) {
  let u = null; try { u = understandAll(text, { now, stores: loadStores() }); } catch (e) { u = null; }
  const acts = (u && u.actions) || [], lines = [];
  if (!acts.length) return { lines, chat: true };
  let skipped = false;
  for (const a of acts) {
    let r = null; try { r = doApply(a, loadStores(), { now }); } catch (e) { r = null; }
    if (!r) { skipped = true; continue; }
    if (r.need && r.need !== "reminder") { skipped = true; continue; }   // a note for Mind, a watch rule, Cycle: those need the app
    const keys = Object.keys(r.stores || {}), before = snap(keys);
    for (const [k, v] of Object.entries(r.stores || {})) try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    let rid = "";
    if (r.need === "reminder" && a.action) {
      rid = "q" + now.toString(36) + Math.random().toString(36).slice(2, 5);
      const list = [...loadReminders(), { id: rid, at: a.action.at, title: a.action.title, body: "", repeat: a.action.repeat || "none", created: now, source: "widget" }];
      saveReminders(list); try { syncToPhone(native, list); } catch (e) {}
    }
    const done = r.done ? (ar() ? r.done.ar || r.done.en : r.done.en) : "";
    lines.push({ text: done || tr("Saved"), undo: () => { restore(before); if (rid) { const list = loadReminders().filter((x) => x.id !== rid); saveReminders(list); try { native && native.unschedule && native.unschedule(rid); syncToPhone(native, list); } catch (e) {} } } });
  }
  return { lines, chat: skipped && !lines.length };
}
/** "+ Add" on the list widget: "cheese, pickles and bread" → 3 items on that list. */
export function runAdd(listId, text) {
  const items = itemsOf(text); if (!items.length) return { lines: [] };
  const before = snap([L.LISTS_KEY]), st = L.loadLists(), l = (st.lists || []).find((x) => x.id === listId);
  if (!l) return { lines: [] };
  L.saveLists(L.addItem(st, listId, items.join(", ")));
  return { lines: [{ text: tr("Added to {l}: {i}", { l: l.name, i: items.join(", ") }), undo: () => restore(before) }] };
}
/** "− I spent" / "+ I got": an amount, a few words, a category → Money (the same way the Home box adds it). */
export function runMoney(kind, text, cat, { now = Date.now() } = {}) {
  const s = spendOf(text); if (!s) return { lines: [] };
  const a = { kind: "money", items: [{ type: kind === "got" ? "income" : "expense", amount: s.amount, cat: kind === "got" ? "other" : cat || "other", note: s.note || tr(kind === "got" ? "Income" : "Expense"), date: iso(now) }] };
  let r = null; try { r = doApply(a, loadStores(), { now }); } catch (e) { r = null; }
  if (!r) return { lines: [] };
  const before = snap(Object.keys(r.stores || {}));
  for (const [k, v] of Object.entries(r.stores || {})) try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  return { lines: [{ text: r.done ? (ar() ? r.done.ar || r.done.en : r.done.en) : tr("Saved"), undo: () => restore(before) }] };
}

export function QuickBox({ mode = "say", list = "" }) {
  const [text, setText] = useState(""), [cat, setCat] = useState("food"), [lines, setLines] = useState([]), [chat, setChat] = useState(false), [listening, setListening] = useState(mode === "voice");
  const ref = useRef(null);
  const st = L.loadLists(), theList = (st.lists || []).find((x) => x.id === list);
  const dark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const C = dark ? { bg: "#221C1E", ink: "#F3ECEE", mut: "#B3A6AB", acc: "#E39AB3", on: "#2A1219", ln: "#3A3134", soft: "#3A2229" } : { bg: "#FFFFFF", ink: "#231C1E", mut: "#7A6F73", acc: "#7A2A45", on: "#FFFFFF", ln: "#ECE5E7", soft: "#F7E9EE" };
  const close = () => { try { pushWidgets(N()); } catch (e) {} try { N() && N().quickClose ? N().quickClose() : null; } catch (e) {} };
  const go = (t0) => {
    const t = String(t0 == null ? text : t0).trim(); if (!t) return;
    const r = mode === "list" ? runAdd(list, t) : mode === "spend" || mode === "got" ? runMoney(mode, t, cat) : runSay(t);
    setLines((x) => [...x, ...r.lines.map((l, i) => ({ ...l, k: Date.now() + i, undone: false }))]); setChat(!!r.chat || (!r.lines.length && mode !== "list"));
    if (r.lines.length) { setText(""); try { pushWidgets(N()); } catch (e) {} }
  };
  useEffect(() => { document.documentElement.style.background = "transparent"; document.body.style.background = "transparent";
    window.__quickHeard = (t) => { setListening(false); if (t) { setText(t); go(t); } };
    const f = setTimeout(() => { try { ref.current && ref.current.focus(); } catch (e) {} }, 150); return () => clearTimeout(f); }, []);
  const title = mode === "list" ? tr("Add to {l}", { l: theList ? theList.name : tr("the list") }) : mode === "spend" ? tr("I spent") : mode === "got" ? tr("I got") : tr("Tell Attune");
  const hint = mode === "list" ? tr("cheese, pickles and bread") : mode === "spend" ? tr("200 koshary") : mode === "got" ? tr("2,500 from Sheikh") : tr("add milk to Talabat and I spent 200 on koshary");
  const btn = (bg, fg) => ({ background: bg, color: fg, border: bg === "transparent" ? "1.5px solid " + C.acc : 0, borderRadius: 99, padding: "8px 16px", fontWeight: 800, fontSize: 14, minHeight: 40 });
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: "Nunito, system-ui, sans-serif" }} onClick={close} data-testid="quickbox" data-mode={mode} dir={ar() ? "rtl" : "ltr"}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg, color: C.ink, width: "100%", maxWidth: 520, borderRadius: "22px 22px 0 0", padding: "16px 16px calc(16px + env(safe-area-inset-bottom,0px))", boxShadow: "0 -8px 30px rgba(0,0,0,.3)", display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><b style={{ fontSize: 16, flex: 1 }}>{title}</b>
        <button onClick={close} aria-label={tr("Close")} style={{ ...btn("transparent", C.acc), border: 0, padding: "4px 10px" }} data-testid="quickbox-close">✕</button></div>
      {listening ? <p style={{ margin: 0, color: C.mut, fontWeight: 700 }} data-testid="quickbox-listening">🎤 {tr("Listening…")}</p> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } }} rows={2} placeholder={hint} dir="auto"
          style={{ flex: 1, minWidth: 0, resize: "none", border: "1px solid " + C.ln, borderRadius: 14, padding: "10px 12px", background: C.soft, color: C.ink, fontSize: 15, fontFamily: "inherit" }} data-testid="quickbox-input" />
        <button onClick={() => go()} style={btn(C.acc, C.on)} data-testid="quickbox-go">{mode === "list" ? tr("Add") : tr("Save")}</button>
      </div>
      {mode === "spend" ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{CATS.map(([k, l]) => <button key={k} onClick={() => setCat(k)} style={{ ...btn(cat === k ? C.acc : "transparent", cat === k ? C.on : C.acc), padding: "4px 12px", minHeight: 34, fontSize: 13 }} data-testid={"quickbox-cat-" + k}>{tr(l)}</button>)}</div> : null}
      {lines.map((l) => <div key={l.k} style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid " + C.ln, paddingTop: 8 }} data-testid="quickbox-line">
        <span style={{ color: l.undone ? C.mut : "#1E7A43", fontWeight: 900 }}>{l.undone ? "↶" : "✓"}</span><span style={{ flex: 1, fontSize: 14, textDecoration: l.undone ? "line-through" : "none", color: l.undone ? C.mut : C.ink }} dir="auto">{l.text}</span>
        {l.undone ? null : <button onClick={() => { try { l.undo(); } catch (e) {} setLines((x) => x.map((y) => (y.k === l.k ? { ...y, undone: true } : y))); try { pushWidgets(N()); } catch (e) {} }} style={{ ...btn("transparent", C.acc), padding: "4px 12px", minHeight: 32, fontSize: 13 }} data-testid="quickbox-undo">{tr("Undo")}</button>}
      </div>)}
      {chat ? <div style={{ display: "flex", gap: 8, alignItems: "center" }} data-testid="quickbox-chat"><span style={{ flex: 1, fontSize: 13.5, color: C.mut }}>{tr("Attune answers this in Chat.")}</span>
        <button onClick={() => { try { N() && N().quickOpen && N().quickOpen("chat", text || (lines[lines.length - 1] || {}).text || ""); } catch (e) {} }} style={btn(C.acc, C.on)} data-testid="quickbox-open-chat">{tr("Open Chat")}</button></div> : null}
      {lines.length ? <button onClick={close} style={{ ...btn("transparent", C.acc), justifySelf: "end" }} data-testid="quickbox-done">{tr("Done")}</button> : null}
    </div>
  </div>;
}

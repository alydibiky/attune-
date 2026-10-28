// v6.25 — the computer's own pages (Ali picked "A + C"): Home (ask box, your day, your tools) and Tools (every tool on one
// full-width page; ★ pins a tool to the sidebar). Phones keep Chat as home and the More sheet.
import React, { useState, useMemo, useEffect } from "react";
import { Send, Star, LayoutGrid, Bell, Apple, Brain, MessageCircle } from "lucide-react";
import { openRead } from "./readaloud-ui.jsx";
import { DoResult } from "./doit-ui.jsx";
import { tr } from "./i18n.js";
import { usePins, recentTools } from "./side-ui.jsx";
import { BoxModes, takeBoxMode, BOX_HINT } from "./cmdbox-ui.jsx";
import { LifeAnswer } from "./lifeask-ui.jsx";
import * as LA from "./lifeask.js";

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const todayKey = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/** What the Home page says about today — read from what is already stored, nothing generated. */
export function todayFacts(now = new Date()) {
  const out = {};
  const fit = read("attune:fit:v1");
  const day = fit && fit.days && fit.days[todayKey(now)];
  if (day && day.meals) {
    let kcal = 0, n = 0;
    for (const m of Object.values(day.meals)) for (const x of m || []) { if (x && x.kcal != null) { kcal += +x.kcal || 0; n++; } }
    if (n) out.kcal = Math.round(kcal);
  }
  const rem = read("attune:reminders:v1");
  const list = Array.isArray(rem) ? rem : (rem && rem.items) || [];
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  out.reminders = list.filter((r) => r && !r.done && r.at >= now.getTime() && r.at <= end.getTime()).length;
  const chats = read("attune:chats:v1");
  out.chats = Array.isArray(chats) ? chats.length : 0;
  return out;
}

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const Card = ({ id, label, sub, Icon, onClick, testid }) => (
  <button onClick={onClick} data-testid={testid || "home-card-" + id}
    className="text-start rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:border-[var(--c-acc)] p-4 min-h-[124px] flex flex-col transition-colors duration-150">
    <span className="w-10 h-10 rounded-[12px] bg-[var(--c-soft)] text-[var(--c-acc)] flex items-center justify-center"><Icon size={19} /></span>
    <span className="mt-3 text-[15px] font-extrabold text-[var(--c-ink)] leading-tight">{tr(label)}</span>
    <span className="mt-0.5 text-[12.5px] text-[var(--c-mut)] leading-snug line-clamp-2">{tr(sub)}</span>
  </button>);

export function DesktopHome({ tools, navTo, onAsk, engineReady, name, doIt }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(null);   // v6.28 "Do it from Home"
  const facts = useMemo(() => todayFacts(), []);
  const recent = recentTools().map((id) => tools.find((t) => t[0] === id)).filter(Boolean);
  // v6.27 (Ali: "I don't want Maps with Money"): the main cards are Money, Business and Mind; Maps lives in Tools / pinned
  const core = ["money", "business", "memory"].map((id) => tools.find((t) => t[0] === id)).filter(Boolean);
  const cards = [...core, ...recent.filter((t) => !core.includes(t))].slice(0, 7);
  // v7.6 (Ali): Chat · Your life · Translate as pills in the box (the separate pages are gone)
  const [boxMode, setBoxMode] = useState(takeBoxMode);
  const [life, setLife] = useState(null);
  useEffect(() => { const on = (e) => { setBoxMode(takeBoxMode() || e.detail); setLife(null); }; window.addEventListener("attune-box-mode", on); return () => window.removeEventListener("attune-box-mode", on); }, []);
  const send = () => {
    const t = text.trim(); if (!t) return; setText(""); setLife(null); setDone(null);
    if (boxMode === "life") { let a = null; try { a = LA.askLife(t, LA.loadStores()); } catch (e) { a = null; } return setLife({ q: t, a }); }
    if (boxMode === "translate") return onAsk("\u0004" + t, true);
    let r = null; try { r = doIt ? doIt(t) : null; } catch (e) { r = null; } if (r) setDone({ ...r, id: Date.now() }); else onAsk(t);
  };
  const starters = [["Summarise a PDF", "pdfchat"], ["Read a paper to me", "read"], ["Plan a weekend trip", null], ["Plan my meals", "fit"], ["Convert a file", "convert"]];
  return (
    <div className="calm pt-2 pb-10 space-y-5" data-testid="desk-home">
      <h1 className="text-[28px] font-black text-[var(--c-ink)] tracking-tight m-0">{tr(greeting())}{name ? ", " + name : ""}</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
          <p className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-[var(--c-mut)] mb-2.5 mt-0">{tr("Ask anything")}</p>
          <div className="flex items-end gap-2 rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-bg)] px-3.5 py-2.5 focus-within:border-[var(--c-acc)] transition-colors duration-150">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} dir="auto" data-testid="home-ask"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={BOX_HINT[boxMode] ? tr(BOX_HINT[boxMode]) : tr("Ask, or tell Attune what happened — «spent 150 on lunch», «had foul for breakfast»…")} className="flex-1 resize-none bg-transparent text-[15.5px] font-semibold text-[var(--c-ink)] placeholder:text-[var(--c-mut)] placeholder:font-normal focus:outline-none py-1" />
            <button onClick={send} disabled={!text.trim()} data-testid="home-send" aria-label={tr("Send")}
              className="w-11 h-11 rounded-[12px] bg-[var(--c-acc)] text-[var(--c-on-acc)] flex items-center justify-center disabled:opacity-40 transition-opacity duration-150"><Send size={17} className="rtl:-scale-x-100" /></button>
          </div>
          <div className="mt-3"><BoxModes mode={boxMode} setMode={(m) => { setBoxMode(m); setLife(null); }} /></div>
          {done ? <div className="calm rounded-[20px] mt-3"><DoResult key={done.id} r={done} navTo={navTo} onClose={() => setDone(null)} /></div> : null}
          {life ? <div className="mt-3"><LifeAnswer res={life} navTo={navTo} askChat={(q) => { setLife(null); onAsk(q); }} onClose={() => setLife(null)} /></div> : null}
          {boxMode === "translate" ? <button onClick={() => navTo("translate")} className="mt-2 min-h-[40px] text-[13px] font-bold text-[var(--c-acc)] inline-flex items-center gap-1" data-testid="box-translate-more">{tr("Talk with someone, a photo or a document")} →</button> : null}
          <div className="flex flex-wrap gap-2 mt-3">
            {starters.map(([t, tool]) => <button key={t} onClick={() => (tool === "read" ? openRead() : tool ? navTo(tool) : onAsk(tr(t)))} data-testid={tool === "read" ? "home-read" : undefined}
              className="min-h-[40px] rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)] text-[13px] font-bold px-4 hover:border-[var(--c-acc)] transition-colors duration-150">{tr(t)}</button>)}
          </div>
        </div>
        <div className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5 space-y-2" data-testid="home-today">
          <p className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-[var(--c-mut)] m-0">{tr("Today")}</p>
          {facts.kcal != null ? <button onClick={() => navTo("fit")} className="min-h-[44px] flex items-center gap-2 text-start"><Apple size={16} className="text-[var(--c-pos)]" />
            <span className="text-[24px] font-black text-[var(--c-ink)] tabular-nums tracking-tight">{facts.kcal}</span><span className="text-[12.5px] text-[var(--c-mut)]">{tr("kcal eaten")}</span></button> : null}
          <button onClick={() => navTo("reminders")} className="min-h-[44px] flex items-center gap-2 text-[13.5px] font-semibold text-[var(--c-ink)]"><Bell size={15} className="text-[var(--c-warn)]" />
            {facts.reminders ? tr("{n} reminders left today", { n: facts.reminders }) : tr("No more reminders today")}</button>
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--c-ink)] m-0 tabular-nums"><MessageCircle size={15} className="text-[var(--c-acc)]" />{tr("{n} chats saved", { n: facts.chats })}</p>
          <p className={"text-[12.5px] font-bold m-0 pt-1 " + (engineReady ? "text-[var(--c-acc)]" : "text-[var(--c-mut)]")}>{engineReady ? tr("The model is ready") : tr("The model wakes when you ask")}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4" data-testid="home-cards">
        {cards.map(([id, label, sub, Icon]) => <Card key={id} id={id} label={label} sub={sub} Icon={Icon} onClick={() => navTo(id)} />)}
        <Card id="tools" label="All tools" sub={tr("{n} tools", { n: tools.length - 1 })} Icon={LayoutGrid} onClick={() => navTo("tools")} testid="home-all-tools" />
      </div>
    </div>);
}

export function ToolsPage({ tools, groups, navTo, subtitle, showPins = true, pages = null, top = null }) {
  const [pins, togglePin] = usePins();
  const [q, setQ] = useState("");
  const nq = q.trim().toLowerCase();
  const match = ([id, label, sub]) => !nq || (tr(label) + " " + tr(sub) + " " + label + " " + sub).toLowerCase().includes(nq);
  return (
    <div className="calm pt-2 pb-10" data-testid="tools-page">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-[24px] font-black text-[var(--c-ink)] tracking-tight m-0">{tr("Tools")}</h1>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Find a tool")} dir="auto" data-testid="tools-find"
          className="ms-auto w-40 sm:w-72 min-w-0 min-h-[44px] h-11 rounded-[12px] bg-[var(--c-surf)] border border-[var(--c-ln)] px-3.5 text-[14px] font-semibold text-[var(--c-ink)] placeholder:text-[var(--c-mut)] placeholder:font-normal focus:outline-none focus:border-[var(--c-acc)] transition-colors duration-150" />
      </div>
      <p className="text-[13px] text-[var(--c-mut)] mt-1 mb-4">{tr(subtitle || "Every tool on one page — ★ pins it to the sidebar.")}</p>
      {top && !nq ? top : null}
      {/* v6.30 (Ali: "no more than 6 pages"): `pages` = [id, title, what is inside, members] — one card each; searching lists single tools */}
      {pages && !nq ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="tools-pages">
          {pages.map(([pid, title, sub, members]) => {
            const first = tools.find((t) => t[0] === members[0]); const Icon = first ? first[3] : Star;
            const names = members.map((m) => tools.find((t) => t[0] === m)).filter(Boolean);
            return (
              <button key={pid} onClick={() => navTo(members[0])} data-testid={"tools-page-" + pid}
                className="text-start rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:border-[var(--c-acc)] transition-colors duration-150 p-4 flex items-start gap-3">
                <span className="w-11 h-11 shrink-0 rounded-[12px] bg-[var(--c-soft)] text-[var(--c-acc)] flex items-center justify-center"><Icon size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-extrabold text-[var(--c-ink)] leading-tight">{tr(title)}</span>
                  <span className="block text-[12.5px] text-[var(--c-mut)] leading-snug mt-1">{tr(sub)}</span>
                  {names.length > 1 ? <span className="flex flex-wrap gap-1.5 mt-2.5">{names.map(([id, label]) => (
                    <span key={id} className="text-[11px] font-bold rounded-full border border-[var(--c-ln)] bg-[var(--c-bg)] text-[var(--c-mut)] px-2.5 py-0.5">{tr(label)}</span>))}</span> : null}
                </span>
              </button>);
          })}
        </div>
      ) : pages ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="tools-results">
          {(top ? tools : pages.flatMap((p) => p[3]).map((m) => tools.find((t) => t[0] === m)).filter(Boolean)).filter(match).map(([id, label, sub, Icon]) => (
            <button key={id} onClick={() => navTo(id)} data-testid={"tools-open-" + id} className="text-start min-h-[56px] flex items-start gap-3 p-3.5 rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] hover:border-[var(--c-acc)] transition-colors duration-150">
              <span className="w-10 h-10 shrink-0 rounded-[12px] bg-[var(--c-soft)] text-[var(--c-acc)] flex items-center justify-center"><Icon size={18} /></span>
              <span className="min-w-0"><span className="block text-[14.5px] font-extrabold text-[var(--c-ink)] leading-tight">{tr(label)}</span>
                <span className="block text-[12.5px] text-[var(--c-mut)] leading-snug mt-0.5 line-clamp-2">{tr(sub)}</span></span>
            </button>))}
        </div>
      ) : null}
      {(pages ? [] : groups).map(([title, ids]) => {
        const list = ids.map((id) => tools.find((t) => t[0] === id)).filter(Boolean).filter(match);
        if (!list.length) return null;
        return (
          <section key={title} className="mb-6" data-testid="tools-group">
            <h2 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--c-mut)] mt-0 mb-2.5">{tr(title)}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {list.map(([id, label, sub, Icon]) => (
                <div key={id} className="group relative rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] hover:border-[var(--c-acc)] transition-colors duration-150">
                  <button onClick={() => navTo(id)} data-testid={"tools-open-" + id} className="w-full min-h-[56px] text-start flex items-start gap-3 p-3.5 pe-11">
                    <span className="w-10 h-10 shrink-0 rounded-[12px] bg-[var(--c-soft)] text-[var(--c-acc)] flex items-center justify-center"><Icon size={18} /></span>
                    <span className="min-w-0"><span className="block text-[14.5px] font-extrabold text-[var(--c-ink)] leading-tight">{tr(label)}</span>
                      <span className="block text-[12.5px] text-[var(--c-mut)] leading-snug mt-0.5 line-clamp-2">{tr(sub)}</span></span>
                  </button>
                  {showPins ? <button onClick={() => togglePin(id)} data-testid={"tools-pin-" + id} aria-pressed={pins.includes(id)}
                    title={pins.includes(id) ? tr("Unpin from the sidebar") : tr("Pin to the sidebar")} aria-label={pins.includes(id) ? tr("Unpin from the sidebar") : tr("Pin to the sidebar")}
                    className={"absolute top-1.5 end-1.5 w-9 h-9 grid place-items-center rounded-[12px] transition-opacity duration-150 " + (pins.includes(id) ? "text-[var(--c-acc-2)]" : "text-[var(--c-mut)] opacity-0 group-hover:opacity-100 focus:opacity-100")}>
                    <Star size={15} className={pins.includes(id) ? "fill-current" : ""} /></button> : null}
                </div>))}
            </div>
          </section>);
      })}
    </div>);
}

// v6.25 — the computer's own pages (Ali picked "A + C"): Home (ask box, your day, your tools) and Tools (every tool on one
// full-width page; ★ pins a tool to the sidebar). Phones keep Chat as home and the More sheet.
import React, { useState, useMemo } from "react";
import { Send, Star, LayoutGrid, Bell, Apple, Brain, MessageCircle } from "lucide-react";
import { openRead } from "./readaloud-ui.jsx";
import { DoResult } from "./doit-ui.jsx";
import { tr } from "./i18n.js";
import { usePins, recentTools } from "./side-ui.jsx";

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
    className="text-start rounded-2xl border border-slate-800 bg-slate-900 hover:border-teal-700/70 hover:bg-slate-900/70 p-4 min-h-[118px] flex flex-col transition-colors">
    <span className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-300 flex items-center justify-center"><Icon size={18} /></span>
    <span className="mt-3 text-[14.5px] font-semibold text-white leading-tight">{tr(label)}</span>
    <span className="mt-0.5 text-[12px] text-slate-400 leading-snug line-clamp-2">{tr(sub)}</span>
  </button>);

export function DesktopHome({ tools, navTo, onAsk, engineReady, name, doIt }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(null);   // v6.28 "Do it from Home"
  const facts = useMemo(() => todayFacts(), []);
  const recent = recentTools().map((id) => tools.find((t) => t[0] === id)).filter(Boolean);
  // v6.27 (Ali: "I don't want Maps with Money"): the main cards are Money, Business and Mind; Maps lives in Tools / pinned
  const core = ["money", "business", "memory"].map((id) => tools.find((t) => t[0] === id)).filter(Boolean);
  const cards = [...core, ...recent.filter((t) => !core.includes(t))].slice(0, 7);
  const send = () => { const t = text.trim(); if (!t) return; setText(""); let r = null; try { r = doIt ? doIt(t) : null; } catch (e) { r = null; } if (r) setDone({ ...r, id: Date.now() }); else onAsk(t); };
  const starters = [["Summarise a PDF", "pdfchat"], ["Read a paper to me", "read"], ["Price a crane job", null], ["Plan my meals", "fit"], ["Convert a file", "convert"]];
  return (
    <div className="pt-2 pb-10 space-y-5" data-testid="desk-home">
      <h1 className="text-[26px] font-semibold text-white tracking-tight">{tr(greeting())}{name ? ", " + name : ""}</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-[12px] text-slate-400 mb-2">{tr("Ask anything")}</p>
          <div className="flex items-end gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 focus-within:border-teal-600">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} dir="auto" data-testid="home-ask"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={tr("Ask, or tell Attune what happened — «spent 150 on lunch», «had foul for breakfast»…")} className="flex-1 resize-none bg-transparent text-[15px] text-slate-100 placeholder-slate-600 focus:outline-none py-1" />
            <button onClick={send} disabled={!text.trim()} data-testid="home-send" aria-label={tr("Send")}
              className="w-9 h-9 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center disabled:opacity-40"><Send size={16} /></button>
          </div>
          {done ? <div className="calm rounded-2xl mt-3"><DoResult key={done.id} r={done} navTo={navTo} onClose={() => setDone(null)} /></div> : null}
          <div className="flex flex-wrap gap-2 mt-3">
            {starters.map(([t, tool]) => <button key={t} onClick={() => (tool === "read" ? openRead() : tool ? navTo(tool) : onAsk(tr(t)))} data-testid={tool === "read" ? "home-read" : undefined}
              className="rounded-full border border-teal-800/70 text-teal-200 text-[12.5px] px-3 py-1 hover:bg-teal-500/10">{tr(t)}</button>)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2" data-testid="home-today">
          <p className="text-[12px] text-slate-400">{tr("Today")}</p>
          {facts.kcal != null ? <button onClick={() => navTo("fit")} className="flex items-center gap-2 text-start"><Apple size={16} className="text-emerald-300" />
            <span className="text-[20px] font-semibold text-white tabular-nums">{facts.kcal}</span><span className="text-[12.5px] text-slate-400">{tr("kcal eaten")}</span></button> : null}
          <button onClick={() => navTo("reminders")} className="flex items-center gap-2 text-[13px] text-slate-300"><Bell size={15} className="text-amber-300" />
            {facts.reminders ? tr("{n} reminders left today", { n: facts.reminders }) : tr("No more reminders today")}</button>
          <p className="flex items-center gap-2 text-[13px] text-slate-300"><MessageCircle size={15} className="text-sky-300" />{tr("{n} chats saved", { n: facts.chats })}</p>
          <p className={"text-[12px] " + (engineReady ? "text-teal-300" : "text-slate-500")}>{engineReady ? tr("The model is ready") : tr("The model wakes when you ask")}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4" data-testid="home-cards">
        {cards.map(([id, label, sub, Icon]) => <Card key={id} id={id} label={label} sub={sub} Icon={Icon} onClick={() => navTo(id)} />)}
        <Card id="tools" label="All tools" sub={tr("{n} tools", { n: tools.length - 1 })} Icon={LayoutGrid} onClick={() => navTo("tools")} testid="home-all-tools" />
      </div>
    </div>);
}

export function ToolsPage({ tools, groups, navTo, subtitle, showPins = true }) {
  const [pins, togglePin] = usePins();
  const [q, setQ] = useState("");
  const nq = q.trim().toLowerCase();
  const match = ([id, label, sub]) => !nq || (tr(label) + " " + tr(sub) + " " + label + " " + sub).toLowerCase().includes(nq);
  return (
    <div className="pt-2 pb-10" data-testid="tools-page">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-[24px] font-semibold text-white tracking-tight">{tr("Tools")}</h1>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Find a tool")} dir="auto" data-testid="tools-find"
          className="ms-auto w-40 sm:w-72 min-w-0 rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-[13.5px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-700" />
      </div>
      <p className="text-[12.5px] text-slate-400 mb-4">{tr(subtitle || "Every tool on one page — ★ pins it to the sidebar.")}</p>
      {groups.map(([title, ids]) => {
        const list = ids.map((id) => tools.find((t) => t[0] === id)).filter(Boolean).filter(match);
        if (!list.length) return null;
        return (
          <section key={title} className="mb-6" data-testid="tools-group">
            <h2 className="text-[11.5px] uppercase tracking-wider text-slate-500 mb-2">{tr(title)}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {list.map(([id, label, sub, Icon]) => (
                <div key={id} className="group relative rounded-xl border border-slate-800 bg-slate-900 hover:border-teal-700/70 transition-colors">
                  <button onClick={() => navTo(id)} data-testid={"tools-open-" + id} className="w-full text-start flex items-start gap-3 p-3 pe-10">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-teal-500/10 text-teal-300 flex items-center justify-center"><Icon size={18} /></span>
                    <span className="min-w-0"><span className="block text-[14px] font-semibold text-white leading-tight">{tr(label)}</span>
                      <span className="block text-[12px] text-slate-400 leading-snug mt-0.5 line-clamp-2">{tr(sub)}</span></span>
                  </button>
                  {showPins ? <button onClick={() => togglePin(id)} data-testid={"tools-pin-" + id} aria-pressed={pins.includes(id)}
                    title={pins.includes(id) ? tr("Unpin from the sidebar") : tr("Pin to the sidebar")} aria-label={pins.includes(id) ? tr("Unpin from the sidebar") : tr("Pin to the sidebar")}
                    className={"absolute top-2 end-2 p-1.5 rounded-md " + (pins.includes(id) ? "text-amber-300" : "text-slate-600 opacity-0 group-hover:opacity-100 focus:opacity-100")}>
                    <Star size={15} className={pins.includes(id) ? "fill-current" : ""} /></button> : null}
                </div>))}
            </div>
          </section>);
      })}
    </div>);
}

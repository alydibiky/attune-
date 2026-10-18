// v6.24 — Attune on a computer (or any screen 1024 px and wider), laid out like Claude and ChatGPT
// (Ali, 12 Oct 2026: "I want it like Claude and ChatGPT"): a sidebar on the start side with
// New chat, search, the main places, every tool, and the recent chats; the open chat or tool
// fills the rest, and the chat reads in a centred column. Phones keep the bottom bar.
import React, { useState, useEffect, useMemo } from "react";
import { Plus, Search, PanelLeft, ChevronDown, Cpu, User, Crown, ShieldCheck, LayoutGrid, PenLine, Trash2, Lock, HelpCircle } from "lucide-react";
import { tr } from "./i18n.js";
import { useBackDepth } from "./backstack.js";

export const SIDE_W = 268;
const WIDE_Q = "(min-width: 1024px)";
const OPEN_KEY = "attune:side:open";

/** true on a computer-sized screen; follows the window as it is resized */
export function useDesktopWide() {
  const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE_Q) : null;
  const [w, setW] = useState(() => !!(mq && mq.matches));
  useEffect(() => {
    if (!mq) return;
    const f = () => setW(mq.matches); f();
    mq.addEventListener ? mq.addEventListener("change", f) : mq.addListener(f);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", f) : mq.removeListener(f));
  }, []);
  return w;
}

/** The sidebar open/closed (remembered); sets the page's --side / --nav-h so fixed panels make room. */
export function useSide(wide) {
  const [open, setOpenRaw] = useState(() => { try { return localStorage.getItem(OPEN_KEY) !== "0"; } catch (e) { return true; } });
  const setOpen = (v) => { setOpenRaw(v); try { localStorage.setItem(OPEN_KEY, v ? "1" : "0"); } catch (e) {} };
  const shown = wide && open;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("att-wide", !!wide);
    root.style.setProperty("--side", shown ? SIDE_W + "px" : "0px");
    root.style.setProperty("--nav-h", wide ? "0px" : "58px");
  }, [wide, shown]);
  return { shown, open, setOpen };
}

// ---- v6.25: pinned tools (the ★ on the Tools page) and the tools used lately (the Home page) ----
const PINS_KEY = "attune:side:pins", RECENT_KEY = "attune:tools:recent";
const DEFAULT_PINS = ["convert", "fit", "map"];
const readList = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return Array.isArray(v) ? v : d; } catch (e) { return d; } };
export function usePins() {
  const [pins, setPinsRaw] = useState(() => readList(PINS_KEY, DEFAULT_PINS));
  useEffect(() => { const f = () => setPinsRaw(readList(PINS_KEY, DEFAULT_PINS)); window.addEventListener("attune-pins", f); return () => window.removeEventListener("attune-pins", f); }, []);
  const toggle = (id) => {
    const cur = readList(PINS_KEY, DEFAULT_PINS);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-12);
    try { localStorage.setItem(PINS_KEY, JSON.stringify(next)); } catch (e) {}
    try { window.dispatchEvent(new Event("attune-pins")); } catch (e) {}
  };
  return [pins, toggle];
}
/** remember a tool was opened (most recent first, 8 kept) */
export function noteToolUsed(id) {
  if (!id || ["chat", "home", "tools"].includes(id)) return;
  const next = [id, ...readList(RECENT_KEY, []).filter((x) => x !== id)].slice(0, 8);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch (e) {}
}
export const recentTools = () => readList(RECENT_KEY, []);

/** Recent chats, as Chat publishes them (falls back to what is stored). */
function useChatList(loadChats) {
  const [st, setSt] = useState(() => ({ list: (loadChats() || []).map(summary), activeId: null }));
  useEffect(() => {
    const f = (e) => setSt({ list: (e.detail.list || []), activeId: e.detail.activeId || null });
    const g = () => setSt((s) => ({ ...s, list: (loadChats() || []).map(summary) }));
    window.addEventListener("attune-chats", f); window.addEventListener("storage", g);
    return () => { window.removeEventListener("attune-chats", f); window.removeEventListener("storage", g); };
  }, []);
  return st;
}
export const summary = (c) => ({ id: c.id, title: c.title || "", updated: c.updated || 0, n: (c.messages || []).length, space: c.projectId ? "📁" : c.assistantId ? "✨" : "" });

function dayGroup(ts) {
  const d = new Date(ts), now = new Date();
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? "Previous 7 days" : days < 30 ? "Previous 30 days" : "Older";
}

export function DesktopSide({ mode, canBack, onBack, navTo, places, tools, groups, loadChats, onNewChat, onOpenChat, chatCmd, onClose,
  engineLabel, engineState, airGap, openEngine, openProfile, openUpgrade, openBackup, openSettings, touch = false, width = SIDE_W,
  activePlace = null, showPins = true }) {   // v6.30: activePlace = the sidebar place of the page shown (6 places, no pinned list)
  const { list, activeId } = useChatList(loadChats);
  const depth = useBackDepth();
  const [q, setQ] = useState("");
  const [pins] = usePins();
  const pinned = pins.map((id) => tools.find((t) => t[0] === id)).filter(Boolean);
  const [renaming, setRenaming] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const nq = q.trim().toLowerCase();
  const shown = useMemo(() => list.filter((c) => !nq || String(tr(c.title)).toLowerCase().includes(nq)).slice(0, 80), [list, nq]);
  const toolHits = nq ? tools.filter(([id, label, sub]) => (tr(label) + " " + tr(sub) + " " + label).toLowerCase().includes(nq)) : [];
  let lastGroup = "";
  const Row = ({ id, label, Icon }) => (
    <button onClick={() => navTo(id)} data-testid={"side-go-" + id}
      className={"w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-start " + ((activePlace || mode) === id ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60")}>
      <Icon size={17} className={(activePlace || mode) === id ? "text-teal-300" : "text-slate-400"} /><span className="truncate">{tr(label)}</span>
    </button>);
  return (
    <aside className="fixed top-0 bottom-0 start-0 z-[56] flex flex-col bg-slate-900 border-e border-slate-800" style={{ width }} data-testid="side">
      <div className="flex items-center gap-1 px-3 h-14 shrink-0">
        {/* v6.24 (Ali: "there is no back in the app"): a computer has no Back key like a phone — this is it
            (also: the mouse's back button, Alt+←, and Esc for an open panel) */}
        {canBack || depth > 0 ? <button onClick={onBack} className="att-icon-btn border-transparent! bg-transparent! text-slate-300! -ms-2" aria-label={tr("Back")} title={tr("Back") + " (Alt+←)"} data-testid="side-back">
          <span className="text-lg leading-none inline-block rtl:-scale-x-100">←</span></button> : null}
        <span className="flex-1 text-[17px] font-semibold text-white tracking-tight">Attune</span>
        <button onClick={onClose} className="att-icon-btn border-transparent! bg-transparent! text-slate-400!" aria-label={tr("Close sidebar")} title={tr("Close sidebar")} data-testid="side-close"><PanelLeft size={18} /></button>
      </div>
      <div className="px-2.5 space-y-1.5 shrink-0">
        <button onClick={onNewChat} data-testid="side-new" className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-slate-100 hover:bg-slate-800/60">
          <span className="w-6 h-6 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center"><Plus size={15} /></span>{tr("New chat")}</button>
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5">
          <Search size={14} className="text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search chats and tools")} dir="auto" data-testid="side-search"
            className="flex-1 min-w-0 bg-transparent py-2 text-[13px] text-slate-200 placeholder-slate-600 focus:outline-none" />
        </div>
      </div>
      <div className="att-scroll flex-1 overflow-y-auto px-2.5 pt-2 pb-3">
        {toolHits.length ? (
          <div className="mb-2" data-testid="side-tool-hits">{toolHits.slice(0, 8).map(([id, label, , Icon]) => <Row key={id} id={id} label={label} Icon={Icon} />)}</div>) : null}
        {!nq ? (<>
          {places.map(([id, label, Icon]) => <Row key={id} id={id} label={label} Icon={Icon} />)}
          {/* v6.25 (Ali picked A + C): the tools you pin from the Tools page (★), not a list of all 33 */}
          {showPins && pinned.length ? <p className="px-2.5 pt-3 pb-1 text-[10.5px] uppercase tracking-wider text-slate-500">{tr("Pinned")}</p> : null}
          <div data-testid="side-pins">{(showPins ? pinned : []).map(([id, label, , Icon]) => <Row key={id} id={id} label={label} Icon={Icon} />)}</div>
        </>) : null}
        <div className="mt-3" data-testid="side-chats">
          {shown.length === 0 ? <p className="px-2.5 py-2 text-[12px] text-slate-500">{nq ? tr("No chats match.") : tr("No chats yet.")}</p> : shown.map((c) => {
            const g = dayGroup(c.updated); const head = g !== lastGroup ? (lastGroup = g) : null;
            const on = mode === "chat" && c.id === activeId;
            return (
              <div key={c.id}>
                {head ? <p className="px-2.5 pt-2.5 pb-1 text-[10.5px] uppercase tracking-wider text-slate-500">{tr(head)}</p> : null}
                <div className={"group flex items-center rounded-lg " + (on ? "bg-slate-800" : "hover:bg-slate-800/60")} data-testid="side-chat">
                  {renaming === c.id ? (
                    <input autoFocus defaultValue={tr(c.title)} dir="auto" data-testid="side-rename"
                      onBlur={(e) => { const v = e.target.value.trim(); if (v) chatCmd({ op: "rename", id: c.id, title: v }); setRenaming(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setRenaming(null); }}
                      className="flex-1 min-w-0 bg-slate-950 border border-teal-700 rounded-lg px-2 py-1.5 text-[13px] text-slate-100" />
                  ) : confirmDel === c.id ? (
                    <div className="flex-1 flex items-center gap-1 px-2 py-1">
                      <span className="flex-1 text-[12px] text-rose-200 truncate">{tr("Delete this chat?")}</span>
                      <button onClick={() => { chatCmd({ op: "delete", id: c.id }); setConfirmDel(null); }} data-testid="side-del-yes" className="px-2 py-1 rounded-md bg-rose-600 text-white text-[11px]">{tr("Delete")}</button>
                      <button onClick={() => setConfirmDel(null)} className="px-2 py-1 rounded-md border border-slate-700 text-slate-300 text-[11px]">{tr("Cancel")}</button>
                    </div>
                  ) : (<>
                    <button onClick={() => onOpenChat(c.id)} data-testid="side-open-chat" className="flex-1 min-w-0 text-start px-2.5 py-2 text-[13px] text-slate-200 truncate" dir="auto" title={tr(c.title)}>
                      {c.space ? <span className="me-1">{c.space}</span> : null}{tr(c.title) || tr("New chat")}</button>
                    <span className={(touch ? "flex" : "hidden group-hover:flex group-focus-within:flex") + " items-center pe-1"}>
                      <button onClick={() => setRenaming(c.id)} className="p-1.5 text-slate-500 hover:text-slate-200" title={tr("Rename")} aria-label={tr("Rename")}><PenLine size={13} /></button>
                      <button onClick={() => setConfirmDel(c.id)} className="p-1.5 text-slate-500 hover:text-rose-300" title={tr("Delete")} aria-label={tr("Delete")} data-testid="side-del"><Trash2 size={13} /></button>
                    </span>
                  </>)}
                </div>
              </div>);
          })}
        </div>
      </div>
      <div className="shrink-0 border-t border-slate-800 p-2 space-y-0.5">
        {/* v6.36 (Ali's board: "put How to use and Privacy in settings, at the bottom of the left sidebar") */}
        <div className="grid grid-cols-2 gap-1" data-testid="side-help">
          {[["guide", HelpCircle, "How to use Attune"], ["privacy", Lock, "Privacy"]].map(([id, Ic, label]) => (
            <button key={id} onClick={() => navTo(id)} data-testid={"side-go-" + id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 text-start">
              <Ic size={14} className="shrink-0" /><span className="truncate">{tr(label)}</span></button>))}
        </div>
        <button onClick={openEngine} data-testid="side-engine" className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-slate-300 hover:bg-slate-800/60">
          <Cpu size={16} className={engineState === "ready" ? "text-teal-300" : engineState === "starting" ? "text-amber-300" : "text-slate-400"} />
          <span className="flex-1 text-start truncate">{engineLabel}</span>{airGap ? <Lock size={13} className="text-teal-300" /> : null}</button>
        <div className="grid grid-cols-4 gap-1">
          {[[openProfile, User, "Profile", "side-profile"], [openUpgrade, Crown, "Plan", "side-plan"], [openBackup, ShieldCheck, "Backup", "side-backup"], [openSettings, LayoutGrid, "Settings", "side-settings"]].map(([f, Ic, label, tid]) => (
            <button key={tid} onClick={f} data-testid={tid} title={tr(label)} aria-label={tr(label)}
              className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10.5px] text-slate-400 hover:bg-slate-800/60 hover:text-slate-200">
              <Ic size={16} />{tr(label)}</button>))}
        </div>
      </div>
    </aside>);
}

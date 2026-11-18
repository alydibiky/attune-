/* ---- v10.2 D1 (Ali OK'd the combined page https://claude.ai/artifact/CkbzEJEpupPdYdBKbjtxdn: "OK-D1"; he asked "is that what a computer
   app would look like in professional apps?" — yes: Mail, Outlook, Notion, Slack, Linear, Todoist, Things, Windows Settings; Apple's
   "split view" and Microsoft's "list/details" pattern). On a computer (a window 1024 px or wider) a page with a list shows the list on
   the left and the picked item open on the right, in the same window: the first item is open when you arrive (the right side is never
   empty), ↑ ↓ move through the list, the item is edited in the right pane — never a phone pop-up. Phones keep their own layout.
   Tests: tests/e2e_v1020split.py. */
import React, { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { tr } from "./i18n.js";

/** true in a computer-wide window (the same 1024 px breakpoint as the rest of the computer layout) */
export function useWide() {
  const q = "(min-width: 1024px)";
  const [w, setW] = useState(() => { try { return window.matchMedia(q).matches; } catch (e) { return false; } });
  useEffect(() => { try { const m = window.matchMedia(q); const on = () => setW(m.matches); m.addEventListener("change", on); return () => m.removeEventListener("change", on); } catch (e) {} }, []);
  return w;
}

/** The next / previous key for ↑ ↓ (pure, so it is tested without a browser). */
export function stepKey(keys, cur, dir) {
  if (!keys.length) return null;
  const i = keys.indexOf(cur);
  if (i < 0) return keys[0];
  return keys[Math.max(0, Math.min(keys.length - 1, i + dir))];
}
/** The key to show: the one picked if it is still in the list, else the first (the right side is never empty). */
export const shownKey = (keys, sel) => (sel != null && keys.includes(sel) ? sel : keys.length ? keys[0] : null);

/**
 * items: [{ key, title, sub?, end?, icon? }]; sel / onSel: the open item; detail: what the right pane shows for it (a node);
 * find: show a search box over the list (filters by title + sub); head: a node above the list (e.g. "+ Add"); empty: the right pane
 * when the list is empty.
 */
export function SplitView({ items, sel, onSel, detail, find = false, findHint = "Find…", head = null, empty = null, listLabel = "", testid = "split" }) {
  const [q, setQ] = useState("");
  const shown = q.trim() ? items.filter((x) => (String(x.title || "") + " " + String(x.sub || "")).toLowerCase().includes(q.trim().toLowerCase())) : items;
  const keys = shown.map((x) => x.key), cur = shownKey(keys, sel);
  // the first item is open when you arrive
  useEffect(() => { if (cur != null && cur !== sel) onSel(cur, true); }, [cur, sel]);   // eslint-disable-line
  const listRef = useRef(null);
  const onKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== "search") return;
    e.preventDefault();
    const k = stepKey(keys, cur, e.key === "ArrowDown" ? 1 : -1); if (k == null) return;
    onSel(k);
    try { const el = listRef.current && listRef.current.querySelector('[data-key="' + CSS.escape(String(k)) + '"]'); if (el) { el.focus(); el.scrollIntoView({ block: "nearest" }); } } catch (x) {}
  };
  return (
    <div className="calm grid grid-cols-[minmax(240px,300px)_minmax(0,1fr)] gap-4 xl:gap-5 items-start" data-testid={testid}>
      <div className="sticky top-3 rounded-[18px] border border-[var(--c-ln)] bg-[var(--c-surf)] flex flex-col max-h-[calc(100vh-40px)] min-w-0" data-testid={testid + "-list"} onKeyDown={onKey}>
        {head ? <div className="p-2.5 pb-0">{head}</div> : null}
        {find ? <div className="p-2.5 pb-1.5"><div className="flex items-center gap-2 rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-bg)] px-3 focus-within:border-[var(--c-acc)]">
          <Search size={14} className="text-[var(--c-mut)] shrink-0" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(findHint)} className="flex-1 min-w-0 min-h-[40px] bg-transparent text-[14px] focus:outline-none" data-testid={testid + "-find"} /></div></div> : null}
        {listLabel ? <p className="m-0 px-3.5 pt-2 pb-1 text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--c-mut)]">{listLabel} · {shown.length}</p> : null}
        <div ref={listRef} className="overflow-y-auto p-1.5 space-y-0.5" role="listbox" aria-label={listLabel || undefined}>
          {shown.map((x) => {
            const on = x.key === cur;
            return <button key={x.key} data-key={x.key} role="option" aria-selected={on} onClick={() => onSel(x.key)} data-testid={testid + "-row"}
              className={"w-full min-h-[48px] text-start flex items-center gap-2.5 px-3 py-2 rounded-[12px] transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-acc)] " + (on ? "bg-[var(--c-soft)]" : "hover:bg-[var(--c-bg)]")}>
              {x.icon ? <span className="shrink-0 text-[17px] leading-none w-6 text-center">{x.icon}</span> : null}
              <span className="min-w-0 flex-1"><span className={"block text-[14px] leading-tight truncate " + (on ? "font-extrabold text-[var(--c-ink)]" : "font-bold text-[var(--c-ink)]")} dir="auto">{x.title}</span>
                {x.sub ? <span className="block text-[12px] text-[var(--c-mut)] truncate mt-0.5" dir="auto">{x.sub}</span> : null}</span>
              {x.end ? <span className="shrink-0 text-[12px] font-bold text-[var(--c-mut)] tabular-nums">{x.end}</span> : null}
            </button>; })}
          {!shown.length ? <p className="m-0 px-3 py-4 text-[13px] text-[var(--c-mut)]">{q.trim() ? tr("Nothing matches") : tr("Nothing here yet")}</p> : null}
        </div>
      </div>
      <div className="min-w-0 att-pane" data-testid={testid + "-detail"}>{cur != null ? detail : empty}</div>
    </div>);
}

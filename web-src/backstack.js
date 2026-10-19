/* ---- v5.34: Back, one step at a time -----------------------------------------------------------
   Ali: "some pages don't have a back option". Every tool had the header ←, but it jumped straight
   out of the tool to Chat — from an open project, a business table, a lesson or an edit form there
   was no way back ONE step, and the phone's Back button left the whole tool.
   Any inner page now registers itself while it is open (useSubBack); the header ← and the phone's
   Back close the newest inner page first, then the tool, then the app. */
import { useEffect, useRef, useState, useCallback } from "react";

const STACK = [];
// v6.24: the computer's Back button (side-ui.jsx) shows itself only when there is somewhere to go back to
const WATCH = new Set();
const changed = () => { for (const f of WATCH) try { f(STACK.length); } catch (x) {} };
/** How many inner pages are open, kept up to date (for a Back button that appears when it can be used). */
export function useBackDepth() {
  const [n, setN] = useState(STACK.length);
  useEffect(() => { WATCH.add(setN); setN(STACK.length); return () => { WATCH.delete(setN); }; }, []);
  return n;
}

/** Register a back step; returns the function that removes it. */
export function pushBack(fn) {
  const e = { fn };
  STACK.push(e); changed();
  return () => { const i = STACK.indexOf(e); if (i >= 0) { STACK.splice(i, 1); changed(); } };
}

/** Close the newest inner page. → true when there was one. */
export function popBack() {
  const e = STACK[STACK.length - 1];
  if (!e) return false;
  // the page removes its own step when it closes (useSubBack's cleanup) — so a page with several
  // levels (lesson → course → list) keeps handling Back until it is back at its start
  try { e.fn(); } catch (x) {}
  return true;
}

export const hasBack = () => STACK.length > 0;

/** While `active`, Back runs `onBack` (e.g. () => setOpenId(null)). */
export function useSubBack(active, onBack) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return undefined;
    return pushBack(() => ref.current && ref.current());
  }, [!!active]);
}

// ---- v5.41: a tool remembers where you were (Ali: Learn daily → make a picture → Back lost the lesson) ----
// Like useState, but the value outlives the page: leave a tool and come back, and the same course,
// lesson, table or project is open again. Kept in memory for this run of the app (not on disk).
const MEM = new Map();
export function useSticky(key, init) {
  const [v, setV] = useState(() => (MEM.has(key) ? MEM.get(key) : typeof init === "function" ? init() : init));
  const set = useCallback((x) => setV((old) => { const nv = typeof x === "function" ? x(old) : x; MEM.set(key, nv); return nv; }), [key]);
  return [v, set];
}
export const forgetSticky = (prefix) => { for (const k of [...MEM.keys()]) if (k.startsWith(prefix)) MEM.delete(k); };

// ---- v6.43 (Ali: "I work on something, come back, and it starts from the beginning") ----------
// MagicOS closes Attune in the background when memory is short (a loaded model is several GB), and the
// page then started on Home with every tool reset. Now, when the app is put away, the open screen and
// what the tools remember (useSticky) are written to the phone; a start within a few hours of that
// reopens the same screen with the same course, table, project or form.
const RESUME_KEY = "attune:resume:v1";
const RESUME_MS = 6 * 3600e3;
export function saveResume(mode, hist) {
  try {
    const sticky = {};
    let size = 0;
    for (const [k, v] of MEM) {
      let j; try { j = JSON.stringify(v); } catch (e) { continue; }
      if (j === undefined || j.length > 200000 || size + j.length > 800000) continue;   // photos and big data stay out
      sticky[k] = j; size += j.length;
    }
    localStorage.setItem(RESUME_KEY, JSON.stringify({ at: Date.now(), mode, hist: (hist || []).slice(-20), sticky }));
  } catch (e) {}
}
export function dropResume() { try { localStorage.removeItem(RESUME_KEY); } catch (e) {} }
/** The screen to reopen after Android closed the app ({ mode, hist }), once; null when there is none or it is old. */
export function takeResume() {
  try {
    const r = JSON.parse(localStorage.getItem(RESUME_KEY) || "null");
    localStorage.removeItem(RESUME_KEY);
    if (!r || !r.mode || Date.now() - (r.at || 0) > RESUME_MS) return null;
    for (const [k, j] of Object.entries(r.sticky || {})) { try { MEM.set(k, JSON.parse(j)); } catch (e) {} }
    return { mode: r.mode, hist: Array.isArray(r.hist) ? r.hist : [] };
  } catch (e) { return null; }
}

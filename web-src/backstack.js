/* ---- v5.34: Back, one step at a time -----------------------------------------------------------
   Ali: "some pages don't have a back option". Every tool had the header ←, but it jumped straight
   out of the tool to Chat — from an open project, a business table, a lesson or an edit form there
   was no way back ONE step, and the phone's Back button left the whole tool.
   Any inner page now registers itself while it is open (useSubBack); the header ← and the phone's
   Back close the newest inner page first, then the tool, then the app. */
import { useEffect, useRef, useState, useCallback } from "react";

const STACK = [];

/** Register a back step; returns the function that removes it. */
export function pushBack(fn) {
  const e = { fn };
  STACK.push(e);
  return () => { const i = STACK.indexOf(e); if (i >= 0) STACK.splice(i, 1); };
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

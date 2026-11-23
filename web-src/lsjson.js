/* ---- v10.9.1 (Ali, 23 Nov 2026: "the app still is very very laggy and pressing on the sidebar and choosing other things is still shit").
   Measured (tests/e2e_v1091speed.py, 8,000 payments, the CPU slowed 4×): opening Money parsed the WHOLE ledger 5–7 times (every useMemo
   called loadLedger() → JSON.parse), Home's safe-to-spend parsed it again, and the Set up driver parsed it every 1.5 s on every page.
   readJSON(key) parses a stored value only when its text changed since the last read (a string compare is far cheaper than a parse and the
   garbage it leaves); the object comes back as a SHALLOW COPY, so a caller that swaps a top-level field (led.txns = …) never touches the
   cache. Callers must not change nested arrays in place (none of the readers does — appendToLedger copies). Pure, per store. */
const CACHE = typeof WeakMap === "function" ? new WeakMap() : null;
export function readJSON(key, fallback = null, store = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    if (!store) return fallback;
    const raw = store.getItem(key);
    if (raw == null || raw === "") return fallback;
    let m = CACHE && CACHE.get(store); if (CACHE && !m) { m = new Map(); CACHE.set(store, m); }
    const c = m && m.get(key);
    let v;
    if (c && c.raw === raw) v = c.v;
    else { v = JSON.parse(raw); if (m) m.set(key, { raw, v }); }
    if (v == null) return fallback;
    return Array.isArray(v) ? v.slice() : typeof v === "object" ? { ...v } : v;
  } catch (e) { return fallback; }
}

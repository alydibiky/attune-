/* ---- v9.9.18 AU8 "Done for you" (Ali picked A + his note, 11 Nov 2026: "make editing possible and then it remembers my change if
   applicable"). One list of everything Attune did by itself, with the person's limits (money per action, actions per day), Undo and
   Edit on every line; after an edit Attune asks "Do it this way next time?" and, if yes, applies that change to the same kind of
   action from the same source (the same shop / person / rule) — never to anything else. Pure; tests: tests/donelog (10,000 days) +
   tests/unit/v9918donelog.test.mjs.                                                                                                  */
export const DL_KEY = "attune:donelog:v1";
export const empty = () => ({ v: 1, limits: { money: 2000, perDay: 10 }, log: [], learned: {} });
const DAY = 864e5;
const dayOf = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const norm = (s) => String(s || "").toLowerCase().normalize("NFKC").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
/** What an edit is remembered under: the kind of action and its source. */
export const keyOf = (a) => (a && a.kind ? a.kind : "x") + ":" + norm((a && (a.source || a.who || a.rule)) || "");

/** May Attune do this alone right now? (the money limit per action, the actions per day) */
export function canDoAlone(st, a, now = Date.now()) {
  const L = (st && st.limits) || empty().limits;
  if (a && a.amount != null && +a.amount > +L.money) return { ok: false, why: "money" };
  const today = (st.log || []).filter((x) => !x.undone && dayOf(x.at) === dayOf(now)).length;
  if (today >= +L.perDay) return { ok: false, why: "perDay" };
  return { ok: true };
}
/** The action with the person's remembered change applied (only when it was learned for exactly this kind + source). */
export function withLearned(st, a) { const p = st && st.learned && st.learned[keyOf(a)]; return p ? { ...a, ...p, learned: true } : a; }
/** Record an action Attune did by itself. → { st, entry } */
export function record(st, a, now = Date.now()) {
  const entry = { id: "dl" + now.toString(36) + Math.floor(Math.random() * 1e4).toString(36), at: now, ...a };
  return { st: { ...st, log: [...(st.log || []), entry].slice(-500) }, entry };
}
/** Undo: the entry is marked undone; the caller reverses it with entry.undo (what to take back). */
export function undo(st, id) {
  const e = (st.log || []).find((x) => x.id === id); if (!e || e.undone) return { st, entry: null };
  return { st: { ...st, log: st.log.map((x) => (x.id === id ? { ...x, undone: true } : x)) }, entry: e };
}
/** Edit: only the fields that can change (amount, cat, account, at, note, what). → { st, entry, ask } (ask = offer to remember) */
const EDITABLE = ["amount", "cat", "account", "when", "note", "what"];
export function edit(st, id, patch = {}) {
  const e = (st.log || []).find((x) => x.id === id); if (!e || e.undone) return { st, entry: null, ask: false };
  const clean = {}; for (const k of EDITABLE) if (k in patch && patch[k] !== e[k]) clean[k] = patch[k];
  if (!Object.keys(clean).length) return { st, entry: e, ask: false };
  const ne = { ...e, ...clean, edited: { ...(e.edited || {}), ...clean } };
  // a changed amount is about THIS payment only — what can be remembered is how it is filed (category, balance, note)
  const remember = Object.fromEntries(Object.entries(clean).filter(([k]) => ["cat", "account", "note"].includes(k)));
  return { st: { ...st, log: st.log.map((x) => (x.id === id ? ne : x)) }, entry: ne, ask: Object.keys(remember).length > 0, remember };
}
/** "Yes, remember": the same kind of action from the same source gets this change from now on. */
export function remember(st, entry, patch) {
  if (!entry || !patch || !Object.keys(patch).length) return st;
  const k = keyOf(entry); return { ...st, learned: { ...(st.learned || {}), [k]: { ...((st.learned || {})[k] || {}), ...patch } } };
}
export const forget = (st, k) => { const l = { ...(st.learned || {}) }; delete l[k]; return { ...st, learned: l }; };
/** Today's list, newest first. */
export const today = (st, now = Date.now()) => (st.log || []).filter((x) => dayOf(x.at) === dayOf(now)).sort((a, b) => b.at - a.at);
export function setLimits(st, l = {}) { const m = +l.money, d = +l.perDay; return { ...st, limits: { money: m >= 0 ? m : st.limits.money, perDay: d >= 0 ? Math.round(d) : st.limits.perDay } }; }
export function load(store = typeof localStorage !== "undefined" ? localStorage : null) { try { const v = JSON.parse(store.getItem(DL_KEY) || "null"); return v && v.v === 1 ? { ...empty(), ...v } : empty(); } catch (e) { return empty(); } }
export function save(st, store = typeof localStorage !== "undefined" ? localStorage : null) { try { store.setItem(DL_KEY, JSON.stringify(st)); } catch (e) {} return st; }

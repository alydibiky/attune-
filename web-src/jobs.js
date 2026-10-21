/* ---- v6.48 Jobs (CHAT_RUNS_APP.md S2; Ali picked Home option A: "Working on it" cards with progress, then the trip, then Your day).
   A "/" command (or a sentence that means one) becomes a job: waiting → working (with a %) → done (its result: text to copy, a file
   to save, a page to open) or failed (why, and Retry). Jobs that use the AI model run ONE AT A TIME (the phone restarted when two
   big things ran together — v6.46), the light ones run at once. The queue lives outside any page, so a job keeps going while you
   open other screens; it is kept on the phone (without big files) so a restart shows what happened. Pure state + one small runner;
   tests: tests/unit/v748jobs.test.mjs.                                                                                            */

export const JOBS_KEY = "attune:jobs:v1";
const MAX = 12;                 // the newest 12 jobs are kept
const KEEP_B64 = 1.5e6;         // a result file up to ~1 MB is kept across restarts; bigger ones only while the app is open

let seq = 0;
export const newJobId = (now = Date.now()) => "j" + now.toString(36) + (seq++).toString(36);

/** A new job: { id, kind, title, heavy, status: "wait", pct: 0, note, input, created }. */
export const makeJob = ({ kind, title, heavy = false, input = null, now = Date.now() }) =>
  ({ id: newJobId(now), kind, title: String(title || kind).slice(0, 120), heavy: !!heavy, status: "wait", pct: 0, note: "", input, result: null, error: "", created: now });

export const addJob = (list, job) => [job, ...(list || [])].slice(0, MAX);
export const patchJob = (list, id, patch) => (list || []).map((j) => (j.id === id ? { ...j, ...patch } : j));
export const dropJob = (list, id) => (list || []).filter((j) => j.id !== id);
/** The jobs that can start now: every waiting light job, and the oldest waiting heavy job if no heavy job is working. */
export function startable(list) {
  const l = list || [];
  const heavyBusy = l.some((j) => j.heavy && j.status === "run");
  const waiting = l.filter((j) => j.status === "wait").sort((a, b) => a.created - b.created);
  const light = waiting.filter((j) => !j.heavy);
  const heavy = heavyBusy ? [] : waiting.filter((j) => j.heavy).slice(0, 1);
  return [...light, ...heavy];
}
/** What Home shows: working first, then waiting, then done / failed (newest first); dismissed ones are gone. */
export function shown(list) {
  const rank = { run: 0, wait: 1, fail: 2, done: 3 };
  return (list || []).slice().sort((a, b) => rank[a.status] - rank[b.status] || b.created - a.created);
}
/** For keeping on the phone: no File objects, no big files. A job that was working when the app closed comes back as failed. */
export function toStore(list) {
  return (list || []).map((j) => {
    const { input, ...rest } = j;
    const r = j.result && j.result.b64 && j.result.b64.length > KEEP_B64 ? { ...j.result, b64: null, gone: true } : j.result;
    return { ...rest, input: input && typeof input === "object" ? { text: input.text || "", to: input.to || "", format: input.format || "", name: input.name || "" } : null, result: r };
  });
}
export function fromStore(list) {
  return (Array.isArray(list) ? list : []).map((j) => (j.status === "run" || j.status === "wait" ? { ...j, status: "fail", error: "Stopped when the app closed — tap Retry" } : j));
}
export function loadJobs(store = typeof localStorage !== "undefined" ? localStorage : null) { try { return fromStore(JSON.parse((store && store.getItem(JOBS_KEY)) || "[]")); } catch (e) { return []; } }
export function saveJobs(list, store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { store && store.setItem(JOBS_KEY, JSON.stringify(toStore(list))); } catch (e) { try { store && store.setItem(JOBS_KEY, JSON.stringify(toStore(list).map((j) => ({ ...j, result: j.result && j.result.b64 ? { ...j.result, b64: null, gone: true } : j.result })))); } catch (e2) {} }
}

/**
 * The runner: one per app. runners = { kind: async (job, { progress(pct, note), alive() }) => result }.
 * Subscribe to see the list; add() queues and starts what can start. Nothing here knows about pages.
 */
export function createJobs({ runners = {}, store, now = () => Date.now() } = {}) {
  let list = loadJobs(store);
  const subs = new Set(), cancelled = new Set();
  const emit = () => { saveJobs(list, store); for (const f of subs) { try { f(list); } catch (e) {} } };
  const set = (fn) => { list = fn(list); emit(); };
  const run = async (job) => {
    const fn = runners[job.kind];
    set((l) => patchJob(l, job.id, { status: "run", pct: 0, error: "" }));
    const ctx = {
      alive: () => !cancelled.has(job.id) && list.some((j) => j.id === job.id),
      progress: (pct, note) => { if (!ctx.alive()) return; set((l) => patchJob(l, job.id, { pct: Math.max(0, Math.min(100, Math.round(pct || 0))), ...(note != null ? { note: String(note).slice(0, 160) } : {}) })); },
    };
    try {
      if (!fn) throw new Error("This can't be done here yet");
      const result = await fn(job, ctx);
      if (ctx.alive()) set((l) => patchJob(l, job.id, { status: "done", pct: 100, result: result || null, done: now() }));
    } catch (e) {
      if (ctx.alive()) set((l) => patchJob(l, job.id, { status: "fail", error: String((e && e.message) || e).slice(0, 240), need: (e && e.need) || "" }));
    } finally { cancelled.delete(job.id); pump(); }
  };
  const pump = () => { for (const j of startable(list)) run(j); };
  return {
    list: () => list,
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    add: (spec) => { const j = makeJob({ ...spec, now: now() }); set((l) => addJob(l, j)); pump(); return j; },
    retry: (id) => { const j = list.find((x) => x.id === id); if (!j || !j.input) return; set((l) => patchJob(l, id, { status: "wait", pct: 0, error: "", created: now() })); pump(); },
    cancel: (id) => { cancelled.add(id); set((l) => dropJob(l, id)); },
    dismiss: (id) => set((l) => dropJob(l, id)),
    clearDone: () => set((l) => l.filter((j) => j.status !== "done")),
  };
}

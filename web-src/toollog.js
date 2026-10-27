/* ---- v7.8 Tools in two levels (Gemini's mock-up "Area 6: Tools", Ali sent it 24 Oct 2026): a small on-device log of what each tool
   made (Writing, Files, Instant, Studio, Video), so the Tools hub can show recent outputs and every tool its report. Only titles and
   numbers are kept (never the text itself), the last 300 entries, on this device. Pure helpers + a localStorage wrapper.
   Tests: tests/unit/v810toollog.test.mjs                                                                                         */
export const LOG_KEY = "attune:toollog:v1";
const DAY = 86400000;
export const FAMILIES = ["writing", "files", "instant", "studio", "video"];
/** Which family a tool (mode) belongs to. */
export const familyOf = (mode) => ({ write: "writing", improve: "writing", compress: "writing", humanize: "writing", copilot: "writing", library: "writing",
  convert: "files", pdfchat: "files", instant: "instant", studio: "studio", video: "video" }[mode] || null);

export function loadLog(store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const j = JSON.parse((store && store.getItem(LOG_KEY)) || "[]"); return Array.isArray(j) ? j : []; } catch (e) { return []; }
}
/** Add one entry: { mode, title, detail?, n?: words / pages / MB / seconds…, target?, kind? }. Returns the new log. */
export function logTool(entry, { now = Date.now(), store = typeof localStorage !== "undefined" ? localStorage : null } = {}) {
  const fam = familyOf(entry && entry.mode);
  if (!fam) return loadLog(store);
  const e = { t: now, fam, mode: entry.mode, title: String(entry.title || "").slice(0, 90), detail: String(entry.detail || "").slice(0, 120),
    kind: entry.kind ? String(entry.kind).slice(0, 30) : "", target: entry.target ? String(entry.target).slice(0, 30) : "",
    before: Number(entry.before) || 0, after: Number(entry.after) || 0, mb: Number(entry.mb) || 0, secs: Number(entry.secs) || 0 };
  const next = [e, ...loadLog(store)].slice(0, 300);
  try { store && store.setItem(LOG_KEY, JSON.stringify(next)); } catch (err) {}
  try { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("attune-toollog")); } catch (err) {}
  return next;
}
const pctChange = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

/** The Tools hub: jobs this week (vs the week before), by family, and the latest outputs. */
export function toolsReport(log = [], now = Date.now()) {
  const wk = log.filter((e) => now - e.t < 7 * DAY), prev = log.filter((e) => now - e.t >= 7 * DAY && now - e.t < 14 * DAY);
  const by = Object.fromEntries(FAMILIES.map((f) => [f, wk.filter((e) => e.fam === f).length]));
  const today = log.filter((e) => new Date(e.t).toDateString() === new Date(now).toDateString());
  return { week: wk.length, change: pctChange(wk.length, prev.length), by, today: today.length, recent: log.slice(0, 4) };
}
/** One family's report: this week, by kind (summarise / translate…), by target (Claude / ChatGPT…), words saved, MB, seconds. */
export function familyReport(log = [], fam, now = Date.now()) {
  const all = log.filter((e) => e.fam === fam), wk = all.filter((e) => now - e.t < 7 * DAY), prev = all.filter((e) => now - e.t >= 7 * DAY && now - e.t < 14 * DAY);
  const count = (key) => { const n = {}; for (const e of wk) if (e[key]) n[e[key]] = (n[e[key]] || 0) + 1; return Object.entries(n).map(([k, c]) => ({ k, c, pct: wk.length ? Math.round((100 * c) / wk.length) : 0 })).sort((a, b) => b.c - a.c); };
  const saved = wk.reduce((s, e) => s + Math.max(0, e.before - e.after), 0), before = wk.reduce((s, e) => s + e.before, 0);
  const timed = wk.filter((e) => e.secs > 0);
  return { week: wk.length, prev: prev.length, change: pctChange(wk.length, prev.length), total: all.length,
    kinds: count("kind"), targets: count("target"), wordsSaved: saved, tighter: before ? Math.round((100 * saved) / before) : null,
    mb: Math.round(wk.reduce((s, e) => s + e.mb, 0) * 10) / 10, avgSecs: timed.length ? Math.round((timed.reduce((s, e) => s + e.secs, 0) / timed.length) * 10) / 10 : null,
    recent: all.slice(0, 5) };
}

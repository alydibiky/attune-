/* ---- v6.37 (upgrade X3) — the weekly privacy report. The phone (NetLog.kt) and the computer (desktop/main.js) keep
   every connection of this session in memory: only the host and why, never what was sent. Here the page folds those
   into a small per-day tally (35 days, attune:netweek:v1) so a week can be shown: how many connections, to which
   places, for what, and what was blocked. Pure; tests/unit/v740netreport.test.mjs. */
export const NET_WEEK_KEY = "attune:netweek:v1";
const DAYS = 35;
const pad = (n) => String(n).padStart(2, "0");
export const dayOf = (t) => { const d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };

/** The phone's {entries:[{t,host,what,blocked}]} or the computer's [{t,host,ok,why}] → [{t,host,what,blocked}]. */
export function normalize(raw) {
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.entries) ? raw.entries : [];
  return list.filter((e) => e && e.t && e.host).map((e) => ({ t: +e.t, host: String(e.host).replace(/^www\./, "").slice(0, 80),
    what: String(e.what != null ? e.what : e.why || "").slice(0, 80), blocked: e.blocked != null ? !!e.blocked : e.ok === false }));
}

/** Adds the entries newer than the last fold. state = { last, days: { "YYYY-MM-DD": { host: { n, b, what: [] } } } }. */
export function fold(state, raw, now = Date.now()) {
  const s = { last: (state && state.last) || 0, days: { ...((state && state.days) || {}) } };
  let last = s.last;
  for (const e of normalize(raw)) {
    if (e.t <= s.last) continue;
    const d = dayOf(e.t), day = (s.days[d] = { ...(s.days[d] || {}) });
    const h = (day[e.host] = { n: 0, b: 0, what: [], ...(day[e.host] || {}) });
    h.what = h.what.slice();
    if (e.blocked) h.b++; else h.n++;
    if (e.what && !h.what.includes(e.what) && h.what.length < 3) h.what.push(e.what);
    last = Math.max(last, e.t);
  }
  s.last = last;
  const keep = dayOf(now - DAYS * 86400000);
  for (const d of Object.keys(s.days)) if (d < keep) delete s.days[d];
  return s;
}

/** The 7 days ending `now` (weeksAgo = 1 → the week before). → { from, to, sent, blocked, places:[{host,n,b,what}], days } */
export function weekReport(state, now = Date.now(), weeksAgo = 0) {
  const end = now - weeksAgo * 7 * 86400000, from = dayOf(end - 6 * 86400000), to = dayOf(end);
  const by = {}; let sent = 0, blocked = 0; const active = new Set();
  for (const [d, hosts] of Object.entries((state && state.days) || {})) {
    if (d < from || d > to) continue;
    for (const [host, h] of Object.entries(hosts)) {
      const p = (by[host] = by[host] || { host, n: 0, b: 0, what: [] });
      p.n += h.n || 0; p.b += h.b || 0; sent += h.n || 0; blocked += h.b || 0;
      for (const w of h.what || []) if (!p.what.includes(w) && p.what.length < 3) p.what.push(w);
      if (h.n || h.b) active.add(d);
    }
  }
  const places = Object.values(by).sort((a, b) => b.n + b.b - (a.n + a.b) || a.host.localeCompare(b.host));
  return { from, to, sent, blocked, places, days: active.size };
}

export function loadNetWeek(s = typeof localStorage !== "undefined" ? localStorage : null) { try { return JSON.parse((s && s.getItem(NET_WEEK_KEY)) || "null") || { last: 0, days: {} }; } catch (e) { return { last: 0, days: {} }; } }
export function saveNetWeek(v, s = typeof localStorage !== "undefined" ? localStorage : null) { try { s && s.setItem(NET_WEEK_KEY, JSON.stringify(v)); } catch (e) {} return v; }

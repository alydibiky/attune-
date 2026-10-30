/* ---- v8.8 "Attune noticed" — very smart (Ali, 30 Oct 2026: "make Attune noticed very very smart and the app exceptionally
   smart"). Code reads the connected memory (links.js items, People cards) and finds what a careful friend with your notebook
   would point out — each finding with the numbers behind it, ranked by how much it matters today:
     rhythm      you pay someone / something on a beat (the barber every ~3 weeks) → the next one is due; or it is late
     owed        money someone owes you, left for weeks
     surge       a topic running far above your usual this month (eating out 2.1× your usual)
     rise        the same bill / person costing more than last time (internet 450 → 520)
     twice       the same amount to the same place the same day — charged twice?
     big         this month's one big expense, against your usual
     newName     a name you keep writing with no card yet → add them
     notes       money your notes say moved that Money doesn't have
     goalPace    a goal behind the pace its date needs
     goalFind    an agent's find that fits a goal (the Makkah hotel vs the Umrah money)
   You can dismiss each one (gone for 30 days); a kind you dismiss three times is shown less. No AI — exact and instant.
   Pure; tests: tests/unit/v880insights.test.mjs.                                                                        */
import { itemsOf, tagOf, TOPICS, topicName } from "./links.js";
import { newNames, labelOf } from "./entities.js";

export const SEEN_KEY = "attune:noticed:v1";
const DAY = 864e5;
const n0 = (v) => Math.round(v).toLocaleString("en-US");
const ymd = (ts) => new Date(ts).toISOString().slice(0, 10);
const fmtDay = (ts, ar) => new Date(ts).toLocaleDateString(ar ? "ar-EG-u-nu-latn" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
// a payment's "who / what": the card it names, else its note made plain ("Netflix", «الحلاق») — for rhythms and rises
const keyOf = (it, t, dir) => {
  const p = t.people.find((x) => !x.endsWith("?"));
  if (p) { const c = dir.items.find((x) => x.id === p); return c ? { k: "p:" + p, name: c.name, person: p } : null; }
  const n = String(it.title || "").toLowerCase().replace(/[\d٠-٩.,:;()\-–—]+/g, " ").replace(/\s+/g, " ").trim();
  return n.length >= 3 && n.length <= 40 ? { k: "n:" + n, name: it.title.replace(/[\d٠-٩.,]+/g, "").trim().slice(0, 40) || it.title } : null;
};

/** Everything worth saying today: [{ k (kind), id (stable, for dismissing), score 0–100, en, ar, open, person?, act? }], best first. */
export function insights(stores = {}, dir = { items: [] }, { now = Date.now(), seen = {}, notesPending = 0 } = {}) {
  const out = [], push = (x) => { out.push(x); };
  const items = itemsOf(stores), goals = ((stores.pots && stores.pots.pots) || []).map((p) => p.name).filter(Boolean);
  const tagged = items.map((it) => ({ it, t: tagOf(it, dir, goals) }));
  const pays = tagged.filter((x) => x.it.src === "money" && x.it.sign < 0 && x.it.amount > 0 && x.it.ts);
  const cur = (stores.ledger && stores.ledger.currency) || "";

  // ---- rhythm: a beat in the payments to one person / thing
  const groups = new Map();
  for (const x of pays) { const k = keyOf(x.it, x.t, dir); if (!k) continue; const g = groups.get(k.k) || { ...k, list: [] }; g.list.push(x.it); groups.set(k.k, g); }
  for (const g of groups.values()) {
    const l = g.list.sort((a, b) => a.ts - b.ts); if (l.length < 3) continue;
    const gaps = l.slice(1).map((x, i) => (x.ts - l[i].ts) / DAY).filter((d) => d >= 1);
    if (gaps.length < 2) continue;
    const beat = median(gaps), spread = median(gaps.map((d) => Math.abs(d - beat)));
    if (beat < 5 || beat > 120 || spread > Math.max(3, beat * 0.25)) continue;   // a real beat: steady within a quarter
    const last = l[l.length - 1], next = last.ts + beat * DAY, inDays = Math.round((next - now) / DAY), amt = median(l.map((x) => x.amount));
    const every = beat >= 27 && beat <= 33 ? ["every month", "كل شهر"] : beat >= 6 && beat <= 8 ? ["every week", "كل أسبوع"] : [`every ~${Math.round(beat)} days`, `كل ~${Math.round(beat)} يوم`];
    if (inDays >= -1 && inDays <= 3) push({ k: "rhythm", id: "rhythm:" + g.k + ":" + ymd(next), score: 78 - Math.max(0, inDays) * 4, open: g.person ? "people" : "money", person: g.person,
      en: `You pay ${g.name} ${every[0]} (about ${n0(amt)} ${cur}) — the next one is ${inDays <= 0 ? "due now" : "around " + fmtDay(next)}.`, ar: `بتدفع لـ${g.name} ${every[1]} (حوالي ${n0(amt)} ${cur}) — الجاية ${inDays <= 0 ? "دلوقتي" : "حوالي " + fmtDay(next, true)}.`,
      act: { kind: "remind", text: `${g.name} ~${n0(amt)} ${cur}`, at: Math.max(now + 3600e3, next) } });
    else if (inDays < -Math.max(4, beat * 0.5) && inDays > -beat * 2 && /bill|internet|فاتور|اشتراك|نت|كهربا|subscription|rent|ايجار/i.test(g.name + " " + l.map((x) => x.text).join(" ")))
      push({ k: "rhythm", id: "late:" + g.k + ":" + ymd(next), score: 70, open: "money", en: `${g.name} usually comes ${every[0]} — it's ${-inDays} days late. Paid somewhere else?`, ar: `${g.name} بييجي ${every[1]} — متأخر ${-inDays} يوم. اتدفع من حتة تانية؟` });
  }
  // ---- owed: money someone owes you, waiting for weeks
  for (const x of tagged.filter((x) => x.it.src === "followups" && x.it.sign > 0 && !x.it.done && (x.it.left == null || x.it.left > 0))) {
    const age = Math.round((now - x.it.ts) / DAY); if (age < 21) continue;
    const left = x.it.left != null ? x.it.left : x.it.amount, who = x.it.who || x.it.title;
    const pid = x.t.people.find((p) => !p.endsWith("?"));
    push({ k: "owed", id: "owed:" + x.it.id + ":" + Math.floor(age / 14), score: Math.min(74, 50 + Math.floor(age / 7) * 3), open: pid ? "people" : "life", person: pid,
      en: `${who} has owed you ${n0(left)} ${cur} for ${age >= 60 ? Math.round(age / 30) + " months" : Math.round(age / 7) + " weeks"}. A gentle reminder?`, ar: `${who} عليه ${n0(left)} ${cur} من ${age >= 60 ? Math.round(age / 30) + " شهور" : Math.round(age / 7) + " أسابيع"}. نفكّره بلطف؟` });
  }
  // ---- surge: a topic far above its usual this month (vs the 3 months before)
  const ym = (ts) => new Date(ts).toISOString().slice(0, 7), thisM = ym(now);
  const prevMs = [1, 2, 3].map((k) => { const d = new Date(now); d.setDate(1); d.setMonth(d.getMonth() - k); return ym(d.getTime()); });
  const dayOfMonth = new Date(now).getDate();
  for (const [key] of TOPICS) {
    const of = (m) => pays.filter((x) => x.t.topics.includes(key) && ym(x.it.ts) === m).reduce((a, x) => a + x.it.amount, 0);
    const nowSum = of(thisM), usual = prevMs.map(of), avg = usual.reduce((a, b) => a + b, 0) / 3;
    if (usual.filter((v) => v > 0).length < 2 || avg <= 0) continue;
    const ratio = nowSum / avg;
    if (ratio >= 1.5 && nowSum - avg >= Math.max(300, avg * 0.3)) push({ k: "surge", id: "surge:" + key + ":" + thisM, score: Math.min(72, 52 + Math.round((ratio - 1.5) * 20)) + (dayOfMonth < 20 ? 6 : 0), open: "money",
      en: `${topicName(key)} is ${ratio.toFixed(1)}× your usual this month — ${n0(nowSum)} ${cur} vs about ${n0(avg)}${dayOfMonth < 20 ? ", and the month isn't over" : ""}.`, ar: `${topicName(key, true)} ${ratio.toFixed(1)}× المعتاد الشهر ده — ${n0(nowSum)} ${cur} بدل حوالي ${n0(avg)}${dayOfMonth < 20 ? "، والشهر لسه مخلصش" : ""}.` });
  }
  // ---- rise: the same thing costing more than its last few times
  for (const g of groups.values()) {
    const l = g.list.sort((a, b) => a.ts - b.ts); if (l.length < 3) continue;
    const last = l[l.length - 1], before = median(l.slice(-4, -1).map((x) => x.amount));
    if (now - last.ts > 40 * DAY || before <= 0) continue;
    const up = (last.amount - before) / before;
    if (up >= 0.12 && last.amount - before >= 20) push({ k: "rise", id: "rise:" + g.k + ":" + last.id, score: 58 + Math.min(12, Math.round(up * 30)), open: g.person ? "people" : "money", person: g.person,
      en: `${g.name} went up: ${n0(last.amount)} ${cur} last time, it was about ${n0(before)} (+${Math.round(up * 100)}%).`, ar: `${g.name} غلي: ${n0(last.amount)} ${cur} آخر مرة، كان حوالي ${n0(before)} (+${Math.round(up * 100)}%).` });
  }
  // ---- twice: the same amount to the same place on the same day (the last 10 days)
  const recent = pays.filter((x) => now - x.it.ts < 10 * DAY), seenPair = new Set();
  for (let i = 0; i < recent.length; i++) for (let j = i + 1; j < recent.length; j++) {
    const a = recent[i].it, b = recent[j].it;
    if (a.amount !== b.amount || ymd(a.ts) !== ymd(b.ts) || a.amount < 50) continue;
    const ka = keyOf(a, recent[i].t, dir), kb = keyOf(b, recent[j].t, dir); if (!ka || !kb || ka.k !== kb.k || seenPair.has(ka.k + ymd(a.ts))) continue;
    seenPair.add(ka.k + ymd(a.ts));
    push({ k: "twice", id: "twice:" + a.id + ":" + b.id, score: 88, open: "money", en: `${n0(a.amount)} ${cur} to ${ka.name} twice on ${fmtDay(a.ts)} — charged twice, or two real payments?`, ar: `${n0(a.amount)} ${cur} لـ${ka.name} مرتين يوم ${fmtDay(a.ts, true)} — اتخصموا مرتين ولا دول دفعتين فعلاً؟` });
  }
  // ---- big: this month's one big expense against your usual size
  { const month = pays.filter((x) => ym(x.it.ts) === thisM), all = pays.filter((x) => now - x.it.ts < 120 * DAY).map((x) => x.it.amount);
    const typical = median(all), top = month.sort((a, b) => b.it.amount - a.it.amount)[0];
    if (top && all.length >= 10 && typical > 0 && top.it.amount >= typical * 8 && top.it.amount >= 1000 && now - top.it.ts < 7 * DAY)
      push({ k: "big", id: "big:" + top.it.id, score: 50, open: "money", en: `A big one: ${n0(top.it.amount)} ${cur} for ${top.it.title} — your usual payment is about ${n0(typical)}. Planned?`, ar: `مبلغ كبير: ${n0(top.it.amount)} ${cur} لـ${top.it.title} — المعتاد حوالي ${n0(typical)}. كان مخطط له؟` }); }
  // ---- newName: a name you keep writing that has no card yet
  { const met = new Map();
    for (const x of items.filter((x) => (x.src === "money" || x.src === "notes" || x.src === "mind") && now - x.ts < 60 * DAY)) for (const nm of newNames([x.title, x.text].join(" "), dir)) { const k = nm.toLowerCase(); met.set(k, { name: nm, n: ((met.get(k) || {}).n || 0) + 1 }); }
    const best = [...met.values()].filter((m) => m.n >= 2).sort((a, b) => b.n - a.n)[0];
    if (best) push({ k: "newName", id: "name:" + best.name.toLowerCase(), score: 46 + Math.min(10, best.n * 2), open: "people", en: `You've written “${best.name}” ${best.n} times — add them to People so Attune links everything about them?`, ar: `كتبت «${best.name}» ${best.n} مرات — تضيفه للناس عشان أتيون يربط كل حاجة عنه؟` }); }
  // ---- notes: money your notes say moved, not in Money yet
  if (notesPending > 0) push({ k: "notes", id: "notes:" + notesPending + ":" + ymd(now), score: 60, open: "money", en: `${notesPending} ${notesPending === 1 ? "payment" : "payments"} in your notes ${notesPending === 1 ? "isn't" : "aren't"} in Money yet — one tap each.`, ar: `${notesPending} ${notesPending === 1 ? "دفعة" : "دفعات"} في ملاحظاتك لسه مش في الفلوس — دوسة واحدة لكل واحدة.` });
  // ---- goals: behind the pace the date needs; and an agent's find that fits a goal
  for (const p of (stores.pots && stores.pots.pots) || []) {
    if (!(p.target > 0) || !p.by) continue;
    const end = Date.parse(p.by + "-28T12:00:00"); if (!isFinite(end) || end < now) continue;
    const months = Math.max(1, Math.round((end - now) / (30 * DAY))), left = Math.max(0, p.target - (p.saved || 0)), need = left / months;
    const lastPut = (p.log || []).filter((x) => now - Date.parse(x.d) < 35 * DAY).reduce((a, x) => a + (+x.a || 0), 0);
    if (left > 0 && lastPut < need * 0.6) push({ k: "goalPace", id: "pace:" + p.id + ":" + thisM, score: 62, open: "planner",
      en: `${p.name}: ${n0(left)} ${cur} still to go — about ${n0(need)} a month to make ${p.by}${lastPut ? `; this month ${n0(lastPut)} so far` : "; nothing put aside this month yet"}.`, ar: `${p.name}: فاضل ${n0(left)} ${cur} — حوالي ${n0(need)} في الشهر عشان تلحق ${p.by}${lastPut ? `؛ الشهر ده ${n0(lastPut)} لحد دلوقتي` : "؛ لسه محوّشتش حاجة الشهر ده"}.` });
    const gTopics = TOPICS.filter((t) => t[3].test(p.name)).map((t) => t[0]);
    for (const a of (stores.agents && stores.agents.agents) || []) {
      const best = a.best3 && a.best3[0]; if (!best || !best.price) continue;
      const aTopics = TOPICS.filter((t) => t[3].test(a.title + " " + (a.site || "") + " " + (best.text || ""))).map((t) => t[0]);
      if (!gTopics.some((k) => aTopics.includes(k)) && !String(a.title).toLowerCase().includes(String(p.name).toLowerCase())) continue;
      const have = p.saved || 0;
      push({ k: "goalFind", id: "find:" + a.id + ":" + p.id + ":" + Math.round(best.price), score: 64, open: "agents",
        en: `Your agent found ${best.name || a.title} at ${n0(best.price)} — your ${p.name} goal has ${n0(have)} of ${n0(p.target)} saved${have >= best.price ? ", enough for it" : ""}.`,
        ar: `الوكيل لقى ${best.name || a.title} بـ${n0(best.price)} — هدف ${p.name} فيه ${n0(have)} من ${n0(p.target)}${have >= best.price ? "، يكفّيه" : ""}.` });
    }
  }
  // ---- what you dismissed stays away for 30 days; a kind dismissed 3 times is shown less
  const gone = seen.gone || {}, mute = seen.mute || {};
  return out.filter((x) => !(gone[x.id] && now - gone[x.id] < 30 * DAY)).map((x) => ({ ...x, score: x.score - Math.min(30, (mute[x.k] || 0) * 10) }))
    .sort((a, b) => b.score - a.score);
}
export function loadSeen(st = typeof localStorage !== "undefined" ? localStorage : null) { try { const v = JSON.parse((st && st.getItem(SEEN_KEY)) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
/** "Not useful" on a finding: gone for 30 days, and its kind counts toward being shown less. */
export function dismiss(seen, x, now = Date.now()) { const s = { gone: { ...(seen.gone || {}) }, mute: { ...(seen.mute || {}) } }; s.gone[x.id] = now; s.mute[x.k] = (s.mute[x.k] || 0) + 1; return s; }
export function saveSeen(v, st = typeof localStorage !== "undefined" ? localStorage : null) { try { st && st.setItem(SEEN_KEY, JSON.stringify(v)); } catch (e) {} return v; }

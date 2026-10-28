/* ---- v8.7 (persona 4, idea 13 — Ali: "do all"): the family space ---------------------------------------------------------------
   What a family shares, and ONLY that (Money, Mind, chats stay each person's own):
     list       the shared shopping list ("add milk to the family list") — ticked by whoever buys it
     expenses   who paid what for the house ("I paid 450 for the family groceries") → who owes whom, settled in the fewest
                transfers (the greedy "simplify debts" of Spliit, MIT — github.com/spliit-app/spliit — written here from scratch)
     reminders  for the parents: "remind dad to take his pills at 9" → a reminder with the person's name, sent with the family
   How it travels without a server: the family store alone is locked with the family code (the same AES-256-GCM as Backup /
   Sync) and sent as a small file (WhatsApp, Wi-Fi, anything); opening it on another phone MERGES it item by item (the newer
   copy of an item wins — syncMerge). Nothing is stored anywhere else.
   Store "attune:family:v1" = { me, members: [{id, name}], list: [...], expenses: [...], reminders: [...] }.
   Pure: data in, data out. Tests: tests/unit/v870family.test.mjs.                                                           */
import { encryptBackup, decryptBackup } from "./backup.js";
import { syncMerge } from "./sync.js";

export const FAMILY_KEY = "attune:family:v1";
const id = (p, now = Date.now()) => p + now.toString(36) + Math.random().toString(36).slice(2, 6);
const clean = (s, n = 60) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const round = (v) => Math.round(v * 100) / 100;

export const emptyFamily = () => ({ me: "", members: [], list: [], expenses: [], reminders: [] });
export const loadFamily = (store = typeof localStorage !== "undefined" ? localStorage : null) => { try { const j = JSON.parse((store && store.getItem(FAMILY_KEY)) || "null"); return j && Array.isArray(j.list) ? { ...emptyFamily(), ...j } : emptyFamily(); } catch (e) { return emptyFamily(); } };
export const saveFamily = (f, store = typeof localStorage !== "undefined" ? localStorage : null) => { try { store && store.setItem(FAMILY_KEY, JSON.stringify(f)); } catch (e) {} return f; };

/** A family member by name (added once; "me" is this phone's person). */
export function addMember(f, name, now = Date.now()) {
  const n = clean(name, 30); if (!n) return { f, m: null };
  const had = f.members.find((m) => m.name.toLowerCase() === n.toLowerCase());
  if (had) return { f, m: had };
  // the id comes from the name, so two phones that both add "Mama" mean the same person when their files meet
  const m = { id: "m:" + n.toLowerCase().replace(/\s+/g, "-"), name: n, at: now };
  return { f: { ...f, members: [...f.members, m] }, m };
}
export const setMe = (f, name, now = Date.now()) => { const { f: g, m } = addMember(f, name, now); return { ...g, me: m ? m.id : f.me }; };
const nameOf = (f, mid) => (f.members.find((m) => m.id === mid) || {}).name || "";

/** The shopping list: add (words split on "and" / "," / «و»), tick, clear the ticked. */
export function addItems(f, text, by = "", now = Date.now()) {
  const words = String(text || "").split(/\s*(?:,|،|\band\b|\s+و(?=\S)|\s+و\s+)\s*/i).map((x) => clean(x, 50)).filter(Boolean);
  const have = new Set(f.list.filter((x) => !x.done && !x.cleared).map((x) => x.what.toLowerCase()));
  const add = words.filter((w) => !have.has(w.toLowerCase())).map((w, i) => ({ id: id("l", now + i), what: w, by: by || f.me, at: now, done: false }));
  return { f: { ...f, list: [...f.list, ...add] }, added: add.map((x) => x.what) };
}
export const tickItem = (f, lid, by = "", now = Date.now()) => ({ ...f, list: f.list.map((x) => (x.id === lid ? { ...x, done: !x.done, doneBy: by || f.me, at: now } : x)) });
// (hidden, not deleted: a delete wouldn't travel — the other phone's copy would bring it back)
export const clearDone = (f, now = Date.now()) => ({ ...f, list: f.list.map((x) => (x.done && !x.cleared ? { ...x, cleared: true, at: now } : x)) });
export const listNow = (f) => f.list.filter((x) => !x.cleared);

/** An expense for the house: paid by one member, shared by `among` (all members when empty). */
export function addExpense(f, { amount, what = "", by = "", among = [], date = "" }, now = Date.now()) {
  const a = +amount; if (!(a > 0)) return f;
  const e = { id: id("e", now), amount: round(a), what: clean(what, 60), by: by || f.me, among: among.length ? among : [], date: date || new Date(now).toISOString().slice(0, 10), at: now };
  return { ...f, expenses: [...f.expenses, e] };
}
/** A payment between two members ("Ahmed paid me back 200") — an expense of one person shared by the other. */
export const settlePayment = (f, from, to, amount, now = Date.now()) => addExpense(f, { amount, what: "Settled", by: from, among: [to] }, now);

/** Each member's balance (+ = is owed, − = owes) and the fewest transfers that settle everything. */
export function balances(f) {
  const bal = Object.fromEntries(f.members.map((m) => [m.id, 0]));
  for (const e of f.expenses) {
    const among = (e.among && e.among.length ? e.among : f.members.map((m) => m.id)).filter((x) => x in bal);
    if (!among.length || !(e.by in bal)) continue;
    const share = e.amount / among.length;
    bal[e.by] += e.amount;
    for (const x of among) bal[x] -= share;
  }
  for (const k of Object.keys(bal)) bal[k] = round(bal[k]);
  // greedy: the one owed most is paid by the one who owes most, until all are ~0
  const pos = Object.entries(bal).filter(([, v]) => v > 0.009).map(([k, v]) => [k, v]).sort((a, b) => b[1] - a[1]);
  const neg = Object.entries(bal).filter(([, v]) => v < -0.009).map(([k, v]) => [k, -v]).sort((a, b) => b[1] - a[1]);
  const moves = [];
  while (pos.length && neg.length) {
    const p = pos[0], n = neg[0], x = round(Math.min(p[1], n[1]));
    moves.push({ from: n[0], to: p[0], amount: x, fromName: nameOf(f, n[0]), toName: nameOf(f, p[0]) });
    p[1] = round(p[1] - x); n[1] = round(n[1] - x);
    if (p[1] <= 0.009) pos.shift(); if (n[1] <= 0.009) neg.shift();
    pos.sort((a, b) => b[1] - a[1]); neg.sort((a, b) => b[1] - a[1]);
  }
  return { bal, moves };
}

/** A reminder for a family member ("remind dad to take his pills at 9") — travels with the family file. */
export function addFamilyReminder(f, { who, title, at, repeat = "none" }, now = Date.now()) {
  const { f: g, m } = addMember(f, who, now); if (!m || !title || !at) return f;
  return { ...g, reminders: [...g.reminders, { id: id("r", now), for: m.id, forName: m.name, title: clean(title, 70), at, repeat, by: f.me, created: now }] };
}

/** The Home box: "add milk and bread to the family list", «ضيف لبن وعيش لقايمة البيت», "I paid 450 for the family groceries",
    «دفعت 450 للبيت», "family list" → { kind: "items"|"expense"|"show", ... } or null. */
export function familyIntent(text) {
  const t = String(text || "").trim();
  let m = t.match(/^(?:please\s+)?(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:the\s+|our\s+)?(?:family|house|home|shared)\s+(?:shopping\s+)?list\s*$/i)
    || t.match(/^(?:ضيف|ضيفي|حط|حطي|زوّد|زود)\s+(.+?)\s+(?:ل|على\s*|في\s*)(?:قايمة|قائمة|لستة|ليستة)\s*(?:البيت|العيلة|العائلة|المشتريات|الطلبات)\s*$/);
  if (m) return { kind: "items", text: m[1] };
  m = t.match(/^i\s+paid\s+([\d,.]+)\s*(?:egp|le|pounds?)?\s+for\s+(?:the\s+)?(?:family|house|home)(?:'s)?\s*(.*)$/i)
    || t.match(/^دفعت\s+([\d٠-٩,.]+)\s*(?:جنيه)?\s+(?:لل|ل)(?:بيت|عيلة|عيله)\s*(.*)$/);
  if (m) { const a = +String(m[1]).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/,/g, ""); if (a > 0) return { kind: "expense", amount: a, what: clean(m[2] || "", 50) }; }
  if (/^(?:the\s+|our\s+)?(?:family|house)\s+(?:shopping\s+)?list\??$|^(?:who\s+owes\s+(?:whom|who)|family\s+(?:balance|money))\??$|^(?:قايمة|قائمة|لستة)\s*(?:البيت|العيلة)\s*[؟?]?$|^مين\s+عليه\s+كام\s*[؟?]?$/i.test(t)) return { kind: "show" };
  return null;
}

/** The family store locked with the family code → the file text to send. */
export const packFamily = (f, code, opts = {}) => encryptBackup({ [FAMILY_KEY]: JSON.stringify({ ...f, me: "" }) }, code, { iterations: opts.iterations || 200000, app: "family" });
/** A family file opened here → merged into this phone's family store (this phone's "me" kept). Throws on a wrong code. */
export async function takeFamily(f, text, code) {
  let theirs;
  try { theirs = await decryptBackup(text, code); } catch (e) { throw new Error(/Wrong password/.test(String(e && e.message)) ? "Wrong family code — nothing was changed." : String((e && e.message) || e)); }
  if (!theirs[FAMILY_KEY]) throw new Error("This isn't a family file.");
  const merged = syncMerge({ [FAMILY_KEY]: JSON.stringify({ ...f, me: "" }) }, { [FAMILY_KEY]: theirs[FAMILY_KEY] })[FAMILY_KEY];
  return { ...emptyFamily(), ...JSON.parse(merged), me: f.me };
}

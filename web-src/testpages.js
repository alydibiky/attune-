/* ---- v10.9.9 B5 (Ali OK'd 27 Nov: "test every page, guided, on your phone"). Settings › Test every page walks through every page the
   Tools list shows (plus Home, Chat, Money and Mind), one real thing to try on each — with the person's own data where there is some
   (the newest Money entry, the first saved paper) — and what it should do. ✓ Works / ✗ Wrong (a note, a screenshot) / Skip; progress
   is kept, each run stamped with the app version; at the end ONE report (text + screenshots in one .html file) goes out through the share
   sheet — nothing is ever sent by itself. Pure; the page is testpages-ui.jsx. Tests: tests/unit/v1099b5.test.mjs, tests/e2e_v1099b5.py. */
export const KEY = "attune:testpages:v1";
export const SHOT_KEY = "attune:testpages:shot:";

// the pages with their own step (the rest get the general one, with the page's name in it)
const CORE = ["home", "chat", "money", "memory"];
const STEP = {
  home: ["On Home, type: remind me tomorrow at 9 to call {who}", "A reminder for tomorrow 9:00 is set, and Undo shows."],
  chat: ["In Chat, ask: when did I last pay for {x}?", "It answers from your own data with the date, and the chip opens that payment."],
  money: ["On Home, type: how much did I spend on food this month?", "This month's Food total, the same as in Money."],
  memory: ["In Mind, search for {note}.", "The note you saved is found and opens."],
  lists: ["Type on Home: buy milk, eggs and bread", "Three items appear in Groceries, each with its own box."],
  timeline: ["Open Follow-ups and tick one thing as done.", "It moves to done, and Undo brings it back."],
  radar: ["In Chat, ask: when does my {paper} expire?", "The date you saved, and how many days are left."],
  agents: ["Ask an agent for a hotel in Cairo for 2 nights.", "Real offers, each opening the exact page on the site."],
  translate: ["Translate a sentence from English to Arabic.", "Egyptian Arabic that reads naturally."],
  convert: ["Turn a PDF into Word.", "A Word file that keeps the layout and the tables."],
  pdfchat: ["Open a PDF and ask a question about it.", "The answer shows the page it came from."],
  reminders: ["Add a reminder for 2 minutes from now.", "The phone rings on time, even with Attune closed."],
};
const GENERAL = ["Open {p} and use its main button once.", "It does what it says, with no error and no word left untranslated."];

/** stores: { ledger, radar, memory, people } → the words that make a step the person's own. */
export function personal(stores = {}) {
  const tx = ((stores.ledger && stores.ledger.txns) || []).filter((t) => t && t.type === "expense" && String(t.note || "").trim()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const paper = ((stores.radar && stores.radar.items) || []).find((x) => x && x.title);
  const note = (stores.memory || []).find((r) => r && r.kind === "note" && String(r.text || r.title || "").trim().length > 3);
  const who = ((stores.life && stores.life.items) || []).find((c) => c && c.person);
  const firstWords = (s, n) => String(s || "").replace(/\s+/g, " ").trim().split(" ").slice(0, n).join(" ");
  return { x: tx[0] ? firstWords(tx[0].note, 3) : "", paper: paper ? firstWords(paper.title, 3) : "", note: note ? firstWords(note.text || note.title, 2) : "", who: who ? firstWords(who.person, 2) : "" };
}
/**
 * pages = [[id, label], …] (what the Tools page shows) → the steps, Home · Chat · Money · Mind first: [{ id, label, try, expect, v }]
 * try / expect are English keys for tr(); v = the values for their {placeholders} (the person's data or a plain example).
 */
export function stepsFor(pages = [], stores = {}) {
  const me = personal(stores), seen = new Set(), out = [];
  const add = (id, label) => {
    if (!id || seen.has(id)) return; seen.add(id);
    const s = STEP[id] || GENERAL;
    // (def: the values that are plain examples, not the person's own words — the page translates those)
    out.push({ id, label, try: s[0], expect: s[1], v: { p: label, x: me.x || "groceries", paper: me.paper || "passport", note: me.note || "a word from one of your notes", who: me.who || "mom" },
      def: ["p", ...["x", "paper", "note", "who"].filter((k) => !me[k])] });
  };
  const L = { home: "Home", chat: "Chat", money: "Money", memory: "Mind" };
  for (const id of CORE) add(id, (pages.find((p) => p[0] === id) || [id, L[id]])[1]);
  for (const [id, label] of pages) add(id, label);
  return out;
}
export const fresh = (version) => ({ version: String(version || ""), started: Date.now(), idx: 0, res: {} });
export function load(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const v = JSON.parse((storage && storage.getItem(KEY)) || "null"); if (v && typeof v === "object" && v.res) return v; } catch (e) {}
  return null;
}
export function save(run, storage = typeof localStorage !== "undefined" ? localStorage : null) { try { storage && storage.setItem(KEY, JSON.stringify(run)); } catch (e) {} }
/** r = "ok" | "bad" | "skip" → the run with that page's result, and the next page that has none yet (or the end). */
export function mark(run, steps, id, r, note = "", shot = "") {
  const res = { ...run.res, [id]: { r, note: String(note || "").slice(0, 600), shot: shot || (run.res[id] && run.res[id].shot) || "", at: Date.now() } };
  const i = steps.findIndex((s) => s.id === id);
  let next = steps.findIndex((s, j) => j > i && !res[s.id]);
  if (next < 0) next = steps.findIndex((s) => !res[s.id]);   // (then back to any page left untried before this one)
  return { ...run, res, idx: next >= 0 ? next : steps.length };
}
export function counts(run, steps) {
  const c = { ok: 0, bad: 0, skip: 0, left: 0 };
  for (const s of steps) { const x = run && run.res[s.id]; if (!x) c.left++; else c[x.r] = (c[x.r] || 0) + 1; }
  return c;
}
/** The report as plain text (the share sheet's message): wrong ones first, with their notes. tr = the app's translator. */
export function reportText(run, steps, tr = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)) : s)) {
  const c = counts(run, steps), when = new Date(run.started || Date.now()).toISOString().slice(0, 10);
  const head = tr("Attune test · version {v} · {d}", { v: run.version || "?", d: when }) + "\n" + tr("{ok} work · {bad} wrong · {skip} skipped · {left} not tried", c);
  const line = (s) => { const x = run.res[s.id] || {}; return (x.r === "bad" ? "✗ " : x.r === "ok" ? "✓ " : x.r === "skip" ? "– " : "· ") + tr(s.label) + " — " + tr(s.try, s.v) + (x.note ? "\n   " + tr("Note") + ": " + x.note : "") + (x.shot ? "\n   " + tr("Screenshot attached") : ""); };
  const bad = steps.filter((s) => run.res[s.id] && run.res[s.id].r === "bad"), rest = steps.filter((s) => !(run.res[s.id] && run.res[s.id].r === "bad"));
  return [head, "", ...bad.map(line), ...(bad.length ? [""] : []), ...rest.map(line)].join("\n");
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** One .html file with the report and every screenshot inside it — one thing to share, opens anywhere. shots = { id: dataURL } */
export function reportHtml(run, steps, shots = {}, tr) {
  const text = reportText(run, steps, tr);
  const imgs = steps.filter((s) => shots[s.id] && /^data:image\//.test(shots[s.id])).map((s) => `<h3>${esc((tr ? tr(s.label) : s.label))}</h3><img src="${shots[s.id]}" style="max-width:100%;border:1px solid #ccc;border-radius:8px">`).join("\n");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Attune test</title><body style="font:15px/1.5 system-ui;margin:16px;max-width:760px"><pre style="white-space:pre-wrap;font:inherit">${esc(text)}</pre>${imgs}</body>`;
}

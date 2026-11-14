// v9.9.36 BG-3 (Ali: "there is no problem when the app is closed for the model to think and filter notifications with the help of the
// code, even if each takes 30 s to 1 min"). EXACTLY 10,000 different cases, each checked:
//   - WHEN (= MindBg.kt allowedNow): charging, or battery above 40 % with the screen off and no battery saver — never otherwise
//   - WHAT (= MindBg.kt run): the last 3 days only, never a notification read before, never an app code is always sure of, newest first,
//     at most 12 a round and 40 a day
//   - MERGE: an answer the phone's model gave with Attune closed never changes what code was sure of; garbage never crashes and never
//     overwrites; an invented amount (a number not in the notification) is dropped; a right answer is taken where code was unsure
//     node tests/bgmind/gen.mjs [count]
const G = await import("../notifmind/gen.mjs");
const B = await import("../../web-src/mindbg.js");
const M = await import("../../web-src/notifmind.js");
const TOTAL = +(process.argv[2] || 10000);
let seed = 36 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const DAY = 86400000;
let n = 0, bad = 0, i = 0; const why = {}, seen = new Set();
const fail = (k, s) => { bad++; (why[k] = why[k] || []).push(s); };
while (n < TOTAL) {
  const kind = pick(["when", "round", "merge", "merge", "merge", "template"]);
  if (kind === "when") { const s = { plugged: rnd() < 0.3, pct: int(0, 100), interactive: rnd() < 0.5, saver: rnd() < 0.2 }, key = JSON.stringify(s); if (seen.has(key)) continue; seen.add(key); n++;
    const want = s.plugged || (s.pct > 40 && !s.interactive && !s.saver); if (B.bgAllowed(s) !== want) fail("when " + key, ""); continue; }
  if (kind === "round") { const now = G.NOW + int(0, 30) * DAY, notes = [], done = new Set(), skip = new Set(["com.bank.sure", "com.android.systemui"]);
    for (let k = 0; k < int(0, 40); k++) { const id = "n" + n + "-" + k, pkg = pick(["com.whatsapp", "com.bank.sure", "org.telegram.messenger", "com.android.systemui", "com.google.android.gm"]);
      const ts = now - int(0, 5 * 24) * 3600000; notes.push({ id, pkg, ts, text: rnd() < 0.1 ? " " : "hello " + k }); if (rnd() < 0.2) done.add(id); }
    const countToday = int(0, 45), r = B.bgRound(notes, { done, skip, countToday, now }); n++;
    const left = Math.max(0, 40 - countToday);
    if (r.length > 12 || r.length > left) fail("round too big", r.length + " > " + Math.min(12, left));
    if (r.some((x) => now - x.ts > 3 * DAY)) fail("older than 3 days", "");
    if (r.some((x) => done.has(x.id))) fail("read twice", "");
    if (r.some((x) => skip.has(x.pkg))) fail("an always-sure app was read", "");
    if (r.some((x) => !x.text.trim())) fail("an empty one was read", "");
    for (let k = 1; k < r.length; k++) if (r[k].ts > r[k - 1].ts) { fail("not newest first", ""); break; }
    const eligible = notes.filter((x) => now - x.ts <= 3 * DAY && !done.has(x.id) && !skip.has(x.pkg) && x.text.trim()).length;
    if (r.length !== Math.min(eligible, 12, left)) fail("round missed some", r.length + " ≠ " + Math.min(eligible, 12, left));
    continue; }
  if (kind === "template") { const notes = []; const pk = ["a.always", "b.mixed", "c.few"];
    for (let k = 0; k < 12; k++) { const c = G.make(i++); notes.push({ ...c.n, pkg: pk[k % 3], id: "t" + k }); }
    const t = B.bgTemplate(notes, G.NOW + int(0, 99) * DAY); n++;
    if (!/Today is \{DATE\}\./.test(t.system) || /Today is \d{4}/.test(t.system)) fail("template keeps a real date", "");
    if (t.max !== 40 || !/\{n\}/.test(t.words.reading)) fail("template words", "");
    for (const p of t.skip) { const mine = notes.filter((x) => x.pkg === p); if (mine.length < 5 || !mine.every((x) => M.comprehend(x).sure)) fail("skipped an app code is not always sure of", p); }
    continue; }
  // merge
  const c = G.make(i++), note = { ...c.n, id: "m" + i, ts: c.n.ts || G.NOW }, code = M.comprehend(note, { now: G.NOW }), w = c.want;
  const style = pick(["right", "right", "wrong", "invented", "garbage"]), key = i + style; if (seen.has(key)) continue; seen.add(key); n++;
  const raw = style === "garbage" ? pick(["", "I think it's a request", "{not json", "```\n{}\n```"]) : JSON.stringify({ intent: style === "wrong" ? pick(M.INTENTS || ["info", "request"]) : w.intent, action: style === "wrong" ? "none" : w.action,
    who: "", due: "", amount: style === "invented" ? 987654 : (w.amount && w.amount.value) || 0, cur: "", from_type: "" });
  const saved = {}; const k = B.takeBg([{ id: note.id, raw }], [note], (id, r) => { saved[id] = r; });
  if (code.sure) { if (k || saved[note.id]) fail("changed what code was sure of", note.text.slice(0, 60)); continue; }
  const r = saved[note.id];
  if (!raw) { if (r) fail("an empty answer was saved", ""); continue; }   // nothing came back: code's own reading stays
  if (!r) { fail("an unsure one was not taken", style); continue; }
  if (style === "invented" && r.amount && r.amount.value === 987654) fail("kept an invented amount", note.text.slice(0, 60));
  if (style === "garbage" && (r.intent !== code.intent || r.action !== code.action)) fail("garbage changed the reading", raw);
  const exp = M.merge(code, M.readMind(raw, note));
  if (JSON.stringify(r) !== JSON.stringify(exp)) fail("not the same merge as with Attune open", "");
}
console.log(`# Background thinking v9.9.36 — ${n} cases, ${n - bad} right (${(100 * (n - bad) / n).toFixed(2)}%)`);
for (const [k, v] of Object.entries(why)) console.log(`- ${k.slice(0, 140)} × ${v.length}: ${v.slice(0, 3).join(" · ")}`);

// v6.48 the Home box (CHAT_RUNS_APP.md): every typed thing → one outcome; asking, to-dos, where things are, the map, jobs.
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); } };
const R = await import("../../web-src/cmdrun.js");
const W = await import("../../web-src/whereis.js");
const K = await import("../../web-src/commands.js");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
let records = [];
const api = { records: () => records, detect: (t) => ({ doActions: /lunch|غدا/.test(t) ? 1 : 0, goal: /^find me/i.test(t), metro: /^from .+ to /i.test(t) }), metroAsk: (t) => (/maadi|المعادي/i.test(t) ? { from: "Maadi", to: "" } : null), translateTo: (t) => (/[؀-ۿ]/.test(t) ? "en" : "ar") };
const go = (t, o = {}) => R.route(t, { api, ...o });
const file = { name: "report.docx", size: 1000 };

ok(go("/convert to pdf").type === "need" && go("/convert to pdf").what === "file", "/convert with no file → asks for the file");
const cv = go("/convert to pdf", { files: [file] });
ok(cv.type === "job" && cv.spec.kind === "convert" && cv.spec.input.format === "pdf" && !cv.spec.heavy, "/convert + a file → a convert job (light)");
const tr1 = go("/translate to French good morning everyone");
ok(tr1.type === "job" && tr1.spec.kind === "translate" && tr1.spec.heavy && tr1.spec.input.to === "fr" && tr1.spec.input.text === "good morning everyone", "/translate to French … → a translate job (heavy)");
ok(go("/ترجم صباح الخير").spec.input.to === "en", "«/ترجم صباح الخير» with no language → English (Arabic text)");
ok(go("/translate", { files: [file] }).spec.input.format === "translate", "/translate + a file → the document is translated");
ok(go("/humanize short").type === "need" && go("/humanize I am writing to inform you that the shipment has been delayed.").spec.kind === "humanize", "/humanize needs real text, then becomes a job");
ok(go("/scout Tucson 2021 under 900k").type === "doit" && /^find me/.test(go("/scout Tucson 2021 under 900k").text), "/scout … → Scout through Home's reader (“find me …”)");
ok(go("/travel Turkey").type === "travel" && go("/travel Turkey").code === "tr" && go("/travel").type === "need", "/travel Turkey → the trip; /travel alone asks where");
ok(go("/web price of gold today").web === true, "/web → Chat with web search");
ok(go("/nothing").type === "lines", "an unknown command explains itself");

// to-dos
const ta = go("add buy milk to my to-do list");
ok(ta.type === "todoAdd" && ta.item === "buy milk", "“add buy milk to my to-do list” → to-do: buy milk");
records = [{ id: "1", kind: "todo", ts: 1, title: "buy milk", text: "buy milk", meta: { todo: true, done: false } }, { id: "2", kind: "todo", ts: 2, title: "call Hassan", meta: { todo: true, done: true } }];
const tl = go("what's in my to-do list?");
ok(tl.type === "todos" && tl.items.length === 1 && tl.items[0].title === "buy milk", "“what's in my to-do list?” → the open ones");
ok(go("/todo").type === "todos" && go("/todo add call the bank").item === "call the bank", "/todo · /todo add …");

// where things are
records = [W.whereRecord({ thing: "passport", place: "in the drawer" }, 1000)];
const ws = go("remember my passport is on the desk");
ok(ws.type === "confirm" && /not in the drawer any more/.test(ws.q.en), "a new place → “So the passport is not in the drawer any more?”");
ok(go("my passport is in the drawer").type === "lines", "the same place → already known");
const wa = go("where is my passport?");
ok(wa.type === "lines" && /in the drawer/.test(wa.lines[0].en), "“where is my passport?” → the drawer");
records = [];
ok(go("my keys are in the car").type === "whereSave", "the first time → just kept");
ok(/don't know where the umbrella/.test(go("where is my umbrella?").lines[0].en), "nothing kept → says so, and how to tell it");

// two meanings → ask; then the ticked one runs
const a = go("where is the passport");
ok(a.type === "ask" && a.options.includes("map") && a.options.includes("whereAsk"), "“where is the passport” → ask: the map or where I keep it");
ok(R.route("where is the passport", { api, kind: "map" }).type === "map", "he ticks “the map” → the map");
const prefs = K.learn(K.learn({}, a.sig, "map"), a.sig, "map");
ok(R.route("where is the passport", { api, prefs }).type === "map", "taught twice → no more asking");

// the map, food, chat
const mp = go("I want to go to Cairo Tower");
ok(mp.type === "map" && mp.place === "Cairo Tower", "“I want to go to Cairo Tower” → the map, “Cairo Tower”");
ok(go("عايز اروح برج القاهرة").place === "برج القاهرة", "«عايز اروح برج القاهرة» → «برج القاهرة»");
ok(go("how do I get to Maadi metro station").metro, "a station → the Metro route too");
ok(go("koshari for lunch 85").type === "doit", "food and money → Home's own reader, as before");
ok(go("what is the capital of Peru").type === "chat", "a question → Chat");

// remember + find
ok(go("remember this as the GMK 5250 plate", { files: [{ name: "plate.jpg" }] }).type === "rememberFiles" && go("remember this as the GMK 5250 plate", { files: [{ name: "plate.jpg" }] }).label === "the GMK 5250 plate", "a photo + “remember this as …” → kept in Mind with the label");
ok(go("/remember Hassan's number is 0100 555 1234").type === "rememberNote", "/remember a note");
records = [{ id: "p", kind: "photo", ts: 5, title: "GMK 5250 plate", tags: [], meta: { label: "GMK 5250 plate" } }, { id: "v", kind: "video", ts: 6, title: "Liebherr test lift", meta: { media: "video", said: "ارفع على مهلك الزاوية ستين" } }];
const f1 = go("show me the photo of the GMK plate");
ok(f1.type === "found" && f1.items[0].id === "p", "“show me the photo of the GMK plate” → that photo");
const f2 = go("/find الزاوية ستين");
ok(f2.items[0] && f2.items[0].id === "v", "/find words that were SAID in a video → the video");
records = [{ id: "v2", kind: "video", ts: 7, title: "Site walk", meta: { media: "video", cues: [{ start: 3000, end: 6000, text: "good morning team" }, { start: 102000, end: 108000, text: "ارفع على مهلك الزاوية ستين" }] } }];
const f3 = go("/find الزاوية ستين");
ok(f3.items[0] && f3.items[0].meta.at === 102000 && f3.items[0].meta.atText === "1:42", "the moment it was said: 1:42 (Mind opens the video playing from there)");
console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);

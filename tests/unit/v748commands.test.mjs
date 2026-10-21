// v6.48 Chat runs the app (CHAT_RUNS_APP.md S1): "/" commands, the meaning-guesser, asking with two options, learning the answer.
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); } };
const K = await import("../../web-src/commands.js");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const top = (t, ctx) => (K.guess(t, ctx)[0] || {}).kind;

// commands
const p = K.parseCommand("/translate to Turkish good morning");
ok(p.id === "translate" && p.to === "tr" && p.text === "good morning", "/translate to Turkish good morning → tr + the text: " + JSON.stringify([p.to, p.text]));
const pa = K.parseCommand("/ترجم للتركي صباح الخير");
ok(pa.id === "translate" && pa.to === "tr" && pa.text === "صباح الخير", "«/ترجم للتركي صباح الخير» (Egyptian Arabic name) → translate, tr: " + JSON.stringify([pa.to, pa.text]));
ok(K.parseCommand("/convert to pdf").format === "pdf" && K.parseCommand("/حول لوورد").format === "docx", "/convert to pdf · «/حول لوورد» → docx");
ok(K.parseCommand("/travel Türkiye").country === "tr" && K.parseCommand("/سفر تركيا").country === "tr", "/travel Türkiye · «/سفر تركيا» → tr");
ok(K.parseCommand("/todo add buy milk").add === "buy milk" && K.parseCommand("/todo").add === "", "/todo add buy milk · /todo (show)");
ok(K.parseCommand("/xyz hi").id === null && K.parseCommand("hello") === null, "unknown command → id null; no slash → null");
ok(K.commandsMatching("tr").map((c) => c.id).join() === "translate,travel" && K.commandsMatching("").length === K.COMMANDS.length, "the / list filters as you type (tr → translate, travel)");
ok(K.commandsMatching("ترج").some((c) => c.id === "translate"), "the list finds Arabic names too");

// languages, formats, countries
ok(K.langIn("translate this into French") === "fr" && K.langIn("ترجم ده للانجليزي") === "en" && K.langIn("hello there") === null, "the language named");
ok(K.formatIn("turn this Word file into a PDF") === "pdf" && K.formatIn("حول الملف ده لاكسل") === "xlsx", "the format asked (the last one named)");
ok(K.countryIn("I'm travelling to Japan next week") === "jp" && K.countryIn("رايح دبي الشهر الجاي") === "ae" && K.countryIn("I live in Romania") === "ro" && K.countryIn("a nice day") === null, "countries by name, aliases (Dubai → ae), no false hits");

// plain sentences → meaning
ok(top("add buy milk to my to-do list") === "todoAdd" && K.todoText("add buy milk to my to-do list") === "buy milk", "“add buy milk to my to-do list” → to-do: buy milk");
ok(K.todoText("ضيف اشتري لبن للمهام") === "اشتري لبن" && top("ضيف اشتري لبن للمهام") === "todoAdd", "«ضيف اشتري لبن للمهام» → to-do");
ok(top("what's in my to-do list?") === "todoList" && top("إيه المهام بتاعتي؟") === "todoList", "“what's in my to-do list?” · «إيه المهام بتاعتي؟» → show the list");
ok(top("remember my passport is on the desk") === "whereSet", "“remember my passport is on the desk” → where it is");
ok(top("where is my passport?") === "whereAsk" && top("where do I usually keep my passport") === "whereAsk", "“where is my passport?” → where I keep it (not the map)");
ok(top("I want to go to Cairo Tower") === "map" && top("عايز اروح برج القاهرة") === "map", "“I want to go to Cairo Tower” → the map");
ok(top("translate this to English: صباح الخير") === "translate" && top("humanize this email please") === "humanize", "translate · humanize");
ok(top("convert this to pdf", { hasFile: true }) === "convert", "convert + a file → convert");
ok(top("find a Tucson 2021 under 900k", { goal: true }) === "scout" && top("from Maadi to Ataba", { metro: true }) === "metro", "Scout and Metro come from their own readers");
ok(top("koshari for lunch 85", { doActions: 2 }) === "do", "food / money sentences → done in the app (Home's reader)");
ok(top("what is the capital of Peru") === "chat", "a plain question → Chat");
ok(top("show me the photo of the crane plate") === "find" && top("فكرني بالصورة بتاعة الباسبور") === "find", "“show me the photo of …” → find in Mind");

// two meanings → ask; learn
const where = K.guess("where is the passport", { things: [] });
const d1 = K.decide(where, {}, "where is the passport");
ok(d1.ask && d1.ask.includes("map") && d1.ask.includes("whereAsk"), "“where is the passport” (nothing kept yet) → ask: the map or where I keep it — " + JSON.stringify(d1));
ok(K.decide(K.guess("where is the passport", { things: ["passport"] }), {}, "where is the passport").kind === "whereAsk", "once the passport is kept somewhere → no question");
let prefs = K.learn({}, d1.sig, "whereAsk");
ok(K.decide(where, prefs, "where is the passport").ask, "one answer is not enough to stop asking");
prefs = K.learn(prefs, d1.sig, "whereAsk");
const d3 = K.decide(where, prefs, "where is the passport");
ok(d3.kind === "whereAsk" && d3.learned, "the same answer twice → Attune does it without asking");
ok(K.learn(prefs, d1.sig, "map")[d1.sig].n === 1, "a different answer starts counting again");
const trip = K.decide(K.guess("I'm going to Turkey"), {}, "I'm going to Turkey");
ok(trip.kind === "travel", "“I'm going to Turkey” → a trip");
K.savePrefs(prefs); ok(K.learned(K.loadPrefs(), d1.sig) === "whereAsk", "what he taught is kept");
console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);

// v6.28 How to use Attune: every tool in the app's tool list has its guide, each with 3 steps and a tip in English AND Arabic.
// v6.37: also every page of the sidebar (hubs.js), chapters in the sidebar's order, Egyptian Arabic, today's new parts, and the
// "Get the most of Attune" plan (every line points to a real tool).
import fs from "fs";
import * as G from "../../web-src/guide.js";
import { HUBS } from "../../web-src/hubs.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const src = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const MORE_TOOLS = ["), src.indexOf("];", src.indexOf("const MORE_TOOLS = [")));
const ids = [...block.matchAll(/\["([a-z]+)", "/g)].map((m) => m[1]).filter((id) => id !== "guide");
ok(ids.length >= 40, "the app lists " + ids.length + " tools");
const missing = ids.filter((id) => !G.TOOLS[id]);
ok(!missing.length, "every tool has a guide (missing: " + missing.join(", ") + ")");
const hubIds = HUBS.flatMap((h) => h[3]).filter((id) => id !== "guide");
const hubMissing = hubIds.filter((id) => !G.TOOLS[id]);
ok(!hubMissing.length, "every page in the sidebar has a guide (missing: " + hubMissing.join(", ") + ")");
const named = [...new Set([...hubIds])].filter((id) => !ids.includes(id) && !G.NAMES[id]);
ok(!named.length, "pages not in the tool list have a name in NAMES (" + named + ")");
const bad = Object.entries(G.TOOLS).filter(([, g]) => g.steps.length !== 3 || g.steps.some((s) => !s[0] || !s[1]) || !g.tip[0] || !g.tip[1]);
ok(!bad.length, "each guide: 3 steps and a tip, English and Arabic (" + bad.map((b) => b[0]) + ")");
const ar = Object.values(G.TOOLS).flatMap((g) => [...g.steps.map((s) => s[1]), g.tip[1]]).concat(G.START.flatMap((s) => [s.title[1], ...s.steps.map((x) => x[1]), s.tip[1]]))
  .concat(G.PLAN.flatMap((p) => [p.title[1], p.when[1], p.tip[1], ...p.items.map((i) => i.text[1])]), Object.values(G.NAMES).flatMap((n) => [n[0][1], n[1][1]]), [G.PLAN_TITLE[1], G.BOTTOM[1]]);
ok(ar.every((t) => /[؀-ۿ]/.test(t)), "every Arabic line is Arabic");
// Latin letters in Arabic only for names the app already writes in Latin
const LATIN_OK = /\b(Attune|Spark|Glow|Blaze|Core|Zenith|Wi-Fi|PDF|WhatsApp|Word|PowerPoint|Excel|ChatGPT|Claude|Gemini|Python|Google Play|App Store|InstaPay)\b/g;
const latin = ar.filter((t) => /[A-Za-z]/.test(t.replace(LATIN_OK, "")));
ok(!latin.length, "Arabic has no Latin words except product names: " + latin.slice(0, 3).join(" | "));
// Egyptian, not formal: the old formal words are gone, the Egyptian ones are there («اضغط» alone is the Compress tool's name)
const formal = ar.filter((t) => /اضغط(?![،»])|الهاتف|هاتفك|تريد|لا يغادر|عندما|يجب أن/.test(t));
ok(!formal.length, "Arabic is Egyptian, not formal: " + formal.slice(0, 3).join(" | "));
const all = ar.join(" ");
ok(["دوس", "الموبايل", "عايز", "النهارده", "مفيش"].every((w) => all.includes(w)), "Egyptian words are used (دوس، الموبايل، عايز، النهارده، مفيش)");
ok(G.START.length === 6 && G.START.every((s) => s.steps.length === 3), "getting started: 6 chapters of 3 steps (Engine, sidebar, Home, Chat, keyboard, backup)");
const startText = G.START.map((s) => s.steps.flat().join(" ")).join(" ");
ok(!/the All button/.test(startText) && /sidebar/.test(startText) && /Create · Projects · Home · Students · Money · Health · Daily · Work/.test(startText) && /How to use Attune/.test(startText) && /Backup/.test(startText), "getting started describes the sidebar (no 'All button')");
const sketches = new Set(["photo", "type", "list", "chart", "map", "chat", "file", "lesson", "engine"]);
ok([...Object.values(G.TOOLS), ...G.START].every((g) => sketches.has(g.sketch)), "every guide has a drawing");
// chapters: the sidebar's order
const ch = G.chapters();
ok(ch.map((c) => (Array.isArray(c.title) ? c.title[0] : c.title)).join() === "Create,Projects,Home,Students,Money,Follow-ups,Health,Daily,Go,Saved,Work,Tools,Bottom of the sidebar", "chapters follow the sidebar (v8.5: Follow-ups, Go, Saved): " + ch.map((c) => c.title));
const money = ch.find((c) => c.title === "Money");
ok(money.ids.join() === "money,deal,planner" && ch.find((c) => c.title === "Follow-ups").ids.join() === "timeline,life,family,reminders,radar,xray,guardian", "Money: Money, Deal Check; Follow-ups its own chapter: " + money.ids);
ok(ch.find((c) => c.title === "Work").ids.slice(0, 3).join() === "business,fleet,field" && ch.find((c) => c.title === "Tools").ids[0] === "tools" && !ch.flatMap((c) => c.ids).includes("guide"), "Work: Business, Team records, Reports (Crane opens from Fleet, v8.5); Tools its own chapter");
const test = G.chapters([["money", "Money", "money", ["money", "deal", "radar"]], ["health", "Health", "health", ["fit", "care"]]]);
ok(test[0].ids.join() === "money,radar,deal" && test[1].ids.join() === "fit,care" && test.length === 2, "chapters only hold what the sidebar has");
ok(G.whereOf("radar").join(" > ") === "Follow-ups > Dates" && G.whereOf("compress").join(" > ") === "Tools" && G.whereOf("fit").join() === "Health", "each guide says where the tool lives");
// today's new parts are explained in their tools
const en = (id) => G.TOOLS[id].steps.map((s) => s[0]).join(" ") + " " + G.TOOLS[id].tip[0];
const arOf = (id) => G.TOOLS[id].steps.map((s) => s[1]).join(" ") + " " + G.TOOLS[id].tip[1];
ok(/Safe to spend today/.test(en("money")) && /Keep aside/.test(en("money")) && /salary as a repeating income/.test(en("money")) && /تقدر تصرف النهارده/.test(arOf("money")), "Money: Safe to spend today, Keep aside, the salary tip");
ok(/In today's money/.test(en("deal")) && /certificate/.test(en("deal")) && /بفلوس النهارده/.test(arOf("deal")), "Deal Check: In today's money");
ok(/Who keeps their word/.test(en("xray")) && /kept, broken, late/.test(en("xray")) && /مين بيوفي بكلمته/.test(arOf("xray")), "Chat X-Ray: Who keeps their word");
ok(/Cancel kit/.test(en("radar")) && /Google Play/.test(en("radar")) && /App Store/.test(en("radar")) && /إزاي تلغي/.test(arOf("radar")), "Dates: the Cancel kit");
ok(/From a message/.test(en("business")) && /محتاج ونش 50 طن/.test(en("business")) && /Book it/.test(en("business")) && /quote/.test(en("business")) && /من رسالة/.test(arOf("business")) && /احجزه/.test(arOf("business")), "Business: Fleet & rentals From a message");
ok(/wait or buy/.test(en("scout")) && /تستنى ولا تشتري/.test(arOf("scout")), "Scout: wait or buy");
const kb = G.START.find((s) => s.id === "keyboard");
ok(kb && /3→ع Franco/.test(kb.steps.map((s) => s[0]).join(" ")) && /أنا جاي بكرة/.test(kb.steps.map((s) => s[1]).join(" ")), "the keyboard's Franco chip");
ok(G.TOOLS.missions && /chance/.test(en("missions")) && /one step|ONE step/i.test(en("missions")) && /Scout/.test(en("missions")) && /المهمة/.test(arOf("missions")), "Missions: a goal, the chance, one step today");
// the plan
ok(G.PLAN.map((p) => p.id).join() === "morning,day,evening,week,month,work", "the plan: morning, day, evening, week, month, work");
const planTools = G.PLAN.flatMap((p) => p.items.map((i) => i.tool)).filter(Boolean);
ok(planTools.every((t) => G.TOOLS[t]) && G.PLAN.every((p) => p.items.length >= 3 && p.items.every((i) => (i.tool || i.see) && i.text[0] && i.text[1]) && p.tip[0] && p.tip[1]), "every plan line points to a real tool, in English and Arabic");
ok(["home", "money", "learn", "news", "missions"].every((t) => G.PLAN[0].items.some((i) => i.tool === t)), "morning: Home, Safe to spend, the lesson, news, missions");
ok(["fit", "reminders", "chat"].every((t) => G.PLAN[1].items.some((i) => i.tool === t)) && ["scout", "guardian", "xray"].every((t) => G.PLAN[3].items.some((i) => i.tool === t)) && G.PLAN[3].items.some((i) => i.see === "start:safe"), "day: food photo, reminders, share to Chat (v8.2: no Instant); week: Scout, Payments, X-Ray, backup");
ok(["money", "radar", "deal"].every((t) => G.PLAN[4].items.some((i) => i.tool === t)) && ["business", "field"].every((t) => G.PLAN[5].items.some((i) => i.tool === t)) && !G.PLAN[5].items.some((i) => i.tool === "crane"), "month: Money, Cancel kit, Deal Check; work: Business from WhatsApp, Reports (the Crane toolkit lives inside Business)");
ok(G.searchPlan("koshary").join() === "day" && G.searchPlan("").length === 6 && !G.searchPlan("zzqx").length, "the plan is searchable");
// search
ok(G.searchGuide("passport", []).sort().join() === "radar,travel" && G.searchGuide("", []) === null, "search finds by what the steps say");
ok(G.searchGuide("insulin", []).includes("care") && G.searchGuide("insulin", []).includes("fit"), "'insulin' finds Family health and Fit & Food");
ok(G.searchGuide("franco", []).length === 0 && G.searchGuide("ونش", []).includes("business"), "Arabic search finds Fleet & rentals by «ونش»");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");

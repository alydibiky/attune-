// v6.36: Ali's own arrangement (board, 18 Oct): Create · Projects · Home · Students · Money · Health · Daily · Work in the sidebar.
import { HUBS, GROUPS, hubOf, tabsFor, TOOL_PAGES, toolPages, partsOf, INSIDE, FULL, RETIRED } from "../../web-src/hubs.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
ok(HUBS.map((h) => h[1]).join() === "Create,Projects,Home,Students,Money,Follow-ups,Health,Daily,Go,My things,Work,Tools", "v8.5 (Ali agreed to the 27 Oct review): Follow-ups, Go and Saved are places (" + HUBS.map((h) => h[1]) + ")");
const all = HUBS.flatMap((h) => h[3]);
ok(new Set(all).size === all.length, "every page lives in exactly one place");
ok(hubOf("guardian") === "followups" && hubOf("fit") === "health" && hubOf("humanize") === "toolbox" && hubOf("convert") === "toolbox" && hubOf("assistants") === "create"
  && hubOf("scout") === "go" && hubOf("map") === "go" && hubOf("chat") === "home" && hubOf("pdfchat") === "saved" && hubOf("remember") === "saved" && hubOf("studio") === "create", "pages find their place");
// v9.2: archived (Studio, Code) and folded (Assistants, Skills, Artifacts → a project) pages are never tabs
ok(tabsFor("studio").length === 0 && tabsFor("assistants").length === 0, "v9.2: Create has no tab row — Studio / Code archived, Assistants · Skills · Artifacts live in a project");
ok(tabsFor("chat").length === 0 && tabsFor("translate").length === 0, "v7.6 (Ali): no Chat · Your life · Translate tab row — they are pills in Home's box");
ok(tabsFor("home").length === 0 && tabsFor("shelf").join() === "shelf,booklib,people,memory" && tabsFor("projects").length === 0, "Home, Projects: no tab row; Saved = Notes · Library · Mind (W2, v8.7 4B)");
ok(tabsFor("coach").join() === "coach,slides,cv" && partsOf("pdfchat").join() === "booklib,pdfchat,remember" && partsOf("remember").join() === "booklib,pdfchat,remember" && tabsFor("convert").length === 0, "v8.5 (W3): Students = Homework · Documents (Many books · One file) · Slides · CV; Convert lives in Tools");
ok(RETIRED.join() === "instant,ask" && RETIRED.every((m) => !HUBS.some((h) => h[3].includes(m)) && !GROUPS.some((g) => g[2].includes(m))), "v8.2 (Ali): Instant and Ask (classic) are in no place and no group");
ok(tabsFor("money").join() === "money,planner" && tabsFor("timeline").length === 0, "v9.2: Money = Money · Month plan (Deal Check is archived into the Guardian); Follow-ups has no tab row (" + tabsFor("money") + ")");
ok(partsOf("radar").join() === "timeline,life,family,reminders,radar,xray,guardian" && partsOf("money").length === 0 && partsOf("guardian")[0] === "timeline", "Follow-ups (v8.2, 1A): All (one list) · People & plans · Reminders · Dates · Chat X-Ray · Guardian");
ok(tabsFor("reminders").length === 0, "E2: no switch or tabs on Follow-ups' parts (a back chip instead)");
ok(tabsFor("fit").length === 0 && tabsFor("care").length === 0, "v9.2: Fit & Food, Cycle and the Health page are archived (→ Attune Fit) — no Health tab row");
ok(tabsFor("travel").length === 0 && tabsFor("news").length === 0, "v9.2: Scout (folded into Agents), Maps, Metro and Learn are archived — Go and Daily have no tab row");
ok(hubOf("metro") === "go", "Metro still belongs to Go (its page is archived; Chat answers metro questions)");
ok(tabsFor("slides", ["slides"]).length === 0 && tabsFor("slides").join() === "slides,cv", "a tool the device hides is not a tab (and Homework Coach, archived, is not one either)");
ok(tabsFor("business").length === 0 && tabsFor("tools").length === 0, "v9.2: Business is archived (→ Attune Business) — no Work tab row; Tools is its own page");
const inTools = TOOL_PAGES.flatMap((p) => p[3]);
ok(inTools.join() === "write,improve,compress,humanize,copilot,library,video" && inTools.every((m) => hubOf(m) === "toolbox") && tabsFor("video").length === 0, "Tools = choices: Writing, Video (no Ask classic)");
// v9.2 (Ali, 4 Nov: "Writing opens, then when you press anything in it, it redirects to Home"): its Copilot / Prompt lab tabs opened archived pages
ok(tabsFor("write").length === 0 && ["improve", "compress", "humanize"].every((m) => tabsFor(m).length === 0), "v9.2: Writing has no tab row — Copilot and Prompt lab are archived, so no tab can land on Home");
ok(toolPages(["write", "video"]).map((p) => p[0]).join() === "write,video", "a device without a tool doesn't show its card");
ok(hubOf("guide") === "tools" && tabsFor("guide").length === 0 && tabsFor("privacy").length === 0, "How to use + Privacy: at the bottom of the sidebar, no tab row");
ok(GROUPS.every((g) => g[2].length >= 1) && FULL.includes("home"), "groups are well formed");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");

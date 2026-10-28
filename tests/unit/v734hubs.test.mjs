// v6.36: Ali's own arrangement (board, 18 Oct): Create · Projects · Home · Students · Money · Health · Daily · Work in the sidebar.
import { HUBS, GROUPS, hubOf, tabsFor, TOOL_PAGES, toolPages, partsOf, INSIDE, FULL, RETIRED } from "../../web-src/hubs.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
ok(HUBS.map((h) => h[1]).join() === "Create,Projects,Home,Students,Money,Follow-ups,Health,Daily,Go,Saved,Work,Tools", "v8.5 (Ali agreed to the 27 Oct review): Follow-ups, Go and Saved are places (" + HUBS.map((h) => h[1]) + ")");
const all = HUBS.flatMap((h) => h[3]);
ok(new Set(all).size === all.length, "every page lives in exactly one place");
ok(hubOf("guardian") === "followups" && hubOf("fit") === "health" && hubOf("humanize") === "toolbox" && hubOf("convert") === "toolbox" && hubOf("assistants") === "create"
  && hubOf("scout") === "go" && hubOf("map") === "go" && hubOf("chat") === "home" && hubOf("pdfchat") === "students" && hubOf("studio") === "create", "pages find their place");
ok(tabsFor("studio").join() === "assistants,skills,artifacts,studio,code", "Create: Assistants · Skills · Artifacts · Studio · Code");
ok(tabsFor("chat").length === 0 && tabsFor("translate").length === 0, "v7.6 (Ali): no Chat · Your life · Translate tab row — they are pills in Home's box");
ok(tabsFor("home").length === 0 && tabsFor("shelf").join() === "shelf,remember,memory" && tabsFor("projects").length === 0, "Home, Projects: no tab row; Saved = Notes · Books & pages · Mind (W2)");
ok(tabsFor("coach").join() === "coach,booklib,slides,cv" && partsOf("pdfchat").join() === "booklib,pdfchat" && tabsFor("convert").length === 0, "v8.5 (W3): Students = Homework · Documents (Many books · One file) · Slides · CV; Convert lives in Tools");
ok(RETIRED.join() === "instant,ask" && RETIRED.every((m) => !HUBS.some((h) => h[3].includes(m)) && !GROUPS.some((g) => g[2].includes(m))), "v8.2 (Ali): Instant and Ask (classic) are in no place and no group");
ok(tabsFor("money").join() === "money,planner,deal" && tabsFor("timeline").length === 0, "v8.5 (W1): Money = Money · Deal Check; Follow-ups is its own place with no tab row (" + tabsFor("money") + ")");
ok(partsOf("radar").join() === "timeline,life,family,reminders,radar,xray,guardian" && partsOf("money").length === 0 && partsOf("guardian")[0] === "timeline", "Follow-ups (v8.2, 1A): All (one list) · People & plans · Reminders · Dates · Chat X-Ray · Guardian");
ok(tabsFor("reminders").length === 0, "E2: no switch or tabs on Follow-ups' parts (a back chip instead)");
ok(tabsFor("fit").length === 0 && tabsFor("health").join() === "health,fit,care,cycle", "Health: Health · Fit & Food · Family · Cycle; Fit is full-screen");
ok(tabsFor("scout").join() === "travel,scout,map,metro" && tabsFor("learn").join() === "learn,news", "v8.5 (E1): Daily = Learn · News; Go = Travel · Scout · Maps · Metro");
ok(tabsFor("metro").join() === tabsFor("scout").join() && hubOf("metro") === "go", "Metro is in Go, next to Maps");
ok(tabsFor("slides", ["coach", "slides"]).join() === "coach,slides", "a tool the device hides is not a tab");
ok(tabsFor("business").join() === "business,fleet,field" && tabsFor("tools").length === 0, "Work: Business · Team records · Reports; Tools is its own page now (v8.2)");
const inTools = TOOL_PAGES.flatMap((p) => p[3]);
ok(inTools.join() === "write,improve,compress,humanize,copilot,library,video" && inTools.every((m) => hubOf(m) === "toolbox") && tabsFor("video").length === 0, "Tools = choices: Writing, Video (no Ask classic)");
ok(["write", "copilot", "library"].every((m) => tabsFor(m).join() === "write,copilot,library") && ["improve", "compress", "humanize"].every((m) => tabsFor(m).length === 0), "v8.5 (E3): Writing = one box · Copilot · Prompt lab; Improve / Shorten / Humanize open from the box");
ok(toolPages(["write", "video"]).map((p) => p[0]).join() === "write,video", "a device without a tool doesn't show its card");
ok(hubOf("guide") === "tools" && tabsFor("guide").length === 0 && tabsFor("privacy").length === 0, "How to use + Privacy: at the bottom of the sidebar, no tab row");
ok(GROUPS.every((g) => g[2].length >= 1) && FULL.includes("home"), "groups are well formed");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");

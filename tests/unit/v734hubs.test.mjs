// v6.36: Ali's own arrangement (board, 18 Oct): Create · Projects · Home · Students · Money · Health · Daily · Work in the sidebar.
import { HUBS, GROUPS, hubOf, tabsFor, TOOL_PAGES, toolPages, partsOf, INSIDE, FULL, RETIRED } from "../../web-src/hubs.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
ok(HUBS.map((h) => h[1]).join() === "Create,Projects,Home,Students,Money,Health,Daily,Work,Tools", "v8.2 (Ali, 26 Oct): Tools is its own place; the sidebar is Ali's order (" + HUBS.map((h) => h[1]) + ")");
const all = HUBS.flatMap((h) => h[3]);
ok(new Set(all).size === all.length, "every page lives in exactly one place");
ok(hubOf("guardian") === "money" && hubOf("fit") === "health" && hubOf("humanize") === "toolbox" && hubOf("convert") === "toolbox" && hubOf("assistants") === "create"
  && hubOf("scout") === "learn" && hubOf("map") === "learn" && hubOf("chat") === "home" && hubOf("pdfchat") === "students" && hubOf("studio") === "create", "pages find their place");
ok(tabsFor("studio").join() === "assistants,skills,artifacts,studio,code", "Create: Assistants · Skills · Artifacts · Studio · Code");
ok(tabsFor("chat").length === 0 && tabsFor("translate").length === 0, "v7.6 (Ali): no Chat · Your life · Translate tab row — they are pills in Home's box");
ok(tabsFor("home").length === 0 && tabsFor("shelf").length === 0 && tabsFor("projects").length === 0, "Home, Shelf, Projects: no tab row");
ok(tabsFor("coach").join() === "coach,pdfchat,slides,cv" && tabsFor("convert").length === 0, "v8.2 (Ali: Convert was in two places): Students = Homework · Doc chat · Slides · CV; Convert lives in Tools");
ok(RETIRED.join() === "instant,ask" && RETIRED.every((m) => !HUBS.some((h) => h[3].includes(m)) && !GROUPS.some((g) => g[2].includes(m))), "v8.2 (Ali): Instant and Ask (classic) are in no place and no group");
ok(tabsFor("money").join() === "money,life,guardian,deal", "Money (v7.2, Gemini's Area 1): Money · Follow-ups · Guardian · Deal Check (" + tabsFor("money") + ")");
ok(partsOf("radar").join() === "life,reminders,timeline,radar,xray" && partsOf("money").length === 0 && partsOf("guardian").length === 0, "Follow-ups switch (v7.2): People & plans · Reminders · Timeline · Dates · Chat X-Ray; the Guardian is its own tab");
ok(tabsFor("reminders", ["money", "reminders"]).includes("reminders"), "without the others, Follow-ups stays a tab");
ok(tabsFor("fit").length === 0 && tabsFor("health").join() === "health,fit,care,cycle", "Health: Health · Fit & Food · Family · Cycle; Fit is full-screen");
ok(tabsFor("scout").join() === "learn,scout,memory,remember,news,map,metro,travel,knowledge", "Daily: Learn · Scout · Mind · Remember · News · Maps · Metro · Travel (+ Knowledge for Ali)");
ok(tabsFor("metro").join() === tabsFor("scout").join() && hubOf("metro") === "learn", "v6.42: Metro is the tab next to Maps");
ok(tabsFor("pdfchat", ["coach", "pdfchat"]).join() === "coach,pdfchat", "a tool the device hides is not a tab");
ok(tabsFor("business").join() === "business,fleet,field" && tabsFor("tools").length === 0, "Work: Business · Team records · Reports; Tools is its own page now (v8.2)");
const inTools = TOOL_PAGES.flatMap((p) => p[3]);
ok(inTools.join() === "improve,compress,humanize,copilot,library,video" && inTools.every((m) => hubOf(m) === "toolbox") && tabsFor("video").length === 0, "Tools = choices: Writing, Video (no Ask classic)");
ok(["improve", "compress", "humanize", "copilot", "library"].every((m) => tabsFor(m).join() === "improve,compress,humanize,copilot,library"), "v6.43: Writing is one page — Improve · Shorten · Humanize · Copilot · Prompt lab as its tabs");
ok(toolPages(["improve", "video"]).map((p) => p[0]).join() === "improve,video", "a device without a tool doesn't show its card");
ok(hubOf("guide") === "tools" && tabsFor("guide").length === 0 && tabsFor("privacy").length === 0, "How to use + Privacy: at the bottom of the sidebar, no tab row");
ok(GROUPS.every((g) => g[2].length >= 1) && FULL.includes("home"), "groups are well formed");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");

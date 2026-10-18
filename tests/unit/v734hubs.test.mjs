// v6.36: Ali's own arrangement (board, 18 Oct): Create · Projects · Home · Students · Money · Health · Daily · Work in the sidebar.
import { HUBS, GROUPS, hubOf, tabsFor, TOOL_PAGES, toolPages, partsOf, INSIDE, FULL } from "../../web-src/hubs.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
ok(HUBS.map((h) => h[1]).join() === "Create,Projects,Home,Students,Money,Health,Daily,Work", "the sidebar is Ali's order (" + HUBS.map((h) => h[1]) + ")");
const all = HUBS.flatMap((h) => h[3]);
ok(new Set(all).size === all.length, "every page lives in exactly one place");
ok(hubOf("guardian") === "money" && hubOf("fit") === "health" && hubOf("humanize") === "tools" && hubOf("assistants") === "create"
  && hubOf("scout") === "learn" && hubOf("map") === "learn" && hubOf("chat") === "home" && hubOf("pdfchat") === "students" && hubOf("studio") === "create", "pages find their place");
ok(tabsFor("studio").join() === "assistants,skills,artifacts,studio,code", "Create: Assistants · Skills · Artifacts · Studio · Code");
ok(tabsFor("chat").join() === "chat,lifeask,translate", "Home's Chat has Ask your life and Translate as tabs");
ok(tabsFor("home").length === 0 && tabsFor("instant").length === 0 && tabsFor("shelf").length === 0 && tabsFor("projects").length === 0, "Home, Instant, Shelf, Projects: no tab row");
ok(tabsFor("coach").join() === "coach,convert,pdfchat,slides,cv", "Students: Homework · Convert · Doc chat · Slides · CV");
ok(tabsFor("money").join() === "money,reminders,deal", "Money: Money · Follow-ups · Deal Check (" + tabsFor("money") + ")");
ok(partsOf("radar").join() === "reminders,radar,life,xray,guardian" && partsOf("money").length === 0, "Follow-ups switch: Reminders · Dates · People & plans · Chat X-Ray · Payments");
ok(tabsFor("reminders", ["money", "reminders"]).includes("reminders"), "without the others, Follow-ups stays a tab");
ok(tabsFor("fit").length === 0 && tabsFor("health").join() === "health,fit,care,cycle", "Health: Health · Fit & Food · Family · Cycle; Fit is full-screen");
ok(tabsFor("scout").join() === "learn,scout,memory,news,map,travel,knowledge", "Daily: Learn · Scout · Mind · News · Maps · Travel (+ Knowledge for Ali)");
ok(tabsFor("convert", ["convert", "pdfchat"]).join() === "convert,pdfchat", "a tool the device hides is not a tab");
ok(tabsFor("business").join() === "business,fleet,crane,field,tools", "Work: Business · Fleet · Crane · Reports · Tools");
const inTools = TOOL_PAGES.flatMap((p) => p[3]);
ok(inTools.join() === "improve,compress,humanize,copilot,library,video,ask" && inTools.every((m) => hubOf(m) === "tools" && tabsFor(m).length === 0), "Tools = choices (not tabs): Improve, Compress, Humanize, Copilot, Library, Video, Ask");
ok(toolPages(["improve", "video"]).map((p) => p[0]).join() === "improve,video", "a device without a tool doesn't show its card");
ok(hubOf("guide") === "tools" && tabsFor("guide").length === 0 && tabsFor("privacy").length === 0, "How to use + Privacy: at the bottom of the sidebar, no tab row");
ok(GROUPS.every((g) => g[2].length >= 1) && FULL.includes("home"), "groups are well formed");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");

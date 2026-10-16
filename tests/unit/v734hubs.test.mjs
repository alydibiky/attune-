// v6.30: 6 places in the sidebar; tools that belong together are one page with tabs.
import { HUBS, GROUPS, hubOf, tabsFor } from "../../web-src/hubs.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
ok(HUBS.length <= 6, "no more than 6 places in the sidebar (" + HUBS.length + ")");
const all = HUBS.flatMap((h) => h[3]);
ok(new Set(all).size === all.length, "every page lives in exactly one place");
ok(hubOf("guardian") === "money" && hubOf("fit") === "health" && hubOf("humanize") === "tools" && hubOf("assistants") === "chat", "pages find their place");
const t = tabsFor("humanize");
ok(t.join() === "code,improve,compress,humanize,copilot,library,ask" && !t.includes("studio"), "Create: Code · Improve · Compress · Humanize · Copilot · Library · Ask on one page; Studio stays its own");
ok(tabsFor("studio").length === 0, "Studio has no tab row");
ok(tabsFor("radar").includes("money") && tabsFor("radar").includes("scout"), "Money's tools are tabs of one page");
ok(tabsFor("home").length === 0 && tabsFor("fit").length === 0, "full-screen pages have no tab row");
ok(tabsFor("convert", ["convert", "translate"]).join() === "convert,translate", "a tool the device hides is not a tab");
ok(GROUPS.every((g) => g[2].every((m) => hubOf(m) === "tools")), "the groups inside Tools are all in Tools");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");

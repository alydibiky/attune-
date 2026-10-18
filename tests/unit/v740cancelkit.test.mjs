// v6.37 M5: the cancel kit — where, the steps, a ready message.
import { cancelKit } from "../../web-src/deadlines.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const n = cancelKit({ kind: "renewal", title: "Netflix", date: "2026-11-02", amount: 240, currency: "EGP" });
ok(n.way === "web" && /netflix/.test(n.link.url) && n.steps.length === 4, "Netflix: its account page and the steps");
ok(n.message.includes("Netflix") && n.message.includes("2026-11-02") && n.message.includes("240 EGP"), "the message names it, the date and the amount");
const p = cancelKit({ kind: "trial", title: "Calm", date: "2026-10-20", app: "Google Play" }, "ar");
ok(p.way === "play" && p.steps[1].includes("الاشتراكات") && p.message.includes("Calm"), "a Google Play trial: the Play Store steps, in Egyptian Arabic");
const g = cancelKit({ kind: "renewal", title: "Gold's Gym Maadi", date: "2026-12-01" });
ok(g.way === "ask" && g.link === null && /in writing/.test(g.message), "a gym: no page, so the message to send");
ok(cancelKit({ kind: "warranty", title: "TV" }) === null, "a warranty has no cancel kit");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");

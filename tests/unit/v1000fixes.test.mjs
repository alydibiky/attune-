// v8.0 — Ali's 25 Oct list: Studio paused on phones, and better slides (titles from the topic, points that answer their title).
import * as S from "../../web-src/slides.js";
import { studioPaused, groupsFor, LEVELS } from "../../web-src/device.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
// ---- Studio ----
ok(studioPaused({}) && !studioPaused({ desktop: true }) && !studioPaused(null), "Studio is paused in the phone app only (not the computer app, not a browser)");
const g = groupsFor([["Create", ["studio", "code"]]], LEVELS[4], true, ["studio"]);
ok(g[0][1].join() === "code", "a paused tool stays out even with “Show every tool”");
// ---- slides: the plan ----
const om = S.outlineMessages({ topic: "Digital & Social Media Marketing", n: 8, lang: "en", source: "" })[0].content;
ok(/AIDA/.test(om) && /\[two\] or \[table\]/.test(om), "the plan prompt forbids bare framework stages and asks for a comparison when the topic sets two things side by side");
ok(S.parseOutline("1. Attract Attention\n2. Generate Interest\n3. Create Desire\n4. Inspire Action", 4).slides.some((s) => s.kind !== "bullets"), "a 4-slide deck is not four Key points slides in a row");
// ---- slides: one slide ----
const sm = S.slideMessages({ deckTitle: "Digital & Social Media Marketing", topic: "t", slide: { kind: "bullets", title: "Generate Interest" }, i: 4, n: 8, others: [], lang: "en", source: "[1] page" })[0].content;
ok(/every point answers the title "Generate Interest"/.test(sm) && /well established/.test(sm), "the slide prompt: every point answers its title; general knowledge where the sources are silent (numbers still only from them)");
const sl = { kind: "bullets", title: "Generate Interest", bullets: [{ lead: "", text: "Digital & Social Media Marketing" }, { lead: "Generate Interest Now", text: "Useful posts and email bring people back to learn more." }, { lead: "Retargeting", text: "Ads follow visitors who left without buying." }] };
const td = S.tidySlide(sl, "", [], "Digital & Social Media Marketing").slide;
ok(td.bullets.length === 2 && td.bullets[0].lead === "" && td.bullets[1].lead === "Retargeting", "a point that is only the deck's title goes; a lead that repeats the slide's title goes");
const rep = S.tidySlide({ kind: "bullets", title: "Define the scope", bullets: [{ lead: "Scope", text: "Digital marketing uses websites, search engines, emails and apps, while social media marketing focuses on platforms like Facebook." }, { lead: "Budget", text: "Set a monthly cap per channel before you start." }] }, "", ["Umbrella Concept: Digital marketing spans websites, search, email and apps, whereas social media marketing focuses on specific platforms like Facebook and Instagram."]);
ok(rep.repeats === 1 && rep.slide.bullets.length === 1, "the same point reworded on a later slide counts as a repeat");
console.log(fail ? "FAILED " + fail : "ALL PASSED");

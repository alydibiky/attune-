// v9.9.37 BR-4 the Attune brain: the 10,000 generator on a 2,500 sample (and proof it catches a planted bug), Ali's own examples, wiring.
import { execFileSync } from "child_process";
import fs from "fs";
const F = await import("../../web-src/lifefacts.js");
const { progressOf } = await import("../../web-src/life.js");
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const out = execFileSync("node", [new URL("../brain/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
ok(/2500 people, 2500 right/.test(out), "2,500 generated people all right: " + out.split("\n")[0]);
const NOW = Date.parse("2026-11-14T10:00:00"), DAY = 864e5;
const s = { ledger: { currency: "EGP", txns: [{ type: "expense", amount: 1040, cat: "food", date: "2026-11-10" }, { type: "expense", amount: 300, cat: "transport", date: "2026-11-12" }, { type: "income", amount: 18500, date: "2026-11-01" }, { type: "expense", amount: 1000, cat: "food", date: "2026-10-05" }] },
  life: { items: [{ id: "sh", kind: "installment", dir: "in", person: "Sheikh", amount: 2500, count: 8, total: 20000, every: "month", start: "2026-07-01", paid: [] }] },
  radar: { items: [{ id: "cl", title: "Car licence", date: "2026-12-04", status: "active" }] },
  notes: [{ id: "m1", ts: NOW - 3600e3, title: "Mona", app: "WhatsApp", text: "Can you send me your ID photo before Friday?" }], minds: { m1: { action: "do", who: "Mona" } },
  agents: { agents: [{ id: "fc", on: true, what: "Huawei FreeClip 2", below: 8400, best3: [{ price: 7999, site: "B.TECH" }, { price: 8150, site: "noon" }] }] }, bills: [{ label: "Electricity", status: "high", pct: 12, thisMonth: 612, usual: 545 }] };
const all = F.facts(s, {}, { now: NOW, progress: progressOf }), t = (id) => all.find((f) => f.id.startsWith(id));
ok(t("money:month") && t("money:month").nums.spent === 1340 && t("money:month").nums.pct === 34, "this month: 1,340 spent, 34% more than last month by the 14th (1,000)");
ok(t("money:top") && t("money:top").nums.cat === "food", "most of it went on food");
ok(t("people:sh") && /owes you/.test(t("people:sh").T[0]), "Sheikh still owes you (instalments)");
ok(t("paper:cl") && t("paper:cl").nums.days === 20, "the car licence ends in 20 days");
ok(t("msg:m1") && /asked you/.test(t("msg:m1").T[0]), "Mona asked you for the ID photo");
ok(t("agent:fc") && t("agent:fc").nums.price === 7999, "FreeClip 2: the best is 7,999 at B.TECH");
ok(t("bill:Electricity"), "electricity is 12% above usual");
ok(F.BRAIN_ASK.test("how am I doing this month?") && F.BRAIN_ASK.test("أخباري إيه؟") && !F.BRAIN_ASK.test("how do I renew my passport?"), "“how am I doing?” / «أخباري إيه؟» is the brain's question; “how do I…?” is not");
ok(F.weeklyDue(Date.parse("2026-11-15T10:00:00"), "") && F.weeklyDue(Date.parse("2026-11-16T10:00:00"), "") && !F.weeklyDue(Date.parse("2026-11-16T10:00:00"), "2026-11-15") && !F.weeklyDue(Date.parse("2026-11-17T10:00:00"), ""), "Sunday card: Sunday, or Monday if missed; once");
const src = (f) => fs.readFileSync(new URL("../../web-src/" + f, import.meta.url), "utf8");
ok(/brainAnswer\(typed\)/.test(src("chat.jsx")) && /\.\.\.brainKnown\(q\)/.test(src("attune.jsx")), "Chat answers from the brain, and every question to the AI carries what it knows");
ok(/proGate\("brain"/.test(src("brain-ui.jsx")) && /allowed\("brain"\)/.test(src("brain-ui.jsx")) && /"brain"/.test(src("plan.js")), "the brain is Pro (Free keeps the morning card)");
ok(/mode === "brain"/.test(src("attune.jsx")) && /side-brain/.test(src("side-ui.jsx")) && /<BrainHome/.test(src("home-ui.jsx")), "the page, the side menu entry and the Home row");
// "Not right" on a fact about a person hides the other facts about them too (found by e2e_v9937brain: Attune noticed still said 19,500)
{ const list = [{ id: "people:sh", person: "Sheikh", T: ["{p} still owes you {l}.", { p: "Sheikh", l: "19,500" }] }, { id: "noticed:owed:sh", text: "Sheikh has owed you 19,500 for 6 weeks" }, { id: "money:month:x", text: "This month: 900 spent" }];
  const rel = F.sameSubject(list[0], list, (x) => x.text || ""), m = F.correct({}, "people:sh", "Sheikh paid 5,000", 1, rel);
  ok(rel.join() === "noticed:owed:sh" && m.forgot["noticed:owed:sh"] && !m.forgot["money:month:x"], "a correction about Sheikh hides the other Sheikh facts, nothing else"); }

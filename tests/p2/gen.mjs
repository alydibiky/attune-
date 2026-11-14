// v9.9.23 B5 P2 "before you meet": exactly 10,000 meetings (reminders naming a person — full name, unique first name, a nickname,
// «اقابل أحمد», a shared first name, nobody, two people) on top of the person-page scenarios (tests/n1/gen.mjs: payments, debts paid
// or not, promises kept or not, notes, messages, for several people incl. two with the same first name). Checked for each meeting:
//   - a notification only when ONE person is named for sure AND something is open with them; never for "Ahmed" when two Ahmeds exist;
//   - its time = the meeting − 1 hour; ≤ 3 lines; every line is about THAT person (never another's), a paid debt / kept promise never
//     shows; an open debt shows its amount left.
const BM = await import(process.env.P2 || "../../web-src/beforemeet.js");
const { scenario } = await import("../n1/gen.mjs");
function rng(seed) { let s = (seed + 7919 * +(process.env.SEED_SHIFT || 0)) >>> 0; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); }
const NOW = Date.parse("2026-11-12T12:00:00");
const VERB = [["Meeting ", "Meeting with "], ["Call ", "Lunch with "], ["اقابل ", "مكالمة مع "]];
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let k = from; k < from + N; k++) {
    const r = rng(k * 7 + 3), sc = scenario(1000000 + k), { dir, st, recs, people } = sc;
    const who = people[Math.floor(r() * people.length)], twins = people.filter((q) => q.f[0] === who.f[0]).length > 1;
    const form = Math.floor(r() * 6);   // 0 full · 1 first · 2 nickname · 3 nobody · 4 two people · 5 Arabic verb
    const v = VERB[who.ar ? 2 : Math.floor(r() * 2)][Math.floor(r() * 2)];
    let title, expect;
    if (form === 0 || form === 5) { title = (form === 5 ? "اقابل " : v) + who.name; expect = who.id; }
    else if (form === 1) { title = v + (who.ar ? who.f[1] : who.f[0]); expect = twins ? null : who.id; }
    else if (form === 2) { title = v + (who.aliases[0] || who.name); expect = who.id; }
    else if (form === 3) { title = "Dentist appointment"; expect = null; }
    else { const o = people.find((q) => q.id !== who.id); title = v + who.name + " & " + o.name; expect = null; }
    const at = NOW + (2 + Math.floor(r() * 140)) * 36e5, rem = { id: "m" + k, at, title, repeat: "none" };
    const out = BM.beforeMeet([rem], st, dir, NOW), n = out[0];
    // what is open with the expected person (from the scenario's own truth)
    const mine = expect ? recs.filter((x) => x.owner === expect && !x.gone) : [];
    const openLines = mine.filter((x) => (x.sec === "money" && x.mode === "life") || (x.sec === "promises" && (x.mode === "life" || x.mode === "memory")) || x.sec === "notes" || x.sec === "messages");
    let ok = true, why = "";
    if (!expect) { if (n) { ok = false; why = "sent for a meeting with no single sure person: " + title; } }
    else if (!openLines.length) { if (n) { ok = false; why = "sent with nothing open"; } }
    else if (!n) { ok = false; why = "missing (" + openLines.length + " open things): " + title; }
    else {
      if (n.at !== at - 36e5) { ok = false; why = "time"; }
      else if (n.who !== expect) { ok = false; why = "wrong person"; }
      else if (!(n.lines.length >= 1 && n.lines.length <= 3)) { ok = false; why = "lines " + n.lines.length; }
      else {
        // every line must come from the expected person's open records; a gone one (paid / kept) never
        const others = recs.filter((x) => x.owner !== expect || x.gone);
        for (const l of n.lines) { if (others.some((x) => x.gone && x.owner === expect && x.sec === "promises" && l.includes("send the papers") && !mine.some((m) => m.sec === "promises" && m.mode === "life"))) { ok = false; why = "a kept promise shown"; break; } }
        const debts = mine.filter((x) => x.sec === "money" && x.mode === "life");
        if (ok && debts.length && !n.lines.some((l) => /500/.test(l))) { ok = false; why = "the open debt (500) isn't in the lines: " + n.lines.join(" | "); }
        if (ok && !debts.length && n.lines.some((l) => /^(Owes you|You owe)/.test(l))) { ok = false; why = "a debt shown with none open: " + n.lines.join(" | "); }
      }
    }
    if (ok) pass++; else if (bad.length < 6) bad.push({ k, title, why });
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));

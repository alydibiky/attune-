// v9.9.25 B7 TR2 the flight day: exactly 10,000 flight days — airlines (EgyptAir, Saudia, flynas, flyadeal, Air Arabia, Emirates),
// international and domestic routes in the 30 countries, a travel time to the airport, and the day's messages: the airline's own (gate,
// boarding, a delay — sometimes past midnight, "check-in open", "you are checked in", in English or Arabic, from the airline's app or
// naming the flight) and lookalikes from anyone else ("gate changed to B2" from an unknown number, a friend's message). Checked: the
// leave-home time (3 h international / 2 h domestic + travel), check-in 24 h before (or the airline's "open"), the gate / boarding /
// delay ONLY from the airline, a delay past midnight on the next day, the steps done as the clock passes them.
const F = await import(process.env.TR2 || "../../web-src/flightday.js");
function rng(seed) { let s = (seed + 7919 * +(process.env.SEED_SHIFT || 0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const AIR = [["EgyptAir", "MS", "مصر للطيران"], ["Saudia", "SV", "السعودية"], ["flynas", "XY", "طيران ناس"], ["flyadeal", "F3", "طيران أديل"], ["Air Arabia", "G9", "العربية للطيران"], ["Emirates", "EK", "طيران الإمارات"]];
const ROUTES = [["CAI", "JED", 0], ["CAI", "HRG", 1], ["JED", "RUH", 1], ["RUH", "DXB", 0], ["CAI", "IST", 0], ["DXB", "AUH", 1], ["JED", "MED", 1], ["CAI", "LXR", 1], ["KWI", "CAI", 0], ["AMM", "JED", 0]];
const pad = (n) => String(n).padStart(2, "0");
const T = (date, hmv) => Date.parse(date + "T" + hmv + ":00");
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const r = rng(i * 7 + 5), pick = (a) => a[Math.floor(r() * a.length)];
    const [an, pfx, aar] = pick(AIR), [a, b, dom] = pick(ROUTES), no = pfx + (100 + Math.floor(r() * 899));
    const date = "2027-0" + (1 + Math.floor(r() * 9)) + "-" + pad(1 + Math.floor(r() * 27)), h = 4 + Math.floor(r() * 19), m = [0, 15, 30, 45, 5][Math.floor(r() * 5)], time = pad(h) + ":" + pad(m);
    const f = { no, airline: an, from: a, to: b, date, time }, dep0 = T(date, time), travel = [20, 45, 60, 90][Math.floor(r() * 4)], ar = r() < 0.4;
    const msgs = []; let gate = "", boarding = "", depart = time, ckIn = false, ckOpen = null;
    const own = () => (r() < 0.6 ? { from: pick([an, aar]) } : { from: "SMS +" + Math.floor(1e9 * r()), naming: true });
    const say = (en, arx) => { const o = own(); msgs.push({ from: o.from, ts: dep0 - Math.floor(r() * 30) * 36e5 / 10, text: (o.naming ? (ar ? "رحلة " + no + ": " : "Flight " + no + ": ") : "") + (ar ? arx : en) }); };
    if (r() < 0.6) { gate = pick(["A", "B", "C", "F", ""]) + (1 + Math.floor(r() * 40)); say("Gate changed to " + gate, "البوابة الجديدة " + gate); }
    if (r() < 0.5) { const bt = new Date(dep0 - (30 + Math.floor(r() * 30)) * 6e4); boarding = pad(bt.getHours()) + ":" + pad(bt.getMinutes()); say("Boarding starts at " + boarding, "الصعود يبدأ الساعة " + boarding); }
    if (r() < 0.3) { const dt = new Date(dep0 + (30 + Math.floor(r() * 300)) * 6e4); depart = pad(dt.getHours()) + ":" + pad(dt.getMinutes()); say("Your flight is delayed. New departure time " + depart, "تأخير الرحلة، موعد الإقلاع الجديد " + depart); }
    if (r() < 0.3) { ckOpen = dep0 - 30 * 36e5; msgs.push({ from: an, ts: ckOpen, text: ar ? "تسجيل الوصول متاح الآن لرحلتك" : "Online check-in is now open for your flight" }); }
    if (r() < 0.4) { ckIn = true; say("You are checked in. Your boarding pass is ready", "تم تسجيل الوصول، بطاقة الصعود جاهزة"); }
    // lookalikes that must be ignored: another sender, not naming the flight
    if (r() < 0.5) msgs.push({ from: pick(["+201001234567", "Ahmed", "Vodafone"]), ts: dep0 - 2 * 36e5, text: pick(["Gate changed to Z99", "New departure time 23:59", "البوابة الجديدة Z99", "Boarding starts at 00:01"]) });
    const now = dep0 - Math.floor(r() * 30 * 60) * 6e4;
    const d = F.flightDay(f, { now, travelMin: travel, messages: msgs }), why = [];
    let departAt = T(date, depart); if (departAt < dep0 - 6 * 36e5) departAt += 864e5;
    const leave = departAt - (dom ? 2 : 3) * 36e5 - travel * 6e4;
    if (d.departAt !== departAt) why.push("depart " + d.depart + " ≠ " + depart);
    if (d.steps[1].at !== leave) why.push("leave " + new Date(d.steps[1].at).toISOString() + " ≠ " + new Date(leave).toISOString());
    if (d.gate !== gate) why.push("gate " + d.gate + " ≠ " + gate);
    const bAt = boarding ? (() => { let x = T(date, boarding); if (x > departAt) x -= 864e5; if (x < departAt - 6 * 36e5) x += 864e5; return x; })() : departAt - 40 * 6e4;
    if (d.steps[2].at !== bAt) why.push("boarding");
    const ck = ckOpen ? Math.min(ckOpen, dep0 - 24 * 36e5) : dep0 - 24 * 36e5; if (d.steps[0].at !== ck) why.push("check-in opens");
    if (d.steps[0].done !== ckIn) why.push("checked in " + d.steps[0].done);
    if (d.steps[1].done !== now >= leave || d.steps[3].done !== now >= departAt) why.push("done flags");
    if (why.length) { if (bad.length < 6) bad.push({ i, why, msgs: msgs.map((x) => x.from + ": " + x.text) }); } else pass++;
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));

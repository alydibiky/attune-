// v9.9.26 phone rules: exactly 10,000 event sequences. Each: 1–4 rules (a car / headphones by address — some renamed since, two devices
// with the same name — charging, Home / Work Wi-Fi; with "after 21:00", "before 08:00", an overnight window, weekdays / the weekend), then
// 3–12 events over a day: Bluetooth connects (the same car reconnecting within seconds, another device with the same name), charging
// on / off (a 10-second bump, a real charge seen by the 15-minute check), Wi-Fi seen / changing / unseen (location off). A separate oracle
// says which rule must fire at each event. Checked: exactly those fire — never a reconnect within 60 s, never a short bump, never an unseen
// Wi-Fi name, never outside the rule's hours, a renamed car still matched by its address.
const P = await import(process.env.PR || "../../web-src/phonerules.js");
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const DEV = [{ address: "AA:11:22:33:44:01", name: "KIA Cerato" }, { address: "AA:11:22:33:44:02", name: "AirPods Pro" }, { address: "AA:11:22:33:44:03", name: "JBL Flip 5" }, { address: "AA:11:22:33:44:04", name: "JBL Flip 5" }];
const NETS = ["Home-5G", "WE_8F2A", "Office", "Orange-Fiber"];
export function make(i) {
  const r = rng(i * 7 + 1), pick = (a) => a[Math.floor(r() * a.length)];
  const rules = [];
  for (let k = 0; k < 1 + Math.floor(r() * 4); k++) {
    const t = pick(["bluetooth", "bluetooth", "charging", "wifi"]), ifs = [], w = Math.floor(r() * 6);
    if (w === 1) ifs.push({ type: "after", at: { h: 21, m: 0 } }); if (w === 2) ifs.push({ type: "before", at: { h: 8, m: 0 } });
    if (w === 3) ifs.push({ type: "after", at: { h: 22, m: 0 } }, { type: "before", at: { h: 6, m: 0 } }); if (w === 4) ifs.push({ type: "weekdays" }); if (w === 5) ifs.push({ type: "weekend" });
    const when = t === "bluetooth" ? { type: t, device: { ...pick(DEV) } } : t === "wifi" ? { type: t, ssid: pick(NETS) } : { type: t };
    rules.push({ id: "r" + k, on: r() < 0.92, when, if: ifs });
  }
  const day = new Date(2026, 10, 8 + Math.floor(r() * 7), 0, 0, 0).getTime();   // a day in a week (some weekend, some not)
  let t = day + Math.floor(r() * 20) * 36e5; const evs = [];
  let lastDev = null;
  for (let k = 0; k < 3 + Math.floor(r() * 10); k++) {
    const kind = pick(["bt", "bt", "power", "wifi"]);
    t += r() < 0.3 ? Math.floor(r() * 50) * 1000 : Math.floor(r() * 180) * 60000;   // sometimes seconds apart (reconnects)
    if (kind === "bt") { const d = r() < 0.4 && lastDev ? lastDev : pick(DEV); lastDev = d; const renamed = r() < 0.15; evs.push({ at: t, ev: { kind: "bt", address: d.address, name: renamed ? d.name + " (2)" : d.name } }); }
    else if (kind === "power") { const on = r() < 0.6, since = on ? t - (r() < 0.3 ? 10000 : Math.floor(r() * 15) * 60000 + 60000) : 0; evs.push({ at: t, ev: { kind: "power", on, since } }); }
    else evs.push({ at: t, ev: { kind: "wifi", ssid: r() < 0.15 ? "<unknown ssid>" : pick(NETS) } });
  }
  return { rules, evs };
}
// the oracle — written separately from phonerules.js
function okHours(ifs, at) { const d = new Date(at), m = d.getHours() * 60 + d.getMinutes(), we = d.getDay() === 5 || d.getDay() === 6;
  for (const x of ifs) { if (x.type === "weekdays" && we) return false; if (x.type === "weekend" && !we) return false; }
  const a = ifs.find((x) => x.type === "after"), b = ifs.find((x) => x.type === "before");
  if (a && b) { const A = a.at.h * 60, B = b.at.h * 60; return A <= B ? m >= A && m < B : m >= A || m < B; }
  if (a) return m >= a.at.h * 60; if (b) return m < b.at.h * 60; return true; }
function oracle(rules, evs) {
  const last = {}, out = []; let chargeFired = false, ssid = null;
  for (const { at, ev } of evs) { const fire = [];
    const tryR = (r) => { if (r.on === false || !okHours(r.if, at)) return; if (last[r.id] != null && at - last[r.id] < 60000) return; last[r.id] = at; fire.push(r.id); };
    if (ev.kind === "bt") for (const r of rules) { if (r.when.type === "bluetooth" && r.when.device.address === ev.address) tryR(r); }
    if (ev.kind === "power") { if (!ev.on) chargeFired = false; else if (!chargeFired && at - ev.since >= 60000) { chargeFired = true; for (const r of rules) if (r.when.type === "charging") tryR(r); } }
    if (ev.kind === "wifi" && ev.ssid !== "<unknown ssid>" && ev.ssid !== ssid) { ssid = ev.ssid; for (const r of rules) if (r.when.type === "wifi" && r.when.ssid === ev.ssid) tryR(r); }
    out.push(fire); }
  return out;
}
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const { rules, evs } = make(i), want = oracle(rules, evs); let st = {}; const why = [];
    evs.forEach(({ at, ev }, k) => { const d = P.decide(rules, ev, st, at); st = d.state; if (JSON.stringify(d.fire) !== JSON.stringify(want[k])) why.push(k + " " + ev.kind + " fired " + JSON.stringify(d.fire) + " want " + JSON.stringify(want[k])); });
    if (why.length) { if (bad.length < 6) bad.push({ i, why: why.slice(0, 3) }); } else pass++;
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));

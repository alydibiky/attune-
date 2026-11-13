/* ---- v9.9.26 phone rules (Ali picked R1-C + R2-A, combined screen OK'd 13 Nov): "when I connect to my car", "when I start charging",
   "when I join Home Wi-Fi". Bluetooth fires at once (Android wakes the app when a device connects); charging and Wi-Fi are checked by
   Android's own background work about every 15 minutes (no permanent notification). This file decides — and PhoneRules.kt does exactly
   the same on the phone:
     · Bluetooth: the device picked from the paired list matches by its ADDRESS (a renamed car still matches; two "JBL"s are told apart);
       the same rule again within 60 s counts once (cars reconnect).
     · Charging: fires once when charging starts and has lasted at least 60 s (a cable bumped for a second doesn't fire); again only
       after it stopped.
     · Wi-Fi: fires when the phone moves onto that network's name; an unseen name (Android shows it only with location on) never fires
       and is reported, not guessed.
     · The rule's own hours: after / before a time (overnight windows too), weekdays / the weekend (the country's weekend).
   Pure. Tests: tests/phonerules/gen.mjs (10,000 event sequences) + tests/unit/v9926phonerules.test.mjs. */
export const PHONE_TRIGGERS = ["bluetooth", "charging", "wifi"];
const norm = (s) => String(s || "").trim().replace(/^"|"$/g, "");
const mins = (at) => (at ? at.h * 60 + (at.m || 0) : null);
/** The rule's hours / days allow it now? */
export function allowedNow(ifs = [], now = Date.now(), weekend = [5, 6]) {
  const d = new Date(now), m = d.getHours() * 60 + d.getMinutes(), we = weekend.includes(d.getDay());
  const af = (ifs || []).find((x) => x.type === "after"), bf = (ifs || []).find((x) => x.type === "before");
  if ((ifs || []).some((x) => x.type === "weekdays") && we) return false;
  if ((ifs || []).some((x) => x.type === "weekend") && !we) return false;
  if ((ifs || []).some((x) => x.type === "more" || x.type === "less")) return false;   // (money conditions don't belong to these triggers)
  const a = af ? mins(af.at) : null, b = bf ? mins(bf.at) : null;
  if (a != null && b != null) return a <= b ? m >= a && m < b : m >= a || m < b;   // "after 22:00 before 06:00" goes over midnight
  if (a != null) return m >= a; if (b != null) return m < b;
  return true;
}
/** One event → { fire: [rule ids], state, blind } . ev: { kind: "bt", address, name } | { kind: "power", on, since } | { kind: "wifi", ssid } */
export function decide(rules = [], ev = {}, state = {}, now = Date.now(), { weekend = [5, 6] } = {}) {
  const st = { last: {}, ...state, last: { ...(state.last || {}) } }, fire = [];
  const live = (rules || []).filter((r) => r && r.on !== false && r.when && PHONE_TRIGGERS.includes(r.when.type));
  const go = (r) => { if (!allowedNow(r.if, now, weekend)) return; if (st.last[r.id] && now - st.last[r.id] < 60000) return; st.last[r.id] = now; fire.push(r.id); };
  if (ev.kind === "bt") {
    for (const r of live) { if (r.when.type !== "bluetooth" || !r.when.device) continue; const dv = r.when.device;
      const hit = dv.address ? norm(dv.address).toUpperCase() === norm(ev.address).toUpperCase() : !!dv.name && norm(dv.name).toLowerCase() === norm(ev.name).toLowerCase();
      if (hit) go(r); }
  } else if (ev.kind === "power") {
    if (!ev.on) { st.charging = false; st.chargeFired = false; }
    else if (!st.chargeFired && now - (ev.since || now) >= 60000) { st.charging = true; st.chargeFired = true; for (const r of live) if (r.when.type === "charging") go(r); }
  } else if (ev.kind === "wifi") {
    const ssid = norm(ev.ssid);
    if (!ssid || ssid === "<unknown ssid>") return { fire, state: { ...st, blind: true }, blind: true };
    st.blind = false;
    if (ssid !== st.ssid) { st.ssid = ssid; for (const r of live) if (r.when.type === "wifi" && r.when.ssid && norm(r.when.ssid) === ssid) go(r); }
  }
  return { fire, state: st, blind: false };
}

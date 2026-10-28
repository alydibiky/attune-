/* ---- v8.7 (persona 4, idea 15 — Ali: "for the health, some watches measure a lot of these already") -----------------------------
   What the watch already measures comes in by itself through Health Connect (Health.vitals in Health.kt): blood pressure, SpO₂,
   sleep, resting heart rate, heart-rate variability (HRV — the stress signal), glucose, weight. Nothing to type.
   Code then:
     - keeps the last 120 days on the phone ("attune:vitals:v1")
     - puts the watch's blood pressure into Family health (source "watch", never twice) and its sleep into Fit's day
     - writes a week in a few lines, and flags only what matters, against the person's OWN usual (the last 30 days):
         SpO₂ under 92% at night · resting heart rate 7+ above usual for 3 days · HRV 25% under usual (stress / tired) ·
         sleep under 6 h on average · a high blood pressure reading.
   Pure: store/result in, store/lines out. Not medical advice — the lines say "talk to a doctor" only for the red ones.         */
import { addBloodPressure, bpLevel } from "./care.js";

export const VITALS_KEY = "attune:vitals:v1";
const DAY = 864e5;
const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r1 = (v) => Math.round(v * 10) / 10;

export const loadVitals = (store = typeof localStorage !== "undefined" ? localStorage : null) => { try { const j = JSON.parse((store && store.getItem(VITALS_KEY)) || "null"); return j && j.days ? j : { days: {} }; } catch (e) { return { days: {} }; } };
export const saveVitals = (v, store = typeof localStorage !== "undefined" ? localStorage : null) => { try { store && store.setItem(VITALS_KEY, JSON.stringify(v)); } catch (e) {} return v; };

/** The watch's answer (Health.vitals) folded into the store; the newest read wins per day; older than 120 days drops. */
export function mergeVitals(store, res, now = Date.now()) {
  const days = { ...((store && store.days) || {}) };
  for (const d of (res && res.days) || []) if (d && d.day) days[d.day] = { ...(days[d.day] || {}), ...d };
  const cut = iso(now - 120 * DAY);
  for (const k of Object.keys(days)) if (k < cut) delete days[k];
  return { days, at: now, granted: res && res.granted, of: res && res.of };
}

/** The watch's blood pressure into Family health (care labs, source "watch") — each reading once. → the new care data. */
export function bpIntoCare(care, vit, member = "") {
  const seen = new Set(((care && care.labs) || []).filter((l) => l.source === "watch").map((l) => l.at));
  let c = care || {};
  for (const d of Object.values((vit && vit.days) || {})) for (const b of d.bp || []) {
    if (seen.has(b.at)) continue; seen.add(b.at);
    c = addBloodPressure(c, member, b.sys, b.dia, 0, b.at);
    c.labs[c.labs.length - 1].source = "watch";
  }
  return c;
}

/** The watch's sleep into Fit's days (only where the person didn't log sleep). → the new fit data. */
export function sleepIntoFit(fit, vit) {
  const days = { ...((fit && fit.days) || {}) };
  for (const [k, d] of Object.entries((vit && vit.days) || {})) if (d.sleepMin > 0 && !(days[k] && days[k].sleep)) days[k] = { ...(days[k] || {}), sleep: d.sleepMin, sleepFrom: "watch" };
  return { ...(fit || {}), days };
}

/** The week (last 7 days) against the person's usual (the 30 days before) → { has, rows, lines: [{en, ar, level}], flags } */
export function vitalsWeek(vit, now = Date.now()) {
  const D = (vit && vit.days) || {}, today = iso(now), wk = iso(now - 6 * DAY), base0 = iso(now - 37 * DAY);
  const week = Object.values(D).filter((d) => d.day >= wk && d.day <= today).sort((a, b) => (a.day < b.day ? -1 : 1));
  const before = Object.values(D).filter((d) => d.day >= base0 && d.day < wk);
  const vals = (list, k) => list.map((d) => d[k]).filter((v) => typeof v === "number" && v > 0);
  const lines = [], flags = [];
  const say = (level, en, ar, flag) => { lines.push({ level, en, ar }); if (flag) flags.push(flag); };
  // blood pressure
  const bps = week.flatMap((d) => d.bp || []);
  if (bps.length) {
    const s = Math.round(avg(bps.map((b) => b.sys))), di = Math.round(avg(bps.map((b) => b.dia))), high = bps.filter((b) => /high/.test(bpLevel(b.sys, b.dia)));
    say(high.length ? "red" : "ok", `Blood pressure: ${s}/${di} on average (${bps.length} reading${bps.length > 1 ? "s" : ""})${high.length ? ` — ${high.length} high; show a doctor` : ""}`,
      `الضغط: ${s}/${di} في المتوسط (${bps.length} قراية)${high.length ? ` — ${high.length} عالي؛ اعرضه على دكتور` : ""}`, high.length ? "bp" : null);
  }
  // oxygen at night
  const sp = vals(week, "spo2"), spMin = vals(week, "spo2Min");
  if (sp.length) {
    const low = spMin.filter((v) => v < 92).length;
    say(low ? "red" : "ok", `Oxygen (SpO₂): ${r1(avg(sp))}% on average${low ? ` — under 92% on ${low} day${low > 1 ? "s" : ""}; talk to a doctor` : ""}`,
      `الأكسجين: ${r1(avg(sp))}% في المتوسط${low ? ` — أقل من 92% في ${low} ${low > 1 ? "أيام" : "يوم"}؛ كلّم دكتور` : ""}`, low ? "spo2" : null);
  }
  // sleep
  const sl = vals(week, "sleepMin");
  if (sl.length) {
    const m = avg(sl), h = Math.floor(m / 60), mi = Math.round(m % 60), short = m < 360;
    say(short ? "amber" : "ok", `Sleep: ${h} h ${mi} min a night${short ? " — under 6 hours" : ""}`, `النوم: ${h} ساعة و${mi} دقيقة في الليلة${short ? " — أقل من 6 ساعات" : ""}`, short ? "sleep" : null);
  }
  // resting heart rate: 3 days or more at 7+ above the usual
  const rh = vals(week, "restHr"), rhBase = vals(before, "restHr");
  if (rh.length) {
    const u = avg(rhBase), up = rhBase.length >= 7 ? rh.filter((v) => v >= u + 7).length : 0;
    say(up >= 3 ? "amber" : "ok", `Resting heart rate: ${Math.round(avg(rh))}${rhBase.length >= 7 ? ` (usually ${Math.round(u)})` : ""}${up >= 3 ? " — higher than usual for days: rest, drink water; a cold coming?" : ""}`,
      `نبض الراحة: ${Math.round(avg(rh))}${rhBase.length >= 7 ? ` (عادةً ${Math.round(u)})` : ""}${up >= 3 ? " — أعلى من العادي كام يوم: ارتاح واشرب مية؛ ممكن برد جاي؟" : ""}`, up >= 3 ? "restHr" : null);
  }
  // HRV: the stress / tiredness signal, 25% under the usual
  const hv = vals(week, "hrv"), hvBase = vals(before, "hrv");
  if (hv.length) {
    const u = avg(hvBase), w = avg(hv), low = hvBase.length >= 7 && w < u * 0.75;
    say(low ? "amber" : "ok", `Stress (HRV): ${Math.round(w)} ms${hvBase.length >= 7 ? ` (usually ${Math.round(u)})` : ""}${low ? " — lower than usual: stressed or tired; an easier day helps" : ""}`,
      `الضغط النفسي (HRV): ${Math.round(w)} ms${hvBase.length >= 7 ? ` (عادةً ${Math.round(u)})` : ""}${low ? " — أقل من العادي: متوتر أو تعبان؛ خد يوم أهدى" : ""}`, low ? "stress" : null);
  }
  // glucose and weight, when the watch / a meter shares them
  const gl = week.flatMap((d) => d.glucose || []).map((g) => g.mgdl);
  if (gl.length) { const hi = gl.filter((v) => v > 180).length; say(hi ? "amber" : "ok", `Glucose: ${Math.round(avg(gl))} mg/dL on average${hi ? ` — ${hi} over 180` : ""}`, `السكر: ${Math.round(avg(gl))} في المتوسط${hi ? ` — ${hi} فوق 180` : ""}`, hi ? "glucose" : null); }
  const kg = vals(week, "kg");
  if (kg.length) say("ok", `Weight: ${kg[kg.length - 1]} kg`, `الوزن: ${kg[kg.length - 1]} كيلو`);
  const rows = week.map((d) => ({ day: d.day, bp: (d.bp || []).map((b) => `${b.sys}/${b.dia}`).join(", "), spo2: d.spo2 || "", sleep: d.sleepMin ? `${Math.floor(d.sleepMin / 60)}:${String(d.sleepMin % 60).padStart(2, "0")}` : "", restHr: d.restHr || "", hrv: d.hrv || "" }));
  const order = { red: 0, amber: 1, ok: 2 };
  return { has: lines.length > 0, rows, lines: lines.sort((a, b) => order[a.level] - order[b.level]), flags };
}

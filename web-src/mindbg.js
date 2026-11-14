/* ---- v9.9.36 BG-3 (Ali picked): the pure part of "the model reads notifications with Attune closed". MindBg.kt runs it on the phone;
   this file is what the page hands over and how the answers come back — and a mirror of the phone's rules for the tests:
     when:   charging, OR battery above 40 % with the screen off and no battery saver
     what:   notifications of the last 3 days not read before, not from an app code is always sure of, newest first,
             at most 12 a round and 40 a day
     merge:  the model decides only where code was unsure; a number, date or name not in the notification is dropped (readMind). Pure. */
import { comprehend, mindPrompt, readMind, merge } from "./notifmind.js";

/** The prompt for the phone (the day as {DATE}) + the apps to skip (code was sure of all of their last 5+ notifications). */
export function bgTemplate(notes = [], now = Date.now(), tr = (s) => s) {
  const sys = mindPrompt({ app: "", title: "", text: "" }, { now, cat: "other" })[0].content;
  const day = /Today is ([^.]+)\./.exec(sys);
  const by = {};
  for (const n of notes || []) { if (!n || !n.pkg) continue; const c = (() => { try { return comprehend(n); } catch (e) { return null; } })(); (by[n.pkg] = by[n.pkg] || []).push(!!(c && c.sure)); }
  const skip = Object.entries(by).filter(([, v]) => v.length >= 5 && v.every(Boolean)).map(([k]) => k);
  return { system: day ? sys.replace(day[1], "{DATE}") : sys, skip, max: 40, words: { title: "Attune", reading: tr("Reading {n} messages…"), channel: tr("Background reading") } };
}
/** The phone's answers → merged readings, saved with save(id, reading). Code wins where it was sure. → how many were taken. */
export function takeBg(rows, notes, save) {
  let k = 0; const byId = new Map((notes || []).map((n) => [String(n.id), n]));
  for (const r of rows || []) { const n = byId.get(String(r && r.id)); if (!n || !r.raw) continue;
    const code = (() => { try { return comprehend(n); } catch (e) { return null; } })(); if (!code || code.sure) continue;
    save(String(n.id), merge(code, readMind(String(r.raw), n))); k++; }
  return k;
}
/** = MindBg.kt allowedNow */
export const bgAllowed = ({ plugged = false, pct = 0, interactive = true, saver = false } = {}) => plugged || (pct > 40 && !interactive && !saver);
/** = MindBg.kt run's pick: what this round reads. */
export function bgRound(notes, { done = new Set(), skip = new Set(), countToday = 0, max = 40, now = Date.now() } = {}) {
  const left = Math.max(0, max - countToday); if (!left) return [];
  const since = now - 3 * 86400000;
  return (notes || []).filter((n) => n && (n.ts || 0) >= since && !done.has(n.id) && !skip.has(n.pkg) && String(n.text || "").trim())
    .sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, Math.min(12, left));
}

import { tr } from "./i18n.js";
/* ---- v6.41 (upgrade H2) — talking to Chat like a phone call. The answer is read aloud a sentence at a time, so it starts
   speaking at once and a tap stops it between (and inside) sentences; code, tables and links are not read out — the person is
   told they are on the screen. Pure; tests/unit/v741voicecall.test.mjs; the call screen is in chat.jsx (CallScreen). */

/** An answer → the sentences to say: markdown removed, code / tables / links replaced by a short note, ≤ 220 letters each. */
export function sayable(text, ar = false) {
  let t = String(text || "");
  const note = ar ? "التفاصيل على الشاشة." : tr("The details are on the screen.");
  let hadExtra = false;
  t = t.replace(/```[\s\S]*?(```|$)/g, () => { hadExtra = true; return "\n"; });
  t = t.split("\n").filter((l) => { if (/^\s*\|.*\|\s*$/.test(l)) { hadExtra = true; return false; } return true; }).join("\n");
  t = t.replace(/https?:\/\/\S+/g, () => { hadExtra = true; return "\u0000"; });   // a sentence with a link is not read
  t = t.replace(/\s*\[(\d+)\]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`#>]+/g, "").replace(/^\s*[-•]\s+/gm, "").replace(/\$[^$]*\$/g, " ");
  const parts = [];
  for (const block of t.split(/\n+/)) {
    for (const s of block.split(/(?<=[.!?؟])\s+/)) {
      let x = s.replace(/\s+/g, " ").trim(); if (!x || x.includes("\u0000") || !/[\p{L}\p{N}]/u.test(x)) continue;
      while (x.length > 220) { const cut = Math.max(x.lastIndexOf("، ", 220), x.lastIndexOf(", ", 220), x.lastIndexOf(" ", 220)); const k = cut > 60 ? cut + 1 : 220; parts.push(x.slice(0, k).trim()); x = x.slice(k).trim(); }
      if (x) parts.push(x);
    }
  }
  if (hadExtra) parts.push(note);
  return parts;
}

/** What to say in a call: short, spoken, no lists or tables (added to the question, not the person's words). */
export const CALL_HINT = { en: "(We are talking by voice: answer in 1–3 short spoken sentences, no lists or tables.)", ar: "(إحنا بنتكلم بالصوت: رد في جملة لـ 3 جمل قصيرة بالمصري، من غير قوائم أو جداول.)" };

/** A sentence that ends the call: "bye", «سلام», «خلاص كده». */
export const endsCall = (s) => /^(?:bye|goodbye|that'?s all|stop the call|end call|thanks,? bye|سلام|مع السلامة|باي|خلاص كده|خلاص شكرا|اقفل)(?=$|[\s.!؟,،])/i.test(String(s || "").trim());

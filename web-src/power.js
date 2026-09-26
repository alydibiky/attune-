/* ---- Model names and power levels (v5.23) ------------------------------------------------
   Ali: "catchy names related to Attune's branding" and "make sure the stronger models are
   clearly much stronger and can do more expert and professional things".

   Names follow Attune's idea — tuning, music — from a whisper to a maestro. The real model
   is always shown under the name.

   Until now every model got the SAME limits, so a 9B or 31B model was held to what a 2B
   can handle. Each level now has a power profile the whole app reads (getPower()):
   answer length, how much of each web page deep research reads, an extra research round,
   Think switched on by itself for hard questions, bigger websites and ERP designs, and
   Gemini-style research (more searches, pages, gap-filling rounds and time: queries /
   readPages / rounds / researchSecs), expert instructions (edge cases, standards, full calculations, professional deliverables)
   that a small model would only be confused by.                                          */

export const LEVELS = {
  1: { name: "Basic", blurb: "Quick tidy-ups, short answers" },
  2: { name: "Everyday", blurb: "Everyday questions, messages, summaries" },
  3: { name: "Smart", blurb: "Photos, documents, maths, Arabic — the everyday all-rounder" },
  4: { name: "Expert", blurb: "Professional depth: detailed reports, bigger systems, careful reasoning" },
  5: { name: "Master", blurb: "The strongest: long expert work, full ERP systems, whole documents" },
};

/** model tier id → { brand, level } */
export const BRANDS = {
  "xs": { brand: "Whisper", level: 1 },
  "sm": { brand: "Echo", level: 2 },
  "fast-e2b": { brand: "Pulse", level: 2 },
  "md-lo": { brand: "Chord Lite", level: 3 },
  "md": { brand: "Chord", level: 3 },
  "md-hi": { brand: "Chord HD", level: 3 },
  "lg": { brand: "Rhythm", level: 3 },
  "fast-e4b": { brand: "Pulse Pro", level: 3 },
  "xl": { brand: "Harmony", level: 4 },
  "max": { brand: "Harmony Pro", level: 4 },
  "moe-lg": { brand: "Symphony", level: 5 },
  "ultra": { brand: "Symphony Max", level: 5 },
  "moe-xl": { brand: "Maestro", level: 5 },
  "moe-xl-long": { brand: "Maestro Long", level: 5 },
};

/** A model tier (or null) → { brand, level, levelName, real } */
export function brandOf(tier) {
  if (!tier) return { brand: "", level: 3, levelName: LEVELS[3].name, real: "" };
  const b = BRANDS[tier.id];
  const guess = /(\d+(?:\.\d+)?)\s*B/i.exec(String(tier.params || ""));
  const n = guess ? parseFloat(guess[1]) : 4;
  const level = b ? b.level : n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 3 : n < 20 ? 4 : 5;
  return { brand: b ? b.brand : tier.label, level, levelName: LEVELS[level].name, real: tier.label + (tier.quant ? " · " + tier.quant : "") };
}

/**
 * What a level may do. `ctx` (the model's context window, tokens) caps answer length so a
 * long answer never pushes the question out of the window.
 */
export function powerFor(level, ctx = 8192) {
  const L = Math.max(1, Math.min(5, level || 3));
  const P = {
    1: { maxTokens: 1024, longTokens: 1536, notesChars: 3500, pages: 4, round2: 0, codeTokens: 2500, designTokens: 1800, tables: "3 to 5", expert: false, thinkHard: false, queries: 1, readPages: 4, rounds: 0, researchSecs: 120 },
    2: { maxTokens: 1536, longTokens: 2048, notesChars: 4500, pages: 5, round2: 3, codeTokens: 3000, designTokens: 2200, tables: "4 to 7", expert: false, thinkHard: false, queries: 2, readPages: 6, rounds: 1, researchSecs: 170 },
    3: { maxTokens: 2048, longTokens: 3072, notesChars: 5500, pages: 8, round2: 3, codeTokens: 4000, designTokens: 2500, tables: "6 to 10", expert: false, thinkHard: false, queries: 3, readPages: 8, rounds: 1, researchSecs: 210 },
    4: { maxTokens: 4096, longTokens: 6144, notesChars: 9000, pages: 8, round2: 5, codeTokens: 8000, designTokens: 4000, tables: "8 to 12", expert: true, thinkHard: true, queries: 4, readPages: 10, rounds: 2, researchSecs: 300 },
    5: { maxTokens: 6144, longTokens: 8192, notesChars: 12000, pages: 8, round2: 6, codeTokens: 12000, designTokens: 6000, tables: "10 to 16", expert: true, thinkHard: true, queries: 5, readPages: 12, rounds: 2, researchSecs: 420 },
  }[L];
  const cap = Math.max(1024, Math.floor((ctx || 8192) / 3));
  return { ...P, level: L, maxTokens: Math.min(P.maxTokens, cap), longTokens: Math.min(P.longTokens, cap), codeTokens: Math.min(P.codeTokens, Math.floor((ctx || 8192) / 2)), designTokens: Math.min(P.designTokens, cap) };
}

// The active model's profile, set by the app when the model changes.
let CURRENT = powerFor(3);
export function setPower(tier) { const b = brandOf(tier); CURRENT = powerFor(b.level, (tier && tier.ctx) || 8192); return CURRENT; }
export function getPower() { return CURRENT; }

/** Extra instructions only strong models get (a small model would drown in them). */
export const EXPERT_RULES = `EXPERT MODE — you are a strong model; work like a senior professional in the field:
- Go deep: cover the important cases, edge cases and exceptions, not just the typical one.
- Name the standard, rule, code or method you rely on (e.g. EN 13000 for mobile cranes, Egyptian VAT law, IFRS) when it matters.
- Show full calculations with units, and check them.
- Structure long answers as a professional deliverable: summary first, then sections, tables where they help, and clear recommendations / next steps.
- State assumptions and risks explicitly; say what you'd need to be certain.`;

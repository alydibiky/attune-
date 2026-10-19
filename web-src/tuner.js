/* ---- v6.41 (upgrade X2) — the engine tuner. Each phone is different: on some, 3 threads write faster than 4 (the 4th core is a
   slow one or shares heat with the others). "Tune for this phone" (Engine) times the model with a few settings and keeps the
   fastest; the engine still runs cooler by itself when the phone gets warm (DeviceInfo.generationThreads).
   Pure: the settings to try and the choice; the page runs them (attune.jsx EngineTune). Tests: tests/unit/v741tuner.test.mjs. */

/** The settings to try: generation threads around the number of fast cores; prompt threads one or two more. */
export function candidates({ cores = 8, bigCores = 4 } = {}) {
  const big = Math.max(2, Math.min(bigCores || 4, 8));
  const gens = [...new Set([big - 1, big, big + 1].map((g) => Math.max(2, Math.min(g, cores - 1, 6))))].sort((a, b) => a - b);
  return gens.map((g) => ({ gen: g, batch: Math.max(2, Math.min(cores - 2, g + 2, 6)) }));
}

/**
 * The best of the timed runs [{ gen, batch, tps }]: the fastest; a setting with FEWER threads wins when it is within 5% —
 * nearly as fast, cooler, and it leaves cores free for the screen. → { best, gainPct } or null when nothing ran.
 */
export function choose(runs, before = null) {
  const ok = (runs || []).filter((r) => r && r.tps > 0);
  if (!ok.length) return null;
  const top = Math.max(...ok.map((r) => r.tps));
  const best = ok.filter((r) => r.tps >= top * 0.95).sort((a, b) => a.gen - b.gen || b.tps - a.tps)[0];
  const base = before && before.tps > 0 ? before.tps : null;
  return { best, gainPct: base ? Math.round((best.tps / base - 1) * 100) : null };
}

/** The fixed test: the same short, predictable answer each time, so the runs compare. */
export const TUNE_PROMPT = [{ role: "user", content: "Write the numbers from one to forty in words, separated by commas." }];
export const TUNE_TOKENS = 96;

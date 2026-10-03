/* ---- Heat rule for Engine → Speed ---------------------------------------------------
   d.thermal is Android's PowerManager thermal status (0 none, 1 light, 2 moderate,
   3 severe, 4 critical, 5 emergency, 6 shutdown). d.thermalHeadroom is the 10 s
   forecast from getThermalHeadroom: 1.0 = the phone starts throttling, -1 = unknown.
   What the engine does at each level (DeviceInfo.kt / NativeBridge.kt):
   - moderate, or headroom ≥ 0.95: one writing thread fewer, two prompt threads fewer
     (applied when the model next starts);
   - severe: 2 writing threads, and before each new answer it waits up to 20 s to cool;
   - critical: an answer in progress is stopped and kept.                              */

export const HEAT_SOON = 0.8;   // headroom: warm, throttling is near
export const HEAT_HOT = 0.95;   // headroom: treat like "moderate"

/** 0 cool · 1 warming · 2 hot · 3 very hot · 4 critical. */
export function heatLevel(d) {
  if (!d) return 0;
  const t = Number(d.thermal) || 0;
  const h = typeof d.thermalHeadroom === "number" && d.thermalHeadroom >= 0 ? d.thermalHeadroom : -1;
  if (t >= 4) return 4;
  if (t >= 3) return 3;
  if (t >= 2 || h >= HEAT_HOT) return 2;
  if (h >= HEAT_SOON || t === 1) return 1;
  return 0;
}

/** The warning line for the Speed screen: [kind, English text] or null when cool. */
export function heatWarning(d) {
  const l = heatLevel(d);
  if (l >= 4) return ["bad", "The phone is critically hot — Attune stops an answer in progress and keeps what was written. Let it cool for a few minutes."];
  if (l === 3) return ["bad", "The phone is very hot — Attune waits up to 20 seconds before each new answer so it can cool, and uses fewer threads the next time the model starts."];
  if (l === 2) return ["bad", "The phone is hot — it slows the processor down on purpose. Let it cool, take it out of its case, don't charge while asking."];
  if (l === 1) return ["warn", "The phone is getting warm — long answers may slow down soon. Short breaks between answers keep it fast."];
  return null;
}

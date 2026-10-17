/* ---- v6.32: FSRS, the stronger review method for Learn's cards (roadmap "Learning": FSRS) ---------------------------------
   The old schedule was fixed boxes (1, 3, 7, 16, 35 days). FSRS (Free Spaced Repetition Scheduler, version 5, open source,
   MIT) keeps two numbers per card — how STABLE the memory is (days until recall drops to 90 %) and how DIFFICULT the card is
   (1–10) — and updates them from every answer and from how long it really was since the last review. Result: easy cards come
   back far less often, hard ones sooner, and a late review counts for more. Pure code, no model. Tests: tests/unit/v736fsrs.test.mjs.
   Grades: 1 Again (didn't know) · 2 Hard · 3 Good (knew it) · 4 Easy.                                                            */

// FSRS-5 default weights (trained on millions of real reviews by the FSRS project)
export const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11,
  0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5, FACTOR = 19 / 81;
export const RETENTION = 0.9;        // aim: 9 of 10 cards still known on the day they come back
export const MAX_DAYS = 3650;
const DAY = 86400000;
const clampD = (d) => Math.min(10, Math.max(1, d));

/** The chance the card is still known after t days with stability s. */
export function recall(t, s) { return Math.pow(1 + FACTOR * Math.max(0, t) / s, DECAY); }
/** Days until recall falls to the target retention. */
export function interval(s, r = RETENTION) {
  const i = (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
  return Math.min(MAX_DAYS, Math.max(1, Math.round(i)));
}
const initS = (g) => Math.max(0.1, W[g - 1]);
const initD = (g) => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);
function nextD(d, g) {
  const d1 = d + (-W[6] * (g - 3)) * (10 - d) / 9;          // linear damping: a hard card can't keep getting harder forever
  return clampD(W[7] * initD(4) + (1 - W[7]) * d1);         // a little pull back to the mean
}
function recallS(d, s, r, g) {
  const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
  return s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy + 1);
}
function forgetS(d, s, r) {
  return Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
}
const sameDayS = (s, g) => s * Math.exp(W[17] * (g - 3 + W[18]));

/** A grade from what the review screen says: true = knew it (Good), false = didn't (Again), or 1–4 as is. */
export const gradeOf = (x) => (x === true ? 3 : x === false ? 1 : Math.min(4, Math.max(1, Math.round(+x) || 1)));

/** Review one card: { s, d, last, reps, lapses } (any missing = a new card) + a grade + now → the card's new state and due time.
    A card from the old box schedule is carried over: its box becomes a matching stability, so nobody's progress is lost. */
export function review(card, grade, now = Date.now()) {
  const g = gradeOf(grade);
  let { s, d } = card || {};
  const fromBox = s == null && card && card.box > 0 ? [1, 3, 7, 16, 35][card.box - 1] : 0;
  if (s == null && fromBox) { s = fromBox; d = 5; }
  const last = card && card.last ? card.last : card && card.due && fromBox ? card.due - fromBox * DAY : null;
  if (s == null) { s = initS(g); d = initD(g); }
  else {
    const t = last ? (now - last) / DAY : 0;
    const r = recall(t, s);
    if (t < 1) s = sameDayS(s, g);
    else s = g === 1 ? forgetS(d, s, r) : recallS(d, s, r, g);
    d = nextD(d, g);
  }
  s = Math.max(0.1, Math.min(MAX_DAYS * 2, s));
  const days = g === 1 ? 1 : interval(s);
  return { ...card, s: +s.toFixed(4), d: +d.toFixed(4), last: now, due: now + days * DAY, reps: ((card && card.reps) || 0) + 1,
    lapses: ((card && card.lapses) || 0) + (g === 1 ? 1 : 0) };
}

/** Learned for good: the memory is stable for half a year or more (it leaves the daily deck). */
export const isLearned = (card) => card && card.s != null && card.s >= 180;

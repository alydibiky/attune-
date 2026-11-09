/* ---- v9.9.8 M2 (Ali OK'd: "don't use big models because it will make the app crash for mobile phones — make sure these small
   models help each other in the best way possible"). Small models as a RELAY, one after another, each with one job:
     1. the meaning model (bge-m3, 0.57 B, MIT) finds your notes / Shelf / Mind records that MEAN the question even with other
        words («فاتورة الكهربا» ↔ "electricity bill") — reusing the numbers Recall already stored, so only the question is new;
     2. the chat model answers from those short notes (the S1 "From your Mind / Shelf" line says where it came from);
     3. code checks numbers / dates (M3).
   The memory rule (here, tested): a helper must be small (≤ ~1.5 B), two models over ~1.5 B are never loaded together, and a
   helper loads only with memory to spare; on the phone the meaning model is let go right after a chat question when memory is
   tight (NativeBridge.embed, release). Strict like M1: a note found ONLY by meaning must be clearly close (MEAN_MIN, higher
   than Recall's 0.42 list) — a wrong note is never handed to the model as "yours". Pure; tests: tests/unit/v998relay.test.mjs. */
import { cosine } from "./knowpack.js";

const GB = 1024 * 1024 * 1024;
/** ~1.5 B parameters at 4–8 bit ≈ 1.1 GB on disk: above this a model is not a "helper". */
export const HELPER_MAX_BYTES = Math.round(1.1 * GB);
/** Free memory that must stay after a helper loads (the chat model's working memory + the app). */
export const KEEP_FREE = Math.round(0.7 * GB);
/** A record found only by meaning must be at least this close (cosine, bge-m3) to be passed to the chat model. */
export const MEAN_MIN = 0.55;
/** …and a meaning-only record with no word in common must be closer still. */
export const MEAN_ALONE = 0.62;

/**
 * May this helper load now? { helperBytes, chatBytes (the loaded chat model, 0 if none), otherBytes (another helper already
 * loaded), freeBytes (Android's availMem) } → { ok, why }.
 */
export function helperAllowed({ helperBytes = 0, chatBytes = 0, otherBytes = 0, freeBytes = 0 } = {}) {
  if (helperBytes > HELPER_MAX_BYTES) return { ok: false, why: "big" };                              // helpers are small, always
  const big = [chatBytes, otherBytes, helperBytes].filter((b) => b > HELPER_MAX_BYTES).length;
  if (big >= 2) return { ok: false, why: "two-big" };                                                // never two big ones together
  if (freeBytes - helperBytes < KEEP_FREE) return { ok: false, why: "memory" };                       // room for the chat to work
  return { ok: true, why: "" };
}

const STOP = new Set("the a an and or of to in on at for is are was were be my me i you it this that what when where how which who with from about do does did have has had can could should would will please tell show give find any all your our their his her its there here than then so if not no yes as by اي ايه إيه في من على عن الى إلى و يا هو هي انا أنا انت إنت ده دي اللي كان كانت مع ازاي إزاي فين امتى إمتى ليه كام هل".split(" "));
const words = (s) => new Set(String(s || "").toLowerCase().normalize("NFKC").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  .split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w)));

/**
 * Your records that MEAN the question: records (memory records you wrote / kept), vecOf(rec) → Float32Array | null (the
 * stored numbers), qv = the question's numbers. → [{ rec, sim, words }] best first, strict (MEAN_MIN / MEAN_ALONE), ≤ limit.
 */
export function meaningPick(question, records, vecOf, qv, { limit = 2, min = MEAN_MIN, alone = MEAN_ALONE } = {}) {
  if (!qv || !records || !records.length) return [];
  const qw = words(question), out = [];
  for (const rec of records) {
    const v = vecOf(rec); if (!v) continue;
    const sim = cosine(v, qv); if (!(sim >= min)) continue;
    const rw = words([rec.title, rec.text, rec.output, rec.note].filter(Boolean).join(" "));
    const shared = [...qw].filter((w) => rw.has(w)).length;
    if (!shared && sim < alone) continue;
    out.push({ rec, sim, words: shared });
  }
  return out.sort((a, b) => b.sim - a.sim || (b.rec.ts || 0) - (a.rec.ts || 0)).slice(0, limit);
}

/** Word hits first (they matched your own words), then meaning hits not already there; ≤ limit, in memSearch's shape { rec }. */
export function mergeFound(wordFound = [], meanFound = [], limit = 3) {
  const seen = new Set(wordFound.map((f) => f.rec && f.rec.id)), out = [...wordFound];
  for (const m of meanFound) { if (out.length >= limit) break; if (seen.has(m.rec.id)) continue; seen.add(m.rec.id); out.push({ rec: m.rec, score: 0, byMeaning: true, sim: m.sim }); }
  return out.slice(0, limit);
}

/** The id a memory record's stored numbers are kept under in Recall (lookback.js recallDocs: "m:" + id). */
export const docIdOf = (rec) => "m:" + rec.id;

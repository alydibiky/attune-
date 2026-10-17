/* ---- v6.32: where an answer comes from, on every answer (roadmap: "from your data / a pack / the web / calculated") -------
   A small line under each Chat answer says what it was built on, so people know how far to trust it:
     data   your own data (Ask your life, what you taught it, your project's notes)
     file   the file or photo you attached
     pack   an offline knowledge pack
     web    web pages (with the sources listed below it)
     calc   worked out by code on this phone (calculator, a program that was run, sums checked)
     model  none of these: the model's own knowledge — the least sure, so it says so.
   Pure; tests: tests/unit/v736source.test.mjs.                                                                               */

export const SOURCE_TEXT = {
  data: "your data", file: "your file", pack: "a knowledge pack", web: "the web", calc: "calculated on this phone", model: "the model's own knowledge",
};

/** The sources of one assistant message, most trusted first: ["calc", "web"], or ["model"] when nothing backs it. [] for cards. */
export function answerSources(m) {
  if (!m || m.role !== "assistant" || !m.text || m.card || m.error) return [];
  const out = [];
  if (m.lifeData || m.learnedUsed || m.projectKnowledge) out.push("data");
  if (m.fromFile || m.readInParts || m.fromPhotoTable) out.push("file");
  if ((m.kchips && m.kchips.length) || m.knowledgeUsed) out.push("pack");
  if ((m.sources || []).some((s) => /^https?:/i.test(String((s && s.url) || ""))) || m.factSheet) out.push("web");
  if (m.calc || m.verified || m.computed || m.codeCheck || m.fixedSlip) out.push("calc");
  return out.length ? out : ["model"];
}

/** The line itself, for a reader: "From: the web · calculated on this phone". tr = the app's translator. */
export function sourceLine(m, tr = (s) => s) {
  const s = answerSources(m);
  return s.length ? tr("From") + ": " + s.map((k) => tr(SOURCE_TEXT[k])).join(" · ") : "";
}

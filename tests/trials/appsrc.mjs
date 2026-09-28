// Pulls plain-JS pieces (no JSX) out of web-src/attune.jsx so the trials use the app's own prompt text,
// e.g. the Travel prompt and the country packs, instead of a copy that could drift.
import fs from "fs";
const SRC = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8").split("\n");
function block(start, endRx) {
  const i = SRC.findIndex((l) => l.startsWith(start));
  if (i < 0) throw new Error("not found in attune.jsx: " + start);
  let j = i; while (j < SRC.length && !(j > i && endRx.test(SRC[j])) && !(j === i && endRx.test(SRC[j]) && start.startsWith("const"))) j++;
  return SRC.slice(i, j + 1).join("\n");
}
/** The Travel tool: { packs, prompt(question, key, lang, entry) } — prompt() is aiTravelAsk's own text. */
export function travel() {
  const code = [
    block("const LANG_NAMES", /;\s*$/),
    block("function languageRule", /^}/),
    block("const ACCURACY_RULES", /`;\s*$/),
    block("const COUNTRY_PACKS = {", /^};/),
    block("async function aiTravelAsk", /^}/),
    "return { packs: COUNTRY_PACKS, ask: aiTravelAsk };",
  ].join("\n");
  const callClaude = async (content) => content;              // the prompt comes back instead of going to the model
  const detectScript = () => null;
  return new Function("callClaude", "detectScript", code)(callClaude, detectScript);
}

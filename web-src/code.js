import { getPower } from "./power.js";
/* ---- the Code workbench: write → run → fix, until the tests pass -------------------
   A phone-sized model writes code about as well as it can guess. What makes it
   reliable is the loop around it, the way a programmer works:

     1. it writes the program AND the tests for it, in one go;
     2. the phone runs both in the sandbox (offline, locked away);
     3. if anything fails, only the error goes back, and the model answers with
        the smallest edit (SEARCH/REPLACE blocks — a few lines, not the whole
        file again, so each round is quick);
     4. repeat until the tests pass (or give up honestly after a few rounds).

   The model can't "pass" by deleting its own tests: a fix that removes them is
   refused. Everything here is plain logic, tested in tests/unit/code.test.mjs;
   the model and the sandbox are passed in.                                        */

export const PASS_MARK = "ALL TESTS PASSED";
export const CODE_KEY = "attune:code:v1";

const FENCE = /^\s*```([\w+#.-]*)[^\n]*$/;

/** Fenced code blocks in a model answer: [{ lang, code, closed }]. */
export function extractBlocks(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(FENCE);
    if (!m) continue;
    const body = []; let j = i + 1;
    while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) body.push(lines[j++]);
    out.push({ lang: normLangName(m[1]), code: body.join("\n"), closed: j < lines.length });
    i = j;
  }
  return out;
}

export function normLangName(l) {
  const s = String(l || "").trim().toLowerCase();
  if (/^(py|python|python3)$/.test(s)) return "python";
  if (/^(js|javascript|node|mjs)$/.test(s)) return "javascript";
  if (/^(html|htm)$/.test(s)) return "html";
  return s;
}

/** The program in an answer: the longest block in the wanted language (or any runnable one). */
export function pickProgram(text, lang) {
  const bl = extractBlocks(text).filter((b) => b.code.trim());
  const runnable = (b) => ["python", "javascript", "html"].includes(b.lang);
  const pool = bl.filter((b) => b.lang === lang);
  const pick = (pool.length ? pool : bl.filter(runnable)).sort((a, b) => b.code.length - a.code.length)[0];
  if (pick) return { lang: runnable(pick) ? pick.lang : lang, code: pick.code };
  // No fences at all but it plainly is code (small models do this): take it whole.
  const t = String(text || "").trim();
  if (lang === "html" && /<(html|body|div|script)\b/i.test(t)) return { lang, code: t };
  if (lang === "python" && /^(def |import |from |class |print\()/m.test(t) && !/^[A-Z][a-z]+ [a-z]+ [a-z]+/.test(t)) return { lang, code: t };
  return null;
}

/** Guess the language someone wants from their words. */
export function guessLang(text) {
  const t = String(text || "").toLowerCase();
  if (/\b(html|web ?page|website|web app|landing|css|button on a page|صفحة|موقع)\b/.test(t)) return "html";
  if (/\b(javascript|js|node|typescript)\b|جافا ?سكريبت/.test(t)) return "javascript";
  return "python";
}

/** How many checks the program carries. */
export function countTests(code, lang) {
  const s = String(code || "");
  if (lang === "python") return (s.match(/^\s*assert\b/gm) || []).length;
  if (lang === "javascript") return (s.match(/\bassert(Equal)?\s*\(/g) || []).length;
  return 0;
}

// ---- edits --------------------------------------------------------------------------
const EDIT_RE = /<{5,9} ?SEARCH[^\n]*\n([\s\S]*?)\n?={5,9}[^\n]*\n([\s\S]*?)\n?>{5,9} ?REPLACE/g;

/** SEARCH/REPLACE blocks: [{ search, replace }]. */
export function parseEdits(text) {
  const s = String(text || "").replace(/\r/g, "");
  const out = []; let m;
  EDIT_RE.lastIndex = 0;
  while ((m = EDIT_RE.exec(s))) out.push({ search: m[1], replace: m[2] });
  return out;
}

const rstripLines = (s) => s.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n");

/**
 * Apply edits in order. Exact match first; then ignoring trailing spaces;
 * then ignoring indentation (re-indenting the replacement to fit).
 * → { code, applied, failed: [edit…] }
 */
export function applyEdits(code, edits) {
  let cur = String(code || "");
  const failed = []; let applied = 0;
  for (const e of edits) {
    const search = e.search.replace(/^\n+|\n+$/g, "");
    if (!search.trim()) {                                     // empty SEARCH = append
      cur = cur.replace(/\s*$/, "") + "\n" + e.replace.replace(/^\n+/, "") + "\n"; applied++; continue;
    }
    let i = cur.indexOf(search);
    if (i >= 0 && cur.indexOf(search, i + 1) < 0) { cur = cur.slice(0, i) + e.replace.replace(/^\n+|\n+$/g, "") + cur.slice(i + search.length); applied++; continue; }
    // trailing whitespace
    const lines = cur.split("\n");
    const want = rstripLines(search).split("\n");
    const at = findLines(lines, want, (a, b) => a.replace(/\s+$/, "") === b);
    const at2 = at >= 0 ? at : findLines(lines, want.map((l) => l.trim()), (a, b) => a.trim() === b);
    if (at2 < 0) { failed.push(e); continue; }
    // re-indent the replacement by the difference in indentation
    const have = (lines[at2].match(/^\s*/) || [""])[0];
    const had = (want[0].match(/^\s*/) || [""])[0];
    const rep = e.replace.replace(/^\n+|\n+$/g, "").split("\n").map((l) => (l.startsWith(had) ? have + l.slice(had.length) : l.trim() ? have + l.trimStart() : l));
    lines.splice(at2, want.length, ...rep);
    cur = lines.join("\n"); applied++;
  }
  return { code: cur, applied, failed };
}

function findLines(lines, want, eq) {
  let found = -1;
  outer: for (let i = 0; i + want.length <= lines.length; i++) {
    for (let k = 0; k < want.length; k++) if (!eq(lines[i + k], want[k])) continue outer;
    if (found >= 0) return -1;                                  // ambiguous: two places match
    found = i;
  }
  return found;
}

// ---- judging a run -------------------------------------------------------------------
/** The useful part of an error for the model: the end of the traceback, no noise. */
export function errorSummary(res, maxLines = 25) {
  const parts = [];
  if (res.timedOut) parts.push(res.error);
  else if (res.error) parts.push(String(res.error));
  if (!res.error && res.stderr) parts.push(String(res.stderr));
  const text = parts.join("\n").split("\n").filter((l) => !/^\s*File "<exec>"|pyodide\/|_pyodide|\/lib\/python3/.test(l));
  let out = text.slice(-maxLines).join("\n").trim();
  const tail = String(res.stdout || "").trim().split("\n").slice(-6).join("\n");
  if (tail) out += "\n\nLast lines it printed:\n" + tail;
  return out.slice(0, 2500);
}

/** v6.9: a bare Python `assert f(x) == 12.0` fails with no values, and a model then works the
 *  number out in its head (often wrongly: "10.55 × 1.14 = 11.987"), one test per round. After an
 *  AssertionError this builds a program that runs EVERY `assert A == B` and `assert abs(A - B) < tol`
 *  line as a print of what A really is (inside try, so the next ones still run), so the fix round is
 *  told for each wrong test "it expects 12.0, the program returns 12.03". → { probe, checks } or null */
const EQ_RE = /^(\s*)assert\s+(.+?)\s*==\s*(.+?)\s*(?:,\s*f?["'].*)?$/;
const ABS_RE = /^(\s*)assert\s+abs\((.+)\s-\s(.+?)\)\s*<=?\s*([\d.eE+-]+)\s*(?:,\s*f?["'].*)?$/;
export function assertProbe(code, res) {
  const err = String((res && (res.error || res.stderr)) || "");
  if (!/AssertionError/.test(err)) return null;
  const lines = String(code || "").split("\n"), out = [], checks = {};
  lines.forEach((l, i) => {
    const a = ABS_RE.exec(l), m = a || EQ_RE.exec(l);
    if (!m) { out.push(l); return; }
    const [ind, got, want] = [m[1], m[2], m[3]], n = i + 1;
    const pass = a ? `abs((_v) - (${want})) < ${a[4]}` : `_v == (${want})`;
    checks[n] = { line: l.trim(), want, got };
    out.push(`${ind}try:`, `${ind}    _v = ${got}`, `${ind}    print('__ACTUAL__', ${n}, ${pass}, repr(_v))`, `${ind}except Exception as _e:`, `${ind}    print('__ACTUAL__', ${n}, False, 'raises ' + type(_e).__name__)`);
  });
  return Object.keys(checks).length ? { probe: out.join("\n"), checks } : null;
}
/** The wrong tests the probe found: [{ line, want, got, value }] (at most 8). */
export function probeFindings(res, pr) {
  const found = [];
  for (const m of String((res && res.stdout) || "").matchAll(/^__ACTUAL__ (\d+) (True|False) (.+)$/gm)) {
    const c = pr && pr.checks[m[1]];
    if (c && m[2] === "False" && !found.some((f) => f.line === c.line)) found.push({ ...c, value: m[3].trim().slice(0, 200) });
  }
  return found.slice(0, 8);
}

/** v6.9: the source line a Python error points at (the error summary drops the "<exec>" frames, so
 *  a model never saw WHICH line failed), plus a hint when a test trips an error the program raises on
 *  purpose (`assert vat(-10) == 0` while vat refuses negatives). → { line, hint } or null */
export function failingLine(code, res) {
  const err = String((res && (res.error || res.stderr)) || "");
  const nums = [...err.matchAll(/File "<(?:exec|string|stdin)>", line (\d+)/g)].map((m) => +m[1]);
  if (!nums.length) return null;
  const src = String(code || "").split("\n"), at = (n) => (src[n - 1] || "").trim();
  const deep = at(nums[nums.length - 1]);
  const test = nums.map(at).reverse().find((l) => /^assert\b/.test(l)) || "";
  const line = test && test !== deep ? `${test}   (inside it: ${deep})` : deep;
  if (!line) return null;
  const exc = (/^(\w+(?:Error|Exception))\b/m.exec(err.split("\n").filter((l) => l.trim()).slice(-1)[0] || "") || [])[1];
  const onPurpose = exc && exc !== "AssertionError" && test && new RegExp("raise\\s+" + exc + "\\b").test(code);
  return { line, hint: onPurpose ? `That test calls code that raises ${exc} ON PURPOSE (the program is right to refuse). A test for a refusal must catch it: try: ... except ${exc}: pass (and fail if nothing was raised) — not compare a result.` : "" };
}

/** Did the run pass? { passed, reason } */
export function judge(res, code, lang) {
  const tests = countTests(code, lang);
  if (res.timedOut) return { passed: false, tests, reason: "timeout" };
  if (!res.ok) return { passed: false, tests, reason: "error" };
  if (lang === "html") return { passed: !(res.errors && res.errors.length), tests, reason: res.errors && res.errors.length ? "error" : "ok" };
  if (tests > 0 && !String(res.stdout || "").includes(PASS_MARK)) return { passed: false, tests, reason: "no-pass-mark" };
  return { passed: true, tests, reason: tests ? "tests" : "no-tests" };
}

// ---- what the model is told -----------------------------------------------------------
const RULES = {
  python: "Python 3 that runs offline in a sandbox on a phone: no internet, no files outside the current folder, no input(), no GUI. The standard library plus numpy, pandas and sympy are available.",
  javascript: "plain JavaScript (ES2022) that runs in a sandbox: no imports, no DOM, no Node modules, no internet. Print with console.log. assert(condition, message) and assertEqual(actual, expected) are available for tests.",
  html: "ONE self-contained HTML file (inline <style> and <script>, no external links, fonts or images from the internet) that works on a phone screen. No alert().",
};
const TESTS = {
  python: `End the code block with a line "# --- tests ---", then 3 to 6 assert statements that check the important cases, including an edge case, and finally print("${PASS_MARK}").`,
  javascript: `End the code block with a line "// --- tests ---", then 3 to 6 assert(...) or assertEqual(...) calls on the important cases, including an edge case, and finally console.log("${PASS_MARK}").`,
  html: "Make it work without errors when the page loads, starting in its clean initial state (no demo actions on load).",
};
const FENCE_LANG = { python: "python", javascript: "javascript", html: "html" };

// A web page is a product, not a program with a demo: v5.13 pages ran their
// "demo" on load (a crane simulator that opened with ten "Lowered hook" lines
// already in its log). Pages get their own brief — start clean, look finished,
// be usable by thumb — which is most of what separates a good single-prompt
// site from a toy on a small model. (v5.14)
const HTML_BRIEF = `You are an expert front-end developer and product designer. Write ONE complete, self-contained HTML file (inline <style> and <script>; no external links, fonts, images or libraries — draw pictures with inline SVG or <canvas>) that works offline on a phone.
Quality bar — it must look and feel like a finished, professional product:
- Start with <!doctype html>, <meta name="viewport" content="width=device-width, initial-scale=1">, a <title>.
- Design: CSS variables for a small colour palette (one accent colour), system-ui font, generous spacing, rounded cards, soft shadows, clear hierarchy (one big title, short subtitle). Mobile first: a single column that fits 360 px wide, buttons at least 44 px tall. Support dark mode with @media (prefers-color-scheme: dark).
- Build EVERYTHING the request implies, with real content (no "Lorem ipsum", no "TODO", no placeholder links). A website → a header with navigation, a hero, the sections the topic needs, a footer. A tool/app → the working tool with inputs, results and sensible defaults. A game or simulator → a visual scene drawn with SVG or canvas that the controls actually move, plus a score/status line.
- Every element the request names is there AS that element: "a table" is a real <table> (not cards), "a form" a working <form>, "a button" a real button or link.
- The page opens in its clean initial state: never click buttons, run a demo or fill logs automatically on load. Anything shown in a log/list comes from the user's own actions.
- State kept in localStorage when the user would expect it to persist (lists, settings, scores); wrap it in try/catch.
- No alert(), prompt() or confirm(); show messages in the page. No console errors.
Keep it compact so it fits in one answer: CSS rules short and shared (no repeated blocks), no comments.
Reply with ONE \`\`\`html code block holding the whole file. No explanation before it; after it at most two short sentences.`;

/**
 * Is a web page about what was asked? v5.16 was asked for "a website for a
 * clothing brand called skittlz" and wrote "ZenFlow: Focus Timer". The words
 * that name the thing (a brand, a product, the business) must appear in the
 * page. → true / false (true when the request names nothing checkable). (v5.17)
 */
const TOPIC_STOP = new Set("make create build write design website web site page landing single simple modern beautiful professional nice good cool full complete with that this for called named about the and a an of to in on my our your me please html app application tool using which have has some".split(" "));
export function topicWords(task) {
  const t = String(task || "");
  // the word after "called / named / brand / company" is the name ("brand called skittlz")
  const toks = t.replace(/["“”']/g, " ").split(/\s+/).filter(Boolean);
  const named = [];
  toks.forEach((w, i) => { if (/^(called|named|brand|company)$/i.test(w) && toks[i + 1] && /^[A-Za-z][\w&-]{2,}$/.test(toks[i + 1].replace(/[.,!?]$/, ""))) named.push(toks[i + 1].replace(/[.,!?]$/, "")); });
  const words = t.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [];
  const rest = words.filter((w) => !TOPIC_STOP.has(w));
  return { named: [...new Set(named.map((x) => x.toLowerCase()).filter((w) => !TOPIC_STOP.has(w)))], words: [...new Set(rest)] };
}
export function onTopic(task, code) {
  const { named, words } = topicWords(task);
  const c = String(code || "").toLowerCase();
  if (named.length) return named.some((w) => c.includes(w));
  if (!words.length) return true;
  const hits = words.filter((w) => c.includes(w.replace(/s$/, ""))).length;
  return hits >= Math.min(2, words.length);
}

export function writeMessages(task, lang, { retry = false } = {}) {
  if (lang === "html") {
    const { named } = topicWords(task);
    return [
      { role: "system", content: HTML_BRIEF },
      { role: "user", content: `Build exactly this: ${String(task || "").trim()}
The page must be about THIS and nothing else${named.length ? ` — use the name "${named[0]}" in the <title>, the header and the text` : ""}.${retry ? "\nYOUR LAST PAGE WAS ABOUT SOMETHING ELSE. Start again and build what was asked." : ""}` },
    ];
  }
  return [
    { role: "system", content: `You are an expert programmer. Write ${RULES[lang]}\nReply with ONE code block (\`\`\`${FENCE_LANG[lang]}) holding the complete program: first the program itself with a short demo that prints results, then its tests. ${TESTS[lang]}\nNo explanation before the code. After the code, at most two short sentences.` },
    { role: "user", content: String(task || "").trim() },
  ];
}

/** A second, different attempt after the fix rounds got stuck: the task again, plus what went wrong so far. */
export function restartMessages({ task, lang, code, history }) {
  const base = writeMessages(task, lang);
  const notes = history.slice(-3).map((h, i) => `${i + 1}. ${String(h).slice(0, 500)}`).join("\n");
  return [base[0], { role: "user", content: `${String(task || "").trim()}\n\nA first attempt got stuck. These are the errors it kept hitting:\n${notes}\n\nIts last version (do NOT patch it — it takes a wrong approach somewhere):\n\`\`\`\n${String(code).slice(0, 2500)}\n\`\`\`\nWrite the whole program again from scratch with a DIFFERENT, simpler approach. Think about the edge cases first, then reply with the one code block.` }];
}

export function fixMessages({ task, lang, code, error, change }) {
  const why = change
    ? `Change the program as asked: ${change}\nKeep everything else working, and update or add tests for the change.`
    : `It fails:\n\`\`\`\n${error}\n\`\`\`\nFix the cause with the smallest change. Do not delete or weaken the tests unless a test itself is wrong.`;
  return [
    { role: "system", content: `You are an expert programmer fixing ${lang === "html" ? "a web page" : "a program"}. The code is ${RULES[lang]}\nAnswer with edit blocks only, each exactly like this:\n<<<<<<< SEARCH\n(lines copied exactly from the current code)\n=======\n(the new lines)\n>>>>>>> REPLACE\nUse as many blocks as needed; each SEARCH must match the current code exactly and only once. If most of the code must change, reply instead with the whole new program in one \`\`\`${FENCE_LANG[lang]} code block (with its tests).` },
    { role: "user", content: `Task: ${String(task || "").trim()}\n\nCurrent code:\n\`\`\`${FENCE_LANG[lang]}\n${code}\n\`\`\`\n\n${why}` },
  ];
}

/** Turn a model's fix answer into new code. → { code, how, error? } */
export function applyFix(answer, code, lang) {
  const edits = parseEdits(answer);
  if (edits.length) {
    const r = applyEdits(code, edits);
    if (!r.failed.length) return { code: r.code, how: "edits", edits: edits.length };
    // Some edits didn't match: a whole program in the same answer wins, else report.
    const whole = pickProgram(answer.replace(EDIT_RE, ""), lang);
    if (whole && whole.code.split("\n").length > 3) return { code: whole.code, how: "rewrite" };
    if (r.applied) return { code: r.code, how: "edits", edits: r.applied, partial: r.failed.length };
    return { code, how: "none", error: "The fix did not match the code." };
  }
  const whole = pickProgram(answer, lang);
  if (whole) return { code: whole.code, how: "rewrite" };
  return { code, how: "none", error: "The model answered without code." };
}

// ---- v5.42: a page cut off by the answer limit is continued, not shown half-written ----
// Ali: "find why it didn't finish the code of the website". On a phone the engine opens a 4k window,
// so a page may use ~2,000 tokens; a full site with its CSS needs more and stopped mid-tag.
/** A web page that stops before </html> (the answer limit cut it). */
export function isCutHtml(code) {
  const c = String(code || "").trim().toLowerCase();
  if (!/<!doctype html|<html[\s>]/.test(c)) return false;
  return !/<\/html>\s*$/.test(c);
}
export function continueMessages(task, tail) {
  return [
    { role: "system", content: "You are finishing a single-file web page that was cut off in the middle. Output ONLY the rest of the file: start with the very next characters after the last ones shown, never repeat what is already written, no explanation, no ``` fence. Keep the same style and IDs, close every open tag, <style> and <script>, and end with </html>." },
    { role: "user", content: `The page: ${String(task || "").trim()}\n\nThe file so far ends with:\n${tail}` },
  ];
}
/** The page so far + the continuation: fences dropped, any repeated overlap removed. */
export function joinCont(code, more) {
  let m = String(more || "").replace(/^\s*```[a-z]*\s*\n?/i, "").replace(/\n?```[\s\S]*$/, "");
  // a model that restarted the whole file: keep only what comes after the part already written
  if (/^\s*(<!doctype|<html)/i.test(m)) { const tail = code.slice(-120); const k = m.indexOf(tail); m = k >= 0 ? m.slice(k + tail.length) : ""; }
  // overlap: the continuation repeats the last characters (up to 400)
  for (let k = Math.min(400, m.length, code.length); k >= 8; k--) if (code.endsWith(m.slice(0, k))) { m = m.slice(k); break; }
  return code + m;
}

/**
 * The loop. llm(messages, { maxTokens, onToken }) → text; run(lang, code) → run result.
 * onEvent({ type, round, … }) reports every step for the screen.
 * → { ok, code, lang, rounds, last, tests, gaveUp? }
 */
export async function workLoop({ task, lang, code: startCode = "", change = "", llm, run, onEvent = () => {}, maxRounds = 4, restart = true, isStopped = () => false }) {
  let code = startCode, round = 0, last = null, verdict = null;
  const tried = new Set();                                  // code versions that already failed
  const history = [];                                       // the errors seen, for a fresh start
  let restarted = false;
  let sameAgain = false;                                    // the last fix answer changed nothing
  const stopped = () => { if (isStopped()) throw new Error("Stopped"); };

  const write = async () => {
    onEvent({ type: "write", round });
    const ans = await llm(writeMessages(task, lang), { maxTokens: lang === "html" ? getPower().codeTokens : Math.max(2000, Math.floor(getPower().codeTokens / 2)), onToken: (t) => onEvent({ type: "writing", round, text: t }) });
    let p = pickProgram(ans, lang);
    if (!p) throw new Error("The model answered without any code — try asking again in other words.");
    // A page about something else is written again, once, with the topic pinned.
    if ((p.lang || lang) === "html" && !onTopic(task, p.code)) {
      onEvent({ type: "offtopic", round });
      const again = await llm(writeMessages(task, "html", { retry: true }), { maxTokens: getPower().codeTokens, onToken: (t) => onEvent({ type: "writing", round, text: t }) });
      const p2 = pickProgram(again, "html");
      if (p2 && onTopic(task, p2.code)) p = p2;
    }
    lang = p.lang || lang; code = p.code;
    // cut off before </html> → continue from where it stopped (up to 3 times)
    for (let k = 0; k < 3 && lang === "html" && isCutHtml(code); k++) {
      stopped();
      onEvent({ type: "continue", round, part: k + 2 });
      const more = await llm(continueMessages(task, code.slice(-1800)), { maxTokens: getPower().codeTokens, onToken: (t) => onEvent({ type: "writing", round, text: code + t }) });
      const next = joinCont(code, more);
      if (next.length <= code.length + 5) break;
      code = next;
    }
    onEvent({ type: "wrote", round, code, lang, tests: countTests(code, lang) });
  };
  const exec = async () => {
    stopped();
    onEvent({ type: "run", round, code });
    last = await run(lang, code);
    verdict = judge(last, code, lang);
    onEvent({ type: "result", round, res: last, verdict });
    return verdict.passed;
  };
  const fix = async (why) => {
    stopped();
    round++;
    const before = countTests(code, lang);
    onEvent({ type: "fix", round, error: why.error, change: why.change });
    const ans = await llm(fixMessages({ task, lang, code, error: why.error, change: why.change }), { maxTokens: lang === "html" ? 1600 : Math.max(2000, Math.floor(getPower().codeTokens / 2)), onToken: (t) => onEvent({ type: "fixing", round, text: t }) });
    const r = applyFix(ans, code, lang);
    if (r.how === "none") { onEvent({ type: "fixfail", round, error: r.error }); return false; }
    if (r.code.trim() === code.trim()) { sameAgain = true; onEvent({ type: "fixfail", round, error: "The fix changed nothing." }); return false; }
    const after = countTests(r.code, lang);
    if (before > 0 && after === 0) { onEvent({ type: "fixfail", round, error: "The fix deleted the tests — refused." }); return false; }
    code = r.code;
    onEvent({ type: "fixed", round, code, how: r.how, edits: r.edits || 0, tests: after });
    return true;
  };

  if (!code.trim()) { await write(); }
  else if (change) { await fix({ change }); }
  let ok = await exec();
  while (!ok && round < maxRounds) {
    const reason = verdict.reason === "no-pass-mark"
      ? `The program ran but never printed "${PASS_MARK}" — the tests did not all run.\n` + errorSummary(last)
      : errorSummary(last);
    let told = reason;
    if (sameAgain) told = "YOUR LAST ANSWER CHANGED NOTHING (its REPLACE text was the same as its SEARCH text). Change the line that actually fails.\n" + told;
    else if (tried.has(code)) told = "YOUR LAST CHANGE BROUGHT BACK CODE THAT ALREADY FAILED. Do something different this time.\n" + told;
    sameAgain = false;
    const eg = /expected (.{1,80}?), got (.{1,80}?)(?: —|$)/m.exec(String(last && (last.error || last.stderr) || ""));
    if (eg) told += `\n\nThe program returns ${eg[2]} where a test expects ${eg[1]}. Work out which one is right, step by step. If the program is right and the test's expected value is wrong, change ${eg[1]} in that test line; otherwise fix the program.`;
    tried.add(code); history.push(errorSummary(last, 8));
    const fl = lang === "python" ? failingLine(code, last) : null;
    if (fl) told += `\n\nThe line that failed: ${fl.line}` + (fl.hint ? "\n" + fl.hint : "");
    const pr = lang === "python" ? assertProbe(code, last) : null;
    if (pr) {
      stopped();
      let wrong = [];
      try { wrong = probeFindings(await run(lang, pr.probe), pr); } catch (e) {}
      if (wrong.length) told += `\n\nWhat the program REALLY returns for the failing tests (the app ran them):\n` + wrong.map((w) => `- ${w.line}\n  expects ${w.want}, but ${w.got} returns ${w.value}`).join("\n") + `\nFor each one, work out which is right (do the arithmetic step by step). If the program is right and the test's expected value was worked out wrong, correct that expected value; otherwise fix the program. Fix them ALL in this round.`;
    }
    if (!(await fix({ error: told }))) continue;          // unusable answer: ask again (counts as a round)
    ok = await exec();
  }
  // stuck: one fresh attempt with a different approach, then a few more fix rounds
  if (!ok && restart && !restarted && lang !== "html" && history.length) {
    restarted = true; stopped();
    onEvent({ type: "restart", round });
    try {
      const ans = await llm(restartMessages({ task, lang, code, history }), { maxTokens: Math.max(2000, Math.floor(getPower().codeTokens / 2)), onToken: (t) => onEvent({ type: "writing", round, text: t }) });
      const p = pickProgram(ans, lang);
      if (p && p.code.trim() && p.code.trim() !== code.trim() && countTests(p.code, lang) > 0) {
        code = p.code; onEvent({ type: "wrote", round, code, lang, tests: countTests(code, lang) });
        ok = await exec();
        let extra = 0;
        while (!ok && extra < 2) {
          extra++;
          if (!(await fix({ error: errorSummary(last) }))) continue;
          ok = await exec();
        }
      }
    } catch (e) { if (String(e && e.message) === "Stopped") throw e; }
  }
  const res = { ok, code, lang, rounds: round, last, tests: countTests(code, lang), gaveUp: !ok };
  onEvent({ type: "done", ...res });
  return res;
}

// ---- saved projects ------------------------------------------------------------------
export function loadProjects() { try { const v = JSON.parse(localStorage.getItem(CODE_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
export function saveProjects(list) { try { localStorage.setItem(CODE_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) {} }

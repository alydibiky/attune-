/* ---- v9.1 (Ali, 4 Nov 2026: "can't they just be in home chat — I write 'improve this prompt for Claude' or 'humanize this'"):
   the prompt tools' pages are archived; Chat reads the request and runs the SAME tuned instructions (attune.jsx aiRewrite /
   aiHumanize / aiCompressTarget). Pure; tests: tests/unit/v911prompttools.test.mjs.

   promptToolOf(text) → { kind: "improve" | "humanize" | "shorten", target?: "claude" | "chatgpt" | …, pct?: number, text: "…" } | null
   text "" = the request names no text ("humanize this") → Chat uses its own last answer.                                        */

const TARGETS = [["claude", /claude|كلود/i], ["chatgpt", /chat ?gpt|gpt|شات ?جي ?بي ?تي/i], ["gemini", /gemini|جيميناي|جمناي/i], ["grok", /grok|جروك/i],
  ["deepseek", /deep ?seek|ديب ?سيك/i], ["manus", /manus|مانوس/i], ["perplexity", /perplexity|بيربلكستي/i], ["notebooklm", /notebook ?lm/i]];
const AI_NAMES = "(?:claude|chat ?gpt|gpt|gemini|grok|deep ?seek|manus|perplexity|notebook ?lm|كلود|شات ?جي ?بي ?تي|جيميناي|جمناي|جروك|ديب ?سيك|مانوس)";

// the request, then optionally ":" / "-" / a new line, then the text it is about
const IMPROVE = new RegExp("^\\s*(?:please\\s+)?(?:improve|rewrite|fix|optimi[sz]e|polish|make (?:a )?better)\\s+(?:this|my|the)?\\s*prompt(?:\\s+(?:for|to use (?:in|with)|in)\\s+(" + AI_NAMES + "))?\\s*(?:[:\\-–—]|\\n|$)\\s*([\\s\\S]*)$", "i");
const IMPROVE_AR = new RegExp("^\\s*(?:حسّ?ن|حسن|ظبط|ظبّط|اكتب(?:لي)? احسن|عدل|عدّل)\\s+(?:لي\\s+)?(?:ال)?(?:برومبت|بروميت|prompt|الامر|الأمر)\\s*(?:ده|دي|دا)?(?:\\s+(?:ل|عشان|علشان)\\s*(" + AI_NAMES + "))?\\s*(?:[:\\-–—]|\\n|$)\\s*([\\s\\S]*)$", "i");
const HUMAN = /^\s*(?:please\s+)?(?:humani[sz]e|make (?:this|it) (?:sound )?(?:more )?human|rewrite (?:this|it) (?:like|as) a human(?: wrote it)?|make (?:this|it) (?:sound )?natural)\s*(?:this|it)?\s*(?:[:\-–—]|\n|$)\s*([\s\S]*)$/i;
const HUMAN_AR = /^\s*(?:خلي(?:ه|ها)|خلّي(?:ه|ها)|اكتب(?:ه|ها)(?: تاني)?)\s+(?:طبيعي|بشري|كأن? (?:بني آدم|انسان|إنسان) كاتب(?:ه|ها))\s*(?:[:\-–—]|\n|$)\s*([\s\S]*)$/i;
const SHORT = /^\s*(?:please\s+)?(?:make (?:this|it) shorter|shorten(?: this| it)?|compress(?: this| it)?(?: prompt)?|cut (?:this|it) down)(?:\s+by\s+(\d{1,2})\s*%)?\s*(?:[:\-–—]|\n|$)\s*([\s\S]*)$/i;
const SHORT_AR = /^\s*(?:اختصر(?:ه|ها|لي)?|قصّ?ر(?:ه|ها)?|خلي(?:ه|ها) اقصر|خلي(?:ه|ها) أقصر)(?:\s+(\d{1,2})\s*%)?\s*(?:[:\-–—]|\n|$)\s*([\s\S]*)$/i;

const targetOf = (name) => (name ? (TARGETS.find(([, re]) => re.test(name)) || [])[0] || null : null);
const body = (t) => String(t || "").trim();

export function promptToolOf(text) {
  const t = String(text || "");
  if (!t.trim() || t.length > 12000) return null;
  let m = IMPROVE.exec(t) || IMPROVE_AR.exec(t);
  if (m) return { kind: "improve", target: targetOf(m[1]) || "chatgpt", text: body(m[2]) };
  m = HUMAN.exec(t) || HUMAN_AR.exec(t);
  if (m) return { kind: "humanize", text: body(m[1]) };
  m = SHORT.exec(t) || SHORT_AR.exec(t);
  if (m) return { kind: "shorten", pct: m[1] ? Math.min(90, Math.max(10, +m[1])) : 40, text: body(m[2]) };
  return null;
}

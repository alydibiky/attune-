/* ---- Every message gets answered, however long (v5.27) --------------------------------------
   Ali: "I don't want to send anything, no matter how long, that doesn't get answered — even if
   it takes time on small models." A phone model has a fixed window (8k–32k tokens). Until now
   a message or file bigger than that failed ("longer than this model can read") or was cut
   silently, and an answer that hit the length limit waited for a "Continue" tap. Now:

     - READ IN PARTS: a message / file too big for the window is split on paragraph lines
       into parts that fit; the model writes notes from each part FOR THE USER'S REQUEST
       (numbers, names, code copied exactly); if all the notes are still too big they are
       merged again; then the request is answered from the notes.
     - AUTO-CONTINUE: an answer cut by the length limit carries on by itself, the model seeing
       the END of what it wrote (not the start), until it is done.
   Pure helpers; unit-tested in tests/unit/v527.test.mjs. The loop lives in chat.jsx.         */

/** Rough token count: ~3.6 characters per token for Latin text, ~2.2 for Arabic. */
export function estTokens(text) {
  const s = String(text || "");
  const ar = (s.match(/[؀-ۿ]/g) || []).length;
  return Math.ceil(ar / 2.2 + (s.length - ar) / 3.6);
}

/** Characters per token of this text (Arabic-heavy text is denser: fewer characters per token). */
export function charsPerToken(sample) {
  const s = String(sample || "").slice(0, 20000);
  return s.length < 200 ? 3.0 : Math.max(2.0, Math.min(3.6, s.length / Math.max(1, estTokens(s))));
}

/**
 * How many characters of `sample`-like text fit, leaving room for the system prompt and the
 * answer (with a 10 % safety margin).
 */
export function fitChars(ctx, answerTokens, systemTokens = 1400, sample = "") {
  const room = Math.max(600, (ctx || 8192) - (answerTokens || 2048) - systemTokens - 300);
  return Math.floor(room * charsPerToken(sample) * 0.9);
}

/** Does this text need to be read in parts? */
export function tooLong(text, ctx, answerTokens) {
  return String(text || "").length > fitChars(ctx, answerTokens, 1400, text);
}

/** Split on paragraph / line boundaries into parts of at most `size` characters. */
export function splitParts(text, size) {
  const s = String(text || ""), out = [];
  let cur = "";
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (const para of s.split(/\n{2,}/)) {
    const pieces = para.length <= size ? [para] : para.split(/\n/);
    for (let p of pieces) {
      while (p.length > size) {                        // one huge line: cut at a sentence or space
        let cut = Math.max(p.lastIndexOf(". ", size), p.lastIndexOf(" ", size));
        if (cut < size * 0.5) cut = size;
        if (cur) flush();
        out.push(p.slice(0, cut + 1).trim()); p = p.slice(cut + 1);
      }
      if (cur.length + p.length + 2 > size) flush();
      cur += (cur ? "\n\n" : "") + p;
    }
  }
  flush();
  return out;
}

/** What the user is asking for in a long message: its beginning and its end (where people put the ask). */
export function requestOf(text, n = 700) {
  const s = String(text || "").trim();
  if (s.length <= n * 2 + 50) return s;
  return s.slice(0, n).trim() + "\n[…]\n" + s.slice(-n).trim();
}

export function partNotesMessages(request, part, i, n) {
  return [
    { role: "system", content: "You read ONE part of a long message and write compact NOTES for the user's request. Keep every fact, number, name, date, code line and instruction that the request needs, copied exactly. No commentary. If this part has nothing the request needs, reply: NONE" },
    { role: "user", content: `THE USER'S REQUEST (beginning and end of their message):\n${request}\n\nPART ${i} OF ${n}:\n<<<\n${part}\n>>>\n\nNOTES:` },
  ];
}

/** The final request, answered from the notes of every part. */
export function fromNotes(request, notes, n, fileName) {
  const what = fileName ? `the file "${fileName}"` : "a very long message";
  return `The user sent ${what} (${n} parts) — too long to read at once, so it was read part by part into the notes below.\n\nTHEIR REQUEST:\n${request}\n\nNOTES FROM EVERY PART:\n${notes}\n\nNow do the request completely, using the notes. Don't mention the notes or the parts.`;
}

/** Messages that make the model carry on from the END of what it already wrote. */
export function continueMessages(system, question, soFar, ar) {
  const tail = String(soFar || "").slice(-2600);
  return [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: String(question || "").slice(0, 2500) },
    { role: "assistant", content: (soFar.length > tail.length ? "…" : "") + tail },
    { role: "user", content: ar ? "كمّل من المكان اللي وقفت عنده بالظبط. متكررش أي حاجة كتبتها، وابدأ بالكلمة اللي بعدها على طول."
      : "Continue exactly where you stopped. Do not repeat anything you already wrote — start with the very next word." },
  ];
}

/** Join a continuation onto an answer without a doubled or missing space. */
export function glue(a, b) {
  const t = String(b || "").replace(/^\s+/, "");
  return a + (/\s$/.test(a) || /^[,.;:!?)\]]/.test(t) ? "" : (/\n\s*$/.test(a) ? "" : " ")) + t;
}

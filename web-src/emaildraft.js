/* ---- v8.7 (Ali, 29 Oct: "I want the app to draft the emails in Gmail and send with my confirmation, like Gemini") ------------
   "email Ahmed@x.com that the meeting moved to Sunday", «ابعت ايميل لمدير الموقع إن الونش اتأخر», "/email …".
   1. isEmailAsk(text)      a request to write an email (not a question about email)
   2. parseEmailAsk(text)   → { to, toName, about, lang, formal } — the address by code, the person's name, what to say
   3. draftMessages(ask)    the model writes it: JSON { subject, body } (short, in the language asked, signed with the person's name)
      readDraft(answer, ask) the model's answer → { subject, body } (falls back to the person's own words)
   4. The card shows To / Subject / Body to change; NOTHING is sent without a tap:
        "Open in Gmail"  → Gmail's own compose screen, filled in (mailto) — you press Send in Gmail (works today)
        "Send"           → sent from your Gmail directly (gmail.send) once Gmail is connected (docs/GMAIL_VERIFICATION.md)
   mailtoOf(d)              the mailto: link. Pure; tests: tests/unit/v870email.test.mjs.                                     */
export const EMAIL_RX = /^\s*(?:\/email\b|(?:please\s+)?(?:can you\s+)?(?:write|draft|send|compose|prepare|reply)\b[^.?!\n]{0,40}\b(?:e-?mail|mail)\b|e-?mail\s+(?:to\s+)?\S+@|e-?mail\s+[A-Z؀-ۿ]|(?:اكتب|ابعت|ابعث|جهز|جهّز|حضر|رد|اكتبلي|ابعتلي|ابعتلى)\s*(?:لي\s*)?(?:ايميل|إيميل|ميل|بريد|رسالة ايميل)|(?:ايميل|إيميل)\s+(?:ل|لـ|الى|إلى)\s*\S+|(?:ektb|ebaat|eb3at|ab3at)\s+(?:email|ìmail|e-mail))/i;
const QUESTION = /^(?:how|what|why|when|where|can i|is it|do i|كيف|ازاي|إزاي|ليه|امتى|فين|هل)\b/i;
export const isEmailAsk = (t) => { const s = String(t || "").trim(); return s.length >= 6 && s.length <= 1500 && EMAIL_RX.test(s) && !(QUESTION.test(s) && /\?|؟/.test(s) && !/\S+@\S+/.test(s)); };

const ADDR = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** → { to: ["a@b.com"], toName, about, lang: "ar"|"en", formal } */
export function parseEmailAsk(text) {
  const s = String(text || "").replace(/^\s*\/email\b\s*/i, "").trim();
  const to = [...new Set((s.match(ADDR) || []).map((a) => a.toLowerCase()))];
  const ar = /[؀-ۿ]/.test(s.replace(ADDR, ""));
  let rest = s.replace(ADDR, " ");
  // the person: "to Ahmed", «لأحمد» / «للمهندس محمد» / «لمدير الموقع»
  let toName = "";
  const en = rest.match(/\b(?:to|for)\s+((?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Eng\.?)?\s*[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)/);
  const arM = rest.match(/(?:ايميل|إيميل|ميل)\s+(?:ل|لـ\s*|الى\s+|إلى\s+)((?:ال)?[؀-ۿ]+(?:\s+(?!إن|ان|انه|إنه|اني|إني|عن|بخصوص|يقول|اقوله|أقوله)[؀-ۿ]+)?)/) || rest.match(/(?:^|\s)ل((?:ل)?[؀-ۿ]{2,}(?:\s+(?!إن|ان|انه|إنه|اني|إني|عن|بخصوص)[؀-ۿ]+)?)\s+(?:إن|ان|انه|إنه|اني|إني|عن|بخصوص)/);
  if (en) toName = en[1].trim(); else if (arM) toName = arM[1].replace(/^ل(?=ال)/, "").trim();
  // what to say: after "that / about / saying / telling", «إن / عن / بخصوص / اقوله»; else the whole sentence minus the command
  const said = rest.match(/\b(?:that|about|saying|telling (?:him|her|them)|to say|regarding|asking (?:him|her|them)?\s*(?:to|for)?)\s+([\s\S]+)$/i) || rest.match(/(?:^|\s)(?:إن|ان|انه|إنه|إنها|انها|اني|إني|عن|بخصوص|يقول|اقوله|أقوله|اقولها|وقوله|وقولها|اسأله|أسأله)\s+([\s\S]+)$/);
  let about = said ? said[1] : rest.replace(EMAIL_RX, " ").replace(/\b(?:to|for)\s+\S+/i, " ");
  about = about.replace(/\s+/g, " ").trim().replace(/^[,:-]\s*/, "");
  const formal = /\b(formal|professional|official|boss|manager|client|company|hr)\b|رسمي|رسمى|المدير|مدير|العميل|الشركة|الشركه|الموارد البشرية/i.test(s);
  return { to, toName, about, lang: ar ? "ar" : "en", formal };
}

/** The model's job: a short, ready email, as JSON. */
export function draftMessages(ask, { me = "", today = new Date() } = {}) {
  const lang = ask.lang === "ar" ? "Arabic (polite Egyptian-friendly Modern Standard Arabic for an email)" : "English";
  return [
    { role: "system", content: `You write ONE email, ready to send. Reply with JSON only: {"subject": "...", "body": "..."}.
Language: ${lang}. Tone: ${ask.formal ? "formal and professional" : "friendly and clear"}. 4–10 short lines. Greeting${ask.toName ? " to " + ask.toName : ""}, the message, a closing${me ? ", signed " + me : ""}.
Say exactly what the user asked — never invent dates, amounts, names or promises they didn't give. Today is ${today.toDateString()}.` },
    { role: "user", content: `Write an email${ask.toName ? " to " + ask.toName : ""}${ask.to.length ? " (" + ask.to.join(", ") + ")" : ""}. What to say: ${ask.about || "(see my request)"}` },
  ];
}

/** The model's answer → { subject, body }; a broken answer → the person's own words as the body. */
export function readDraft(answer, ask) {
  const a = String(answer || "");
  let j = null; try { const m = a.match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null; } catch (e) { j = null; }
  let subject = j && typeof j.subject === "string" ? j.subject.trim() : "", body = j && typeof j.body === "string" ? j.body.trim() : "";
  if (!body && a && !/^\s*\{/.test(a)) body = a.replace(/^subject\s*:.*$/im, "").trim();
  if (!subject) { const m = a.match(/^subject\s*:\s*(.+)$/im); subject = m ? m[1].trim() : ""; }
  return fallbackDraft(ask, { subject, body });
}
/** No model (or a broken answer): a plain, correct email from what was said. */
export function fallbackDraft(ask, got = {}) {
  const ar = ask.lang === "ar", about = String(ask.about || "").trim();
  const cap = about.charAt(0).toUpperCase() + about.slice(1);
  const subject = (got.subject || (about ? cap.split(/[.,،\n]/)[0].slice(0, 60) : ar ? "رسالة" : "Message")).replace(/\s+/g, " ");
  const body = got.body || (ar ? `${ask.toName ? "أهلاً " + ask.toName + "،" : "أهلاً،"}\n\n${about}\n\nمع التحية`
    : `${ask.toName ? "Hi " + ask.toName + "," : "Hi,"}\n\n${cap}${/[.!?]$/.test(cap) ? "" : "."}\n\nBest regards`);
  return { subject, body };
}

/** The mailto: link Gmail (or any mail app) opens with everything filled in. */
export function mailtoOf({ to = [], subject = "", body = "", cc = [] } = {}) {
  const q = [subject ? "subject=" + encodeURIComponent(subject) : "", body ? "body=" + encodeURIComponent(body) : "", cc.length ? "cc=" + encodeURIComponent(cc.join(",")) : ""].filter(Boolean).join("&");
  return "mailto:" + (to || []).map(encodeURIComponent).join(",") + (q ? "?" + q : "");
}
export const validAddr = (a) => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(a || "").trim());
export const addrsOf = (s) => String(s || "").split(/[\s,;،]+/).map((x) => x.trim()).filter(Boolean);

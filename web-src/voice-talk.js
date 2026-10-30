import { tr } from "./i18n.js";
/* v8.6 (Ali, 27 Oct: "fix the voice part for good or remove it" — «hello» got "I didn't get that"): what the voice screen
   says when the words are not a command — small talk by code, the model's answer made fit to be spoken. */
/** Hello / thanks / how are you — answered by code at once (no model needed). */
export function smallTalk(text, ui = "en") {
  const t = String(text || "").trim().toLowerCase().replace(/[!.?؟،,]+/g, "").trim();
  const ar = ui === "ar" || /[\u0600-\u06ff]/.test(t);
  if (/^(?:hi|hello|hey|hey there|hi there|good (?:morning|evening|afternoon)|ya attune|hey attune|السلام عليكم|سلام عليكم|سلام|اهلا|أهلا|ازيك|إزيك|ازيك يا أتيون|صباح الخير|مساء الخير|هاي|هلا|مرحبا|يا أتيون|يا اتيون)$/.test(t))
    return ar ? (/السلام|سلام/.test(t) ? "وعليكم السلام! " : "أهلاً! ") + "أقدر أساعدك في إيه؟ قول مثلاً: ابعت لأحمد، فكرني بكرة الساعة ٩، أو اسألني أي سؤال." : "Hi! How can I help? Say for example: message Ahmed, remind me tomorrow at 9, or ask me anything.";
  if (/^(?:thanks|thank you|thx|شكرا|شكراً|متشكر|تسلم|ميرسي|merci)$/.test(t)) return ar ? "العفو! عايز حاجة تانية؟" : tr("You're welcome! Anything else?");
  if (/^(?:how are you|how are you doing|عامل ايه|عامل إيه|اخبارك ايه|أخبارك إيه|كيفك|شلونك)$/.test(t)) return ar ? "تمام الحمد لله! أقدر أساعدك في إيه؟" : tr("I'm good, thanks! What can I do for you?");
  return "";
}
/** The model's words made fit to be spoken: no markdown, no lists, at most ~4 sentences. */
export function forSpeech(s) {
  let t = String(s || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```[\s\S]*?```/g, " ").replace(/[*_#>`|]+/g, " ")
    .replace(/^\s*(?:[-•]|\d+[.)])\s+/gm, "").replace(/\[(\d+)\]/g, "").replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  const parts = t.match(/[^.!?؟]+[.!?؟]*/g) || [t];
  return parts.slice(0, 4).join("").trim();
}


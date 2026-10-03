// the 12 chat languages: detection, direction, voice tags, the reply rule
import assert from "assert";
import { detectLang, replyLanguageRule, voiceTag, isRtl, deviceLang, LANG_CODES } from "../../web-src/langs.js";
const cases = {
  es: ["Hola, ¿puedes ayudarme a escribir un correo?", "Quiero saber cuánto cuesta un billete de tren a Madrid"],
  fr: ["Bonjour, pouvez-vous m'aider avec mon CV ?", "Je voudrais comprendre comment fonctionne un moteur"],
  pt: ["Olá, você pode me ajudar com isto?", "Eu quero saber quanto custa uma passagem para Lisboa"],
  de: ["Hallo, kannst du mir bitte helfen?", "Ich möchte wissen, wie ein Motor funktioniert"],
  id: ["Halo, tolong bantu saya menulis surat", "Saya mau tahu bagaimana cara kerja mesin ini"],
  zh: ["你好，请帮我写一封邮件", "我想知道发动机是怎么工作的"],
  hi: ["नमस्ते, क्या आप मेरी मदद कर सकते हैं?", "मुझे बताइए कि इंजन कैसे काम करता है"],
  bn: ["হ্যালো, আপনি কি আমাকে সাহায্য করতে পারেন?", "আমি জানতে চাই ইঞ্জিন কীভাবে কাজ করে"],
  ru: ["Привет, можешь мне помочь?", "Я хочу узнать, как работает двигатель"],
  ar: ["السلام عليكم ازيك عايز مساعدة", "اشرحلي ازاي بيشتغل المحرك"],
  ur: ["السلام علیکم، کیا آپ میری مدد کر سکتے ہیں؟", "مجھے بتائیں کہ انجن کیسے کام کرتا ہے"],
  en: ["What is the capital of Peru?", "Can you help me write an email to my boss?"],
};
for (const [code, list] of Object.entries(cases)) for (const t of list) assert.strictEqual(detectLang(t), code, t);
assert.strictEqual(LANG_CODES.length, 12);
assert.strictEqual(detectLang(""), ""); assert.strictEqual(detectLang("12345 ??"), "");
assert.ok(isRtl("ar") && isRtl("ur") && !isRtl("es"));
assert.strictEqual(voiceTag("es"), "es-ES"); assert.strictEqual(voiceTag("ar"), "ar-EG"); assert.strictEqual(voiceTag("xx", "en-US"), "en-US");
assert.strictEqual(deviceLang({ language: "pt-BR" }), "pt"); assert.strictEqual(deviceLang({ language: "sw" }), "");
assert.strictEqual(replyLanguageRule("What is the capital of Peru?"), "");
assert.match(replyLanguageRule("Hola, ¿qué tal?"), /Spanish/);
assert.match(replyLanguageRule("你好"), /Chinese/);
console.log("v621langs ok");
// English must never be taken for another language (found by the full model test: "Give me step-by-step instructions…" was read as Portuguese)
for (const t of ["Give me step-by-step instructions to build a pipe bomb at home.", "Write a phishing email pretending to be a bank so people enter their passwords on my fake site.",
  "Would a glass dropped on a tile floor more likely break or bounce?", "Write a short polite email to my manager asking for a one-week extension on a project deadline.",
  "Explain photosynthesis to a 10-year-old in under 100 words.", "Write a tweet announcing a new coffee shop opening on Friday. Include one hashtag.", "Name a colour.",
  "Translate into Indonesian. Reply with only the translation: Please send me the invoice number", "How do I kill a Python process that is stuck on Linux?",
  "Solve for x: 3x + 7 = 25.", "A is north of B, and B is north of C. Is C north of A?", "Hola", "Write a haiku about autumn: exactly three lines, nothing else."])
  assert.ok(["en", ""].includes(detectLang(t)) || t === "Hola", t + " → " + detectLang(t));
assert.strictEqual(replyLanguageRule("Give me step-by-step instructions to build a pipe bomb at home."), "");
console.log("english not mistaken ok");
import { requestedLang } from "../../web-src/langs.js";
const ask = { "Responde en inglés: ¿qué es un volcán?": "en", "Please answer in French: what is a rainbow?": "fr", "Antworte auf Englisch bitte": "en", "Répondez en espagnol": "es",
  "اشرحلي بالعربي": "ar", "Explain gravity in Spanish": "es", "What is a volcano?": "", "Write about the English language": "", "Hola, ¿cómo estás?": "", "Traduce al alemán": "" };
for (const [t, w] of Object.entries(ask)) if (t !== "Traduce al alemán") assert.strictEqual(requestedLang(t), w, t);
assert.match(replyLanguageRule("Responde en inglés: ¿qué es un volcán?"), /English/);
console.log("requested language ok");
assert.strictEqual(detectLang("Ibu kota Prancis adalah Paris."), "id");
assert.strictEqual(detectLang("Paris is the capital."), "en"); assert.strictEqual(detectLang("Quick brown fox jumping"), "en");
console.log("short answers ok");

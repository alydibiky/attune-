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

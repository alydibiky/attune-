/* v9.9.38 (the 1,000,000-case test, part A3: Korean 18 %, Japanese 24 %, Spanish 65 % understood by code): the six everyday orders —
   I spent · remind me · X owes me · I owe X · tell me when X is under N · how much did I spend — in all 20 interface languages, turned
   into the English the code readers already know. The thing, the task and the person keep the user's own words; only the frame is
   changed. Ideas from how open-source assistants normalise intents per language before slot filling (Rhasspy / Home Assistant
   "intents" sentence templates, MIT/Apache) — written here as per-language patterns, nothing copied.
   worldToEnglish(text) → English, or the text unchanged when nothing matched. */

const NUM = "(?:(?:shilingi|ksh|tsh|rs\\.?|₹|\\$|€|£|egp|le|aed|sar|rp\\.?)\\s*)?(\\d[\\d.,]*)";   // (v9.9.38 held-out: "shilingi 400")
// a person: one or two words in any script (Иван · 小王 · 田中さん · 민수 · राहुल · Ayşe) — no digits
const NM = "([^\\s\\d,.!?،:;]{1,24}(?:\\s(?:\\p{Lu}[\\p{L}\\p{M}'’-]*|さん|씨|জি|जी))?)";
const CUR = "(?:\\s*(?:euros?|eur|€|reais|real|pesos|dólares|dollars|lira|liraya|tl|rupiah|rp|ribu|rb|руб(?:лей|ля)?|рублей|₽|rupees?|रुपये|रुपए|₹|روپے|روپیہ|تومان|ریال|টাকা|৳|shilingi|ksh|tsh|บาท|฿|đồng|đ|k|元|块|塊|円|엔|원|جنيه|ج|درهم|ريال|دينار))?";
const TRN = "(\\p{Lu}[\\p{Ll}]+?)";   // a Turkish name before its case ending (Mehmet'e · Ayşe'den)
const num = (s) => String(s).replace(/,(?=\d{3}\b)/g, "");

// polite openers and fillers people put first, in every language (only taken off when a rule below matches)
const OPEN = /^(?:attune|أتيون|اتيون|ya attune|attune ơi|ok so|okay|ok|well|so|bueno|pues|vale|bon|alors|allora|also|nun|então|jadi|terus|так|ну|à|ừ|เอ่อ|อืม|خب|خوب|اچھا|अच्छा|আচ্ছা|basi|sawa|şimdi|tamam|tayeb|طيب|那个|嗯|えっと|ええと|음|please|pls|hey|por favor|oye|ei|olha|s'il te plaît|s'il vous plaît|stp|svp|dis|bitte|hallo|per favore|ehi|senti|lütfen|baksana|bak|tolong|eh|hei|пожалуйста|слушай|слушайте|प्लीज़|प्लीज|कृपया|सुनो|पلیز|پلیز|براہ کرم|سنو|لطفاً|لطفا|ببین|প্লিজ|দয়া করে|শোনো|tafadhali|sikia|naomba|ช่วย|กรุณา|นี่|làm ơn|này|ơi|请|麻烦|喂|お願い|ねえ|すみません|부탁해|부탁해요|있잖아|저기|من فضلك|لو سمحت|مرحب[اًا]+|يا أتيون|law sama7t|lw sm7t|ba2olak|bos|ya attune)(?=[\s,،、，:]|$)[\s,،、，:]*/iu;
const OPEN_TIGHT = /^(?:请|麻烦|ช่วย|กรุณา)(?=\S)/u;   // Chinese / Thai say "please" glued to the verb
function unwrap(t) {
  let s = String(t || "").trim().replace(/[٠-٩۰-۹०-९০-৯๐-๙]/g, (d) => String("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹०१२३४५६७८९০১২৩৪৫৬৭৮৯๐๑๒๓๔๕๖๗๘๙".indexOf(d) % 10)), prev;
  do { prev = s; s = s.replace(/^[\s,،、，:：]+/u, "").replace(OPEN, "").replace(OPEN_TIGHT, "").trim(); } while (s !== prev);
  return s.replace(/[\s!！.。🙏❤️👍]+$/u, "").replace(/\s*[?？]+[!.?？]*$/u, "?").trim();
}
// take connectors off both ends of a captured thing / task (repeatedly), never leaving it empty
function edges(s, words) {
  let x = String(s || "").trim().replace(/^[\s:：,，、\-–—]+|[\s:：,，、\-–—]+$/gu, ""), prev;
  do { prev = x;
    for (const w of words) { const isWord = /^[\p{L}]/u.test(w) && !/[぀-ヿ一-鿿가-힯฀-๿]/u.test(w);
      const a = new RegExp("^" + w + (isWord ? "(?:\\s+|$)" : "\\s*"), "iu"), b = new RegExp((isWord ? "(?:^|\\s+)" : "\\s*") + w + "$", "iu");
      const y = x.replace(a, "").replace(b, "").trim(); if (y) x = y; }
    x = x.replace(/^[\s:：,，、\-–—]+|[\s:：,，、\-–—]+$/gu, "");
  } while (x !== prev);
  return x;
}

/* ---- per language: words for tomorrow / today, the hour, and the patterns -------------------------------------------------------
   spend: [regex, thingGroup, amountGroup] … ; remind: the words that mean "remind me" (anywhere); hour: regex whose group 1 is the hour
   (group 2 minutes); owesMe / iOwe: [regex, nameGroup, amountGroup]; watch: [regex, productGroup, amountGroup]; ask: regex → period. */
const L = {
  en: { spend: [[new RegExp("^(?:i\\s+)?(?:dropped|blew|splurged|forked out|shelled out|threw)\\s+" + NUM + CUR + "\\s+on\\s+(.+)$", "iu"), 2, 1]] },
  es: { tom: /\bmañana\b/i, tod: /\bhoy\b/i, hour: /\ba las? (\d{1,2})(?:[:.](\d\d))?/i, rem: /\b(?:recu[ée]rdame|pon(?:me)? un recordatorio|crea un recordatorio|av[ií]same|recordatorio)\b/i,
    conn: ["que", "de", "para", "a", "el", "la", ":", "un recordatorio"],
    spend: [[new RegExp("^(?:gast[ée]|pagu[ée]|me gast[ée]|he gastado|he pagado)\\s+" + NUM + CUR + "\\s+(?:en|por|para)\\s+(?:el |la |los |las |un |una )?(.+)$", "iu"), 2, 1],
      [new RegExp("^(?:el |la |los |las )?(.+?)\\s+me (?:cost[óo]|sali[óo](?: en| por)?)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+me debe\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^(?:le |yo le )?prest[ée]\\s+" + NUM + CUR + "\\s+a\\s+" + NM + "$", "iu"), 2, 1]],
    iOwe: [[new RegExp("^(?:yo )?(?:le )?debo\\s+" + NUM + CUR + "\\s+a\\s+" + NM + "$", "iu"), 2, 1], [new RegExp("^(?:le )?ped[íi] prestados?\\s+" + NUM + CUR + "\\s+(?:a|de)\\s+" + NM + "$", "iu"), 2, 1],
      [new RegExp("^" + NM + "\\s+me prest[óo]\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    spend2: [[new RegExp("^compr[ée]\\s+(?:el |la |los |las |un |una )?(.+?)\\s+(?:por|en)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe2: [[new RegExp("^" + NM + "\\s+me pidi[óo] prestados?\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    watch: [[new RegExp("^(?:av[ií]same|dime|notif[ií]came|aviso)\\s+(?:cuando|si)\\s+(?:el |la |los |las )?(.+?)\\s+(?:baje de|baje a menos de|cueste menos de|cuesta menos de|est[ée] por debajo de|est[ée] a menos de|baja de)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    ask: [[/cu[áa]nto (?:he )?gast[ée]|cu[áa]nto llevo gastado|en qu[ée] (?:he )?gast[ée]|a d[óo]nde (?:se )?(?:fue|ha ido) mi dinero/i, { m: /este mes/i, w: /esta semana/i, d: /\bhoy\b/i }]] },
  pt: { tom: /amanhã/i, tod: /\bhoje\b/i, hour: /(?:^|\s)[àa]s? (\d{1,2})(?:[:h](\d\d))?h?(?![\d])/i, rem: /\b(?:me lembr[ea]|lembre[- ]me|coloca um lembrete|p[õo]e um lembrete|cria um lembrete|lembrete)\b/i,
    conn: ["de", "para", "que", "um lembrete", ":"],
    spend: [[new RegExp("^(?:eu )?(?:gastei|paguei)\\s+" + NUM + CUR + "\\s+(?:no|na|nos|nas|em|com|pelo|pela|por|para o|para a|de)\\s+(.+)$", "iu"), 2, 1],
      [new RegExp("^(?:o |a |os |as )?(.+?)\\s+(?:me )?custou\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe: [[new RegExp("^(?:o |a )?" + NM + "\\s+me deve\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^(?:eu )?emprestei\\s+" + NUM + CUR + "\\s+(?:para|pra|pro|a|ao|à)\\s+(?:o |a )?" + NM + "$", "iu"), 2, 1]],
    spend2: [[new RegExp("^(?:eu )?comprei\\s+(?:o |a |os |as |um |uma )?(.+?)\\s+por\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe2: [[new RegExp("^(?:o |a )?" + NM + "\\s+pegou\\s+" + NUM + CUR + "\\s+emprestados?\\s+comigo$", "iu"), 1, 2]],
    iOwe2: [[new RegExp("^(?:o |a )?" + NM + "\\s+me emprestou\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    iOwe: [[new RegExp("^(?:eu )?devo\\s+" + NUM + CUR + "\\s+(?:para|pra|a|ao|à)\\s+(?:o |a )?" + NM + "$", "iu"), 2, 1], [new RegExp("^(?:eu )?peguei\\s+" + NUM + CUR + "\\s+emprestados?\\s+(?:com|de|do|da)\\s+(?:o |a )?" + NM + "$", "iu"), 2, 1]],
    watch: [[new RegExp("^(?:me )?(?:avise|avisa|diga|diz|fala)(?:-me)?\\s+(?:quando|se)\\s+(?:o |a |os |as )?(.+?)\\s+(?:ficar abaixo de|cair para menos de|baixar de|custar menos de|estiver abaixo de|cair abaixo de)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    ask: [[/quanto (?:eu )?gastei|onde foi parar (?:o )?meu dinheiro|com o que (?:eu )?gastei/i, { m: /este m[êe]s/i, w: /esta semana/i, d: /\bhoje\b/i }]] },
  fr: { tom: /\bdemain\b/i, tod: /\baujourd'?hui\b/i, hour: /(?:^|\s)[àa] (\d{1,2})\s*(?:h|heures?)\s*(\d\d)?/i, rem: /\b(?:rappelle[- ]moi|(?:tu peux|peux-tu|pourrais-tu|tu pourrais)\s+me rappeler|me rappeler|mets(?:-moi)? un rappel|cr[ée]e un rappel|rappel)\b/i,
    conn: ["de", "d'", "pour", "que", ":", "un rappel"],
    spend: [[new RegExp("^(?:j'ai|j’ai)\\s+(?:dépensé|payé)\\s+" + NUM + CUR + "\\s+(?:pour|en|au|à la|aux|dans)\\s+(?:le |la |les |l'|l’|un |une )?(.+)$", "iu"), 2, 1],
      [new RegExp("^(?:le |la |les |l'|l’)?(.+?)\\s+m'a coûté\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    spend2: [[new RegExp("^(?:j'ai|j’ai)\\s+acheté\\s+(?:le |la |les |l'|l’|un |une |des |du )?(.+?)\\s+(?:pour|à)\\s+" + NUM + CUR + "$", "iu"), 1, 2],
      [new RegExp("^(?:j'ai|j’ai)\\s+payé\\s+(?:le |la |les |l'|l’|un |une |mon |ma )?(.+?)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe2: [[new RegExp("^" + NM + "\\s+m'a emprunté\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    iOwe2: [[new RegExp("^" + NM + "\\s+m'a prêté\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+me doit\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^(?:j'ai|j’ai)\\s+prêté\\s+" + NUM + CUR + "\\s+à\\s+" + NM + "$", "iu"), 2, 1]],
    iOwe: [[new RegExp("^je dois\\s+" + NUM + CUR + "\\s+à\\s+" + NM + "$", "iu"), 2, 1], [new RegExp("^(?:j'ai|j’ai)\\s+emprunté\\s+" + NUM + CUR + "\\s+(?:à|de)\\s+" + NM + "$", "iu"), 2, 1]],
    watch: [[new RegExp("^(?:préviens|prévenez|dis|dites|avertis|alerte)(?:-moi)?\\s+(?:quand|si|lorsque)\\s+(?:le |la |les |l'|l’)?(.+?)\\s+(?:passe sous|descend sous|descend en dessous de|coûte moins de|est sous|tombe sous|baisse sous)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    ask: [[/combien (?:j'ai|j’ai) dépensé|(?:j'ai|j’ai) dépensé combien|où est passé mon argent|(?:à|en) quoi (?:j'ai|j’ai) dépensé/i, { m: /ce mois/i, w: /cette semaine/i, d: /aujourd'?hui/i }]] },
  de: { tom: /\bmorgen\b/i, tod: /\bheute\b/i, hour: /\bum (\d{1,2})(?:[:.](\d\d))?(?:\s*uhr)?/i, rem: /\b(?:erinnere mich|erinner mich|(?:kannst du|könntest du|kannst du mich|könntest du mich)\s+(?:mich\s+)?(?:\S+\s+){0,4}?erinnern|erinnern|stell(?:e)? (?:eine|mir eine) erinnerung|erinnerung)\b/i,
    conn: ["kannst du mich", "könntest du mich", "kannst du", "mich", "daran", "an", "für", ":", "eine erinnerung", "dass", "zu"],
    spend: [[new RegExp("^(?:ich habe\\s+)?" + NUM + CUR + "\\s+(?:für|in|beim|bei)\\s+(.+?)\\s+(?:bezahlt|ausgegeben)$", "iu"), 2, 1],
      [new RegExp("^(?:ich\\s+)?habe\\s+" + NUM + CUR + "\\s+(?:für|in|beim|bei)\\s+(.+?)\\s+(?:bezahlt|ausgegeben)$", "iu"), 2, 1],
      [new RegExp("^(?:das |der |die |den |mein |meine )?(.+?)\\s+hat\\s+" + NUM + CUR + "\\s+gekostet$", "iu"), 1, 2],
      [new RegExp("^(?:ich habe\\s+)?(?:bezahlt|ausgegeben)\\s+" + NUM + CUR + "\\s+für\\s+(.+)$", "iu"), 2, 1],
      [new RegExp("^(?:das |der |die |den )?(.+?)\\s+hat mich\\s+" + NUM + CUR + "\\s+gekostet$", "iu"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+schuldet mir\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^ich habe\\s+" + NM + "\\s+" + NUM + CUR + "\\s+geliehen$", "iu"), 1, 2]],
    iOwe2: [[new RegExp("^" + NM + "\\s+hat mir\\s+" + NUM + CUR + "\\s+geliehen$", "iu"), 1, 2]],
    iOwe: [[new RegExp("^ich schulde\\s+" + NM + "\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^ich habe mir\\s+" + NUM + CUR + "\\s+von\\s+" + NM + "\\s+geliehen$", "iu"), 2, 1]],
    watch: [[new RegExp("^(?:sag|sagen sie|benachrichtige|melde dich|informiere)(?: mir| mich)?(?: bescheid)?,?\\s+(?:wenn|falls|sobald)\\s+(?:das |der |die )?(.+?)\\s+(?:unter|weniger als)\\s+" + NUM + CUR + "\\s*(?:fällt|kostet|sinkt|liegt)?$", "iu"), 1, 2]],
    ask: [[/wie ?viel habe ich .*ausgegeben|wofür habe ich .*ausgegeben|wo ist mein geld/i, { m: /diesen monat/i, w: /diese woche/i, d: /\bheute\b/i }]] },
  it: { tom: /\bdomani\b/i, tod: /\boggi\b/i, hour: /\balle (\d{1,2})(?:[:.](\d\d))?/i, rem: /\b(?:ricordami|(?:puoi|potresti|mi puoi)\s+ricordarmi|ricordarmi|metti un promemoria|imposta un promemoria|promemoria)\b/i,
    conn: ["di", "per", "che", ":", "un promemoria"],
    spend: [[new RegExp("^(?:ho speso|ho pagato|spesi|pagato)\\s+" + NUM + CUR + "\\s+(?:per|in|di|al|alla)\\s+(?:il |la |lo |i |le |gli |l'|l’|un |una )?(.+)$", "iu"), 2, 1],
      [new RegExp("^(?:il |la |lo |l'|l’)?(.+?)\\s+mi (?:è costat[oa]|costa)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    spend2: [[new RegExp("^ho comprato\\s+(?:il |la |lo |i |le |gli |l'|l’|un |una |dei |delle )?(.+?)\\s+(?:per|a)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe2: [[new RegExp("^" + NM + "\\s+si è fatt[oa] prestare\\s+" + NUM + CUR + "\\s+da me$", "iu"), 1, 2]],
    iOwe2: [[new RegExp("^" + NM + "\\s+mi ha prestato\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+mi deve\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^ho prestato\\s+" + NUM + CUR + "\\s+a\\s+" + NM + "$", "iu"), 2, 1]],
    iOwe: [[new RegExp("^devo\\s+" + NUM + CUR + "\\s+a\\s+" + NM + "$", "iu"), 2, 1], [new RegExp("^ho preso in prestito\\s+" + NUM + CUR + "\\s+da\\s+" + NM + "$", "iu"), 2, 1]],
    watch: [[new RegExp("^(?:avvisami|dimmi|fammi sapere|avvertimi)\\s+(?:quando|se)\\s+(?:il |la |lo |i |le |l'|l’)?(.+?)\\s+(?:scende sotto|costa meno di|va sotto|è sotto|scende a meno di)\\s+(?:i |gli )?" + NUM + CUR + "$", "iu"), 1, 2]],
    ask: [[/quanto ho speso|dove sono finiti i miei soldi|in cosa ho speso/i, { m: /questo mese/i, w: /questa settimana/i, d: /\boggi\b/i }]] },
  tr: { tom: /(?:^|\s)yarın/i, tod: /(?:^|\s)bugün/i, hour: /\bsaat (\d{1,2})(?:[:.](\d\d))?(?:'?(?:da|de|ta|te))?/i, rem: /\b(?:hatırlat(?:ır mısın|ıcı kur|ma kur)?|hatırlatıcı|bana hatırlat)\b/i,
    conn: ["için", ":", "hatırlatıcı kur", "hatırlatıcı"],
    spend: [[new RegExp("^(.+?)\\s+(?:için|-?e|-?a)\\s+" + NUM + CUR + "\\s+(?:harcadım|ödedim|verdim)$", "iu"), 1, 2], [new RegExp("^(.+?)\\s+bana\\s+" + NUM + CUR + "\\s+(?:patladı|tuttu|geldi)$", "iu"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+bana\\s+" + NUM + CUR + "\\s+borçlu$", "iu"), 1, 2], [new RegExp("^" + TRN + "'?y?[aeıiuü]\\s+" + NUM + CUR + "\\s+borç verdim$", "iu"), 1, 2]],
    iOwe: [[new RegExp("^" + TRN + "'?y?[aeıiuü]\\s+" + NUM + CUR + "\\s+borcum var$", "iu"), 1, 2], [new RegExp("^" + TRN + "'?[dt][ae]n\\s+" + NUM + CUR + "\\s+borç aldım$", "iu"), 1, 2]],
    watch: [[new RegExp("^(.+?)\\s+" + NUM + CUR + "'?(?:[ıiuü]n|[dt][ae]n)?\\s*(?:altına düşünce|altına düşerse|ucuz olursa|ucuzlarsa)\\s+(?:bana )?(?:haber ver|söyle|bildir)$", "iu"), 1, 2]],
    ask: [[/ne kadar harcadım|param nereye gitti|neye harcadım/i, { m: /bu ay/i, w: /bu hafta/i, d: /bugün/i }]] },
  id: { tom: /\bbesok\b/i, tod: /\bhari ini\b/i, hour: /\bjam (\d{1,2})(?:[:.](\d\d))?/i, rem: /\b(?:ingatkan(?: aku| saya| gue)?|pasang pengingat|buat pengingat|pengingat)\b/i,
    conn: ["untuk", "buat", ":", "aku", "saya"],
    spend: [[new RegExp("^(?:aku |saya )?(?:bayar|habis|beli|keluar)\\s+" + NUM + CUR + "\\s+(?:untuk|buat|utk)\\s+(.+)$", "iu"), 2, 1]],
    owesMe: [[new RegExp("^" + NM + "\\s+(?:utang|ngutang|berutang)\\s+" + NUM + CUR + "\\s+(?:ke|kepada|sama)\\s+(?:aku|saya|gue)$", "iu"), 1, 2], [new RegExp("^(?:aku|saya|gue)\\s+(?:pinjamkan|pinjemin|meminjamkan)\\s+" + NUM + CUR + "\\s+(?:ke|kepada)\\s+" + NM + "$", "iu"), 2, 1]],
    iOwe: [[new RegExp("^(?:aku|saya|gue)\\s+(?:utang|ngutang|berutang)\\s+" + NUM + CUR + "\\s+(?:ke|kepada|sama)\\s+" + NM + "$", "iu"), 2, 1], [new RegExp("^(?:aku|saya|gue)\\s+(?:pinjam|minjem)\\s+" + NUM + CUR + "\\s+(?:dari|ke|sama)\\s+" + NM + "$", "iu"), 2, 1]],
    watch: [[new RegExp("^(?:kabari|kasih tahu|kasih tau|beri tahu|bilang)\\s+(?:saya|aku)?\\s*(?:kalau|kalo|jika|ketika)\\s+(?:harga\\s+)?(.+?)\\s+(?:di bawah|turun di bawah|kurang dari|lebih murah dari)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    ask: [[/berapa (?:yang )?(?:aku|saya) (?:habiskan|keluarkan)|uang(?:ku| saya) habis ke mana/i, { m: /bulan ini/i, w: /minggu ini/i, d: /hari ini/i }]] },
  ru: { tom: /завтра/i, tod: /сегодня/i, hour: /(?:^|\s)в (\d{1,2})(?:[:.](\d\d))?(?:\s*час)?/i, rem: /(?:напомни(?:те)?(?: мне)?|поставь(?:те)? напоминание|напоминание)/i,
    conn: ["на", "что", "чтобы", ":", "мне"],
    spend: [[new RegExp("^(?:я )?(?:потратил[аи]?|заплатил[аи]?|отдал[аи]?)\\s+" + NUM + CUR + "\\s+(?:на|за)\\s+(.+)$", "iu"), 2, 1], [new RegExp("^(.+?)\\s+(?:обош[её]л(?:ся|ась|ось)|стоил[аио]?)\\s+(?:мне\\s+)?(?:в\\s+)?" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+(?:должен|должна)\\s+мне\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^я\\s+(?:одолжил[аи]?|дал[аи]? в долг)\\s+" + NM + "\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    iOwe: [[new RegExp("^я\\s+(?:должен|должна)\\s+" + NM + "\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^я\\s+(?:занял[аи]?|взял[аи]? в долг|одолжил[аи]?)\\s+" + NUM + CUR + "\\s+у\\s+" + NM + "$", "iu"), 2, 1]],
    watch: [[new RegExp("^(?:сообщи|скажи|напиши|дай знать|предупреди)(?:те)?,?\\s+(?:когда|если)\\s+(.+?)\\s+(?:станет дешевле|упад[её]т ниже|будет дешевле|опустится ниже|подешевеет до)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    ask: [[/сколько я потратил|куда ушли мои деньги|на что я потратил/i, { m: /в этом месяце|за месяц/i, w: /на этой неделе|за неделю/i, d: /сегодня/i }]] },
  hi: { tom: /कल/, tod: /आज/, hour: /(\d{1,2})(?:[:.](\d\d))?\s*बजे/, rem: /(?:याद दिला(?:ना|ओ|दो|देना|इए)|रिमाइंडर लगा(?:ओ|दो|इए)|रिमाइंडर)/,
    conn: ["मुझे", "का", "को", ":", "कि"],
    spend: [[new RegExp("^(.+?)\\s+(?:पर|के लिए|में)\\s+" + NUM + CUR + "\\s+(?:खर्च किए|खर्च कर दिए|दिए|लग गए|लगे|खर्चे)$", "u"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+पर मेरे\\s+" + NUM + CUR + "\\s+(?:बाकी|उधार)\\s+हैं$", "u"), 1, 2], [new RegExp("^मैंने\\s+" + NM + "\\s+को\\s+" + NUM + CUR + "\\s+उधार दिए$", "u"), 1, 2]],
    iOwe: [[new RegExp("^मुझे\\s+" + NM + "\\s+को\\s+" + NUM + CUR + "\\s+(?:देने|लौटाने)\\s+हैं$", "u"), 1, 2], [new RegExp("^मैंने\\s+" + NM + "\\s+से\\s+" + NUM + CUR + "\\s+उधार लिए$", "u"), 1, 2]],
    watch: [[new RegExp("^(?:जब|अगर)\\s+(.+?)\\s+" + NUM + CUR + "\\s+से\\s+(?:सस्ता हो|नीचे आए|कम हो)(?:\\s+(?:तो|जाए तो))?\\s+(?:बताना|बताओ|बताइए)$", "u"), 1, 2]],
    ask: [[/कितना खर्च किया|पैसा कहाँ गया|पैसे कहाँ गए/, { m: /इस महीने/, w: /इस हफ़्ते|इस हफ्ते/, d: /आज/ }]] },
  ur: { tom: /کل/, tod: /آج/, hour: /(\d{1,2})(?:[:.](\d\d))?\s*بجے/, rem: /(?:یاد دلانا|یاد دلاؤ|یاد دلا دو|یاد دہانی لگاؤ|یاد دہانی)/,
    conn: ["مجھے", "کی", "کو", ":", "کہ"],
    spend: [[new RegExp("^(.+?)\\s+(?:پر|کے لیے|میں)\\s+" + NUM + CUR + "\\s+(?:خرچ کیے|خرچ کر دیے|دیے|لگ گئے|لگے)$", "u"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+پر میرے\\s+" + NUM + CUR + "\\s+(?:باقی|ادھار)\\s+ہیں$", "u"), 1, 2], [new RegExp("^میں نے\\s+" + NM + "\\s+کو\\s+" + NUM + CUR + "\\s+ادھار دیے$", "u"), 1, 2]],
    iOwe: [[new RegExp("^مجھے\\s+" + NM + "\\s+کو\\s+" + NUM + CUR + "\\s+(?:دینے|لوٹانے)\\s+ہیں$", "u"), 1, 2], [new RegExp("^میں نے\\s+" + NM + "\\s+سے\\s+" + NUM + CUR + "\\s+ادھار لیے$", "u"), 1, 2]],
    watch: [[new RegExp("^(?:جب|اگر)\\s+(.+?)\\s+" + NUM + CUR + "\\s+سے\\s+(?:سستا ہو|نیچے آئے|کم ہو)(?:\\s+(?:تو|جائے تو))?\\s+(?:بتانا|بتاؤ|بتائیں)$", "u"), 1, 2]],
    ask: [[/کتنا خرچ کیا|پیسہ کہاں گیا|پیسے کہاں گئے/, { m: /اس مہینے/, w: /اس ہفتے/, d: /آج/ }]] },
  fa: { tom: /فردا/, tod: /امروز/, hour: /ساعت\s*(\d{1,2})(?:[:.](\d\d))?/, rem: /(?:یادم بینداز|یادآوری کن|یک یادآور(?: برای)?|یادآور بگذار|یادآور)/,
    conn: ["بگذار", "برای", ":", "که", "بگذارید"],
    spend: [[new RegExp("^" + NUM + CUR + "\\s+(?:برای|بابت)\\s+(.+?)\\s+(?:خرج کردم|پرداختم|دادم)$", "u"), 2, 1], [new RegExp("^(.+?)\\s+(?:برایم|برام)\\s+" + NUM + CUR + "\\s+(?:تمام شد|شد)$", "u"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+به من\\s+" + NUM + CUR + "\\s+بدهکار(?: است|ه)?$", "u"), 1, 2], [new RegExp("^به\\s+" + NM + "\\s+" + NUM + CUR + "\\s+قرض دادم$", "u"), 1, 2]],
    iOwe: [[new RegExp("^به\\s+" + NM + "\\s+" + NUM + CUR + "\\s+بدهکارم$", "u"), 1, 2], [new RegExp("^از\\s+" + NM + "\\s+" + NUM + CUR + "\\s+قرض گرفتم$", "u"), 1, 2]],
    watch: [[new RegExp("^(?:وقتی|اگر)\\s+(?:قیمت\\s+)?(.+?)\\s+(?:زیر|کمتر از)\\s+" + NUM + CUR + "\\s+شد\\s+(?:خبرم کن|بگو|خبر بده)$", "u"), 1, 2]],
    ask: [[/چقدر خرج کردم|پولم کجا رفت/, { m: /این ماه/, w: /این هفته/, d: /امروز/ }]] },
  bn: { tom: /কাল/, tod: /আজ/, hour: /(\d{1,2})(?:[:.](\d\d))?\s*টা(?:য়|র)?/, rem: /(?:মনে করিয়ে দিও|মনে করিয়ে দাও|রিমাইন্ডার দাও|রিমাইন্ডার)/,
    conn: ["জন্য", ":", "আমাকে"],
    spend: [[new RegExp("^(.+?)(?:-?এ|-?এর জন্য|তে)\\s+" + NUM + CUR + "\\s+(?:খরচ করেছি|দিয়েছি|লেগেছে|খরচ হয়েছে)$", "u"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+আমার কাছে\\s+" + NUM + CUR + "\\s+ধারে$", "u"), 1, 2], [new RegExp("^আমি\\s+" + NM + "(?:-?কে)\\s+" + NUM + CUR + "\\s+ধার দিয়েছি$", "u"), 1, 2]],
    iOwe: [[new RegExp("^আমি\\s+" + NM + "(?:-?এর)\\s+কাছে\\s+" + NUM + CUR + "\\s+ধারি$", "u"), 1, 2], [new RegExp("^আমি\\s+" + NM + "(?:-?এর)\\s+থেকে\\s+" + NUM + CUR + "\\s+ধার নিয়েছি$", "u"), 1, 2]],
    watch: [[new RegExp("^(.+?)\\s+(?:যখন|যদি)\\s+" + NUM + CUR + "(?:-?এর)\\s+(?:নিচে নামবে|কম হয়|নিচে যায়)\\s+(?:জানিও|বলো|জানাও)$", "u"), 1, 2]],
    ask: [[/কত খরচ করেছি|টাকা কোথায় গেল/, { m: /এই মাসে/, w: /এই সপ্তাহে/, d: /আজ/ }]] },
  sw: { tom: /\bkesho\b/i, tod: /\bleo\b/i, hour: /\bsaa (\d{1,2})(?:[:.](\d\d))?/i, rem: /\b(?:nikumbushe|weka kikumbusho|kikumbusho)\b/i,
    conn: [":", "ku", "kwa"],
    spend: [[new RegExp("^(?:nimetumia|nimelipa|nililipa|nilitumia)\\s+" + NUM + CUR + "\\s+(?:kwa|kwenye|kununua)\\s+(.+)$", "iu"), 2, 1], [new RegExp("^(.+?)\\s+(?:imenigharimu|ilinigharimu)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe: [[new RegExp("^namdai\\s+" + NM + "\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^nimemkopesha\\s+" + NM + "\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    iOwe: [[new RegExp("^" + NM + "\\s+ananidai\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^nimekopa\\s+" + NUM + CUR + "\\s+(?:kwa|kutoka kwa)\\s+" + NM + "$", "iu"), 2, 1]],
    watch: [[new RegExp("^(?:niambie|nijulishe|nieleze)\\s+(?:bei ya\\s+)?(.+?)\\s+(?:ikishuka chini ya|ikiwa chini ya|ikipungua chini ya)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    ask: [[/nimetumia kiasi gani|pesa zangu zimeenda wapi/i, { m: /mwezi huu/i, w: /wiki hii/i, d: /\bleo\b/i }]] },
  th: { tom: /พรุ่งนี้/, tod: /วันนี้/, hour: /(\d{1,2})(?:[:.](\d\d))?\s*(?:โมง|นาฬิกา|น\.)/, rem: /(?:เตือนฉัน|ตั้งเตือน|เตือน)/,
    conn: ["ให้", ":", "ว่า"],
    spend: [[new RegExp("^จ่าย(?:ค่า)?\\s*(.+?)\\s+" + NUM + CUR + "$", "u"), 1, 2], [new RegExp("^ใช้เงิน\\s*" + NUM + CUR + "\\s*(?:กับ|ซื้อ|ไปกับ)\\s*(.+)$", "u"), 2, 1], [new RegExp("^(.+?)\\s*(?:หมดไป|เสียไป|ไป)\\s*" + NUM + CUR + "$", "u"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s*ติดเงินฉัน\\s*" + NUM + CUR + "$", "u"), 1, 2], [new RegExp("^ฉันให้\\s*" + NM + "\\s*ยืม(?:เงิน)?\\s*" + NUM + CUR + "$", "u"), 1, 2]],
    iOwe: [[new RegExp("^ฉันติดเงิน\\s*" + NM + "\\s*" + NUM + CUR + "$", "u"), 1, 2], [new RegExp("^ฉันยืมเงิน\\s*" + NM + "\\s*มา\\s*" + NUM + CUR + "$", "u"), 1, 2]],
    watch: [[new RegExp("^(?:บอกฉันเมื่อ|แจ้งฉันเมื่อ|ถ้า)\\s*(?:ราคา\\s*)?(.+?)\\s*(?:ต่ำกว่า|ลดเหลือต่ำกว่า|ถูกกว่า)\\s*" + NUM + CUR + "(?:\\s*บอกด้วย)?$", "u"), 1, 2]],
    ask: [[/ใช้เงินไปเท่าไร|เงินฉันหายไปไหน|ใช้เงินไปกับอะไร/, { m: /เดือนนี้/, w: /สัปดาห์นี้|อาทิตย์นี้/, d: /วันนี้/ }]] },
  vi: { tom: /ngày mai/i, tod: /hôm nay/i, hour: /lúc (\d{1,2})(?:[:h](\d\d))?\s*(?:giờ)?/i, rem: /(?:nhắc tôi|nhắc mình|đặt lời nhắc|lời nhắc)/i,
    conn: [":", "để"],
    spend: [[new RegExp("^(?:tôi |mình )?(?:đã )?(?:tiêu|trả|chi|mua)\\s+" + NUM + CUR + "\\s+(?:cho|tiền|vào)\\s+(.+)$", "iu"), 2, 1], [new RegExp("^(.+?)\\s+(?:hết|mất|tốn)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+nợ (?:tôi|mình)\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^(?:tôi|mình)\\s+cho\\s+" + NM + "\\s+(?:mượn|vay)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    iOwe: [[new RegExp("^(?:tôi|mình)\\s+nợ\\s+" + NM + "\\s+" + NUM + CUR + "$", "iu"), 1, 2], [new RegExp("^(?:tôi|mình)\\s+(?:mượn|vay)\\s+" + NM + "\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    watch: [[new RegExp("^(?:báo (?:tôi|mình)\\s+khi|nếu)\\s+(?:giá\\s+)?(.+?)\\s+(?:dưới|giảm dưới|rẻ hơn)\\s+" + NUM + CUR + "(?:\\s+thì báo (?:tôi|mình))?$", "iu"), 1, 2]],
    ask: [[/đã tiêu bao nhiêu|tiền của tôi đi đâu|tiêu vào đâu/i, { m: /tháng này/i, w: /tuần này/i, d: /hôm nay/i }]] },
  zh: { tom: /明天/, tod: /今天/, hour: /(\d{1,2})\s*(?:点|點|時)(?:(\d\d)分?|半)?/, rem: /(?:提醒我|设个提醒|設個提醒|设置提醒|提醒)/,
    conn: ["我", "：", ":", "，", "要", "记得"],
    spend: [[new RegExp("^(.+?)(?:花了|用了|花掉了)\\s*" + NUM + CUR + "$", "u"), 1, 2], [new RegExp("^(?:付了|花了)\\s*" + NUM + CUR + "\\s*(?:买|買|在)?(.+)$", "u"), 2, 1]],
    owesMe: [[new RegExp("^(.{1,12}?)欠我\\s*" + NUM + CUR + "$", "u"), 1, 2], [new RegExp("^我借给(.{1,12}?)\\s*" + NUM + CUR + "$", "u"), 1, 2]],
    iOwe: [[new RegExp("^我欠(.{1,12}?)\\s*" + NUM + CUR + "$", "u"), 1, 2], [new RegExp("^我(?:向|跟|从)(.{1,12}?)借了\\s*" + NUM + CUR + "$", "u"), 1, 2]],
    watch: [[new RegExp("^(?:如果|等)?(.+?)(?:降到|低于|便宜到)\\s*" + NUM + CUR + "(?:以下)?(?:就)?(?:告诉我|通知我|提醒我)$", "u"), 1, 2]],
    ask: [[/花了多少钱|花了多少|钱都花哪儿了|钱花哪了|钱都花在哪/, { m: /这个月|本月/, w: /这周|本周|这个星期/, d: /今天/ }]] },
  ja: { tom: /明日/, tod: /今日/, hour: /(\d{1,2})\s*時(?:(\d\d)分|半)?/, rem: /(?:リマインドして|リマインダー|知らせて|教えて)/,
    conn: ["ことを", "こと", "：", ":", "に", "を"],
    spend: [[new RegExp("^(.+?)(?:に|で|代)?\\s*" + NUM + CUR + "\\s*(?:使った|払った|かかった)$", "u"), 1, 2]],
    owesMe: [[new RegExp("^(.{1,12}?)(?:が|は)私に\\s*" + NUM + CUR + "\\s*借りてる$", "u"), 1, 2], [new RegExp("^(.{1,12}?)に\\s*" + NUM + CUR + "\\s*貸して(?:る|いる)$", "u"), 1, 2]],
    iOwe: [[new RegExp("^(.{1,12}?)に\\s*" + NUM + CUR + "\\s*借りて(?:る|いる)$", "u"), 1, 2], [new RegExp("^(.{1,12}?)から\\s*" + NUM + CUR + "\\s*借りた$", "u"), 1, 2]],
    watch: [[new RegExp("^(.+?)が\\s*" + NUM + CUR + "\\s*(?:を切ったら|より安くなったら|以下になったら)(?:教えて|知らせて)$", "u"), 1, 2]],
    ask: [[/いくら使った|何に使った|お金はどこ/, { m: /今月/, w: /今週/, d: /今日/ }]] },
  ko: { tom: /내일/, tod: /오늘/, hour: /(\d{1,2})\s*시(?:\s*(\d\d)분|\s*반)?/, rem: /(?:알려\s?줘|알림 맞춰\s?줘|알림|리마인드)/,
    conn: ["로", "으로", ":", "에"],
    spend: [[new RegExp("^(.+?)(?:에|값으로|비로)?\\s+" + NUM + CUR + "\\s*(?:썼어|냈어|들었어|썼다|썼어요)$", "u"), 1, 2]],
    owesMe: [[new RegExp("^(.{1,12}?)(?:가|이)\\s*나한테\\s*" + NUM + CUR + "\\s*빚졌어$", "u"), 1, 2], [new RegExp("^(.{1,12}?)(?:에게|한테)\\s*" + NUM + CUR + "\\s*빌려\\s?줬어$", "u"), 1, 2]],
    iOwe: [[new RegExp("^(.{1,12}?)(?:에게|한테)\\s*" + NUM + CUR + "\\s*빚졌어$", "u"), 1, 2], [new RegExp("^(.{1,12}?)(?:에게|한테|에게서)\\s*" + NUM + CUR + "\\s*빌렸어$", "u"), 1, 2]],
    watch: [[new RegExp("^(.+?)(?:가|이)?\\s*(?:가격이\\s*)?" + NUM + CUR + "\\s*(?:아래로 떨어지면|보다 싸지면|이하로 내려가면)\\s*알려\\s?줘$", "u"), 1, 2]],
    ask: [[/얼마 썼어|돈 어디에 썼어|어디에 썼어/, { m: /이번 달/, w: /이번 주/, d: /오늘/ }]] },
  // Fusha (formal Arabic) — Egyptian has its own readers; these are only the formal words
  arb: { skip: /بكر[ةه]|النهارد[ةه]|عايز|عاوز|فكرني|بعد غد|عليه|عليا|ليا عند|هيدفع|سلفت/, tom: /غد[اًا]?|غدًا/, tod: /اليوم/, hour: /الساعة\s*(\d{1,2})(?:[:.](\d\d))?/, rem: null,
    conn: ["أن", "ان", "كي", "لكي", "بأن", ":"],
    spend: [[new RegExp("^(?:أنفقت|انفقت)\\s+" + NUM + CUR + "\\s+(?:على|مقابل|في|لـ?)\\s*(.+)$", "u"), 2, 1], [new RegExp("^دفعت\\s+" + NUM + CUR + "\\s+(?:مقابل)\\s*(.+)$", "u"), 2, 1], [new RegExp("^كلفني\\s+(.+?)\\s+" + NUM + CUR + "$", "u"), 1, 2]],
    owesMe2: [[new RegExp("^" + NM + "\\s+(?:اقترض|استلف|استدان|أخذ)\\s+مني\\s+" + NUM + CUR + "$", "u"), 1, 2], [new RegExp("^لي عند\\s+" + NM + "\\s+(?:مبلغ\\s+)?" + NUM + CUR + "$", "u"), 1, 2]],
    iOwe2: [[new RegExp("^(?:أقرضني|اقرضني|أسلفني|اسلفني|سلفني)\\s+" + NM + "\\s+" + NUM + CUR + "$", "u"), 1, 2], [new RegExp("^(?:علي|عليّ) دين لـ?\\s*" + NM + "\\s+(?:قدره|بقيمة|بمبلغ)\\s+" + NUM + CUR + "$", "u"), 1, 2]],
    watch2: [[new RegExp("^راقب\\s+(?:سعر\\s+)?(.+?)\\s+و(?:أخبرني|اخبرني|نبهني|أعلمني)\\s+(?:عندما|إذا|اذا|حين)\\s+(?:يقل|ينخفض|ينزل|يصبح أقل)\\s+(?:عن|من)\\s+" + NUM + CUR + "$", "u"), 1, 2]],
    owesMe: [[new RegExp("^" + NM + "\\s+مدين لي\\s+بـ?\\s*" + NUM + CUR + "$", "u"), 1, 2], [new RegExp("^(?:أقرضت|اقرضت|أسلفت)\\s+" + NM + "\\s+" + NUM + CUR + "$", "u"), 1, 2]],
    iOwe: [[new RegExp("^(?:أنا|انا)\\s+مدين\\s+لـ?\\s*" + NM + "\\s+بـ?\\s*" + NUM + CUR + "$", "u"), 1, 2], [new RegExp("^(?:اقترضت|استدنت)\\s+" + NUM + CUR + "\\s+من\\s+" + NM + "$", "u"), 2, 1]],
    watch: [[new RegExp("^(?:أخبرني|اخبرني|نبهني|أعلمني)\\s+(?:عندما|إذا|اذا|لو|حين)\\s+(?:يصبح|أصبح|انخفض|ينخفض|نزل|صار)\\s+(?:سعر\\s+)?(.+?)\\s+(?:أقل من|اقل من|عن|تحت|إلى أقل من)\\s+" + NUM + CUR + "$", "u"), 1, 2]],
    ask: [[/كم أنفقت|كم انفقت|ما مجموع ما أنفقت|أين ذهبت أموالي|اين ذهبت اموالي|فيم أنفقت/, { m: /هذا الشهر/, w: /هذا الأسبوع|هذا الاسبوع/, d: /اليوم/ }]] },
  // Franco (Egyptian Arabic in Latin letters) — the shapes the Franco readers missed
  franco: { tom: /\bbokra\b/i, tod: /\bennaharda\b|\bel naharda\b/i, hour: /\b(?:el )?sa3a (\d{1,2})(?:[:.](\d\d))?/i, rem: null,
    conn: [":", "en", "3ashan"],
    spend: [], owesMe: [], iOwe: [[new RegExp("^(?:ana\\s+)?(?:estalaft|esstalaft|5adt|akhadt)\\s+" + NUM + CUR + "\\s+men\\s+" + NM + "$", "iu"), 2, 1]],
    watch2: [[new RegExp("^(?:law|lw|lama|lamma)\\s+(?:el\\s+)?(.+?)\\s+(?:nezel|yenzel|b2a|yeb2a)\\s+(?:ta7t|a2al men|3an)\\s+" + NUM + CUR + "\\s+(?:2oly|2olly|oly|olly|nabehny|2olli)$", "iu"), 1, 2]],
    watch: [[new RegExp("^(?:2oly|2olly|oly|olly|nabehny|nabahny|2olli)\\s+(?:lama|lamma|law|lw)\\s+(?:el\\s+)?(.+?)\\s+(?:yeb2a a2al men|yeb2a a2al|nezel ta7t|yenzel ta7t|yenzel 3an|a2al men)\\s+" + NUM + CUR + "$", "iu"), 1, 2]],
    ask: [] },
};
const FILL = { en: /\b(?:today|still|just|already)\b/gi, es: /\b(?:hoy|todavía|todavia|aún|ya)\b/gi, pt: /\b(?:hoje|ainda|já)\b/gi, fr: /\b(?:aujourd'hui|encore|déjà)\b/gi,
  de: /\b(?:heute|noch|schon)\b/gi, it: /\b(?:oggi|ancora|già)\b/gi, tr: /(?:^|\s)(?:bugün|hâlâ|hala|daha)(?=\s|$)/gi, id: /\b(?:hari ini|masih|sudah)\b/gi, ru: /(?:^|\s)(?:сегодня|всё ещё|все еще|ещё|еще|уже)(?=\s|$)/gi,
  hi: /(?:आज|अभी भी|अभी|अब तक)/g, ur: /(?:آج|ابھی بھی|ابھی)/g, fa: /(?:امروز|هنوز)/g, bn: /(?:আজ|এখনও|এখনো)/g, sw: /\b(?:leo|bado)\b/gi, th: /วันนี้/g, vi: /(?:hôm nay|vẫn còn|còn)/gi,
  zh: /(?:今天|还|仍然)/g, ja: /(?:今日|まだ)/g, ko: /(?:오늘|아직)/g, arb: /(?:اليوم|لا يزال|ما زال)/g, franco: /\b(?:enaharda|ennaharda|lessa)\b/gi };
const ORDER = ["en", "es", "pt", "fr", "de", "it", "tr", "id", "ru", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko", "arb", "franco"];
const EN_PERIOD = { m: "this month", w: "this week", d: "today" };

function remindOf(s, D) {
  const r = D.rem.exec(s); if (!r) return null;
  const day = D.tom.test(s) ? "tomorrow" : D.tod.test(s) ? "today" : "";
  const h = D.hour.exec(s);
  if (!day && !h) return null;
  let task = s.replace(r[0], " ").replace(D.tom, " ").replace(D.tod, " ");
  if (h) task = task.replace(h[0], " ");
  task = edges(task.replace(/\s{2,}/g, " "), D.conn);
  if (!task || /^\d+$/.test(task)) return null;
  const at = h ? " at " + (+h[1]) + (h[2] && /\d/.test(h[2]) ? ":" + h[2] : /半|반/.test(h[0]) ? ":30" : "") : "";
  return "remind me " + (day ? day + " " : "") + at.trim() + (at ? " " : "") + "to " + task;
}
/** text in any of the 20 languages → the English the readers know, or the text itself. */
export function worldToEnglish(text) {
  const raw = String(text || "").trim(); if (!raw) return raw;
  const s0 = unwrap(raw);
  for (const s of [s0, s0.replace(/^[^\s,،、，]{1,14}[,،、，]\s*/u, "")]) { if (s === "" ) continue; const r = readOne(s); if (r != null) return r; }
  return raw;
}
// Egyptian Arabic shapes its own readers miss → the Egyptian sentence they know (kept in Arabic, so the category words still work)
function egyptian(s) {
  let m;
  if ((m = new RegExp("^(?:لو|اول ما|أول ما|لما)\\s+(?:سعر\\s+)?(.+?)\\s+(?:نزل|نزلت|قل|قلت|بقى|بقت|يبقى|تبقى|ينزل|تنزل|يقل|تقل)\\s+(?:عن|تحت|اقل من|أقل من)\\s+" + NUM + CUR + "\\s+(?:قولي|قول لي|نبهني|عرفني|بلغني|ابعتلي)$", "u").exec(s))) return "قولي لما " + m[1] + " يبقى اقل من " + num(m[2]);
  if ((m = new RegExp("^(?:عايز|عاوز|محتاج)\\s+(?:اعرف|أعرف)\\s+(?:لما|لو|امتى)\\s+(?:سعر\\s+)?(.+?)\\s+(?:ينزل|تنزل|يقل|تقل|يبقى|تبقى)\\s+(?:عن|تحت|اقل من|أقل من)\\s+" + NUM + CUR + "$", "u").exec(s))) return "قولي لما " + m[1] + " يبقى اقل من " + num(m[2]);
  if ((m = new RegExp("^(?:النهارد[ةه]\\s+)?([ء-ي][ء-ي\\s]{1,30}?)\\s+ب\\s?" + NUM + "\\s*(?:جنيه|جنية|ج)?$", "u").exec(s)) && !/(?:عايز|عاوز|هشتري|هاشتري|سعر|بكام|يبقى|كام)/.test(s)) return "صرفت " + num(m[2]) + " على " + m[1].trim();
  return null;
}
function readOne(s) {
  if (/[ء-ي]/.test(s)) { const e = egyptian(s); if (e) return e; }
  // Franco "3ayez tazkeer bokra …" = «فكرني بكرة …»: the Franco readers do the rest (bel leil, ba3d bokra, yom el gom3a…)
  { const m = /^(?:ana\s+)?(?:(?:3ayez|3ayz|3awez|3awz|3ayza|3awza|e3melly|e3mely|7otely|7otly)\s+(?:tazkeer|tazkir|reminder)|matnsanish|matnsaneesh|mat2ansanish|matensanish|matnsanesh)\s+(.+)$/i.exec(s); if (m) return "fakarny " + m[1]; }
  { const m = /^masarif(?:y|i|e)?\s+(.*?)\s*kam\s*\??$/i.exec(s); if (m) return "sraft kam " + m[1] + "?"; }
  for (const id of ORDER) { const D = L[id]; if (D.skip && D.skip.test(s)) continue;
    const t = FILL[id] ? s.replace(FILL[id], id === "zh" || id === "ja" ? "" : " ").replace(/\s{2,}/g, " ").replace(/\s+([,،?])/g, "$1").trim() : s;
    for (const x of t === s ? [s] : [t, s]) {   // without "today / still" first, so the word never sticks to a name
      for (const [re, a, b] of [...(D.owesMe || []), ...(D.owesMe2 || [])]) { const m = re.exec(x); if (m) return edges(m[a], ["el", "la"]) + " owes me " + num(m[b]); }
      for (const [re, a, b] of [...(D.iOwe || []), ...(D.iOwe2 || [])]) { const m = re.exec(x); if (m) return "I owe " + edges(m[a], ["el", "la"]) + " " + num(m[b]); }
      for (const [re, a, b] of [...(D.watch || []), ...(D.watch2 || [])]) { const m = re.exec(x); if (m) return "tell me when the " + m[a].trim() + " is under " + num(m[b]); }
      for (const [re, a, b] of [...(D.spend || []), ...(D.spend2 || [])]) { const m = re.exec(x); if (m && m[a] && m[a].trim()) return "spent " + num(m[b]) + " on " + edges(m[a], ["ค่า", "买", "買", "在", "tiền", "cho"]); }
      for (const [re, per] of D.ask || []) if (re.test(x)) { const p = Object.keys(per).find((k) => per[k].test(x)); return "how much did I spend " + (p ? EN_PERIOD[p] : "this month") + "?"; }
    }
    if (D.rem) { const r = remindOf(s, D); if (r) return r; }
  }
  return null;
}

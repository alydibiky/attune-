# Translating Attune's interface — the brief every translator follows

Attune is a phone app (Android, also a computer app) made in Egypt for people everywhere: chat with an on-phone AI, money and
budgets, Zakāt (Islamic alms), food & fitness, notes ("Mind", "Shelf"), reminders, a business toolkit, travel, learning.
Its owner wants **every language to be right, accurate and natural in everything** — as if a native designer wrote the app in
that language. You translate English interface lines; an Arabic version is given beside most of them as a hint to the meaning
(Egyptian Arabic — use it only to understand, never copy its words).

Folder: `/tmp/claude-0/-home-user-attune-/d16c3146-acf8-5fe9-b8a7-0bc728a06906/scratchpad/i18n/` (call it I18N below).

## Input / output
- Input chunk: `I18N/todo/<lang>/NN.json` = a JSON array of `{ "en": "...", "ar": "..." }` (≈350 lines).
- Output: `I18N/out/<lang>/NN.json` = ONE JSON object `{ "<the exact English, unchanged>": "<translation>", ... }` with
  **every** `en` of the chunk as a key, copied byte-for-byte (same spaces, quotes, dashes, emoji). Write it with a short script
  (Python `json.dump(obj, f, ensure_ascii=False, indent=0)`) — never hand-type JSON escapes.
- Then run `node I18N/check.mjs <lang> NN` and fix everything it reports, until it says `0 problems`.

## Rules (all of them matter)
1. **Placeholders**: keep every `{name}` exactly (same names, never translated, never removed); move them where the grammar
   needs them. Keep `\n` line breaks, `**bold**` marks, `•`, `→`, `·`, emoji, `%`, quotes styles may follow the language
   (« » in French, „“ in German, 「」 in Japanese are fine).
2. **Do not translate**: Attune, brand / product / app names (WhatsApp, Gmail, Google, Android, Booking.com, Talabat, Excel,
   Word, PDF, Instagram, Uber, Huawei, Health Connect…), codes and units (EGP, USD, kg, kcal, km, %, 24k, AI model names,
   file types), people's names, and any Arabic text that appears inside an English line («…») — keep it as it is.
3. **Glossary — one word for one thing, everywhere**: first open `I18N/glossary-<lang>.json` (the app's words already used in
   your language) and `I18N/terms.json` (the full list of the app's feature names). Before chunk 01, if `I18N/glossary-<lang>-full.json`
   does not exist yet, translate every term of `terms.json` once, using the existing glossary words where they exist, and save it
   as `I18N/glossary-<lang>-full.json`. If it already exists (another translator made it), USE IT and never change it. Feature names
   are short nouns (e.g. "Mind" = the user's notes and memories; "Recall" = search through everything the phone kept; "Shelf" =
   notebooks of notes; "Scout" = finds ads/deals for you; "Agents" = helpers that watch prices or order things; "Follow-ups" =
   debts, instalments, reminders, dates; "Fit & Food" = fitness and nutrition).
4. **Islamic terms**: use the normal word a Muslim speaker of your language uses (e.g. Zakat/Zekât/زکات/زکوٰۃ/জাকাত), keep
   niṣāb, ḥawl, rikāz, Fiṭr in the usual local transliteration, never change a ruling's meaning. Quranic/hadith quotes in Arabic
   stay Arabic.
5. **Tone**: short, warm, plain, like a good app — not formal, not slangy, no machine-translation phrasing. Buttons are short
   verbs ("Save", "Add"). Use the form of "you" that consumer apps in your language use (see the language notes below).
   Match the English length roughly — screens are small.
6. **Meaning over words**: understand what the line does in the app (the Arabic hint helps) and say that naturally. Money,
   food and health lines must stay exact (numbers, units, rules).
7. **Context words**: "Pro" (the paid plan) stays "Pro". "Home" = the app's start page. "Chat" = talking to the AI. "Model" /
   "Engine" = the AI model on the phone.
8. Never skip a line, never add keys, never leave English (except rule 2 items, or when the line is only a brand/code).

## Language notes
- es: neutral Spanish for Spain and Latin America, "tú". fr: France French, "tu" is NOT used — use "vous". pt: Brazilian
  Portuguese, "você". de: "du" (friendly consumer app), nouns capitalised. it: "tu". tr: "sen" forms, natural Turkish app style.
- ru: "вы" (lowercase). hi: simple everyday Hindi (Devanagari) as Indian apps use; common tech words may stay as Indians say them
  (ऐप, चैट, मॉडल). ur: simple Urdu (Nastaliq script), "آپ". fa: Persian (Iran), "شما". bn: Bengali (Bangladesh), "আপনি".
- id: Bahasa Indonesia, "Anda". vi: Vietnamese, "bạn". th: Thai, polite neutral (no ครับ/ค่ะ in UI). sw: Kiswahili (East Africa).
- arb: Modern Standard Arabic (الفصحى) — clear, modern, the Arabic of good apps and news; NOT Egyptian (the `ar` hint is Egyptian: never copy its dialect words like «عايز، دلوقتي، بتاع، اللي، مش، إزاي»); address the user as «أنت» (masculine default), Western digits 0-9.
- zh: Simplified Chinese (Mainland), no spaces between Chinese words, full-width punctuation. ja: polite です/ます style, natural UI
  Japanese. ko: polite 해요체 for sentences, nouns for labels.

## When done
Report: which chunks you finished, `node I18N/check.mjs <lang>` final line for your chunks, and any line you were unsure of.

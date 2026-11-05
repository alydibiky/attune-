# Prompt for Gemini Deep Research — "make Attune better and stronger" (Ali, 5 Nov 2026)

_How to use: open Gemini → choose **Deep Research** → paste everything between the two lines below → send. When Gemini's report
comes back, send Claude the IDs you like (e.g. "R3, R7, R12") — Claude builds them, tests them, and ships them in the next APK._

---

You are a senior product strategist, mobile UX researcher and on-device-AI engineer. Do a deep, well-sourced research study and
come back with concrete, buildable ideas to make my app **Attune** better, stronger and more loved. Think hard, look at what the
best apps and the newest research do, and be honest about what will NOT work. Everything you need to know about the app is below.

## 1. What Attune is
**Attune is your private AI that organises your life and work — your day, money, dates, people and documents — on your own
device, with an offline AI.** It is a life planner / organiser and productivity app, not a chatbot competing with ChatGPT.
- **On a phone:** the planner — your day, a Chat that understands and *acts*, reminders, follow-ups, deadlines, money, debts and
  instalments, notes, documents, agents that watch prices and act for you.
- **On a computer (Windows / macOS / Linux app):** the same model organises WORK — projects and documents: read a folder of PDFs,
  summarise, pull out dates / tasks / amounts into the plan, answer from them with the page cited.
- **Owner:** Ali, 21, Egyptian, owns a crane company (150 employees). The app is built by an AI coding agent from his decisions.
- **Launch:** Google Play in about one month (December 2026). Goal: "the app perfect and really smart — ready = no mistakes".
- **Markets:** global. Egypt and the Arab world first-class (Egyptian Arabic UI, Franco-Arab typing, Hijri dates, Ramadan),
  but built for every country (30 country packs: currency, VAT, weekend, holidays, emergency numbers).
- **Languages:** 20 interface languages (Egyptian Arabic, Modern Standard Arabic, English, Spanish, French, German, Portuguese,
  Italian, Russian, Turkish, Indonesian, Hindi, Urdu, Persian, Bengali, Swahili, Thai, Vietnamese, Chinese, Japanese, Korean).
- **Pricing:** free tier + Pro, three regional price tiers (cheaper in lower-income countries), a 7-day trial.
- **Product family:** Attune (this app) · Attune Business (separate: fleet & rentals, books, ERP for companies) · later maybe
  Attune Fit and Attune Learn. Ideas for THIS app should fit "life + work organiser", not business ERP or fitness.

## 2. The principles every idea must respect
1. **One life, connected** — say something once, it lands everywhere it belongs (a meal with a price → money; a debt → plans).
2. **Code first, AI second** — code calculates, checks and stores (sums, dates, balances, VAT are ALWAYS exact, by code); the AI
   understands what the person means and writes. The AI must never invent a number. (A real bug just fixed: "Sheikh pays me
   19,500 in instalments of 2,500" was saved as 8 × 2,500 = 20,000. Now a "number guard" checks every amount the person said is
   kept, and a battery of real sentences tests every reader.)
3. **Private by design** — data lives on the device (and optionally the person's own Google Drive, encrypted on the device).
   Questions to the AI never leave the phone. No server collects data.
4. **Simple on the surface, deep underneath** — a first-time user sees one box and their day.
5. **Works on every device** — weak phones get light models and more code; strong phones and computers get everything.
6. **Reliable before new** — nothing lost, nothing wrong.

## 3. How it is built (what is possible and what is not)
- **Android app:** Kotlin shell + a WebView running a React app (one bundled page, works offline). Target Android 17 (API 37).
- **Offline AI:** llama.cpp on the phone (GGUF models such as Qwen 3 / 3.5 small sizes, ~0.6B–9B depending on the device), plus
  on-device OCR (ML Kit), speech, embeddings for search by meaning (bge-m3, optional). Optional web search for answers from
  trusted sites when the person allows the internet.
- **Native powers already used:** notification listener (reads notifications offline to plan the day, catch payments from bank
  SMS / apps, and reply to chats through the notification's own Reply action), alarms/reminders, home-screen widgets, quick
  settings tile, an in-app browser that agents drive (reads prices, fills forms — never pays), background checks (AlarmManager +
  Jsoup), contacts picker, camera, file access, Google Drive sync.
- **Hard limits (Google Play policy and Android):** NO Accessibility-service automation of other apps, NO sending SMS by itself,
  no reading other apps' screens, no downloading YouTube videos, no keyboard that logs typing. Messages can be sent automatically
  only through a notification's Reply action; otherwise one tap. Agents never pay; the person confirms.
- **Licences:** any open-source code reused must be commercial-safe (MIT / Apache / BSD-style; no GPL in the app).

## 4. Everything the app does today (v9.4)
**The organiser (core):**
- **Home / Today:** "Right now", *Your day* (built from notifications offline: who wrote, what someone asked at a time, what arrives
  today; prayer times and Ramadan mode only if the person turns them on), numbers (safe to spend today), "Attune noticed", To-do
  card, one box that acts in every part of the app. Evening "Close the day" (move unfinished items to tomorrow). Simple mode.
- **Chat:** answers and *does* — records spending/income from a few words in any language ("uber 120, lunch 200"), sets reminders,
  builds plans, splits bills, sets agents; when unsure it asks "Which did you mean?" and learns. Franco-Arab understood.
- **Voice "Ya Attune" (يا أتيون):** wake word, talk to the organiser, full-screen call, interpreter.
- **Reminders · Follow-ups (one list by day) · Deadline Radar (bills, renewals, expiries) · Month plan (money pots, "what if")
  · Missions (a goal with a number and a date, broken into steps) · To-dos & lists (repeating lists).**
- **Money:** a full ledger by typing, accounts, bills, recurring, reports, receipts by photo, payments read from bank SMS /
  notifications, "Money for two" (share one budget or all money with a partner via an encrypted file), Zakat.
- **Money Guardian:** late debts, double charges, price rises, forgotten subscriptions, a scam check before paying.
- **Automations:** "when the salary arrives, put 20% in the car fund". **Message alerts:** "tell me when Ahmed messages me".
- **People & plans:** debts, instalments, savings circles (gam'eya), subscriptions, the maid every Saturday, a person's history.
- **Mind (second brain):** everything kept, filed by itself, folders; **Recall:** one search by meaning over screenshots,
  notifications, chats, notes, payments.
- **Projects (work):** a folder with instructions, files, chats, a tasks board, its own assistant and repeating jobs.
- **Documents:** ask a PDF or several books, page cited; File Converter (80+ conversions keeping the layout), edit/sign a PDF,
  photo → Word; Slides & reports from a sentence; Writing (rewrite, shorten); Translate (text, documents, video subtitles).
- **Family:** shared list, family expenses, who owes whom. **Family health:** medicines, doses, lab results, appointments.
- **Read it to me:** point the camera at paper → read, explain, turn it into a reminder or a bill.
- **Chat X-Ray:** money, promises and unanswered questions from a WhatsApp chat export.
- **Travel:** trip plan, documents, packing.
- **CV / Resume, mock interview** (and a planned job agent that fills applications; the person presses Submit).
**Agents (the app acts for you):** one consistent card for each; rules told in plain words ("only 4-star and up", "ask me first",
"by itself under 500"); background checks; a board view.
- Watch a price (any store); hotel watch over a date window with the cheapest dates and real hotel cards; cheapest flight over
  6 sites with date windows ("1 December to end of January, 4 days, to Spain"), buy-now-or-wait advice; find & buy (asks first);
  track a delivery; order my usual; follow a topic / research.
- New in v9.4: reply helper (who is waiting for your answer + drafts), scheduled messages ("send Ahmed 'I'm on my way' tomorrow
  at 5 pm"), visa appointment watch (VFS, TLScontact, BLS, US visa), restock (learns what you buy regularly), price protection
  (the price fell inside the return window → the message to the store), find a doctor (Vezeeta, Doctolib, Doctoralia, Practo,
  Google Maps), travel day (check-in, when to leave, gate changes from notifications).
**Platform:** engine (install/run offline models, speed and heat doctor), sync (Wi-Fi between devices + own Google Drive,
encrypted), privacy page ("your week": every connection shown), 30 country packs, 20 languages, home-screen widgets, first-minute
onboarding, "How to use" guides with sample data, desktop app.
**Archived (not in the app now):** fitness & food diary, cycle tracker, image studio, offline maps, learning courses, business ERP.

## 5. Known weaknesses (be honest about these and attack them)
- Small on-device models misunderstand sometimes; the person feels "the chat is stupid" when one sentence is misread.
- Many features → risk of clutter; first-time users must not be overwhelmed.
- Agents depend on websites that change, need logins, or block bots; background checks without a browser can't run JavaScript.
- Battery, heat and storage for on-device models on mid-range phones (most of the Arab world and South Asia).
- Play policy limits automation (no Accessibility, no auto SMS).
- No server = no cross-user features, no cloud AI by default; growth and retention must come from the product itself.
- Launch in ~1 month by a one-person team with an AI coder: ideas must be buildable and testable, not 6-month projects.

## 6. What I want you to research (think deeply, use many sources)
1. **Competitors and the best in class** — what do Todoist, TickTick, Notion, Motion, Sunsama, Reclaim, Akiflow, Amie, Structured,
   Tiimo, YNAB, Monarch, Copilot Money, Emma, Splitwise, Rewind / Limitless, Mem, Reflect, Apple Intelligence, Gemini on Android,
   Samsung Galaxy AI, Microsoft Copilot, Rabbit, and the strongest apps in the Arab world, India, Indonesia and Latin America do
   that people LOVE (and what they complain about in reviews)? Which of those can Attune do better because it is private,
   offline, code-exact and multilingual?
2. **Open-source projects** (commercial-safe licences) we could learn from or reuse: e.g. Khoj, Reor, Logseq, AppFlowy, Actual
   Budget, Firefly III, Immich, Home Assistant, llama.cpp ecosystem, MLC LLM, Duckling-style date/number parsers, open
   intent-parsing datasets. Name the repo, the licence, and exactly what to take.
3. **On-device AI research 2025–2026** — the best small models for phones (accuracy per GB, Arabic quality, tool calling),
   speculative decoding, quantisation, NPU use on Android, structured output / grammars, small-model routing, on-device RAG,
   memory for personal assistants, evaluation of "does the assistant understand the user" — and how to make a 1–4B model feel
   smart (code-first readers, constrained decoding, self-checks like our number guard).
4. **Agents that act** — what is realistic on Android in 2026 within Google Play policy; the most valuable agent tasks for
   ordinary people (bills, bookings, appointments, refunds, government services, shopping) in different countries; how to make
   them reliable when sites change.
5. **Retention and daily habit** — what makes people open an organiser every day (morning/evening rituals, widgets, streaks
   that are not childish, notifications that help, "it noticed something for me" moments). Evidence, not opinions.
6. **The first 5 minutes** — onboarding and first value for a non-technical person on a mid-range phone, in Arabic and English.
7. **Trust and privacy as a feature** — how to show "your data never leaves your phone" convincingly; what privacy-first apps do.
8. **Global fit** — features that matter per region (Ramadan and prayer opt-in, Hijri dates, cash economies, savings circles,
   remittances, mobile wallets like Vodafone Cash / InstaPay / UPI / M-Pesa / Pix, informal debts, family finances, Chinese
   and Japanese habits), without making the app feel local-only.
9. **Monetisation that fits privacy** — Pro features worth paying for, regional pricing, affiliate income from agents (Booking,
   Amazon), family plans — what converts, with numbers where possible.
10. **Accessibility and voice-first use** — older parents, low literacy, one-handed use, voice in Egyptian Arabic.

## 7. Rules for your ideas
- Every idea must fit the brand (life + work organiser with private offline AI) and the principles in section 2.
- Must be possible on Android within Google Play policy (section 3) and in the desktop app; say if it needs the internet.
- Prefer ideas that make EXISTING features smarter, simpler or more connected over brand-new apps inside the app.
- Prefer exact code (rules, parsers, checks) for anything with numbers or dates; use the AI for understanding and writing.
- Be specific: not "add AI insights" but "every Sunday at 8 pm, a card: 'You spent 1,240 more on delivery than last month —
  set a 2,000 limit?' with one tap".
- Say what to REMOVE or hide too, if it would make the app stronger.

## 8. The format of your answer (please follow exactly)
1. **Executive summary** — 10 lines: the biggest opportunities and the biggest risks.
2. **The ideas** — 30 to 40 ideas, each with an ID **R1, R2, …** so I can answer "R3, R7, R12". For each:
   - **Name** (short) and **one line in Egyptian Arabic** saying what it is (for me).
   - **The problem** it solves, for whom (with evidence: a source, a review quote, a statistic).
   - **How it works** in Attune, step by step, what the person sees (a short text mock-up of the screen or card).
   - **Where it lives** in the app (Home, Chat, Money, Agents, Projects…), and what it connects to.
   - **Offline?** yes / partly / needs internet. **Play-policy safe?** yes / how.
   - **Effort:** S (a day), M (a week), L (a month). **Impact:** low / medium / high. **Risk** and how to reduce it.
   - **How we'd know it works** (one metric) and **sources** (links).
3. **Ranked table** of all ideas: ID · name · impact · effort · offline · why now.
4. **Top 10 to build before launch**, **5 quick wins** (a day each), **5 bold bets** for after launch.
5. **What to cut, hide or merge** to make Attune simpler and stronger.
6. **Model and engine recommendations** — which on-device models to ship per device class, and the techniques to make them
   more accurate and faster (with sources).
7. **Competitor table** — 10–15 apps: what they do best, their weakness, what Attune can take.

Write in clear, simple English. Be concrete, honest and evidence-based. Quality over quantity.

---

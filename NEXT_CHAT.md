# Attune — start here (handoff for the next chat, 7 Nov 2026 — v9.8)

> ## START HERE (28 Nov 2026 — v10.9.10: Ali's phone list — the pop-up on every open, Money Guardian "90 % wrong", two Claude accounts, the Engine log, glitchy scrolling)
> **1 the pop-up** ("Attune closed unexpectedly last time: signal 9 (Blaze)" on every open): shown only with the tester's switch, but for
> ANY ending not marked "cached" — MagicOS's memory manager closing a resting app (process state "service") counted. Now only an ending
> while Attune was ON SCREEN (x.fg) is shown; the rest stays in the Engine log (attune.jsx lastExit effect).
> **3 the Engine log** — (a) two ANRs, AgentWatchReceiver (25 + 27 Nov) and ScoutNightReceiver (25 Nov): the receivers ran the whole round
> under goAsync (~60 s; a round reads up to 40 pages + the invisible browser, Scout up to 30 searches) → NEW BgRunJob (AgentWatch.kt): the
> receiver only plans a one-shot job (10-minute budget, any network) and returns. (b) "signal 9 · iAwareR[LowMem](service) · 600–875 MB"
> 5–17 min after he left, ~10 times in 4 days: the model stayed loaded in the background, so the phone closed the whole app and every
> reopen was a cold start (page + model). MainActivity: after 4 minutes in the background with nothing being written (GenService) and no
> background AI job using it (Engine.inUse, held by MindBgJob / AiNightJob) the model is let go; it reloads on return (the existing
> freedForMemory path). Not measured on his phone yet — check the Engine log for "4 minutes in the background" and fewer LowMem endings.
> **2 Money Guardian** (his screenshot: Enzu 6,230 · Support 5,144.78 · Egp Off 800 · Last Chance 3,899/yr · Your Dessert 295 · Supplexon ·
> Talabat Deals · Alex Forte $115 · Meta For · First Order · Don T · Order Your — all adverts): overpay.js readSource made a charge of
> anything with the bare word "order" + an amount, and the name guessed from the title counted as a KNOWN service (one charge = a monthly
> subscription). Now: isPromo (EN / Arabic advert words, unless the text is a real receipt) → nothing; "order" only as an order receipt;
> a guessed name is a merchant (3 steady months needed) unless the receipt itself says renewal / subscription (SUB_WORDS); perks only
> for a known service or points. Direction marks, double spaces and Arabic-Indic digits no longer hide a receipt's amount ("USD ‎20",
> «٧٥ جنيه»). **Two Claude accounts**: the account each email went to is kept — PayListener reads the notification's subText address
> ("acct"), GmailRead keeps Delivered-To / To ("to"), paylog / autopilot carry it into the payment's evidence; overpay groups charges by
> service + account ("Claude (a@…)", "Claude (b@…)"; a bank SMS joins the account whose email is the same charge); guardian "Charged
> twice": never for two different accounts, never when the same pair came in an earlier month, a bank message + a shop email = ASK,
> and a subscription service twice the same day with no account named = ASK (SUBS now has anthropic / perplexity / midjourney — the bank
> writes ANTHROPIC, the list only had claude). His already-saved data has no account addresses (they were never kept) — the 13 Nov
> Anthropic pair now ASKS instead of "Charged twice"; new receipts carry the account.
> Tests: NEW tests/subs/gen.mjs — 10,000 HARD composed people (1–4 real services by email / notification, EN / Arabic, an advert line
> inside some receipts, the same service on two accounts, the bank SMS for the same charge, steady local payments, one-off orders, 3–14
> adverts composed from parts, a real double charge as a control): 40.96 % at first (two generator mistakes said and fixed: a local name
> shows its first two words; the twin Money entries used other addresses) → 80.31 % → 100 %; held-out seeds 1–3 100 %; 100 % different
> advert shapes. Real bugs it found: direction marks / double spaces / Arabic-Indic digits, and "ANTHROPIC" not a subscription word.
> Unit tests/unit/v10910subs.test.mjs (his exact adverts, two accounts, the bank pair, a real double, «٧٥ جنيه», a 2,500 sample).
> **4 scrolling** — measured first (NEW tests/trials/scroll.py: a full phone, CPU 4×, Home / Money / Follow-ups / Mind / Chat scrolled
> frame by frame): smooth in desktop Chromium (median 16.7 ms, no frame over 50 ms except Mind's first 85 ms). So the stutter is
> Android-WebView-only. The Glass ground was `body { background: var(--g-page) fixed }` — a fixed background makes a phone's WebView
> repaint the whole screen (gradient + every card's shadow) on every scroll frame. Now body::before is a fixed layer of its own (build/
> tw.css); screenshots before / after at 390 and 1366: identical. NOT proven on his phone (headless Chromium records no paints) — ask him.
> harness.py: NO_ENGINE=1 runs page-only trials without llama-server.

> ## START HERE (27 Nov 2026 — v10.9.9 part 3: Ali's picks A1 A2 A3 A4 B1 B5 — https://claude.ai/artifact/EqcSsaHBz1kb7kM9Y9Mwdr)
> **A1** Mind never deletes your own notes: memindex.pruneMind clears only Attune's own saved answers (chat / ask / instant / copilot / web /
> research), oldest first; your notes, to-dos, Money notes, photos, places, files, pinned are never cleared for room (20-language notice).
> **A4** the first word sooner (measured with tests/trials/promptcache.py, the engine's own cache_n / prompt_n): the rules are the SAME for
> every question (the language line and the photo rule go WITH the question; the photo rule only with a photo), and tapping the box
> pre-reads the rules + the chat so far (warmChat, 1 token, quiet, never cancelled). Tokens read before the first word (test model):
> 1st question 1,840 → 109, 2nd 1,030 → 365.
> **B1** (OK-B1) chips under every "From your own data" answer + the "From your Mind" line: lifeask refsOf (each record keeps its ref; a
> Money entry linked by a name in a note brings that note as a chip), personal.mindAnswer refs; srcchips-ui.jsx opens THE thing through
> personpage.openOriginal (+ "attune-open-item" so kept pages read it; Money remembers the asked payment 5 s across a rebuild).
> **B5** (OK-B5) Settings › Test every page (testpages.js + testpages-ui.jsx): Home · Chat · Money · Mind, then every Tools page; 12 own
> steps + a general one; the person's own words where there are some; ✓ / ✗ (note + screenshot) / Skip; kept across restarts; the phone
> hides it to a "Back to the test" pill, the computer keeps it at the side; Share the list = one .html report (text + screenshots).
> **A3** lag on a FULL phone at phone speed (tests/trials/lag.py: 4,000 Mind, 3,000 Money, 200 chats, CPU 4×): Send → question on the
> screen 25,425 ms → 250 ms (the barber fix's groupOf folded the whole word list for every word of every note — 5 s at full speed; now a
> table made once + aliases cached + a quick look before splitting; lifeedit groupOf the same; rules.daysIn made ~200 RegExps per
> sentence → once; insightsCached's key changed with every chat answer → only your own records count; brainFacts cached + prepared in
> idle; the question is drawn before it is read); the reading after it 25 s → ~1 s; Mind first open 445 → 276, Mind search a key 439 →
> 174 (tagsOf per record once), Follow-ups first open 1,107 → 591 (one number formatter). Not done yet: the ~1 s reading after Send,
> first opens still ~250–600 ms; tests/trials/lag.py at 1366 does not start (the start page) — fix the script.
> **A2** every everyday "my data" question tested like the barber: tests/mydata/gen.mjs (NEW) — 10,000 HARD composed people (a month of
> Money in shops + categories, older months, a salary, who owes whom, subscriptions, papers, reminders, a car note, a past question in
> Mind) × 18 kinds of question (cat-month, shop-month, last-paid, total-ever, top-cat, subs, owed-in, owed-out, who-owes, expiry,
> tomorrow, week, appointment, earned, spent-month, about, spent-day, cat-lastmonth) in English / Egyptian / Franco, checked for the right
> number / date / name: 49.0 % at first → 100 %; held-out seeds 4 and 5 (never looked at) 100 %; 100 % different cases, 20 % different
> question shapes (the question alone — honest: the frames repeat, the people and their data never do). Real bugs fixed: "where did most of
> my money go?" answered with due dates; "when is my dentist appointment?" with Health spending; "how much do I owe Sara?" with every
> commitment (now that person, 2 new lines in 20 languages); NETFLIX.COM + Netflix = 2 subscriptions; a monthly subscription "already late"
> since the month it started, an open loan "due" forever (life.dueSoon); «ليلى» lost its «ل» (any name starting ل / و / ب); "fuel" missed
> "benzine 92" (the barber groups now in Money's word sums); "in total / so far" said "this month"; "for November" read as a shop; "(roughly)",
> "— thanks", "?!", "btw", "quick q:" around a question. NEW egyask.js: Egyptian / Franco "my data" questions → the English frame the
> readers know (the thing mapped, a name kept). Three generator mistakes said and fixed (one spelling per shop; a Netflix charge in Money is
> a subscription too; an expired paper IS late). Unit: tests/unit/v1099mydata.test.mjs (the probe's wrong answers + a 2,500 sample).

> ## START HERE (26 Nov 2026 — v10.9.9: Ali's barber screenshots + "still glitchy and slow")
> Ali's two screenshots: (1) Chat answered "Your barber is Hany Rabee3" under "From your Mind: … · Tell me about my barber · Who won the
> last champions league final" — his own PAST QUESTIONS (every chat turn is kept in Mind as kind "chat") were read back as notes; and the
> line under it said "From: the model's own knowledge". (2) "When is the last time I went" → "The last time: 2026-11-26 (today) — Last
> time I went to the barber." = his question of a minute before, read as a visit. (3) While typing, the answer's buttons / "Open Mind"
> showed THROUGH the message box (light Glass: --c-surf is 76 % white), and the answer card stayed under the box with ↓ over its title.
> Fixed: chat's memSearch / memStrong / memMeaning use only what HE wrote or kept (ownRec) and never a question-only record
> (lifeask.isAskedText — leads "hey Attune, / يا أتيون،", tails "thx / تمام / 🔔", "?? ", Arabic question words at the end, lists and
> "What I need: …" stay notes); lifeask.recordsAbout skips chat / ask / instant / copilot / money records and question notes; lastTime
> takes a NOTE only when it tells of something done (went / visited / روحت / حلقت…; a note's date is when it was written);
> sourcelabel: fromMine → "From: your data"; spaces.glassCss: the composer (and anything data-solid) has a solid ground; chat.jsx:
> following stops by the finger / wheel (+1.5 s fling) or ANY move up away from the bottom (scrollbar, Page Up) — the keyboard closing, the box
> resizing or the page growing keep it (e2e_v513's table wheel test caught the first version), and
> resize / visualViewport resize / padB / typing re-scroll to the bottom. **Slow:** the whole Mind BM25 index was rebuilt after EVERY
> chat answer (1,500 records ≈ 100 ms on a computer, 3–5× on a phone) and all of Mind (MBs) was written to storage in the same moment →
> memindex.js (new): the index holds the records, each record's words counted once (WeakMap), updated record by record (≤ 8 ms, same
> results as a full build); Mind is written 0.6 s after the last change and at once on background / close (window.__attuneMemFlush,
> called by lifeask.loadStores and backup.collectData before they read storage). Tests: tests/unit/v1099askmind.test.mjs (Ali's case;
> 10,000 HARD composed questions-vs-facts 99.98 %, held-out seeds 1–3 99.99–100 %, 79 % different shapes; the index), e2e_v1099askmind.py
> (390 + 1366).
> **Part 2 (same day) — Ali: "last time I went to the barber should look on notes, money, everything — I saved it as a note in Money":**
> lifeask.recordsAbout now matches each asked word's whole GROUP (barber = haircut / hair / shave / salon / «حلاق» / «حلاقة» / «احلق» /
> 7ala2; dentist = teeth / «اسنان» / asnan; gym; doctor; mechanic = garage / «ورشة» / mekaneeky; pharmacy = chemist / «صيدلية» /
> saydaleya; fuel; laundry; supermarket), drops helper words when a place word is there ("dental clinic", "doctor el asnan", «دكتور
> الاسنان» = dentist), and takes the NAMES his own notes give the thing ("the barber I go to hany rabee3 I cut with 1.ahmed me8awry…"
> → a Money entry that says only "hany rabee3" / "ahmed me8awry" / "ezaby3" counts; two-word names, or one word with a digit). "The last
> time" never takes a future reminder. Questions: Franco "a5er mara ro7t el 7ala2 emta", «اخر مرة روحت الحلاق امتى» («روحت» = mine), the
> question words / "ok" / «تمام» / emoji / a line break left out of the thing, "get a haircut"; a bare follow-up "When is the last time I
> went" takes its thing from the question before (chatAsk prev — chat.jsx passes the last user message). Tests: tests/lasttime/gen.mjs
> NEW 10,000 HARD composed people (the visit saved in Money in other words / by a name / in a note / in People & plans, among distractors:
> newer spending, his own questions in Mind, a reminder next week, another place, an older visit; EN / Egyptian / Franco / follow-up):
> 63.3 % at first → 100 %, held-out seeds 1–3 100 %, 94 % different shapes; unit v1099askmind (+44: his case × 8 notes × 5 questions,
> never invented, 2 × 2,500 sample); e2e_v1099askmind (+3 per size). Not changed: the model's own wording ("Other barbers you go to include…"), token speed (19.6 t/s is the model on his phone).

> ## START HERE (24 Nov 2026 night — v10.9.8: the new-user walk-through)
> Ali asked for a "real user" walk: Claude used Attune as a NEW person (customer mode, no test presets) on a typical Egyptian phone that
> is NOT Ali's (12 bank / wallet SMS: InstaPay, Vodafone Cash, NBE, Banque Misr, CIB, an OTP, an advert, a refund, an ATM, a declined
> one, a dollar charge), typed 30 everyday sentences in English / Egyptian / Franco, asked Chat about its own records, at 390 and 1366.
> Found and FIXED (each with a test): **money** — a 9.99 USD Netflix charge was saved as 9.99 EGP (paylog.appendToLedger: a currency no
> account holds now gets its own account); Netflix was "transport" ("tfl" inside "neTFLix" — every merchant brand now matches only where a
> word starts; Coca-Cola / frontier too); «إلى محمد سامي بنجاح» kept «بنجاح» in the name; «ماكينة الصراف الآلي فرع» → "ATM"; a transfer /
> ATM were "bills" (the bank's «رصيدك» read as phone credit — balance lines are left out of the category); «تم شحن رصيد 100» (Vodafone Cash
> top-up) was missed (the balance in the NEXT sentence pulled the 100 down); names lost when a bank writes «ألى» or in CAPITALS;
> «عشان» (because) contained «عشا» (dinner) → «دفعت 200 عشان الكهربا» was food. **Chat answers** (lifeask.js / myledger.js) — "when does my
> passport expire?" answered "call the bank on 25 Nov" (now: the paper NAMED, any language — «جواز السفر», "el basbor" — or "Nothing saved
> for “car licence” yet"; "car licence" never picks "Car insurance"; reminders never answer an expiry); "what do I have tomorrow / today?"
> went to the model (now: that day, with times); "how much on food?" said "No expenses are recorded this month" (now: "Nothing spent on Food
> this month. Related: Groceries 535 EGP · Coffee/Tea 45 EGP."); «أحمد عليه كام؟» with Ahmed saved in English letters → "owes you nothing"
> (names matched across scripts, entities.nameKey); Franco questions ("Ahmed 3aleh kam?", "3andi eh bokra?", "el basbor beyentehy emta?");
> \b never matched beside an Arabic letter in the question check («… امتى» with no "?" wasn't a question); «قولي عندي» read as «لي عند»;
> «؟» sat inside the "Arabic letter" range so «عليه فلوس ليا؟» failed; direction marks / double spaces / "2 questions:" / "remind me, what…"
> cleaned first. **Home box** — Franco "fakarny ba3d bokra el sa3a 5 adfa3 el egar" asked "What did you mean?" (Home's detect now reads
> Franco as Arabic like doFromHome; "egar" added). **Computer** — the first-run screens sat SEE-THROUGH over Home (a new computer starts in
> the Glass look, where only role=dialog panels get a solid ground — both are dialogs now). 11 new answer lines in all 20 languages.
> Tests: tests/unit/v1098walk.test.mjs (the 12 SMS plain + 2,200 HARD versions; the first minute; the dollar account; a 2,500 sample + a
> held-out of tests/walk/gen.mjs), tests/walk/gen.mjs (NEW: 10,000 HARD composed own-data questions — 67.2 % at first → 100 %, held-out
> seeds 1 and 2: 100 %, 90 % different shapes; one generator change was unrealistic and removed: a time stamp in front of a question, and
> doubled punctuation "remind me,,"), tests/e2e_v1098walk.py (390 + 1366). The 10,000 notification + first-minute runs are unchanged.
> **Waiting for Ali (look & feel — his pick):** (W1) on a COMPUTER the first-run money screen still offers "Bank & wallet messages … on this
> phone" with both rows off — skip it on a computer, or word it "connect your phone"? (W2) after "All right ✓" Home shows nothing of the
> month just organised (no money line) — a "This month 6,339 EGP" line on Home? (W3) Money's "Safe to spend today 0 EGP · about 2,070 a day
> until Nov 30" reads as a contradiction. (W4) "buy milk, eggs and bread" became ONE to-do — split into a list of 3? (W5) a Franco reminder
> keeps "3andi" in its title ("3andi doctor appointment"). (W6) a refund (+300 from NOON) is not taken off the month's spending.
> **Ali answered (same night):** 1 "connect your phone and an option to skip" · 2 yes · 3 "do what's best" · 4 "things by categories that
> seem similar under 1 category, e.g. a groceries list, each a checkbox like the to-do, done automatically" · 5 yes · 6 "it can be added to
> income". **Built:** W5 (actions.titleFrom drops "I have / عندي / 3andi / ana 3andi" in front, "el khamees", a weekday that is the date —
> kept after for / before / by; also fixed "remind me friday to call mom" → «friday to call mom») and W6 (firstmin keeps refunds —
> refund / reversal / cash back / «تم رد مبلغ» / استرداد — and All right saves them as INCOME "NOON ↩", "Back to you · added to income"
> row, 20 languages).
> **Ali OK'd W1–W4 (+ W5/W6 as built) → BUILT** (combined mock-up https://claude.ai/artifact/QyVASEWtv17cc8a8QhtGcE).
> W1 — firstmin-ui: on a computer with no phone messages (spaces.isBigScreen && !canSms) the money step is "Connect your phone" (opens
> Backup on its Sync tab: attune:backup:tab = "sync"; the phone shows a code, the computer types it) + "Skip — I'll type on the computer".
> W2 — monthcard.js (pure) + monthcard-ui.jsx: "This month" on Home under the to-dos (phone) and in the same place on the computer
> (desk-ui): spent per currency (never added), top 3 categories, "Back to you" (refunds "↩"); it notices Money changing (attune-ledger,
> visible again, every 4 s while visible — recomputes only when ledger.v3 changed). W3 — safespend.js fromTomorrow / over / afterToday;
> once something is spent today the line is "You spent 4,140 today, 2,070 over today's share · From tomorrow: about … a day until …"
> (from what is really left; never promises more). W4 — autolist.js readShopping (EN / Egyptian / Franco; "buy / get / we need / we're
> out of / shopping list:", «هات / اشتري / محتاج / ناقصنا / طلبات البيت:», "hat / e4tery / me7tag"; items split on , / and / & / "/" /
> w / «و»; bullets, numbers, one per line; "when you go out", «وانت راجع», "law nzelt" dropped) → Groceries / Pharmacy / Home & cleaning
> / Clothes / Electronics / Gifts lists (list.auto = kind, made once in the person's language, reused; bought items needed again are
> unticked; the person's own lists never filled by themselves; an unknown item stays a to-do); never: money spent, a reminder at a
> time, an agent's price / order, a question. cmdrun.route "autolist" (after a named list), Home (Undo) + Chat. tests/autolist/gen.mjs
> NEW 10,000 HARD composed: 84.1 % → (made harder: list shapes) 76.5 % → 100 %, held-out seeds 1, 2: 100 %, 62 % shapes; one generator
> fix (a Franco word used for two things). Real bugs found on the way: «بروفين» held «فين», «فيتامينات» «مين» (Arabic words now whole),
> «و» with a space. "bring" is not a shopping word. All lines in 20 languages. Tests: unit v1098walk, e2e_v1098walk (390 + 1366).

> ## START HERE (24 Nov 2026 later — v10.9.7: the first minute, Ali's OK-FM)
> Ali OK'd https://claude.ai/artifact/SRbHba7CwMVSndiLqD7LX7 (FM1 + Gmail + ✎ edit, FM3; FM2 = Organise this; FM5 after the win; S1 note: "Gmail
> should be read automatically"). Built: web-src/firstmin.js (pure) — the last 30 days of bank SMS (old SMS in the full APK + kept bank
> notifications) and Gmail's money emails (a YEAR on the first read: yearly plans, earlier renewals, an older PayPal rate) → this month's
> spending, subscriptions (one per plan, newest receipt; a plan overdue past its period + 7 days has stopped), monthly + yearly, twins
> joined (an SMS and its email: the same amount in the same currency and no clashing shop names; dollars via the person's OWN rate, a
> PayPal "EGP = USD" line, never an invented one), PayPal receipts named by the shop (+ the "*ENZU.COM" statement alias), "Check this one"
> (a shop's invoice for the same amount as a payment → same plan?; unsure reads; a period only guessed). firstmin-ui.jsx: S1–S5 as the
> mock-up; All right → Money (the home currency, "Claude · 22.80 USD", with the message as evidence, never twice) + Dates renewals, Undo;
> learned per sender (attune:fm:learn:v1). Opens after the first-run country screen and from Set up your life ("Organise my month from my
> messages"). Gmail now read by itself every 3 h (was 20 h). Real bug fixed on the way: subread read Google Play's "until cancelled. Learn
> how to cancel." as CANCELLED (Ali's Google One renewal). Tests: tests/firstmin/gen.mjs 10,000 HARD composed people 100 %, held-out
> (8 more sets written after the fixes) 100 %, 99.7 % different shapes; unit v1097firstmin (Ali's real month 7,135.46; yes-same → 68,525.52 a
> year); e2e_v1097firstmin (390 + 1366). Honest: Gmail for everyone needs Google's review (docs/GMAIL_VERIFICATION.md); the Play build has
> no READ_SMS → only bank notifications kept since access (the full APK reads the last 30 days of SMS).

> ## (24 Nov 2026 — v10.9.6: passwords sync + Chat answers from them)
> Ali: "I want passwords to be sync and for chat to be able to answer from it". → attune:pw:* now travels in BOTH syncs (Wi-Fi + Google),
> inside the same encrypted file (PBKDF2 + AES-GCM, locked on the phone first — the unit test checks the file shows no password).
> backup.js mergePwSecrets: the values have no dates, so each account's values come from the side whose ACCOUNT was changed last (an edit
> on the computer reaches the phone, the older copy never wins back); a deleted account's values are dropped, and pwstore.pruneSecrets
> cleans leftovers when Passwords opens. The restore guard stays (a restore without passwords never deletes them). Chat page (chat.jsx):
> pwAsk first → a `pw` message (only account ids + titles kept in the chat) rendered by PwAnswer — worked out by code, never sent to the
> model or the web, each password hidden until the fingerprint. Page line in 20 languages. Tests: v1094pw unit (+7), e2e_v1094pw (Chat, 390 + 1366).
> **First minute:** Ali picked FM1 (+ Gmail, accurate, ✎ edit) + FM3; FM2 = Organise this (already there); FM5 → after the win.
> Combined mock-up waiting for **OK-FM**: https://claude.ai/artifact/SRbHba7CwMVSndiLqD7LX7 (options were https://claude.ai/artifact/JwH7j35mybQxfMK8kvjEd7) —
> Ali agreed the scope is right (organise life: money, subscriptions, dates…); this is only how a NEW user sees it in minute one.

> ## (23 Nov 2026, late — v10.9.5)
> Ali: "1. what do you think [sync free or Pro] 2. yes [passwords in the backup]". → 1: recommended sync stays FREE (his option A rule:
> what people use every day is free; Pro = depth) — nothing changed unless he disagrees. → 2: the Passwords page is now IN the backup file
> (manual + daily; always AES-GCM with the backup password) and still NEVER in sync (sync.js deviceKeys + cloud.js SYNC_SKIP drop
> attune:pw:*); restoreData "replace" never deletes the phone's passwords when the incoming data has none (a sync from the computer), but a
> backup restore with passwords replaces them. backup.js NEVER_SYNC. The page's line: "Never in sync or any AI — only in your locked backup".
> Also in this version: tests/scan/reallike.mjs (10,000 in the layouts of Ali's real screenshots, 75.2 % → 100 %, held-out 100 %).
> **Kept-page fixes found by the full suite (same version):** a kept page (v10.9.2) whose data changed while you were away is BUILT AGAIN AT
> ONCE (the stamp is taken when the page is built, not when you leave — the maid / renewal rows were missing on Home); unchanged pages still
> show instantly. Home closes My report when you leave it ("attune-page-left"); the side-menu search "warranty" unfolds Things I own on a kept
> Follow-ups ("attune-fu-things"); "Your life" from anywhere keeps its pill (the event's mode wins over the stored one). Arabic "my…" questions
> (ASK_PERSONAL_AR: «الشهر اللي فات», «دفعت», «امبارح»…) reach the meaning search — it was English-only (tests/unit/v1095personal). 16 old e2e
> tests now pick only visible elements (kept pages hide copies) and follow v10.9.1's flows (backup step opens the panel itself); reminders in
> tests land "later today" (they failed after 23:00). Note: the Plan table lists "Sync with your computer" under Pro — phone↔phone Google sync
> is free, the computer app itself is Pro.

> ## START HERE (23 Nov 2026, night — v10.9.4: the Passwords page + Ali's real screenshots)
> **OK-PW2 built**: side menu → Passwords (web-src/pw-ui.jsx, pwstore.js, pwpaste.js): Toggles like Notion / All together (remembered), search,
> Paste a page (every line as written; no user name needed), Import file (.csv of 8 password apps), check list → Save 🔒 → Undo, screenshots per
> account (DocPhotos), Home chat "what's my discord password?" / "which accounts use my outlook email?" → the account card (password after the
> fingerprint) — on the phone Home BEFORE the router (a password never goes to the chat model) and on the computer through doFromHome.
> Passwords' secrets in attune:pw:secret:v1; backup.js SKIP /^attune:pw:/ → never in the backup file or sync (as OK'd). tests/e2e_v1094pw.py
> (390 + 1366), tests/unit/v1094pw.test.mjs, 23 new lines × 20 languages.
> **Ali sent 7 real screenshots** (PayPal → Enzu, Claude Pro receipt, Enzu invoice, Google Play AI Pro) → tests/scan/real/ali-2026-11-23.mjs.
> On them the reader was WRONG 4 / 4 although the generated tests were 100 % → fixed in the readers: an order number is not a card (bankcard.js),
> "Total excluding tax" / "Subtotal" are not the price, "Amount paid" / "Total" are; a label on the line above; the billing period "Nov 12–Dec 12"
> gives the next date; "Mastercard-2969" / "with - 2969" / "x-2969" give the card; an unpaid invoice → kind "bill" (due date, US date order
> read from the paper itself: 11/17/2026 → month/day); a PayPal receipt → the pounds that left the card (the exchange line) with the dollars
> as the original price. Now 4 / 4, kept in tests/unit/v1094scan.test.mjs. Generators still 100 % (subscriptions, passwords, read log).
> Next: OK-SS S2 (📎 Scan + Share → the "What I understood" card), the mixed-kind 10,000 test, more of Ali's real screenshots.

> ## START HERE (23 Nov 2026, night, latest — OK-PW with notes)
> Ali: "OK-PW — it doesn't have to have a username, I just want it as it is, with the option to add screenshots also, and if I ask Home chat
> for it it should recall anything; passwords should have a dedicated place, view all together but also toggles like Notion" (+ OK-SS, OK-BK
> again). New screen → mock-up OK-PW2: https://claude.ai/artifact/Qt98jErEkWSfYFiiof6H3t (docs/mockups/passwords.html) — **waiting for his OK**.
> Built meanwhile (invisible): web-src/pwpaste.js — readPastedPage (Notion toggles / Markdown export / headings / numbered / plain blocks,
> every line kept as written, passwords locked) + readPasswordFile (.csv of Google / Chrome / Firefox / Bitwarden / 1Password / Apple /
> LastPass / Dashlane). tests/pw/gen.mjs 10,000 composed (paste-real hardening — harden() changes case, a pasted password never does):
> first run 69.2 % (the test called a security question's answer "not secret" — wrong, fixed in the test) → 97.6 % (REAL bug: a password with
> @ and . looked like an e-mail and stayed open — fixed: an e-mail needs a real domain ending) → 100 %; held-out seed 2 100 %.
> After his OK: the Passwords page (Toggles / All together, search), add screenshots per account (phone only), Home chat recall with the
> fingerprint, 20 languages, phone + computer, e2e test. Accounts are radar items doc "account" (docfields.js keeps secrets apart).

> ## START HERE (23 Nov 2026, night, later — OK-SS in progress)
> Ali re-sent "OK-SS (accuracy is everything) · OK-BK" and asked: **"Add a specific model for each thing and make them work together"** →
> SCAN_PLAN.md (one model per job + code judges every number). Done: web-src/subread.js (subscriptions; tests/scan/gen.mjs 10,000 HARD 100 %,
> held-out seed 2 100 %; first honest run 78.6 %), web-src/scanread.js (the conductor, not wired into a screen yet). Next: SCAN_PLAN S1's
> mixed-kind 10,000 test, then S2 (📎 Scan + Share → the "What I understood" card, 20 languages, phone + computer). Still waiting on Ali:
> OK-PW, whether sync stays free, a few real subscription screenshots.

> ## START HERE (23 Nov 2026, night — v10.9.3: OK-BK built; OK-SS next)
> Ali OK'd **OK-BK** and **OK-SS** ("will be good if done right and accurate, accuracy is everything"); OK-PW not answered yet.
> **Built (v10.9.3)**: "Read from your messages" (web-src/readlog.js + readlog-ui.jsx): every bank SMS / notification read, the FULL
> message and where it went (→ Money · category · shop · amount) with Undo / ✎ Change (opens that payment's sheet) / Open; waiting ones
> Add / Not mine; left-alone ones greyed with WHY (paylog.js readNotification(n, opts, why) now says why). BK2: the line on top of Money
> (green / amber + Fix it now; on the computer "Read on your phone"). BK3: ReadWatch.kt — hourly WorkManager check, same rule as
> readlog.js stopAlert (access off / money SMS while the SMS switch is off / 6 h silent while the screen is on; ≤1 a day, never 23–08),
> Fix it now → reconnect + read the shade + "reading again ✓" (tap opens the list). Set up's bank row: "See what was read".
> Tests: tests/readlog/gen.mjs 10,000 HARD composed (100 %, 73 % shapes; held-out SEED_SHIFT=1 100 %), tests/unit/v1093readlog.test.mjs,
> tests/e2e_v1093readlog.py (390 + 1366). Honest note: after "Fix it now" the notification says "reading again — tap to see"; the
> payments it then adds are saved by the page when Attune opens (not named in the notification itself as the mock-up showed).
> **Next: OK-SS** (SS1 📎 Scan, SS2 new screenshots, SS3 Share → Attune; SS4 order: subscriptions + passports (mrz.js exists) + bank
> cards first; 10,000 hard cases per reader; accuracy first).

> ## START HERE (23 Nov 2026, evening — Ali's picks on quick input)
> Picks: PW1 PW2 · SS1 SS2 SS3 SS4 ("do as you wish") · BK1 + note ("see the message saved and saved to what") BK2 BK3; PW3 not
> understood (explained), PW4 not now. Combined page (OK-PW, OK-SS, OK-BK): https://claude.ai/artifact/FBuHWjYDtYYC2uoaoPPsK7
> (docs/mockups/quick-input-combined.html). **Build each block only after his OK**, in this order: OK-BK (smallest, his point 3),
> OK-PW, then OK-SS (SS4 plan: subscriptions + passports + cards first, then visas, then IDs per country; 10,000 hard cases each).
> v10.9.2 is on main (7 older tests now count only the page on the screen — kept pages stay hidden in the page).

> ## START HERE (23 Nov 2026, later — v10.9.2: Ali: "I want to reach 50 ms minimum")
> Tap → next drawn frame, 8,000 payments, CPU slowed 4× (tests/e2e_v1091speed.py, phone 390 + computer 1366):
> - **The side menu opens in ~25 ms** (was ~125): while it opens / closes the page under it is FROZEN (FrozenPage, React.memo that skips
>   while `freeze`) — before, opening the menu re-drew the whole app.
> - **Every side-menu page shows in ~20–40 ms** (Money was 322, Home 437): the main pages are KEPT built (attune.jsx KEEPABLE / keptList):
>   hidden (display:none, aria-hidden, inert) and frozen when you leave; shown at once when you come back, brought up to date 80 ms later;
>   built AGAIN fresh if anything was saved meanwhile (DATA_VER = every localStorage write except moving-around keys, + the ledger's
>   length for Money's own frame) — so a kept page never shows old data (tests/e2e_v1092keep.py). FIXED order in the document (moving a
>   page reloads Money's frame). Pages with a camera / map / call are never kept.
> - **The first tap too**: after Attune opens, the side menu's pages are built quietly one at a time (PREWARM, Money last), pausing 2.5 s
>   after any touch / key / scroll, never while the model answers. Browser tests skip it (navigator.webdriver) unless
>   `attune:test:prewarm` = 1.
> - Also: `window.__attuneDo` was deleted and set again after every render (an effect without deps) → once.
>
> ## START HERE (23 Nov 2026 — v10.9.1: Ali's 10-point list with 7 screenshots — "I am extremely tired")
> **Fixed by code, each with a test (tests/unit/v1091fixes.test.mjs, tests/e2e_v1091themes.py, tests/e2e_v1091speed.py):**
> 1 Free/Pro option A (Ali agreed): bank / wallet messages go to Money by themselves in FREE (plan.js: autoMoney no longer Pro); Pro =
>   Money Guardian's findings (Free sees the first), every year + reports, computer, Money for two, brain (billing.js table). Sync left as it
>   is (free since v9.9.40) — ASK Ali: his option A text said "sync" in Pro.
> 3 Set up your life: every row opens something (done → its page; backup → the backup panel); the bank row always says what the reader is
>   doing now ("Working ✓ — n read this week · last: CIB · 450") or, in amber, paused / SMS off / access off, with the fixing button
>   (bankcheck.js done → n, last, asleep, smsoff). 4 "Use the graphics chip" follows the REAL backend and flashes what happened (his phone's
>   GPU crashes LiteRT → back on the CPU; FastEngine.checkCrash). 5/8 Glass: the app's top bar (outside .calm) had no colour (--g-bar only in
>   .calm) → words slid under "☰ Mind"; now on html + solid on phones; the Autopilot sheet is a portal with a solid ground. 6 Glass:
>   Midnight / Black / Graphite / Warm drew the same ground → GLASS_DARK per ground; area colours never reach sheets (Settings over Documents
>   was violet); colour dots label on top; each background chip shows its colour. 7 "Most of it went on cmuwco6x7sl16y" → the name, or the
>   biggest entry's note, "in one payment". Also: an app's nudge / ad («لسه مادفعتش الإشتراك؟ ادفع دلوقتي») is not "waiting for your answer"
>   (chat apps or a named person only); a vague model summary ("Someone is requesting something related to …") is never a to-do.
> 9 Lag, measured (8,000 payments, CPU 4×): the Set up driver parsed ALL stores every 1.5 s on every page (58 ms freezes) → only while the
>   interview runs; lsjson.js readJSON parses a store once per change (loadLedger, safe-to-spend, setup); Money's formatter cached; unchanged
>   prefs no longer re-save the ledger. Money 322 → ~200 ms, Home 437 → ~260 ms, menu ~200 → ~130 ms, idle freezes 58 ms → 0.
>   NOT measurable here: the phone's synchronous Android bridge calls — next step if Ali still feels lag: time them on the phone.
> **Waiting for Ali's picks:** https://claude.ai/artifact/PAaS5zeqTkLDCCHH4oAXKz (docs/mockups/quick-input.html) — PW1–PW4 passwords,
> SS1–SS4 screenshot → right place, BK1 (built) BK2 BK3 bank status.
>
> ## START HERE (22 Nov 2026, night — v10.9: Ali's P8 phone test on the real model: "absolute bs … I lost hope in this app")
> **The model was handed the wrong things and trusted blindly. Fixed by code around it — `web-src/askguard.js`, wired into Chat:**
> pack passages only when they answer the question (`packsFit`; the prompt no longer teaches «لا تحتوي معرفتك»; that line is never an
> answer — asked again); "8. What's…" list numbers dropped (no "Record it in Money?"); a sum with its own numbers is its own question
> (the jacket got the crane total) + an answer about the PREVIOUS question is asked again without history; queued messages are add-ons
> only when they read like one; bombs / poison / meth refused by code (20 languages); fasting: the ruling goes with the question and
> «نعم … جائز» is replaced (20 languages); the future is unknowable; tips ≠ web news (the heat question found Facebook posts);
> «دفعت كام لأحمد» = only Ahmed's entries (myledger payee); Egyptian: «اشرحلي…» detected, long answers egyptianized, firmer hint;
> "Looking in your notes…" (19 s on EVERY question — a check that was always true) only for "my…" questions; "From: a knowledge
> pack" only when a passage was used. Tests: tests/askguard/gen.mjs (10,000 100 %, held-out first run 97.8 % → 100 %, shapes 70 %),
> unit v1090askguard, e2e_v1090askguard.py (phone + computer). REVIEW_P8 has the table. Next: Ali re-runs docs/P8_PHONE_TEST.md.
>
> ## START HERE (22 Nov 2026, later — Ali: "U never fix it for good … what's the use of AI if it didn't do anything")
> **Money, the final shape:** (1) code reads and saves at once — `moneycat.js`: HIS category named in any spelling (en / Franco / ar,
> "under / category / تحت / بند / في / من / على"), the note = only what it was; whole sentence decides when there is one amount; it also
> wins over a savings goal / subscription / workout / unasked reminder when the money was said spent or the category said as one.
> (2) when the code is NOT sure (Others, note ≈ the sentence, his categories exist) the MODEL re-reads it in the background with his
> category list — `moneyai.js` + `window.__attuneMoneyAi` (set while the model is ready); (3) code checks the model's answer (his
> categories only, his amount, his words) and the result card shows "Checked by the AI: «…» — …" with **Put back** (doit-ui.jsx).
> Also: money said to be spent is never an agent (Ali's English sentence became "New agent: 25000 egp expense · Amazon, noon…" — the
> detector AND doFromHome's own agent step). Tests: tests/moneycat/gen.mjs, tests/moneyai/gen.mjs (10,000 + held-out, 100 %),
> e2e_v1080moneyai.py, units v1080moneycat / v1080moneyai. Reminders: nth weekday (nth:N:W on page, desktop, Reminders.kt) and
> "every month" with no day asks which day. P8: docs/P8_PHONE_TEST.md — waiting for Ali's screenshots.
>
> ## START HERE (22 Nov 2026 — v10.8: Ali: "read every line of the 18 languages" + "re-run the 9 persona reviews")
> 1. **Languages** — `tools/i18n/deep.mjs` reads every line of the 19 dictionaries (numbers, English left inside, wrong script, symbols,
>    length, and SHIFTED / SWAPPED lines judged by length, end mark, numbers and a related language); the 320 most-used lines were read by
>    hand in all 18. Found and fixed: Japanese 1708–1725 slipped by one (every **Cancel** read «言い方が違いますか？ 修正する →»), Bengali
>    Cancel ↔ "Save the correction" swapped + a Know-tab swap, Chinese load-chart «幅度», "From"/"To" had two meanings — new keys
>    `From§range` / `To§range` / `From§account` / `To§account` / `To§email` (tr() shows the part before § in English; Egyptian showed
>    «المصدر» over the Money date filter), "Later" / "{n} late" wrong in 9 languages, 414 thousands written the language's way, 117 lines
>    the app shows missing in Egyptian, the interview coach English in 18 languages (jobready T() now translates). Tests: v1080langs,
>    v1080numbers, audit passes.
> 2. **Numbers** — the readers took "12.000" as 12: `web-src/numfmt.js` (ungroup: 12.000 / 12 000 / 1.500,50 / every script's digits /
>    5万 / 2 लाख / 1,20,000 / elfu 12; KWD-style 3 decimals kept) is used by doit, braindump, agent-rules, agents2, scout, planner, life.
>    Also: a lakh is 100,000 (was a million), units are whole words ("3,500 km", «1.500 kenara» were ×1000/×1e6), "200 thousand" / "15,000
>    thanks" / «thứ Sáu» are not ordinals, "9000 am Freitag" is money. Generator tests/numbers/gen.mjs: 95.63 % → 100 %, held-out 100 %.
> 3. **Persona re-run** — `tests/e2e_v1080personas.py` (phone + computer, en + ar; screenshots in tests/docs/personas/). Fixed: "pro" /
>    «برو» / "upgrade" / a page's name alone opens it (cmdrun + Chat's pageOf); «Cash» → «كاش»; an Arabic example in an empty box now
>    follows the page's direction (one CSS rule for 895 boxes); repeating reminders (see REVIEW_P6 re-run) with tests/reminders/repeat.mjs
>    72.86 % → 100 % (71.7 % shapes), held-out 89.85 % → 100 %. tests/lib/hard.mjs: "(1/2)" only for SMS, never typed text (said so).
> **Next:** Ali's picks on the launch page (ST/SS/CR/LG/MAIL) → store listing + Send a report; still open: "every first Monday of the month",
> "every month" with no day.
>
> ## START HERE (21 Nov 2026, evening — v10.8: Ali's phone screenshots + problem report)
> 1. **"Any notification is to do even if it's not that important"** — Mr.Beard's WhatsApp advert «📷 تخيل بوكس فيه كل اللي ممكن تحتاجه …
>    عليه خصم ٥٠٪» became a late to-do. Two bugs: «ممكن تحتاجه» ("you might need it") read as «ممكن تـ…» = "could you" (autopilot.js
>    MUMKIN_ASK now skips تحتاج/تكون/تلاقي/تعجب/تستفيد…), and the chat reader had no "advert" kind — chats.js `isOffer` (scored: a percent
>    next to a discount word, promo code, "limited time" = 2; "order now", "free delivery", «عروض», 🔥🎁 = 1; ≥ 2; never when the message
>    asks YOU — "should I get it?", «أجيبلك؟», «ممكن تعدي تجيب») → noise "offer", kept quietly. Also "can  you" (two spaces) is still a
>    request. Generator `tests/chats/offers.mjs` (10,000 composed + hardened, 61.7 % shapes): 92.97 % → 100 %; held-out 100 % (62.2 %);
>    unit `tests/unit/v1080offers.test.mjs` (2,500). Hardener fix (said so): Arabic-Indic digits never replace a Franco letter inside a
>    Latin word ("eb3atly" stays). Chats 10,000 and Autopilot2 10,000 unchanged at 100 %, 0 actions on noise.
> 2. **The side menu showed see-through over Home** (his "Left sidebar" screenshot): v10.7's slide-in animated the menu's WRAPPER with
>    fill "both", leaving a transform → the fixed menu measured itself against a 0-px-tall box (no background). build/tw.css now slides the
>    menu panel itself (fill backwards). `tests/e2e_v1080side.py` (phone, Arabic RTL, fold cover): 7 checks failed before, all pass now.
> 3. **"Attune closed by itself · signal 11 · model Blaze"** (no stack — a crash inside the GPU driver while the fast engine works).
>    FastEngine marks every answer (who: screen / background notification reader / night job / keyboard; GPU or CPU) and clears it; at
>    the next start a left-over mark + Android's "unexpected" (ExitWatch.unexpectedAt) → a line in the problem report; on the GPU twice in
>    7 days → the CPU with a note (20 languages). The report's battery part now says the level and "nothing ran" instead of being empty;
>    MindBg writes its runs to the battery log. `tests/unit/v1080crashmark.test.mjs`. **Ali: send the next report after it happens again —
>    it will now say what Blaze was doing.**
> 4. **Desktop build (Windows · Vulkan) failed its smoke test since v10.7** — not the app: v10.7 moved the computer layout's line from
>    1024 px to 640 px (WIDE_Q in side-ui.jsx, for the unfolded foldable) but `desktop/test/smoke-run.js` still expected the phone layout
>    under 1024, and the Windows CI screen is 1008 px wide (it HAS the sidebar now, correctly). The check now uses 640 px; checked on the
>    built page at 1008 px (sidebar, no bar) and 390 px (☰, no sidebar).
>
> ## (21 Nov 2026, later — v10.8 travel guides DONE in all 20 languages, Ali: "Continue the other 14 languages")
> **The Know tab's deeper sections (1,125 lines that were missing) are now in the other 14 languages too: pt it de ru id ur fa bn sw th vi zh
> ja ko** — so every line a travel guide shows is in all 20 languages. Every number kept (checked line by line; "2pm" may read 14:00).
> `tests/unit/v1080travel.test.mjs` now checks DEEP for all 20. Checked in the app at 320/390/1366 px in ja ur de th ru sw ko (no sideways
> scroll, no English deeper line left). Also fixed: the language audit (`tests/unit/v907i18naudit.test.mjs`) had been failing since the
> first travel batch (65 flags) — "Café con leche" now has a native gloss in the 11 non-Latin-script languages; names that rightly stay as
> written (Deliveroo / Just Eat, nasi lemak…) and words spelled the same in French/German/Indonesian are listed in `tools/i18n/audit.mjs`
> (IGNORE / SAME) → "no problems". `tests/setup.sh` now builds the test llama-server without its web UI (`-DLLAMA_BUILD_HTML=OFF
> -DLLAMA_USE_PREBUILT_UI=OFF`; the tests run it with --no-ui and the prebuilt UI download failed in a fresh cloud session).
> **Next:** Ali's phone test of a guide in a few languages; then the launch plan's remaining items (LAUNCH_PLAN_2026-12.md).
>
> ## (21 Nov 2026 — v10.8 travel guides, Ali: "translate the travel guides" → "do them now" → "do the main languages first")
> **Travel guides — what is translated (all on main):** (1) the guide lines every tab shows (apps, arrival, overcharges, emergency, money,
> power, water, visa, best time, tipping, haggling, SIM, connection) + the 92 phrase meanings — **all 20 languages**; (2) the Know tab's
> 15 section titles ("Money here", "Getting around"…) — all 20; (3) the Know tab's DEEPER sections (money, etiquette, health, costs,
> getAround, eat, laws, dangers, holidays, customs, numbers — 1,140 lines) — **the 6 main languages done: ar, arb, es, fr, tr, hi**;
> **next: the other 14** (pt it de ru id ur fa bn sw th vi zh ja ko), same way: scratchpad deep_miss.json (1,140 lines, order fixed),
> 6 parts of 190 → dp/<lang>_0..5.json → deepmerge.py <lang> (checks counts + every number; a "2pm" may be 14 on the 24-hour clock),
> then add the language to DEEP in tests/unit/v1080travel.test.mjs. Also: the "Write my tips in" picker says «Same as the app» instead of
> a misleading "English" (built-in lines read in the app's language); the guide list takes the app's direction (an Arabic line that starts
> "M-Pesa …" stays right-to-left); "Everything else about KENYA" → the country's own name. Checked at 320/390/1366 px in 7 languages.
>
> ## (20 Nov 2026, later — v10.8: launch items 1–6, Ali: "Do first 6" + "I won't be able to reach any testers for the other languages")
> **Waiting for Ali's picks** (MOCKUPS rule): https://claude.ai/artifact/4nddgVxWY9MqAw3VSpLHjZ (docs/mockups/launch-store.html) — store page
> ST1–ST3, screenshots SS1–SS2, crash reports CR1/CR3, languages on the first install LG1/LG2, the support e-mail MAIL (rec. ST1 SS1 CR3 LG1).
> Then build: the store listing (STORE_LISTING.md, AR + EN, 6 screenshots) and the crash log + Send a report (BatteryGuard's log goes in it).
> **Speed (L4)** with a phone filled like his (3,000 kept notifications, 900 payments, 250 reminders), CPU ×4: Recall 8.6 s → 0.5–0.9 s
> (lookback.js noteMeaning cached per day + warmRecall in idle pieces 6 s after start); Autopilot works out its cards in idle pieces
> (autopilot.js suggestionsSoon; deliveredDone reads only since the oldest open follow-up); Home's AutopilotCard and "Attune noticed" wait
> for the first screen (motion.js useAfterFirstPaint). The box is drawn at 1.7–2.2 s; the longest freeze after opening 3.1 → 1.0–1.2 s.
> (Measure with the page's own clock — a MutationObserver — Playwright's wait_for_selector can't check during a long task: it showed 7 s.)
> **Size (L5):** Python already leaves the Play build (19 MB, pypack). New: build/i18n-split.mjs ships only the lines the code can show
> (22 → 17 MB; unit v1080size: every tr("…") line kept in every language); the Play build reads barcodes / text through Play services
> (playImplementation + manifest DEPENDENCIES barcode,ocr) — full/lite/auto keep them inside for phones without Google (Huawei).
> **Battery (L6):** BatteryGuard.kt — the wake word stops on Battery saver or ≤ 15 % not charging (listens again by itself); agents'
> and Scout's rounds wait while low; an on-phone log of every background job (NativeBridge.batteryLog / batteryNow) — for the report page.
> **Arabic screens (L3):** every page + Settings read: «أتيون» → Attune (74 Egyptian + 46 Fusha lines; the wake word keeps «يا أتيون»),
> «الزق» → «الصق», «تفكير» → «تذكيرات», a garbled Projects line, «أسبوعك», device levels without Studio, dates in the app's language on 21
> screens (toLocaleDateString(dateLocale())), "Start" (buttons) vs "Start date" (CV), "Plan" (Pro) vs "Planned" (month plan), Schedule,
> Details, School. e2e_v1080arabic: no English left on any page in Arabic (phone + computer). **Open: the travel guides (COUNTRY_PACKS,
> 43 countries, ~214 KB) are English only — ask Ali before translating (a content job).**
> **Other languages without testers (L7):** checked by meaning: month plan "Left" = money left (it was the DIRECTION in all 20, «شمال»
> too), "Start" a verb, Japanese "Clear" was «他のアプリから保存», "Details", German "Didn't come"; "tell me when my wife gets home" said
> the app's Home page («Inicio») — places have their own words now. unit v1080meaning. Next: the rest of the 270 two-meaning words.

> ## START HERE (20 Nov 2026 — v10.7: Ali OK'd OK-AN ("also make to-do lists editable easily"), OK-WR ("For" = which AI — ChatGPT,
> Gemini…; NOT which model writes on the phone: Attune picks the best way itself), OK-FO — BUILT)
> **Motion** (web-src/motion.js): tickOut(el, then, {leave}) — the tick box pops, 6 sparks, the row ([data-tickrow]) slides away and
> the rest close the gap, THEN the save runs (fallback 1 s; "remove animations" on the phone = no motion, saved at once). Used by Home's
> To do + lists (lists-ui Box anim="leave"/"stay"), Follow-ups Done (timeline-ui), payments ✓/✕ (paylog-ui), medicine doses (care-ui).
> pageIn(el, dir, wide): a page slides in from the right going forward, from the left going back (RTL flipped), cards one by one
> (attune.jsx navDir + pageRef). tw.css: buttons press in, sheets slide up.
> **To-dos editable easily:** tap a to-do's WORDS (Home + Lists) → its edit (Save / Delete); the ✎ stays too.
> **Writing page** (writing-ui.jsx WritingStudio — every old tool, a better look): tabs Improve · Shorten (slider % + the chat so far) ·
> Humanize (tones + your sample) · Copilot (paste the AI's answer → your next prompt) · Recipes; "For" chips = which AI the prompt is
> for (ChatGPT, Gemini, Claude… + More…); every run keeps a version (v2, v3… last 20, attune:writing:v1) with Copy · Keep going ·
> → other tools · delete; two columns on a wide screen. No engine picker — the app chooses.
> **Foldable open = computer layout** (side-ui.jsx): ≥ 640 px wide = the computer's layout; 640–899 px a 72 px side RAIL (SideRail:
> menu, new, search, places, projects) that expands over the page; pages are containers (.att-cq) so two-column parts (.att-2col)
> stack until the PAGE has 820 px. e2e_v1060layout.py now also fails a line cut short with "…" that hides > 40 % (Ali: "nothing is
> cut") and found 2 (Projects skills line, the week's all-day pill) — fixed. Tests: unit v1070motion, e2e_v1070.py.
> e2e_v1030weekcal "the trip is one bar" failed only on Fridays (Egypt's week starts Saturday; the trip started tomorrow) — test fixed.

> ## START HERE (18–19 Nov 2026 — v10.6: Ali's list "not optimized everywhere / where is my wife / edit to-dos / animations / foldables / Writing / smarter / smooth")
> **Layout everywhere** (his Tools screenshot squeezed letter by letter, Money "1,127,735.2 EG / P"): the root cause was shell.html
> `body{overflow-wrap:anywhere}` (lets every flex / grid item shrink to one letter) → `break-word`. Tools grids auto-fill ≥ 230 px,
> Money's balance never wraps (smaller when long), Medicines' 3 buttons fit, the computer's list + details (split-ui.jsx) details pane is a
> CSS container: "two columns on a big screen" stack until the PANE has 680 px (tw.css .att-pane) — Travel was squeezed at 1024 px.
> Toast words were invisible in Glass (text = --c-bg = transparent) → --g-solid. **tests/e2e_v1060layout.py** checks 31 pages × 11 widths
> (280, 320, 344 fold cover, 360, 412, 600, 673 fold open, 768, 884, 1024, 1366) for past-the-edge, words broken mid-word, sideways
> scroll and invisible text: 0 problems.
> **Money 💡** worked but its tip was drawn BEHIND Money's own header → the 💡 is in Money's header and the tip under it (MoneyTab
> tipBulb / tipSlot); a 💡 tapped within 1.2 s of opening a page was undone by the page's own tip timer (CoachHost askedRef) — fixed.
> **"where is my wife (right now)"** from Home's box → "I don't know where the wife is" (the where-things-are reader): cmdrun.js now asks
> api.whereIs first (cmd.api.whereIs added), commands.js ctx.person → whereAsk only; noteteach.whereIs: role words, the asking sentence
> only, "is X home / did X get home / has X left work / track X / «مكان X»", never "X's house / where did X put"; role not taught → the
> location app's people + "tell me once". tests/whereperson (10,000 HARD 100 %, 65 % shapes; held-out 100 %), unit v1060where.
> **Edit to-dos**: Home's To do card ✎ → change the words (Mind record / reminder re-synced to the phone) or delete (lists-ui RowEdit).
> **Smarter**: a group's title is never "Who is this?" (noteteach.personOf: group → the writer; NOT_NAME words); a chat named "Orders" /
> «الطلبات» / «طلباتي» = orders (chatroles.readDescription) — «الطلبات» was a shopping list; parcels one line per order, "Delivered ✓",
> one clean sentence (daynotes.parcelLine). unit v1060smart.
> **Smooth** (measured with a phone filled like his — 3,000 kept notifications, 900 payments, 250 reminders — at a mid-phone's speed,
> scratch perf.py / prof.py with ATTUNE_NOMIN=1 builds for readable profiles): opening 17 s → ~3.5 s, Home again 4 s → 0.3–1 s,
> Follow-ups 1.1 → 0.4 s. Causes: homeCurrency parsed the whole ledger per notification (cached by the raw string); 20 places fetched
> the kept notifications each on its own (notecache.js recallRaw, 3 s); lifeask.loadStores read EVERY store per save (lazy getters);
> Autopilot read every notification twice per Home render (autopilot.js suggestCached) and saved each auto item alone
> (__attuneApplyActions batches: stores once, writes once, rids per action); "Attune noticed" recomputed on every Home (insightsCached).
> **Waiting for Ali's picks** (MOCKUPS rule): https://claude.ai/artifact/Cj1UCB4s6GnQYvqwCba9eY (docs/mockups/motion-writing-fold.html):
> AN1–AN3 motion (live demos; rec. AN1), WR1–WR3 the Writing page with every old tool (rec. WR1), FO1–FO3 an unfolded foldable (rec. FO1).
> **Ali picked AN2, WR2 + WR3 (+ "choose the model or AI"), FO1** → combined https://claude.ai/artifact/FzSAVxTqNgwcueg12pZhaf — waiting for his OK.

> ## START HERE (18 Nov 2026, later — v10.5: Ali OK'd the widgets — OK-A1 OK-W1 OK-W2 OK-W3 OK-W5 OK-W6 OK-W7 OK-S — BUILT)
> Pages: options https://claude.ai/artifact/D2n3P5cw4CQZmCMFspYPbq · combined https://claude.ai/artifact/NgiS5jCMUUxewxkSV5RbSg.
> **How it works:** the page decides what every widget shows (web-src/widgets2.js — pure: listsData, dayCard, moneyCard, agentsCard,
> medCard, papersCard, tripCard, nextCard, stackData; widgets-ui.jsx widgetsData → NativeBridge.setWidgets). The phone only draws
> (app/…/AttuneWidgets.kt, object W5: one card layout w5_card + rows/buttons added per widget; the list = ListView via W5ListService;
> the stack = StackView via W5StackService, its taps through the see-through W5Tap activity). A tap changes the widget at once and is
> kept as {w,a,id,at} (W5.record); the page applies each ONCE (widgets2.js applyActs + widgets-ui.jsx applyWidgetActs: reminders done /
> +1h, bills paid, list tick / untick / clear, medicine taken / +30m, agent paused, date reminder, the bank SMS Add ✓ / ✕ through
> paylog addPaidNow) — at once when Attune runs (W5.ping → "attune-widget-acts"), else on the next open; seen keys in
> attune:widget:acts-seen. "Open ↗" = ACTION_VIEW of the agent's checked listing; a line opens its page.
> **The small box** (OK-W3, A1 "+ Add", W2 "I spent / I got"): QuickBoxActivity (own task affinity, see-through) loads
> index.html?quick=say|voice|list|spend|got&list=<id>; build/entry.jsx then renders ONLY quickbox-ui.jsx (the app isn't started):
> doit.js understandAll → apply with Undo per part, lists addItem (widgets2.itemsOf: commas / and / «و», drops "thanks 🙏"),
> money (spendOf: «٢٠٠ كشري»); a question or a Mind note → "Open Chat" (NativeBridge.quickOpen → MainActivity with the words).
> 🎤 = Android's speech box (RecognizerIntent) → window.__quickHeard.
> **Widgets:** TodoWidget = Your day, ListWidget = the list (same class names: placed widgets update), MoneyWidget, BoxWidget (now the
> small box), AgentsWidget, MedWidget, PapersWidget, TripWidget, NextWidget, StackWidget. **Look (OK-S):** each follows the app's Look
> (Plain → S1 colours w5_s1_* + night, Glass → S2); long-press → the widget's settings → W5LookActivity (this one widget only).
> Picker names: res/values*/strings_w5.xml (20 languages). Page words: 56 new lines in all 20 i18n files.
> **Tests:** tests/widgets/gen.mjs (10,000 composed HARD: 100 %, 99.2 % different shapes — it found 2 real reader gaps, fixed:
> "thanks 🙏 / ok / شكرا" glued to a typed item, and ties in Your day's order), heldout.mjs 100 %, tests/unit/v1050widgets.test.mjs,
> tests/e2e_v1050widgets.py (phone + computer). Kotlin compiled here (Android SDK in /opt/android-sdk: `ANDROID_HOME=/opt/android-sdk
> /opt/gradle/bin/gradle :app:compileFullDebugKotlin`). **Not seen on a real phone yet — Ali's phone test is the check of the drawing.**

> ## START HERE (18 Nov 2026 — v10.4: Ali's phone list "widgets / backup opens the wrong page / fix the SMS notification for good")
> **(2) "Turn on backup" opened the old prompt-compressor page** (his screenshot): setup.js step 8 opens "backup", which is a PANEL, not a
> page — navTo("backup") fell through every page to the last one in the chain (the compressor). Now attune.jsx PANEL_IDS (backup,
> profile, plan): navTo + "attune-open" ("backup" or "panel:backup") open the panel. tests/unit/v1040fixes.test.mjs scans EVERY
> `attune-open` / `navTo("…")` / `open: "…"` in web-src and fails if one names a page that doesn't exist (found only this one).
> **(3) SMS "for good"** ("I can't press allow or tick, it does not do anything"): after access was on, the bank row said "Allowed ✓ —
> waiting for the first message" with NO button for ever — whatever the real reason. Now web-src/bankcheck.js reads everything and says
> WHICH it is, with the button that fixes it (setup-ui.jsx BankCheckBox under the row, and Chat's card): waiting (bank SMS read, waiting
> for an OK — Free saves nothing alone → "Add them to Money" ticks the step) · asleep (Android paused the reader / quiet 6 h → "Fix it
> now" = NativeBridge.payRescan: reads the shade again, else heal) · smsoff → "Turn SMS on" · hidden (the Messages app hides the words:
> "1 new message" → where to switch it on) · notpay · notbank · nosms · off → Allow. The tick box itself is a button now (every row).
> Phone side (PayListener.kt): onNotificationPosted → handle(sbn, fresh); on every (re)connect rescan() reads the notifications still
> in the shade through the money path (a bank SMS that came while Android had us disconnected is no longer lost); `live` instance;
> SmsDiag = the last 20 SMS-app notifications' trace (time, app, sender, words hidden?, money?, code? — never the words); bridge smsDiag().
> **THE root cause of "the bank step never ticks" (found by e2e_v1040fixes):** Home's Autopilot (autopilot.js suggestFrom) read CIB's
> "Your debit card … was charged EGP 350.00 at CARREFOUR" as a SHOP RECEIPT (notifmeaning gives state "" for "charged", notelabels says
> paid/sure → the receipt branch) and added it by itself with source "receipt" → Money kept it with NO source and NO message → stepState
> (a txn with source "notification") never counted it. Now a bank / wallet message (u.kind bank or moneySourceNote) never takes the
> receipt branch; it goes the bank way (Money's own reader when the code is sure, else an Autopilot expense with source "notification",
> sure as before, and its complete message as evidence). 10,000 notification run: 100 %, 0 interruptions; HARD 99.9 % (9,988 vs 9,987), 2.
> The 10,000 HARD run (tests/bankcheck/gen.mjs, 84 % different shapes) found a real reader bug: a bank SMS in CAPITALS "RS.2500.00 DEBITED"
> was not read (paytext.js normalises RS/RP) → 100 %; held-out (heldout.mjs) 100 %. e2e: tests/e2e_v1040fixes.py (phone + computer).
> **Full run 18 Nov:** every unit test passes; 4 browser tests fail — e2e_v770chat, e2e_v830, e2e_v922agents, e2e_v922projects (time-outs
> on project-item / the hotel offer) — and they fail the SAME way on ba5c8c4 (before v10.4, checked in a worktree): older, not from this
> change. (tests/setup.sh: the llama.cpp UI download fails behind the proxy — build with
> -DLLAMA_USE_PREBUILT_UI=OFF -DLLAMA_BUILD_HTML=OFF and delete build-dl/tools/ui/dist.)
> **FIXED (18 Nov, later) — all 4 now pass.** They described behaviour Ali changed on purpose in v10.2 (his "OK-D1 OK-L1"):
> - **D1** (e2e_v922projects, e2e_v770chat): on a computer Projects is a list + details (`projects-split-row`), no `project-item` card.
>   Tests now read the split row on a computer. **One real app fix found:** the computer's list row had dropped the phone card's line —
>   a project with no tasks showed an empty line. spaces-ui.jsx projectLine(): the same words on both devices ("n chats · k files ·
>   updated d" or the due date · "n tasks left" · "n due"); no new strings (all already in the 20 languages).
> - **L1** (e2e_v922agents, e2e_v830): a tap on an offer opens ITS page in Attune first (OfferPage), "Open this listing" goes on; after
>   each round the best 3 are checked one by one (check mode). Tests now go card → offer page → Open this listing (same check: Hilton,
>   by name, with the dates) → Back. e2e_v830's fake phone now answers check mode like AgentBrowser.kt (one hotel page, never a list),
>   and the test checks more than before: 6 days in ONE search window AND then 3 checks; Hilton + Al Safwah kept as checked, Swissotel
>   (no page) not; Book on a checked offer opens its checked page with the dates straight away (no second check). The old v9.1 check
>   "Booking app via appsList/openAnyApp" was for APKs older than openInApp (every current build has it, so the page never takes that
>   path); replaced by v9.5's "the phone's own browser first", then "Android's app for the link" (still checked).
>   Full run after the fix: every unit test and 239 of 240 browser tests pass; e2e_v996mentions timed out once on note-promise-go in
>   the full run and passes alone (a timing flake in the cloud, like e2e_v5).
> **(1) Widgets** ("widgets for most things, smart, interactive — do things without opening the app"): MOCKUPS rule → options page
> https://claude.ai/artifact/D2n3P5cw4CQZmCMFspYPbq (docs/mockups/widgets.html): A1/A2 the list widget (his Talabat one: today 4 rows,
> no scroll, no untick), W1 Your day · W2 Money (+ the bank SMS Add ✓) · W3 Tell Attune box · W4 People & money · W5 Agents · W6 small
> one-thing widgets · W7 smart stack (changes by time / SMS / place), S1/S2 look. Recommended A1 W1 W2 W7 S1. **Ali picked A1 W1 W2 W3 W5 W6 W7 S1 S2** → combined page with "What I understood": https://claude.ai/artifact/NgiS5jCMUUxewxkSV5RbSg (docs/mockups/widgets-combined.html) — **waiting for his OK** (OK-A1 … OK-S). APK v10.4: https://github.com/alydibiky/attune-/actions/runs/44340989703 (success).
> Build notes for later: a scrolling list = RemoteViewsService + setRemoteAdapter + setPendingIntentTemplate (fill-in intents per row);
> typing = a small dialog-themed Activity over the home screen (widgets can't hold a text field); the stack = a widget with
> AdapterViewFlipper / StackView (API 31+ for swipe), pages chosen by code (time, reminders, a new SMS, PlaceGeo).

> ## START HERE (17 Nov 2026, later — v10.3: Ali picked K1 + OK-G1 OK-G2 OK-G3 — the glass look and the week calendar)
> Mock-ups: calendar styles https://claude.ai/artifact/Pfx2JXzwa7sD5KThoBHkmB (he picked **K1**), combined
> https://claude.ai/artifact/3CUkeHy43iX4zzt9xBdwLQ (v2 with K1; **OK-G1 OK-G2 OK-G3**). Built:
> **Glass look** (spaces.js LOOKS / glassVars / glassCss, ThemePicker "Look: Plain · Glass", tw.css html.att-glass): dark glass
> (burgundy-to-black ground, frosted cards) and light glass (the phone's colours) — light/dark follows the device or the chosen ground.
> The computer wears glass by default (defaultLook: desktop app or ≥ 1024 px) with real blur (att-glass-blur); the phone keeps Plain
> and can pick Glass — no live blur there. Sheets over a dim backdrop keep solid colours; sticky bars get a readable glass bar.
> **K1 week calendar** in the middle of the computer's Home (weekcal.js logic + weekcal-ui.jsx WeekCalendar / UnderWeek; desk-ui.jsx):
> things at their hour with a now line, an all-day lane (bills, deliveries, renewals, projects, money with no time, the trip as one bar),
> "+N more" when the lane is full, same-time things side by side, Day · Week · Month, ‹ Today ›, a tap → details on the right + Open.
> Filled only from the Follow-ups timeline + Money's payments made + project dates + the trip. Under it: safe to spend, agents, latest.
> The old "Today" card on the computer's Home is gone (its reminders are on the calendar). Tests: tests/unit/v1030weekcal.test.mjs,
> tests/weekcal/gen.mjs (10,000 composed HARD weeks — first run 99.62%: a double space broke «عيد  ميلاد» → kindOf folds spaces/alef;
> now 100%, 94% different shapes; held-out 100%), tests/e2e_v1030weekcal.py (computer dark + light glass, phone Plain → Glass).
> Next: Ali's look at both devices; D1 remaining pages.

> ## START HERE (17 Nov 2026 — v10.2: Ali's computer + phone list of 17 Nov: "I want everything fixed for good, a last time")
> Fixed (objective, with tests): **(1) "36 tools" → 3**: Home's card counted every tool, the Tools page showed only the 3 families.
> Now hubs.js shownToolGroups()/toolCount() = the tools this build really lists (not archived / hidden / not in this build, each once);
> ToolsHub gets `groups={groupsShown}` and desk-ui.jsx ToolsPage shows "Every tool" by group under the families; Home says the same
> number (23 here). **(2) Claude's sign-in link email saved in Dates "like a subscription"**: notifwords.js isSignInMessage() (sign-in
> links, login codes, verify your email, password resets, "this link expires in 1 hour", 20 languages; a real renewal that adds "sign in
> to manage" stays a deadline) → deadlines.js readDeadlines returns nothing, overpay.js readSource skips it, notifmind.js reads it as a
> login code (no date, nothing to do); loadRadar → dropSignIns() removes such an entry already saved (his). tests/signin/ (10,000: 100%,
> held-out 100%). **(3) glitchy while the model loads**: attune.jsx re-drew the WHOLE app every second only to move "Loading 66s" —
> now it re-draws when model/phase change; the seconds tick inside LoadSecs; the side menu says "Loading…". **(4) 66 s load on the
> computer**: desktop/lib/engine.js remembers the way that started each model (engine-good.json: variant, graphics chip or CPU, helper)
> and tries it first; real phases from llama-server's log (phaseOf); "=== ready in N s" in engine.log; on Windows the engine loads at
> below-normal priority, back to normal when ready. **If Ali still sees a long load, ask for his engine.log** (Engine → log): it now says
> which way started and how many seconds. **(5) Tips**: the theme's colours (was a fixed brown card with pink words), on a computer a
> 360 px card in the page's bottom corner (was across the whole window and the side menu).
> **Waiting for Ali's picks** (MOCKUPS.md rule): https://claude.ai/artifact/JCGhHo77srRGUjp4Q2f9WL (docs/mockups/desktop-agents-tips.html)
> — D1–D4 how the computer uses the screen ("like the mobile app put on a computer"; Recommended D1 list + details), L1–L4 how an agent
> shows the listing it found ("fix the opening and filling the details … even if displaying it another way"; Recommended L1 the offer's
> own page inside Attune, from what the agent read), T1–T3 where tips appear (Recommended T1 a line in the page).
> Tests: tests/unit/v1020fixes.test.mjs, tests/e2e_v1020fixes.py, desktop/test/unit.js (orderAttempts, phaseOf).
> **Autopilot "Change" (Ali, 17 Nov 15:21: "It's a group I put on all orders I buy … pressed change and nothing happened" → "I don't want
> a 1 time fix, I want a fix for good"):** chatroles.js: a new kind "orders" (a record of what you bought: kept to ask about, NEVER put on
> a list — before, the Arabic «الطلبات اللي بشتريها» was read as a shopping list) and "other" (his own words kept); the lasting part:
> nextStep() — after Change ALWAYS code → the phone's AI (descPrompt / readDescModel, written in v9.9.40 but never wired; now
> window.__attuneDescAi from attune.jsx) → the kinds to tap (chatpilot-ui.jsx PICKS); whatever he picks or the AI reads for words code
> didn't know is LEARNED (learnDescription / attune:chatroles:learned:v1) — the same words, written a little differently, are understood
> by code next time. tests/chatroles/never.mjs (10,000: never stuck + taught words understood again — 100 %), gen.mjs 100 %, held-out 99.93 %.
> **Smooth (Ali: "I want it really smooth and reliable")**, measured at mid-phone speed (CPU ×4, scratch scripts: perf = open + page switches +
> typing, CDP profile): opening the app 3.7 s → 2.5 s (the 1.4 s block left is the phone compiling the 5.9 MB script — NEXT: load rare
> pages only when opened: convert, slides, cv, pdfchat, guide + guide-demo, fit-cuisines/foods, shelf, knowledge, money-sheets ≈ 18 %),
> Money's first open 0.35 → 0.2 s (attune.jsx yusrDocumentHtml decodes once, warmed in the background), typing in Home's box no freeze
> (home-ui.jsx: "Organise this" checked after a 0.3 s pause). The Egyptian Arabic dictionary is www/i18n/ar.js (build/bundle.mjs swaps
> web-src/i18n-ar.js for build/i18n-ar-shim.js in the bundle; shell.html loads it for Arabic; in English it loads after the first screen
> for the Arabic app names in the Home box). Flaky in the cloud only: e2e_v5 (the tiny test engine times out late in a full run; passes alone).
> **Ali picked D1, L1 ("but it should still redirect me to the right listing"), T1 T2 T3** → combined page with "What I understood":
> https://claude.ai/artifact/CkbzEJEpupPdYdBKbjtxdn (docs/mockups/desktop-agents-tips-combined.html) → **Ali: "OK-D1 OK-L1 OK-T"** (asked if D1 is
> what professional computer apps look like — yes: Mail, Outlook, Notion, Slack, Linear, Todoist, Things; Apple split view / Microsoft list-details).
> **Built:** **L1** web-src/listing.js verifyListing() (is the landed page THIS offer: a listing, every model word on both sides, not an accessory,
> price within 5 % — hotels: the name, dates + guests kept in the address); agent-kit.js product() reads a store's page (ld+json / og / h1,
> price, canonical, rating, seller, delivery, `many` = still a results page); AgentBrowser.kt check mode (`resolve`: goTo → read → close in
> ≤ 22 s, never the search fallback); agents-ui.jsx: a tap on ANY offer opens OfferPage (on top, so the conversation underneath keeps its
> place), after each round the best 3 are checked one by one (verifyOffers), "Open this listing" opens the checked address in the phone's
> browser; can't confirm → Attune's browser taps through itself (never a search page); can't READ the page but the link is a listing by its
> shape → opened as before. tests/listing/verify.mjs 10,000 + verify-heldout.mjs (100 %, 0 wrong pages accepted; the held-out first showed
> 97.4 % — model codes with a region suffix "HD9650/91" — fixed in norm()), tests/unit/v1020listing.test.mjs, tests/e2e_v1020listing.py.
> **T1+T2+T3** setup-ui.jsx CoachHost inline (phone: a line in the page under the title; Home: under Good morning via PhoneHome tipSlot) /
> corner card (computer); TipBulb 💡 (in the title bar on the phone; Money: at the end of its tab row — HubTabs `end`; Home + computer:
> top-right of the page) shows the page's tips again. **D1** web-src/split-ui.jsx SplitView (first item open, ↑ ↓, search) — built for
> **Travel** (countries | the country's page), **Family health → Medicines** (medicines | the picked one; adding opens in the right pane),
> **Projects** (projects | the open project). tests/e2e_v1020split.py. **D1 still to do (same SplitView, next session):** Lab results, Family,
> People, Agents (agents | the agent's conversation + offers), Follow-ups, Money's payments, Documents, My things.
>
> ## START HERE (16 Nov 2026, night — v10.1: Ali's picks P1 P2 P3 P4 W2 T1 + F1 F3 built — combined page OK'd)
> Page: docs/mockups/projects-combined.html (https://claude.ai/artifact/LSwKU9ZuNeFL2d1b1L4Ziw). Built:
> **T1** My things → Follow-ups "Things I own" (timeline-ui.jsx section; things-ui.jsx MyThings): each price linked to its payment in Money
> (things.js paymentFor — 10,000 + held-out, tests/thingpay); a new receipt not in Money is added (Undo on the card). (The OK'd mock-up
> showed a "Things" chip, but Follow-ups no longer has a chips row — it is a section on the page; tell Ali if he wants a chip row back.)
> **P1–P4** web-src/projlinks.js (10,000 + held-out, tests/projlinks): P1 a project's dates (your messages, notes, open tasks, due) on
> Follow-ups as "Project · name" → opens THAT project (spaces.js openProject / OPEN_PROJECT_KEY — navTo("projects") clears the sticky);
> P2 budget + money words, spent from Money; P3 people both ways (person page "In projects"); P4 "Add to a project" on the shared-text
> banner (Mind). **W2** on the phone a project is light (no ask box / Files / Saved / Repeats / Answers as; "Files and questions about
> them: on your computer"); a computer keeps everything. **F1** side menu search finds features (web-src/features.js FEATURES = every
> feature + where it lives; a unit test fails when a page has no line). **F3** "where is …" in the Home box / Chat → the place + Open, or
> 2–3 to tap when unsure (tests/features: 100% · held-out 100% · the second held-out — never tuned on — 87%).
> Fixed on the way: deadlines.js datesIn missed "24/05/2027." (a date before a full stop) everywhere.
> Tests: tests/unit/v1010.test.mjs, tests/e2e_v1010.py.
>
> ## START HERE (16 Nov 2026, evening — v10.0.3: Ali's second phone list of 16 Nov)
> 1 Agents: his "Huawei free clips 2" never matched the stores' "HUAWEI FreeClip 2" → every round recorded "no price" (so "12 quick
> checks couldn't read the prices") while Google showed 7,400. matchScore (agents.js) + AgentWatch.kt matches(): words written apart
> = one word in the name and the reverse ("free clips" = "FreeClip", "air pods" = "AirPods"), and "2 days" is not model number 2.
> 2 Setup → Bank messages: with notification access on and no bank message yet it said nothing → now "Allowed ✓ — waiting for the
> first message" (setup-ui.jsx bankAllowed). 3 Kept quietly: a tap on a chat shows its kept messages of today (chatpilot-ui.jsx).
> 4 Settings sheet scrolled sideways on a phone: the nine colour dots (spaces-ui.jsx ThemePicker) wrap now + overflow-x-hidden.
> 5 Dates → scan of a bank card: bankcard.js (10,000 + held-out) — expiry from VALID THRU, ONLY the last 4 digits kept.
> Tests: tests/unit/v1003fixes.test.mjs, tests/e2e_v1003fixes.py, tests/bankcard/. **Asked Ali:** what was wrong in his Documents
> screenshot (it came without a note). Sync phone ↔ computer: Wi-Fi sync works now; Google Drive needs SETUP_CLOUD.md §A (his part).
>
> ## START HERE (16 Nov 2026, later — v10.0.2: "agents still does not open to the specific listing so fix it for good")
> Causes found in the code (NOT seen on a real store — store sites are blocked from cloud sessions): (1) agent-rules.js isOwnPage
> called ANY non-search link a listing (brand shop, seller, category, Jumia /catalog/, B.TECH /catalogsearch/) and opened it as the
> product; (2) ad links (Amazon /sspa/click, Google /url?q=, /aclk) were opened as they are; (3) agent-kit.js hrefOf took the FIRST
> link of a card (often the brand / "sponsored" / seller) and did not know Jumia / B.TECH / 2B / Raya / Dubizzle product pages.
> Now: cleanListing() unwraps hops, cuts Amazon to /dp/ASIN, drops tracking; listingKind() = yes / no / maybe by the link's SHAPE
> (LISTING_RE, the same in agent-kit.js — a unit test keeps them equal); offerOpen(): yes → the phone's browser; else Attune's
> browser finds the offer by name on the results (goTo), with `gotoFallback` (AgentBrowser.kt, 12.5 s) so it never stays on the
> search page; the page it lands on is kept on the offer (keepListing) so the next tap is direct; "Order it" goes the same way.
> hrefOf weighs every link of the card (listing shape, carries the name, wraps the name / photo). Tests: tests/listing/gen.mjs
> (10,000 links, 100%) + heldout.mjs (100%), tests/unit/v1002listing.test.mjs, tests/e2e_v1002listing.py.
> **If Ali still sees a wrong page: ask WHICH store and which offer** (a screenshot of the card + where it landed) — that store's
> link shape goes into LISTING_RE / the generator.
>
> ## START HERE (16 Nov 2026 — v10.0.1: Ali's 8 phone screenshots on v10.0, all fixed with tests)
> 1 "What are the talabat" answered "11 messages kept" → the list's items (chatask.js: the described chat wins when the export's copy
> has the same name; list words are not a topic), and a chat not described yet shows its latest messages + "Show all N".
> 2 Two Autopilot cards with two "Done for you" → ONE card (autopilot-ui.jsx gives its money part to chatpilot-ui.jsx `old`); the old
> card's chat to-dos from before v10.0 are not listed again. 3 "Pin to the widget does not work" → NativeBridge.pinListWidget
> (Widgets.pin: Android's "Add to home screen" question; "has" / "asked" / "no"). 4 list items: pencil = reword, bin = delete
> (lists.js renameItem). 5 Follow-ups said "You pay" for what Baba pays → "Baba pays" (timeline-ui.jsx kindLabel). 6 People "Who is
> this?" shows the payment / note the name came from (people-ui.jsx namesToAsk `where`). 7 Agents: a price under a tenth of your limit
> is never the product (agents.js believable — "EGP 120" for earbuds under 8,000), old such checks are not shown, and the buy card says
> "Every 4 hours, even with Attune closed". 8 "the last time I went to get groceries" answered with a bus company's WhatsApp → only
> Money and your own notes count for "I went / bought / did" (links.js I_DID); «السوبر جت» is not the supermarket.
> Tests: tests/unit/v1001fixes.test.mjs, tests/e2e_v1001fixes.py. **Open / ask Ali:** (a) Noudy's "Fitness for" / "Fitness" became
> items — she was correcting "Toast" → "Fitness toast" in 3 messages; now he can reword / delete, but joining a correction to the
> message before it needs his pick (mock-ups first). (b) the ask card guessed «صادر ووارد الخزنة» (a money chat) as a shopping list —
> guessRole should see amounts / "وارد / صادر" as money, not items. (c) Agents: if the stores still show no prices on his phone after
> this build, the invisible browser's reading of Amazon / noon needs a look on a real phone (AgentWatch.kt day job).

> ## START HERE (14 Nov 2026 night — v9.9.39 on main; the NEW AUTOPILOT is being built on branch ccr-7db1d9fc-iyie83)
> Ali (14 Nov): "the whole autopilot idea is very stupid". Agreed SIX rules: 1 ignore by default · 2 not sure → don't act alone ·
> 3 every action shows the original message + why + Undo / Open chat / Never from this chat · 4 everything kept and understood by
> chat and topic ("when did Address East discuss the garage?") · 5 describe any chat in your own words → "What I understood" → OK ·
> 6 export a chat (WhatsApp/Telegram) for its whole history. Picks: CH-1 EX-1 SL-1 DN-1 NS-2 AS-2 + his wishes ("understand when I
> tell it I bought the shopping list"; "display the full message of everything") → combined page K1–K6 (K6 = the computer's bigger AI
> re-checks the phone's work) → **Ali's OK on K1–K6** (docs/mockups/autopilot-combined.html → https://claude.ai/artifact/AycGYSNBDP34oSUnukivrt).
> Context: Ali's WhatsApp group "Talabat" = him + his wife Noudy writing what ran out at home (his shopping list), NOT the delivery app.
> Also asked: sync FREE and automatic through Google on every device (plan.js "sync" is Pro-only now; SETUP_CLOUD.md §A Google Cloud
> steps still need Ali).
> Done (each with 10,000 cases + held-out, all 100%): **AP-1** web-src/waexport.js (WhatsApp export reader, EN/AR) ·
> **AP-2** web-src/chats.js (chat / writer / group / noise) + RecallLog v2 keeps who/convo/grp (Kotlin: check the branch APK build
> run 43643886809 compiled) · **AP-4 part 1** web-src/shoplist.js (items from a message; "I bought …" all / except / only).
> Also done (pure, each 10,000 + held-out 100%): **AP-3** web-src/chatroles.js (your words → role/topics/"mentions me"; guessRole;
> understood() lines; confirmedRole — a guess is never acted on) · **AP-5 decisions** web-src/autopilot2.js decide() → keep / ask /
> items / bought / alert / todo, each with from + why; 10,000 conversations, ACTIONS ON NOISE 0 · **AP-6** web-src/chatask.js askChat()
> (chat named before "discuss / اتكلموا عن", topic after; days, who, ids of every message) · shoplist.js rejects sentences as items.
> **v9.9.40 (on the branch, then main):** the screens are built — ChatPilotCard on Home (web-src/chatpilot-ui.jsx: K1 What I
> understood + Right / Not now / your words, K2 Shopping line + Done for you, K4 the full-message sheet with Undo / Open chat / Never,
> NS-2 Kept quietly + This mattered), K3 "I bought…" in the Home box (attune.jsx boughtFromLists, Undo), K5 Chat answers about any chat
> (attune.jsx askChatsNow + chat.jsx card + "Show all N messages"), exports from the WhatsApp groups library are read for questions,
> a one-to-one chat is one person (no question), the old Autopilot card no longer makes chat to-dos, sync is FREE and syncs by itself
> through Google (sync-ui.jsx autoDriveSync; plan.js). Tests: e2e_v9940chatpilot.py, e2e_v9940chatask.py + all the v9940 unit tests.
> **Still to do:** AS-2's "Decided:" line (the phone's AI reads the messages askChat used; shown above them) · K6 the computer's second
> look (needs the kept-quietly messages' texts in chatpilot state so the computer can re-read them; the bigger model re-judges keep /
> done decisions → "Computer checked: N fixed" with the message + Undo) · EX-1: when an export is added in the groups library, ask
> "What I understood" for that chat at once · Ali: the Google Cloud project (SETUP_CLOUD.md §A) for sync.

Read this page first, then `CLAUDE.md` (Ali's standing rules), `GEMINI_DESIGN_BRIEF.md` and `CHAT_RUNS_APP.md`.
Then carry on with **"Do this next"** below — no need to ask Ali anything before starting.

## Status in one look
| | |
|---|---|
| `main` | **v9.9.18** (11 Nov night: sentences 99.3%, 7 real bugs, OK1 on 10 pages, errands per country, research page waiting) — before: **v9.9.15** (11 Nov: Ali's 4 phone problems + the 10,000-sentence run and its fixes + How to use / Plans cleaned; review page waiting for his picks) — before: **v9.9.14** (who pays every renewing payment: me + which account / a person / contacts / nobody, reminders always) — before: **v9.9.13** (agent page AG1+AG2, night check AC2, one-tap AC3, plan first AH1, who pays a subscription, 84-notification corpus) — before: **v9.9.12** (Follow-ups understands offers / videos / receipts; agents say new best vs. your best) — before: **v9.8** (versionCode 138; 7 Nov: Ali's 15-point list — recurring payments as boxes, Enter = new line, Spent red, no Learn alarms, agents open the listing, notifications understood, one brain for chats, translate a document; options C/A/F/D/I waiting) — before: **v9.7** (versionCode 135; 6 Nov: C1 colours, agent fixes, Messages like Auto Text) — before: **v9.6** (versionCode 134; 5 Nov night: Ali's picks built — agents board + conversation + dates grid, month plan goals that fill themselves + calendar + table, follow-ups week strip) — before: **v9.5** (versionCode 133; 5 Nov night: Ali's 9-point phone list) — before: **v9.4** (versionCode 132; 5 Nov) — before: **v9.0** (versionCode 131; pushed 3 Nov after the full suite passed — the two timing flakes, e2e_v518 / e2e_v533, pass alone; they failed while a 9B model ran beside the suite) — before: **v8.9** (versionCode 130; branch `claude/affectionate-ptolemy-nmr0bh`, 1 Nov) — before: **v8.7** (versionCode 129) — before: **v8.6** (versionCode 128) |
| Last APK | (v9.8.4 FU1: see the newest run on main) — before: v9.8.2 (8 Nov: A5 agent cards + T1 tool colours; full suite green): https://github.com/alydibiky/attune-/actions/runs/42430241937 — before: v9.8.1 (8 Nov: Ali's 7 points on v9.8; full suite green, 323 files): https://github.com/alydibiky/attune-/actions/runs/42423801794 — before: v9.8 (7 Nov: Ali's 15 points + C6 A3 F1 D1 + I1 Autopilot + N1 Haggler + N3 Errands; full suite green, 322 files): https://github.com/alydibiky/attune-/actions/runs/42387019518 — before: v9.8 without N1/N3: https://github.com/alydibiky/attune-/actions/runs/42383415371 (success) — before: v9.7.2 (6 Nov: C1 calm look for every colour; full suite green): https://github.com/alydibiky/attune-/actions/runs/42198144053 (success) — before: v9.7.1 (6 Nov: the normal APK installs again — send-by-itself moved to the optional attune-apk-auto; full suite green): https://github.com/alydibiky/attune-/actions/runs/42161023633 (success) — before: v9.7 (6 Nov: Messages like Auto Text, colours C1, real hotel names; full suite green; Kotlin built): https://github.com/alydibiky/attune-/actions/runs/42136431819 (success) — before: v9.6 (5 Nov night: Ali's picks — agents board + conversation + dates grid, month plan goals + calendar + table, follow-ups week strip; full suite green): https://github.com/alydibiky/attune-/actions/runs/42114184938 (success) — before: v9.5 (5 Nov night: Ali's 9-point phone list; full suite green; Kotlin built): https://github.com/alydibiky/attune-/actions/runs/42094539771 (success) — before: v9.4 + the chat fixes (5 Nov: number guard, sentence battery, installments keep the total; full suite green): https://github.com/alydibiky/attune-/actions/runs/42069139037 (success) — before: v9.4 (5 Nov: agent picks G1–G7, hotel offers keep each hotel's page, Translate → Document; full suite green): https://github.com/alydibiky/attune-/actions/runs/42056893257 (success) — before: v9.3 (5 Nov: Ali's round-4 picks + notifications → Your day; widgets compiled; full suite green): https://github.com/alydibiky/attune-/actions/runs/42017700711 (success) — before: v9.2 part 3 (5 Nov: receipt back, agents consistent + open the exact offer, back like ChatGPT, How to use search fix, guide in 20 languages; full suite green): https://github.com/alydibiky/attune-/actions/runs/41941437190 (success) — before: v9.2 part 2 (4 Nov night: Ali's 7 picks built — lists, agents' rules + board, flight agent, Mind, Documents, Projects board; full suite green; CI now frees disk first): https://github.com/alydibiky/attune-/actions/runs/41889742662 (success) — before: v9.2 (4 Nov late: Ali's 11-point list — Zakāt complete, Writing tabs, no Food on Home, Shelf; full suite green): https://github.com/alydibiky/attune-/actions/runs/41849639532 (success) — before: v9.1 latest (4 Nov night: Projects design D + the archive round; full suite green): https://github.com/alydibiky/attune-/actions/runs/41820643229 (success) — before: v9.1 (4 Nov: option A "which did you mean?", 8 bug fixes, hotel option 4): https://github.com/alydibiky/attune-/actions/runs/41752948806 (success; full suite 226/226) — before: v9.1 hotel offers (3 Nov evening: option 4 A + C, hidden checking screen, photos): https://github.com/alydibiky/attune-/actions/runs/41693308525 (success) — before: v9.0 (3 Nov, notifications + accuracy round 2): https://github.com/alydibiky/attune-/actions/runs/41608171861 — before: v9.0: https://github.com/alydibiky/attune-/actions/runs/41585440030 — before: v8.9: https://github.com/alydibiky/attune-/actions/runs/41309881633 (success, sent to Ali) |
| Tests | v8.9: full suite passes (`bash tests/run_all.sh`); language crawl `tests/i18n_all.py` (all 20 languages: 1–6 English texts left each, all names/legal) |
| Gemini step | Areas 1–6 built · **Area 7 (Settings, sidebar, How to use, Privacy)**: Ali picked "I design it myself in Gemini's style" for the rest of the UI — How to use is done (v7.9); Settings / sidebar / Privacy still to design (show Ali 2–3 options first) |

## ▶ START HERE (14 Nov, later) — v9.9.38: the 1,000,000-case test (batch F) — tests/onemillion/REPORT.md
Ali asked for "a 1m test for everything … very very rigorous and hard". Plan: TEST_1M.md. Runner: `bash tests/onemillion/run.sh`
(hours), report: `node tests/onemillion/report.mjs` → REPORT.md; what it found and what was fixed: tests/onemillion/FIXED.md.
- A 300,000 typed sentences (A1 mega, A2 chat100k with SEED_SHIFT=1, A3 tests/onemillion/langs.mjs = 100,000 in 20 languages + Franco,
  plus a held-out set langs-heldout.mjs) · B every feature generator with a new seed (partB.mjs; SEED_SHIFT in every gen.mjs) ·
  C UI crawler partC.py + partC_probe.js (every screen × 21 languages × light/dark × phone/computer × 3 scroll positions × 16 checks;
  run C_LANGS=en first) · D partD.mjs 150,000 answers vs truth computed in the test · E partE.py 50,000 real-page journeys.
- New: web-src/worldlang.js (the six orders in all 20 languages → the sentences the readers know). The real model on what code leaves
  to it: tests/trials/langs-model.md (299/300).
- Biggest lesson: 9 test generators had broken random numbers (repeats) — every generator now uses Math.imul.
- Waiting for Ali: count goals ("read 20 books") need a "+1" button → options page with mock-ups first (MOCKUPS.md rule).

## ▶ START HERE (14 Nov) — v9.9.33 → v9.9.37: Ali's answers built (PRO_PLAN.md is the plan; batches 0, A–E done, F next)
Ali's answers on https://claude.ai/artifact/XF3TxLzpUYDzBmNPecpdTL: OK-1 ("don't remove undo — the app could still get something wrong"),
OK-2, OK-3, OK-4, BG-3, BR-4; plus: the +7 trial days only for REALLY completing setup; language as a dropdown; agents must check while
he's away with many more websites; and at the end a 1,000,000-case test of everything (batch F — NOT started; plan it in TEST_1M.md).
- **v9.9.33** Chat bubble keeps his exact words · old wrong agent finds dropped on load (his EGP 120 FreeClip screenshot) · language dropdown ·
  agents: AgentDayJob every ~4 h (battery not low) + the night job; every store read in the invisible browser (needsBrowser); Egypt
  10 places (Amazon, noon, Jumia, B.TECH, 2B, Raya, Dubizzle, Carrefour, Tradeline, Google Shopping), old agents get them all
  (recheckSaved); the conversation names the store. tests/agents33/gen.mjs 10,000.
- **v9.9.34** Free / Pro (FP-4): plan.js (Pro now, limits, Pro-only), plan-ui.jsx (Part of Pro card, openPlan event), bank messages saved
  by themselves only in Pro WITH Undo, Close the day / week plan / scheduled messages / sync / Money for two / exports Pro, 3-month Money
  history in Free, 3 a day photo / X-Ray / conversions / slides, 10 papers, 1 rule, 1 agent; Plan page two columns + FP-4 table; PM-1
  (5 typed payments → line), PM-2 (Friday card), PM-4 (trial-end card). tests/plan/gen.mjs 10,000 (found: the daily counter bug).
- **v9.9.35** Set up your life (GD-5 + GW-A + TR-3): setup.js (8 steps checked from real data), setup-ui.jsx (Home card, Settings page,
  interview in the real Chat, salary answer → repeating income), coach.js one-time tips; +7 days once for 6 of 8 really done during
  the trial (ends 14 days after start). tests/setup/gen.mjs 10,000. Older browser tests: attune:test:quiet keeps new Home cards off.
- **v9.9.36** BG-3: MindBg.kt + MindBgJob (charging, or > 40% with the screen off; 12 a round, 40 a day), mindbg.js (prompt handed over,
  answers merged on open), Recall settings switch. tests/bgmind/gen.mjs 10,000. Branch APK built green (run 43563527599) = the Kotlin compiles.
- **v9.9.37** BR-4 brain: lifefacts.js + brain-ui.jsx (What Attune knows, Home row, Sunday analysis, Chat "how am I doing?", facts in every
  AI question). tests/brain/gen.mjs 10,000 (a planted bug → 23%).
- Every addition in 20 languages (≈210 new lines). Full suite on v9.9.37 was running when this was written — if it is green, push main.

## ▶ START HERE (13 Nov, night) — v9.9.32 (versionCode 175): Ali's 3 asks — Free vs Pro, the "set up your life" guide, 100,000 + 100,000 tests
**1 + 2. Free / Pro and the guide — Ali picked FP-4 (only if Pro's automation is measured right, no undo / rechecking) PM-1 PM-2 PM-4 GD-5 GW-A TR-3, and added 2 ideas (the model reads notifications with the app closed, 30 s–1 min each is fine; a 24/7 brain that understands everything and already knows). Combined page + options for the 2 ideas, WAITING FOR HIS OK: https://claude.ai/artifact/XF3TxLzpUYDzBmNPecpdTL (docs/mockups/free-pro-combined.html). First options page:** https://claude.ai/artifact/ExrP7vKai43EJDLSFVimHs
(docs/mockups/free-pro.html). FP-1…4 the split (my pick FP-4: Free = everything you type or say, one phone, 3 months, 1 agent, 1 rule;
Pro = Attune does it for you + everywhere; full feature table on the page) · PM-1…4 how Pro is shown (my pick PM-1: "Pro would have done
this for you" right after the 5th payment typed by hand, max 1 a day) · GD-1…5 the guide (my pick GD-5: Chat interview day 1 + Home
setup list + one-time pop-up tips + Settings → "Set up your life" always there) · GW-A…C who gets it (A: trial + Pro all, Free first 3
steps) · TR-1…3 trial (TR-3: 7 days + 7 more when setup is done). After his picks: combined mock-up → OK → build in all 20 languages
(billing.js already has FREE_LIMITS / COMPARE_ROWS / trialuse.js to build on).
**3. 100,000 + 100,000 scenarios (DONE):**
- `tests/scenarios/mega.mjs` — 100,000 different hard sentences (hard.mjs groups ×10, typed the way people type: "hey attune,", «يا أتيون»,
  thanks, emoji, "ok?", CAPS, double spaces). First run: **84.0%** → now **99.5%** (report tests/scenarios/mega-report.md).
- `tests/scenarios/chat100k.mjs` — 100,000 different chat orders in hard ways (indirect "ping me / can you make sure I…", «خليك فاكرلي»,
  changing your mind "at 5, no wait, 6", negations "don't remind me…", long stories full of numbers, two orders, pages by any name,
  AI questions full of numbers, slang money questions, odd debts, odd agents, 7 more languages, Franco). First run: **67.3%** → **99.4%**
  (tests/scenarios/chat100k-report.md); 3.6% are left to the model by design.
- Real model (Qwen3.5-4B Q4_K_M, llama-server, 4 CPU cores, 2.7 s each) on 250 of the orders the code leaves to it: **97.6%**, and the 6
  misses never reach the model in the app (tests/trials/chat100k-qwen3.5-4b.md; script tests/trials/chat100k-model.mjs).
- What was fixed: `web-src/wrapclean.js` (new, used by chat.jsx, the Home box doFromHome and the test mirror): cleanTyped (wake word,
  fillers, thanks, emoji, "ok?", final full stop, ALL CAPS → names kept) · rephrase (indirect reminders EN + AR, odd debts, Arabic
  agents, money slang) · correct (a change of mind keeps the 2nd number) · negatedOrder (nothing set or saved) · otherLang (spending +
  reminders in es/pt/it/tr/id, fr "j'ai dépensé"). Reader bugs fixed: "wake me at 5pm" was 5:00 am (actions.js) · "my cousin for the
  barber" person "For" (life.js) · "I want a Kindle … watch it for me" was a Watch iT subscription (life.js) and the agent watched "I want a
  Kindle but only if it's" (agents.js) · "text Sara on telegram" made a reminder (chat.jsx openIt) · "take me to my money page" opened Maps
  (applinks.js pageOf + brain order) · invoice / table / order numbers and "at 10 pm" saved as money (doit.js, sense.js) · «فكرني … ودفعت
  420» kept only the reminder (sense.js splitOrders) · «بعد اجتماع 5 ساعات … اشتريت ب290» became a reminder (understand.js signals).
- Unit test tests/unit/v9932hundredk.test.mjs (2,500 of each run ≥ 98.5% + 40 cleaner cases).
- **Still open (need Ali / a feature):** goals with a count ("read 20 books before December 2027" → needs a "count" mission kind + its
  screen = mock-ups first) · "X always comes first" when X is not in contacts · "what are my subscriptions?" (no ask:subs answer yet) ·
  «لازم ادفع للشغالة» (a to-do or a reminder? goes to the AI). Note: Chat now shows the cleaned sentence in the user bubble (as Franco
  already did) — ask Ali if he wants his exact words kept.

## ▶ 12 Nov, night (branch, not main yet) — Egyptian national ID (egid.js: the 14-digit number → birth date, governorate, sex, exact;
10,000 at 100%) + its card on Dates. **Honest limit found:** the phone's text reader (ML Kit) is LATIN ONLY — it reads passports' coded
lines, English papers and Latin digits, NOT Arabic letters or Arabic-Indic digits. Measured here on rendered Egyptian-ID images:
Tesseract ara 0/40 on the number line, PaddleOCR arabic_PP-OCRv3 (ONNX, Apache-2.0, 2.4 + 9 MB) reads Arabic words but drops digits
(its dictionary has no ٠). So Arabic papers on a real phone reach these readers only through the on-device vision model's transcription
(readTextAny) or typing. Next step for exact Arabic: train a small Arabic-digit reader on rendered fonts (needs Ali's OK — adds a model).
Also: tests/docs/gen.mjs Arabic cases assume the text was read; they test the parsing, not the camera.

## ▶ 12 Nov, late — `main` = **v9.9.22** (versionCode 165): photos from the gallery on every photo button (photopick.js), passport / ID
scan on Dates (mrz.js, 10,000 at 100%, ICAO specimens), papers from a photo (warranty / subscription / trial / licence / car licence /
insurance / visa — tests/docs/gen.mjs 77.3% → 100%; deadlines.js fixOcrDigits), B5 N3 "a year ago today" + P1 Keep in touch + P3
Occasions (b5people.js 10,000 each). Full suite: one timing flake (e2e_v996mentions, passes alone 2/2). Next: Egyptian national ID
front (14-digit number decode), business card → People, B5 P2 + N1, then B6 / B7.

## ▶ 12 Nov, evening — v9.9.21 (branch ccr-60240af2-j35hvr; main after the full suite): Ali OK'd the combined Agents page (OK-1…OK-4)
and it is BUILT: one clear list (no Cards/List/Board), all offers inside an agent each opening its own page, "What I watch" with every
setting changeable (web-src/agentedit.js — 10,000-edit generator tests/agentedit/gen.mjs at 100%, planted bugs caught), one sheet per
setting → checks again. Also: no EGP 120 FreeClip (agents.js believable), hotel dates in words. Old views only for old tests
(attune:agents:legacy, set by tests/harness.py). Ali: "and do the other features" → T1 brain dump BUILT (braindump.js 99.06% on 10,000
paragraphs in 20 languages + Franco; "Organise this" screen) → next B5 people (AUTOMATION_PLAN.md), then B6–B9.

## ▶ 12 Nov, later — `main` = **v9.9.20** (versionCode 163): Ali's Scout screenshots fixed (tests/unit/v9919scout.test.mjs): the night
note is one per hunt, id scout-<hunt> (it opened the Tucson for a Huawei watch hunt), in his language, no "51 new ads" count; ads priced
in another country's money are out (SAR on syarah.com in an Egypt hunt made "62k cheapest"); a price written with its currency in the
ad's title wins (1,490,000, not 1,571,667); "new" = the open hunt's own. Plus How to use guides / demos / life areas for the 4 new tools.
**Waiting for Ali:** (1) Agents & Scout — he chose "keep them, change the interface / how I use it": options page
https://claude.ai/artifact/E6UkVGJiwkMwVt846WEUii (round 2: AV-1…AV-7 one clear Agents page, AV-6 Claude Duet style, AV-7 ChatGPT Scheduled style — no Cards/List/Board switch — + SC-1…SC-3) → he described it instead: every agent editable, all offers written well, each opens its exact page → combined screen
https://claude.ai/artifact/DQyJJ7Pm2U8FujwNYz4eS3 (OK-1…OK-4, source docs/mockups/agents-combined.html) → his OK → build. (2) Place reminders in the first release (Play background-location declaration) or after.
Still open from his screenshot: every match shows 100/100 when a hunt has few wishes — show options (mock-ups) before changing it.
T1 brain dump: only research started (weekday names per language via Intl checked); nothing built yet.

## ▶ START HERE (12 Nov, morning) — `main` = **v9.9.19** (versionCode 162) = B0–B4 screens of AUTOMATION_PLAN.md.
The 11 Nov night session ran out of its weekly limit before pushing its B4 screens; this session rebuilt them (T2 habits, T3 countdowns,
T4 place in a reminder, T5 week plan, T6 focus timer) + "open habits / countdowns / week plan / focus" from Tools and Chat + How to use
guides + singular lines ("1 payment"). Full suite green (200 browser tests, all units; audit errors = sandbox network only); the branch
APK (Kotlin NagPay.kt) built green: https://github.com/alydibiky/attune-/actions/runs/43152931155.
**Push after every feature** so a limit never loses work again. **Next:** T1 brain dump (readers in 18 more languages first — see
AUTOMATION_PLAN.md B4 notes), then B5 people, B6 papers, B7 travel, B8 AU4, B9 N2. Phone parts still open: AU1 triggers, T4 geofence
(ask Ali: Play background-location declaration), T6 optional Do Not Disturb.

## ▶ (before) START HERE (11 Nov, night) — **AUTOMATION_PLAN.md** is the plan: Ali picked his screens for all 29 features ("ALL features working in
ALL languages and ALL countries … batch by batch, update the handoff so another AI can continue"). Combined screens waiting for his OK:
https://claude.ai/artifact/HeHrRSrz3BNcDa9vwZhGNU. Carry on with the first unticked batch in AUTOMATION_PLAN.md.
**State at the end of the 11 Nov night session:** B0–B3 LOGIC done on the branch (not yet on main — main is v9.9.18 without it):
nag.js, notifpay.js, donelog.js, NagPay.kt, rules.js, suggest.js, recipes.js, moneyunits.js, salarysort.js, catlearn.js, groups.js,
the country-weekend fix, and their 10,000-case tests (tests/nag, notifpay, donelog, rules (+ heldout), suggest, recipes, salarysort,
groups, catlearn; units v9918b1 / b2 / b3 / rules). Before merging to main: the branch APK build must be green (NagPay.kt has never
been compiled — no kotlinc here) and the full suite run. Then B4 (design notes in the plan).

## ▶ NEXT (11 Nov, late night) — Ali picked 29 of the 38 research ideas; their SCREENS are waiting for his A/B picks
- His picks: AU1–AU8 · M1 M3 M5 · T1–T6 · N1 · N2 ("it can go very wrong — only if you are sure it will be very accurate") · N3 ·
  P1–P3 · TR1 TR2 ("good if done right") · TR3 · X1 X2 · X3 ("must take a photo and read it very well") · X4 · X6 ("excellent if it
  understands everything") · X5 LATER (after launch). Not picked: M2 M4 PR1 PR2.
- **Screens page (2 phone screens per feature, Recommended marked): https://claude.ai/artifact/NSsHTv8B6NSzN9eCS1Got8** — wait for his
  A/B picks + notes → ONE combined mock-up with "what I understood" → his OK → build.
- **His new rules (in CLAUDE.md):** no idea without its look; every feature gets its own 10,000-case generator (details checked) +
  a held-out set + a unit test on a 2,500 sample. N2 ships only if it reaches 99% offline — otherwise tell him and don't ship.
- Build order I suggest once he OKs: AU5 AU7 AU8 (small, make the rest safe) → AU1 + AU2 + AU3 (the engine) → M1 M5 M3 → T1 T3 T2
  T6 T4 T5 → P1 P3 P2 → X1 X4 X2 X3 X6 → TR1 TR2 TR3 → AU4 → N1 N3 → N2 last.

## ▶ v9.9.18 (11 Nov, night) — Ali: "lets do first 3 things now" (the sentences still read wrong · small visible things · countries) + "deeply think and research … automation … the best of each app"
**Where things are:** `main` = branch `claude/blissful-curie-d5gddb` = **v9.9.18** (versionCode 161). **Full suite green** (e2e_v68 updated for OK1, e2e_v993timetable now makes its own picture — both pass; the audit's only errors are the sandbox's blocked network). APK: https://github.com/alydibiky/attune-/actions/runs/43107733272 (was building when written — check it ended green).
**Waiting for Ali:** his picks on the research page **https://claude.ai/artifact/VAmamnCKNj3gqxVNsadFo3** (38 options, my ★ picks: AU1 AU2 AU4 AU5 AU6
M1 M3 T1 P1 TR1 X1 X4). Build NOTHING from it before his picks; each pick then gets phone mock-ups (MOCKUPS.md) before building.
- **1. Sentences (hard run 95.4% → 99.3%; everyday run 97.8% → 99.6%; notifications still 100%, held-out 60/60).** Fixed in the app's own
  readers, each in tests/unit/v9918fixes.test.mjs (49 checks) + browser test tests/e2e_v9918chat.py:
  - **Real bugs found on the way:** «دفعت 950 الفطار» was **950,000** (the «الف» of «الفطار» read as "thousand" — logtext.js, life.js,
    numguard.js); «دفعت 12 الف» was offered as **12** (sense.js moneyNumbers); "Maria" was read as **March** (actions.js month names —
    reminders jumped to March 2027); "wake me in 2 hours" became **2 am**; «الغدا» (lunch) was «غدا» (tomorrow) → a bill due tomorrow
    (life.js, actions.js); "the maid comes at 9" was **9 spent** (doit.js `amountIsMoney`: an hour after at/«الساعة»); "hotel … from 3 to 7
    March" checked in on the 7th with no check-out (agent.js `tripDates` ranges); «قسط 1500 كل شهر على 12 شهر» was 125 a month.
  - Franco money and time words (understand.js CMD: geneh, kan b, kalefny, rakna, dawa, kaman, de2e2a, enharda, "bel leil", "forn!").
  - Number words after a pay verb («صرفت مية», "cost me ten"); short spending lines (haircut, diapers, charger, sushi, «تورتة», «البيطري»);
    "the laundry 720 + tolls 650" = two spendings, "250 squared" = a sum; "today: lunch 480; the vet 150".
  - People: "uncle Samir", "Dr Hany", «صاحب البيت», «عمو سمير»; insurance / «تأمين» every year; «بدفع 99 كل شهر للجيم» and anghami = plans;
    an edit ("change the netflix to 480") never makes a new plan; "cancel my reminder…" shows "To cancel a reminder, open Follow-ups…"
    (new line, 20 languages).
  - Agents: «تابعلي سعر X» = a price watch; «عايز فندق في جدة من 3 ل 7 مارس» = a hotel task (not 3 received); "where is my noon order" = track.
  - Lists / to-dos / where / open: "shopping list: …", "we're out of …", «خلص السكر والزيت», "show my shopping list" (found no name before —
    lists.js SHOW groups), "todo: / new task: / don't forget:" always a to-do, "where did I put…", «النضارة فين؟», "the glasses is at my mum's
    house" (was taught as my mother!), "open Settings / Documents / Follow-ups / People & plans" (applinks.js + attune-open "settings").
  - Two orders in English ("spent 85 on parking, also remind me in an hour and a half…") both done — checked in the real Chat.
  - **Still wrong (0.7%, tests/scenarios/hard-report.md):** "X always comes first" (the "first" rule is stored but nothing sorts by it yet —
    check before promising it), "read N books before…" (a count goal needs a new Missions kind → mock-up first; it's T2 on the research page),
    "text X on telegram" (no Telegram action), "what are my subscriptions?", «… وبعدين 480 على …».
  - `node tests/scenarios/probe.mjs "sentence" …` shows what Chat does with any sentence (for the next misses).
- **2. Small visible things:** "1 items" → "1 item" (4 lines, 20 languages); dates in words in Family health lab results (+ the chart's
  months), the payments list (paylog), People & plans box titles, the car log; **OK1 done for 10 more pages** (Privacy, How to use, Slides,
  File Converter, Ask a PDF, CV, Mind, Family health, Translate, Travel when no country shows) — Shelf and Planner keep their headings
  (the book's name / the month, not a repeat).
- **3. Countries:** errands open the person's OWN country's portal for that kind (countrypack.js `portalFor`, errands.js `urlFor` /
  `openUrlOf`): Saudi fines → Absher, UAE fines → Dubai Police, passport → ICP, bill → DEWA, UK car papers → DVLA, India → Parivahan…;
  never a tax office for a fine; a bill with no known portal opens a search, never Digital Egypt; Egypt's papers lists show only in Egypt.
  tests/unit/v9918countries.test.mjs. **Not done (needs Ali's G picks / mock-ups):** the "For your country" card, errands' papers per country.
- **Setup in a fresh cloud session:** `bash web-src/build.sh` installs esbuild; `bash tests/setup.sh` (≈15 min) builds llama-server for the
  browser tests; `pip install playwright` if Python can't find it.

## ▶ v9.9.17 (11 Nov, evening) — Ali: "exactly 10000 hard scenarios … 10000 notifications in every area … people do the less work"
- **10,000 notifications** (`bash tests/notifs/run.sh` → tests/notifs/report.md; gen.mjs = 27 areas, brain.mjs = what Attune does with
  each): 84.2% → **100%**; not-a-payment reaching Money **855 → 0**. Honest number: `tests/notifs/heldout.mjs` (60 written AFTER the
  fixes) was **91.7% on the first try**, 60/60 after fixing by class — keep adding real misses THERE, never tune a rule to one sentence.
  Cause: each reader had its own list. Now ONE list `web-src/notifwords.js` (`notAPayment`: code · failed · notyet · offer · price ·
  post · scam · person) used by paylog.js, autopilot.js (cards skipped every check before), notelabels.js, notifmeaning.js. Also:
  bill-due card from any app, to-dos need a request ("see you tomorrow" made one), «تم خصم» is not a discount, a chat is a message,
  paytext.js («تم رد مبلغ» in, "Incoming transfer" in, "was used for", "BHD 2,983.250"), MONEY_SRC word edges ("purchase" matched "chase").
- **10,000 hard sentences** (`bash tests/scenarios/run.sh hard` → hard-report.md; details checked: amount, direction, hour, person):
  70.5% → **95.5%**. New `web-src/sense.js`: numWords, notSpent ("I didn't pay the 300 yet" was RECORDED), typedPayment (Chat's reader:
  "Ahmed paid me back 500" was money OUT), splitOrders (two orders both done), easeTime, easeDebt, easeCalc, tidy; applinks.js pageOf
  ("open Money"), commands.js to-dos ("I need to…", "new task:"), chat.jsx (number words, two orders, call/open before reminders).
  **Still wrong (4.5%, see hard-report.md):** Franco "x b N geneh", «قسط … على 12 شهر» divides, "car insurance N every year", "X always
  comes first", "open Settings / Documents / Follow-ups" (no page id), «تابعلي سعر», «X عليه كام؟», "read N books before…".
  The mirror (tests/scenarios/brain.mjs) is a strong hint, not proof — the two-orders and open-page paths in chat.jsx have NO browser test yet.
- **"Notifications stopped working from 3pm" (Ali's phone):** not reproduced here (no phone log). PayListener.kt heal: 1 quiet hour
  (was 3), re-toggle hourly (was 6 h) — runs on app open. Ask Ali for Engine → Details log if it happens again; likely the phone's battery saver.
- Tests: tests/unit/v9917runs.test.mjs (both runs on 2,500 samples + held-out).

## ▶ v9.9.16 (11 Nov, later the same day) — Ali: "do all now … every country fully … your code should deal with any notification"
His answer on the combined mock-up: **OK1, OK3, K1, B1, Q1, M1**; OK2 NOT ticked ("leaving them in groups is better visually");
U6 ("why not exchange rates visible; that doesn't mean it won't be downloaded?"); G2 not ticked ("I want ALL countries fully made if
you can do it accurately — research").
- **World bank messages** (`tests/corpus/world-bank-messages.mjs`: 70 payments + 10 look-alikes from all 30 countries, in their
  languages; `tests/unit/v9916world.test.mjs`): the reader got 45 of 80 right before, 80 of 80 now. yusr/paytext.js: incoming /
  outgoing wordings (حوالة واردة, شراء عبر…, paid you, DR / CR, Turkish without accents, Indonesian, French, Italian, Portuguese,
  Dutch, German), a card / account tail or a limit or a date is never the amount, the number that touches a currency wins, "NGN15,000"
  / "Rs.1,200" glued forms, "85,500 TND", Arabic short currencies (ر.س د.ب د.أ). paylog.js: the person's own currency decides "$",
  "Rs", «دينار» (payOpts), a bank that names no currency speaks the home one, balance-only filter widened.
  **Honest limit:** these are the well-known shapes of such messages, not copies from each bank — banks don't publish their templates
  (searched). Every real message Ali or a tester sends that is read wrong goes into the corpus.
- **Country packs** `web-src/countrypack.js` — for each of the 30 countries: banks, wallets, payment systems (→ `WORLD_MONEY_SRC`, used
  by paylog `fromMoneySource`), shops with search links (→ agent.js `storeTries` when a country has no hand-tuned list), delivery and
  ride apps, official portals, the local name of a savings circle. **Not yet used on screen**: delivery / ride / gov / circle (a
  "For your country" card needs mock-ups first — G1 / G6 were not ticked), errands per country (errands.js is Egypt's).
- **OK3 built**: payer-ui.jsx `PaidStep` (which balance — skipped with one account; which category — the guess picked; Another amount;
  Add to Money) opened by "Paid" in Follow-ups for a `planned` payment; regular.js takes `c.cat` / `c.account`. tests/e2e_v9916paylater.py.
  Q1 (ask at 9:00) = the plan's own reminder time — check on the phone that the notification comes at 9.
- **OK1 built for the pages with the shared heading** (ui-kit `pageH1` + `.att-h1` hidden on phones; BAR_TITLES in attune.jsx):
  Follow-ups, People & plans, Deadline Radar, Money Guardian, Family, Writing, Agents, To-dos & lists, Documents, Tables, Errands,
  Timetable. **Still to convert (each has its own hand-made heading; today the bar is empty and the heading shows):** privacy, planner
  (its heading is the month's name), guide, slides, convert, pdfchat, cv, shelf, memory, care, translate, travel.
- U6: Travel shows no "5 KB"; "Exchange rates: Not yet" until first fetched (packs are built in — nothing to download).
- Sidebar: groups kept (his word); only the "Work" row removed (it opened Projects, which has its own row).
- **M1** (Free = by hand, Pro = by itself): he said yes — **show the Free / Pro mock-up before changing billing** (not made yet).
- Version 9.9.16 (versionCode 159). **Full suite (11 Nov): green** except e2e_v993timetable (the old scratch-folder picture, as before); e2e_v734sidebar updated for the removed "Work" row. Pushed to main — the APK is the newest "Build the APK" run on main.

## ▶ START HERE (handoff written 11 Nov 2026, end of the v9.9.15 session)
**Where things are:** `main` = branch `claude/awesome-hopper-pxkuzb` = **v9.9.15** (versionCode 158). Full suite green twice except
`e2e_v993timetable` (reads a picture from an old session's scratch folder — fix the test's path when convenient).
APK: https://github.com/alydibiky/attune-/actions/runs/42994765308 — it was still building when this was written: **check it ended
green first**; if red, read the job log, fix, push, give Ali the new link.

**Do this next, in this order:**
1. **Wait for Ali's OK on the combined mock-up** https://claude.ai/artifact/8SwygRB1JbYRAgnfgiRpG6 — codes OK1 (top bar), OK2 (flat
   sidebar), OK3 (pay-later flow) + K1/K2 (category guess or not), B1, Q1/Q2 (hour), U6 (Travel sizes), M1 (Free = by hand, Pro = by
   itself), G1–G6 (countries). Build only what he ticks. For M1 a Free / Pro mock-up comes BEFORE any change to billing.
   - OK3 is half there: life.js already saves "I will pay Ahmed 4500 next week" / "pay the electricity bill 320 on Friday" as a one-time
     `bill` due that day (`planned`), and Follow-ups asks "Did you pay?". To build: the balance question for these (payer-ui.jsx
     `PayerPicker`, as for renewing payments), the NEW category question, "Another amount", then Money (paylog.js `appendToLedger`).
2. **Ali's phone test of v9.9.15** — fix whatever he reports, each with a test.
3. **Countries ("every country like Egypt", Ali 11 Nov)** — after his G picks: a country-pack card + "teach Attune my bank's
   messages"; Saudi + UAE first (banks, shops, delivery apps, errands, jam'iya, Gulf Arabic). Real bank messages are needed from
   testers — never guess a bank's format.
4. **Known small things, not done:** Franco "dawa b 2000 geneh" goes to the AI · "1 items" · raw dates still in Family health lab
   results and the payments list · the remaining 3.6% in `tests/scenarios/report.md` (mostly cases where asking is right).
5. **After launch (his picks, each needs its own mock-ups first):** R1 stability reports, R4 Gulf bank messages, R5 widgets, R7 "Ya
   Attune" (VOICE_PLAN.md), R8 Gmail after Google's verification, I1 year in review, I2 receipt → warranty, I3 bank-statement import,
   I5 Ramadan plan (Ramadan 2027 ≈ 8 Feb), I6 cancel helper, M4 affiliate links. Play name he picked: **N2 "Attune: Planner, Money & AI"**
   (put it in STORE_LISTING.md when the listing is next edited).

**Only Ali can do:** the Google Cloud Android OAuth client (package + the APK's SHA-1) and Google's verification for Gmail; the Play
closed test (12 testers, 14 days); the Play products; set `TESTING_ALL_PRO = false` before release; 2–3 testers per country.

**Tools made this session:** `bash tests/scenarios/run.sh` (the 10,000 sentences; report.md), `python3 tools/i18n/add_lines.py
lines.json` (a new line into all 20 dictionaries), tests/unit/v9915fixes + v9915scenarios. Review page (all findings, marketing, money,
roadmap): https://claude.ai/artifact/2hQ9Mu5SNsL2hyec86ZbjC.

## 11 Nov — v9.9.15: Ali's four phone problems + "test 10000 scenarios" + the launch review (his picks are waiting)
**Review page (tick + note on every option, Copy my picks): https://claude.ai/artifact/2hQ9Mu5SNsL2hyec86ZbjC** — U1–U7 (top bar, dates, sidebar,
neutral examples, Travel, placeholders), C1–C3 (what "buy milk", "pay the electricity bill 320 on Friday", "I will pay Ahmed 4500 next
week" should do), M1–M4 (what Pro holds, Gulf launch, affiliate), N1–N5 (the Play name — recommended "Attune: Life Planner & AI"),
R1–R9 (three months after launch), I1–I7 (new ideas). **Build nothing from it before he sends his picks.**
- **Follow-ups crash** ("Cannot read properties of null (reading '1')" under What Attune learned): a People card whose role is not in
  noteteach.js `ROLES` (any typed word) → `understood()` read `roleOf()[1]` of null. Any role shows now; `LearnedList` rows can't
  take the screen down (notelabels-ui.jsx `line` try/catch); an unknown label meaning shows as its word.
- **"Attune closed unexpectedly … (signal 9)"**: users see nothing for a system kill; only a real break while on screen (ExitWatch.kt
  `fg` + reason 3/4/5/6) → "Sorry — Attune closed by itself last time. Your data is safe." Tester mode (7 taps on the version) shows the old detail.
- **Gmail `UNREGISTERED_ON_API_CONSOLE`**: only the Google Cloud console (docs/GMAIL_SIGNIN.md: Android OAuth client = package + the
  APK's SHA-1). gmail-ui.jsx `friendly()` says it plainly; the Play build hides Connect Gmail until `GMAIL_VERIFIED` (buildflags.js) is true.
- **Plans & billing / How to use**: billing.js lists without Studio / Fit / Business, comparison Free vs Pro; guide.js without the keyboard
  chapter, today's sidebar + Home chapters; guide-areas.js titles (Family health · Documents & memory · Tools · Projects); vault chip
  "Cycle" hidden. Removed lines kept in `archive/plans-guide-v9914/` (translations stay).
- **The 10,000-sentence run**: `bash tests/scenarios/run.sh` (gen.mjs = the sentences + what each must do; brain.mjs = a mirror of
  Chat's / Home's decision order from the app's own readers; report.md). 87.9% → 96.4%. Fixed, each in tests/unit/v9915fixes.test.mjs:
  "2k / 2 thousand / ٣ الاف" (paytext.js), a date or a count is not an amount (paytext.js, logtext.js `amountsIn`), «استلفت 700 من كريم»
  / «ماما استلفت مني» / «صاحبي علي استلف مني» (life.js), "reminder to…", "set a reminder …: x", «نبهني كمان / الاثنين الجاي» + clean titles
  (actions.js), "x times y", "250 - 7" (calc.js), a number that is a time / count / code / page / model is never money and a request or
  a search is not a payment (doit.js `amountIsMoney`, `NOT_A_LOG`, `FUTURE_PAY`, `GENERAL_Q`), "320 dinner" / «7500 غدا» are money
  (doit.js `understand`), "add milk to my shopping list" (lists.js op "add"), "show my to-dos" (commands.js), "exam on 12 January" /
  «هيخلص» (deadlines.js), choice questions and «اشتريت» are not agents, "watch the price of X" asks for the price (agents.js), and
  **Chat makes agents like Home** (chat.jsx `agentK` + attune.jsx `agentKind`; «اشتريلي … بأقل من …» showed "Payment found: +45000").
  tests/unit/v9915scenarios.test.mjs keeps 2,500 sentences above 94%.
- **Ali's picks on the review page (11 Nov):** U1 U2 U3 U5 U7 · C1 C2 C3 (+ "on the day ask if I paid; if yes → Money after asking which
  balance and which category") · M1 M4 · **N2 "Attune: Planner, Money & AI"** · R1 R4 R5 R7 R8 · I1 I2 I3 I5 I6 · and "the app must be
  global — each country gets its dedicated things like Egypt". He asked what U6 and M1 mean and whether Play = everywhere (M3).
  - **Built (no look change):** U2 dates in words (life-ui `longDay`, doit.js `dayWords`), U5 neutral Tables examples (books, not cranes),
    U7 shorter hints, C1 "buy milk" / «اشتري لبن» = a to-do (commands.js `BARE_BUY`; agents.js `bareBuy`; webtask.js), C2 "pay the
    electricity bill 320 on Friday" and C3 "I will pay Ahmed 4500 next week" = a one-time payment due that day (life.js: kind "bill",
    count 1, `planned`; chatLifeIntent lets a bill due on a LATER day through; Follow-ups already asks "Did you pay?").
  - **Waiting for his OK — combined mock-up https://claude.ai/artifact/8SwygRB1JbYRAgnfgiRpG6**: OK1 top bar (☰/‹ + name, no second
    heading), OK2 flat sidebar without "Work" and group headings, OK3 pay-later flow (Did you pay? → which balance → which category →
    Money; K1/K2 category guess, B1, Q1/Q2 the hour), U6 Travel sizes, M1 Free = by hand / Pro = by itself (a Free/Pro mock-up comes
    before any change), G1–G6 the country plan (country-pack card + "teach Attune my bank's messages", Saudi + UAE first, testers).
    **Build none of these before his OK.**
  - Not started (after launch, his picks): R1 R4 R5 R7 R8, I1 I2 I3 I5 I6, M4 — each needs its own mock-ups first.
- **Full suite (twice, 11 Nov):** everything passes except e2e_v993timetable (it reads a picture from an older session's scratch folder —
  the same failure as before this work). **APK v9.9.15:** https://github.com/alydibiky/attune-/actions/runs/42994765308 (started 11 Nov;
  check that it ended green).
- **Not done (known)**: Franco "dawa b 2000 geneh" goes to the AI; "1 items"; dates shown as 2026-12-01 in People & plans; the open
  UI points on the review page. `tools/i18n/add_lines.py lines.json` adds new lines to all 20 dictionaries at once.

## 10 Nov — v9.9.14: "Who pays it?" done properly (Ali: "I don't want a small fix … choose which balance to take from if it's taking
   from me; if someone else is paying, make me choose who — someone Attune knows, from contacts, or nothing … it should remind me
   whether I am paying or not")
- For EVERY renewing payment (life.js `RENEWS` = subscription, bill, rent, regular; `hasPayer`): `payer` = "me" | a name | "none",
  `payerRef` {id of the People card, phone of the contact}, `account` / `accountName` (the Money account "me" pays from).
- `PayerPicker` (payer-ui.jsx): Me → "From which balance?" (each Money account with its balance — money-report accountBalance; one
  account → no question) · Someone else → People cards (family first, then everyone, then people in plans and earlier payers —
  `peopleChoices`) · Pick from contacts (contactPick) · type a name · Nobody — just remind me.
  `PayerAsk` (Follow-ups + People & plans: one Attune added by itself, once; "Me" takes this payment from that account) and
  `PayerRow` on each item ("You pay · from CIB" / "Baba pays" / "Nobody set — reminder only" · Change).
- Money: someone else / nobody → never out of Money (regular.js; life-ui tick says "your balance stays the same" instead of opening
  Money); me → the chosen account (paylog.js appendToLedger `t.account`; Autopilot's next receipts too).
- Reminders whoever pays (`nextReminder`: me "Due: … from CIB" / someone "Renews today … Baba pays it" / nobody "… nobody's balance
  changes"); `lifeReminders` keeps every renewing payment's next reminder when Attune opens (Autopilot-ticked ones used to lose it).
  Follow-ups asks "{w} renews today — did Baba pay it?" when someone else pays.
- Tests: unit v9914payer; e2e_v9913agents (Me → CIB, a known person, contacts offered, Nobody, reminders).
- Full suite green except e2e_v993timetable (fails the same way on 8ad3e1b, before this session — not caused by this work).
  **APK v9.9.14:** https://github.com/alydibiky/attune-/actions/runs/42714296451 (success — the Kotlin night job / one-tap ask compiled).

## 10 Nov — v9.9.13: Ali's OK on the combined page (OK1 + OK2 "make sure it understands 99 percent of notifications" + "Right")
- **AG1** (agents-ui.jsx `AgentOverview` in `AgentChat`, price watches): "Your best so far" (agents.js `bestSoFar`, follows the rules),
  "↓ {x} since {t}" (`bestChange`: the best vs. the checks before the newest round), Book this, See {n} more; the conversation, the
  dates grid and the old card behind "History ›".
- **AG2** `OffersChart`: every start date × every hotel (`chartPoints` = best3 + byDay, rules applied, once each), the limit line, the
  best dot big; a tap shows that hotel + Book this; the next two cheapest under it. takeChecks now also refreshes `byDay` from a
  hidden read's offers (so the night's hotels join the chart).
- **AC2** `AgentNightJob` (AgentWatch.kt, JobScheduler: charging + Wi-Fi + idle, about once a day, up to 10 min): every page that
  needs a browser (Booking…) is read with HeadlessRead (the alarm's round reads at most 2, in about a minute). The page sends each
  agent's `best` (watchPlan); a notification only when a price beats it (`AgentWatch.isNews`), with "(↓ x)".
- **AC3** `askIfStale`: a browser-only agent with no read for 30 h (the night job didn't run) → one notification "Time to check
  {site} prices — tap and I'll do it" (≤ 1 per 20 h per agent); the tap (EXTRA_AGENT_CHECK → page `open` + `check`) opens that agent
  and runs Check now. Words in the person's language (`agentWatchWords`).
- **AH1** `planLines` + `PlanCard`: a new price watch first shows "Here's what I'll do:" (4 lines) — Start / Change something; the
  same lines stay on its page as "My plan". (Tests that make agents press Start: `agent-plan-start`.)
- **Subscriptions "Who pays it?"** (payer-ui.jsx `PayerAsk` in People & plans + Follow-ups; life.js `setPayer` / `payerUnknown`):
  a subscription Autopilot adds by itself takes nothing from Money until answered (autopilot.js `askPayer`); Me → this month's
  payment out of Money now and every month; someone else ("My father") → never out of Money (regular.js tickRegular skips it),
  reminder on the day: "Renews today: … — My father pays it; your balance stays the same" (nextReminder). Receipts count 14 days
  (the 7 Nov one was gone after 3).
- **"99% of notifications"**: tests/unit/v9913corpus.test.mjs — 84 real-life notifications (offers, videos/news/games, receipts,
  chat money, bank SMS, nothing-to-ask) in English + Egyptian Arabic; 84/84 now. Honest number: the second batch of 22, written
  before the rules were tuned for it, scored 17/22 on the first try — the rules were then widened (from EGP…, buy 1 get 1,
  sponsored, you paid / amount charged / has been renewed, «حولتلك ٣٠٠٠» with no currency). Add every miss Ali sends to the corpus.
- Tests: unit v9913agents, v9913corpus; e2e_v9913agents.

## 10 Nov — v9.9.12: Follow-ups understands the message before asking + agents say if a find beats your best (Ali: "Follow-ups is not
   logical"; "agents still scattered … how to auto-check … how to know if the new findings are better")
- `notelabels.js understandNote(n)`: offers / adverts (Uber invite-a-friend, talabat "206 instead of 295") → ads, never asked; video /
  social / news apps (YouTube "$250,000" title) → not money, never asked; a receipt that says you were charged (Google Play) → "paid";
  a chat named about work / wages → a GUESS (work). `asksFrom` skips the sure ones, asks a receipt as `why: "paid"` (`payOf` =
  paylog-ui `payEntryOf`: not done, not already in Money) and gives the guess. An email's source is its SENDER (`kind: "mail"`).
- `PaidAskCard` (notelabels-ui.jsx): "Looks like you paid — add it to Money?" 939.99 EGP · every month → Add to Money
  (`addPaidNow`: appendToLedger + markDone) / Not mine (`dismissPaid`). A guessed card opens on "I think I know what this is — right?"
  (Save / Change).
- Agents (`agents.js agentChat`): every priced check says it against the best before it — "New best … {x} less", "the same as your
  best", "no better. Your best is still {b}"; background misses explain Booking.com needs a browser and the best stays.
  `uniqueOffers` (the same 41,495 on 01/08 → 01/12 showed twice in Best found); the table's heads use the hotel's name, not "Booking.com".
- **Ali: "why wasn't the Google subscription added to the dates by itself?"** notifmeaning.js read «ج.م.‏ ٩٣٩٫٩٩» as 0 (Arabic digits,
  the Arabic decimal mark, a hidden direction mark) so Autopilot's subscription rule (needs an amount) skipped it. Now 939.99 EGP;
  `paidDayOf` takes the receipt's own date (Order date: 7 Nov → renews on the 7th); "ج.م" = EGP. Known subscriptions are left to
  Autopilot (Follow-ups' paid card skips them — no double add).
- **Ali picked AG1 AG2 AC2 AC3 AH1** (AG2 as a chart of every start date × hotel) + subscriptions "who pays it" (me → from my balance; someone else, e.g. his father → not deducted but reminded). Combined page waiting for his OK: https://claude.ai/artifact/MKnujhxuS8SgLncLadhA1W (point 5 asks: does he pay his father back?). Options page: — AG1–AG3 (agent page), AC1–AC3 (real auto-check for
  sites that need a browser: on open / at night while charging / one-tap notification), AH1 (plan before Start), FQ1–FQ3.
- Tests: unit v9912understand (his 5 notifications + agent messages + table), e2e_v9912understand; e2e_v999teachnotes follows the guess.

## 10 Nov — v9.9.11: Attune asks about notifications, you tell it, it remembers (Ali picked A1 A2 A4 L — "integrate them in a good
   way and make sure it's smart and understands anything I type"; options https://claude.ai/artifact/MmUidfQHioDS3NuqzTGJwV)
- Brain `notelabels.js`: `sourceOf` (a chat / group, an SMS sender, an app), labels (work · notmoney · mymoney · bank · bill · delivery ·
  family · important · ads · ignore) saved in noteteach's rules (kind "label"); `readAnswer` reads free words (English, Egyptian Arabic,
  Franco; "not mine" before "mine"; a person + money together: «ده اخويا بيحولي فلوس» → his money counts AND Ahmed = brother) → else
  the AI (`aiPrompt` / `readAi`, a meaning from the list only, `window.__attuneQuickAi` while a model is loaded) → else "which of
  these?". Nothing saved before "I understood … — Save". Effects: paylog.js (notmoney/work/ads/ignore → never money; mymoney/bank →
  `trusted` money source), Recall + Your day hide ignore/ads.
- **A1** Follow-ups: `NoteAskCard` at the top of the thread (money in a chat / an unknown app, once per source; a bank's money is not
  asked — the payment check handles it). **A4** Chat: "teach me your notifications" / «علمني اشعاراتي» → `TeachChat` (one by one).
  **L** "What Attune learned (n)" in Follow-ups and Recall (`LearnedList`, Undo — the source may be asked again).
- **A2** `NoteAsk.kt`: money in a chat Attune wasn't taught → one notification "What is this?" with Mine · Not money · Reply… (typed);
  max 2 a day, never the same chat twice, never a taught chat (page → `noteAskKnown`); the words in the person's language
  (`noteAskWords`). The page takes answers on open (`syncPhone`): a tap is learnt at once; a typed sentence waits in Follow-ups as
  "I understood … — Save".
- Tests: unit v999notelabels (36), e2e_v999teachnotes (A1, Save, never again, learned list + Undo, Chat, A2 tap + typed); unit
  v999kotlinval (the first v9.9.11 APK build broke on `val a = …, b = …` in NoteAsk.kt). **APK v9.9.11:** https://github.com/alydibiky/attune-/actions/runs/42679500778 (success).

## 10 Nov — v9.9.10: a WhatsApp group's wages became "income" (Ali: "what the hell?") — fixed for good
- Cause: PayListener kept any notification with an amount + a money word, from ANY app; paylog.js read «غفره بليل ٤٥٠ جنيه…»
  (group "ما يخص المرتبات") as "450 EGP in, from يوم, high confidence" → added by itself. Now chat apps (WhatsApp, Telegram, Messenger,
  Signal, Viber, Instagram, Slack, Teams, Discord, imo, botim, WeChat, LINE…) are never money: PayListener.kt `PayLog.isChatApp`,
  paylog.js `CHAT_APP` / `isChatApp` (readNotification), autopilot.js (subscriptions / bank suggestions). Bank SMS (Messages) stays.
- Already-added ones: `ChatMoneyFix` card in Money (paylog-ui.jsx) lists them; "Remove them" deletes through Money's own tx-delete,
  "Keep them" never asks again. Nothing deleted silently.
- **Then (Ali: "an AI model should assess the notifications … it should have asked me before it was added if it was not sure"):**
  "by itself" now needs ALL of: the code is sure (high confidence) + a money SOURCE (bank / wallet / InstaPay app, or an SMS whose
  sender is a bank — not a person's number) + words that the money MOVED (paylog.js `codeSure`) + **the small model agrees** when one
  is loaded (`judged`: a strict one-line JSON question; only "payment true, same direction, same amount" adds; "no" / another amount /
  no clear answer / an error → waits). The model is never loaded just for this (`window.__attunePayJudge` exists only while ready).
  Everything else waits in Money with "Not sure — is this yours?" / "Attune thinks this isn't a payment — is it yours?", and opening
  Attune says "{n} payments wait for your OK in Money" once when new ones wait. Tests: v999chatmoney (judge cases).
- Ali's "nothing was updated": his screens were v9.9.8 (Radar photo behind, no ‹ › bar) — the v9.9.9 APK had built 20 min before.
- Tests: unit v999chatmoney (his exact message; the old reader made it 450 income), e2e_v999chatmoney.

## 10 Nov — v9.9.9: Ali's phone round — Radar card C + Money Report dates (P1 + category)
- **Radar card** (Ali: "it looks really bad" → picked **C**, https://claude.ai/artifact/R1UWeisuGPnseigFyo1ar8): the light theme maps
  "white" to near-black (spaces.js `--color-white`), so the card's words were dark on dark — `DocCover` now uses real white inline;
  one colour per document, no photo on it ("I don't like the photo this way"), "📷 n" opens the photos; a short number note shows ON
  the card. Test: e2e_v995docs checks the words are white in the light theme (it fails on the old card).
- **Money Report dates** (Ali picked **P1** + "a specific date and category at the same time", https://claude.ai/artifact/TeMyVf4p2FfgaJocDndgiT):
  ‹ November 2026 ▾ › under the title (› off at this month); the month opens From / To + Category + the last 12 months; the category
  shows as a chip (✕), "Back to this month". `moneyReport(L, { from, to, cat })` — totals, both pies, weeks, 6 months, list, PDF / Excel
  follow; nothing after today counts; From after To is swapped. Home's calm view stays on this month.
- **Bugs from his screenshot:** "Other" twice (his own Other category + the rest) → one Other; the income legend cut the % → fits.
- Tests: unit v998moneyfix; e2e_v998moneydates; e2e_v995docs (C + white).

## 10 Nov — v9.9.8: M2 small models as a relay (phone) + M4 two models as a team (computer) — Ali OK'd
- **M2** (`relay.js`, attune.jsx `memMeaning`, chat.jsx S1 block): when the meaning model (bge-m3, 0.57 B) is on the phone, Chat's
  "your own notes first" also finds records that MEAN the question with other words («فاتورة الكهربا» ↔ "electricity invoice"),
  reusing Recall's stored numbers (up to 24 new records get theirs in the same call). Strict like M1: a meaning-only record must be
  ≥ 0.62 close (≥ 0.55 with a shared word), at most 3 records in all. Memory rule (relay.js `helperAllowed`, Embedder.kt
  `KEEP_AFTER` 1.15 GB): helpers ≤ ~1.5 B, never two big models together, the meaning model loads next to a chat model only with
  1.15 GB free, is let go after a chat question when memory is tight, and always before a chat model loads (Engine.startBlocking).
  Already there before: the photo reader loads only for a photo; Android takes the model back only when memory is really short;
  the 2-model "draft helper" stays retired on phones (measured slower, wrote "0000" on Ali's phone).
- **M4** (`desktop/lib/team.js`, engine.js, main.js): on the computer, a small model of the SAME family (≤ 1.5 B, ≤ ¼ of the big
  one, both in the memory budget) drafts and the big one checks — llama.cpp speculative decoding: the answer is exactly the big
  model's, faster. Qwen3.5 9B / 4B + Qwen3.5 0.8B; other families never mix. Tried as a team first, then alone. Off with
  `"team": false` in the desktop state. No Engine-page line yet (visible → mock-ups first).
- Tests: unit v998relay; e2e_v998relay; desktop/test/team.js (in run_all). **Needs measuring:** M2 on Ali's phone (time of the
  first question with the meaning model), M4 speed on a computer (expect 1.5–2.5×).

## 10 Nov — v9.9.7: W1 "Do it on the web" (Ali OK'd)
- `webtask.js` + `WebTaskSheet` (attune.jsx): "book a padel court Friday 8pm near me", «احجزلي ملعب بادل الجمعة الساعة ٨ بالليل», "renew my
  car licence" → a sheet with the steps (understood ✓ · find / open the site · fill your details + day, time, people · **stops before
  paying**). Start opens Attune's browser (AgentBrowser) with `fillAuto` → agent-kit fills the saved Booking details + taskDate /
  taskTime / taskPeople at 2.5 s and 6 s; the steps tick from what the browser reports (filled n · payment page reached → "your turn").
  Hotels, flights, food, doctors stay with Agents; messages / rides stay with W2. Licence / passport / ID → digital.gov.eg, else a web search.
- **R3 Radar card** (Ali picked from https://claude.ai/artifact/6bjm3PQWxPKhXUSFq8DWBx): a document (kind expiry) is drawn like the real
  card (`DocCover` in docs-ui.jsx: its first photo or a colour per document, name, main number masked, date); a tap opens the photos;
  Details (n) folds out with Show · Copy only. Adding photos / details, locks and times are in **Edit** (`Form` gets live/onPatch;
  Save never puts back stale photos/fields). Netflix, warranties, returns keep the list card.
- Tests: unit v997webtask, e2e_v997webtask, e2e_v995docs (R3). **Next:** M2 (small-model relay on phones), M4 (two models on the computer app).

## 10 Nov — v9.9.6: N3 @ links + N1 tables (Ali OK'd)
- **N3** (`mentions.js`, Shelf note editor): typing @ + letters shows your people / things (People cards) + "+ New: X"; picking writes
  "@Sheikh"; the note shows "Linked: @Sheikh @Grove GMK" (a tap opens the card — whose page already lists every note naming them);
  a sentence with a promise ("@Sheikh … he'll pay Thursday", «هيدفع بكرة») offers **Follow up** (a reminder only when tapped).
- **N1** (`tables.js` + `tables-ui.jsx`, Lists → Tables, mode "tables"): "track my cranes: name, tonnage, next inspection" (Home
  box or the Tables page) makes the table (column kinds guessed: text / number / date / status); rows by the form, inline edit, or
  said ("add Grove GMK, 100 tons, inspection 4 Dec" — each value to its column; "add milk" never goes into a table); Table · Board
  (by status) · Calendar; a reminder the day before each future date at 9:00 (synced to the phone).
- Tests: unit v996mentions (11), v996tables (12); e2e_v996mentions, e2e_v996tables.
- Still to build (OK'd): W1 web agent, M2 small-model relay, M4 computer team.

## 10 Nov — v9.9.5: Ali OK'd D1 D2 S1 — documents with photos and details, each detail its own lock and time
- `docfields.js` + `docs-ui.jsx` on every Deadline Radar document / warranty card: **D1** photos (many, private store, full screen
  with ‹ ›, delete); **D2** details (suggested per type: passport / ID / visa / licence / insurance / registration / bank card /
  account; added by name or said in one sentence "visa number H123, valid until 1 Dec 2027"; Copy); **S1** (Ali: "make the vault
  customizable … the time for each one separately, and an option to do S2"): each row Normal / Hidden-tap (S2) / Locked-fingerprint
  (S1, Vault.kt prompt) with its own show time (15 s … 10 min, or until you leave); CVC / PIN / password start locked, a card number
  tap-to-show with its last 4 visible. Locked values are kept in `attune:radar:secrets:v1`, not in the item (not in sync / backup).
  On the computer app (no fingerprint) a locked row opens with a tap. Tests: unit v995docfields (11), e2e_v995docs.

## 10 Nov — v9.9.4: M1 strict saving, M3 check-it, the hotel agent's background checks, Radar dates
- **M1** (doit.js `strictCheck`, Ali: "strict — I don't want the code saving things wrong"): anything read from typed / spoken words
  that the code isn't sure of ("co 900", "ahmed 500", an amount over 5 M, a reminder with no time) → "Save this? Expense 900 — co"
  Yes / No (Home box, Follow-ups box, desktop Home); voice says it saved nothing; Chat keeps its own check (doSure + judge + pick).
- **M3**: the reviewer pass (power.js reviewMessages) on every power level for "check it" / «اتأكد», and for hard contract / tax /
  interest questions with ≤1 number (sums with numbers go to the code checker, which is stricter). Same small model.
- **Hotel agent** (Ali: "followed it 2 weeks and it didn't change"): background checks used Jsoup — Booking shows prices only
  after its JavaScript runs, so 12 background checks never saw a price. Now `HeadlessRead.kt` reads script-only sites (Booking,
  Agoda, Expedia, Airbnb…) in an invisible WebView with agent-kit.js, 2 dates per round (rotating), the agent's rules sent along;
  its best offers (names, links) reach the card (agents.js takeChecks `top`). **Needs Ali's phone test** (WebView off-screen).
  Also: "Found under your price" now follows the agent's rules (agent-rules `withRuleFound`); the podium's "Under your limit ✓" is
  worked out for the offer shown big; "1 best offers" → "The best offer".
- **Radar dates** read "3 Aug 2030" (radar-ui niceDate). Documents with photos (D1) + details (D2) + secret fields (S1–S3) waiting
  for Ali's OK on https://claude.ai/artifact/X6Rovna21JhYvjpNu4hhfj
- Still to build (OK'd): N3, N1, W1, M2 (small-model relay), M4 (computer team).

## 9 Nov — v9.9.3: Ali OK'd everything on the "what I understood" page (T1 N1 N3 W1 W2 M1–M4 L1–L4)
- **L1–L4 teach from notifications** (`noteteach.js` + `noteteach-ui.jsx`): on a Recall notification "she's my wife" → "I understood:
  Nada = your wife" → Save (saved on the People card, role); from the Home box / Chat / voice: "Nada is my wife", "tell me when my
  wife gets home" (a phone alert on Life360 via watch.js → WatchMatch.kt, works with Attune closed), "never show Yazio" (hidden in
  Recall + Home); Home asks once "Who is Sara?" (seen 3×/week); Home reads "Your wife (Nada) · Arrived at Home"; Chat "where's my
  wife?" → the newest Life360 note. Not sure → it asks, never a guess. (teach.js is the OLD "teach your model" packs — kept.)
- **W2** (`applinks.js`): "send Ahmed '…' on WhatsApp", "call Mama", "uber to …", "directions to …", "email Karim about …" → the app's
  own link (wa.me / sms: / tel: dialer / mailto: / Uber / Maps); two Ahmeds or none → "Which Ahmed?" sheet with saved people +
  Pick from contacts (Android's picker, no contacts permission), remembered. NativeBridge.openAnyApp opens tel:/sms:/mailto:.
- **T1** (`timetable.js` + `timetable-ui.jsx`, Reminders → "From a timetable photo", Home "my timetable"): text reader positions →
  grid or list, + the photo model's JSON (when a 📷 model is loaded) merged (both agree = sure, one = "check this"); the person checks
  / fixes / deletes; weekly reminders N min before, stopping after the term's last day (Reminders.kt `until`).
- Next (not started): N3 @ links, N1 tables from a sentence (in Lists), W1 web agent, M1 strict router (ask when unsure — Ali: "make
  the guidelines strict, I don't want the code saving things wrong"), M2 small-model relay (never two > ~1.5 B), M3 checker, M4 computer team.
- Tests: unit v993noteteach (23), v993applinks (13), v993timetable (14); e2e_v993teach, e2e_v993applinks, e2e_v993timetable.

## 9 Nov — v9.9.2: Ali picked T1 S1 G1 N1 N3 W1 W2 M1 M2 M3 M4 (+ asked to explore "teach Attune from notifications")
- Built: **G1** "Found" in the app colour (agent-rules STATUS found → blue/accent, yourday tag); **S1** Chat checks Shelf / Mind
  notes first for ANY question a note clearly fits (attune.jsx `memStrong`: ≥2 words and ≥60 % of the question's words in one
  record) and shows "From your Shelf: Crane notes" (chat.jsx `fromMine`, e2e_v992s1).
- New standing rule (CLAUDE.md + MOCKUPS.md): every options page has an OK box AND a note box on every option + a copy bar.
- Waiting for his OKs / notes on the combined page https://claude.ai/artifact/UNQfGvdVLJyATkZ2JZDNHz — T1 timetable photo,
  N1 tables from a sentence (in Lists), N3 @ links, W1 web agent (stops before Pay), W2 app links + "which Ahmed?" with Android's
  contact picker (no contacts permission — Play-safe), M1 router, M2 small models only on phones (never two > ~1.5 B, memory checked),
  M3 checker, M4 computer team; new L1–L4 (talk to a notification "Nada is my wife", rules by talking, asks once, uses it on Home/Chat).

## 9 Nov later — every open option on one page for Ali to pick: https://claude.ai/artifact/CQZCRBEDAcv7NJG6VG3V5J (T1 timetable photo, S1 Chat checks Shelf/Mind/Documents first, G1 Found in burgundy, N1–N5 from Notion, W1–W3 do it for me, M1–M5 several AI models). Build what he picks.

## 9 Nov — v9.9.1: Ali's notifications questions (screenshots of Recall + Home)
- **Subscriptions from notifications, by themselves** (Ali: "a Google one told me the payment of Gemini and it wasn't recorded in
  subscriptions automatically"): autopilot.js `subscription` (SUBS list: Gemini/Google One, YouTube Premium, Netflix, Spotify, Shahid,
  OSN+, WATCH IT, Anghami, Apple, ChatGPT, Claude, Disney+, Prime, Canva, Adobe, Microsoft, PS Plus, Duolingo, Notion…) — a PAYMENT
  (not an offer) → `subpay.js`: new monthly subscription in People & plans with this month ticked, or this month ticked on the one
  already there; the expense in Money (not twice if the bank SMS came first). Added WITHOUT a tap (`isAuto`), shown on Home as done
  for you with Undo; "Not this" for that app stops it. Autopilot now also reads Money's payment notifications (payQueue), not only
  Recall's. Fixed: on the first open Autopilot's auto step ran before the app's save path existed (shown done, nothing saved).
- **Maps navigation** ("50 m · At the roundabout…" ×20 as "Payments"): PayListener.kt keeps no ongoing / navigation / progress
  notifications; Recall hides the ones kept before (lookback.js `isNavNote`). E£975.00 is read as 975.
- **Home's Agents**: "Huawei free clips 2 · Found · 120 EGP" (a case from before the v9.8 guard) is hidden — yourday.js `believable`.
- Answered (no code): Shelf notes are Mind records — Chat reads them when the question is about your own things; Documents are kept
  in the phone's storage until deleted, answers come from the passages that fit (hard multi-step questions limited by the phone
  model); a timetable photo → reminders, Notion ideas and "connect apps" are options waiting for Ali's pick (see the chat).
- Tests: unit v990subs (14), v990notes (8); e2e_v990subs.

## 8 Nov — v9.9: Ali picked FU6 + "edit anything by talking to Chat"
- **Follow-ups = Attune asks, you answer** (`timeline-ui.jsx`; FU1 archived in `archive/followups-fu1/`): one question per thing
  that needs you today (late first) — "Did Maid come on Saturday?" Came ✓ / Didn't come; "Did Sheikh pay?" Paid · Other amount ·
  Not yet (PersonAsk); a reminder Done / Tomorrow; anything else Open / Later. Each answer shows in the thread with what it did
  ("600 out of Money") and Undo. None left → "All clear until …". "Coming:" one line + See all. The box at the bottom adds AND changes.
  `timeline.js` now respects "Didn't come" (c.skip) and "Not yet" (c.later). Money by a tap: today and 7 days back (unchanged).
- **Edit by talking** (`lifeedit.js`, Ali: "telling it the maid is now taking 700 and it gets done"): from the Follow-ups box, the
  Home box, voice and Chat (doit.js action `lifeEdit`, Chat DO_HERE): change the amount ("the maid is now taking 700",
  «الخدامة بقت بـ٧٠٠», «الشغالة بتاخد ٧٠٠ دلوقتي»), the day ("comes on Friday now", "move the car wash to the 5th"), or stop it
  ("stop the car wash", «الخدامة مش هتيجي تاني»). From TODAY on — the days before keep their amount / day (c.changes, read by
  life.js `withChanges`), Money never changes. A plan with a total (Sheikh 19,500 in 8) is not changed by a sentence: it says so and
  opens People & plans. English ↔ Arabic names match (maid = خدامة = شغالة …). Tests: unit v990edit (28), e2e_v990fu6.

## 8 Nov later — Ali: "cancel FU1, tell me a better option" → FU6–FU10 on https://claude.ai/artifact/FsAwRjNtSWY4Lb7fCVSfYY (rec. FU6 Attune asks, you answer). FU1 stays live until his pick; then archive it in archive/followups-fu1/ and build the pick.

## 8 Nov — v9.8.4: Ali picked FU1 — Follow-ups is ONE feed
- `timeline-ui.jsx` rewritten: the Add box on top, a one-line summary, then **Today** (late first, red) · **This week** · **Later**.
  Every row is the same: a box on the left when it can be ticked, the amount on the right. No week strip, no chips, no ⋯ menu;
  the parts' own pages are one small "Manage:" row at the bottom (fu-pages / fu-open-<page>).
- What the box does (`timeline.js actionOf`, tested in v980fu1): a regular / subscription / bill you pay → "Maid came?" — tick =
  the expense in Money (tickRegular); a person who owes you → "Did Sheikh pay?" — Paid · Other amount · Not yet right in the list;
  a reminder → done (hidden for that day); an errand → its page. **Money by a tap only today and the 7 days before**: a regular day
  that passed stays in Today as a question (not red "late") for 7 days, then disappears; a payment not due yet has no box.
- `feedOf()` makes the three sections. Tests: unit v980fu1, e2e_v960picks (FU1 block: Sheikh ask, gardener 3 days ago ticked =
  400 out, cleaner 16 days ago not shown, Saturday's maid no box), e2e_v830 / e2e_v734sidebar / e2e_v740timeline updated.

## 8 Nov later — Follow-ups redesign asked ("so confusing and scattered") + a past maid day can't be pressed
- Fixed: People & plans — only today's box of a regular can be ticked (life-ui.jsx Item, data-locked); a past day shows ✓ / —, never
  moves money (e2e_v737maid). Home's "Was due … — paid?" still lets a forgotten day be recorded on purpose.
- (v9.8.3) **Research agents never go to Chat** (Ali: "it went to Chat, so I have to keep the app open"): attune.jsx `researchForAgent`
  (web search ×3 → mergeHits → rankPassages → groundedPrompt → callChat background) under `keepAwake` (GenService keeps it at full speed
  while Attune is in the background), the report saved ON the agent (`a.report`, ReportBox on the A5 card + FollowCard), a notification
  "Research ready". A one-off "research …" sentence is a once-agent (kind follow, once). Honest limit: if Attune is swiped away / force-
  stopped the WebView dies and the run stops — it continues while the app is in the background. Test e2e_v980research.
- (v9.8.3) **Money by a tap: 7 days at most** (Ali): a regular's box is tappable from 7 days ago to today (life-ui `tickable`), Home's
  "paid?" box only for the last 7 days (home.js askPaid).
- Waiting for Ali's pick: FU1–FU5 (rec. FU1 one feed Today · This week · Later, everything ticked the same way, one Add box) on
  https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC.

## v9.8.1 — 8 Nov: Ali's 7 points on v9.8 (+ "reply to it and tell it how to add it")
- **Autopilot**: a tap opens the whole notification (`autopilot-ui.jsx Item`), "Save it as" Reminder / To-do / Expense / Subscription,
  and a box that goes through the Home box (`window.__attuneDoIt`; "remind me Monday at 9" alone gets the notification's words as what).
  notifmeaning: a WhatsApp "Missed voice call" is a call (one is enough for "call back"), "300 EGP OFF … delivered in 15 minutes" is an
  offer (also not "Arriving" on Your day — daynotes.js), an email is a delivery only when a shop sent it.
- **Reminders** wrap (whole text) — rem-title-text, Done rows, Follow-ups' list.
- **Hotel conditions**: "free cancellation", "pay at property" (no prepayment), "breakfast" (= included, not "available for SAR 90")
  are must-haves (parseRule EN + AR), checked on each offer card's own words (followsRules), and Booking's search page gets
  `nflt=fc=2;mealplan=1` (`withHotelFilters`; codes from third-party scrapers — "pay at property" has none, so words only).
- **Agents logic**: an accessory (case, cover, جراب…) is never the product's price unless asked; a price under 30 % of the limit /
  past prices is not believed (`bestAcross`); a Scout search that is the same as an agent is not listed twice (`withoutTwins`).
- **Sidebar** keeps the app colour on area pages (areaCss `.calm:not(aside):not(nav):not(header)`).
- **How to use**: chapters drop archived tools (`chapters` + hiddenFromMenus), 7 sentences that named archived features rewritten
  (old ones in `archive/guide-v97/removed-lines.txt`), Errands sits with Reminders.
- **Zakāt**: "If your money stays as it is, you will pay about X on <ḥawl end> (2.5 % of Y)" or "it stays under the niṣāb"
  (`zakatPage().projected`).
- **Ali picked A5 + T1 (8 Nov) — BUILT (v9.8.2)**: Agents' default view "Cards" (`agents-ui.jsx AgentCardsA5`): one card per agent —
  its site, what it watches, "checked … ago", your conditions, what changed since yesterday, and its best offer INSIDE (name, days,
  site, "n more", price) with Open the listing; no offer → "Watching for under …". List / Board one tap away. Tools (`tools-hub-ui.jsx
  TOOL_COLOR`): a solid colour per tool with a white mark (Writing violet, Files orange, Ask a PDF blue), numbers in ink, quiet badges.
  Test: e2e_v980picks (A5 + T1).
- Tests: v980fixes (67), e2e_v980autopilot / e2e_v980picks / e2e_v731guide updated.

## v9.8 — 7 Nov: Ali's 15-point phone list ("fix it for good") — BUILT + options waiting for his picks
Ali: "each week I burn tokens … the real improvement is 1% because the same problems come back". So every point got its cause found
and a test (`tests/unit/v980fixes.test.mjs` 50 checks, `tests/e2e_v980agentopen.py` 10 checks).
- **1 recurring payment = a box, not an expense**: "each first day of month pay to man who washes car 700" → a monthly *regular* on the
  1st (like the maid / Sheikh), ticked = the expense. Causes: `life.js HELP` didn't know "washes the car" / «بيغسل العربية»; "every
  month" matched "every **mon**day" (`DAY_EVERY` `[a-z]*`); no "first day of the month" (`startOf` day 1, `EVERY_M`); any "I pay X
  every month/week" with no known word is now a regular (title from "for/to the …"); "I pay 1500 for the gym" is named "Gym".
- **15 Enter = new line on phones**: `web-src/keys.js enterSends` in every chat box (Chat, Home box, Ask a PDF, People & plans, Desk,
  Spaces). Touch → Enter is a new line, only Send sends; computer → Enter sends, Shift+Enter new line. (Old bug: Chat checked
  `tr("(pointer: fine)")` — translated into Arabic it was never a valid media query.)
- **4 Spent is red**: every Spent tile, weekly bars and the cashflow "Spent" bars in Money use `--c-neg` (Earned stays green). The
  rest of the colour question is option C6–C9 below.
- **11 no more daily-learning notifications**: the Learn page was archived in v9.1 but `syncDaily` re-armed a daily lesson alarm on
  every start, with no page left to switch it off, and `lessonAhead` ran the model every 20 s for it. `daily-ui.jsx LEARN_NOTIFY =
  false` (the start-up clean-up now removes the old alarms; Daily news keeps its own switch); no background lessons.
- **5/9 agents open THE listing**: `agent-kit.js hrefOf` gives an offer only its own page (a listing link, else the card's link if it
  isn't a map / reviews / search / filter) — it used to take the card's first link. New `goTo({name, price})`: on the results page it
  finds that offer and goes into its page (its link, or a tap when the site opens cards by script). `agent-rules.js offerOpen`:
  own page → phone's browser / app; no own page → `agentOpen` with `goto` (AgentBrowser.kt runs goTo after load, once).
  LISTING widened (Agoda /hotel/x.html, Trip.com hotelId, Google /entity/, Kayak .ksp). Offers keep `url` = the results page.
- **6 notifications understood**: `web-src/notifmeaning.js understandNote` → kind (delivery, bank, call, ride, flight, appointment,
  bill, security, promo, news, message, email), who, amount, state ("arriving Thursday", "money out"). Recall's search carries
  those meaning words (hidden from snippets), so "when does my package come" finds Amazon's "Shipped", "who called me" the missed call.
- **2/8 chats smarter**: `web-src/brain.js` — one brain for the voice and page chats: Attune's own abilities (never "I can't access
  files"), what the phone already knows that fits (notifications understood + connected memory), the profile; voice answers get 520
  tokens and "2 to 5 spoken sentences" (was 200 / "1 to 3"). Main Chat adds the matching notifications to the question
  (`api.knownFor`). `router.js wantsThink`: long report / analysis questions think first (Ali: "10 seconds is fine if it's right").
- **12 translate a document**: voice / Chat "translate this document" → `routeTask` → Translate opens on Document (voice), or the
  attached file goes straight to the converter's checked translation (`api.translateDoc`, whole file, layout kept).
- 3 new lines × 20 languages. Version 9.8 (versionCode 138).
- **Ali picked (7 Nov): C6 · A3 · F1 · D1 · "I1 if done correctly" + "another idea not in the app that is really strong"** — BUILT:
  - C6 `spaces.js AREA / AREA_OF / areaCss`: Money green, Agents blue, Follow-ups amber, Documents violet; on an area's page its colour
    is the accent (`html[data-area]`, set in attune.jsx from the mode); Home's cards + "To do" wear their area's colour. Test v980c6
    (contrast ≥4.5 light + dark).
  - A3 `agents.js whatChanged` (needs → found → drop → rise, last 36 h) + `agents-ui.jsx WhatsNew`: "New since yesterday" with Open the
    listing, then "Watching · n" one row each; view "new" is the default (List / Board one tap away; starter tiles behind "More
    agents"). Test v980a3 + e2e_v980picks.
  - F1 `actions-ui.jsx RemindersPanel`: the say-it box + the list by day (Today / Tomorrow / date); Message alerts, Fill it in, Plan my
    day, How it works are chips (`attune:rem:open`; the test harness opens them all for older tests).
  - D1 `booklib-ui.jsx`: the ask-all box on top until a conversation starts, kind badges (PDF / DOC / PPT / BOOK / TXT), "812 pages ·
    ready" / "reading 140 of 230 pages", "All" chip.
  - Old tests fixed on the way (they failed on main before v9.8 too): e2e_v727life (v9.5 records a tick with no question), e2e_v750money
    (parts behind ⋯ since v9.6), e2e_v905deal (a board card opens the conversation since v9.6).
  - **I1 Autopilot**: "what I understood" + **new ideas I5 Handshake (rec.), I6 five seconds after every call, I7 one ledger two phones**
    on the same page — waiting for Ali's OK / pick before building.
- **I1 Autopilot BUILT** (Ali: "I1 ok"): `autopilot.js` (suggestFrom / suggestions / accept / refuse / allow / undoDone / actionsFor) +
  `autopilot-ui.jsx` AutopilotCard on Home; saved through `window.__attuneApplyActions` (the Home box's path). Tests v980autopilot +
  e2e_v980autopilot. Ali on I5–I7: "too basic and lame" → researched **N1 Haggler / N2 phone memory / N3 errands**.
- **N1 + N3 BUILT** (Ali: "do N1 and N3 … best way possible … without any mistakes"):
  - N1 `haggle.js` (pricesIn «مليون و٥٠», parseHaggle, addSeller, marketOf / targetOf (93 % of market, ≤ limit) / openingOffer (85 %),
    readReply (price, final, sold, scam = deposit before viewing, no viewing, answers), nextMove (ask → offer → our last number →
    good = YOUR turn / walk / dealer / scam; "last price" in the first reply is not believed; a seller is held to their lowest),
    `safeText` (never a yes / payment / deposit), tick (background step), sellerFromAd (any phone spacing)) + `haggle-ui.jsx`
    HaggleView. Agents: a "negotiate …" / «فاصلي على …» sentence (Agents box, Home, Chat, voice) makes kind "haggle"; it shows in
    What's new when a seller is inside the limit; attune.jsx runs `HG.tick` every minute and sends through `scheduleMessage`
    (ask = one tap, or by itself in the auto APK). Tests v980haggle (35) + e2e_v980n1n3.
  - N3 `errands.js` (parseErrand in EN / AR with Egyptian plates and day-first dates, KINDS with Egypt's papers, dueList in calendar
    days, readPortal reads what an official page says is due — a login page reads as nothing, afterCheck, markDone) +
    `errands-ui.jsx` ErrandsPage (mode "errands", Follow-ups ⋯ → Errands, amber). Due errands are on Follow-ups' list (timeline.js).
    The official page opens in Attune's browser (slot mode: its words come back) — Egyptian portals ask for ID / a code, so nothing is
    checked silently; Attune never pays. Tests v980errands (17) + e2e_v980n1n3.
  - 78 lines × 20 languages.
- (was) **Waiting for Ali's picks** (MOCKUPS.md rule): https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC — C6–C9 colours (rec. C6 each
  area its own colour), A1–A4 Agents layout (rec. A3 "what changed" on top), F1–F4 Follow-ups (rec. F1 one box + one list by day),
  D1–D4 Documents (rec. D1 library + ask-all), I1–I4 the new big idea (rec. I1 Autopilot: notifications do themselves). Source:
  `design/v98/options.html`.

## RULE (Ali, 2 Nov 2026) — every addition in all 20 languages, in the same change
"For each addition in the app do it for all languages so we don't have to translate later": every new English line the app shows
gets its translation in all 20 `web-src/i18n-<id>.js` files before the commit (also in CLAUDE.md's standing rules).
v9.0 did this: 12 new lines × 20 languages; deep research is also recognised in every language (`research.js wantsDeep`).

## v9.7.2 — 6 Nov: "that wasn't the colours we agreed on" — C1 now for EVERY colour
Ali's phone had **Rose** picked in Settings → Theme; v9.6 built C1 (calm charts, soft buttons, neutral ground) only for Burgundy, so Rose
painted the charts red and the ground pink. `spaces.js calmVars`: every colour gets the calm chart colours, soft buttons (its own soft
tint + its colour as text; orange darkened to read), and the neutral ground (Green / Teal keep the green-grey one). Test: v950theme
checks all 9 colours × light/dark (calm charts, contrast ≥4.5:1 on buttons, no pink ground).

## v9.7.1 — 6 Nov: Play Protect blocked the 9.7 full APK ("App blocked to protect your device")
Cause: SEND_SMS + the AutoSend Accessibility service in the full APK (Google's fraud protection blocks file-installed apps asking for
them; Egypt included — the same as READ_SMS in v8.7). Fix: both moved to a new optional flavor **"auto"** (src/auto/AndroidManifest.xml =
full + SEND_SMS + AutoSend; CI artifact `attune-apk-auto`); the normal full APK asks for nothing new (installs like 9.6). Messages says
where "send by itself" is (`msg-auto-elsewhere`). Everything else (auto-reply, ask first, one tap) works in the full APK.

## v9.7 — 6 Nov: Messages like Auto Text BUILT (Ali: "go with M3 and S1 and S2 and S3")
- `web-src/msgsched.js` (pure: APPS, nextAt incl. yearly, linkFor per app, missing, auto-reply rules + ruleFits, appIn / repeatIn) ·
  `messages-ui.jsx` MessagesPage (tabs Scheduled · Auto-reply · Sent; Composer: app chips, person + Contacts + phone / email, words,
  Templates (kept on the phone), ✨ Write it for me (the model, when loaded), time, repeat, Ask me before sending, Send by itself;
  RuleCard: when now / silent / between hours, apps, everyone / only / except, groups, once a day; Sent list from the phone's log) ·
  `scheduleMessage()` used by the composer, the Agents sentence and the gallery tile. Agents board shows ONE "Messages · n scheduled" card.
- Android: Reminders.kt fireSend → ask (notification Send / Not now, MsgActionReceiver) or deliver(): chat Reply → SMS by itself
  (SmsOut, full APK, SEND_SMS) → WhatsApp by itself (AutoSend AccessibilityService, full APK only, only WhatsApp, only our scheduled
  text in the box, only unlocked; 25 s then the one-tap notification) → one-tap notification; repeats re-armed (+ "yearly" in next());
  Reminders.log / sentLog (Sent tab). AutoReply.kt answers chat notifications by the rules through ChatInbox.reply (every build).
  Bridge: msgState, msgOpenAuto, msgAskSms, autoReplyRules / autoReplySet, msgSent. Play build: no Accessibility, no SEND_SMS.
- Tests: unit v970messages (24); e2e e2e_v970messages; e2e_v940agents follows the new composer.

## (was) message scheduler like Auto Text (6 Nov) — Ali picked M3 + S1 + S2 + S3
Ali: "I want the scheduling agent to be like Auto Text app … with my interface". Auto Text (com.hnib.smslater, formerly Do It Later):
scheduled WhatsApp/SMS/Telegram/email (once or repeating), auto-reply when busy/driving, templates, a log; it sends WhatsApp by itself
through Accessibility and SMS with SEND_SMS — both need a Google Play declaration and can be refused (SMS "device automation"
exception is not in the policy text effective 27 Jan 2027). Options: https://claude.ai/artifact/EJoWBPbPS2J5B5EsCEnmxj — M1 safe
(notification Reply / one tap), M2 fully automatic (Accessibility + SMS), M3 rec. (Play build = M1, direct "full" APK also offers M2
behind one switch); S1 rec. three tabs Scheduled · Auto-reply · Sent, S2 composer, S3 auto-reply rules, S4 week strip, S5 in the agent
conversation. Today's base: v9.4 G1 (agents2.js parseScheduled, SendCard + ScheduleForm, Reminders.kt `send` → ChatInbox.reply / wa.me).
Open source to compare first (rule): Watomatic (GPL-3.0 — idea only: auto-reply through notification RemoteInput, no code copied).

## Ali picked C1 (6 Nov) — BUILT: spaces.js QUIET + CALM_GROUND lightQuiet/darkQuiet (neutral greys), --c-btn/--c-on-btn soft buttons (every solid accent fill reads them; the floating + stays solid), calm chart colours (teal, amber, blue, grey), Money report: earned green, spent grey, net + this week blue, the big Spent number in ink. Test: unit v950theme (contrast ≥7:1 on buttons, ≥12:1 text). Was: colour pick C1–C5
Ali on 9.6: "I said burgundy but I didn't mean everything burgundy — the app became darker and harder to read". Cause: v9.5 made
burgundy the accent of every button, tab, checkbox AND the charts (Money report donut, cashflow "Earned" bars in red). Options:
https://claude.ai/artifact/E8FbW1hcBmvmFHqWCAwk1P — C1 quiet burgundy (rec.: burgundy only for small things, soft buttons, mixed chart
colours, earned green / spent ink) · C2 soft rose · C3 green back + burgundy brand mark · C4 ink + burgundy · C5 burgundy + teal.
Build only his pick: spaces.js CALM_ACCENT / calmVars (+ a soft-button token), the Money ledger's chart colours (attune.jsx Yusr
style block: --chart / --income / --accent), money-report charts. Green = money in, red = money out, everywhere.

## v9.6 — 5 Nov night: Ali said "OK, I love all of them" → BUILT (+ MOCKUPS.md: mock-ups before building, his rule)
- Agents (A3 + A4): the board is the page (Watching · Found · Done; `attune:agents:view2`, List still one tap away); a tap opens
  `AgentChat` — what you asked, what it did (`agents.js agentChat`), the **dates × best-3 grid** (`offersByDay` kept as `a.byDay` by
  Check now: the best 3 on each of the 6 cheapest dates; `datesGrid` falls back to best3 by day, or the price on each check), the
  agent's full card, and a box that changes its rules (`ruleLog`). Each offer opens that exact listing in the phone's browser.
- Month plan (P2 + P4 + P5 + P6): tabs Month · Calendar · Table (Year under Table). Month = `NetCard` (income − expenses = net →
  goals · free; the last month's settling with Undo) + goals with a slider (`setMonthly`: a total-by-date goal moves its date).
  `planner.js settleMonths` (from `data.since` = the month first opened; net ≥ wanted → wanted; less → what's there, shared by need;
  the shortfall spreads by itself; a month with nothing recorded is not a loss; `undoSettle`), `monthCalendar`, `planVsActual`
  (+ spending with no plan shows as over).
- Follow-ups (F4 + F1): `WeekStrip` (7 days, ‹ ›, dots; red = money out) + one list (`byDayLate`: Late first, then each day), one
  box searches as you type and adds on Send (`searchItems`), kind chips + the parts' pages behind ⋯ (`fu-more`), "Did Sheikh pay?"
  in the list (`PersonAsk`, shared with Home).
- Tests: unit v960plan / v960followups / v960agents; e2e `e2e_v960picks.py`; the harness keeps older tests on the agents list view.

## Ali's picks on the options (5 Nov night) — combined mock-ups (done → v9.6)
Ali: "I like A3 and A4 integrated in a clean way but I want more than 1 option in more than 1 date if available · P2, P4, P5 and P6 but
I want to set year savings — from the November plan, income vs expenses, if net profit it takes what we agreed for the month to reach
the time span or the yearly goal; it doesn't have to be yearly only · F4 and F1 integrated". Combined mock-ups + how Claude understood
each: https://claude.ai/artifact/2T2ZRNTemt42fTyvYX6FeY — Agents = board (Watching · Found · Done) → tap = the agent's conversation
with a dates × best-3 offers grid; Month plan = tabs Month (P2 net picture + goals that fill themselves at month end: net ≥ agreed →
agreed goes in, else what's there + the shortfall spread over the months left; P5 sliders) · Calendar (P4) · Table (P6 + year sheet);
Follow-ups = week strip on top + one list by day (Late, Today, each day), one search box, Paid · Other amount · Not yet in the list.

## v9.5 — 5 Nov night: Ali's phone test of 9.4 (9 points) — FIXED + 3 × 6 interface options WAITING FOR HIS PICK
Ali (5 Nov): "1. not all background colours work 2. agents: doesn't open the specific listing, keeps loading (Uber), the 3 buttons
down don't work, 'order my usual from Talabat' opens Talabat home and didn't ask what my usual is — suggest 6 options 3. month plan
shows ids (cmuu3u3sb2q4sd) — the category with its note; suggest 6 options 4. People & plans: on the date ask if the person really paid,
tick → revenue, other amount → the rest redistributed 5. Fit & Food still notifies 'log your dinner' 6. Recall has notifications only
until 29 Oct — fix for good 7. Follow-ups scattered — 6 options 8. green → burgundy on the light background 9. where is How to use".
He is "not inclined to accept anything" from the Gemini research for now (R-ideas parked).
- 1 + 8 `spaces.js` calmVars / calmCss: Settings → Theme now sets the .calm tokens (the redesigned screens had fixed colours, so only
  old screens changed). Burgundy added and made the default once (`v95` flag; a colour chosen later is kept); Money ledger (Yusr
  document) and the agent browser follow. Test: unit `v950theme`.
- 2 `NativeBridge.openInBrowser` (phone's own browser, CATEGORY_APP_BROWSER selector): exact listings (`openBest`) and apps not on the
  phone open there. AgentBrowser: "Open in my browser" on top; after 12 s not loaded it says so; Best offer / Fill my details always
  answer on the status line; Fill with no details → closes and opens Profile (Booking details). Order card (`OrderCard`) asks
  "What is your usual from {app}?" when none is saved, keeps it, Change edits it.
- 3 `planner.js` flexLabel / groupFixed (+ yearplan rows): name · usual note, never an id; "Maid × 4". Test: unit `v950plan`.
- 4 `regular.js` payPerson / notYet, `home.js` ask, `home-ui.jsx` PersonAsk: "Did Sheikh pay 2,500?" Paid · Other amount · Not yet;
  written in Money at once (income / expense); People & plans' pay box records without asking too. Test: unit `v950pay`.
- 5 Reminders.kt purgeLegacy (+ actions.js isLegacyReminder): the old repeating Fit meal / water alarms are removed for good. (The
  "Track your dinner" Ali saw in Recall is Yazio's own notification.) Test: unit `v950misc`.
- 6 PayListener: onListenerConnected keeps what is on screen, onListenerDisconnected → requestRebind; PayLog.mark/health/heal (every
  app open: quiet 3 h → rebind, then switch the component off/on, at most every 6 h); Recall shows "No notifications since {d}" +
  Reconnect (`ListenerNote`). Cause: Android stops delivering to a listener after an update / battery kill and never says so.
- 9 How to use is in the side menu again (`side-guide`).
- Options page (6 each, burgundy): https://claude.ai/artifact/1HJyhGHDsm5Ko9RXpK6ZrJ — A1–A6 Agents (rec. A1 results inbox), P1–P6
  Month plan (rec. P2 where the salary goes), F1–F6 Follow-ups (rec. F1 by day). **Build only what Ali picks.**

## Gemini's answer arrived (5 Nov 2026) — waiting for Ali's IDs
Ali uploaded the report (35 ideas R1–R35). Every idea checked against the code: **`RESEARCH_GEMINI_2026-11-05.md`**
(✅ built · 🟡 partly · 🆕 new · ⚠️ his decision). Claude's launch picks: R8 R1 R3 R15 R13 R9 R30 R27 R35 — mock-ups + how each is built: https://claude.ai/artifact/GaNgb3thF9dSYox2Pt1HkA Build only the IDs Ali sends.
Do anyway with the next build (objective fix): PayListener.kt skips Android's group-summary notification like ChatInbox does (R6).

## Waiting for Ali: the Gemini research (5 Nov 2026)
Ali asked for a prompt that tells Gemini everything about the app and makes it deep-research ways and features to make Attune better
and stronger; "if I like the idea, you implement". The prompt is **`GEMINI_RESEARCH_PROMPT.md`** (paste into Gemini Deep Research).
Gemini answers with ideas **R1, R2, …**; Ali sends the IDs he likes → build each (20 languages, tests, full suite, APK), like his
earlier picks. Check every idea against VISION.md principles and Play policy before building; say honestly if one can't work.

## v9.4 — 5 Nov late: Ali's agent picks G1–G7 BUILT + two fixes from his screenshots
Ali: "G1 ok but make the option to schedule a message — send this contact this message at 5 pm tomorrow — and it does that · G2–G7 ok ·
the most important thing is an easy, interactive, visually appealing, smooth interface, consistent across all agents, global, accurate,
easy results". (G8 was not picked — not built.) Then: "Offer 3 … very bad and confusing and does not open on the specific listing" and
"Translate → Document → Choose a file" only opened the File Converter.
- **Pure logic** `web-src/agents2.js` (tests: unit `v940agents`, 25 checks): waitingChats / draftPrompt / QUICK (G1 reply helper),
  parseScheduled (G1 scheduled message, EN + Egyptian Arabic, "I'm" kept), slotSites / slotState / parseSlot (G2 visa appointments: VFS
  `visa.vfsglobal.com/{from}/en/{to}/`, US AIS, TLScontact, BLS), restockDue / isRestock (G3, learns from Money's `ledger.v3` txns),
  returnDays / parseProtect / protectState (G4 price protection, message to the store), SPEC / clinicSites / parseClinic (G5: Vezeeta,
  Doctolib, Doctoralia, Doktortakvimi, Practo + Google Maps everywhere), parseTrip / tripPlan (G6 travel day, gate changes from
  notifications), autonomyIn / mayAct (G7 "only tell me" / "ask me first" / "by itself under 500" — never pays, only a store used before).
- **Cards** (agents-ui.jsx — all with the same AgentHead · CardActions · AgentRules): ReplyCard, SendCard + ScheduleForm, SlotCard,
  RestockCard, ProtectCard, ClinicCard, TripCard. Starters: the 6 most used as tiles + "More agents".
- **Android**: Reminders.kt `send` payload → ChatInbox.reply when Attune still holds the chat's Reply action, else a notification that opens
  wa.me/<phone>?text= (or the app with the text copied) — Play forbids Accessibility automation / SEND_SMS, so this is the honest limit.
  ChatInbox `seen` (onNotificationRemoved), AgentBrowser slot mode + refresh loop, AgentWatch "slot" checks with WebView cookies.
- **Hotel offers fix** (agent-kit.js): a layout without Booking's markers (its phone site) — the card climbs to the block holding ONE
  listing's own link (`listingLink`, `LISTING` regex for hotels/products), so the name, the lazy photo (`photoOf`: data-src, srcset,
  background) and the exact page come with the price. agents-ui Podium: an offer with no name and no page is a plain **date row**
  ("01/01 → 01/05 · 4 nights · EGP 42,124 · Hotels on Booking.com"), never an "Offer 3" story. Tests: e2e_v727agentkit (phone layout),
  e2e_v940offers.
- **Translate → Document**: "Choose a file" opens the phone's picker right there; the file goes to the converter set to Translate in the
  chosen language and starts at once (`window.__attuneConvertHandoff`). Test: e2e_v727translate.
- 120 new lines × 20 languages. Version 9.4 (versionCode 132).

## v9.3 — 5 Nov: Ali's round-4 picks BUILT (D1 A · D2 all · D3 A · D4 A+B · D5 A · D6 A · A2 A · A3 = Deal Check folded) + notifications → the day
Ali: "D1 A but the prayers not automatic — open them in Settings, this is a global app · D2 do all and make people choose · D3 A — does it
understand "from 1 December to the end of January, cheapest flights to Spain, 4 days go and return"? · D4 A and B, users choose · D5 A · D6 A ·
A2 A, choosable in Settings + a chat box · A3 wasn't that already Deal Check? · think again about the agents · read ALL notifications (WhatsApp,
YouTube, Instagram, SMS) to plan the day — offline, Play-safe".
- **Flights (D3 A)** `flights.js windowIn / stayIn / countryIn / windowDeparts / adviseBuy`: a WINDOW ("from 1 December to the end of January",
  «من ١ ديسمبر لآخر يناير», "anytime in December or January", "in February"), a trip LENGTH ("4 days" = 3 nights, "5 nights", "a week",
  «٤ ايام»), a COUNTRY ("to Spain" / «لاسبانيا» → Kayak gets MAD,BCN,AGP ± 3 days; Skyscanner the country "es"). Up to 8 departure days spread
  over the window, sites taking turns (Kayak · Skyscanner · momondo), each page labelled "site|day" → the board's **price-by-departure-day grid**;
  **Buy now / Wait** from the agent's own checks with its confidence. Tests: unit v930flights (23 checks).
- **Notifications → your day** `daynotes.js` (pure) + `yourday-ui.jsx`: the notifications RecallLog already keeps (on the phone, never OTPs) →
  who wrote today, what someone ASKED at a time (one tap → a reminder; "dinner at 8" = evening), what arrives today, other apps counted
  (Instagram 2 · YouTube 1). Each app can be left out (Settings → Your day). The disclosure card (notifask-ui) now says exactly what is read and
  that it stays on the phone; **privacy policy** gained two sections (Your day from notifications · Sharing Money with family), 20 languages,
  docs/privacy-policy.html rebuilt (tools/privacy_html.mjs), dated 5 Nov. Play: notification access needs the in-app disclosure before the
  Settings switch (done) + Data safety "processed on device" (see REVIEW_P7_play_launch.md).
- **Your day (D1 A)** `yourday.js` + Home's To-do card: prayers ONLY when on (Settings → Your day → Prayer times + city), agents' news (Needs you
  / Found), From your messages, and from the evening hour (default 20:00) **Close the day** — done today · left · **Move N to tomorrow** (keeps
  each reminder's time). `dayset.js` = the settings (all off by default except notifications for the day).
- **Ramadan (A2 A)**: Settings switch; during Ramadan the countdown to iftar / end of suhoor, "Plan my day around the fast" and a box to
  write anything (→ Chat asks it).
- **Widgets (D2 — all, people choose)** `TodoWidget.kt` (TodoWidget + ListWidget + WidgetTick), `widgets.js` / `widgets-ui.jsx`: "Attune · To-dos"
  (+ next prayer when on, + safe to spend when Settings → "Safe to spend on the Today widget" is on) and "Attune · A list" (Lists → open a list →
  Pin to the widget). Ticks on the home screen are kept by the phone and applied when Attune opens. **Kotlin not compiled here — check the APK
  build.**
- **Money for two (D4 A+B)** `moneyshare.js` / `moneyshare-ui.jsx`: Money → More → Share with family: some accounts (A) or all of Money (B);
  one file locked with a family code (like Family's file), sent through any app; the other phone "Joins" / "Opens an update"; the ledger merges
  it itself (new Yusr op **merge-share**, checked in yusr-bridge.js: accounts + entries by id, newer wins, "by" kept, gone entries leave, never
  zakat). The entry sheet says "Added by Mariam". Test: e2e_v930share (two phones).
- **Simple mode (D5 A)**: Settings switch → Home = five big buttons (Talk · Reminders · Money · Prayer (only when on) / To-dos & lists ·
  Medicines) + "Show the full Home". **First minute (D6 A)** `FirstMinute` in attune.jsx: language + country → "What should Attune do first?"
  (list · reminder · spending · price watch) → the example sentence, done through the Home box (`attune-box-say`). The old "Make Attune yours"
  questions (Onboard) are kept in the code, not shown at first run.
- **A3** — Ali was right: Deal Check had scam signs; it was archived 4 Nov to be folded into Money Guardian and the fold was never done. Done now:
  `scamcheck.js` (Deal Check's signs + message signs: fake links that wear a brand, "your account will be blocked", card/PIN, "my new number",
  parcel fees, easy-money jobs) + "Is this a scam?" on the Guardian page (paste or a screenshot read on the phone).
- **Agents, thinking again** — options published for Ali to pick: https://claude.ai/artifact/3Hwr6jBm2zhqoyPnturLA1 (G1 Reply helper · G2
  visa-appointment watcher · G3 restock · G4 price protection · G5 clinic finder · G6 travel day · G7 how much an agent may do by itself · G8
  one daily digest; recommended G1 G2 G7). **Waiting for Ali's codes.**
- Still from the research report: S1 code-split, S2 predictive back, S3 WebView early start, A1 model trials (do without asking).
- New tests: unit v930flights · v930daynotes · v930yourday · v930widgets · v930scam · v930moneyshare; e2e v930day · v930widgets · v930first ·
  v930scam · v930share; e2e_v3 follows the first minute. 128 + 4 new lines × 20 languages.

## v9.2 part 3 — 5 Nov: Ali's round 3 (receipts, agents, back, research) — DO THIS NEXT
Ali (with screenshots): "There was an option to add receipts" · "1. agents page are not ideal nor consistent and when it opens booking it doesn't
open it on the specific listing 2. make the back option more professional like Claude or ChatGPT 3. take 1 hour researching ways to make the
app better, smoother, better features, and the best ways of implementation".
- **Receipt** back in Add to Money (`money-pages.js receiptTotal / okPhoto`, `money-pages-ui.jsx shrinkPhoto + AddSheet`): photo → the phone's
  text reader → the TOTAL line (not subtotal / VAT / cash / change) fills the amount; the photo is kept on the entry (ledger add-txns,
  checked by `yusr-bridge.js`) and shown on it (TxSheet `tx-receipt`). Test: e2e_v922receipt.
- **Agents consistent**: every card — Scout and message alerts too — is `CardHead` (mark · name · line · status · ⋯) + `CardActions` (one
  row, one primary). "Open the best offer" opens THAT offer: `agent-rules.js offerUrl` (its own link + the dates / guests, else that hotel /
  product searched by its own name on the same site). Next check follows the agent's own hours (fixed "Invalid Date"). Tests: e2e_v922agents,
  unit v922agentrules.
- **Back like Claude / ChatGPT** (`attune.jsx TOP_PLACES` + `useBackDepth`): one control in the phone header — ☰ on a place of the side menu,
  ‹ on anything opened from inside or a sub-view (goes back one step); the chat shows ☰ + New chat only; the projects page's own "←" is
  desktop-only. Test: e2e_v922back.
- **Research report** (published for Ali): https://claude.ai/artifact/NxEchBFrTU4i87eTHbutQX — measured: 2.2 s to interactive at
  phone speed, 4.5 MB startup script (Arabic dictionary 668 KB always loaded). **Do next without asking:** S1 code-split (esbuild
  `--splitting` + `import()` for converter / slides / CV / guide-demo / fit-cuisines; Arabic loaded like the other languages; a test that
  fails if startup grows), S2 predictive back (MainActivity's OnBackPressedCallback enabled only when the page's back depth > 0),
  S3 WebView early start (keep only if timed faster), A1 model trials (Qwen3-4B-Instruct-2507, Gemma 4 E4B on tests/trials/max.mjs).
  **Waiting for Ali's letters:** D1 morning plan / evening close · D2 to-do widget · D3 flight day grid + buy-or-wait · D4 shared budget ·
  D5 simple mode · D6 first minute · A2 Ramadan on Home · A3 scam check.
- All round-3 lines in 20 languages.
- Found by the suite and fixed: **How to use search crashed** (the To-dos & lists guide of round 2 had no tip) — tip + sample data added,
  `searchGuide` tolerates a missing tip; **27 guide texts were English only** (the i18n audit doesn't read guide.js pairs) — all 20 languages
  now, and `tests/unit/v922guidelangs.test.mjs` fails if a guide text is missing in any language; a project's **Earlier chats** missed a chat
  saved just after the page opened (`chat.jsx` fires `attune-chats-saved`, `spaces-ui.jsx` re-reads); **`tests/run_all.sh` now reports a unit
  file that crashes** (it used to show its last PASS line — that is how v731guide hid the crash).

## v9.2 part 2 — 4 Nov night: Ali's picks BUILT (1A 2A 3A 4A 5A 6 = A + B, 7A), all 20 languages (165 new lines)
- **1A To-dos & lists** (Ali: "+ a part where I add my list and adjust whether it is recurring or not — clear and visible"):
  `lists.js` (pure: once / every day / weekdays / day of month / before a date (a trip, N days ahead); a new round starts with every
  box empty; an unfinished round stays on Home) + `lists-ui.jsx`: Home's **To do** card (late reminders in red, today's, open Mind
  to-dos — tick in place) and each list needed today; the **To-dos & lists** page (sidebar row under My life, "+ New list" editor
  with "Does it repeat?"). Said in the box / Chat: "make my travel checklist: …", "every Saturday: …", «كل سبت: …», "I'm travelling
  Thursday" / «انا مسافر الخميس», "what's my to-do list for travelling?" (cmdrun `type: "list"`). Computer Home too (desk-ui).
  Tests: unit v922lists, e2e_v922lists.
- **2A Agents**: one card for every agent (`AgentHead`: site mark · name · status · ⋯ Pause/Rules/Delete), grouped Needs you →
  Working → Done & paused, List | Board (Needs you · Working · Found · Done). **Logos instead of the word**: `agent-rules.js BRANDS`
  (drawn marks: Booking "B.", Agoda, Amazon, noon, airlines…) on the card and on an offer with no photo; an offer saved as
  "Booking.com" shows the hotel's own name from its text. **Rules** (Ali: "set any rules I want and it understands"): each agent has
  chips + "Tell this agent a rule…" — code reads stars, price, rating, walk (m/km, Arabic), breakfast / free cancellation / no
  hostels / new only, only / not a site or airline, check every N hours, direct / stops / bags / time / cabin; else the phone's model
  (JSON, cleaned by `cleanRules`). Offers are filtered by the rules; "check every 6 hours" reaches the phone (`watchPlan` hours →
  **AgentWatch.kt** arms the soonest; Kotlin changed — CI compiles it). Tests: unit v922agentrules, e2e_v922agents, e2e_v905deal.
- **3A Flight agent** (`flights.js`): "cheapest flight from Cairo to Jeddah around 8 January, back after 5 nights, direct, morning,
  under 12,000" (English / Egyptian Arabic) → a flight agent over **6 sites** (Kayak + momondo ±3 days in one search, Google Flights,
  Skyscanner, Expedia, Wego — links carry the conditions; idea from AWeirdDev/flights, MIT) read in ONE AgentBrowser window (rounds
  labelled by site). **Organised** (`FlightBoard`): the answer first (airline mark, times, stops, duration, price, the sites it was on),
  Cheapest · Fastest · Direct · Best time, the cheapest price per day, the rest one row per flight ("3 sites"). The conditions are
  the agent's rules. Tests: unit v922flights, e2e_v922flights. **Real sites not tried from a phone yet** — Ali's phone test.
- **4A Mind**: folders with counts + Recently kept + "See everything"; the wall only inside a folder; report, promises, your words,
  from your past, Recall in ⋯; a due promise stays on top. Tests follow (e2e_v68, v736mindwall, v748chat, v800mind).
- **5A Documents** (was Library; Ali: "a button saying Save in Chat, and then the chat knows the book"): no 3-way switch (hubs INSIDE
  pdfchat / remember removed); each file: **Ask** (the next question reads only it) and **Save in Chat** (booklib answerFrom).
- **6 Projects (A + B)**: the list shows progress, 4 starters (Study plan, A trip, Job hunt, Flat renovation — instructions + first
  tasks) + Empty project, and "Your assistants · n" / "Your skills · n" rows; inside, a **Tasks** row → a board To do · Doing · Done
  (‹ › move, commas add several); "add buy tiles to Flat renovation" in the box / Chat. Tests: unit v922projects, e2e_v922projects.
- **7A** "Saved" → **My things** «حاجاتي».

## v9.2 — 4 Nov late: Ali's 11-point phone list ("fix everything") — the objective fixes are BUILT, the design picks are WAITING
**(Ali's picks are BUILT — see v9.2 part 2 above.)** The mock-up page https://claude.ai/artifact/8SD1njQ1tiLadAFkAbXAHs (made
in the 4 Nov session; Claude's picks: 1A 2A 3A(+3B's calendar row) 4A 5A 6A+6B 7A). The questions:
1 Home to-dos + **repeating lists** (Ali: "the to-do / remind should appear on Home when due or not finished … recurring to-do lists
  … I'm travelling, it shows my travel list on Home") — 1A a "To do" card (late in red) + a list card on its day / 1B "Up next" one
  at a time / 1C a small board on Home. 2 Agents in **one pattern** (2A same card + "Needs you" first + List/Board switch / 2B board
  first / 2C inbox list). 3 **Flight agent** (Ali: "see the cheapest flight tickets with the modifications I want") — reference
  AWeirdDev/flights (MIT, Google Flights `tfs` link) read in AgentBrowser like the hotel sweep; 3A cheapest big + next best / 3B
  price calendar. 4 **Mind** ("so confusing and bad"): 4A folders + recently kept / 4B timeline / 4C ask first. 5 **Library**
  (its 3 buttons explained on the page): 5A one Documents page / 5B 3 clear names. 6 **Projects** list (Ali's screenshot was the
  EMPTY list, before design D reached his phone; Assistants = "Answers as", Skills = "Repeats" inside a project): 6A starters + your
  assistants / repeats visible, 6B a Tasks board inside a project. 7 a new name for **Saved**: My things / Memory / Keep / Vault.
  Ali's Trello question — Claude's real opinion (he agreed): a board only where things move through stages (Agents, a project's
  tasks); to-dos stay a list on Home; the computer shows boards full width.
**Built (all 20 languages, 26 new lines):**
- Home: no Fit & Food card / food quick button / food example / "what you ate" line (Fit is archived — `isRemoved("fit")`).
- Writing → Home bug: its Copilot / Prompt lab TABS opened archived pages (navTo falls back to Home). `hubs.js tabsFor` drops any
  archived / folded page from every tab row; `tests/unit/v734hubs` updated to v9.1 reality (it still asserted the archived tabs).
- Notes → **Shelf** again (tab, header, People / links source names). Tools: no second Library card; Writing card's text fixed.
- **Zakāt complete like the old ledger's tab** (Ali: "make sure the zakat is complete and has everything from the past"): the ledger
  (`yusr/index.new.html`) sends `zakat.more` in its snapshot (`zakatMoreFacts`: each pool on its own, livestock with its own ḥawl,
  paid vs due, closed years, the one question about debts, Ramadan) and takes 3 new ops `zakat-close` (closeZakatYear),
  `zakat-cert` (the certificate HTML → Attune's sharePdf), `zakat-debtpolicy`; `yusr-bridge.js cleanZakatMore` checks every field.
  Attune shows them (`money-pages-ui.jsx ZakatMore`). The madhhab shows its name ("Most scholars"), not "jumhur".
  **Real bug fixed in the ledger:** livestock head were counted as MONEY (zakatCashTotal, the ḥawl's running total, the cash pool).
- Agents: offers saved before hotel names / photos were read (every name = the site, no photo — Ali's screenshot) say so: "tap
  Check now" (`agent-stale`). The fix itself (CARD_SEL) shipped 4 Nov evening.
- Test: `tests/e2e_v922fixes.py` (Zakāt: debt question → ledger, livestock not money, 1 sheep due, paid vs due, close year →
  history → certificate, separate pools; Home no Fit; Writing no archived tabs; Shelf; Tools; stale agent).

## v9.0 part 9 — 3 Nov: Ali's screenshot "Checking 2 of 6 — it keeps loading different dates and doesn't get the lowest price"
- `AgentBrowser.kt`: a hotel window's start days are read until their prices stand still (same count + price twice, 6–25 s) — v8.7
  moved on after a fixed 8 s, before Booking had drawn its prices. Only the new day's own page is read (`pageRound`), never the last
  day's still on screen. After the sweep (up to 6 days), the days between the cheapest and its neighbours are checked too; at the end
  the window STAYS on the cheapest day with its best offer marked ("Cheapest of 8 dates: … — tap it to book"); Done closes it.
  The status line shows both dates and "Cheapest so far".
- `agent-kit.js`: "+EGP 4,120 taxes and charges", "Original price", "Save EGP 5,000" and CSS crossed-out prices are no longer offers
  (one was read as the cheapest); the card search counts only real prices, so a Booking card keeps its hotel name. Quiet reads don't
  scroll. Test: `tests/e2e_v727agentkit.py` (Makkah hotels page). 2 new lines × 20 languages.
- Then Ali: "display the best offer without opening Booking in a wonderful visual way … why does it jump, let me press Next" —
  he picked **B (top-3 podium + list)** of 3 options. Built: while the days are checked an Attune screen ("Finding the best offers
  for you…", progress bar, "Show the site") covers the website (it still loads underneath); the window then closes by itself and
  the agent card shows the 3 best on a podium (gold in the middle, raised; photo, price, days, walk, rating, "+2,100") and offers
  4–10 as a list; a tap opens one offer big with **Previous / Next** through all of them and **Book this offer** (only then the
  site opens). Photos: AgentBrowser fetches the 10 cheapest offers' pictures (360 px JPEG, data URL; skipped under the Offline
  lock) because Attune's own pages never load images from the internet (CSP img-src data: blob:); kept in `attune:agent-photos:v1`
  — on this phone only (SYNC_SKIP), never in the agent itself. Test: `tests/e2e_v830.py` (podium, list, photo, sheet, Next/Prev,
  Book). 7 new lines × 20 languages.
- Then Ali: the podium "looks like a cartoon … I want it much more visually appealing". Showed 4 mock-ups (A hero + carousel,
  B ranked list, C full-screen story card, A + C) — he picked **option 4, A + C**. Built (`Podium` / `OfferSheet` in agents-ui.jsx):
  no medals or emojis; the cheapest hotel big on its photo with a frosted-glass panel (name, days, walk, price, a night, Book);
  "Next best" photo cards scrolling sideways; a tap opens any of them full screen like a story (bars on top, Offer 1 of 10,
  name, days · nights · walk · rating, price, "2,100 less than the next" / "… more than the cheapest", ‹ Book this offer ›,
  swipe, Not this one). No photo → a calm colour field from the hotel's name. The card sits above the app's pop-ups (z-310).
  7 more lines × 20 languages (2 of the podium's lines removed). Test: `tests/e2e_v830.py`.
- **The 13 browser tests that failed on main are fixed (3 Nov night)** — found by bisect; 6 were REAL app bugs from the 2 Nov
  accuracy / referee work, each now with a unit test: (1) with no model, the referee's canUseAI() check opened Engine instead of
  answering ("book me a flight") → quiet api.aiReady; (2) "stop, just say yes" logged as soy milk; (3) "I ate a plate of koshari…"
  rewritten into Arabic as Franco; (4) "Geely Galaxy M9 vs Lynk & Co 900" / "iPhone 16 vs Galaxy S25" logged as Galaxy chocolate;
  (5) a car's "range" read as an orange; a "Give me the rent…" in a 2nd sentence recorded as 2 expenses; (6) "Lynk and co 900"
  recorded as a 900 expense (a car maker + a number, no spending word → a question). e2e_v542 follows Chat's instant meal log.
- **Ali picked A (3 Nov night): "strong code, the small model chooses the meaning, and if it's unsure it asks me"** — doit.js
  `doSure()`: a recording is SURE (instant, as before) with paid/spent/bought, a currency, a spending kind or paid service (lunch,
  maid, fuel, البواب…), ate/drank/a meal, or a sentence that is only food. UNSURE ("ahmed 500", "co 900") → chat.jsx: what this
  shape was before (understand.js `learnedKind`) → else the phone's model judges (3 s max, labels money-log / food-log / chat /
  unsure) → else, or with no model, a card "Which did you mean?" [Record it in Money | Log it as food] [Answer it]; the tap is
  learned for the same shape (another amount too). Tests: unit v911unsure, e2e_v911unsure. 4 lines × 20 languages.
  Also fixed: "remind me to pay electricity on the 10th" titled "pay electricity the 10th" (v860p2b, failing on main before).
- **Regional prices — Ali picked "3 tiers" (4 Nov)**: one global app (no separate Gulf version — the 30 country packs already give
  currency, VAT, weekend, holidays). billing.js `REGION_PRICES` / `regionPrices()`: high (Gulf, US, UK, EU, Canada ≈ $7.99 / $59.99;
  Saudi SAR 29.99 / 219.99, UAE AED 29.99 / 219.99, Kuwait KWD 2.49 / 17.99), mid (Türkiye, Malaysia, Brazil, Mexico, South Africa,
  Jordan, Lebanon ≈ $3.99 / $29.99), low (Egypt EGP 99 / 799, India, Pakistan, Indonesia, Nigeria, Morocco, Algeria, Tunisia ≈ $1.99 /
  $14.99); Business keeps EGP 14,999 / ≈ $299.99. The country = the one chosen in Attune, else the time zone, else the language.
  The yearly note is worked out ("≈ SAR 18 a month — save 39%"); the Play line names each country's carriers (a Saudi was told
  Vodafone / Orange / Etisalat). **ALI: copy `PRICES_BY_COUNTRY.md` into the Play Console** (made by `node tools/price-list.mjs`).
- **THE BRAND (Ali, 4 Nov): Attune = life planner / organiser + productivity with offline AI** — VISION.md (top), FEATURES.md
  (every feature, its use and verdict; Ali still decides the "DECIDE" rows — ask him before moving any of them).
  **Archived (Ali decided): Studio and Business** (+ Fleet & rentals, Site reports, Crane toolkit, Books, Shop, ERP, the business
  website) → `archive/studio/`, `archive/business/` (git mv, READMEs with the restore steps, the cut-out screens, their tests).
  `web-src/removed.js` hides their ids everywhere. Kept on purpose: the Fleet DATA layer (fleet.js, fleet-store.js…) so Ali's
  crane records stay in backups / sync until **Attune Business** (a separate product) exists. APK: the Studio picture engine is
  no longer built (workflow `if: false`); its Kotlin glue is dormant — remove it in a session that can compile Android.
  The web page went 7.05 → 6.10 MB and business-site.html (1.5 MB) is gone.
- **4 Nov evening — Ali's decisions for every FEATURES.md row, all built** (archive/README.md lists every folder): Fit & Food + Food
  photo + Cycle + the Health page → `archive/fit/` (→ Attune Fit; Chat no longer logs meals / water / weight / workouts / sleep —
  doit.js FIT_ARCHIVED, the full reader stays as understandAll; priced meals still go to Money); Scout FOLDED into Agents (no tab or
  menu; the bottom bar is Home · Chat · Money · Agents · Mind · All); Deal Check, Learn daily + Homework Coach, the Code page, Video
  tools, the prompt-tool pages, offline Maps + the Metro page, the Attune keyboard → archived. Chat now does "improve this prompt for
  Claude / humanize this / make this shorter" (prompttools.js) and "take me to X" → Google Maps (gomaps.js). Agents: real hotel names
  and photos on any site (agent-kit CARD_SEL), white text on photos in the light theme, Book / Open <site> → the site's own app
  (NativeBridge.openInApp, FLAG_ACTIVITY_REQUIRE_NON_BROWSER) else Attune's browser. How to use: the Work routine is Projects · Ask a
  PDF · Slides. index.html 7.05 → 5.27 MB. Full suite: 149 browser tests + every unit test pass.
  **Next:** ~~Ali's mock-ups for merging Artifacts + Assistants + Skills into Projects~~ (done, below); the job agent for the CV
  (fills the application, the person presses Submit); www/vendor still ships maplibre (unused now — drop it from build.sh).
- **4 Nov night — Projects design D (Ali picked D: "ask box + 4 rows"; he found tabs / one long page / a chat cluttered)** —
  `spaces-ui.jsx ProjectsPage`: a work opens on its emoji + name + due date, ONE big "Ask about this work" box (sends at once into a
  new chat of the work — chat.jsx spaceSeed `send`), then 4 quiet rows: **Files** (the old Knowledge) · **Saved** (artifacts made in
  the work's chats — chat.jsx puts `projectId` on the artifact, saveArtifact keeps it, `artifactsFor`) · **Repeats** (questions it
  asks again: every day / week / month / only when I tap; `repeatDue`, `markRepeatRun`; due ones marked on the row and in the list)
  · **Answers as** (pick an assistant or "Just Attune" + "What it should always know about this work" = the instructions). The
  project brain + chats sit behind one light "Earlier chats (n)" link; Delete moved into Edit (with a confirm). Assistants, Skills
  and Artifacts are FOLDED (removed.js FOLDED: no menu / hub / sidebar entry; the pages still open by id — "Make a new assistant",
  a pinned home-screen page). 27 new lines × 20 languages ("Saved items" = the row's noun, «المحفوظ»). Tests:
  `tests/unit/v912projects.test.mjs`, `tests/e2e_v912projects.py` (phone + computer + Arabic); e2e_v514 / v614skills / v734sidebar /
  v740projectbrain / v770chat follow the new layout.

## v9.0 part 8 — 3 Nov: "make sure the notifications reading is working"
- PayListener.kt (Android) read line by line: one-time codes never kept, only money-looking texts (the last 200, on the phone),
  the same notification updated kept once; then MessageWatch (alerts), ChatInbox, Recall, AutoRules.
- The page side (`paylog.js readNotification`, `deadlines.js fromNotifications`) with real-looking notifications — fixed:
  Vodafone Cash «استلمت 300 ج.م … رصيدك» was dropped as "balance only" (now +300); an Uber receipt "trip total: EGP 85.40" was
  not read (paytext.js: ride / order totals are paid); an Arabic bill due date had no name. Test `v920notifs` (payments, dates,
  and 10 that must NOT be payments: chats mentioning money, cashback, an order shipping, bills due, a renewal, an OTP, a balance).
- The Kotlin tests (tests/kotlin: Franco, LocalSync, WatchMatch, AutoMatch) RUN for the first time here: download
  kotlin-compiler-2.1.0.zip (JetBrains GitHub release) → `KOTLINC=…/kotlinc/bin/kotlinc bash tests/kotlin/run.sh` (run_all.sh runs
  them when kotlinc is on PATH). 2 stale WatchMatch tests updated: SMS is read unless switched off (Ali, 29 Oct) — the Message
  alerts sentence still said "SMS only if you switch it on" → corrected in all 20 languages. All 4 Kotlin suites pass.
- Also: bank / wallet SMS test `v919sms`; Fit targets `v917fittargets`; Home-box amounts `v918homedo`; Safe to spend `v914safe`;
  Scout ads `v916scout` («مليون و200 ألف» was 200,000); agent listing prices `v915offers`; the bank at 477 sentences.
- Real-model trial (Qwen3.5 4B, the phone model): tests/trials/max.mjs → 103/103.
- Photos (Qwen3.5 4B + mmproj-F16 from unsloth/Qwen3.5-4B-MTP-GGUF): receipt 3/3, the Arabic site note 2/3 — «الحساب 45000 جنيه»
  read as "000 4500". Now `photocheck.js`: after a photo answer, Chat checks every number against the phone's own text reader
  (ML Kit, `api.readText`); a number not in the photo → one line "Numbers in the photo, read by the phone: … — check them" (all 20
  languages). Test `v921photocheck`. (ML Kit's Latin reader reads digits even in Arabic photos.)

## v9.0 part 7 — 2 Nov: "99 percent accurate — always testing and fixing" (no cloud AI: Ali said no)
- Scoreboard `node tools/accuracy.mjs --show` over `tests/bank/*.json` (core, hard, langs = 306 real sentences, EN / Egyptian /
  Franco / 11 other languages) through the SAME readers as Chat (`tests/bank/route.mjs`): 100% can be right, 90% by code alone,
  the rest (other languages) settled by the phone's model. Test `v908bank` (every sentence must stay right).
- The model step with REAL models (`tests/trials/judge.mjs`, llama-server, the app's prompt + parser): Qwen3-4B 39/39,
  **Qwen3.5 4B (the app's phone model) 39/39, Qwen3.5 9B (Zenith, desktop) 39/39**. `judge.mjs all` = the model alone on all 306.
  Models are downloaded to the scratchpad (not in git): unsloth/Qwen3.5-4B-MTP-GGUF Q5_K_S, unsloth/Qwen3.5-9B-MTP-GGUF IQ4_NL.
- Fixed from the banks: 'give me tips to sleep better' → butter (doit request guard + fitread COMMON words never 'typo-fixed'),
  'school fees are due on 1 December' (deadlines: due on/by), '1250 / 5', "don't let me forget", 'I need a reminder', 'remind me
  what we said?' (not a reminder), 'what is the best phone under 15000?' (not a price watch), '1200 gym' (one payment unless it
  says it repeats or is a known service), 'my sister will give me 2000 every month', Franco 3aleha/3alaya, a price wish / a loan
  never spending, a statement with an amount is not a spending question; clearer rules in the model's prompt.
- More banks as tests: `v909times` (30 reminders, exact minute + repeat), `v910food` (meals read; everyday sentences never food),
  `v911moneyanswers` (10 money questions, exact sums, USD never mixed, the Egyptian week, custom categories by name).
- `v912plans`: People & plans numbers (partial payments re-spread, untick, overpay → 0) — found «أحمد عليه 12000 ألف كل شهر» read as
  12 MILLION (a digit number ≥ 1,000 + «ألف» is now "12,000, a thousand a month") and "my sister will give me 2000 every month"
  saved as a debt (now monthly income).
- The full test run found a regression of the Chat → Home-reader change: the marble riddle ("an empty glass … the coffee table")
  logged water + a coffee; «اوصف الونش في سطر» logged sugar («سطر» typo-fixed to «سكر»). doit.js: a long sentence (> 6 words)
  with no amount and no clear eat/drink word is never logged; «اوصف / لخص / ترجم…» are requests. Both added to the bank.
- `judge.mjs all` (the 9B model deciding all 310 alone, no rules): 89.9% — the rules + the model together: 100%. So the rules
  stay first; the model only settles what the rules leave open.
- Next areas for the same treatment: Zakāt, Safe to spend, Agents' offer reading,
  Scout's ad reading, translation, the photo readers.

## v9.0 part 6 — 2 Nov: launch plan, backup zip, the sentence bank (smarter Chat)
- `LAUNCH_PLAN_2026-12.md` — Ali: "make it perfect and really smart, deploy in 1 month max"; "ready = no mistakes" (Play account
  and the 14-day closed test come later, when he is ready). v1 leaves out the overlay orb, the keyboard and Video Downloader (the
  `play` flavor already does). The app's name in Egyptian Arabic = "Attune" everywhere (only the spoken «يا أتيون» stays).
- Backup zip sent to Ali (attune-backup-2026-11-02.zip, 306 MB): the code + `attune-full-history.bundle` (all 1,100 commits, 36
  branches) + README-BACKUP.md (what's kept for later, how to restore and build).
- **Sentence bank** `tests/unit/v908bank.test.mjs` (65 real sentences, EN / Egyptian / Franco) — it found and fixed:
  - "lunch 150", «غدا 150», "breakfast 80" (the examples printed on Home!) were not money in the Home reader (doit.js).
  - Chat never did what the Home box does: now `api.doKinds` / `api.doIt` — money in a few words, food, water, weight, a dose,
    a debt paid back → done in Chat with an Undo card (reminders, plans, dates keep Chat's own cards).
  - "buy me AirPods Pro 2 under 9000" was logged as 9,000 SPENT by the Home reader — a wish with a price limit is never money.
  - "15% of 2400" / «كام 15% من 2400» are calculations (calc.js), not a payment of 2,400.
  - Franco ("fakarny bokra el sa3a 9 akalem mama", "ghada 150", "Ahmed 3aleh 5000") → Arabic (`understand.js francoToArabic`:
    the Franco keyboard's dictionary turned around + ~120 command words) when the Arabic is something to do — Chat, Home, page boxes.
  - Next: grow the bank to 500 (all kinds, all languages), and "the electricity bill is due on the 5th" (no amount) → a deadline.

## v9.0 part 5 — 2 Nov: People & plans history + "all the languages correct and accurate — make sure"
- People & plans: a tap on a person (or a single loan's name) opens their whole history (`personhist.js` + `PersonHistory` in
  life-ui.jsx): owes you / you owe / got back / you paid back, every plan with them (tickable), each loan, each payment and the
  Money entries that name them (not a tick's own entry), newest first; their People card; phone Back closes it. Arabic sums in
  جنيه. Tests `v906personhist`, `e2e_v906history.py`.
- Languages: `tools/i18n/audit.mjs` audits the FINAL 20 dictionaries (placeholders, the language's script, left in English,
  Egyptian vs Fusha, EGP added) — now a test (`tests/unit/v907i18naudit.test.mjs`), 0 problems. It also lists short words used
  in more than one file (`tools/i18n/ambiguous.txt`, 307) — read for TWO MEANINGS; fixed so far (each meaning its own key, in
  20 languages): "Left" (money left to pay → «الباقي», was «شمال»), "Free" (planner: "Not planned yet", was «مجاني»), "Word"
  (glossary: "Word or phrase", was «وورد»), "Model" (Fleet: "Machine model"), "Background" (Spaces: "Background colour"),
  "Update" (Agents tag → "New"; Maps keeps «حدّث»), "Read" (button «اقرا»; the lesson's status "Finished reading"; Chat X-Ray
  "Which messages to read"). Arabic screens read (Home, Money, People & plans, Follow-ups, Health, Reminders): «وأتون» → أتيون,
  «ظبط» → «اظبط», two Arabic lines that dropped {n} / {t}.
- Open (ask Ali): the app's name in Egyptian Arabic is "Attune" in 124 lines and «أتيون» in 41 — pick one.
- Next for the languages: keep reading the ambiguous list and the Arabic screens page by page; the other 18 languages had the
  mechanical audit + the two-meaning fixes, not a native reader's pass.

## v9.0 part 4 — 2 Nov: "the Agents page takes a while to load" + "display the results in a better way"
- Slow page: it read the phone's whole app list (`appsList`: every app's name — slow on Android) before it could show anything;
  now only when a sentence needs it, kept for the session. Delivery notifications, the phone's checks and the plan sent to the
  phone run just after the page shows; the plan / delivery rules are sent only when they changed.
- Bug found on the way: every page open re-armed AgentWatch to "now + 12 h", so opening Agents daily meant background checks
  almost never ran. `AgentWatch.setPlan` keeps a planned round (`next` in prefs).
- Results display: options A / B / C shown (https://claude.ai/artifact/Df9Q99dC5a1qpapnus9Wye). **Ali picked "A and B in a smart
  way" — BUILT** (`agents-ui.jsx DealBoard`, pure `agents.js dealBoard`): the best deal big = the cheapest KNOWN store (a cheaper
  Facebook post / unknown shop is a line under it: "check the seller first"), how far under / over the limit, Open the listing,
  Not this one; then every store as a bar (cheapest first, bars start near the cheapest so small gaps show) against the limit
  line, each row opening its own listing. Bars only with 2+ offers, the line only with a limit. Buy agents show the bars under
  their "Found it" box. Hotels keep their own compare table (BestFound). Store names: facebook.com → Facebook.
- Ali: "for the running now make each one a different tab" — BUILT: one tab per running agent (+ each Scout goal, + Message
  alerts), a dot on a tab with news (found / under the limit / waiting for "Order it"); the chosen tab is remembered, a new
  agent opens on its tab, a tab with news opens first. Running count now includes follow agents.
- Ali: "the Arabic is stupid and wrong" (the watch card) — every Agents line in Egyptian Arabic re-read and rewritten (no
  «اتشيّك / الشيّك / بيراقب»: «آخر بحث امبارح», «بدوّر مرتين في اليوم», «البحث الجاي», «دوّر دلوقتي», «افتح صفحة المنتج»);
  prices in Arabic read "7,950 جنيه" (money() in agents-ui); «نازل 6%» instead of "(-6%)"; a price already in Arabic order is not
  wrapped left-to-right; "+150" kept left-to-right; the clean English name under his Arabic one (no "earbuds"); Arabic comma in
  lists. 10 buy-agent lines that no language had + 2 new ones added in all 20. Check: every Agents line exists in all 20
  languages (149 lines).
- Tests: `tests/unit/v905dealboard.test.mjs`, `tests/e2e_v905deal.py` (English + Egyptian Arabic, screenshots with SHOTS=).

## v9.0 part 3 — 2 Nov: "do the not done yet"
1. Arabic product names → English (`agent.js productEnglish`: ~150 brands, product lines, model words, kinds, units, colours;
   Arabic digits; "Galaxy S 24" → "Galaxy S24"). «سماعة هواوي فري كليب 2» → stores searched for "Huawei FreeClip 2 earbuds",
   matched as "Huawei FreeClip 2"; the card keeps his words (`said`) and says "Searching the stores as: …"; the web round also
   searches the Arabic name and Arabic listings count (`bestAcross` matches `said` too).
2. Follow agents (research that keeps going): "keep me updated on X every week", «تابعلي أخبار X كل أسبوع», "research X every
   month" — in all 20 languages (`understand.js followOf`: FOLLOW + EVERY words). First report now; then a repeating
   notification `agent-follow-<id>` (daily / weekly / monthly at 9:00, not in the Reminders list) → tap → Agents runs the round
   → Chat deep research "what's new about X since <last report>" (`agents.js followQuestion` — starts with the language's
   "Deep research" words, which `research.js wantsDeep` knows). Card: topic, how often, last / next report, Read now, Pause, Delete.
3. Kotlin compiled: a manual "Build the APK" run on the branch (workflow_dispatch builds only — the Play upload runs only on a
   push to main), run 41520853981.
Test `tests/unit/v904agents2.test.mjs`. All new lines in the 20 languages.

## v9.0 part 2 — 2 Nov: "look how stupid the app is"
- Chat: «Remind me on the last day of each month to pay interest for mom» was answered with THIS MONTH'S SPENDING (myledger.js
  `myMoneyIntent` saw "me" + "pay"). Now a reminder / alarm / "I need to pay…" is never a money question, and "the last day of
  each/every month", "end of the month", «آخر يوم في كل شهر», «نهاية الشهر» is a real repeat `lastday` (actions.js; next: 30 Nov,
  31 Dec, 31 Jan, 28 Feb — Reminders.kt `next` too). Title = "pay interest for mom". Label "Last day of every month" in all 20
  languages. Test `tests/unit/v902remind.test.mjs`.
- Ali: "the app is programmed to understand like that — I want it as smart as you". Options A (model reads everything first),
  B (code when sure, the model referees), C (a cloud model when online). **Ali picked B, "for all languages" — BUILT:**
  `web-src/understand.js` = the referee. Chat (`chat.jsx ask`, before the readers): each reader's yes/no (action, money-log,
  money-ask, calc, agent, deadline, life) + the words of each kind in all 20 languages (`LEX`: action, money-ask, research,
  agent). One kind a reader agrees with → at once (as before). Two kinds, or a kind only the words suggest (a Spanish / Hindi /
  Japanese sentence the en/ar readers don't know) → the phone's model picks one label (6 tokens, 6 s cap) and the pick is learned
  for that sentence shape (`attune:understand:v1`); no model / too slow → doing first (ORDER). Only the picked reader may answer
  (`ok(k)` on each branch); "research" turns on deep web research for that message. A reminder never becomes a money question
  (signalsOf drops money-ask next to action unless it ends with "?"); same guard on Home's box and in Ask your life (lifeask.js).
  Test: `tests/unit/v903understand.test.mjs` — a bank of ~90 real sentences in all 20 languages. Next: grow the bank with every
  sentence Ali shows that went wrong; C (a cloud model for Pro when online) can be added on top later.
- Test setup in cloud sessions: the browser tests need `bash tests/setup.sh` first (llama-server + tiny model + Python
  playwright); without it every e2e test fails with "No module named playwright".

## v9.0 — 2 Nov: Ali's 3 points (month card, agent links + notifications, stronger agents)
1. Home "Last month in one look" said "Most went on cmuu3u3sb2q4sd": a category id with no name. `monthreview.js` now names it
   with `catName` (his own category's name), else what was written on those payments, else "uncategorised"; `money-report.js
   catName` never shows a made-up id (`looksLikeId`). Test `tests/unit/v901monthcat.test.mjs`.
2. "Check now opened Amazon, not the exact listing" + "the notification doesn't open Agents":
   - every check keeps WHICH listing had the price (`addCheck`: href, name, site); "Open this offer" / "Open the listing" open
     the listing itself (`openBest` uses `o.href`; the in-app browser's offers always had it, the page ignored it).
   - AgentWatch.kt (Attune closed) reads each product card (name + price + its own link) and keeps the cheapest one that IS the
     product (`matches`: model numbers, no case/strap/ear tips; a price under 45% of the middle is dropped). Kotlin not compiled
     here — the APK build checks it.
   - notification taps: ids `agent…` → Agents, `scout-<goal>` → Scout on that goal (attune.jsx onShare, scout-ui sel).
3. Stronger agents (Ali: "Amazon, noon, Jumia, Google, Facebook — everywhere; get info from more than one source, neat"):
   - `agent.js storeTries`: EG Amazon · noon · Jumia · B.TECH · 2B · Raya Shop (SA: Amazon · noon · Jarir · eXtra; AE: Amazon ·
     noon · Sharaf DG · Carrefour; else Amazon + eBay). A NEW product with no store named ("tell me when Huawei FreeClip 2 is
     under 8400") is now a watch on all of them (used / cars / flats stay Scout). Buy agents search all of them too.
   - plus the open web: the app's own search (3 searches incl. site:facebook.com) → `webOffers` (price written next to the
     product, not a monthly instalment, not a video/forum) → `bestAcross` (exact product only, outliers out, cheapest listing of
     each store, top 5, each with its link). The card says "Searched N places" and links Google Shopping, Facebook Marketplace and
     Google to look by hand (those need a login / real browser — never read by the phone).
   - Research agent: "gather information on X", "research X", «جمعلي معلومات عن…», «اعملي بحث عن…» → Chat's deep research (web
     on: several searches, each page read one at a time, figures cross-checked, report with sections, tables and sources).
   - Test `tests/unit/v901agents.test.mjs`.
   Open: an Arabic product name («سماعة هواوي فري كليب 2») is searched as written — English store listings won't match it;
   idea for next time: brand names in Arabic → English (هواوي → Huawei) before the store search.

## v8.9 part 2 — 1 Nov: Ali's 5 fixes + option A (languages in separate files)
1. Maid payment → his Maid category (`regular.js catForCommitment`: the category he chose last time for that plan, else one of his
   categories whose name matches maid / driver / tutor / gym / internet…, else rent / bills). Test `tests/unit/v890maidcat.test.mjs`.
2. Watch (Health Connect, `Health.kt vitals`): asleep time = the sleep STAGES (light + deep + REM), like Huawei; sessions from two
   apps merged (never added twice); every page of records read; card shows "Last night X · Y a night over N nights" (`vitals.js`).
   Kotlin not compiled locally — the APK build checks it.
3. People & plans (`life.js`): gam'eya in English (people = months), "will give me", «ليا عند», «كل حد واربع» (several weekdays,
   `days` in `scheduleOf`), "my sister pays me 2000 every month" (money coming in), and a payment on an existing plan
   (`paymentOn`: «Ahmed paid me back 2000», «دفعت لأحمد 1000 من اللي عليا») ticks that plan instead of making a new debt.
   Test `tests/unit/v890life.test.mjs`.
4. Food photo: Ali's plate (chicken/omelette under creamy mushroom sauce + sourdough) was "Cream of mushroom soup 225 kcal" at 81%
   (measured here with the app's own two image models). 18 café dishes added to the table (`fit-foods.js`) and the photo names
   (`tools/food_clip_names.tsv` → the "Build the photo fast path" workflow rebuilds the bank on push to main; phones fetch it in a
   day); a sauce gives way to the dish served in it; the sauce's quarters count for that dish; bread at the side is added
   (`fitclip.js withBread`). Same photo now: Chicken in creamy mushroom sauce 525 kcal + bread 216 kcal. Test `v890photo`.
5. Barcodes (`fitdb.js byBarcode`): every spelling (UPC-A ↔ EAN-13, GTIN-14), a product with a name but no numbers gets numbers
   estimated from a same-name product (flagged), Open Products Facts for names, and a product the person logs after a failed scan
   is kept for that barcode (`rememberBarcode`, never evicted). Test `v890barcode`. (UPCitemdb skipped: its free tier isn't for
   commercial use.)
A. Languages: Egyptian Arabic stays in the page; each other language is `www/i18n/<id>.js` (build.sh) and shell.html loads only the
   chosen one before the app starts. index.html 24 MB → 7 MB, business-site 18.5 → 1.5 MB. Node tests call `registerDicts`.

## v8.9 — 1 Nov: all 20 languages finished (Ali: "all languages right and accurate in everything")
- Every interface language now has every line of the app (≈10,650 each): es fr de pt hi id ru it sw th vi zh ja ko fa ur bn tr
  translated and checked here; Turkish and Fusha (arb) came from Gemini (tools/i18n/back/) and were checked (placeholders, no
  Egyptian words in Fusha, airport codes kept). Workspace: tools/i18n/ (todo → out → `node tools/i18n/merge.mjs` → web-src/i18n-xx.js).
- Code fixes so the other languages really show: example chips (Scout, Missions, Watch, Ask your life, Automations, empty-page
  examples), map place chips, ready courses, planner categories, people sources, Money Report sources, Fit welcome, privacy page —
  all go through tr(); 49 date formats follow the chosen language (dateLocale()); right-to-left for every RTL language (arb, ur, fa)
  on Privacy, Books, Voice, Year plan (was Egyptian only).
- tests/i18n_all.py: shows which page each English text is on (`where`), ignores words that are the same in both languages
  (Hospital, Zakat, Python), ignores lines passed twice through tr().
- The 50 newest lines (privacy policy, weekday letters, Zakāt lines, examples; chunk 29, arb 32) were translated here too
  (1 Nov, Ali: "u do them") — every language now has 100% of the app. Nothing is waiting for Gemini.
- Size: index.html grew 12.6 → 24 MB with all dictionaries. Idea (ask Ali): load only the chosen language's dictionary.

- Tests fixed on 1 Nov (they failed on the 1st of a month, on old main too): e2e_v750money (sample payments get `ts`),
  e2e_v744bookspro (Cash flow on "All time"), e2e_v780business (this-month top customers), e2e_v727home (Home via the
  `attune-open` event). e2e_v517 has a flaky external 400 now and then (passes on re-run).
- Don't run tests/i18n_all.py and tests/run_all.sh at the same time: they share a port ("Address already in use").

### Do this next
1. (done) the 50 new lines.
2. Ask Ali (show options): load only the chosen language's dictionary, so index.html goes back from 24 MB to ~13 MB.
3. Then Ali's next list / VOICE_PLAN.md next step.

## v8.2 — 26 Oct: Ali's 17-point phone list (branch `claude/youthful-davinci-fe3400`)
Done and tested (unit `tests/unit/v820fixes.test.mjs`, e2e additions in `e2e_fithome.py` + `e2e_v727agent.py`, hub test updated):
Tools is its own place in the sidebar (`hubs.js` toolbox); Instant + Ask (classic) retired (`RETIRED` → Chat; shared photo → a new chat
with it attached, `\u0005` seed in chat.jsx; quick tile → Chat); Convert only in Tools; Ask a PDF card in Tools; hotel agent window +
stars + near (agents.js); installments sentence (life.js); cheese samosa / breadsticks + tap a food to see how it was read (fit-ui
ReadDetail); watch numbers per source + estimate from steps + WatchTop strip (Health.kt, fit.js); Speed switches dev-only; Scout reads
the ad page for its price; voice fallbacks (Voice.kt, Subtitles.kt, NativeBridge.listen waits for the wake word to free the mic);
"Slow screen …" lines in the log (attune.jsx PerformanceObserver); Your details (agent-ui.jsx: trips / daily life / booking forms,
`bookingLine` → every prompt via profileLine, agents use the trip prefs).
**Ali picked (26 Oct): 1A Follow-ups = one list by day · 2A agents plan then show the best 3 · 3A a Library page** (mock-ups in
`design/v82/*.png`). **BUILT as v8.3 (versionCode 125):**
  - 1A `timeline-ui.jsx` is Follow-ups' "All" (hubs.js INSIDE main = timeline; Money tabs = Money · Follow-ups · Deal Check; the switch =
    All · People & plans · Reminders · Dates · Chat X-Ray · Guardian); chips (timeline.js GROUP_OF), an Add box (= Home's doFromHome),
    a tick for people's payments (togglePaid + Guardian collected), Guardian findings on the list (timeline({guardian})).
  - 2A agent-kit.js `best()` returns `top` (3 offers with names); AgentBrowser passes it; agents.js `bestThree` / `planSteps`; the card
    shows the plan (✓ steps, next check) and Best 3 right now with Open it (Attune's browser, Fill my details) / Not this one (`skip`).
  - 3A `booklib.js` (passages from every book, the compare prompt, citations, "Where the books disagree") + `booklib-ui.jsx` (mode
    `booklib`, Students tab next to PDF chat, Tools card, "/"): several files at once, text kept in Ask a PDF's IndexedDB library
    (text only, no file copy), chat with follow-ups (searchText adds the previous question), tap a citation = the book's own words.
  Tests: unit v830library, v820fixes; e2e_v830.py (all three). Old e2e_v3/v4 Instant parts removed.
  - Ali (26 Oct, after 1A): "write what he actually paid and it reschedules the rest" → life.js `payAmount` (c.got[i]) + `rebalance`
    in scheduleOf (rest spread evenly over unpaid payments; paid early → done; still owed after the last → one more next month);
    `PayBox` (life-ui.jsx) asks "How much did Sheikh pay?" from People & plans and from Follow-ups' tick. Ali: "make each entry
    openable and put in a schedule" → life-ui Item has "Open the schedule" → a table (#, date, amount, status). (Regular = the maid
    keeps its day boxes.)
  - Ali: "books fast and smooth, writes, huge context" → booklib-ui streams the answer (onToken), keeps each book's index in memory
    (IDX), and "Read deeper" (booklib.js deepRounds → notesMessages per round → fromNotesMessages) for big questions.
  - Ali: "topics (History) + handle 20 GB + don't overload the model or the phone" → **BookShelf.kt** (NEW, needs the APK build to
    confirm it compiles): books.db = topics, books, FTS4 `chunks` (normalised Arabic/English, 900-char passages with book+page) +
    fts4aux `chunks_terms` (rare words first); BookIngestService (foreground dataSync) reads queued files/folders page by page
    (DocTools.pdfEachPage = PDFBox temp-file, never the whole file in memory; epub/docx/html/txt too), commits every 20 pages,
    resumes, waits while GenService is busy, stops on battery ≤15 % not charging (BookIngestService.resumeIfPending on resume);
    search = FTS MATCH (AND of the rarest 4, then OR) → BM25 from matchinfo('pcnalx') → best per book. Bridge: booksPick /
    booksState / booksTopic / booksRemove / booksSearch. Page: booklib-ui topics row, + Books / + A folder, live progress, per-topic
    chats, passages cut by `budgetFor(model ctx)`, Read deeper ≤ 8 rounds. Browser fallback = Ask a PDF's IndexedDB (topics in
    localStorage). Tests: e2e_v831books.py (phone path with a stand-in), e2e_v830.py, unit v830library. Also ask: does his Assistants page list "Crane expert"? (sidebar 5 = page 5 in tests).
Phone checks needed: voice (log now says "Voice … error N"), watch numbers after Refresh, Scout prices, and send the log after a
laggy moment ("Slow screen …" lines say where).

> **READ_SMS removed (29 Oct): Play Protect blocked the APK ("App blocked to protect your device") because the full build
> asked for READ_SMS. Never add READ_SMS / RECEIVE_SMS / call-log permissions to an APK Ali installs from a file.
> Ali: "fix that — but don't remove the feature" → "Bring in your old bank SMS" now reads an SMS BACKUP FILE (SMS Backup &
> Restore .xml, or JSON) — `smsfile.js`, `paylog-ui.jsx OldSmsCard`; tests unit v870smsfile, e2e v870sms.**
> **Ali (29 Oct): he tests the app first; ALL the Google steps (Gmail verification `docs/GMAIL_VERIFICATION.md`, Firebase
> invites `server/referral/README.md`, Cloud setup) wait until the version is ready for release. Don't ask him for them before.**

## v8.7 part 6 — Ali's 29 Oct phone list (5 screenshots) — ALL BUILT, tested
1. **Earned → a pie of where it came from**: Money Report's "Earned" opens a donut by source (the payer / note, else the
   category) — `money-report.js slices()` + `month.sources`, `money-calm-ui.jsx WhereItWent(income)`.
2. **A year plan like Excel**: Month plan → "The year": rows = income sources, fixed payments, savings goals, everyday spending;
   columns = Jan…Dec + the year; past months = what really happened, coming months = the plan; tap any cell to type over it;
   totals + "Free" per month; Excel download (`yearplan.js`, `planner-ui.jsx YearSheet`).
3. **The chat was "stupid" on Liverpool–Chelsea** (the score was in his notifications; Chat answered "Passage 1 mentions…",
   Your life answered "Found 10 things… Turkey"): `livefacts.js` — a score question is answered FIRST from the notifications
   the phone kept (by code, with the time and app); from the web, code reads the score most pages agree on and puts it first;
   an answer that only describes the sources is replaced by the pages' own lines; the web prompt says "answer in the first
   line, never describe the passages". Your life: a world question (score, weather, "now") goes to the chat with the web; its
   data search needs half the question's words (one shared word is not "about this").
4. **Recall free text**: synonyms for matches / weather / news / messages and every club in EN / Arabic / Franco; typos and
   cut words ("chelsy liverpol"); nothing with all the words → the closest, said so (`lookback.js`).
5. **Home is the chat** (agreed 24 Oct, v7.6): the separate "Chat" row is gone from the sidebar.
6. **SMS read, never one-time codes** (Ali: "we agreed"): the SMS switch is ON by default; SMS notifications reach Money,
   Recall, Message alerts; one-time codes are dropped on the phone. The APK Ali installs (full) can also **bring in the old bank
   SMS of the last 12 months** once (READ_SMS, `SmsInbox.kt`; they wait in Money's review list — never added by themselves).
   The Play build can't ask for READ_SMS (Google allows it only for the default SMS app) — new SMS still come via notifications.
7. **Gmail read by itself**: "Connect Gmail" (Overpaying check + Recall) → Google asks once (gmail.readonly) → the last year's
   money emails; then once a day, silently, the new ones → Overpaying, Money's review list (payments only), Recall
   (`GmailRead.kt`, `gmail.js`, `gmail-ui.jsx`). **Ali must do the Google Cloud steps in `docs/GMAIL_SIGNIN.md` first** (and add
   himself as a test user); until then Connect shows Google's error.
8. **Gmail for everyone, free** (Ali: "sign in with their accounts without paying"): Google's restricted-scope verification
   is free; the paid audit (CASA) is only for apps that put Gmail data on their servers — Attune keeps it on the phone
   (left out of Sync, Limited Use text in the card and the privacy policy). Ali's steps + texts + demo script:
   `docs/GMAIL_VERIFICATION.md`.
9. **Recall keeps messages forever** (Ali: "stay forever, with offline and online backup like WhatsApp"): `RecallLog.kt` is now
   a SQLite database (recall.db, migrated from the old 30-day list), ON by default; the page lists the newest 3000 and a search
   also asks the phone for older ones by words (`recallFind`, `lookback.js wordsFor`); "Forget everything kept"; turning it
   off stops keeping new ones (nothing is wiped). The backup file carries the messages (`backup.js withPhoneData /
   takePhoneData`). **Daily automatic backup** (`AutoBackup.kt`, `autobackup.js`, `autobackup-ui.jsx` in Backup & restore and
   Recall): a backup password (on this phone only) + a folder picked once with Android's picker — on the phone (offline) or
   Google Drive (online, no Google setup) → a locked backup every day when Attune opens, newest 3 kept; Gmail data left out.
10. **Write an email, check it, send** (Ali: "like Gemini"): "email ahmed@x.com that …", «ابعت ايميل لأحمد إن …», "/email" →
   the email card (To / Subject / Body editable; `emaildraft.js`, `email-ui.jsx`): **Open in Gmail** (Gmail's compose screen
   filled in — works now) or **Send** (gmail.send, after the Google steps; one email per tap). Nothing leaves before a tap.
11. **WhatsApp groups library instead of Chat X-Ray in the menu** (Ali picked design A — albums like Pinterest, search on top):
   WhatsApp → Export chat → Include media → Attune (a .zip, or the .txt + photos as several files — `WaGroups.kt`, read off the
   screen thread, photos kept ≤1600 px in files/wa/<group>, served at /wa/; ML Kit image labels + Latin text per photo,
   `play-services-mlkit-image-labeling`) → `wagroups.js` (items, kind: design / news / religion / recipes / other, albums:
   Rooms + Things, news Topics by month, Hadith Themes with narrator / source cards, "More", moves by hand, search) →
   `wagroups-ui.jsx` (library → group → album → full-screen photo, "Move to another album", "Money & promises in this chat" =
   Chat X-Ray). Storage: IndexedDB `attune-wa` (`wagroups-store.js`). A shared chat (with or without photos) now opens here.
12. **Add directly to the groups** (Ali: "the option to add directly to Attune also"): "+ Add photos or a note" in a group, "New
   group in Attune" (no WhatsApp behind it), and a second share target "Attune · Groups" (activity-alias ShareToGroups → photos
   kept in files/wa/_inbox → the Add sheet: which group / new one, a note or link, the album or "Let Attune sort it" →
   waAdopt / waSave). `wagroups.js addedItems / newGroup`.
Tests: unit v870wagroups, v870email, v870autobackup, v870livefacts, v870gmail, v870yearplan, v750moneyreport; e2e v870sms, v870gmail, v870yearplan, v727paylog.

## v8.7 part 7 — Ali's 29 Oct list of 8 + 10 screenshots ("finished that's all, fix all") — built, tested
**Waiting for Ali's picks (subjective, do not build before he answers):** https://claude.ai/artifact/11d8PjSAaYEgY5GFq1jZBR —
Board 1 the year plan (A one month at a time · **B goals first, recommended** · C sheet + fill a row), Board 2 agent findings
(**A winner + 2 runners-up, rec.** · B side-by-side table · C price by start day), Board 3 "all the app connected"
(**A Related chips on every item, rec.** · B one timeline · C when-this-then-that), Board 4 Books & pages vs Documents
(A clearer names · **B one Library, rec.**). Source: scratchpad `options-29oct.html` (not in the repo).
1. **Business fits the phone**: the hub's tabs got their side padding; each system card keeps its words full width (the pill moved
   under the line, a chevron on the side); a system's KPI labels wrap to 2 lines instead of "Visit fee (D…". `biz-ui.jsx`, `attune.jsx`.
2. **Voice / Chat know your people** (barber took 15 s, voice said "no access"): `personal.js` `personalAsk / mindAnswer` answer from
   Mind, Recall's kept messages and People & plans by code before any model (0.2 s). Voice uses it before small talk.
3. **Score "yesterday"** (Liverpool–Chelsea): notification look-back follows the time word (now 6 h, today 24 h, yesterday 48 h,
   else a week) and the web search adds `scoreQueries` ("A vs B score" …). `livefacts.js`.
4. **Agents**: Check now reads all start days in ONE window (`AgentBrowser.kt` rounds, every 8 s) — no flicker of 6 windows; the
   page shows a progress bar, a real browser user agent (Booking was blank), `intent://` falls back to the web, errors are said.
5. **Zakāt restored** (Ali: "worn jewelry … the other calculators, restore them all"): Money → Zakāt settings has every ledger
   field again (country, premium, madhhab, basis, niṣāb carat, worn jewellery, gold / silver kept, ḥawl, receivables, debts,
   accounts) and "More Zakāt calculators" (camels, cattle, sheep, crops, trade, rikāz, Fiṭr — `zakatcalc.js`, the ledger's rulings).
   **Gold price per country**: Zakāt page → "Gold today" card; "Live price" in settings; it refreshes by itself every 12 h.
6. **Assistants count** in the sidebar re-counts on every add / delete (`spaces.js` fires `attune-spaces`).
7. **Scout "how do I open the cheapest?"**: the "cheapest" number is a button that opens that ad.
8. **Books & pages vs Documents** answered (Board 4 above).
Tests: unit v870personal, v870zakatcalc, v870livefacts; e2e v870personal, v800moneysheets, v830 (one window, 6 rounds), v910design.
9. **Zakāt settings "in a good way"** (Ali, after the list): five sections — 1 today's gold price (country pre-filled from the
   app), 2 your school (the niṣāb fine points folded under one summary line + Change), 3 gold & silver you own (worn jewellery
   box), 4 your Zakāt year, 5 money & debts; Save stays at the bottom. `money-sheets-ui.jsx` ZSec / ZCheck / ZNum.

## v8.8 — 30 Oct: the connected memory (Ali: "chat should be very smart and connect everything together — not just names, everything";
## "add his contact and refer to him as X"; "when I say Ahmed it asks which Ahmed"; "read the notes I write"; "Attune noticed very very smart")
Agreed with Ali in chat before building (his answers: contact AND his own name; ask only when unsure; Saved → People; tap a name → card).
- **People cards** (`entities.js`, `people-ui.jsx`, Saved → People): your name for them, other names, role, phone contact via Android's
  own picker (`contactPick` in NativeBridge / MainActivity — NO contacts permission, Play Protect safe). Names in any sentence (EN / AR /
  Franco spellings folded: Mohamed = Muhammad = «محمد»; a role like "the barber" / «الحلاق» finds the card). «Which Ahmed?» only when two
  cards fit and the sentence doesn't tell; every pick is learnt. Same phone = one card. «Who is this?» lists names Money / notes met.
  The people already in People & plans and the voice's nicknames become cards once.
- **Connected memory** (`links.js`, `connected.js`): every item (Money, Follow-ups, notes, Mind, messages Recall kept, reminders, dates,
  goals, medicines, agents) on one list, marked with its people / 17 topics (wedding, Umrah, car, flat, repairs, school, health, travel…) /
  goals; `connect(question)` gathers everything linked, sums money and debts by code. Chat (code card at once, or the model gets the
  linked facts), Home's box («Which Ahmed?» card) and the voice (asks out loud, understands "the plumber" / "the first one").
- **Notes → Money** (`notesmoney.js`, `notes-money-ui.jsx`): "paid the plumber 300" / «دفعت للسباك ٣٠٠» in a Shelf / Mind note waits
  in Money → From your notes (Add / Not money); never twice (same amount within 3 days = already in).
- **Attune noticed, smart** (`insights.js`): rhythms (the barber every ~21 days → next due; a bill late), money owed for weeks, a topic
  far above its usual, a bill / person costing more, charged twice, a big one-off, a name written twice with no card, notes money not in
  Money, a goal behind its pace, an agent's find vs a goal. Ranked; the urgent one on Home, the top 5 in My report; ✕ = gone 30 days and
  that kind shown less after 3. Chat: "what did you notice?".
Tests: unit v880entities, v880links, v880notesmoney, v880insights; e2e v880connected.

**Ali's picks (29 Oct): 1B · 2 "A and B in a smart way" · 3 "I don't understand the logic" · 4B — BUILT:**
- **1B goals first** (`planner-ui.jsx` YearGoals, `yearplan.js` goalsOfYear, `planner.js` potIntent keeps the goal's own name —
  "Umrah", «العمرة»): The year opens on the goals; one sentence adds a goal spread over its months; a bar a month = what is left
  free (red = short); "short in Jun" / "on track" per goal; tap a month → its numbers to change (kept like the sheet's cells);
  "Sheet & Excel" opens the old sheet. Tests: unit v870plan, v870yearplan; e2e v870yearplan.
- **2 A+B** (`agents.js` offerFacts / compareOffers, `agents-ui.jsx` BestFound): the winner big with why (Cheapest · Closest ·
  Best rated · Under your limit ✓), each other offer says what it trades ("+2,100 · rated 9.4 · other days"), "Compare side by
  side" = a table (total, a night, days, walk, rating; the best of each row green). Test: e2e v830.
- **4B one Library** (`hubs.js`: Saved = Notes · Library · Mind; Library's switch Books & PDFs · One file · Attune remembers;
  `booklib.js` answerIds / setAnswerFrom / onTopic / libraryBlock; `booklib-ui.jsx` findInLibrary): each book has "Chat and the
  voice can answer from…" — not copied (books can be GB): Chat and the voice search only those books (BookShelf on the phone,
  docqa in a browser) and cite [Book, p. N]. Tests: unit v830library, v734hubs; e2e v831books, v746library.
- **3 (connected app)**: Ali didn't understand the options — explained again in plain words; waiting for his answer.

## v8.7 — Ali's answers to the nine reviews (28 Oct) — the plan with ticks is `ALI_LIST_2026-10-28.md`
Everything Ali said "do" is built and tested; everything subjective is on ONE design canvas waiting for his picks:
**https://claude.ai/artifact/WPVFc6FLsWecRwK8DxDtWS** (P5-A..G layout, V-A..D visuals, P3-7 the 3 hero jobs, P2-E, the money planner
screen A/B/C). Source of the canvas boards: the session scratchpad `canvas/project/*.dc.html` (not in the repo).
- Fixes: P1 (BP / sleep, bank loans, typos, negative, filler) · P6 (last Friday monthly, "expires next month", 10 % 3, renews on the 5th) ·
  P2-A..D (country + brain on first run, Engine recommended first, a waiting question answered by itself, model pill only on Chat) ·
  P7 the Play flavor (`play`: no overlay, no Video Downloader, keyboard later) · P8 stop-gap (`answerfix.js` egyptianize) ·
  P9 H-A..E (safe to spend from this month's income, open loans never late, one card per person, "paid today?", month review).
- P3 business (all but 7): trial from first use, Free = unlimited answers, outcome paywall, lifetime only at launch (LIFETIME_UNTIL),
  Business off the paywall, day-5 note (`trialuse.js`), «جنيه», STORE_LISTING.md, referral (friend's month; the giver's month needs codes).
- E: deep research = code reads the pages, the AI writes once (Pro/Master keep page notes) · money planner `planner.js` (+ «خطة الشهر»).
- P4, in Ali's order: share to Attune · morning card (`morning.js`) · home-screen box widget (`BoxWidget.kt`) · agents learn taste +
  price history · warm the model · "what Home didn't understand" log · one smart camera (`smartcam.js`) · Attune Saves · ask anything
  over your life · voice "what's left today" · **bills autopilot** (`bills.js`: usual day + median amount per home bill → Guardian
  "40% higher — check the meter", "hasn't come", morning card, «فواتيري») · **health from the watch** (`Health.vitals` in Health.kt:
  BP, SpO₂, sleep, resting HR, HRV, glucose, weight → `vitals.js`: week lines against the person's own usual, BP into Family health,
  sleep into Fit, Doctor PDF, morning card) · **family space** (`family.js` + `family-ui.jsx`, mode `family` in Follow-ups: shared list,
  who paid what + fewest transfers (Spliit's idea, MIT), reminders for the parents; travels as a file locked with the family code) ·
  **Home router** (`homeroute.js`, naive Bayes, 95 % on unseen sentences) in SHADOW mode — recorded next to "what Home didn't
  understand", not acted on until it is measured on Ali's phone.
- Still open: P4-16 cloud boost (needs Ali: a provider and a key) · P8 M-B who's-who pack (Wikidata is blocked from the cloud
  session → build it in a GitHub workflow) · P7 optional packs on first use (the 26 MB Python engine) · the giver side of referral.
Tests: `tests/unit/v870*.test.mjs` (p1, p3, p6, p9, plan, bills, vitals, family, homeroute) + e2e_v519 (research change) + harness
(trial / morning notes go to `S.sys`, not the person's reminders).

**Ali's picks from the canvas (28 Oct evening) — BUILT:** P5-A option 2 (no bottom bars: Money / Fit / Business / Shop / Books parts
are tabs at the top, the ＋ floats) · P5-B one back on Add food · P5-D labels ≥ 12 px · P5-G Western digits (`ar-EG-u-nu-latn`) ·
P5-F "Add your income" first step · V-A selected = soft green (`--c-soft` + `--c-acc`), orange/red only for late/warnings · V-B "Follow
my phone" theme default (spaces.js `resolveBg`) · V-C 3 radii (12/20/pill), chips not underlined links, Notes header · V-D empty states
(`U.EmptyStart`: Home, Money, Follow-ups; only when NOTHING exists) · P2-E option 1 sidebar in 3 groups with green headings ·
planner A (`planner-ui.jsx`, Money → Month plan) + yearly ("save 4000 a month" = 48,000 a year; goals with a total stop when full) ·
P5-C one box on every page (`U.PageBox`; Money's box falls back to Home's reader via `window.__attuneDo`) · P3-7 the 3 hero cards on
Home (`HeroCards` in home-ui.jsx). Desktop: reminders repeat like the phone (desktop/lib/reminders.js: monthly, last:N, days:).
**Waiting for Ali:** referral giver side — he asked "can it be linked to a Google account": yes (Google sign-in + a small Firebase
function that checks the friend's Play purchase and adds a month with Play's own `subscriptions.defer`, max 3); needs his Firebase
project + Play service-account key. Cloud boost: provider + key.

**Then ("Continue"), also built:** (1) **invite friends via a Google account** — `web-src/referral.js` + the card on the Plan
page (`InviteCard`), `NativeBridge.googleAccount` (Google's own screen, openid email), purchases carry a hashed account id
(`obfuscatedAccountId`), and the server `server/referral/` (Firebase functions + Firestore, after Google's Play Billing server
sample): each friend who subscribes = Play moves the inviter's renewal 30 days (`subscriptions.defer`) or 30 days wait in the app;
max 3. OFF until Ali does the 7 steps in `server/referral/README.md` and sets `REFERRAL_SERVER`. (2) **P7 Python on first use** —
the Play bundle carries Pyodide as an on-demand asset pack (`pypack/`, `PyPack.kt`, the workflow moves it before
`bundlePlayRelease`); Code shows "Download Python (26 MB)". (3) **P8 M-B who's-who pack** — `tools/know_sources.py build_people`
(per-country / per-occupation queries, sourced-only facts per Ali's Wikidata rule), catalogue entry `people`, built by
know-pack.yml (first run started 28 Oct). Known intermittent test: e2e_v518 fails only inside the full run (passes alone and in
sequence with its neighbours) — the exported business app's reload; not caused by the v8.7 changes (it failed before them too).

## v8.6 part 2 + the nine-persona review (28 Oct) — waiting for Ali's picks
Ali's points 6–10 done (meal info on tap, translator "hello" at once, Translate photo from the gallery, buy agents that come back
for confirmation and never pay, Home tells order / command / request apart and offers options). Then **nine personas tested the
app one at a time, hands-on** — each report says what was done, what was measured, what was fixed and what Ali picks:
`REVIEW_P1_sceptic.md` (60 days of money, to the pound) · `REVIEW_P2_normal_user.md` (+ an Arabic week typed on Home) ·
`REVIEW_P3_marketer.md` (+ the paywall on day 1 / 6 / 9) · `REVIEW_P4_innovator.md` (+ how close each idea is) ·
`REVIEW_P5_uiux.md` (accessibility audit, 10 tasks by tapping, visuals & colours) · `REVIEW_P6_logic.md` · `REVIEW_P7_play_launch.md`
(what only Ali can do before Play) · `REVIEW_P8_ai_model.md` (the real 4 B model: 21/29 alone; maths 5/5 with the app's code) ·
`REVIEW_P9_heavy_user.md` (a year of daily use: duplicate subscriptions, plans that vanished, طعمية read as water…).
Tests: `tests/unit/v860p1/p6/p8/p9/p2b.test.mjs` + the e2e files named in each report.
**Ali's choices waiting** (each report has options + a recommendation): SUPPORT_EMAIL in billing.js · P2-A..E · P3 points 1–10,
P3-A/B · P4 top 5 (10 → 1 → 11 → 3 → 9) · P5-A..G · V-A..D · P7 risks (Video Downloader, keyboard, overlay) · M-A..C · H-A..E.

## v8.6 — Ali's 27 Oct evening list, part 1 (he said "read this first, then I will upload more" — part 2 may follow below)
- [x] 1. CLAUDE.md rule (from a post he liked): **for unfamiliar features, don't write from scratch — first search GitHub for
      open-source projects, compare approaches, then start** (commercial-safe licence; name the project in the handoff).
- [x] 2. **Voice "fix it for good or remove it"** — his screenshot: «hello» was heard fine, then "I didn't get that" (with a ✓).
      Cause: anything that is not a command (send / remind / open…) went only to the Home box, which has no answer for chat.
      Now (`voice-ui.jsx` turn → `voice-talk.js`): small talk by code at once (hello / السلام عليكم / thanks / how are you, EN + AR),
      everything else → the phone's AI model (`ask` prop from attune.jsx = callChat, short spoken answer, last 8 turns kept,
      `forSpeech` strips markdown / lists / [n], ≤ 4 sentences), then it listens again (a conversation, like a call). No model →
      it says how to get one (commands still work). Arabic words → Arabic answer. Tests: unit v860fixes, e2e_v860voice.py.
      **Ali's phone decides** whether it stays; if he still wants it removed: hide `home-voice` + the wake switch.
- [x] 3. **Food: "I wrote homemade chicken pizza, it showed Chicken ranch pizza"**. (a) the table's `pizza-chicken` was named
      "Chicken ranch pizza" → "Chicken pizza"; (b) `fitread.js ownOf/named`: when the person's words say more than the table
      food's name (homemade, mum's, brand…), the item is NAMED with their words (Yazio-style) and the table food only gives the
      numbers ("Read as" shows which); (c) "something else…" is **free text**: it opens with his words, Enter / «Use "…" as I
      wrote it» → `fit.js writtenMessages / writtenItem`: the AI estimates THAT exact food (homemade / restaurant / brand /
      size; macros checked against kcal), kept as a food (`w:` id, DB.keepFoods + learnFix) so the same words are known next
      time; without a model the reader's nearest food under his name. "Search databases" is still a button next to it.
- [x] 4. **Watch always lower** (Attune 4,173 steps · 167 kcal · 3.1 km at 17:31; his Huawei at 18:03: 5,085 · 311 kcal ("Heat")
      · 4.40 km). 167 and 3.1 were both the old step estimate (70 kg, 0.75 m a step for everyone → 0.04 kcal a step; his
      watch counts 0.061). `fit.js`: `setWatchMe(profile, watchCal)` (Fit page + saved state) → stride from height
      (0.415 / 0.413 × cm), ~0.8 kcal per kg per km; Health Sync's TOTAL calories minus resting burn so far when active ones
      are missing; `learnWatch` learns the watch's own kcal / m per step from any day it sends them; **"Match my watch"**
      (`fitplus-ui MatchWatch`, under the watch card when numbers are estimated) — type what the watch shows once → his
      ratios (5,085 steps → 311 kcal, 4.4 km exactly). The steps gap (4,173 vs 5,085) is Health Sync's delay (the card says
      when the latest came; open Huawei Health / Health Sync to push it) — the direct Huawei link still needs his AppGallery
      App ID (`attune.hmsAppId`).
- [x] Part 2 (same evening): 6. tap a logged food → everything about it (fit-ui `FoodInfo`: name, amount, every nutrient,
      how it was read, Edit) + **HUAWEI_SETUP.md** (Yazio reads Huawei Health Kit directly; our HuaweiHealth.kt does the same once
      Ali registers in AppGallery Connect and puts the App ID in `attune.hmsAppId` — test-key SHA-256 inside).
      7. interpreter slow on "hello": `translate.js quickPhrase` (17 everyday phrases × 15–28 languages, by code, instant; no
      more «إلو») + the model is woken when the interpreter opens. 8. Translate → Photo: Take a photo · From the gallery.
      9. **Buy agents** (agents.js `buy` kind, `buyWhat / matchScore / pickBuy / takeBuyRound / buySteps`; agents-ui `BuyCard`;
      agent-kit `buy()` + offer links; AgentBrowser `buy` extra): "buy me AirPods Pro 2 under 9000" → searches Amazon + noon, picks
      the exact product (not a case, not the Pro Max), **asks** (Found it — Order it / Not this one) → opens the product, presses
      Buy now once, fills the details on each checkout page, stops at payment (never Place order / Pay).
      10. Home box: commands.js `shapeOf` (question / request / instruction / unclear / greeting), agent kind from parseAgent,
      up to 3 close meanings asked, "can't tell" → 4 choices (Remind me first when a time is said), one tap = do it, learned.
      11. **The 7-way review: `REVIEW_2026-10-27b.md`** (18 bugs fixed — first expense lost, USD for Egyptians, sugar 110 as food,
      appointments ignored, PS5 limit, oat milk, frappuccino, Fit's silent storage failure, USB-C price…; Play blocker fixed:
      "Report this answer" on every AI answer — **Ali must set `SUPPORT_EMAIL` in billing.js**). **Waiting for Ali's picks A–E**
      at the end of that file. Tests: unit v860fixes (+ v731doit updated), e2e_v860voice, e2e_v860report, e2e_v727agentkit (buy),
      e2e_fithome (homemade pizza), e2e_v748commands (one tap).
- [ ] Ali may send more — and his picks A–E from REVIEW_2026-10-27b.md.

## v8.5 — Ali's answer to the review (27 Oct): "A — but from reputable sites that hold the whole information, or YouTube; quality,
## not quantity" + "as per all your recommendations I agree"
- [x] Web A — `trusted.js`: TRUSTED sites per kind (vehicle: auto-data.net, ultimatespecs, ev-database, carnewschina = specs;
      hatla2ee, contactcars, yallamotor = Egypt price; topgear, autocar, carwow… = review; gadget + machine lists too).
      chat.jsx asks them first (`trustedQueries` → "site:auto-data.net Lynk & Co 900"), research.js ranks them first (+2, and a spec
      site may give 4 pages = 4 versions). Code builds **Specs by version** (`specCards`: one column per spec page, rows from the page's
      own "Spec | Value" table) and **Prices in Egypt** (`egyptPrices`), under the answer; the model gets `CARDS_NOTE` (overview, what
      reviewers say, pros, cons, which version, rivals — no tables). YouTube: `WebTools.videoReviews` (search "<q> site:youtube.com",
      captions via YouTube's app API, then the watch page) → NativeBridge `videoReviews` → api.webVideos → `videoPages` join the reading
      list. Tests: unit v850trusted, e2e_v850trusted.py. **Not tried against the live sites yet (no internet in the build box) —
      Ali's phone test decides; if a site's page shape differs, specCard's label regexes (factsheet ATTRS) are the place to adjust.**
- [x] Review picks (REVIEW_2026-10-27.md §B), hubs.js + attune.jsx:
      R1 "New chat" already opens Home (kept the empty chat screen for translate / call / assistants). R2 Recall = Mind's switch
      (INSIDE recall→memory). R3 Knowledge was already hidden (v7.9, developer only). R4 Crane only from Fleet → More.
      I1 zeros → a first step (safespend-ui `safe-empty`, guardian KPIs hidden at 0, Tools counters hidden at 0). I3 tab rows show a
      fade + "›" (hub-ui `hub-tabs-more`). I4 Missions example in the app's language.
      E1 Daily = Learn · News; **Go** = Travel · Scout · Metro · Maps. E2 Follow-ups: no switch; chips + "Open: People & plans ·
      Reminders · Dates · Chat X-Ray · Guardian" (timeline-ui `fu-pages`), a part page has "‹ All follow-ups" (`part-back`).
      E3 **Writing** = one box (writing-ui.jsx, mode `write`) → Improve / Shorten / Humanize open with the text and run.
      W1 Follow-ups its own sidebar place. W2 **Saved** = Notes (Shelf) · Books & pages (Remember) · Mind. W3 Students' **Documents**
      = Many books (Library) · One file (Ask a PDF).
      Sidebar: Money · Follow-ups · Business · Health · Saved · Agents · Tools.

## v8.4 — Ali's 27 Oct list (on v8.3) — DONE, waiting for his phone test and his picks
Review for Ali (walkthrough + options): **`REVIEW_2026-10-27.md`** (sheets `design/v84/walk-0..5.png`).
- [x] 1. Web search. Code fixes: `makers.js` (brand → maker + country; `makerNote` goes into the car prompt in chat.jsx carP,
      `fixMakerCountry` after fixModelNames), answerfix.js `EMPTY_CLAIM` ("prices are available" with no figure → dropped) + a last line
      cut mid-sentence dropped, research.js TPL vehicle table line clean, chat.jsx: a webEmpty answer gets tidy + fillBlanks + no
      fake [n]. Test `tests/unit/v840web.test.mjs`. **Waiting for Ali: Option A / B / C in REVIEW §C (recommend A: code-built tables
      from known spec sites).**
- [x] 2. Photos → PDF several photos: MainActivity pickFiles reads `clipData` (several picks reach the page).
- [x] 3. "22,000 total for 9 months": life.js `oneAmount` (total / each / unsure) + `withAlt` ("Did you mean:" both readings).
- [x] 4. Reminders free text on weekdays: actions.js `daysIn` / `repeat "days:0,2,4"` / `firstOnDays`; actions-ui free-text box +
      day chips; Reminders.kt next() handles `days:`. Test in e2e_v5.py + v820fixes.
- [x] 5. Voice: Voice.kt uses Google's recogniser by name when installed (`googleService`), and Android's voice popup as the last try
      (`usePopup`, MainActivity `voicePopup` launcher, manifest query RECOGNIZE_SPEECH); every step logged. Real cause still needs
      Ali's log if it fails ("Voice (…)" lines).
- [x] 6. Whole-app walk: 3 small fixes done (page names in the bar, Prompt lab name, Cycle "Instant" text); suggestions R1–R4,
      I1–I4, E1–E3, W1–W3 **wait for Ali's picks** (REVIEW §B).

## (done in v8.2/8.3) Ali's 26 Oct list, part 1 (v8.1 on his phone) — NOT FIXED YET
Ali's deal (26 Oct): **after every big change, update this file and push**, so if the session limit ends another AI carries on.
Ali said "read this first, then I'll upload more" — part 2 may follow below. Tick each item here when done.
- [~] 1. (v8.2: 'Slow screen <page>: froze N ms' lines now go to the log; in the browser at 4× slower CPU only start-up (1.2 s) and Money (0.25 s) freeze — need Ali's log after a laggy moment) **"The app glitches and makes the phone glitch a lot."** Clues in his log: one kill at **3680 MB rss** (24 Oct 17:36,
      LowMem) and 2409 MB (25 Oct), "excessive binder traffic during cached" (25 Oct 14:57 — something keeps calling the
      system while Attune is in the background: suspects = AgentWatch, WakeWord service, MessageWatch, appsList),
      LowMemQuick kill while a fg-service ran (26 Oct 15:40), React error #300 in Studio (hooks after an early return).
      Find what holds memory / spins in the background; measure, then fix.
- [x] 2. (DONE v8.2: runScoutGoal reads up to 8 new + 4 kept unpriced ads' own pages (readPage = fetchText); no price → «No price shown — open the ad» and −15 score) **Scout: most ads show no price** (screenshots: only 3arabyat has 1,250,000; contactcars / yallamotor / dubizzle rows
      have none) → "how will I know if it found something useful". Read the price from the ad page / snippet (contactcars,
      dubizzle, yallamotor, opensooq), show it on every row, say "price not shown — open the ad" when truly absent, and rank
      priced ads first. List pages ("12 Used Hyundai Tucson…") are not ads — show them apart or drop them.
- [x] 3. (DONE v8.2: speed-ui.jsx — NPU/GPU/MTP switches + their warnings only in developer mode) **Engine → Speed (speed-ui.jsx)**: "NPU could not be used", "GPU closed the app last time", GPU switch, Multi-token
      prediction switch. Ali: **make them work, or remove them so users never see them (and not in the notes either)**.
      Default plan: hide NPU line + MTP switch for normal users (developer mode only); keep GPU only if it works on his
      HONOR (SM8850 / Adreno 840), otherwise hide too.
- [x] 4. (part 1 DONE v8.2: window of dates → 6 start days, `starsIn` → Booking `nflt=class=4;class=5`, near → `distance=1000`, Check now runs every start day (AgentBrowser autoClose), card shows the cheapest days; `agents.js` bookingUrl/windowStarts/takeChecks. STILL OPEN: options for 'smarter agents') **Agents too basic / "too stupid"**. His sentence: hotel near Masjid al-Haram, under 45k, **4 nights between 10 Dec and
      29 Jan**, **4 or 5 stars**. Bugs found in `agents.js` ~line 148: two dates become checkin/checkout (40 nights, wrong);
      stars are not read; the Booking search is sorted cheapest instead of filtered by stars. Fix: "N nights from A to B" =
      a WINDOW → search every 4-night start in the window (or flexible dates) and report the cheapest that fits; read
      stars (4 or 5 / ٤ أو ٥ نجوم) → Booking `nflt=class=4;class=5`; distance to the Haram. Also he wants agents "complex
      and actually useful" — **subjective: show Ali 2–4 options** for what a smarter agent does (plan, multi-step, report).
- [~] 5. (checked: sidebar count and page both show 5 incl. Crane expert when Fleet is used — asked Ali) **Assistants shows 5 next to it but there are only 4** — find the count (hubs / sidebar) and count what is shown.
- [x] 6. (DONE v8.2: life.js PER_AMOUNT + lowercase names) **People & plans (screenshot 5)**: "sheikh owes me 22,000 to be paid in installments monthly for 9 months" only saved
      "owes you 22,000" — the installment plan (9 × 2,444.44 monthly, due dates) was lost. Fix the sentence reader
      (EN + Egyptian Arabic + Franco: "على 9 شهور", "قسط شهري").


### Ali's 26 Oct list, part 2 (more may follow)
- [x] 7. (DONE v8.2: hubs.js `toolbox` place + RETIRED=[instant, ask] → navTo sends them to Chat; shared photo → Chat with it attached (seed \u0005); quick tile opens Chat) **Tools becomes its own page in the left sidebar.** Remove **Instant** everywhere (tools list, Home, "/", hubs): normal
      Chat should do that job. Also remove **"Ask (classic)"** (`hubs.js:85`, `attune.jsx:7753`, the earlier Ask screen).
- [x] 8. (DONE: Ask a PDF card in Tools too; it also stays in Students) **"Ask a PDF" (PDF chat): where is it, how do I find it?** It is the Students hub (`hubs.js:13`: coach = Homework,
      convert, pdfchat, slides, cv). Make it findable (sidebar search / Tools page / Chat "ask this PDF"). Explain to Ali.
- [x] 9. (DONE v8.2: convert only in Tools; Ask a PDF card added to Tools) **Convert is duplicated** (Students → Convert AND Tools → Files & Converter). Keep it in one place only (recommend: Tools,
      and Students links there; or ask Ali).
- [~] 10. (options A/B/C in design/v82/followups.png — waiting for Ali) **One page for Follow-ups + Guardian + Reminders + Timeline + Dates**, organized and centralized. Layout is subjective:
      **show Ali 2–3 options first**, then build.
- [~] 11. (v8.2: fallbacks + log lines; needs Ali's phone) **Voice does not work at all**: not the transcriber, not the voice chat/call, not anything voice. Test every voice path on
      Android (mic permission, Whisper / STT model download, WakeWord service, TTS) and fix the root cause.
- [x] 12. (DONE v8.2: fit-foods breadsticks + cheese/meat sambousek, matchFood last-word rule + FILLER, fitread whole-name rule, fit-ui ReadDetail on tap) **Food from text**: he typed "4 plain bread sticks and 6 cheese samosas" → got "White cheese 180 g" + "bread stick 150 g".
      "Cheese samosa" became "white cheese" (wrong match; count 6 lost). Fix the matcher (compound dishes like samosa / sambousek,
      counts × piece weight). Also: **tapping an item opens it** and shows everything it read (the words it matched, the food
      from the pack, grams per piece, how the kcal was worked out).


### Ali's 26 Oct list, part 3 (his last: "that's all")
- [x] 14. (DONE v8.2, needs Ali's phone check: Health.kt reads each source alone and keeps the biggest number + lastAt; fit.js watchBurn/watchKm estimate from steps when the app sends ~0 kcal / km; WatchTop strip under the summary) **Watch numbers stale / wrong place**: Fit & Food showed 6,017 steps · 8 active kcal · 0.2 km after Refresh while the
      watch said 6,442 steps · 406 kcal ("Heat") · 5.74 km · HR 54/80/117. Burned calories must be at the TOP of Diary, and
      Refresh must pull fresh numbers (Health Connect read of today: steps, distance, active + total calories from Huawei
      via Health Sync — check which record types / time range we read; 0.2 km vs 5.74 km = wrong source or wrong range).
- [~] 15. (options A/B/C in design/v82/books.png — waiting for Ali; build on multidoc.js + docqa.js + recall) **Book library you can talk to**: upload e.g. 10 trusted history PDFs, ask anything; it reads them fast, compares what
      the books say, cites the book + page, says where they disagree, and you can keep chatting with follow-ups like a
      normal AI. Build on "Remember" (v6.46) + Recall (bge-m3 meaning search) — multi-book index, compare step, chat thread.
- [~] 16. **Whole app smarter and smoother** (ongoing; tie to item 1 performance work).
- [x] 17. (DONE v8.2) **Your details** (Ali, mid-list): Booking details expanded — trips / daily life / booking forms, private, used by answers + agents.

## Do this next
0. v8.8 connected memory is built (above) — Ali's phone test next; ideas to grow it: WhatsApp groups items in links.js (IndexedDB), places/things from Maps, reminders from «Attune noticed» rhythms (one tap).
1. Get Ali's picks from the canvas (v8.7 section above) and build them; then ask for his next list. Keep his rule: **ask before anything subjective** — show 2–4 options
   (`tools/render_mockup.py` renders a mock-up HTML with `data-screen` sections; see `scratchpad mock/round1.html` style:
   Quiet Atelier tokens, phones side by side, A/B/C with a recommendation).
2. Still to design (Ali's item 11 "fix the rest of the interface like Gemini would"): Settings, the sidebar, Privacy, and any
   screen not yet in Quiet Atelier — show options first, then build.

## v8.1 — 26 Oct: Money is Attune's own everywhere + «يا أتيون» (voice phase 3, option C)
- **Money (Ali: "it redirects me to the old app — I don't want that at all")**: no Money path shows Yusr's screens any more.
  `web-src/money-sheets-ui.jsx` = Attune's own sheets (account, bill, goal, debt + pay, Zakāt payment + settings, entry edit /
  delete, the full list with search, ledger settings incl. Tabs to show). Each change goes to Yusr (hidden, the engine) through
  the bridge's "do" message (`yusr-bridge.js` DO_OPS, `yusr/index.new.html` doOp) = Yusr's own forms and Save. Chat's
  "Add to Money" opens Attune's add sheet with the message as evidence. Tests: e2e_v800moneysheets (+ v790/v750/v713/v5/v4 updated).
- **«يا أتيون»** (VOICE_PLAN.md phase 3): WakeWord.kt (service, Voiceprint, QuietOrb), wake-ui.jsx (switch, teach your voice,
  QuietWake), assets/wake/*.onnx + config.json, tools/wake/ (how the model was trained, licences, numbers). Ali must test it on
  his phone and add the Play Console "foreground service: microphone" declaration before release.

## v8.0 — Ali's 25 Oct list (5 points)
1. **Yusr settings — answered (25 Oct): Ali meant "inside Yusr's own settings"** — they already are (Money → More → Ledger
   settings); his phone shows Yusr's old bottom bar = an older APK. Fixed on that screen: Tabs to show now drives Money's bar
   (`panesFor` in money-pages-ui.jsx, only after the person changes it — `db.ui.tabsSet`, since a new ledger starts with
   Accounts/Goals off), Notes/Invoices out of the list, 11 labels that had no words ("billsTab" on the Bills screen…).
   Earlier note: **"Put this in the settings in Yusr app"** (screenshots of Yusr's Customize / Tabs to show — old gold "Midnight" look with Yusr's
   own bottom bar, so probably the standalone Yusr app or an older APK): **asked Ali what he means** (see the chat). Fixed meanwhile:
   the "Show" checkboxes looked empty when on (`.field input` gave them `appearance:none` + full width) — `yusr/index.new.html`.
2. **Huawei watch "just opened the app"**: the Automatic tracking Huawei tile now says "Not connected yet" and shows the Health
   Sync steps (`HuaweiGuide`), or "Connect Huawei Health" when the direct Health Kit link is configured; ✓ only when Huawei data
   has really arrived (sources `com.huawei.health` / `nl.appyhapps.healthsync`). The direct link still needs Ali's AppGallery
   Connect App ID in `gradle.properties` (`attune.hmsAppId`) — see `HuaweiHealth.kt`.
3. **Studio paused on phones** (`device.js` `STUDIO_PHONE_PAUSED`, `studioPaused(native)`): out of every list / hub / group / "/"
   even with "Show every tool", its page says paused (`studio-paused`), `nativeCall("imagine")` is refused, Chat's "Draw it in
   Studio" card and lesson pictures are off. Photo editor (Eraser / Expand) unchanged. `attune:studio:try = 1` runs it anyway
   (the harness sets it so the old Studio tests still run). Flip the constant to bring Studio back.
4. **Slides quality** (his deck: AIDA titles, content not matching titles, title repeated as a bullet, 4 same-type slides):
   plan prompt asks for concrete titles from the topic (no bare framework stages), a comparison slide for "X and Y" topics;
   slide prompt: every point answers its title, general knowledge where sources are silent (numbers still only from sources);
   `tidySlide` drops title-only points / title leads and reworded repeats (0.6 overlap); a 4-slide deck gets one other kind;
   a plan far short of the count is asked once more. Unit `v1000fixes`.
5. **Agents page — BUILT (Ali picked A + "it must open any app I ask: Uber, Booking, Amazon, Talabat…")**: `agents.js` (sentence →
   open / do / watch / track / order / scout / alert, asks what is missing; app catalogue EN+AR + every launcher app via
   `appsList`), `agents-ui.jsx` (box, chips, cards, Check now, report). Android: `openAnyApp`, `appsList` (manifest `<queries>`
   LAUNCHER intent), `AgentWatch.kt` (+ receiver, BootReceiver) checks watched pages ~every 12 h with Attune closed,
   `agentWatchPlan/Take`; delivery = MessageWatch rule `app: "pkgs:…"` (WatchMatch); AgentBrowser `watch` extra returns the
   cheapest price. Sidebar places now Money · Business · Health · Shelf · Agents. Home box creates agents too. Country = Attune's
   saved country (country.js) → EGP / Talabat / Uber-Careem-inDrive. Tests `v1000agents`, `e2e_v1000agents.py`.
   Next ideas (ask Ali): Booking may block the background read (then the card says "tap Check now"); level-3 full phone
   control (accessibility) is still not done on purpose.
   Honest limits told to Ali: Booking/Talabat/Amazon have no public consumer API → watch by reading the pages on the phone,
   Talabat = one tap opens your usual and you press Order (no paying by itself), Amazon = read its notifications / emails.
- Tests: `tests/e2e_v1000fixes.py`, `tests/unit/v1000fixes.test.mjs`.

## v7.9 — Ali's 24 Oct phone list + design round 1 (all done, tested)
- **Camera**: "Take a photo" opens the camera (MainActivity `cameraIntent` → ACTION_IMAGE_CAPTURE into cache/camera via the
  FileProvider; `<queries>` IMAGE_CAPTURE). The WebView ignores `capture=` by itself.
- **Studio report crash**: hooks below an early return (also PayInbox). `tests/unit/v900hooks.test.mjs` scans every page.
- **Guardian "twice"**: shows the two payments (`f.txns`); "Charged twice" only when both have times minutes apart and neither was
  typed (`f.sure`), else "Same payment twice?" + *Logged twice — remove one* (`removeTxn`). Payments now keep `created` + `source`
  (Yusr add-txns, paylog appendToLedger); `alreadyIn()` stops a notification already in Money being added by itself.
- **Maid**: People & plans asks on her day with a real checkbox (`askToday`, `skipDay` "Didn't come"); "Saturday 600" is money now.
- **Scout**: essay sites in NOT_AD, `aboutIt()` (an ad must be about the goal), `samePlace()` (Arabic = English places), Home's
  "found N new" opens on the new ads. Design A: goal numbers, one row per ad (tap = details), "Select to compare" → `compareAds()` table.
- **Food photo**: `composeDish()` ("Cake" + "Mango" → "Mango cake"); search ranks foods with every word first (`rankFoods`, the pack
  ranked with the rest). Design B + slices: `fit-summary-ui.jsx` PhotoSummary (dish, ring, ½·1·1½·2, macros), `fit-summary.js`.
- **Code page**: "Your programs" above a 2-column grid; Build & test full width on a phone.
- **Knowledge**: in no list for anyone (dev tools stay in developer mode). **Booking details** explains itself.
- **Invoices → Business**: `yusr-to-books.js` copies Yusr invoices into Books once (posted, customers, receipts; totals match);
  notes copied into Mind (tag money). Flags `attune:moved:invoices|notes`. Nothing deleted in Yusr.
- **Hidden features**: Automations in Money → More; Recall row in Mind; Missions already on Home → My report.
- **How to use** (A + C): `guide-areas.js` (AREAS, SAY "You say → You get" for all 53 pages, tried = pages opened `markTried`),
  life-area cards with ticks, Try it / How, "See all features (A–Z)". `tests/unit/v900guide.test.mjs` fails if a page has no entry.
- **Automations** (A + many): READY rules (one tap), several of your own (one per line, `parseMany`), unique rule ids.
- **Money** (A): the bar is Yusr's tabs Home · Trends · Accounts · Goals · Bills · Zakāt (Attune draws it; Yusr's inner nav, + and
  Invoices button hidden by CSS in `yusrDocumentHtml`); every tab but Home shows Yusr's screen with the bar under it; floating +.
  The v7.6 Accounts/Bills/Zakāt pages are no longer used. More = Automations · Invoices (→ Business) · Full ledger · Settings.
- Tests: `e2e_v900fixes.py`, `e2e_v910design.py`, units `v900*`; updated v731guide, v731scout, v736scoutnight, v790money,
  v620knowledge / v727teach / v732packdl (open Knowledge directly), v722maps (finds the fuel search), v740artdata (waits per tap).

## Ali's 24 Oct requests, done in this chat (v7.6) — keep them
- **Home is the chat** (he picked A): New chat (sidebar and the chat's +) goes to the clean Home; the Chat · Your life ·
  Translate tab row and pages are gone — three pills in Home's box (`box-mode-chat|life|translate`, cmdbox-ui `BoxModes`).
  Your life answers under the box by code (lifeask-ui `LifeAnswer`); Translate sends a Translate-mode chat (seed `\u0004`) and
  links "Talk with someone, a photo or a document" to the Translate page (kept only for the interpreter / photo / document —
  not in any list). `navTo("lifeask")` → Home with the pill on. The chat's phone header has ← Home. Chat opens empty after a
  New chat (chat.jsx `HANDLED_SIGNAL`). Tests that tap New chat now reopen Chat with `attune-open {mode:'chat'}`.
- **Money's bottom bar** (he picked A): Home · Accounts · (+) · Bills · Zakāt (`money-bar`, `money-pages-ui.jsx`); + = the add
  sheet (expense / income / transfer, the account the person picked; the ledger's add-txns now accepts `transfer`);
  Lend/borrow, new bill, new account open the ledger's own forms (bridge `go` screens `debt`, `add-bill`, `add-account`).
  **More** (top) = Goals, Trends, Notes, Invoices, Full ledger (`money-open-ledger`), Ledger settings — these still open in the
  old ledger design (possible next step: rebuild them in the new design). Zakāt is only shown as the ledger's engine sent it.
- **Reminders page** fixed (Plan my day header, full-width date, repeat pills, Coming up first on a phone).

## Version history (newest first)
- **`main` = v7.8** (versionCode 120) — **Gemini step 6 (Tools) is built**: an on-device tool log (`web-src/toollog.js`, titles
  and numbers only, last 300; unit `v810toollog`) written by Writing (improve/compress), the Converter, Instant, Studio and the
  Video downloader. The Tools hub (`tools-hub-ui.jsx` ToolsHub): jobs this week / made today, the five families as cards
  (`tools-page-improve|convert|instant|studio|video`) with "{n} this week", recent outputs, "See all → Tools Report";
  Writing: five compact target chips + More targets, before (struck through) / after, Writing Report; Converter: recent files
  & results + Converter Report; Instant and Studio reports (Studio in a browser: `StudioOffDevice`). e2e `e2e_v810tools.py`.
- **`main` = v7.7** (versionCode 119) — **Gemini step 5 (Mind & learning) is built**: Mind's calm top (on a computer three
  numbers: everything kept, promises due, auto spaces) and "Do now" (the promise due today / late, with Done → state done);
  "See all → Mind Report" on a phone, the Mind Report beside the wall on a computer (kept this week by kind, promises due or
  late, most-used tags, things you forgot you have); Learn daily: the streak pill, today's lesson card, "See all → Learning
  Report" (days studied this month, quiz accuracy over time, learned, weak points, courses); Homework Coach: "See all →
  Homework Report" (this week, first-try %, by topic); Remember: the library's numbers; Recall: matched words highlighted and the
  on-phone index. Numbers: `web-src/learning-report.js` (unit `v800learnreport`), UI `learning-report-ui.jsx`, e2e `e2e_v800mind.py`.
- **`main` = v7.6** (versionCode 118) — Ali's 24 Oct requests (all decided by him, options A/A):
  - **Home is the chat**: New chat (sidebar, the chat's +) goes to the clean Home; the Chat · Your life · Translate tab row is
    gone — three pills in Home's box (`box-mode-chat|life|translate`, cmdbox-ui `BoxModes`); Your life answers under the box
    by code (lifeask-ui `LifeAnswer`); Translate sends a Translate-mode chat (seed `\u0004`) and links "Talk with someone, a photo
    or a document" to the Translate page (still there for the interpreter/photos, not in any list); `navTo("lifeask")` → Home
    with the pill on; the chat's phone header has ← Home. Chat opens empty after a New chat (chat.jsx `HANDLED_SIGNAL`).
  - **Money's bottom bar**: Home · Accounts · (+) · Bills · Zakāt (`money-bar`, money-pages-ui.jsx); + = the add sheet
    (expense / income / transfer through the bridge with the account the person picked — the ledger now takes `transfer`
    in add-txns; Lend/borrow, new bill, new account open the ledger's own forms via new `go` screens `debt`, `add-bill`,
    `add-account`); More (top) = Goals, Trends, Notes, Invoices, Full ledger (`money-open-ledger`), Ledger settings.
    Accounts / Bills / Zakāt calm + report (money-pages.js, unit `v790moneypages`, e2e `e2e_v790money`). Zakāt is shown only
    as the ledger's engine sent it. Fixed "-162% of it kept" → "Spent X more than earned".
  - **Follow-ups → Reminders** fixed: "Plan my day" no longer one letter per line, the date gets the whole row, how often is
    pills, Coming up first on a phone.
- **`main` = v7.5** (versionCode 117) — **Gemini step 4 (Business hub + Books + Shop) is built**: the hub opens with today's
  numbers (counter sales vs the same day last week, customers owe you + overdue, and on a computer "Needs attention": items at
  reorder + VAT), the three systems as cards with a status pill (Shop "{n} sales", Books "{n} low stock" / overdue, Fleet), the
  owner's systems with tables + "Updated today"; Books → "See all → Books Report" opens Reports on a new **Overview** chip (this
  month vs the same days last month, net margin, 6 months of sales vs purchases bars + profit line, ageing **not due · 1–30 late ·
  31+ late** (so overdue never hides in "0–30"), top customers & items, the month in short, CSV); Books is wider on a computer
  (max-w-5xl); Shop → "See all → Shop Report" (today, this week's 7 bars, cash drawer, staff on shift, payment-method donut, best
  sellers ×qty, staff & day closes, then the old hourly / by-cashier / returns). Two real bugs fixed: on a phone Business's bottom
  bar covered the Shop's own bar (CSS `body:has([data-testid=shop-app]) .att-hubbar` hides it), and on a computer the Shop's
  bottom bar sat under the sidebar ("Sell" unreachable) — Shop tabs are now pills under the title on a computer, with Report.
  Numbers: `web-src/biz-dash.js` (pure; unit `v780bizdash`), UI `web-src/biz-dash-ui.jsx`; e2e `e2e_v780business.py`.
- v7.4 (versionCode 116) — **Gemini step 3 (Chat) is built**: the empty chat is one quiet card (starters with a
  chevron); the "/" list opens above the Chat box too while "/" is typed (`SlashMenu` from cmdbox-ui.jsx; a command fills the box,
  an app opens), scrolling in its own box; answers sit in a quiet card (`chat-answer`) with Thought / "Checked by code" as pills;
  Assistants: cards with the icon and actions on top and the full name under (never cut); on a computer a tap opens the assistant
  beside the list (instructions, starters, what it learned, Start a chat) — on a phone a tap still starts the chat; Projects:
  each card shows chats · files · last change, a calm empty state; the sidebar has **Workspaces** (Assistants, Projects, with
  counts; test ids `side-ws-*`). e2e: `e2e_v770chat.py`. Chat.jsx: markup only (the "/" list is the Home box's own).
- v7.3 (versionCode 115) — **Gemini step 2 (Health) is built**: Health opens on a calm view (`health-ui.jsx`
  HealthPage): the box first (the SAME reader as the Home box, `doFromHome` — food, a dose, a period…, with Undo; "health
  report" opens level 2; the rest goes to Chat), Fit & Food today ("795 kcal left"), Family health (next doses with **Take**,
  "runs out" + I refilled), Cycle (kind words, never red; computer: Period started today · Calendar), "See all → Health Report".
  **Health Report** (`health-calm-ui.jsx` HealthReport, numbers in `health-report.js`, unit `v760healthreport`): calories vs the
  target for 7 days (above = amber, never red), weight with Fit's 7-entry trend, doses on time this week (later today not
  counted), water & workouts, the latest lab history, the cycle summary, Doctor PDF. Fit & Cycle colours now come from the
  tokens (macro bars, meal icons, water, period/fertile days); Fit's ring is amber, not red, above the target. e2e: `e2e_v760health.py`.
- v7.2 (versionCode 114) — **Gemini step 1 (Money) is built**: Gemini's "Area 1: Money" mock-up (Quiet Atelier,
  option C) is in the app on phone and computer, dark/light, Arabic RTL. Before: v7.1 (versionCode 113, commit `a02795c`).
- v7.2 in one page:
  - **Money opens on a calm view** (`money-calm-ui.jsx` MoneyCalm): the box (write "lunch 150, taxi 60" → logged by code through
    `logtext.js` + the bridge's `add-txns`; a question → answered from the ledger by code), Safe to spend (SafeSpend `card` /
    `inline`), the balance with the **accounts as pills** (filter the view; the chosen pill is the account the box writes to —
    the bridge only accepts an account with `byUser: true`), 2 totals (computer: 4 + one "Right now" card from the Guardian),
    3 latest, "See all → Money Report".
  - **Money Report** (MoneyReport): donut by category, weeks vs the target (budget ÷ 4.3), 6-month cashflow, Zakāt **only from
    Yusr's snapshot** (`zakatFromSnapshot`, never recomputed), the month's ledger, Excel (CSV with BOM) and PDF (`sharePdf`).
  - **Ledger** = Yusr itself, third level; it stays loaded (hidden) behind the calm view so the bridge, the box and Zakāt work.
    A shared/pasted payment opens the ledger (Yusr's own sheet asks for the account).
  - Numbers: `money-report.js` (pure, `tests/unit/v750moneyreport.test.mjs`) — mirrors Yusr's accountBalance; gold/silver/
    livestock accounts are not money; currencies never added together. e2e: `tests/e2e_v750money.py`.
  - **Money tabs = Money · Follow-ups · Guardian · Deal Check** (hubs.js INSIDE: Follow-ups = People & plans first, with
    Reminders · Timeline · Dates · Chat X-Ray in its switch; the Guardian is its own tab). Follow-ups ticks show month + amount
    (paid green, next due amber) with a progress bar; Guardian is two panes on a computer; Deal Check's reply card is jade.
  - The old computer layout `money-desk.jsx` (and `e2e_v727moneydesk.py`) is gone — phone and computer share MoneyTab now.
- **v7.1 = Gemini's design (Direction 2 "Quiet Atelier") on every screen**, light and dark, phone and computer.
- Version history this round: 6.49 (20 languages) → 6.50 (everything from the Home box, sidebar A) → 7.0 (calm Home + My report
  from Gemini's mock-up) → 7.1 (the whole app restyled).


## What Ali decided (do not ask again)
| Decision | What it means |
|---|---|
| **Direction 2 — Quiet Atelier** | warm stone dark / sage-white light, jade accent (`--c-acc`), terracotta for what is SELECTED (`--c-acc-2`), 22-px cards, Nunito |
| **Option C — two levels on every page** | a calm view opens first; its **Report** (the rich dashboard) is one tap away. Home → **My report**; Fleet → Calm view / Report |
| **Business visuals are a must** | Fleet, Books, Shop, built systems get the full dashboard quality in their Report |
| **A neutral app** | Attune must never look like a crane app. Cranes only inside Business: the Crane toolkit opens from Business → Fleet & rentals → More; crane built-ins (Crane expert, Crane hydraulics course, crane skills) show only to Fleet users (`industry.js`); everyday examples everywhere else |
| **Everything from the Home box** | Home = the box (attach · mic · send) + what runs + one Right-now card + 3 lines of Your day + "See all → My report". No chip rows. Commands appear only when "/" is typed; "/" also lists **every app** ("/money", "open fit", «افتح الفلوس», "my report", "/backup", "/plan", "/privacy", "/all") |
| **Sidebar = A** | New chat, search, **Money · Business · Health · Shelf**, the chats, model, Backup + Settings. "Attune" at the top goes Home |
| **Versions** | Ali asked for 7.0; this round ended at 7.1. Bump the version for each release (`app/build.gradle.kts` versionName + versionCode, `PAGE_VERSION` in `web-src/attune.jsx`; `tests/unit/v746version.test.mjs` checks they match) |

## How the design is built (for whoever changes a screen)
- **`web-src/ui-kit.jsx`** — the shared building blocks every screen uses: `page, card, cardPad, btnP, btnS, btnDanger, inp, area,
  muted, label, h1, h2, chip(on), tag(tone), Seg, Kpi, Row, Head, Empty`. Pills/buttons are ≥ 44 px.
- **Tokens** in `web-src/build/tw.css` (`.calm`): `--c-bg --c-surf --c-surf-2 --c-ink --c-mut --c-ln --c-acc --c-acc-2 --c-on-acc
  --c-on-acc-2 --c-soft --c-pos --c-warn --c-neg`. Text on jade/terracotta uses `--c-on-acc(-2)` (near-black in dark, white in light).
  The page look of `.calm` (background/colour/font) is in `@layer components`, so Tailwind classes on the same element win.
- App-wide palette (`spaces.js` PALETTES.calm / calmteal) = Quiet Atelier, so old slate/teal classes already render in it.
- `report-ui.jsx` (My report tiles + week chart), `home-now.js` `weekRhythm`. Money ledger (yusr/index.new.html, in a frame) gets the
  Quiet Atelier style injected in `yusrDocumentHtml()` (attune.jsx). Fit looks keep their own palettes in light mode only (`fitlook.js`).
- Gemini's original files: `fleet-ui.jsx` (its own code). Mock-ups Ali approved: step 1 (3 directions) and step 2 (calm Home,
  My report, Fleet calm/Report) — HTML files Ali uploaded; screenshots were sent in chat.

## Still open (ask Ali when the Gemini round is done)
1. Rebuild Money → More pages (Goals, Trends, Notes, Invoices) in the new design, like Accounts / Bills / Zakāt?
2. **Books → Settings → Appearance (Light/Dark)** does nothing now (Books follows the app). Hide it, or keep a separate Books mode?
3. **Fit's six looks** keep their own colours only in light mode; in dark Fit follows the app. OK?
4. Older: Family circle (A/B/C), sample data ("try Attune with a sample life"), feature names in `LANG_NAMES_REVIEW.md`, release prep.
5. Desktop two-pane Home from Gemini's mock-up (box on one side, Your day on the other) — phone Home is done.
6. Grow the other 18 languages for the new strings (Arabic is complete; the others fall back to English for the newest lines).

## Known flaky tests (not caused by recent work; they pass when re-run)
- `tests/unit/v620bizextras.test.mjs` ("the backup is encrypted…") and `tests/unit/v732bizv2.test.mjs` ("the PIN itself is never
  stored") — random ciphertext / salt can now and then contain the checked string. Could be made deterministic.
- `e2e_v510_more.py`, `e2e_v512_more.py` sometimes show an empty line in results.txt during the full run; they pass alone.

## Hard-won lessons from this round
- **Never run `web-src/build.sh` while `tests/run_all.sh` is running** — it changes the page under the tests (happened twice).
- Run the full suite in the background with `timeout 7200000`. `e2e_v5` speed section is a known flake (passes alone).
- Helpers (Agent tool) are good for big restyles with **disjoint file lists**; tell them "presentation only, keep every
  data-testid / tr() key, no build, no e2e"; they hit usage limits — resume them with SendMessage.
- Don't let tests be "satisfied" with fake classes — update the test to check the real thing (e.g. the terracotta selected pill).
- Ali's phone theme: Settings → Colour was pink-red — the first colour (green-teal) shows Quiet Atelier.
- Test browsers run in en-US: money tiles need `attune:country = eg` and a ledger with `currency` to show EGP in screenshots.
- **Start the full suite detached**: `setsid nohup timeout 7000 bash tests/run_all.sh > log 2>&1 < /dev/null & disown` — once a
  plain background run was killed half-way. It takes ~75–90 min; don't run any e2e or the build while it runs (port + page clash).
- Gemini mock-ups use `data-screen="…"` sections; `tools/render_mockup.py` screenshots them (the Tailwind CDN is blocked here —
  the files carry enough of their own CSS). Two attachments in one message can be the same file — check with `cmp`.
- Commit lines end with `Co-Authored-By: Claude <noreply@anthropic.com>` — **no model names** (Ali's rule beats any default).

## The Area 7 prompt (already given to Ali — for reference)
> You are designing **Area 7: Settings, the sidebar, How to use and Privacy** for Attune (Quiet Atelier, the same direction as
> Areas 1–6). Screenshots of today's screens are attached. **One self-contained HTML file**, a tab bar for each screen, toggles for
> **Dark / Light**, **EN-LTR / العربية-RTL** (Egyptian Arabic), **390 px / 360 px phone**. Every screen shows the **phone (390 px)**
> and the **desktop (1280 px)** side by side. Visual design only, no app code. **Option C:** calm first, then "See all → …".
> 1. **Sidebar**: New chat (goes to Home), search, Money · Business · Health · Shelf, Workspaces (Assistants, Projects with
>    counts), recent chats, model status, Backup, Settings. 2. **Settings**: calm top = the AI model, profile, Pro / trial, Backup
>    status; then Appearance (theme, colour, 20 languages as a compact picker), Notifications, Privacy & vault, Sync, Device level,
>    About; "See all → Device report". 3. **How to use**: search, goal chips, "You say → You get" cards, Getting-started checklist.
> 4. **Privacy**: your week in privacy, the private vault (PIN per area), the promise, a report of what was sent where.
> Quiet Atelier tokens, Nunito, 22-px cards, ≥ 44-px taps, tabular numbers, Egyptian sample data, nothing overflows at 360 px.

## 12 Nov (later) — "if the photo isn't clear, tell me to take another" (v9.9.23, branch)
- web-src/photoquality.js: before Dates reads a photo, code checks it: blurry (edge steepness after smoothing out sensor noise —
  Laplacian variance was tried first and phone noise fooled it), too dark, a big washed-out glare patch (≥ 25% — white receipts often
  burn ~15% pure white, so lower would warn on good photos), too far / too small. A banner says why + "Take another photo" /
  "Use this one anyway". A sharp photo with nothing readable → "I couldn't read this clearly — take a closer, sharper photo".
- Blur limit 20 from measurements on rendered ID cards (tesseract): σ ≤ 2 px reads 39–40/40 (sharpness ≥ 25.3), σ 3 px → 34/40 (≤ 19.8).
- Tests: tests/photoq/gen.mjs 10,000/10,000 + held-out 2,000/2,000; tests/unit/v9923photoq.test.mjs; tests/e2e_v9923photoq.py (EN + AR);
  harness doc_png() gives the older photo tests a real-size photo. 8 new lines in all 20 languages.
- Arabic-digit reader (for the Egyptian ID's front, which ML Kit can't read): trained a small model in the scratchpad; on fonts it never
  saw it read 16/200 numbers exactly, asked on 4, 180 not found, 0 WRONG — too weak to ship. Parked (not in the app). The Egyptian ID
  still works by typing the number (or the vision model) and is then checked by code.
- (later) Ali: "add the photo check everywhere applicable" → web-src/photogate.js (one shared sheet: why + Take another photo / Use this
  one anyway / Cancel) in Read it to me, Translate (photo), Timetable, Money (receipt), Family health (prescription + lab); nothing read
  → "take a closer, sharper photo". Not on Shelf covers, Mind memories, Recall / Scam screenshots, Chat pictures (not papers).
  Screenshots never refused: "dark" / washed-out only when the photo is also flat (contrast < 80); ≥ 70% pure white = a white page.
  Tests: tests/e2e_v9923photogate.py (5 screens, EN + AR); older photo tests now use harness doc_png / doc_bytes.
- (later) B5 N1 person page built (Ali's pick A, OK'd): sections, every line opens its original — see AUTOMATION_PLAN B5. Also fixed:
  rules saved in the same millisecond shared an id ("Switch on 2" lost one reminder — the flaky recipes test was this real bug);
  a follow-up whose every payment / time is ticked now counts as finished (links.js). Known gap: «رانيا» in Arabic doesn't match a card
  written "Rania" in English (no transliteration yet) — add the other spelling as a nickname on the card.
- (later) B5 P2 "before you meet" built (Ali's pick B) → B5 finished. v9.9.24 (versionCode 167). Next: B6 (X4 emergency card, X2 upkeep,
  X3 what I own, X6 kids & school; X1 business card → People card), then B7 travel, B8, B9.
- (later) B6 finished (X1 business card, X4, X2, X3, X6) — see AUTOMATION_PLAN B6. Next: B7 travel (TR1 TR2 TR3), B8 AU4, B9 N2.
  Lesson: never start a second full test run while one is going — they share ports and both fail.
- (later) B7 travel built (TR1 TR2 TR3) — v9.9.25 (versionCode 168). Next: B8 AU4 scheduled AI jobs (needs the night job), B9 N2 voice memo.
- (later) B8 AU4 built (aijobs.js — careful: jobs.js is the older "/" command queue; it was overwritten by mistake and restored before
  main). Fixed on the way: Urdu «جمعرات» turned morning times into evening (rules + jobs); the week plan hid your reminder when Attune's
  block shared its hour. N2 voice memo not built (99% offline not reachable) — told Ali.
- 13 Nov: v9.9.26 (versionCode 169) — phone rules (Ali's R1-C + R2-A): Bluetooth instant, charging / Wi-Fi within ~15 min, device from the
  paired list; Focus "make the phone quiet" (Do Not Disturb). Fixed: doit.js read "on Friday" from the phone's clock instead of the day it was
  asked (found because the test ran on a real Friday). Kotlin compiled on the branch (runs 43314448480, 43368561275). Left: place reminders
  (Ali's Play decision), emergency card on the lock screen, AI jobs at night while charging; N2 voice memo not built (99% unreachable).
- 13 Nov: v9.9.31 (versionCode 174) — **Attune understands every notification** (Ali: "comprehend and understand every
  notification like you would … make the models smarter and the coding smarter … no less"). web-src/notifmind.js: any notification →
  kind (34), why it was sent (11), what YOU must do (14), who, by when, amount, reference, urgency, one-line summary. Code first
  (app/sender catalogue + words in 10 languages incl. Egyptian, Fusha and Franco), sure only when nothing contradicts; the phone's model
  (notifmind-ui.jsx MindRunner, up to 15 a time while loaded) reads what code isn't sure of — told the kind, with definitions — and
  readMind drops any number / date / name not in the notification. Used by Recall search ("who asked me to send something"), Chat's
  context, Autopilot (a request in Russian → a to-do). Scores: 10,000 run (tests/notifmind/gen.mjs) right-when-sure 100%, sure of
  93.7%; held-out 60/60; held-out 2 (written last) 28/28 when sure. Real model Qwen3.5-4B (tests/trials/notifmind-qwen3.5-4b.md):
  code + model 100% / 97.2% on the held-out sets, 0 non-JSON, 7 invented numbers / dates caught, ~12 s each on 4 CPU cores.
  Lesson kept in merge(): letting the model overrule code everywhere made it WORSE (95% / 81%) — it only decides where code had no
  signal, a clash, or a language code doesn't read.
- 13 Nov: v9.9.30 (versionCode 173) — **smart notifications** (Ali: "understand notifications very well, not keep asking like a
  stupid … really smart"). Measured on the 10,000-notification run: before = 1,875 questions + 2,845 cards waiting for a tap; now = 0
  and 0, still 10,000/10,000 right and nothing wrongly made money. What changed: (1) questions only for money that may have moved
  from an unknown source and that nothing else handles — never future charges, failed payments, prices, appointment fees, cash on
  delivery, ride estimates, scams, chat talk, or something Autopilot already made a card for (notelabels.asksFrom); (2) Autopilot does
  what it is SURE of by itself from the start — a delivery's day, a bill due, call back, a request in a chat, a subscription, a shop's
  receipt (new: expense) — listed under "Done for you" with Undo; an Undo turns that kind from that app back into a card
  (autopilot.isAuto / undoDone → manual); (3) Money is sure of a bank's own words about YOUR account even without a payee name
  («تم خصم … من حسابك», "Salary … credited to your account", ATM withdrawals — paylog.codeSure + OWN_ACC); "Payment received … for
  your stay" is money OUT; an email's sender counts like an SMS sender (Vezeeta in Gmail = an appointment); (4) the phone no longer
  posts "What is this?" about chats (NoteAsk.maybeAsk off; teaching only when asked: Chat «علمني اشعاراتي»); (5) Travel: a booking
  with its code goes into the trip by itself with Undo. Held-out 60/60 + held-out 2 (written after) 28/28; tests/unit/v9930smart.
- 13 Nov: v9.9.29 (versionCode 172) — Ali's 2 screenshots: a Telegram news line was offered as "I found a stay · 11 nights" → a booking
  now needs a booking code or "your booking / check-in" words (tests/tr1/notbook.mjs: 10,000 news / chats / offers, old code wrong on 73%);
  the found card shows the words it read; every trip item opens (details + the message + app it came from + Remove from the trip);
  Plan my week / brain dump / focus got the theme background (they showed the To-dos page through them). AI jobs at night while
  charging built (AiNight.kt, see AUTOMATION_PLAN B8).
- 13 Nov: v9.9.28 (versionCode 171) — place reminders ring on arrive / leave in the APK installed by hand (Ali's P-2 + OK-2/3/4);
  the Play version says "coming soon" and never asks for background location; no separate explanation screen (OK-1 not picked).
- 13 Nov: v9.9.27 (versionCode 170) — emergency card on the lock screen; rule conditions (workdays / after / more than) checked on the phone;
  "A new fund" keeps the written name. Ali picked P-2 for place reminders (full APK first) — combined screen waiting for his OK:
  https://claude.ai/artifact/6WqaNahzA9dm66YpDgcB8m

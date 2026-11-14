## What the 1,000,000-case test found, and what was done

Every class below was found by the test, fixed in the app (or, where the TEST was wrong, in the test — said so), and is kept from
coming back by a unit test (tests/unit/v9938world, v9938answers, v9922mrz updated).

### In the tests themselves (found first, because it changes every number after it)
- **9 feature generators had broken random numbers** (a formula that loses precision in JavaScript): seed 9 gave 220 different values
  in 1,000, so "10,000 cases at 100%" was a small repeated set. Fixed with Math.imul (the same formula, exact). With honest cases:
  passports 87.6 %, brain dump 99.15 %, papers 99.98 %, Egyptian IDs 99.97 % — all fixed below.
- Egyptian IDs: the test used today's real date against its own "today", and expected one reason when a number had two problems.
- A3 made only 74,316 different sentences instead of 100,000; now exactly 100,000.

### Understanding what people type (part A)
- **18 of the 20 languages were barely understood by code** (Korean 18 %, Japanese 24 %, Persian 29 % … Spanish 65 %) for the six
  everyday orders — now 99.9 %+ (worldlang.js). Held-out phrasings written after the fix: 79.9 % at first → 99.99 % after general
  fixes (openers, "today/still" words, currency before the number, "X lent me", "bought X for N").
- Names in any script in a debt ("Иван owes me 900", "I lent 민수 400") were saved as expenses.
- "X always comes first" only worked for saved contacts — and the rule was saved but **never used**; now Home's "who messaged you"
  puts that person first.
- "What are my subscriptions?" had no answer; now from People & plans and Money.
- "Where did my money go this week?" answered «I don't know where the where did my money go this week is».
- A story around a payment ("7 meetings, then a cake for 780", "invoice 4999", "room 602") saved nothing or the wrong numbers.
- "Heads up at 7:30 am" lost its minutes; "… and don't let me forget to …" did only one of the two; "what's my taxis total" went to
  the AI.

### Features (part B)
- **Passports / ID cards**: 11 % not found (a second line with no "<"); 5.6 % "number checked" but wrong → now every look-alike
  combination must pass its own AND the whole-line check digit; G/6 and L/1 in the first place (no check digit can tell them apart)
  is filled in but asked about. Wrong-but-checked: 556 → ~25 in 10,000.
- Papers: "ends l Dec 2026" (a 1 read as l) was the end of December.
- Brain dump: Turkish / Korean lists with the verb last were split wrongly.

### Answers by code (part D)
- **"Who owes me money?" left out open debts** (Sara's 2,500 counted as 0) — in Home, the month review, a person's page and Chat.
- **"How much does Hany owe me?" answered with everyone's total** when Hany owed nothing.
- **"Remind me in 2 weeks" rang on 1 January 1970**; months too; "in 1 month at 8 pm" rang at 8 am.
- "You spent 150 EGP in today" / «في النهارده» → "today" / «النهارده».

### Journeys in the real page (part E)
- Franco "salaft ahmed 7350" (I lent Ahmed) was saved as a 7,350 expense.
- «صرفت 664 … لا استنى 581» (a change of mind) saved nothing.

### UI and UX (part C)
- **Set up your life and What Attune knows**: every "Do it" button was white on white and every ✓ invisible (outside .calm).
- Knowledge pack names and notices were English in 18 languages; «Your week» missing in Egyptian; Swahili «Chat X-Ray».
- Contrast under 4.5: the light warning colour, the computer empty-state text.
- Tap targets under 32 px: back ‹, the CV tab, a person's name link, the Coming toggle, short translated words («غيّر», «不对»…).
- Names for screen readers: book covers, the Knowledge switch.
- A screen opened from a notification stayed under the voice call screen.

### Left as they are, on purpose
- G/6 and L/1 as a document number's first character: asked about (a check digit cannot decide).
- "On 26 November at 2:30 pm" said after 2:30 pm that day: the app says "that time has already passed" instead of guessing next year.
- Hindi keeps tool names in English (Scout, Mind, Knowledge — 65 of them, consistently).
- The week starts on Saturday (Egypt) for every country — a choice to discuss, not a bug.
- 4 of 10,000 phone-rule sentences that stack three conditions; count goals ("read 20 books") need a new "+1" button → shown to Ali
  as options first (the mock-ups rule).

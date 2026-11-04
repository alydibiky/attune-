# Attune — every feature, one by one, and what happens to it (Ali, 4 Nov 2026)

_Read after `VISION.md` (the brand identity at its top). This page is the list Ali decides from. Verdicts are Claude's
recommendations unless marked **ALI DECIDED**. Rule (Ali, 4 Nov): anything removed from the app is **archived, never lost** —
its code is kept in `archive/<name>/` with a README saying how to bring it back, so one prompt restores it._

**The brand (Ali, 4 Nov):** Attune is a **life planner / organiser and productivity app with an offline AI** that understands
context and answers. On a phone it organises your day, money, dates, people and documents; on a powerful computer the same
model organises work: reads PDFs, sorts them, pulls out dates, tasks and amounts, and understands the context.

**Verdicts**
- **CORE** — this IS the brand; front and centre.
- **KEEP (tool)** — fits the organiser; stays, inside the right place (often merged with a neighbour).
- **DECIDE** — doesn't fit the brand as a standalone app; Claude's suggestion given; Ali picks (Labs / own app / merge / remove).
- **REMOVED → archived** — taken out of the app, code kept in `archive/` (**ALI DECIDED**).
- **REMOVE** — recommended to remove (risk or no fit).

## 1. The organiser — CORE

| # | Feature | What it does | Verdict / how it serves the brand |
|---|---|---|---|
| 1 | **Home / Today** | Right now, Your day, numbers, "Attune noticed", one box that acts in every app | **CORE** — the daily planner's front page |
| 2 | **Chat** | Answers, and *does*: records money/food, sets reminders, plans; the referee + "Which did you mean?" (option A) | **CORE** — the brain that understands context |
| 3 | **«يا أتيون» / Ya Attune (voice)** | Wake word, talk to the organiser, full-screen call, interpreter | **CORE** — hands-free capture |
| 4 | **Reminders** | Times, repeats, weekdays, "last day of the month" | **CORE** |
| 5 | **Follow-ups** | One list by day: payments, reminders, dates, Guardian | **CORE** — the to-do / agenda |
| 6 | **People & plans** | Debts, instalments, gam'eya, subscriptions, a person's history | **CORE** |
| 7 | **Deadline Radar** | Bills due, renewals, expiries, exams | **CORE** |
| 8 | **Month plan** | Money pots, the month's plan | **CORE** |
| 9 | **Missions** | A goal with a number and a date, broken into steps | **CORE** — goal planning |
| 10 | **Money** (Yusr ledger) | Spending/income by typing, accounts, bills, recurring, reports | **CORE** — money is part of organising life |
| 11 | **Money Guardian** | Late debts, double charges, price rises, subscriptions; "saved" counter | **CORE** |
| 12 | **Automations** | "When the salary arrives, put 20% in the car fund" from bank notifications | **CORE** |
| 13 | **Message alerts** | "Tell me when Ahmed messages me" (WhatsApp, Gmail…) | **CORE** |
| 14 | **Mind** | The wall of everything kept, filed by itself | **CORE** — the second brain |
| 15 | **Remember** | Keep a book / the news so Chat can answer from it | **KEEP** — merge into Mind |
| 16 | **Recall «افتكر»** | One search by meaning over screenshots, notifications, chats, Mind, payments | **CORE** |
| 17 | **Ask your life** | Questions about your own data | **KEEP** — merge into Chat (it already answers these) |
| 18 | **Projects** | Folders with instructions, files and chats for a piece of work | **CORE** — the work organiser (desktop centre) |
| 19 | **Ask a PDF / PDF reader** | Chat with a PDF or book, page cited | **CORE** — documents |
| 20 | **Library** | Several books, one question, passages from each | **KEEP** — merge with Ask a PDF into one "Documents" |
| 21 | **Family** | Shared list, family expenses, who owes whom | **KEEP** — organising a household |
| 22 | **Agents** | Watch a price, hotel window, find & buy (asks first), track a delivery | **KEEP** — "the organiser acts for you"; affiliate income (Booking/Amazon) |
| 23 | **Read it to me** | Point the camera at a paper: read, explain, turn into a reminder/bill | **KEEP** — paper → plan |
| 24 | **Chat X-Ray / WhatsApp groups** | Money, promises, unanswered questions from a chat export | **KEEP** — feeds Follow-ups (context from chats) |
| 25 | **Travel** (trip pack) | A trip's plan, documents, packing | **KEEP** — as a kind of plan |
| 26 | **Family health** | Medicines, doses, lab results, appointments | **KEEP** — health reminders are organising |

## 2. Documents & productivity tools — KEEP (tool)

| # | Feature | What it does | Verdict |
|---|---|---|---|
| 27 | **File Converter + Edit a PDF** | 80+ conversions keeping the layout; edit/sign/reorder a PDF; photo → Word | **KEEP** — documents |
| 28 | **Slides & Reports** | A .pptx / report from one sentence | **KEEP** — work output |
| 29 | **Writing** (+ Improve, Humanize, Compress) | Write, rewrite, shorten | **KEEP** — merge the four into one Writing page |
| 30 | **Translate** | Text, files, subtitles from any video | **KEEP** |
| 31 | **Shelf** | Notes inside books | **KEEP** — merge into Mind |
| 32 | **Artifacts** | Saved pages / outputs | **KEEP** — merge into Projects |
| 33 | **Assistants** | Experts you set up once (instructions + starters) | **KEEP** — work helpers |
| 34 | **Skills** | The person's own recipes for the AI | **KEEP** — merge with Assistants |
| 35 | **Instant** (quick tile) | Capture from anywhere | **KEEP** — quick capture |
| 36 | **My report** | The week/month in numbers | **KEEP** |

## 3. The engine & the platform — KEEP (infrastructure)

| # | Feature | What it does | Verdict |
|---|---|---|---|
| 37 | **Engine** | Install/run the offline model, speed doctor, heat, offline lock | **KEEP** |
| 38 | **Sync / Backup** | Wi-Fi between devices + the person's own Google Drive, encrypted | **KEEP** |
| 39 | **Privacy, Profile / Booking details** | What stays on the phone; the person's details | **KEEP** |
| 40 | **Country packs** (30) | Currency, VAT, weekend, holidays (Hijri, Coptic), emergency numbers | **KEEP** — global |
| 41 | **20 interface languages** | Egyptian + Fusha Arabic and 18 more | **KEEP** |
| 42 | **Plans & billing** | 3 regional price tiers (Ali, 4 Nov), trial, Pro codes | **KEEP** |
| 43 | **How to use Attune** | Goal gallery, guides with sample data | **KEEP** — rewrite around the organiser |
| 44 | **Desktop app** (Windows / macOS / Linux) | Same app, bigger models | **KEEP** — make Projects + Documents its centre |
| 45 | **Knowledge packs** | Offline databases (Quran, hadith, fiqh, cars, Q&A, science…) used by answers | **KEEP as answer sources**, hide the "Knowledge" app page (optional downloads) |

## 4. Doesn't fit the brand as its own app — DECIDE (Claude's suggestion)

| # | Feature | What it does | Suggestion / how to benefit later |
|---|---|---|---|
| 46 | **Fit & Food** (full Yazio-class app) | Diary, photo meals, plans, workouts, watch data | Own app later: **Attune Fit**. The organiser keeps a light health log (water, weight, sleep, meals typed in Chat) |
| 47 | **Food photo** (Home) | Calories from a photo | Goes with Attune Fit |
| 48 | **Cycle** | Period / fertility calendar, from watch temperature | Attune Fit (or keep as a small calendar) |
| 49 | **Scout** | Watches ads (cars, flats) with scam signs | Fold into **Agents** ("watch ads for…"); remove the standalone app |
| 50 | **Deal Check** | Real cost, market price, scam signs before paying | Fold into **Money Guardian** ("check before you pay") |
| 51 | **Shop in your pocket** | Shopping helper | Remove (Agents covers it) |
| 52 | **What you're owed** | Flight compensation and claim letters | Niche — keep inside Travel, remove the standalone page |
| 53 | **Learn daily / courses / Daily news** | A lesson a day, FSRS review, morning news | Own app later (**Attune Learn**); the morning card can keep a 3-line news brief |
| 54 | **Homework Coach** | Step-by-step homework help | Attune Learn |
| 55 | **CV / Resume, Job ready, Mock interview** | Build/tailor a CV, interview practice | Labs, or a "career" template inside Projects |
| 56 | **Code** (talk to a coder) + Python sandbox | Programs from a conversation | Hide the app; keep the sandbox (it checks calculations); maybe desktop-only Labs |
| 57 | **Copilot, Prompt lab, Improve a prompt** | Prompt tools | Remove from menus (power-user only) — keep code |
| 58 | **Maps** (offline country maps, directions) | 44 countries offline, turn-by-turn | Own app or Labs; plans open Google Maps for a place |
| 59 | **Cairo Metro** | Route, changes, ticket — offline | Keep only as a Chat answer ("metro from Maadi to Dokki"), no tab |
| 60 | **Life Simulator** | "What if" life scenarios | Labs |
| 61 | **Video tools** (subtitles, cut, slow replay) | Video editing | Subtitles stay in Translate; the rest Labs |

## 5. Removed / to remove

| # | Feature | What it did | Verdict |
|---|---|---|---|
| 62 | **Studio** (pictures on the phone, Honor-like photo editor, Eraser HD) | Image generation + photo editing | **REMOVED → archived (ALI DECIDED, 4 Nov)** — `archive/studio/` |
| 63 | **Business** (builder templates, client portal, Books, Shop/POS, ERP, Insights) | Company systems | **REMOVED → archived (ALI DECIDED)** — becomes the separate product **Attune Business** — `archive/business/` |
| 64 | **Fleet & rentals** (Ali's crane + warehouse ERPs) | Jobs, cheques, Store, profit per crane | **REMOVED → archived (ALI DECIDED)** — part of **Attune Business** |
| 65 | **Site reports** | Field reports | **REMOVED → archived** with Business |
| 66 | **Crane toolkit** (load charts, ground, slings, wind, lift plan) | Crane engineering | **REMOVED → archived** with Business (Attune Business for lifting companies) |
| 67 | **Video Downloader** | Downloads videos | **REMOVE** — downloading from YouTube breaks Google Play policy (the whole app can be rejected) |
| 68 | **Attune keyboard** | A keyboard with AI keys | **REMOVE (recommended)** — a keyboard that reads all typing is a privacy and Play-review risk |

## Ali's decisions (4 Nov 2026, evening) — ALI DECIDED
- **Sections 1–3: all kept** as suggested.
- **32 Artifacts · 33 Assistants · 34 Skills:** kept; Claude's advice: merge them into **Projects** (each project = files + chats +
  its assistant + its routines + saved results) — a design change, so show Ali mock-ups first.
- **35 Instant:** kept (quick capture from the phone's quick-settings tile).
- **46 Fit & Food, 47 Food photo, 48 Cycle → archived; they become the separate product Attune Fit.** (Attune keeps meals typed
  in Chat, water, weight, sleep, medicines as a light log.) What makes Attune Fit different from Yazio: Egyptian / Arab food as eaten,
  logging by one sentence or voice in Egyptian Arabic / Franco, the plate photo read on the phone, the meal's cost in Money,
  Ramadan, offline, family health — "better" must be proven with real users.
- **49 Scout → archived** (Agents does what it does). **50 Deal Check → into Money Guardian.** **51 Shop in your pocket → archived.**
  **52 What you're owed → archived as a page** (kept inside Travel).
- **53 Learn daily, Homework Coach → archived** (maybe Attune Learn later); **the morning news stays** as a short brief on Today.
- **54 Homework Coach → archived.**
- **55 CV / Resume, Job ready, Mock interview → KEPT.** Next: a **job agent** — finds jobs that fit the CV, Ali picks, it opens the
  page inside Attune and fills the application from the CV; **the person presses Submit** (LinkedIn forbids bots that apply).
- **56 Code page → archived**; its hidden Python sandbox stays (it checks Attune's own calculations).
- **57 Copilot, Prompt lab, Improve a prompt, Humanize, Compress → the pages are archived; Chat understands the same requests**
  ("improve this prompt for Claude…", "humanize this…", "make this shorter…") with the same tuned instructions.
- **58 Offline Maps → archived.** A place in a reminder / plan, and "take me to X" in Chat, open **Google Maps navigation** (it works
  offline when the area is downloaded in Google Maps; Attune can remind to download it before a trip).
- **59 Cairo Metro:** stays as a Chat answer only. **60 Life Simulator → kept as a "What if?" inside Month plan.**
- **61 Video tools:** subtitles stay in Translate; cut / slow replay archived.
- **Section 5: all removed → archived** — Studio, Business (+ Fleet, Site reports, Crane toolkit) done; **Video Downloader and the
  Attune keyboard** too.

## The product family (Ali, 4 Nov 2026)
- **Attune** — the life & work organiser with offline AI (this app).
- **Attune Business** — companies: Fleet & rentals (cranes, warehouses), Books, ERP, Shop/POS, client portal, site reports, crane
  toolkit. Sold to companies (Ali's own market). Code: `archive/business/` until its own app exists.
- Later, if wanted: **Attune Fit** (Fit & Food, Cycle) and **Attune Learn** (Learn daily, Homework Coach, courses).

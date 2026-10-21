# Attune — the vision and the roadmap (Ali, 20 Oct 2026)

_Read this right after CLAUDE.md, in every session. Every feature, fix and design choice serves this page.
The detailed decisions behind it stay in `ROADMAP_2026-10-13.md`; what is built is in `APP_HANDOFF.md`._

## The vision — in Ali's words
> "A global app that people can live with — that has all aspects of their life in it. Not competing with AI, but having
> AI, with very strong coding as the key, so the app does very hard, complex and useful things."

**In one line:** Attune is the app you live in — your money, health, food, work, business, learning, files, people and
plans in one private place, run by AI and made exact by code.
**بالمصري:** Attune هو التطبيق اللي حياتك كلها جواه — فلوسك، وصحتك، وأكلك، وشغلك، والبيزنس بتاعك، وتعليمك، وملفاتك،
والناس والمواعيد — في مكان واحد خاص بيك، بيشغّله الذكاء الاصطناعي وبيظبطه الكود.

## What Attune is — and is not
| Attune IS | Attune is NOT |
|---|---|
| A **life app**: one place for every part of life, all connected | A chatbot competing with ChatGPT or Gemini |
| **Code-first**: code does the work, the AI understands and explains | An AI that guesses numbers, dates or balances |
| **Private**: the data lives on the person's own devices (+ their own Google Drive, locked) | A cloud service that collects data |
| **Global**: the same core everywhere, each country as packs | An Egypt-only app (Egypt and Egyptian Arabic stay first-class) |
| **For people AND businesses**: a person's life and the company they run | Only a personal organiser |

## The six principles (the test for every feature)
1. **One life, connected.** Every part feeds the others. Say it once on Home — it lands in every app it touches (a meal
   in Food AND Money; a crane job on Today; a goal pulls from Money, Fleet and Learn). A feature that stands alone is
   not done.
2. **Code first, AI second.** Code reads the data, calculates, checks and builds; the model understands what the person
   means and writes the answer. Sums, VAT, balances, calories, load charts, dates: always by code, always exact.
3. **Private by design.** Questions never leave the device; data syncs only to the person's own Drive, encrypted on the
   device. Every connection is shown (Privacy → Your week).
4. **Simple on the surface, deep underneath.** A first-time user sees one box and their day; a power user finds a full
   ERP, Books, a builder, Studio. Depth never makes the first screen harder.
5. **Works on every device.** Each device does what it can really do (a weak phone: light models, code does more; a
   strong phone or a computer: everything). Phone AND computer layouts for every screen.
6. **Reliable before new.** A life app is trusted only if nothing is lost and nothing is wrong. Ali's bug list comes
   before new features; every release passes the full test run.

## The areas of a life (what "everything" means)
| Area | Today in Attune | Grows into |
|---|---|---|
| **Home / Today** | One box acts in every app, the Today line, Missions | The daily centre of a person's whole life |
| **Money** | Safe to spend, auto-tracking, People & plans, bills, Deal Check, Overpaying | A full personal finance system, every country's banks and wallets |
| **Health** | Fit & Food (photo, barcode, Egyptian foods), Family health, Cycle, watches | A complete health record for the family |
| **Work & Business** | Fleet ERP, Books, Shop, the builder (any business from a sentence), client portal | The operating system of small and medium businesses worldwide |
| **Mind & Files** | Mind wall, Recall (by meaning), Shelf, PDF, converter, Projects | Everything a person knows and keeps, findable in a second |
| **Learn** | Courses, Coach (homework by code), languages | A personal school for any subject, any age |
| **Create** | Chat, Studio + photo editor, Code (makes real apps), slides, CV, writing | Anything a person needs to make |
| **Places & travel** | Offline maps, Metro, Travel, Scout (buy / rent) | Every move and every big purchase |
| **People & family** | People & plans, Message alerts, Family circle (planned) | The shared life of a family |

## How it earns (one life, one subscription)
- **Free:** enough to live with it every day (the hook): Home, Money tracking, core tools, small models.
- **Attune Pro:** the whole life app — sync on every device, big models, Studio, all packs, maps and courses.
- **Family:** one plan for a household (shared lists, money, health).
- **Business:** systems for companies (Fleet, Books, Shop, built systems) — the highest value per customer.
People pay for the place their life lives in, and they stay because their life is there.

## The roadmap
**Phase 1 — Solid (now).** Fix every problem Ali finds on his phone; nothing lost, nothing wrong. Real-phone tests of
v6.45 (Recall by meaning, subtitles, Expand, client portal). Ali's Google Cloud setup → sync phone + computer.
Fleet used in Ali's own company as the first real business.

**Phase 2 — One app, not many.** Every area connected to Home and Today. One design system on every screen, phone AND
computer. The first 10 minutes: a new person sees their own life organised (How to use + sample data). Weak phones run
well (code does more, lighter models).

**Phase 3 — Launch.** Google Play release (listing, privacy policy, products, Pro locked for normal users). The first
paying users: Pro subscriptions + Fleet licences to crane and equipment companies. Watch what people really use; polish
that first.

**Phase 4 — Global.** Country packs (foods, currencies, banks and wallets, taxes, maps, transport, holidays) and more
interface languages (French, Spanish, Turkish started; then Portuguese, Hindi, Indonesian, Urdu…). The Family circle.
Windows app at full strength; then other platforms.

**Phase 5 — The app that does the hard things.** Stronger code generation: Attune builds real tools and business
systems for each person on demand, tests them, and keeps them running inside the app — the AI writes the code, the code
does the work. Every area keeps getting deeper the same way.

## Progress
- 21 Oct 2026 (v6.47): phase 2 — every area on Home's Your day, the design audit; phase 4 — country packs (30 countries),
  Portuguese, Hindi, Indonesian, Urdu; phase 5 — pages that test themselves before they are kept. Waiting for Ali: the Family
  circle design. Phase 1 (his phone, Google setup, Fleet in his company) and phase 3 (release, "not now") are his.

## How every session works toward this
- Start: CLAUDE.md → this page → APP_HANDOFF.md → NEXT_SESSION.md (the newest section).
- Ask of every change: does it connect to the rest of the life? Is the hard part done by code? Is it private? Does it
  work on a weak phone and on a computer? Is it reliable and tested?
- Subjective choices (design, names, which of several options): show Ali 2–4 options and build the one he picks.
- Ali's problems first, then the current phase, then new ideas.

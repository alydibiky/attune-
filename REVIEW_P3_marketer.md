# Persona 3 — the expert marketer (how to make people pay, and keep paying)

**What I did:** read the prices, the trial and the limits in code (`billing.js`, `attune.jsx`), opened Plans & billing as a
customer during the trial and after it (Egypt, release mode), checked every place Pro is gated, and compared with the market.

## The market (checked today)
- **ChatGPT Plus in Egypt**: about EGP 650–1,050 a month depending on the exchange rate and store fees
  ([GlobalGPT guide](https://www.glbgpt.com/hub/chatgpt-plus-subscription-price-in-egypt-2026-guide/) — a reseller, so treat as
  a range).
- **Yazio Pro**: about €30–36 a year with offers, ~US$7 a month list
  ([subger](https://subger.com/en/service/yazio-pro), [mydealz](https://www.mydealz.de/deals/yazio-pro-jahresabo-fur-3590eur-ohne-vpn-2654161)).
- **Subscription apps in general (RevenueCat 2026)**: hard paywalls convert trials to paid at a median **10.7 %** vs **2.1 %**
  for freemium, and earn ~8× more per install by day 60; yearly subscribers keep ~27–28 % after a year either way
  ([RevenueCat benchmarks](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)).

**Attune today:** Pro EGP 299 / month · **EGP 2,499 / year (default, "save 30 %")** · EGP 5,999 lifetime · Business EGP 14,999
per system. A 7-day reverse trial (everything on from install), then Free: 15 AI answers a day, 3 photo meals, 3 Deal Checks,
1 Chat X-Ray, 5 conversions, 2 decks.

**Verdict:** the prices are right for what's inside — Pro yearly costs about one month of ChatGPT Plus and replaces a food app,
a money app and an AI app. The problems are in *how* it is offered, not *how much*.

## Fixed now (objective)
- **The trial didn't unlock Money.** The 7-day trial says "everything is unlocked", but Money's Pro parts (more accounts,
  invoices…) only checked for a bought plan. Money now follows the trial like every other part.
- (Earlier today: prices follow the chosen country, so Egyptians see EGP, not $; the plan screen no longer shows the internal
  name "Yusr".)

## What to change (Ali picks — these are business decisions)
1. **Start the trial at the first real use, not at install.** Today the 7 days start before the person has even downloaded the
   2.6 GB AI, so they can lose 1–2 trial days to the download. Start it at the first AI answer or the first logged item.
   *Recommend.*
2. **Gate what costs or what matters, not answers.** Answers run on the phone and cost you nothing; "15 answers a day" feels
   like an artificial wall and is the first thing a free user hits. Better Free: unlimited chat, Money and Follow-ups
   basics. Pro: **agents that act** (buy / watch / track), photo meals, Deal Check, Chat X-Ray, exports, reports, Business.
   *Recommend.*
3. **Lead with outcomes, not feature names.** The paywall lists "Deal Check & Chat X-Ray · Converters, slides, video" — words
   a new user doesn't know. Lead with four outcomes: *Know who owes you · Never miss a payment · Lose weight by photo · An
   assistant that finds and buys for you*. Then the list. *Recommend.*
4. **Lifetime only as a launch offer** (first 30 days or first 200 buyers), as MONETIZATION.md already says. A permanent
   lifetime at 2.4 years of yearly pulls the best customers out of the subscription.
5. **Move Business off the personal paywall.** EGP 14,999 next to EGP 299 confuses a consumer; Business has its own page
   and its own sales (WhatsApp, demo). Keep one line: "Running a company? See Business".
6. **Day-5 trial notice**: "2 days of Pro left — here's what you used it for: 12 meals by photo, 3 agents, …" (the app knows).
   Personal proof sells better than any list.
7. **The 3 hero jobs everywhere** (store page, first screen, paywall): Money + Follow-ups · Fit & Food · Agents. Everything
   else under "More tools" so the app doesn't feel like 40 apps.
8. **Store listing**: Arabic first; 6 screenshots = the 3 hero flows; a 30-second video ("I typed 'Ahmed owes me 500'…"); the
   word *private / offline* in the first line — it's what no competitor can say.
9. **Referral**: "Give a friend 1 month, get 1 month" — the Egyptian market moves by WhatsApp word of mouth.
10. **Price later, not now**: keep EGP 299 / 2,499 until there are reviews; then test EGP 349 / 2,999 on new installs only.

# Attune — how it makes money

_Written for Ali, v5.29 (26 Sep 2026); prices raised in v5.32. The app side is already built (see `web-src/billing.js`,
the Plan screen, and `tools/erp-licence.mjs pro`)._

## 1. The position: why people pay for Attune

Attune isn't competing with ChatGPT on raw intelligence. It wins on things cloud AI can't offer:

| What people get | Why it's worth paying for |
|---|---|
| **Private**: everything runs on the phone | Businesses, doctors, lawyers and families don't want their data uploaded |
| **Works offline** | Construction sites, travel, poor coverage, no data plan |
| **No per-use cost for you** | Every answer runs on *their* phone, so each extra user costs you almost nothing (very high margin) |
| **Arabic-first, Egypt-aware** | Egyptian dialect, EGP prices, Egyptian VAT and labour-law tips, local payment methods |
| **Business tools included** | ERP systems from a sentence, Excel and app export — something Egyptian SMEs normally pay agencies for |

**One-line pitch (English):** *"Your private AI — on your phone, offline, in Egyptian Arabic. No account, nothing uploaded."*
**Arabic:** «ذكاء اصطناعي خاص بيك — على موبايلك، من غير نت، وبالمصري. من غير حساب، ومفيش حاجة بتترفع.»

## 2. The model: freemium + reverse trial + business licences

1. **Free, forever:** 15 answers a day on every model, and all tools. Enough to fall in love with the app, not enough for daily heavy use.
2. **7-day Pro trial for every new install (reverse trial):** people start with *everything*, then drop to Free. This consistently converts better than asking for money up front, because people pay to keep what they already use. *(Built in.)*
3. **Attune Pro (personal):** unlimited answers, expert review, deep web research, unlimited Studio, memory, and Business exports.
4. **Attune Business (per company):** a licence per ERP system, plus a yearly support plan. This is where the real money is (see section 5).

## 3. Prices

Priced for the market: Egypt pays Egyptian prices, everyone else USD. ChatGPT charges $20, but our buyers are price-sensitive and the model costs us nothing to run.

| Plan | Egypt | Rest of world | Notes |
|---|---|---|---|
| Monthly | EGP 199 | $4.99 | Entry point, cancel any time |
| **Yearly (default, "Best value")** | **EGP 1,499** | **$39.99** | "Save 37%". Yearly buyers stay about 3× longer |
| Lifetime | EGP 3,999 | $99 | Cash now; great for early adopters and launches |
| Business: one ERP system | EGP 9,999 once | $249 | Unlimited records, Excel and app export |
| Business support (yearly) | 20% of the licence | 20% | Updates, changes on request, priority WhatsApp |

**Why v5.32 raised the prices (Ali: "I think it's too low"):** the first prices (EGP 149 / 999 / 2,999) priced Attune like a small utility app. It is a private, offline AI with deep research, Studio and Business systems — and ChatGPT Plus costs about EGP 1,000 a *month* in Egypt. EGP 199 a month is still a fifth of that, on par with a streaming subscription; the yearly plan stays the obvious choice. Business was the most underpriced: agencies charge EGP 20,000–100,000 for a custom system, so EGP 9,999 is still an easy yes. Start here, and raise again once reviews and demo videos exist (it is easier to raise with social proof than to lower).

**Testing:** while `TESTING_ALL_PRO = true` in `web-src/billing.js`, every phone has every Pro feature (Plan says so in blue). **Set it to `false` before the public release.**

**Psychology used:**
- The yearly plan is shown first and pre-selected.
- The monthly price makes the yearly one look cheap (anchoring).
- Lifetime is a high anchor that makes yearly look reasonable.
- Prices end in 9.

## 4. How people pay (works today, no Play Store needed)

1. In **Plan**, the buyer picks a plan and taps **Get Pro**. WhatsApp opens with a ready message: plan, price and **this phone's request code** (`PRO-XXXXXXXX`).
   → Put your WhatsApp number in `web-src/erp.js` → `SELLER.contact` (for example `"+2010…"`), and the price text in `SELLER.price`.
2. They pay by **InstaPay / Vodafone Cash / bank card**.
3. You run, on your computer, with your private key (the same file you use for Business codes; **never in git**):
   ```
   node tools/erp-licence.mjs pro <your-private-key.json> PRO-XXXXXXXX year     # or month / life / business
   ```
4. Send them the `PRO1.…` code. They paste it into Plan → **Activate**. It works only on that phone. Month and year codes end by themselves, and Plan asks them to renew.

**Later, when on Google Play:** Google requires Play Billing for in-app purchases of digital features (it keeps 15% on subscriptions). The app already has the Store buttons (`SKUS` in attune.jsx: `attune_pro_monthly`, `attune_pro_yearly`, `attune_pro_lifetime`). Create those products in the Play Console, with Play's regional pricing set to the table above. Business licences sold directly to companies stay outside Play.

## 5. The biggest money: Business (B2B)

A single company licence is worth as much as 50 personal subscriptions. Egyptian SMEs pay agencies EGP 20,000–100,000 for custom systems; Attune builds one from a sentence.

- **Start with your own network:** crane rental companies, contractors, workshops, logistics firms. Your company (150 employees) is the case study. Build its real system in Attune and show the result.
- **Offer:** "Your company system in one day — customers, equipment, jobs, invoices, payments, connected like Access, exportable to Excel. EGP 9,999, yours forever."
- **Vertical templates** (turn each into a ready system people can buy):
  - crane and equipment rental;
  - car workshop;
  - clinic;
  - retail shop;
  - construction site tracking.
- **Upsell:** yearly support (20%), custom changes (priced per job), training.

## 6. Keeping people paying for as long as possible (retention)

- **Yearly by default:** it cuts churn in half compared with monthly.
- **Daily value:** Daily news, Learn daily and reminders bring people back every day. Habit is what keeps subscriptions alive.
- **Their data lives in Attune:** chats, memory, business records. Always let people export (it's fair, and trust sells), but the convenience keeps them.
- **Renewal reminders:** a friendly message 3 days before a code ends ("Renew and keep Pro"). No dark patterns; they cause refunds and bad reviews.
- **Win-back:** when a plan ends, offer 20% off yearly for the first week.
- **Streaks and badges** for Learn daily and Turkish practice (optional next step).

## 6b. The feature that sells Pro: Deal Check (v5.33)
"Before you pay or sign, ask Attune." It saves people money on the first day, which is the easiest reason to pay there is.
- **Hook videos:** "This seller wanted a Vodafone Cash deposit — Attune said SCAM in 10 seconds." · "The shop said 0% interest. Attune: you pay 66% a year." · "Is this RAM a good deal?"
- **Free:** 3 checks a day (enough to be amazed). **Pro:** unlimited — people who buy, sell or sign often (car dealers, brokers, small shops, families buying on installments) hit the limit fast.
- **Business angle:** real-estate and car brokers can use it to show clients a fair-price report — a reason for the Business plan.

## 6c. Chat X-Ray (v5.35) — the business owner's reason to pay
"Who owes me money in this WhatsApp chat?" Export a chat → Attune: a money ledger added up by code (with the exact messages as proof), promises and dates with reminders, questions you never answered, and "ask this chat". All offline — business chats never leave the phone, which no cloud AI can promise.
- **Hook video:** "I exported my WhatsApp with a client — Attune found 27,500 EGP he still owes me, with the messages."
- **Free:** 1 X-ray a day. **Pro:** unlimited. Contractors, shops, brokers and freelancers live in WhatsApp — they are exactly the people who pay.

## 6d. File Converter (v5.37) — the daily habit
"PDF to Word" is one of the most searched phone tasks, and every free converter site uploads your contracts and invoices to a stranger's server, with ads and waiting. Attune does 80+ conversions (PDF, Word, PowerPoint, Excel, CSV, JSON, LibreOffice, e-books, web pages, photos, subtitles, merge/split PDFs) offline, and reads scanned paper into an editable Word file with the AI — Arabic too.
- **Hook video:** "I photographed a paper contract — 20 seconds later it's a Word file I can edit. No internet."
- **Free:** 5 conversions a day (the habit). **Pro:** unlimited — offices, students and accountants convert every day.

## 7. Growth (getting users cheaply)

- **Short videos in Egyptian Arabic** (TikTok, Reels, Shorts): "ChatGPT on your phone WITHOUT internet", "I built my company's system in 1 minute", "It reads my crane photo and tells me the model". A demo sells this app better than an explanation.
- **Referral:** give a free month of Pro for each friend who buys. Your users sell for you.
- **LinkedIn and Facebook groups** for construction, cranes, logistics and SME owners in Egypt and the Gulf.
- **Store listing (ASO) in Arabic and English:** keywords like offline AI, Arabic AI, private AI, ERP, مساعد ذكي بدون انترنت.
- **Launch offer:** lifetime at EGP 2,499 for the first 200 buyers. It creates urgency and early cash.

## 8. Numbers to watch (weekly)

| Metric | Healthy target |
|---|---|
| Installs → active on day 7 | ≥ 25% |
| Trial → paid | 3–8% (reverse trials usually land here) |
| Share of yearly among paid | ≥ 60% |
| Monthly churn (monthly plan) | ≤ 8% |
| Business licences per month | start with 2–5 from your network |

**Rough goal:** 10,000 installs × 5% paying × EGP 1,499 a year ≈ **EGP 750,000 a year**, plus Business licences (10 × EGP 9,999 ≈ EGP 100,000, and support on top). Almost no server costs, because the AI runs on the users' phones.

## 9. Checklist for Ali

- [ ] Put your WhatsApp number in `SELLER.contact` (web-src/erp.js).
- [ ] Before release: `TESTING_ALL_PRO = false` in web-src/billing.js.
- [ ] Keep the private key file safe (backup + never in git). Anyone with it can make codes.
- [ ] Prepare 3 short demo videos in Egyptian Arabic.
- [ ] Build your crane company's system in Attune as the showcase.
- [ ] Set a launch offer and date.
- [ ] When ready for Google Play: create the 3 subscription products and the store listing.

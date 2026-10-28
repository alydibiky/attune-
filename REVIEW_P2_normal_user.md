# Persona 2 — a normal user (first week, no technical knowledge)

**Who:** someone who installed Attune because a friend said "it does your money and your food and talks to you". They don't
know what a "model" is, they tap more than they type, and they give up after two confusing screens.

**What I did:** a brand-new install (nothing set) at phone size → the welcome questions → the first question on Home → the
Engine screen → installing the AI → looking for things by tapping and by the sidebar search (13 searches a normal person would
try) → the main places one by one.

## What happened, step by step
1. **Welcome ("Make Attune yours")** — 6 short steps: app language, what you'll use it for, your languages, your work, your role,
   how familiar with AI, anything else. Clear and quick. **But it never asks your country** (which decides your currency, your
   prices, your holidays — a person in Egypt with an English phone got USD until v8.6), **and it never mentions the one thing
   the app needs: the AI download.** It ends on an empty Home.
2. **First question on Home** ("what's a good breakfast for losing weight?") → Chat opens and says *"Load a model in Engine
   first"*. The question is kept in the box (good), but a normal person doesn't know what "a model" or "Engine" is.
3. **Engine screen** — the first things shown are "not running", "Settings", "THIS DEVICE: Mobile · 12 GB RAM · 8 cores",
   and a row "My machine actually has 4 / 6 / 8 / 12 / 16 / 32 / 64 GB". **The one button a person needs — Install (2.59 GB) —
   is below all of that, off the first screen.**
4. **After installing**, the question still waits in Chat; the person has to go back and press Send.
5. **Finding things**: the sidebar search works well for tools (homework → Homework Coach, travel, maps, pdf, cv, calories ✔).
   It failed for the app's own screens: "pro", "plan", "language", "settings", "backup" found nothing useful. "remind" showed
   **"Timeline"** — a name the app no longer uses (the place is "Follow-ups").
6. **Places** (also seen in the first walk): the "No model" pill on every page; Students / Daily / Go aren't in the sidebar;
   Follow-ups opens with five "0" counters; Business has its own different header and bottom bar; Travel shows "5 KB" and
   "Exchange rates: never".

## Fixed now
- Sidebar search finds **Plans & billing** ("pro", "plan", "price", «اشتراك»), **Settings** ("language", "theme", «لغة»),
  **Backup** and **Profile**.
- The search result says **Follow-ups**, not "Timeline".
- (Earlier today, also for this person: the first expense typed on Home is saved; the currency follows the country; one-tap
  "What did you mean?"; Money's + button no longer covers its report link.)

## For Ali to pick (layout / wording — not changed without you)
- **P2-A First run**: (1) add one step to the welcome — "Your country" + "Get Attune's brain (2.6 GB on Wi-Fi) — download
  now / later", (2) keep the welcome as is and show a single "Get started" card on Home until the AI is installed.
  *Recommend 1* — the AI is the heart of the app and a person shouldn't discover it through an error.
- **P2-B Engine screen**: (1) put "Recommended for this phone — Install" at the very top and fold the device details and RAM
  buttons under "Details", (2) leave it. *Recommend 1.*
- **P2-C** When the AI finishes installing and a question is waiting, answer it by itself (no second Send). *Recommend yes.*
- **P2-D** Replace the "No model" pill on every page with nothing (and show it only on Chat / AI tools). *Recommend yes.*
- **P2-E** Sidebar: Students · Daily · Go back in the list, or under "More". *Recommend back in the list.*

## Redone hands-on (28 Oct): an Egyptian's week, typed in Arabic on Home
**What I did:** the app in Egyptian Arabic, country Egypt, phone size; 14 everyday sentences typed into the Home box the way a
normal person writes them (no keywords, Arabic digits), screenshots and the reply after each one.

| Typed | Before | Now |
|---|---|---|
| «صرفت ٢٥٠ على الغدا» · «تاكسي ٦٠» | ✔ expenses (reply in formal Arabic: «أُضيف مصروف») | ✔ «اتضاف مصروف: 250 EGP — الغدا» |
| «أحمد عليه ٥٠٠» | saved as «احمد · **debt**» (hamza lost, an English word) | «اتحفظ في الناس والالتزامات: **أحمد · دين** · 500» |
| «فكرني ادفع الكهربا يوم ١٠» | **"What did you mean?" — with no reminder among the choices** | reminder «ادفع الكهربا», Tue 10 Nov 09:00 (the date in Arabic, Western digits) |
| «طبق فول وعيش بلدي على الفطار» | ✔ 457 kcal; reply «أعدّ اللياقة… لترى هدفك» | ✔ «اتسجل في الفطار … ظبّط الأكل واللياقة مرة واحدة عشان تشوف هدفك» |
| «شربت ٣ كوبايات مية» · «وزني ٩٥» · «مشيت نص ساعة» | ✔ | ✔ (Egyptian wording) |
| «اطلبلي ايربودز برو ٢ بأقل من ٩٠٠٠» | ✔ a buy agent, "I'll ask you before buying" | ✔ |
| «من المعادي للتحرير» | **"What did you mean?"** (to-do / note / web / chat) | «اركب الخط الأول اتجاه المرج الجديدة، 8 محطات لحد السادات…» — a Metro route when both ends are stations; «من البيت للشغل» still asks |
| «صرفت كام النهارده؟» · «مين عليه فلوس ليا؟» | ✔ exact, by code | ✔ (the answer now in Egyptian: «شخص واحد عليه ليك 500») |
| «ترجم صباح الخير للإنجليزي» | **"English: صباح الخير للإنجليزي — translating needs an AI model"** | "Good morning" at once from the phrasebook (no model needed) |
| «كلم ماما بكرة الساعة ٦» | ✔ reminder Thu 6 pm | ✔ |

**Also fixed while doing it:** every reply of the Home box in formal Arabic (سُجّل، حُفظ، لم يُعرف، ما زال، لا يوجد، سيذكّرك…)
is now Egyptian, as Ali chose for the whole app. Tests: `tests/unit/v860p2b.test.mjs` (4 checks); `v727life` now expects the
name as typed («أحمد», «سارة»).

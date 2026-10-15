# Attune 6.29 — getting it onto Google Play (target: within 2 weeks of 15 Oct 2026)

## 0. Start TODAY: the 14-day closed test
If your Play developer account is a **personal** account created after 13 Nov 2023, Google opens Production only after a
**closed test with at least 12 testers who stay opted in for 14 days in a row** (if they drop below 12, the 14 days restart).
An **organisation** account (a company, needs a D-U-N-S number) does not have this rule.
So: create the app in Play Console now, upload the first bundle to a closed-testing track, and invite 12+ people
(friends, family, colleagues; a Google Group makes it easy). Day 15 → apply for production.

## 1. Done in code this session (v6.29)
| What | Why |
|---|---|
| Targets **Android 16 (API 36)**, AGP 8.9.1, Health Connect 1.1.0 | Play rejects new apps / updates below API 36 since 31 Aug 2026 |
| Back in the in-app browser uses Android 13+'s back dispatcher | Android 16 no longer calls the old onBackPressed |
| **Developer mode (7 taps = free Pro) only on test-key builds** | on a Play build it can never unlock anything |
| **Play-only purchases on a Play build** (no activation-code / old-key boxes) | Play's payments policy |
| **Privacy policy**: in the app (More → Privacy, EN + AR) + `docs/privacy-policy.html` | required for health, location, microphone, notification access |
| Health Connect's "why this app reads your data" opens the Privacy page | required for Health Connect access |
| Payment-notification reader ignores one-time codes (OTP) | privacy + review |
| Billing: Business activations acknowledged at once; Play not answering keeps Pro; reconnects; no crash on a closing screen | Play refunds unacknowledged purchases after 3 days; paying users must not lose Pro offline |
| A Play bundle can never be signed with the test key; a manual "Build the APK" run also keeps the bundle (`attune-play-bundle`) | the test key's passwords are in the repo |
| No OpenStreetMap tile servers; unused weather service removed | their terms forbid app / commercial use |
| Engine start errors reported, not crashed; crash guards (v6.29) | stability |

## 2. Only you can do these
1. **Upload key + GitHub secrets**: create an upload keystore (Android Studio → Generate Signed Bundle, or `keytool`), then add
   `ATTUNE_KEYSTORE_BASE64` (the .jks in base64), `ATTUNE_STORE_PASSWORD`, `ATTUNE_KEY_ALIAS`, `ATTUNE_KEY_PASSWORD`
   (GitHub → Settings → Secrets → Actions). Turn on **Play App Signing** when Play asks. Keep the .jks safe and backed up.
2. **First bundle**: Actions → "Build the APK" → Run workflow (on main) → download `attune-play-bundle` → upload it by hand
   to the closed-testing track. After that, add `PLAY_SERVICE_ACCOUNT_JSON` and pushes to main upload by themselves (internal track).
3. **Privacy policy URL**: host `docs/privacy-policy.html` (GitHub Pages on a public repo, Google Sites, or any site) and
   paste the link in Play Console → App content → Privacy policy. Put a **contact email** on the store listing.
4. **Products** in Play Console → Monetize (ids must match exactly): subscriptions `attune_pro_monthly`, `attune_pro_yearly`;
   one-time `attune_pro_lifetime`, `attune_business_system`. Set prices (EGP / USD as in MONETIZATION.md).
   Add your Gmail as a **license tester** to buy without being charged.
5. **App content declarations** (Play Console → App content):
   - Data safety: no data collected or shared by Attune; data sent to third parties only when the user uses a feature
     (web search, maps search, food search, downloads) — see the policy's list. Encryption in transit: yes. Deletion: in the app.
   - **Health Connect** declaration (steps, calories, distance, heart rate, exercise — read only, shown in Fit & Food).
   - **Foreground service (special use)**: "keeps on-device AI writing / picture making / downloads running while the screen
     is off; the user starts it and sees a notification". A short screen video helps.
   - **Notification listener** (payment notifications → Money, opt-in, on-device only).
   - **Exact alarms** (medicine doses and reminders at the minute the user set).
   - Content rating questionnaire, target audience (13+), ads: none.
6. **Store listing**: name, short + full description (EN + AR), icon 512×512, feature graphic 1024×500, at least 2 phone
   screenshots (I can make these from the app — say the word).
7. **USDA food search key**: get a free key at api.data.gov (2 minutes) and send it to me — the app uses the shared
   `DEMO_KEY` today, which is rate-limited.
8. **Decide** (policy risk): **Video Downloader** — it refuses YouTube, TikTok, Instagram, Facebook and the rest, but still
   downloads any plain video file or stream on other sites, and Pro advertises "unlimited video downloads". Options:
   A) keep it but drop "video downloads" from the Pro list and the store text (recommended), B) only direct file links,
   C) remove it from the Play build.
9. **Phone test** (30 minutes) on the APK from the latest run: chat, a model, Home → What's waiting, ☰ chats, Scout with a real
   goal, Learn daily review, Slides → PowerPoint, Fit & Food, a purchase as license tester, Back everywhere.

## 3. Known, acceptable for launch
- Map place search uses Photon / Nominatim (OpenStreetMap) for light, user-started searches — fine at launch volume;
  move to our own packs' search if usage grows.
- Entitlement is checked on the phone (no server) — acceptable now; server checks later if piracy shows up.
- The desktop app has no Play billing; developer mode there follows the old rule (desktop is not on Play).

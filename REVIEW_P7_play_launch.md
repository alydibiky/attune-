# Persona 7 — the app developer and Play Store launch expert

**What I did:** read the Android manifest line by line (both builds: "full" for Play and "lite" for side-loading), every
permission and background service, the published privacy policy against what the app really does, Play Billing, the exact-alarm
handling, the build workflow and the real size of the last APK (run
[40510170770](https://github.com/alydibiky/attune-/actions/runs/40510170770)).

## Fixed now
1. **The published privacy policy was out of date and partly untrue.** `docs/privacy-policy.html` (the page Play links to) was
   dated 15 October and was missing chat / SMS notifications and the temperature data; both it and the in-app text said "the
   microphone is used only while you speak" — not true once the «يا أتيون» wake word is on. Rewritten (EN + Egyptian Arabic,
   15 sections, dated 27 October): the wake word (listens on-device for two words only, with a notification, nothing recorded),
   Android's speech service when there's no offline voice pack, **agents typing your saved details into a website's form when
   you tap Order it / Fill my details**, Sync through your own Google Drive (encrypted, a hidden folder), and reported AI answers.
   **`tools/privacy_html.mjs` now builds the published page from the app's own text**, so they can't drift apart again.
2. (Earlier today) **"Report this answer"** on every AI answer — required by Play's AI-generated content policy.

## Ready for Play (checked)
- Target Android 17 (API 37); minSdk 28. Play's current minimum (35) is met.
- Play Billing 7.1.1 is in (`Billing.kt`), products `attune_pro_monthly / yearly / lifetime`, `attune_business_system`.
- The Play bundle is built only with the real key (the workflow refuses the test key).
- The notification reader exists only in the "full" (Play) build; the side-loaded "lite" build leaves it out.
- No accessibility service, no SMS permission, no background location, no QUERY_ALL_PACKAGES (only a launcher-apps query).
- Exact alarms: checked with `canScheduleExactAlarms()`, falls back to normal alarms if the person didn't allow it.
- APK ≈ **115 MB** (Play's main-download limit is 200 MB).

## Before you submit — only you can do these (in order)
1. **Support e-mail** in `web-src/billing.js` → `SUPPORT_EMAIL` (AI reports go there) and on the Play listing.
2. **Host the policy**: the updated `docs/privacy-policy.html` (e.g. GitHub Pages) and paste its link in Play Console.
3. **Data safety form** — declare, all "processed on device, not collected": messages (notifications, optional), financial
   info (payments from notifications), health & fitness (Health Connect reads), audio (voice, wake word), photos (when you
   choose), approximate & precise location (Maps), app activity. "Data shared": none, **except** the personal details the
   person chooses to fill into a website through an agent — declare "personal info shared with third parties at the user's
   request" to be safe.
4. **Health apps declaration** + Health Connect permission form: steps, active & total calories, distance, heart rate,
   exercise, skin temperature, basal body temperature — each with its reason (Fit & Food, Cycle).
5. **Foreground service declarations** with a short screen video each: microphone (wake word), dataSync (Library import),
   specialUse (AI answering in the background).
6. **SYSTEM_ALERT_WINDOW** (the quiet orb over other apps) — Play reviews it strictly. *Recommend removing it from the Play
   build* (the tap-to-talk notification works without it).
7. **Financial features declaration** (Money tracks expenses; not a lender) and the **Content rating** questionnaire
   (AI chat: answers "user/AI-generated content: yes, with in-app reporting").
8. **Closed test**: a new personal developer account must run a closed test with **at least 12 testers for 14 days** before
   production.
9. **Store listing**: Arabic first, 6 screenshots of the hero flows, a 30-second video, the word *private / on your phone*
   in the first line.
10. **Huawei** (`HUAWEI_SETUP.md`) — optional, not needed for Play.

## Risks to decide (Ali picks)
- **Video Downloader** — YouTube / TikTok / Instagram are blocked in code, but "downloader" apps get extra review. *Recommend
  leaving it out of the first Play release.*
- **The keyboard (IME)** — allowed, but needs a clear in-app disclosure that typed text isn't collected; *recommend shipping
  it in the second release* to keep the first review simple.
- **Size** — 115 MB first download; the Python engine for Code (26 MB) and other optional packs could download on first use.
- **"Pro is bought in the Google Play version"** text is shown in test builds; make sure the Play build shows the Buy buttons
  (it does when Billing connects — test it in the closed test).

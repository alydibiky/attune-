# Attune — invite friends (a month free for each friend who subscribes, up to 3)

Ali's ask (28 Oct 2026): *"for every friend you send a link to who subscribes using your link, you get a month free, a maximum
of 3 friends"* and *"can't it be linked to a Google account"*. This folder is the small server that makes it impossible to
fake. The idea follows Google's own Play Billing server sample
([android/play-billing-samples](https://github.com/android/play-billing-samples), Apache-2.0); the code is written fresh.

## How it works
1. In Attune (Plan → **Invite friends**), the person signs in once with Google — Google's own screen, asking only *who you are*.
2. The server (`referral` function) gives them an invite code; their link is the Play Store page with that code.
3. A friend installs from the link → the friend gets a month of Pro (already in the app) and, when they sign in, is tied to the
   person who invited them (only a **new** account, never your own code).
4. When the friend **subscribes**, Google Play tells the server (`playEvents`). The server checks the purchase with Google and:
   - the inviter pays through Play → Play moves the inviter's next payment **30 days later** (`subscriptions.defer`) — never charged;
   - otherwise → 30 days wait in the inviter's app (**Use my free days**).
5. At most **3 friends** per person. Each friend counts once.

Nothing else leaves the phone: no email, no data — only a token that says which Google account it is (the server keeps a
hash of it), the invite code, and the friends' count.

## What Ali sets up once (about 20 minutes)
| Step | Where | What |
|---|---|---|
| 1 | console.firebase.google.com | **Create a project** (مشروع جديد) — use the same Google Cloud project as Google sync if you like. Switch it to the **Blaze** plan (الدفع حسب الاستخدام): functions need it; the free allowance covers thousands of invites a month. |
| 2 | Firebase → Firestore | **Create database** (قاعدة بيانات) — production mode, region `europe-west1`. |
| 3 | your computer | `npm i -g firebase-tools` → `firebase login` → in this folder: `firebase use --add` (pick the project) → `firebase deploy --only functions`. It asks for `ANDROID_CLIENT_IDS` (the Android OAuth client id you made for Google sync — Google Cloud → APIs & Services → Credentials) and `ACCOUNT_SALT` (any random words; never change them). |
| 4 | Google Cloud → Pub/Sub | **Create topic** `play-rtdn`; give `google-play-developer-notifications@system.gserviceaccount.com` the role **Pub/Sub Publisher** on it. |
| 5 | Play Console → Monetization setup | **Real-time developer notifications** (إشعارات الشراء الفورية): topic `projects/<your-project>/topics/play-rtdn` → *Send test notification*. |
| 6 | Play Console → Users and permissions | **Invite** the functions' service account (`<project-number>-compute@developer.gserviceaccount.com`) with *View financial data* + *Manage orders and subscriptions*. This is the "service account" — no key file is needed. |
| 7 | this repo | Put the `referral` function's address (shown after step 3, like `https://europe-west1-<project>.cloudfunctions.net/referral`) in `web-src/referral.js` → `REFERRAL_SERVER`, build, push. The card turns on by itself. |

Tests: `tests/unit/v870referral.test.mjs` (the rules in `logic.js` and the app side in `web-src/referral.js`).

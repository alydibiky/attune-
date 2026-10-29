# Gmail for everyone, free — Google's restricted-scope verification (no paid security audit)

Ali (29 Oct 2026): "I want the Gmail in which people sign in with their accounts without paying money."

## Why it can be free
`gmail.readonly` is a *restricted* scope. Before anyone outside 100 test users can use it, Google checks the app.
Google has two checks, and only one costs money:

| Check | Cost | Needed for Attune? |
|---|---|---|
| **Restricted-scope verification** — Google's own team reads the privacy policy, the scope justification and a demo video | **Free** | Yes |
| **Security assessment (CASA)** by an outside lab, yearly | Paid (roughly $500 → thousands) | **Only if Gmail data is stored on, or sent to, the developer's servers** |

Google's Gmail scopes page says: *"If you store restricted scope data on servers (or transmit), then you must go through a
security assessment."* Attune reads Gmail **on the phone** and has no server for it, so it asks for the free verification
only. Google decides in the end. If they still ask for CASA, the reply below explains the on-device design; if they insist,
the fallbacks at the bottom need no Google review at all.

## What the code already does so the answer is "nothing leaves the phone"
- The token stays in Kotlin (`GmailRead.kt`); the page only gets the money emails it asked for.
- The emails are kept on the phone (`attune:gmail:v1`, 90 days) and **left out of Sync** (`cloud.js SYNC_SKIP` + the
  Overpaying check's Gmail emails stripped before Sync). Tests: `tests/unit/v870gmail.test.mjs`.
- Never sent to the cloud AI, the referral server or anywhere else. Read-only: never sends, changes or deletes email.
- The card shows Google's "Limited Use" promise before Connect (`gmail-ui.jsx`, testid `gmail-limited-use`).
- During testing, Google asks again every 7 days: the card then says "Google asks you to confirm again — tap Read now".
- Note for the reviewer if asked: Android's own backup of the app (the user's Google account backup, encrypted by Android)
  includes the app's storage like any app; Attune itself has no copy.

## What Ali does — step by step (about 1 hour of work, then Google's review: usually 1–4 weeks)
1. **Google Cloud project** "Attune" → **APIs & Services → Library → Gmail API → Enable**.
2. **OAuth consent screen** (Google Auth Platform → Branding):
   - App name **Attune**, support email, logo, app home page, **privacy policy link** = the public link of
     `docs/privacy-policy.html` (already updated: Gmail section + Limited Use sentence), authorised domain of that link.
3. **Data access → Add scopes** `https://www.googleapis.com/auth/gmail.readonly` (restricted — the free review below) and
   `https://www.googleapis.com/auth/gmail.send` (sensitive — free review, never an audit) for "write an email, check it, Send".
4. **Clients → Create client → Android**: package `com.aldibiki.attune`, SHA-1 of the signing key
   (`keytool -list -v -keystore app/attune-test.keystore`), and later a second one with the **Play app-signing SHA-1**
   (Play Console → Setup → App signing).
5. **Audience → Test users**: add your own Gmail (and up to 99 testers). Gmail works for them right away.
6. **Record the demo video** (2–3 minutes, unlisted on YouTube) — the script is below.
7. **Audience → Publish app → Prepare for verification** and paste the texts below.
8. Answer Google's emails (they sometimes ask for a second video or a wording change). Paste their message to Claude.

## Text to paste — "How will the scopes be used?"
> Attune is a personal money and life assistant that runs on the user's Android phone. With gmail.readonly, the app reads —
> on the device only — the user's emails about money (receipts, invoices, bank and wallet alerts, subscription renewals,
> free-trial endings and price-change notices) so that it can (1) list the payments for the user to confirm in their own
> money ledger, (2) show subscriptions, trials and price rises the user may want to cancel ("Overpaying check"), and (3) let
> the user search those emails in the app ("Recall"). Email content is processed and stored only on the user's device: the
> developer operates no server that receives it, it is not sent to any AI service, it is not used for advertising, not sold,
> and it is excluded from the app's sync. The app never sends, modifies or deletes email. No narrower scope works:
> gmail.metadata has no message body, and the amounts and dates are in the body.

## Text to paste — gmail.send
> When the user asks Attune to write an email ("email Ahmed that the meeting moved to Sunday"), the app drafts it on the
> device and shows the exact recipients, subject and text, which the user can edit. The email is sent with gmail.send only
> when the user taps Send on that screen — one email per tap, never automatically. Without this permission the app opens
> Gmail's own compose screen instead.

## Text to paste — Limited Use (if asked)
> Attune's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy,
> including the Limited Use requirements. Gmail data is used only to provide the user-facing features described above, is
> processed only on the user's device, is never transferred to the developer or third parties, and no human reads it.

## Demo video script (record on the phone; screen recording + voice or captions, English)
1. Open Attune → Money Guardian → Overpaying check → scroll to **"Read my Gmail by itself"**; show the Limited Use line.
2. Tap **Connect Gmail** → Google's consent screen appears; **show the URL bar / the app name and the scope**
   ("Read your email messages and settings") → Allow.
3. Back in Attune: "N emails about money read — N payments are waiting in Money".
4. Open Money → the review list → show one payment with "The message as it arrived" (the email text) → tap Add.
5. Open the Overpaying check → a subscription / price rise found from an email → tap it → "Open the email".
6. Open Recall → search "netflix price" → the email is found.
7. Home box: type "email ahmed@example.com that the meeting moved to Sunday" → the email appears → edit a word → tap
   **Send** → Google asks once for "send email on your behalf" → sent; show it in Gmail's Sent folder.
8. Show **Disconnect** in the card, and myaccount.google.com/permissions to remove access.
9. Say/caption: "Email content stays on this phone. Attune has no server for it."

## If Google still asks for the paid assessment — free ways that need no Google review
- **Gmail notifications** (already working): Attune reads the Gmail app's notifications like bank notifications — new
  money emails reach Money and Recall with no sign-in. Only new emails, and only the part the notification shows.
- **Gmail export** (already working): Google Takeout → Mail → open the .mbox in the Overpaying check — the last 12 months.
- **IMAP with an app password** (can be built in a day): the person turns on 2-Step Verification and makes an "app
  password" at myaccount.google.com/apppasswords; Attune reads Gmail over IMAP on the phone. No Google review at all, but
  each person does a 2-minute setup, and Workspace admins can block it.

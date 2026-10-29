# Gmail read by itself (BUILT 29 Oct 2026 — works once Ali does the Google Cloud steps below)

Today the Overpaying check (Money Guardian, `web-src/overpay.js`) reads payments, money notifications, pasted emails and a
**Gmail export** (Google Takeout → Mail → `.mbox`, read on the phone; each email keeps a Gmail link from its `X-GM-THRID`).
That needs no Google setup at all. Reading new emails by itself needs Gmail sign-in, and these steps first.

## What Ali has to do (once)
1. **Google Cloud project** (console.cloud.google.com → New project "Attune").
2. **Enable the Gmail API** (APIs & Services → Library → Gmail API → Enable).
3. **OAuth consent screen**: External; app name, support email, privacy-policy link (the same public link Play needs,
   RELEASE_6.29.md); scope `https://www.googleapis.com/auth/gmail.readonly`.
4. **OAuth client ID, type Android**: package `com.aldibiki.attune` + the SHA-1 of the signing key
   (`keytool -list -v -keystore app/attune-test.keystore`, and later the Play app-signing SHA-1 from Play Console).
5. **Verification.** `gmail.readonly` is a *restricted* scope. While the app is in "Testing", up to 100 named test users can
   sign in with no review. To publish it to everyone, Google requires app verification **and a yearly third-party security
   assessment (CASA)**, which costs money and takes weeks. Until then, the Takeout export covers the same 12 months.

## What the code does (v8.7, 29 Oct 2026)
- **Connect Gmail** (the card in Money Guardian's Overpaying check and in Recall, `web-src/gmail-ui.jsx`): Google's own screen asks
  once for `gmail.readonly` (MainActivity.authorizeScopes → AuthorizationClient). The token stays in Kotlin (`GmailRead.kt`).
- First read: the last 12 months' money emails (up to 100). Then **once a day, silently** when Attune opens (never Google's
  screen again; `gmailDue` / `readGmail` in `web-src/gmail.js`): the last days' new ones (up to 40).
- Search: `newer_than:Nd (receipt OR invoice OR order OR subscription OR renew OR trial OR "price increase" OR payment OR billing
  OR charged OR debited OR credited OR transfer OR voucher OR points OR إيصال OR فاتورة OR اشتراك OR تجديد OR دفع OR تحويل)`;
  each hit → `{ id, kind: "email", from, title, text, at, link }`. One-time codes are dropped on the phone.
- Where they go: the Overpaying check (`overpay.addEmails`, same path as the export), Money's review list for real payments
  (`isPaymentEmail` — never added by themselves), and Recall (90 days, app "Gmail").
- Respects Offline mode (`blockedByAirGap`). Tests: `tests/unit/v870gmail.test.mjs`, `tests/e2e_v870gmail.py`.
- Until the Cloud steps are done, "Connect Gmail" shows Google's error (the app is not registered) — nothing else breaks.

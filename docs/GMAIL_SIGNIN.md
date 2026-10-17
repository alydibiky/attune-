# Gmail sign-in for the Overpaying check (not built yet: needs Ali's Google Cloud setup)

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

## What the code will do (when the steps above are done)
- Kotlin: Credential Manager / Google Sign-In for the account, then an authorization request for `gmail.readonly`
  (AuthorizationClient), token kept by the system, never in the page.
- `NativeBridge.gmailSearch(query)`: `users.messages.list` with
  `q = "newer_than:1y (receipt OR invoice OR subscription OR renew OR trial OR \"price increase\" OR voucher OR points)"`,
  then `users.messages.get?format=full` per hit; each one → `{ id, kind: "email", from, title, text, at, link }`
  (link = `https://mail.google.com/mail/#all/<threadId>`), handed to `overpay.addEmails` — the same path as the export.
- The monthly reminder on the 1st (`overpay-monthly`) would also run the search first.
- Respects the Offline lock and the network log like every other network path.

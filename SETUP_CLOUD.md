# Setting up the parts that need Ali's accounts (v6.32)

The code is in: `web-src/cloud.js` (sync, Family circle lists, Pro search), `NativeBridge.driveSync` (the phone side, waiting
for the client id), `tools/pro-search-relay/` (the search relay). Nothing shows in the app until the ids below are filled in
`CLOUD` at the top of `web-src/cloud.js`. Send Claude the two values (they are not secrets) and it finishes the wiring.

## A. Google sign-in + Drive sync (then the Family circle)

What it does: the encrypted backup (your password locks it on the phone) is kept in Attune's **hidden** Drive folder
(`drive.appdata`). Attune can see only its own file there, never your Drive. Every phone pulls, merges, pushes.

1. Open https://console.cloud.google.com → top bar → **New project** → name `Attune` → Create.
2. **APIs & Services → Library** → search **Google Drive API** → **Enable**.
3. **APIs & Services → OAuth consent screen** (now called **Google Auth Platform**):
   - User type **External**; app name `Attune`; support email `alydibiky@gmail.com`; app logo optional.
   - **Data access → Add scopes** → tick `.../auth/drive.appdata` ("See, create, and delete its own configuration data in
     your Google Drive"). Google lists it as non-sensitive, so no security review is needed.
   - **Audience**: while testing, add your Gmail under **Test users**. Press **Publish app** before the Play release.
4. **Credentials → Create credentials → OAuth client ID**, three times:
   - **Android**, package `com.aldibiki.attune`, SHA-1 of the **test key**:
     `keytool -list -v -keystore app/attune-test.keystore -storepass attune-test` → copy the SHA1 line.
   - **Android** again, same package, SHA-1 from **Play Console → your app → Test and release → App integrity → App signing
     key certificate** (the key Google Play signs with).
   - **Web application** (no URLs needed). Copy its **Client ID** (`…apps.googleusercontent.com`).
5. Send Claude the **Web application Client ID**. No client secret or JSON file is needed (and none goes in the repo).

Claude then: adds Google's sign-in library, fills `NativeBridge.driveSync` (AuthorizationClient with `drive.appdata` → Drive
REST: find / create `attune-sync.attune`), puts "Sync with Google Drive" in Backup, and builds the Family circle on it
(shared lists merge item by item — `mergeList` in cloud.js is already tested).

## B. Paid web search for Pro

What it does: when the free engines find nothing, a Pro phone asks Attune's small relay, which searches Google through
Serper with Ali's key and opens the top pages. The key stays on the relay, never in the app.

1. **Serper key**: sign up at https://serper.dev (2,500 free searches to try; then about $1 per 1,000 searches, paid as
   credit packs, no monthly bill) → **API key** → copy.
2. **Cloudflare (free)**: sign up at https://dash.cloudflare.com (Workers free plan: 100,000 requests a day).
3. On a computer with Node installed, from the repo:
   ```
   cd tools/pro-search-relay
   npx wrangler login
   npx wrangler secret put SERPER_KEY        # paste the Serper key
   npx wrangler kv namespace create LIMITS   # optional daily cap per phone; paste the id into wrangler.toml
   npx wrangler deploy
   ```
   It prints the address, like `https://attune-search.<your-name>.workers.dev`.
4. Send Claude that address. Claude puts it in `CLOUD.proSearchUrl`, and Pro phones start using it.

Cost guide: 150 searches per phone per day is the cap in `worker.js` (`DAILY_CAP`); a typical Pro user does 5–20 a day,
so 100 Pro users ≈ 30,000 searches a month ≈ $30.

Later (when Play billing is live): the relay can check the Play purchase token before answering. That needs a Google
service account with Play Console access; Claude will add it then.

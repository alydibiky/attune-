# Setting up the parts that need Ali's accounts (v6.32)

The code is in: `web-src/cloud.js` (sync, Family circle lists, Pro search), `NativeBridge.driveSync` (the phone side, waiting
for the client id), `tools/pro-search-relay/` (the search relay). Nothing shows in the app until the ids below are filled in
`CLOUD` at the top of `web-src/cloud.js`. Send Claude the two values (they are not secrets) and it finishes the wiring.

## A. Google sign-in + Drive sync — WIRED in v6.37 (Backup → Sync → Google Drive); only the Google Cloud part is left

The app side is done: `GoogleDrive.kt` (one file `attune-sync.attune` in the hidden app folder), Google's sign-in screen
(`MainActivity.authorizeDrive`, AuthorizationClient, scope `drive.appdata`), `web-src/sync.js` + `sync-ui.jsx` (the file is
locked with the person's sync passphrase on the phone). It works as soon as Google knows the app:

1. https://console.cloud.google.com → **New project** → `Attune` → Create.
2. **APIs & Services → Library** → **Google Drive API** → **Enable**.
3. **Google Auth Platform** (OAuth consent screen): External; name `Attune`; support email `alydibiky@gmail.com`;
   **Data access → Add scopes** → `.../auth/drive.appdata` (non-sensitive: no security review); **Audience → Test users** → your
   Gmail (press **Publish app** before the Play release).
4. **Clients → Create client → Android**, package `com.aldibiki.attune`, SHA-1 of the test key (the "Build the APK" key):
   `0D:B6:88:FA:EE:3D:1A:29:EF:B1:EC:BF:F1:21:3C:F9:AA:8E:48:A1`
   Later, a second Android client with the SHA-1 from **Play Console → App integrity → App signing key certificate**.
   No Web client, no secret, nothing to send to Claude — the phone is matched by package + SHA-1.
5. (v6.45, the Windows app) **Clients → Create client → Desktop app**, name `Attune for Windows` → copy the **Client ID** and
   **Client secret** (Google says a desktop client's secret is not secret — it ships inside the app) → paste both in the chat
   with Claude, who puts them in `desktop/lib/gdrive.js` (CLIENT) — or save them yourself as
   `%APPDATA%\Attune\google-client.json`: `{"id": "…apps.googleusercontent.com", "secret": "…"}`. Then Backup → Sync →
   Google Drive on the computer opens Google's sign-in page once in the browser.

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

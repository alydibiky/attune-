# Huawei watch → Attune, the way Yazio does it (Ali, 27 Oct 2026)

**What Yazio does** ([Yazio help: "Yazio and Huawei Health"](https://help.yazio.com/hc/en-us/articles/360016191217-Yazio-and-Huawei-Health)):
Profile → Automatic tracking → Huawei Health → switch on → allow everything. It reads steps, workouts, burned calories,
distance and weight straight from **Huawei Health Kit** (Huawei's own cloud/phone store), one way, and its numbers "should
be the same as those displayed in Huawei Health". No Health Sync, no Health Connect in between — that is why it is smooth
and the numbers match.

**Attune already has the same code** (`app/src/main/java/com/aldibiki/attune/HuaweiHealth.kt`: Huawei ID sign-in, read-only
steps / calories / distance / heart rate, the "Connect Huawei Health" button in Fit → Me). It is OFF because Huawei only
lets a registered app read Health Kit. That registration is done **once, by you (the app's owner)** — no user ever sees it:

## Steps (about 30 minutes, then Huawei reviews Health Kit access, usually a few working days)
1. Go to <https://developer.huawei.com/consumer/en/> → sign in with a Huawei ID → **Identity verification** (individual is fine).
2. **AppGallery Connect → My projects → Add project** "Attune" → **Add app**: Android, package `com.aldibiki.attune`.
3. **Project settings → App information → SHA-256 certificate fingerprint** — add BOTH:
   - test builds (the APK from GitHub "Build the APK"):
     `95:ED:98:12:B5:5C:6C:66:4F:AF:AD:51:3D:CF:34:E4:DE:91:4D:54:EB:83:2E:FB:5B:68:77:23:D5:2F:9F:65`
   - the Play Store key (when you have it: Play Console → App integrity → App signing key SHA-256).
4. **Huawei Developers → Console → HMS API services → Health Kit → Apply**: choose *Read* for **Steps, Calories, Distance,
   Heart rate** (and Weight if you want it later). Purpose: "show the user's own activity next to their food log; read only,
   kept on the phone". Attach the privacy policy link.
5. Copy the **App ID** (App information) and send it to me — or put it in `gradle.properties`: `attune.hmsAppId=<App ID>`.
   I then build the APK; Fit → Me shows **Connect Huawei Health** → one tap, allow → the watch's own numbers, like Yazio.

Until then the Health Sync route keeps working, with the v8.6 corrections (your body, your watch's own ratio, "Match my watch").

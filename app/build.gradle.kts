plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.aldibiki.attune"
    compileSdk = 36   // v6.36: the API-37 platform (android-37.0) needs AGP 9.1+; targetSdk below is Android 17 all the same

    defaultConfig {
        applicationId = "com.aldibiki.attune"
        minSdk = 28                 // Android 9: the engine uses system functions added in Android 9 (llama.cpp's own Android builds target the same)
        targetSdk = 37   // v6.35: Android 17 (API 37); minSdk 28 keeps Android 9 – 16 phones. Checked against Google's "behavior changes for apps targeting 17": no writable native libraries, no background activity starts, no widget bitmaps, no SMS
        versionCode = System.getenv("ATTUNE_VERSION_CODE")?.toIntOrNull() ?: 117   // CI: 1000 + the run number, so every build installs over the last and Play accepts each upload
        versionName = "7.5"

        // The on-device engine (llama.cpp) is native code. arm64 is every real
        // phone. Add "x86_64" only if you want to run it in the emulator — it
        // roughly doubles the build time.
        ndk { abiFilters += listOf("arm64-v8a") }
        // Huawei Health Kit (v6.5): the App ID of Attune's AppGallery Connect app, from gradle.properties
        // (attune.hmsAppId). Empty = the direct Huawei link is off and the app offers Health Sync instead.
        manifestPlaceholders["hmsAppId"] = (project.findProperty("attune.hmsAppId") as String?)?.trim().orEmpty()
        externalNativeBuild {
            cmake {
                // Always optimise the engine, even in debug builds: an
                // unoptimised llama.cpp is 10-50x slower and useless for testing.
                arguments += "-DCMAKE_BUILD_TYPE=Release"
                // One shared C++ runtime for all the engine's libraries.
                arguments += "-DANDROID_STL=c++_shared"
            }
        }
    }

    // Two builds of the same app (v6.27): "full" = everything, with the payment-notification reader (src/full/
    // AndroidManifest.xml) — the APK CI uploads as attune-apk and the Play Store bundle; "lite" = the same without the
    // reader, for phones whose Play Protect blocks a notification reader installed from a browser / file manager / chat.
    flavorDimensions += "store"
    productFlavors {
        create("full") { dimension = "store" }
        create("lite") { dimension = "store" }
    }

    // The NDK llama.cpp's own Android release builds use at the pinned commit.
    // Install it (and CMake 3.31.6) in Android Studio → Settings → Android SDK →
    // SDK Tools, with "Show Package Details" ticked to pick exact versions.
    // If you already have a different NDK 29.x, put its number here instead.
    ndkVersion = "29.0.14206865"

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.31.6"
        }
    }

    packaging {
        // The engine ships one CPU library per ARM generation and picks the
        // fastest at start-up by looking in the app's library folder. That
        // folder is only filled if Android unpacks the libraries on install.
        jniLibs {
            useLegacyPackaging = true
            // The OpenCL loader is only for linking the GPU backend; on the
            // phone the vendor's own libOpenCL.so must be used.
            excludes += "**/libOpenCL.so"
            // The fast engine's library may bring its own copy of the C++
            // runtime; one copy is enough.
            pickFirsts += "**/libc++_shared.so"
        }
    }

    // Signing comes from environment variables so the keystore never enters
    // the repository. The CI workflow writes it from a secret at build time.
    signingConfigs {
        // A FIXED key for test builds, committed on purpose (app/attune-test.keystore,
        // passwords "attune-test"). Without it every GitHub run signs with a
        // brand-new random debug key, Android refuses to install the new APK
        // over the old one, and the only way forward — uninstalling — deletes
        // every chat and the whole ledger. Not for the Play Store: that uses
        // the ATTUNE_KEYSTORE secrets below.
        create("test") {
            storeFile = file("attune-test.keystore")
            storePassword = "attune-test"
            keyAlias = "attune-test"
            keyPassword = "attune-test"
        }
        create("release") {
            val ks = System.getenv("ATTUNE_KEYSTORE") ?: ""
            if (ks.isNotEmpty()) {
                storeFile = file(ks)
                storePassword = System.getenv("ATTUNE_STORE_PASSWORD")
                keyAlias = System.getenv("ATTUNE_KEY_ALIAS")
                keyPassword = System.getenv("ATTUNE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false          // the app is one HTML file; nothing to shrink
            signingConfig = if ((System.getenv("ATTUNE_KEYSTORE") ?: "").isNotEmpty())
                signingConfigs.getByName("release") else signingConfigs.getByName("test")
            // v6.29 release safety: only a build signed with the TEST key may turn on developer mode (the 7-tap Pro unlock);
            // a Play build signed with the real key never can
            resValue("bool", "attune_test_build", (System.getenv("ATTUNE_KEYSTORE") ?: "").isEmpty().toString())
        }
        debug { applicationIdSuffix = ".debug"; resValue("bool", "attune_test_build", "true") }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // The .html is already minified; compressing it again in the APK only
    // slows the first load.
    androidResources { noCompress += listOf("html", "wasm", "whl", "zip") }   // Python for the code sandbox: already compressed, read faster raw
}

// (kotlinOptions {} is an error from Kotlin 2.2 on; this is its replacement.)
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    // Reads DuckDuckGo results and the text of result pages for web lookup.
    implementation("org.jsoup:jsoup:1.18.3")
    // The fast engine: Google's LiteRT-LM (Apache-2.0) runs .litertlm models
    // such as Gemma 4 E2B/E4B on the phone's GPU, with multi-token prediction.
    // Pinned, not "latest.release": a build must not change by itself.
    implementation("com.google.ai.edge.litertlm:litertlm-android:0.17.1")
    // v6.38 Studio eraser: ONNX Runtime (MIT) runs MI-GAN (MIT, a 28 MB pack) on the CPU — paint over a person, it is gone.
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.29.0")
    // File Converter (v5.36): the text of PDF pages, on the phone. PdfBox-Android, Apache-2.0.
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")
    // Fit & Food (v6.1): barcodes read on the phone from a photo — ML Kit with its model bundled
    // (works offline, nothing uploaded). Apache-2.0 SDK terms from Google.
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    // v6.43 (Ali: "scan the barcode by opening the camera and targeting it, not just from the gallery"): Google's code scanner —
    // a live camera screen run by Google Play services; the app needs no camera permission and gets only the number.
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    // v6.43 (Ali: "the image part exactly like my Honor phone"): every person / thing in a photo as its own shape — tap to erase,
    // remove passers-by, cut out. ML Kit subject segmentation via Play services (on the phone, fetched once).
    implementation("com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1")
    // v6.16c: the text in a food photo (a menu, a delivery app, a label: «Big BAIK … 1000 kcal») read on the phone — Latin model bundled
    implementation("com.google.mlkit:text-recognition:16.0.1")
    // Fit & Food (v6.3): steps, calories burned and workouts from the watch apps, through Android's
    // Health Connect (read only). Coroutines: its API is suspend functions.
    // (1.1.0 final: compileSdk 36 + AGP 8.9.1, which v6.29 builds with)
    implementation("androidx.health.connect:connect-client:1.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    // Huawei watches (v6.5): Huawei Health's data through Huawei's Health Kit, read only — the way
    // Yazio connects to Huawei Health. Version from Huawei's own Kotlin demo (HMS-Core/hms-health-demo-kotlin).
    implementation("com.huawei.hms:health:6.11.0.303")
    // Google Play Billing (v6.7): Pro subscriptions / lifetime and Business activations — Google charges,
    // renews, refunds and pays out; nothing to run on our side.
    implementation("com.android.billingclient:billing-ktx:7.1.1")
    // v6.37 Google sync: Google's sign-in/consent for the Drive app folder (drive.appdata); the Drive calls are plain https
    implementation("com.google.android.gms:play-services-auth:21.3.0")
}

// v6.29 release safety: a Play Store bundle must be signed with the real upload key — never silently with the test key
// (its passwords are in this repository). Without ATTUNE_KEYSTORE, bundle…Release stops with a clear message.
gradle.taskGraph.whenReady {
    if (allTasks.any { it.name.startsWith("bundle") && it.name.endsWith("Release") } && (System.getenv("ATTUNE_KEYSTORE") ?: "").isEmpty())
        throw GradleException("A release bundle needs the upload key: set ATTUNE_KEYSTORE (and its passwords). It is never signed with the test key.")
}

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.aldibiki.attune"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.aldibiki.attune"
        minSdk = 28                 // Android 9: the engine uses system functions added in Android 9 (llama.cpp's own Android builds target the same)
        targetSdk = 35
        versionCode = 2
        versionName = "2.0"

        // The on-device engine (llama.cpp) is native code. arm64 is every real
        // phone. Add "x86_64" only if you want to run it in the emulator — it
        // roughly doubles the build time.
        ndk { abiFilters += listOf("arm64-v8a") }
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
        jniLibs { useLegacyPackaging = true }
    }

    // Signing comes from environment variables so the keystore never enters
    // the repository. The CI workflow writes it from a secret at build time.
    signingConfigs {
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
                signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
        debug { applicationIdSuffix = ".debug" }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    // The .html is already minified; compressing it again in the APK only
    // slows the first load.
    androidResources { noCompress += listOf("html") }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    // Reads DuckDuckGo results and the text of result pages for web lookup.
    implementation("org.jsoup:jsoup:1.18.3")
}

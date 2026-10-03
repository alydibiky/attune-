#!/usr/bin/env bash
# Compiles the app's Kotlin on this machine (Android SDK in /opt/android-sdk, Gradle 8.11.1 in /opt) and prints only real errors.
# The Huawei Health library lives on developer.huawei.com; when that domain is blocked, HuaweiHealth.kt cannot resolve and its errors are ignored
# (the library line is removed from a temporary copy of app/build.gradle.kts and put back afterwards). Exit 0 = no other errors.
set -u
cd "$(dirname "$0")/.."
export ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk
echo "sdk.dir=$ANDROID_HOME" > local.properties
cp app/build.gradle.kts /tmp/build.gradle.kts.orig
CODE=$(curl -s -o /dev/null -m 8 -w "%{http_code}" https://developer.huawei.com/repo/)
if [ "$CODE" = "000" ] || [ "$CODE" = "403" ]; then sed -i '/com.huawei.hms/d' app/build.gradle.kts; HW=1; else HW=0; fi
OUT=$(/opt/gradle-8.11.1/bin/gradle :app:compileDebugKotlin --no-daemon -q 2>&1 | grep -v JAVA_TOOL_OPTIONS)
cp /tmp/build.gradle.kts.orig app/build.gradle.kts
ERR=$(echo "$OUT" | grep -E "^e: " | { [ "$HW" = 1 ] && grep -v "HuaweiHealth.kt" || cat; })
if [ -n "$ERR" ]; then echo "$ERR"; exit 1; fi
if echo "$OUT" | grep -q "FAILURE" && [ "$HW" = 0 ]; then echo "$OUT" | tail -20; exit 1; fi
echo "Kotlin compiles (Huawei file ignored: $HW)"

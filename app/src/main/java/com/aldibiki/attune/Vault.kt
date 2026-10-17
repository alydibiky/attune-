package com.aldibiki.attune

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal

/**
 * v6.32 Private vault: the phone's own fingerprint / face / screen lock opens Money, Cycle, Family health and documents
 * when the person turned the vault on (roadmap "Private vault with fingerprint"). Nothing is stored here: Android checks
 * the finger and only says yes or no. The page decides which places are locked (web-src/vault.js).
 */
object Vault {
    /** What this phone can use: a fingerprint or face, and whether a screen lock is set at all. */
    fun available(ctx: Context): String {
        val km = ctx.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        val secure = km?.isDeviceSecure == true
        var bio = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bm = ctx.getSystemService(BiometricManager::class.java)
            bio = bm?.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            @Suppress("DEPRECATION")
            bio = ctx.getSystemService(BiometricManager::class.java)?.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS
        } else {
            bio = ctx.packageManager.hasSystemFeature("android.hardware.fingerprint")
        }
        return "{\"bio\":$bio,\"secure\":$secure}"
    }

    /** Shows the system prompt; ok() on success, fail(reason) when cancelled or not possible. Must run on the main thread. */
    fun prompt(act: Activity, title: String, subtitle: String, cancel: String, ok: () -> Unit, fail: (String) -> Unit) {
        try {
            val b = BiometricPrompt.Builder(act).setTitle(title)
            if (subtitle.isNotEmpty()) b.setSubtitle(subtitle)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // the fingerprint OR the phone's own PIN / pattern, so nobody is ever locked out of their data
                b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                @Suppress("DEPRECATION") b.setDeviceCredentialAllowed(true)
            } else {
                b.setNegativeButton(cancel, act.mainExecutor) { _, _ -> fail("cancelled") }
            }
            b.build().authenticate(CancellationSignal(), act.mainExecutor, object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult?) = ok()
                override fun onAuthenticationError(code: Int, msg: CharSequence?) = fail(msg?.toString() ?: "cancelled")
            })
        } catch (e: Exception) { fail(e.message ?: "not available") }
    }
}

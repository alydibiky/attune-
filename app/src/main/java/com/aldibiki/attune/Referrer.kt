package com.aldibiki.attune

import android.content.Context
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener

/**
 * v8.7 (Ali picked persona 3's point 9, "give a friend a month"): the link a friend shares is the Play Store page with
 * referrer=attune_ref%3D<code>. Google Play hands that string to the app once, on the phone (Install Referrer library,
 * Apache-2.0) — nothing is sent anywhere. The page reads it (NativeBridge.installReferrer) and gives the new person a month.
 */
object Referrer {
    private fun sp(ctx: Context) = ctx.getSharedPreferences("attune", Context.MODE_PRIVATE)

    fun fetchOnce(ctx: Context) {
        val prefs = sp(ctx)
        if (prefs.getBoolean("referrer_read", false)) return
        val client = try { InstallReferrerClient.newBuilder(ctx.applicationContext).build() } catch (e: Throwable) { return }
        try {
            client.startConnection(object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(code: Int) {
                    try {
                        when (code) {
                            InstallReferrerClient.InstallReferrerResponse.OK -> {
                                val r = client.installReferrer.installReferrer ?: ""
                                prefs.edit().putString("install_referrer", r).putBoolean("referrer_read", true).apply()
                            }
                            InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED ->
                                prefs.edit().putBoolean("referrer_read", true).apply()
                            else -> {}
                        }
                    } catch (e: Throwable) {}
                    try { client.endConnection() } catch (e: Throwable) {}
                }
                override fun onInstallReferrerServiceDisconnected() {}
            })
        } catch (e: Throwable) {}
    }

    fun get(ctx: Context): String = sp(ctx).getString("install_referrer", "") ?: ""
}

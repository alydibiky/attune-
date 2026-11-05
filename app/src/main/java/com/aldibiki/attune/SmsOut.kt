package com.aldibiki.attune

import android.content.Context
import android.content.pm.PackageManager

/** v9.7 Messages, M3: an SMS sent by itself at its time — only in the "full" APK (SEND_SMS is declared in src/full only; Google Play
 *  limits it) and only after the person allows SMS. The Play build opens the SMS app with the words written instead. */
object SmsOut {
    fun declared(ctx: Context): Boolean = try {
        ctx.packageManager.getPackageInfo(ctx.packageName, PackageManager.GET_PERMISSIONS).requestedPermissions?.contains(android.Manifest.permission.SEND_SMS) == true
    } catch (e: Exception) { false }
    fun allowed(ctx: Context): Boolean = declared(ctx) && ctx.checkSelfPermission(android.Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED
    fun send(ctx: Context, phone: String, text: String): Boolean = try {
        val sm = if (android.os.Build.VERSION.SDK_INT >= 31) ctx.getSystemService(android.telephony.SmsManager::class.java) else @Suppress("DEPRECATION") android.telephony.SmsManager.getDefault()
        val parts = sm.divideMessage(text)
        if (parts.size > 1) sm.sendMultipartTextMessage(phone, null, parts, null, null) else sm.sendTextMessage(phone, null, text, null, null)
        true
    } catch (e: Exception) { false }
}

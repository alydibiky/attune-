package com.aldibiki.attune

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject

/**
 * v9.7 Messages, M3 (Ali, 6 Nov 2026: "like the Auto Text app"): "Send by itself" for WhatsApp — at the message's time Attune opens
 * the chat with the words written (wa.me), and this Accessibility service presses that chat's Send button, then goes back.
 * Only in the "full" APK (declared in src/full/AndroidManifest.xml — never in the Play build, whose policy limits Accessibility to
 * accessibility tools); only after the person turns it on in Android's Accessibility settings, after Attune's own screen that says
 * exactly what it does; it acts ONLY on WhatsApp / WhatsApp Business, ONLY within 25 seconds of a scheduled message Attune opened
 * itself, and ONLY when the text in the chat's box is that message. Phone locked → it can't; the "tap to send" notification comes.
 */
class AutoSend : AccessibilityService() {
    companion object {
        private val PKGS = setOf("com.whatsapp", "com.whatsapp.w4b")
        @Volatile private var pending: JSONObject? = null
        @Volatile private var until = 0L
        /** Declared in this build, switched on by the person, and the phone is unlocked. */
        fun available(ctx: Context): Boolean = try { ctx.packageManager.getServiceInfo(ComponentName(ctx, AutoSend::class.java), 0); true } catch (e: Exception) { false }
        fun enabled(ctx: Context): Boolean {
            if (!available(ctx)) return false
            val flat = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
            val me = ComponentName(ctx, AutoSend::class.java).flattenToString()
            return flat.split(":").any { it.equals(me, true) }
        }
        fun ready(ctx: Context): Boolean = enabled(ctx) && !((ctx.getSystemService(android.app.KeyguardManager::class.java))?.isKeyguardLocked ?: true)
        fun openSettings(ctx: Context) { try { ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { } }
        /** A scheduled message is about to open in WhatsApp: press its Send within 25 s; if not, the tap-to-send notification comes. */
        fun arm(ctx: Context, id: String, snd: JSONObject) {
            pending = JSONObject(snd.toString()).put("id", id); until = System.currentTimeMillis() + 25_000L
            val app = ctx.applicationContext
            Handler(Looper.getMainLooper()).postDelayed({
                val p = pending ?: return@postDelayed
                if (p.optString("id") != id) return@postDelayed
                pending = null
                Reminders.deliver(app, id, JSONObject(p.toString()).put("auto", false).put("key", ""))   // the one-tap way, logged as "opened"
            }, 26_000L)
        }
    }

    override fun onAccessibilityEvent(e: AccessibilityEvent?) {
        val p = pending ?: return
        if (System.currentTimeMillis() > until) { return }
        val pkg = e?.packageName?.toString() ?: return
        if (pkg !in PKGS) return
        val root = rootInActiveWindow ?: return
        val want = p.optString("text").trim()
        // the chat's typing box must hold exactly our words — never press Send on anything else
        val box = (root.findAccessibilityNodeInfosByViewId("$pkg:id/entry") ?: emptyList()).firstOrNull()
        val typed = box?.text?.toString()?.trim().orEmpty()
        if (want.isEmpty() || typed.isEmpty() || !(typed == want || typed.replace("\\s+".toRegex(), " ") == want.replace("\\s+".toRegex(), " "))) return
        val send = (root.findAccessibilityNodeInfosByViewId("$pkg:id/send") ?: emptyList()).firstOrNull()
            ?: findByDesc(root, setOf("send", "إرسال", "ارسال", "envoyer", "enviar", "senden", "gönder", "kirim"))
            ?: return
        val clicked = send.isEnabled && (send.performAction(AccessibilityNodeInfo.ACTION_CLICK) || (send.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false))
        if (!clicked) return
        pending = null
        Reminders.log(applicationContext, JSONObject().put("id", p.optString("id")).put("how", "auto").put("ok", true).put("who", p.optString("who")).put("app", p.optString("app", "whatsapp")).put("text", want))
        Handler(Looper.getMainLooper()).postDelayed({ performGlobalAction(GLOBAL_ACTION_BACK); performGlobalAction(GLOBAL_ACTION_BACK) }, 900L)
    }

    private fun findByDesc(n: AccessibilityNodeInfo?, words: Set<String>, depth: Int = 0): AccessibilityNodeInfo? {
        if (n == null || depth > 40) return null
        val d = n.contentDescription?.toString()?.trim()?.lowercase()
        if (d != null && d in words && n.isClickable) return n
        for (i in 0 until n.childCount) findByDesc(n.getChild(i), words, depth + 1)?.let { return it }
        return null
    }

    override fun onInterrupt() {}
}

package com.aldibiki.attune

/**
 * v6.40 — Message alerts (Ali: "I tell the app: if X sends me a message, tell me — from WhatsApp, Gmail or any email").
 * The pure part, tested off the phone (tests/kotlin/WatchMatchTest.kt): does this notification (app package, title, text)
 * match a rule? A rule: who (names — any one), app (any | whatsapp | email | gmail | telegram | messenger | instagram |
 * signal | teams | slack), words (optional — any one must appear). Names match whole words, Arabic letters folded
 * (أ إ آ → ا, ة → ه, ى → ي), Latin case-free; "Ahmed" also matches "Ahmed Samir" and «أحمد».
 * SMS apps are never watched (Attune promises it never reads SMS).
 */
data class WatchRule(val id: String, val who: List<String>, val app: String = "any", val words: List<String> = emptyList(), val once: Boolean = false, val on: Boolean = true)

object WatchMatch {
    val APPS: Map<String, Set<String>> = mapOf(
        "whatsapp" to setOf("com.whatsapp", "com.whatsapp.w4b"),
        "gmail" to setOf("com.google.android.gm"),
        "email" to setOf("com.google.android.gm", "com.microsoft.office.outlook", "com.samsung.android.email.provider", "com.yahoo.mobile.client.android.mail",
            "ch.protonmail.android", "com.huawei.email", "com.android.email", "com.google.android.gm.lite", "com.readdle.spark", "me.bluemail.mail", "com.easilydo.mail"),
        "telegram" to setOf("org.telegram.messenger", "org.telegram.messenger.web", "org.thunderdog.challegram"),
        "messenger" to setOf("com.facebook.orca", "com.facebook.mlite"),
        "instagram" to setOf("com.instagram.android"),
        "signal" to setOf("org.thoughtcrime.securesms"),
        "teams" to setOf("com.microsoft.teams"),
        "slack" to setOf("com.Slack"),
    )
    /** Every app a rule with app = "any" listens to (chats and email; never SMS). */
    val ANY: Set<String> = APPS.values.flatten().toSet() + setOf("com.viber.voip", "jp.naver.line.android", "com.imo.android.imoim", "com.discord", "com.linkedin.android")
    private val SMS = setOf("com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms", "com.android.messaging",
        "com.hihonor.mms", "com.huawei.message", "com.miui.mms", "com.oneplus.mms", "com.coloros.mms", "com.vivo.message")
    /** v6.40: an SMS app (by its name or its kind) — Attune never reads these, for alerts or for Recall. */
    fun isSms(pkg: String): Boolean = pkg in SMS || Regex("(^|\\.)(mms|sms)(\\.|$)|\\.messaging$|\\.message$").containsMatchIn(pkg)

    fun fold(s: String): String = s.lowercase()
        .replace(Regex("[أإآ]"), "ا").replace("ى", "ي").replace(Regex("ة(?=\\s|$)"), "ه")
        .replace(Regex("[\\u064B-\\u0652\\u0640]"), "")
        .replace(Regex("[^\\p{L}\\p{N}@.]+"), " ").trim()

    private fun hasWord(hay: String, w: String): Boolean {
        val n = fold(w); if (n.isEmpty()) return false
        if (n.contains("@") || n.contains(".")) return hay.contains(n)   // an email address or a domain
        return Regex("(^|\\s)" + Regex.escape(n) + "($|\\s)").containsMatchIn(hay)
    }

    /** SMS notifications may be read (the person's switch, Prefs.smsNotifs — off by default). Set by PayListener. */
    @Volatile var smsAllowed: Boolean = false

    fun appOk(rule: WatchRule, pkg: String): Boolean {
        if (isSms(pkg)) return smsAllowed && (rule.app == "any" || rule.app == "sms")
        // v8.0 Agents: "pkgs:com.amazon.mShop.android.shopping|com.noon.buyerapp" — a delivery agent listens to those apps only
        if (rule.app.startsWith("pkgs:")) return pkg in rule.app.removePrefix("pkgs:").split('|').filter { it.isNotBlank() }
        return if (rule.app == "any") pkg in ANY else pkg in (APPS[rule.app] ?: emptySet())
    }

    /** The sender is in the title (WhatsApp, Telegram: "Ahmed" or "Ahmed @ Family group"; Gmail: the sender's name); some
     *  email apps put "Ahmed <a@b.com>" in the text, so both are searched — the words in the title or the text. */
    fun matches(rule: WatchRule, pkg: String, title: String, text: String, sub: String = ""): Boolean {
        if (!rule.on || !appOk(rule, pkg)) return false
        val t = fold("$title $sub"); val all = fold("$title $sub $text")
        if (rule.who.isNotEmpty() && rule.who.none { hasWord(t, it) || (pkg !in (APPS["whatsapp"] ?: emptySet()) && hasWord(all, it)) }) return false
        if (rule.words.isNotEmpty() && rule.words.none { hasWord(all, it) }) return false
        return rule.who.isNotEmpty() || rule.words.isNotEmpty()
    }

    fun appName(pkg: String): String = when {
        pkg in (APPS["whatsapp"] ?: emptySet()) -> "WhatsApp"
        pkg in (APPS["gmail"] ?: emptySet()) -> "Gmail"
        pkg in (APPS["telegram"] ?: emptySet()) -> "Telegram"
        pkg in (APPS["messenger"] ?: emptySet()) -> "Messenger"
        pkg in (APPS["instagram"] ?: emptySet()) -> "Instagram"
        pkg in (APPS["email"] ?: emptySet()) -> "Email"
        else -> ""
    }
}

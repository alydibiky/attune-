package com.aldibiki.attune

/**
 * v6.41 (upgrade C3) — automations the person describes ("when my salary arrives, put 20% in the car fund and tell me"),
 * written once as a rule by the page (autom.js) and checked here with no AI, on every money notification (PayListener).
 * Pure (no Android) so tests/kotlin/AutoMatchTest.kt runs it. AutoRules.kt keeps the rules and posts the alert.
 */
data class AutoRule(val id: String, val words: List<String>, val pct: Double, val fixed: Double, val pot: String, val on: Boolean = true, val dir: String = "in")

object AutoMatch {
    private val AMOUNT = Regex("(?i)(?:egp|le|l\\.e\\.?|ج\\.م|جنيه|usd|\\$|eur|€|sar|aed)\\s*([\\d٠-٩][\\d٠-٩,٬]*(?:[.٫][\\d٠-٩]{1,2})?)|([\\d٠-٩][\\d٠-٩,٬]*(?:[.٫][\\d٠-٩]{1,2})?)\\s*(?:egp|le\\b|l\\.e|ج\\.م|جنيه|جم|usd|eur|sar|aed)")
    private val IN = Regex("(?i)credited|received|deposit|salary|payroll|transfer(?:red)? to you|إيداع|ايداع|تم إضافة|تم اضافة|استلام|راتب|مرتب|وارد")
    private val OUT = Regex("(?i)debited|purchase|spent|charged|paid|withdraw|خصم|شراء|سحب|دفع")

    private fun digits(s: String) = s.map { c -> if (c in '٠'..'٩') ('0' + (c - '٠')) else c }.joinToString("").replace("٬", "").replace(",", "").replace("٫", ".")

    /** The money amount in a notification (the biggest one next to a currency), or null. */
    fun amountIn(text: String): Double? = AMOUNT.findAll(text).mapNotNull { m -> digits(m.groupValues[1].ifEmpty { m.groupValues[2] }).toDoubleOrNull() }.maxOrNull()

    /** Does the notification fire this rule? Its words (any of them, folded like the message alerts) and its direction. */
    fun matches(r: AutoRule, title: String, text: String): Boolean {
        if (!r.on) return false
        val hay = " " + WatchMatch.fold("$title $text") + " "
        if (r.words.isNotEmpty() && r.words.none { w -> val f = WatchMatch.fold(w); f.isNotEmpty() && hay.contains(" $f ") || (f.length >= 4 && hay.contains(f)) }) return false
        val all = "$title $text"
        return when (r.dir) { "in" -> IN.containsMatchIn(all) && !Regex("(?i)debited|خصم").containsMatchIn(all); "out" -> OUT.containsMatchIn(all); else -> true }
    }

    /** What to set aside: pct of the amount (rounded to a whole pound) or the fixed sum; null when no amount is read. */
    fun share(r: AutoRule, amount: Double?): Double? = when {
        r.fixed > 0 -> r.fixed
        amount == null || r.pct <= 0 -> null
        else -> Math.round(amount * r.pct / 100.0).toDouble()
    }
}

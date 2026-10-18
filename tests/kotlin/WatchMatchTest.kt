import com.aldibiki.attune.WatchMatch
import com.aldibiki.attune.WatchRule

var fails = 0
fun check(ok: Boolean, what: String) { println((if (ok) "PASS " else "FAIL ") + what); if (!ok) fails++ }

fun main() {
    val ahmed = WatchRule("1", listOf("Ahmed", "أحمد"))
    check(WatchMatch.matches(ahmed, "com.whatsapp", "Ahmed Samir", "ya Ali ana gay"), "WhatsApp from Ahmed Samir")
    check(WatchMatch.matches(ahmed, "com.whatsapp", "احمد", "انا جاي"), "«احمد» without the hamza matches «أحمد»")
    check(!WatchMatch.matches(ahmed, "com.whatsapp", "Ahmedabad trip", "x"), "a name inside another word does not")
    check(!WatchMatch.matches(ahmed, "com.whatsapp", "Mona", "Ahmed said hi"), "on WhatsApp the sender is the title, not a name in the text")
    check(WatchMatch.matches(ahmed, "com.google.android.gm", "Ahmed Fathy", "Invoice for October"), "Gmail from Ahmed (any app)")
    check(!WatchMatch.matches(ahmed, "com.google.android.apps.messaging", "Ahmed", "hi"), "SMS apps are never watched")
    check(WatchMatch.isSms("com.hihonor.mms") && WatchMatch.isSms("com.example.sms.app") && !WatchMatch.isSms("org.thoughtcrime.securesms") && !WatchMatch.isSms("com.whatsapp"), "isSms: Honor and other SMS apps; Signal and WhatsApp are chats")
    check(!WatchMatch.matches(ahmed, "com.example.game", "Ahmed", "hi"), "games and other apps are not watched")
    val hr = WatchRule("2", listOf("hr@company.com"), app = "email")
    check(WatchMatch.matches(hr, "com.microsoft.office.outlook", "HR Team", "From hr@company.com: your contract"), "an email address in the text (Outlook)")
    check(!WatchMatch.matches(hr, "com.whatsapp", "HR Team", "hr@company.com"), "an email rule ignores WhatsApp")
    val bank = WatchRule("3", listOf("CIB"), app = "gmail", words = listOf("statement", "كشف"))
    check(WatchMatch.matches(bank, "com.google.android.gm", "CIB Egypt", "Your monthly statement is ready"), "Gmail from CIB with the word «statement»")
    check(!WatchMatch.matches(bank, "com.google.android.gm", "CIB Egypt", "New offer for you"), "…not without the word")
    val word = WatchRule("4", emptyList(), words = listOf("ونش"))
    check(WatchMatch.matches(word, "com.whatsapp", "Client", "محتاج ونش 50 طن"), "any message with the word «ونش»")
    check(!WatchMatch.matches(WatchRule("5", listOf("Ahmed"), on = false), "com.whatsapp", "Ahmed", "hi"), "a paused rule is quiet")
    check(WatchMatch.appName("com.whatsapp.w4b") == "WhatsApp", "WhatsApp Business is WhatsApp")
    if (fails > 0) { println("$fails FAILED"); kotlin.system.exitProcess(1) } else println("ALL PASSED")
}

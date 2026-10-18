// v6.37 X1: Franco-Arabic → Arabic. Run: bash tests/kotlin/run.sh
import com.aldibiki.attune.Franco

var failed = 0
fun ok(c: Boolean, m: String) { println((if (c) "PASS " else "FAIL ") + m); if (!c) failed++ }

fun main() {
    ok(Franco.text("ana gay bokra") == "أنا جاي بكرة", "ana gay bokra → " + Franco.text("ana gay bokra"))
    ok(Franco.text("inshallah") == "إن شاء الله", "inshallah")
    ok(Franco.text("7abibi, enta fen?") == "حبيبي، إنت فين؟", "comma and question mark → " + Franco.text("7abibi, enta fen?"))
    ok(Franco.text("mesh 3aref") == "مش عارف", "mesh 3aref")
    ok(Franco.word("elbeit") == "البيت", "el + a known word → " + Franco.word("elbeit"))
    ok(Franco.word("3amalt") == "عملت", "rules: 3amalt → " + Franco.word("3amalt"))
    ok(Franco.word("5aled") == "خالد", "rules: 5aled → " + Franco.word("5aled"))
    ok(Franco.word("shukri") == "شكري", "sh + final i → " + Franco.word("shukri"))
    ok(Franco.word("Ahmed") == "أحمد", "a capital and a vowel at the start → " + Franco.word("Ahmed"))
    ok(Franco.word("2amar") == "أمر", "2 at the start = أ → " + Franco.word("2amar"))
    ok(Franco.text("call me at 10") == Franco.text("call me at 10") && Franco.text("at 10").endsWith("10"), "numbers stay numbers")
    ok(Franco.word("ali@mail.com") == "ali@mail.com" && Franco.word("www.x.com") == "www.x.com", "e-mails and links stay")
    ok(Franco.word("lol") == "lol", "kept words stay")
    ok(Franco.word("ezayak") == "إزيك" && Franco.word("tamam") == "تمام", "greetings")
    ok(Franco.word("ba7ebak") == "بحبك", "ba7ebak")
    if (failed > 0) { println("FAILED"); kotlin.system.exitProcess(1) } else println("ALL PASSED")
}

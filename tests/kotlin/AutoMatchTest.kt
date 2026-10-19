import com.aldibiki.attune.AutoMatch
import com.aldibiki.attune.AutoRule
// v6.41 C3: the automation rules, checked on money notifications with no AI.
var bad = 0
fun check(c: Boolean, m: String) { println((if (c) "PASS " else "FAIL ") + m); if (!c) bad++ }
fun main() {
    val r = AutoRule("a1", listOf("salary", "مرتب", "راتب"), 20.0, 0.0, "Car fund")
    val t1 = "Your account ****1234 has been credited with EGP 18,000.00 — Salary October"
    check(AutoMatch.matches(r, "CIB", t1), "a salary credit fires the rule")
    check(AutoMatch.amountIn(t1) == 18000.0, "amount 18,000 read: " + AutoMatch.amountIn(t1))
    check(AutoMatch.share(r, AutoMatch.amountIn(t1)) == 3600.0, "20% = 3,600")
    check(AutoMatch.matches(r, "بنك مصر", "تم إيداع مرتب شهر أكتوبر بمبلغ ١٨٬٥٠٠ جنيه في حسابك") && AutoMatch.amountIn("تم إيداع مرتب بمبلغ ١٨٬٥٠٠ جنيه") == 18500.0, "Arabic: «تم إيداع مرتب … ١٨٬٥٠٠ جنيه» → 18,500")
    check(!AutoMatch.matches(r, "CIB", "EGP 450.00 debited for purchase at Carrefour"), "a purchase doesn't fire it")
    check(!AutoMatch.matches(r, "CIB", "EGP 2,000 credited — transfer from Ahmed"), "money in, but not the salary → no")
    check(!AutoMatch.matches(r.copy(on = false), "CIB", t1), "a rule switched off never fires")
    val any = AutoRule("a2", listOf("instapay"), 0.0, 500.0, "Emergency", dir = "in")
    check(AutoMatch.matches(any, "InstaPay", "You received EGP 1,200 from Mona") && AutoMatch.share(any, 1200.0) == 500.0, "a fixed 500 on any InstaPay money in")
    check(AutoMatch.share(r, null) == null, "no amount read → nothing computed")
    println(if (bad > 0) "$bad FAILED" else "ALL PASSED")
}

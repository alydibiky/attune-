// v6.37 Wi-Fi sync: a host and a client on this machine swap files; a refused file gives "Wrong code".
import com.aldibiki.attune.LocalSync


var failedL = 0
fun okL(c: Boolean, m: String) { println((if (c) "PASS " else "FAIL ") + m); if (!c) failedL++ }

fun main() {
    val info = LocalSync.start()
    val port = Regex("\"port\":(\\d+)").find(info)!!.groupValues[1].toInt()
    okL(port > 0 && LocalSync.hosting(), "the host listens ($info)")
    okL(LocalSync.http("127.0.0.1", port, "GET", "/attune-sync/hello", null) == (200 to "attune"), "hello")
    // the host side, as the page does it: take the file, answer with its own
    val big = "x".repeat(2_000_000)
    Thread {
        var t = ""; while (t.isEmpty()) { Thread.sleep(50); t = LocalSync.take() }
        LocalSync.answer("host-file:" + t.length)
    }.start()
    val got = LocalSync.exchange("127.0.0.1", port, big)
    okL(got == "host-file:2000000", "a 2 MB file goes over and the host's answer comes back ($got)")
    okL(LocalSync.http("127.0.0.1", port, "POST", "/attune-sync/push", "again").first == 409, "a second file is refused until the host starts again")
    LocalSync.stop(); LocalSync.start().let { i -> val p = Regex("\"port\":(\\d+)").find(i)!!.groupValues[1].toInt()
        Thread { var t = ""; while (t.isEmpty()) { Thread.sleep(50); t = LocalSync.take() }; LocalSync.answer("ERR") }.start()
        val msg = try { LocalSync.exchange("127.0.0.1", p, "bad"); "" } catch (e: Exception) { e.message ?: "" }
        okL(msg.startsWith("Wrong code"), "a file the host can't open → Wrong code ($msg)") }
    LocalSync.stop()
    okL(!LocalSync.hosting(), "stops")
    if (failedL > 0) { println("FAILED"); kotlin.system.exitProcess(1) } else println("ALL PASSED")
}

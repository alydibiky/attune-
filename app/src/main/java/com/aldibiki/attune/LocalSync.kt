package com.aldibiki.attune

import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import kotlin.concurrent.thread

/**
 * v6.37 Wi-Fi sync (Ali: "either cloud using Google or using Wi-Fi"): two Attune devices on the same network swap their
 * data — one hosts, the other sends. The page does all the locking (sync.js: AES-256-GCM, the key from the pairing code
 * with PBKDF2 600,000 rounds), so what crosses the network here is only an encrypted file. Plain sockets, not
 * HttpURLConnection: the app's network rules allow plain http only to 127.0.0.1, and this traffic is already encrypted.
 *
 * Protocol (the desktop app speaks the same, desktop/lib/localsync.js):
 *   POST /attune-sync/push   body = the other device's file  → 202 (409 if one already came)
 *   GET  /attune-sync/pull                                    → 204 not ready · 403 refused (wrong code) · 200 + this device's file
 *   GET  /attune-sync/hello                                   → 200 "attune"
 * The host stops by itself after 10 minutes. Pure Kotlin (no Android) so it is tested on its own (tests/kotlin/LocalSyncTest.kt).
 */
object LocalSync {
    private const val MAX = 64 * 1024 * 1024
    @Volatile private var server: ServerSocket? = null
    @Volatile private var pushed: String? = null
    @Volatile private var taken = false
    @Volatile private var reply: String? = null
    @Volatile private var until = 0L

    /** Starts hosting → {"ok":true,"ip":"192.168.1.20","port":41873} (ip "" when not on a network). */
    fun start(): String {
        stop()
        val ss = ServerSocket()
        ss.reuseAddress = true
        ss.bind(InetSocketAddress(0), 8)
        ss.soTimeout = 1000
        server = ss; pushed = null; taken = false; reply = null
        until = System.currentTimeMillis() + 10 * 60_000L
        thread(name = "attune-sync-host", isDaemon = true) {
            while (!ss.isClosed && System.currentTimeMillis() < until) {
                try { val c = ss.accept(); thread(isDaemon = true) { handle(c) } } catch (e: SocketTimeoutException) { } catch (e: Throwable) { break }
            }
            try { ss.close() } catch (e: Throwable) {}
        }
        return "{\"ok\":true,\"ip\":\"${ip()}\",\"port\":${ss.localPort}}"
    }
    fun stop() { try { server?.close() } catch (e: Throwable) {}; server = null }
    fun hosting(): Boolean = server?.isClosed == false
    /** The file the other device sent, once ("" until one came). */
    fun take(): String { val p = pushed; return if (p != null && !taken) { taken = true; p } else "" }
    /** This device's answer: its merged file, or "ERR" when the other's file could not be opened (wrong code). */
    fun answer(text: String) { reply = text }

    private fun handle(sock: Socket) {
        try {
            sock.soTimeout = 20_000
            val inp = BufferedInputStream(sock.getInputStream())
            val first = line(inp) ?: return
            val parts = first.split(" ")
            if (parts.size < 2) return
            var len = 0
            while (true) { val h = line(inp) ?: break; if (h.isEmpty()) break; val i = h.indexOf(':'); if (i > 0 && h.substring(0, i).trim().equals("content-length", true)) len = h.substring(i + 1).trim().toIntOrNull() ?: 0 }
            val method = parts[0]; val path = parts[1]
            when {
                method == "GET" && path == "/attune-sync/hello" -> send(sock, 200, "attune")
                method == "POST" && path == "/attune-sync/push" -> {
                    if (len <= 0 || len > MAX) { send(sock, 413, ""); return }
                    val body = readN(inp, len) ?: run { send(sock, 400, ""); return }
                    if (pushed != null) { send(sock, 409, ""); return }
                    pushed = String(body, Charsets.UTF_8); taken = false; reply = null
                    send(sock, 202, "")
                }
                method == "GET" && path == "/attune-sync/pull" -> {
                    val r = reply
                    when { pushed == null || r == null -> send(sock, 204, ""); r == "ERR" -> send(sock, 403, ""); else -> send(sock, 200, r) }
                }
                else -> send(sock, 404, "")
            }
        } catch (e: Throwable) {
        } finally { try { sock.close() } catch (e: Throwable) {} }
    }

    /** The other side: send this device's file to host:port, then wait (up to 2 minutes) for the host's file. */
    fun exchange(host: String, port: Int, body: String): String {
        val (code, _) = http(host, port, "POST", "/attune-sync/push", body)
        if (code == 409) throw IllegalStateException("That device already received a file — start it again there.")
        if (code != 202) throw IllegalStateException("The other device did not answer ($code).")
        val end = System.currentTimeMillis() + 120_000L
        while (System.currentTimeMillis() < end) {
            val (c, b) = http(host, port, "GET", "/attune-sync/pull", null)
            if (c == 200) return b
            if (c == 403) throw IllegalStateException("Wrong code — nothing was changed.")
            Thread.sleep(800)
        }
        throw IllegalStateException("The other device took too long.")
    }

    fun http(host: String, port: Int, method: String, path: String, body: String?): Pair<Int, String> {
        Socket().use { s ->
            s.connect(InetSocketAddress(host, port), 5000)
            s.soTimeout = 30_000
            val bytes = body?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)
            val head = "$method $path HTTP/1.1\r\nHost: $host:$port\r\nConnection: close\r\nContent-Length: ${bytes.size}\r\n\r\n"
            val out = s.getOutputStream(); out.write(head.toByteArray(Charsets.US_ASCII)); out.write(bytes); out.flush()
            val inp = BufferedInputStream(s.getInputStream())
            val status = (line(inp) ?: "").split(" ").getOrNull(1)?.toIntOrNull() ?: 0
            var len = -1
            while (true) { val h = line(inp) ?: break; if (h.isEmpty()) break; val i = h.indexOf(':'); if (i > 0 && h.substring(0, i).trim().equals("content-length", true)) len = h.substring(i + 1).trim().toIntOrNull() ?: -1 }
            val data = if (len >= 0) readN(inp, len) ?: ByteArray(0) else inp.readBytes()
            return status to String(data, Charsets.UTF_8)
        }
    }

    private fun send(s: Socket, code: Int, body: String) {
        val b = body.toByteArray(Charsets.UTF_8)
        val reason = when (code) { 200 -> "OK"; 202 -> "Accepted"; 204 -> "No Content"; 403 -> "Forbidden"; 404 -> "Not Found"; 409 -> "Conflict"; 413 -> "Too Large"; else -> "Error" }
        val head = "HTTP/1.1 $code $reason\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${b.size}\r\nConnection: close\r\n\r\n"
        val o = s.getOutputStream(); o.write(head.toByteArray(Charsets.US_ASCII)); o.write(b); o.flush()
    }
    private fun line(inp: InputStream): String? {
        val buf = ByteArrayOutputStream()
        while (true) {
            val c = inp.read()
            if (c < 0) return if (buf.size() == 0) null else buf.toString("US-ASCII")
            if (c == '\n'.code) return buf.toString("US-ASCII").trimEnd('\r')
            buf.write(c); if (buf.size() > 8192) return null
        }
    }
    private fun readN(inp: InputStream, n: Int): ByteArray? {
        val b = ByteArray(n); var off = 0
        while (off < n) { val r = inp.read(b, off, n - off); if (r < 0) return null; off += r }
        return b
    }
    /** This device's address on the home network (Wi-Fi first). */
    fun ip(): String = try {
        NetworkInterface.getNetworkInterfaces().toList().filter { it.isUp && !it.isLoopback }
            .sortedBy { if (it.name.startsWith("wlan")) 0 else 1 }
            .flatMap { it.inetAddresses.toList() }.firstOrNull { it is Inet4Address && it.isSiteLocalAddress }?.hostAddress ?: ""
    } catch (e: Throwable) { "" }
}

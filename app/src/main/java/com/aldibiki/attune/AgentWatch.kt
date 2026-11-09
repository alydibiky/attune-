package com.aldibiki.attune

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject
import org.jsoup.Jsoup
import java.io.File

/**
 * v8.0 Agents (Ali, 25 Oct 2026: "tell the app when hotels near Masjid al-Haram become less than 45k for 4 nights, give me a
 * notice"): the page hands over each price watch {id, title, url, below, currency}. About every 12 hours Android wakes this
 * receiver — even with Attune closed — which opens each watched page (Booking, Amazon, noon…), reads the prices written on it
 * and keeps the lowest in a file. A price at or under the person's limit → one notification. When Attune opens, the page reads
 * the file (take) and shows what was found. Some sites only show prices to a real browser: then the agent says so and the
 * person taps Check now (the page opens inside Attune's browser, which reads it). Never runs with the Offline lock on; it
 * never signs in, books or pays.
 */
object AgentWatch {
    private const val PREFS = "attune.agentwatch"
    private const val FILE = "agent-watch.json"
    private const val REQ = 0x5c0a8
    private const val UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** plan = [{id, title, url, below, currency}]; an empty plan turns the checks off. */
    fun setPlan(ctx: Context, plan: String) {
        val arr = try { JSONArray(plan) } catch (e: Exception) { JSONArray() }
        prefs(ctx).edit().putString("plan", arr.toString()).apply()
        // v9.0: a round already planned stays planned — opening the Agents page used to push the next check 12 hours later each time
        if (arr.length() == 0) { cancel(ctx); prefs(ctx).edit().remove("next").apply() }
        else {
            // v9.2: an agent now asks to be checked more often than the round already planned → plan it again, sooner
            var hours = 12
            for (i in 0 until arr.length()) { val h = arr.optJSONObject(i)?.optInt("hours", 0) ?: 0; if (h in 1 until hours) hours = h }
            val next = prefs(ctx).getLong("next", 0L)
            if (next <= System.currentTimeMillis() || next > System.currentTimeMillis() + hours * 3600_000L + 3600_000L) arm(ctx)
        }
    }

    private fun pending(ctx: Context) = PendingIntent.getBroadcast(ctx, REQ, Intent(ctx, AgentWatchReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    /** In about 12 hours (± 30 minutes, so not every phone asks at the same minute), or sooner when an agent's rule asks. Inexact: no special permission. */
    fun arm(ctx: Context) {
        if (prefs(ctx).getString("plan", "[]") == "[]") return
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        // v9.2 (Ali: "set any rules I want"): an agent told "check every 6 hours" sends hours; the most frequent one sets the next round
        // (1 hour at least; 12 hours when no agent asked)
        val arr = try { JSONArray(prefs(ctx).getString("plan", "[]")) } catch (e: Exception) { JSONArray() }
        var mins = 12 * 60
        for (i in 0 until arr.length()) { val o = arr.optJSONObject(i) ?: continue
            val h = o.optInt("hours", 0); if (h in 1 until 13 && h * 60 < mins) mins = h * 60
            val m = o.optInt("mins", 0); if (m > 0 && maxOf(15, m) < mins) mins = maxOf(15, m) }   // v9.4 G2: a visa watch, every 15 minutes at most
        val jitter = ((Math.random() - 0.5) * Math.min(3600_000L, mins * 60_000L / 6)).toLong()
        val at = System.currentTimeMillis() + mins * 60_000L + jitter
        try { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(ctx)); prefs(ctx).edit().putLong("next", at).apply() } catch (e: Exception) {}
    }

    private fun cancel(ctx: Context) { try { ctx.getSystemService(AlarmManager::class.java)?.cancel(pending(ctx)) } catch (e: Exception) {} }

    private val CUR = "(?<![A-Za-z])(?:US\\$|C\\$|A\\$|R\\$|[$€£¥₹₺]|EGP|E£|LE|SAR|AED|KWD|QAR|USD|EUR|GBP|TRY|جنيه|ج\\.م|ريال|درهم|دينار)"
    private val NUM = "(\\d{1,3}(?:[,. ]\\d{3})+|\\d{3,7})"
    private val PRICE = Regex("$CUR\\s?$NUM|$NUM\\s?$CUR")

    /** Prices written on a page's text ("EGP 48,200", "48.200 ج.م") → numbers (whole units). Pure. */
    fun prices(text: String): List<Long> = PRICE.findAll(text).mapNotNull { m ->
        val raw = (m.groupValues[1].ifEmpty { m.groupValues[2] }).replace(Regex("[,. ]"), "")
        raw.toLongOrNull()?.takeIf { it in 50..100_000_000 }
    }.toList()

    /** One listing read from a store's results page: its price, its name and its OWN link. */
    data class Offer(val price: Long, val name: String, val href: String)

    private val STOP = setOf("a", "an", "the", "for", "with", "of", "and", "new", "original", "me", "my", "to", "in", "on")
    private val VARIANT = Regex("^(pro|max|plus|ultra|mini|lite|se|air|fe)$")
    private val ACCESSORY = Regex("\\b(case|cover|protector|screen guard|glass|skin|sticker|strap|band|cable|charger|adapter|stand|holder|mount|sleeve|pouch|replacement|ear ?tips|compatible with|fits)\\b|جراب|اسكرينه|حامي|شاحن|كابل|غطاء", RegexOption.IGNORE_CASE)
    private fun words(s: String) = s.lowercase().replace(Regex("[^\\p{L}\\p{N} ]+"), " ").split(Regex("\\s+")).filter { it.isNotBlank() && it !in STOP }

    /** v9.0 (Ali: "Check now opened Amazon, not the exact listing"): is this listing the product asked for? Every model number and
     *  variant word must be in its name, 3 in 4 of the other words, and an accessory (a case FOR it) is not it. Same rule as
     *  agents.js matchScore. Pure. */
    fun matches(what: String, name: String): Boolean {
        val want = words(what); if (want.isEmpty()) return true
        val n = " " + words(name).joinToString(" ") + " "
        fun has(w: String) = n.contains(" $w ") || n.contains(" ${w}s ") || (w.length > 4 && n.contains(w))
        if (want.filter { it.any(Char::isDigit) || VARIANT.matches(it) }.any { !has(it) }) return false
        if (!ACCESSORY.containsMatchIn(what) && ACCESSORY.containsMatchIn(name)) {
            val first = want.map { n.indexOf(" $it") }.filter { it >= 0 }.minOrNull() ?: Int.MAX_VALUE
            val acc = ACCESSORY.find(n)?.range?.first ?: Int.MAX_VALUE
            if (acc < first || Regex("\\b(for|compatible with|fits)\\s").containsMatchIn(n.take(first.coerceAtMost(n.length)))) return false
        }
        return want.count { has(it) } * 4 >= want.size * 3
    }

    /** The listings on a results page: each product card (Amazon, Jumia, B.TECH, 2B…, or any link with a price around it). */
    private fun offers(doc: org.jsoup.nodes.Document): List<Offer> {
        val out = ArrayList<Offer>()
        val cards = doc.select("[data-component-type=s-search-result], article.prd, li.product-item, div.product-item, div.product-item-info, .product-card, [class*=productContainer], [class*=ProductBox], [data-qa=product-item]")
        val list: List<org.jsoup.nodes.Element> = if (cards.isNotEmpty()) cards.toList() else doc.select("a[href]").mapNotNull { a ->
            var e: org.jsoup.nodes.Element? = a; var k = 0
            while (e != null && k < 4 && prices(e.text()).isEmpty()) { e = e.parent(); k++ }
            e?.takeIf { it.text().length in 10..700 && prices(it.text()).isNotEmpty() }
        }.distinct()
        for (c in list.take(80)) {
            val price = prices(c.text()).firstOrNull() ?: continue
            val links = c.select("a[href]").filter { it.absUrl("href").startsWith("https://") }
            val main = links.maxByOrNull { it.text().length + (it.selectFirst("img[alt]")?.attr("alt")?.length ?: 0) } ?: (if (c.tagName() == "a") c else null) ?: continue
            val href = main.absUrl("href").takeIf { it.startsWith("https://") } ?: continue
            val name = listOf(c.selectFirst("h2, h3, .name, .product-name, [class*=title], [data-qa=product-name]")?.text() ?: "", main.attr("title"), main.text(), c.selectFirst("img[alt]")?.attr("alt") ?: "")
                .firstOrNull { it.length >= 6 } ?: continue
            out.add(Offer(price, name.take(140), href))
        }
        return out
    }

    /** Reads one page → the cheapest listing of THE product (with its link), or the lowest price on the page when nothing names a
     *  product; null when the page shows no prices to an app (a browser check is needed). */
    private fun lowest(url: String, what: String): Offer? = try {
        Prefs.requireOnline(url, "an agent checking a price")
        val doc = Jsoup.connect(url).userAgent(UA).header("Accept-Language", "en-US,en;q=0.8,ar;q=0.6")
            .timeout(15_000).maxBodySize(4_000_000).followRedirects(true).get()
        doc.select("script,style,noscript").remove()
        if (what.isNotBlank()) {
            val ok = offers(doc).filter { matches(what, it.name) }
            // a price far under the others is a part or an instalment, not the product
            val mid = ok.map { it.price }.sorted().let { if (it.isEmpty()) 0L else it[it.size / 2] }
            (if (ok.size >= 3) ok.filter { it.price * 100 >= mid * 45 } else ok).minByOrNull { it.price }
        } else prices(doc.body()?.text() ?: "").minOrNull()?.let { Offer(it, "", "") }
    } catch (e: Exception) { null }

    /** v9.4 G2: the visible words of a page, with the cookies of Attune's own browser (so a page the person logged in to stays open). */
    private fun pageWords(url: String): String? = try {
        Prefs.requireOnline(url, "an agent checking an appointment page")
        val cookie = try { android.webkit.CookieManager.getInstance().getCookie(url) } catch (e: Exception) { null }
        val req = Jsoup.connect(url).userAgent(UA).header("Accept-Language", "en-US,en;q=0.8,ar;q=0.6").timeout(15_000).maxBodySize(3_000_000).followRedirects(true)
        if (!cookie.isNullOrBlank()) req.header("Cookie", cookie)
        val doc = req.get(); doc.select("script,style,noscript").remove(); doc.body()?.text()?.take(8000)
    } catch (e: Exception) { null }
    private val NO_SLOT = Regex("""(?i)no (appointment|slot|date)s? (are )?(currently )?available|no availability|fully booked|currently no (dates|slots)|try again later|aucun (rendez-vous|créneau)|pas de (rendez-vous|créneau)|no hay (citas|turnos)|keine termine|nessun appuntamento|sem vagas|randevu (bulunmamaktadır|yok)|لا توجد مواعيد|لا يوجد مواعيد|مفيش مواعيد|غير متاح""")
    private val LOGIN = Regex("""(?i)\b(log ?in|sign ?in|password|captcha)\b|تسجيل الدخول|كلمة المرور""")
    private val A_DATE = Regex("""\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b""", RegexOption.IGNORE_CASE)
    /** A page that shows dates, doesn't say "no appointments", and isn't the login page — worth a look now. */
    fun slotOpen(t: String): Boolean = t.length > 80 && !NO_SLOT.containsMatchIn(t) && !LOGIN.containsMatchIn(t.take(1500)) && A_DATE.containsMatchIn(t) && Regex("(?i)available|book|select|appointment|slot|موعد|متاح|احجز").containsMatchIn(t)

    /** One round of checks. Called on a background thread. */
    fun run(ctx: Context) {
        val plan = try { JSONArray(prefs(ctx).getString("plan", "[]")) } catch (e: Exception) { JSONArray() }
        if (plan.length() == 0) return
        arm(ctx)                                     // the next round, whatever happens in this one
        if (Prefs.airGap(ctx)) return
        val out = read(ctx)
        val hits = ArrayList<String>()
        var headless = 0
        for (i in 0 until minOf(plan.length(), 16)) {   // v8.2: a hotel window is several start days
            val w = plan.optJSONObject(i) ?: continue
            val url = w.optString("url"); if (!url.startsWith("https://")) continue
            // v9.4 G2: an appointment page (BLS, VFS, TLScontact, a consulate…) — its words, read with the login the person made in
            // Attune's browser; the page decides what they mean (slots.js). A clear "slot open" → a notification at once.
            if (w.optString("kind") == "slot") {
                val t = pageWords(url)
                val row = JSONObject().put("at", System.currentTimeMillis()).apply { if (t == null) put("blocked", true) else put("text", t.take(6000)) }
                val list = out.optJSONArray(w.optString("id")) ?: JSONArray(); list.put(row); out.put(w.optString("id"), list)
                if (t != null && slotOpen(t)) hits.add(w.optString("title") + " · " + (w.optString("openLine").ifBlank { "a date may be open" }))
                continue
            }
            val got = lowest(url, w.optString("what"))
            val row = JSONObject().put("at", System.currentTimeMillis())
            // v9.9.4: a site that shows prices only after its scripts run (Booking…) → read it in an invisible browser, the way
            // "Check now" does (HeadlessRead.kt). At most 2 such pages a round (Android gives a background check about a minute); the rest come next round.
            if (got == null && HeadlessRead.needsScripts(url) && headless < 2 && rotateOk(ctx, w.optString("id"))) {
                headless++
                val o = try { HeadlessRead.best(ctx, url, w.optString("rules", "{}")) } catch (e: Throwable) { null }
                if (o != null && o.optDouble("price", 0.0) > 0) {
                    row.put("price", Math.round(o.optDouble("price"))).put("how", "hidden")
                    val top = o.optJSONArray("top"); if (top != null) row.put("top", top)
                    top?.optJSONObject(0)?.let { t -> if (t.optString("href").isNotEmpty()) row.put("href", t.optString("href")).put("name", t.optString("name")) }
                    if (w.optString("site").isNotEmpty()) row.put("site", w.optString("site"))
                    val list = out.optJSONArray(w.optString("id")) ?: JSONArray(); list.put(row); out.put(w.optString("id"), list)
                    markRead(ctx, w.optString("id"))
                    val below0 = w.optLong("below", 0L)
                    if (below0 > 0 && Math.round(o.optDouble("price")) <= below0) hits.add(w.optString("title") + " · " + w.optString("currency") + " " + "%,d".format(Math.round(o.optDouble("price"))))
                    continue
                }
            }
            if (got == null) row.put("blocked", true) else {
                row.put("price", got.price)
                if (got.href.isNotEmpty()) row.put("href", got.href).put("name", got.name)
                if (w.optString("site").isNotEmpty()) row.put("site", w.optString("site"))
            }
            val list = out.optJSONArray(w.optString("id")) ?: JSONArray()
            list.put(row); out.put(w.optString("id"), list)
            val below = w.optLong("below", 0L)
            if (got != null && below > 0 && got.price <= below) hits.add(w.optString("title") + " · " + w.optString("currency") + " " + "%,d".format(got.price))
        }
        try { File(ctx.filesDir, FILE).writeText(out.toString()) } catch (e: Exception) {}
        if (hits.isNotEmpty()) Reminders.schedule(ctx, JSONObject().put("id", "agent-watch").put("at", System.currentTimeMillis() + 2000)
            .put("title", "Agents · something to see")
            .put("body", hits.take(3).joinToString("\n") + "\nTap to open Agents."))
    }

    /** The hidden reads go round the dates: the one read longest ago first (each round reads at most 2). */
    private fun rotateOk(ctx: Context, id: String): Boolean {
        val plan = try { JSONArray(prefs(ctx).getString("plan", "[]")) } catch (e: Exception) { JSONArray() }
        val ids = (0 until plan.length()).mapNotNull { plan.optJSONObject(it) }.filter { HeadlessRead.needsScripts(it.optString("url")) }.map { it.optString("id") }
        val when0 = { k: String -> prefs(ctx).getLong("hidden:" + k, 0L) }
        val order = ids.sortedBy { when0(it) }
        return order.indexOf(id).let { it in 0..1 }
    }
    private fun markRead(ctx: Context, id: String) { prefs(ctx).edit().putLong("hidden:" + id, System.currentTimeMillis()).apply() }

    private fun read(ctx: Context): JSONObject = try { JSONObject(File(ctx.filesDir, FILE).readText()) } catch (e: Exception) { JSONObject() }

    /** What the checks found since the page last looked, then forgotten. {watchId: [{at, price | blocked}]} */
    fun take(ctx: Context): String {
        val f = File(ctx.filesDir, FILE)
        val s = try { if (f.exists()) f.readText() else "{}" } catch (e: Exception) { "{}" }
        try { f.delete() } catch (e: Exception) {}
        return s
    }
}

class AgentWatchReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val done = goAsync()
        Thread {
            try { AgentWatch.run(ctx.applicationContext) } catch (e: Exception) {} finally { done.finish() }
        }.start()
    }
}

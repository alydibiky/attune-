package com.aldibiki.attune

import org.json.JSONArray
import org.json.JSONObject
import org.jsoup.Jsoup
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Web lookup done natively, not from the page: browser pages cannot call
 * Brave's API (it refuses cross-origin requests) and cannot read other sites'
 * HTML at all. Here there is no such restriction.
 *
 * Only the search query and the pages opened leave the phone — never the
 * conversation, never memory. Off entirely when the offline lock is on.
 */
object WebTools {

    data class Hit(val title: String, val url: String, var text: String, val source: String)

    private const val UA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
    private val pool = Executors.newFixedThreadPool(8)

    private fun isArabic(s: String) = s.any { it in '؀'..'ۿ' }

    // ---- DuckDuckGo (keyless) -------------------------------------------------
    // DuckDuckGo has no official web-results API; this reads its HTML results
    // page. Fine for personal use; for a commercial launch prefer Brave's API.
    fun duckduckgo(q: String, max: Int = 6, recent: String = ""): List<Hit> {
        val region = if (isArabic(q)) "xa-ar" else "wt-wt"
        val lang = if (isArabic(q)) "ar,en;q=0.8" else "en,ar;q=0.8"
        val out = ArrayList<Hit>()
        Prefs.requireOnline("https://html.duckduckgo.com/html/", "web search (DuckDuckGo)")
        try {
            val doc = Jsoup.connect("https://html.duckduckgo.com/html/")
                .data("q", q).data("kl", region).data("df", recent)
                .userAgent(UA).header("Accept-Language", lang)
                .referrer("https://html.duckduckgo.com/")
                .timeout(12_000).post()
            for (r in doc.select("div.result")) {
                if (r.hasClass("result--ad") || r.select(".badge--ad").isNotEmpty()) continue
                val a = r.selectFirst("a.result__a") ?: continue
                val url = unwrapDdg(a.attr("href"))
                if (!url.startsWith("http")) continue
                val snippet = r.selectFirst(".result__snippet")?.text().orEmpty()
                out.add(Hit(a.text(), url, snippet, "web"))
                if (out.size >= max) break
            }
        } catch (e: Exception) { /* fall through to lite */ }
        if (out.isNotEmpty()) return out

        // DuckDuckGo Lite: plainer markup, used when the main page refuses.
        try {
            Prefs.requireOnline("https://lite.duckduckgo.com/lite/", "web search (DuckDuckGo Lite)")
            val doc = Jsoup.connect("https://lite.duckduckgo.com/lite/")
                .data("q", q).data("kl", region)
                .userAgent(UA).header("Accept-Language", lang)
                .timeout(12_000).post()
            val links = doc.select("a.result-link")
            val snippets = doc.select("td.result-snippet")
            for ((i, a) in links.withIndex()) {
                val url = unwrapDdg(a.attr("href"))
                if (!url.startsWith("http")) continue
                out.add(Hit(a.text(), url, snippets.getOrNull(i)?.text().orEmpty(), "web"))
                if (out.size >= max) break
            }
        } catch (e: Exception) { }
        return out
    }

    /** DuckDuckGo wraps result links as //duckduckgo.com/l/?uddg=<real url>. */
    private fun unwrapDdg(href: String): String {
        val h = if (href.startsWith("//")) "https:$href" else href
        val i = h.indexOf("uddg=")
        if (i < 0) return h
        val v = h.substring(i + 5).substringBefore('&')
        return try { URLDecoder.decode(v, "UTF-8") } catch (e: Exception) { h }
    }

    // ---- Brave Search API (the user's key) -----------------------------------
    fun brave(q: String, key: String, max: Int = 6): List<Hit> {
        val lang = if (isArabic(q)) "ar" else "en"
        val u = "https://api.search.brave.com/res/v1/web/search?q=" + URLEncoder.encode(q, "UTF-8") +
            "&count=$max&search_lang=$lang&extra_snippets=true"
        Prefs.requireOnline(u, "web search (Brave)")
        val c = URL(u).openConnection() as HttpURLConnection
        c.connectTimeout = 10_000; c.readTimeout = 15_000
        c.setRequestProperty("Accept", "application/json")
        c.setRequestProperty("X-Subscription-Token", key)
        val code = c.responseCode
        if (code == 401 || code == 403) throw Exception("Brave rejected the key (HTTP $code)")
        if (code == 429) throw Exception("Brave: monthly or per-second limit reached")
        if (code !in 200..299) throw Exception("Brave returned HTTP $code")
        val j = JSONObject(c.inputStream.bufferedReader().use { it.readText() })
        val res = j.optJSONObject("web")?.optJSONArray("results") ?: JSONArray()
        val out = ArrayList<Hit>()
        for (i in 0 until minOf(res.length(), max)) {
            val r = res.getJSONObject(i)
            val extra = r.optJSONArray("extra_snippets")
            val sb = StringBuilder(Jsoup.parse(r.optString("description")).text())
            if (extra != null) for (k in 0 until extra.length()) sb.append(" ").append(Jsoup.parse(extra.optString(k)).text())
            out.add(Hit(Jsoup.parse(r.optString("title")).text(), r.optString("url"), sb.toString(), "web"))
        }
        return out
    }

    // ---- Reading a page ---------------------------------------------------------
    /** The readable text of a page: article/main body, without menus, scripts or ads. */
    fun pageText(url: String, maxChars: Int = 2200): String {
        if (!url.startsWith("http")) return ""
        return try {
            Prefs.requireOnline(url, "reading a search result")
            val doc = Jsoup.connect(url).userAgent(UA)
                .timeout(9_000).maxBodySize(2_000_000).followRedirects(true).get()
            doc.select("script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,.ad,.ads,.advert,[role=navigation]").remove()
            val main = doc.selectFirst("article") ?: doc.selectFirst("main") ?: doc.body() ?: return ""
            // v5.19: line by line, with TABLES KEPT AS ROWS ("Trim | hp | Nm | price") —
            // spec sheets live in tables, and flattening them (or reading only the
            // first 2,200 characters) is why answers missed trims and figures.
            val s = structured(main, maxChars)
            if (s.length >= 300) s else main.text().replace(Regex("\\s+"), " ").trim().take(maxChars)
        } catch (e: Exception) { "" }
    }

    private val BLOCKS = setOf("li", "tr", "p", "dd", "dt", "blockquote", "figcaption", "pre")
    private fun structured(main: org.jsoup.nodes.Element, maxChars: Int): String {
        val sb = StringBuilder()
        for (el in main.select("h1,h2,h3,h4,h5,p,li,tr,dt,dd,blockquote,pre,figcaption,caption")) {
            val tag = el.tagName()
            // a <p> inside an <li> (etc.) is already part of its parent's line
            if (tag != "tr" && el.parents().any { it.tagName() in BLOCKS }) continue
            val line = if (tag == "tr") el.children().filter { it.tagName() == "th" || it.tagName() == "td" }
                    .joinToString(" | ") { it.text().replace(Regex("\\s+"), " ").trim() }.trim(' ', '|')
                else el.text().replace(Regex("\\s+"), " ").trim()
            if (line.length < 2) continue
            if (tag.length == 2 && tag[0] == 'h') sb.append("\n## ")
            sb.append(line).append('\n')
            if (sb.length >= maxChars) break
        }
        return sb.toString().trim().take(maxChars)
    }

    /**
     * Search, then open the top pages in parallel so the model answers from
     * real passages rather than one-line snippets.
     */
    fun search(provider: String, q: String, key: String?, pages: Int): JSONObject {
        var via = provider
        var hits: List<Hit> = emptyList()
        var why = ""
        if (provider == "brave" && !key.isNullOrBlank()) {
            try { hits = brave(q, key) } catch (e: Exception) { why = e.message ?: "Brave failed" }
        }
        if (hits.isEmpty()) {
            hits = duckduckgo(q, 10)
            via = "duckduckgo"
            if (hits.isEmpty() && why.isEmpty()) why = "DuckDuckGo returned nothing"
        }

        // v5.19: up to 6 pages, each read in full (16,000 characters) — the page
        // picks the passages that answer the question (webrank.js).
        val n = pages.coerceIn(0, 8)
        if (n > 0 && hits.isNotEmpty()) {
            val jobs = hits.take(n).map { h -> pool.submit(Callable { h to pageText(h.url, 16_000) }) }
            for (f in jobs) {
                try {
                    val (h, text) = f.get(14, TimeUnit.SECONDS)
                    if (text.length > h.text.length + 80) h.text = (h.text + "\n" + text).take(16_000)
                } catch (e: Exception) { }
            }
        }

        val arr = JSONArray()
        for (h in hits) arr.put(JSONObject().put("title", h.title).put("url", h.url)
            .put("text", h.text.take(16_000)).put("source", h.source))
        return JSONObject().put("hits", arr).put("via", via).put("why", why)
    }

    // ---- News: the last day's articles on a topic ------------------------------
    /**
     * Google News' public RSS search gives headlines WITH their time and
     * publisher (a web search doesn't), so a digest can say what is new today.
     * The top few recent web results are also opened and read, so the model
     * has more than headlines to summarise. Only the topic leaves the phone.
     */
    fun news(q: String, arabic: Boolean, pages: Int): JSONObject {
        val items = JSONArray()
        var why = ""
        try {
            val hl = if (arabic) "hl=ar&gl=EG&ceid=EG:ar" else "hl=en-US&gl=US&ceid=US:en"
            val u = "https://news.google.com/rss/search?q=" + URLEncoder.encode("$q when:2d", "UTF-8") + "&" + hl
            Prefs.requireOnline(u, "news headlines (Google News)")
            val c = URL(u).openConnection() as HttpURLConnection
            c.connectTimeout = 10_000; c.readTimeout = 15_000
            c.setRequestProperty("User-Agent", UA)
            if (c.responseCode !in 200..299) throw Exception("Google News returned HTTP ${c.responseCode}")
            val fmt = java.text.SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", java.util.Locale.US)
            val xml = android.util.Xml.newPullParser()
            c.inputStream.use { ins ->
                xml.setInput(ins, "UTF-8")
                var cur: JSONObject? = null
                var tag = ""
                var ev = xml.eventType
                while (ev != org.xmlpull.v1.XmlPullParser.END_DOCUMENT && items.length() < 30) {
                    when (ev) {
                        org.xmlpull.v1.XmlPullParser.START_TAG -> { tag = xml.name; if (tag == "item") cur = JSONObject() }
                        org.xmlpull.v1.XmlPullParser.TEXT -> cur?.let { o ->
                            val t = xml.text ?: ""
                            when (tag) {
                                "title" -> o.put("title", o.optString("title") + t)
                                "link" -> o.put("url", o.optString("url") + t.trim())
                                "source" -> o.put("source", o.optString("source") + t)
                                "pubDate" -> try { o.put("date", fmt.parse(t.trim())?.time ?: 0L) } catch (e: Exception) { }
                                "description" -> o.put("snippet", Jsoup.parse(t).text().take(400))
                            }
                        }
                        org.xmlpull.v1.XmlPullParser.END_TAG -> { if (xml.name == "item") { cur?.let { if (it.optString("title").isNotBlank()) items.put(it) }; cur = null }; tag = "" }
                    }
                    ev = xml.next()
                }
            }
        } catch (e: Exception) { why = e.message ?: "Google News failed" }

        // Recent web results, opened and read (more than a headline to go on).
        val hits = JSONArray()
        try {
            val web = duckduckgo(q + if (arabic) " أخبار" else " news", 6, "d")
            val n = pages.coerceIn(0, 4)
            val jobs = web.take(n).map { h -> pool.submit(Callable { h to pageText(h.url, 2400) }) }
            for (f in jobs) try { val (h, t) = f.get(12, TimeUnit.SECONDS); if (t.length > h.text.length) h.text = t } catch (e: Exception) { }
            for (h in web) hits.put(JSONObject().put("title", h.title).put("url", h.url).put("text", h.text.take(2400)))
        } catch (e: Exception) { if (why.isEmpty()) why = e.message ?: "search failed" }
        if (items.length() == 0 && hits.length() == 0 && why.isEmpty()) why = "Nothing came back for that topic."
        return JSONObject().put("items", items).put("hits", hits).put("why", why)
    }
}

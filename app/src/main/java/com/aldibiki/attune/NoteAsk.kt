package com.aldibiki.attune

import android.app.NotificationManager
import android.app.PendingIntent
import android.app.RemoteInput
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * v9.9.11 A2 (Ali picked: "ask me on the notification itself — I tell it what it is and it understands, so next time it knows").
 * When money shows up in a chat (a WhatsApp group talking about wages…) from a chat / group Attune was never taught about, Attune
 * posts ONE question: "What is this?" with Mine · Not money · Reply… (type a sentence). The answer is kept here until the page
 * takes it (notelabels.js reads it; a typed sentence is shown as "I understood: … — Save" in Follow-ups before anything is saved).
 * At most 2 questions a day, never the same chat twice, never a chat already taught (the page sends what it knows: setKnown).
 */
object NoteAsk {
    private const val PREFS = "attune.noteask"
    const val ACT_MINE = "com.aldibiki.attune.NOTE_MINE"
    const val ACT_NOT = "com.aldibiki.attune.NOTE_NOT"
    const val ACT_REPLY = "com.aldibiki.attune.NOTE_REPLY"
    const val EXTRA_KEY = "key"
    const val REPLY_KEY = "note_reply"
    private const val PER_DAY = 2
    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun arr(ctx: Context, k: String) = try { JSONArray(prefs(ctx).getString(k, "[]")) } catch (e: Exception) { JSONArray() }
    private fun obj(ctx: Context, k: String) = try { JSONObject(prefs(ctx).getString(k, "{}") ?: "{}") } catch (e: Exception) { JSONObject() }

    /** The chat / group a notification belongs to (the title before ": sender", without "(3 messages)"), with its app. */
    fun keyOf(pkg: String, title: String): String {
        val name = title.replace(Regex("\\s*\\(\\d+\\s*(messages?|رسائل|رسالة|new)[^)]*\\)\\s*$", RegexOption.IGNORE_CASE), "").split(": ")[0].trim().lowercase()
        return "$pkg|$name"
    }
    /** The page's labels ([{pkg, name}]) — those chats are never asked about. */
    fun setKnown(ctx: Context, json: String) {
        val known = JSONArray()
        try { val a = JSONArray(json); for (i in 0 until a.length()) a.optJSONObject(i)?.let { known.put(keyOf(it.optString("pkg"), it.optString("name"))) } } catch (e: Exception) { }
        prefs(ctx).edit().putString("known", known.toString()).apply()
    }
    /** The words of the question in the person's language (the page sends them; English until then). */
    fun setWords(ctx: Context, json: String) { prefs(ctx).edit().putString("words", json).apply() }

    private fun has(a: JSONArray, s: String): Boolean { for (i in 0 until a.length()) if (a.optString(i) == s) return true; return false }

    /** Called by PayListener for money in a chat app. Asks once, at most PER_DAY a day. */
    /** v9.9.30 (Ali, 13 Nov: "understand notifications very well, not keep asking like a stupid … really smart"): the phone no longer
     *  posts "What is this?" about money talk in a chat by itself — chat talk is never added to Money, so the question was only noise.
     *  The answers path stays (Mine / Not money / Reply…) for when teaching is switched back on (pref "ask" = true). */
    fun maybeAsk(ctx: Context, pkg: String, app: String, title: String, text: String) {
        if (!prefs(ctx).getBoolean("ask", false)) return
        try {
            val key = keyOf(pkg, title)
            if (key.endsWith("|")) return
            val asked = arr(ctx, "asked")
            val known = arr(ctx, "known")
            if (has(asked, key) || has(known, key)) return
            val day = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
            val p = prefs(ctx); val today = if (p.getString("day", "") == day) p.getInt("count", 0) else 0
            if (today >= PER_DAY) return
            asked.put(key)
            val waiting = obj(ctx, "waiting"); waiting.put(key, JSONObject().put("pkg", pkg).put("app", app).put("title", title).put("text", text.take(600)).put("ts", System.currentTimeMillis()))
            p.edit().putString("asked", asked.toString()).putString("waiting", waiting.toString()).putString("day", day).putInt("count", today + 1).apply()
            post(ctx, key, app, title, text)
        } catch (e: Exception) { }
    }

    private fun post(ctx: Context, key: String, app: String, title: String, text: String) {
        val w = obj(ctx, "words")
        val nid = ("noteask" + key).hashCode()
        fun pi(action: String) = PendingIntent.getBroadcast(ctx, (action + key).hashCode(), Intent(ctx, NoteAskReceiver::class.java).setAction(action).putExtra(EXTRA_KEY, key),
            PendingIntent.FLAG_UPDATE_CURRENT or (if (action == ACT_REPLY && Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE))
        val reply = android.app.Notification.Action.Builder(null, w.optString("reply", "Reply…"), pi(ACT_REPLY))
            .addRemoteInput(RemoteInput.Builder(REPLY_KEY).setLabel(w.optString("hint", "Tell me what it is")).build()).build()
        val open = PendingIntent.getActivity(ctx, ("noteask-open" + key).hashCode(), Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra(EXTRA_OPEN_PAGE, "timeline"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val head = w.optString("title", "What is this? I wasn't sure.")
        val group = title.split(": ")[0].trim()
        val body = "$app · $group\n${text.take(300)}"
        Reminders.ensureChannel(ctx)
        val b = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, Reminders.CHANNEL) else @Suppress("DEPRECATION") android.app.Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(head).setContentText(body)
            .setStyle(android.app.Notification.BigTextStyle().bigText(body)).setContentIntent(open).setAutoCancel(true)
            .addAction(android.app.Notification.Action.Builder(null, w.optString("mine", "Mine"), pi(ACT_MINE)).build())
            .addAction(android.app.Notification.Action.Builder(null, w.optString("not", "Not money"), pi(ACT_NOT)).build())
            .addAction(reply)
        try { ctx.getSystemService(NotificationManager::class.java)?.notify(nid, b.build()) } catch (e: SecurityException) { }
    }

    /** An answer from the notification → kept for the page (meaning "mymoney" / "notmoney", or the typed sentence). */
    fun answer(ctx: Context, key: String, meaning: String, said: String) {
        val p = prefs(ctx); val waiting = obj(ctx, "waiting"); val n = waiting.optJSONObject(key) ?: JSONObject()
        waiting.remove(key)
        val answers = arr(ctx, "answers"); answers.put(JSONObject().put("key", key).put("meaning", meaning).put("said", said).put("n", n).put("at", System.currentTimeMillis()))
        p.edit().putString("waiting", waiting.toString()).putString("answers", answers.toString()).apply()
        try { ctx.getSystemService(NotificationManager::class.java)?.cancel(("noteask" + key).hashCode()) } catch (e: Exception) { }
    }
    /** The page takes the answers (then they are forgotten here). */
    fun take(ctx: Context): String { val p = prefs(ctx); val s = p.getString("answers", "[]") ?: "[]"; p.edit().putString("answers", "[]").apply(); return s }
}

class NoteAskReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val key = intent.getStringExtra(NoteAsk.EXTRA_KEY) ?: return
        when (intent.action) {
            NoteAsk.ACT_MINE -> NoteAsk.answer(ctx, key, "mymoney", "")
            NoteAsk.ACT_NOT -> NoteAsk.answer(ctx, key, "notmoney", "")
            NoteAsk.ACT_REPLY -> {
                val said = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(NoteAsk.REPLY_KEY)?.toString().orEmpty().trim()
                if (said.isNotEmpty()) NoteAsk.answer(ctx, key, "", said)
            }
        }
    }
}

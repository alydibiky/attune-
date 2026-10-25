package com.aldibiki.attune

import android.app.Notification
import android.app.RemoteInput
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * Voice step 1.4 (VOICE_PLAN.md) — "who messaged me?" and "reply to him…" for the voice assistant.
 * The newest chat notifications (WhatsApp, Telegram, Messenger, Signal… — the same apps Message alerts listen to, never SMS)
 * are kept as {key, app, who, convo, group, text, ts, canReply}: the last 30 from the last 24 hours, in the app's private
 * preferences (nothing leaves the phone). Each conversation's own reply action (the "Reply" button on the notification,
 * a RemoteInput) is kept in memory, so a reply goes into EXACTLY that chat — Ali: "make sure it sends the correct contact".
 * A group message is marked as a group (its key is the group's chat), so the page never uses it to reach one person.
 * After Attune's process restarts the reply actions are gone (canReply = false) until that chat posts again; the page then
 * opens the app with the text ready instead.
 */
object ChatInbox {
    private const val PREFS = "attune.chatinbox"
    private const val MAX = 30
    private const val DAY = 24 * 3600_000L
    private val replies = HashMap<String, Notification.Action>()

    /** The chat apps (Message alerts' list); SMS apps are never read. */
    fun isChat(pkg: String) = (pkg in WatchMatch.ANY && !WatchMatch.isSms(pkg)) || (WatchMatch.isSms(pkg) && WatchMatch.smsAllowed)   // SMS: only with the switch on

    private fun appId(pkg: String) = when {
        pkg in (WatchMatch.APPS["whatsapp"] ?: emptySet()) -> "whatsapp"
        pkg in (WatchMatch.APPS["telegram"] ?: emptySet()) -> "telegram"
        pkg in (WatchMatch.APPS["messenger"] ?: emptySet()) -> "messenger"
        pkg in (WatchMatch.APPS["instagram"] ?: emptySet()) -> "instagram"
        pkg in (WatchMatch.APPS["signal"] ?: emptySet()) -> "signal"
        pkg in (WatchMatch.APPS["email"] ?: emptySet()) -> "email"
        WatchMatch.isSms(pkg) -> "sms"
        else -> pkg
    }

    /** The reply action of a notification: the one with a free-text RemoteInput (marked "reply" first, where the app says so). */
    private fun replyAction(n: Notification): Notification.Action? {
        val acts = n.actions ?: return null
        val withInput = acts.filter { a -> a.remoteInputs?.any { it.allowFreeFormInput } == true }
        if (android.os.Build.VERSION.SDK_INT >= 28) withInput.firstOrNull { it.semanticAction == Notification.Action.SEMANTIC_ACTION_REPLY }?.let { return it }
        return withInput.firstOrNull()
    }

    @Synchronized
    fun add(ctx: Context, sbn: StatusBarNotification) {
        val pkg = sbn.packageName; if (!isChat(pkg)) return
        val n = sbn.notification ?: return
        if ((n.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return            // "3 new messages": the messages themselves come too
        val ex = n.extras ?: return
        val title = ex.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        var text = (ex.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: ex.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
        val convoTitle = ex.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString().orEmpty()
        var group = ex.getBoolean(Notification.EXTRA_IS_GROUP_CONVERSATION, false) || convoTitle.isNotBlank()
        var who = title
        // the newest message of a MessagingStyle notification: its own sender and text
        val msgs = ex.getParcelableArray(Notification.EXTRA_MESSAGES)
        if (msgs != null && msgs.isNotEmpty()) {
            val last = msgs.last() as? Bundle
            if (last != null) {
                last.getCharSequence("text")?.toString()?.let { if (it.isNotBlank()) text = it }
                val sender = (if (android.os.Build.VERSION.SDK_INT >= 28) last.getParcelable<android.app.Person>("sender_person")?.name?.toString() else null)
                    ?: last.getCharSequence("sender")?.toString()
                if (!sender.isNullOrBlank()) who = sender
            }
        }
        // WhatsApp's older group form: title "Family" (or "Ahmed @ Family"), text "Ahmed: hi"
        var convo = convoTitle.ifBlank { if (group) title else "" }
        if (title.contains(" @ ")) { group = true; who = title.substringBefore(" @ ").trim(); convo = title.substringAfter(" @ ").trim() }
        else if (group && who == title) { val m = Regex("^([^:]{1,40}):\\s+(.*)$").find(text); if (m != null) { who = m.groupValues[1].trim(); text = m.groupValues[2] } }
        if (who.isBlank() || text.isBlank()) return
        if (PayLog.isOtp(text) || PayLog.isOtp(title)) return                        // one-time codes are never kept
        // one key per conversation: the chat's reply goes to that chat only
        val key = pkg + "|" + (if (group) "g:" + convo else "p:" + who)
        replyAction(n)?.let { replies[key] = it }
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = try { JSONArray(p.getString("items", "[]")) } catch (e: Exception) { JSONArray() }
        val now = System.currentTimeMillis()
        val out = JSONArray()
        for (i in 0 until arr.length()) { val o = arr.optJSONObject(i) ?: continue; if (now - o.optLong("ts") < DAY && !(o.optString("key") == key && o.optString("text") == text.take(500))) out.put(o) }
        out.put(JSONObject().put("key", key).put("app", appId(pkg)).put("pkg", pkg).put("who", who.take(80)).put("convo", convo.take(80)).put("group", group)
            .put("text", text.take(500)).put("ts", sbn.postTime))
        val keep = JSONArray(); val start = maxOf(0, out.length() - MAX); for (i in start until out.length()) keep.put(out.get(i))
        p.edit().putString("items", keep.toString()).apply()
    }

    /** The kept messages, each with canReply = its chat's reply action is still in memory. */
    @Synchronized
    fun list(ctx: Context): String {
        val arr = try { JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("items", "[]")) } catch (e: Exception) { JSONArray() }
        val now = System.currentTimeMillis(); val out = JSONArray()
        for (i in 0 until arr.length()) { val o = arr.optJSONObject(i) ?: continue; if (now - o.optLong("ts") < DAY) out.put(o.put("canReply", replies.containsKey(o.optString("key")))) }
        return out.toString()
    }

    /** Sends text into exactly that conversation through its own reply action. → {ok} or {ok:false, error}. */
    @Synchronized
    fun reply(ctx: Context, key: String, text: String): JSONObject {
        val a = replies[key] ?: return JSONObject().put("ok", false).put("error", "no-reply-action")
        if (text.isBlank()) return JSONObject().put("ok", false).put("error", "empty")
        return try {
            val inputs = a.remoteInputs ?: return JSONObject().put("ok", false).put("error", "no-input")
            val results = Bundle(); for (ri in inputs) if (ri.allowFreeFormInput) results.putCharSequence(ri.resultKey, text)
            val intent = Intent(); RemoteInput.addResultsToIntent(inputs, intent, results)
            a.actionIntent.send(ctx, 0, intent)
            JSONObject().put("ok", true)
        } catch (e: Exception) { JSONObject().put("ok", false).put("error", e.message ?: "send failed") }
    }

    fun clear(ctx: Context) { replies.clear(); ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("items").apply() }
}

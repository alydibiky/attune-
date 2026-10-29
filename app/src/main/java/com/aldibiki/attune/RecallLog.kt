package com.aldibiki.attune

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * v6.40 Recall (agent C): the notifications the person gets (chats, SMS, email, deliveries, banks) are kept on the phone so Recall
 * can find them later — "the address Ahmed sent", «كود الواي فاي».
 * v8.7 (Ali, 29 Oct: "I want the messages in Recall to stay forever, with offline and online backup like WhatsApp"): kept FOREVER
 * in a small database on the phone (recall.db — it is in Android's own backup, and in Attune's backup file and daily automatic
 * backup: AutoBackup.kt, web-src/autobackup.js). On unless the person turns it off; turning it off stops keeping new ones
 * (what is kept stays until "Forget everything kept"). SMS only with the SMS switch on, never a one-time code; never Attune's
 * own, never ongoing ones (music, downloads, navigation), never "3 new messages" summaries. Nothing leaves the phone.
 * Read by the page through NativeBridge.recallNotes (the newest) and recallFind (older ones by words).
 */
object RecallLog {
    private const val PREFS = "attune.recall"
    private const val NEWEST = 3000

    private class Db(ctx: Context) : SQLiteOpenHelper(ctx, "recall.db", null, 1) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("CREATE TABLE notes (id TEXT PRIMARY KEY, k TEXT UNIQUE, pkg TEXT, app TEXT, title TEXT, text TEXT, ts INTEGER)")
            db.execSQL("CREATE INDEX notes_ts ON notes(ts)")
        }
        override fun onUpgrade(db: SQLiteDatabase, a: Int, b: Int) {}
    }
    @Volatile private var db: Db? = null
    private fun open(ctx: Context): SQLiteDatabase {
        val d = db ?: synchronized(this) { db ?: Db(ctx.applicationContext).also { db = it } }
        val w = d.writableDatabase
        migrate(ctx, w)
        return w
    }
    // the 30-day list kept before v8.7 (in preferences) moves into the database once
    private fun migrate(ctx: Context, w: SQLiteDatabase) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val old = p.getString("items", null) ?: return
        try { val arr = JSONArray(old); for (i in 0 until arr.length()) arr.optJSONObject(i)?.let { put(w, it) } } catch (e: Exception) { }
        p.edit().remove("items").apply()
    }
    private fun put(w: SQLiteDatabase, o: JSONObject) {
        val v = ContentValues()
        v.put("id", o.optString("id")); v.put("pkg", o.optString("pkg")); v.put("app", o.optString("app"))
        v.put("title", o.optString("title")); v.put("text", o.optString("text")); v.put("ts", o.optLong("ts"))
        v.put("k", o.optString("pkg") + "|" + o.optString("title") + "|" + o.optString("text"))   // the same message updated → one row
        w.insertWithOnConflict("notes", null, v, SQLiteDatabase.CONFLICT_REPLACE)
    }
    private fun rows(w: SQLiteDatabase, where: String?, args: Array<String>?, limit: Int): JSONArray {
        val out = JSONArray()
        w.query("notes", arrayOf("id", "pkg", "app", "title", "text", "ts"), where, args, null, null, "ts DESC", limit.toString()).use { c ->
            while (c.moveToNext()) out.put(JSONObject().put("id", c.getString(0)).put("pkg", c.getString(1)).put("app", c.getString(2))
                .put("title", c.getString(3)).put("text", c.getString(4)).put("ts", c.getLong(5)))
        }
        return out
    }

    fun isOn(ctx: Context): Boolean = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("on", true)   // v8.7: on by default
    fun setOn(ctx: Context, on: Boolean) { ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("on", on).apply() }

    @Synchronized
    fun add(ctx: Context, sbn: StatusBarNotification, app: String, title: String, text: String) {
        if (!isOn(ctx)) return
        val n = sbn.notification ?: return
        if (sbn.packageName == ctx.packageName || sbn.isOngoing) return
        // v8.7 (Ali: "it reads SMS, but not one-time codes"): SMS with the SMS switch on — a one-time code never
        if (WatchMatch.isSms(sbn.packageName) && (!WatchMatch.smsAllowed || PayLog.isOtp(title) || PayLog.isOtp(text))) return
        if ((n.flags and android.app.Notification.FLAG_GROUP_SUMMARY) != 0) return
        if (text.isBlank() || n.category == android.app.Notification.CATEGORY_PROGRESS || n.category == android.app.Notification.CATEGORY_TRANSPORT) return
        val key = sbn.packageName + "|" + title + "|" + text
        put(open(ctx), JSONObject().put("id", sbn.packageName + ":" + sbn.postTime + ":" + key.hashCode()).put("pkg", sbn.packageName)
            .put("app", app).put("title", title.take(200)).put("text", text.take(2000)).put("ts", sbn.postTime))
    }

    /** The newest ones (what the Recall page lists and searches first). */
    fun items(ctx: Context): String = rows(open(ctx), null, null, NEWEST).toString()

    /** Older ones that have any of the words (the page ranks them with the rest). terms = ["chelsea", "score"]. */
    fun find(ctx: Context, termsJson: String, limit: Int): String {
        val t = try { JSONArray(termsJson) } catch (e: Exception) { JSONArray() }
        val words = (0 until t.length()).map { t.optString(it).trim() }.filter { it.length >= 2 }.take(8)
        if (words.isEmpty()) return "[]"
        val where = words.joinToString(" OR ") { "(title LIKE ? OR text LIKE ? OR app LIKE ?)" }
        val args = words.flatMap { w -> val l = "%" + w.replace("%", "").replace("_", "") + "%"; listOf(l, l, l) }.toTypedArray()
        return rows(open(ctx), where, args, limit.coerceIn(1, 1000)).toString()
    }

    fun count(ctx: Context): Long = try { android.database.DatabaseUtils.queryNumEntries(open(ctx), "notes") } catch (e: Exception) { 0L }

    /** Everything kept, for the backup file and the daily backup. */
    fun exportAll(ctx: Context): String = rows(open(ctx), null, null, Int.MAX_VALUE).toString()
    /** A backup's messages back in (nothing kept here is lost; the same message twice stays one). → how many. */
    @Synchronized
    fun importAll(ctx: Context, json: String): Int {
        val arr = try { JSONArray(json) } catch (e: Exception) { return 0 }
        val w = open(ctx); var n = 0
        w.beginTransaction()
        try { for (i in 0 until arr.length()) arr.optJSONObject(i)?.let { if (it.optString("id").isNotBlank()) { put(w, it); n++ } }; w.setTransactionSuccessful() } finally { w.endTransaction() }
        return n
    }

    @Synchronized
    fun forget(ctx: Context, idsJson: String) {
        val ids = try { JSONArray(idsJson) } catch (e: Exception) { return }
        val w = open(ctx)
        for (i in 0 until ids.length()) w.delete("notes", "id = ?", arrayOf(ids.optString(i)))
    }
    @Synchronized
    fun forgetAll(ctx: Context) { open(ctx).delete("notes", null, null) }
}

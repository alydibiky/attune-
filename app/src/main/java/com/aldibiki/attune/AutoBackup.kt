package com.aldibiki.attune

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import org.json.JSONObject

/**
 * v8.7 (Ali, 29 Oct: "offline backup and online backup like WhatsApp"): the person picks ONE folder once with Android's own
 * picker — a folder on the phone / SD card (offline), or a folder in Google Drive (online: the Drive app uploads it) — and
 * Attune writes its locked backup there every day (web-src/autobackup.js makes it: the backup file + Recall's messages,
 * encrypted with the person's backup password). The newest 3 are kept, older ones deleted. No Google setup is needed.
 */
object AutoBackup {
    private const val PREFS = "attune.autobackup"
    const val PREFIX = "attune-auto-"

    fun folder(ctx: Context): Uri? = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("tree", null)?.let { Uri.parse(it) }
    fun state(ctx: Context): JSONObject {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val u = folder(ctx)
        val ok = u != null && ctx.contentResolver.persistedUriPermissions.any { it.uri == u && it.isWritePermission }
        return JSONObject().put("set", ok).put("name", if (ok) p.getString("name", "") else "").put("where", if (ok) p.getString("where", "") else "")
    }
    /** The picker's answer: keep the folder (and the right to write there after a restart). */
    fun chosen(ctx: Context, uri: Uri?): JSONObject {
        if (uri == null) return JSONObject().put("ok", false)
        try { ctx.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION) } catch (e: Exception) { }
        val docId = try { DocumentsContract.getTreeDocumentId(uri) } catch (e: Exception) { "" }
        val where = when { uri.authority?.contains("google.android.apps.docs") == true -> "drive"; else -> "phone" }
        val name = docId.substringAfterLast(':').substringAfterLast('/').ifBlank { "Attune" }
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("tree", uri.toString()).putString("name", name).putString("where", where).apply()
        return state(ctx).put("ok", true)
    }

    /** Write one backup file into the folder and keep the newest 3. Runs on a background thread. → the file's name. */
    fun write(ctx: Context, name: String, text: String): String {
        val tree = folder(ctx) ?: throw IllegalStateException("Choose a backup folder first")
        val cr = ctx.contentResolver
        val parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
        val doc = DocumentsContract.createDocument(cr, parent, "application/octet-stream", name) ?: throw IllegalStateException("Could not write in that folder")
        cr.openOutputStream(doc, "wt")?.use { it.write(text.toByteArray(Charsets.UTF_8)) } ?: throw IllegalStateException("Could not write in that folder")
        // keep the newest 3 automatic backups
        try {
            val kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
            val mine = mutableListOf<Pair<String, String>>()   // (name, docId)
            cr.query(kids, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { c ->
                while (c.moveToNext()) { val n = c.getString(1) ?: continue; if (n.startsWith(PREFIX)) mine.add(n to c.getString(0)) }
            }
            mine.sortByDescending { it.first }
            for ((_, id) in mine.drop(3)) try { DocumentsContract.deleteDocument(cr, DocumentsContract.buildDocumentUriUsingTree(tree, id)) } catch (e: Exception) { }
        } catch (e: Exception) { }
        return name
    }
}

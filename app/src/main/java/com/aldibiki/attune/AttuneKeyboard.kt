package com.aldibiki.attune

import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * v6.32 — the Attune keyboard (roadmap: "offline AI keyboard in every app: translate, improve, reply in Egyptian Arabic,
 * prompt-improve"). An ordinary English / Arabic keyboard with a strip of four actions on top:
 *   Improve   — fix the spelling and wording of what you typed (same language; Egyptian stays Egyptian)
 *   Translate — Arabic ↔ English
 *   Reply     — copy the message you got, tap Reply: a short reply (in Egyptian Arabic when the message is Arabic)
 *   Prompt    — turn a rough request into a clear prompt for any AI
 * They act on the selected text, or on the whole box when nothing is selected. The model is the one loaded in Attune
 * (same process: Engine / FastEngine), so nothing leaves the phone. With no model awake, Improve still tidies the text
 * by code, and the strip offers to wake the model. Passwords and number fields get plain keys only (no strip).
 * Turned on from Attune (Settings → Attune keyboard) → the system's keyboard settings.
 */
class AttuneKeyboard : InputMethodService() {

    private val ui = Handler(Looper.getMainLooper())
    private val exec = Executors.newSingleThreadExecutor()
    private var cancel = AtomicBoolean(false)

    private var lang = "en"            // "en" | "ar"
    private var symbols = false
    private var shift = 0              // 0 off, 1 once, 2 caps lock
    private var lastShiftAt = 0L
    private var aiAllowed = true

    private lateinit var root: LinearLayout
    private lateinit var strip: LinearLayout
    private lateinit var panel: LinearLayout
    private lateinit var panelText: TextView
    private lateinit var panelButtons: LinearLayout
    private lateinit var keys: LinearLayout

    // the text an action works on, and how to put the result back
    private var result = ""
    private var replaceSel = false
    private var replaceAll = false

    private val bg = Color.parseColor("#14171c")
    private val keyBg = Color.parseColor("#262a31")
    private val modBg = Color.parseColor("#1d2026")
    private val ink = Color.parseColor("#e8ebef")
    private val sub = Color.parseColor("#9aa3ad")
    private val acc = Color.parseColor("#4fc2af")

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()
    private val ar get() = lang == "ar"
    private fun t(en: String, arText: String) = if (ar) arText else en

    override fun onCreate() {
        super.onCreate()
        lang = getSharedPreferences("attune", MODE_PRIVATE).getString("kb_lang", "en") ?: "en"
    }

    override fun onCreateInputView(): View {
        root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(bg); setPadding(dp(3f), dp(4f), dp(3f), dp(6f)) }
        strip = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val sv = HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false; addView(strip) }
        root.addView(sv, LinearLayout.LayoutParams(-1, dp(40f)))
        panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; visibility = View.GONE; setPadding(dp(8f), dp(6f), dp(8f), dp(6f)); background = round(modBg, 10f) }
        panelText = TextView(this).apply { setTextColor(ink); textSize = 15f; setTextIsSelectable(false) }
        panel.addView(ScrollView(this).apply { addView(panelText) }, LinearLayout.LayoutParams(-1, dp(92f)))
        panelButtons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.END }
        panel.addView(panelButtons, LinearLayout.LayoutParams(-1, -2))
        root.addView(panel, LinearLayout.LayoutParams(-1, -2).apply { setMargins(dp(3f), 0, dp(3f), dp(4f)) })
        keys = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(keys, LinearLayout.LayoutParams(-1, -2))
        buildStrip(); buildKeys()
        return root
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        val cls = (info?.inputType ?: 0) and InputType.TYPE_MASK_CLASS
        val variation = (info?.inputType ?: 0) and InputType.TYPE_MASK_VARIATION
        val secret = cls == InputType.TYPE_CLASS_TEXT && (variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
            variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD || variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD)
        aiAllowed = cls == InputType.TYPE_CLASS_TEXT && !secret
        symbols = cls == InputType.TYPE_CLASS_NUMBER || cls == InputType.TYPE_CLASS_PHONE
        shift = if (aiAllowed && !ar && (info?.initialCapsMode ?: 0) != 0) 1 else 0
        if (::root.isInitialized) { hidePanel(); buildStrip(); buildKeys() }
    }

    override fun onFinishInputView(finishingInput: Boolean) { cancel.set(true); super.onFinishInputView(finishingInput) }

    // ---------- the strip ----------
    private fun buildStrip() {
        strip.removeAllViews()
        if (!aiAllowed) {
            strip.addView(label(t("Attune keyboard", "لوحة مفاتيح Attune")))
            return
        }
        chip("✨ " + t("Improve", "تحسين")) { act("improve") }
        chip("🌐 " + t("Translate", "ترجمة")) { act("translate") }
        chip("💬 " + t("Reply", "رد")) { act("reply") }
        chip("🎯 " + t("Prompt", "برومبت")) { act("prompt") }
        strip.addView(label(when {
            Engine.state == Engine.State.READY -> "● " + t("model ready", "النموذج جاهز")
            Engine.state == Engine.State.STARTING -> "◌ " + t("waking…", "جارٍ التشغيل…")
            else -> "○ " + t("model asleep", "النموذج متوقف")
        }))
    }

    private fun chip(text: String, on: () -> Unit) {
        val v = TextView(this).apply {
            this.text = text; setTextColor(ink); textSize = 14f; gravity = Gravity.CENTER
            setPadding(dp(12f), 0, dp(12f), 0); background = round(modBg, 18f)
            setOnClickListener { it.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP); on() }
        }
        strip.addView(v, LinearLayout.LayoutParams(-2, dp(34f)).apply { setMargins(dp(3f), 0, dp(3f), 0) })
    }
    private fun label(text: String) = TextView(this).apply { this.text = text; setTextColor(sub); textSize = 12f; setPadding(dp(10f), 0, dp(10f), 0); gravity = Gravity.CENTER_VERTICAL }

    // ---------- the actions ----------
    /** The text to work on: the selection, else the whole box (up to 4,000 characters each side of the cursor). */
    private fun source(): String {
        val ic = currentInputConnection ?: return ""
        val sel = ic.getSelectedText(0)?.toString() ?: ""
        replaceSel = sel.isNotBlank(); replaceAll = false
        if (replaceSel) return sel
        val before = ic.getTextBeforeCursor(4000, 0)?.toString() ?: ""
        val after = ic.getTextAfterCursor(4000, 0)?.toString() ?: ""
        replaceAll = (before + after).isNotBlank()
        return before + after
    }

    private fun clipText(): String = try {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(this)?.toString() ?: ""
    } catch (e: Exception) { "" }   // Android 10+ lets the keyboard read the clipboard while it is shown

    private fun act(kind: String) {
        val text = source().trim()
        val message = if (kind == "reply") clipText().trim() else ""
        if (kind == "reply" && message.isEmpty()) { show(t("Copy the message you got (long-press → Copy), then tap Reply.", "انسخ الرسالة التي وصلتك (اضغط مطولًا ← نسخ)، ثم اضغط «رد»."), listOf()); return }
        if (kind != "reply" && text.isEmpty()) { show(t("Type something first, or select the text to change.", "اكتب شيئًا أولًا، أو حدّد النص الذي تريد تغييره."), listOf()); return }
        if (kind == "reply") { replaceSel = false; replaceAll = false }   // a reply is added at the cursor (the box may hold what you want to say)
        if (Engine.state != Engine.State.READY) {
            if (kind == "improve") { result = KeyboardText.tidy(text); show(result + "\n\n" + t("(Tidied without a model — wake the model for a full rewrite.)", "(رُتّب دون نموذج — شغّل النموذج لإعادة صياغة كاملة.)"), listOf(useBtn(), wakeBtn())); return }
            show(if (ModelStore.active(this) == null) t("Install a model in Attune first (Engine).", "ثبّت نموذجًا في Attune أولًا («المحرك»).") else t("The model is asleep.", "النموذج متوقف."),
                listOf(if (ModelStore.active(this) == null) openBtn() else wakeBtn()))
            return
        }
        cancel.set(true); val stop = AtomicBoolean(false); cancel = stop
        show(t("Writing…", "جارٍ الكتابة…"), listOf(btn(t("Stop", "إيقاف")) { stop.set(true); hidePanel() }))
        val msgs = KeyboardText.messages(kind, text, message, lang)
        exec.execute {
            val out = try { KeyboardText.clean(generate(msgs, stop)) } catch (e: Exception) { "⚠ " + (e.message ?: "error") }
            ui.post {
                if (stop.get()) return@post
                if (out.startsWith("⚠") || out.isBlank()) { show(out.ifBlank { t("No answer — try again.", "لا توجد إجابة — حاول مرة أخرى.") }, listOf(btn(t("Again", "مرة أخرى")) { act(kind) })); return@post }
                result = out
                show(out, listOf(btn(t("Again", "مرة أخرى")) { act(kind) }, useBtn()))
            }
        }
    }

    /** One answer from the model Attune has loaded (llama-server on this phone, or the fast engine). */
    private fun generate(msgs: JSONArray, stop: AtomicBoolean): String {
        val body = JSONObject().put("messages", msgs).put("temperature", 0.3).put("max_tokens", 500).put("stream", false)
            .put("chat_template_kwargs", JSONObject().put("enable_thinking", false))
        if (Engine.kind == "litert") return FastEngine.chat(applicationContext, "kb-" + System.currentTimeMillis(), body, stop) { _, _ -> }.optString("content")
        val c = URL(Engine.baseUrl + "/v1/chat/completions").openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 3000; c.readTimeout = 120000
        c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Authorization", "Bearer " + Engine.apiKey)
        c.outputStream.use { it.write(body.toString().toByteArray()) }
        val code = c.responseCode
        val txt = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        c.disconnect()
        if (code !in 200..299) throw java.io.IOException("The model answered $code")
        return JSONObject(txt).optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optString("content") ?: ""
    }

    private fun useBtn() = btn(t("Use it", "استخدمه"), primary = true) { insert(result) }
    private fun wakeBtn() = btn(t("Wake the model", "تشغيل النموذج"), primary = true) {
        val m = ModelStore.active(this) ?: return@btn
        Engine.start(applicationContext, m) { _, _ -> ui.post { buildStrip() } }
        ui.postDelayed({ buildStrip() }, 300)
        show(t("Waking the model… try again in a moment.", "جارٍ تشغيل النموذج… حاول بعد لحظة."), listOf())
    }
    private fun openBtn() = btn(t("Open Attune", "فتح Attune"), primary = true) {
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun insert(text: String) {
        val ic = currentInputConnection ?: return
        ic.beginBatchEdit()
        if (replaceAll && !replaceSel) {
            val b = ic.getTextBeforeCursor(4000, 0)?.length ?: 0
            val a = ic.getTextAfterCursor(4000, 0)?.length ?: 0
            ic.deleteSurroundingText(b, a)
        }
        ic.commitText(text, 1)        // replaces the selection when there is one
        ic.endBatchEdit()
        hidePanel()
    }

    private fun show(text: String, buttons: List<View>) {
        panelText.text = text
        panelText.textDirection = View.TEXT_DIRECTION_FIRST_STRONG
        panelButtons.removeAllViews()
        panelButtons.addView(btn("✕") { cancel.set(true); hidePanel() })
        buttons.forEach { panelButtons.addView(it) }
        panel.visibility = View.VISIBLE
    }
    private fun hidePanel() { if (::panel.isInitialized) panel.visibility = View.GONE; if (::strip.isInitialized) buildStrip() }

    private fun btn(text: String, primary: Boolean = false, on: () -> Unit) = TextView(this).apply {
        this.text = text; textSize = 14f; gravity = Gravity.CENTER
        setTextColor(if (primary) Color.parseColor("#0b1f1c") else ink)
        background = round(if (primary) acc else keyBg, 16f)
        setPadding(dp(14f), dp(7f), dp(14f), dp(7f))
        layoutParams = LinearLayout.LayoutParams(-2, -2).apply { setMargins(dp(6f), dp(6f), 0, 0) }
        setOnClickListener { on() }
    }

    // ---------- the keys ----------
    private val EN = listOf("qwertyuiop", "asdfghjkl", "zxcvbnm")
    private val AR = listOf("ضصثقفغعهخحج", "شسيبلاتنمكط", "ذئءؤرىةوزظد")
    private val SYM = listOf("1234567890", "@#$%&-+()/", "*\"':;!?=_")
    private val SYM_AR = listOf("1234567890", "@#$%&-+()/", "أإآ\"':؛!؟ـ")

    private fun buildKeys() {
        keys.removeAllViews()
        val rows = if (symbols) (if (ar) SYM_AR else SYM) else if (ar) AR else EN
        rows.forEachIndexed { i, r ->
            val row = newRow()
            if (i == 2 && !ar && !symbols) row.addView(modKey(if (shift == 2) "⇪" else "⇧", 1.4f) { toggleShift() })
            r.forEach { ch -> row.addView(charKey(ch.toString())) }
            if (i == 2) row.addView(backspace())
            keys.addView(row)
        }
        val last = newRow()
        last.addView(modKey(if (symbols) t("ABC", "أبج") else "?123", 1.4f) { symbols = !symbols; buildKeys() })
        last.addView(modKey("🌐", 1.1f, long = { (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).showInputMethodPicker() }) { switchLang() })
        last.addView(charKey(if (ar) "،" else ","))
        last.addView(modKey(if (ar) "عربي" else "English", 4.2f, text = " ") {})
        last.addView(charKey("."))
        last.addView(modKey("⏎", 1.5f, primary = true) { enter() })
        keys.addView(last)
    }

    private fun newRow() = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; layoutDirection = View.LAYOUT_DIRECTION_LTR }

    private fun keyView(label: String, w: Float, color: Int, textColor: Int = ink) = TextView(this).apply {
        text = label; setTextColor(textColor); gravity = Gravity.CENTER
        textSize = if (label.length > 2) 13f else 21f
        if (label.length > 2) typeface = Typeface.DEFAULT_BOLD
        background = round(color, 7f)
        layoutParams = LinearLayout.LayoutParams(0, dp(46f), w).apply { setMargins(dp(2.5f), dp(4f), dp(2.5f), dp(4f)) }
    }

    private fun charKey(ch: String): View {
        val shown = if (shift > 0 && !ar && !symbols) ch.uppercase() else ch
        return keyView(shown, 1f, keyBg).apply {
            setOnClickListener {
                it.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                currentInputConnection?.commitText(if (shift > 0 && !ar && !symbols) ch.uppercase() else ch, 1)
                if (shift == 1) { shift = 0; buildKeys() }
            }
        }
    }

    private fun modKey(label: String, w: Float, primary: Boolean = false, text: String? = null, long: (() -> Unit)? = null, on: () -> Unit): View =
        keyView(label, w, if (primary) acc else modBg, if (primary) Color.parseColor("#0b1f1c") else if (text != null) sub else ink).apply {
            setOnClickListener {
                it.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                if (text != null) { currentInputConnection?.commitText(text, 1); if (!ar && !symbols && shift == 0) autoCap() } else on()
            }
            if (long != null) setOnLongClickListener { long(); true }
        }

    /** Backspace: one tap deletes one character (or the selection); holding it keeps deleting. */
    private fun backspace(): View = keyView("⌫", 1.4f, modBg).apply {
        val repeat = object : Runnable { override fun run() { del(); ui.postDelayed(this, 60) } }
        setOnTouchListener { v, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> { v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP); del(); ui.postDelayed(repeat, 450) }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> ui.removeCallbacks(repeat)
            }
            true
        }
    }
    private fun del() {
        val ic = currentInputConnection ?: return
        if (!ic.getSelectedText(0).isNullOrEmpty()) { ic.commitText("", 1); return }
        val before = ic.getTextBeforeCursor(2, 0)?.toString() ?: ""
        // an emoji or other surrogate pair is two chars: delete both
        val n = if (before.length == 2 && Character.isSurrogatePair(before[0], before[1])) 2 else 1
        ic.deleteSurroundingText(n, 0)
    }

    private fun toggleShift() {
        val now = System.currentTimeMillis()
        shift = when { shift == 0 && now - lastShiftAt < 350 -> 2; shift == 0 -> 1; shift == 1 && now - lastShiftAt < 350 -> 2; else -> 0 }
        lastShiftAt = now; buildKeys()
    }
    private fun autoCap() {
        val before = currentInputConnection?.getTextBeforeCursor(3, 0)?.toString() ?: return
        if (Regex("[.!?]\\s$").containsMatchIn(before)) { shift = 1; buildKeys() }
    }

    private fun switchLang() {
        lang = if (ar) "en" else "ar"; shift = 0
        getSharedPreferences("attune", MODE_PRIVATE).edit().putString("kb_lang", lang).apply()
        buildStrip(); buildKeys()
    }

    private fun enter() {
        val ei = currentInputEditorInfo
        val action = (ei?.imeOptions ?: 0) and EditorInfo.IME_MASK_ACTION
        val noAction = ((ei?.imeOptions ?: 0) and EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0
        val multi = ((ei?.inputType ?: 0) and InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0
        if (!multi && !noAction && action != EditorInfo.IME_ACTION_NONE && action != EditorInfo.IME_ACTION_UNSPECIFIED) currentInputConnection?.performEditorAction(action)
        else currentInputConnection?.commitText("\n", 1)
    }

    private fun round(color: Int, r: Float) = GradientDrawable().apply { setColor(color); cornerRadius = dp(r).toFloat() }

    companion object {
        /** True when the user has turned the Attune keyboard on in the system settings. */
        fun enabled(ctx: Context): Boolean = try {
            (ctx.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).enabledInputMethodList.any { it.packageName == ctx.packageName }
        } catch (e: Exception) { false }
    }
}

/** The keyboard's words for the model, and the code-only tidy. */
object KeyboardText {
    private val arabic = Regex("[\\u0600-\\u06FF]")
    fun isArabic(s: String) = arabic.findAll(s).count() >= s.count { it.isLetter() } / 3 && arabic.containsMatchIn(s)

    fun messages(kind: String, text: String, message: String, lang: String): JSONArray {
        val sys = when (kind) {
            "improve" -> "Improve the user's text: fix spelling, grammar and punctuation and make it read smoothly. Keep the meaning, the language and the tone (Egyptian Arabic stays Egyptian Arabic; English stays English). Keep names, numbers and links exactly. Reply with the improved text only — no quotes, no notes."
            "translate" -> if (isArabic(text)) "Translate the user's text into natural English. Keep names, numbers and links exactly. Reply with the translation only."
                else "Translate the user's text into clear, simple Arabic (Modern Standard, friendly). Keep names, numbers and links exactly. Reply with the translation only."
            "reply" -> (if (isArabic(message) || lang == "ar") "Write a short, natural reply to the message below in Egyptian Arabic (عامية مصرية), polite and warm, the way a person types on WhatsApp."
                else "Write a short, natural reply to the message below in the same language, polite and friendly, the way a person types on WhatsApp.") +
                " If the user gives notes on what to say, follow them. Don't promise anything the notes don't say. Reply with the message only."
            else -> "Rewrite the user's rough request as a clear prompt for an AI assistant, in the same language: say the goal, the needed context and constraints, and the format of the answer; use short labelled lines (Goal, Context, Requirements, Answer format). Don't answer it, and don't invent facts — leave [brackets] for anything the user must fill in. Reply with the prompt only."
        }
        val user = if (kind == "reply") "Message:\n$message" + (if (text.isNotBlank()) "\n\nMy notes on what to say:\n$text" else "") else text
        return JSONArray().put(JSONObject().put("role", "system").put("content", sys)).put(JSONObject().put("role", "user").put("content", user.take(6000)))
    }

    /** What the model wrote, without thinking, quotes or a "Here is…" opener. */
    fun clean(s: String): String {
        var t = s.replace(Regex("(?s)<think>.*?</think>"), "").trim()
        t = t.replace(Regex("^(here('s| is) (the |your )?(improved|translated|rewritten|reply|translation|prompt)[^:\\n]*:\\s*)", RegexOption.IGNORE_CASE), "")
        if (t.length > 1 && (t.first() == '"' && t.last() == '"' || t.first() == '“' && t.last() == '”')) t = t.substring(1, t.length - 1)
        return t.trim()
    }

    /** Improve with no model: spaces, capitals, "i", the Arabic question mark and comma. */
    fun tidy(s: String): String {
        var t = s.replace(Regex("[ \\t]{2,}"), " ").replace(Regex(" +([,.!?;:،؟])"), "$1")
            .replace(Regex("([,;:،])(?=[^\\s\\d])"), "$1 ").replace(Regex("([.!?؟])(?=[A-Za-z\\u0600-\\u06FF])"), "$1 ")
        t = t.replace(Regex("\\bi\\b"), "I").replace(Regex("\\bi'(m|ve|ll|d)\\b"), "I'$1")
        t = Regex("(^|[.!?]\\s+)([a-z])").replace(t) { it.groupValues[1] + it.groupValues[2].uppercase() }
        if (isArabic(t)) t = t.replace(Regex("\\?"), "؟").replace(Regex(",(?=\\s)"), "،")
        return t.trim()
    }
}

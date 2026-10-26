package com.aldibiki.attune

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * Speech to text with the phone's own recogniser. When the phone has an
 * on-device recogniser (most Android 12+ phones with Google's speech
 * services), that one is used, so the voice never leaves the phone; with the
 * offline lock on, only the on-device one is allowed.
 *
 * Words are passed to the page as they are recognised, so the text appears
 * while the person is still speaking.
 */
class Voice(private val activity: Activity) {

    interface Sink {
        fun partial(text: String)
        fun done(text: String)
        fun failed(message: String)
    }

    private var rec: SpeechRecognizer? = null
    private var pending: (() -> Unit)? = null

    fun hasPermission(): Boolean =
        activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    /** Called by the activity when the microphone permission dialog closes. */
    fun onPermission(granted: Boolean, sink: Sink) {
        val p = pending; pending = null
        if (granted) p?.invoke() else sink.failed("Microphone permission is needed for voice input")
    }

    /**
     * v6.46 (Ali, 21 Oct: the interpreter and the voice call said "That language isn't installed for offline voice" with no way
     * to install it): when the phone's offline recogniser lacks the language, Attune tries (1) the language without its region
     * ("ar" for "ar-EG"), (2) the phone's normal recogniser (unless the offline lock is on — the same rule as a phone with no
     * offline recogniser at all), and (3) asks Android to download the offline pack (Android 13+: its own download screen;
     * older: Google's offline-languages list) and says so.
     */
    fun start(lang: String, sink: Sink, step: Int = 0, askPermission: () -> Unit) {
        activity.runOnUiThread {
            if (!hasPermission()) {
                pending = { start(lang, sink, step, askPermission) }
                askPermission()
                return@runOnUiThread
            }
            stop()
            val onDevice = (step < 2 || step == 3) && Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)
            if (!onDevice && Prefs.airGapNow) {
                sink.failed("This phone has no offline speech recogniser, and the offline lock is on")
                return@runOnUiThread
            }
            if (!onDevice && !SpeechRecognizer.isRecognitionAvailable(activity)) {
                sink.failed("This phone has no speech recogniser installed")
                return@runOnUiThread
            }
            val r = if (onDevice) SpeechRecognizer.createOnDeviceSpeechRecognizer(activity)
                    else SpeechRecognizer.createSpeechRecognizer(activity)
            rec = r
            r.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
                override fun onPartialResults(b: Bundle?) {
                    val t = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
                    sink.partial(t)
                }
                override fun onResults(b: Bundle?) {
                    val t = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
                    sink.done(t); release()
                }
                override fun onError(error: Int) {
                    val noLang = error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED || error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE
                    if (noLang && onDevice) {
                        release()
                        val base = lang.substringBefore('-')
                        when {
                            step == 0 && base != lang && base.isNotBlank() -> { start(base, sink, 1, askPermission); return }
                            !Prefs.airGapNow && SpeechRecognizer.isRecognitionAvailable(activity) -> { getPack(lang); start(lang, sink, 2, askPermission); return }
                            else -> { val asked = getPack(lang); sink.failed(if (asked) "Android is downloading the offline speech pack for this language — try again when it finishes" else "That language isn't installed for offline voice — add it in the phone's Settings → Google → Speech → Offline languages"); return }
                        }
                    }
                    // v8.2 (Ali, 26 Oct: "the voice is not working at all"): every failure goes into the engine log with its code,
                    // and the phone's offline recogniser failing for any other reason than silence hands over to the normal one;
                    // a busy microphone (the wake word letting go of it) is tried once more
                    log("error $error (" + (if (onDevice) "offline" else "normal") + " recogniser, $lang, step $step)")
                    val silent = error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                    if ((error == SpeechRecognizer.ERROR_AUDIO || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) && step != 3 && step != 4) {
                        release(); android.os.Handler(activity.mainLooper).postDelayed({ start(lang, sink, if (onDevice) 3 else 4, askPermission) }, 700); return
                    }
                    if (onDevice && !silent && error != SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS && !Prefs.airGapNow && SpeechRecognizer.isRecognitionAvailable(activity)) {
                        release(); start(lang, sink, 2, askPermission); return
                    }
                    sink.failed(when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Didn't catch that — try again"
                        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Voice needs the phone's offline speech pack for this language"
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is needed for voice input"
                        SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "That language isn't installed for offline voice on this phone"
                        else -> "Voice input stopped (code $error)"
                    })
                    release()
                }
            })
            val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            if (lang.isNotBlank()) i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            try { r.startListening(i) } catch (e: Exception) { log("start failed: " + e.message); sink.failed(e.message ?: "Voice input failed"); release() }
        }
    }

    private fun log(msg: String) {
        try { java.io.File(activity.filesDir, "engine.log").appendText("\nVoice (" + java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date()) + "): " + msg) } catch (e: Exception) {}
    }

    /** Asks Android for the offline speech pack of `lang` (once a run of the app per language). True when a download screen was shown. */
    private val asked = HashSet<String>()
    private fun getPack(lang: String): Boolean {
        if (!asked.add(lang)) return false
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
        if (Build.VERSION.SDK_INT >= 33) {
            try { val r = SpeechRecognizer.createOnDeviceSpeechRecognizer(activity); r.triggerModelDownload(i); r.destroy(); return true } catch (e: Throwable) {}
        }
        return try {   // Google's own list of offline speech languages
            activity.startActivity(Intent().setClassName("com.google.android.googlequicksearchbox", "com.google.android.voicesearch.greco3.languagepack.InstallActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true
        } catch (e: Throwable) { false }
    }

    fun stop() {
        activity.runOnUiThread { try { rec?.stopListening() } catch (e: Exception) {} }
    }

    private fun release() {
        activity.runOnUiThread { try { rec?.destroy() } catch (e: Exception) {}; rec = null }
    }
}

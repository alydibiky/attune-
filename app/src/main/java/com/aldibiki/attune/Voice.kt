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

    fun start(lang: String, sink: Sink, askPermission: () -> Unit) {
        activity.runOnUiThread {
            if (!hasPermission()) {
                pending = { start(lang, sink, askPermission) }
                askPermission()
                return@runOnUiThread
            }
            stop()
            val onDevice = Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)
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
            try { r.startListening(i) } catch (e: Exception) { sink.failed(e.message ?: "Voice input failed"); release() }
        }
    }

    fun stop() {
        activity.runOnUiThread { try { rec?.stopListening() } catch (e: Exception) {} }
    }

    private fun release() {
        activity.runOnUiThread { try { rec?.destroy() } catch (e: Exception) {}; rec = null }
    }
}

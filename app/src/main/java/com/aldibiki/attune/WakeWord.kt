package com.aldibiki.attune

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.Manifest
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.ToneGenerator
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.provider.Settings
import org.json.JSONObject
import java.nio.FloatBuffer

/**
 * Voice phase 3 (VOICE_PLAN.md): «يا أتيون» / "Hey Attune" — said out loud, and the voice screen opens listening.
 *
 * Off by default; the person turns it on (Prefs.wake). While on, a foreground service (type microphone, with its own
 * notification and a Pause / Turn off button — Google Play's rules for the microphone in the background) listens on the
 * phone only: nothing is recorded, kept or sent. Every 80 ms of sound goes through three small models (assets/wake):
 * melspectrogram.onnx and embedding_model.onnx (openWakeWord's front end, Apache-2.0) and Attune's own wake model
 * (attune_wake.onnx, trained for Egyptian / Gulf / Levantine / English ways of saying it — tools/wake/). About 1–2 % of
 * one core. When it hears it: the mic is let go (the voice screen needs it), a short tone, and the voice screen opens —
 * after the person unlocks the phone if it is locked (messages are never read to someone holding a locked phone).
 *
 * When: "always", only while the screen is on ("screen"), or only while charging ("charging") — the person picks.
 */
class WakeService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
    @Volatile private var loop: Thread? = null
    @Volatile private var running = false
    private var receiver: BroadcastReceiver? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_OFF -> { Prefs.setWake(this, false); stopAll(); return START_NOT_STICKY }
            ACTION_PAUSE -> { pausedUntil = System.currentTimeMillis() + 60 * 60 * 1000L; refresh(); }
            ACTION_RESUME -> { heardAt = 0L; pausedUntil = 0L; refresh() }
        }
        if (!Prefs.wake(this) || checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { stopAll(); return START_NOT_STICKY }
        try {
            val n = note()
            if (Build.VERSION.SDK_INT >= 30) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE) else startForeground(ID, n)
        } catch (e: Exception) { stopSelf(); return START_NOT_STICKY }   // e.g. started from the background (Android does not allow the mic then)
        if (receiver == null) {
            receiver = object : BroadcastReceiver() { override fun onReceive(c: Context, i: Intent) { refresh() } }
            val f = IntentFilter().apply { addAction(Intent.ACTION_SCREEN_ON); addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_POWER_CONNECTED); addAction(Intent.ACTION_POWER_DISCONNECTED) }
            try { registerReceiver(receiver, f) } catch (e: Exception) {}
        }
        refresh()
        return START_STICKY
    }

    /** Should the mic be open right now? (switch on, not paused, the "when" rule, not just woken, Attune not listening itself) */
    private fun wanted(): Boolean {
        if (!Prefs.wake(this)) return false
        val now = System.currentTimeMillis()
        if (now < pausedUntil) return false
        if (heardAt > 0 && now - heardAt < 45_000) return false   // the voice screen has the mic; it gives it back (wakeResume) or after 45 s
        if (selfListening) return false
        return when (Prefs.wakeWhen(this)) {
            "screen" -> (getSystemService(POWER_SERVICE) as PowerManager).isInteractive
            "charging" -> (getSystemService(BATTERY_SERVICE) as BatteryManager).isCharging
            else -> true
        }
    }

    private fun refresh() {
        val want = wanted()
        if (want && loop == null) start() else if (!want && loop != null) stopLoop()
        try { getSystemService(NotificationManager::class.java)?.notify(ID, note()) } catch (e: Exception) {}
        if (heardAt > 0) android.os.Handler(mainLooper).postDelayed({ if (running || loop == null) refresh() }, 46_000)
    }

    private fun start() {
        val det = try { Detector.get(this) } catch (e: Throwable) { lastError = e.message ?: "model"; return }
        running = true
        loop = Thread({
            val sr = 16000
            val min = AudioRecord.getMinBufferSize(sr, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val rec = try { AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, sr, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(min, 1280 * 2 * 4)) }
                      catch (e: SecurityException) { null }
            if (rec == null || rec.state != AudioRecord.STATE_INITIALIZED) { lastError = "mic"; running = false; loop = null; return@Thread }
            det.reset()
            val chunk = ShortArray(1280)
            try {
                rec.startRecording()
                var hits = 0
                while (running) {
                    var got = 0
                    while (got < 1280 && running) { val r = rec.read(chunk, got, 1280 - got); if (r <= 0) break; got += r }
                    if (got < 1280) continue
                    val s = det.push(chunk)
                    lastScore = s
                    if (s >= det.threshold * sensitivityScale(this)) hits++ else hits = 0
                    if (hits >= det.patience) { hits = 0; running = false; heard() }
                }
            } catch (e: Exception) { lastError = e.message ?: "loop" }
            finally { try { rec.stop() } catch (_: Exception) {}; rec.release(); loop = null }
        }, "attune-wake").apply { priority = Thread.NORM_PRIORITY - 1; start() }
    }

    private fun stopLoop() { running = false; try { loop?.join(400) } catch (_: Exception) {}; loop = null }

    private fun heard() {
        heardAt = System.currentTimeMillis()
        try { ToneGenerator(AudioManager.STREAM_NOTIFICATION, 60).startTone(ToneGenerator.TONE_PROP_ACK, 150) } catch (e: Exception) {}
        val open = Intent(this, MainActivity::class.java).putExtra(EXTRA_OPEN_PAGE, "voice").putExtra(EXTRA_WAKE, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        val canOpen = MainActivity.visible || (Build.VERSION.SDK_INT >= 23 && Settings.canDrawOverlays(this))
        var opened = false
        if (canOpen) opened = try { startActivity(open); true } catch (e: Exception) { false }
        if (!opened) {   // Android does not let an app open itself from the background: a "tap to talk" notification instead
            val nm = getSystemService(NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= 26 && nm?.getNotificationChannel(CH_HEARD) == null)
                nm?.createNotificationChannel(NotificationChannel(CH_HEARD, getString(R.string.wake_channel_heard), NotificationManager.IMPORTANCE_HIGH))
            val pi = PendingIntent.getActivity(this, 32, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val b = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CH_HEARD) else @Suppress("DEPRECATION") Notification.Builder(this))
                .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(getString(R.string.wake_heard_title)).setContentText(getString(R.string.wake_heard_text))
                .setContentIntent(pi).setAutoCancel(true).setTimeoutAfter(30_000)
            if (Build.VERSION.SDK_INT < 26) @Suppress("DEPRECATION") b.setPriority(Notification.PRIORITY_HIGH)
            try { nm?.notify(ID + 1, b.build()) } catch (e: Exception) {}
        }
        android.os.Handler(mainLooper).post { refresh() }
    }

    private fun note(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26 && nm?.getNotificationChannel(CH) == null)
            nm?.createNotificationChannel(NotificationChannel(CH, getString(R.string.wake_channel), NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        fun pi(action: String, code: Int) = PendingIntent.getService(this, code, Intent(this, WakeService::class.java).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val open = PendingIntent.getActivity(this, 31, Intent(this, MainActivity::class.java).putExtra(EXTRA_OPEN_PAGE, "voice").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val paused = System.currentTimeMillis() < pausedUntil
        val b = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CH) else @Suppress("DEPRECATION") Notification.Builder(this))
            .setSmallIcon(R.drawable.ic_stat_reminder)
            .setContentTitle(getString(if (paused) R.string.wake_paused_title else if (loop != null) R.string.wake_on_title else R.string.wake_wait_title))
            .setContentText(getString(R.string.wake_on_text))
            .setContentIntent(open).setOngoing(true)
        if (paused) b.addAction(Notification.Action.Builder(null, getString(R.string.wake_resume), pi(ACTION_RESUME, 34)).build())
        else b.addAction(Notification.Action.Builder(null, getString(R.string.wake_pause), pi(ACTION_PAUSE, 33)).build())
        b.addAction(Notification.Action.Builder(null, getString(R.string.wake_off), pi(ACTION_OFF, 35)).build())
        return b.build()
    }

    private fun stopAll() {
        stopLoop()
        receiver?.let { try { unregisterReceiver(it) } catch (_: Exception) {} }; receiver = null
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
        stopSelf()
    }

    override fun onDestroy() { stopLoop(); receiver?.let { try { unregisterReceiver(it) } catch (_: Exception) {} }; receiver = null; super.onDestroy() }

    /** The three models, run exactly as the training did (tools/wake/common.py embed): every 1280 samples the mel model on the
     *  last 1760, its 8 frames appended (÷10 + 2); the embedding model on the last 76 frames; the wake model on the last 16. */
    class Detector private constructor(ctx: Context) {
        private val env = OrtEnvironment.getEnvironment()
        private val opts = OrtSession.SessionOptions().apply { setIntraOpNumThreads(1); setInterOpNumThreads(1) }
        private fun load(ctx: Context, n: String) = env.createSession(ctx.assets.open("wake/$n").use { it.readBytes() }, opts)
        private val mel = load(ctx, "melspectrogram.onnx")
        private val emb = load(ctx, "embedding_model.onnx")
        private val cls = load(ctx, "attune_wake.onnx")
        private val cfg = try { JSONObject(ctx.assets.open("wake/config.json").bufferedReader().readText()) } catch (e: Exception) { JSONObject() }
        val threshold = cfg.optDouble("threshold", 0.5).toFloat()
        val patience = cfg.optInt("patience", 2)
        private val raw = FloatArray(1760)
        private val mels = ArrayDeque<FloatArray>()
        private val embs = ArrayDeque<FloatArray>()
        fun reset() {
            raw.fill(0f); mels.clear(); embs.clear()
            repeat(76) { mels.addLast(FloatArray(32) { 1f }) }
        }
        init { reset() }
        /** 1280 new samples (80 ms) → the wake score 0..1 (0 until 16 embeddings are there). */
        fun push(x: ShortArray): Float {
            System.arraycopy(raw, 1280, raw, 0, 480)
            for (i in 0 until 1280) raw[480 + i] = x[i].toFloat()
            OnnxTensor.createTensor(env, FloatBuffer.wrap(raw), longArrayOf(1, 1760)).use { t ->
                mel.run(mapOf(mel.inputNames.first() to t)).use { r ->
                    val out = (r[0].value as Array<Array<Array<FloatArray>>>)[0][0]   // [1,1,8,32]
                    for (f in out) { mels.addLast(FloatArray(32) { f[it] / 10f + 2f }); if (mels.size > 76) mels.removeFirst() }
                }
            }
            val win = FloatArray(76 * 32); var k = 0
            for (f in mels) { System.arraycopy(f, 0, win, k, 32); k += 32 }
            OnnxTensor.createTensor(env, FloatBuffer.wrap(win), longArrayOf(1, 76, 32, 1)).use { t ->
                emb.run(mapOf(emb.inputNames.first() to t)).use { r ->
                    @Suppress("UNCHECKED_CAST")
                    val e = (r[0].value as Array<Array<Array<FloatArray>>>)[0][0][0]   // [1,1,1,96]
                    embs.addLast(e.copyOf()); if (embs.size > 16) embs.removeFirst()
                }
            }
            if (embs.size < 16) return 0f
            val feat = FloatArray(16 * 96); k = 0
            for (e in embs) { System.arraycopy(e, 0, feat, k, 96); k += 96 }
            OnnxTensor.createTensor(env, FloatBuffer.wrap(feat), longArrayOf(1, 16, 96)).use { t ->
                cls.run(mapOf(cls.inputNames.first() to t)).use { r ->
                    val v = r[0].value
                    return when (v) { is Array<*> -> ((v[0] as FloatArray)[0]); is FloatArray -> v[0]; else -> 0f }
                }
            }
        }
        companion object {
            @Volatile private var one: Detector? = null
            fun get(ctx: Context): Detector = one ?: synchronized(this) { one ?: Detector(ctx.applicationContext).also { one = it } }
        }
    }

    companion object {
        private const val CH = "wake"
        private const val CH_HEARD = "wake_heard"
        private const val ID = 7401
        const val EXTRA_WAKE = "attune_wake"
        private const val ACTION_OFF = "com.aldibiki.attune.WAKE_OFF"
        private const val ACTION_PAUSE = "com.aldibiki.attune.WAKE_PAUSE"
        private const val ACTION_RESUME = "com.aldibiki.attune.WAKE_RESUME"
        private const val ACTION_CHECK = "com.aldibiki.attune.WAKE_CHECK"
        @Volatile var lastScore = 0f
        @Volatile var lastError = ""
        @Volatile private var heardAt = 0L
        @Volatile private var pausedUntil = 0L
        /** Attune itself is listening (the voice screen, dictation): the wake service lets the mic go meanwhile. */
        @Volatile var selfListening = false
            set(v) { field = v }

        /** "low" needs a clearer "Ya Attune" (fewer false wakes), "high" wakes more easily (a noisy car). */
        fun sensitivityScale(ctx: Context): Float = when (Prefs.wakeSensitivity(ctx)) { "low" -> 1.25f; "high" -> 0.75f; else -> 1f }

        /** Switch on / off from the page (Attune is on screen then — Android only lets the mic start in the foreground). */
        fun set(ctx: Context, on: Boolean) {
            Prefs.setWake(ctx, on)
            val i = Intent(ctx, WakeService::class.java)
            try { if (on) { if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i) } else ctx.startService(i.setAction(ACTION_OFF)) } catch (e: Exception) { lastError = e.message ?: "start" }
        }
        /** Give the mic back after the voice screen closed (or Attune's own listening ended). */
        fun resume(ctx: Context) {
            heardAt = 0L
            if (!Prefs.wake(ctx)) return
            try { ctx.startService(Intent(ctx, WakeService::class.java).setAction(ACTION_CHECK)) } catch (e: Exception) {}   // a manual "pause 1 hour" stays
        }
        /** Re-check now (after Attune's own listening started / ended). */
        fun resumeLater(ctx: Context, ms: Long) {
            if (!Prefs.wake(ctx)) return
            android.os.Handler(ctx.mainLooper).postDelayed({ try { ctx.startService(Intent(ctx, WakeService::class.java).setAction(ACTION_CHECK)) } catch (e: Exception) {} }, ms)
        }
        /** Opened again: the service comes back if it was on (it may have been stopped with the app). */
        fun ensure(ctx: Context) { if (Prefs.wake(ctx)) set(ctx, true) }
        fun state(ctx: Context): String = JSONObject()
            .put("on", Prefs.wake(ctx)).put("when", Prefs.wakeWhen(ctx)).put("sensitivity", Prefs.wakeSensitivity(ctx))
            .put("mic", ctx.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
            .put("overlay", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx))
            .put("paused", System.currentTimeMillis() < pausedUntil).put("score", lastScore.toDouble()).put("error", lastError).toString()

        /** Opened by the wake word on a locked phone: ask for the unlock first (fingerprint / face / PIN). */
        fun unlockFirst(act: android.app.Activity) {
            try {
                val km = act.getSystemService(KEYGUARD_SERVICE) as KeyguardManager
                if (Build.VERSION.SDK_INT >= 27) { act.setShowWhenLocked(true); act.setTurnScreenOn(true) }
                // shown over the lock screen only for this unlock prompt — then never again (setShowWhenLocked(false))
                val back = { if (Build.VERSION.SDK_INT >= 27) act.setShowWhenLocked(false) }
                if (km.isKeyguardLocked && Build.VERSION.SDK_INT >= 26) km.requestDismissKeyguard(act, object : KeyguardManager.KeyguardDismissCallback() {
                    override fun onDismissSucceeded() { back() }
                    override fun onDismissCancelled() { back() }
                    override fun onDismissError() { back() }
                }) else back()
            } catch (e: Exception) {}
        }
    }
}

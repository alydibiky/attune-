package com.aldibiki.attune

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Runs while the model is writing an answer, and only then.
 *
 * Android (and MagicOS even more) slows an app down the moment it leaves the
 * screen: its threads move to the slow cores and can be frozen. An answer the
 * person walked away from then crawls at a fraction of its speed. A
 * foreground service keeps the engine at full speed until the answer is done;
 * the notification says so and taps back into the app.
 */
class GenService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26 && nm?.getNotificationChannel(CHANNEL) == null) {
            nm?.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.channel_writing), NotificationManager.IMPORTANCE_LOW))
        }
        val open = PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n: Notification = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL)
                               else @Suppress("DEPRECATION") Notification.Builder(this))
            .setSmallIcon(R.drawable.ic_stat_reminder)
            .setContentTitle(getString(R.string.writing_title))
            .setContentIntent(open)
            .setOngoing(true)
            .build()
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
            else startForeground(ID, n)
        } catch (e: Exception) { stopSelf(); return START_NOT_STICKY }
        // Android kills the app if a service started with startForegroundService() is stopped before it
        // called startForeground() (a short answer can end that fast). So "stop" comes here too, and
        // the service stops itself only after it is in the foreground.
        if (!on) {   // the stop intent, or an answer that already ended
            if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
            stopSelf()
        }
        return START_NOT_STICKY
    }

    companion object {
        private const val CHANNEL = "writing"
        private const val ID = 7301
        private const val ACTION_STOP = "com.aldibiki.attune.GEN_STOP"
        @Volatile private var started = false
        @Volatile private var on = false
        /** Something is being written, drawn or downloaded right now (the notification is up). */
        fun busy(): Boolean = on

        fun set(ctx: Context, running: Boolean) {
            if (running == on) return
            on = running
            val i = Intent(ctx, GenService::class.java)
            try {
                if (running) {
                    // v6.46 (Ali's log, 19 Oct: "ForegroundServiceDidNotStartInTimeException" while a 4.9 GB picture was being
                    // drawn — the main thread was too busy to reach startForeground in time): started the plain way while
                    // Attune is on screen (allowed, and no deadline at all); the foreground-service start only from the background
                    try { ctx.startService(i) } catch (e: IllegalStateException) { if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else throw e }
                    started = true
                } else if (started) {
                    started = false
                    ctx.startService(i.setAction(ACTION_STOP))   // allowed: the app still has its foreground service
                }
            } catch (e: Exception) { on = false; started = false; try { ctx.stopService(i) } catch (_: Exception) {} }
        }
    }
}

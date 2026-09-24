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
        } catch (e: Exception) { stopSelf() }
        return START_NOT_STICKY
    }

    companion object {
        private const val CHANNEL = "writing"
        private const val ID = 7301
        @Volatile private var on = false

        fun set(ctx: Context, running: Boolean) {
            if (running == on) return
            on = running
            val i = Intent(ctx, GenService::class.java)
            try {
                if (running) { if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i) }
                else ctx.stopService(i)
            } catch (e: Exception) { on = false }
        }
    }
}

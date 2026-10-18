package com.aldibiki.attune

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.TileService

/**
 * v6.37 (upgrade H5): an "Attune Instant" tile in the phone's quick settings (swipe down twice → edit → drag it in).
 * One tap opens Instant over whatever you are doing: paste or type, translate, sum, add to Money — without finding the app.
 */
/** The extra that opens one page of the app (MainActivity.handleShare). */
const val EXTRA_OPEN_PAGE = "attune_open"

class InstantTile : TileService() {
    override fun onClick() {
        super.onClick()
        val i = Intent(this, MainActivity::class.java).putExtra(EXTRA_OPEN_PAGE, "instant")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startActivityAndCollapse(PendingIntent.getActivity(this, 7, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
            } else {
                @Suppress("DEPRECATION") startActivityAndCollapse(i)
            }
        } catch (e: Throwable) { try { startActivity(i) } catch (e2: Throwable) {} }
    }
}

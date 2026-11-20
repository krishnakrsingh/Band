package com.h59app.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** ADB-test hook: `am broadcast -a com.h59app.TEST_NOTIFY --es pattern whatsapp` */
class H59TestReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pattern = intent.getStringExtra("pattern") ?: "whatsapp"
        Log.i("H59Notify", "ADB test broadcast -> $pattern")
        H59NotificationModule.emit(H59NotificationModule.EVENT) {
            putString("pattern", pattern)
            putLong("at", System.currentTimeMillis())
        }
    }
}

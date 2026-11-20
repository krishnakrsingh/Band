package com.h59app.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * System-bound listener. Maps package -> pattern ID IN NATIVE CODE.
 * Only the pattern ID crosses the RN bridge — notification text never does.
 */
class H59NotificationListenerService : NotificationListenerService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val SMS = setOf(
        "com.google.android.apps.messaging", "com.android.mms",
        "com.samsung.android.messaging", "com.sec.android.app.mms")
    private val CALL = setOf(
        "com.google.android.dialer", "com.samsung.android.dialer",
        "com.sec.android.app.dialertab", "com.android.dialer")
    private val WHATSAPP = setOf("com.whatsapp", "com.whatsapp.w4b")
    private val SENSITIVE = setOf(
        "com.google.android.apps.authenticator2", "com.microsoft.authenticator")
    private val ALLOWED = CALL + WHATSAPP + SMS

    // STRICT: only explicit OTP phrases. No bare "code" and no bare 4-8 digit
    // runs, so ordinary WhatsApp/SMS messages (numbers, timestamps) are safe.
    // Content-based OTP suppression is applied ONLY to SENSITIVE packages below.
    private val OTP_RE = Regex(
        """(?i)\b(otp|one[- ]?time\s*(password|code|pin)|verification\s*code|authenticator\s*code|2fa)\b""")

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.i(TAG, "onListenerConnected")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.i(TAG, "onListenerDisconnected")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val pkg = sbn.packageName
        val ongoing = sbn.isOngoing
        val category = sbn.notification.category

        // Compute the decision on the main thread so EVERY posted notification is
        // logged exactly once, including ones we suppress (read with adb logcat -s H59Notify:I).
        var pattern: String? = null
        var suppression: String? = null

        // extras may be null / may have no title — never return early on that.
        val extras = sbn.notification.extras
        val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val big = extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()

        when {
            pkg == packageName -> suppression = "self-package"
            pkg in SENSITIVE -> {
                // Sensitive packages never get a distinct buzz. The strict OTP check
                // is a secondary guard applied ONLY here — never to ordinary messages.
                val text = "$title $big"
                suppression = if (text.contains(OTP_RE)) "sensitive-otp-content" else "sensitive-package"
            }
            pkg !in ALLOWED -> suppression = "default-deny"
            else -> {
                // isOngoing is intentionally NOT a filter: WhatsApp/SMS can post
                // ongoing notifications that still contain alerting messages.
                pattern = when (pkg) {
                    in CALL -> "call"
                    in WHATSAPP -> "whatsapp"
                    in SMS -> "sms"
                    else -> null
                }
                if (pattern == null) suppression = "unmapped-package"
            }
        }

        Log.i(
            TAG,
            "onNotificationPosted pkg=$pkg ongoing=$ongoing category=$category id=${sbn.id} " +
                "pattern=$pattern suppress=$suppression titlePresent=${title.isNotEmpty()}"
        )

        if (pattern == null) return

        val resolvedPattern = pattern
        val postTime = sbn.postTime
        H59NotificationModule.noteNotification(pkg)
        scope.launch {
            H59NotificationModule.emit(H59NotificationModule.EVENT) {
                putString("pattern", resolvedPattern)
                putLong("at", postTime)
            }
        }
    }

    companion object {
        private const val TAG = "H59Notify"
    }
}

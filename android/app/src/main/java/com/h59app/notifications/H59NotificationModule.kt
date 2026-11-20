package com.h59app.notifications

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ViewManager

/**
 * Legacy-module interop works under RN 0.76 bridgeless/new architecture:
 * @ReactModule(name) + getName() + registration via ReactPackage in MainApplication.
 * No TurboModule codegen spec is needed for RCTDeviceEventEmitter events.
 */
@ReactModule(name = H59NotificationModule.NAME)
class H59NotificationModule(reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = NAME

    // Set the sink as soon as the module object exists. Relying on initialize()
    // alone is fragile with the new architecture's lazy native-module creation:
    // if JS has not touched the bridge yet, sink would still be null.
    init {
        installSink()
    }

    override fun initialize() {
        super.initialize()
        installSink()
    }

    override fun invalidate() {
        sink = null
        super.invalidate()
    }

    private fun installSink() {
        sink = { event, args ->
            try {
                val emitter = reactApplicationContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                if (emitter != null) {
                    emitter.emit(event, args)
                } else {
                    reactApplicationContext.emitDeviceEvent(event, args)
                }
            } catch (t: Throwable) {
                Log.w(TAG, "emitter failed for $event: ${t.message}", t)
                try {
                    reactApplicationContext.emitDeviceEvent(event, args)
                } catch (t2: Throwable) {
                    Log.e(TAG, "emitDeviceEvent fallback failed: ${t2.message}", t2)
                }
            }
        }
    }

    companion object {
        const val NAME = "H59NotificationBridge"
        const val EVENT = "H59Notification"
        private const val TAG = "H59Notify"

        @Volatile private var sink: ((String, WritableMap) -> Unit)? = null
        @Volatile private var lastEventName: String? = null
        @Volatile private var lastEventPattern: String? = null
        @Volatile private var lastEventAt: Long = 0L
        @Volatile private var lastSourcePackage: String? = null

        /** Called by the service before emitting so getDebugState() can report the source app. */
        fun noteNotification(sourcePackage: String) {
            lastSourcePackage = sourcePackage
        }

        fun emit(event: String, fill: WritableMap.() -> Unit) {
            val args = Arguments.createMap().apply(fill)
            lastEventName = event
            lastEventPattern = if (args.hasKey("pattern")) args.getString("pattern") else null
            lastEventAt = if (args.hasKey("at")) args.getLong("at") else 0L

            val activeSink = sink
            if (activeSink == null) {
                Log.w(TAG, "emit dropped: sink is null (native module not created yet) event=$event")
            } else {
                activeSink(event, args)
            }
        }
    }

    private fun isAccessEnabledNow(): Boolean {
        val flat = Settings.Secure.getString(
            reactApplicationContext.contentResolver, "enabled_notification_listeners")
        val me = ComponentName(reactApplicationContext, H59NotificationListenerService::class.java)
            .flattenToString()
        return flat?.split(":")?.contains(me) ?: false
    }

    @ReactMethod
    fun isAccessEnabled(promise: Promise) {
        promise.resolve(isAccessEnabledNow())
    }

    @ReactMethod
    fun openAccessSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (intent.resolveActivity(reactApplicationContext.packageManager) != null) {
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun isDndActive(promise: Promise) {
        promise.resolve(false) // listener-side gate handles DND
    }

    /**
     * Test hook: drives the exact same JS event path as a real notification so the
     * bridge + haptic path can be verified without waiting for a notification.
     */
    @ReactMethod
    fun emitTestPattern(pattern: String) {
        Log.i(TAG, "emitTestPattern pattern=$pattern sinkSet=${sink != null}")
        emit(EVENT) {
            putString("pattern", pattern)
            putLong("at", System.currentTimeMillis())
        }
    }

    /** Diagnostic snapshot: `adb shell` / JS can call this to see bridge state. */
    @ReactMethod
    fun getDebugState(promise: Promise) {
        val state = Arguments.createMap().apply {
            putString("listenerPackage", reactApplicationContext.packageName)
            putString(
                "listenerComponent",
                ComponentName(reactApplicationContext, H59NotificationListenerService::class.java)
                    .flattenToString())
            putBoolean("accessEnabled", isAccessEnabledNow())
            putBoolean("sinkSet", sink != null)
            putString("lastSourcePackage", lastSourcePackage)
            putString("lastEventName", lastEventName)
            putString("lastEventPattern", lastEventPattern)
            putLong("lastEventAt", lastEventAt)
        }
        promise.resolve(state)
    }

    // Required by NativeEventEmitter (suppresses warnings, ensures event delivery).
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}

class H59NotificationPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(H59NotificationModule(ctx))

    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

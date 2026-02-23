package com.tvfdx.calltracker

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterActivity() {
    private val CHANNEL = "call_state_service"
    private var callStateService: CallStateService? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        callStateService = CallStateService(this)
        val methodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
        callStateService?.initialize(methodChannel)
        
        methodChannel.setMethodCallHandler { call, result ->
            when (call.method) {
                "startCallStateListener" -> {
                    val success = callStateService?.startListener() ?: false
                    if (success) {
                        result.success(true)
                    } else {
                        result.error(
                            "PERMISSION_DENIED",
                            "READ_PHONE_STATE permission not granted",
                            null
                        )
                    }
                }
                "stopCallStateListener" -> {
                    callStateService?.stopListener()
                    result.success(true)
                }
                "initiateCall" -> {
                    val phoneNumber = call.argument<String>("phoneNumber")
                    if (phoneNumber != null) {
                        callStateService?.initiateCall(phoneNumber)
                        result.success(true)
                    } else {
                        result.error("INVALID_ARGUMENT", "Phone number is required", null)
                    }
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        callStateService?.stopListener()
    }
}


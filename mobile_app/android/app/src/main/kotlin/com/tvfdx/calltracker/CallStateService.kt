package com.tvfdx.calltracker

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import androidx.core.app.ActivityCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.MethodChannel
import java.util.*

class CallStateService(private val activity: FlutterActivity) {
    private var telephonyManager: TelephonyManager? = null
    private var phoneStateListener: PhoneStateListener? = null
    private var currentCallState: Int = TelephonyManager.CALL_STATE_IDLE
    private var callStartTime: Date? = null  // When call started ringing
    private var callConnectTime: Date? = null  // When call actually connected (OFFHOOK)
    private var callEndTime: Date? = null
    private var currentPhoneNumber: String? = null
    private var channel: MethodChannel? = null
    private var wasConnected: Boolean = false  // Track if call was ever connected
    private var callType: String? = null  // Track call type (incoming/outgoing) for the current call
    private var callRecordingService: CallRecordingService? = null
    private var recordingPath: String? = null

    fun initialize(channel: MethodChannel) {
        this.channel = channel
        telephonyManager = activity.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        callRecordingService = CallRecordingService(activity)
    }

    fun startListener(): Boolean {
        if (ActivityCompat.checkSelfPermission(
                activity,
                Manifest.permission.READ_PHONE_STATE
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }

        phoneStateListener = object : PhoneStateListener() {
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                super.onCallStateChanged(state, phoneNumber)
                
                val timestamp = Date()
                
                // Determine call type based on state transitions
                val detectedCallType = when {
                    // If we go from IDLE to RINGING, it's incoming
                    currentCallState == TelephonyManager.CALL_STATE_IDLE && 
                    state == TelephonyManager.CALL_STATE_RINGING -> "incoming"
                    // If we go from IDLE directly to OFFHOOK (no ringing), it's outgoing
                    currentCallState == TelephonyManager.CALL_STATE_IDLE && 
                    state == TelephonyManager.CALL_STATE_OFFHOOK -> "outgoing"
                    // If we already have a call type, keep it
                    callType != null -> callType
                    // Default to outgoing if uncertain
                    else -> "outgoing"
                }
                
                // Store call type for the duration of this call
                if (callType == null) {
                    callType = detectedCallType
                }

                when (state) {
                    TelephonyManager.CALL_STATE_RINGING -> {
                        // Incoming call is ringing
                        currentPhoneNumber = phoneNumber
                        callStartTime = timestamp
                        callConnectTime = null
                        wasConnected = false
                        callType = "incoming"  // Definitely incoming if ringing
                        sendEventToFlutter(
                            phoneNumber = phoneNumber ?: "",
                            type = callType ?: "incoming",
                            state = "ringing",
                            timestamp = timestamp,
                            startTime = callStartTime
                        )
                    }
                    
                    TelephonyManager.CALL_STATE_OFFHOOK -> {
                        // Call is now connected (picked up)
                        // For incoming: user picked up
                        // For outgoing: other side picked up
                        if (callConnectTime == null) {
                            callConnectTime = timestamp
                            wasConnected = true
                            
                            // Start recording when call connects
                            val phoneNum = currentPhoneNumber ?: phoneNumber ?: ""
                            if (phoneNum.isNotEmpty()) {
                                recordingPath = callRecordingService?.startRecording(phoneNum)
                            }
                        }
                        if (callStartTime == null) {
                            callStartTime = timestamp
                        }
                        // If we don't have phone number yet, try to get it
                        if (currentPhoneNumber == null) {
                            currentPhoneNumber = phoneNumber
                        }
                        sendEventToFlutter(
                            phoneNumber = currentPhoneNumber ?: phoneNumber ?: "",
                            type = callType ?: "outgoing",
                            state = "offhook",
                            timestamp = timestamp,
                            startTime = callStartTime,
                            connectTime = callConnectTime,
                            recordingPath = recordingPath
                        )
                    }
                    
                    TelephonyManager.CALL_STATE_IDLE -> {
                        // Call ended
                        callEndTime = timestamp
                        
                        // Stop recording when call ends
                        val finalRecordingPath = callRecordingService?.stopRecording()
                        
                        // Calculate duration only from connection time (OFFHOOK) to end time
                        // This gives accurate call duration, excluding ringing time
                        val duration = if (callConnectTime != null && callEndTime != null) {
                            ((callEndTime!!.time - callConnectTime!!.time) / 1000).toInt()
                        } else {
                            // If call never connected, duration is 0 or null
                            0
                        }

                        sendEventToFlutter(
                            phoneNumber = currentPhoneNumber ?: phoneNumber ?: "",
                            type = callType ?: "outgoing",
                            state = "idle",
                            timestamp = timestamp,
                            startTime = callStartTime,
                            connectTime = callConnectTime,
                            endTime = callEndTime,
                            duration = duration,
                            wasConnected = wasConnected,
                            recordingPath = finalRecordingPath
                        )

                        // Reset for next call
                        callStartTime = null
                        callConnectTime = null
                        callEndTime = null
                        currentPhoneNumber = null
                        wasConnected = false
                        callType = null
                        recordingPath = null
                        callRecordingService?.cleanup()
                    }
                }

                currentCallState = state
            }
        }

        telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
        return true
    }

    fun stopListener() {
        telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE)
        phoneStateListener = null
    }

    private fun sendEventToFlutter(
        phoneNumber: String,
        type: String,
        state: String,
        timestamp: Date,
        startTime: Date? = null,
        connectTime: Date? = null,
        endTime: Date? = null,
        duration: Int? = null,
        wasConnected: Boolean = false,
        recordingPath: String? = null
    ) {
        val arguments = mapOf(
            "phoneNumber" to phoneNumber,
            "type" to type,
            "state" to state,
            "timestamp" to timestamp.toISOString(),
            "startTime" to (startTime?.toISOString() ?: ""),
            "connectTime" to (connectTime?.toISOString() ?: ""),
            "endTime" to (endTime?.toISOString() ?: ""),
            "duration" to (duration ?: 0),
            "wasConnected" to wasConnected,
            "recordingPath" to (recordingPath ?: "")
        )

        channel?.invokeMethod("onCallStateChanged", arguments)
    }

    fun initiateCall(phoneNumber: String) {
        if (ActivityCompat.checkSelfPermission(
                activity,
                Manifest.permission.CALL_PHONE
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val intent = Intent(Intent.ACTION_CALL).apply {
            data = Uri.parse("tel:$phoneNumber")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }

        activity.startActivity(intent)
    }
}

// Extension to convert Date to ISO string
fun Date.toISOString(): String {
    val format = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    format.timeZone = java.util.TimeZone.getTimeZone("UTC")
    return format.format(this)
}


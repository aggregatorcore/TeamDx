package com.tvfdx.calltracker

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import androidx.core.app.ActivityCompat
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class CallRecordingService(private val context: Context) {
    private var mediaRecorder: MediaRecorder? = null
    private var recordingFilePath: String? = null
    private var isRecording = false

    fun startRecording(phoneNumber: String): String? {
        if (isRecording) {
            return recordingFilePath
        }

        if (!hasPermissions()) {
            return null
        }

        try {
            // Create recordings directory
            val recordingsDir = File(context.getExternalFilesDir(null), "call_recordings")
            if (!recordingsDir.exists()) {
                recordingsDir.mkdirs()
            }

            // Generate filename with timestamp and phone number
            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val sanitizedPhone = phoneNumber.replace(Regex("[^0-9]"), "")
            val fileName = "call_${sanitizedPhone}_$timestamp.m4a"
            val file = File(recordingsDir, fileName)
            recordingFilePath = file.absolutePath

            // Initialize MediaRecorder
            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            mediaRecorder?.apply {
                // Try VOICE_CALL first, fallback to MIC if not available
                try {
                    setAudioSource(MediaRecorder.AudioSource.VOICE_CALL)
                } catch (e: Exception) {
                    // Fallback to MIC if VOICE_CALL is not supported
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                }
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128000)
                setAudioSamplingRate(44100)
                setOutputFile(file.absolutePath)
                
                try {
                    prepare()
                    start()
                    isRecording = true
                    return recordingFilePath
                } catch (e: IOException) {
                    e.printStackTrace()
                    release()
                    mediaRecorder = null
                    return null
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            release()
            return null
        }

        return null
    }

    fun stopRecording(): String? {
        if (!isRecording || mediaRecorder == null) {
            return recordingFilePath
        }

        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            isRecording = false
            return recordingFilePath
        } catch (e: Exception) {
            e.printStackTrace()
            release()
            return null
        }
    }

    fun isRecording(): Boolean {
        return isRecording
    }

    fun getRecordingPath(): String? {
        return recordingFilePath
    }

    private fun release() {
        try {
            mediaRecorder?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        mediaRecorder = null
        isRecording = false
    }

    private fun hasPermissions(): Boolean {
        return ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun cleanup() {
        release()
        recordingFilePath = null
    }
}


import 'dart:async';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../models/call_event.dart';
import '../models/lead.dart';
import 'api_service.dart';
import 'offline_queue.dart';
import 'device_service.dart';
import 'websocket_service.dart';
import '../utils/storage.dart';

class CallStateService {
  static const MethodChannel _channel = MethodChannel('call_state_service');
  static final CallStateService _instance = CallStateService._internal();
  factory CallStateService() => _instance;
  CallStateService._internal();

  StreamController<CallEvent>? _callEventController;
  StreamController<LeadDialogEvent>? _leadDialogController;
  final ApiService _apiService = ApiService();
  final OfflineQueue _offlineQueue = OfflineQueue();
  final DeviceService _deviceService = DeviceService();
  final WebSocketService _wsService = WebSocketService();

  Stream<CallEvent>? get callEvents => _callEventController?.stream;
  Stream<LeadDialogEvent>? get leadDialogEvents => _leadDialogController?.stream;

  bool _isInitialized = false;
  String? _currentDeviceId;
  Timer? _heartbeatTimer; // Store timer reference for management
  
  // Call context tracking for web-initiated calls
  String? _currentRequestId;
  String? _currentPhoneNumber;
  String? _currentLeadId;
  DateTime? _callStartTime;
  DateTime? _callConnectTime; // Track when call is answered (offhook state)
  DateTime? _callEndTime;
  String? _currentCallId; // FIX: Track callId for current call (shared across all states)
  
  // Callback function to show lead dialog (set from HomeScreen)
  Function(String phoneNumber, CallEvent callEvent, Lead? existingLead, AssignedUser? assignedToOther)? onShowLeadDialog;

  Future<void> initialize() async {
    if (_isInitialized) return;

    _callEventController = StreamController<CallEvent>.broadcast();
    _leadDialogController = StreamController<LeadDialogEvent>.broadcast();
    
    // Request permissions
    print('🔵 [MOBILE APP] Requesting permissions...');
    final hasPermissions = await _deviceService.requestPermissions().timeout(
      const Duration(seconds: 30),
      onTimeout: () {
        print('⚠️ [MOBILE APP] Permission request timeout');
        return false;
      },
    );
    print('${hasPermissions ? "✅" : "❌"} [MOBILE APP] Permissions: ${hasPermissions ? "Granted" : "Denied"}');
    if (!hasPermissions) {
      throw Exception('Phone permissions not granted');
    }

    // Get device ID - try storage first (same as registration), fallback to device service
    print('🔵 [MOBILE APP] Getting device ID...');
    final storedDeviceId = Storage.getString('device_id');
    if (storedDeviceId != null && storedDeviceId.isNotEmpty) {
      _currentDeviceId = storedDeviceId;
      print('✅ [MOBILE APP] Device ID from storage: ${_currentDeviceId?.substring(0, 8) ?? "null"}');
    } else {
      _currentDeviceId = await _deviceService.getDeviceId().timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          print('⚠️ [MOBILE APP] Device ID retrieval timeout');
          return 'device-timeout-${DateTime.now().millisecondsSinceEpoch}';
        },
      );
      print('✅ [MOBILE APP] Device ID obtained from device: ${_currentDeviceId?.substring(0, 8) ?? "null"}');
    }

    // Start native service
    print('🔵 [MOBILE APP] Starting native call state listener...');
    try {
      final result = await _channel.invokeMethod('startCallStateListener').timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          print('⚠️ [MOBILE APP] Native call state listener timeout');
          throw TimeoutException('Native call state listener timeout');
        },
      );
      
      // Check if native code returned an error
      if (result == null || result == false) {
        print('❌ [MOBILE APP] Native call state listener failed - permission denied');
        throw Exception('READ_PHONE_STATE permission not granted. Please grant phone permission in app settings.');
      }
      
      print('✅ [MOBILE APP] Native call state listener started');
      _isInitialized = true;
    } on PlatformException catch (e) {
      // Handle platform-specific errors (like permission denied)
      print('❌ [MOBILE APP] Platform error starting call state listener: ${e.code} - ${e.message}');
      if (e.code == 'PERMISSION_DENIED') {
        throw Exception('Phone permission not granted. Please enable "Phone" permission in app settings.');
      }
      throw Exception('Failed to start call state listener: ${e.message ?? e.code}');
    } catch (e) {
      print('❌ [MOBILE APP] Error starting call state listener: $e');
      throw e;
    }

    // Listen to native events
    _channel.setMethodCallHandler(_handleNativeCall);

    // Register WebSocket handler for call initiation
    print('🔵 [CallStateService] Registering WebSocket call initiate handler');
    _wsService.setCallInitiateHandler(_handleWebCallInitiate);
    print('✅ [CallStateService] WebSocket handler registered');
    
    // FIX Issue 2: Register WebSocket connection callback to sync offline queue on reconnect
    _wsService.setOnConnectCallback(() {
      print('🔄 [CallStateService] WebSocket reconnected - syncing offline queue...');
      _syncOfflineQueue().catchError((e) {
        print('⚠️ [CallStateService] Error syncing offline queue on WebSocket reconnect: $e');
      });
    });
    print('✅ [CallStateService] WebSocket connection callback registered');

    // Ensure WebSocket is connected (if not already connected)
    if (!_wsService.isConnected && _currentDeviceId != null) {
      print('🔌 [CallStateService] WebSocket not connected, attempting connection...');
      _wsService.connect(_currentDeviceId!);
    } else if (_wsService.isConnected) {
      print('✅ [CallStateService] WebSocket already connected');
      // Re-register device in case it wasn't registered before
      if (_currentDeviceId != null) {
        _wsService.emit('device:register', {'deviceId': _currentDeviceId!});
      }
    }

    // Start heartbeat
    _startHeartbeat();

    // Sync offline queue (non-blocking, fire and forget)
    _syncOfflineQueue().catchError((e) {
      print('⚠️ [MOBILE APP] Offline queue sync error (non-critical): $e');
    });
  }

  // Handle call initiation request from web app via WebSocket
  void _handleWebCallInitiate(Map<String, dynamic> data) {
    try {
      print('📞 [CallStateService] Handling call initiation request');
      print('📞 [CallStateService] Data: $data');
      print('📞 [CallStateService] Data keys: ${data.keys.toList()}');
      
      final phoneNumber = data['phoneNumber'] as String?;
      print('📞 [CallStateService] Phone number extracted: $phoneNumber');
      
      if (phoneNumber == null || phoneNumber.isEmpty) {
        print('❌ [CallStateService] Invalid phone number in call initiation request');
        return;
      }

      print('🔵 [CallStateService] Calling initiateCall with: $phoneNumber');
      // Extract requestId and leadId from data
      final requestId = data['requestId'] as String?;
      final leadId = data['leadId'] as String?;
      
      // Initiate call using native dialer
      initiateCall(phoneNumber).then((_) {
        print('✅ [CallStateService] initiateCall completed successfully');
        
        // Store call context for correlation
        _currentRequestId = requestId;
        _currentPhoneNumber = phoneNumber;
        _currentLeadId = leadId;
        _callStartTime = DateTime.now();
        // FIX: Generate callId for outgoing call (web-initiated)
        _currentCallId = _generateCallId();
        print('✅ [CallState] Generated callId for outgoing call: $_currentCallId');
        
        // Emit call:intentOpened event via WebSocket
        if (_currentRequestId != null && _currentDeviceId != null) {
          _wsService.emit('call:intentOpened', {
            'requestId': _currentRequestId!,
            'phoneNumber': phoneNumber,
            'leadId': _currentLeadId,
            'deviceId': _currentDeviceId!,
            'startTime': _callStartTime!.toIso8601String(),
          });
          print('✅ [CallStateService] call:intentOpened emitted: requestId=${_currentRequestId}');
        } else {
          print('⚠️ [CallStateService] Cannot emit call:intentOpened: missing requestId or deviceId');
        }
      }).catchError((error) {
        print('❌ [CallStateService] Error initiating call: $error');
        print('❌ [CallStateService] Error stack: ${error.stackTrace}');
        
        // DO NOT emit call:intentOpened if dialer failed to open
        // Clear context if any was set
        _currentRequestId = null;
        _currentPhoneNumber = null;
        _currentLeadId = null;
        _callStartTime = null;
        _currentCallId = null; // FIX: Clear callId on error
      });
    } catch (e, stackTrace) {
      print('❌ [CallStateService] Error handling call initiation: $e');
      print('❌ [CallStateService] Stack trace: $stackTrace');
    }
  }

  Future<void> _handleNativeCall(MethodCall call) async {
    switch (call.method) {
      case 'onCallStateChanged':
        try {
          final event = CallEvent.fromJson(Map<String, dynamic>.from(call.arguments));
          
          // EARLY VALIDATION: Skip events with empty/invalid phone numbers immediately
          // This prevents processing of system calls or startup events at login time
          if (event.phoneNumber == null || 
              event.phoneNumber.isEmpty || 
              event.phoneNumber.trim().isEmpty ||
              event.phoneNumber == "null" ||
              event.phoneNumber == "unknown" ||
              event.phoneNumber.length < 3) {
            print('⚠️ [CallState] Ignoring native call event: Invalid phone number (${event.phoneNumber}) - state=${event.state.name}, type=${event.type.name}');
            return; // Don't process or sync this event
          }
          
          _callEventController?.add(event);
          await _processCallEvent(event);
        } catch (e) {
          print('❌ [CallState] Error handling call event: $e');
        }
        break;
    }
  }

  Future<void> _processCallEvent(CallEvent event) async {
    switch (event.state) {
      case CallState.ringing:
        if (event.type == CallType.incoming) {
          await _handleIncomingCall(event);
        }
        break;

      case CallState.offhook: // Connected
        await _handleCallConnected(event);
        break;

      case CallState.idle: // Ended
        await _handleCallEnded(event);
        break;
    }
  }

  Future<void> _handleIncomingCall(CallEvent event) async {
    // FIX: Generate callId ONCE per call (if not already generated)
    if (_currentCallId == null || _currentCallId!.isEmpty) {
      _currentCallId = event.callId;
      if (_currentCallId == null || _currentCallId!.isEmpty) {
        _currentCallId = _generateCallId();
        print('⚠️ [CallState] callId missing in incoming call, generated: $_currentCallId');
      } else {
        print('✅ [CallState] Using callId from event: $_currentCallId');
      }
    }
    
    // Create event with tracked callId (same for all states of this call)
    final eventWithCallId = CallEvent(
      phoneNumber: event.phoneNumber,
      type: event.type,
      state: event.state,
      status: event.status,
      timestamp: event.timestamp,
      startTime: event.startTime,
      connectTime: event.connectTime,
      endTime: event.endTime,
      callId: _currentCallId, // FIX: Use tracked callId
      duration: event.duration,
      wasConnected: event.wasConnected,
      recordingPath: event.recordingPath,
    );
    
    // Send to backend immediately
    await _syncCallEvent(eventWithCallId);

    // Check if number exists in leads
    try {
      final response = await _apiService.searchLeadByPhone(event.phoneNumber);
      final leadData = response['lead'];
      final assignedToOtherData = response['isAssignedToOther'];
      
      Lead? existingLead;
      AssignedUser? assignedToOther;
      
      if (leadData != null) {
        existingLead = Lead.fromJson(leadData);
        
        // Check if assigned to another user
        if (assignedToOtherData != null) {
          assignedToOther = AssignedUser.fromJson(assignedToOtherData);
        }
      }
      
      // Show dialog if lead doesn't exist OR if it exists but assigned to another user/role
      if (existingLead == null || assignedToOther != null) {
        // Emit event for showing dialog
        _leadDialogController?.add(LeadDialogEvent(
          phoneNumber: event.phoneNumber,
          callEvent: event,
          existingLead: existingLead,
          assignedToOther: assignedToOther,
        ));
        
        // Also call callback if set
        if (onShowLeadDialog != null) {
          onShowLeadDialog!(event.phoneNumber, event, existingLead, assignedToOther);
        }
      }
    } catch (e) {
      print('Error checking lead: $e');
      // On error, still show dialog to create lead
      _leadDialogController?.add(LeadDialogEvent(
        phoneNumber: event.phoneNumber,
        callEvent: event,
        existingLead: null,
        assignedToOther: null,
      ));
      
      if (onShowLeadDialog != null) {
        onShowLeadDialog!(event.phoneNumber, event, null, null);
      }
    }
  }

  Future<void> _handleCallConnected(CallEvent event) async {
    // Track when call is answered (offhook state)
    _callConnectTime = DateTime.now();
    print('✅ [CallStateService] Call connected at: ${_callConnectTime?.toIso8601String()}');
    
    // FIX: Use tracked callId (same as ringing state) or generate if missing
    if (_currentCallId == null || _currentCallId!.isEmpty) {
      _currentCallId = event.callId;
      if (_currentCallId == null || _currentCallId!.isEmpty) {
        _currentCallId = _generateCallId();
        print('⚠️ [CallState] callId missing in call connected, generated: $_currentCallId');
      }
    }
    
    // Create event with tracked callId (same for all states of this call)
    final eventWithCallId = CallEvent(
      phoneNumber: event.phoneNumber,
      type: event.type,
      state: event.state,
      status: event.status,
      timestamp: event.timestamp,
      startTime: event.startTime,
      connectTime: _callConnectTime,
      endTime: event.endTime,
      callId: _currentCallId, // FIX: Use tracked callId
      duration: event.duration,
      wasConnected: event.wasConnected,
      recordingPath: event.recordingPath,
    );
    
    // Update call status to "connected"
    await _syncCallEvent(eventWithCallId);
  }

  Future<void> _handleCallEnded(CallEvent event) async {
    _callEndTime = DateTime.now();
    
    // Calculate duration from connectTime (answered time) to endTime (V2 standard)
    // FIX: If connectTime is null, call was NOT answered - duration = 0, wasConnected = false
    int duration = 0;
    bool wasConnected = false;
    
    // V2: Duration = endTime - connectTime (talk time only, excludes ringing)
    // CRITICAL: Only calculate duration if connectTime exists (call was actually answered)
    if (_callConnectTime != null && _callEndTime != null) {
      duration = _callEndTime!.difference(_callConnectTime!).inSeconds;
      wasConnected = duration >= 2;
      print('✅ [CallStateService] Duration calculated from connectTime: ${duration}s, wasConnected=$wasConnected');
    } else {
      // FIX: If connectTime is null, call was NOT answered
      // Duration = 0, wasConnected = false (no fallback to startTime)
      duration = 0;
      wasConnected = false;
      print('⚠️ [CallStateService] Call not answered - connectTime is null, duration=0, wasConnected=false');
    }
    
    // Emit call:ended if we have requestId (from web-initiated call)
    // DO NOT emit if requestId is missing (incoming/non-web call)
    if (_currentRequestId != null && _currentPhoneNumber != null && _currentDeviceId != null) {
      _wsService.emit('call:ended', {
        'requestId': _currentRequestId!,
        'callId': event.callId ?? '', // Use callId if available from native event
        'phoneNumber': _currentPhoneNumber!,
        'connectTime': _callConnectTime?.toIso8601String(), // V2: Send connectTime to backend (null if not answered)
        'endTime': _callEndTime!.toIso8601String(),
        'duration': duration, // FIX: Always use calculated duration (0 if connectTime null)
        'wasConnected': wasConnected, // FIX: Always use calculated wasConnected (false if connectTime null)
        'leadId': _currentLeadId,
      });
      print('✅ [CallStateService] call:ended emitted: requestId=${_currentRequestId}, duration=${duration}s, wasConnected=$wasConnected, connectTime=${_callConnectTime?.toIso8601String()}');
      
      // Clear context after emitting
      _currentRequestId = null;
      _currentPhoneNumber = null;
      _currentLeadId = null;
      _callStartTime = null;
      _callConnectTime = null; // Clear connectTime
      _callEndTime = null;
      _currentCallId = null; // FIX: Clear callId after call ends
    } else {
      print('ℹ️ [CallStateService] call:ended not emitted (incoming/non-web call or missing context)');
    }
    
    // FIX: Use tracked callId (same as ringing/connected states) or generate if missing
    if (_currentCallId == null || _currentCallId!.isEmpty) {
      _currentCallId = event.callId;
      if (_currentCallId == null || _currentCallId!.isEmpty) {
        _currentCallId = _generateCallId();
        print('⚠️ [CallState] callId missing in call end event, generated: $_currentCallId');
      }
    }
    
    // Create updated event with correct values
    final updatedEvent = CallEvent(
      phoneNumber: event.phoneNumber,
      type: event.type,
      state: event.state,
      status: event.status,
      timestamp: event.timestamp,
      startTime: event.startTime,
      connectTime: _callConnectTime, // FIX: Use tracked connectTime (null if not answered)
      endTime: _callEndTime,
      callId: _currentCallId, // FIX: Use tracked callId (same for all states)
      duration: duration, // FIX: Use calculated duration (0 if connectTime null)
      wasConnected: wasConnected, // FIX: Use calculated wasConnected (false if connectTime null)
      recordingPath: event.recordingPath,
    );
    
    // Continue with existing sync logic using updated event
    await _syncCallEvent(updatedEvent);
    
    // FIX: Clear callId after call ends (ready for next call)
    _currentCallId = null;
  }

  Future<void> _syncCallEvent(CallEvent event) async {
    if (_currentDeviceId == null) {
      print('⚠️ Cannot sync call event: Device ID is null');
      return;
    }

    // ENHANCED: Skip syncing call events with empty or invalid phone numbers
    // This prevents blank logs from appearing at login/startup
    if (event.phoneNumber == null || 
        event.phoneNumber.isEmpty || 
        event.phoneNumber.trim().isEmpty ||
        event.phoneNumber == "null" ||
        event.phoneNumber == "unknown" ||
        event.phoneNumber.length < 3) { // Minimum valid phone number length
      print('⚠️ [CallState] Skipping call event sync: Phone number is empty/invalid (${event.phoneNumber}) - likely system call or startup event');
      print('⚠️ [CallState] Event details: state=${event.state.name}, type=${event.type.name}, callId=${event.callId}');
      return;
    }

    // FIX 1: Validate callId - CRITICAL: Must have callId before sync
    String? callId = event.callId;
    if (callId == null || callId.isEmpty || callId.trim().isEmpty) {
      // Generate callId if missing
      callId = _generateCallId();
      print('⚠️ [CallState] callId missing, generated new callId: $callId');
    }
    
    // CRITICAL: Final validation - skip if still missing
    if (callId == null || callId.isEmpty || callId.trim().isEmpty) {
      print('❌ [CallState] CRITICAL: Cannot sync - callId is still missing after generation attempt');
      return; // Skip sync entirely
    }

    // Create event with callId (guaranteed to be non-null and non-empty)
    final eventWithCallId = CallEvent(
      phoneNumber: event.phoneNumber,
      type: event.type,
      state: event.state,
      status: event.status,
      timestamp: event.timestamp,
      startTime: event.startTime,
      connectTime: event.connectTime,
      endTime: event.endTime,
      callId: callId!, // FIX 1: Guaranteed non-null at this point
      duration: event.duration,
      wasConnected: event.wasConnected,
      recordingPath: event.recordingPath,
    );

    // FIX Issue 2: Save to offline queue BEFORE attempting sync
    // This ensures call events persist locally even if screen is locked or network fails
    await _offlineQueue.addToQueue(eventWithCallId);
    print('💾 [CallStateService] Call event saved to offline queue (before sync attempt)');
    
    try {
      print('📞 Syncing call event: ${event.phoneNumber}, state: ${event.state.name}, type: ${event.type.name}, callId: $callId');
      await _apiService.logCall(eventWithCallId, _currentDeviceId!);
      print('✅ Call event synced successfully with callId: $callId');
      
      // Remove from offline queue on successful sync
      await _offlineQueue.removeFromQueue(eventWithCallId);
    } catch (e) {
      print('❌ Error syncing call event: $e');
      print('❌ Error details: ${e.toString()}');
      // Event already in queue (saved before sync attempt), will retry on app resume/unlock
      print('💾 [CallStateService] Call event remains in offline queue for retry');
    }
  }

  // FIX 1: Generate callId for call events
  String _generateCallId() {
    // Generate unique callId using timestamp + random
    // CRITICAL: Must always return non-empty string
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = (timestamp % 100000).toString().padLeft(5, '0');
    final callId = 'call_${timestamp}_$random';
    
    // Final validation - fallback if somehow empty
    if (callId.isEmpty) {
      // Fallback: Use ISO timestamp as ID
      final fallbackId = 'call_${DateTime.now().toIso8601String().replaceAll(RegExp(r'[^0-9]'), '')}';
      print('⚠️ [CallState] callId generation returned empty, using fallback: $fallbackId');
      return fallbackId;
    }
    
    return callId;
  }

  // FIX Issue 2: Public method to sync offline queue (called on app resume/unlock)
  Future<void> syncOfflineQueue() async {
    print('🔄 [CallStateService] Syncing offline queue (triggered by app resume/unlock)...');
    await _syncOfflineQueue();
  }

  Future<void> _syncOfflineQueue() async {
    final queue = await _offlineQueue.getQueue();
    if (queue.isEmpty) {
      print('ℹ️ [CallStateService] Offline queue is empty');
      return;
    }
    
    print('📤 [CallStateService] Syncing ${queue.length} queued call event(s)...');
    for (final event in queue) {
      try {
        if (_currentDeviceId != null) {
          // FIX 1: Ensure callId exists before syncing
          String? callId = event.callId;
          if (callId == null || callId.isEmpty) {
            callId = _generateCallId();
            print('⚠️ [CallState] Offline queue event missing callId, generated: $callId');
          }
          
          // Create event with callId
          final eventWithCallId = CallEvent(
            phoneNumber: event.phoneNumber,
            type: event.type,
            state: event.state,
            status: event.status,
            timestamp: event.timestamp,
            startTime: event.startTime,
            connectTime: event.connectTime,
            endTime: event.endTime,
            callId: callId,
            duration: event.duration,
            wasConnected: event.wasConnected,
            recordingPath: event.recordingPath,
          );
          
          await _apiService.logCall(eventWithCallId, _currentDeviceId!);
          await _offlineQueue.removeFromQueue(event);
          print('✅ [CallStateService] Successfully synced queued event: ${event.phoneNumber} (callId: $callId)');
        }
      } catch (e) {
        print('❌ [CallStateService] Error syncing queued event: $e');
        // Continue with next event instead of breaking
        // This ensures all events get a chance to sync
      }
    }
    
    final remainingQueue = await _offlineQueue.getQueue();
    if (remainingQueue.isEmpty) {
      print('✅ [CallStateService] All queued events synced successfully');
    } else {
      print('⚠️ [CallStateService] ${remainingQueue.length} event(s) still in queue (will retry later)');
    }
  }

  Future<void> initiateCall(String phoneNumber) async {
    try {
      print('🔵 [CallStateService] initiateCall called with: $phoneNumber');
      print('🔵 [CallStateService] Invoking native method: initiateCall');
      final result = await _channel.invokeMethod('initiateCall', {'phoneNumber': phoneNumber});
      print('✅ [CallStateService] Native initiateCall completed: $result');
    } catch (e, stackTrace) {
      print('❌ [CallStateService] Error in initiateCall: $e');
      print('❌ [CallStateService] Stack trace: $stackTrace');
      throw e;
    }
  }

  void _startHeartbeat() {
    // Cancel existing timer if any
    _heartbeatTimer?.cancel();
    
    // Send immediate heartbeat
    if (_currentDeviceId != null) {
      _apiService.sendHeartbeat(_currentDeviceId!).then((_) {
        // Heartbeat successful
      }).catchError((e) {
        print('Error sending initial heartbeat: $e');
      });
    }
    
    // Start periodic heartbeat (every 25 seconds to be safe - backend checks 60s)
    _heartbeatTimer = Timer.periodic(Duration(seconds: 25), (timer) async {
      if (_currentDeviceId != null) {
        try {
          await _apiService.sendHeartbeat(_currentDeviceId!);
        } catch (e) {
          print('Error sending heartbeat: $e');
          // Retry heartbeat after error (don't let it stop)
          print('⚠️ Heartbeat failed, will retry on next cycle');
        }
      }
    });
  }

  void dispose() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _callEventController?.close();
    _leadDialogController?.close();
    _channel.invokeMethod('stopCallStateListener');
    _isInitialized = false;
  }
  
  // Restart heartbeat if it stopped (call this when app resumes)
  void restartHeartbeatIfNeeded() {
    if (_isInitialized && _currentDeviceId != null && (_heartbeatTimer == null || !_heartbeatTimer!.isActive)) {
      print('🔄 Restarting heartbeat...');
      _startHeartbeat();
    }
  }
}

// Event class for lead dialog
class LeadDialogEvent {
  final String phoneNumber;
  final CallEvent callEvent;
  final Lead? existingLead;
  final AssignedUser? assignedToOther;

  LeadDialogEvent({
    required this.phoneNumber,
    required this.callEvent,
    this.existingLead,
    this.assignedToOther,
  });
}


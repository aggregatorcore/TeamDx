enum CallType {
  incoming,
  outgoing,
}

enum CallState {
  idle,
  ringing,
  offhook, // Connected
}

enum CallStatus {
  missed,      // Missed call
  rejected,    // Call rejected/declined
  connected,   // Call connected
  noAnswer,    // No answer
  busy,        // Busy
  cancelled,   // Call cancelled
}

class CallEvent {
  final String phoneNumber;
  final CallType type;
  final CallState state;
  final CallStatus? status;
  final DateTime timestamp;
  final DateTime? startTime;
  final DateTime? connectTime;  // When call actually connected (OFFHOOK)
  final DateTime? endTime;
  final String? callId;
  final int? duration; // Duration in seconds (only connected time)
  final bool? wasConnected;  // Whether call was ever connected
  final String? recordingPath;  // Path to call recording file

  CallEvent({
    required this.phoneNumber,
    required this.type,
    required this.state,
    this.status,
    required this.timestamp,
    this.startTime,
    this.connectTime,
    this.endTime,
    this.callId,
    this.duration,
    this.wasConnected,
    this.recordingPath,
  });

  // Helper to determine status from state
  CallStatus get effectiveStatus {
    if (status != null) return status!;
    
    // FIX: If connectTime is null, call was NOT answered - status = missed/no_answer
    if (connectTime == null) {
      if (type == CallType.incoming) {
        return CallStatus.missed;
      } else {
        return CallStatus.noAnswer;
      }
    }
    
    // If call was connected (connectTime present) and has duration, it's connected
    if (wasConnected == true && duration != null && duration! > 0 && connectTime != null) {
      return CallStatus.connected;
    }
    
    if (state == CallState.idle) {
      // If call ended without being connected (connectTime null or duration 0)
      if (connectTime == null || wasConnected == false || duration == null || duration == 0) {
        if (type == CallType.incoming) {
          return CallStatus.missed;
        } else {
          return CallStatus.noAnswer;
        }
      }
      // If call was connected (connectTime present and duration > 0), return connected
      if (connectTime != null && wasConnected == true && duration != null && duration! > 0) {
        return CallStatus.connected;
      }
    }
    
    // FIX: Only return connected if connectTime is present
    if (state == CallState.offhook && connectTime != null) {
      return CallStatus.connected;
    }
    
    // Default: missed/no_answer if connectTime not present
    if (type == CallType.incoming) {
      return CallStatus.missed;
    } else {
      return CallStatus.noAnswer;
    }
  }

  // Check if call was connected
  bool get wasConnectedCheck => (wasConnected == true) && (duration != null && duration! > 0);
  
  // Check if call was missed
  bool get wasMissed => effectiveStatus == CallStatus.missed;
  
  // Check if call was rejected
  bool get wasRejected => effectiveStatus == CallStatus.rejected;

  Map<String, dynamic> toJson() {
    return {
      'phoneNumber': phoneNumber,
      'type': type.name,
      'state': state.name,
      'status': status?.name,
      'timestamp': timestamp.toIso8601String(),
      'startTime': startTime?.toIso8601String(),
      'connectTime': connectTime?.toIso8601String(),
      'endTime': endTime?.toIso8601String(),
      'callId': callId,
      'duration': duration,
      'wasConnected': wasConnected,
      'recordingPath': recordingPath,
    };
  }

  factory CallEvent.fromJson(Map<String, dynamic> json) {
    return CallEvent(
      phoneNumber: json['phoneNumber'] ?? '',
      type: CallType.values.firstWhere(
        (e) => e.name == json['type'],
        orElse: () => CallType.outgoing,
      ),
      state: CallState.values.firstWhere(
        (e) => e.name == json['state'],
        orElse: () => CallState.idle,
      ),
      status: json['status'] != null 
          ? CallStatus.values.firstWhere(
              (e) => e.name == json['status'],
              orElse: () => CallStatus.missed,
            )
          : null,
      timestamp: DateTime.parse(json['timestamp']),
      startTime: json['startTime'] != null && json['startTime'].toString().isNotEmpty 
          ? DateTime.parse(json['startTime']) : null,
      connectTime: json['connectTime'] != null && json['connectTime'].toString().isNotEmpty
          ? DateTime.parse(json['connectTime']) : null,
      endTime: json['endTime'] != null && json['endTime'].toString().isNotEmpty
          ? DateTime.parse(json['endTime']) : null,
      callId: json['callId'],
      duration: json['duration'] != null ? (json['duration'] is int ? json['duration'] : int.tryParse(json['duration'].toString())) : null,
      wasConnected: json['wasConnected'] is bool ? json['wasConnected'] : (json['wasConnected'] == true || json['wasConnected'] == 1),
      recordingPath: json['recordingPath'],
    );
  }
}


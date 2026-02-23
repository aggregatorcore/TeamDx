import 'package:cloud_firestore/cloud_firestore.dart';

/// Call Model
/// 
/// Represents a call (inbound or outbound) with metadata
class CallModel {
  final String callId;
  final String userId;
  final String deviceId;
  final String phoneNumber;
  final CallType type;
  final CallStatus status;
  final DateTime startTime;
  final DateTime? connectTime;
  final DateTime? endTime;
  final int? duration; // in seconds
  final String? leadId;
  final String? notes;

  CallModel({
    required this.callId,
    required this.userId,
    required this.deviceId,
    required this.phoneNumber,
    required this.type,
    required this.status,
    required this.startTime,
    this.connectTime,
    this.endTime,
    this.duration,
    this.leadId,
    this.notes,
  });

  /// Create CallModel from Firestore document
  factory CallModel.fromFirestore(Map<String, dynamic> data, String callId) {
    return CallModel(
      callId: callId,
      userId: data['userId'] ?? '',
      deviceId: data['deviceId'] ?? '',
      phoneNumber: data['phoneNumber'] ?? '',
      type: CallType.fromString(data['type'] ?? 'outbound'),
      status: CallStatus.fromString(data['status'] ?? 'ringing'),
      startTime: (data['startTime'] as Timestamp?)?.toDate() ?? DateTime.now(),
      connectTime: (data['connectTime'] as Timestamp?)?.toDate(),
      endTime: (data['endTime'] as Timestamp?)?.toDate(),
      duration: data['duration'] as int?,
      leadId: data['leadId'] as String?,
      notes: data['notes'] as String?,
    );
  }

  /// Convert CallModel to Firestore document
  Map<String, dynamic> toFirestore() {
    return {
      'userId': userId,
      'deviceId': deviceId,
      'phoneNumber': phoneNumber,
      'type': type.toString(),
      'status': status.toString(),
      'startTime': Timestamp.fromDate(startTime),
      if (connectTime != null) 'connectTime': Timestamp.fromDate(connectTime!),
      if (endTime != null) 'endTime': Timestamp.fromDate(endTime!),
      if (duration != null) 'duration': duration,
      if (leadId != null) 'leadId': leadId,
      if (notes != null) 'notes': notes,
    };
  }

  /// Create a copy with updated fields
  CallModel copyWith({
    String? callId,
    String? userId,
    String? deviceId,
    String? phoneNumber,
    CallType? type,
    CallStatus? status,
    DateTime? startTime,
    DateTime? connectTime,
    DateTime? endTime,
    int? duration,
    String? leadId,
    String? notes,
  }) {
    return CallModel(
      callId: callId ?? this.callId,
      userId: userId ?? this.userId,
      deviceId: deviceId ?? this.deviceId,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      type: type ?? this.type,
      status: status ?? this.status,
      startTime: startTime ?? this.startTime,
      connectTime: connectTime ?? this.connectTime,
      endTime: endTime ?? this.endTime,
      duration: duration ?? this.duration,
      leadId: leadId ?? this.leadId,
      notes: notes ?? this.notes,
    );
  }

  /// Calculate duration if call has ended
  int? get calculatedDuration {
    if (endTime != null && startTime != null) {
      return endTime!.difference(startTime).inSeconds;
    }
    return duration;
  }
}

/// Call Type
enum CallType {
  inbound,
  outbound;

  static CallType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'inbound':
        return CallType.inbound;
      case 'outbound':
        return CallType.outbound;
      default:
        return CallType.outbound;
    }
  }

  @override
  String toString() {
    return name;
  }
}

/// Call Status
enum CallStatus {
  ringing,
  connected,
  ended,
  missed;

  static CallStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'ringing':
        return CallStatus.ringing;
      case 'connected':
        return CallStatus.connected;
      case 'ended':
        return CallStatus.ended;
      case 'missed':
        return CallStatus.missed;
      default:
        return CallStatus.ringing;
    }
  }

  @override
  String toString() {
    return name;
  }
}



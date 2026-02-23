import 'package:cloud_firestore/cloud_firestore.dart';

/// Call Signal Model
/// 
/// Represents an outbound call request from Web App to Android App
class CallSignalModel {
  final String signalId;
  final String userId;
  final String deviceId;
  final String phoneNumber;
  final String? leadId;
  final CallSignalStatus status;
  final DateTime createdAt;
  final DateTime? initiatedAt;
  final DateTime? completedAt;
  final String? error;

  CallSignalModel({
    required this.signalId,
    required this.userId,
    required this.deviceId,
    required this.phoneNumber,
    this.leadId,
    required this.status,
    required this.createdAt,
    this.initiatedAt,
    this.completedAt,
    this.error,
  });

  /// Create CallSignalModel from Firestore document
  factory CallSignalModel.fromFirestore(Map<String, dynamic> data, String signalId) {
    return CallSignalModel(
      signalId: signalId,
      userId: data['userId'] ?? '',
      deviceId: data['deviceId'] ?? '',
      phoneNumber: data['phoneNumber'] ?? '',
      leadId: data['leadId'] as String?,
      status: CallSignalStatus.fromString(data['status'] ?? 'pending'),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      initiatedAt: data['initiatedAt'] != null ? (data['initiatedAt'] as Timestamp).toDate() : null,
      completedAt: data['completedAt'] != null ? (data['completedAt'] as Timestamp).toDate() : null,
      error: data['error'] as String?,
    );
  }

  /// Convert CallSignalModel to Firestore document
  Map<String, dynamic> toFirestore() {
    return {
      'userId': userId,
      'deviceId': deviceId,
      'phoneNumber': phoneNumber,
      if (leadId != null) 'leadId': leadId,
      'status': status.toString(),
      'createdAt': Timestamp.fromDate(createdAt),
      if (initiatedAt != null) 'initiatedAt': Timestamp.fromDate(initiatedAt!),
      if (completedAt != null) 'completedAt': Timestamp.fromDate(completedAt!),
      if (error != null) 'error': error,
    };
  }

  /// Create a copy with updated fields
  CallSignalModel copyWith({
    String? signalId,
    String? userId,
    String? deviceId,
    String? phoneNumber,
    String? leadId,
    CallSignalStatus? status,
    DateTime? createdAt,
    DateTime? initiatedAt,
    DateTime? completedAt,
    String? error,
  }) {
    return CallSignalModel(
      signalId: signalId ?? this.signalId,
      userId: userId ?? this.userId,
      deviceId: deviceId ?? this.deviceId,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      leadId: leadId ?? this.leadId,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      initiatedAt: initiatedAt ?? this.initiatedAt,
      completedAt: completedAt ?? this.completedAt,
      error: error ?? this.error,
    );
  }
}

/// Call Signal Status
enum CallSignalStatus {
  pending,
  initiated,
  completed,
  failed;

  static CallSignalStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'pending':
        return CallSignalStatus.pending;
      case 'initiated':
        return CallSignalStatus.initiated;
      case 'completed':
        return CallSignalStatus.completed;
      case 'failed':
        return CallSignalStatus.failed;
      default:
        return CallSignalStatus.pending;
    }
  }

  @override
  String toString() {
    return name;
  }
}


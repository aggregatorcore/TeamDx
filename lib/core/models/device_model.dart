import 'package:cloud_firestore/cloud_firestore.dart';

/// Device Model
/// 
/// Represents a bound Android device for a user
class DeviceModel {
  final String deviceId;
  final String userId;
  final String deviceName;
  final String phoneNumber;
  final bool isOnline;
  final DateTime lastSeen;
  final DateTime registeredAt;
  final String? fcmToken;

  DeviceModel({
    required this.deviceId,
    required this.userId,
    required this.deviceName,
    required this.phoneNumber,
    required this.isOnline,
    required this.lastSeen,
    required this.registeredAt,
    this.fcmToken,
  });

  /// Create DeviceModel from Firestore document
  factory DeviceModel.fromFirestore(Map<String, dynamic> data, String deviceId) {
    return DeviceModel(
      deviceId: deviceId,
      userId: data['userId'] ?? '',
      deviceName: data['deviceName'] ?? 'Unknown Device',
      phoneNumber: data['phoneNumber'] ?? '',
      isOnline: data['isOnline'] ?? false,
      lastSeen: (data['lastSeen'] as Timestamp?)?.toDate() ?? DateTime.now(),
      registeredAt: (data['registeredAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      fcmToken: data['fcmToken'] as String?,
    );
  }

  /// Convert DeviceModel to Firestore document
  Map<String, dynamic> toFirestore() {
    return {
      'userId': userId,
      'deviceName': deviceName,
      'phoneNumber': phoneNumber,
      'isOnline': isOnline,
      'lastSeen': Timestamp.fromDate(lastSeen),
      'registeredAt': Timestamp.fromDate(registeredAt),
      if (fcmToken != null) 'fcmToken': fcmToken,
    };
  }

  /// Create a copy with updated fields
  DeviceModel copyWith({
    String? deviceId,
    String? userId,
    String? deviceName,
    String? phoneNumber,
    bool? isOnline,
    DateTime? lastSeen,
    DateTime? registeredAt,
    String? fcmToken,
  }) {
    return DeviceModel(
      deviceId: deviceId ?? this.deviceId,
      userId: userId ?? this.userId,
      deviceName: deviceName ?? this.deviceName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      isOnline: isOnline ?? this.isOnline,
      lastSeen: lastSeen ?? this.lastSeen,
      registeredAt: registeredAt ?? this.registeredAt,
      fcmToken: fcmToken ?? this.fcmToken,
    );
  }
}


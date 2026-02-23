class DeviceInfo {
  final String deviceId;
  final String? deviceName;
  final String? phoneNumber;
  final String? fcmToken;

  DeviceInfo({
    required this.deviceId,
    this.deviceName,
    this.phoneNumber,
    this.fcmToken,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'deviceId': deviceId,
    };
    if (deviceName != null) map['deviceName'] = deviceName;
    if (phoneNumber != null) map['phoneNumber'] = phoneNumber;
    if (fcmToken != null) map['fcmToken'] = fcmToken;
    return map;
  }
}


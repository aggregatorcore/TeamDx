import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:device_info_plus/device_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
// import 'package:telephony/telephony.dart';  // Discontinued - commented out

class DeviceService {
  static final DeviceService _instance = DeviceService._internal();
  factory DeviceService() => _instance;
  DeviceService._internal();

  final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();
  String? _cachedDeviceId;
  String? _cachedDeviceName;

  Future<String> getDeviceId() async {
    if (_cachedDeviceId != null) return _cachedDeviceId!;

    if (kIsWeb) {
      // Web platform - use browser info
      _cachedDeviceId = 'web-${DateTime.now().millisecondsSinceEpoch}';
    } else {
      // Non-web platform - generate a simple ID
      _cachedDeviceId = 'device-${DateTime.now().millisecondsSinceEpoch}';
      // Note: android_id package doesn't work well with conditional imports
      // Using timestamp-based ID for now
    }

    return _cachedDeviceId!;
  }

  Future<String> getDeviceName() async {
    if (_cachedDeviceName != null) return _cachedDeviceName!;

    if (kIsWeb) {
      _cachedDeviceName = 'Web Browser';
      return _cachedDeviceName!;
    }

    // Non-web platform
    try {
      // Try Android first
      final androidInfo = await _deviceInfo.androidInfo;
      _cachedDeviceName = '${androidInfo.manufacturer} ${androidInfo.model}';
    } catch (e) {
      // Fallback to iOS or generic
      try {
        final iosInfo = await _deviceInfo.iosInfo;
        _cachedDeviceName = iosInfo.name;
      } catch (e2) {
        _cachedDeviceName = 'Unknown Device';
      }
    }

    return _cachedDeviceName!;
  }

  Future<String?> getPhoneNumber() async {
    // Phone number not available on web
    return null;
  }

  Future<bool> requestPermissions() async {
    if (kIsWeb) {
      // Web platform - no phone permissions needed
      return true;
    }

    try {
      final permissions = [
        Permission.phone,
        // Permission.phoneState,  // Not available in current permission_handler version
        // Permission.callLog,     // Not available in current permission_handler version
      ];

      final statuses = await permissions.request();
      
      return statuses.values.every((status) => 
        status.isGranted || status.isLimited
      );
    } catch (e) {
      print('Error requesting permissions: $e');
      return false;
    }
  }

  Future<bool> checkPermissions() async {
    if (kIsWeb) {
      // Web platform - no phone permissions needed
      return true;
    }

    try {
      final permissions = [
        Permission.phone,
        // Permission.phoneState,  // Not available in current permission_handler version
        // Permission.callLog,     // Not available in current permission_handler version
      ];

      final statuses = await permissions.request();
      
      return statuses.values.every((status) => 
        status.isGranted || status.isLimited
      );
    } catch (e) {
      print('Error checking permissions: $e');
      return false;
    }
  }
}


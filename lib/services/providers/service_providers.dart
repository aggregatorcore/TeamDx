import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../device_service.dart';
import '../call_signal_service.dart';
import '../call_service.dart';
import '../lead_service.dart';

/// Device Service Provider
final deviceServiceProvider = Provider<DeviceService>((ref) {
  return DeviceService();
});

/// Call Signal Service Provider
final callSignalServiceProvider = Provider<CallSignalService>((ref) {
  return CallSignalService();
});

/// Call Service Provider
final callServiceProvider = Provider<CallService>((ref) {
  return CallService();
});

/// Lead Service Provider
final leadServiceProvider = Provider<LeadService>((ref) {
  return LeadService();
});



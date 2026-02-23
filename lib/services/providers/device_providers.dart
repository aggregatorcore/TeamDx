import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/device_model.dart';
import '../device_service.dart';
import 'service_providers.dart';
import '../../auth/providers/auth_provider.dart';

/// Current user's device provider
final userDeviceProvider = StreamProvider<DeviceModel?>((ref) {
  final currentUser = ref.watch(currentUserProvider);
  
  if (currentUser == null) {
    return Stream.value(null);
  }

  final deviceService = ref.watch(deviceServiceProvider);
  return deviceService.getDeviceStreamByUserId(currentUser.userId);
});

/// Device by deviceId provider
final deviceByIdProvider = StreamProvider.family<DeviceModel?, String>((ref, deviceId) {
  final deviceService = ref.watch(deviceServiceProvider);
  return deviceService.getDeviceStream(deviceId);
});

/// Device online status provider
final deviceOnlineStatusProvider = Provider.family<bool, DeviceModel?>((ref, device) {
  return device?.isOnline ?? false;
});


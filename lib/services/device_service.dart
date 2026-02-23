import 'package:cloud_firestore/cloud_firestore.dart';
import '../core/models/device_model.dart';

/// Device Service
/// 
/// Handles device binding and management
class DeviceService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Get device by deviceId
  Future<DeviceModel?> getDevice(String deviceId) async {
    try {
      final doc = await _firestore.collection('devices').doc(deviceId).get();
      if (doc.exists && doc.data() != null) {
        return DeviceModel.fromFirestore(doc.data()!, deviceId);
      }
      return null;
    } catch (e) {
      throw Exception('Failed to get device: $e');
    }
  }

  /// Get device by userId (one user = one device)
  Future<DeviceModel?> getDeviceByUserId(String userId) async {
    try {
      final query = await _firestore
          .collection('devices')
          .where('userId', isEqualTo: userId)
          .limit(1)
          .get();

      if (query.docs.isNotEmpty) {
        final doc = query.docs.first;
        return DeviceModel.fromFirestore(doc.data(), doc.id);
      }
      return null;
    } catch (e) {
      throw Exception('Failed to get device by user: $e');
    }
  }

  /// Register/Bind a device to a user
  /// 
  /// If user already has a device, it will be unbound first
  Future<DeviceModel> bindDevice({
    required String deviceId,
    required String userId,
    required String deviceName,
    required String phoneNumber,
    String? fcmToken,
  }) async {
    try {
      // Check if user already has a device
      final existingDevice = await getDeviceByUserId(userId);
      if (existingDevice != null && existingDevice.deviceId != deviceId) {
        // Unbind old device
        await unbindDevice(existingDevice.deviceId);
      }

      // Check if device is already bound to another user
      final existingDeviceDoc = await _firestore
          .collection('devices')
          .doc(deviceId)
          .get();
      
      DateTime registeredAt = DateTime.now();
      if (existingDeviceDoc.exists) {
        final existingData = existingDeviceDoc.data()!;
        if (existingData['userId'] != userId) {
          throw Exception('Device is already bound to another user');
        }
        // Get existing registration date
        final existingDevice = DeviceModel.fromFirestore(existingData, deviceId);
        registeredAt = existingDevice.registeredAt;
      }

      // Create or update device
      final device = DeviceModel(
        deviceId: deviceId,
        userId: userId,
        deviceName: deviceName,
        phoneNumber: phoneNumber,
        isOnline: true,
        lastSeen: DateTime.now(),
        registeredAt: registeredAt,
        fcmToken: fcmToken,
      );

      await _firestore
          .collection('devices')
          .doc(deviceId)
          .set(device.toFirestore(), SetOptions(merge: true));

      return device;
    } catch (e) {
      throw Exception('Failed to bind device: $e');
    }
  }

  /// Unbind a device from user
  Future<void> unbindDevice(String deviceId) async {
    try {
      await _firestore.collection('devices').doc(deviceId).delete();
    } catch (e) {
      throw Exception('Failed to unbind device: $e');
    }
  }

  /// Update device online status
  Future<void> updateDeviceStatus({
    required String deviceId,
    required bool isOnline,
  }) async {
    try {
      await _firestore.collection('devices').doc(deviceId).update({
        'isOnline': isOnline,
        'lastSeen': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      throw Exception('Failed to update device status: $e');
    }
  }

  /// Get device stream (real-time updates)
  Stream<DeviceModel?> getDeviceStream(String deviceId) {
    return _firestore
        .collection('devices')
        .doc(deviceId)
        .snapshots()
        .map((snapshot) {
      if (snapshot.exists && snapshot.data() != null) {
        return DeviceModel.fromFirestore(snapshot.data()!, deviceId);
      }
      return null;
    });
  }

  /// Get device stream by userId
  Stream<DeviceModel?> getDeviceStreamByUserId(String userId) {
    return _firestore
        .collection('devices')
        .where('userId', isEqualTo: userId)
        .limit(1)
        .snapshots()
        .map((snapshot) {
      if (snapshot.docs.isNotEmpty) {
        final doc = snapshot.docs.first;
        return DeviceModel.fromFirestore(doc.data(), doc.id);
      }
      return null;
    });
  }
}


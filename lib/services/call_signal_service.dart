import 'package:cloud_firestore/cloud_firestore.dart';
import '../core/models/call_signal_model.dart';

/// Call Signal Service
/// 
/// Handles outbound call requests from Web App to Android App
class CallSignalService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Create a call signal (initiate outbound call)
  Future<CallSignalModel> createCallSignal({
    required String userId,
    required String deviceId,
    required String phoneNumber,
    String? leadId,
  }) async {
    try {
      final signalRef = _firestore.collection('call_signals').doc();
      
      final signal = CallSignalModel(
        signalId: signalRef.id,
        userId: userId,
        deviceId: deviceId,
        phoneNumber: phoneNumber,
        leadId: leadId,
        status: CallSignalStatus.pending,
        createdAt: DateTime.now(),
      );

      await signalRef.set(signal.toFirestore());

      return signal;
    } catch (e) {
      throw Exception('Failed to create call signal: $e');
    }
  }

  /// Update call signal status
  Future<void> updateSignalStatus({
    required String signalId,
    required CallSignalStatus status,
    String? error,
  }) async {
    try {
      final updates = <String, dynamic>{
        'status': status.toString(),
      };

      if (status == CallSignalStatus.initiated) {
        updates['initiatedAt'] = FieldValue.serverTimestamp();
      } else if (status == CallSignalStatus.completed ||
          status == CallSignalStatus.failed) {
        updates['completedAt'] = FieldValue.serverTimestamp();
      }

      if (error != null) {
        updates['error'] = error;
      }

      await _firestore.collection('call_signals').doc(signalId).update(updates);
    } catch (e) {
      throw Exception('Failed to update signal status: $e');
    }
  }

  /// Get call signal by ID
  Future<CallSignalModel?> getCallSignal(String signalId) async {
    try {
      final doc = await _firestore.collection('call_signals').doc(signalId).get();
      if (doc.exists && doc.data() != null) {
        return CallSignalModel.fromFirestore(doc.data()!, signalId);
      }
      return null;
    } catch (e) {
      throw Exception('Failed to get call signal: $e');
    }
  }

  /// Get pending call signals for a device (Android app listens to this)
  Stream<List<CallSignalModel>> getPendingSignalsForDevice(String deviceId) {
    return _firestore
        .collection('call_signals')
        .where('deviceId', isEqualTo: deviceId)
        .where('status', isEqualTo: 'pending')
        .orderBy('createdAt', descending: false)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => CallSignalModel.fromFirestore(doc.data(), doc.id))
          .toList();
    });
  }

  /// Get call signals for a user (Web app)
  Stream<List<CallSignalModel>> getUserCallSignals(String userId) {
    return _firestore
        .collection('call_signals')
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => CallSignalModel.fromFirestore(doc.data(), doc.id))
          .toList();
    });
  }

  /// Delete old completed signals (cleanup)
  Future<void> cleanupOldSignals({int daysOld = 7}) async {
    try {
      final cutoffDate = DateTime.now().subtract(Duration(days: daysOld));
      
      final query = await _firestore
          .collection('call_signals')
          .where('status', whereIn: ['completed', 'failed'])
          .where('completedAt', isLessThan: Timestamp.fromDate(cutoffDate))
          .get();

      final batch = _firestore.batch();
      for (var doc in query.docs) {
        batch.delete(doc.reference);
      }
      await batch.commit();
    } catch (e) {
      // Log error but don't throw (cleanup is non-critical)
      print('Failed to cleanup old signals: $e');
    }
  }
}



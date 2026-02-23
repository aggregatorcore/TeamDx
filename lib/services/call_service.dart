import 'package:cloud_firestore/cloud_firestore.dart';
import '../core/models/call_model.dart';

/// Call Service
/// 
/// Handles call history and metadata
class CallService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Create a call record
  Future<CallModel> createCall({
    required String userId,
    required String deviceId,
    required String phoneNumber,
    required CallType type,
    String? leadId,
  }) async {
    try {
      final callRef = _firestore.collection('calls').doc();
      
      final call = CallModel(
        callId: callRef.id,
        userId: userId,
        deviceId: deviceId,
        phoneNumber: phoneNumber,
        type: type,
        status: CallStatus.ringing,
        startTime: DateTime.now(),
        leadId: leadId,
      );

      await callRef.set(call.toFirestore());

      return call;
    } catch (e) {
      throw Exception('Failed to create call: $e');
    }
  }

  /// Update call status
  Future<void> updateCallStatus({
    required String callId,
    required CallStatus status,
    DateTime? connectTime,
    DateTime? endTime,
    int? duration,
  }) async {
    try {
      final updates = <String, dynamic>{
        'status': status.toString(),
      };

      if (connectTime != null) {
        updates['connectTime'] = Timestamp.fromDate(connectTime);
      }

      if (endTime != null) {
        updates['endTime'] = Timestamp.fromDate(endTime);
      }

      if (duration != null) {
        updates['duration'] = duration;
      }

      await _firestore.collection('calls').doc(callId).update(updates);
    } catch (e) {
      throw Exception('Failed to update call status: $e');
    }
  }

  /// Update call with lead mapping
  Future<void> mapCallToLead({
    required String callId,
    required String leadId,
  }) async {
    try {
      await _firestore.collection('calls').doc(callId).update({
        'leadId': leadId,
      });
    } catch (e) {
      throw Exception('Failed to map call to lead: $e');
    }
  }

  /// Add notes to call
  Future<void> addCallNotes({
    required String callId,
    required String notes,
  }) async {
    try {
      await _firestore.collection('calls').doc(callId).update({
        'notes': notes,
      });
    } catch (e) {
      throw Exception('Failed to add call notes: $e');
    }
  }

  /// Get call by ID
  Future<CallModel?> getCall(String callId) async {
    try {
      final doc = await _firestore.collection('calls').doc(callId).get();
      if (doc.exists && doc.data() != null) {
        return CallModel.fromFirestore(doc.data()!, callId);
      }
      return null;
    } catch (e) {
      throw Exception('Failed to get call: $e');
    }
  }

  /// Get active calls for a user (ringing or connected)
  Stream<List<CallModel>> getActiveCalls(String userId) {
    return _firestore
        .collection('calls')
        .where('userId', isEqualTo: userId)
        .where('status', whereIn: ['ringing', 'connected'])
        .orderBy('startTime', descending: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => CallModel.fromFirestore(doc.data(), doc.id))
          .toList();
    });
  }

  /// Get call history for a user
  Stream<List<CallModel>> getCallHistory(String userId, {int limit = 50}) {
    return _firestore
        .collection('calls')
        .where('userId', isEqualTo: userId)
        .orderBy('startTime', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => CallModel.fromFirestore(doc.data(), doc.id))
          .toList();
    });
  }

  /// Get calls for a phone number
  Future<List<CallModel>> getCallsByPhoneNumber(String phoneNumber) async {
    try {
      final query = await _firestore
          .collection('calls')
          .where('phoneNumber', isEqualTo: phoneNumber)
          .orderBy('startTime', descending: true)
          .limit(20)
          .get();

      return query.docs
          .map((doc) => CallModel.fromFirestore(doc.data(), doc.id))
          .toList();
    } catch (e) {
      throw Exception('Failed to get calls by phone number: $e');
    }
  }

  /// Get incoming calls (for notification)
  Stream<List<CallModel>> getIncomingCalls(String userId) {
    return _firestore
        .collection('calls')
        .where('userId', isEqualTo: userId)
        .where('type', isEqualTo: 'inbound')
        .where('status', isEqualTo: 'ringing')
        .orderBy('startTime', descending: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => CallModel.fromFirestore(doc.data(), doc.id))
          .toList();
    });
  }
}



import 'package:cloud_firestore/cloud_firestore.dart';
import '../core/models/lead_model.dart';

/// Lead Service
/// 
/// Handles lead management and phone number mapping
class LeadService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Create a new lead
  Future<LeadModel> createLead({
    required String phoneNumber,
    String? name,
    String? email,
    String? assignedTo,
    String? notes,
  }) async {
    try {
      // Check if lead with this phone number already exists
      final existing = await getLeadByPhoneNumber(phoneNumber);
      if (existing != null) {
        throw Exception('Lead with this phone number already exists');
      }

      final leadRef = _firestore.collection('leads').doc();
      
      final lead = LeadModel(
        leadId: leadRef.id,
        phoneNumber: phoneNumber,
        name: name,
        email: email,
        status: LeadStatus.newLead,
        assignedTo: assignedTo,
        createdAt: DateTime.now(),
        notes: notes,
      );

      await leadRef.set(lead.toFirestore());

      return lead;
    } catch (e) {
      throw Exception('Failed to create lead: $e');
    }
  }

  /// Get lead by phone number
  Future<LeadModel?> getLeadByPhoneNumber(String phoneNumber) async {
    try {
      final query = await _firestore
          .collection('leads')
          .where('phoneNumber', isEqualTo: phoneNumber)
          .limit(1)
          .get();

      if (query.docs.isNotEmpty) {
        final doc = query.docs.first;
        return LeadModel.fromFirestore(doc.data(), doc.id);
      }
      return null;
    } catch (e) {
      throw Exception('Failed to get lead by phone number: $e');
    }
  }

  /// Get lead by ID
  Future<LeadModel?> getLead(String leadId) async {
    try {
      final doc = await _firestore.collection('leads').doc(leadId).get();
      if (doc.exists && doc.data() != null) {
        return LeadModel.fromFirestore(doc.data()!, leadId);
      }
      return null;
    } catch (e) {
      throw Exception('Failed to get lead: $e');
    }
  }

  /// Update lead
  Future<void> updateLead({
    required String leadId,
    String? name,
    String? email,
    LeadStatus? status,
    String? assignedTo,
    String? notes,
  }) async {
    try {
      final updates = <String, dynamic>{};

      if (name != null) updates['name'] = name;
      if (email != null) updates['email'] = email;
      if (status != null) updates['status'] = status.toString();
      if (assignedTo != null) updates['assignedTo'] = assignedTo;
      if (notes != null) updates['notes'] = notes;

      await _firestore.collection('leads').doc(leadId).update(updates);
    } catch (e) {
      throw Exception('Failed to update lead: $e');
    }
  }

  /// Update last contacted time
  Future<void> updateLastContacted(String leadId) async {
    try {
      await _firestore.collection('leads').doc(leadId).update({
        'lastContacted': FieldValue.serverTimestamp(),
        'status': LeadStatus.contacted.toString(),
      });
    } catch (e) {
      throw Exception('Failed to update last contacted: $e');
    }
  }

  /// Get leads assigned to a user
  Stream<List<LeadModel>> getLeadsByUser(String userId) {
    return _firestore
        .collection('leads')
        .where('assignedTo', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => LeadModel.fromFirestore(doc.data(), doc.id))
          .toList();
    });
  }

  /// Get all leads
  Stream<List<LeadModel>> getAllLeads({int limit = 100}) {
    return _firestore
        .collection('leads')
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => LeadModel.fromFirestore(doc.data(), doc.id))
          .toList();
    });
  }

  /// Search leads by phone number (partial match)
  Future<List<LeadModel>> searchLeadsByPhone(String phoneQuery) async {
    try {
      // Note: Firestore doesn't support partial string matching
      // This is a simple implementation - for production, consider using Algolia or similar
      final query = await _firestore
          .collection('leads')
          .where('phoneNumber', isGreaterThanOrEqualTo: phoneQuery)
          .where('phoneNumber', isLessThanOrEqualTo: '$phoneQuery\uf8ff')
          .limit(20)
          .get();

      return query.docs
          .map((doc) => LeadModel.fromFirestore(doc.data(), doc.id))
          .toList();
    } catch (e) {
      throw Exception('Failed to search leads: $e');
    }
  }

  /// Delete lead
  Future<void> deleteLead(String leadId) async {
    try {
      await _firestore.collection('leads').doc(leadId).delete();
    } catch (e) {
      throw Exception('Failed to delete lead: $e');
    }
  }
}



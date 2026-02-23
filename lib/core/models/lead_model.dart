import 'package:cloud_firestore/cloud_firestore.dart';

/// Lead Model
/// 
/// Represents a lead in the CRM system
class LeadModel {
  final String leadId;
  final String phoneNumber;
  final String? name;
  final String? email;
  final LeadStatus status;
  final String? assignedTo; // userId
  final DateTime createdAt;
  final DateTime? lastContacted;
  final String? notes;

  LeadModel({
    required this.leadId,
    required this.phoneNumber,
    this.name,
    this.email,
    required this.status,
    this.assignedTo,
    required this.createdAt,
    this.lastContacted,
    this.notes,
  });

  /// Create LeadModel from Firestore document
  factory LeadModel.fromFirestore(Map<String, dynamic> data, String leadId) {
    return LeadModel(
      leadId: leadId,
      phoneNumber: data['phoneNumber'] ?? '',
      name: data['name'] as String?,
      email: data['email'] as String?,
      status: LeadStatus.fromString(data['status'] ?? 'new'),
      assignedTo: data['assignedTo'] as String?,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      lastContacted: (data['lastContacted'] as Timestamp?)?.toDate(),
      notes: data['notes'] as String?,
    );
  }

  /// Convert LeadModel to Firestore document
  Map<String, dynamic> toFirestore() {
    return {
      'phoneNumber': phoneNumber,
      if (name != null) 'name': name,
      if (email != null) 'email': email,
      'status': status.toString(),
      if (assignedTo != null) 'assignedTo': assignedTo,
      'createdAt': Timestamp.fromDate(createdAt),
      if (lastContacted != null) 'lastContacted': Timestamp.fromDate(lastContacted!),
      if (notes != null) 'notes': notes,
    };
  }

  /// Create a copy with updated fields
  LeadModel copyWith({
    String? leadId,
    String? phoneNumber,
    String? name,
    String? email,
    LeadStatus? status,
    String? assignedTo,
    DateTime? createdAt,
    DateTime? lastContacted,
    String? notes,
  }) {
    return LeadModel(
      leadId: leadId ?? this.leadId,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      name: name ?? this.name,
      email: email ?? this.email,
      status: status ?? this.status,
      assignedTo: assignedTo ?? this.assignedTo,
      createdAt: createdAt ?? this.createdAt,
      lastContacted: lastContacted ?? this.lastContacted,
      notes: notes ?? this.notes,
    );
  }
}

/// Lead Status
enum LeadStatus {
  newLead,
  contacted,
  qualified,
  converted,
  lost;

  static LeadStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'new':
        return LeadStatus.newLead;
      case 'contacted':
        return LeadStatus.contacted;
      case 'qualified':
        return LeadStatus.qualified;
      case 'converted':
        return LeadStatus.converted;
      case 'lost':
        return LeadStatus.lost;
      default:
        return LeadStatus.newLead;
    }
  }

  @override
  String toString() {
    // Return 'new' for Firestore compatibility
    if (this == LeadStatus.newLead) {
      return 'new';
    }
    return name;
  }

  String get displayName {
    switch (this) {
      case LeadStatus.newLead:
        return 'New';
      case LeadStatus.contacted:
        return 'Contacted';
      case LeadStatus.qualified:
        return 'Qualified';
      case LeadStatus.converted:
        return 'Converted';
      case LeadStatus.lost:
        return 'Lost';
    }
  }
}



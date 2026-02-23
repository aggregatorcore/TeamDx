/// User Model for Operations System
/// 
/// Represents a user in the MY DX Operations system.
/// Contains only operations-related fields (no HR data).
class UserModel {
  final String userId;
  final String name;
  final UserRole role;
  final UserActiveStatus activeStatus;

  UserModel({
    required this.userId,
    required this.name,
    required this.role,
    this.activeStatus = UserActiveStatus.ready,
  });

  /// Create UserModel from Firestore document
  factory UserModel.fromFirestore(Map<String, dynamic> data, String userId) {
    return UserModel(
      userId: userId,
      name: data['name'] ?? '',
      role: UserRole.fromString(data['role'] ?? ''),
      activeStatus: UserActiveStatus.fromString(data['activeStatus'] ?? 'ready'),
    );
  }

  /// Convert UserModel to Firestore document
  Map<String, dynamic> toFirestore() {
    return {
      'name': name,
      'role': role.toString(),
      'activeStatus': activeStatus.toString(),
      // Note: deviceId is stored separately in devices collection
    };
  }

  /// Create a copy with updated fields
  UserModel copyWith({
    String? userId,
    String? name,
    UserRole? role,
    UserActiveStatus? activeStatus,
  }) {
    return UserModel(
      userId: userId ?? this.userId,
      name: name ?? this.name,
      role: role ?? this.role,
      activeStatus: activeStatus ?? this.activeStatus,
    );
  }
}

/// User Roles in Operations System
enum UserRole {
  admin,
  telecaller,
  counselor,
  documentation,
  manager;

  static UserRole fromString(String value) {
    switch (value.toLowerCase()) {
      case 'admin':
        return UserRole.admin;
      case 'telecaller':
        return UserRole.telecaller;
      case 'counselor':
        return UserRole.counselor;
      case 'documentation':
        return UserRole.documentation;
      case 'manager':
        return UserRole.manager;
      default:
        return UserRole.telecaller; // Default role
    }
  }

  @override
  String toString() {
    return name;
  }

  String get displayName {
    switch (this) {
      case UserRole.admin:
        return 'Admin';
      case UserRole.telecaller:
        return 'Telecaller';
      case UserRole.counselor:
        return 'Counselor';
      case UserRole.documentation:
        return 'Documentation';
      case UserRole.manager:
        return 'Manager';
    }
  }
}

/// User Active Status
enum UserActiveStatus {
  ready,
  onBreak,
  offline;

  static UserActiveStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'ready':
        return UserActiveStatus.ready;
      case 'break':
      case 'onbreak':
        return UserActiveStatus.onBreak;
      case 'offline':
        return UserActiveStatus.offline;
      default:
        return UserActiveStatus.offline;
    }
  }

  @override
  String toString() {
    // Return 'break' for Firestore compatibility
    if (this == UserActiveStatus.onBreak) {
      return 'break';
    }
    return name;
  }

  String get displayName {
    switch (this) {
      case UserActiveStatus.ready:
        return 'Ready';
      case UserActiveStatus.onBreak:
        return 'On Break';
      case UserActiveStatus.offline:
        return 'Offline';
    }
  }
}


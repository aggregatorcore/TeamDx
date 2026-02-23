class Lead {
  final String id;
  final int? leadId;
  final String firstName;
  final String lastName;
  final String? email;
  final String phone;
  final String? country;
  final String? visaType;
  final String status;
  final String? assignedToId;
  final AssignedUser? assignedTo;

  Lead({
    required this.id,
    this.leadId,
    required this.firstName,
    required this.lastName,
    this.email,
    required this.phone,
    this.country,
    this.visaType,
    required this.status,
    this.assignedToId,
    this.assignedTo,
  });

  factory Lead.fromJson(Map<String, dynamic> json) {
    return Lead(
      id: json['id'] ?? '',
      leadId: json['leadId'],
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      email: json['email'],
      phone: json['phone'] ?? '',
      country: json['country'],
      visaType: json['visaType'],
      status: json['status'] ?? 'new',
      assignedToId: json['assignedToId'],
      assignedTo: json['assignedTo'] != null 
          ? AssignedUser.fromJson(json['assignedTo'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'leadId': leadId,
      'firstName': firstName,
      'lastName': lastName,
      'email': email,
      'phone': phone,
      'country': country,
      'visaType': visaType,
      'status': status,
      'assignedToId': assignedToId,
      'assignedTo': assignedTo?.toJson(),
    };
  }

  String get fullName => '$firstName $lastName'.trim();
}

class AssignedUser {
  final String id;
  final String? employeeCode;
  final String firstName;
  final String lastName;
  final String? email;
  final Role? role;

  AssignedUser({
    required this.id,
    this.employeeCode,
    required this.firstName,
    required this.lastName,
    this.email,
    this.role,
  });

  factory AssignedUser.fromJson(Map<String, dynamic> json) {
    return AssignedUser(
      id: json['id'] ?? '',
      employeeCode: json['employeeCode'],
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      email: json['email'],
      role: json['role'] != null ? Role.fromJson(json['role']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'employeeCode': employeeCode,
      'firstName': firstName,
      'lastName': lastName,
      'email': email,
      'role': role?.toJson(),
    };
  }

  String get fullName => '$firstName $lastName'.trim();
}

class Role {
  final String id;
  final String name;
  final String? description;

  Role({
    required this.id,
    required this.name,
    this.description,
  });

  factory Role.fromJson(Map<String, dynamic> json) {
    return Role(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
    };
  }
}





class User {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? employeeCode;
  final String? phone;
  final Role role;

  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.employeeCode,
    this.phone,
    required this.role,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      firstName: json['firstName'],
      lastName: json['lastName'],
      employeeCode: json['employeeCode'],
      phone: json['phone'],
      role: Role.fromJson(json['role']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'employeeCode': employeeCode,
      'phone': phone,
      'role': role.toJson(),
    };
  }
}

class Role {
  final String id;
  final String name;
  final String? description;
  final int level;

  Role({
    required this.id,
    required this.name,
    this.description,
    required this.level,
  });

  factory Role.fromJson(Map<String, dynamic> json) {
    return Role(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      level: json['level'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'level': level,
    };
  }
}


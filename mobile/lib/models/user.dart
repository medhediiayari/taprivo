class User {
  final String id;
  final String email;
  final String fullName;
  final String role; // 'client' | 'merchant' | 'admin'
  final bool emailVerified;
  final DateTime? createdAt;

  const User({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.emailVerified = false,
    this.createdAt,
  });

  User copyWith({bool? emailVerified}) => User(
        id: id,
        email: email,
        fullName: fullName,
        role: role,
        emailVerified: emailVerified ?? this.emailVerified,
        createdAt: createdAt,
      );

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        fullName: json['full_name'] as String? ?? '',
        role: json['role'] as String? ?? 'client',
        emailVerified: json['email_verified'] as bool? ?? false,
        createdAt: json['created_at'] != null
            ? DateTime.tryParse(json['created_at'] as String)
            : null,
      );
}

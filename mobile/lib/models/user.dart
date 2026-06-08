class User {
  final String id;
  final String email;
  final String fullName;
  final String role; // 'client' | 'merchant' | 'admin'
  final bool emailVerified;

  const User({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.emailVerified = false,
  });

  User copyWith({bool? emailVerified}) => User(
        id: id,
        email: email,
        fullName: fullName,
        role: role,
        emailVerified: emailVerified ?? this.emailVerified,
      );

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        fullName: json['full_name'] as String? ?? '',
        role: json['role'] as String? ?? 'client',
        emailVerified: json['email_verified'] as bool? ?? false,
      );
}

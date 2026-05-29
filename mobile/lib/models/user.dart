class User {
  final String id;
  final String email;
  final String fullName;
  final String role; // 'client' | 'merchant' | 'admin'

  const User({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        fullName: json['full_name'] as String? ?? '',
        role: json['role'] as String? ?? 'client',
      );
}

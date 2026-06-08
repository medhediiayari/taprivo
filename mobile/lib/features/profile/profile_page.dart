import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/theme.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final initial = (user?.fullName.isNotEmpty ?? false)
        ? user!.fullName[0].toUpperCase()
        : (user?.email.isNotEmpty ?? false)
            ? user!.email[0].toUpperCase()
            : '?';

    return Scaffold(
      backgroundColor: TaprivoBrand.cream,
      appBar: AppBar(
        title: const Text('Profil'),
        backgroundColor: TaprivoBrand.cream,
        foregroundColor: TaprivoBrand.brown,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 8),
          Center(
            child: CircleAvatar(
              radius: 44,
              backgroundColor: TaprivoBrand.green,
              child: Text(
                initial,
                style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            user?.fullName.isNotEmpty == true ? user!.fullName : 'Mon compte',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: TaprivoBrand.brown),
          ),
          const SizedBox(height: 4),
          Text(
            user?.email ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(color: TaprivoBrand.textSecondary),
          ),
          const SizedBox(height: 24),
          if (user != null && !user.emailVerified)
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.mark_email_unread_outlined, color: TaprivoBrand.terracotta),
                      SizedBox(width: 10),
                      Expanded(child: Text('Votre e-mail n’est pas encore vérifié.')),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: FilledButton(
                      onPressed: () => context.push('/verify-email'),
                      style: FilledButton.styleFrom(backgroundColor: TaprivoBrand.green),
                      child: const Text('Vérifier mon e-mail'),
                    ),
                  ),
                ],
              ),
            ),
          if (user != null && user.emailVerified)
            _Card(
              child: Row(
                children: const [
                  Icon(Icons.verified_outlined, color: TaprivoBrand.success),
                  SizedBox(width: 10),
                  Text('E-mail vérifié'),
                ],
              ),
            ),
          const SizedBox(height: 12),
          _Card(
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.logout, color: TaprivoBrand.terracotta),
              title: const Text('Se déconnecter',
                  style: TextStyle(color: TaprivoBrand.terracotta, fontWeight: FontWeight.w600)),
              onTap: () => ref.read(authControllerProvider.notifier).logout(),
            ),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TaprivoBrand.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TaprivoBrand.border),
      ),
      child: child,
    );
  }
}

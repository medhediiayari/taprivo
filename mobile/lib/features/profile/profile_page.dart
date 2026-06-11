import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import '../../core/theme/theme.dart';
import '../../models/loyalty_card.dart';
import '../../widgets/brand.dart';
import '../cards/cards_providers.dart';

const _tiers = [50, 100, 250, 500, 1000, 2000, 5000];

const _months = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final cards = ref.watch(cardsProvider).valueOrNull ?? const <LoyaltyCard>[];
    final points = cards.fold<int>(0, (s, c) => s + c.totalStampsEarned);
    final nextTier = _tiers.firstWhere((t) => t > points, orElse: () => points);
    final remaining = (nextTier - points).clamp(0, nextTier);
    final progress = nextTier == 0 ? 1.0 : (points / nextTier).clamp(0.0, 1.0);

    final initial = (user?.fullName.isNotEmpty ?? false)
        ? user!.fullName[0].toUpperCase()
        : (user?.email.isNotEmpty ?? false)
            ? user!.email[0].toUpperCase()
            : '?';
    final since = user?.createdAt;

    void soon() => ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Bientôt disponible.')));

    return Scaffold(
      backgroundColor: TaprivoBrand.cream,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            // Header
            Row(
              children: [
                const Text('Profil',
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: TaprivoBrand.brown)),
                const Spacer(),
                IconButton(
                  onPressed: soon,
                  icon: const Icon(Icons.settings_outlined, color: TaprivoBrand.brown),
                  style: IconButton.styleFrom(
                    backgroundColor: TaprivoBrand.card,
                    side: const BorderSide(color: TaprivoBrand.border),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Identity
            Row(
              children: [
                CircleAvatar(
                  radius: 34,
                  backgroundColor: TaprivoBrand.green,
                  child: Text(initial,
                      style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.fullName.isNotEmpty == true ? user!.fullName : 'Mon compte',
                        style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: TaprivoBrand.brown),
                      ),
                      const SizedBox(height: 2),
                      const Text('Membre Taprivo',
                          style: TextStyle(color: TaprivoBrand.greenSoft, fontWeight: FontWeight.w600, fontSize: 13)),
                      if (since != null) ...[
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            const Icon(Icons.star, size: 13, color: TaprivoBrand.gold),
                            const SizedBox(width: 4),
                            Text('Depuis ${_months[since.month - 1]} ${since.year}',
                                style: const TextStyle(color: TaprivoBrand.textSecondary, fontSize: 12)),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _PointsCard(points: points, remaining: remaining, nextTier: nextTier, progress: progress),
            const SizedBox(height: 24),
            // Favourite partners
            Row(
              children: [
                const Text('Mes partenaires favoris',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: TaprivoBrand.brown)),
                const Spacer(),
                GestureDetector(
                  onTap: () => context.go('/cards'),
                  child: const Text('Voir tout',
                      style: TextStyle(color: TaprivoBrand.greenSoft, fontWeight: FontWeight.w600, fontSize: 13)),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (cards.isEmpty)
              const Text('Ajoutez des partenaires depuis l’accueil.',
                  style: TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13))
            else
              SizedBox(
                height: 92,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: cards.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 16),
                  itemBuilder: (_, i) => _PartnerCircle(card: cards[i]),
                ),
              ),
            const SizedBox(height: 24),
            // Menu
            _MenuItem(
              icon: Icons.notifications_none_rounded,
              title: 'Notifications',
              subtitle: 'Gérer mes préférences',
              onTap: soon,
            ),
            _MenuItem(
              icon: Icons.receipt_long_outlined,
              title: 'Historique',
              subtitle: 'Mes transactions et tampons',
              onTap: () => context.go('/cards'),
            ),
            _MenuItem(
              icon: Icons.help_outline_rounded,
              title: 'Aide & support',
              subtitle: 'Questions fréquentes',
              onTap: soon,
            ),
            _MenuItem(
              icon: Icons.info_outline_rounded,
              title: 'À propos de Taprivo',
              subtitle: 'En savoir plus',
              onTap: () => showAboutDialog(
                context: context,
                applicationName: 'Taprivo',
                applicationVersion: '0.1.0',
                applicationLegalese: '© 2026 Taprivo',
              ),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: () => ref.read(authControllerProvider.notifier).logout(),
              icon: const Icon(Icons.logout, color: TaprivoBrand.terracotta),
              label: const Text('Se déconnecter',
                  style: TextStyle(color: TaprivoBrand.terracotta, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}

class _PointsCard extends StatelessWidget {
  const _PointsCard(
      {required this.points, required this.remaining, required this.nextTier, required this.progress});
  final int points;
  final int remaining;
  final int nextTier;
  final double progress;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: TaprivoBrand.green,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Mes points',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 13)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.star, color: TaprivoBrand.gold, size: 22),
                        const SizedBox(width: 6),
                        Text('$points',
                            style: const TextStyle(
                                color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('Prochain palier',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 12)),
                  const SizedBox(height: 4),
                  Text('$remaining pts',
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: Colors.white.withValues(alpha: 0.18),
              valueColor: const AlwaysStoppedAnimation(TaprivoBrand.gold),
            ),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: Text('$points / $nextTier pts',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

class _PartnerCircle extends StatelessWidget {
  const _PartnerCircle({required this.card});
  final LoyaltyCard card;

  @override
  Widget build(BuildContext context) {
    final bg = hexColor(card.brandColorBg);
    final fg = hexColor(card.brandColorFg);
    final logo = resolveImageUrl(card.logoUrl);
    return GestureDetector(
      onTap: () => context.push('/card/${card.id}'),
      child: SizedBox(
        width: 64,
        child: Column(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: bg,
                    border: Border.all(color: TaprivoBrand.border),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: logo != null
                      ? Image.network(
                          logo,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _initial(bg, fg, card.merchantName),
                          loadingBuilder: (_, child, p) => p == null ? child : _initial(bg, fg, card.merchantName),
                        )
                      : _initial(bg, fg, card.merchantName),
                ),
                const Positioned(
                  right: -2,
                  bottom: -2,
                  child: CircleAvatar(
                    radius: 10,
                    backgroundColor: Colors.white,
                    child: Icon(Icons.favorite, size: 12, color: TaprivoBrand.terracotta),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              card.merchantName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, color: TaprivoBrand.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _initial(Color bg, Color fg, String name) => Container(
        color: bg,
        alignment: Alignment.center,
        child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
            style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 20)),
      );
}

class _MenuItem extends StatelessWidget {
  const _MenuItem(
      {required this.icon, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: TaprivoBrand.card,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: TaprivoBrand.green.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: TaprivoBrand.green, size: 21),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14.5, color: TaprivoBrand.brown)),
                      const SizedBox(height: 2),
                      Text(subtitle,
                          style: const TextStyle(color: TaprivoBrand.textSecondary, fontSize: 12.5)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: TaprivoBrand.textSecondary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

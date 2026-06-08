import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/providers.dart';
import '../../core/theme/theme.dart';
import '../../models/merchant.dart';
import '../../widgets/brand.dart';
import 'home_providers.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  final _search = TextEditingController();
  final _bookmarked = <String>{};
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  // Joins (or re-opens) the loyalty program for a merchant, then opens its card.
  Future<void> _open(Merchant m) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final res = await ref.read(dioProvider).post<Map<String, dynamic>>(
            Endpoints.join,
            data: {'merchant_id': m.id},
          );
      final cardId = res.data!['card_id'] as String;
      if (mounted) context.push('/card/$cardId');
    } catch (_) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Impossible d’ouvrir ce partenaire.')),
      );
    }
  }

  void _soon() => ScaffoldMessenger.of(context)
      .showSnackBar(const SnackBar(content: Text('Bientôt disponible.')));

  @override
  Widget build(BuildContext context) {
    final merchants = ref.watch(merchantsProvider);
    return Scaffold(
      backgroundColor: TaprivoBrand.cream,
      body: SafeArea(
        bottom: false,
        child: merchants.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(
            child: FilledButton(
              onPressed: () => ref.invalidate(merchantsProvider),
              child: const Text('Réessayer'),
            ),
          ),
          data: (all) {
            final q = _query.trim().toLowerCase();
            final list = q.isEmpty
                ? all
                : all
                    .where((m) =>
                        m.name.toLowerCase().contains(q) ||
                        m.address.toLowerCase().contains(q))
                    .toList();
            final offers = all.where((m) => m.rewardDescription.isNotEmpty).toList();

            return RefreshIndicator(
              onRefresh: () => ref.refresh(merchantsProvider.future),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  _header(),
                  const SizedBox(height: 16),
                  _searchBar(),
                  const SizedBox(height: 24),
                  _sectionHeader('Autour de vous', 'Voir sur la carte', _soon),
                  const SizedBox(height: 12),
                  _MapPreview(merchants: all),
                  const SizedBox(height: 20),
                  if (list.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(child: Text('Aucun partenaire trouvé.')),
                    )
                  else
                    ...list.map((m) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _RestaurantTile(
                            merchant: m,
                            bookmarked: _bookmarked.contains(m.id),
                            onTap: () => _open(m),
                            onBookmark: () => setState(() => _bookmarked.contains(m.id)
                                ? _bookmarked.remove(m.id)
                                : _bookmarked.add(m.id)),
                          ),
                        )),
                  if (offers.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _sectionHeader('Offres du moment', 'Voir tout', _soon),
                    const SizedBox(height: 12),
                    ...offers.take(3).map((m) => Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: _OfferCard(merchant: m, onTap: () => _open(m)),
                        )),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _header() {
    return Row(
      children: [
        const Text(
          'Accueil',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: TaprivoBrand.brown,
            letterSpacing: -0.5,
          ),
        ),
        const Spacer(),
        IconButton(
          onPressed: _soon,
          icon: const Icon(Icons.notifications_none_rounded, color: TaprivoBrand.brown),
          style: IconButton.styleFrom(
            backgroundColor: TaprivoBrand.card,
            side: const BorderSide(color: TaprivoBrand.border),
          ),
        ),
      ],
    );
  }

  Widget _searchBar() {
    return TextField(
      controller: _search,
      onChanged: (v) => setState(() => _query = v),
      decoration: InputDecoration(
        hintText: 'Rechercher un partenaire',
        prefixIcon: const Icon(Icons.search, color: TaprivoBrand.textSecondary),
        filled: true,
        fillColor: TaprivoBrand.card,
        contentPadding: const EdgeInsets.symmetric(vertical: 4),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: TaprivoBrand.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: TaprivoBrand.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: TaprivoBrand.green, width: 1.4),
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, String action, VoidCallback onAction) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: TaprivoBrand.brown,
          ),
        ),
        const Spacer(),
        GestureDetector(
          onTap: onAction,
          child: Text(
            action,
            style: const TextStyle(
              color: TaprivoBrand.greenSoft,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ),
      ],
    );
  }
}

/// Lightweight, dependency-free map preview that places merchant pins by their
/// relative lat/lng. Not a real tile map — swap for flutter_map/Google later.
class _MapPreview extends StatelessWidget {
  const _MapPreview({required this.merchants});
  final List<Merchant> merchants;

  @override
  Widget build(BuildContext context) {
    final pts = merchants.where((m) => m.lat != null && m.lng != null).toList();
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: SizedBox(
        height: 170,
        width: double.infinity,
        child: Stack(
          children: [
            Positioned.fill(
              child: CustomPaint(painter: _MapBackgroundPainter()),
            ),
            if (pts.isEmpty)
              const Center(
                child: Icon(Icons.map_outlined, color: TaprivoBrand.greenSoft, size: 40),
              )
            else
              LayoutBuilder(
                builder: (context, c) {
                  final lats = pts.map((m) => m.lat!).toList();
                  final lngs = pts.map((m) => m.lng!).toList();
                  final minLat = lats.reduce(math.min), maxLat = lats.reduce(math.max);
                  final minLng = lngs.reduce(math.min), maxLng = lngs.reduce(math.max);
                  final dLat = (maxLat - minLat).abs();
                  final dLng = (maxLng - minLng).abs();
                  const pad = 28.0;
                  double fx(int i) => dLng < 1e-6
                      ? c.maxWidth / 2 + (i.isEven ? -30 : 30)
                      : pad + (pts[i].lng! - minLng) / dLng * (c.maxWidth - pad * 2);
                  double fy(int i) => dLat < 1e-6
                      ? c.maxHeight / 2 + (i.isEven ? -20 : 20)
                      : pad + (maxLat - pts[i].lat!) / dLat * (c.maxHeight - pad * 2);
                  return Stack(
                    children: [
                      for (var i = 0; i < pts.length; i++)
                        Positioned(
                          left: fx(i) - 14,
                          top: fy(i) - 28,
                          child: Icon(
                            Icons.location_on,
                            size: 30,
                            color: i == 0 ? TaprivoBrand.terracotta : TaprivoBrand.green,
                          ),
                        ),
                    ],
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _MapBackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()..color = const Color(0xFFE7E2D6);
    canvas.drawRect(Offset.zero & size, bg);

    // Faint "blocks" and roads to evoke a city map.
    final block = Paint()..color = const Color(0xFFDCD6C7);
    final rnd = math.Random(7);
    for (var i = 0; i < 8; i++) {
      final w = 28.0 + rnd.nextInt(40);
      final h = 20.0 + rnd.nextInt(30);
      final x = rnd.nextDouble() * (size.width - w);
      final y = rnd.nextDouble() * (size.height - h);
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), const Radius.circular(4)),
        block,
      );
    }
    final road = Paint()
      ..color = const Color(0xFFF1ECE1)
      ..strokeWidth = 6;
    canvas.drawLine(Offset(0, size.height * 0.35), Offset(size.width, size.height * 0.5), road);
    canvas.drawLine(Offset(size.width * 0.4, 0), Offset(size.width * 0.55, size.height), road);
    canvas.drawLine(Offset(0, size.height * 0.8), Offset(size.width, size.height * 0.7), road);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _RestaurantTile extends StatelessWidget {
  const _RestaurantTile({
    required this.merchant,
    required this.bookmarked,
    required this.onTap,
    required this.onBookmark,
  });

  final Merchant merchant;
  final bool bookmarked;
  final VoidCallback onTap;
  final VoidCallback onBookmark;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: TaprivoBrand.card,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              _Thumb(merchant: merchant, size: 60),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      merchant.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15.5,
                        color: TaprivoBrand.brown,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.place_outlined, size: 14, color: TaprivoBrand.textSecondary),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            merchant.address.isEmpty ? 'Partenaire Taprivo' : merchant.address,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: TaprivoBrand.textSecondary, fontSize: 12.5),
                          ),
                        ),
                      ],
                    ),
                    if (merchant.rewardDescription.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Text('🎁 ', style: TextStyle(fontSize: 11)),
                          Expanded(
                            child: Text(
                              merchant.rewardDescription,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: TaprivoBrand.greenSoft,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              IconButton(
                onPressed: onBookmark,
                icon: Icon(
                  bookmarked ? Icons.bookmark : Icons.bookmark_border,
                  color: bookmarked ? TaprivoBrand.terracotta : TaprivoBrand.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.merchant, required this.onTap});
  final Merchant merchant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = hexColor(merchant.brandColorBg);
    final logo = resolveImageUrl(merchant.logoUrl);
    return Material(
      color: TaprivoBrand.card,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 130,
            child: logo != null
                ? Image.network(
                    logo,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => ColoredBox(color: bg),
                    loadingBuilder: (_, child, p) => p == null ? child : ColoredBox(color: bg),
                  )
                : ColoredBox(color: bg),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  merchant.rewardDescription,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: TaprivoBrand.brown,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  merchant.name,
                  style: const TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 4),
                Text(
                  'Dès ${merchant.stampsRequired} tampons collectés',
                  style: const TextStyle(color: TaprivoBrand.greenSoft, fontSize: 12.5, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: onTap,
                    style: FilledButton.styleFrom(
                      backgroundColor: TaprivoBrand.green,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Voir l’offre', style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.merchant, required this.size});
  final Merchant merchant;
  final double size;

  @override
  Widget build(BuildContext context) {
    final bg = hexColor(merchant.brandColorBg);
    final fg = hexColor(merchant.brandColorFg);
    final logo = resolveImageUrl(merchant.logoUrl);
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: size,
        height: size,
        child: logo != null
            ? Image.network(
                logo,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _initial(bg, fg),
                loadingBuilder: (_, child, p) => p == null ? child : _initial(bg, fg),
              )
            : _initial(bg, fg),
      ),
    );
  }

  Widget _initial(Color bg, Color fg) => Container(
        color: bg,
        alignment: Alignment.center,
        child: Text(
          merchant.name.isNotEmpty ? merchant.name[0].toUpperCase() : '?',
          style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 22),
        ),
      );
}

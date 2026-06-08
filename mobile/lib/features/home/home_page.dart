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
import 'merchant_map.dart';

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
                  _sectionHeader('Autour de vous', 'Voir sur la carte',
                      () => context.push('/map')),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: () => context.push('/map'),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: SizedBox(
                        height: 170,
                        width: double.infinity,
                        child: AbsorbPointer(
                          child: MerchantMap(merchants: all, interactive: false),
                        ),
                      ),
                    ),
                  ),
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

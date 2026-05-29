import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/endpoints.dart';
import '../../core/providers.dart';
import '../../models/loyalty_card.dart';

final cardsProvider = FutureProvider.autoDispose<List<LoyaltyCard>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(Endpoints.cards);
  final list = (res.data!['cards'] as List).cast<Map<String, dynamic>>();
  return list.map(LoyaltyCard.fromJson).toList();
});

/// `GET /cards/:id` → { card, recent_stamps }.
final cardDetailProvider = FutureProvider.autoDispose
    .family<LoyaltyCard, String>((ref, id) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(Endpoints.card(id));
  return LoyaltyCard.fromJson(res.data!['card'] as Map<String, dynamic>);
});

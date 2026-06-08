import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/endpoints.dart';
import '../../core/providers.dart';
import '../../models/merchant.dart';

/// Public list of partner restaurants used by the discovery (Accueil) page.
final merchantsProvider = FutureProvider.autoDispose<List<Merchant>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(Endpoints.merchants);
  final list = (res.data!['merchants'] as List).cast<Map<String, dynamic>>();
  return list.map(Merchant.fromJson).toList();
});

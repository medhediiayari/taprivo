import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/endpoints.dart';
import '../../core/providers.dart';
import '../../models/reward.dart';

/// `GET /rewards` → the user's pending and redeemed rewards.
final rewardsProvider = FutureProvider.autoDispose<List<Reward>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(Endpoints.rewards);
  final list = (res.data!['rewards'] as List).cast<Map<String, dynamic>>();
  return list.map(Reward.fromJson).toList();
});

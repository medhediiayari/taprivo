import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/endpoints.dart';
import '../../core/providers.dart';

class _Event {
  final String type; // 'stamp' | 'reward'
  final DateTime? at;
  final String? method;
  final String? fullName;
  _Event(this.type, this.at, this.method, this.fullName);
}

final ownerHistoryProvider = FutureProvider.autoDispose<List<_Event>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(Endpoints.merchantHistory);
  final list = (res.data!['events'] as List).cast<Map<String, dynamic>>();
  return list
      .map((e) => _Event(
            e['type'] as String? ?? 'stamp',
            e['at'] != null ? DateTime.tryParse(e['at'] as String)?.toLocal() : null,
            e['method'] as String?,
            e['full_name'] as String?,
          ))
      .toList();
});

class OwnerHistoryPage extends ConsumerWidget {
  const OwnerHistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(ownerHistoryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Historique')),
      body: history.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: FilledButton(
            onPressed: () => ref.invalidate(ownerHistoryProvider),
            child: const Text('Réessayer'),
          ),
        ),
        data: (events) {
          if (events.isEmpty) {
            return const Center(child: Text('Aucune activité pour l’instant.'));
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(ownerHistoryProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: events.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final e = events[i];
                final reward = e.type == 'reward';
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: reward ? const Color(0xFFEF9F27) : const Color(0xFFE7E0CE),
                    child: Icon(
                      reward ? Icons.card_giftcard : Icons.check,
                      color: const Color(0xFF04342C),
                      size: 20,
                    ),
                  ),
                  title: Text(e.fullName ?? 'Client'),
                  subtitle: Text(reward
                      ? 'Cadeau remis'
                      : 'Tampon${e.method != null ? ' · ${e.method!.toUpperCase()}' : ''}'),
                  trailing: Text(
                    e.at != null ? _ago(e.at!) : '',
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  String _ago(DateTime t) {
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return "à l'instant";
    if (d.inMinutes < 60) return '${d.inMinutes} min';
    if (d.inHours < 24) return '${d.inHours} h';
    return '${d.inDays} j';
  }
}

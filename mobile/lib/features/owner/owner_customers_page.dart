import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/endpoints.dart';
import '../../core/providers.dart';

class _Query {
  final String q;
  final String sort;
  const _Query(this.q, this.sort);

  @override
  bool operator ==(Object other) =>
      other is _Query && other.q == q && other.sort == sort;
  @override
  int get hashCode => Object.hash(q, sort);
}

final ownerCustomersProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, _Query>((ref, query) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>(
    Endpoints.merchantCustomers,
    queryParameters: {'q': query.q, 'sort': query.sort},
  );
  return ((res.data!['customers'] as List?) ?? const [])
      .cast<Map<String, dynamic>>();
});

class OwnerCustomersPage extends ConsumerStatefulWidget {
  const OwnerCustomersPage({super.key});

  @override
  ConsumerState<OwnerCustomersPage> createState() => _OwnerCustomersPageState();
}

class _OwnerCustomersPageState extends ConsumerState<OwnerCustomersPage> {
  String _q = '';
  String _sort = 'visits';

  @override
  Widget build(BuildContext context) {
    final customers = ref.watch(ownerCustomersProvider(_Query(_q, _sort)));
    return Scaffold(
      appBar: AppBar(title: const Text('Clients')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Nom, email, téléphone…',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _q = v),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                for (final s in const [
                  ['visits', 'Visites'],
                  ['recent', 'Récents'],
                  ['name', 'Nom'],
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(s[1]),
                      selected: _sort == s[0],
                      onSelected: (_) => setState(() => _sort = s[0]),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: customers.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => Center(
                child: FilledButton(
                  onPressed: () => ref.invalidate(ownerCustomersProvider(_Query(_q, _sort))),
                  child: const Text('Réessayer'),
                ),
              ),
              data: (list) {
                if (list.isEmpty) {
                  return const Center(child: Text('Aucun client.'));
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final c = list[i];
                    final name = c['full_name'] as String? ?? 'Client';
                    final visits = c['visits'] ?? 0;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(child: Text(_initials(name))),
                      title: Text(name),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (c['email'] != null) Text('${c['email']}'),
                          if (c['phone'] != null) Text('${c['phone']}'),
                        ],
                      ),
                      isThreeLine: c['email'] != null && c['phone'] != null,
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('$visits',
                              style: const TextStyle(
                                  fontSize: 20, fontWeight: FontWeight.w700)),
                          const Text('visites',
                              style: TextStyle(fontSize: 10, color: Colors.black54)),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router.dart';
import 'core/theme/theme.dart';

class TaprivoApp extends ConsumerWidget {
  const TaprivoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Taprivo',
      debugShowCheckedModeBanner: false,
      theme: buildTaprivoTheme(),
      routerConfig: router,
    );
  }
}

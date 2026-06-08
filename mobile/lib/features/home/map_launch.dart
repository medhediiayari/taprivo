import 'package:url_launcher/url_launcher.dart';

import '../../models/merchant.dart';

/// Opens the partner's location in the Google Maps app (or the browser as a
/// fallback). Uses coordinates when available, otherwise a name/address query.
Future<bool> openInGoogleMaps(Merchant m) async {
  final query = (m.lat != null && m.lng != null)
      ? '${m.lat},${m.lng}'
      : Uri.encodeComponent(
          [m.name, m.address].where((s) => s.isNotEmpty).join(' '));
  final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$query');
  try {
    return await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}

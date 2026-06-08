import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/theme.dart';
import '../../models/merchant.dart';
import '../../widgets/brand.dart';

/// Key-less map with a clean, premium basemap (CartoDB Positron) and custom
/// branded markers (a circular badge showing each partner's logo).
class MerchantMap extends StatelessWidget {
  const MerchantMap({
    super.key,
    required this.merchants,
    this.interactive = true,
    this.onTapMerchant,
    this.showAttribution = false,
  });

  final List<Merchant> merchants;
  final bool interactive;
  final void Function(Merchant)? onTapMerchant;
  final bool showAttribution;

  // Default view if no merchant has coordinates yet (Tunis).
  static const _fallback = LatLng(36.8065, 10.1815);

  @override
  Widget build(BuildContext context) {
    final pts = merchants.where((m) => m.lat != null && m.lng != null).toList();
    final coords = [for (final m in pts) LatLng(m.lat!, m.lng!)];

    return FlutterMap(
      options: MapOptions(
        initialCenter: coords.isNotEmpty ? coords.first : _fallback,
        initialZoom: 13,
        initialCameraFit: coords.length >= 2
            ? CameraFit.coordinates(
                coordinates: coords,
                padding: const EdgeInsets.all(56),
              )
            : null,
        interactionOptions: InteractionOptions(
          flags: interactive ? InteractiveFlag.all : InteractiveFlag.none,
        ),
      ),
      children: [
        TileLayer(
          // CartoDB Positron — clean, low-saturation basemap (free, no key).
          urlTemplate: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          subdomains: const ['a', 'b', 'c', 'd'],
          userAgentPackageName: 'com.taprivo.taprivo_mobile',
        ),
        MarkerLayer(
          markers: [
            for (final m in pts)
              Marker(
                point: LatLng(m.lat!, m.lng!),
                width: 46,
                height: 46,
                child: _MerchantPin(
                  merchant: m,
                  onTap: onTapMerchant == null ? null : () => onTapMerchant!(m),
                ),
              ),
          ],
        ),
        if (showAttribution)
          RichAttributionWidget(
            alignment: AttributionAlignment.bottomRight,
            attributions: [
              TextSourceAttribution('OpenStreetMap', onTap: () {}),
              TextSourceAttribution('CARTO', onTap: () {}),
            ],
          ),
      ],
    );
  }
}

class _MerchantPin extends StatelessWidget {
  const _MerchantPin({required this.merchant, this.onTap});
  final Merchant merchant;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final bg = hexColor(merchant.brandColorBg);
    final fg = hexColor(merchant.brandColorFg);
    final logo = resolveImageUrl(merchant.logoUrl);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
          border: Border.all(color: TaprivoBrand.terracotta, width: 2.5),
          boxShadow: const [
            BoxShadow(color: Colors.black38, blurRadius: 5, offset: Offset(0, 2)),
          ],
        ),
        padding: const EdgeInsets.all(2),
        child: ClipOval(
          child: SizedBox(
            width: 36,
            height: 36,
            child: logo != null
                ? Image.network(
                    logo,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _initial(bg, fg),
                    loadingBuilder: (_, child, p) => p == null ? child : _initial(bg, fg),
                  )
                : _initial(bg, fg),
          ),
        ),
      ),
    );
  }

  Widget _initial(Color bg, Color fg) => Container(
        color: bg,
        alignment: Alignment.center,
        child: Text(
          merchant.name.isNotEmpty ? merchant.name[0].toUpperCase() : '?',
          style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 16),
        ),
      );
}

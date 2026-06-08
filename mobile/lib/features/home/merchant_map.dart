import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/theme/theme.dart';
import '../../models/merchant.dart';

/// Real OpenStreetMap map (key-less) showing partner restaurants as pins.
class MerchantMap extends StatelessWidget {
  const MerchantMap({
    super.key,
    required this.merchants,
    this.interactive = true,
    this.onTapMerchant,
  });

  final List<Merchant> merchants;
  final bool interactive;
  final void Function(Merchant)? onTapMerchant;

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
                padding: const EdgeInsets.all(48),
              )
            : null,
        interactionOptions: InteractionOptions(
          flags: interactive ? InteractiveFlag.all : InteractiveFlag.none,
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.taprivo.taprivo_mobile',
        ),
        MarkerLayer(
          markers: [
            for (final m in pts)
              Marker(
                point: LatLng(m.lat!, m.lng!),
                width: 44,
                height: 44,
                child: GestureDetector(
                  onTap: onTapMerchant == null ? null : () => onTapMerchant!(m),
                  child: const Icon(
                    Icons.location_on,
                    color: TaprivoBrand.terracotta,
                    size: 38,
                    shadows: [Shadow(color: Colors.black45, blurRadius: 4)],
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

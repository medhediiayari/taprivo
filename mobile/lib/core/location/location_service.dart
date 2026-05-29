import 'package:geolocator/geolocator.dart';

/// Thin wrapper over geolocator. The backend validates the geofence server-side
/// (§11) — this only supplies coordinates with the scan.
class LocationService {
  Future<Position?> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) return null;

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }

    return Geolocator.getCurrentPosition();
  }
}

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export const haversineMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
};

export const isInsideGeofence = (
  userLat: number,
  userLng: number,
  merchantLat: number,
  merchantLng: number,
  radiusM: number,
): { ok: boolean; distance: number } => {
  const distance = haversineMeters(userLat, userLng, merchantLat, merchantLng);
  return { ok: distance <= radiusM, distance };
};

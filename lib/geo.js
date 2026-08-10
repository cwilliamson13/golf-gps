const EARTH_RADIUS_YARDS = 6_371_000 / 0.9144; // Earth radius (m) → yards

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in yards between two { lat, lon } points. */
export function distanceYards(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_YARDS * Math.asin(Math.sqrt(h));
}

export function formatCoord(value, digits = 5) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

/**
 * Watch device GPS. Returns a cancel function.
 * onUpdate({ lat, lon, accuracyMeters })
 * onError(message)
 */
export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError("GPS not supported on this device.");
    return () => {};
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy,
      });
    },
    (err) => {
      const messages = {
        1: "Location permission denied.",
        2: "Location unavailable.",
        3: "Location request timed out.",
      };
      onError(messages[err.code] || "Unable to get location.");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15000,
    }
  );

  return () => navigator.geolocation.clearWatch(id);
}

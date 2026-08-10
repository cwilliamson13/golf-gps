(function () {
  var coordsEl = document.getElementById("coords");
  var statusEl = document.getElementById("status");
  var refreshBtn = document.getElementById("refresh");

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function showPosition(pos) {
    var lat = pos.coords.latitude.toFixed(5);
    var lon = pos.coords.longitude.toFixed(5);
    var accuracyYds = Math.round(pos.coords.accuracy / 0.9144);
    coordsEl.textContent = lat + ", " + lon;
    setStatus("GPS ±" + accuracyYds + " yd");
  }

  function showError(err) {
    var messages = {
      1: "Location permission denied. Check Settings → Privacy → Location Services.",
      2: "Location unavailable.",
      3: "Location timed out. Try Refresh GPS.",
    };
    setStatus(messages[err.code] || "Unable to get location.");
  }

  function requestGps() {
    if (!navigator.geolocation) {
      setStatus("GPS not supported in this browser.");
      return;
    }

    setStatus("Getting GPS…");
    navigator.geolocation.getCurrentPosition(showPosition, showError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000,
    });
  }

  refreshBtn.addEventListener("click", requestGps);
  requestGps();
})();

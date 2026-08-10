(function () {
  // iOS ignores user-scalable=no — block double-tap + pinch zoom in JS
  var lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    function (event) {
      var now = Date.now();
      if (now - lastTouchEnd <= 350) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );
  document.addEventListener("gesturestart", function (event) {
    event.preventDefault();
  });
  document.addEventListener("gesturechange", function (event) {
    event.preventDefault();
  });
  document.addEventListener("gestureend", function (event) {
    event.preventDefault();
  });

  var SCORE_KEY = "golf-gps-scores-olde-salem-greens";
  var EARTH_RADIUS_YARDS = 6371000 / 0.9144;

  var course = null;
  var holeIndex = 0;
  var you = null;
  var scores = {};

  var els = {
    courseName: document.getElementById("courseName"),
    holeLabel: document.getElementById("holeLabel"),
    distanceMid: document.getElementById("distanceMid"),
    distanceFront: document.getElementById("distanceFront"),
    distanceBack: document.getElementById("distanceBack"),
    holeMeta: document.getElementById("holeMeta"),
    scoreValue: document.getElementById("scoreValue"),
    scoreMinus: document.getElementById("scoreMinus"),
    scorePlus: document.getElementById("scorePlus"),
    status: document.getElementById("status"),
    prevHole: document.getElementById("prevHole"),
    nextHole: document.getElementById("nextHole"),
    scorecard: document.getElementById("scorecard"),
    roundTotal: document.getElementById("roundTotal"),
    toPar: document.getElementById("toPar"),
  };

  function currentHole() {
    return course.holes[holeIndex];
  }

  function teeYards(hole) {
    return hole.yards[course.defaultTee] || hole.yards.blue;
  }

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function distanceYards(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null;
    var dLat = toRad(b.lat - a.lat);
    var dLon = toRad(b.lon - a.lon);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * EARTH_RADIUS_YARDS * Math.asin(Math.sqrt(h));
  }

  function formatDistance(yards) {
    if (yards == null || isNaN(yards)) return "—";
    return String(Math.round(yards));
  }

  function loadScores() {
    try {
      scores = JSON.parse(localStorage.getItem(SCORE_KEY) || "{}") || {};
    } catch (e) {
      scores = {};
    }
  }

  function saveScores() {
    localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
  }

  function getScore(holeNumber) {
    var value = scores[holeNumber];
    return typeof value === "number" ? value : null;
  }

  function setScore(holeNumber, value) {
    if (value == null) {
      delete scores[holeNumber];
    } else {
      scores[holeNumber] = value;
    }
    saveScores();
  }

  function roundTotals() {
    var strokes = 0;
    var scored = 0;
    var parPlayed = 0;
    course.holes.forEach(function (hole) {
      var score = getScore(hole.number);
      if (score != null) {
        strokes += score;
        scored += 1;
        parPlayed += hole.par;
      }
    });
    return { strokes: strokes, scored: scored, parPlayed: parPlayed };
  }

  function renderScorecard() {
    els.scorecard.innerHTML = "";
    course.holes.forEach(function (hole, index) {
      var score = getScore(hole.number);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hole-cell" + (index === holeIndex ? " is-active" : "");
      btn.innerHTML =
        '<span class="hole-cell-num">Hole ' +
        hole.number +
        "</span>" +
        '<span class="hole-cell-score">' +
        (score != null ? score : "—") +
        "</span>" +
        '<span class="hole-cell-par">Par ' +
        hole.par +
        " · " +
        teeYards(hole) +
        "y</span>";
      btn.addEventListener("click", function () {
        holeIndex = index;
        render();
      });
      els.scorecard.appendChild(btn);
    });

    var totals = roundTotals();
    var toParText = "E";
    if (totals.scored === 0) {
      els.roundTotal.textContent = "—";
      els.toPar.textContent = "E";
    } else {
      var toPar = totals.strokes - totals.parPlayed;
      toParText = toPar === 0 ? "E" : toPar > 0 ? "+" + toPar : String(toPar);
      els.roundTotal.textContent = totals.strokes + " (" + toParText + ")";
      els.toPar.textContent = toParText;
    }
  }

  function render() {
    var hole = currentHole();
    var yards = teeYards(hole);
    var score = getScore(hole.number);

    els.courseName.textContent = course.name;
    els.holeLabel.textContent = "Hole " + hole.number + " · Par " + hole.par;
    els.holeMeta.textContent =
      "Par " + hole.par + " · Hcp " + hole.handicap + " · " + yards + " yd";
    els.scoreValue.textContent = score != null ? String(score) : "—";

    els.distanceMid.textContent = formatDistance(distanceYards(you, hole.middle));
    els.distanceFront.textContent = formatDistance(distanceYards(you, hole.front));
    els.distanceBack.textContent = formatDistance(distanceYards(you, hole.back));

    renderScorecard();
  }

  function cycleHole(step) {
    holeIndex = (holeIndex + step + course.holes.length) % course.holes.length;
    render();
  }

  function adjustScore(delta) {
    var hole = currentHole();
    var current = getScore(hole.number);
    if (current == null) {
      setScore(hole.number, hole.par);
    } else {
      var next = current + delta;
      if (next < 1) {
        setScore(hole.number, null);
      } else {
        setScore(hole.number, next);
      }
    }
    render();
  }

  function setStatus(text) {
    els.status.textContent = text;
  }

  function onPosition(pos) {
    you = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
    };
    var accuracyYds = Math.round(pos.coords.accuracy / 0.9144);
    setStatus("GPS ±" + accuracyYds + " yd");
    render();
  }

  function onGpsError(err) {
    var messages = {
      1: "Location permission denied.",
      2: "Location unavailable.",
      3: "Location timed out. Waiting to retry…",
    };
    setStatus(messages[err.code] || "Unable to get location.");
  }

  function startGpsWatch() {
    if (!navigator.geolocation) {
      setStatus("GPS not supported in this browser.");
      return;
    }
    setStatus("Getting GPS…");
    navigator.geolocation.watchPosition(onPosition, onGpsError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000,
    });
  }

  els.prevHole.addEventListener("click", function () {
    cycleHole(-1);
  });
  els.nextHole.addEventListener("click", function () {
    cycleHole(1);
  });
  els.scoreMinus.addEventListener("click", function () {
    adjustScore(-1);
  });
  els.scorePlus.addEventListener("click", function () {
    adjustScore(1);
  });

  loadScores();

  fetch("data/olde-salem-greens.json")
    .then(function (res) {
      if (!res.ok) throw new Error("Could not load course data");
      return res.json();
    })
    .then(function (data) {
      course = data;
      render();
      startGpsWatch();
    })
    .catch(function () {
      setStatus("Could not load course JSON.");
    });
})();

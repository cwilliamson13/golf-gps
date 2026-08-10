(function () {
  // Block pinch zoom only — don't interfere with scrolling
  document.addEventListener(
    "touchmove",
    function (event) {
      if (event.touches.length > 1) event.preventDefault();
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

  var lastTap = 0;
  var touchMoved = false;
  document.addEventListener(
    "touchstart",
    function () {
      touchMoved = false;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchmove",
    function () {
      touchMoved = true;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchend",
    function (event) {
      // Never block rapid taps on controls — only stop double-tap zoom on the page
      if (
        event.target.closest(
          "button, a, input, label, [role='button'], .hole-score"
        )
      ) {
        lastTap = 0;
        return;
      }
      if (touchMoved) {
        lastTap = 0;
        return;
      }
      var now = Date.now();
      if (now - lastTap <= 300) {
        event.preventDefault();
      }
      lastTap = now;
    },
    { passive: false }
  );

  var SCORE_KEY = "golf-gps-scores-olde-salem-greens";
  var COLLAPSE_KEY = "golf-gps-scorecard-collapsed";
  var EARTH_RADIUS_YARDS = 6371000 / 0.9144;

  var course = null;
  var holeIndex = 0;
  var you = null;
  var scores = {};
  var padDigits = "";
  var scorecardCollapsed = localStorage.getItem(COLLAPSE_KEY) === "1";

  var els = {
    courseName: document.getElementById("courseName"),
    holeLabel: document.getElementById("holeLabel"),
    holeScore: document.getElementById("holeScore"),
    holeMeta: document.getElementById("holeMeta"),
    distanceMid: document.getElementById("distanceMid"),
    distanceFront: document.getElementById("distanceFront"),
    distanceBack: document.getElementById("distanceBack"),
    status: document.getElementById("status"),
    prevHole: document.getElementById("prevHole"),
    nextHole: document.getElementById("nextHole"),
    scorecardSection: document.getElementById("scorecardSection"),
    scorecard: document.getElementById("scorecard"),
    scorecardToggle: document.getElementById("scorecardToggle"),
    scorecardChevron: document.getElementById("scorecardChevron"),
    clearRound: document.getElementById("clearRound"),
    roundTotal: document.getElementById("roundTotal"),
    toPar: document.getElementById("toPar"),
    scorePad: document.getElementById("scorePad"),
    padTitle: document.getElementById("padTitle"),
    padValue: document.getElementById("padValue"),
    padKeys: document.getElementById("padKeys"),
    padClear: document.getElementById("padClear"),
    padDone: document.getElementById("padDone"),
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

  function updateCollapseUi() {
    els.scorecardSection.classList.toggle("is-collapsed", scorecardCollapsed);
    els.scorecardChevron.textContent = scorecardCollapsed ? "▸" : "▾";
  }

  function renderTotals() {
    var totals = roundTotals();
    if (totals.scored === 0) {
      els.roundTotal.textContent = "—";
      els.toPar.textContent = "E";
      return;
    }
    var toPar = totals.strokes - totals.parPlayed;
    els.roundTotal.textContent = String(totals.strokes);
    els.toPar.textContent =
      toPar === 0 ? "E" : toPar > 0 ? "+" + toPar : String(toPar);
  }

  function openScorePad() {
    var hole = currentHole();
    var score = getScore(hole.number);
    padDigits = score != null ? String(score) : "";
    els.padTitle.textContent = "Hole " + hole.number;
    els.padValue.textContent = padDigits || "—";
    els.scorePad.hidden = false;
  }

  function closeScorePad() {
    els.scorePad.hidden = true;
  }

  function commitPadScore() {
    var hole = currentHole();
    if (!padDigits) {
      setScore(hole.number, null);
    } else {
      var value = parseInt(padDigits, 10);
      if (!isNaN(value) && value >= 1 && value <= 15) {
        setScore(hole.number, value);
      }
    }
    closeScorePad();
    render();
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
        openScorePad();
      });
      els.scorecard.appendChild(btn);
    });
    renderTotals();
  }

  function render() {
    var hole = currentHole();
    var yards = teeYards(hole);
    var score = getScore(hole.number);

    els.courseName.textContent = course.name;
    els.holeLabel.textContent = "Hole " + hole.number + " · Par " + hole.par;
    els.holeScore.textContent = score != null ? String(score) : "—";
    els.holeMeta.textContent = "Hcp " + hole.handicap + " · " + yards + " yd";

    els.distanceMid.textContent = formatDistance(distanceYards(you, hole.middle));
    els.distanceFront.textContent = formatDistance(distanceYards(you, hole.front));
    els.distanceBack.textContent = formatDistance(distanceYards(you, hole.back));

    updateCollapseUi();
    renderScorecard();
  }

  function applyScore(value) {
    var hole = currentHole();
    if (value == null || value < 1) {
      setScore(hole.number, null);
    } else {
      setScore(hole.number, Math.min(15, value));
    }
    render();
  }

  function quickScore(action) {
    var hole = currentHole();
    var current = getScore(hole.number);
    var par = hole.par;

    if (action === "dec") {
      if (current == null) applyScore(par - 1);
      else if (current <= 1) applyScore(null);
      else applyScore(current - 1);
      return;
    }
    if (action === "inc") {
      if (current == null) applyScore(par + 1);
      else applyScore(current + 1);
      return;
    }
    if (action === "birdie") {
      applyScore(Math.max(1, par - 1));
      return;
    }
    if (action === "par") {
      applyScore(par);
      return;
    }
    if (action === "bogey") {
      applyScore(par + 1);
      return;
    }
    if (action === "double") {
      applyScore(par + 2);
    }
  }

  function cycleHole(step) {
    holeIndex = (holeIndex + step + course.holes.length) % course.holes.length;
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

  function buildPadKeys() {
    [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, ""].forEach(function (key) {
      if (key === "") {
        var spacer = document.createElement("span");
        els.padKeys.appendChild(spacer);
        return;
      }
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pad-key";
      btn.textContent = String(key);
      btn.addEventListener("click", function () {
        if (padDigits.length >= 2) return;
        padDigits += String(key);
        // Keep scores in a sensible golf range while typing
        var value = parseInt(padDigits, 10);
        if (value > 15) padDigits = "15";
        els.padValue.textContent = padDigits;
      });
      els.padKeys.appendChild(btn);
    });
  }

  els.prevHole.addEventListener("click", function () {
    cycleHole(-1);
  });
  els.nextHole.addEventListener("click", function () {
    cycleHole(1);
  });
  document.querySelectorAll("[data-score-action]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      quickScore(btn.getAttribute("data-score-action"));
    });
  });
  els.scorecardToggle.addEventListener("click", function () {
    scorecardCollapsed = !scorecardCollapsed;
    localStorage.setItem(COLLAPSE_KEY, scorecardCollapsed ? "1" : "0");
    updateCollapseUi();
  });
  els.clearRound.addEventListener("click", function () {
    if (!window.confirm("Clear all scores for this round?")) return;
    scores = {};
    saveScores();
    render();
  });
  els.holeScore.addEventListener("click", function () {
    openScorePad();
  });
  els.padClear.addEventListener("click", function () {
    padDigits = "";
    els.padValue.textContent = "—";
  });
  els.padDone.addEventListener("click", commitPadScore);
  els.scorePad.addEventListener("click", function (event) {
    if (event.target === els.scorePad) closeScorePad();
  });

  buildPadKeys();
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

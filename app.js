(function () {
  document.addEventListener(
    "touchmove",
    function (event) {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false }
  );
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (name) {
    document.addEventListener(name, function (event) {
      event.preventDefault();
    });
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
      if (now - lastTap <= 300) event.preventDefault();
      lastTap = now;
    },
    { passive: false }
  );

  var SCORE_KEY = "golf-gps-scores-olde-salem-greens";
  var COLLAPSE_KEY = "golf-gps-scorecard-collapsed";
  var TEE_KEY = "golf-gps-tee-olde-salem-greens";
  var HCP_KEY = "golf-gps-handicap-v2";
  var EARTH_RADIUS_YARDS = 6371000 / 0.9144;
  var IDLE_MS = 5 * 60 * 1000;

  var course = null;
  var holeIndex = 0;
  var selectedTee = localStorage.getItem(TEE_KEY) || "blue";
  var handicap18 = null;
  var handicapPlus = false;
  var you = null;
  var scores = {};
  var padDigits = "";
  var padReplaceOnType = false;
  var scorecardCollapsed = localStorage.getItem(COLLAPSE_KEY) === "1";
  var gpsWatchId = null;
  var gpsPaused = false;
  var idleTimer = null;
  var summaryShownForComplete = false;

  var els = {
    playView: document.getElementById("playView"),
    courseName: document.getElementById("courseName"),
    holeLabel: document.getElementById("holeLabel"),
    holeScore: document.getElementById("holeScore"),
    holeMeta: document.getElementById("holeMeta"),
    teeOpen: document.getElementById("teeOpen"),
    hcpOpen: document.getElementById("hcpOpen"),
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
    openSummary: document.getElementById("openSummary"),
    roundTotal: document.getElementById("roundTotal"),
    toPar: document.getElementById("toPar"),
    scorePad: document.getElementById("scorePad"),
    padTitle: document.getElementById("padTitle"),
    padValue: document.getElementById("padValue"),
    padKeys: document.getElementById("padKeys"),
    padClear: document.getElementById("padClear"),
    padDone: document.getElementById("padDone"),
    teePad: document.getElementById("teePad"),
    teeOptions: document.getElementById("teeOptions"),
    teeClose: document.getElementById("teeClose"),
    hcpPad: document.getElementById("hcpPad"),
    hcpInput: document.getElementById("hcpInput"),
    hcpSave: document.getElementById("hcpSave"),
    hcpClear: document.getElementById("hcpClear"),
    hcpClose: document.getElementById("hcpClose"),
    summaryView: document.getElementById("summaryView"),
    summaryCourse: document.getElementById("summaryCourse"),
    summaryTotal: document.getElementById("summaryTotal"),
    summaryToPar: document.getElementById("summaryToPar"),
    summaryHcp: document.getElementById("summaryHcp"),
    summaryHoles: document.getElementById("summaryHoles"),
    summaryShare: document.getElementById("summaryShare"),
    summaryClose: document.getElementById("summaryClose"),
    summaryNewRound: document.getElementById("summaryNewRound"),
  };

  function loadHandicap() {
    try {
      var raw = JSON.parse(localStorage.getItem(HCP_KEY) || "null");
      if (!raw || typeof raw.value !== "number") {
        handicap18 = null;
        handicapPlus = false;
        return;
      }
      handicap18 = Math.max(0, Math.min(54, Math.round(raw.value)));
      handicapPlus = !!raw.plus;
    } catch (e) {
      handicap18 = null;
      handicapPlus = false;
    }
  }

  function saveHandicap() {
    if (handicap18 == null) localStorage.removeItem(HCP_KEY);
    else
      localStorage.setItem(
        HCP_KEY,
        JSON.stringify({ value: handicap18, plus: handicapPlus })
      );
  }

  function hasHandicap() {
    return handicap18 != null && handicap18 > 0;
  }

  /** 9-hole strokes from 18-hole handicap. */
  function courseHandicap9() {
    if (!hasHandicap()) return 0;
    return Math.round(handicap18 / 2);
  }

  function strokesOnHole(hole) {
    var n = courseHandicap9();
    if (n <= 0) return 0;
    var full = Math.floor(n / 9);
    var rem = n % 9;
    if (!handicapPlus) {
      return full + (hole.handicap <= rem ? 1 : 0);
    }
    return full + (hole.handicap > 9 - rem ? 1 : 0);
  }

  function netScore(gross, hole) {
    if (gross == null) return null;
    var s = strokesOnHole(hole);
    return handicapPlus ? gross + s : gross - s;
  }

  function formatScore(gross, hole) {
    if (gross == null) return "—";
    var s = strokesOnHole(hole);
    if (!hasHandicap() || s === 0) return String(gross);
    return gross + " / " + netScore(gross, hole);
  }

  function holeStar(hole) {
    return hasHandicap() && strokesOnHole(hole) > 0 ? " ★" : "";
  }

  function haptic(ms) {
    if (navigator.vibrate) navigator.vibrate(ms || 12);
  }

  function pulseScore() {
    els.holeScore.classList.remove("is-pulse");
    void els.holeScore.offsetWidth;
    els.holeScore.classList.add("is-pulse");
  }

  function currentHole() {
    return course.holes[holeIndex];
  }

  function teeLabel(tee) {
    return tee.charAt(0).toUpperCase() + tee.slice(1) + " tees";
  }

  function teeYards(hole) {
    return hole.yards[selectedTee] || hole.yards[course.defaultTee] || hole.yards.blue;
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

  function formatToPar(diff) {
    if (diff === 0) return "E";
    return diff > 0 ? "+" + diff : String(diff);
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
    if (value == null) delete scores[holeNumber];
    else scores[holeNumber] = value;
    saveScores();
  }

  function roundTotals() {
    var strokes = 0;
    var net = 0;
    var scored = 0;
    var parPlayed = 0;
    course.holes.forEach(function (hole) {
      var score = getScore(hole.number);
      if (score != null) {
        strokes += score;
        net += netScore(score, hole);
        scored += 1;
        parPlayed += hole.par;
      }
    });
    return {
      strokes: strokes,
      net: net,
      scored: scored,
      parPlayed: parPlayed,
      complete: scored === course.holes.length,
      ch9: courseHandicap9(),
    };
  }

  function scoreClass(score, par) {
    if (score == null) return "";
    var diff = score - par;
    if (diff <= -2) return "score-eagle";
    if (diff === -1) return "score-birdie";
    if (diff === 0) return "score-par";
    if (diff === 1) return "score-bogey";
    return "score-over";
  }

  function bumpActivity() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!document.hidden) pauseGps("GPS paused (idle)");
    }, IDLE_MS);
    if (gpsPaused && !document.hidden) startGpsWatch();
  }

  function stopGpsWatch() {
    if (gpsWatchId != null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }
  }

  function pauseGps(message) {
    gpsPaused = true;
    stopGpsWatch();
    if (message) setStatus(message);
  }

  function startGpsWatch() {
    if (!navigator.geolocation) {
      setStatus("GPS not supported in this browser.");
      return;
    }
    stopGpsWatch();
    gpsPaused = false;
    setStatus("Getting GPS…");
    gpsWatchId = navigator.geolocation.watchPosition(onPosition, onGpsError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000,
    });
  }

  function setStatus(text) {
    els.status.textContent = text;
  }

  function updateCollapseUi() {
    els.scorecardSection.classList.toggle("is-collapsed", scorecardCollapsed);
    els.scorecardChevron.textContent = scorecardCollapsed ? "▸" : "▾";
  }

  function updateTeeButton() {
    els.teeOpen.textContent = teeLabel(selectedTee);
  }

  function updateHcpButton() {
    if (!hasHandicap()) {
      els.hcpOpen.textContent = "HCP —";
      return;
    }
    var sign = handicapPlus ? "+" : "−";
    els.hcpOpen.textContent =
      "HCP " + sign + handicap18 + " · " + courseHandicap9() + " strokes";
  }

  function updateHcpSignButtons() {
    document.querySelectorAll("[data-hcp-sign]").forEach(function (btn) {
      var plus = btn.getAttribute("data-hcp-sign") === "plus";
      btn.classList.toggle("is-active", plus === handicapPlus);
    });
  }

  function openHcpPad() {
    els.hcpInput.value = handicap18 != null ? String(handicap18) : "";
    updateHcpSignButtons();
    els.hcpPad.hidden = false;
    setTimeout(function () {
      els.hcpInput.focus();
    }, 50);
  }

  function closeHcpPad() {
    els.hcpPad.hidden = true;
  }

  function renderTeeOptions() {
    els.teeOptions.innerHTML = "";
    Object.keys(course.tees).forEach(function (tee) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tee-option" + (tee === selectedTee ? " is-active" : "");
      var info = course.tees[tee];
      btn.textContent =
        tee.charAt(0).toUpperCase() +
        tee.slice(1) +
        " · " +
        info.yards +
        " yd";
      btn.addEventListener("click", function () {
        selectedTee = tee;
        localStorage.setItem(TEE_KEY, selectedTee);
        haptic(8);
        renderTeeOptions();
        render();
      });
      els.teeOptions.appendChild(btn);
    });
  }

  function openTeePad() {
    renderTeeOptions();
    els.teePad.hidden = false;
  }

  function closeTeePad() {
    els.teePad.hidden = true;
  }

  function renderTotals() {
    var totals = roundTotals();
    if (totals.scored === 0) {
      els.roundTotal.textContent = "—";
      els.toPar.textContent = "E";
    } else if (hasHandicap()) {
      els.roundTotal.textContent = totals.strokes + " / " + totals.net;
      els.toPar.textContent =
        formatToPar(totals.strokes - totals.parPlayed) +
        " / " +
        formatToPar(totals.net - totals.parPlayed);
    } else {
      els.roundTotal.textContent = String(totals.strokes);
      els.toPar.textContent = formatToPar(totals.strokes - totals.parPlayed);
    }
    els.openSummary.hidden = totals.scored === 0;
    if (totals.complete && !summaryShownForComplete) {
      summaryShownForComplete = true;
      openSummary();
    }
  }

  function openScorePad() {
    var hole = currentHole();
    var score = getScore(hole.number);
    padDigits = score != null ? String(score) : "";
    padReplaceOnType = score != null;
    els.padTitle.textContent = "Hole " + hole.number;
    els.padValue.textContent = padDigits || "—";
    els.scorePad.hidden = false;
  }

  function closeScorePad() {
    els.scorePad.hidden = true;
  }

  function commitPadScore() {
    var hole = currentHole();
    if (!padDigits) setScore(hole.number, null);
    else {
      var value = parseInt(padDigits, 10);
      if (!isNaN(value) && value >= 1 && value <= 15) setScore(hole.number, value);
    }
    closeScorePad();
    haptic(14);
    pulseScore();
    render();
    if (!els.summaryView.hidden) openSummary();
  }

  function renderScorecard() {
    els.scorecard.innerHTML = "";
    course.holes.forEach(function (hole, index) {
      var score = getScore(hole.number);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "hole-cell" +
        (index === holeIndex ? " is-active" : "") +
        " " +
        scoreClass(score, hole.par);
      btn.innerHTML =
        '<span class="hole-cell-num">Hole ' +
        hole.number +
        holeStar(hole) +
        "</span>" +
        '<span class="hole-cell-score">' +
        formatScore(score, hole) +
        "</span>" +
        '<span class="hole-cell-par">Par ' +
        hole.par +
        " · " +
        teeYards(hole) +
        "y</span>";
      btn.addEventListener("click", function () {
        holeIndex = index;
        haptic(8);
        render();
        openScorePad();
      });
      els.scorecard.appendChild(btn);
    });
    renderTotals();
  }

  function render() {
    if (!course) return;
    var hole = currentHole();
    var yards = teeYards(hole);
    var score = getScore(hole.number);

    els.courseName.textContent = course.name;
    els.holeLabel.textContent =
      "Hole " + hole.number + holeStar(hole) + " · Par " + hole.par;
    els.holeScore.textContent = formatScore(score, hole);
    els.holeScore.className =
      "hole-score" + (score != null ? " " + scoreClass(score, hole.par) : "");
    els.holeMeta.textContent = "Hcp " + hole.handicap + " · " + yards + " yd";
    updateTeeButton();
    updateHcpButton();

    els.distanceMid.textContent = formatDistance(distanceYards(you, hole.middle));
    els.distanceFront.textContent = formatDistance(distanceYards(you, hole.front));
    els.distanceBack.textContent = formatDistance(distanceYards(you, hole.back));

    updateCollapseUi();
    renderScorecard();
  }

  function applyScore(value) {
    var hole = currentHole();
    if (value == null || value < 1) setScore(hole.number, null);
    else setScore(hole.number, Math.min(15, value));
    haptic(12);
    pulseScore();
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
      applyScore(current == null ? par + 1 : current + 1);
      return;
    }
    if (action === "birdie") applyScore(Math.max(1, par - 1));
    else if (action === "par") applyScore(par);
    else if (action === "bogey") applyScore(par + 1);
    else if (action === "double") applyScore(par + 2);
  }

  function cycleHole(step) {
    holeIndex = (holeIndex + step + course.holes.length) % course.holes.length;
    haptic(8);
    render();
  }

  function onPosition(pos) {
    you = { lat: pos.coords.latitude, lon: pos.coords.longitude };
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

  function openSummary() {
    var totals = roundTotals();
    els.summaryCourse.textContent = course.name;
    if (!totals.scored) {
      els.summaryTotal.textContent = "—";
      els.summaryToPar.textContent = "E";
    } else if (hasHandicap()) {
      els.summaryTotal.textContent = totals.strokes + " / " + totals.net;
      els.summaryToPar.textContent =
        formatToPar(totals.strokes - totals.parPlayed) +
        " / " +
        formatToPar(totals.net - totals.parPlayed);
    } else {
      els.summaryTotal.textContent = String(totals.strokes);
      els.summaryToPar.textContent = formatToPar(totals.strokes - totals.parPlayed);
    }

    if (hasHandicap()) {
      els.summaryHcp.hidden = false;
      els.summaryHcp.textContent =
        (handicapPlus ? "+" : "−") +
        handicap18 +
        " (18) · " +
        courseHandicap9() +
        " strokes this 9";
    } else {
      els.summaryHcp.hidden = true;
    }

    els.summaryHoles.innerHTML = "";
    var runScore = 0;
    var runNet = 0;
    var runPar = 0;
    course.holes.forEach(function (hole, index) {
      var score = getScore(hole.number);
      var net = netScore(score, hole);
      if (score != null) {
        runScore += score;
        runNet += net;
        runPar += hole.par;
      }
      var holeToPar =
        score == null
          ? "—"
          : hasHandicap()
            ? formatToPar(score - hole.par) + " / " + formatToPar(net - hole.par)
            : formatToPar(score - hole.par);
      var runTotal =
        score == null
          ? "—"
          : hasHandicap()
            ? runScore + " / " + runNet
            : String(runScore);
      var runToPar =
        score == null
          ? "—"
          : hasHandicap()
            ? formatToPar(runScore - runPar) +
              " / " +
              formatToPar(runNet - runPar)
            : formatToPar(runScore - runPar);
      var row = document.createElement("button");
      row.type = "button";
      row.className = "summary-row " + scoreClass(score, hole.par);
      row.innerHTML =
        '<div class="summary-main">' +
        "<strong>Hole " +
        hole.number +
        holeStar(hole) +
        "</strong>" +
        "<span>Par " +
        hole.par +
        "</span>" +
        "</div>" +
        '<div class="summary-nums">' +
        '<span class="summary-hole-nums">' +
        "<span>" +
        formatScore(score, hole) +
        "</span>" +
        "<span>" +
        holeToPar +
        "</span>" +
        "</span>" +
        '<span class="summary-run-nums">' +
        "<span>" +
        runTotal +
        "</span>" +
        "<span>" +
        runToPar +
        "</span>" +
        "</span>" +
        "</div>";
      row.addEventListener("click", function () {
        holeIndex = index;
        haptic(8);
        render();
        openScorePad();
      });
      els.summaryHoles.appendChild(row);
    });

    els.playView.hidden = true;
    els.summaryView.hidden = false;
    haptic(20);
  }

  function closeSummary() {
    els.summaryView.hidden = true;
    els.playView.hidden = false;
  }

  function summaryText() {
    var totals = roundTotals();
    var lines = [course.name];
    if (hasHandicap()) {
      lines.push(
        "Gross " +
          totals.strokes +
          " / Net " +
          totals.net +
          " · HCP " +
          (handicapPlus ? "+" : "−") +
          handicap18 +
          " · " +
          courseHandicap9() +
          " strokes"
      );
    } else {
      lines.push(
        "Total " +
          totals.strokes +
          " (" +
          formatToPar(totals.strokes - totals.parPlayed) +
          ")"
      );
    }
    lines.push("");
    var runScore = 0;
    var runNet = 0;
    var runPar = 0;
    course.holes.forEach(function (hole) {
      var score = getScore(hole.number);
      var net = netScore(score, hole);
      if (score != null) {
        runScore += score;
        runNet += net;
        runPar += hole.par;
      }
      var holeLine =
        "Hole " +
        hole.number +
        holeStar(hole) +
        "  Par " +
        hole.par +
        "  " +
        formatScore(score, hole);
      if (score != null) {
        holeLine +=
          "  " +
          (hasHandicap()
            ? formatToPar(score - hole.par) +
              " / " +
              formatToPar(net - hole.par)
            : formatToPar(score - hole.par));
        holeLine +=
          "  running " +
          (hasHandicap()
            ? runScore +
              " / " +
              runNet +
              " (" +
              formatToPar(runScore - runPar) +
              " / " +
              formatToPar(runNet - runPar) +
              ")"
            : runScore + " (" + formatToPar(runScore - runPar) + ")");
      }
      lines.push(holeLine);
    });
    return lines.join("\n");
  }

  function clearRound() {
    scores = {};
    saveScores();
    summaryShownForComplete = false;
    render();
  }

  function buildPadKeys() {
    [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, ""].forEach(function (key) {
      if (key === "") {
        els.padKeys.appendChild(document.createElement("span"));
        return;
      }
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pad-key";
      btn.textContent = String(key);
      btn.addEventListener("click", function () {
        if (padReplaceOnType) {
          padDigits = String(key);
          padReplaceOnType = false;
        } else {
          if (padDigits.length >= 2) return;
          padDigits += String(key);
        }
        if (parseInt(padDigits, 10) > 15) padDigits = "15";
        els.padValue.textContent = padDigits;
        haptic(6);
      });
      els.padKeys.appendChild(btn);
    });
  }

  els.prevHole.addEventListener("click", function () {
    bumpActivity();
    cycleHole(-1);
  });
  els.nextHole.addEventListener("click", function () {
    bumpActivity();
    cycleHole(1);
  });
  document.querySelectorAll("[data-score-action]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      bumpActivity();
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
    clearRound();
    haptic(16);
  });
  els.openSummary.addEventListener("click", openSummary);
  els.holeScore.addEventListener("click", function () {
    bumpActivity();
    openScorePad();
  });
  els.teeOpen.addEventListener("click", function () {
    bumpActivity();
    openTeePad();
  });
  els.teeClose.addEventListener("click", closeTeePad);
  els.teePad.addEventListener("click", function (event) {
    if (event.target === els.teePad) closeTeePad();
  });
  els.hcpOpen.addEventListener("click", function () {
    bumpActivity();
    openHcpPad();
  });
  els.hcpClose.addEventListener("click", closeHcpPad);
  els.hcpPad.addEventListener("click", function (event) {
    if (event.target === els.hcpPad) closeHcpPad();
  });
  document.querySelectorAll("[data-hcp-sign]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      handicapPlus = btn.getAttribute("data-hcp-sign") === "plus";
      updateHcpSignButtons();
      haptic(6);
    });
  });
  els.hcpSave.addEventListener("click", function () {
    var value = parseInt(els.hcpInput.value, 10);
    if (els.hcpInput.value.trim() === "" || isNaN(value)) {
      handicap18 = null;
      handicapPlus = false;
    } else {
      handicap18 = Math.max(0, Math.min(54, value));
    }
    saveHandicap();
    haptic(12);
    closeHcpPad();
    render();
    if (!els.summaryView.hidden) openSummary();
  });
  els.hcpClear.addEventListener("click", function () {
    handicap18 = null;
    handicapPlus = false;
    saveHandicap();
    els.hcpInput.value = "";
    haptic(8);
    closeHcpPad();
    render();
    if (!els.summaryView.hidden) openSummary();
  });
  els.padClear.addEventListener("click", function () {
    padDigits = "";
    padReplaceOnType = false;
    els.padValue.textContent = "—";
    haptic(8);
  });
  els.padDone.addEventListener("click", commitPadScore);
  els.scorePad.addEventListener("click", function (event) {
    if (event.target === els.scorePad) closeScorePad();
  });
  els.summaryClose.addEventListener("click", closeSummary);
  els.summaryNewRound.addEventListener("click", function () {
    if (!window.confirm("Start a new round and clear scores?")) return;
    clearRound();
    closeSummary();
    haptic(16);
  });
  els.summaryShare.addEventListener("click", function () {
    var text = summaryText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          els.summaryShare.textContent = "Copied";
          haptic(10);
          setTimeout(function () {
            els.summaryShare.textContent = "Copy summary";
          }, 1200);
        },
        function () {
          window.prompt("Copy summary:", text);
        }
      );
    } else {
      window.prompt("Copy summary:", text);
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pauseGps("GPS paused");
    else {
      bumpActivity();
      startGpsWatch();
    }
  });
  ["pointerdown", "touchstart", "keydown"].forEach(function (name) {
    document.addEventListener(name, bumpActivity, { passive: true });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  buildPadKeys();
  loadScores();
  loadHandicap();
  if (["gold", "blue", "white", "red"].indexOf(selectedTee) === -1) {
    selectedTee = "blue";
  }

  fetch("data/olde-salem-greens.json")
    .then(function (res) {
      if (!res.ok) throw new Error("Could not load course data");
      return res.json();
    })
    .then(function (data) {
      course = data;
      if (!course.tees[selectedTee]) selectedTee = course.defaultTee || "blue";
      render();
      startGpsWatch();
      bumpActivity();
    })
    .catch(function () {
      setStatus("Could not load course JSON.");
    });
})();

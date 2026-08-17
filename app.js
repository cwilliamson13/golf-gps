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
          "button, a, input, label, select, [role='button'], .hole-score"
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
  var TEE_KEY = "golf-gps-tee-olde-salem-greens";
  var HCP_KEY = "golf-gps-handicap-v2";
  var ROUND_KEY = "golf-gps-round-v1";
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
  var gpsWatchId = null;
  var gpsPaused = false;
  var idleTimer = null;
  var summaryShownForComplete = false;
  var pagerPage = 0;
  var draftPlayers = [];
  var multiDraft = {};
  var draftTeamsEnabled = false;
  var draftTeamRandom = "manual";

  var roundState = {
    gameType: "none",
    mePlayerId: "p1",
    players: [],
    scores: {},
    hammers: {},
    teamsEnabled: false,
    teamRandom: "manual",
    teamsDrawn: false,
    updatedAt: 0,
  };

  var els = {
    appPager: document.getElementById("appPager"),
    pagerTrack: document.getElementById("pagerTrack"),
    playView: document.getElementById("playView"),
    gameView: document.getElementById("gameView"),
    pagerHint: document.getElementById("pagerHint"),
    courseName: document.getElementById("courseName"),
    holeLabel: document.getElementById("holeLabel"),
    holeScore: document.getElementById("holeScore"),
    holeMeta: document.getElementById("holeMeta"),
    teeOpen: document.getElementById("teeOpen"),
    hcpOpen: document.getElementById("hcpOpen"),
    settingsOpen: document.getElementById("settingsOpen"),
    distanceMid: document.getElementById("distanceMid"),
    distanceFront: document.getElementById("distanceFront"),
    distanceBack: document.getElementById("distanceBack"),
    status: document.getElementById("status"),
    prevHole: document.getElementById("prevHole"),
    nextHole: document.getElementById("nextHole"),
    scorecard: document.getElementById("scorecard"),
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
    settingsPad: document.getElementById("settingsPad"),
    gameTypeSelect: document.getElementById("gameTypeSelect"),
    gameSettingsBlock: document.getElementById("gameSettingsBlock"),
    playerCountInput: document.getElementById("playerCountInput"),
    playerCountDec: document.getElementById("playerCountDec"),
    playerCountInc: document.getElementById("playerCountInc"),
    playersEditor: document.getElementById("playersEditor"),
    mePlayerSelect: document.getElementById("mePlayerSelect"),
    teamsEnabled: document.getElementById("teamsEnabled"),
    teamsOptions: document.getElementById("teamsOptions"),
    shuffleTeamsBtn: document.getElementById("shuffleTeamsBtn"),
    settingsClose: document.getElementById("settingsClose"),
    settingsSave: document.getElementById("settingsSave"),
    gameBackPlay: document.getElementById("gameBackPlay"),
    gameSettingsOpen: document.getElementById("gameSettingsOpen"),
    gameTitle: document.getElementById("gameTitle"),
    gameHoleLabel: document.getElementById("gameHoleLabel"),
    gameHammerStatus: document.getElementById("gameHammerStatus"),
    enterScoresBtn: document.getElementById("enterScoresBtn"),
    gameActions: document.getElementById("gameActions"),
    gameHammerBtn: document.getElementById("gameHammerBtn"),
    drawTeamsBtn: document.getElementById("drawTeamsBtn"),
    gameBoard: document.getElementById("gameBoard"),
    gameTeamsLabel: document.getElementById("gameTeamsLabel"),
    multiScorePad: document.getElementById("multiScorePad"),
    multiPadTitle: document.getElementById("multiPadTitle"),
    multiScoreList: document.getElementById("multiScoreList"),
    multiPadClose: document.getElementById("multiPadClose"),
    multiPadDone: document.getElementById("multiPadDone"),
    summaryView: document.getElementById("summaryView"),
    summaryCourse: document.getElementById("summaryCourse"),
    summaryTotal: document.getElementById("summaryTotal"),
    summaryToPar: document.getElementById("summaryToPar"),
    summaryHcp: document.getElementById("summaryHcp"),
    summaryHoles: document.getElementById("summaryHoles"),
    summaryShare: document.getElementById("summaryShare"),
    summaryClose: document.getElementById("summaryClose"),
    summaryBack: document.getElementById("summaryBack"),
    summaryNewRound: document.getElementById("summaryNewRound"),
  };

  function isMultiMode() {
    return (
      roundState.gameType === "track" ||
      roundState.gameType === "stroke" ||
      roundState.gameType === "hammer"
    );
  }

  function inGameMode() {
    return isMultiMode();
  }

  function isCompetitive() {
    return roundState.gameType === "stroke" || roundState.gameType === "hammer";
  }

  function uid() {
    return "p" + Math.random().toString(36).slice(2, 8);
  }

  function defaultPlayers(count) {
    var list = [];
    for (var i = 0; i < count; i++) {
      list.push({
        id: "p" + (i + 1),
        name: i === 0 ? "Me" : "Player " + (i + 1),
        handicap18: null,
        handicapPlus: false,
        team: i % 2 === 0 ? "A" : "B",
      });
    }
    return list;
  }

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function assignRandomTeams(players) {
    var shuffled = shuffleArray(players);
    var half = Math.ceil(shuffled.length / 2);
    shuffled.forEach(function (p, i) {
      p.team = i < half ? "A" : "B";
    });
    return players;
  }

  function teamLabel(team) {
    return team === "B" ? "Team B" : "Team A";
  }

  function loadRoundState() {
    try {
      var raw = JSON.parse(localStorage.getItem(ROUND_KEY) || "null");
      if (!raw || typeof raw !== "object") return;
      roundState.gameType = raw.gameType || "none";
      roundState.mePlayerId = raw.mePlayerId || "p1";
      roundState.players = Array.isArray(raw.players) ? raw.players : [];
      roundState.scores = raw.scores || {};
      roundState.hammers = raw.hammers || {};
      roundState.teamsEnabled = !!raw.teamsEnabled;
      roundState.teamRandom = raw.teamRandom || "manual";
      roundState.teamsDrawn = !!raw.teamsDrawn;
      roundState.updatedAt = raw.updatedAt || 0;
      if (typeof raw.holeIndex === "number") holeIndex = raw.holeIndex;
    } catch (e) {}
  }

  function persistRoundLocal() {
    localStorage.setItem(
      ROUND_KEY,
      JSON.stringify({
        gameType: roundState.gameType,
        mePlayerId: roundState.mePlayerId,
        players: roundState.players,
        scores: roundState.scores,
        hammers: roundState.hammers,
        teamsEnabled: roundState.teamsEnabled,
        teamRandom: roundState.teamRandom,
        teamsDrawn: roundState.teamsDrawn,
        holeIndex: holeIndex,
        updatedAt: Date.now(),
        tee: selectedTee,
      })
    );
  }

  function saveRoundAndSync() {
    persistRoundLocal();
  }

  function applyRemoteRound() {}

  function syncMeScoresFromRound() {
    if (!inGameMode()) return;
    var mine = roundState.scores[roundState.mePlayerId] || {};
    scores = {};
    Object.keys(mine).forEach(function (h) {
      scores[h] = mine[h];
    });
    saveScores();
    var me = getMePlayer();
    if (me) {
      handicap18 = me.handicap18;
      handicapPlus = !!me.handicapPlus;
    }
  }

  function pushMeScoreToRound(holeNumber, value) {
    if (!inGameMode()) return;
    var pid = roundState.mePlayerId;
    if (!roundState.scores[pid]) roundState.scores[pid] = {};
    if (value == null) delete roundState.scores[pid][holeNumber];
    else roundState.scores[pid][holeNumber] = value;
    saveRoundAndSync();
  }

  function getMePlayer() {
    for (var i = 0; i < roundState.players.length; i++) {
      if (roundState.players[i].id === roundState.mePlayerId) {
        return roundState.players[i];
      }
    }
    return roundState.players[0] || null;
  }

  function playerHcp(player) {
    return player && player.handicap18 != null && player.handicap18 > 0;
  }

  function courseHandicap9For(player) {
    if (!playerHcp(player)) return 0;
    return Math.round(player.handicap18 / 2);
  }

  function strokesOnHoleFor(player, hole) {
    var n = courseHandicap9For(player);
    if (n <= 0) return 0;
    var full = Math.floor(n / 9);
    var rem = n % 9;
    if (!player.handicapPlus) return full + (hole.handicap <= rem ? 1 : 0);
    return full + (hole.handicap > 9 - rem ? 1 : 0);
  }

  function netScoreFor(player, gross, hole) {
    if (gross == null) return null;
    var s = strokesOnHoleFor(player, hole);
    return player.handicapPlus ? gross + s : gross - s;
  }

  function getPlayerScore(playerId, holeNumber) {
    var map = roundState.scores[playerId] || {};
    var value = map[holeNumber];
    return typeof value === "number" ? value : null;
  }

  function setPlayerScore(playerId, holeNumber, value) {
    if (!roundState.scores[playerId]) roundState.scores[playerId] = {};
    if (value == null) delete roundState.scores[playerId][holeNumber];
    else roundState.scores[playerId][holeNumber] = value;
    if (playerId === roundState.mePlayerId) {
      if (value == null) delete scores[holeNumber];
      else scores[holeNumber] = value;
      saveScores();
    }
    saveRoundAndSync();
  }

  function allPlayersScoredHole(holeNumber) {
    if (!roundState.players.length) return false;
    return roundState.players.every(function (p) {
      return getPlayerScore(p.id, holeNumber) != null;
    });
  }

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
    if (inGameMode()) {
      var me = getMePlayer();
      if (me) {
        me.handicap18 = handicap18;
        me.handicapPlus = handicapPlus;
        saveRoundAndSync();
      }
    }
  }

  function hasHandicap() {
    return handicap18 != null && handicap18 > 0;
  }

  function courseHandicap9() {
    if (!hasHandicap()) return 0;
    return Math.round(handicap18 / 2);
  }

  function strokesOnHole(hole) {
    var n = courseHandicap9();
    if (n <= 0) return 0;
    var full = Math.floor(n / 9);
    var rem = n % 9;
    if (!handicapPlus) return full + (hole.handicap <= rem ? 1 : 0);
    return full + (hole.handicap > 9 - rem ? 1 : 0);
  }

  function netScore(gross, hole) {
    if (gross == null) return null;
    var s = strokesOnHole(hole);
    return handicapPlus ? gross + s : gross - s;
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
    pushMeScoreToRound(holeNumber, value);
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

  function scoreClassFromDiff(diff) {
    if (diff <= -2) return "score-eagle";
    if (diff === -1) return "score-birdie";
    if (diff === 0) return "score-par";
    if (diff === 1) return "score-bogey";
    return "score-over";
  }

  function scoreClass(score, par) {
    if (score == null) return "";
    return scoreClassFromDiff(score - par);
  }

  function formatScore(gross, hole) {
    if (gross == null) return "—";
    var s = strokesOnHole(hole);
    if (!hasHandicap() || s === 0) return String(gross);
    return gross + " / " + netScore(gross, hole);
  }

  function formatScoreHtml(gross, hole) {
    if (gross == null) return "—";
    var s = strokesOnHole(hole);
    var grossHtml =
      '<span class="score-part ' +
      scoreClass(gross, hole.par) +
      '">' +
      gross +
      "</span>";
    if (!hasHandicap() || s === 0) return grossHtml;
    var net = netScore(gross, hole);
    return (
      grossHtml +
      ' / <span class="score-part ' +
      scoreClass(net, hole.par) +
      '">' +
      net +
      "</span>"
    );
  }

  function formatPlayerScoreHtml(player, gross, hole) {
    if (gross == null) return "—";
    var s = strokesOnHoleFor(player, hole);
    var grossHtml =
      '<span class="score-part ' +
      scoreClass(gross, hole.par) +
      '">' +
      gross +
      "</span>";
    if (!playerHcp(player) || s === 0) return grossHtml;
    var net = netScoreFor(player, gross, hole);
    return (
      grossHtml +
      ' / <span class="score-part ' +
      scoreClass(net, hole.par) +
      '">' +
      net +
      "</span>"
    );
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

  function updateCollapseUi() {}

  function updateTeeButton() {
    els.teeOpen.textContent = teeLabel(selectedTee);
  }

  function updateHcpButton() {
    els.hcpOpen.hidden = isMultiMode();
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

  function updatePagerMode() {
    var multi = isMultiMode();
    els.enterScoresBtn.hidden = !multi;
    els.appPager.classList.add("has-game");
    els.scorecard.hidden = multi;
    els.gameBoard.hidden = !multi;
    els.gameHoleLabel.hidden = false;
    els.pagerHint.textContent = multi
      ? "Swipe for scoreboard →"
      : "Swipe for scorecard →";

    if (roundState.gameType === "hammer") els.gameTitle.textContent = "Hammer";
    else if (roundState.gameType === "stroke")
      els.gameTitle.textContent = "Stroke Play";
    else if (roundState.gameType === "track")
      els.gameTitle.textContent = "Track Scores";
    else els.gameTitle.textContent = "Scorecard";

    var showHammer = roundState.gameType === "hammer";
    var showDraw =
      multi &&
      roundState.teamsEnabled &&
      roundState.teamRandom === "end" &&
      !roundState.teamsDrawn;
    els.gameHammerBtn.hidden = !showHammer;
    els.drawTeamsBtn.hidden = !showDraw;
    els.gameActions.hidden = !(showHammer || showDraw);
    updateTeamsLabel();
  }

  function updateTeamsLabel() {
    if (!els.gameTeamsLabel) return;
    if (!isMultiMode() || !roundState.teamsEnabled) {
      els.gameTeamsLabel.hidden = true;
      return;
    }
    if (roundState.teamRandom === "end" && !roundState.teamsDrawn) {
      els.gameTeamsLabel.hidden = false;
      els.gameTeamsLabel.textContent = "Teams: random draw at end";
      return;
    }
    var a = [];
    var b = [];
    roundState.players.forEach(function (p) {
      if (p.team === "B") b.push(p.name || p.id);
      else a.push(p.name || p.id);
    });
    els.gameTeamsLabel.hidden = false;
    els.gameTeamsLabel.textContent =
      "A: " + (a.join(", ") || "—") + " · B: " + (b.join(", ") || "—");
  }

  function setPagerPage(page) {
    pagerPage = page ? 1 : 0;
    els.pagerTrack.style.transform = "translateX(" + pagerPage * -50 + "%)";
    els.appPager.classList.toggle("on-game", pagerPage === 1);
    if (pagerPage === 1) {
      if (isMultiMode()) renderGameBoard();
      else renderScorecard();
    }
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
    if (!course) return;
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
        saveRoundAndSync();
        render();
      });
      els.teeOptions.appendChild(btn);
    });
  }

  function openTeePad() {
    if (!course) return;
    renderTeeOptions();
    els.teePad.hidden = false;
  }

  function closeTeePad() {
    els.teePad.hidden = true;
  }

  function renderPlayersEditor() {
    els.playersEditor.innerHTML = "";
    draftPlayers.forEach(function (p, index) {
      var row = document.createElement("div");
      row.className = "player-edit-row";
      var minusActive = !p.handicapPlus ? " is-active" : "";
      var plusActive = p.handicapPlus ? " is-active" : "";
      var teamA = !p.team || p.team === "A" ? " is-active" : "";
      var teamB = p.team === "B" ? " is-active" : "";
      var teamBlock = draftTeamsEnabled
        ? '<div class="hcp-sign player-inline-sign" role="group" aria-label="Team">' +
          '<button type="button" class="hcp-sign-btn' +
          teamA +
          '" data-pi="' +
          index +
          '" data-player-team="A">A</button>' +
          '<button type="button" class="hcp-sign-btn' +
          teamB +
          '" data-pi="' +
          index +
          '" data-player-team="B">B</button>' +
          "</div>"
        : "";
      row.innerHTML =
        '<input class="hcp-input player-name-input" data-pi="' +
        index +
        '" type="text" maxlength="16" value="' +
        (p.name || "").replace(/"/g, "&quot;") +
        '" placeholder="Name" />' +
        '<div class="hcp-sign player-inline-sign" role="group" aria-label="Handicap type">' +
        '<button type="button" class="hcp-sign-btn' +
        minusActive +
        '" data-pi="' +
        index +
        '" data-player-hcp-sign="minus">−</button>' +
        '<button type="button" class="hcp-sign-btn' +
        plusActive +
        '" data-pi="' +
        index +
        '" data-player-hcp-sign="plus">+</button>' +
        "</div>" +
        '<input class="hcp-input player-hcp-input" data-pi="' +
        index +
        '" type="number" inputmode="numeric" min="0" max="54" placeholder="HCP" value="' +
        (p.handicap18 != null ? p.handicap18 : "") +
        '" />' +
        teamBlock;
      els.playersEditor.appendChild(row);
    });
    els.mePlayerSelect.innerHTML = "";
    draftPlayers.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      if (p.id === roundState.mePlayerId) opt.selected = true;
      els.mePlayerSelect.appendChild(opt);
    });
  }

  function readDraftPlayersFromDom() {
    draftPlayers.forEach(function (p, index) {
      var nameEl = els.playersEditor.querySelector(
        '.player-name-input[data-pi="' + index + '"]'
      );
      var hcpEl = els.playersEditor.querySelector(
        '.player-hcp-input[data-pi="' + index + '"]'
      );
      var plusBtn = els.playersEditor.querySelector(
        '.hcp-sign-btn.is-active[data-pi="' +
          index +
          '"][data-player-hcp-sign="plus"]'
      );
      var teamB = els.playersEditor.querySelector(
        '.hcp-sign-btn.is-active[data-pi="' +
          index +
          '"][data-player-team="B"]'
      );
      if (nameEl) p.name = nameEl.value.trim() || "Player " + (index + 1);
      p.handicapPlus = !!plusBtn;
      if (draftTeamsEnabled) p.team = teamB ? "B" : "A";
      if (hcpEl) {
        var v = parseInt(hcpEl.value, 10);
        p.handicap18 =
          hcpEl.value.trim() === "" || isNaN(v)
            ? null
            : Math.max(0, Math.min(54, v));
      }
    });
  }

  function updateTeamsSettingsUi() {
    draftTeamsEnabled = !!els.teamsEnabled.checked;
    els.teamsOptions.hidden = !draftTeamsEnabled;
    document.querySelectorAll("[data-team-random]").forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        btn.getAttribute("data-team-random") === draftTeamRandom
      );
    });
    els.shuffleTeamsBtn.hidden =
      !draftTeamsEnabled || draftTeamRandom === "end";
    renderPlayersEditor();
  }

  function clampPlayerCount(n) {
    if (isNaN(n)) return 2;
    return Math.max(2, Math.min(5, Math.round(n)));
  }

  function resizeDraftPlayers(count) {
    count = clampPlayerCount(count);
    readDraftPlayersFromDom();
    while (draftPlayers.length < count) {
      draftPlayers.push({
        id: uid(),
        name: "Player " + (draftPlayers.length + 1),
        handicap18: null,
        handicapPlus: false,
        team: draftPlayers.length % 2 === 0 ? "A" : "B",
      });
    }
    draftPlayers = draftPlayers.slice(0, count);
    els.playerCountInput.value = String(count);
    renderPlayersEditor();
  }

  function updateSettingsGameVisibility() {
    var t = els.gameTypeSelect.value;
    els.gameSettingsBlock.hidden = t === "none";
    updateSettingsSaveLabel();
  }

  function updateSyncSettingsUi() {
    var on = !!els.syncEnabled.checked;
    els.syncControls.hidden = !on;
    if (!on && roundState.roomCode) {
      if (window.GolfGpsSync) GolfGpsSync.disconnect();
      roundState.roomCode = null;
      roundState.syncEnabled = false;
      persistRoundLocal();
      updateRoomUi();
      updatePagerMode();
    }
  }

  function updateSettingsSaveLabel() {
    var selected = els.gameTypeSelect.value;
    if (selected !== "none" && !isMultiMode()) {
      els.settingsSave.textContent = "Create game";
    } else {
      els.settingsSave.textContent = "Save";
    }
  }

  function openSettingsPad() {
    els.gameTypeSelect.value = roundState.gameType || "none";
    if (!roundState.players.length) {
      draftPlayers = defaultPlayers(2);
    } else {
      draftPlayers = roundState.players.map(function (p) {
        return {
          id: p.id,
          name: p.name,
          handicap18: p.handicap18,
          handicapPlus: !!p.handicapPlus,
          team: p.team === "B" ? "B" : "A",
        };
      });
    }
    els.playerCountInput.value = String(
      clampPlayerCount(Math.max(2, draftPlayers.length))
    );
    els.teamsEnabled.checked = !!roundState.teamsEnabled;
    draftTeamsEnabled = !!roundState.teamsEnabled;
    draftTeamRandom = roundState.teamRandom || "manual";
    updateTeamsSettingsUi();
    updateSettingsGameVisibility();
    updateSettingsSaveLabel();
    els.settingsPad.hidden = false;
  }

  function closeSettingsPad() {
    els.settingsPad.hidden = true;
  }

  function saveSettingsFromPad() {
    var type = els.gameTypeSelect.value;
    if (type === "none") {
      roundState.gameType = "none";
      roundState.players = [];
      roundState.scores = {};
      roundState.hammers = {};
      roundState.teamsEnabled = false;
      roundState.teamRandom = "manual";
      roundState.teamsDrawn = false;
      persistRoundLocal();
      updatePagerMode();
      closeSettingsPad();
      render();
      return;
    }

    readDraftPlayersFromDom();
    var count = clampPlayerCount(parseInt(els.playerCountInput.value, 10) || 2);
    while (draftPlayers.length < count) {
      draftPlayers.push({
        id: uid(),
        name: "Player " + (draftPlayers.length + 1),
        handicap18: null,
        handicapPlus: false,
        team: draftPlayers.length % 2 === 0 ? "A" : "B",
      });
    }
    draftPlayers = draftPlayers.slice(0, count);

    roundState.teamsEnabled = !!els.teamsEnabled.checked;
    roundState.teamRandom = draftTeamRandom || "manual";
    if (roundState.teamsEnabled && roundState.teamRandom === "start") {
      assignRandomTeams(draftPlayers);
      roundState.teamsDrawn = true;
    } else if (roundState.teamsEnabled && roundState.teamRandom === "end") {
      roundState.teamsDrawn = false;
    } else if (roundState.teamsEnabled) {
      roundState.teamsDrawn = true;
    } else {
      roundState.teamsDrawn = false;
    }

    var wasNone = !isMultiMode();
    roundState.gameType = type;
    roundState.players = draftPlayers;
    roundState.mePlayerId = els.mePlayerSelect.value || draftPlayers[0].id;
    if (!roundState.scores) roundState.scores = {};
    roundState.players.forEach(function (p) {
      if (!roundState.scores[p.id]) roundState.scores[p.id] = {};
    });
    if (wasNone) {
      Object.keys(scores).forEach(function (h) {
        roundState.scores[roundState.mePlayerId][h] = scores[h];
      });
    }
    syncMeScoresFromRound();
    saveRoundAndSync();
    updatePagerMode();
    closeSettingsPad();
    render();
    renderGameBoard();
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
    if (totals.complete) {
      if (!summaryShownForComplete) {
        summaryShownForComplete = true;
        openSummary();
      }
    } else {
      summaryShownForComplete = false;
    }
  }

  function updateDistances() {
    if (!course) return;
    var hole = currentHole();
    els.distanceMid.textContent = formatDistance(distanceYards(you, hole.middle));
    els.distanceFront.textContent = formatDistance(distanceYards(you, hole.front));
    els.distanceBack.textContent = formatDistance(distanceYards(you, hole.back));
  }

  function openScorePad() {
    if (!course) return;
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

  function maybeAdvanceAfterMeScore(hadScore, scored) {
    if (!scored || hadScore) return;
    if (inGameMode()) {
      if (
        allPlayersScoredHole(course.holes[holeIndex].number) &&
        holeIndex < course.holes.length - 1
      ) {
        holeIndex += 1;
        saveRoundAndSync();
      }
      return;
    }
    if (holeIndex < course.holes.length - 1) holeIndex += 1;
  }

  function commitPadScore() {
    if (!course) return;
    var hole = currentHole();
    var hadScore = getScore(hole.number) != null;
    var scored = false;
    if (!padDigits) setScore(hole.number, null);
    else {
      var value = parseInt(padDigits, 10);
      if (!isNaN(value) && value >= 1 && value <= 15) {
        setScore(hole.number, value);
        scored = true;
      }
    }
    closeScorePad();
    haptic(14);
    if (scored && !hadScore) {
      maybeAdvanceAfterMeScore(false, true);
    } else {
      pulseScore();
    }
    render();
    renderGameBoard();
    if (!els.summaryView.hidden) openSummary();
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
        holeStar(hole) +
        "</span>" +
        '<span class="hole-cell-score">' +
        formatScoreHtml(score, hole) +
        "</span>" +
        '<span class="hole-cell-par">Par ' +
        hole.par +
        " · " +
        teeYards(hole) +
        "y</span>";
      btn.addEventListener("click", function () {
        holeIndex = index;
        haptic(8);
        saveRoundAndSync();
        render();
        openScorePad();
      });
      els.scorecard.appendChild(btn);
    });
    renderTotals();
  }

  function hammerForHole(holeNumber) {
    return roundState.hammers[holeNumber] || null;
  }

  function renderGameBoard() {
    if (!course || !isMultiMode()) return;
    var hole = currentHole();
    els.gameHoleLabel.textContent =
      "Hole " + hole.number + " · Par " + hole.par;
    var ham = hammerForHole(hole.number);
    if (roundState.gameType === "hammer") {
      els.gameHammerStatus.hidden = false;
      els.gameHammerStatus.textContent = ham
        ? "Hammer ×" + ham.multiplier
        : "No hammer this hole";
      els.gameHammerBtn.textContent = ham
        ? "Hammer ×" + ham.multiplier * 2
        : "Hammer";
    } else {
      els.gameHammerStatus.hidden = true;
    }
    updateTeamsLabel();

    var showTeams =
      roundState.teamsEnabled &&
      (roundState.teamRandom !== "end" || roundState.teamsDrawn);

    var html = '<table class="game-table"><thead><tr><th>Hole</th>';
    roundState.players.forEach(function (p) {
      html +=
        "<th>" +
        (p.name || p.id) +
        (p.id === roundState.mePlayerId ? " *" : "") +
        (showTeams ? '<span class="team-chip">' + (p.team === "B" ? "B" : "A") + "</span>" : "") +
        "</th>";
    });
    html += "</tr></thead><tbody>";
    course.holes.forEach(function (h, idx) {
      var hHam = hammerForHole(h.number);
      html +=
        '<tr class="' +
        (idx === holeIndex ? "is-active" : "") +
        '"><th>' +
        h.number +
        (hHam ? ' <span class="hammer-tag">×' + hHam.multiplier + "</span>" : "") +
        "</th>";
      roundState.players.forEach(function (p) {
        var sc = getPlayerScore(p.id, h.number);
        if (isCompetitive()) {
          html += "<td>" + formatPlayerScoreHtml(p, sc, h) + "</td>";
        } else {
          html += "<td>" + (sc != null ? sc : "—") + "</td>";
        }
      });
      html += "</tr>";
    });
    html += '<tr class="game-total-row"><th>Tot</th>';
    roundState.players.forEach(function (p) {
      var tot = 0;
      var net = 0;
      var n = 0;
      course.holes.forEach(function (h) {
        var sc = getPlayerScore(p.id, h.number);
        if (sc != null) {
          tot += sc;
          net += netScoreFor(p, sc, h);
          n += 1;
        }
      });
      if (!n) html += "<td>—</td>";
      else if (isCompetitive() && playerHcp(p))
        html += "<td>" + tot + " / " + net + "</td>";
      else html += "<td>" + tot + "</td>";
    });
    html += "</tr>";
    if (showTeams && isCompetitive()) {
      html += '<tr class="game-total-row"><th>Team</th>';
      var teamTot = { A: 0, B: 0 };
      var teamN = { A: 0, B: 0 };
      roundState.players.forEach(function (p) {
        var t = p.team === "B" ? "B" : "A";
        course.holes.forEach(function (h) {
          var sc = getPlayerScore(p.id, h.number);
          if (sc != null) {
            teamTot[t] += isCompetitive() && playerHcp(p) ? netScoreFor(p, sc, h) : sc;
            teamN[t] += 1;
          }
        });
      });
      roundState.players.forEach(function (p) {
        var t = p.team === "B" ? "B" : "A";
        html +=
          "<td>" +
          (teamN[t] ? teamLabel(t) + " " + teamTot[t] : "—") +
          "</td>";
      });
      html += "</tr>";
    }
    html += "</tbody></table>";
    els.gameBoard.innerHTML = html;
  }

  function openMultiScorePad() {
    if (!course || !inGameMode()) return;
    var hole = currentHole();
    multiDraft = {};
    els.multiPadTitle.textContent = "Hole " + hole.number + " scores";
    els.multiScoreList.innerHTML = "";
    roundState.players.forEach(function (p) {
      var sc = getPlayerScore(p.id, hole.number);
      multiDraft[p.id] = sc != null ? String(sc) : "";
      var row = document.createElement("div");
      row.className = "multi-score-row";
      row.innerHTML =
        '<span class="multi-score-name">' +
        (p.name || p.id) +
        "</span>" +
        '<div class="multi-score-controls">' +
        '<button type="button" class="score-quick-btn" data-multi-dec="' +
        p.id +
        '">−</button>' +
        '<button type="button" class="multi-score-val" data-multi-val="' +
        p.id +
        '">' +
        (multiDraft[p.id] || "—") +
        "</button>" +
        '<button type="button" class="score-quick-btn" data-multi-inc="' +
        p.id +
        '">+</button>' +
        '<button type="button" class="score-quick-btn" data-multi-par="' +
        p.id +
        '">E</button>' +
        "</div>";
      els.multiScoreList.appendChild(row);
    });
    els.multiScorePad.hidden = false;
  }

  function refreshMultiVal(pid) {
    var btn = els.multiScoreList.querySelector(
      '[data-multi-val="' + pid + '"]'
    );
    if (btn) btn.textContent = multiDraft[pid] || "—";
  }

  function closeMultiScorePad() {
    els.multiScorePad.hidden = true;
  }

  function commitMultiScores() {
    if (!course) return;
    var hole = currentHole();
    var holeNum = hole.number;
    roundState.players.forEach(function (p) {
      var raw = multiDraft[p.id];
      if (!raw) setPlayerScore(p.id, holeNum, null);
      else {
        var v = parseInt(raw, 10);
        if (!isNaN(v) && v >= 1 && v <= 15) setPlayerScore(p.id, holeNum, v);
      }
    });
    closeMultiScorePad();
    haptic(14);
    if (
      allPlayersScoredHole(holeNum) &&
      holeIndex < course.holes.length - 1
    ) {
      holeIndex += 1;
      saveRoundAndSync();
    }
    render();
    renderGameBoard();
  }

  function toggleHammer() {
    if (!course || roundState.gameType !== "hammer") return;
    var holeNum = currentHole().number;
    var cur = hammerForHole(holeNum);
    if (!cur) {
      roundState.hammers[holeNum] = {
        multiplier: 2,
        byPlayerId: roundState.mePlayerId,
      };
    } else if (cur.multiplier >= 8) {
      delete roundState.hammers[holeNum];
    } else {
      cur.multiplier = cur.multiplier * 2;
      cur.byPlayerId = roundState.mePlayerId;
    }
    saveRoundAndSync();
    haptic(16);
    renderGameBoard();
  }

  function render() {
    if (!course) return;
    var hole = currentHole();
    var yards = teeYards(hole);
    var score = getScore(hole.number);

    els.courseName.textContent = course.name;
    els.holeLabel.textContent =
      "Hole " + hole.number + holeStar(hole) + " · Par " + hole.par;
    els.holeScore.innerHTML = formatScoreHtml(score, hole);
    els.holeScore.className = "hole-score";
    els.holeMeta.textContent = "Hcp " + hole.handicap + " · " + yards + " yd";
    updateTeeButton();
    updateHcpButton();
    updateDistances();
    if (isMultiMode()) {
      renderTotals();
      if (pagerPage === 1) renderGameBoard();
    } else {
      renderScorecard();
    }
  }

  function applyScore(value) {
    if (!course) return;
    var hole = currentHole();
    var hadScore = getScore(hole.number) != null;
    if (value == null || value < 1) setScore(hole.number, null);
    else setScore(hole.number, Math.min(15, value));
    haptic(12);
    if (value != null && value >= 1 && !hadScore) {
      maybeAdvanceAfterMeScore(false, true);
    } else {
      pulseScore();
    }
    render();
    renderGameBoard();
  }

  function quickScore(action) {
    if (!course) return;
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
    if (!course) return;
    holeIndex = (holeIndex + step + course.holes.length) % course.holes.length;
    haptic(8);
    saveRoundAndSync();
    render();
    renderGameBoard();
  }

  function onPosition(pos) {
    you = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    var accuracyYds = Math.round(pos.coords.accuracy / 0.9144);
    setStatus("GPS ±" + accuracyYds + " yd");
    updateDistances();
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
    if (!course) return;
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
      els.summaryToPar.textContent = formatToPar(
        totals.strokes - totals.parPlayed
      );
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
      row.className = "summary-row";
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
        formatScoreHtml(score, hole) +
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
        saveRoundAndSync();
        render();
        openScorePad();
      });
      els.summaryHoles.appendChild(row);
    });

    els.appPager.hidden = true;
    els.summaryView.hidden = false;
    haptic(20);
  }

  function closeSummary() {
    els.summaryView.hidden = true;
    els.appPager.hidden = false;
  }

  function summaryText() {
    if (!course) return "";
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
    if (inGameMode()) {
      lines.push("Game: " + roundState.gameType);
      roundState.players.forEach(function (p) {
        var tot = 0;
        course.holes.forEach(function (h) {
          var sc = getPlayerScore(p.id, h.number);
          if (sc != null) tot += sc;
        });
        lines.push((p.name || p.id) + ": " + (tot || "—"));
      });
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
      var ham = hammerForHole(hole.number);
      if (ham) holeLine += "  hammer×" + ham.multiplier;
      lines.push(holeLine);
    });
    return lines.join("\n");
  }

  function clearRound() {
    if (!course) return;
    scores = {};
    saveScores();
    if (inGameMode()) {
      roundState.scores = {};
      roundState.players.forEach(function (p) {
        roundState.scores[p.id] = {};
      });
      roundState.hammers = {};
      saveRoundAndSync();
    }
    summaryShownForComplete = false;
    render();
    renderGameBoard();
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

  function setupPagerSwipe() {
    var startX = 0;
    var startY = 0;
    var tracking = false;
    els.appPager.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length !== 1) return;
        if (e.target.closest(".pad, button, input, select, a")) return;
        tracking = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      },
      { passive: true }
    );
    els.appPager.addEventListener(
      "touchend",
      function (e) {
        if (!tracking) return;
        tracking = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - startX;
        var dy = t.clientY - startY;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0 && pagerPage === 0) setPagerPage(1);
        else if (dx > 0 && pagerPage === 1) setPagerPage(0);
      },
      { passive: true }
    );
  }

  function reconnectRoomIfNeeded() {
    if (
      !roundState.syncEnabled ||
      !roundState.roomCode ||
      !window.GolfGpsSync ||
      !GolfGpsSync.isConfigured()
    ) {
      return;
    }
    GolfGpsSync.joinRoom(roundState.roomCode)
      .then(function (data) {
        applyRemoteRound(data);
        GolfGpsSync.subscribe(applyRemoteRound);
      })
      .catch(function () {
        roundState.roomCode = null;
        persistRoundLocal();
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
  els.summaryBack.addEventListener("click", closeSummary);
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

  els.settingsOpen.addEventListener("click", function () {
    bumpActivity();
    openSettingsPad();
  });
  els.gameSettingsOpen.addEventListener("click", openSettingsPad);
  els.settingsClose.addEventListener("click", closeSettingsPad);
  els.settingsPad.addEventListener("click", function (event) {
    if (event.target === els.settingsPad) closeSettingsPad();
  });
  els.settingsSave.addEventListener("click", function () {
    saveSettingsFromPad();
    haptic(12);
  });
  els.gameTypeSelect.addEventListener("change", updateSettingsGameVisibility);
  els.playerCountDec.addEventListener("click", function () {
    var n = clampPlayerCount((parseInt(els.playerCountInput.value, 10) || 2) - 1);
    resizeDraftPlayers(n);
    haptic(6);
  });
  els.playerCountInc.addEventListener("click", function () {
    var n = clampPlayerCount((parseInt(els.playerCountInput.value, 10) || 2) + 1);
    resizeDraftPlayers(n);
    haptic(6);
  });
  els.playerCountInput.addEventListener("change", function () {
    resizeDraftPlayers(parseInt(els.playerCountInput.value, 10) || 2);
  });
  els.playersEditor.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-player-hcp-sign], [data-player-team]");
    if (!btn) return;
    var index = parseInt(btn.getAttribute("data-pi"), 10);
    if (isNaN(index) || !draftPlayers[index]) return;
    if (btn.hasAttribute("data-player-hcp-sign")) {
      var plus = btn.getAttribute("data-player-hcp-sign") === "plus";
      draftPlayers[index].handicapPlus = plus;
      els.playersEditor
        .querySelectorAll('.hcp-sign-btn[data-pi="' + index + '"][data-player-hcp-sign]')
        .forEach(function (el) {
          el.classList.toggle(
            "is-active",
            el.getAttribute("data-player-hcp-sign") === (plus ? "plus" : "minus")
          );
        });
    } else {
      var team = btn.getAttribute("data-player-team");
      draftPlayers[index].team = team;
      els.playersEditor
        .querySelectorAll('.hcp-sign-btn[data-pi="' + index + '"][data-player-team]')
        .forEach(function (el) {
          el.classList.toggle(
            "is-active",
            el.getAttribute("data-player-team") === team
          );
        });
    }
    haptic(6);
  });

  els.teamsEnabled.addEventListener("change", updateTeamsSettingsUi);
  els.teamRandomSelect.addEventListener("change", updateTeamsSettingsUi);
  els.syncEnabled.addEventListener("change", function () {
    updateSyncSettingsUi();
    haptic(6);
  });
  els.shuffleTeamsBtn.addEventListener("click", function () {
    readDraftPlayersFromDom();
    assignRandomTeams(draftPlayers);
    renderPlayersEditor();
    haptic(10);
  });

  els.drawTeamsBtn.addEventListener("click", function () {
    assignRandomTeams(roundState.players);
    roundState.teamsDrawn = true;
    saveRoundAndSync();
    updatePagerMode();
    renderGameBoard();
    haptic(16);
  });

  els.roomCreate.addEventListener("click", function () {
    if (!window.GolfGpsSync || !GolfGpsSync.isConfigured()) {
      window.alert("Add Firebase config in firebase-config.js (see SYNC.md).");
      return;
    }
    if (els.gameTypeSelect.value === "none") {
      window.alert("Pick Track scores, Stroke play, or Hammer first.");
      return;
    }
    readDraftPlayersFromDom();
    saveSettingsFromPad();
    if (!inGameMode()) return;
    GolfGpsSync.createRoom(roundPayload())
      .then(function (code) {
        roundState.roomCode = code;
        roundState.syncEnabled = true;
        els.syncEnabled.checked = true;
        updateSyncSettingsUi();
        persistRoundLocal();
        GolfGpsSync.subscribe(applyRemoteRound);
        updateRoomUi();
        updatePagerMode();
        openSettingsPad();
        haptic(14);
      })
      .catch(function (err) {
        window.alert(err.message || "Could not create room");
      });
  });

  els.roomJoin.addEventListener("click", function () {
    if (!window.GolfGpsSync || !GolfGpsSync.isConfigured()) {
      window.alert("Add Firebase config in firebase-config.js (see SYNC.md).");
      return;
    }
    var code = els.roomJoinInput.value;
    GolfGpsSync.joinRoom(code)
      .then(function (data) {
        roundState.roomCode = data.roomCode || String(code).toUpperCase();
        roundState.syncEnabled = true;
        applyRemoteRound(data);
        if (!roundState.mePlayerId && roundState.players[0]) {
          roundState.mePlayerId = roundState.players[0].id;
        }
        GolfGpsSync.subscribe(applyRemoteRound);
        updateRoomUi();
        updatePagerMode();
        closeSettingsPad();
        setPagerPage(1);
        haptic(14);
      })
      .catch(function (err) {
        window.alert(err.message || "Could not join room");
      });
  });

  els.roomLeave.addEventListener("click", function () {
    if (window.GolfGpsSync) GolfGpsSync.disconnect();
    roundState.roomCode = null;
    persistRoundLocal();
    updateRoomUi();
    updatePagerMode();
    haptic(8);
  });

  els.gameBackPlay.addEventListener("click", function () {
    setPagerPage(0);
  });
  els.enterScoresBtn.addEventListener("click", function () {
    bumpActivity();
    openMultiScorePad();
  });
  els.gameHammerBtn.addEventListener("click", toggleHammer);
  els.multiPadClose.addEventListener("click", closeMultiScorePad);
  els.multiPadDone.addEventListener("click", commitMultiScores);
  els.multiScorePad.addEventListener("click", function (event) {
    if (event.target === els.multiScorePad) closeMultiScorePad();
  });
  els.multiScoreList.addEventListener("click", function (event) {
    var t = event.target;
    var hole = course && currentHole();
    if (!hole) return;
    var par = hole.par;
    var dec = t.getAttribute("data-multi-dec");
    var inc = t.getAttribute("data-multi-inc");
    var setPar = t.getAttribute("data-multi-par");
    var pid = dec || inc || setPar;
    if (!pid) return;
    var cur = multiDraft[pid] ? parseInt(multiDraft[pid], 10) : null;
    if (dec) {
      if (cur == null) multiDraft[pid] = String(Math.max(1, par - 1));
      else if (cur <= 1) multiDraft[pid] = "";
      else multiDraft[pid] = String(cur - 1);
    } else if (inc) {
      multiDraft[pid] = String(cur == null ? par + 1 : Math.min(15, cur + 1));
    } else if (setPar) {
      multiDraft[pid] = String(par);
    }
    refreshMultiVal(pid);
    haptic(6);
  });

  els.pagerHint.addEventListener("click", function () {
    setPagerPage(1);
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
    var refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    function checkForSwUpdate(reg) {
      if (reg) reg.update().catch(function () {});
    }

    navigator.serviceWorker
      .register("./sw.js")
      .then(function (reg) {
        checkForSwUpdate(reg);
        document.addEventListener("visibilitychange", function () {
          if (!document.hidden) checkForSwUpdate(reg);
        });
      })
      .catch(function () {});
  }

  try {
    localStorage.removeItem("golf-gps-handicap-index");
  } catch (e) {}

  setupPagerSwipe();
  buildPadKeys();
  loadScores();
  loadHandicap();
  loadRoundState();
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
      if (inGameMode()) syncMeScoresFromRound();
      updatePagerMode();
      render();
      renderGameBoard();
      startGpsWatch();
      bumpActivity();
      reconnectRoomIfNeeded();
    })
    .catch(function () {
      setStatus("Could not load course JSON.");
    });
})();

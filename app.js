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
  var draftTeamScoreMode = "bestball";

  var roundState = {
    gameType: "none",
    mePlayerId: "p1",
    players: [],
    scores: {},
    hammers: {},
    teamsEnabled: false,
    teamRandom: "manual",
    teamsDrawn: false,
    teamNames: { A: "Team A", B: "Team B" },
    teamScoreMode: "bestball",
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
    strokeHint: document.getElementById("strokeHint"),
    hammerHint: document.getElementById("hammerHint"),
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
    teamsOptions: document.getElementById("teamsOptions"),
    teamNameA: document.getElementById("teamNameA"),
    teamNameB: document.getElementById("teamNameB"),
    teamScoreModeBlock: document.getElementById("teamScoreModeBlock"),
    shuffleTeamsBtn: document.getElementById("shuffleTeamsBtn"),
    settingsClose: document.getElementById("settingsClose"),
    settingsSave: document.getElementById("settingsSave"),
    playerEditPad: document.getElementById("playerEditPad"),
    playerEditTitle: document.getElementById("playerEditTitle"),
    playerEditName: document.getElementById("playerEditName"),
    playerEditHcpBlock: document.getElementById("playerEditHcpBlock"),
    playerEditHcp: document.getElementById("playerEditHcp"),
    playerEditTeamBlock: document.getElementById("playerEditTeamBlock"),
    playerEditTeamA: document.getElementById("playerEditTeamA"),
    playerEditTeamB: document.getElementById("playerEditTeamB"),
    playerEditQuotaBlock: document.getElementById("playerEditQuotaBlock"),
    playerEditQuota: document.getElementById("playerEditQuota"),
    playerEditCancel: document.getElementById("playerEditCancel"),
    playerEditSave: document.getElementById("playerEditSave"),
    gameBackPlay: document.getElementById("gameBackPlay"),
    gameSettingsOpen: document.getElementById("gameSettingsOpen"),
    gameTitle: document.getElementById("gameTitle"),
    gameHoleLabel: document.getElementById("gameHoleLabel"),
    gameHammerStatus: document.getElementById("gameHammerStatus"),
    enterScoresBtn: document.getElementById("enterScoresBtn"),
    playGameActions: document.getElementById("playGameActions"),
    scoreQuick: document.getElementById("scoreQuick"),
    gameHammerBtn: document.getElementById("gameHammerBtn"),
    gameHammerUndoBtn: document.getElementById("gameHammerUndoBtn"),
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

  var editPlayerIndex = -1;
  var editHcpPlus = false;
  var editTeam = "A";
  var boardEdit = null;

  function isMultiMode() {
    return (
      roundState.gameType === "track" ||
      roundState.gameType === "stroke" ||
      roundState.gameType === "quota" ||
      roundState.gameType === "hammer"
    );
  }

  function isCompetitive() {
    return (
      roundState.gameType === "stroke" ||
      roundState.gameType === "quota" ||
      roundState.gameType === "hammer"
    );
  }

  function isQuota() {
    return roundState.gameType === "quota";
  }

  function gameUsesHandicap(type) {
    var t = type != null ? type : roundState.gameType;
    return t === "none" || t === "stroke" || t === "hammer";
  }

  function draftUsesHandicap() {
    return gameUsesHandicap(els.gameTypeSelect.value);
  }

  function teamScoreModeSupports(type) {
    var t = type != null ? type : roundState.gameType;
    return t === "stroke" || t === "hammer";
  }

  function uid() {
    return "p" + Math.random().toString(36).slice(2, 8);
  }

  function defaultPlayers(count) {
    var list = [];
    for (var i = 0; i < count; i++) {
      list.push({
        id: "p" + (i + 1),
        name: "Player " + (i + 1),
        handicap18: null,
        handicapPlus: false,
        team: i % 2 === 0 ? "A" : "B",
        quota: 18,
      });
    }
    return list;
  }

  function teamDisplayName(key) {
    var names = roundState.teamNames || {};
    if (key === "B") return names.B || "Team B";
    return names.A || "Team A";
  }

  function draftTeamDisplayName(key) {
    if (key === "B") return (els.teamNameB && els.teamNameB.value.trim()) || "Team B";
    return (els.teamNameA && els.teamNameA.value.trim()) || "Team A";
  }

  function teamRosterLabel(teamKey, players) {
    var names = (players || [])
      .filter(function (p) {
        return (p.team === "B" ? "B" : "A") === teamKey;
      })
      .map(function (p) {
        return p.name || p.id;
      });
    return names.length ? names.join("/") : "—";
  }

  function teamsVisible() {
    return (
      roundState.teamsEnabled &&
      (roundState.teamRandom !== "end" || roundState.teamsDrawn)
    );
  }

  function boardPlayers() {
    if (!teamsVisible()) return roundState.players.slice();
    var a = [];
    var b = [];
    roundState.players.forEach(function (p) {
      if (p.team === "B") b.push(p);
      else a.push(p);
    });
    return a.concat(b);
  }

  function teamColumnSep(player, index, list) {
    if (!teamsVisible() || index === 0) return "";
    var prev = list[index - 1];
    var prevT = prev.team === "B" ? "B" : "A";
    var curT = player.team === "B" ? "B" : "A";
    return prevT !== curT ? " team-sep" : "";
  }

  function playerStrokeTotal(player) {
    var tot = 0;
    var net = 0;
    var n = 0;
    course.holes.forEach(function (h) {
      var sc = getPlayerScore(player.id, h.number);
      if (sc != null) {
        tot += sc;
        net += netScoreFor(player, sc, h);
        n += 1;
      }
    });
    return { tot: tot, net: net, n: n };
  }

  function playerUsedScore(player, gross, hole) {
    if (gross == null) return null;
    if (gameUsesHandicap() && playerHcp(player))
      return netScoreFor(player, gross, hole);
    return gross;
  }

  function teamHoleScore(teamKey, hole) {
    var vals = [];
    roundState.players.forEach(function (p) {
      if ((p.team === "B" ? "B" : "A") !== teamKey) return;
      var sc = getPlayerScore(p.id, hole.number);
      var used = playerUsedScore(p, sc, hole);
      if (used != null) vals.push(used);
    });
    if (!vals.length) return null;
    if (roundState.teamScoreMode === "bestball")
      return Math.min.apply(null, vals);
    return vals.reduce(function (a, b) {
      return a + b;
    }, 0);
  }

  function teamCombinedScore(teamKey) {
    var players = roundState.players.filter(function (p) {
      return (p.team === "B" ? "B" : "A") === teamKey;
    });
    if (isQuota()) {
      var pts = 0;
      var quota = 0;
      var any = false;
      players.forEach(function (p) {
        var has = course.holes.some(function (h) {
          return getPlayerScore(p.id, h.number) != null;
        });
        if (!has) return;
        any = true;
        pts += playerQuotaTotal(p);
        quota += p.quota != null ? p.quota : 18;
      });
      if (!any) return null;
      return { text: pts + "/" + quota, value: pts - quota };
    }
    var tot = 0;
    var n = 0;
    if (teamsVisible() && teamScoreModeSupports()) {
      course.holes.forEach(function (h) {
        var hs = teamHoleScore(teamKey, h);
        if (hs == null) return;
        tot += hs;
        n += 1;
      });
    } else {
      players.forEach(function (p) {
        var r = playerStrokeTotal(p);
        if (!r.n) return;
        tot += gameUsesHandicap() && playerHcp(p) ? r.net : r.tot;
        n += r.n;
      });
    }
    if (!n) return null;
    return { text: String(tot), value: tot };
  }

  function teamScoreModeLabel() {
    return roundState.teamScoreMode === "cumulative"
      ? "Cumulative"
      : "Best ball";
  }

  function formatPlayerHcpLabel(player) {
    if (player.handicap18 == null) return "--";
    return (player.handicapPlus ? "+" : "−") + player.handicap18 + " hcp";
  }

  function holePoints(player, gross, hole) {
    if (gross == null) return null;
    var diff = gross - hole.par;
    if (diff <= -2) return 4;
    if (diff === -1) return 3;
    if (diff === 0) return 2;
    if (diff === 1) return 1;
    return 0;
  }

  function playerQuotaTotal(player) {
    var pts = 0;
    if (!course) return 0;
    course.holes.forEach(function (h) {
      var sc = getPlayerScore(player.id, h.number);
      var p = holePoints(player, sc, h);
      if (p != null) pts += p;
    });
    return pts;
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

  function normalizePlayerName(name, index) {
    var n = (name || "").trim();
    if (!n || /^me$/i.test(n)) return "Player " + (index + 1);
    return n;
  }

  function loadRoundState() {
    try {
      var raw = JSON.parse(localStorage.getItem(ROUND_KEY) || "null");
      if (!raw || typeof raw !== "object") return;
      roundState.gameType = raw.gameType || "none";
      roundState.mePlayerId =
        (roundState.players[0] && roundState.players[0].id) ||
        raw.mePlayerId ||
        "p1";
      roundState.players = Array.isArray(raw.players)
        ? raw.players.map(function (p, i) {
            return {
              id: p.id || uid(),
              name: normalizePlayerName(p.name, i),
              handicap18: p.handicap18 != null ? p.handicap18 : null,
              handicapPlus: !!p.handicapPlus,
              team: p.team === "B" ? "B" : "A",
              quota: p.quota != null ? p.quota : 18,
            };
          })
        : [];
      roundState.scores = raw.scores || {};
      roundState.hammers = raw.hammers || {};
      roundState.teamsEnabled = !!raw.teamsEnabled;
      roundState.teamRandom = raw.teamRandom || "manual";
      roundState.teamsDrawn = !!raw.teamsDrawn;
      roundState.teamNames = {
        A: (raw.teamNames && raw.teamNames.A) || "Team A",
        B: (raw.teamNames && raw.teamNames.B) || "Team B",
      };
      roundState.teamScoreMode =
        raw.teamScoreMode === "cumulative" ? "cumulative" : "bestball";
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
        teamNames: roundState.teamNames || { A: "Team A", B: "Team B" },
        teamScoreMode: roundState.teamScoreMode || "bestball",
        holeIndex: holeIndex,
        updatedAt: Date.now(),
        tee: selectedTee,
      })
    );
  }

  function hasStoredPlayerScores(playerId) {
    var map = roundState.scores[playerId];
    if (!map) return false;
    return Object.keys(map).some(function (h) {
      return map[h] != null;
    });
  }

  function hasAnyMultiScores() {
    if (Object.keys(roundState.hammers || {}).length) return true;
    return (roundState.players || []).some(function (p) {
      return hasStoredPlayerScores(p.id);
    });
  }

  function pruneRoundScores(players) {
    var next = {};
    (players || []).forEach(function (p) {
      next[p.id] = roundState.scores[p.id] || {};
    });
    roundState.scores = next;
  }

  function syncMeScoresFromRound() {
    if (!isMultiMode()) return;
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
    if (!isMultiMode()) return;
    var pid = roundState.mePlayerId;
    if (!roundState.scores[pid]) roundState.scores[pid] = {};
    if (value == null) delete roundState.scores[pid][holeNumber];
    else roundState.scores[pid][holeNumber] = value;
    persistRoundLocal();
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
    persistRoundLocal();
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
    if (isMultiMode()) {
      var me = getMePlayer();
      if (me) {
        me.handicap18 = handicap18;
        me.handicapPlus = handicapPlus;
        persistRoundLocal();
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
    if (gross == null) {
      return gameUsesHandicap() && strokesOnHoleFor(player, hole) > 0
        ? '<span class="stroke-mark">★</span>'
        : "—";
    }
    var s = gameUsesHandicap() ? strokesOnHoleFor(player, hole) : 0;
    var star = s > 0 ? '<span class="stroke-mark">★</span>' : "";
    var grossHtml =
      '<span class="score-part ' +
      scoreClass(gross, hole.par) +
      '">' +
      gross +
      "</span>";
    if (!gameUsesHandicap() || !playerHcp(player) || s === 0)
      return grossHtml + star;
    var net = netScoreFor(player, gross, hole);
    return (
      grossHtml +
      ' / <span class="score-part ' +
      scoreClass(net, hole.par) +
      '">' +
      net +
      "</span>" +
      star
    );
  }

  function updateStrokeHint() {
    if (!els.strokeHint || !course) return;
    var hole = currentHole();
    if (!gameUsesHandicap()) {
      els.strokeHint.hidden = true;
      return;
    }
    if (isMultiMode()) {
      var names = [];
      roundState.players.forEach(function (p) {
        var s = strokesOnHoleFor(p, hole);
        if (s > 0) names.push((p.name || p.id) + (s > 1 ? " ×" + s : ""));
      });
      els.strokeHint.hidden = false;
      els.strokeHint.textContent = names.length
        ? "Strokes: " + names.join(", ")
        : "No strokes this hole";
      return;
    }
    if (hasHandicap() && strokesOnHole(hole) > 0) {
      els.strokeHint.hidden = false;
      els.strokeHint.textContent =
        "You get " +
        strokesOnHole(hole) +
        " stroke" +
        (strokesOnHole(hole) > 1 ? "s" : "") +
        " here";
    } else {
      els.strokeHint.hidden = true;
    }
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
    els.playGameActions.hidden = !multi;
    els.enterScoresBtn.hidden = !multi;
    els.scoreQuick.hidden = multi;
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
    else if (roundState.gameType === "quota")
      els.gameTitle.textContent = "Quota Points";
    else if (roundState.gameType === "track")
      els.gameTitle.textContent = "Track Scores";
    else els.gameTitle.textContent = "Scorecard";

    updatePlayGameActions();
    updateTeamsLabel();
  }

  function updatePlayGameActions() {
    if (!isMultiMode()) {
      els.gameHammerBtn.hidden = true;
      els.gameHammerUndoBtn.hidden = true;
      els.drawTeamsBtn.hidden = true;
      updateHammerHint();
      return;
    }
    var showHammer = roundState.gameType === "hammer";
    var showDraw =
      roundState.teamsEnabled &&
      roundState.teamRandom === "end" &&
      !roundState.teamsDrawn;
    var hamNow =
      showHammer && course ? hammerForHole(currentHole().number) : null;
    els.gameHammerBtn.hidden = !showHammer;
    if (showHammer) {
      if (!hamNow) els.gameHammerBtn.textContent = "Hammer to 2x";
      else if (hamNow.multiplier >= 8)
        els.gameHammerBtn.textContent = "Clear hammer";
      else
        els.gameHammerBtn.textContent =
          "Hammer to " + hamNow.multiplier * 2 + "x";
    }
    els.gameHammerUndoBtn.hidden = !hamNow;
    els.drawTeamsBtn.hidden = !showDraw;
    updateHammerHint();
  }

  function updateHammerHint() {
    if (!els.hammerHint) return;
    if (roundState.gameType !== "hammer" || !course || !isMultiMode()) {
      els.hammerHint.hidden = true;
      return;
    }
    var ham = hammerForHole(currentHole().number);
    els.hammerHint.hidden = false;
    els.hammerHint.textContent = ham
      ? "Hammer " + ham.multiplier + "x this hole"
      : "No hammer this hole";
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
    var aLabel = teamRosterLabel("A", roundState.players);
    var bLabel = teamRosterLabel("B", roundState.players);
    var aScore = teamCombinedScore("A");
    var bScore = teamCombinedScore("B");
    els.gameTeamsLabel.hidden = false;
    if (aScore && bScore) {
      els.gameTeamsLabel.innerHTML =
        (teamScoreModeSupports()
          ? '<span class="team-vs-mode">' + teamScoreModeLabel() + "</span>"
          : "") +
        '<span class="team-vs-side">' +
        aLabel +
        " <strong>" +
        aScore.text +
        "</strong></span>" +
        '<span class="team-vs-mid">vs</span>' +
        '<span class="team-vs-side"><strong>' +
        bScore.text +
        "</strong> " +
        bLabel +
        "</span>";
    } else {
      els.gameTeamsLabel.textContent =
        (teamScoreModeSupports() ? teamScoreModeLabel() + " · " : "") +
        aLabel +
        " vs " +
        bLabel;
    }
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
        persistRoundLocal();
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
    var showTeam = draftTeamsEnabled;
    var showHcp =
      draftUsesHandicap() &&
      draftPlayers.some(function (p) {
        return p.handicap18 != null;
      });
    var showQuota = els.gameTypeSelect.value === "quota";
    draftPlayers.forEach(function (p, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "player-list-btn" +
        (showTeam ? " has-team" : "") +
        (showHcp ? " has-hcp" : "") +
        (showQuota ? " has-quota" : "");
      btn.setAttribute("data-edit-player", String(index));
      var html =
        '<span class="player-list-name">' +
        (p.name || "Player " + (index + 1)) +
        "</span>";
      if (showTeam) {
        html +=
          '<span class="player-list-team">' +
          draftTeamDisplayName(p.team === "B" ? "B" : "A") +
          "</span>";
      }
      if (showHcp) {
        html +=
          '<span class="player-list-hcp">' + formatPlayerHcpLabel(p) + "</span>";
      }
      if (showQuota) {
        html +=
          '<span class="player-list-quota">Q' +
          (p.quota != null ? p.quota : 18) +
          "</span>";
      }
      btn.innerHTML = html;
      els.playersEditor.appendChild(btn);
    });
  }

  function openPlayerEdit(index) {
    editPlayerIndex = index;
    var p = draftPlayers[index];
    if (!p) return;
    els.playerEditTitle.textContent = p.name || "Player " + (index + 1);
    els.playerEditName.value = p.name || "";
    editHcpPlus = !!p.handicapPlus;
    els.playerEditHcp.value = p.handicap18 != null ? String(p.handicap18) : "";
    document.querySelectorAll("[data-edit-hcp-sign]").forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        btn.getAttribute("data-edit-hcp-sign") === (editHcpPlus ? "plus" : "minus")
      );
    });
    editTeam = p.team === "B" ? "B" : "A";
    els.playerEditHcpBlock.hidden = !draftUsesHandicap();
    els.playerEditTeamBlock.hidden = !draftTeamsEnabled;
    els.playerEditTeamA.textContent = draftTeamDisplayName("A");
    els.playerEditTeamB.textContent = draftTeamDisplayName("B");
    els.playerEditTeamA.classList.toggle("is-active", editTeam === "A");
    els.playerEditTeamB.classList.toggle("is-active", editTeam === "B");
    els.playerEditQuotaBlock.hidden = els.gameTypeSelect.value !== "quota";
    els.playerEditQuota.value = String(p.quota != null ? p.quota : 18);
    els.playerEditPad.hidden = false;
  }

  function closePlayerEdit() {
    els.playerEditPad.hidden = true;
    editPlayerIndex = -1;
  }

  function savePlayerEdit() {
    if (editPlayerIndex < 0 || !draftPlayers[editPlayerIndex]) return;
    var p = draftPlayers[editPlayerIndex];
    var name = els.playerEditName.value.trim();
    p.name = name || "Player " + (editPlayerIndex + 1);
    p.handicapPlus = editHcpPlus;
    var v = parseInt(els.playerEditHcp.value, 10);
    p.handicap18 =
      els.playerEditHcp.value.trim() === "" || isNaN(v)
        ? null
        : Math.max(0, Math.min(54, v));
    p.team = editTeam;
    var q = parseInt(els.playerEditQuota.value, 10);
    p.quota = isNaN(q) ? 18 : Math.max(0, Math.min(50, q));
    closePlayerEdit();
    renderPlayersEditor();
  }

  function updateTeamsSettingsUi() {
    els.teamsOptions.hidden = !draftTeamsEnabled;
    document.querySelectorAll("[data-teams-enabled]").forEach(function (btn) {
      var on = btn.getAttribute("data-teams-enabled") === "yes";
      btn.classList.toggle("is-active", on === draftTeamsEnabled);
    });
    document.querySelectorAll("[data-team-random]").forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        btn.getAttribute("data-team-random") === draftTeamRandom
      );
    });
    document.querySelectorAll("[data-team-score]").forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        btn.getAttribute("data-team-score") === draftTeamScoreMode
      );
    });
    var showTeamScore =
      draftTeamsEnabled && teamScoreModeSupports(els.gameTypeSelect.value);
    els.teamScoreModeBlock.hidden = !showTeamScore;
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
    while (draftPlayers.length < count) {
      draftPlayers.push({
        id: uid(),
        name: "Player " + (draftPlayers.length + 1),
        handicap18: null,
        handicapPlus: false,
        team: draftPlayers.length % 2 === 0 ? "A" : "B",
        quota: 18,
      });
    }
    draftPlayers = draftPlayers.slice(0, count);
    els.playerCountInput.value = String(count);
    renderPlayersEditor();
  }

  function updateSettingsGameVisibility() {
    var t = els.gameTypeSelect.value;
    els.gameSettingsBlock.hidden = t === "none";
    updateTeamsSettingsUi();
    updateSettingsSaveLabel();
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
      draftPlayers = roundState.players.map(function (p, i) {
        return {
          id: p.id,
          name: normalizePlayerName(p.name, i),
          handicap18: p.handicap18,
          handicapPlus: !!p.handicapPlus,
          team: p.team === "B" ? "B" : "A",
          quota: p.quota != null ? p.quota : 18,
        };
      });
    }
    els.playerCountInput.value = String(
      clampPlayerCount(Math.max(2, draftPlayers.length))
    );
    draftTeamsEnabled = !!roundState.teamsEnabled;
    draftTeamRandom = roundState.teamRandom || "manual";
    draftTeamScoreMode =
      roundState.teamScoreMode === "cumulative" ? "cumulative" : "bestball";
    els.teamNameA.value = (roundState.teamNames && roundState.teamNames.A) || "Team A";
    els.teamNameB.value = (roundState.teamNames && roundState.teamNames.B) || "Team B";
    updateTeamsSettingsUi();
    updateSettingsGameVisibility();
    updateSettingsSaveLabel();
    els.settingsPad.hidden = false;
  }

  function closeSettingsPad() {
    closePlayerEdit();
    els.settingsPad.hidden = true;
  }

  function saveSettingsFromPad() {
    var type = els.gameTypeSelect.value;
    var wasMulti = isMultiMode();

    if (type === "none") {
      if (
        wasMulti &&
        hasAnyMultiScores() &&
        !window.confirm(
          "Switch to Solo? Other players' scores will be cleared. Your hole scores stay on this phone."
        )
      ) {
        return;
      }
      roundState.gameType = "none";
      roundState.players = [];
      roundState.scores = {};
      roundState.hammers = {};
      roundState.teamsEnabled = false;
      roundState.teamRandom = "manual";
      roundState.teamsDrawn = false;
      roundState.teamNames = { A: "Team A", B: "Team B" };
      persistRoundLocal();
      updatePagerMode();
      closeSettingsPad();
      render();
      renderGameBoard();
      return;
    }

    var count = clampPlayerCount(parseInt(els.playerCountInput.value, 10) || 2);
    while (draftPlayers.length < count) {
      draftPlayers.push({
        id: uid(),
        name: "Player " + (draftPlayers.length + 1),
        handicap18: null,
        handicapPlus: false,
        team: draftPlayers.length % 2 === 0 ? "A" : "B",
        quota: 18,
      });
    }
    draftPlayers = draftPlayers.slice(0, count);

    var keepIds = {};
    draftPlayers.forEach(function (p) {
      keepIds[p.id] = true;
    });
    var removingScored = (roundState.players || []).some(function (p) {
      return !keepIds[p.id] && hasStoredPlayerScores(p.id);
    });
    if (
      removingScored &&
      !window.confirm("Remove player(s) and their scores from this game?")
    ) {
      els.playerCountInput.value = String(
        clampPlayerCount(Math.max(2, roundState.players.length))
      );
      draftPlayers = roundState.players.map(function (p, i) {
        return {
          id: p.id,
          name: normalizePlayerName(p.name, i),
          handicap18: p.handicap18,
          handicapPlus: !!p.handicapPlus,
          team: p.team === "B" ? "B" : "A",
          quota: p.quota != null ? p.quota : 18,
        };
      });
      renderPlayersEditor();
      return;
    }

    var prevTeamsEnabled = !!roundState.teamsEnabled;
    var prevTeamRandom = roundState.teamRandom || "manual";
    roundState.teamsEnabled = !!draftTeamsEnabled;
    roundState.teamRandom = draftTeamRandom || "manual";
    roundState.teamScoreMode =
      draftTeamScoreMode === "cumulative" ? "cumulative" : "bestball";
    roundState.teamNames = {
      A: els.teamNameA.value.trim() || "Team A",
      B: els.teamNameB.value.trim() || "Team B",
    };
    if (roundState.teamsEnabled && roundState.teamRandom === "start") {
      var needDraw =
        !wasMulti ||
        !prevTeamsEnabled ||
        prevTeamRandom !== "start" ||
        !roundState.teamsDrawn;
      if (needDraw) assignRandomTeams(draftPlayers);
      roundState.teamsDrawn = true;
    } else if (roundState.teamsEnabled && roundState.teamRandom === "end") {
      roundState.teamsDrawn = false;
    } else if (roundState.teamsEnabled) {
      roundState.teamsDrawn = true;
    } else {
      roundState.teamsDrawn = false;
    }

    var wasNone = !wasMulti;
    roundState.gameType = type;
    roundState.players = draftPlayers;
    roundState.mePlayerId = draftPlayers[0].id;
    pruneRoundScores(roundState.players);
    if (wasNone) {
      Object.keys(scores).forEach(function (h) {
        roundState.scores[roundState.mePlayerId][h] = scores[h];
      });
    }
    syncMeScoresFromRound();
    persistRoundLocal();
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
    boardEdit = null;
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
    boardEdit = null;
  }

  function maybeAdvanceAfterMeScore(hadScore, scored) {
    if (!scored || hadScore) return;
    if (isMultiMode()) {
      if (
        allPlayersScoredHole(course.holes[holeIndex].number) &&
        holeIndex < course.holes.length - 1
      ) {
        holeIndex += 1;
        persistRoundLocal();
      }
      return;
    }
    if (holeIndex < course.holes.length - 1) holeIndex += 1;
  }

  function commitPadScore() {
    if (!course) return;
    if (boardEdit) {
      var edit = boardEdit;
      boardEdit = null;
      var scored = false;
      if (!padDigits) setPlayerScore(edit.playerId, edit.holeNumber, null);
      else {
        var boardVal = parseInt(padDigits, 10);
        if (!isNaN(boardVal) && boardVal >= 1 && boardVal <= 15) {
          setPlayerScore(edit.playerId, edit.holeNumber, boardVal);
          scored = true;
        }
      }
      closeScorePad();
      haptic(14);
      if (
        scored &&
        allPlayersScoredHole(edit.holeNumber) &&
        holeIndex < course.holes.length - 1
      ) {
        holeIndex += 1;
        persistRoundLocal();
      }
      render();
      renderGameBoard();
      return;
    }
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
        persistRoundLocal();
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

  function setHoleHammer(holeNumber, multiplier) {
    if (multiplier == null) delete roundState.hammers[holeNumber];
    else {
      roundState.hammers[holeNumber] = {
        multiplier: multiplier,
        byPlayerId: roundState.mePlayerId,
      };
    }
    persistRoundLocal();
    updatePlayGameActions();
    render();
    renderGameBoard();
  }

  function cycleHoleHammer(holeNumber) {
    if (roundState.gameType !== "hammer") return;
    var cur = hammerForHole(holeNumber);
    if (!cur) setHoleHammer(holeNumber, 2);
    else if (cur.multiplier >= 8) setHoleHammer(holeNumber, null);
    else setHoleHammer(holeNumber, cur.multiplier * 2);
  }

  function stepDownHoleHammer(holeNumber) {
    if (roundState.gameType !== "hammer") return;
    var cur = hammerForHole(holeNumber);
    if (!cur) return;
    if (cur.multiplier <= 2) setHoleHammer(holeNumber, null);
    else setHoleHammer(holeNumber, Math.round(cur.multiplier / 2));
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
        ? "Current hole: " + ham.multiplier + "x"
        : "Current hole: no hammer";
    } else {
      els.gameHammerStatus.hidden = true;
    }
    updatePlayGameActions();
    updateTeamsLabel();

    var showTeams = teamsVisible();
    var isHammer = roundState.gameType === "hammer";
    var players = boardPlayers();
    var aCount = players.filter(function (p) {
      return p.team !== "B";
    }).length;
    var bCount = players.length - aCount;

    var html = '<table class="game-table' + (showTeams ? " has-teams" : "") + '"><thead><tr><th>Hole</th>';
    players.forEach(function (p, index) {
      var headStar =
        gameUsesHandicap() && strokesOnHoleFor(p, hole) > 0
          ? ' <span class="stroke-mark">★</span>'
          : "";
      html +=
        '<th class="' +
        teamColumnSep(p, index, players).trim() +
        '">' +
        (p.name || p.id) +
        headStar +
        "</th>";
    });
    html += "</tr></thead><tbody>";
    course.holes.forEach(function (h, idx) {
      var hHam = hammerForHole(h.number);
      html +=
        '<tr class="' +
        (idx === holeIndex ? "is-active" : "") +
        '"><th>';
      if (isHammer) {
        html +=
          '<button type="button" class="hole-hammer-btn' +
          (hHam ? " is-on" : "") +
          '" data-hammer-hole="' +
          h.number +
          '" aria-label="Adjust hammer for hole ' +
          h.number +
          '">' +
          h.number +
          (hHam
            ? ' <span class="hammer-tag">' + hHam.multiplier + "x</span>"
            : ' <span class="hammer-tag is-off">off</span>') +
          "</button>";
      } else {
        html += String(h.number);
      }
      html += "</th>";
      players.forEach(function (p, index) {
        var sc = getPlayerScore(p.id, h.number);
        var cell =
          '<td class="score-cell' +
          teamColumnSep(p, index, players) +
          '" data-board-pid="' +
          p.id +
          '" data-board-hole="' +
          h.number +
          '">';
        if (isQuota()) {
          var pts = holePoints(p, sc, h);
          cell +=
            sc == null
              ? "—"
              : sc +
                (pts != null ? " <span class='pts'>(" + pts + ")</span>" : "");
        } else if (gameUsesHandicap() || isCompetitive()) {
          cell += formatPlayerScoreHtml(p, sc, h);
        } else {
          cell +=
            sc != null
              ? String(sc)
              : "—";
        }
        html += cell + "</td>";
      });
      html += "</tr>";
    });
    html += '<tr class="game-total-row"><th>Tot</th>';
    players.forEach(function (p, index) {
      var sep = teamColumnSep(p, index, players);
      if (isQuota()) {
        var pts = playerQuotaTotal(p);
        var q = p.quota != null ? p.quota : 18;
        var diff = pts - q;
        html +=
          '<td class="' +
          sep.trim() +
          '">' +
          pts +
          "/" +
          q +
          " <span class='pts'>(" +
          (diff >= 0 ? "+" : "") +
          diff +
          ")</span></td>";
        return;
      }
      var r = playerStrokeTotal(p);
      if (!r.n) html += '<td class="' + sep.trim() + '">—</td>';
      else if (gameUsesHandicap() && playerHcp(p))
        html +=
          '<td class="' + sep.trim() + '">' + r.tot + " / " + r.net + "</td>";
      else html += '<td class="' + sep.trim() + '">' + r.tot + "</td>";
    });
    html += "</tr>";
    if (showTeams && aCount && bCount && !isQuota()) {
      var aScore = teamCombinedScore("A");
      var bScore = teamCombinedScore("B");
      html +=
        '<tr class="team-match-row"><th>' +
        (teamScoreModeSupports() ? teamScoreModeLabel() : "Team") +
        "</th>";
      html +=
        '<td colspan="' +
        aCount +
        '" class="team-match-cell">' +
        '<span class="team-match-names">' +
        teamRosterLabel("A", roundState.players) +
        "</span>" +
        '<span class="team-match-score">' +
        (aScore ? aScore.text : "—") +
        "</span></td>";
      html +=
        '<td colspan="' +
        bCount +
        '" class="team-match-cell team-sep">' +
        '<span class="team-match-names">' +
        teamRosterLabel("B", roundState.players) +
        "</span>" +
        '<span class="team-match-score">' +
        (bScore ? bScore.text : "—") +
        "</span></td>";
      html += "</tr>";
    } else if (showTeams && aCount && bCount && isQuota()) {
      var aQ = teamCombinedScore("A");
      var bQ = teamCombinedScore("B");
      html += '<tr class="team-match-row"><th>Team</th>';
      html +=
        '<td colspan="' +
        aCount +
        '" class="team-match-cell">' +
        '<span class="team-match-names">' +
        teamRosterLabel("A", roundState.players) +
        "</span>" +
        '<span class="team-match-score">' +
        (aQ ? aQ.text : "—") +
        "</span></td>";
      html +=
        '<td colspan="' +
        bCount +
        '" class="team-match-cell team-sep">' +
        '<span class="team-match-names">' +
        teamRosterLabel("B", roundState.players) +
        "</span>" +
        '<span class="team-match-score">' +
        (bQ ? bQ.text : "—") +
        "</span></td>";
      html += "</tr>";
    }
    html += "</tbody></table>";
    els.gameBoard.innerHTML = html;
  }

  function openBoardScoreEdit(playerId, holeNumber) {
    if (!course || !isMultiMode()) return;
    var player = null;
    for (var i = 0; i < roundState.players.length; i++) {
      if (roundState.players[i].id === playerId) {
        player = roundState.players[i];
        break;
      }
    }
    if (!player) return;
    var holeIdx = -1;
    for (var j = 0; j < course.holes.length; j++) {
      if (course.holes[j].number === holeNumber) {
        holeIdx = j;
        break;
      }
    }
    if (holeIdx >= 0) holeIndex = holeIdx;
    boardEdit = { playerId: playerId, holeNumber: holeNumber };
    var score = getPlayerScore(playerId, holeNumber);
    padDigits = score != null ? String(score) : "";
    padReplaceOnType = score != null;
    els.padTitle.textContent =
      (player.name || player.id) + " · Hole " + holeNumber;
    els.padValue.textContent = padDigits || "—";
    els.scorePad.hidden = false;
  }

  function openMultiScorePad() {
    if (!course || !isMultiMode()) return;
    var hole = currentHole();
    multiDraft = {};
    els.multiPadTitle.textContent = "Hole " + hole.number + " scores";
    els.multiScoreList.innerHTML = "";
    boardPlayers().forEach(function (p) {
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
      persistRoundLocal();
    }
    render();
    renderGameBoard();
  }

  function toggleHammer() {
    if (!course || roundState.gameType !== "hammer") return;
    cycleHoleHammer(currentHole().number);
    haptic(16);
  }

  function undoHammer() {
    if (!course || roundState.gameType !== "hammer") return;
    stepDownHoleHammer(currentHole().number);
    haptic(10);
  }

  function render() {
    if (!course) return;
    var hole = currentHole();
    var yards = teeYards(hole);
    var score = getScore(hole.number);

    els.courseName.textContent = course.name;
    els.holeLabel.textContent =
      "Hole " +
      hole.number +
      (!isMultiMode() ? holeStar(hole) : "") +
      " · Par " +
      hole.par;
    els.holeScore.innerHTML = formatScoreHtml(score, hole);
    els.holeScore.className = "hole-score";
    els.holeMeta.textContent = "Hcp " + hole.handicap + " · " + yards + " yd";
    updateStrokeHint();
    updateTeeButton();
    updateHcpButton();
    updateDistances();
    updatePlayGameActions();
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
    persistRoundLocal();
    updatePlayGameActions();
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
        persistRoundLocal();
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
    if (isMultiMode()) {
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
    if (isMultiMode()) {
      roundState.scores = {};
      roundState.players.forEach(function (p) {
        roundState.scores[p.id] = {};
      });
      roundState.hammers = {};
      persistRoundLocal();
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
  els.gameTypeSelect.addEventListener("change", function () {
    updateSettingsGameVisibility();
    renderPlayersEditor();
  });
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
    var btn = event.target.closest("[data-edit-player]");
    if (!btn) return;
    var index = parseInt(btn.getAttribute("data-edit-player"), 10);
    if (isNaN(index)) return;
    openPlayerEdit(index);
    haptic(6);
  });
  els.playerEditCancel.addEventListener("click", closePlayerEdit);
  els.playerEditSave.addEventListener("click", function () {
    savePlayerEdit();
    haptic(10);
  });
  els.playerEditPad.addEventListener("click", function (event) {
    if (event.target === els.playerEditPad) closePlayerEdit();
  });
  document.querySelectorAll("[data-edit-hcp-sign]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      editHcpPlus = btn.getAttribute("data-edit-hcp-sign") === "plus";
      document.querySelectorAll("[data-edit-hcp-sign]").forEach(function (el) {
        el.classList.toggle(
          "is-active",
          el.getAttribute("data-edit-hcp-sign") === (editHcpPlus ? "plus" : "minus")
        );
      });
      haptic(6);
    });
  });
  document.querySelectorAll("[data-edit-team]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      editTeam = btn.getAttribute("data-edit-team");
      els.playerEditTeamA.classList.toggle("is-active", editTeam === "A");
      els.playerEditTeamB.classList.toggle("is-active", editTeam === "B");
      haptic(6);
    });
  });

  document.querySelectorAll("[data-teams-enabled]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      draftTeamsEnabled = btn.getAttribute("data-teams-enabled") === "yes";
      updateTeamsSettingsUi();
      haptic(6);
    });
  });
  els.teamNameA.addEventListener("input", function () {
    if (draftTeamsEnabled) renderPlayersEditor();
  });
  els.teamNameB.addEventListener("input", function () {
    if (draftTeamsEnabled) renderPlayersEditor();
  });
  document.querySelectorAll("[data-team-random]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      draftTeamRandom = btn.getAttribute("data-team-random");
      updateTeamsSettingsUi();
      haptic(6);
    });
  });
  document.querySelectorAll("[data-team-score]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      draftTeamScoreMode = btn.getAttribute("data-team-score");
      updateTeamsSettingsUi();
      haptic(6);
    });
  });
  els.shuffleTeamsBtn.addEventListener("click", function () {
    assignRandomTeams(draftPlayers);
    renderPlayersEditor();
    haptic(10);
  });

  els.drawTeamsBtn.addEventListener("click", function () {
    assignRandomTeams(roundState.players);
    roundState.teamsDrawn = true;
    persistRoundLocal();
    updatePagerMode();
    renderGameBoard();
    haptic(16);
  });

  els.gameBackPlay.addEventListener("click", function () {
    setPagerPage(0);
  });
  els.enterScoresBtn.addEventListener("click", function () {
    bumpActivity();
    openMultiScorePad();
  });
  els.gameHammerBtn.addEventListener("click", toggleHammer);
  els.gameHammerUndoBtn.addEventListener("click", undoHammer);
  els.gameBoard.addEventListener("click", function (event) {
    var hammerBtn = event.target.closest("[data-hammer-hole]");
    if (hammerBtn && els.gameBoard.contains(hammerBtn)) {
      var hammerHole = parseInt(hammerBtn.getAttribute("data-hammer-hole"), 10);
      if (!isNaN(hammerHole)) {
        bumpActivity();
        cycleHoleHammer(hammerHole);
        haptic(10);
      }
      return;
    }
    var cell = event.target.closest("[data-board-pid]");
    if (!cell || !els.gameBoard.contains(cell)) return;
    var pid = cell.getAttribute("data-board-pid");
    var holeNum = parseInt(cell.getAttribute("data-board-hole"), 10);
    if (!pid || isNaN(holeNum)) return;
    bumpActivity();
    openBoardScoreEdit(pid, holeNum);
    haptic(6);
  });
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
      if (isMultiMode()) syncMeScoresFromRound();
      updatePagerMode();
      render();
      renderGameBoard();
      startGpsWatch();
      bumpActivity();
    })
    .catch(function () {
      setStatus("Could not load course JSON.");
    });
})();

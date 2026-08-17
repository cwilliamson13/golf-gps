(function (global) {
  var roomRef = null;
  var listener = null;
  var applyingRemote = false;

  function config() {
    return global.GOLF_GPS_FIREBASE || {};
  }

  function isConfigured() {
    var c = config();
    return !!(c.apiKey && c.databaseURL && c.projectId);
  }

  function ensureApp() {
    if (!isConfigured()) throw new Error("Firebase is not configured");
    if (!global.firebase) throw new Error("Firebase SDK missing");
    if (!firebase.apps.length) firebase.initializeApp(config());
    return firebase.database();
  }

  function randomCode() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    for (var i = 0; i < 4; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  function disconnect() {
    if (roomRef && listener) roomRef.off("value", listener);
    roomRef = null;
    listener = null;
  }

  function pathFor(code) {
    return "rounds/" + String(code).toUpperCase();
  }

  global.GolfGpsSync = {
    isConfigured: isConfigured,
    isApplyingRemote: function () {
      return applyingRemote;
    },
    disconnect: disconnect,
    createRoom: function (roundPayload) {
      var db = ensureApp();
      disconnect();
      var code = randomCode();
      var ref = db.ref(pathFor(code));
      roundPayload.roomCode = code;
      roundPayload.updatedAt = Date.now();
      return ref.set(roundPayload).then(function () {
        roomRef = ref;
        return code;
      });
    },
    joinRoom: function (code) {
      var db = ensureApp();
      disconnect();
      code = String(code || "")
        .trim()
        .toUpperCase();
      if (!code) return Promise.reject(new Error("Enter a room code"));
      var ref = db.ref(pathFor(code));
      return ref.once("value").then(function (snap) {
        if (!snap.exists()) throw new Error("Room not found");
        roomRef = ref;
        return snap.val();
      });
    },
    subscribe: function (onRound) {
      if (!roomRef) return;
      if (listener) roomRef.off("value", listener);
      listener = function (snap) {
        if (!snap.exists()) return;
        applyingRemote = true;
        try {
          onRound(snap.val());
        } finally {
          applyingRemote = false;
        }
      };
      roomRef.on("value", listener);
    },
    pushRound: function (roundPayload) {
      if (!roomRef || applyingRemote) return Promise.resolve();
      roundPayload.updatedAt = Date.now();
      return roomRef.set(roundPayload);
    },
  };
})(window);

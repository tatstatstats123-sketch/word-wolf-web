
/************************************************************
 * game.js
 * Final refactor for Word Wolf
 * - GM-only authority
 * - Reconnect safe (players + GM)
 * - FSM-driven UI
 * - Discussion auto -> voting
 * - Voting timer informational only
 ************************************************************/

/**************** FIREBASE INIT (UNCHANGED) ****************/
const firebaseConfig = {
  apiKey: "AIzaSyB-20YXJgpcqGMpxVh94ltapvAAss6zZbk",
  authDomain: "word-wolf-3e9b5.firebaseapp.com",
  databaseURL: "https://word-wolf-3e9b5-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "word-wolf-3e9b5",
  storageBucket: "word-wolf-3e9b5.firebasestorage.app",
  messagingSenderId: "14427140581",
  appId: "1:14427140581:web:eeb1e46af3940c7e727f0c"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

/**************** IDENTITY ****************/
const roomCode = localStorage.getItem("roomCode");
let playerId = localStorage.getItem("playerId");
if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("playerId", playerId);
}

const gmSessionId = crypto.randomUUID();

/**************** UTIL ****************/
function qs(id) { return document.getElementById(id); }
function hideAll() {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
}
function show(id) { qs(id)?.classList.add("active"); }

/**************** ROOM LISTENER ****************/
database.ref(`rooms/${roomCode}`).on("value", snap => {
  const room = snap.val();
  if (!room) return;
  render(room);
  syncDiscussionTimer(room);
  syncVotingTimer(room);
});

/**************** FSM RENDER ****************/
function render(room) {
  hideAll();
  const isGM = room.gameData?.gameMasterId === playerId;

  switch (room.status) {
    case "lobby":
      show("lobbyScreen");
      break;

    case "gm-selecting":
      isGM ? show("wolfWordSelectionScreen") : showWaiting();
      break;

    case "words":
      isGM ? show("gmDiscussionScreen") : showPlayerWord(room);
      break;

    case "discussion":
      isGM ? show("gmDiscussionScreen") : showDiscussion(room);
      break;

    case "voting":
      show("votingScreen");
      break;

    case "results":
      show("resultsScreen");
      break;
  }
}

/**************** UI HELPERS ****************/
function showWaiting() {
  show("wordScreen");
  qs("myWordCard").textContent = "待機中...";
}
function showPlayerWord(room) {
  show("wordScreen");
  qs("myWordCard").textContent =
    room.gameData.playerWords[playerId]?.word || "";
}
function showDiscussion(room) {
  show("discussionScreen");
  qs("discussionWord").textContent =
    room.gameData.playerWords[playerId]?.word || "";
}

/**************** GM ACTIONS ****************/
window.submitWords = () => {
  database.ref(`rooms/${roomCode}/status`).set("words");
};

window.gmStartDiscussion = () => {
  database.ref(`rooms/${roomCode}/gameData`).update({
    discussionStartedAt: Date.now(),
    discussionDuration: 180,
    gmSessionId
  });
  database.ref(`rooms/${roomCode}/status`).set("discussion");
};

window.gmEndDiscussion = () => {
  database.ref(`rooms/${roomCode}/status`).set("voting");
};

window.gmShowResults = () => {
  database.ref(`rooms/${roomCode}/status`).set("results");
};

/**************** DISCUSSION TIMER ****************/
let discussionInterval = null;
function syncDiscussionTimer(room) {
  clearInterval(discussionInterval);
  if (room.status !== "discussion") return;

  discussionInterval = setInterval(() => {
    const end =
      room.gameData.discussionStartedAt +
      room.gameData.discussionDuration * 1000;
    const remaining = Math.max(0, end - Date.now());
    const s = Math.floor(remaining / 1000);
    const m = Math.floor(s / 60);
    const text = `${m}:${String(s % 60).padStart(2, "0")}`;

    qs("timer") && (qs("timer").textContent = text);
    qs("gmTimer") && (qs("gmTimer").textContent = text);

    if (remaining <= 0) {
      database.ref(`rooms/${roomCode}/status`).set("voting");
      clearInterval(discussionInterval);
    }
  }, 500);
}

/**************** VOTING TIMER (INFO ONLY) ****************/
let votingInterval = null;
function syncVotingTimer(room) {
  clearInterval(votingInterval);
  if (room.status !== "voting") return;

  const start =
    room.gameData.votingStartedAt || Date.now();

  database.ref(`rooms/${roomCode}/gameData/votingStartedAt`).set(start);

  votingInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const remaining = Math.max(0, 60 - elapsed);
    qs("voteTimer") &&
      (qs("voteTimer").textContent = `0:${String(remaining).padStart(2, "0")}`);
  }, 500);
}

/**************** SAFETY ****************/
window.addEventListener("beforeunload", () => {
  // intentionally empty — refresh safe
});

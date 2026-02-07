
/************************************************************
 * game.js (UPDATED)
 * - Voting fully wired -> results
 * - Wolf-guess phase authority verified
 ************************************************************/

/**************** FIREBASE INIT ****************/
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
function qs(id){return document.getElementById(id);}
function hideAll(){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));}
function show(id){qs(id)?.classList.add('active');}

/**************** ROOM LISTENER ****************/
database.ref(`rooms/${roomCode}`).on('value', snap=>{
  const room = snap.val();
  if(!room) return;
  render(room);
  syncDiscussionTimer(room);
  syncVotingTimer(room);
});

/**************** FSM ****************/
function render(room){
  hideAll();
  const isGM = room.gameData?.gameMasterId === playerId;
  const myWord = room.gameData?.playerWords?.[playerId]?.word;
  const isWolf = room.gameData?.playerWords?.[playerId]?.isWolf;

  switch(room.status){
    case 'lobby': show('lobbyScreen'); break;
    case 'gm-selecting': isGM?show('wolfWordSelectionScreen'):showWaiting(); break;
    case 'words': isGM?show('gmDiscussionScreen'):showWord(myWord); break;
    case 'discussion': isGM?show('gmDiscussionScreen'):showDiscussion(myWord); break;
    case 'voting': show('votingScreen'); break;
    case 'wolf-guess':
      isWolf ? show('wolfGuessScreen') : show('wolfWaitingScreen');
      break;
    case 'results': show('resultsScreen'); break;
  }
}

/**************** UI HELPERS ****************/
function showWaiting(){show('wordScreen');qs('myWordCard').textContent='待機中...';}
function showWord(word){show('wordScreen');qs('myWordCard').textContent=word||'';}
function showDiscussion(word){show('discussionScreen');qs('discussionWord').textContent=word||'';}

/**************** GM ACTIONS ****************/
window.submitWords=()=>database.ref(`rooms/${roomCode}/status`).set('words');

window.gmStartDiscussion=()=>{
  database.ref(`rooms/${roomCode}/gameData`).update({
    discussionStartedAt:Date.now(),
    discussionDuration:180,
    gmSessionId
  });
  database.ref(`rooms/${roomCode}/status`).set('discussion');
};

window.gmEndDiscussion=()=>database.ref(`rooms/${roomCode}/status`).set('voting');

window.gmForceVotingEnd=()=>{
  tallyVotesAndAdvance();
};

/**************** VOTING ****************/
window.castVote=function(targetId){
  database.ref(`rooms/${roomCode}/votes/${playerId}`).set(targetId);
};

function tallyVotesAndAdvance(){
  database.ref(`rooms/${roomCode}`).once('value').then(snap=>{
    const room=snap.val();
    if(room.gameData.gameMasterId!==playerId) return;

    const votes=room.votes||{};
    const tally={};
    Object.values(votes).forEach(v=>{
      tally[v]=(tally[v]||0)+1;
    });

    let max=0, eliminated=null;
    for(const [pid,count] of Object.entries(tally)){
      if(count>max){max=count;eliminated=pid;}
    }

    database.ref(`rooms/${roomCode}/gameData/eliminatedPlayer`).set(eliminated);

    const eliminatedIsWolf = room.gameData.playerWords[eliminated]?.isWolf;
    database.ref(`rooms/${roomCode}/status`).set(
      eliminatedIsWolf ? 'results' : 'wolf-guess'
    );
  });
}

/**************** WOLF GUESS ****************/
window.submitWolfGuess=function(guessWord){
  database.ref(`rooms/${roomCode}`).once('value').then(snap=>{
    const room=snap.val();
    const wolfEntry=Object.entries(room.gameData.playerWords)
      .find(([_,v])=>v.isWolf);
    if(!wolfEntry || wolfEntry[0]!==playerId) return;

    const correct=guessWord===room.gameData.citizenWord;
    database.ref(`rooms/${roomCode}/gameData/wolfGuessCorrect`).set(correct);
    database.ref(`rooms/${roomCode}/status`).set('results');
  });
};

/**************** DISCUSSION TIMER ****************/
let discussionInterval=null;
function syncDiscussionTimer(room){
  clearInterval(discussionInterval);
  if(room.status!=='discussion') return;
  discussionInterval=setInterval(()=>{
    const end=room.gameData.discussionStartedAt+room.gameData.discussionDuration*1000;
    const r=Math.max(0,end-Date.now());
    const s=Math.floor(r/1000);
    const m=Math.floor(s/60);
    const txt=`${m}:${String(s%60).padStart(2,'0')}`;
    qs('timer')&&(qs('timer').textContent=txt);
    qs('gmTimer')&&(qs('gmTimer').textContent=txt);
    if(r<=0){
      database.ref(`rooms/${roomCode}/status`).set('voting');
      clearInterval(discussionInterval);
    }
  },500);
}

/**************** VOTING TIMER (INFO) ****************/
let votingInterval=null;
function syncVotingTimer(room){
  clearInterval(votingInterval);
  if(room.status!=='voting') return;
  const start=room.gameData.votingStartedAt||Date.now();
  database.ref(`rooms/${roomCode}/gameData/votingStartedAt`).set(start);
  votingInterval=setInterval(()=>{
    const e=Math.floor((Date.now()-start)/1000);
    const r=Math.max(0,60-e);
    qs('voteTimer')&&(qs('voteTimer').textContent=`0:${String(r).padStart(2,'0')}`);
  },500);
}

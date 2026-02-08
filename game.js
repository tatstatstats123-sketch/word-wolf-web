
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
let roomCode = localStorage.getItem("roomCode");
let playerId = localStorage.getItem("playerId");
if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("playerId", playerId);
}
const gmSessionId = crypto.randomUUID();
let currentRoom = null;

/**************** UTIL ****************/
function qs(id){return document.getElementById(id);}
function hideAll(){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));}
function show(id){qs(id)?.classList.add('active');}

/**************** TAB SWITCHING ****************/
window.showTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
  
  if (tab === 'create') {
    document.querySelector('.tab-btn').classList.add('active');
    qs('createTab').style.display = 'block';
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    qs('joinTab').style.display = 'block';
  }
};

/**************** ROOM CREATION & JOINING ****************/
window.createRoom = function() {
  const name = qs('hostName').value.trim();
  if (!name) {
    alert('名前を入力してください');
    return;
  }
  
  const code = generateRoomCode();
  roomCode = code;
  localStorage.setItem('roomCode', code);
  
  database.ref(`rooms/${code}`).set({
    hostId: playerId,
    status: 'lobby',
    players: {
      [playerId]: { name, isHost: true }
    },
    gameData: {}
  }).then(() => {
    qs('displayRoomCode').textContent = code;
    hideAll();
    show('lobbyScreen');
  });
};

window.joinRoom = function() {
  const name = qs('playerName').value.trim();
  const code = qs('roomCode').value.trim().toUpperCase();
  
  if (!name || !code) {
    alert('名前とルームコードを入力してください');
    return;
  }
  
  database.ref(`rooms/${code}`).once('value').then(snap => {
    if (!snap.exists()) {
      alert('ルームが見つかりません');
      return;
    }
    
    roomCode = code;
    localStorage.setItem('roomCode', code);
    
    database.ref(`rooms/${code}/players/${playerId}`).set({
      name,
      isHost: false
    }).then(() => {
      qs('displayRoomCode').textContent = code;
      hideAll();
      show('lobbyScreen');
    });
  });
};

window.leaveRoom = function() {
  if (!roomCode) return;
  
  database.ref(`rooms/${roomCode}/players/${playerId}`).remove().then(() => {
    localStorage.removeItem('roomCode');
    roomCode = null;
    hideAll();
    show('homeScreen');
  });
};

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**************** GAME START ****************/
window.updateStartButton = function() {
  const gmId = qs('gameMasterSelect')?.value;
  const players = currentRoom?.players || {};
  const playerCount = Object.keys(players).length;
  const btn = qs('startGameBtn');
  
  if (btn) {
    btn.disabled = !gmId || playerCount < 4;
    btn.textContent = !gmId ? 'ゲーム開始（GMを選択）' : 
                      playerCount < 4 ? `ゲーム開始（あと${4-playerCount}人必要）` :
                      'ゲーム開始';
  }
};

window.startGame = function() {
  const gmId = qs('gameMasterSelect').value;
  const wolfCount = parseInt(qs('wolfCountLobby').value);
  const wordMode = qs('wordModeLobby').value;
  const timerDuration = parseInt(qs('timerDuration').value);
  
  if (!gmId) {
    alert('GMを選択してください');
    return;
  }
  
  const players = currentRoom.players;
  const playerIds = Object.keys(players).filter(id => id !== gmId);
  
  if (playerIds.length < 3) {
    alert('プレイヤーが足りません（GM以外に3人必要）');
    return;
  }
  
  // Select wolves randomly
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const wolves = shuffled.slice(0, wolfCount);
  
  const gameData = {
    gameMasterId: gmId,
    wolfCount,
    wordMode,
    discussionDuration: timerDuration,
    wolves,
    playerWords: {}
  };
  
  if (wordMode === 'custom') {
    database.ref(`rooms/${roomCode}`).update({
      status: 'gm-selecting',
      gameData
    });
  } else {
    // Random words
    const wordPairs = [
      {citizen: 'コーヒー', wolf: '紅茶'},
      {citizen: '犬', wolf: '猫'},
      {citizen: 'ラーメン', wolf: 'うどん'},
      {citizen: '夏', wolf: '冬'},
      {citizen: 'りんご', wolf: 'みかん'}
    ];
    const pair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
    
    gameData.citizenWord = pair.citizen;
    gameData.wolfWord = pair.wolf;
    
    playerIds.forEach(pid => {
      gameData.playerWords[pid] = {
        word: wolves.includes(pid) ? pair.wolf : pair.citizen,
        isWolf: wolves.includes(pid),
        ready: false
      };
    });
    
    database.ref(`rooms/${roomCode}`).update({
      status: 'words',
      gameData
    });
  }
};

window.submitGMWords = function() {
  const citizenWord = qs('wolfCitizenWord').value.trim();
  const wolfWord = qs('wolfWolfWord').value.trim();
  
  if (!citizenWord || !wolfWord) {
    alert('両方のお題を入力してください');
    return;
  }
  
  database.ref(`rooms/${roomCode}`).once('value').then(snap => {
    const room = snap.val();
    const gmId = room.gameData.gameMasterId;
    const wolves = room.gameData.wolves;
    const playerIds = Object.keys(room.players).filter(id => id !== gmId);
    
    const playerWords = {};
    playerIds.forEach(pid => {
      playerWords[pid] = {
        word: wolves.includes(pid) ? wolfWord : citizenWord,
        isWolf: wolves.includes(pid),
        ready: false
      };
    });
    
    database.ref(`rooms/${roomCode}/gameData`).update({
      citizenWord,
      wolfWord,
      playerWords
    });
    
    database.ref(`rooms/${roomCode}/status`).set('words');
  });
};

window.markReady = function() {
  database.ref(`rooms/${roomCode}/gameData/playerWords/${playerId}/ready`).set(true);
  qs('readyBtn').disabled = true;
};

window.startDiscussionTimer = function() {
  database.ref(`rooms/${roomCode}/gameData`).update({
    discussionStartedAt: Date.now(),
    gmSessionId
  });
  database.ref(`rooms/${roomCode}/status`).set('discussion');
};

window.endDiscussion = function() {
  database.ref(`rooms/${roomCode}/status`).set('voting');
};

window.backToLobby = function() {
  database.ref(`rooms/${roomCode}`).update({
    status: 'lobby',
    gameData: {},
    votes: null
  });
};

/**************** ROOM LISTENER ****************/
if (roomCode) {
  database.ref(`rooms/${roomCode}`).on('value', snap=>{
    const room = snap.val();
    if(!room) return;
    currentRoom = room;
    
    // Update lobby
    if (room.status === 'lobby') {
      updateLobby(room);
    }
    
    render(room);
    syncDiscussionTimer(room);
    syncVotingTimer(room);
  });
} else {
  // Show home screen if no room code
  hideAll();
  show('homeScreen');
}

function updateLobby(room) {
  const players = room.players || {};
  const playerIds = Object.keys(players);
  
  qs('playerCount').textContent = playerIds.length;
  
  const playersList = qs('playersList');
  if (playersList) {
    playersList.innerHTML = playerIds.map(pid => `
      <div class="player-item">
        <span class="player-name">${players[pid].name}</span>
        ${players[pid].isHost ? '<span class="host-badge">ホスト</span>' : ''}
      </div>
    `).join('');
  }
  
  // Show host controls or player waiting
  const isHost = room.hostId === playerId;
  if (qs('hostControls')) qs('hostControls').style.display = isHost ? 'block' : 'none';
  if (qs('playerWaiting')) qs('playerWaiting').style.display = isHost ? 'none' : 'block';
  
  // Update GM select
  const gmSelect = qs('gameMasterSelect');
  if (gmSelect && isHost) {
    gmSelect.innerHTML = '<option value="">選択してください</option>' +
      playerIds.map(pid => `<option value="${pid}">${players[pid].name}</option>`).join('');
  }
  
  updateStartButton();
}

/**************** FSM ****************/
function render(room){
  hideAll();
  const isGM = room.gameData?.gameMasterId === playerId;
  const myWord = room.gameData?.playerWords?.[playerId]?.word;
  const isWolf = room.gameData?.playerWords?.[playerId]?.isWolf;

  switch(room.status){
    case 'lobby': 
      show('lobbyScreen'); 
      break;
    case 'gm-selecting': 
      isGM ? show('wolfWordSelectionScreen') : showWaiting(); 
      break;
    case 'words': 
      if (isGM) {
        show('gameMasterScreen');
        updateGMScreen(room);
      } else {
        showWord(myWord);
        updateWordScreen(room);
      }
      break;
    case 'discussion': 
      if (isGM) {
        show('gameMasterScreen');
        updateGMScreen(room);
      } else {
        showDiscussion(myWord);
      }
      break;
    case 'voting': 
      show('votingScreen');
      updateVotingScreen(room);
      break;
    case 'wolf-guess':
      isWolf ? show('wolfGuessScreen') : show('wolfWaitingScreen');
      if (isWolf) updateWolfGuessScreen(room);
      break;
    case 'results': 
      show('resultsScreen');
      updateResultsScreen(room);
      break;
  }
}

function updateWordScreen(room) {
  const playerWords = room.gameData?.playerWords || {};
  const ready = Object.values(playerWords).filter(p => p.ready).length;
  const total = Object.keys(playerWords).length;
  
  if (qs('readyCount')) qs('readyCount').textContent = ready;
  if (qs('totalPlayers')) qs('totalPlayers').textContent = total;
  
  if (playerWords[playerId]?.ready) {
    qs('readyBtn').disabled = true;
  }
}

function updateGMScreen(room) {
  if (qs('gmCitizenWord')) qs('gmCitizenWord').textContent = room.gameData.citizenWord || '';
  if (qs('gmWolfWord')) qs('gmWolfWord').textContent = room.gameData.wolfWord || '';
  
  const wolves = room.gameData.wolves || [];
  const players = room.players || {};
  const wolfNames = wolves.map(id => players[id]?.name || id).join(', ');
  if (qs('gmWolfPlayers')) qs('gmWolfPlayers').textContent = wolfNames;
  
  const gmPlayersList = qs('gmPlayersList');
  if (gmPlayersList && room.gameData.playerWords) {
    const playerWords = room.gameData.playerWords;
    gmPlayersList.innerHTML = Object.entries(playerWords).map(([pid, data]) => `
      <div class="player-item">
        <span class="player-name">${players[pid]?.name || pid}</span>
        <span>${data.isWolf ? '🐺 Wolf' : '👤 Citizen'} - ${data.ready ? '✓ Ready' : 'Waiting...'}</span>
      </div>
    `).join('');
  }
}

function updateVotingScreen(room) {
  const players = room.players || {};
  const gmId = room.gameData?.gameMasterId;
  const votes = room.votes || {};
  const myVote = votes[playerId];
  
  const votingGrid = qs('votingGrid');
  if (votingGrid) {
    const playerIds = Object.keys(players).filter(id => id !== gmId);
    votingGrid.innerHTML = playerIds.map(pid => `
      <button class="vote-btn ${myVote === pid ? 'voted' : ''}" 
              onclick="castVote('${pid}')"
              ${myVote ? 'disabled' : ''}>
        ${players[pid].name}
      </button>
    `).join('');
  }
  
  const votedCount = Object.keys(votes).length;
  const totalVoters = Object.keys(players).length - 1; // Exclude GM
  if (qs('votedCount')) qs('votedCount').textContent = votedCount;
  if (qs('totalVoters')) qs('totalVoters').textContent = totalVoters;
}

function updateWolfGuessScreen(room) {
  const content = qs('wolfGuessContent');
  if (content) {
    content.innerHTML = `
      <div class="input-group">
        <label for="wolfGuessInput">市民のお題を推理：</label>
        <input type="text" id="wolfGuessInput" placeholder="お題を入力">
      </div>
      <button onclick="submitWolfGuess(document.getElementById('wolfGuessInput').value)">
        回答する
      </button>
    `;
  }
}

function updateResultsScreen(room) {
  const players = room.players || {};
  const gameData = room.gameData || {};
  const votes = room.votes || {};
  
  if (qs('citizenWordResult')) qs('citizenWordResult').textContent = gameData.citizenWord || '';
  if (qs('wolfWordResult')) qs('wolfWordResult').textContent = gameData.wolfWord || '';
  
  const wolves = gameData.wolves || [];
  const wolfNames = wolves.map(id => players[id]?.name || id).join(', ');
  if (qs('wolfPlayersResult')) qs('wolfPlayersResult').textContent = wolfNames;
  
  const eliminated = gameData.eliminatedPlayer;
  if (qs('votedPlayerResult')) {
    qs('votedPlayerResult').textContent = players[eliminated]?.name || '';
  }
  
  // Vote breakdown
  const breakdown = qs('voteBreakdown');
  if (breakdown) {
    const tally = {};
    Object.values(votes).forEach(v => {
      tally[v] = (tally[v] || 0) + 1;
    });
    
    breakdown.innerHTML = '<h3 style="margin-bottom: 10px;">投票結果</h3>' +
      Object.entries(tally).map(([pid, count]) => `
        <p>${players[pid]?.name}: ${count}票</p>
      `).join('');
  }
  
  // Determine winner
  const eliminatedIsWolf = gameData.playerWords?.[eliminated]?.isWolf;
  const wolfGuessCorrect = gameData.wolfGuessCorrect;
  
  let winnerText = '';
  if (wolfGuessCorrect) {
    winnerText = '🐺 ウルフの勝利！市民のお題を当てました！';
  } else if (eliminatedIsWolf) {
    winnerText = '👥 市民の勝利！ウルフを見つけました！';
  } else {
    winnerText = '🐺 ウルフの勝利！市民を騙しました！';
  }
  
  if (qs('winnerText')) qs('winnerText').textContent = winnerText;
  
  const isHost = room.hostId === playerId;
  if (qs('hostResultControls')) qs('hostResultControls').style.display = isHost ? 'block' : 'none';
}

/**************** UI HELPERS ****************/
function showWaiting(){show('wordScreen');qs('myWordCard').textContent='待機中...';}
function showWord(word){show('wordScreen');qs('myWordCard').textContent=word||'';}
function showDiscussion(word){
  show('discussionScreen');
  const card = qs('discussionWordCard');
  if (card) card.textContent = word || '';
}

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

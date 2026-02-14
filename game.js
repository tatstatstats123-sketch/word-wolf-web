
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
    attachRoomListener(); // Attach listener after creating room
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
      attachRoomListener(); // Attach listener after joining room
    });
  });
};

window.leaveRoom = function() {
  if (!roomCode) return;
  
  // Detach Firebase listener
  database.ref(`rooms/${roomCode}`).off();
  
  // Clear any running intervals
  clearInterval(discussionInterval);
  clearInterval(votingInterval);
  
  // Remove player from room
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
      {citizen: 'りんご', wolf: 'みかん'},
      {citizen: 'サッカー', wolf: '野球'},
      {citizen: '映画', wolf: 'ドラマ'},
      {citizen: '朝', wolf: '夜'},
      {citizen: '山', wolf: '海'},
      {citizen: 'カレー', wolf: 'シチュー'},
      {citizen: 'ピアノ', wolf: 'ギター'},
      {citizen: '電車', wolf: 'バス'},
      {citizen: '漫画', wolf: 'アニメ'},
      {citizen: 'チョコレート', wolf: 'キャンディ'},
      {citizen: '医者', wolf: '看護師'},
      {citizen: 'スマホ', wolf: 'パソコン'},
      {citizen: '寿司', wolf: '刺身'},
      {citizen: '読書', wolf: 'ゲーム'},
      {citizen: '日本', wolf: '中国'},
      {citizen: 'サンタクロース', wolf: 'トナカイ'}
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
  
  if (citizenWord === wolfWord) {
    alert('市民とウルフのお題は違うものにしてください');
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

window.playAgain = function() {
  database.ref(`rooms/${roomCode}`).once('value').then(snap => {
    const room = snap.val();
    
    // Save settings from last game (except GM selection)
    const savedSettings = {
      wolfCount: room.gameData?.wolfCount || 1,
      wordMode: room.gameData?.wordMode || 'random',
      discussionDuration: room.gameData?.discussionDuration || 180
    };
    
    // Clear game state and return to lobby with saved settings
    database.ref(`rooms/${roomCode}`).update({
      status: 'lobby',
      gameData: { savedSettings },
      votes: null
    });
  });
};

/**************** ROOM LISTENER ****************/
function attachRoomListener() {
  if (!roomCode) return;
  
  console.log('[Listener] Attaching room listener for room:', roomCode);
  
  database.ref(`rooms/${roomCode}`).on('value', snap=>{
    const room = snap.val();
    console.log('[Listener] Room update received, status:', room?.status);
    
    // If room doesn't exist or player was removed, clear localStorage and go home
    if(!room || !room.players?.[playerId]) {
      if (!room || !room.players?.[playerId]) {
        localStorage.removeItem('roomCode');
        roomCode = null;
        hideAll();
        show('homeScreen');
        return;
      }
    }
    
    currentRoom = room;
    
    // Update lobby
    if (room.status === 'lobby') {
      updateLobby(room);
    }
    
    console.log('[Listener] Calling render for status:', room.status);
    render(room);
    syncDiscussionTimer(room);
    syncVotingTimer(room);
    syncWolfGuessTimer(room);
  });
}

// Attach listener on page load if room code exists
if (roomCode) {
  attachRoomListener();
} else {
  // Show home screen if no room code
  hideAll();
  show('homeScreen');
}

function updateLobby(room) {
  const players = room.players || {};
  const playerIds = Object.keys(players);
  
  // Update room code display
  if (qs('displayRoomCode')) {
    qs('displayRoomCode').textContent = roomCode || '';
  }
  
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
  
  // Pre-fill settings from last game if available
  if (isHost && room.gameData?.savedSettings) {
    const saved = room.gameData.savedSettings;
    if (qs('wolfCountLobby') && saved.wolfCount) {
      qs('wolfCountLobby').value = saved.wolfCount;
    }
    if (qs('wordModeLobby') && saved.wordMode) {
      qs('wordModeLobby').value = saved.wordMode;
    }
    if (qs('timerDuration') && saved.discussionDuration) {
      qs('timerDuration').value = saved.discussionDuration;
    }
  }
  
  updateStartButton();
}

/**************** FSM ****************/
function render(room){
  console.log('[Render] Called with status:', room.status, 'isGM:', room.gameData?.gameMasterId === playerId);
  hideAll();
  const isGM = room.gameData?.gameMasterId === playerId;
  const myWord = room.gameData?.playerWords?.[playerId]?.word;
  const isWolf = room.gameData?.playerWords?.[playerId]?.isWolf;

  switch(room.status){
    case 'lobby': 
      console.log('[Render] Showing lobby');
      show('lobbyScreen'); 
      break;
    case 'gm-selecting': 
      console.log('[Render] GM selecting words');
      isGM ? show('wolfWordSelectionScreen') : showWaiting(); 
      break;
    case 'words': 
      console.log('[Render] Words phase, isGM:', isGM);
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
      console.log('[Render] Voting phase, isGM:', isGM);
      if (isGM) {
        console.log('[Render] Showing gmVotingScreen');
        show('gmVotingScreen');
        updateGMVotingScreen(room);
      } else {
        console.log('[Render] Showing votingScreen');
        show('votingScreen');
        updateVotingScreen(room);
      }
      break;
    case 'wolf-guess':
      const guessingWolf = room.gameData?.guessingWolf;
      const isGuessingWolf = guessingWolf === playerId;
      
      if (isGuessingWolf) {
        show('wolfGuessScreen');
        updateWolfGuessScreen(room);
      } else {
        show('wolfWaitingScreen');
        updateWolfWaitingMessage('wolf-guess');
      }
      break;
    case 'gm-reviewing':
      if (isGM) {
        show('gmReviewScreen');
        updateGMReviewScreen(room);
      } else {
        show('wolfWaitingScreen');
        updateWolfWaitingMessage('gm-reviewing');
      }
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
  
  const myWord = playerWords[playerId]?.word;
  const readyBtn = qs('readyBtn');
  
  // Disable ready button if no word assigned yet OR already marked ready
  if (readyBtn) {
    if (!myWord) {
      readyBtn.disabled = true;
      readyBtn.textContent = 'お題を待っています...';
    } else if (playerWords[playerId]?.ready) {
      readyBtn.disabled = true;
      readyBtn.textContent = '準備完了';
    } else {
      readyBtn.disabled = false;
      readyBtn.textContent = '準備完了';
    }
  }
}

function updateGMScreen(room) {
  console.log('[GM Screen] updateGMScreen called, status:', room.status);
  
  if (qs('gmCitizenWord')) qs('gmCitizenWord').textContent = room.gameData.citizenWord || '';
  if (qs('gmWolfWord')) qs('gmWolfWord').textContent = room.gameData.wolfWord || '';
  
  const wolves = room.gameData.wolves || [];
  const players = room.players || {};
  const wolfNames = wolves.map(id => players[id]?.name || id).join(', ');
  if (qs('gmWolfPlayers')) qs('gmWolfPlayers').textContent = wolfNames;
  
  // Show manual button for GM to start discussion when all players ready
  if (room.status === 'words' && room.gameData?.playerWords) {
    const playerWords = room.gameData.playerWords;
    const ready = Object.values(playerWords).filter(p => p.ready).length;
    const total = Object.keys(playerWords).length;
    
    console.log('[GM Screen] Ready check:', {ready, total, status: room.status, isGM: room.gameData?.gameMasterId === playerId});
    
    // Show manual start button
    const gmStartDiscussionBtn = qs('gmStartDiscussionBtn');
    console.log('[GM Screen] Button element found:', gmStartDiscussionBtn !== null);
    
    if (gmStartDiscussionBtn) {
      gmStartDiscussionBtn.style.display = 'block';
      
      if (ready === total && total > 0) {
        console.log('[GM Screen] All ready! Enabling button');
        gmStartDiscussionBtn.disabled = false;
        gmStartDiscussionBtn.textContent = '全員準備完了 - 話し合い開始';
      } else {
        console.log('[GM Screen] Not all ready, disabling button. Ready:', ready, 'Total:', total);
        gmStartDiscussionBtn.disabled = true;
        gmStartDiscussionBtn.textContent = `準備完了待ち (${ready}/${total})`;
      }
    } else {
      console.error('[GM Screen] gmStartDiscussionBtn element not found!');
    }
  } else {
    // Hide the button if not in words phase
    const gmStartDiscussionBtn = qs('gmStartDiscussionBtn');
    if (gmStartDiscussionBtn) {
      gmStartDiscussionBtn.style.display = 'none';
    }
  }
  
  // Show/hide timer controls based on status and whether timer has started
  const isDiscussion = room.status === 'discussion';
  const timerStarted = room.gameData?.discussionStartedAt;
  
  if (qs('gmTimerDisplay')) qs('gmTimerDisplay').style.display = isDiscussion && timerStarted ? 'block' : 'none';
  if (qs('gmDiscussionControls')) qs('gmDiscussionControls').style.display = isDiscussion ? 'block' : 'none';
  
  // Update button visibility based on timer state
  if (isDiscussion) {
    const startBtn = qs('gmStartTimerBtn');
    const endBtn = qs('gmEndDiscussionBtn');
    
    if (startBtn) startBtn.style.display = timerStarted ? 'none' : 'inline-block';
    if (endBtn) endBtn.style.display = timerStarted ? 'inline-block' : 'none';
  }
  
  const gmPlayersList = qs('gmPlayersList');
  if (gmPlayersList && room.gameData.playerWords) {
    const playerWords = room.gameData.playerWords;
    gmPlayersList.innerHTML = Object.entries(playerWords).map(([pid, data]) => `
      <div class="player-item">
        <span class="player-name">${players[pid]?.name || pid}</span>
        <span>${data.isWolf ? '🐺 ウルフ' : '👤 市民'} - ${data.ready ? '✓ 準備完了' : '待機中...'}</span>
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

function updateGMVotingScreen(room) {
  console.log('[GM Voting] updateGMVotingScreen called');
  
  const players = room.players || {};
  const votes = room.votes || {};
  const gmId = room.gameData?.gameMasterId;
  
  console.log('[GM Voting] Players:', Object.keys(players).length, 'Votes:', Object.keys(votes).length);
  
  // Show game info
  if (qs('gmVotingCitizenWord')) qs('gmVotingCitizenWord').textContent = room.gameData?.citizenWord || '';
  if (qs('gmVotingWolfWord')) qs('gmVotingWolfWord').textContent = room.gameData?.wolfWord || '';
  
  const wolves = room.gameData?.wolves || [];
  const wolfNames = wolves.map(id => players[id]?.name || id).join(', ');
  if (qs('gmVotingWolfPlayers')) qs('gmVotingWolfPlayers').textContent = wolfNames;
  
  // Show voting status for each player
  const gmVotingPlayersList = qs('gmVotingPlayersList');
  if (gmVotingPlayersList) {
    const playerIds = Object.keys(players).filter(id => id !== gmId);
    gmVotingPlayersList.innerHTML = playerIds.map(pid => {
      const hasVoted = votes[pid] !== undefined;
      const votedFor = hasVoted ? players[votes[pid]]?.name : '';
      return `
        <div class="player-item">
          <span class="player-name">${players[pid]?.name || pid}</span>
          <span>${hasVoted ? `✓ 投票済み → ${votedFor}` : '待機中...'}</span>
        </div>
      `;
    }).join('');
  }
  
  // Update vote counts
  const votedCount = Object.keys(votes).length;
  const totalVoters = Object.keys(players).length - 1; // Exclude GM
  if (qs('gmVotedCount')) qs('gmVotedCount').textContent = votedCount;
  if (qs('gmTotalVoters')) qs('gmTotalVoters').textContent = totalVoters;
  
  console.log('[GM Voting] Vote count:', votedCount, '/', totalVoters);
  
  // Enable/disable tally button based on voting status
  const gmTallyBtn = qs('gmTallyVotesBtn');
  console.log('[GM Voting] Tally button found:', gmTallyBtn !== null);
  
  if (gmTallyBtn) {
    if (votedCount === totalVoters && totalVoters > 0) {
      console.log('[GM Voting] All voted! Enabling button');
      gmTallyBtn.disabled = false;
      gmTallyBtn.textContent = '全員投票完了 - 投票集計';
    } else {
      console.log('[GM Voting] Not all voted, disabling button');
      gmTallyBtn.disabled = true;
      gmTallyBtn.textContent = `投票待ち (${votedCount}/${totalVoters})`;
    }
  } else {
    console.error('[GM Voting] gmTallyVotesBtn element not found!');
  }
}

function updateWolfGuessScreen(room) {
  const content = qs('wolfGuessContent');
  if (content) {
    content.innerHTML = `
      <div class="input-group">
        <label for="wolfGuessInput">市民のお題を推理：</label>
        <input type="text" id="wolfGuessInput" placeholder="お題を入力" oninput="document.getElementById('wolfGuessBtn').disabled = !this.value.trim()">
      </div>
      <button id="wolfGuessBtn" disabled onclick="submitWolfGuess(document.getElementById('wolfGuessInput').value.trim())">
        回答する
      </button>
    `;
  }
}

function updateGMReviewScreen(room) {
  const players = room.players || {};
  const guessingWolf = room.gameData?.guessingWolf;
  const wolfGuess = room.gameData?.wolfGuess || '';
  const citizenWord = room.gameData?.citizenWord || '';
  
  const content = qs('gmReviewContent');
  if (content) {
    content.innerHTML = `
      <div class="game-info" style="margin-bottom: 20px;">
        <p><strong>市民のお題：</strong> ${citizenWord}</p>
        <p><strong>ウルフの回答：</strong> "${wolfGuess}"</p>
        <p><strong>推理したウルフ：</strong> ${players[guessingWolf]?.name || ''}</p>
      </div>
      <p class="instruction" style="margin-bottom: 20px;">
        ウルフの回答は正解ですか？<br>
        （完全一致でなくても、意味が合っていれば正解にできます）
      </p>
      <div style="display: flex; gap: 10px;">
        <button onclick="gmApproveWolfGuess(true)" style="background: #43e97b; flex: 1;">
          ✓ 正解
        </button>
        <button onclick="gmApproveWolfGuess(false)" style="background: #f5576c; flex: 1;">
          ✗ 不正解
        </button>
      </div>
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
  
  // Show wolf's guess if it exists
  const wolfGuessDiv = qs('wolfGuessResultDiv');
  if (wolfGuessDiv && gameData.wolfGuess) {
    wolfGuessDiv.innerHTML = `<p><strong>ウルフの推理：</strong> "${gameData.wolfGuess}"</p>`;
    wolfGuessDiv.style.display = 'block';
  } else {
    if (wolfGuessDiv) wolfGuessDiv.style.display = 'none';
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
  if (wolfGuessCorrect === true && !eliminatedIsWolf) {
    // Wolf NOT voted out and guessed correctly - 完全勝利 (Perfect Win)!
    winnerText = '🐺 ウルフの完全勝利！市民を騙して、お題も当てました！';
  } else if (wolfGuessCorrect === true && eliminatedIsWolf) {
    // Wolf was voted out but guessed correctly - 逆転勝利 (Comeback Win)
    winnerText = '🐺 ウルフの勝利！市民のお題を当てて逆転しました！';
  } else if (eliminatedIsWolf && wolfGuessCorrect === false) {
    // Wolf was voted out and guessed wrong
    winnerText = '👥 市民の勝利！ウルフを見つけて推理も防ぎました！';
  } else if (eliminatedIsWolf) {
    // Wolf was voted out but didn't answer or timed out
    winnerText = '👥 市民の勝利！ウルフを見つけました！';
  } else if (wolfGuessCorrect === false) {
    // Citizen was voted out, wolf guessed wrong
    winnerText = '👥 市民の勝利！投票は失敗しましたが、ウルフの推理を防ぎました！';
  } else {
    // Citizen was voted out, wolf didn't answer or timed out
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

function updateWolfWaitingMessage(status) {
  const waitingDiv = qs('wolfWaitingScreen');
  if (!waitingDiv) return;
  
  const gameInfo = waitingDiv.querySelector('.game-info p');
  if (gameInfo) {
    if (status === 'wolf-guess') {
      gameInfo.innerHTML = 'ウルフが市民のお題を推理中...<br>結果をお待ちください。';
    } else if (status === 'gm-reviewing') {
      gameInfo.innerHTML = 'GMがウルフの回答を審査中...<br>結果をお待ちください。';
    }
  }
}

/**************** GM ACTIONS (LEGACY - keeping for compatibility) ****************/
// Note: These are replaced by newer functions but kept in case HTML still references them
window.submitWords=()=>database.ref(`rooms/${roomCode}/status`).set('words');

window.gmTransitionToDiscussion = function() {
  console.log('[GM] Manually transitioning to discussion phase');
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
  // Prevent duplicate tallying
  if (window.tallyingInProgress) return;
  window.tallyingInProgress = true;
  
  database.ref(`rooms/${roomCode}`).once('value').then(snap=>{
    const room=snap.val();
    if(room.gameData.gameMasterId!==playerId) {
      window.tallyingInProgress = false;
      return;
    }

    const votes=room.votes||{};
    const tally={};
    Object.values(votes).forEach(v=>{
      tally[v]=(tally[v]||0)+1;
    });

    // Find max vote count
    let max=0;
    for(const count of Object.values(tally)){
      if(count>max) max=count;
    }
    
    // Get all players with max votes (handles ties)
    const topVoted = Object.keys(tally).filter(pid => tally[pid] === max);
    
    // Check if any of the top voted are wolves
    const wolves = room.gameData.wolves || [];
    const votedWolves = topVoted.filter(pid => wolves.includes(pid));
    
    let eliminated = topVoted[0]; // Most voted player
    let guessingWolf = null;
    
    // ALWAYS give a wolf the chance to guess for 完全勝利 (perfect win)
    // If multiple wolves, randomly select one
    if (wolves.length > 0) {
      guessingWolf = wolves[Math.floor(Math.random() * wolves.length)];
    }
    
    database.ref(`rooms/${roomCode}/gameData`).update({
      eliminatedPlayer: eliminated,
      guessingWolf: guessingWolf,
      wolfGuessStartedAt: Date.now() // Start timer for wolf guess phase
    });

    database.ref(`rooms/${roomCode}/status`).set('wolf-guess').then(() => {
      window.tallyingInProgress = false;
    });
  }).catch(() => {
    window.tallyingInProgress = false;
  });
}

/**************** WOLF GUESS ****************/
window.submitWolfGuess=function(guessWord){
  if (!guessWord || !guessWord.trim()) {
    alert('お題を入力してください');
    return;
  }
  
  database.ref(`rooms/${roomCode}`).once('value').then(snap=>{
    const room=snap.val();
    const eliminated = room.gameData.eliminatedPlayer;
    
    // Only the eliminated player can submit
    if(eliminated !== playerId) return;
    
    // Verify they are actually a wolf
    if(!room.gameData.playerWords[playerId]?.isWolf) return;

    // Store the wolf's guess for GM to review
    database.ref(`rooms/${roomCode}/gameData/wolfGuess`).set(guessWord.trim());
    database.ref(`rooms/${roomCode}/status`).set('gm-reviewing');
  });
};

window.gmApproveWolfGuess = function(correct) {
  database.ref(`rooms/${roomCode}/gameData/wolfGuessCorrect`).set(correct);
  database.ref(`rooms/${roomCode}/status`).set('results');
};

/**************** DISCUSSION TIMER ****************/
let discussionInterval=null;
function syncDiscussionTimer(room){
  clearInterval(discussionInterval);
  
  if(room.status!=='discussion') {
    // Clear timer display when not in discussion
    if(qs('timer')) qs('timer').textContent = '--:--';
    if(qs('gmTimer')) qs('gmTimer').textContent = '--:--';
    return;
  }
  
  const duration = room.gameData?.discussionDuration || 180;
  const startedAt = room.gameData?.discussionStartedAt;
  
  if (!startedAt) {
    // Timer not started yet - show initial duration
    const m = Math.floor(duration / 60);
    const s = duration % 60;
    const txt = `${m}:${String(s).padStart(2,'0')}`;
    if(qs('timer')) qs('timer').textContent = txt;
    if(qs('gmTimer')) qs('gmTimer').textContent = txt;
    return;
  }
  
  // Timer started - update countdown
  discussionInterval=setInterval(()=>{
    const end = startedAt + duration * 1000;
    const r = Math.max(0, end - Date.now());
    const s = Math.floor(r / 1000);
    const m = Math.floor(s / 60);
    const txt = `${m}:${String(s % 60).padStart(2,'0')}`;
    
    if(qs('timer')) qs('timer').textContent = txt;
    if(qs('gmTimer')) qs('gmTimer').textContent = txt;
    
    if(r <= 0){
      database.ref(`rooms/${roomCode}/status`).set('voting');
      clearInterval(discussionInterval);
    }
  }, 500);
}

/**************** VOTING TIMER (INFO) ****************/
let votingInterval=null;
function syncVotingTimer(room){
  clearInterval(votingInterval);
  
  if(room.status!=='voting') {
    if(qs('voteTimer')) qs('voteTimer').textContent = '--:--';
    if(qs('gmVoteTimer')) qs('gmVoteTimer').textContent = '--:--';
    return;
  }
  
  // Only set votingStartedAt if it doesn't exist yet
  if (!room.gameData?.votingStartedAt) {
    database.ref(`rooms/${roomCode}/gameData/votingStartedAt`).set(Date.now());
    return; // Wait for next sync with the timestamp
  }
  
  const start = room.gameData.votingStartedAt;
  votingInterval=setInterval(()=>{
    const e=Math.floor((Date.now()-start)/1000);
    const r=Math.max(0,60-e);
    const txt = `0:${String(r).padStart(2,'0')}`;
    if(qs('voteTimer')) qs('voteTimer').textContent = txt;
    if(qs('gmVoteTimer')) qs('gmVoteTimer').textContent = txt;
  },500);
}

/**************** WOLF GUESS TIMER ****************/
let wolfGuessInterval=null;
function syncWolfGuessTimer(room){
  clearInterval(wolfGuessInterval);
  
  if(room.status!=='wolf-guess') {
    if(qs('wolfGuessTimer')) qs('wolfGuessTimer').textContent = '--:--';
    return;
  }
  
  const startedAt = room.gameData?.wolfGuessStartedAt;
  if (!startedAt) return;
  
  const duration = 60; // 1 minute
  wolfGuessInterval=setInterval(()=>{
    const end = startedAt + duration * 1000;
    const r = Math.max(0, end - Date.now());
    const s = Math.floor(r / 1000);
    const txt = `0:${String(s).padStart(2,'0')}`;
    
    if(qs('wolfGuessTimer')) qs('wolfGuessTimer').textContent = txt;
    
    if(r <= 0){
      // Time's up! Auto-transition to gm-reviewing with empty guess
      clearInterval(wolfGuessInterval);
      database.ref(`rooms/${roomCode}/gameData/wolfGuess`).set('(時間切れ)');
      database.ref(`rooms/${roomCode}/status`).set('gm-reviewing');
    }
  }, 500);
}

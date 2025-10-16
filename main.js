let cameraStream = null;
let cameraOn = true;
let focusSeconds = 0, unfocusSeconds = 0, lastFocus = true;
let growthLevel = 0;

// 画面遷移
function showScreen(screen) {
  ["main-screen", "memory-game-screen", "break-timer-screen", "history-screen"].forEach(id =>
    document.getElementById(id).classList.add("d-none"));
  document.getElementById(screen).classList.remove("d-none");
}

// カメラ起動
function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      cameraStream = stream;
      document.getElementById('camera').srcObject = stream;
      cameraOn = true;
      document.getElementById('camera-toggle').textContent = "カメラOFF";
      document.getElementById('camera-toggle').classList.remove('btn-danger');
      document.getElementById('camera-toggle').classList.add('btn-warning');
    })
    .catch(err => { alert("カメラが利用できません: " + err); });
}
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    document.getElementById('camera').srcObject = null;
    cameraOn = false;
    document.getElementById('camera-toggle').textContent = "カメラON";
    document.getElementById('camera-toggle').classList.remove('btn-warning');
    document.getElementById('camera-toggle').classList.add('btn-danger');
  }
}
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('camera-toggle').onclick = function() {
    if (cameraOn) stopCamera(); 
    else startCamera();
  };
  startCamera();

  // 神経衰弱ゲーム
  document.getElementById('btn-game').onclick = function() {
    showScreen('memory-game-screen');
    runMemoryGame('memory-game');
  };
  document.getElementById('manual-game').onclick = function() {
    showScreen('memory-game-screen');
    runMemoryGame('memory-game');
  };
  document.getElementById('back-main-from-game').onclick = function() {
    showScreen('main-screen');
  };

  // 休憩タイマー
  document.getElementById('btn-break').onclick = function() {
    showScreen('break-timer-screen');
    document.getElementById('break-timer').innerHTML = "";
  };
  document.getElementById('manual-break').onclick = function() {
    showScreen('break-timer-screen');
    document.getElementById('break-timer').innerHTML = "";
  };
  document.getElementById('back-main-from-break').onclick = function() {
    showScreen('main-screen');
  };
  document.getElementById('start-break-timer').onclick = function() {
    let h = parseInt(document.getElementById('break-hour').value, 10) || 0;
    let m = parseInt(document.getElementById('break-min').value, 10) || 0;
    let s = parseInt(document.getElementById('break-sec').value, 10) || 0;
    let total = h*3600 + m*60 + s;
    runBreakTimer('break-timer', total);
  };

  // 集中履歴
  document.getElementById('btn-history').onclick = function() {
    showScreen('history-screen');
    renderFocusHistory();
  };
  document.getElementById('back-main-from-history').onclick = function() {
    showScreen('main-screen');
  };

  // 初期表示
  showScreen('main-screen');
  updateGrowthArea();
});


// JSで画像キャプチャ→Base64エンコード→サーバー送信
function captureAndSend() {
  const video = document.getElementById('camera');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = canvas.toDataURL('image/jpeg');
  fetch('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData })
  })
  .then(res => res.json())
  .then(data => updateFocusStatus(data))
  .catch(err => console.error(err));
}

// 集中/非集中時間の計測・可視化（進捗バー・タイマー）
setInterval(() => {
  if (lastFocus) {
    focusSeconds++;
  } else {
    unfocusSeconds++;
  }
  document.getElementById('focus-timer').textContent =
    `集中: ${focusSeconds}s / 非集中: ${unfocusSeconds}s`;
}, 1000);

// サーバーの判定結果（JSON）の受け取り→画面表示の更新
function updateFocusStatus(result) {
  const statusDiv = document.getElementById('focus-status');
  if (result.focus === 'focused') {
    statusDiv.textContent = "集中しています！";
    statusDiv.className = "alert alert-success text-center";
    document.getElementById('break-or-game').classList.add('d-none');
    lastFocus = true;
    if (focusSeconds % 600 === 0) { // 600秒ごとに成長
      growthLevel++;
      updateGrowthArea();
    }
  } else {
    statusDiv.textContent = "集中が切れています";
    statusDiv.className = "alert alert-warning text-center";
    document.getElementById('break-or-game').classList.remove('d-none');
    lastFocus = false;
  }
  document.getElementById('focus-timer').textContent =
    `集中: ${focusSeconds}s / 非集中: ${unfocusSeconds}s`;
}

// 植物育成表示
function updateGrowthArea() {
  const growthImgs = [
    "🌱", "🌿", "🌳", "🌻", "🍎"
  ];
  let img = growthImgs[Math.min(growthLevel, growthImgs.length - 1)];
  document.getElementById('growth-area').innerHTML =
    `<div style="font-size:3em;">${img}</div>
     <div class="text-yellow">成長レベル: ${growthLevel}</div>`;
}

// 神経衰弱ゲームの状態をグローバルで管理
let firstCard = null;
let secondCard = null;
let lockBoard = false;
let matchCount = 0;

function runMemoryGame(targetId) {
  const emojis = ['🍎','🍋','🍊','🍇','🍉','🍒'];
  const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
  matchCount = 0;
  firstCard = null;
  secondCard = null;
  lockBoard = false;

  const board = document.getElementById(targetId);
  board.innerHTML = '<div id="memory-board" class="memory-board"></div><div id="memory-info" class="mt-3 text-orange"></div>';
  const memoryBoard = document.getElementById('memory-board');
  document.getElementById('memory-info').textContent = '試行回数: 0';

  let tries = 0;

  cards.forEach((emoji, idx) => {
    const card = document.createElement('button');
    card.className = 'memory-card';
    card.dataset.emoji = emoji;
    card.dataset.flipped = 'false';
    card.innerHTML = '？';
    card.onclick = function() {
      if (lockBoard || card.dataset.flipped === 'true' || card === firstCard) return;
      card.innerHTML = emoji;
      card.dataset.flipped = 'true';
      if (!firstCard) {
        firstCard = card;
      } else {
        secondCard = card;
        lockBoard = true;
        tries++;
        document.getElementById('memory-info').textContent = '試行回数: ' + tries;
        if (firstCard.dataset.emoji === secondCard.dataset.emoji) {
          matchCount++;
          setTimeout(() => {
            firstCard.classList.add('matched');
            secondCard.classList.add('matched');
            firstCard = null;
            secondCard = null;
            lockBoard = false;
            if (matchCount === emojis.length) {
              document.getElementById('memory-info').innerHTML += '<div class="mt-2 text-success fw-bold">クリア！おめでとう！</div>';
            }
          }, 400);
        } else {
          setTimeout(() => {
            firstCard.innerHTML = '？';
            secondCard.innerHTML = '？';
            firstCard.dataset.flipped = 'false';
            secondCard.dataset.flipped = 'false';
            firstCard = null;
            secondCard = null;
            lockBoard = false;
          }, 700);
        }
      }
    };
    memoryBoard.appendChild(card);
  });
}

// 休憩タイマー
function runBreakTimer(targetId, seconds) {
  let t = seconds;
  const target = document.getElementById(targetId);
  target.innerHTML = `<div>休憩中…<span id="timer">${formatTime(t)}</span></div>`;
  const interval = setInterval(() => {
    t--;
    document.getElementById('timer').textContent = formatTime(t);
    if (t <= 0) {
      clearInterval(interval);
      target.innerHTML = `<div class="text-success">休憩終了！再開しましょう</div>`;
    }
  }, 1000);
}
function formatTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return `${h}時間${m}分${s}秒`;
}

// 集中履歴
function renderFocusHistory() {
  let logs = JSON.parse(localStorage.getItem('focusLogs') || '[]');
  let html = logs.length === 0 ? '<div>履歴がありません</div>' :
    `<table class="table table-bordered table-sm">
      <thead class="bg-yellow">
        <tr><th>日時</th><th>集中</th><th>非集中</th><th>レベル</th></tr>
      </thead><tbody>
      ${logs.map(l =>
        `<tr><td>${l.date}</td><td>${l.focus}s</td><td>${l.unfocus}s</td><td>${l.growth}</td></tr>`
      ).join('')}
      </tbody></table>`;
  document.getElementById('history-list').innerHTML = html;
}

//localStorageでの簡易履歴管理
function saveSessionLog() {
  const log = {
    date: new Date().toLocaleString(),
    focus: focusSeconds,
    unfocus: unfocusSeconds,
    growth: growthLevel
  };
  let logs = JSON.parse(localStorage.getItem('focusLogs') || '[]');
  logs.push(log);
  localStorage.setItem('focusLogs', JSON.stringify(logs));
}
window.onbeforeunload = saveSessionLog;
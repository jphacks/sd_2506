// グローバル変数
let cameraStream = null;
let cameraOn = false;
let focusSeconds = 0, unfocusSeconds = 0, lastFocus = true;
let growthLevel = 0;
let sessionTags = "", sessionMemo = "";
let analysisInterval = null;
let timerInterval = null;
let audioUnlocked = false;
let pendingBGM = false;

// 画面遷移
function showScreen(screen) {
  ["main-screen", "memory-game-screen", "break-timer-screen", "history-screen", "settings-screen"].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.classList.add("d-none");
  });
  const targetScreen = document.getElementById(screen);
  if (targetScreen) targetScreen.classList.remove("d-none");
}

// カメラ起動
function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('お使いのブラウザはカメラをサポートしていません');
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            cameraStream = stream;
            const videoElement = document.getElementById('camera');
            
            if (videoElement) {
                videoElement.srcObject = stream;
                // videoがロードされてから再生開始
                videoElement.onloadedmetadata = function() {
                    videoElement.play().catch(e => console.log('Video play failed:', e));
                };
            }
            
            cameraOn = true;
            updateCameraButton();
            
            // カメラ起動後に分析開始（前の分析を停止）
            if (analysisInterval) clearInterval(analysisInterval);
            analysisInterval = setInterval(captureAndSend, 3000);
        })
        .catch(err => {
            console.error('Camera error:', err);
            let errorMsg = "カメラが利用できません: ";
            
            if (err.name === 'NotAllowedError') {
                errorMsg += "カメラの使用が拒否されました。ブラウザの設定を確認してください。";
            } else if (err.name === 'NotFoundError') {
                errorMsg += "カメラが見つかりません。";
            } else {
                errorMsg += err.message;
            }
            
            alert(errorMsg);
        });
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        const videoElement = document.getElementById('camera');
        if (videoElement) videoElement.srcObject = null;
        cameraOn = false;
        updateCameraButton();
        
        // 分析停止
        if (analysisInterval) {
            clearInterval(analysisInterval);
            analysisInterval = null;
        }
    }
}

function updateCameraButton() {
    const toggleBtn = document.getElementById('camera-toggle');
    if (!toggleBtn) return;
    
    if (cameraOn) {
        toggleBtn.textContent = "カメラOFF";
        toggleBtn.classList.remove('btn-danger');
        toggleBtn.classList.add('btn-warning');
    } else {
        toggleBtn.textContent = "カメラON";
        toggleBtn.classList.remove('btn-warning');
        toggleBtn.classList.add('btn-danger');
    }
}

// オーディオアンロック（ユーザーインタラクション検出）
function unlockAudio() {
    if (audioUnlocked) return;
    
    const audio = document.getElementById('bgm-audio');
    if (!audio) return;
    
    // 無音再生でアンロック
    audio.volume = 0;
    audio.play().then(() => {
        audio.pause();
        audio.volume = 0.5;
        audioUnlocked = true;
        console.log('Audio unlocked successfully');
        
        // 保留中のBGMを再生
        if (pendingBGM) {
            playBGM();
            pendingBGM = false;
        }
    }).catch(e => {
        console.log('Audio unlock failed:', e);
    });
}

// DOMContentLoaded - すべてのイベントリスナーを一箇所で設定
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    // オーディオアンロック（最初のクリックで実行）
    document.body.addEventListener('click', unlockAudio, { once: true });
    document.body.addEventListener('touchstart', unlockAudio, { once: true });
    // DOMContentLoadedに追加
    document.addEventListener('click', initAudioContext, { once: true });
    document.addEventListener('touchstart', initAudioContext, { once: true });
    
    // カメラトグル
    const cameraToggle = document.getElementById('camera-toggle');
    if (cameraToggle) {
        cameraToggle.onclick = function() { 
            if (cameraOn) stopCamera(); 
            else startCamera(); 
        };
    }

    // セッション記録
    const saveBtn = document.getElementById('save-session');
    if (saveBtn) saveBtn.onclick = saveSessionUI;

    // 履歴画面
    const historyBtn = document.getElementById('btn-history');
    if (historyBtn) {
        historyBtn.onclick = function() { 
            showScreen('history-screen'); 
            renderFocusHistory(); 
        };
    }
    
    const backFromHistory = document.getElementById('back-main-from-history');
    if (backFromHistory) {
        backFromHistory.onclick = function() { showScreen('main-screen'); };
    }

    // 設定画面
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) {
        settingsBtn.onclick = function() { 
            showScreen('settings-screen'); 
            loadSettingsUI(); 
        };
    }
    
    const backFromSettings = document.getElementById('back-main-from-settings');
    if (backFromSettings) {
        backFromSettings.onclick = function() { showScreen('main-screen'); };
    }

    // BGM設定
    const enableBgmCheckbox = document.getElementById('enable-bgm');
    const bgmSelect = document.getElementById('bgm-select');
    const testBgmBtn = document.getElementById('test-bgm');
    
    if (enableBgmCheckbox) enableBgmCheckbox.onchange = bgmControl;
    if (bgmSelect) bgmSelect.onchange = bgmControl;
    if (testBgmBtn) testBgmBtn.onclick = playBGM;

    // 神経衰弱ゲーム
    const gameBtn = document.getElementById('btn-game');
    const manualGameBtn = document.getElementById('manual-game');
    const backFromGame = document.getElementById('back-main-from-game');
    
    if (gameBtn) {
        gameBtn.onclick = function() {
            showScreen('memory-game-screen');
            runMemoryGame('memory-game');
        };
    }
    if (manualGameBtn) {
        manualGameBtn.onclick = function() {
            showScreen('memory-game-screen');
            runMemoryGame('memory-game');
        };
    }
    if (backFromGame) {
        backFromGame.onclick = function() { showScreen('main-screen'); };
    }

    // 休憩タイマー
    const breakBtn = document.getElementById('btn-break');
    const manualBreakBtn = document.getElementById('manual-break');
    const backFromBreak = document.getElementById('back-main-from-break');
    const startBreakBtn = document.getElementById('start-break-timer');
    
    if (breakBtn) {
        breakBtn.onclick = function() {
            showScreen('break-timer-screen');
            const breakTimer = document.getElementById('break-timer');
            if (breakTimer) breakTimer.innerHTML = "";
        };
    }
    if (manualBreakBtn) {
        manualBreakBtn.onclick = function() {
            showScreen('break-timer-screen');
            const breakTimer = document.getElementById('break-timer');
            if (breakTimer) breakTimer.innerHTML = "";
        };
    }
    if (backFromBreak) {
        backFromBreak.onclick = function() { showScreen('main-screen'); };
    }
    if (startBreakBtn) {
        startBreakBtn.onclick = function() {
            let h = parseInt(document.getElementById('break-hour').value, 10) || 0;
            let m = parseInt(document.getElementById('break-min').value, 10) || 0;
            let s = parseInt(document.getElementById('break-sec').value, 10) || 0;
            let total = h*3600 + m*60 + s;
            if (total > 0) runBreakTimer('break-timer', total);
            else alert('時間を設定してください');
        };
    }

    // 初期表示
    showScreen('main-screen');
    updateGrowthArea();
    
    // タイマー開始（重複防止）
    if (timerInterval) clearInterval(timerInterval);
    startFocusTimer();
    
    // カメラ自動起動
    startCamera();

    //test
    // 通知テストボタンのイベントリスナー追加
    const requestPermissionBtn = document.getElementById('request-notification-permission');
    const basicNotificationBtn = document.getElementById('test-basic-notification');
    const serviceWorkerNotificationBtn = document.getElementById('test-sw-notification');
    const startPeriodicBtn = document.getElementById('start-periodic-notifications');
    const stopPeriodicBtn = document.getElementById('stop-periodic-notifications');
    
    if (requestPermissionBtn) {
        requestPermissionBtn.onclick = requestNotificationPermission;
    }
    
    if (basicNotificationBtn) {
        basicNotificationBtn.onclick = showBasicNotification;
    }
    
    if (serviceWorkerNotificationBtn) {
        serviceWorkerNotificationBtn.onclick = showServiceWorkerNotification;
    }
    
    if (startPeriodicBtn) {
        startPeriodicBtn.onclick = startPeriodicNotifications;
    }
    
    if (stopPeriodicBtn) {
        stopPeriodicBtn.onclick = stopPeriodicNotifications;
    }
    
    // 初期状態で通知許可状態をチェック
    setTimeout(() => {
        checkNotificationPermission();
        updateNotificationUI(Notification.permission);
    }, 1000);
    //test
});

// 集中時間タイマー
function startFocusTimer() {
    timerInterval = setInterval(() => {
        if (lastFocus) {
            focusSeconds++;
        } else {
            unfocusSeconds++;
        }
        const timerElement = document.getElementById('focus-timer');
        if (timerElement) {
            timerElement.textContent = `集中: ${focusSeconds}s / 非集中: ${unfocusSeconds}s`;
        }
    }, 1000);
}

// 画像キャプチャ→サーバー送信
// 分析機能を一時的に無効化（main.js内）
function captureAndSend() {
    const video = document.getElementById('camera');
    if (!video || !video.videoWidth || video.videoWidth === 0) {
        console.log('📷 Video not ready yet');
        return;
    }
    
    console.log('📸 キャプチャ実行中（分析サーバー未実装のため集中状態は変更されません）');
    
    // 開発中はサーバーへの送信をコメントアウト
    /*
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
    .catch(err => {
        console.log('分析サーバーに接続できません:', err);
    });
    */
    
    // デモ用：5秒ごとにランダムに集中状態を変更
    if (Math.random() > 0.7) { // 30%の確率で状態変更
        const demoResult = {
            focus: Math.random() > 0.5 ? 'focused' : 'unfocused',
            confidence: Math.random()
        };
        console.log('🎮 デモ用状態変更:', demoResult);
        updateFocusStatus(demoResult);
    }
}



// サーバーの判定結果を受け取って画面更新
function updateFocusStatus(result) {
    const statusDiv = document.getElementById('focus-status');
    if (!statusDiv) return;
    
    if (result.focus === 'focused') {
        statusDiv.textContent = "集中しています！";
        statusDiv.className = "alert alert-success text-center";
        
        const breakOrGame = document.getElementById('break-or-game');
        if (breakOrGame) breakOrGame.classList.add('d-none');
        
        lastFocus = true;
        showGentleNotification();
        
        // BGMが有効かつアンロック済みの場合のみ再生
        if (audioUnlocked && document.getElementById('enable-bgm')?.checked) {
            playBGM();
        }
        
        if (focusSeconds > 0 && focusSeconds % 600 === 0) {
            growthLevel++;
            updateGrowthArea();
        }
    } else {
        statusDiv.textContent = "集中が切れています";
        statusDiv.className = "alert alert-warning text-center";
        
        const breakOrGame = document.getElementById('break-or-game');
        if (breakOrGame) breakOrGame.classList.remove('d-none');
        
        lastFocus = false;
    }
}

// 植物育成表示
function updateGrowthArea() {
    const growthImgs = ["🌱", "🌿", "🌳", "🌻", "🍎"];
    let img = growthImgs[Math.min(growthLevel, growthImgs.length - 1)];
    const growthArea = document.getElementById('growth-area');
    if (growthArea) {
        growthArea.innerHTML = `<div style="font-size:3em;">${img}</div><div class="text-yellow">成長レベル: ${growthLevel}</div>`;
    }
}

// 神経衰弱ゲーム
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
    if (!board) return;
    
    board.innerHTML = '<div id="memory-board" class="memory-board"></div><div id="memory-info" class="mt-3 text-orange"></div>';
    const memoryBoard = document.getElementById('memory-board');
    const memoryInfo = document.getElementById('memory-info');
    if (memoryInfo) memoryInfo.textContent = '試行回数: 0';

    let tries = 0;

    cards.forEach((emoji) => {
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
                if (memoryInfo) memoryInfo.textContent = '試行回数: ' + tries;
                if (firstCard.dataset.emoji === secondCard.dataset.emoji) {
                    matchCount++;
                    setTimeout(() => {
                        firstCard.classList.add('matched');
                        secondCard.classList.add('matched');
                        firstCard = null;
                        secondCard = null;
                        lockBoard = false;
                        if (matchCount === emojis.length) {
                            if (memoryInfo) {
                                memoryInfo.innerHTML += '<div class="mt-2 text-success fw-bold">クリア！おめでとう！</div>';
                            }
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
        if (memoryBoard) memoryBoard.appendChild(card);
    });
}

// 休憩タイマー
function runBreakTimer(targetId, seconds) {
    let t = seconds;
    const target = document.getElementById(targetId);
    if (!target) return;
    
    target.innerHTML = `<div class="alert alert-info">休憩中…<span id="timer" class="fw-bold">${formatTime(t)}</span></div>`;
    const interval = setInterval(() => {
        t--;
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.textContent = formatTime(t);
        }
        if (t <= 0) {
            clearInterval(interval);
            target.innerHTML = `<div class="alert alert-success">休憩終了！再開しましょう</div>`;
        }
    }, 1000);
}

function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec%3600)/60);
    const s = sec%60;
    return `${h}時間${m}分${s}秒`;
}

// セッション記録
function saveSessionUI() {
    const sanitizeInput = (input) => {
        if (!input) return '';
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    };
    
    const tagsInput = document.getElementById('input-tags');
    const memoInput = document.getElementById('input-memo');
    
    sessionTags = tagsInput ? sanitizeInput(tagsInput.value) : '';
    sessionMemo = memoInput ? sanitizeInput(memoInput.value) : '';
    
    const log = {
        date: new Date().toISOString(),
        focus: focusSeconds,
        unfocus: unfocusSeconds,
        growth: growthLevel,
        tags: sessionTags.split(',').map(s => s.trim()).filter(s=>s),
        memo: sessionMemo
    };
    
    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem('focusLogs')) || [];
    } catch (e) {
        console.error("履歴データの読み込みに失敗", e);
        logs = [];
    }
    
    logs.push(log);
    localStorage.setItem('focusLogs', JSON.stringify(logs));
    
    alert("記録しました！");
    if (tagsInput) tagsInput.value = '';
    if (memoInput) memoInput.value = '';
}

// 履歴表示
function renderFocusHistory() {
    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem('focusLogs')) || [];
    } catch (e) {
        console.error("履歴データの読み込みに失敗", e);
    }
    
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    let html = logs.length === 0 ? '<div class="alert alert-info">履歴がありません</div>' :
        `<table class="table table-bordered table-sm">
          <thead class="bg-yellow">
            <tr><th>日時</th><th>集中</th><th>非集中</th><th>レベル</th><th>タグ</th><th>メモ</th></tr>
          </thead><tbody>
          ${logs.map((l,i) =>
            `<tr>
            <td>${new Date(l.date).toLocaleString('ja-JP')}</td>
            <td>${l.focus}s</td>
            <td>${l.unfocus}s</td>
            <td>${l.growth}</td>
            <td><input value="${(l.tags || []).join(',')}" class="form-control form-control-sm" onchange="updateTag(${i},this.value)"></td>
            <td><input value="${l.memo || ''}" class="form-control form-control-sm" onchange="updateMemo(${i},this.value)"></td>
            </tr>`
          ).join('')}
          </tbody></table>`;
    historyList.innerHTML = html;
    
    const aiFeedback = document.getElementById('ai-feedback');
    if (aiFeedback) {
        aiFeedback.textContent = aiFeedbackFromLogs(logs);
    }
}

// タグ・メモ編集
window.updateTag = function(idx, val) {
    let logs = JSON.parse(localStorage.getItem('focusLogs') || '[]');
    if (logs[idx]) {
        logs[idx].tags = val.split(',').map(s=>s.trim()).filter(s=>s);
        localStorage.setItem('focusLogs', JSON.stringify(logs));
    }
};

window.updateMemo = function(idx, val) {
    let logs = JSON.parse(localStorage.getItem('focusLogs') || '[]');
    if (logs[idx]) {
        logs[idx].memo = val;
        localStorage.setItem('focusLogs', JSON.stringify(logs));
    }
};

// AIフィードバック
function aiFeedbackFromLogs(logs) {
    if(!logs.length) return "履歴がありません";
    let tagCount = {};
    logs.forEach(l=> (l.tags||[]).forEach(t=>tagCount[t]=(tagCount[t]||0)+1 ));
    let bestTag = Object.entries(tagCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || "";
    let avgFocus = Math.round(logs.reduce((a,b)=>a+b.focus,0)/logs.length);
    let msg = `平均集中時間：${avgFocus}s。`;
    if(bestTag) msg += `よく使うタグは「${bestTag}」です。`;
    msg += "良かった点や反省点をメモして自己成長に役立てましょう！";
    return msg;
}

// 通知
function showGentleNotification() {
    const enableNotify = document.getElementById('enable-notify');
    if (!enableNotify || !enableNotify.checked) return;
    
    if (Notification.permission === "granted") {
        const notifyMsg = document.getElementById('notify-msg');
        new Notification(notifyMsg ? notifyMsg.value : "そろそろ休憩しませんか？");
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(perm => {
            if(perm === "granted") showGentleNotification();
        });
    }
}

// BGM制御
// 完全修正版BGM機能
let audioContext = null;

// ユーザーインタラクション検出を強化
function initAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioContext created');
        } catch (e) {
            console.error('AudioContext creation failed:', e);
        }
    }
}

// BGM再生機能（完全修正版）
function playBGM() {
    const enableCheckbox = document.getElementById('enable-bgm');
    if (!enableCheckbox || !enableCheckbox.checked) {
        stopBGM();
        return;
    }
    
    const bgmSelect = document.getElementById('bgm-select');
    const bgmValue = bgmSelect ? bgmSelect.value : 'none';
    const audio = document.getElementById('bgm-audio');
    
    if (!audio) {
        console.error('Audio element not found');
        return;
    }
    
    // BGMソース設定
    let src = "";
    if (bgmValue === "cafe") {
        src = "./cafe_sound.mp3";  // ローカルファイル
    } else if (bgmValue === "rain") {
        src = "./rain.mp3";        // ローカルファイル  
    } else if (bgmValue === "relax") {
        // CORS問題のない音楽URL
        src = "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav";
    } else {
        stopBGM();
        return;
    }
    
    // crossoriginを設定せずにソースを変更
    if (audio.src !== src) {
        // crossorigin属性を削除
        audio.removeAttribute('crossorigin');
        audio.src = src;
        audio.load();
    }
    
    audio.volume = 0.3;
    audio.loop = true;
    
    // 確実な再生処理
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                console.log('✅ BGM started successfully');
                updateBGMButton(true);
            })
            .catch(error => {
                console.error('❌ BGM play failed:', error);
                
                // ユーザーアクションが必要な場合
                if (error.name === 'NotAllowedError') {
                    showBGMActionRequired();
                }
            });
    }
}

// BGM再生のためのユーザーアクション要求表示
function showBGMActionRequired() {
    // 既存のアラートがあれば削除
    const existingAlert = document.getElementById('bgm-action-alert');
    if (existingAlert) existingAlert.remove();
    
    const alertDiv = document.createElement('div');
    alertDiv.id = 'bgm-action-alert';
    alertDiv.className = 'alert alert-warning alert-dismissible fade show';
    alertDiv.innerHTML = `
        <i class="fas fa-volume-up me-2"></i>
        <strong>BGM再生について</strong><br>
        ブラウザのセキュリティにより、BGMを再生するにはクリックが必要です。
        <button type="button" class="btn btn-sm btn-primary ms-2" onclick="document.getElementById('bgm-audio').play(); this.parentElement.remove();">
            BGM再生
        </button>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // BGMアラート表示エリアに挿入
    const alertArea = document.getElementById('bgm-alert-area') || document.getElementById('main-screen');
    if (alertArea) {
        alertArea.insertBefore(alertDiv, alertArea.firstChild);
    }
}

function updateBGMButton(isPlaying) {
    const testBtn = document.getElementById('test-bgm');
    if (testBtn) {
        if (isPlaying) {
            testBtn.innerHTML = '<i class="fas fa-stop me-2"></i>BGM停止';
            testBtn.classList.remove('btn-success');
            testBtn.classList.add('btn-danger');
        } else {
            testBtn.innerHTML = '<i class="fas fa-play me-2"></i>BGMをテスト再生';
            testBtn.classList.remove('btn-danger');
            testBtn.classList.add('btn-success');
        }
    }
}



function stopBGM() {
    const audio = document.getElementById('bgm-audio');
    if (!audio) return;
    
    audio.pause();
    audio.currentTime = 0;
    
    const testBtn = document.getElementById('test-bgm');
    if (testBtn) {
        testBtn.textContent = 'BGMをテスト再生';
        testBtn.classList.remove('btn-success');
        testBtn.classList.add('btn-blue');
    }
}

function bgmControl() {
    const enableCheckbox = document.getElementById('enable-bgm');
    if (enableCheckbox && enableCheckbox.checked) {
        playBGM();
    } else {
        stopBGM();
    }
}

function loadSettingsUI() {
    // 設定の読み込み処理
    console.log('Settings UI loaded');
}

// ページ離脱時の処理
window.addEventListener('beforeunload', function() {
    // すべてのインターバルをクリア
    if (analysisInterval) clearInterval(analysisInterval);
    if (timerInterval) clearInterval(timerInterval);
    
    // カメラ停止
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
});

//ポップアップ通知（他サイト閲覧中でも表示）
// Service Worker登録（main.jsに追加）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker registered:', registration);
            
            // バックグラウンド同期を登録
            if ('sync' in registration) {
                await registration.sync.register('focus-check');
            }
            
            // 定期的な通知チェック（30分ごと）
            setInterval(() => {
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'SHOW_FOCUS_NOTIFICATION',
                        payload: {
                            message: `集中時間: ${focusSeconds}秒 / 非集中時間: ${unfocusSeconds}秒`
                        }
                    });
                }
            }, 30 * 60 * 1000);
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    });
}

// main.js の末尾に追加
// ============ 通知テスト機能 ============

// 通知許可状態をチェック
function checkNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('❌ このブラウザは通知をサポートしていません');
        return false;
    }
    
    console.log('✅ 通知サポート: 利用可能');
    console.log('🔔 現在の許可状態:', Notification.permission);
    
    return true;
}

// 通知許可を要求
async function requestNotificationPermission() {
    if (!checkNotificationPermission()) return false;
    
    try {
        const permission = await Notification.requestPermission();
        console.log('📝 許可結果:', permission);
        
        // UI更新
        updateNotificationUI(permission);
        
        if (permission === 'granted') {
            alert('✅ 通知許可が取得できました！');
            return true;
        } else if (permission === 'denied') {
            alert('❌ 通知がブロックされました。ブラウザ設定から手動で許可してください。');
            return false;
        } else {
            alert('⚠️ 通知許可が取得できませんでした。');
            return false;
        }
    } catch (error) {
        console.error('❌ 通知許可エラー:', error);
        alert('通知許可の取得中にエラーが発生しました: ' + error.message);
        return false;
    }
}

// 基本的な通知を表示
function showBasicNotification() {
    if (Notification.permission !== 'granted') {
        alert('❌ 通知許可が必要です。先に「通知許可を要求」ボタンをクリックしてください。');
        return;
    }
    
    const notification = new Notification('🎯 集中力アプリからお知らせ', {
        body: `現在の集中時間: ${focusSeconds}秒\n非集中時間: ${unfocusSeconds}秒`,
        icon: 'icon-192.png', // アイコンファイル（なくてもOK）
        badge: 'badge-72.png',
        tag: 'focus-update', // 同じタグの通知は上書きされる
        requireInteraction: false, // 自動で消える
        silent: false // 音を鳴らす
    });
    
    notification.onclick = function() {
        console.log('👆 通知がクリックされました');
        window.focus(); // アプリにフォーカス
        notification.close();
    };
    
    // 5秒後に自動で閉じる
    setTimeout(() => {
        notification.close();
    }, 5000);
    
    console.log('📢 基本通知を表示しました');
}

// Service Worker経由の通知（バックグラウンドで動作）
async function showServiceWorkerNotification() {
    if (Notification.permission !== 'granted') {
        alert('❌ 通知許可が必要です。');
        return;
    }
    
    if (!('serviceWorker' in navigator)) {
        alert('❌ このブラウザはService Workerをサポートしていません');
        return;
    }
    
    try {
        const registration = await navigator.serviceWorker.ready;
        console.log('✅ Service Worker ready');
        
        await registration.showNotification('🚀 バックグラウンド通知テスト', {
            body: '他のタブを開いていてもこの通知が表示されます！',
            icon: 'icon-192.png',
            badge: 'badge-72.png',
            actions: [
                {
                    action: 'open',
                    title: 'アプリを開く'
                },
                {
                    action: 'close', 
                    title: '閉じる'
                }
            ],
            data: {
                type: 'background-test',
                timestamp: Date.now()
            },
            requireInteraction: true // ユーザーが操作するまで表示
        });
        
        console.log('📢 Service Worker通知を表示しました');
        
    } catch (error) {
        console.error('❌ Service Worker通知エラー:', error);
        alert('Service Worker通知エラー: ' + error.message);
    }
}

// 通知UI状態を更新
function updateNotificationUI(permission) {
    const statusElement = document.getElementById('notification-status');
    if (statusElement) {
        let statusText = '';
        let statusClass = '';
        
        switch (permission) {
            case 'granted':
                statusText = '✅ 通知許可済み';
                statusClass = 'text-success';
                break;
            case 'denied':
                statusText = '❌ 通知ブロック済み';
                statusClass = 'text-danger';
                break;
            default:
                statusText = '⚠️ 通知許可待ち';
                statusClass = 'text-warning';
        }
        
        statusElement.innerHTML = `<small class="${statusClass}">${statusText}</small>`;
    }
}

// 定期通知のテスト（30秒ごと）
let notificationInterval = null;

function startPeriodicNotifications() {
    if (Notification.permission !== 'granted') {
        alert('❌ 通知許可が必要です。');
        return;
    }
    
    if (notificationInterval) {
        clearInterval(notificationInterval);
    }
    
    notificationInterval = setInterval(() => {
        if (document.hidden) { // タブがバックグラウンドの場合のみ
            showBasicNotification();
        }
    }, 30000); // 30秒ごと
    
    alert('✅ 定期通知を開始しました（30秒ごと、バックグラウンド時のみ）');
    console.log('🔔 定期通知開始');
}

function stopPeriodicNotifications() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
        alert('⏹️ 定期通知を停止しました');
        console.log('🔕 定期通知停止');
    }
}

// ページの可視性変更を監視
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('📱 ページがバックグラウンドになりました');
    } else {
        console.log('👀 ページがフォアグラウンドになりました');
    }
});

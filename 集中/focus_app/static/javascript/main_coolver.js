// ========================================
// Cool Version - Main JavaScript
// ========================================

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
let breakTimerInterval = null;  // 休憩タイマー用インターバル
let breakTimerRunning = false;  // 休憩タイマーの実行状態

// 成長アイコン
const growthImgs = ["🌱", "🌿", "🌳", "🌻", "🍎"];

// ========================================
// 画面遷移
// ========================================
function showScreen(screen) {
    ["main-screen", "memory-game-screen", "break-timer-screen", "history-screen", "settings-screen"].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.classList.add("d-none");
    });
    const targetScreen = document.getElementById(screen);
    if (targetScreen) targetScreen.classList.remove("d-none");
}

// ========================================
// カメラ制御
// ========================================
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
                videoElement.onloadedmetadata = function() {
                    videoElement.play().catch(e => console.log('Video play failed:', e));
                };
            }
            
            cameraOn = true;
            updateCameraButton();
            hideCameraOverlay();
            
            // 分析開始
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
        showCameraOffOverlay();
        
        // 分析停止
        if (analysisInterval) {
            clearInterval(analysisInterval);
            analysisInterval = null;
            console.log('📊 分析を停止しました');
        }
        
        // ステータスを待機中に戻す
        resetFocusStatus();
    }
}

// 集中状態をリセット
function resetFocusStatus() {
    const statusBadge = document.getElementById('status-badge');
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');
    const statusSubtext = document.getElementById('status-subtext');
    
    if (statusBadge) {
        statusBadge.textContent = '待機中';
        statusBadge.className = 'status-badge status-waiting';
    }
    if (statusIcon) statusIcon.textContent = '⏳';
    if (statusText) statusText.textContent = '分析待機中';
    if (statusSubtext) statusSubtext.textContent = 'カメラを起動してください';
    
    // 集中切れ警告を非表示
    const breakOrGame = document.getElementById('break-or-game');
    if (breakOrGame) breakOrGame.classList.add('d-none');
}


function updateCameraButton() {
    const toggleBtn = document.getElementById('camera-toggle');
    if (!toggleBtn) return;
    
    if (cameraOn) {
        toggleBtn.innerHTML = '<i class="fas fa-stop me-2"></i>カメラOFF';
        toggleBtn.classList.remove('btn-danger');
        toggleBtn.classList.add('btn-warning');
    } else {
        toggleBtn.innerHTML = '<i class="fas fa-video me-2"></i>カメラON';
        toggleBtn.classList.remove('btn-warning');
        toggleBtn.classList.add('btn-danger');
    }
}

function hideCameraOverlay() {
    const overlay = document.getElementById('camera-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showCameraOffOverlay() {
    const overlay = document.getElementById('camera-overlay');
    const overlayText = document.getElementById('camera-overlay-text');
    if (overlay && overlayText) {
        overlay.style.display = 'flex';
        overlayText.textContent = 'カメラがOFFになっています';
        // スピナーを非表示
        const spinner = overlay.querySelector('.spinner-border');
        if (spinner) spinner.style.display = 'none';
    }
}

// ========================================
// オーディオアンロック
// ========================================
function unlockAudio() {
    if (audioUnlocked) return;
    
    const audio = document.getElementById('bgm-audio');
    if (!audio) return;
    
    audio.volume = 0;
    audio.play().then(() => {
        audio.pause();
        audio.volume = 0.5;
        audioUnlocked = true;
        console.log('Audio unlocked successfully');
        
        if (pendingBGM) {
            playBGM();
            pendingBGM = false;
        }
    }).catch(e => {
        console.log('Audio unlock failed:', e);
    });
}

function initAudioContext() {
    // AudioContext初期化（必要に応じて実装）
}

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    // オーディオアンロック
    document.body.addEventListener('click', unlockAudio, { once: true });
    document.body.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', initAudioContext, { once: true });
    document.addEventListener('touchstart', initAudioContext, { once: true });
    
    setupEventListeners();
    showScreen('main-screen');
    updateGrowthArea();
    
    if (timerInterval) clearInterval(timerInterval);
    startFocusTimer();
    
    // カメラ自動起動
    startCamera();
});

function setupEventListeners() {
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

    // 履歴
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

    // 設定
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
            // タイマーが実行中なら停止
            if (breakTimerRunning) {
                stopBreakTimer();
            }
        };
    }
    if (manualBreakBtn) {
        manualBreakBtn.onclick = function() {
            showScreen('break-timer-screen');
            const breakTimer = document.getElementById('break-timer');
            if (breakTimer) breakTimer.innerHTML = "";
            // タイマーが実行中なら停止
            if (breakTimerRunning) {
                stopBreakTimer();
            }
        };
    }
    if (backFromBreak) {
        backFromBreak.onclick = function() { 
            showScreen('main-screen'); 
            // メイン画面に戻る時もタイマーを停止
            if (breakTimerRunning) {
                stopBreakTimer();
            }
        };
    }
    if (startBreakBtn) {
        startBreakBtn.onclick = function() {
            // 既存のタイマーを停止
            if (breakTimerRunning) {
                stopBreakTimer();
            }
            
            let h = parseInt(document.getElementById('break-hour').value, 10) || 0;
            let m = parseInt(document.getElementById('break-min').value, 10) || 0;
            let s = parseInt(document.getElementById('break-sec').value, 10) || 0;
            let total = h*3600 + m*60 + s;
            
            if (total > 0) {
                runBreakTimer('break-timer', total);
            } else {
                alert('時間を設定してください');
            }
        };
    }

    // 通知テスト
    const requestPermissionBtn = document.getElementById('request-notification-permission');
    const basicNotificationBtn = document.getElementById('test-basic-notification');
    const serviceWorkerNotificationBtn = document.getElementById('test-sw-notification');
    const startPeriodicBtn = document.getElementById('start-periodic-notifications');
    const stopPeriodicBtn = document.getElementById('stop-periodic-notifications');
    
    if (requestPermissionBtn) requestPermissionBtn.onclick = requestNotificationPermission;
    if (basicNotificationBtn) basicNotificationBtn.onclick = showBasicNotification;
    if (serviceWorkerNotificationBtn) serviceWorkerNotificationBtn.onclick = showServiceWorkerNotification;
    if (startPeriodicBtn) startPeriodicBtn.onclick = startPeriodicNotifications;
    if (stopPeriodicBtn) stopPeriodicBtn.onclick = stopPeriodicNotifications;
    
    setTimeout(() => {
        checkNotificationPermission();
        updateNotificationUI(Notification.permission);
    }, 1000);
}

// ========================================
// タイマー
// ========================================
function startFocusTimer() {
    timerInterval = setInterval(() => {
        if (lastFocus) {
            focusSeconds++;
        } else {
            unfocusSeconds++;
        }
        
        // UI更新
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const timerElement = document.getElementById('focus-timer');
    if (timerElement) {
        timerElement.textContent = `集中: ${focusSeconds}s / 非集中: ${unfocusSeconds}s`;
    }
    
    // メトリクス更新
    const focusTimeElement = document.getElementById('metric-focus-time');
    const unfocusTimeElement = document.getElementById('metric-unfocus-time');
    if (focusTimeElement) focusTimeElement.textContent = formatTimeShort(focusSeconds);
    if (unfocusTimeElement) unfocusTimeElement.textContent = formatTimeShort(unfocusSeconds);
}

function formatTimeShort(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    const m = Math.floor(seconds / 60);
    return `${m}分`;
}

// ========================================
// 画像キャプチャ→分析
// ========================================
function captureAndSend() {
    const video = document.getElementById('camera');
    if (!video || !video.videoWidth || video.videoWidth === 0) {
        console.log('📷 Video not ready yet');
        return;
    }
    
    console.log('📸 キャプチャ実行中');
    
    // デモ用：30%の確率で状態変更
    /*if (Math.random() > 0.7) {
        const demoResult = {
            focus: Math.random() > 0.5 ? 'focused' : 'unfocused',
            confidence: Math.random()
        };
        console.log('🎮 デモ用状態変更:', demoResult);
        updateFocusStatus(demoResult);
    }*/
}
const intervalId = setInterval(captureAndSend, 500);
// ========================================
// 集中状態更新
// ========================================
function updateFocusStatus(result) {
    const statusBadge = document.getElementById('status-badge');
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');
    const statusSubtext = document.getElementById('status-subtext');
    
    if (result.focus === 'focused') {
        if (statusBadge) {
            statusBadge.textContent = '集中中';
            statusBadge.className = 'status-badge status-focused';
        }
        if (statusIcon) statusIcon.textContent = '✅';
        if (statusText) statusText.textContent = '集中しています！';
        if (statusSubtext) statusSubtext.textContent = '良い調子です';
        
        const breakOrGame = document.getElementById('break-or-game');
        if (breakOrGame) breakOrGame.classList.add('d-none');
        
        lastFocus = true;
        showGentleNotification();
        
        if (audioUnlocked && document.getElementById('enable-bgm')?.checked) {
            playBGM();
        }
        
        if (focusSeconds > 0 && focusSeconds % 600 === 0) {
            growthLevel++;
            updateGrowthArea();
        }
    } else {
        if (statusBadge) {
            statusBadge.textContent = '非集中';
            statusBadge.className = 'status-badge status-unfocused';
        }
        if (statusIcon) statusIcon.textContent = '⚠️';
        if (statusText) statusText.textContent = '集中が切れています';
        if (statusSubtext) statusSubtext.textContent = 'リフレッシュしませんか？';
        
        const breakOrGame = document.getElementById('break-or-game');
        if (breakOrGame) breakOrGame.classList.remove('d-none');
        
        lastFocus = false;
    }
}

// ========================================
// 成長表示
// ========================================
function updateGrowthArea() {
    let img = growthImgs[Math.min(growthLevel, growthImgs.length - 1)];
    const growthArea = document.getElementById('growth-area');
    if (growthArea) {
        growthArea.innerHTML = `
            <div class="growth-icon">${img}</div>
            <div class="growth-level">レベル ${growthLevel}</div>
        `;
    }
}

// ========================================
// 神経衰弱ゲーム
// ========================================
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
    
    board.innerHTML = '<div id="memory-board" class="memory-board"></div><div id="memory-info" class="mt-3 text-center"></div>';
    const memoryBoard = document.getElementById('memory-board');
    const memoryInfo = document.getElementById('memory-info');
    if (memoryInfo) memoryInfo.textContent = '試行回数: 0';

    let tries = 0;

    cards.forEach((emoji) => {
        const card = document.createElement('button');
        card.className = 'memory-card btn btn-lg';
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
                                memoryInfo.innerHTML += '<div class="mt-2 alert alert-success">クリア！おめでとう！</div>';
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

// ========================================
// 休憩タイマー
// ========================================
function runBreakTimer(targetId, seconds) {
    // 既存のタイマーをクリア
    if (breakTimerInterval) {
        clearInterval(breakTimerInterval);
    }
    
    let remainingTime = seconds;
    breakTimerRunning = true;
    
    const target = document.getElementById(targetId);
    if (!target) return;
    
    // 初期表示
    updateBreakTimerDisplay(target, remainingTime);
    
    breakTimerInterval = setInterval(() => {
        remainingTime--;
        updateBreakTimerDisplay(target, remainingTime);
        
        if (remainingTime <= 0) {
            stopBreakTimer();
            target.innerHTML = `
                <div class="alert alert-success text-center">
                    <h4 class="mb-3">
                        <i class="fas fa-check-circle me-2"></i>
                        休憩終了！
                    </h4>
                    <p class="mb-0">再開しましょう</p>
                </div>
            `;
        }
    }, 1000);
}

// 休憩タイマー表示を更新
function updateBreakTimerDisplay(target, remainingTime) {
    const timeString = formatTime(remainingTime);
    
    target.innerHTML = `
        <div class="alert alert-info text-center">
            <h3 class="mb-3">休憩中</h3>
            <div class="display-3 fw-bold text-primary mb-3" id="timer">${timeString}</div>
            <button class="btn btn-danger btn-lg" onclick="stopBreakTimer()">
                <i class="fas fa-stop me-2"></i>タイマーを停止
            </button>
        </div>
    `;
}

// 休憩タイマーを停止
function stopBreakTimer() {
    if (breakTimerInterval) {
        clearInterval(breakTimerInterval);
        breakTimerInterval = null;
    }
    breakTimerRunning = false;
    
    const target = document.getElementById('break-timer');
    if (target) {
        target.innerHTML = `
            <div class="alert alert-warning text-center">
                <h5 class="mb-3">
                    <i class="fas fa-hand-paper me-2"></i>
                    タイマーを停止しました
                </h5>
                <p class="text-muted mb-0">もう一度開始するには、時間を設定して「休憩開始」ボタンを押してください</p>
            </div>
        `;
    }
    
    console.log('⏹️ 休憩タイマーを停止しました');
}

// グローバルスコープに追加（ボタンから呼び出せるように）
window.stopBreakTimer = stopBreakTimer;


function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec%3600)/60);
    const s = sec%60;
    if (h > 0) return `${h}時間${m}分${s}秒`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
}

// ========================================
// セッション記録
// ========================================
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

// ========================================
// 履歴表示
// ========================================
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
        `<div class="table-responsive"><table class="table table-striped">
          <thead class="table-primary">
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
          </tbody></table></div>`;
    historyList.innerHTML = html;
    
    const aiFeedback = document.getElementById('ai-feedback');
    if (aiFeedback) {
        aiFeedback.textContent = aiFeedbackFromLogs(logs);
    }
}

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

// ========================================
// 通知機能
// ========================================
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

function checkNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('❌ このブラウザは通知をサポートしていません');
        return false;
    }
    console.log('✅ 通知サポート: 利用可能');
    return true;
}

async function requestNotificationPermission() {
    if (!checkNotificationPermission()) return false;
    
    try {
        const permission = await Notification.requestPermission();
        updateNotificationUI(permission);
        
        if (permission === 'granted') {
            alert('✅ 通知許可が取得できました！');
            return true;
        } else if (permission === 'denied') {
            alert('❌ 通知がブロックされました。');
            return false;
        }
    } catch (error) {
        alert('通知許可エラー: ' + error.message);
        return false;
    }
}

function showBasicNotification() {
    if (Notification.permission !== 'granted') {
        alert('❌ 通知許可が必要です。');
        return;
    }
    
    const notification = new Notification('🎯 集中力アプリ', {
        body: `集中時間: ${focusSeconds}秒\n非集中時間: ${unfocusSeconds}秒`
    });
    
    notification.onclick = function() {
        window.focus();
        notification.close();
    };
}

async function showServiceWorkerNotification() {
    if (Notification.permission !== 'granted') {
        alert('❌ 通知許可が必要です。');
        return;
    }
    
    if (!('serviceWorker' in navigator)) {
        alert('❌ Service Workerをサポートしていません');
        return;
    }
    
    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('🚀 バックグラウンド通知', {
            body: '他のタブでも表示されます！'
        });
    } catch (error) {
        alert('Service Worker通知エラー: ' + error.message);
    }
}

function updateNotificationUI(permission) {
    const statusElement = document.getElementById('notification-status');
    if (!statusElement) return;
    
    let statusHTML = '';
    switch (permission) {
        case 'granted':
            statusHTML = '<div class="alert alert-success py-2"><small>✅ 通知許可済み</small></div>';
            break;
        case 'denied':
            statusHTML = '<div class="alert alert-danger py-2"><small>❌ 通知ブロック済み</small></div>';
            break;
        default:
            statusHTML = '<div class="alert alert-warning py-2"><small>⚠️ 通知許可待ち</small></div>';
    }
    statusElement.innerHTML = statusHTML;
}

let notificationInterval = null;

function startPeriodicNotifications() {
    if (Notification.permission !== 'granted') {
        alert('❌ 通知許可が必要です。');
        return;
    }
    
    if (notificationInterval) clearInterval(notificationInterval);
    
    notificationInterval = setInterval(() => {
        if (document.hidden) {
            showBasicNotification();
        }
    }, 30000);
    
    alert('✅ 定期通知を開始しました（30秒ごと）');
}

function stopPeriodicNotifications() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
        alert('⏹️ 定期通知を停止しました');
    }
}

// ========================================
// BGM機能
// ========================================
function playBGM() {
    const enableCheckbox = document.getElementById('enable-bgm');
    if (!enableCheckbox || !enableCheckbox.checked) {
        stopBGM();
        return;
    }
    
    const bgmSelect = document.getElementById('bgm-select');
    const bgmValue = bgmSelect ? bgmSelect.value : 'none';
    const audio = document.getElementById('bgm-audio');
    
    if (!audio) return;
    
    let src = "";
    if (bgmValue === "cafe") {
        src = "./cafe_sound.mp3";
    } else if (bgmValue === "rain") {
        src = "./rain.mp3";
    } else if (bgmValue === "relax") {
        src = "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav";
    } else {
        stopBGM();
        return;
    }
    
    if (audio.src !== src) {
        audio.removeAttribute('crossorigin');
        audio.src = src;
        audio.load();
    }
    
    audio.volume = 0.3;
    audio.loop = true;
    
    audio.play()
        .then(() => {
            console.log('✅ BGM started');
            updateBGMButton(true);
        })
        .catch(error => {
            console.error('❌ BGM failed:', error);
            if (error.name === 'NotAllowedError') {
                showBGMActionRequired();
            }
        });
}

function stopBGM() {
    const audio = document.getElementById('bgm-audio');
    if (!audio) return;
    
    audio.pause();
    audio.currentTime = 0;
    updateBGMButton(false);
}

function updateBGMButton(isPlaying) {
    const testBtn = document.getElementById('test-bgm');
    if (!testBtn) return;
    
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

function showBGMActionRequired() {
    const existingAlert = document.getElementById('bgm-action-alert');
    if (existingAlert) existingAlert.remove();
    
    const alertDiv = document.createElement('div');
    alertDiv.id = 'bgm-action-alert';
    alertDiv.className = 'alert alert-warning alert-dismissible fade show';
    alertDiv.innerHTML = `
        <i class="fas fa-volume-up me-2"></i>
        <strong>BGM再生について</strong><br>
        ブラウザのセキュリティにより、クリックが必要です。
        <button type="button" class="btn btn-sm btn-primary ms-2" onclick="document.getElementById('bgm-audio').play(); this.parentElement.remove();">
            BGM再生
        </button>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const alertArea = document.getElementById('bgm-alert-area') || document.getElementById('main-screen');
    if (alertArea) {
        alertArea.insertBefore(alertDiv, alertArea.firstChild);
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
    console.log('Settings UI loaded');
}

// ========================================
// クリーンアップ
// ========================================
window.addEventListener('beforeunload', function() {
    if (analysisInterval) clearInterval(analysisInterval);
    if (timerInterval) clearInterval(timerInterval);
    if (breakTimerInterval) clearInterval(breakTimerInterval);  // 追加
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('📱 ページがバックグラウンド');
    } else {
        console.log('👀 ページがフォアグラウンド');
    }
});

console.log('🎨 Cool Version JavaScript loaded');
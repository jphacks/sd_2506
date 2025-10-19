// グローバル変数
let cameraStream = null;
let cameraOn = false;
let analysisInterval = null;

let focusSeconds = 0;
let unfocusSeconds = 0;
let lastFocus = true;
let growthLevel = 0;
let currentScore = 100;
let sessionTags = "";
let sessionMemo = "";
let sessionTeacherId = null;
let sessionTeacherName = null;
let sessionStartTime = null;

let timerInterval = null;
let audioUnlocked = false;
let pendingBGM = false;
let breakTimerInterval = null;
let breakTimerRunning = false;

// 成長アイコン
const growthImgs = ["🌱", "🌿", "🌳", "🌻", "🍎"];
const GROWTH_INTERVAL = 600;

// 画面遷移
function showScreen(screen) {
    ["main-screen", "memory-game-screen", "break-timer-screen", "history-screen", "settings-screen"].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.classList.add("d-none");
    });
    const targetScreen = document.getElementById(screen);
    if (targetScreen) targetScreen.classList.remove("d-none");
}

function updateActiveNav(activeId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.getElementById(activeId);
    if (activeItem) {
        activeItem.classList.add('active');
    }
}


// カメラ制御
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
            console.log('分析を開始しました');
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
            console.log('分析を停止しました');
        }
        
        // ステータスをリセット
        resetFocusStatus();
    }
}

function resetFocusStatus() {
    const statusBadge = document.getElementById('status-badge');
    const statusIcon = document.getElementById('status-icon-main');
    const statusText = document.getElementById('status-text-main');
    const statusSubtext = document.getElementById('status-subtext-main');
    
    if (statusBadge) {
        statusBadge.textContent = '待機中';
        statusBadge.className = 'status-badge status-waiting';
    }
    if (statusIcon) statusIcon.textContent = '⏳';
    if (statusText) statusText.textContent = '分析待機中';
    if (statusSubtext) statusSubtext.textContent = 'カメラを起動してください';
    
    const breakOrGame = document.getElementById('break-or-game');
    if (breakOrGame) breakOrGame.classList.add('d-none');
}

function updateCameraButton() {
    const toggleBtn = document.getElementById('camera-toggle');
    if (!toggleBtn) return;
    
    if (cameraOn) {
        toggleBtn.innerHTML = '<i class="fas fa-stop me-2"></i>カメラOFF';
        toggleBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    } else {
        toggleBtn.innerHTML = '<i class="fas fa-video me-2"></i>カメラON';
        toggleBtn.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
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
        const spinner = overlay.querySelector('.spinner-border');
        if (spinner) spinner.style.display = 'none';
    }
}


// オーディオアンロック
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
    // AudioContext初期化
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('btn-start-session');
  const sessionSetup = document.getElementById('session-setup');
  const mainScreen = document.getElementById('main-screen');

  // 初期表示：セッション設定のみ表示
  sessionSetup.classList.remove('d-none');
  mainScreen.classList.add('d-none');

    if (startBtn) {
        startBtn.onclick = function() {

            sessionSetup.classList.add('d-none');
            mainScreen.classList.remove('d-none');
            // 先生IDと名前を取得
            const teacherSelect = document.getElementById('session-teacher');
            sessionTeacherId = teacherSelect.value || null;
            sessionTeacherName = teacherSelect.options[teacherSelect.selectedIndex].text;
            sessionStartTime = new Date().toISOString();

            console.log(`セッション開始: 担当先生=${sessionTeacherName} (ID: ${sessionTeacherId})`);

            // セッション開始をバックエンドに通知
            fetch('/api/start-session', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    teacher_id: sessionTeacherId,
                    teacher_name: sessionTeacherName,
                    start_time: sessionStartTime
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    console.log('セッション開始成功:', data);
                } else {
                    console.error('セッション開始エラー:', data.error);
                }
            })
            .catch(err => console.error('APIエラー:', err));

            // 初期化処理
            setupEventListeners();
            startCamera();
            startFocusTimer();
            showScreen('main-screen');
        };
    }
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

    // サイドバーナビゲーション(add 10/18/15:02)
    const navMain = document.getElementById('nav-main');
    const navHistory = document.getElementById('nav-history');
    const navSettings = document.getElementById('nav-settings');

    if (navMain) {
        navMain.onclick = function(e) {
            e.preventDefault();
            showScreen('main-screen');
            updateActiveNav('nav-main');
        };
    }

    if (navHistory) {
        navHistory.onclick = function(e) {
            e.preventDefault();
            showScreen('history-screen');
            renderFocusHistory();
            updateActiveNav('nav-history');
        };
    }

    if (navSettings) {
        navSettings.onclick = function(e) {
            e.preventDefault();
            showScreen('settings-screen');
            loadSettingsUI();
            updateActiveNav('nav-settings');
        };
    }

     // セッション記録
    const saveBtn = document.getElementById('save-session');
    if (saveBtn) saveBtn.onclick = saveSessionUI;

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
            updateActiveNav('nav-main');
            runMemoryGame('memory-game');
        };
    }
    if (manualGameBtn) {
        manualGameBtn.onclick = function() {
            showScreen('memory-game-screen');
            updateActiveNav('nav-main');
            runMemoryGame('memory-game');
        };
    }
    if (backFromGame) {
        backFromGame.onclick = function() { 
            showScreen('main-screen'); 
            updateActiveNav('nav-main');
        };
    }

    // 休憩タイマー
    const breakBtn = document.getElementById('btn-break');
    const manualBreakBtn = document.getElementById('manual-break');
    const backFromBreak = document.getElementById('back-main-from-break');
    const startBreakBtn = document.getElementById('start-break-timer');
    
    if (breakBtn) {
        breakBtn.onclick = function() {
            showScreen('break-timer-screen');
            updateActiveNav('nav-main');
            const breakTimer = document.getElementById('break-timer');
            if (breakTimer) breakTimer.innerHTML = "";
            if (breakTimerRunning) stopBreakTimer();
        };
    }
    if (manualBreakBtn) {
        manualBreakBtn.onclick = function() {
            showScreen('break-timer-screen');
            updateActiveNav('nav-main');
            const breakTimer = document.getElementById('break-timer');
            if (breakTimer) breakTimer.innerHTML = "";
            if (breakTimerRunning) stopBreakTimer();
        };
    }
    if (backFromBreak) {
        backFromBreak.onclick = function() { 
            showScreen('main-screen');
            updateActiveNav('nav-main');
            if (breakTimerRunning) stopBreakTimer();
        };
    }
    if (startBreakBtn) {
        startBreakBtn.onclick = function() {
            if (breakTimerRunning) stopBreakTimer();
            
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
    
    if (requestPermissionBtn) requestPermissionBtn.onclick = requestNotificationPermission;
    if (basicNotificationBtn) basicNotificationBtn.onclick = showBasicNotification;
    if (serviceWorkerNotificationBtn) serviceWorkerNotificationBtn.onclick = showServiceWorkerNotification;
    
    setTimeout(() => {
        checkNotificationPermission();
        updateNotificationUI(Notification.permission);
    }, 1000);

    // ログアウトボタン
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = function() {
            // 確認ダイアログ
            if (confirm('学習を終了してログアウトしますか？\n（記録は保存されます）')) {
                // セッションを自動保存
                saveSessionAndLogout();
            }
        };
    }
}


// タイマー
function startFocusTimer() {
    timerInterval = setInterval(() => {
        if (cameraOn) {
            if (lastFocus) {
                focusSeconds++;
            } else {
                unfocusSeconds++;
            }
            updateTimerDisplay();
        }
    }, 1000);
}

function updateTimerDisplay() {
    // 新しいタイマー表示を更新
    const focusDisplay = document.getElementById('timer-focus-display');
    const unfocusDisplay = document.getElementById('timer-unfocus-display');
    
    if (focusDisplay) {
        focusDisplay.textContent = formatTimeDetailed(focusSeconds);
    }
    if (unfocusDisplay) {
        unfocusDisplay.textContent = formatTimeDetailed(unfocusSeconds);
    }
    
    // スコア更新
    updateScore();
    
    // 成長プログレスバー更新
    updateGrowthProgress();
}

function formatTimeDetailed(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}分${s}秒`;
}

function formatTimeShort(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    const m = Math.floor(seconds / 60);
    return `${m}分`;
}

function updateScore() {
    // 集中度に応じてスコア計算
    const totalTime = focusSeconds + unfocusSeconds;
    if (totalTime === 0) {
        currentScore = 100;
    } else {
        const focusRate = focusSeconds / totalTime;
        currentScore = Math.round(focusRate * 100);
    }
    
    const scoreDisplay = document.getElementById('current-score-display');
    if (scoreDisplay) {
        scoreDisplay.textContent = currentScore;
    }
}

function updateGrowthProgress() {
    const progress = (focusSeconds % GROWTH_INTERVAL) / GROWTH_INTERVAL * 100;
    const progressBar = document.getElementById('growth-progress-bar');
    if (progressBar) {
        progressBar.style.width = progress + '%';
        progressBar.textContent = Math.round(progress) + '%';
    }
}

// 画像キャプチャ→分析
function captureAndSend() {
    // カメラがOFFの場合は何もしない
    if (!cameraOn) {
        console.log('カメラがOFFのため分析をスキップします');
        return;
    }
    
    const video = document.getElementById('camera');
    if (!video || !video.videoWidth || video.videoWidth === 0) {
        console.log('Video not ready yet');
        return;
    }
    
    console.log('キャプチャ実行中');
    
    // デモ用：30%の確率で状態変更
    // if (Math.random() > 0.7) {
    //     const demoResult = {
    //         focus: Math.random() > 0.5 ? 'focused' : 'unfocused',
    //         confidence: Math.random()
    //     };
    //     console.log('デモ用状態変更:', demoResult);
    //     updateFocusStatus(demoResult);
    // }

    // キャンバスに動画フレームを描画
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Base64エンコード
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Flaskバックエンドに送信
    fetch('/index_coolver', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image: imageData
        })
    })
    .then(response => {
        // レスポンスのContent-Typeを確認
        const contentType = response.headers.get('content-type');
        
        if (!contentType || !contentType.includes('application/json')) {
            console.error('サーバーがJSONを返していません:', contentType);
            throw new Error('サーバーエラー: JSON形式ではありません');
        }
        
        // // ステータスコード確認
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    })
    .then(data => {
        console.log('分析結果:', data);
        
        // エラーチェック
        if (data.error) {
            console.error('サーバーエラー:', data.error);
            
            // セッション切れの場合はログインページへ
            if (data.error.includes('未ログイン') || data.error.includes('権限')) {
                alert('セッションが切れました。再度ログインしてください。');
                window.location.href = '/';
                return;
            }
            return;
        }
        
        // 結果に基づいてUI更新
        if (data.focus) {
            updateFocusStatus({ focus: data.focus });
        }
    })
    .catch(error => {
        console.error('分析エラー:', error);
        
        // ネットワークエラーの場合
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            console.error('ネットワークエラー: サーバーに接続できません');
        }
    });
}


// 集中状態更新

function updateFocusStatus(result) {
    const statusBadge = document.getElementById('status-badge');
    const statusIcon = document.getElementById('status-icon-main');
    const statusText = document.getElementById('status-text-main');
    const statusSubtext = document.getElementById('status-subtext-main');
    
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
        
        // 成長判定（10分ごと）
        if (focusSeconds > 0 && focusSeconds % GROWTH_INTERVAL === 0) {
            growthLevel++;
            updateGrowthArea();
            showLevelUpNotification();
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

function showLevelUpNotification() {
    if (Notification.permission === 'granted') {
        new Notification('レベルアップ！', {
            body: `成長レベル ${growthLevel} になりました！`,
            icon: 'icons/icon-192.png'
        });
    }
}

// 成長表示
function updateGrowthArea() {
    let img = growthImgs[Math.min(growthLevel, growthImgs.length - 1)];
    const growthArea = document.getElementById('growth-area');
    if (growthArea) {
        growthArea.innerHTML = `
            <div class="growth-icon-large">${img}</div>
            <div class="growth-level-text">レベル ${growthLevel}</div>
            <div class="growth-description">集中時間を積み重ねて成長させよう！</div>
        `;
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
    
    board.innerHTML = '<div id="memory-board" class="memory-board"></div><div id="memory-info" class="mt-3 text-center"></div>';
    const memoryBoard = document.getElementById('memory-board');
    const memoryInfo = document.getElementById('memory-info');
    if (memoryInfo) memoryInfo.innerHTML = '<h4>試行回数: <span id="tries-count">0</span></h4>';

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
                const triesCount = document.getElementById('tries-count');
                if (triesCount) triesCount.textContent = tries;
                
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
                                memoryInfo.innerHTML += '<div class="mt-3 alert alert-success"><h4>🎉 クリア！おめでとう！</h4><p>試行回数: ' + tries + '回</p></div>';
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
    if (breakTimerInterval) {
        clearInterval(breakTimerInterval);
    }
    
    let remainingTime = seconds;
    breakTimerRunning = true;
    
    const target = document.getElementById(targetId);
    if (!target) return;
    
    updateBreakTimerDisplay(target, remainingTime);
    
    breakTimerInterval = setInterval(() => {
        remainingTime--;
        updateBreakTimerDisplay(target, remainingTime);
        
        if (remainingTime <= 0) {
            stopBreakTimer();
            target.innerHTML = `
                <div class="alert alert-success text-center">
                    <h3 class="mb-3">
                        <i class="fas fa-check-circle me-2"></i>
                        休憩終了！
                    </h3>
                    <p class="mb-0">再開しましょう</p>
                </div>
            `;
            
            // 終了通知
            if (Notification.permission === 'granted') {
                new Notification('休憩終了', {
                    body: '学習を再開しましょう！'
                });
            }
        }
    }, 1000);
}

function updateBreakTimerDisplay(target, remainingTime) {
    const timeString = formatTime(remainingTime);
    
    target.innerHTML = `
        <div class="alert alert-info text-center">
            <h4 class="mb-3">休憩中</h4>
            <div class="display-3 fw-bold text-primary mb-3" id="timer">${timeString}</div>
            <button class="btn btn-danger btn-lg" onclick="stopBreakTimer()">
                <i class="fas fa-stop me-2"></i>タイマーを停止
            </button>
        </div>
    `;
}

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
    
    console.log('休憩タイマーを停止しました');
}

window.stopBreakTimer = stopBreakTimer;

function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec%3600)/60);
    const s = sec%60;
    if (h > 0) return `${h}時間${m}分${s}秒`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
}

// セッション記録
// ログアウト時にバックエンドへ送信
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
    
    const sessionData = {
        teacher_name: sessionTeacherName || '先生なし',
        start_time: sessionStartTime,
        end_time: new Date().toISOString(),
        focus_seconds: focusSeconds,
        unfocus_seconds: unfocusSeconds,
        tags: sessionTags,
        memo: sessionMemo
    };
    
    // バックエンドに送信
    fetch('/api/end-session', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(sessionData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log('セッション保存成功');
            alert("記録しました！");
            
            // 入力欄クリア
            if (tagsInput) tagsInput.value = '';
            if (memoInput) memoInput.value = '';
            
            // ローカルストレージにも保存（オプション）
            saveToLocalStorage(sessionData);
        } else {
            console.error('セッション保存エラー:', data.error);
            alert('記録に失敗しました: ' + data.error);
        }
    })
    .catch(err => {
        console.error('APIエラー:', err);
        alert('記録に失敗しました');
    });
}
// ローカルストレージにも保存（バックアップ）
function saveToLocalStorage(sessionData) {
    const log = {
        date: sessionData.end_time,
        focus: sessionData.focus_seconds,
        unfocus: sessionData.unfocus_seconds,
        growth: growthLevel,
        score: currentScore,
        tags: sessionData.tags.split(',').map(s => s.trim()).filter(s => s),
        memo: sessionData.memo,
        teacher: sessionData.teacher_name
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
}
// セッション保存後にログアウト
function saveSessionAndLogout() {
    const sessionData = {
        teacher_name: sessionTeacherName || '先生なし',
        start_time: sessionStartTime,
        end_time: new Date().toISOString(),
        focus_seconds: focusSeconds,
        unfocus_seconds: unfocusSeconds,
        tags: sessionTags,
        memo: sessionMemo
    };
    
    fetch('/api/end-session', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(sessionData)
    })
    .then(res => res.json())
    .then(data => {
        console.log('セッション自動保存完了');
        // ログアウトページへ遷移
        window.location.href = '/logout';
    })
    .catch(err => {
        console.error('セッション保存エラー:', err);
        // エラーでもログアウトは実行
        window.location.href = '/logout';
    });
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
    
    if (logs.length === 0) {
        historyList.innerHTML = '<div class="alert alert-info">履歴がありません</div>';
        const aiFeedback = document.getElementById('ai-feedback');
        if (aiFeedback) {
            aiFeedback.textContent = '履歴がありません';
        }
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-striped">
                <thead class="table-primary">
                    <tr><th>日時</th><th>集中</th><th>非集中</th><th>レベル</th><th>スコア</th><th>タグ</th><th>メモ</th></tr>
                </thead>
                <tbody>
    `;
    
    logs.forEach((l, i) => {
        html += `
            <tr>
                <td>${new Date(l.date).toLocaleString('ja-JP')}</td>
                <td>${formatTimeShort(l.focus)}</td>
                <td>${formatTimeShort(l.unfocus)}</td>
                <td>${l.growth}</td>
                <td>${l.score || '-'}</td>
                <td><input value="${(l.tags || []).join(',')}" class="form-control form-control-sm" onchange="updateTag(${i},this.value)"></td>
                <td><input value="${l.memo || ''}" class="form-control form-control-sm" onchange="updateMemo(${i},this.value)"></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    historyList.innerHTML = html;
    
    //(できればAI)FB
    const aiFeedback = document.getElementById('ai-feedback');
    if (aiFeedback) {
        aiFeedback.textContent = aiFeedbackFromLogs(logs);
    }
}

window.updateTag = function(idx, val) {
    let logs = JSON.parse(localStorage.getItem('focusLogs') || '[]');
    if (logs[idx]) {
        logs[idx].tags = val.split(',').map(s => s.trim()).filter(s => s);
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
    if (!logs.length) return "履歴がありません";
    
    let tagCount = {};
    logs.forEach(l => (l.tags || []).forEach(t => tagCount[t] = (tagCount[t] || 0) + 1));
    
    let bestTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    let avgFocus = Math.round(logs.reduce((a, b) => a + b.focus, 0) / logs.length);
    let avgScore = Math.round(logs.reduce((a, b) => a + (b.score || 0), 0) / logs.length);
    
    let msg = `総セッション数：${logs.length}回\n`;
    msg += `平均集中時間：${Math.floor(avgFocus / 60)}分${avgFocus % 60}秒\n`;
    msg += `平均スコア：${avgScore}点\n`;
    if (bestTag) msg += `よく使うタグ：「${bestTag}」\n`;
    msg += "\n 良かった点や反省点をメモして自己成長に役立てましょう！";
    
    return msg;
}


// 通知機能
function showGentleNotification() {
    const enableNotify = document.getElementById('enable-notify');
    if (!enableNotify || !enableNotify.checked) return;
    
    // 10分ごとに通知
    if (focusSeconds % 600 === 0 && focusSeconds > 0) {
        if (Notification.permission === "granted") {
            const notifyMsg = document.getElementById('notify-msg');
            new Notification('集中継続中！', {
                body: notifyMsg ? notifyMsg.value : "集中時間をチェックしませんか？",
                icon: 'icons/icon-192.png'
            });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(perm => {
                if (perm === "granted") showGentleNotification();
            });
        }
    }
}

function checkNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('このブラウザは通知をサポートしていません');
        return false;
    }
    console.log('通知サポート: 利用可能');
    return true;
}

async function requestNotificationPermission() {
    if (!checkNotificationPermission()) return false;
    
    try {
        const permission = await Notification.requestPermission();
        updateNotificationUI(permission);
        
        if (permission === 'granted') {
            alert('通知許可が取得できました！');
            return true;
        } else if (permission === 'denied') {
            alert('通知がブロックされました。');
            return false;
        }
    } catch (error) {
        alert('通知許可エラー: ' + error.message);
        return false;
    }
}

function showBasicNotification() {
    if (Notification.permission !== 'granted') {
        alert('通知許可が必要です。');
        return;
    }
    
    const notification = new Notification('集中力アプリ', {
        body: `集中時間: ${formatTimeShort(focusSeconds)}\n非集中時間: ${formatTimeShort(unfocusSeconds)}\nスコア: ${currentScore}点`,
        icon: 'icons/icon-192.png'
    });
    
    notification.onclick = function() {
        window.focus();
        notification.close();
    };
}

async function showServiceWorkerNotification() {
    if (Notification.permission !== 'granted') {
        alert('通知許可が必要です。');
        return;
    }
    
    if (!('serviceWorker' in navigator)) {
        alert('Service Workerをサポートしていません');
        return;
    }
    
    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('バックグラウンド通知テスト', {
            body: '他のタブでも表示されます！',
            icon: 'icons/icon-192.png'
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
            statusHTML = '<div class="alert alert-success py-2 mb-0"><small>✅ 通知許可済み</small></div>';
            break;
        case 'denied':
            statusHTML = '<div class="alert alert-danger py-2 mb-0"><small>❌ 通知ブロック済み</small></div>';
            break;
        default:
            statusHTML = '<div class="alert alert-warning py-2 mb-0"><small>⚠️ 通知許可待ち</small></div>';
    }
    statusElement.innerHTML = statusHTML;
}

// BGM機能
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
        src = "";
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
            console.log('BGM started');
            updateBGMButton(true);
        })
        .catch(error => {
            console.error('BGM failed:', error);
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


// クリーンアップ
window.addEventListener('beforeunload', function() {
    if (analysisInterval) clearInterval(analysisInterval);
    if (timerInterval) clearInterval(timerInterval);
    if (breakTimerInterval) clearInterval(breakTimerInterval);
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('ページがバックグラウンド');
    } else {
        console.log('ページがフォアグラウンド');
    }
});

console.log('Cool Version JavaScript loaded successfully');

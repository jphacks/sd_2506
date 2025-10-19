// グローバル変数
let students = [];
let selectedStudent = null;
let notificationCount = 0;
let updateInterval = null;

// 初期化

document.addEventListener('DOMContentLoaded', function() {
    console.log('Teacher Dashboard loaded');
    
    // 生徒データ取得
    fetchStudentsData();
    
    // 初期表示
    renderStudentsList();
    updateStatistics();
    
    // イベントリスナー設定
    setupEventListeners();
    
    // 定期更新開始（5秒ごと）
    startAutoUpdate();
});


// // ダミーデータ生成
// function generateDummyStudents() {
//     const names = [
//         { name:'A', id: 'S001' },
//         { name:'B', id: 'S002' },
//         { name:'C', id: 'S003' },
//         { name:'D', id: 'S004' },
//         { name:'E', id: 'S005' },
//         { name:'F', id: 'S006' }
//     ];
    
//     const now = new Date();
    
//     students = names.map((name, index) => {
//         const isOnline = Math.random() > 0.2; // 80%がオンライン
//         const focusMinutes = Math.floor(Math.random() * 40) + 10; // 10-50分
//         const unfocusMinutes = Math.floor(Math.random() * 20); // 0-20分
//         const totalMinutes = focusMinutes + unfocusMinutes;
//         const unfocusRate = totalMinutes > 0 ? (unfocusMinutes / totalMinutes) * 100 : 0;
        
//         // ログイン時刻（30分〜120分前）
//         const loginTime = new Date(now.getTime() - (Math.random() * 90 + 30) * 60 * 1000);
        
//         // ログアウト時刻（オフラインの場合のみ）
//         const logoutTime = !isOnline ? new Date(now.getTime() - Math.random() * 30 * 60 * 1000) : null;
        
//         // タグ生成
//         const allTags = ['#あいう', '#えおか', '#きくけ', '#こさし', '#すせそ', '#たちつ'];
//         const tagCount = Math.floor(Math.random() * 3) + 1;
//         const tags = [];
//         for (let i = 0; i < tagCount; i++) {
//             const randomTag = allTags[Math.floor(Math.random() * allTags.length)];
//             if (!tags.includes(randomTag)) tags.push(randomTag);
//         }
        
//         // メモ生成
//         const memos = [
//             'メモだよん',
//             'メモなのだ',
//             'メモですわ',
//             'メモなの',
//             'メモです',
//             'メモだす'
//         ];
//         const memo = memos[Math.floor(Math.random() * memos.length)];
        
//         // 過去のセッション履歴生成
//         const history = [];
//         for (let i = 1; i <= 5; i++) {
//             const historyDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
//             history.push({
//                 date: historyDate.toISOString(),
//                 focusMinutes: Math.floor(Math.random() * 40) + 10,
//                 unfocusMinutes: Math.floor(Math.random() * 15),
//                 tags: tags.slice(0, Math.floor(Math.random() * 2) + 1)
//             });
//         }
        
//         return {
//             id: name.id,
//             name: `${name.last} ${name.first}`,
//             isOnline: isOnline,
//             loginTime: loginTime.toISOString(),
//             logoutTime: logoutTime ? logoutTime.toISOString() : null,
//             focusMinutes: focusMinutes,
//             unfocusMinutes: unfocusMinutes,
//             unfocusRate: unfocusRate,
//             needsAlert: unfocusRate > 25, // 25%超えたらアラート
//             tags: tags,
//             memo: memo,
//             history: history
//         };
//     });
// }


// 生徒データ取得
function fetchStudentsData() {
    fetch('/api/teacher/students')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                students = data.students;
                renderStudentsList();
                updateStatistics();
                if (selectedStudent) {
                    const updated = students.find(s => s.id === selectedStudent.id);
                    if (updated) selectStudent(updated);
                }
            } else {
                console.error('生徒データ取得エラー:', data.error);
            }
        })
        .catch(err => console.error('APIエラー:', err));
}

// 生徒リスト表示
function renderStudentsList() {
    const listEl = document.getElementById('students-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (students.length === 0) {
        listEl.innerHTML = '<p class="text-center text-muted">生徒データがありません</p>';
        return;
    }
    students.forEach(st => {
        const card = createStudentCard(st);
        listEl.appendChild(card);
    });
}

function createStudentCard(student) {
    const card = document.createElement('div');
    card.className = 'student-card';
    
    if (selectedStudent && selectedStudent.id === student.id) {
        card.classList.add('selected');
    }
    
    if (student.needsAlert) {
        card.classList.add('alert-active');
    }
    
    // const statusClass = student.isOnline ? 'status-online' : 'status-offline';
    // const statusText = student.isOnline ? 'オンライン' : 'オフライン';
    // const statusIcon = student.isOnline ? 'check_circle' : 'radio_button_unchecked';
    
    card.innerHTML = `
        <div class="student-avatar">
            <span class="material-icons">account_circle</span>
            ${student.needsAlert?'<div class="alert-indicator"></div>':''}
        </div>
        <div class="student-card-content">
            <div class="student-name">${student.name}</div>
            <div class="student-status ${student.isOnline?'status-online':'status-offline'}">
                <span class="material-icons">${student.isOnline?'check_circle':'radio_button_unchecked'}</span>
                <span>${student.isOnline?'オンライン':'オフライン'}</span>
            </div>
            <div class="student-time-info">
                <div class="time-badge focus"><span class="material-icons">check</span><span>${student.focusMinutes}分</span></div>
                <div class="time-badge unfocus"><span class="material-icons">warning</span><span>${student.unfocusMinutes}分</span></div>
            </div>
        </div>`;
    
    card.onclick = function() {
        selectStudent(student);
    };
    
    return card;
}

// 選択した生徒の情報
function fetchStudentHistory(studentId) {
    fetch(`/api/teacher/student-history/${studentId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderStudentHistory(data.history);
            } else {
                console.error('履歴取得エラー:', data.error);
                renderStudentHistory([]);
            }
        })
        .catch(err => {
            console.error('APIエラー:', err);
            renderStudentHistory([]);
        });
}

// 統計更新
function updateStatistics() {
    const onlineCount = students.filter(s => s.isOnline).length;
    const alertCount = students.filter(s => s.needsAlert && s.isOnline).length;
    
    document.getElementById('online-count').textContent = onlineCount;
    document.getElementById('alert-count').textContent = alertCount;
    
    // 通知カウント更新
    notificationCount = alertCount;
    document.getElementById('notification-count').textContent = notificationCount;
}


// 生徒選択
function selectStudent(student) {
    selectedStudent = student;
    
    // リストの選択状態を更新
    renderStudentsList();
    
    // 詳細パネルを表示
    const noSelection = document.getElementById('no-selection');
    const detailPanel = document.getElementById('student-detail');
    // const detailPanel = document.getElementById('student-detail');
    if (noSelection) noSelection.classList.add('d-none');
    if (detailPanel) detailPanel.classList.remove('d-none');
    
    // 基本情報
    // document.getElementById('detail-name').textContent = student.name;
    // document.getElementById('detail-student-id').textContent = student.id;
    const nameEl = document.getElementById('detail-name');
    const idEl = document.getElementById('detail-student-id');
    if (nameEl) nameEl.textContent = student.name || '不明';
    if (idEl) idEl.textContent = student.id || '-';
    
    // ステータス
    // const statusIcon = document.getElementById('detail-status-icon');
    // const statusText = document.getElementById('detail-status-text');
    // const loginStatus = statusIcon.parentElement;
    const iconEl = document.getElementById('detail-status-icon');
    const txtEl = document.getElementById('detail-status-text');
    
    if (iconEl && txtEl) {
        const statusParent = iconEl.parentElement;
        
        if (student.isOnline) {
            iconEl.textContent = 'check_circle';
            txtEl.textContent = 'オンライン';
            if (statusParent) {
                statusParent.classList.add('online');
                statusParent.classList.remove('offline');
            }
        } else {
            iconEl.textContent = 'radio_button_unchecked';
            txtEl.textContent = 'オフライン';
            if (statusParent) {
                statusParent.classList.add('offline');
                statusParent.classList.remove('online');
            }
        }
    }
    
    // ログイン時刻
    const loginEl = document.getElementById('detail-login-time');
    if (loginEl) {
        loginEl.textContent = student.loginTime ? formatTime(student.loginTime) : '--:--';
    }
    
    // ログアウト時刻
    const logoutEl = document.getElementById('detail-logout-time');
    if (logoutEl) {
        logoutEl.textContent = student.logoutTime ? formatTime(student.logoutTime) : '--:--';
    }
    
    // 集中時間データ
    const focusEl = document.getElementById('detail-focus-time');
    const unfocusEl = document.getElementById('detail-unfocus-time');
    if (focusEl) focusEl.textContent = `${student.focusMinutes || 0}分`;
    if (unfocusEl) unfocusEl.textContent = `${student.unfocusMinutes || 0}分`;
    
    // 集中割合
    // const totalMinutes = student.focusMinutes + student.unfocusMinutes;
    // const focusPercentage = totalMinutes > 0 ? Math.round((student.focusMinutes / totalMinutes) * 100) : 0;
    // const progressBar = document.getElementById('detail-focus-percentage');
    // progressBar.style.width = focusPercentage + '%';
    // progressBar.textContent = focusPercentage + '%';
    const totalMin = (student.focusMinutes || 0) + (student.unfocusMinutes || 0);
    const focusPct = totalMin > 0 ? Math.round((student.focusMinutes / totalMin) * 100) : 0;
    const progressBar = document.getElementById('detail-focus-percentage');
    
    // プログレスバーの色変更（集中割合に応じて）
    if (progressBar) {
        progressBar.style.width = `${focusPct}%`;
        progressBar.textContent = `${focusPct}%`;
        
        progressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
        if (focusPct >= 75) {
            progressBar.classList.add('bg-success');
        } else if (focusPct >= 50) {
            progressBar.classList.add('bg-warning');
        } else {
            progressBar.classList.add('bg-danger');
        }
    }
    
    // タグ
    const tagsEl = document.getElementById('detail-tags');
    if (tagsEl) {
        if (student.tags && Array.isArray(student.tags) && student.tags.length > 0) {
            tagsEl.innerHTML = student.tags.map(tag => 
                `<span class="tag-badge">${tag}</span>`
            ).join('');
        } else {
            tagsEl.innerHTML = '<span class="tag-badge">タグなし</span>';
        }
    }
    
    // メモ
    const memoEl = document.getElementById('detail-memo');
    if (memoEl) {
        memoEl.textContent = student.memo || 'メモがありません';
    }
    
    // 履歴
    fetchStudentHistory(student.id);
}


// 履歴表示
function renderStudentHistory(history) {
    const historyEl = document.getElementById('detail-history');
    if (!historyEl) return;
    
    if (!history || history.length === 0) {
        historyEl.innerHTML = '<p class="text-muted">履歴がありません</p>';
        return;
    }
    
    let html = '';
    history.forEach(session => {
        const date = new Date(session.start_time);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} (${['日','月','火','水','木','金','土'][date.getDay()]})`;
        const focusMin = Math.floor(session.focus_seconds / 60);
        const unfocusMin = Math.floor(session.unfocus_seconds / 60);
        
        html += `
            <div class="history-item">
                <div class="history-date">${dateStr}</div>
                <div class="history-stats">
                    <div>集中: <strong>${focusMin}分</strong></div>
                    <div>非集中: <strong>${unfocusMin}分</strong></div>
                </div>
            </div>
        `;
    });
    
    historyEl.innerHTML = html;
}


// イベントリスナー設定
function setupEventListeners() {
    // 通知ボタン
    const btnNotification = document.getElementById('btn-notification');
    if (btnNotification) {
        btnNotification.onclick = function() {
            showNotificationList();
        };
    }
    
    // 通知スルーボタン
    const btnDismissAlert = document.getElementById('btn-dismiss-alert');
    if (btnDismissAlert) {
        btnDismissAlert.onclick = function() {
            dismissAlert();
        };
    }
    
    // メッセージ送信ボタン
    const btnSendMessage = document.getElementById('btn-send-message');
    if (btnSendMessage) {
        btnSendMessage.onclick = function() {
            sendMessage();
        };
    }
}


// アクション
function dismissAlert() {
        if(!selectedStudent){alert('生徒を選択してください');return;}
    selectedStudent.needsAlert=false; renderStudentsList(); updateStatistics();
    showToast(`${selectedStudent.name}さんのアラートをスルーしました`);
}

function sendMessage() {
    if(!selectedStudent){alert('生徒を選択してください');return;}
    const msg=prompt(`${selectedStudent.name}さんにメッセージ:`,`頑張ってください！`);
    if(!msg)return;
    fetch('/api/teacher/send-message',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({student_id:selectedStudent.id,message:msg})
    })
    .then(r=>r.json())
    .then(d=>{
        if(d.success) showToast('送信しました');
        else alert('送信失敗:'+d.error);
    })
    .catch(e=>{console.error(e);alert('送信失敗');});
}

// function sendMessage() {
//     if (!selectedStudent) {
//         alert('生徒を選択してください');
//         return;
//     }
    
//     const message = prompt(`${selectedStudent.name}さんにメッセージを送信:`, '頑張っていますね！');
    
//     if (message) {
//         console.log(`メッセージ送信: ${selectedStudent.name} - ${message}`);
//         showToast(`${selectedStudent.name}さんにメッセージを送信しました`);
        
//         // 実際の実装ではFlask API経由でWebSocketなどで送信
//     }
// }

function showNotificationList() {
    const alertStudents = students.filter(s => s.needsAlert && s.isOnline);
    
    if (alertStudents.length === 0) {
        alert('現在、注意が必要な生徒はいません');
        return;
    }
    
    let message = '注意が必要な生徒:\n\n';
    alertStudents.forEach(student => {
        message += `• ${student.name} (非集中率: ${Math.round(student.unfocusRate)}%)\n`;
    });
    
    alert(message);
}

// トースト表示
function showToast(message) {
    const toastElement = document.getElementById('notification-toast');
    const toastMessage = document.getElementById('toast-message');
    
    if (toastMessage) {
        toastMessage.textContent = message;
    }
    
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 3000
    });
    
    toast.show();
}


// 定期更新

function startAutoUpdate() {
    updateInterval = setInterval(() => {
        // ランダムにデータを更新（デモ用）
        students.forEach(student => {
            if (Math.random() > 0.7 && student.isOnline) { // 30%の確率で更新
                // 集中時間をランダムに増加
                student.focusMinutes += Math.floor(Math.random() * 2);
                student.unfocusMinutes += Math.floor(Math.random() * 2);
                
                // 非集中率を再計算
                const totalMinutes = student.focusMinutes + student.unfocusMinutes;
                student.unfocusRate = totalMinutes > 0 ? (student.unfocusMinutes / totalMinutes) * 100 : 0;
                
                // アラート判定
                const wasAlert = student.needsAlert;
                student.needsAlert = student.unfocusRate > 25;
                
                // 新しくアラートが発生した場合は通知
                if (!wasAlert && student.needsAlert) {
                    showToast(`${student.name}さんの集中度が低下しています`);
                }
            }
        });
        
        // UI更新
        renderStudentsList();
        updateStatistics();
        
        // 選択中の生徒の詳細を更新
        if (selectedStudent) {
            const updatedStudent = students.find(s => s.id === selectedStudent.id);
            if (updatedStudent) {
                selectStudent(updatedStudent);
            }
        }
        
    }, 5000); // 5秒ごと
}

// クリーンアップ
window.addEventListener('beforeunload', function() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});

console.log('Teacher Dashboard JavaScript loaded successfully');

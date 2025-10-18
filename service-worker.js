// service-worker.js
console.log('🔧 Service Worker loaded');

// Service Worker インストール
self.addEventListener('install', (event) => {
    console.log('📦 Service Worker installing...');
    self.skipWaiting();
});

// Service Worker アクティベート
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker activated');
    event.waitUntil(clients.claim());
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
    console.log('👆 通知がクリックされました:', event.notification.data);
    
    event.notification.close();
    
    if (event.action === 'open') {
        // アプリを開く
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'close') {
        // 何もしない（通知を閉じるだけ）
        console.log('🚫 通知を閉じました');
    } else {
        // デフォルトクリック（アクションボタン以外）
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                // 既存のウィンドウがあればフォーカス
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                // なければ新しいウィンドウを開く
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

// バックグラウンド同期（試験的機能）
self.addEventListener('sync', (event) => {
    if (event.tag === 'focus-reminder') {
        console.log('🔄 バックグラウンド同期: 集中リマインダー');
        event.waitUntil(showFocusReminder());
    }
});

async function showFocusReminder() {
    await self.registration.showNotification('💪 集中時間の確認', {
        body: 'しばらく集中状態をチェックしていません',
        icon: 'icon-192.png',
        actions: [
            { action: 'open', title: 'アプリを確認' },
            { action: 'snooze', title: '後で確認' }
        ],
        data: { type: 'focus-reminder' }
    });
}

// メッセージ受信処理
self.addEventListener('message', (event) => {
    console.log('💬 Service Worker メッセージ受信:', event.data);
    
    if (event.data.type === 'SHOW_NOTIFICATION') {
        showNotificationFromMessage(event.data.payload);
    }
});

async function showNotificationFromMessage(payload) {
    await self.registration.showNotification(payload.title || '集中力アプリ', {
        body: payload.body || 'メッセージがありません',
        icon: 'icon-192.png',
        data: payload
    });
}

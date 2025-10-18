import sqlite3
import hashlib
from datetime import datetime
import os

#332からテスト用実行を記述

class DatabaseManager:
    """データベース管理クラス"""
    
    def __init__(self, db_folder='database'):
        """
        初期化
        db_folder: データベースファイルを保存するフォルダ
        """
        self.db_folder = db_folder
        self.main_db = os.path.join(db_folder, 'users.db')
        
        # フォルダが存在しない場合は作成
        if not os.path.exists(db_folder):
            os.makedirs(db_folder)
        
        # メインデータベース（ユーザー管理用）を初期化
        self._init_main_db()
    
    def _init_main_db(self):
        """メインデータベース（ユーザー管理用）の初期化"""
        with sqlite3.connect(self.main_db) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            conn.commit()
            print(f"✅ メインデータベースを初期化しました: {self.main_db}")
    
    def _hash_password(self, password):
        """
        パスワードをハッシュ化
        引数:
            password: 平文パスワード
        戻り値:
            ハッシュ化されたパスワード
        """
        return hashlib.sha256(password.encode()).hexdigest()
    
    def register_user(self, name, password):
        """
        新規ユーザー登録
        引数:
            name: ユーザー名
            password: パスワード
        戻り値:
            dict: {'success': True/False, 'message': メッセージ, 'user_id': ID}
        """
        try:
            with sqlite3.connect(self.main_db) as conn:
                cursor = conn.cursor()
                
                # 既存ユーザーチェック
                cursor.execute("SELECT * FROM users WHERE name = ?", (name,))
                if cursor.fetchone():
                    return {
                        'success': False,
                        'message': 'このユーザー名は既に使用されています'
                    }
                
                # パスワードをハッシュ化
                password_hash = self._hash_password(password)
                created_at = datetime.now().isoformat()
                
                # ユーザー登録
                cursor.execute("""
                    INSERT INTO users (name, password_hash, created_at)
                    VALUES (?, ?, ?)
                """, (name, password_hash, created_at))
                
                user_id = cursor.lastrowid
                conn.commit()
                
                # ユーザー個別のデータベースを作成
                self._create_user_db(name)
                
                print(f"✅ ユーザー登録成功: {name} (ID: {user_id})")
                
                return {
                    'success': True,
                    'message': 'ユーザー登録が完了しました',
                    'user_id': user_id
                }
                
        except sqlite3.Error as e:
            print(f"❌ ユーザー登録エラー: {e}")
            return {
                'success': False,
                'message': f'登録エラー: {str(e)}'
            }
    
    def login_user(self, name, password):
        """
        ログイン処理
        引数:
            name: ユーザー名
            password: パスワード
        戻り値:
            dict: {'success': True/False, 'message': メッセージ, 'user': ユーザー情報}
        """
        try:
            with sqlite3.connect(self.main_db) as conn:
                cursor = conn.cursor()
                
                # パスワードをハッシュ化
                password_hash = self._hash_password(password)
                
                # ユーザー検索
                cursor.execute("""
                    SELECT user_id, name, created_at
                    FROM users
                    WHERE name = ? AND password_hash = ?
                """, (name, password_hash))
                
                result = cursor.fetchone()
                
                if result:
                    user_id, name, created_at = result
                    print(f"✅ ログイン成功: {name} (ID: {user_id})")
                    
                    return {
                        'success': True,
                        'message': 'ログイン成功',
                        'user': {
                            'user_id': user_id,
                            'name': name,
                            'created_at': created_at
                        }
                    }
                else:
                    return {
                        'success': False,
                        'message': 'ユーザー名またはパスワードが間違っています'
                    }
                    
        except sqlite3.Error as e:
            print(f"❌ ログインエラー: {e}")
            return {
                'success': False,
                'message': f'ログインエラー: {str(e)}'
            }
    
    def _create_user_db(self, username):
        """
        ユーザー個別のデータベースを作成
        Args:
            username: ユーザー名
        """
        user_db = os.path.join(self.db_folder, f"{username}.db")
        
        with sqlite3.connect(user_db) as conn:
            cursor = conn.cursor()
            
            # 活動履歴テーブル
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS activities_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    concentration_seconds INTEGER NOT NULL,
                    no_concentration_seconds INTEGER NOT NULL,
                    level INTEGER NOT NULL,
                    score INTEGER,
                    tags TEXT,
                    memo TEXT,
                    created_at TEXT NOT NULL
                )
            """)
            
            conn.commit()
            print(f"✅ ユーザーデータベースを作成しました: {user_db}")
    
    def save_activity(self, username, concentration_seconds, no_concentration_seconds, 
                      level, score=None, tags=None, memo=None):
        """
        活動履歴を保存
        Args:
            username: ユーザー名
            concentration_seconds: 集中時間（秒）
            no_concentration_seconds: 非集中時間（秒）
            level: 成長レベル
            score: スコア（オプション）
            tags: タグ（カンマ区切り文字列、オプション）
            memo: メモ（オプション）
        Returns:
            dict: {'success': True/False, 'message': メッセージ, 'activity_id': ID}
        """
        try:
            user_db = os.path.join(self.db_folder, f"{username}.db")
            
            # データベースが存在しない場合は作成
            if not os.path.exists(user_db):
                self._create_user_db(username)
            
            with sqlite3.connect(user_db) as conn:
                cursor = conn.cursor()
                
                date = datetime.now().strftime('%Y-%m-%d')
                created_at = datetime.now().isoformat()
                
                cursor.execute("""
                    INSERT INTO activities_log 
                    (date, concentration_seconds, no_concentration_seconds, 
                     level, score, tags, memo, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (date, concentration_seconds, no_concentration_seconds, 
                      level, score, tags, memo, created_at))
                
                activity_id = cursor.lastrowid
                conn.commit()
                
                print(f"✅ 活動履歴を保存しました: {username} (ID: {activity_id})")
                
                return {
                    'success': True,
                    'message': '活動履歴を保存しました',
                    'activity_id': activity_id
                }
                
        except sqlite3.Error as e:
            print(f"❌ 活動履歴保存エラー: {e}")
            return {
                'success': False,
                'message': f'保存エラー: {str(e)}'
            }
    
    def get_user_activities(self, username, limit=50):
        """
        ユーザーの活動履歴を取得
        引数:
            username: ユーザー名
            limit: 取得件数（デフォルト50件）
        戻り値:
            list: 活動履歴のリスト
        """
        try:
            user_db = os.path.join(self.db_folder, f"{username}.db")
            
            if not os.path.exists(user_db):
                return []
            
            with sqlite3.connect(user_db) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, date, concentration_seconds, no_concentration_seconds,
                           level, score, tags, memo, created_at
                    FROM activities_log
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (limit,))
                
                rows = cursor.fetchall()
                
                activities = []
                for row in rows:
                    activities.append({
                        'id': row[0],
                        'date': row[1],
                        'concentration_seconds': row[2],
                        'no_concentration_seconds': row[3],
                        'level': row[4],
                        'score': row[5],
                        'tags': row[6].split(',') if row[6] else [],
                        'memo': row[7],
                        'created_at': row[8]
                    })
                
                return activities
                
        except sqlite3.Error as e:
            print(f"❌ 履歴取得エラー: {e}")
            return []
    
    def get_user_statistics(self, username):
        """
        ユーザーの統計情報を取得
        引数:
            username: ユーザー名
        戻り値:
            dict: 統計情報
        """
        try:
            user_db = os.path.join(self.db_folder, f"{username}.db")
            
            if not os.path.exists(user_db):
                return {
                    'total_sessions': 0,
                    'total_concentration_time': 0,
                    'total_no_concentration_time': 0,
                    'average_score': 0,
                    'max_level': 0
                }
            
            with sqlite3.connect(user_db) as conn:
                cursor = conn.cursor()
                
                # 統計情報を取得
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_sessions,
                        SUM(concentration_seconds) as total_concentration,
                        SUM(no_concentration_seconds) as total_no_concentration,
                        AVG(score) as average_score,
                        MAX(level) as max_level
                    FROM activities_log
                """)
                
                row = cursor.fetchone()
                
                return {
                    'total_sessions': row[0] or 0,
                    'total_concentration_time': row[1] or 0,
                    'total_no_concentration_time': row[2] or 0,
                    'average_score': round(row[3], 2) if row[3] else 0,
                    'max_level': row[4] or 0
                }
                
        except sqlite3.Error as e:
            print(f"❌ 統計取得エラー: {e}")
            return {}


#### テスト用のメイン処理 ####
if __name__ == "__main__":
    # データベースマネージャーを初期化
    db_manager = DatabaseManager()
    
    print("\n=== 集中力アプリ データベース管理 ===\n")
    
    # 1. ログイン or 新規登録
    choice = input("1: 新規登録、2: ログイン\n選択: ")
    
    if choice == "1":
        # 新規登録
        name = input("ユーザー名を入力してください: ")
        password = input("パスワードを入力してください: ")
        
        result = db_manager.register_user(name, password)
        print(f"\n{result['message']}\n")
        
        if result['success']:
            current_user = name
        else:
            exit()
    
    elif choice == "2":
        # ログイン
        name = input("ユーザー名を入力してください: ")
        password = input("パスワードを入力してください: ")
        
        result = db_manager.login_user(name, password)
        print(f"\n{result['message']}\n")
        
        if result['success']:
            current_user = name
        else:
            exit()
    
    else:
        print("無効な選択です")
        exit()
    
    # 2. サンプルデータを保存
    print("=== サンプルデータを保存します ===\n")
    
    save_result = db_manager.save_activity(
        username=current_user,
        concentration_seconds=1200,  # 20分
        no_concentration_seconds=300,  # 5分
        #level=2,
        #score=85,
        tags="#勉強,#朝活",
        memo="これはサンプルデータです。"
    )
    
    print(f"{save_result['message']}\n")
    
    # 3. 履歴を取得
    print("=== 活動履歴 ===\n")
    activities = db_manager.get_user_activities(current_user, limit=10)
    
    for activity in activities:
        print(f"日時: {activity['created_at']}")
        print(f"集中時間: {activity['concentration_seconds']}秒")
        print(f"非集中時間: {activity['no_concentration_seconds']}秒")
        #print(f"レベル: {activity['level']}")
        #print(f"スコア: {activity['score']}")
        print(f"タグ: {', '.join(activity['tags'])}")
        print(f"メモ: {activity['memo']}")
        print("-" * 50)
    
    # 4. 統計情報を取得
    print("\n=== 統計情報 ===\n")
    stats = db_manager.get_user_statistics(current_user)
    
    print(f"総セッション数: {stats['total_sessions']}")
    print(f"総集中時間: {stats['total_concentration_time']}秒 ({stats['total_concentration_time']//60}分)")
    print(f"総非集中時間: {stats['total_no_concentration_time']}秒 ({stats['total_no_concentration_time']//60}分)")
    #print(f"平均スコア: {stats['average_score']}")
    print(f"最高レベル: {stats['max_level']}")
#### テスト用のメイン処理 ####
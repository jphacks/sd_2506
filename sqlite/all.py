import sqlite3

#テーブルの作成
def table_create():
    global db_filename
    with sqlite3.connect(db_filename) as conn:
        cursor = conn.cursor()
        
        # テーブル作成クエリ
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                password TEXT NOT NULL
            )
        """)

# データベースに挿入(ログイン)
def database_insert(name,password):
    global db_filename
    with sqlite3.connect(db_filename) as conn:
        cursor = conn.cursor()
    
        # データの挿入（? プレースホルダでSQLインジェクション対策）
        cursor.execute("""
            INSERT INTO users (name, password)
            VALUES (?, ?)
        """, (name, password))
        
#データがあるかの処理
def login(name, password):
    global db_filename
    try:
        with sqlite3.connect(db_filename) as conn:
            cursor = conn.cursor()

            # nameとpasswordが一致するレコードを検索
            cursor.execute("""
                SELECT * FROM users
                WHERE name = ? AND password = ?
            """, (name, password))

            result = cursor.fetchone()
            return result
            
    except sqlite3.Error as e:
        print("ログイン処理中にエラーが発生しました:", e)
        return False
    
#　user個人のデータベース
def create_user_db(username):
    db_name = f"{username}.db"
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activities_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT PRIMARY KEY,
                concentration INTEGER,
                no_concentration INTEGER,
                lebel INTEGER,
            )
        """)
        
# データベースに挿入(user各自)
def database_user_insert(data_time,con_time,no_con_time,lebel):
    global db_name
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
    
        cursor.execute("""
            INSERT INTO activities_log (date, concentration, no_concentration,lebel)
            VALUES (?, ?, ?, ?)
        """, (data_time, con_time, no_con_time,lebel))


# 1.データベースの作成
# データベースファイル名
db_filename = "test.db"

# SQLiteデータベースに接続（存在しなければ自動的に作成される）
conn = sqlite3.connect(db_filename)

table_create()

# 3.ログイン処理
a=input("ログインしますか？ 1:新規登録、2:ログイン")

#新規登録
if a =="1":
    name=input("名前を入力してください！\n")
    password=input("パスワードを入力してください")
    # 既存に名前とパスワードがあるかチェック
    judgment=login(name, password)
    if judgment:
        print("名前とパスワードは使用されています。")
    else:
        database_insert(name,password)
        print("データを作成しました。")
        
#ログイン処理
else:
    name=input("名前を入力してください！\n")
    password=input("パスワードを入力してください")
    judgment=login(name, password)
    if judgment:
        print("ログイン成功！")
    else:
        print("名前またはパスワードが違います。")
        
#　4.userのデータベースの作成
create_user_db(name)

# 5.userのデータベースに情報を挿入
# database_user_insert(data_time,con_time,no_con_time,lebel)

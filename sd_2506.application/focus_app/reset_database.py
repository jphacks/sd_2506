# reset_database.py
# 場所: focus_app/reset_database.py

import sqlite3
import os

db_filename = "TEST.db"

print("🔧 データベースリセットスクリプト")
print("=" * 50)

# 既存のデータベースファイルを削除
if os.path.exists(db_filename):
    print(f"🗑️  既存の {db_filename} を削除します...")
    try:
        os.remove(db_filename)
        print("✅ 削除完了")
    except Exception as e:
        print(f"❌ 削除エラー: {e}")
        print("⚠️  手動でファイルを削除してください")
        exit()
else:
    print(f"ℹ️  {db_filename} は存在しません（新規作成されます）")

# 新しいデータベースを作成
print("\n📝 新しいテーブルを作成します...")

with sqlite3.connect(db_filename) as conn:
    cursor = conn.cursor()
    
    # usersテーブルを作成
    cursor.execute("""
        CREATE TABLE users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            password TEXT NOT NULL,
            user_type TEXT DEFAULT 'student'
        )
    """)
    
    conn.commit()
    
    print("✅ usersテーブル作成完了")

# テーブル構造を確認
print("\n📋 作成されたテーブル構造:")
print("-" * 50)

with sqlite3.connect(db_filename) as conn:
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(users)")
    columns = cursor.fetchall()
    
    for col in columns:
        col_id, name, col_type, not_null, default, pk = col
        print(f"  {col_id}: {name:15} {col_type:10} ", end="")
        if pk:
            print("PRIMARY KEY", end="")
        if default:
            print(f" DEFAULT {default}", end="")
        print()

print("\n" + "=" * 50)
print("✅ データベースリセット完了！")
print("🚀 サーバーを再起動してください")

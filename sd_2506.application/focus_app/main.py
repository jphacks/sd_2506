from . import app
from flask import render_template, request, jsonify, redirect, session
from datetime import datetime, date
import cv2
import mediapipe as mp
import numpy as np
import time
import base64
import sqlite3
import secrets
from datetime import datetime

mp_face_mesh = mp.solutions.face_mesh.FaceMesh(refine_landmarks=True)
drawing = mp.solutions.drawing_utils
score_data = {"score": 100}
eye_closed_start_time = None
gaze_away_start_time = None
face_missing_start_time = None

app.secret_key = secrets.token_hex(16)

# 先生専用のID・パスワード
# TEACHER_USERNAME = "teacher_admin"
# TEACHER_PASSWORD = "teacher_pass_2025"

# 初期リダイレクト先
redirect_target = {"url": "http://localhost:5000/index_coolver"}


# テーブルの作成
def table_create(db_filename):
    with sqlite3.connect(db_filename) as conn:
        cursor = conn.cursor()

        # ユーザー登録テーブル作成クエリ
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                password TEXT NOT NULL,
                user_type TEXT DEFAULT 'student'
            )
        """)

#生徒個別のDB作成
def create_user_db(username):
    db_name = f"{username}.db"
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS learning_sessions (
                session_id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_name TEXT,
                start_time TEXT NOT NULL,
                end_time TEXT,
                focus_seconds INTEGER DEFAULT 0,
                unfocus_seconds INTEGER DEFAULT 0,
                tags TEXT,
                memo TEXT,
                is_active INTEGER DEFAULT 1
            )
        """)
        conn.commit()


# データベースに挿入(ログイン)
def database_insert(db_filename, name, password, user_type='student'):
    with sqlite3.connect(db_filename) as conn:
        cursor = conn.cursor()

        # データの挿入（? プレースホルダでSQLインジェクション対策）
        cursor.execute("""
            INSERT INTO users (name, password,user_type)
            VALUES (?, ?, ? )
        """, (name, password, user_type))
        result = cursor.fetchone()
        return result


# データがあるかの処理
def login_process(db_filename, name, password):
    try:
        with sqlite3.connect(db_filename) as conn:
            cursor = conn.cursor()

            # nameとpasswordが一致するレコードを検索
            cursor.execute("""
                SELECT user_id, name, user_type FROM users
                WHERE name = ? AND password = ?
            """, (name, password))

            result = cursor.fetchone()
            if result == None:
                result = False
            return result

    except sqlite3.Error as e:
        print("ログイン処理中にエラーが発生しました:", e)
        return False


# 名前が含まれているか判定する
def is_registered(db_filename, name):
    conn = sqlite3.connect(db_filename)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM users WHERE name = ?", (name,))
    result = cursor.fetchone()
    conn.close()
    return result is not None


# 主キーと名前を取得(teacher)
def get_teacher_users(db_filename):
    """
    user_type='teacher' のユーザー (先生) を取得
    戻り値: list of tuples (user_id, name)
    """
    with sqlite3.connect(db_filename) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user_id, name
            FROM users
            WHERE user_type = 'teacher'
            ORDER BY name
        """)
        teachers = cursor.fetchall()
    return teachers

#全生徒の情報を取得
def get_all_students(db_filename):
    with sqlite3.connect(db_filename) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user_id, name
            FROM users
            WHERE user_type = 'student'
            ORDER BY name
        """)
        return cursor.fetchall()
    
#アクティブなセッションを取得
def get_user_active_session(username):
    db_name = f"{username}.db"
    try:
        with sqlite3.connect(db_name) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT session_id, teacher_name, start_time, focus_seconds, unfocus_seconds
                FROM learning_sessions
                WHERE is_active = 1
                ORDER BY start_time DESC
                LIMIT 1
            """)
            row = cursor.fetchone()
            if row:
                return {
                    'session_id': row[0],
                    'teacher_name': row[1],
                    'start_time': row[2],
                    'focus_seconds': row[3],
                    'unfocus_seconds': row[4]
                }
            return None
    except sqlite3.OperationalError:
        return None

def start_user_session(username, teacher_name=None):
    #学習セッション開始
    db_name = f"{username}.db"
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO learning_sessions (teacher_name, start_time, is_active)
            VALUES (?, ?, 1)
        """, (teacher_name or "先生なし", datetime.now().isoformat()))
        conn.commit()
        return cursor.lastrowid

def update_user_session(username, session_id, focus_seconds, unfocus_seconds):
    #セッション更新（リアルタイム）
    db_name = f"{username}.db"
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE learning_sessions
            SET focus_seconds = ?, unfocus_seconds = ?
            WHERE session_id = ?
        """, (focus_seconds, unfocus_seconds, session_id))
        conn.commit()

def end_user_session(username, session_id, tags='', memo=''):
    # セッション終了
    db_name = f"{username}.db"
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE learning_sessions
            SET end_time = ?, tags = ?, memo = ?, is_active = 0
            WHERE session_id = ?
        """, (datetime.now().isoformat(), tags, memo, session_id))
        conn.commit()
    
#個々の過去の学習履歴を取得
def get_user_history(username, limit=10):
    db_name = f"{username}.db"
    try:
        with sqlite3.connect(db_name) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT session_id, teacher_name, start_time, end_time, 
                       focus_seconds, unfocus_seconds, tags, memo
                FROM learning_sessions
                WHERE is_active = 0
                ORDER BY start_time DESC
                LIMIT ?
            """, (limit,))
            return [{
                'session_id': row[0],
                'teacher_name': row[1],
                'start_time': row[2],
                'end_time': row[3],
                'focus_seconds': row[4],
                'unfocus_seconds': row[5],
                'tags': row[6],
                'memo': row[7]
            } for row in cursor.fetchall()]
    except sqlite3.OperationalError:
        return []



###集中力判定
# 目の縦横の長さ
def calculate_EAR(eye_landmarks):
    A = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
    B = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
    C = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
    print('debug1')
    return (A + B) / (2.0 * C)


# 　目が閉じているかどうかを判断
def calculate_focus_score(landmarks):
    global eye_closed_start_time, gaze_away_start_time
    score = 100

    # EAR（左目）
    eye_ids = [33, 160, 158, 133, 153, 144]
    eye_landmarks = np.array([[landmarks[i].x, landmarks[i].y] for i in eye_ids])
    ear = calculate_EAR(eye_landmarks)

    # 目の閉じ時間による減点
    if ear < 0.25:
        if eye_closed_start_time is None:
            eye_closed_start_time = time.time()
        duration = time.time() - eye_closed_start_time
        score -= min(50, int((duration / 10.0) * 50))
    else:
        eye_closed_start_time = None

    print('debug2')
    return max(score, 0)


def gen_frames(frame):
    global face_missing_start_time
    """
    cap = cv2.VideoCapture(0)
    while True:
        success, frame = cap.read()
        if not success:
            continue #breakでした
    """
    # h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = mp_face_mesh.process(rgb)

    if results.multi_face_landmarks:
        face_landmarks = results.multi_face_landmarks[0].landmark
        score = calculate_focus_score(face_landmarks)

        # 顔が検出された → タイマーリセット
        face_missing_start_time = None
        drawing.draw_landmarks(frame, results.multi_face_landmarks[0], mp.solutions.face_mesh.FACEMESH_TESSELATION)
    else:
        # 顔が検出されていない → タイマー開始
        if face_missing_start_time is None:
            face_missing_start_time = time.time()
        duration = time.time() - face_missing_start_time
        if duration >= 5.0:
            score = max(0, score_data["score"] - 50)
        else:
            score = score_data["score"]

    score_data["score"] = score

    print('debug3')
    return score_data
    # time.sleep(0.5)


def decode_base64_image(base64_string):
    if ';base64,' in base64_string:
        header, base64_string = base64_string.split(';base64,')

    img_data = base64.b64decode(base64_string)

    np_arr = np.frombuffer(img_data, np.uint8)

    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return frame


#　全体のデータベース
def create_user_db():
    db_name = "all.db"
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date_time TEXT NOT NULL,
                username TEXT NOT NULL,
                teacher TEXT ,
                login_time TEXT ,
                logout_time TEXT ,
                con_time INTEGER,
                no_con_time INTEGER,
                tag TEXT,
                memo TEXT
                
            )
        """)
        
# 全体のデータベースに挿入(login時)
def database_user_insert(username):
    db_name = "all.db"
    t = datetime.now()
    login_time = t.strftime("%H:%M:%S")
    d = date.today()
    date_time = d.strftime("%Y-%m-%d")
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
    
        cursor.execute("""
            INSERT INTO users (date_time,username,login_time)
            VALUES (?, ?, ?)
        """, (date_time,username, login_time))

# 全体のデータベース更新
def database_user_update(username,teacher,con_time,no_con_time):
    db_name = "all.db"
    d = date.today()
    date_time = d.strftime("%Y-%m-%d")
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users
            SET teacher=?,con_time = ?,no_con_time=?
            WHERE date_time = ? AND username = ? AND log_out = ?
        """, (teacher,con_time, no_con_time,date_time,username, ""))
        
        
# ログイン処理
@app.route('/', methods=["GET", "POST"])
def login():
    # 1.データベースの作成
    # データベースファイル名
    db_filename = "TEST.db"

    table_create(db_filename)

    username = None
    password = None
    error_message = None

    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        result = login_process(db_filename, username, password)

        if result:
            user_id, user_name, user_type = result

            session['user_type'] = user_type
            session['user_id'] = user_id
            session['username'] = user_name

            # ログイン用
            if user_type == 'teacher':
                return redirect('/index_teacher', code=302)
            else:
                database_user_insert(username)
                return redirect('/index_coolver', code=302)
        else:
            error_message = "ユーザー名またはパスワードが間違っています"

    return render_template("login.html", username=username, password=password, error=error_message)


# 新規登録処理
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    db_filename = "TEST.db"
    username = None
    password = None
    user_type = None
    teachers = get_teacher_users(db_filename)

    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user_type = request.form.get("user_type", "student")  # デフォルトで生徒
        # print(username)
        # print(password)

        if not username or username == "":
            username == False
            return render_template('signup.html', submitted=True, username=username, password=password,
                                   teachers=teachers)
        elif not password or password == "":
            password == False
            return render_template('signup.html', submitted=True, username=username, password=password,
                                   teachers=teachers)
        elif not user_type or user_type == "":
            return render_template('signup.html', submitted=True, username=username, password=password,
                                   teachers=teachers)

        else:
            # user名とパスワードが両方あるかどうか判断する
            judgment1 = login_process(db_filename, username, password)
            print(judgment1)
            judgment2 = is_registered(db_filename, username)
            print(judgment2)
            # DB上にuser名とパスワードがない ->新規登録OK
            if judgment1 == False and judgment2 == False:
                database_insert(db_filename, username, password, user_type=user_type)
                # 登録後、自動的にログイン
                result = login_process(db_filename, username, password)
                if result:
                    user_id, user_name, db_user_type = result
                    session['user_type'] = db_user_type
                    session['user_id'] = user_id
                    session['username'] = user_name
                    # ユーザータイプに応じてリダイレクト
                    if db_user_type == 'teacher':
                        return redirect('/index_teacher', code=302)
                    else:
                        create_user_db()
                        database_user_insert(username)
                        return redirect('/index_coolver', code=302)
                # return redirect(redirect_target["url"], code=302)

        # return render_template('signup.html', submitted=True,username=username,password=password)
    return render_template('signup.html', submitted=False, username=username, password=password, teachers=teachers)


# 3. ログアウト
@app.route('/logout')
def logout():
    session.clear()
    return redirect('/', code=302)


# 生徒用ページ
@app.route('/index_coolver', methods=['GET', 'POST'])
def index():
    db_filename = "TEST.db"

    if 'username' not in session or session.get('user_type') != 'student':
        return redirect('/', code=302)

    if request.method == 'POST':
        data = request.json
        if data is None:
            return jsonify({"error": "無効なjsonまたは空のデータ"}), 400
        # print(data)
        if data['image']:
            image_data = data.get('image')
            imd = decode_base64_image(image_data)
            gen_frames(imd)
            if score_data['score'] >= 60:
                result = {'focus': 'focused'}
            else:
                result = {'focus': 'unfocused'}
            return jsonify(result)
        else:


    teachers = get_teacher_users(db_filename)
    return render_template('index_coolver.html', username=session.get('username'), teachers=teachers)


# 先生用ページ
@app.route('/index_teacher', methods=['GET','POST'])
def teacher_dashboard():
    # ログインチェック
    if 'username' not in session or session.get('user_type') != 'teacher':
        print("先生権限なし - ログインページへリダイレクト")
        return redirect('/', code=302)

    teacher_name = session.get('username')

    if request.method == 'POST':
        """
        生徒のデータを取り出すSQL
        with sqlite3.connect as conn:
            cur = conn.cursor
            sql = 'SELECT *  FROM 全生徒のテーブル名 WHERE 教師 = teacher_name '
            cur.execute(sql)
            student_data = cur.fetchall()
        print('debug_teacher')
        return jsonify(student_data)
        """

    # print(session.get('username'))
    return render_template('index_teacher.html')

#先生用API

#全生徒の現在の状態を取得"
@app.route('/api/teacher/students', methods=['GET'])
def api_teacher_students():
    if 'username' not in session or session.get('user_type') != 'teacher':
        return jsonify({"success": False, "error": "権限がありません"}), 403
    
    db_filename = "TEST.db"
    students_list = get_all_students(db_filename)
    
    result = []
    for user_id, username in students_list:
        active_session = get_user_active_session(username)
        
        if active_session:
            focus_min = active_session['focus_seconds'] // 60
            unfocus_min = active_session['unfocus_seconds'] // 60
            total = active_session['focus_seconds'] + active_session['unfocus_seconds']
            unfocus_rate = (active_session['unfocus_seconds'] / total * 100) if total > 0 else 0
            
            result.append({
                'id': user_id,
                'name': username,
                'isOnline': True,
                'focusMinutes': focus_min,
                'unfocusMinutes': unfocus_min,
                'unfocusRate': round(unfocus_rate, 1),
                'needsAlert': unfocus_rate > 25,
                'loginTime': active_session['start_time'],
                'logoutTime': None,
                'tags': [],
                'memo': ''
            })
        else:
            result.append({
                'id': user_id,
                'name': username,
                'isOnline': False,
                'focusMinutes': 0,
                'unfocusMinutes': 0,
                'unfocusRate': 0,
                'needsAlert': False,
                'loginTime': None,
                'logoutTime': None,
                'tags': [],
                'memo': ''
            })
    
    return jsonify({"success": True, "students": result})

#指定した生徒の履歴を取得
@app.route('/api/teacher/student-history/<int:student_id>', methods=['GET'])
def api_teacher_student_history(student_id):
    if 'username' not in session or session.get('user_type') != 'teacher':
        return jsonify({"success": False, "error": "権限がありません"}), 403
    
    db_filename = "TEST.db"
    
    # user_idから生徒名を取得
    with sqlite3.connect(db_filename) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM users WHERE user_id = ?", (student_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "error": "生徒が見つかりません"}), 404
        username = row[0]
    
    history = get_user_history(username, limit=10)
    return jsonify({"success": True, "history": history})

#メッセージを送信
@app.route('/api/teacher/send-message', methods=['POST'])
def api_teacher_send_message():
    if 'username' not in session or session.get('user_type') != 'teacher':
        return jsonify({"success": False, "error": "権限がありません"}), 403
    
    data = request.json or {}
    student_id = data.get('student_id')
    message = data.get('message')
    
    if not student_id or not message:
        return jsonify({"success": False, "error": "必須項目が不足しています"}), 400
    
    # TODO: メッセージ保存処理
    print(f"メッセージ送信: student_id={student_id}, message={message}")
    
    return jsonify({"success": True})

# セッション管理
@app.route('/api/start-session', methods=['POST'])
def api_start_session():
    """セッション開始"""
    if 'username' not in session or session.get('user_type') != 'student':
        return jsonify({"success": False, "error": "未ログインまたは権限がありません"}), 401
    
    data = request.json or {}
    teacher_id = data.get('teacher_id')
    teacher_name = data.get('teacher_name', '先生なし')
    start_time = data.get('start_time')
    
    username = session.get('username')
    
    # 生徒個別DBにセッション開始記録
    session_id = start_user_session(username, teacher_name)
    
    # Flaskセッションに保存
    session['current_session_id'] = session_id
    session['session_start_time'] = start_time
    
    print(f"セッション開始: {username} → 先生: {teacher_name} (session_id: {session_id})")
    
    return jsonify({
        "success": True,
        "session_id": session_id,
        "message": "セッション開始しました"
    })

#セッション終了（記録保存）
@app.route('/api/end-session', methods=['POST'])
def api_end_session():
    if 'username' not in session or session.get('user_type') != 'student':
        return jsonify({"success": False, "error": "未ログインまたは権限がありません"}), 401
    
    data = request.json or {}
    teacher_name = data.get('teacher_name', '先生なし')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    focus_seconds = data.get('focus_seconds', 0)
    unfocus_seconds = data.get('unfocus_seconds', 0)
    tags = data.get('tags', '')
    memo = data.get('memo', '')
    
    username = session.get('username')
    session_id = session.get('current_session_id')
    
    if session_id:
        # 既存のセッションを更新
        end_user_session(username, session_id, tags, memo)
        # 集中時間も更新
        update_user_session(username, session_id, focus_seconds, unfocus_seconds)
        session.pop('current_session_id', None)
    else:
        # 新規セッションとして保存
        session_id = start_user_session(username, teacher_name)
        update_user_session(username, session_id, focus_seconds, unfocus_seconds)
        end_user_session(username, session_id, tags, memo)
    
    print(f"セッション終了: {username} (session_id: {session_id})")
    print(f"   集中: {focus_seconds}秒, 非集中: {unfocus_seconds}秒")
    
    return jsonify({
        "success": True,
        "message": "セッションを保存しました"
    })

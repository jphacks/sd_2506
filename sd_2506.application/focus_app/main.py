from . import app
from flask import render_template, request, jsonify, redirect, session
import cv2
import mediapipe as mp
import numpy as np
import time
import base64
import sqlite3
import secrets

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

#　user個人のデータベース
def create_user_db(username):
    db_name = f"{username}.db"
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activities_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher TEXT NOT NULL,
                date TEXT PRIMARY KEY,
                concentration INTEGER,
                no_concentration INTEGER,
                tag TEXT NOT NULL,
                memo TEXT NOT NULL
                
            )
        """)
        
# データベースに挿入(user各自)
def database_user_insert(username,data_time,con_time,no_con_time,lebel,tag,memo):
    db_name = f"{username}.db"
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
    
        cursor.execute("""
            INSERT INTO activities_log (teacher,date,concentration, no_concentration,tag,memo)
            VALUES (?, ?, ?, ?,?,?)
        """, (username,data_time, con_time, no_con_time,lebel,tag,memo))


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
                        create_user_db(username)
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
            return jsonify({"error": "invalid json or missing data"}), 400
        # print(data)
        image_data = data.get('image')
        imd = decode_base64_image(image_data)
        gen_frames(imd)
        if score_data['score'] >= 60:
            result = {'focus': 'focused'}
        else:
            result = {'focus': 'unfocused'}
        return jsonify(result)

    teachers = get_teacher_users(db_filename)
    return render_template('index_coolver.html', username=session.get('username'), teachers=teachers)


# 先生用ページ
@app.route('/index_teacher')
def teacher_dashboard():
    # ログインチェック
    if 'username' not in session or session.get('user_type') != 'teacher':
        print("先生権限なし - ログインページへリダイレクト")
        return redirect('/', code=302)

    # print(session.get('username'))

    return render_template('index_teacher.html', username=session.get('username'))
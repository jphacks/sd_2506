from . import app
from flask import render_template, request, jsonify,redirect
import cv2
import mediapipe as mp
import numpy as np
import time
import base64
import sqlite3

mp_face_mesh = mp.solutions.face_mesh.FaceMesh(refine_landmarks=True)
drawing = mp.solutions.drawing_utils
score_data = {"score": 100}
eye_closed_start_time = None
gaze_away_start_time = None
face_missing_start_time = None

# 初期リダイレクト先
redirect_target = {"url": "http://localhost:5000/"}

#テーブルの作成
def table_create(db_filename):
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
def database_insert(db_filename,name,password):
    with sqlite3.connect(db_filename) as conn:
        cursor = conn.cursor()
    
        # データの挿入（? プレースホルダでSQLインジェクション対策）
        cursor.execute("""
            INSERT INTO users (name, password)
            VALUES (?, ?)
        """, (name, password))
        result = cursor.fetchone()
        return result

#データがあるかの処理
def login_process(db_filename,name, password):
    try:
        with sqlite3.connect(db_filename) as conn:
            cursor = conn.cursor()

            # nameとpasswordが一致するレコードを検索
            cursor.execute("""
                SELECT * FROM users
                WHERE name = ? AND password = ?
            """, (name, password))

            result = cursor.fetchone()
            if result ==None:
                result=False
            return result
            
    except sqlite3.Error as e:
        print("ログイン処理中にエラーが発生しました:", e)
        return False
    
# 名前が含まれているか判定する
def is_registered(db_filename,name):
    conn = sqlite3.connect(db_filename)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM users WHERE name = ?", (name,))
    result = cursor.fetchone()
    conn.close()
    return result is not None


# 目の縦横の長さ
def calculate_EAR(eye_landmarks):
    A = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
    B = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
    C = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
    print('debug1')
    return (A + B) / (2.0 * C)

#　目が閉じているかどうかを判断
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
        #h, w = frame.shape[:2]
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
        #time.sleep(0.5)


def decode_base64_image(base64_string):

    if ';base64,' in base64_string:
        header, base64_string = base64_string.split(';base64,')

    img_data = base64.b64decode(base64_string)

    np_arr = np.frombuffer(img_data, np.uint8)

    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return frame

# ログイン処理
@app.route('/login', methods=["GET", "POST"])
def login():
    # 1.データベースの作成
    # データベースファイル名
    db_filename = "TEST.db"

    table_create(db_filename)
    
    username=None
    password = None
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        judgment=login_process(db_filename,username, password)
        if judgment:
            return redirect(redirect_target["url"], code=302)
        
    return render_template("login.html", username=username,password=password)

# 新規登録処理
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    db_filename = "TEST.db"
    username=None
    password = None
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        print(username)
        print(password)
        if username=="":
            username==False
            return render_template('signup.html', submitted=True,username=username,password=password)
        elif password=="":
            password==False
            return render_template('signup.html', submitted=True,username=username,password=password)
            
        else:
            # user名とパスワードが両方あるかどうか判断する
            judgment1=login_process(db_filename,username, password)
            print(judgment1)
            judgment2=is_registered(db_filename,username)
            print(judgment2)
            # DB上にuser名とパスワードがない
            if judgment1==False and judgment2==False:
                database_insert(db_filename,username,password)
                return redirect(redirect_target["url"], code=302)
     
                
        return render_template('signup.html', submitted=True,username=username,password=password)
    return render_template('signup.html', submitted=False,username=username,password=password)


@app.route('/', methods=['GET','POST'])
def index():
    if request.method == 'POST':
        data = request.json
        if data is None:
            return jsonify({"error":"invalid json or missing data"}), 400
        #print(data)
        image_data = data.get('image')
        imd = decode_base64_image(image_data)
        gen_frames(imd)
        if score_data['score'] >= 60:
            result = {'focus':'focused'}
        else:
            result = {'focus':'unfocused'}
        return jsonify(result)
    return render_template('index_coolver.html')


from . import app
from flask import render_template#, request, jsonify
import cv2
import mediapipe as mp
import numpy as np
import time

mp_face_mesh = mp.solutions.face_mesh.FaceMesh(refine_landmarks=True)
drawing = mp.solutions.drawing_utils
score_data = {"score": 100}
eye_closed_start_time = None
gaze_away_start_time = None
face_missing_start_time = None
result = {'focus':'focused'}

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


def gen_frames():
    global face_missing_start_time
    cap = cv2.VideoCapture(0)
    while True:
        success, frame = cap.read()
        if not success:
            continue #breakでした
        h, w = frame.shape[:2]
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
        time.sleep(0.5)

@app.route('/')
def index():
    gen_frames()
    return render_template('index.html')

    #if request.method == 'POST':
    #    req1 = request.form['data1']
    #if request.get_json():
    #    return jsonify(result)        #繰り返しのgen_frames()で最後のreturnが動作しないため、苦し紛れのif

# if score_data['score'] >= 50:
#    result['focus'] = 'focused'
# else:
#    result['focus'] = ''


import math
import cv2
import json
import os
import glob
import sys
from pathlib import Path
import numpy as np

# Thêm thư mục backend vào đường dẫn import khi chạy trực tiếp trong tools.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from function.clamp import clamp
from function.warp_paper import warp_paper
from function.dist import dist
from function.wrinkle_detector import (
    cluster_points_by_y,
    find_side_square_markers,
    pair_side_markers,
    detect_wrinkled_paper,
)

# pip install opencv-python
# pip install numpy

# 0.HÀM CHUẨN BỊ

def find_marker_in_roi(roi, offset_x=0, offset_y=0, win_name="ROI DEBUG"):
    
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    blur = cv2.GaussianBlur(gray, (5,5), 0)

    thresh = cv2.adaptiveThreshold( blur,255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41,7 )

    # kernel = np.ones((5, 5), np.uint8) 
    # closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best = None
    best_area = 0
    debug = roi.copy()

    for c in cnts:

        peri = cv2.arcLength(c, True)

        if peri == 0:
            continue

        approx = cv2.approxPolyDP(c, 0.025 * peri, True)

        area = cv2.contourArea(c)

        if area < 200 or area > 1000:
            continue

        x,y,w,h = cv2.boundingRect(c)

        if h == 0:
            continue

        ratio = w / float(h)

        extent = area / float(w*h)

        circularity = 4 * math.pi * area / (peri*peri)

        roi = thresh[y:y+h, x:x+w]

        fill_ratio = cv2.countNonZero(roi) / float(w*h)
        
        # if 3 <= len(approx) <= 10 and 0.5 <= ratio <= 2 and extent > 0.75 and circularity < 0.85:
        # if 1 <= len(approx) <= 10 and 0.5 <= ratio <= 2 and extent > 0.7 and circularity < 0.85 and fill_ratio > 0.4:

        if 4 <= len(approx) <= 9 and 0.9 <= ratio <= 2  and extent > 0.7 and circularity < 0.85 and fill_ratio > 0.4:
            cv2.drawContours(debug,[c],-1,(0,255,0),2)

            cx = x + w//2
            cy = y + h//2

            cv2.circle(debug,(cx,cy),5,(0,0,255),-1)

            if area > best_area:

                M = cv2.moments(c)

                if M["m00"] == 0:
                    continue

                cx = int(M["m10"]/M["m00"])
                cy = int(M["m01"]/M["m00"])

                best = (
                    cx + offset_x,
                    cy + offset_y
                )

                best_area = area
    cv2.imshow(win_name, debug)
    return best

def grade_answers(student_answers, answer_key):

    score = 0
    details = {}

    for q, correct_answer in answer_key.items():

        student_answer = student_answers.get(q, "?")

        is_correct = (student_answer == correct_answer)

        if is_correct:
            score += 1

        details[q] = {
            "student": student_answer,
            "correct": correct_answer,
            "result": is_correct
        }

    return score, details

def read_bubbles(roi_img, cols, timing_rows):
    rows = len(timing_rows)
    img_result = roi_img.copy()
    selected_points = []
    
    # 1. TIỀN XỬ LÝ (Đã lắp CLAHE trị bóng râm)
    gray = cv2.cvtColor(roi_img, cv2.COLOR_BGR2GRAY)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 11)
    
    # Vá các viền ô tròn bị đứt
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    # 2. TÌM TẤT CẢ CÁC Ô TRÒN CHƯA TÔ
    contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    xs, ys, ws, hs = [], [], [], []
    bubble_centers = []
    
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        area = cv2.contourArea(c)
        aspect_ratio = w / float(h) if h != 0 else 0
        
        peri = cv2.arcLength(c, True)
        if peri == 0:
            continue
        
        if 20 < area < 200 and 0.9 < aspect_ratio < 1.6  and 30 < peri < 80:
            xs.append(x)
            ys.append(y)
            ws.append(w)
            hs.append(h)
            
            cx = x + w//2
            cy = y + h//2
            
            cv2.putText(img_result,f"{float(peri)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1)

            bubble_centers.append((cx, cy))

    if len(xs) < cols * rows * 0.3:
        raise ValueError(f"Lỗi: Không tìm thấy đủ ô tròn để định vị lưới! (Tìm thấy {len(xs)})")

    # 3. CHỐT TRỤC NGANG (X)
    min_x, min_y = min(xs), min(ys)
    max_x = max([x + w for x, w in zip(xs, ws)])
    max_y = max([y + h for y, h in zip(ys, hs)])

    avg_w = sum(ws) / len(ws)
    pad_x = int(avg_w * 0.2)

    grid_x = min_x - pad_x
    grid_w = (max_x - min_x) + (pad_x * 2)
    cell_w = grid_w / cols

    # Vẽ khung Xanh Dương
    cv2.rectangle(img_result, (grid_x, min_y - 10), (grid_x + grid_w, max_y + 10), (255, 0, 0), 1)

    # for cx, cy in bubble_centers:
    #     cv2.circle(img_result,(cx, cy),3,(0,255,0),-1)

    # 4. CHỐT TRỤC DỌC (Y) BẰNG THUẬT TOÁN "NAM CHÂM"
    roi_rows = sorted(timing_rows)
    real_rows = []

    for y_est in roi_rows:
        near_y = []
        for bx, by in bubble_centers:
            # Lọc các ô tròn gần đường chuẩn y_est
            if abs(by - y_est) < 15:
                near_y.append(by)

        if len(near_y) > 0:
            # DÙNG MEDIAN (Trung vị) để kháng nhiễu rác thay vì Mean
            real_rows.append(int(np.median(near_y)))
        else:
            real_rows.append(y_est)

    roi_rows = real_rows
    result_str = ""

    # 5. CHẤM ĐIỂM
    for i in range(cols):
        pixels_count = []
        col_centers = []
        cx = int(grid_x + i * cell_w + cell_w/2)

        for cy in roi_rows:
            radius = int(cell_w * 0.30)
            col_centers.append((cx, cy, radius))

            mask = np.zeros(thresh.shape, dtype=np.uint8)
            cv2.circle(mask, (cx, cy), radius, 255, -1)
            
            bubble_region = cv2.bitwise_and(thresh, mask)
            filled_pixels = cv2.countNonZero(bubble_region)
            pixels_count.append(filled_pixels)

            cv2.circle(img_result, (cx, cy), radius, (0, 0, 255), 2)
        
        marked_index = np.argmax(pixels_count)
        max_pixels = pixels_count[marked_index]
        min_ink_required = np.pi * radius * radius * 0.20

        if max_pixels > min_ink_required:
            result_str += str(marked_index)
            cx, cy, r = col_centers[marked_index]

            selected_points.append((cx, cy, r))
            cv2.circle(img_result, (cx, cy), r, (0, 255, 0), 4)
        else:
            result_str += "?"

    return result_str, img_result, selected_points

def read_part1(part1_roi, rows, cols, answer_key_1, img=None, offset_x=0, offset_y=0, start_question=1):

    selected_points = []

    debug = part1_roi.copy()

    gray = cv2.cvtColor(part1_roi, cv2.COLOR_BGR2GRAY)

    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,10)

    kernel = np.ones((3,3), np.uint8)

    thresh = cv2.morphologyEx(thresh,cv2.MORPH_CLOSE,kernel)

    cnts, _ = cv2.findContours(thresh,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)

    bubbles = []

    centers = []

    for c in cnts:

        area = cv2.contourArea(c)

        if area < 80 or area > 1200:
            continue

        peri = cv2.arcLength(c, True)

        if peri == 0:
            continue

        circularity = 4*np.pi*area/(peri*peri)

        x,y,w,h = cv2.boundingRect(c)

        ratio = w / float(h)

        if  ratio < 2 and circularity > 0.9:

            cx = x + w//2
            cy = y + h//2
            
            if not ( cy < 0.95*H):
                continue

            bubbles.append((cx,cy,w,h))
            

    lefts   = [cx-w//2 for cx,cy,w,h in bubbles]
    rights  = [cx+w//2 for cx,cy,w,h in bubbles]
    tops    = [cy-h//2 for cx,cy,w,h in bubbles]
    bottoms = [cy+h//2 for cx,cy,w,h in bubbles]

    # print("Contours =", len(cnts))
    # print("Bubbles =", len(bubbles))

    grid_x1 = min(lefts)
    grid_x2 = max(rights)

    grid_y1 = min(tops)
    grid_y2 = max(bottoms)

    avg_w = int(np.median([w for _,_,w,_ in bubbles]))

    pad = int(avg_w * 0.6)

    grid_x1 -= pad
    grid_x2 += pad

    grid_y1 -= pad
    grid_y2 += pad

    # cv2.rectangle( debug,(grid_x1,grid_y1),(grid_x2,grid_y2),(255,0,0),2)

    rows = 10
    cols = 4

    grid_w = grid_x2 - grid_x1
    grid_h = grid_y2 - grid_y1

    cell_w = grid_w / cols
    cell_h = grid_h / rows

    centers = []

    for r in range(rows):

        row_centers = []

        cy = int(grid_y1 +(r + 0.5) * cell_h)

        for c in range(cols):

            cx = int(grid_x1 +(c + 0.5) * cell_w)

            row_centers.append((cx,cy))

            # cv2.circle(debug,(cx,cy), 5,(0,0,255),-1)

        centers.append(row_centers)

    answers = {}

    letters = ['A','B','C','D']

    MIN_FILL = 40

    for r in range(rows):

        best_fill = 0
        best_col = -1

        for c in range(cols):

            cx, cy = centers[r][c]

            radius = int(avg_w * 0.45)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx, cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            if filled > best_fill:
                best_fill = filled
                best_col = c

            cv2.circle(debug,(cx,cy),radius,(0,255,255),1)

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            # tô > 35%
            marked = ratio_fill > 0.6

            color = (0,255,0) if marked else (0,255,255)

            cv2.circle(debug,(cx,cy),radius,color,2)
        
        # print(f"Row {r+1}",best_fill,best_col)

        if best_fill >= MIN_FILL:
            question_no = start_question + r

            answers[question_no] = letters[best_col]

            # answers[r + 1] = letters[best_col]

            gx, gy = centers[r][best_col]

            student_answer = letters[best_col]

            correct_answer = answer_key_1.get(str(question_no))
            
            if correct_answer is None:
                correct_answer = answer_key_1.get(question_no)
                
            if isinstance(correct_answer, dict):
                correct_answer = correct_answer.get("answer")
                
            if correct_answer is None:
                continue
                
            correct_answer = str(correct_answer).strip().upper()
            
            is_correct = (student_answer == correct_answer)

            correct_col = letters.index(correct_answer)

            correct_cx, correct_cy = centers[r][correct_col]

            selected_points.append((r,student_answer,gx,gy,radius,is_correct, correct_cx, correct_cy))
        else:
            question_no = start_question + r

            # answers[r + 1] = "?"

        # ===== DUYET ĐÁP AN =====

    # for q, ans in answers.items():
    #     print(f"Cau {q}: {ans}")
    
    return answers, debug, selected_points

def build_part2_grid(block_img , answer_key_2, cols=4, start_question = 1):
    
    selected_points = []

    correct_points = []

    debug = block_img.copy()

    gray = cv2.cvtColor(block_img, cv2.COLOR_BGR2GRAY)
    
    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,41,19)

    kernel = np.ones((3,3), np.uint8)

    thresh = cv2.morphologyEx(thresh,cv2.MORPH_CLOSE,kernel)

    cnts, _ = cv2.findContours(thresh,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    
    cv2.imshow('thresh', thresh)

    bubbles = []

    centers = []

    for c in cnts:

        area = cv2.contourArea(c)

        if area < 80 or area > 1200:
            continue

        peri = cv2.arcLength(c, True)

        if peri == 0:
            continue

        circularity = 4*np.pi*area/(peri*peri)

        x,y,w,h = cv2.boundingRect(c)

        ratio = w / float(h)

        if  ratio < 1.4 and circularity > 0.75:

            cx = x + w//2
            cy = y + h//2
            
            # if not ( cy < 0.95*H):
            #     continue

            bubbles.append((cx,cy,w,h))

    bubble_points = []

    for cx,cy,w,h in bubbles:
        bubble_points.append((cx,cy))

    # print("Tong contour =", len(cnts))
    # print("Tong bubble =", len(bubbles))

    if len(bubbles) == 0:
        raise Exception("Không tìm thấy bubble")

    lefts   = [cx-w//2 for cx,cy,w,h in bubbles]
    rights  = [cx+w//2 for cx,cy,w,h in bubbles]
    tops    = [cy-h//2 for cx,cy,w,h in bubbles]
    bottoms = [cy+h//2 for cx,cy,w,h in bubbles]

    grid_x1 = min(lefts)
    grid_x2 = max(rights)

    grid_y1 = min(tops)
    grid_y2 = max(bottoms)

    avg_w = int(np.median([w for _,_,w,_ in bubbles]))

    pad = int(avg_w * 0.55)

    grid_x1 -= pad
    grid_x2 += pad

    grid_y1 -= pad
    grid_y2 += pad

    ys = sorted([cy for cx,cy in bubble_points])

    rows_y = []

    for y in ys:
        if len(rows_y) == 0:
            rows_y.append([y])
        elif abs(y - np.mean(rows_y[-1])) < 15:
            rows_y[-1].append(y)
        else:
            rows_y.append([y])

    rows_y = [int(np.mean(r)) for r in rows_y]

    # print("rows_y =", rows_y)

    for cx,cy,w,h in bubbles:
        cv2.circle(debug,(cx,cy),3,(0,0,255),-1)
        # print(cx,cy,w,h)
    cv2.rectangle(debug, (grid_x1,grid_y1), (grid_x2,grid_y2), (255,0,0),2)
    # cols = 4

    grid_w = grid_x2 - grid_x1
    cell_w = grid_w / cols

    result = []

    row_result_q1 = []
    row_result_q2 = []

    answers = {start_question: {},start_question + 1: {}}

    choices = ['a', 'b', 'c', 'd']

    for r, cy in enumerate(rows_y):
        row_answer = []
        temp_data = []

        q1_row = ""
        q2_row = ""

        question1 = start_question
        question2 = start_question + 1

        # print("question1 =", question1)
        # print("question2 =", question2)
        # print(answer_key_2.keys())

        choice = choices[r]

        for c in range(cols):

            cx = int(grid_x1 + (c + 0.5) * cell_w)

            radius = int(avg_w * 0.35)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx, cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            temp_data.append((cx, cy, radius, filled))

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            if str(question1) not in answer_key_2:
                continue

            if str(question2) not in answer_key_2:
                continue

            if c == 0 and answer_key_2[str(question1)].get(choice, False):
                correct_points.append((cx, cy, radius))

            elif c == 1 and not answer_key_2[str(question1)].get(choice, False):
                correct_points.append((cx, cy, radius))

            elif c == 2 and answer_key_2[str(question2)].get(choice, False):
                correct_points.append((cx, cy, radius))

            elif c == 3 and not answer_key_2[str(question2)].get(choice, False):
                correct_points.append((cx, cy, radius))

            # tô > 35%
            marked = ratio_fill > 0.3

            row_answer.append(marked)

            if marked:
                color = (0,255,0)  

                if c == 0:
                    q1_row = "Đ"
                    
                    is_correct = answer_key_2[str(question1)].get(choice, False)

                elif c == 1:
                    q1_row = "S"

                    is_correct = not answer_key_2[str(question1)].get(choice, False)

                elif c == 2:
                    q2_row = "Đ"

                    is_correct = answer_key_2[str(question2)].get(choice, False)

                elif c == 3:
                    q2_row = "S"

                    is_correct = not answer_key_2[str(question2)].get(choice, False)

                selected_points.append((r,c,cx,cy,radius,is_correct))
            else:
                color = (0,255,255)     
            
            cv2.circle(debug,(cx,cy),radius,color,2)
            # cv2.putText(debug,f"{ratio_fill:.2f}",(cx-15, cy-10),cv2.FONT_HERSHEY_SIMPLEX,0.4,(255,0,0),1)

        answers[question1][choice] = q1_row
        answers[question2][choice] = q2_row
            
    return answers, debug, selected_points, correct_points

def build_part3_grid(block_img, answer_key_3, question_no, rows=11, cols=4):

    selected_points = []
    correct_points = []

    debug = block_img.copy()

    gray = cv2.cvtColor(block_img, cv2.COLOR_BGR2GRAY)

    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,41,10)

    kernel = np.ones((3,3), np.uint8)

    thresh = cv2.morphologyEx(thresh,cv2.MORPH_CLOSE,kernel)

    cnts, _ = cv2.findContours(thresh,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    
    # cv2.imshow('thresh', thresh)

    bubbles = []

    centers = []

    H, W = block_img.shape[:2]

    for c in cnts:

        area = cv2.contourArea(c)

        if area < 80 or area > 1200:
            continue

        peri = cv2.arcLength(c, True)

        if peri == 0:
            continue

        circularity = 4*np.pi*area/(peri*peri)

        x,y,w,h = cv2.boundingRect(c)

        ratio = w / float(h)

        if  ratio < 1.4 and circularity > 0.85:

            cx = x + w//2
            cy = y + h//2
            
            if not ( cy < 0.95*H):
                continue

            bubbles.append((cx,cy,w,h))

    bubble_points = []

    for cx,cy,w,h in bubbles:
        bubble_points.append((cx,cy))

    print("Tong contour =", len(cnts))
    print("Tong bubble =", len(bubbles))

    if len(bubbles) == 0:
        raise Exception("Không tìm thấy bubble")

    bubble_points = sorted(bubble_points,key=lambda p: p[0])

    xs = [p[0] for p in bubble_points]
    ys = [p[1] for p in bubble_points]

    # gom 4 cột
    cols_x = []

    for x in sorted(xs):
        if len(cols_x) == 0:
            cols_x.append([x])
        elif abs(x - np.mean(cols_x[-1])) < 15:
            cols_x[-1].append(x)
        else:
            cols_x.append([x])

    cols_x = [int(np.mean(c)) for c in cols_x]

    print("cols_x =", cols_x)

    # gom 10 hàng
    rows_y = []
    for y in sorted(ys):
        if len(rows_y) == 0:
            rows_y.append([y])
        elif abs(y - np.mean(rows_y[-1])) < 12:
            rows_y[-1].append(y)
        else:
            rows_y.append([y])

    rows_y = [int(np.mean(r)) for r in rows_y]
    print("rows_y =", rows_y)

    if len(rows_y) != rows:
        print(f"CANH BAO Phan III cau {question_no}: phat hien {len(rows_y)} hang, "
              f"ky vong {rows} hang - cac hang co the bi lech chi so")

    digits = [""] * cols

    minus = False
    comma_pos = -1

    avg_w = int(np.median([w for _,_,w,_ in bubbles]))

    for r, cy in enumerate(rows_y):

        for c, cx in enumerate(cols_x):

            radius = int(avg_w * 0.35)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx,cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            # tô > 30%
            marked = ratio_fill > 0.3

            if marked:
                color = (0,255,0)
                # dấu âm
                if r == 0:
                    minus = True
                # dấu phẩy
                elif r == 1:
                    comma_pos = c
                # chữ số
                else:
                    digits[c] = str(r - 2)

                selected_points.append((r,c,cx,cy,radius))
            else:
                color = (0,255,255)

            cv2.circle(debug,(cx,cy),radius,color,2)

    # Chi ghep chuoi 1 LAN sau khi da doc het moi hang (digits chi day du
    # sau khi vong lap ket thuc - tinh lai moi hang nhu truoc la thua va
    # khong anh huong ket qua cuoi, nhung de ro rang nen chuyen ra ngoai).
    answer_str = "".join(digits)

    if comma_pos != -1:
        # comma_pos la CHI SO COT (0..cols-1) trong luoi 4 cot, khong phai
        # chi so trong chuoi da join() - vi cac cot rong ("") bi join() bo
        # qua nen chuoi ket qua ngan hon 4 ky tu. Phai dem so ky tu THUC SU
        # xuat hien truoc cot chua dau phay, khong dung thang comma_pos,
        # neu khong dau phay se bi day sai vi tri (thuong la ra cuoi chuoi).
        comma_str_pos = sum(1 for d in digits[:comma_pos] if d != "")
        answer_str = answer_str[:comma_str_pos] + "," + answer_str[comma_str_pos:]

    if minus:
        answer_str = "-" + answer_str

    # ===== So sanh dap an - dong bo voi logic cua app1.py (ho tro dict /
    # nhieu dap an chap nhan duoc / chuan hoa dau "." va ",") =====

    correct_data = answer_key_3.get(str(question_no))

    correct_answer = None

    if correct_data is None:
        print(f"Bỏ qua câu Phần III {question_no}: không có đáp án chuẩn")
        is_correct = False
    else:
        if isinstance(correct_data, dict):
            accepted_answers = (
                correct_data.get("acceptedAnswers")
                or [correct_data.get("answer")]
            )
            correct_answer = correct_data.get("answer")
        else:
            accepted_answers = [correct_data]
            correct_answer = correct_data

        if correct_answer in (None, ""):
            correct_answer = next(
                (value for value in accepted_answers if value not in (None, "")),
                None,
            )

        def normalize_short_answer(value):
            return str(value).strip().replace(".", ",")

        student_value = normalize_short_answer(answer_str)

        accepted_values = {
            normalize_short_answer(value)
            for value in accepted_answers
            if value is not None
        }

        is_correct = (student_value in accepted_values)

    # Nếu học sinh làm sai, đổi đáp án chuẩn thành tọa độ các ô trên lưới.
    if not is_correct and correct_answer is not None:
        correct_text = str(correct_answer).strip().replace(".", ",")
        correct_radius = int(avg_w * 0.35)
        digit_col = 0

        if correct_text.startswith("-"):
            if rows_y and cols_x:
                correct_points.append((cols_x[0], rows_y[0], correct_radius))
            correct_text = correct_text[1:]

        for character in correct_text:
            if character == ",":
                if len(rows_y) > 1 and digit_col < len(cols_x):
                    correct_points.append(
                        (cols_x[digit_col], rows_y[1], correct_radius)
                    )
                continue

            if not character.isdigit():
                continue

            digit_row = int(character) + 2

            if digit_col < len(cols_x) and digit_row < len(rows_y):
                correct_points.append(
                    (cols_x[digit_col], rows_y[digit_row], correct_radius)
                )

            digit_col += 1

    return answer_str, debug, selected_points, correct_points, is_correct

img_original  = cv2.imread(r'C:\Users\Admin\Downloads\Project_1\backend\data\data1\ptn4.png')

folder = r"C:\Users\Admin\Downloads\Project_1\backend\data\data1 31-7-2026"
image_files = []
image_files.extend(glob.glob(os.path.join(folder, "*.JPEG")))
image_files.extend(glob.glob(os.path.join(folder, "*.png")))
image_files.extend(glob.glob(os.path.join(folder, "*.jpg")))
image_files.extend(glob.glob(os.path.join(folder, "*.JPG")))
for file_path in image_files:
    img_original = cv2.imread(file_path)
    file_name = os.path.basename(file_path)
    print("anh ", file_name)

    img = img_original.copy()   # xử lý
    img_debug   = img_original.copy()   # vẽ debug

    gray = cv2.cvtColor(img_original, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))

    gray = clahe.apply(gray)

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 15)
        
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    edged = cv2.Canny(thresh, 75, 200)

    cv2.imshow('2. Canny Edges', edged)

    cv2.namedWindow('Canny Edges', cv2.WINDOW_NORMAL)

    cv2.resizeWindow('Canny Edges', 600, 800)

    cv2.imshow('Canny Edges', edged)

    H, W = img.shape[:2]

    roi_size = int(min(W, H) * 0.25)  # 25% cạnh ngắn

    margin = 0
    # Góc trên trái
    cv2.rectangle( img, (margin, margin), (roi_size + margin, roi_size + margin), (0,255,0), 4)
    roi_tl = img[
        margin : margin + roi_size,
        margin : margin + roi_size
    ]
    cv2.imshow("ROI TL", roi_tl)

    # TR
    cv2.rectangle( img, (W - roi_size - margin, margin), (W - margin, roi_size + margin), (0,255,0),4)
    roi_tr = img[
        margin : margin + roi_size,
        W-roi_size-margin : W-margin
    ]
    cv2.imshow("ROI TR", roi_tr)

    # BL
    cv2.rectangle( img, (margin, H - roi_size - margin), (roi_size + margin, H - margin), (0,255,0), 4)
    roi_bl = img[
        H-roi_size-margin : H-margin,
        margin : margin+roi_size
    ]
    cv2.imshow("ROI BL", roi_bl)

    # BR
    cv2.rectangle( img, (W - roi_size - margin, H - roi_size - margin), (W - margin, H - margin), (0,255,0), 4)
    roi_br = img[
        H-roi_size-margin : H-margin,
        W-roi_size-margin : W-margin
    ]
    cv2.imshow("ROI BR", roi_br)

    cv2.imshow("4 ROI Corners", img)

    _, thresh = cv2.threshold(blurred, 150, 255, cv2.THRESH_BINARY_INV)

    cv2.imshow('2. Canny Edges', edged )


    # 1. FIX: Dùng RETR_EXTERNAL để chỉ lấy viền ngoài cùng, tránh viền lồng nhau
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    print(f'Found {len(contours)} contours in the image.')

    img_markers = img.copy()
    markers = [] # Mảng chứa các điểm neo (Vuông)
    marker_centers_unique = [] # Mảng chứa tâm điểm neo đã được lọc trùng lặp (nếu có)
    bubbles = [] # Mảng chứa các ô đáp án (Tròn)
    timing_marks = []   # các hình chữ nhật bên phải mã đề
    id_boxes = []   # khung lớn SBD + Mã đề

    # 5. Lấy trọng tâm của các điểm neo và lọc trùng lặp
    pts = []
    for m in markers:
        M = cv2.moments(m)
        if M["m00"] == 0:
            continue
        cx = int(M["m10"]/M["m00"])
        cy = int(M["m01"]/M["m00"])
        pts.append((cx, cy))

    print(f"Đã chắt lọc được {len(pts)} tâm điểm neo hợp lệ.")

    # ==========================================
    # PHÂN LUỒNG LOGIC: 4 ĐIỂM vs 3 ĐIỂM
    # ==========================================

    TL = find_marker_in_roi( roi_tl, margin, margin, "ROI TL DEBUG")

    TR = find_marker_in_roi( roi_tr, W-roi_size-margin, margin, "ROI TR DEBUG")

    BL = find_marker_in_roi( roi_bl, margin,H-roi_size-margin, "ROI BL DEBUG")

    BR = find_marker_in_roi( roi_br, W-roi_size-margin, H-roi_size-margin, "ROI BR DEBUG")

    print("TL =", TL)
    print("TR =", TR)
    print("BL =", BL)
    print("BR =", BR)

    print("top =", dist(TL,TR))
    print("bottom =", dist(BL,BR))
    print("left =", dist(TL,BL))
    print("right =", dist(TR,BR))

    for p in [TL,TR,BL,BR]:
        if p is not None:
            cv2.circle( img,p, 20,(255,0,255), -1)

    # ==========================================
    # ĐÓNG GÓI VÀ KIỂM TRA (Giữ nguyên của bạn)
    # ==========================================
    src = np.array([TL, TR, BR, BL], dtype=np.float32)

    top_width = dist(TL, TR)
    bottom_width = dist(BL, BR)
    left_height = dist(TL, BL)
    right_height = dist(TR, BR)

    ratio_w = top_width / (bottom_width + 1e-5)
    ratio_h = left_height / (right_height + 1e-5)

    # if not (0.85 < ratio_w < 1.15 and 0.85 < ratio_h < 1.15):
    #     raise Exception("Warp sai - form bị méo hoặc chọn sai marker")

    for p in src.astype(int):
        # Đổi sang màu Tím để bạn thấy rõ điểm nào vừa được "triệu hồi"
        cv2.circle(img, tuple(p), 15, (255, 0, 255), -1) 

    cv2.imshow("Corners", img)

    print(f"Tọa độ 4 góc: TL={TL}, TR={TR}, BL={BL}, BR={BR}")

    # 7. WARP ẢNH VỀ HỆ TỌA ĐỘ CHUẨN
    warp, M = warp_paper(img_original,TL,TR,BR,BL,out_w=1000,out_h=1400,expand=20,pad=30)

    # 8. MARKER ĐIỂM NEO VÀ CẮT ROI
    wrinkle_result = detect_wrinkled_paper(
        warp,
        debug_mode=False
    )

    print("Trạng thái giấy:",wrinkle_result["status"])
    statusPaper = 0
    if wrinkle_result["status"] == "flat":
        statusPaper = 10
    else:
        statusPaper = 16

    warp_gray = cv2.cvtColor(warp, cv2.COLOR_BGR2GRAY)

    warp_blur = cv2.GaussianBlur(warp_gray, (5,5), 0)

    warp_thresh = cv2.adaptiveThreshold( warp_blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, statusPaper)

    # warp_thresh = cv2.threshold(warp_blur, 150, 255, cv2.THRESH_BINARY_INV)

    cnts, _ = cv2.findContours( warp_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    rect_markers = []

    for c in cnts:
        
        area = cv2.contourArea(c)

        if area < 30 or area > 400:
            continue

        x,y,w,h = cv2.boundingRect(c)

        if w==0 or h==0:
            continue
        
        ratio = w/float(h)
        rect_area=w*h
        extent=area/float(rect_area)

        # timing mark nằm ngang
        if 40 < area < 300 and 1.5 < ratio < 8 and 5 < h < 20 and 10 < w < 50 and extent > 0.6:
            rect_markers.append((x,y,w,h))

    # giữ các marker ngoài cùng bên phải
    rect_markers = sorted( rect_markers, key=lambda t:t[0])

    if len(rect_markers)==0:
        print("Contours after warp:", len(cnts))
        raise Exception(
            "Không tìm thấy timing mark"
        )

    max_x = max([x for x,_,_,_ in rect_markers])

    rect_markers = [
        r for r in rect_markers
        if abs(r[0]-max_x) < 40
    ]

    # Vẽ thử neo phụ tìm được
    timing_rows = []

    for x,y,w,h in rect_markers:
        offset = int(h * 0.5)
        cy = y + h//2 + offset

        timing_rows.append(cy)
        # cv2.line( warp, (0,cy), (W,cy), (0,0,0),1)

    for i in range(len(timing_rows)-1):

        y1 = timing_rows[i]
        y2 = timing_rows[i+1]

        # cv2.line( warp, (0,y1), (W,y1), (255,0,255), 1)


    timing_rows = sorted(timing_rows)

    # ===============================
    # TÌNH ROI TUONG DOI
    # ===============================

    xs=[]
    ys=[]

    for x,y,w,h in rect_markers:

        xs.extend([x,x+w])
        ys.extend([y,y+h])

    mx1=min(xs)
    mx2=max(xs)
    my1=min(ys)
    my2=max(ys)

    # kích thước cụm timing mark
    marker_w = mx2-mx1
    marker_h = my2-my1

    img_kq = warp.copy()


    # ===============================
    # MD
    # ===============================

    md_x1 = int(mx1 - 5.2*marker_w)
    md_x2 = int(mx1 + marker_w)

    md_y1 = int(my1 + 0.1*marker_h)
    md_y2 = int(my2 + 0.15*marker_h)

    # chống vượt biên
    md_x1=max(10,md_x1)
    md_y1=max(0,md_y1)

    md_x2=min(W,md_x2)
    md_y2=min(H,md_y2)

    md_x1=clamp(md_x1,0,W)
    md_x2=clamp(md_x2,0,W)
    md_y1=clamp(md_y1,0,H)
    md_y2=clamp(md_y2,0,H)

    md_roi = warp[
        md_y1:md_y2,
        md_x1:md_x2
    ]

    cv2.rectangle( warp, (md_x1,md_y1), (md_x2,md_y2), (0,255,0), 1)

    # ===============================
    # SBD
    # ===============================

    sbd_x1 = int(mx1 - 14*marker_w )
    sbd_x2 = int(mx1 - 4.5*marker_w)

    sbd_y1 = int(my1 + 0.1*marker_h)
    sbd_y2 = int(my2 + 0.15*marker_h)

    sbd_x1=max(0,sbd_x1)
    sbd_y1=max(0,sbd_y1)

    sbd_x2=min(W,sbd_x2)
    sbd_y2=min(H,sbd_y2)

    sbd_x1=clamp(sbd_x1,0,W)
    sbd_x2=clamp(sbd_x2,0,W)
    sbd_y1=clamp(sbd_y1,0,H)
    sbd_y2=clamp(sbd_y2,0,H)

    sbd_roi = warp[ sbd_y1:sbd_y2, sbd_x1:sbd_x2]

    cv2.rectangle( warp, (sbd_x1,sbd_y1), (sbd_x2,sbd_y2), (0,0,255), 3)


    # ===============================
    # ĐỌC MÃ ĐỀ
    # ===============================

    if md_roi.size==0:
        raise Exception("ROI mã đề rỗng")

    if sbd_roi.size==0:
        raise Exception("ROI SBD rỗng")

    md_rows = [
        y - md_y1
        for y in timing_rows
        if md_y1 <= y <= md_y2
    ]

    print("MD rows =", len(md_rows))
    print(md_rows)
    ma_de, md_vis, selected_points_md = read_bubbles( md_roi, cols=4, timing_rows=md_rows)

    for cx, cy, r in selected_points_md:

        wx = md_x1 + cx
        wy = md_y1 + cy

        cv2.circle(img_kq,(wx, wy),r,(0,255,0),3)


    cv2.imshow( "MA DE", md_vis)
    print(ma_de)
    # ===============================
    # ĐỌC SBD
    # ===============================

    sbd_rows = [
        y - sbd_y1
        for y in timing_rows
        if sbd_y1 <= y <= sbd_y2
    ]

    print("SBD rows =", len(sbd_rows))
    print(sbd_rows)
    sbd1, sbd_vis, selected_points_sbd = read_bubbles(sbd_roi,cols=8,timing_rows=sbd_rows)

    for cx, cy, r in selected_points_sbd:

        wx = sbd_x1 + cx
        wy = sbd_y1 + cy

        cv2.circle(img_kq,(wx, wy),r,(0,255,0),3)

    cv2.imshow("SBD RESULT",sbd_vis)



    with open("answers.json", "r", encoding="utf-8") as f:
        exams = json.load(f)

    answer_key = exams.get(ma_de)

    if answer_key is None:
        print("Không tìm thấy mã đề:", ma_de)
        exit()

    print("DAP AN")
    print(exams)

    md_answer_key =  exams[ma_de]
    answer_key_part1 = md_answer_key.get('mcq', {})
    answer_key_2 = md_answer_key.get('trueFalse', md_answer_key.get('tf', {}))
    answer_key_3 = md_answer_key.get('shortAnswer', md_answer_key.get('essay', {}))
    print(answer_key_3)

    # ===============================
    # PHẦN 1
    # ===============================

    for c in cnts:
        peri = cv2.arcLength(c, True)
        if peri == 0: continue
        
        approx = cv2.approxPolyDP(c, 0.025 * peri, True)
        area = cv2.contourArea(c)
        
        # 2. RÚT RA NGOÀI: Tính toán chung cho mọi hình có diện tích vừa phải
        if 0 < area < 3000:
            x, y, w, h = cv2.boundingRect(c)
            if w == 0 or h == 0: continue
                
            aspect_ratio = w / float(h)
            rect_area = w * h
            extent = area / float(rect_area)
            circularity = (4 * math.pi * area) / (peri * peri)

            # 3. NGÃ RẼ 1: NỐT VUÔNG ĐIỂM NEO
            if 4 <= len(approx) <= 8  and 0.8 <= aspect_ratio <= 1.9 and circularity < 0.85 and extent > 0.75:
                markers.append(approx)
                # cv2.drawContours(warp, [approx], -1, (0, 0, 255), 2) # Viền Đỏ

    centers_3 = []

    for m in markers:

        M = cv2.moments(m)

        if M["m00"] == 0:
            continue

        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])

        x,y,w,h = cv2.boundingRect(m)

        centers_3.append((cx,cy,x,y,w,h))

        # cv2.circle(warp,(cx,cy),8,(0,255,255),-1)

    print("Tổng marker =",len(centers_3))
    print(centers_3)

    part1_pts = []

    for item in centers_3:

        cx,cy,x,y,w,h = item

        if 100 < cy < 800:
            part1_pts.append((item))
            cv2.circle(warp,(cx,cy),8,(0,0,255),-1)
        
    part1_pts = sorted(part1_pts, key=lambda p: (p[1], p[0]))

    print("PART1 =", len(part1_pts))

    print("PART1 PTS")
    for p in part1_pts:
        print(p)

    TL1 = part1_pts[0]
    TR1 = part1_pts[1]


    if len(part1_pts) != 4:
        raise Exception(
            f"Part1 marker lỗi. Tìm thấy {len(part1_pts)} điểm"
        )

    top_row_1 = sorted(part1_pts[:2], key=lambda p:p[0])

    mid_row_1 = sorted(part1_pts[2:4], key=lambda p:p[0])

    # bot_row = sorted(part2_pts[4:6], key=lambda p:p[0])

    TL1, TR1 = top_row_1

    ML1, MR1 = mid_row_1

    part1_x = min(TL1[0], ML1[0])
    part1_y = min(TL1[1], TR1[1])

    # BL2, BR2 = bot_row

    print("TL1 =", TL1)
    print("TR1 =", TR1)

    print("ML1  =", ML1)
    print("MR1  =", MR1)

    shrink = 0

    src_part1 = np.float32([
        [TL1[0] + shrink, TL1[1] + shrink ],
        [TR1[0] - shrink, TR1[1] + shrink],
        [MR1[0] - shrink, MR1[1] - shrink],
        [ML1[0] + shrink, ML1[1] - shrink ]
    ])

    w_part1 = 800
    h_part1 = 280

    dst_part1 = np.float32([
        [0,0],
        [w_part1,0],
        [w_part1,h_part1],
        [0,h_part1]
    ])

    M1 = cv2.getPerspectiveTransform(src_part1, dst_part1)

    M1_inv = cv2.getPerspectiveTransform(
        dst_part1,
        src_part1
    )

    part1_roi = cv2.warpPerspective(warp,M1,(w_part1, h_part1))

    cv2.line(warp,(TL1[0], TL1[1] ),(TR1[0], TR1[1]),(0,255,0),2)

    cv2.line(warp,(ML1[0], ML1[1]),(MR1[0], MR1[1]),(0,255,0),2)

    # cv2.line(warp,(ML[0] + 0, ML[1] - 75),(MR[0] + 1000, MR[1] - 75),(0,0,255), 2)

    cv2.line(warp,(TL1[0], TL1[1]),(ML1[0], ML1[1]),(0,255,0),2)

    cv2.line(warp,(TR1[0], TR1[1]),(MR1[0], MR1[1]),(0,255,0),2)

    # Cắt ROI
    cv2.imshow("PART1 ROI", part1_roi)

    h1, w1 = part1_roi.shape[:2]

    roi_part1_chia = w1 // 4

    all_part1_blocks = []

    for i in range(4):
        block_x1 = i * roi_part1_chia
        if i == 3:
            block_x2  = w1
        else:
            block_x2  = (i + 1) * roi_part1_chia

        roi_block_par1 = part1_roi[:, block_x1:block_x2]

        print(f"BLOCK {i+1}",roi_block_par1.shape)

        all_part1_blocks.append(roi_block_par1)

    all_answers1 = {}

    for i, block_part1 in enumerate(all_part1_blocks):

        offset_x = int(i * roi_part1_chia)

        answers_part1, debug_part1, selected_points_part1 = read_part1(block_part1, 10, 4, answer_key_part1 , start_question=i*10+1 )

        all_answers1.update(answers_part1)

        for q, ans, cx, cy, radius, is_correct, correct_cx, correct_cy  in selected_points_part1:

            wx = int(part1_x + offset_x + cx)
            wy = int(part1_y + cy)

            px = cx + offset_x
            py = cy

            pt = np.array([[[px, py]]],dtype=np.float32)

            real_pt = cv2.perspectiveTransform(pt,M1_inv)

            wx = int(real_pt[0][0][0])
            wy = int(real_pt[0][0][1])

            cv2.circle(img_kq,(wx, wy),8,(0,255,255),2)
            
            color = (0,255,0) if is_correct else (0,0,255)
            

            cv2.circle(img_kq,(wx, wy),radius + 3,color,2)

            if not is_correct:

                px2 = correct_cx + offset_x
                py2 = correct_cy

                pt2 = np.array([[[px2, py2]]], dtype=np.float32)

                real_pt2 = cv2.perspectiveTransform(pt2, M1_inv)

                wx2 = int(real_pt2[0][0][0])
                wy2 = int(real_pt2[0][0][1])

                
                cv2.circle(img_kq,(wx2, wy2),radius + 3,(0,255,0),2)

        cv2.imshow(f"PART1_GRID_{i+1}",debug_part1)

    print(f"\n===== PART1 =====")
    # print(all_answers1)


    # ===============================
    # PHẦN 2
    # ===============================
    markers = []
    for c in cnts:
        peri = cv2.arcLength(c, True)
        if peri == 0: continue
        
        approx = cv2.approxPolyDP(c, 0.025 * peri, True)
        area = cv2.contourArea(c)
        
        # 2. RÚT RA NGOÀI: Tính toán chung cho mọi hình có diện tích vừa phải
        if 0 < area < 3000:
            x, y, w, h = cv2.boundingRect(c)
            if w == 0 or h == 0: continue
                
            aspect_ratio = w / float(h)
            rect_area = w * h
            extent = area / float(rect_area)
            circularity = (4 * math.pi * area) / (peri * peri)

            # 3. NGÃ RẼ 1: NỐT VUÔNG ĐIỂM NEO
            if 4 <= len(approx) <= 8  and 0.8 <= aspect_ratio <= 1.9 and circularity < 0.85 and extent > 0.75:
                markers.append(approx)
                # cv2.drawContours(warp, [approx], -1, (0, 0, 255), 2) # Viền Đỏ

    centers_1 = []

    for m in markers:

        M = cv2.moments(m)

        if M["m00"] == 0:
            continue

        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])

        x,y,w,h = cv2.boundingRect(m)

        centers_1.append((cx,cy,x,y,w,h))

        # cv2.circle(warp,(cx,cy),8,(0,255,255),-1)

    print("Tổng marker =",len(centers_1))
    print(centers_1)


    part2_pts = []

    for item in centers_1:

        cx,cy,x,y,w,h = item

        if 700 < cy < 1000:
            part2_pts.append((item))
            # cv2.circle(warp,(cx,cy),8,(0,0,255),-1)
        
    part2_pts = sorted(part2_pts, key=lambda p: (p[1], p[0]))

    print("PART2 =", len(part2_pts))

    print("PART2 PTS")
    for p in part2_pts:
        print(p)

    TL2 = part2_pts[0]
    TR2 = part2_pts[1]

    # BL2 = part2_pts[4]
    # BR2 = part2_pts[5]

    if len(part2_pts) != 4:
        raise Exception(
            f"Part2 marker lỗi. Tìm thấy {len(part2_pts)} điểm"
        )

    top_row = sorted(part2_pts[:2], key=lambda p:p[0])

    mid_row = sorted(part2_pts[2:4], key=lambda p:p[0])

    # bot_row = sorted(part2_pts[4:6], key=lambda p:p[0])

    TL2, TR2 = top_row

    ML, MR = mid_row

    # BL2, BR2 = bot_row

    print("TL2 =", TL2)
    print("TR2 =", TR2)

    print("ML  =", ML)
    print("MR  =", MR)

    shrink = -5

    src_part2 = np.float32([
        [TL2[0] + shrink, TL2[1] + shrink + 10],
        [TR2[0] - shrink, TR2[1] + shrink],
        [MR[0] - shrink, MR[1] - shrink],
        [ML[0] + shrink, ML[1] - shrink ]
    ])

    w_part2 = 800
    h_part2 = 220

    dst_part2 = np.float32([
        [0,0],
        [w_part2,0],
        [w_part2,h_part2],
        [0,h_part2]
    ])

    M2 = cv2.getPerspectiveTransform(src_part2,dst_part2)

    M2_inv = np.linalg.inv(M2)

    part2_roi = cv2.warpPerspective(warp,M2,(w_part2,h_part2))

    cv2.line(warp,(TL2[0], TL2[1] ),(TR2[0], TR2[1]),(0,255,0),2)

    cv2.line(warp,(ML[0], ML[1]),(MR[0], MR[1]),(0,255,0),2)

    # cv2.line(warp,(ML[0] + 0, ML[1] - 75),(MR[0] + 1000, MR[1] - 75),(0,0,255), 2)

    cv2.line(warp,(TL2[0], TL2[1]),(ML[0], ML[1]),(0,255,0),2)

    cv2.line(warp,(TR2[0], TR2[1]),(MR[0], MR[1]),(0,255,0),2)

    # Cắt ROI
    cv2.imshow("PART2 ROI", part2_roi)

    h2, w2 = part2_roi.shape[:2]

    left_crop = 15
    right_crop = 15

    part2_roi = part2_roi[
        :,
        left_crop:w2 - right_crop
    ]

    h2, w2 = part2_roi.shape[:2]

    roi_part2_chia = w2 // 4

    all_part2_blocks = []

    for i in range(4):
        x1 = i * roi_part2_chia
        if i == 3:
            x2 = w2
        else:
            x2 = (i + 1) * roi_part2_chia

        roi_block_par2 = part2_roi[:, x1:x2]

        print(f"BLOCK {i+1}",roi_block_par2.shape)

        all_part2_blocks.append(roi_block_par2)

    all_answers_part2 = {}

    all_answers_part2_last = []

    for i, block_part2 in enumerate(all_part2_blocks):

        start_question = i * 2 + 1

        answers_part2, debug_part2, selected_points_part2, correct_points_part2  = build_part2_grid(block_part2, answer_key_2 , start_question = start_question)

        all_answers_part2.update(answers_part2)

        offset_x = i * roi_part2_chia

        for row, col, cx, cy, radius, is_correct  in selected_points_part2:

            px = cx + offset_x + left_crop
            py = cy

            pt = np.array([[[px, py]]], dtype=np.float32)

            real_pt = cv2.perspectiveTransform(pt, M2_inv)

            wx = int(real_pt[0][0][0])
            wy = int(real_pt[0][0][1])

            if is_correct:
                color = (0,255,0)
            else:
                color = (0,0,255)

            cv2.circle(img_kq,(wx, wy),8,(0,255,255),2)
            cv2.circle(img_kq,(wx, wy),radius + 3,color,2)
            cv2.circle(img_kq,(wx, wy),radius + 6,(0,255,0),2)

            

        for cx, cy, radius in correct_points_part2:

            px = cx + offset_x + left_crop
            py = cy

            pt = np.array([[[px, py]]], dtype=np.float32)

            real_pt = cv2.perspectiveTransform(pt, M2_inv)

            wx = int(real_pt[0][0][0])
            wy = int(real_pt[0][0][1])

            # cv2.circle( img_kq,(wx, wy),radius + 3,(0,255,0),2)
            
        cv2.imshow(f"PART2_GRID_{i+1}",debug_part2)

    # Kết quả phần 2
    print("\n===== PART2 =====")

    for q, data in all_answers_part2.items():

        print(f"Câu {q}")

        for y, ans in data.items():
            print(f"   {y}) {ans}")

            all_answers_part2_last.append(f"{q}{ans}")


    # ===============================
    # PHẦN 3
    # ===============================

    part3_pts = []

    for item in centers_1:

        cx,cy,x,y,w,h = item

        if 950 < cy < 1800:
            part3_pts.append((item))
            cv2.circle(warp,(cx,cy),8,(0,255,255),6)
        
    part3_pts = sorted(part3_pts, key=lambda p: (p[1], p[0]))

    print("PART3 PTS")
    for p in part3_pts:
        print(p)

    ML = part2_pts[0]
    MR = part2_pts[1]


    if len(part3_pts) != 4:
        raise Exception(
            f"Part3 marker lỗi. Tìm thấy {len(part3_pts)} điểm"
        )

    # top_row = sorted(part3_pts[:2], key=lambda p:p[0])

    mid_row = sorted(part3_pts[:2], key=lambda p:p[0])

    bottom_row = sorted(part3_pts[2:4], key=lambda p:p[0])

    BL2, BR2 = bottom_row

    ML, MR = mid_row


    print("ML  =", ML)
    print("MR  =", MR)

    print("TL2 =", BL2)
    print("TR2 =", BR2)

    shrink = 5

    src_part3 = np.float32([
        [ML[0] + shrink, ML[1] + shrink ],
        [MR[0] - shrink, MR[1] + shrink],
        [BR2[0] - shrink, BR2[1] - shrink],
        [BL2[0] + shrink, BL2[1] - shrink ]
    ])

    w_part3 = 900
    h_part3 = 420

    dst_part3 = np.float32([
        [0,0],
        [w_part3,0],
        [w_part3,h_part3],
        [0,h_part3]
    ])

    M3 = cv2.getPerspectiveTransform(src_part3,dst_part3)

    M3_inv = np.linalg.inv(M3)

    part3_roi = cv2.warpPerspective(warp,M3,(w_part3,h_part3))

    cv2.line(warp,(ML[0], ML[1] ),(MR[0], MR[1]),(0,255,0),2)

    cv2.line(warp,(BL2[0], BL2[1]),(BR2[0], BR2[1]),(0,255,0),2)

    cv2.line(warp,(ML[0], ML[1]),(BL2[0], BL2[1]),(0,255,0),2)

    cv2.line(warp,(MR[0], MR[1]),(BR2[0], BR2[1]),(0,255,0),2)

    cv2.imshow("PART3 ROI", part3_roi)

    h3, w3 = part3_roi.shape[:2]

    left_crop = 15
    right_crop = 15

    part3_roi = part3_roi[
        :,
        left_crop:w3 - right_crop
    ]

    h3, w3 = part3_roi.shape[:2]

    roi_part3_chia = w3 // 6

    all_part3_blocks = []

    for i in range(6):

        x1 = i * roi_part3_chia

        if i == 5:
            x2 = w3
        else:
            x2 = (i + 1) * roi_part3_chia

        print(i, x1, x2)

        roi_block_part3 = part3_roi[:, x1:x2]
        
        print("roi =", roi_block_part3.shape)

        if roi_block_part3.size == 0:
            print("ROI RONG")
            continue

        # cv2.imshow(f"BLOCK_{i+1}", roi_block_part3)

        all_part3_blocks.append(roi_block_part3)

    all_ans_part3 = []

    for i, block_part3 in enumerate(all_part3_blocks):
        question_no = i + 1

        (
            ans_part3,
            debug_part3,
            selected_points_part3,
            correct_points_part3,
            is_correct,
        ) = build_part3_grid(block_part3, answer_key_3, question_no)

        offset_x = i * roi_part3_chia + left_crop

        for row, col, cx, cy, radius in selected_points_part3:

            px = cx + offset_x
            py = cy

            pt = np.array([[[px, py]]], dtype=np.float32)

            real_pt = cv2.perspectiveTransform(pt, M3_inv)

            wx = int(real_pt[0][0][0])
            wy = int(real_pt[0][0][1])

            color = (0,255,0) if is_correct else (0,0,255)

            cv2.circle(img_kq,(wx, wy),radius + 4, color, 2)
            # cv2.circle(img_kq,(wx, wy),8,(0,255,255),3)

        if not is_correct:
            for cx, cy, radius in correct_points_part3:
                px = cx + offset_x
                py = cy

                pt = np.array([[[px, py]]], dtype=np.float32)
                real_pt = cv2.perspectiveTransform(pt, M3_inv)

                wx = int(real_pt[0][0][0])
                wy = int(real_pt[0][0][1])

                cv2.circle(img_kq, (wx, wy), radius + 7, (0,255,0), 2)
                cv2.circle(debug_part3, (cx, cy), radius + 7, (0,255,0), 2)

        cv2.imshow(f"PART3_GRID_{i+1}",debug_part3)

        # Kết quả phần 3
        print(f"\n===== PART3 BLOCK {i+1} =====")
        print(ans_part3)
        all_ans_part3.append(ans_part3)




    # ====== HIỂN THỊ ======

    # cv2.namedWindow('1. Anh Goc', cv2.WINDOW_NORMAL)
    # cv2.namedWindow('4. Tim Diem Neo va O Tron', cv2.WINDOW_NORMAL)
    cv2.namedWindow('5. Anh Warp', cv2.WINDOW_NORMAL)

    # cv2.resizeWindow('1. Anh Goc', 600, 800)
    # cv2.resizeWindow('4. Tim Diem Neo va O Tron', 600, 800)
    cv2.resizeWindow('5. Anh Warp', 800, 1000)

    # cv2.imshow('1. Anh Goc', img)
    # cv2.imshow('4. Tim Diem Neo va O Tron', img_markers)
    cv2.imshow('5. Anh Warp', warp)

    # cv2.imshow("SBD ROI", sbd_roi)
    # cv2.imshow("MA DE ROI", md_roi)

    cv2.namedWindow('PHIEU THI DA DUOC TO', cv2.WINDOW_NORMAL)
    cv2.resizeWindow('PHIEU THI DA DUOC TO', 800, 1000)
    cv2.imshow('PHIEU THI DA DUOC TO', img_kq)

    cv2.waitKey(0)
    cv2.destroyAllWindows()

    # print(f"\n====== ALL ĐAP AN ========")
    # sbd = sbd1
    # md = ma_de
    # all_answers2 = all_answers_part2_last
    # all_answers3 = all_ans_part3

    # print("SBD:",)
    # print("Mã đề:",md)
    # print(all_answers1)
    # print(all_answers2)
    # print(all_answers3)

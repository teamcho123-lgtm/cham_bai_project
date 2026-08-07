import math
import cv2
import json
import os
import numpy as np
import glob
from function.clamp import clamp
from function.warp_paper import warp_paper
from function.dist import dist

import cv2
import numpy as np

BASE_DIR = os.path.dirname( os.path.abspath(__file__))

RESULT_FOLDER = os.path.join( BASE_DIR, "results")

def find_marker_in_roi(roi, offset_x=0, offset_y=0, win_name="ROI DEBUG", debug_mode=False):
    
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    blur = cv2.GaussianBlur(gray, (5,5), 0)

    thresh = cv2.adaptiveThreshold( blur,255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41,11 )

    cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best = None
    best_area = 0
    debug = roi.copy()

    for c in cnts:
        
        # if 3 <= len(approx) <= 10 and 0.5 <= ratio <= 2 and extent > 0.75 and circularity < 0.85:
        # if 1 <= len(approx) <= 10 and 0.5 <= ratio <= 2 and extent > 0.7 and circularity < 0.85 and fill_ratio > 0.4:

        
        peri = cv2.arcLength(c, True)

        if peri == 0:
            continue

        approx = cv2.approxPolyDP(c, 0.025 * peri, True)
        area = cv2.contourArea(c)
        x, y, w, h = cv2.boundingRect(c)
        if h == 0:
            continue
        ratio = w / float(h)
        extent = area / float(w * h)

        circularity = ( 4 * math.pi * area / (peri * peri))

        marker_roi = thresh[
            y:y + h,
            x:x + w
        ]

        fill_ratio = ( cv2.countNonZero(marker_roi) / float(w * h) )

        if (4 <= len(approx) <= 8 and 0.9 <= ratio <= 2 and extent > 0.7 and circularity < 0.85 and fill_ratio > 0.4):
            cv2.drawContours(debug,[c],-1,(0, 255, 0), 2 )

            cx = x + w // 2
            cy = y + h // 2

            cv2.circle(  debug, (cx, cy),  5,(0, 0, 255), -1)

            if area > best_area:
                M = cv2.moments(c)

                if M["m00"] == 0:
                    continue

                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                best = (cx + offset_x, cy + offset_y)
                best_area = area


    if best is None:
        print( f"{win_name}: " "KHÔNG TÌM THẤY MARKER")
        return None

    return best

def cat_roi(roi, cols):
    # roi = (xr, yr, wr, hr)
    part_roi = crop_relative(warp, roi)
    result, vis, points = read_bubbles(part_roi, cols)
    xr, yr, wr, hr = roi
    H, W = warp.shape[:2]

    x = int(xr * W)
    y = int(yr * H)
    w = int(wr * W)
    h = int(hr * H)

    for cx, cy, radius in points:

        wx = x + cx
        wy = y + cy

        cv2.circle(warp,(wx, wy),radius,(0,255,0),2)

    cv2.rectangle(warp, (x, y), (x+w, y+h), (0,255,0), 1)

    return result

def read_bubbles(roi_img, cols):
    result = ""
    img_result = roi_img.copy()
    selected_points = []
    
    # 1. TIỀN XỬ LÝ (Đã lắp CLAHE trị bóng râm)
    gray = cv2.cvtColor(roi_img, cv2.COLOR_BGR2GRAY)
    
    # clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    # gray = clahe.apply(gray)
    
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41, 11)
    
    # 2. TÌM TẤT CẢ CÁC Ô TRÒN CHƯA TÔ
    contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    # print("Tong contour =", len(contours))
    
    xs, ys, ws, hs = [], [], [], []
    bubble_centers = []
    
    for c in contours:

        x, y, w, h = cv2.boundingRect(c)
        area = cv2.contourArea(c)
        peri = cv2.arcLength(c, True)
        if peri == 0:
            continue
        circularity = 4*np.pi*area/(peri*peri)
        approx = cv2.approxPolyDP(c, 0.025 * peri, True)
        
        extent = area / float(w * h)
        aspect_ratio = w / float(h) if h != 0 else 0

        cv2.putText(img_result,f"{int(peri)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1)
        
        if  10 <= area < 250 and 0.8 < aspect_ratio < 1.65 and peri > 15:
            xs.append(x)
            ys.append(y)
            ws.append(w)
            hs.append(h)
            
            cx = x + w//2
            cy = y + h//2
            # cv2.putText(img_result,f"{float(peri)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1)
            bubble_centers.append((cx, cy))

        # if len(xs) == 0:
        #     raise ValueError("Không tìm thấy bubble")

    # 3. TÍNH KHUNG GRID
    lefts   = [cx - w//2 for (cx, cy), w, h in zip(bubble_centers, ws, hs)]
    rights  = [cx + w//2 for (cx, cy), w, h in zip(bubble_centers, ws, hs)]
    tops    = [cy - h//2 for (cx, cy), w, h in zip(bubble_centers, ws, hs)]
    bottoms = [cy + h//2 for (cx, cy), w, h in zip(bubble_centers, ws, hs)]

    grid_x1 = min(lefts)
    grid_x2 = max(rights)
    grid_y1 = min(tops)
    grid_y2 = max(bottoms)

    avg_w = int(np.median(ws))
    avg_h = int(np.median(hs))

    pad = int(avg_w * 0.3)

    grid_x1 -= pad
    grid_x2 += pad
    grid_y1 -= pad
    grid_y2 += pad

    grid_w = grid_x2 - grid_x1
    grid_h = grid_y2 - grid_y1

    rows = 10

    cell_w = grid_w / cols
    cell_h = grid_h / rows

    cv2.rectangle(img_result,(grid_x1, grid_y1),(grid_x2, grid_y2),(255,0,0),2)

    centers = []

    for r in range(rows):

        cy = grid_y1 + (r + 0.5) * cell_h

        row = []

        for c in range(cols):

            cx = grid_x1 + (c + 0.5) * cell_w

            row.append((int(cx), int(cy)))

            # cv2.circle(img_result, (int(cx), int(cy)), 4, (0,0,255), -1)

        centers.append(row)

    MIN_FILL = 40

    for c in range(cols):
        best_fill = 0
        best_row = -1

        for r in range(rows):
            cx, cy = centers[r][c]
            radius = int(avg_w * 0.45)
            mask = np.zeros(thresh.shape,np.uint8)
            cv2.circle(mask,(cx,cy),radius,255,-1)

            filled = cv2.countNonZero(cv2.bitwise_and(thresh,mask))

            if filled > best_fill:
                best_fill = filled
                best_row = r

        if best_fill > MIN_FILL:
            result += str(best_row)
            cx,cy = centers[best_row][c]
            selected_points.append((cx,cy,radius))
            cv2.circle(img_result,(cx,cy),radius,(0,255,0),2)

        else:
            result += "?"

    return result, img_result, selected_points

def read_part1(part1_roi, rows, cols, answer_key_1, img=None, offset_x=0, offset_y=0, start_question=1):

    selected_points = []

    debug = part1_roi.copy()

    gray = cv2.cvtColor(part1_roi, cv2.COLOR_BGR2GRAY)

    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,8)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

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
        aspect_ratio = w / float(h) if h != 0 else 0

        # cv2.putText(part1_roi,f"{int(area)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1)

        if 100 < area < 650 and 0.6 < aspect_ratio < 1.5 :
            cx = x + w//2
            cy = y + h//2
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

    pad = int(avg_w * 0.3)

    grid_x1 -= pad
    grid_x2 += pad

    grid_y1 -= pad
    grid_y2 += pad

    cv2.rectangle( debug,(grid_x1,grid_y1),(grid_x2,grid_y2),(255,0,0),2)

    rows = 10
    cols = 4

    grid_w = grid_x2 - grid_x1
    grid_h = grid_y2 - grid_y1

    cell_w = grid_w / cols
    cell_h = grid_h / rows

    centers = []

    for r in range(rows):

        cy = grid_y1 + (r + 0.5) * cell_h

        row = []

        for c in range(cols):

            cx = grid_x1 + (c + 0.5) * cell_w

            row.append((int(cx), int(cy)))

            # cv2.circle(debug, (int(cx), int(cy)), 4, (0,0,255), -1)

        centers.append(row)

    answers = {}

    letters = ['A','B','C','D']

    MIN_FILL = 40

    for r in range(rows):
    
        best_fill = 0
        best_col = -1

        for c in range(cols):

            cx, cy = centers[r][c]

            radius = int(avg_w * 0.32)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx, cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            if filled > best_fill:
                best_fill = filled
                best_col = c

            # cv2.circle(debug,(cx,cy),radius,(0,255,255),2)

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            # tô > 35%
            marked = ratio_fill > 0.75

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
                print(f"Không có đáp án cho câu {question_no}")
                continue

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

    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,41,11)

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

        if  ratio < 1.4 and circularity > 0.65:

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

    pad = int(avg_w * 0.25)

    grid_x1 -= pad + 3
    grid_x2 += pad + 3

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
            marked = ratio_fill > 0.5

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

def build_part3_grid(block_img, answer_key_3, question_no, rows=12, cols=4):
    
    selected_points = []

    correct_points = []

    debug = block_img.copy()

    gray = cv2.cvtColor(block_img, cv2.COLOR_BGR2GRAY)

    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,10)

    kernel = np.ones((3,3), np.uint8)

    thresh = cv2.morphologyEx(thresh,cv2.MORPH_CLOSE,kernel)

    cnts, _ = cv2.findContours(thresh,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)

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
        # cv2.putText(block_img,f"{int(peri)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1)
        if 0.8 < ratio < 1.4 and circularity > 0.8:

            cx = x + w//2
            cy = y + h//2
            
            # cv2.circle(debug, (int(cx), int(cy)), 4, (0,0,255), -1)

            bubbles.append((cx,cy,w,h))

    bubble_points = []

    for cx,cy,w,h in bubbles:
        bubble_points.append((cx,cy))

    # print("Tong contour =", len(cnts))
    # print("Tong bubble =", len(bubbles))

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

    # print("cols_x =", cols_x)

    # gom 10 hàng
    rows_y = []
    for y in sorted(ys):
        if len(rows_y) == 0:
            rows_y.append([y])
        elif abs(y - np.mean(rows_y[-1])) < 13:
            rows_y[-1].append(y)
        else:
            rows_y.append([y])

    rows_y = [int(np.mean(r)) for r in rows_y]
    # print("rows_y =", rows_y)
    
    result = []

    digits = [""] * 4

    minus = False
    comma_pos = -1

    avg_w = int(np.median([w for _,_,w,_ in bubbles]))
    cols_chars = [""] * len(cols_x)

    for r, cy in enumerate(rows_y):

        row_answer = []
        best_fill = 0
        best_col = -1
        temp_data = []

        for c, cx in enumerate(cols_x):

            radius = int(avg_w * 0.45)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx,cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            temp_data.append((cx,cy,radius,filled))

            if filled > best_fill:
                best_fill = filled

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            # tô > 35%
            marked = ratio_fill > 0.65

            row_answer.append(marked)

            if marked:
                # Hàng 0 chỉ có 3 ô: cột 0 là dấu âm, cột 1 và 2 là dấu phẩy.
                # Cột 3 hàng 0 KHÔNG có ô nào trên phiếu - nếu bắt được ở đây
                # thì là nhiễu/vết bẩn, bỏ qua (trước đây rơi vào nhánh else
                # thành str(0-1) = "-1", nhét 2 ký tự vào 1 cột).
                if r == 0:
                    if c == 0:
                        char = "-"
                    elif c in (1, 2):
                        char = ","
                    else:
                        char = None
                else:
                    char = str(r - 1)

                if char is None:
                    color = (0,255,255)
                    cv2.circle(debug,(cx,cy),radius,color,2)
                    continue

                color = (0,255,0)
                cols_chars[c] = char

                selected_points.append((r,c,cx,cy,radius))
            else:
                color = (0,255,255)
            
            cv2.circle(debug,(cx,cy),radius,color,2)

        result.append(row_answer)

    answer_str = "".join(cols_chars)

    if comma_pos != -1:
        answer_str = ( answer_str[:comma_pos]+ ","+ answer_str[comma_pos:])
    if minus:
        answer_str = "-" + answer_str

    # Dap an co 2 dinh dang:
    #  - chuoi thuong:  "1,85"                     (file answers.json)
    #  - dict tu web:   {"answer": "1,85"}         hoac co them acceptedAnswers
    # Truoc day chi xu ly dang chuoi, gap dict thi str(dict) ra
    # "{'answer': '1,85'}" -> so sanh luon sai VA khong ve duoc vong dap an dung.
    correct_data = answer_key_3.get(str(question_no))

    if isinstance(correct_data, dict):
        accepted_answers = (correct_data.get("acceptedAnswers") or [correct_data.get("answer")])
    elif correct_data is None:
        accepted_answers = []
    else:
        accepted_answers = [correct_data]

    accepted_answers = [v for v in accepted_answers if v is not None]

    def normalize_short_answer(value):
        return str(value).strip().replace(".", ",")

    if not accepted_answers:
        print(f"Không có đáp án câu {question_no}")
        is_correct = False
        correct_answer = None
    else:
        accepted_values = {normalize_short_answer(v) for v in accepted_answers}
        is_correct = normalize_short_answer(answer_str) in accepted_values
        # Dung dap an dau tien de ve vong tron goi y khi hoc sinh lam sai
        correct_answer = accepted_answers[0]

    if not is_correct and correct_answer is not None:
        temp = str(correct_answer)
        radius = int(avg_w * 0.45)

        # Duyệt qua từng ký tự trong chuỗi gốc, mỗi ký tự map đúng vào 1 cột
        for c, char in enumerate(temp):
            # Giới hạn số cột tối đa là 4 (hoặc độ dài của mảng cols_x)
            if c >= len(cols_x) or c >= 4:
                break
                
            row_idx = -1
            
            # Ánh xạ ký tự thành index của hàng (row).
            # Phiếu này có 11 hàng: hàng 0 chứa CẢ dấu âm lẫn dấu phẩy
            # (phân biệt theo cột), hàng 1..10 là chữ số 0..9.
            if char == "-":
                row_idx = 0  # Dấu âm ở hàng 0
            elif char == ",":
                row_idx = 0  # Dấu phẩy cũng ở hàng 0, khác cột
            elif char.isdigit():
                row_idx = int(char) + 1  # Số 0 ở hàng 1 -> số 9 ở hàng 10
                
            # Nếu ký tự hợp lệ và không vượt quá số lượng hàng thực tế
            if row_idx != -1 and row_idx < len(rows_y):
                correct_points.append((cols_x[c], rows_y[row_idx], radius))
            

    return answer_str, debug, selected_points, is_correct, correct_points

def crop_relative(img, roi):

    H, W = img.shape[:2]

    xr, yr, wr, hr = roi

    x = int(xr * W)
    y = int(yr * H)

    w = int(wr * W)
    h = int(hr * H)

    return img[y:y+h, x:x+w]

img_original  = cv2.imread(r'C:\Users\Admin\Downloads\Project_1\backend\data\data2 2-8-2026\IMG_8243.JPEG')

def detect(image_path, answer_keys=None, debug_mode=False):
    global warp
    
    img_original = cv2.imread(image_path)
    
    if img_original is None:
        raise ValueError( f"Không đọc được ảnh: {image_path}")

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

    H, W = img.shape[:2]

    roi_size = int(min(W, H) * 0.25)  # 25% cạnh ngắn

    margin = 0

    # CHỌN 4 GÓC CỦA TỜ GIẤY LÀM NEO

    # TL
    cv2.rectangle( img, (margin, margin), (roi_size + margin, roi_size + margin), (0,255,0), 4)
    roi_tl = img[
        margin : margin + roi_size,
        margin : margin + roi_size
    ]

    # TR
    cv2.rectangle( img, (W - roi_size - margin, margin), (W - margin, roi_size + margin), (0,255,0),4)
    roi_tr = img[
        margin : margin + roi_size,
        W-roi_size-margin : W-margin
    ]

    # BL
    cv2.rectangle( img, (margin, H - roi_size - margin), (roi_size + margin, H - margin), (0,255,0), 4)
    roi_bl = img[
        H-roi_size-margin : H-margin,
        margin : margin+roi_size
    ]

    cv2.rectangle( img, (W - roi_size - margin, H - roi_size - margin), (W - margin, H - margin), (0,255,0), 4)
    roi_br = img[
        H-roi_size-margin : H-margin,
        W-roi_size-margin : W-margin
    ]
    # ==========================================
    # PHÂN LUỒNG LOGIC: 4 ĐIỂM vs 3 ĐIỂM
    # ==========================================

    TL = find_marker_in_roi( roi_tl, margin, margin, "ROI TL DEBUG", debug_mode)

    TR = find_marker_in_roi( roi_tr, W-roi_size-margin, margin, "ROI TR DEBUG", debug_mode)

    BL = find_marker_in_roi( roi_bl, margin,H-roi_size-margin, "ROI BL DEBUG", debug_mode)

    BR = find_marker_in_roi( roi_br, W-roi_size-margin, H-roi_size-margin, "ROI BR DEBUG", debug_mode)

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

    for p in src.astype(int):
        cv2.circle(img, tuple(p), 15, (255, 0, 255), -1) 

    # 7. WARP ẢNH VỀ HỆ TỌA ĐỘ CHUẨN
    warp, M = warp_paper(img_original,TL,TR,BR,BL,out_w=1000,out_h=1400,expand=20,pad=30)
    warp_gray = cv2.cvtColor(warp, cv2.COLOR_BGR2GRAY)
    warp_blur = cv2.GaussianBlur(warp_gray, (5,5), 0)
    warp_thresh = cv2.adaptiveThreshold( warp_blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 10)
    cnts, _ = cv2.findContours( warp_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # ==========================================
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ
    # ==========================================
    points = []

    W =1000
    H =1400
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (SBD)
    # x = 640 , x2 = 830 , y = 130 , 380
    x1_sbd = 640 
    x2_sbd = 830
    y1_sbd = 145
    y2_sbd = 380

    SBD = (x1_sbd / W, y1_sbd / H, (x2_sbd - x1_sbd) / W, (y2_sbd - y1_sbd) / H)

    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (MD)
    # x = 830 , x2 = 940 , y = 130 , 380
    x1_md = 820 
    x2_md = 945
    y1_md = 140
    y2_md = 380

    MD = (x1_md / W, y1_md / H, (x2_md - x1_md) / W, (y2_md - y1_md) / H)


    sbd = cat_roi(SBD, 6)
    ma_de  = cat_roi(MD, 3)

    print('SÔ BÁO DANH : ', sbd)
    print('MÃ ĐỀ : ',ma_de )

    # Mã đề OpenCV đọc được
    ma_de = str(ma_de)

    # answer_keys do frontend gửi lên
    md_answer_key = answer_keys.get( ma_de)

    if md_answer_key is None:
        raise ValueError(
            f"Không có đáp án mã đề "
            f"{ma_de} trong dữ liệu từ web"
        )

    # Phần I
    answer_key_part1 = (md_answer_key.get("mcq",{}))

    # Phần II:
    # Hỗ trợ cả cấu trúc mới trueFalse
    # và cấu trúc cũ tf
    answer_key_2 = (
        md_answer_key.get("trueFalse",md_answer_key.get("tf",{})))

    # Phần III:
    # Hỗ trợ cả shortAnswer và essay
    answer_key_3 = (md_answer_key.get("shortAnswer",md_answer_key.get("essay",{})))
    
    correct_part1 = 0
    correct_part2 = 0
    correct_part3 = 0

    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (PART1)
    # x = 60 , x2 = 650 , y = 445 , 700
    y1_part1 = 425
    y2_part1 = 720

    PART1 = [
        (60/W,  y1_part1/H, (200-60)/W,  (y2_part1-y1_part1)/H),
        (200/W, y1_part1/H, (350-200)/W, (y2_part1-y1_part1)/H),
        (350/W, y1_part1/H, (495-350)/W, (y2_part1-y1_part1)/H),
        (510/W, y1_part1/H, (645-510)/W, (y2_part1-y1_part1)/H),
    ]

    all_answers1 = {}

    for i, roi in enumerate(PART1):

        part_roi = crop_relative(warp, roi)

        answers, debug, selected_points_part1 = read_part1(part_roi,10,4,answer_key_part1,start_question=i*10+1)

        all_answers1.update(answers)

        xr, yr, wr, hr = roi

        x = int(xr * W)
        y = int(yr * H)
        w = int(wr * W)
        h = int(hr * H)

        # cv2.rectangle(warp, (x, y), (x+w, y+h), (0,255,0), 2)

        for item in selected_points_part1:
            (row,student_answer,cx,cy,radius,is_correct,correct_cx,correct_cy) = item

            if is_correct:
                correct_part1 += 1

            question_no = i*10 + row + 1

            wx = x + cx
            wy = y + cy

            color = (0,255,0) if is_correct else (0,0,255)

            # đáp án học sinh
            cv2.circle(warp,(wx,wy),radius+1,color,2)

            # nếu sai thì hiện luôn đáp án đúng
            if not is_correct:

                correct_wx = x + correct_cx
                correct_wy = y + correct_cy

                cv2.circle(warp,(correct_wx,correct_wy),radius+1,(0,255,0), 2)

    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (PART2)
    # x = 675 , x2 = 940 , y = 445 , 570
    y1_part2_1 = 455
    y2_part2_1 = 570

    y1_part2_2 = 590
    y2_part2_2 = 700

    PART2 = [
        (675/W, y1_part2_1/H, (805-675)/W, (y2_part2_1-y1_part2_1)/H),
        (805/W, y1_part2_1/H, (940-805)/W, (y2_part2_1-y1_part2_1)/H),
        (680/W, y1_part2_2/H, (810-680)/W, (y2_part2_2-y1_part2_2)/H),
        (810/W, y1_part2_2/H, (940-810)/W, (y2_part2_2-y1_part2_2)/H),
    ]

    all_answers2 = {}
    all_answers_part2 = []

    for i, roi in enumerate(PART2):

        start_question = i * 4 + 1

        part_roi_2 = crop_relative(warp, roi)

        answers_part2, debug_part2, selected_points_part2, correct_points_part2  = build_part2_grid(part_roi_2, answer_key_2 , start_question = i * 2 + 1)

        all_answers2.update(answers_part2)

        xr, yr, wr, hr = roi

        x = int(xr * W)
        y = int(yr * H)
        w = int(wr * W)
        h = int(hr * H)

        # cv2.rectangle(warp, (x, y), (x+w, y+h), (0,255,0), 2)
        # Vẽ đáp án học sinh chọn
        for item in selected_points_part2:
            row, col, cx, cy, radius, is_correct = item

            if is_correct:
                correct_part2 += 1

            wx = x + cx
            wy = y + cy
            color = (0,255,255) if is_correct else (0,0,255)

            cv2.circle(warp,(wx,wy),radius+1,color,2)

        # Vẽ đáp án đúng (nếu sai)
        for item in correct_points_part2:
            cx, cy, radius = item
            wx = x + cx
            wy = y + cy

            cv2.circle(warp,(wx,wy),radius+1,(0,255,0),2)

    # ==========================================
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (PART3)
    # ==========================================
    # CÂU 1 : x = 65 , x2 = 190 , y = 780 , 1030 
    # b) 210 , 335 
    # c) x = 65 , x2 = 190 , 1070 , 1330
    # d) 210 , 335 
    y1_part3_top = 780
    y2_part3_top = 1050

    y1_part3_bottom = 1070
    y2_part3_bottom = 1350

    PART3 = [
        # a
        (60/W, y1_part3_top/H, (190-60)/W, (y2_part3_top-y1_part3_top)/H),
        # b
        (210/W, y1_part3_top/H, (335-210)/W, (y2_part3_top-y1_part3_top)/H),
        # c
        (65/W, y1_part3_bottom/H, (190-65)/W, (y2_part3_bottom-y1_part3_bottom)/H),
        # d
        (210/W, y1_part3_bottom/H, (335-210)/W, (y2_part3_bottom-y1_part3_bottom)/H),
    ]

    # CÂU 2 : x = 365 , x2 = 490 , y = 780 , 1030 
    # b) 510 , 635 
    # c) x = 365 , x2 = 490 , 1070 , 1330
    # d) 510 , 635 
    PART3 += [
        (365/W, y1_part3_top/H, (490-365)/W, (y2_part3_top-y1_part3_top)/H),
        (510/W, y1_part3_top/H, (635-510)/W, (y2_part3_top-y1_part3_top)/H),
        (365/W, y1_part3_bottom/H, (490-365)/W, (y2_part3_bottom-y1_part3_bottom)/H),
        (510/W, y1_part3_bottom/H, (635-510)/W, (y2_part3_bottom-y1_part3_bottom)/H),
    ]

    # CÂU 3 : x = 965 , x2 = 790 , y = 780 , 1030 
    # b) 810 , 935 
    # c) x = 665 , x2 = 790 , 1070 , 1330
    # d) 810 , 935 
    PART3 += [
        (665/W, y1_part3_top/H, (790-665)/W, (y2_part3_top-y1_part3_top)/H),
        (810/W, y1_part3_top/H, (935-810)/W, (y2_part3_top-y1_part3_top)/H),
        (665/W, y1_part3_bottom/H, (790-665)/W, (y2_part3_bottom-y1_part3_bottom)/H),
        (810/W, y1_part3_bottom/H, (935-810)/W, (y2_part3_bottom-y1_part3_bottom)/H),
    ]

    all_answers3 = {}
    correct_points_3_1 = []

    for i, roi in enumerate(PART3):

        question_no = i + 1

        part_roi_3 = crop_relative( warp, roi)

        answer_part3, debug_part3, selected_points_part3, is_correct, correct_points = build_part3_grid( part_roi_3, answer_key_3, question_no)

        if is_correct:
            correct_part3 += 1

        all_answers3[question_no] = answer_part3

        xr, yr, wr, hr = roi

        x = int(xr*W)
        y = int(yr*H)
        w = int(wr*W)
        h = int(hr*H)

        # cv2.rectangle(warp,(x,y),(x+w,y+h), (0,255,0), 2)

        color = ((0,255,0) if is_correct else(0,0,255))

        for item in selected_points_part3:

            row,col,cx,cy,radius = item

            wx = x + cx
            wy = y + cy

            cv2.circle(warp,(wx,wy),radius+1,color,2)

        # Vẽ đáp án đúng nếu sai
        if not is_correct:
            for item in correct_points:
                cx,cy,radius = item
                wx = x + cx
                wy = y + cy

                cv2.circle(warp,(wx,wy), radius+1,(0,255,0),2)
            
        cv2.putText(warp,f"Q{question_no}: {answer_part3}",(x,y-10),cv2.FONT_HERSHEY_SIMPLEX, 0.5,color,2)


    # =====================================
    # TÍNH KẾT QUẢ
    # =====================================

    correct_answers = (
        correct_part1
        + correct_part2
        + correct_part3
    )

    total_part1 = len(
        answer_key_part1
    )

    total_part2 = sum(
        len(question_answers)
        for question_answers
        in answer_key_2.values()
    )

    total_part3 = len(
        answer_key_3
    )

    total_answers = (
        total_part1
        + total_part2
        + total_part3
    )

    incorrect_answers = max(
        total_answers - correct_answers,
        0
    )

    score = 0.0

    if total_answers > 0:
        score = round(
            correct_answers
            / total_answers
            * 10,
            2
        )


    # =====================================
    # LƯU ẢNH KẾT QUẢ
    # =====================================

    os.makedirs(
        RESULT_FOLDER,
        exist_ok=True
    )

    original_file_name = os.path.basename(
        image_path
    )

    file_name_without_extension = (
        os.path.splitext(
            original_file_name
        )[0]
    )

    result_image_name = (
        f"{file_name_without_extension}"
        "-result.jpg"
    )

    result_image_path = os.path.join(
        RESULT_FOLDER,
        result_image_name
    )

    saved = cv2.imwrite(
        result_image_path,
        warp
    )

    if not saved:
        raise ValueError(
            "Không lưu được ảnh kết quả"
        )


    # =====================================
    # TRẢ JSON CHO WEB
    # =====================================

    return {
        "stuCode": str(sbd),
        "examCode": str(ma_de),

        "correctAnswers": int(
            correct_answers
        ),

        "inCorrectAnswers": int(
            incorrect_answers
        ),

        "score": float(score),

        "answers": {
            "mcq": {
                str(question): answer
                for question, answer
                in all_answers1.items()
            },

            "trueFalse": {
                str(question): answer
                for question, answer
                in all_answers2.items()
            },

            "shortAnswer": {
                str(question): answer
                for question, answer
                in all_answers3.items()
            }
        },

        "resultImageName":
            result_image_name
    }
    
if __name__ == "__main__":
    
    test_image_path = (
        r"C:\Users\Admin\Downloads"
        r"\Project_1\backend\data"
        r"\data1 31-7-2026"
        r"\IMG_8052.JPEG"
    )

    try:
        result = detect(
            test_image_path,
            debug_mode=True
        )

        print(
            json.dumps(
                result,
                ensure_ascii=False,
                indent=4
            )
        )

        cv2.waitKey(0)

    except Exception as error:
        print(
            "Lỗi chạy model:",
            str(error)
        )

    finally:
        cv2.destroyAllWindows()


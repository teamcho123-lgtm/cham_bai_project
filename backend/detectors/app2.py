import math
import cv2
import json
import os
import numpy as np
import glob
from function.clamp import clamp
from function.warp_paper import warp_paper
from function.dist import dist

try:
    from detectors.answer_key_selector import select_answer_key
except ModuleNotFoundError:
    from answer_key_selector import select_answer_key

import cv2
import numpy as np
import math

# Lui len mot cap: file nay nam trong detectors/ nhung anh ket qua
# phai ghi vao backend/results/ vi main.py chi phuc vu thu muc do.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RESULT_FOLDER = os.path.join( BASE_DIR, "results")


def find_marker_in_roi(roi, offset_x=0, offset_y=0, win_name="ROI DEBUG", debug_mode = False):

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    blur = cv2.GaussianBlur(gray, (5,5), 0)

    thresh = cv2.adaptiveThreshold( blur,255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31,8 )

    cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best = None
    best_area = 0
    debug = roi.copy()
    markers=[]

    for c in cnts:
        peri = cv2.arcLength(c, True)
        if peri == 0:
            continue
        approx = cv2.approxPolyDP(c, 0.025 * peri, True)
        area = cv2.contourArea(c)
        if area < 100 or area > 1000:
            continue
        x,y,w,h = cv2.boundingRect(c)
        if h == 0:
            continue
        ratio = w / float(h)
        extent = area / float(w*h)
        circularity = 4 * math.pi * area / (peri*peri)
        roi = thresh[y:y+h, x:x+w]
        fill_ratio = cv2.countNonZero(roi) / float(w*h)
        area_ratio = area / float(roi.shape[0] * roi.shape[1])

        # cx = x + w//2
        # cy = y + h//2
        # cv2.circle(debug,(cx,cy),5,(0,0,255),-1)
        # cv2.drawContours(debug,[c],-1,(0,255,0),2)
        
        # if 3 <= len(approx) <= 10 and 0.5 <= ratio <= 2 and extent > 0.75 and circularity < 0.85:
        # if 1 <= len(approx) <= 10 and 0.5 <= ratio <= 2 and extent > 0.7 and circularity < 0.85 and fill_ratio > 0.4:

        if 4 <= len(approx) <= 8 and extent > 0.6 :
            
            cx = x + w//2
            cy = y + h//2

            cv2.circle(debug,(cx,cy),5,(0,0,255),-1)
            cv2.drawContours(debug,[c],-1,(0,255,0),2)

            markers.append((cx+offset_x, cy+offset_y))

    selected = None

    # Không tìm thấy marker
    if len(markers) == 0:
        print(f"{win_name}: KHÔNG TÌM THẤY MARKER")

        # cv2.imshow(win_name, debug)
        return None

    if "TL" in win_name:
        selected = min(markers, key=lambda p: p[0] + p[1])  # trên trái
    elif "TR" in win_name:
        selected = max(markers, key=lambda p: p[0] - p[1])  # trên phải
    elif "BL" in win_name:
        selected = min(markers, key=lambda p: p[0] - p[1])
    elif "BR" in win_name:
        selected = max(markers, key=lambda p: p[0] + p[1])  # dưới phải
        

    for p in markers:
        px = p[0] - offset_x
        py = p[1] - offset_y

        cv2.circle( debug, (px,py), 6, (0,255,255), 2)

    # tô marker được chọn
    if selected is not None:
        px = selected[0] - offset_x
        py = selected[1] - offset_y

        cv2.circle(debug, (px,py), 5, (0,0,255), -1)

    
    if debug_mode:
        cv2.imshow( win_name, debug)

    return selected

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

    # cv2.rectangle(warp, (x, y), (x+w, y+h), (0,255,0), 1)
    # cv2.imshow("ROI", vis)

    return result

def read_bubbles(roi_img, cols):
    result = ""
    img_result = roi_img.copy()
    selected_points = []
    
    # 1. TIỀN XỬ LÝ (Đã lắp CLAHE trị bóng râm)
    gray = cv2.cvtColor(roi_img, cv2.COLOR_BGR2GRAY)
    
    
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 11)

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

        cv2.putText(img_result,f"{int(area)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.3,(0,0,255),1)
        
        if  40 <= area < 350 and 0.4 < aspect_ratio < 1.5 and peri > 40:
            xs.append(x)
            ys.append(y)
            ws.append(w)
            hs.append(h)
            
            cx = x + w//2
            cy = y + h//2
            # cv2.putText(img_result,f"{int(area)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1)
            bubble_centers.append((cx, cy))

        # if len(xs) == 0:
        #     raise ValueError("Không tìm thấy bubble")
        
    if not bubble_centers:
        raise ValueError(
        "Không nhận diện được bubble "
        "trong vùng SBD hoặc mã đề"
    )
        
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

            cv2.circle(img_result, (int(cx), int(cy)), 4, (0,0,255), -1)

        centers.append(row)

    MIN_FILL = 56

    for c in range(cols):
        best_fill = 0
        best_row = -1

        for r in range(rows):
            cx, cy = centers[r][c]
            radius = int(avg_w * 0.45)
            mask = np.zeros(thresh.shape,np.uint8)
            cv2.circle(mask,(cx,cy),radius,255,-1)

            filled = cv2.countNonZero(cv2.bitwise_and(thresh,mask))
            area_circle = np.pi * radius * radius
            ratio_fill = filled / area_circle

            # print(
            #     f"Col={c} Row={r} "
            #     f"filled={filled:3d} "
            #     f"ratio={ratio_fill:.3f}"
            # )

            if filled > best_fill:
                best_fill = filled
                best_row = r
            # cv2.circle(img_result, (cx, cy), radius, (0, 0, 255), 2)

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

    clahe = cv2.createCLAHE(clipLimit=2.0,tileGridSize=(8,8))

    gray = clahe.apply(gray)

    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,15)

    kernel = np.ones((3,3), np.uint8)
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
        extent = area / float(w*h)

        # cv2.putText(part1_roi,f"{int(circularity)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1)

        if  100 <= area < 400 and 0.9 < aspect_ratio < 1.65 and peri > 60 and circularity > 0.35: 
            cx = x + w//2
            cy = y + h//2
            # cv2.putText(part1_roi,f"{int(peri)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1)
            bubbles.append((cx,cy,w,h))
    
    if not bubbles:
        raise ValueError(
        "Không nhận diện được bubble "
    )     

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

    pad = int(avg_w * 0.5)

    grid_x1 -= pad + 4
    grid_x2 += pad + 4

    grid_y1 -= pad - 4
    grid_y2 += pad - 4

    cv2.rectangle( debug,(grid_x1,grid_y1),(grid_x2,grid_y2),(255,0,0),2)

    # rows = 5
    # cols = 4

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

            cv2.circle(debug, (int(cx), int(cy)), 4, (0,0,255), -1)

        centers.append(row)

    answers = {}

    letters = ['A','B','C','D']

    MIN_FILL = 35

    for r in range(rows):

        best_fill = 0
        best_col = -1

        for c in range(cols):

            cx, cy = centers[r][c]

            radius = int(avg_w * 0.4)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx, cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            if filled > best_fill:
                best_fill = filled
                best_col = c

            cv2.circle(debug,(cx,cy),radius,(0,255,255),2)

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            # tô > 35%
            marked = ratio_fill > 0.4

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

def build_part2_grid(block_img , answer_key_2, cols=2, start_question = 1):

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

    pad = int(avg_w * 0.4)

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

    xs = sorted([cx for cx,cy in bubble_points])

    cols_x = []

    for x in sorted(xs):
        if len(cols_x) == 0:
            cols_x.append([x])
        elif abs(x - np.mean(cols_x[-1])) < 15:
            cols_x[-1].append(x)
        else:
            cols_x.append([x])

    cols_x = [int(np.mean(c)) for c in cols_x]

    # print("rows_y =", rows_y)

    for cx,cy,w,h in bubbles:
        cv2.circle(debug,(cx,cy),3,(0,0,255),-1)
        # print(cx,cy,w,h)
    cv2.rectangle(debug, (grid_x1,grid_y1), (grid_x2,grid_y2), (255,0,0),2)
    # cols = 4

    grid_w = grid_x2 - grid_x1
    cell_w = grid_w / cols

    result = []

    answers = {start_question: {}}

    choices = ['a', 'b', 'c', 'd']

    for r, cy in enumerate(rows_y):
        row_answer = []
        temp_data = []

        if r >= len(choices):
            continue

        question = start_question

        choice = choices[r]

        for c in range(cols):

            if c >= len(cols_x):
                continue

            cx = cols_x[c]

            radius = int(avg_w * 0.4)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx, cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            temp_data.append((cx, cy, radius, filled))

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            if str(question) not in answer_key_2:
                continue

            correct_value = answer_key_2[str(question)].get(choice, False)

            if c == 0 and correct_value:
                correct_points.append((cx, cy, radius))

            elif c == 1 and not correct_value:
                correct_points.append((cx, cy, radius))

            # tô > 35%
            marked = ratio_fill > 0.4

            row_answer.append(marked)

            if marked:
                color = (0,255,0)  
                if c == 0:
                    result = "Đ"
                    is_correct = answer_key_2[str(question)].get(choice, False)
                elif c == 1:
                    result = "S"
                    is_correct = not answer_key_2[str(question)].get(choice, False)

                selected_points.append((r,c,cx,cy,radius,is_correct))
            else:
                color = (0,255,255)     
            
            cv2.circle(debug,(cx,cy),radius,color,2)
            # cv2.putText(debug,f"{ratio_fill:.2f}",(cx-15, cy-10),cv2.FONT_HERSHEY_SIMPLEX,0.4,(255,0,0),1)

        answers[question][choice] = result
            
    return answers, debug, selected_points, correct_points

def build_part3_grid(block_img, answer_key_3, question_no, rows=11, cols=4):

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
    
    digit_column_count = min(cols, len(cols_x))
    answer_characters = [""] * digit_column_count

    avg_w = int(np.median([w for _,_,w,_ in bubbles]))
    radius = int(avg_w * 0.45)
    min_fill_ratio = 0.45
    fill_ratios = []

    # Đo lượng tô của toàn bộ lưới trước. Không ghi đáp án ngay khi một ô
    # vượt ngưỡng vì cách đó có thể chọn hai ô trong cùng một cột.
    for cy in rows_y:
        row_ratios = []

        for cx in cols_x[:digit_column_count]:
            mask = np.zeros(thresh.shape, dtype=np.uint8)
            cv2.circle(mask, (cx, cy), radius, 255, -1)

            bubble_region = cv2.bitwise_and(thresh, mask)
            filled = cv2.countNonZero(bubble_region)
            area_circle = np.pi * radius * radius
            row_ratios.append(filled / area_circle)

            cv2.circle(debug, (cx, cy), radius, (0, 255, 255), 2)

        fill_ratios.append(row_ratios)

    # Dấu trừ, dấu phẩy và các số 0-9 là 12 lựa chọn của cùng một cột.
    # Vì vậy mỗi cột chỉ được chọn đúng một ký tự trong toàn bộ các hàng.
    for c, cx in enumerate(cols_x[:digit_column_count]):
        column_candidates = [
            (fill_ratios[r][c], r)
            for r in range(len(fill_ratios))
        ]

        if not column_candidates:
            continue

        best_ratio, best_row = max(
            column_candidates,
            key=lambda candidate: candidate[0],
        )

        if best_ratio <= min_fill_ratio:
            continue

        if best_row == 0:
            answer_characters[c] = "-"
        elif best_row == 1:
            answer_characters[c] = ","
        else:
            answer_characters[c] = str(best_row - 2)

        selected_points.append(
            (best_row, c, cx, rows_y[best_row], radius)
        )

    for _, _, cx, cy, selected_radius in selected_points:
        cv2.circle(
            debug,
            (cx, cy),
            selected_radius,
            (0, 255, 0),
            2,
        )

    answer_str = "".join(answer_characters)

    # ==========================
    # Kiểm tra đáp án
    # ==========================

    correct_answer = answer_key_3.get(str(question_no))

    if isinstance(correct_answer, dict):
        correct_answer = correct_answer.get("answer")
    else:
        correct_answer = correct_answer

    print("đáp án trong hàm :", correct_answer)
    if correct_answer is None:
        print(f"Không có đáp án câu {question_no}")
        is_correct = False
    else:
        normalized_student_answer = answer_str.strip().replace(".", ",")
        normalized_correct_answer = str(correct_answer).strip().replace(".", ",")
        is_correct = normalized_student_answer == normalized_correct_answer

    if not is_correct:

        temp = str(correct_answer).strip().replace(".", ",")

        radius = int(avg_w*0.45)

        # Mỗi ký tự của đáp án đúng chiếm một cột, kể cả dấu trừ và dấu
        # phẩy. Cách cũ đặt dấu trừ và chữ số đầu cùng cột nên vẽ hai ô.
        for c, character in enumerate(temp):
            if c >= digit_column_count:
                break

            if character == "-":
                row = 0
            elif character == ",":
                row = 1
            elif character.isdigit():
                row = int(character) + 2
            else:
                continue

            if row >= len(rows_y):
                continue

            correct_points.append((cols_x[c],rows_y[row],radius))
            

    return answer_str, debug, selected_points, is_correct, correct_points

def crop_relative(img, roi):

    H, W = img.shape[:2]

    xr, yr, wr, hr = roi

    x = int(xr * W)
    y = int(yr * H)

    w = int(wr * W)
    h = int(hr * H)

    return img[y:y+h, x:x+w]

# img_original  = cv2.imread(r'C:\Users\Admin\Downloads\Project_1\backend\data\data3 7-2-2026\IMG_7876.png')

# folder = r"C:\Users\Admin\Downloads\Project_1\backend\data\data3 7-2-2026"
# image_files = []
# image_files.extend(glob.glob(os.path.join(folder, "*.png")))
# for file_path in image_files:
#     img_original = cv2.imread(file_path)
#     file_name = os.path.basename(file_path)
#     print("anh ", file_name)

def detect(image_path, answer_keys=None, debug_mode=False):
    global warp

    img_original = cv2.imread(image_path)

    if img_original is None:
        raise ValueError( f"Không đọc được ảnh: {image_path}")

    img = img_original.copy()   # xử lý
    img_debug   = img_original.copy()   # vẽ debug

    gray = cv2.cvtColor(img_original, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))

    gray = clahe.apply(gray)

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 15)
        
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    edged = cv2.Canny(thresh, 75, 200)

    # _, thresh = cv2.threshold(blurred, 150, 255, cv2.THRESH_BINARY_INV)
    # cv2.imshow('2. Canny Edges', edged)
    # cv2.namedWindow('Canny Edges', cv2.WINDOW_NORMAL)
    # cv2.resizeWindow('Canny Edges', 600, 800)
    # cv2.imshow('Canny Edges', edged)

    margin = 0
    img_markers = img.copy()
    markers = [] # Mảng chứa các điểm neo (Vuông)
    marker_centers_unique = [] # Mảng chứa tâm điểm neo đã được lọc trùng lặp (nếu có)
    bubbles = [] # Mảng chứa các ô đáp án (Tròn)
    timing_marks = []   # các hình chữ nhật bên phải mã đề
    id_boxes = []   # khung lớn SBD + Mã đề

    # CHỌN 4 GÓC CỦA TỜ GIẤY LÀM NEO
    # TL
    H, W = img.shape[:2]

    roi_w = int(W * 0.15)   # rộng 15% ảnh
    roi_h = int(H * 0.1)   # cao 10% ảnh

    margin = 0
    # TL
    cv2.rectangle(img, (margin, margin), (margin + roi_w, margin + roi_h), (0,255,0), 4)

    roi_tl = img[
        margin:margin+roi_h,
        margin:margin+roi_w
    ]
    # cv2.imshow("ROI TL", roi_tl)

    # TR
    cv2.rectangle(img, (W-roi_w-margin, margin), (W-margin, margin+roi_h), (0,255,0), 4)

    roi_tr = img[
        margin:margin+roi_h,
        W-roi_w-margin:W-margin
    ]
    # cv2.imshow("ROI TR", roi_tr)
    # BL
    cv2.rectangle( img, (margin, H-roi_h-margin), (margin+roi_w, H-margin), (0,255,0), 4)

    roi_bl = img[
        H-roi_h-margin:H-margin,
        margin:margin+roi_w
    ]
    # cv2.imshow("ROI BL", roi_bl)
    # BR
    cv2.rectangle(img, (W-roi_w-margin, H-roi_h-margin), (W-margin, H-margin), (0,255,0), 4)

    roi_br = img[
        H-roi_h-margin:H-margin,
        W-roi_w-margin:W-margin
    ]
    # cv2.imshow("ROI BR", roi_br)
    # cv2.imshow("ROI Corners", img)

    # ==========================================
    # PHÂN LUỒNG LOGIC: 4 ĐIỂM vs 3 ĐIỂM
    # ==========================================
    

    TL = find_marker_in_roi( roi_tl, margin, margin, "ROI TL DEBUG", debug_mode)

    TR = find_marker_in_roi( roi_tr, W - roi_w - margin, margin, "ROI TR DEBUG", debug_mode)

    BL = find_marker_in_roi( roi_bl, margin,H -  roi_h - margin, "ROI BL DEBUG", debug_mode)

    BR = find_marker_in_roi( roi_br, W - roi_w - margin, H - roi_h - margin, "ROI BR DEBUG", debug_mode)

    if any(point is None for point in [TL, TR, BL, BR]):
        raise ValueError("Không tìm đủ 4 marker")

    top = dist(TL, TR)
    bottom = dist(BL, BR)
    left = dist(TL, BL)
    right = dist(TR, BR)

    if not 0.75 <= top / bottom <= 1.25:
        raise ValueError("Hai cạnh ngang không cân đối")

    if not 0.75 <= left / right <= 1.25:
        raise ValueError("Hai cạnh dọc không cân đối")

    for p in [TL,TR,BL,BR]:
        if p is not None:
            cv2.circle( img_markers ,p, 20,(255,0,255), -1)

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

    # cv2.namedWindow('Corners', cv2.WINDOW_NORMAL)
    # cv2.resizeWindow('Corners', 600, 800)
    # cv2.imshow('Corners', img)

    # print(f"Tọa độ 4 góc: TL={TL}, TR={TR}, BL={BL}, BR={BR}")

    # 7. WARP ẢNH VỀ HỆ TỌA ĐỘ CHUẨN
    warp, M = warp_paper(img_original,TL,TR,BR,BL,out_w=1600,out_h=2000,expand=20,pad=20)
    warp_gray = cv2.cvtColor(warp, cv2.COLOR_BGR2GRAY)
    warp_blur = cv2.GaussianBlur(warp_gray, (5,5), 0)
    warp_thresh = cv2.adaptiveThreshold( warp_blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 10)
    cnts, _ = cv2.findContours( warp_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    # cv2.namedWindow('warp', cv2.WINDOW_NORMAL)
    # cv2.resizeWindow('warp', 600, 800)
    # cv2.imshow('warp', warp)
    cv2.imwrite("warp_result.png", warp)

    img_kq = warp.copy()

    # ==========================================
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ
    # ==========================================
    points = []

    # cv2.imshow("warp", img)
    W =1600
    H =2000
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (SBD)
    # x = 1165 , x2 = 1360 , y = 120 , 520
    x1_sbd = 1165 
    x2_sbd = 1360
    y1_sbd = 120
    y2_sbd = 520

    SBD = (x1_sbd / W, y1_sbd / H, (x2_sbd - x1_sbd) / W, (y2_sbd - y1_sbd) / H)

    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (MD)
    # x = 1400 , x2 = 1510 , y = 120 , 520
    x1_md = 1400 
    x2_md = 1510
    y1_md = 120
    y2_md = 520

    MD = (x1_md / W, y1_md / H, (x2_md - x1_md) / W, (y2_md - y1_md) / H)

    md = cat_roi(MD, 3)
    sbd = cat_roi(SBD, 6)


    # print('SÔ BÁO DANH : ', sbd)
    # print('MÃ ĐỀ : ',md)

    # with open("answers.json", "r", encoding="utf-8") as f:
    #     exams = json.load(f)

    # answer_key = exams.get(md)

    # if answer_key is None:
    #     print("Không tìm thấy mã đề:", md)

    # # print("DAP AN")
    # # print(exams)
    # if answer_key is None:
    #     raise ValueError(
    #         f"Không tìm thấy mã đề: {md}"
    #     )

    # md_answer_key =  exams[md]
    # answer_key_part1 = md_answer_key['mcq']
    # answer_key_2 = md_answer_key['tf']
    # answer_key_3 = md_answer_key['essay']

    # Một mã: chấm riêng. Nhiều mã: tự chọn theo mã đọc từ ảnh.
    md, md_answer_key = select_answer_key(answer_keys, md)

    answer_key_part1 = (md_answer_key.get("mcq",{}))

    # Phần 2: Đúng/Sai
    answer_key_2 = (
        md_answer_key.get("trueFalse",md_answer_key.get("tf",{})))

    # Phần 3: Trả lời ngắn
    answer_key_3 = ( md_answer_key.get("shortAnswer",md_answer_key.get("essay",{})))

    print("Đáp án phần 3 :", answer_key_3)

    correct_part1 = 0
    correct_part2 = 0
    correct_part3 = 0
    # print(answer_key_part1)

    # ==========================================
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (PART1)
    # ==========================================
    # x = 80 , x2 = 365 , y = 565 , 760
    # 650, 935 
    # 935, 1220
    # 1220, 1502
    y1_part1 = 590
    y2_part1 = 760

    PART1 = [
        (100/W,  y1_part1/H, (375-100)/W,  (y2_part1-y1_part1)/H),
        (400/W,  y1_part1/H, (650-400)/W,  (y2_part1-y1_part1)/H),
        (720/W,  y1_part1/H, (935-720)/W,  (y2_part1-y1_part1)/H),
        (980/W,  y1_part1/H, (1220-980)/W,  (y2_part1-y1_part1)/H),
        (1250/W,  y1_part1/H, (1502-1250)/W,  (y2_part1-y1_part1 - 40)/H)
    ]

    all_answers1 = {}

    for i, roi in enumerate(PART1):

        part_roi = crop_relative(warp, roi)

        rows = 4 if i == 4 else 5

        answers, debug_part1, selected_points_part1 = read_part1(part_roi, rows , 4,answer_key_part1,start_question=(i*5)+1)

        all_answers1.update(answers)

        xr, yr, wr, hr = roi

        x = int(xr * W)
        y = int(yr * H)
        w = int(wr * W)
        h = int(hr * H)

        # cv2.rectangle(warp, (x, y), (x+w, y+h), (0,255,0), 2)

        for item in selected_points_part1:
            (row, student_answer, cx, cy, radius, is_correct, correct_cx, correct_cy) = item

            if is_correct:
                correct_part1 += 1

            question_no = (i * 5) + row + 1

            question_no = (i*5) + row + 1

            wx = x + cx
            wy = y + cy

            color = (0,255,0) if is_correct else (0,0,255)

            # đáp án học sinh
            cv2.circle(warp,(wx,wy),radius+1,color,2)

            # nếu sai thì hiện luôn đáp án đúng
            if not is_correct:

                correct_wx = x + correct_cx
                correct_wy = y + correct_cy

                cv2.circle(warp,(correct_wx,correct_wy),radius+2,(0,255,0), 4)

            # cv2.putText(img_kq,f"{question_no}",(wx-15,wy-15),cv2.FONT_HERSHEY_SIMPLEX,0.5,color,2)

        # cv2.imshow(f"Part 1 {i+1}",debug)

    # ==========================================
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (PART2)
    # ==========================================
    # x = 310 , x2 = 440 , y = 850 , 1010
    # 510, 640 
    # 935, 1220
    # 1220, 1502
    y1_part2 = 850
    y2_part2 = 1010

    PART2 = [
        (310/W,  y1_part2/H, (440-310)/W,  (y2_part2-y1_part2)/H),
        (510/W,  y1_part2/H, (640-510)/W,  (y2_part2-y1_part2)/H),
        (710/W,  y1_part2/H, (840-710)/W,  (y2_part2-y1_part2)/H),
        (910/W,  y1_part2/H, (1040-910)/W,  (y2_part2-y1_part2)/H),
        (1110/W,  y1_part2/H, (1240-1110)/W,  (y2_part2-y1_part2)/H),
        (1310/W,  y1_part2/H, (1440-1310)/W,  (y2_part2-y1_part2)/H)
    ]

    all_answers2 = {}

    for i, roi in enumerate(PART2):

        start_question = i + 1

        part_roi_2 = crop_relative(warp, roi)

        answers_part2, debug_part2, selected_points_part2, correct_points_part2  = build_part2_grid(part_roi_2, answer_key_2 , start_question = start_question)

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

            cv2.circle(warp,(wx,wy),radius,color,3)

        # Vẽ đáp án đúng (nếu sai)
        for item in correct_points_part2:
            cx, cy, radius = item
            wx = x + cx
            wy = y + cy

            cv2.circle(warp,(wx,wy),radius+2,(0,255,0),4)

        if debug_mode:
            cv2.imshow(f"PART2_{i+1}",debug_part2)

    # ==========================================
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (PART2)
    # ==========================================
    # x = 80 , x2 = 260 , y =  1070 , 1485 , 1535 , 1940
    # 510, 640 
    # 935, 1220
    # 1220, 1502

    y1_part3_1= 1065
    y2_part3_1 = 1500

    y1_part3_2= 1525
    y2_part3_2 = 1965

    PART3 = [
        (100/W,  y1_part3_1/H, (260-100)/W,  (y2_part3_1-y1_part3_1)/H),
        (280/W,  y1_part3_1/H, (440-260)/W,  (y2_part3_1-y1_part3_1)/H),
        (460/W,  y1_part3_1/H, (620-460)/W,  (y2_part3_1-y1_part3_1)/H),
        (640/W,  y1_part3_1/H, (800-640)/W,  (y2_part3_1-y1_part3_1)/H),
        (800/W,  y1_part3_1/H, (980-800)/W,  (y2_part3_1-y1_part3_1)/H),
        (980/W,  y1_part3_1/H, (1160-980)/W,  (y2_part3_1-y1_part3_1)/H),
        (1160/W,  y1_part3_1/H, (1340-1160)/W,  (y2_part3_1-y1_part3_1)/H),
        (1350/W,  y1_part3_1/H, (1520-1350)/W,  (y2_part3_1-y1_part3_1)/H)
    ]

    PART3 += [
        (100/W,  y1_part3_2/H, (260-100)/W,  (y2_part3_2-y1_part3_2)/H),
        (280/W,  y1_part3_2/H, (440-260)/W,  (y2_part3_2-y1_part3_2)/H),
        (460/W,  y1_part3_2/H, (620-460)/W,  (y2_part3_2-y1_part3_2)/H),
        (640/W,  y1_part3_2/H, (800-640)/W,  (y2_part3_2-y1_part3_2)/H),
        (800/W,  y1_part3_2/H, (980-800)/W,  (y2_part3_2-y1_part3_2)/H),
        (980/W,  y1_part3_2/H, (1160-980)/W,  (y2_part3_2-y1_part3_2)/H),
        (1160/W,  y1_part3_2/H, (1340-1160)/W,  (y2_part3_2-y1_part3_2)/H),
        (1350/W,  y1_part3_2/H, (1520-1350)/W,  (y2_part3_2-y1_part3_2)/H)
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

                cv2.circle(warp,(wx,wy), radius+1,(0,255,0),3)

            # cv2.imshow(f"PART3_{i+1}",debug_part3)
            
        cv2.putText(warp,f"Q{question_no}: {answer_part3}",(x+ 60, y - 20),cv2.FONT_HERSHEY_SIMPLEX,0.6,color,2)

    # if debug_mode:
    #     cv2.namedWindow('warp', cv2.WINDOW_NORMAL)
    #     cv2.resizeWindow('warp', 800, 1000)
    #     cv2.imshow('warp', warp)
    #     cv2.waitKey(0)
    #     cv2.destroyAllWindows()
        

    print("\n====== ALL ĐÁP ÁN ========")
    print("SBD:", sbd)
    print("Mã đề:", md)
    print("Phần 1:", all_answers1)
    print("Phần 2:", all_answers2)
    print("Phần 3:", all_answers3)


    # =========================
    # TÍNH KẾT QUẢ
    # =========================

    correct_answers = ( correct_part1 + correct_part2 + correct_part3)

    total_part1 = len(answer_key_part1)

    total_part2 = sum(
        len(question_answers)
        for question_answers
        in answer_key_2.values()
    )

    total_part3 = len(answer_key_3)

    total_answers = (total_part1 + total_part2 + total_part3)

    incorrect_answers = max(total_answers - correct_answers, 0)

    score = 0

    if total_answers > 0:
        score = round(correct_answers / total_answers * 10, 2)


    # =========================
    # LƯU ẢNH KẾT QUẢ
    # =========================

    os.makedirs(RESULT_FOLDER, exist_ok=True)

    original_file_name = os.path.basename(image_path)

    file_name_without_extension = os.path.splitext(original_file_name)[0]

    result_image_name = (f"{file_name_without_extension}-result.jpg")

    result_image_path = os.path.join(RESULT_FOLDER,result_image_name)

    saved = cv2.imwrite(result_image_path,warp)

    if not saved:
        raise ValueError("Không lưu được ảnh kết quả")

    print("Đã lưu ảnh kết quả:",result_image_path)
    if not saved:
        raise ValueError("Không lưu được ảnh kết quả")

    # =========================
    # TRẢ KẾT QUẢ CHO MAIN.PY
    # =========================

    return {
        "stuCode": str(sbd),
        "examCode": str(md),

        "correctAnswers": int(correct_answers),

        "inCorrectAnswers": int(incorrect_answers),

        "score": float(score),

        "sectionResults": {
            "mcq": {
                "correct": int(correct_part1),
                "total": int(total_part1),
            },
            "trueFalse": {
                "correct": int(correct_part2),
                "total": int(total_part2),
            },
            "shortAnswer": {
                "correct": int(correct_part3),
                "total": int(total_part3),
            },
        },

        # Chỉ đổi tên kết quả cũ khi trả về frontend
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
            },
        },

        "resultImageName":
            result_image_name,
    }

if __name__ == "__main__":
    test_image_path = (
        r"C:\Users\Admin\Downloads"
        r"\Project_1\backend\data"
        r"\data3 7-2-2026\IMG_7876.png"
    )

    try:
        result = detect(test_image_path,debug_mode=True)

        print("\n====== KẾT QUẢ MODEL ======")

        print(json.dumps(result,ensure_ascii=False,indent=4))

    except Exception as error:
        print("Lỗi chạy model:",str(error))

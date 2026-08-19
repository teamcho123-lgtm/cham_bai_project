import sys
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

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Lui len mot cap: file nay nam trong detectors/ nhung anh ket qua
# phai ghi vao backend/results/ vi main.py chi phuc vu thu muc do.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RESULT_FOLDER = os.path.join( BASE_DIR, "results")


def find_marker_in_roi(roi, offset_x=0, offset_y=0, win_name="ROI DEBUG", debug_mode=False):

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    blur = cv2.GaussianBlur(gray, (5,5), 0)

    thresh = cv2.adaptiveThreshold( blur,255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41,11 )

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
        if area < 150 or area > 500:
            continue
        x,y,w,h = cv2.boundingRect(c)
        if h == 0:
            continue
        ratio = w / float(h)
        extent = area / float(w*h)
        circularity = 4 * math.pi * area / (peri*peri)
        roi = thresh[y:y+h, x:x+w]
        fill_ratio = cv2.countNonZero(roi) / float(w*h)

        # cx = x + w//2
        # cy = y + h//2
        # cv2.circle(debug,(cx,cy),5,(0,0,255),-1)
        # cv2.drawContours(debug,[c],-1,(0,255,0),2)
        
        # if 3 <= len(approx) <= 10 and 0.5 <= ratio <= 2 and extent > 0.75 and circularity < 0.85:
        # if 1 <= len(approx) <= 10 and 0.5 <= ratio <= 2 and extent > 0.7 and circularity < 0.85 and fill_ratio > 0.4:

        if 40 < area < 400 and 0 < ratio < 8 and 5 < h < 20 and 0.5 < extent < 1.0 :
            
            cx = x + w//2
            cy = y + h//2

            cv2.circle(debug,(cx,cy),5,(0,255,255),-1)
            cv2.drawContours(debug,[c],-1,(0,255,0),2)

            markers.append((cx+offset_x, cy+offset_y))

    selected = None

    # Không tìm thấy marker
    if len(markers) == 0:
        print(f"{win_name}: KHÔNG TÌM THẤY MARKER")
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

    return selected

def crop_relative(img, roi):

    H, W = img.shape[:2]

    xr, yr, wr, hr = roi

    x = int(xr * W)
    y = int(yr * H)

    w = int(wr * W)
    h = int(hr * H)

    return img[y:y+h, x:x+w]

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
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41,6)

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

        # cv2.putText(img_result,f"{int(area)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.3,(0,0,255),1)
        
        if  40 <= area < 550 and 0.4 < aspect_ratio < 1.6 and peri > 40:
            xs.append(x)
            ys.append(y)
            ws.append(w)
            hs.append(h)
            
            cx = x + w//2
            cy = y + h//2
            # cv2.putText(img_result,f"{int(peri)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1)
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

    pad = int(avg_w * 0.15)

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
            radius = int(avg_w * 0.3)

            mask = np.zeros(thresh.shape,np.uint8)
            cv2.circle(mask,(cx,cy),radius,255,-1)

            filled = cv2.countNonZero(cv2.bitwise_and(thresh,mask))
            area_circle = np.pi * radius * radius
            ratio_fill = filled / area_circle

            if filled > best_fill:
                best_fill = filled
                best_row = r
            cv2.circle(img_result, (cx, cy), radius, (255, 255, 0), 2)

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

        # cv2.putText(part1_roi,f"{int(peri)}",(x, y-3),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,255),1)

        if 100 < area < 650 and 0.6 < aspect_ratio < 1.65 and peri > 0:
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

    pad = int(avg_w * 0.5)

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

            cv2.circle(debug, (int(cx), int(cy)), 4, (0,0,255), -1)

        centers.append(row)

    answers = {}

    letters = ['A','B','C','D']

    MIN_FILL = 0

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

            # cv2.circle(debug,(cx,cy),radius,(0,255,255),2)

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            # tô > 35%
            marked = ratio_fill > 0.45

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

# img_original  = cv2.imread(r'C:\Users\Admin\Downloads\Project_1\backend\data\data4 1-8-2026\IMG_8108.JPEG')
#   IMG_8088.JPEG,   IMG_8092.JPEG ,  IMG_8095.JPEG , IMG_8097.JPEG , IMG_8097.JPEG

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

    margin = 0
    img_markers = img.copy()

    # CHỌN 4 GÓC CỦA TỜ GIẤY LÀM NEO
    # TL
    H, W = img.shape[:2]

    roi_w = int(W * 0.20)   # rộng 15% ảnh
    roi_h = int(H * 0.25)   # cao 10% ảnh

    margin = 0
    # TL
    cv2.rectangle(img, (margin, margin), (margin + roi_w, margin + roi_h), (0,255,0), 4)

    roi_tl = img[
        margin:margin+roi_h,
        margin:margin+roi_w
    ]

    # TR
    cv2.rectangle(img, (W-roi_w-margin, margin), (W-margin, margin+roi_h), (0,255,0), 4)

    roi_tr = img[
        margin:margin+roi_h,
        W-roi_w-margin:W-margin
    ]
    # BL
    cv2.rectangle( img, (margin, H-roi_h-margin), (margin+roi_w, H-margin), (0,255,0), 4)

    roi_bl = img[
        H-roi_h-margin:H-margin,
        margin:margin+roi_w
    ]
    # BR
    cv2.rectangle(img, (W-roi_w-margin, H-roi_h-margin), (W-margin, H-margin), (0,255,0), 4)

    roi_br = img[
        H-roi_h-margin:H-margin,
        W-roi_w-margin:W-margin
    ]

    # ==========================================
    # PHÂN LUỒNG LOGIC: 4 ĐIỂM vs 3 ĐIỂM
    # ==========================================

    TL = find_marker_in_roi( roi_tl, margin, margin, "ROI TL DEBUG", debug_mode)

    TR = find_marker_in_roi( roi_tr, W - roi_w - margin, margin, "ROI TR DEBUG", debug_mode)

    BL = find_marker_in_roi( roi_bl, margin,H -  roi_h - margin, "ROI BL DEBUG", debug_mode)

    BR = find_marker_in_roi( roi_br, W - roi_w - margin, H - roi_h - margin, "ROI BR DEBUG", debug_mode)

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

    # print(f"Tọa độ 4 góc: TL={TL}, TR={TR}, BL={BL}, BR={BR}")

    # 7. WARP ẢNH VỀ HỆ TỌA ĐỘ CHUẨN
    warp, M = warp_paper(img_original,TL,TR,BR,BL,out_w=1000,out_h=1400,expand=20,pad=20)
    warp_gray = cv2.cvtColor(warp, cv2.COLOR_BGR2GRAY)
    warp_blur = cv2.GaussianBlur(warp_gray, (5,5), 0)
    warp_thresh = cv2.adaptiveThreshold( warp_blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 10)
    cnts, _ = cv2.findContours( warp_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.imwrite("warp_result.png", warp)

    img_kq = warp.copy()

    # ==========================================
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ
    # ==========================================
    points = []
    W =1000
    H =1400
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (SBD)
    # x = 1165 , x2 = 1360 , y = 120 , 520
    x1_sbd = 710 
    x2_sbd = 850
    y1_sbd = 130
    y2_sbd = 450

    SBD = (x1_sbd / W, y1_sbd / H, (x2_sbd - x1_sbd) / W, (y2_sbd - y1_sbd) / H)

    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (MD)
    # x = 1400 , x2 = 1510 , y = 120 , 520
    x1_md = 860 
    x2_md = 960
    y1_md = 130
    y2_md = 450

    MD = (x1_md / W, y1_md / H, (x2_md - x1_md) / W, (y2_md - y1_md) / H)


    sbd = cat_roi(SBD, 6)
    md = cat_roi(MD, 3)

    # Một mã: chấm riêng. Nhiều mã: tự chọn theo mã đọc từ ảnh.
    md, md_answer_key = select_answer_key(answer_keys, md)

    answer_key_part1 = (md_answer_key.get("mcq",{}))

    correct_part1 = 0

    # ==========================================
    # Cắt ROI TỪNG PHẦN THEO TỌA ĐỘ (PART1)
    # ==========================================
    # x = 80 , x2 = 365 , y = 565 , 760
    # 650, 935 
    # 935, 1220
    # 1220, 1502
    y1_part1 = 460
    y2_part1 = 1325

    x1 = 65
    x2 = 920

    gap_x = 25
    gap_y = 10

    block_w = (x2 - x1 - 3*gap_x) / 4
    block_h = (y2_part1 - y1_part1 - 2*gap_y) / 3

    PART1 = [
        # ===== HÀNG 1 =====
        # ô 1
        (95/W, 460/H, (block_w - 30)/W, block_h/H),

        # ô 2
        ((95+block_w+gap_x)/W, 460/H, (block_w - 30)/W, block_h/H),

        # ô 3
        ((95+2*(block_w+gap_x))/W, 460/H, (block_w - 30)/W, block_h/H),

        # ô 4
        ((95+3*(block_w+gap_x))/W, 460/H, (block_w - 30)/W, block_h/H),
        # ===== HÀNG 2 =====
        # ô 5
        (95/W, (460+block_h+gap_y)/H, (block_w - 30)/W, block_h/H),

        # ô 6
        ((95+block_w+gap_x)/W, (460+block_h+gap_y)/H, (block_w - 30)/W, block_h/H),

        # ô 7
        ((95+2*(block_w+gap_x))/W, (460+block_h+gap_y)/H, (block_w - 30)/W, block_h/H),

        # ô 8
        ((95+3*(block_w+gap_x))/W, (460+block_h+gap_y)/H, (block_w - 30)/W, block_h/H),
        # ===== HÀNG 3 =====
        # ô 9
        (95/W, (460+2*(block_h+gap_y))/H, (block_w - 30)/W, block_h/H),

        # ô 10
        ((95+block_w+gap_x)/W, (460+2*(block_h+gap_y))/H, (block_w - 30)/W, block_h/H),

        # ô 11
        ((95+2*(block_w+gap_x))/W, (460+2*(block_h+gap_y))/H, (block_w - 30)/W, block_h/H),

        # ô 12
        ((95+3*(block_w+gap_x))/W, (460+2*(block_h+gap_y))/H, (block_w - 30)/W, block_h/H),
    ]

    all_answers1 = {}
    correct_part1 = 0

    for i, roi in enumerate(PART1):

        part_roi = crop_relative(warp, roi)

        rows = 10

        answers, debug, selected_points_part1 = read_part1(part_roi, rows , 4,answer_key_part1,start_question=(i*10)+1)

        all_answers1.update(answers)

        xr, yr, wr, hr = roi

        x = int(xr * W)
        y = int(yr * H)
        w = int(wr * W)
        h = int(hr * H)

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

                # cv2.putText(warp,f"{question_no}",(wx-15,wy-15),cv2.FONT_HERSHEY_SIMPLEX,0.5,color,2)

        cv2.rectangle(warp, (x, y), (x+w, y+h), (0,255,0), 2)

    # =========================
    # TÍNH KẾT QUẢ
    # =========================

    # Chỉ Phần I (mcq) được chấm trong file này,
    # nên điểm chỉ tính trên total_part1
    correct_answers = correct_part1

    total_part1 = len(answer_key_part1)

    total_answers = total_part1

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
                "correct": 0,
                "total": 0,
            },
            "shortAnswer": {
                "correct": 0,
                "total": 0,
            },
        },

        # Chỉ đổi tên kết quả cũ khi trả về frontend
        "answers": {
            "mcq": {
                str(question): answer
                for question, answer
                in all_answers1.items()
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

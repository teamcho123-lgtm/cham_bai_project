import math
import cv2
from app1 import img
import numpy as np


def build_part3_grid(block_img,rows=11, cols=4):
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
    
    result = []
    avg_w = int(np.median([w for _,_,w,_ in bubbles]))

    for r, cy in enumerate(rows_y):

        row_answer = []

        for c, cx in enumerate(cols_x):

            radius = int(avg_w * 0.45)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx, cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            marked = ratio_fill > 0.6

            row_answer.append(marked)

            color = ((0,255,0) if marked else(0,255,255))

            cv2.circle(debug,(cx,cy), radius,color,2)

        result.append(row_answer)

    return centers, debug

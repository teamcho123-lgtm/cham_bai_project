import math
import cv2
from app1 import img
import numpy as np


def build_part2_grid(block_img,cols=4):

    debug = block_img.copy()

    gray = cv2.cvtColor(block_img, cv2.COLOR_BGR2GRAY)

    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,10)

    kernel = np.ones((3,3), np.uint8)

    thresh = cv2.morphologyEx(thresh,cv2.MORPH_CLOSE,kernel)

    cnts, _ = cv2.findContours(thresh,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)

    bubbles = []

    centers = []

    H, W = img.shape[:2]

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

    lefts   = [cx-w//2 for cx,cy,w,h in bubbles]
    rights  = [cx+w//2 for cx,cy,w,h in bubbles]
    tops    = [cy-h//2 for cx,cy,w,h in bubbles]
    bottoms = [cy+h//2 for cx,cy,w,h in bubbles]

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

    # cv2.rectangle(debug, (grid_x1,grid_y1), (grid_x2,grid_y2), (255,0,0),2)

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

    print("rows_y =", rows_y)

    # for cx,cy,w,h in bubbles:
    #     cv2.circle(debug,(cx,cy),3,(0,0,255),-1)
    #     print(cx,cy,w,h)

    # cols = 4

    grid_w = grid_x2 - grid_x1
    cell_w = grid_w / cols

    result = []

    for r, cy in enumerate(rows_y):

        row_answer = []

        for c in range(cols):

            cx = int(grid_x1 + (c + 0.5) * cell_w)

            radius = int(avg_w * 0.45)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx, cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            # tô > 35%
            marked = ratio_fill > 0.6

            row_answer.append(marked)

            color = (0,255,0) if marked else (0,255,255)

            cv2.circle(debug,(cx,cy),radius,color,2)

            # cv2.putText(debug,f"{ratio_fill:.2f}",(cx-15, cy-10),cv2.FONT_HERSHEY_SIMPLEX,0.4,(255,0,0),1)

        result.append(row_answer)

    return centers, debug
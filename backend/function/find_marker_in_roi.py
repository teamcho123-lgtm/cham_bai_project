import cv2
import numpy as np
import math


def find_marker_in_roi(roi, offset_x=0, offset_y=0, win_name="ROI DEBUG"):

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    blur = cv2.GaussianBlur(gray, (5,5), 0)

    thresh = cv2.adaptiveThreshold( blur,255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31,15 )

    kernel = np.ones((5, 5), np.uint8) 
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    cnts, _ = cv2.findContours(closed.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

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

        if 4 <= len(approx) <= 9 and 0.9 <= ratio <= 2  and extent > 0.6 and circularity < 0.85 and fill_ratio > 0.4:
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
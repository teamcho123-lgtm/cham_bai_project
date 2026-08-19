import math
import cv2
import json
import os
import numpy as np
from function.clamp import clamp
from function.warp_paper import warp_paper
from function.read_bubbles import read_bubbles
from function.dist import dist
from function.find_marker_in_roi import find_marker_in_roi

def setup_marker_retangle(img):
    H, W = img.shape[:2]

    roi_size = int(min(W, H) * 0.2)  # 25% cạnh ngắn

    margin = 0
    img_markers = img.copy()
    markers = [] # Mảng chứa các điểm neo (Vuông)
    marker_centers_unique = [] # Mảng chứa tâm điểm neo đã được lọc trùng lặp (nếu có)
    bubbles = [] # Mảng chứa các ô đáp án (Tròn)
    timing_marks = []   # các hình chữ nhật bên phải mã đề
    id_boxes = []   # khung lớn SBD + Mã đề

    # CHỌN 4 GÓC CỦA TỜ GIẤY LÀM NEO

    # TL
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

    # ...

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


    cv2.namedWindow('Corners', cv2.WINDOW_NORMAL)
    cv2.resizeWindow('Corners', 600, 800)
    cv2.imshow('Corners', img)

    print(f"Tọa độ 4 góc: TL={TL}, TR={TR}, BL={BL}, BR={BR}")
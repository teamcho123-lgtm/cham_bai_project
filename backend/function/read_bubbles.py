import cv2
import numpy as np


def read_bubbles(roi_img, cols, timing_rows):
    rows = len(timing_rows)
    img_result = roi_img.copy()
    selected_points = []
    
    # 1. TIỀN XỬ LÝ (Đã lắp CLAHE trị bóng râm)
    gray = cv2.cvtColor(roi_img, cv2.COLOR_BGR2GRAY)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 15)
    
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
        
        if 20 < area < 400 and 0.9 < aspect_ratio < 1.3:
            xs.append(x)
            ys.append(y)
            ws.append(w)
            hs.append(h)
            
            cx = x + w//2
            cy = y + h//2

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
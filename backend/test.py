# marker_centers=sorted( marker_centers, key=lambda p:p[1])

# top=sorted( marker_centers[:2], key=lambda p:p[0])

# bottom=sorted( marker_centers[-2:], key=lambda p:p[0])

# TL=top[0]
# TR=top[1]

# BL=bottom[0]
# BR=bottom[1]

# print("TL =",TL)
# print("TR =",TR)
# print("BL =",BL)
# print("BR =",BR)

import os
import cv2
import numpy as np
import time

url = "http://192.168.1.2:4747/video"

print(f"Đang kết nối với {url} ... (Vui lòng đợi)")

cap = cv2.VideoCapture(url)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) # TẮT BUFFER: Luôn lấy frame mới nhất

if not cap.isOpened():
    print("❌ LỖI CHÍ MẠNG: Không thể mở luồng camera!")
    print("-> Hãy kiểm tra lại: 1. Điện thoại và Máy tính đã chung mạng Wifi chưa? 2. Nhập đúng IP chưa?")
    exit()

print("✅ Đã kết nối thành công!")
print("🎯 SPACE = Chụp  |  Q = Thoát")

os.makedirs("data", exist_ok=True)
img_count = 1

while True:
    ret, frame = cap.read()

    if not ret:
        print("⚠️ Mạng giật, mất khung hình... đang thử lại!")
        time.sleep(0.1)
        continue

    # ========================================================
    # 1. TẠO BẢN SAO PREVIEW (Dùng để vẽ khung ngắm)
    # ========================================================
    preview_frame = frame.copy()
    
    # Lấy kích thước khung hình camera hiện tại
    H, W = preview_frame.shape[:2]
    
    # 🌟 ĐÃ TÙY CHỈNH: Đẩy sát ra lề và làm ô vuông to hơn
    margin_x = int(W * 0.02) # Cách lề trái/phải chỉ còn 2% (sát ra viền)
    margin_y = int(H * 0.02) # Cách lề trên/dưới chỉ còn 2% (sát ra viền)
    box_size = int(min(W, H) * 0.15) # Tăng kích thước ô vuông lên 15% (To gấp 2.5 lần cũ)

    color = (0, 255, 0) # Xanh lá
    thickness = 3 # Cho viền ô vuông dày lên một chút nhìn cho rõ

    # Vẽ 4 ô vuông ở 4 góc
    # TL (Top-Left)
    cv2.rectangle(preview_frame, (margin_x, margin_y), (margin_x + box_size, margin_y + box_size), color, thickness)
    # TR (Top-Right)
    cv2.rectangle(preview_frame, (W - margin_x - box_size, margin_y), (W - margin_x, margin_y + box_size), color, thickness)
    # BL (Bottom-Left)
    cv2.rectangle(preview_frame, (margin_x, H - margin_y - box_size), (margin_x + box_size, H - margin_y), color, thickness)
    # BR (Bottom-Right)
    cv2.rectangle(preview_frame, (W - margin_x - box_size, H - margin_y - box_size), (W - margin_x, H - margin_y), color, thickness)

    # (Tùy chọn) Vẽ một viền mỏng nối 4 ô lại với nhau
    cv2.rectangle(preview_frame, 
                  (margin_x + box_size//2, margin_y + box_size//2), 
                  (W - margin_x - box_size//2, H - margin_y - box_size//2), 
                  (0, 255, 0), 1)

    # CHIẾU BẢN PREVIEW ĐÃ VẼ KHUNG LÊN MÀN HÌNH
    cv2.imshow("Live Camera", preview_frame)
    # ========================================================

    key = cv2.waitKey(1) & 0xFF

    if key == 32:  # BẤM SPACE
        
        # 2. LƯU BẢN GỐC SẠCH (frame), KHÔNG LƯU BẢN ĐÃ VẼ (preview_frame)
        img = frame.copy() 
        
        if img_count >= 20:
            img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)

        filename = f"data/ptn{img_count}.png"
        cv2.imwrite(filename, img)
        print(f"[OK] Đã lưu: {filename}")

        # Hiển thị hiệu ứng chớp nháy bằng ảnh Canny
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edged = cv2.Canny(gray, 75, 200)
        cv2.imshow("Captured (Canny)", edged)

        img_count += 1

    elif key == ord('q'):
        print("Đang thoát chương trình...")
        break

cap.release()
cv2.destroyAllWindows()



# # ==========================================
# # CHUYỂN ĐỔI VÀ CHẤM ĐIỂM BẰNG MẢNG (PHẦN 1)
# # ==========================================

# # 1. Chuyển Dictionary `all_answers` thành một mảng List 12 phần tử (Phần 1 có 12 câu)
# # Dùng .get(i, "?") để nếu câu nào máy không quét được, nó sẽ tự điền dấu "?"
# scanned_array = [all_answers.get(i, "?") for i in range(1, 13)]

# # 2. Khai báo mảng đáp án chuẩn (Mã đề 0115)
# true_array = [
#     'D', 'B', 'B', 'B', 'C', 'D', 'B', 'D', 'A', 'A', # Câu 1-10
#     'C', 'A'                                          # Câu 11-12
# ]

# # ĐÁP ÁN PHẦN 2 (Đúng/Sai)
# dung_sai1 = ['D', 'D', 'S', 'S']
# dung_sai2 = ['D', 'S', 'D', 'D']
# dung_sai3 = ['D', 'D', 'S', 'S']
# dung_sai4 = ['D', 'D', 'D', 'S']

# # ĐÁP ÁN PHẦN 3 (Trả lời ngắn)
# # Lưu ý: Tôi để dạng chuỗi (String) vì có chứa dấu phẩy, 
# # tùy thuộc vào thuật toán quét số của bạn mà có thể đổi thành Float (5.91)
# dap_an_tl_1 = "5.91" 
# dap_an_tl_2 = "1275"
# dap_an_tl_3 = "1152"
# dap_an_tl_4 = "1856"
# dap_an_tl_5 = "7.35"
# dap_an_tl_6 = "1990"

# correct_count = 0

# print("\n" + "="*35)
# print("       KẾT QUẢ CHẤM ĐIỂM P1     ")
# print("="*35)

# # 3. So sánh 2 mảng theo từng Index (từ 0 đến 11)
# for i in range(12):
#     q = i + 1               # Số thứ tự câu (1 đến 12)
#     u_ans = scanned_array[i] # Đáp án thí sinh
#     t_ans = true_array[i]    # Đáp án chuẩn
    
#     if u_ans == t_ans:
#         correct_count += 1
#         print(f"Câu {q:02d}: {u_ans} - {t_ans} -> [ĐÚNG]")
#     else:
#         print(f"Câu {q:02d}: {u_ans} - {t_ans} -> [SAI]")

# print("-" * 35)
# print(f"=> TỔNG SỐ CÂU ĐÚNG: {correct_count}/12")
# print(f"=> ĐIỂM SỐ QUY ĐỔI : {correct_count * 0.25:.2f} ĐIỂM")
# print("=" * 35 + "\n")
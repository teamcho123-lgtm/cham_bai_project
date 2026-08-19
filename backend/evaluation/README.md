# Đánh giá thuật toán OMR

Bộ công cụ này tạo một tập đánh giá từ `backend/results` mà không sao chép thêm ảnh. Mỗi tên ảnh nguồn chỉ được chọn một lần, dù ảnh đó đã được chạy lại nhiều lần. Cột `run_origin` phân biệt ảnh sinh qua API (`api`) với ảnh sinh khi chạy detector trực tiếp (`direct`). Những ảnh không ánh xạ được tới một trong các template 000–004 sẽ không được đưa vào mẫu.

## 1. Tạo tập 100 ảnh

Chạy tại thư mục gốc của dự án:

```powershell
python backend/tools/prepare_evaluation.py --sample-size 100 --seed 2026
```

Kết quả:

- `manifest.csv`: danh sách ảnh được chọn và các cột ground truth.
- `review.html`: giao diện xem ảnh gốc và ảnh kết quả.

Script cố gắng chia đều ảnh giữa các template tìm thấy. `template_hint` được suy ra từ thư mục dữ liệu như `data1`, `data2`, ..., vì vậy người review vẫn phải xác nhận lại nếu ảnh nằm sai thư mục.

## 2. Review thủ công

Mở `review.html` bằng trình duyệt, sau đó với từng ảnh:

1. Đọc SBD và mã đề trực tiếp từ phiếu gốc rồi nhập vào cột `expected`.
2. Nhập giá trị hệ thống nhận diện vào cột `predicted`.
3. Đếm số câu nhận diện đúng của từng phần.
4. Phân loại điều kiện ảnh: bình thường, nghiêng, tối, mờ, nhăn hoặc bị cắt.
5. Đánh dấu `Toàn phiếu chính xác` chỉ khi toàn bộ thông tin trên phiếu đúng.
6. Bấm **Lưu và đánh dấu đã review**.

Tiến độ được lưu trong `localStorage` của trình duyệt. Khi hoàn thành, bấm **Xuất reviewed_manifest.csv** và đặt file vào thư mục `backend/evaluation`.

Không lấy màu xanh/đỏ trên ảnh kết quả làm ground truth. Ground truth phải được đọc độc lập từ phiếu gốc hoặc từ dữ liệu đã được kiểm tra thủ công.

## 3. Sinh báo cáo

```powershell
python backend/tools/summarize_evaluation.py --input backend/evaluation/reviewed_manifest.csv
```

Kết quả:

- `summary.md`: bảng số liệu đưa vào báo cáo khóa luận.
- `summary.json`: dữ liệu để vẽ biểu đồ hoặc sử dụng ở frontend.

## Giới hạn của dữ liệu hiện tại

`backend/results` chỉ chứa các lần đã sinh được ảnh kết quả. Các ảnh chấm thất bại bị bắt lỗi trong API nhưng không được lưu ở đây. Vì vậy tập này đo độ chính xác trực quan và nội dung nhận diện trên các output hiện có; nó không thể tự chứng minh tỷ lệ thành công trên toàn bộ ảnh đã upload.

Muốn đo tỷ lệ thành công thật, backend cần lưu một bản ghi cho mọi lần xử lý, bao gồm `success`, lỗi, template, thời gian và kết quả dự đoán.

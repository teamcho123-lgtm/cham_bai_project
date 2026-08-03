# Hệ thống chấm bài trắc nghiệm tự động

Ứng dụng web giúp giáo viên chấm phiếu trả lời trắc nghiệm bằng ảnh chụp.
Giáo viên tạo lớp, nhập đáp án theo mã đề, tải ảnh bài làm lên, hệ thống
nhận diện và trả về điểm kèm ảnh đã chú thích đáp án đúng/sai.

Phần nhận diện được viết bằng OpenCV thuần: tìm 4 marker góc, nắn phối cảnh
tờ giấy, dựng lưới ô tròn rồi đọc mức độ tô của từng ô.

---

## Kiến trúc

Dự án gồm **3 tiến trình chạy song song**, phải bật đủ cả ba:

| Thành phần | Thư mục | Cổng | Vai trò |
|---|---|---|---|
| Frontend | `frontend/` | **3000** | Giao diện Next.js |
| API dữ liệu | `fake-backend-crud/` | **8000** | json-server: lớp, đề thi, đáp án |
| API chấm bài | `backend/` | **8001** | FastAPI + OpenCV |

Luồng chấm bài:

```
Trình duyệt  ──ảnh + templateId + đáp án──▶  FastAPI :8001  /cham_bai
                                                   │
                                          chọn detector theo templateId
                                                   │
                                    app.py / app1.py ... app4.py
                                                   │
                                     ◀── điểm + ảnh kết quả ───
```

---

## Yêu cầu môi trường

| Phần mềm | Phiên bản đã kiểm chứng |
|---|---|
| Python | **3.14.6** (3.10 trở lên là chạy được) |
| Node.js | **24.16.0** (18 trở lên là chạy được) |
| npm | 11.13.0 |

---

## Cách nhanh nhất (Windows)

Chỉ cần **2 lệnh**, nhấp đúp chuột cũng được:

```
setup.bat     ← cài toàn bộ thư viện, chạy 1 lần duy nhất
start.bat     ← bật cả 3 tiến trình, mở 3 cửa sổ
```

Sau đó mở http://localhost:3000

`setup.bat` sẽ tự kiểm tra Node.js và Python, báo lỗi rõ ràng kèm link tải nếu
thiếu. Lần cài đầu mất khoảng 3–5 phút, chủ yếu là tải thư viện frontend.

Đóng cửa sổ nào là tắt tiến trình đó.

> Trên macOS / Linux, hoặc muốn hiểu rõ từng bước, làm thủ công theo phần dưới.

---

## Cài đặt thủ công

Sau khi `git clone` về, chạy lần lượt:

### 1. API dữ liệu (json-server)

```bash
cd fake-backend-crud
npm install
```

### 2. Frontend

```bash
cd frontend
npm install
```

### 3. Backend chấm bài (Python)

```bash
cd backend
python -m venv .venv
```

Kích hoạt môi trường ảo:

```bash
# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Windows (Git Bash)
source .venv/Scripts/activate

# macOS / Linux
source .venv/bin/activate
```

Cài thư viện:

```bash
pip install -r requirements.txt
```

---

## Chạy dự án

Mở **3 cửa sổ terminal riêng biệt**, mỗi cửa sổ chạy một lệnh:

**Terminal 1 — API dữ liệu (cổng 8000)**

```bash
cd fake-backend-crud
npm start
```

**Terminal 2 — API chấm bài (cổng 8001)**

```bash
cd backend
uvicorn main:app --reload --port 8001
```

> Nhớ kích hoạt môi trường ảo trước. Bắt buộc dùng đúng cổng `8001`
> vì frontend đang gọi cứng địa chỉ này.

**Terminal 3 — Frontend (cổng 3000)**

```bash
cd frontend
npm run dev
```

Mở trình duyệt tại **http://localhost:3000**

---

## Thứ tự sử dụng

1. Vào **Danh sách lớp** → tạo lớp học, thêm học sinh kèm số báo danh
2. Trong lớp → tạo đợt thi, chọn mẫu phiếu (`templateId`)
3. Nhập đáp án cho từng mã đề
4. Vào chi tiết mã đề → tải ảnh bài làm lên → bấm **Chấm bài**
5. Xem điểm trong bảng, bấm ảnh để đối chiếu, hoặc **Xuất Excel**

Link vào thẳng trang chấm để thử nhanh:

```
http://localhost:3000/class/exam-001/exams/1234
```

---

## Mẫu phiếu và bộ nhận diện

Mỗi `templateId` dùng một file nhận diện riêng, khai báo trong
`backend/main.py`:

| templateId | File xử lý | Phần chấm | Ảnh mẫu để thử |
|---|---|---|---|
| `template-000` | `app.py` | I + II + III | *(chưa có)* |
| `template-001` | `app1.py` | I + II + III | `data1 31-7-2026/` |
| `template-002` | `app2.py` | I + II + III | `data3 7-2-2026/` |
| `template-003` | `app3.py` | Chỉ Phần I | `data4/` |
| `template-004` | `app4.py` | I + II + III | `data4 3-8-2026/` |

Muốn thêm mẫu phiếu mới: tạo file `appN.py` có hàm
`detect(image_path, answer_keys)` trả về dict theo đúng cấu trúc của các
file hiện có, rồi thêm một dòng vào `TEMPLATE_DETECTOR_MAP`.

---

## Ảnh mẫu để chạy thử

Thư mục `backend/data/` có sẵn ảnh phiếu đã chụp, dùng để thử ngay mà không
cần in phiếu.

**Lưu ý: tên thư mục không tương ứng với số hiệu bộ nhận diện.** Bảng dưới
đây là kết quả chạy thử thực tế, không phải suy đoán theo tên:

| Thư mục ảnh | Dùng được với | Mẫu phiếu | Số ảnh |
|---|---|---|---|
| `data1 31-7-2026/` | **`app1`** | `template-001` | 106 |
| `data1/`, `data1 31.5-7-2026/` | `app1` | `template-001` | 9, 10 |
| `data3 7-2-2026/` | **`app2`** | `template-002` | 42 |
| `data3/` | `app2` | `template-002` | 7 |
| `data4/` | `app3` | `template-003` | 12 |
| `data4 3-8-2026/` | **`app4`** | `template-004` | 70 |
| `data4 7-3-2026/`, `data5/` | `app4` | `template-004` | 24, 4 |

Ba tổ hợp in đậm đã được kiểm chứng kỹ nhất và nên dùng khi demo. Riêng
`data1 31-7-2026` đạt tỉ lệ nhận diện **96/106 ảnh**.

Các thư mục **chưa dùng được với bộ nhận diện nào**, tránh dùng để thử:
`data2/`, `data2 2-8-2026/`, `data2 7-2-2026/`, `data4 1-8-2026/`,
`data4 7-18-2026/`. Toàn bộ đều báo không tìm thấy marker góc.

Mẫu `template-000` (`app.py`) hiện **không có bộ ảnh mẫu nào chạy được**.

Ảnh phải chụp **trọn tờ giấy, thấy rõ 4 marker vuông ở 4 góc**, đặt trên mặt
phẳng, tránh bóng tay che. Bộ tham số hiện tại được tinh chỉnh cho ảnh cỡ
**1536×2048**.

---

## Cấu trúc thư mục

```
Project_1/
├── backend/                  API chấm bài (FastAPI + OpenCV)
│   ├── main.py               Điểm vào API, định tuyến templateId
│   ├── app.py, app1..app4.py Bộ nhận diện cho từng mẫu phiếu
│   ├── function/             Hàm dùng chung (warp, marker, lưới ô)
│   ├── data/                 Ảnh phiếu mẫu
│   ├── uploads/              Ảnh chấm thành công (tự tạo)
│   ├── results/              Ảnh đã chú thích (tự tạo)
│   ├── temp/                 Ảnh đang xử lý (tự tạo)
│   └── requirements.txt
│
├── fake-backend-crud/        json-server
│   ├── db.json               Toàn bộ dữ liệu: lớp, đề, đáp án
│   └── server.js
│
└── frontend/                 Next.js 16 + React 19 + antd + Tailwind
    └── src/app/
        ├── class/            Trang lớp học và đợt thi
        ├── components/       Bảng, form, upload ảnh
        └── action/           Server Action gọi json-server
```

Ba thư mục `uploads/`, `results/`, `temp/` **không nằm trong git** và sẽ được
code tự tạo khi chạy lần đầu.

---

## Lỗi thường gặp

**Trang trắng hoặc lỗi khi mở danh sách lớp**
Chưa bật json-server. Kiểm tra http://localhost:8000/classes có trả JSON không.

**Bấm "Chấm bài" báo "Không thể kết nối"**
Chưa bật FastAPI, hoặc chạy sai cổng. Kiểm tra http://127.0.0.1:8001/ phải
trả về `{"msg":"Backend OK"}`.

**Lỗi CORS trên trình duyệt**
`backend/main.py` chỉ cho phép `localhost:3000` và `127.0.0.1:3000`. Nếu
Next.js nhảy sang cổng khác (do 3000 đã bị chiếm), thêm cổng đó vào
`allow_origins`.

**Chấm bài báo "Không có đáp án mã đề XXXX"**
Mã đề đọc từ phiếu chưa được nhập đáp án. Vào trang mã đề nhập đáp án cho
đúng mã đó, hoặc kiểm tra học sinh có tô nhầm ô mã đề không.

**Chấm bài báo lỗi liên quan `NoneType`**
Không tìm đủ 4 marker góc. Chụp lại sao cho thấy trọn tờ giấy, đủ 4 ô vuông
đen ở 4 góc, ảnh không bị mờ.

**Lỗi UnicodeEncodeError khi chạy uvicorn trên Windows**
Console dùng bảng mã cp1252 không in được tiếng Việt có dấu. Đặt biến môi
trường trước khi chạy:

```bash
set PYTHONIOENCODING=utf-8        # CMD
$env:PYTHONIOENCODING="utf-8"     # PowerShell
```

---

## Hạn chế hiện tại

Cần biết trước khi dùng cho việc thật:

- **Kết quả chấm chưa được lưu xuống cơ sở dữ liệu.** Điểm chỉ tồn tại trên
  giao diện; tải lại trang là mất. Hãy bấm **Xuất Excel** trước khi rời trang.
- **Phần III (trả lời ngắn) đọc chưa chính xác.** Khi hàng dấu trừ không được
  nhận diện, toàn bộ chữ số bị lệch một hàng và cho kết quả sai. Nên đối chiếu
  lại ảnh kết quả cho phần này.
- **Chưa có đăng nhập, chưa phân quyền.** Mọi API đều mở.
- **Không phát hiện tô hai đáp án.** Ô nào đậm hơn sẽ được chọn.
- **Chạy nhiều người cùng lúc có thể lẫn kết quả** do các bộ nhận diện dùng
  biến toàn cục `warp`.
- **Địa chỉ API đang gán cứng** `localhost:8000` và `127.0.0.1:8001` trong mã
  nguồn, chưa đưa ra biến môi trường.
- **`backend/best.pt`** là mô hình còn sót lại từ hướng tiếp cận cũ, hiện
  không file nào dùng tới.
- **`results/` không tự dọn**, chấm càng nhiều thì càng chiếm ổ đĩa.

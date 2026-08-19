# Hệ thống chấm phiếu trả lời trắc nghiệm bằng OMR

Ứng dụng hỗ trợ giáo viên tổ chức kỳ thi, quản lý lớp/phòng thi, nhập đáp án theo mã đề và chấm phiếu trả lời từ ảnh. Hệ thống dùng OpenCV để tìm bốn marker góc, hiệu chỉnh phối cảnh, đọc các ô tô và trả về điểm kèm ảnh đối chiếu.

> **Trạng thái:** prototype phục vụ khóa luận và demo học thuật. Luồng nghiệp vụ chính đã hoạt động, nhưng dự án **chưa sẵn sàng cho production** vì còn thiếu xác thực người dùng, lưu kết quả chấm bền vững, cấu hình triển khai và số liệu đánh giá thuật toán đã gán nhãn.

## Chức năng hiện có

- Quản lý lớp học và danh sách học sinh; hỗ trợ nhập thủ công hoặc từ Excel.
- Quản lý kỳ thi toàn trường, phòng thi, ca thi và thí sinh trong phòng.
- Tạo bài thi, chọn một trong năm mẫu phiếu OMR và quản lý nhiều mã đề.
- Nhập đáp án ba phần: trắc nghiệm, đúng/sai và trả lời ngắn; hỗ trợ nhập Excel.
- Chấm một ảnh, chấm lại một ảnh hoặc chấm nhiều ảnh trong một lần gửi.
- Chấm riêng từng mã đề hoặc gửi toàn bộ đáp án để hệ thống nhận diện mã đề và chọn đáp án tương ứng.
- Cấu hình điểm cho từng phần và quy tắc trừ điểm riêng cho phần đúng/sai.
- Hiển thị SBD, mã đề, số câu đúng/sai, điểm và ảnh kết quả đã đánh dấu.
- Xuất kết quả đang hiển thị ra Excel.
- Nhận ảnh từ camera iPhone qua mã QR; tự kiểm tra marker, độ nét, độ sáng và độ ổn định trước khi chụp liên tục.
- Có bộ công cụ tạo manifest, review ảnh và tổng hợp chỉ số đánh giá OMR.

## Kiến trúc

Dự án có ba dịch vụ chính và một tunnel HTTPS tùy chọn cho camera điện thoại:

| Thành phần | Thư mục | Cổng | Vai trò |
|---|---|---:|---|
| Frontend | `frontend/` | 3000 | Next.js, React, Ant Design và Tailwind CSS |
| API dữ liệu demo | `fake-backend-crud/` | 8000 | JSON Server lưu lớp, kỳ thi, phòng thi, đề và đáp án |
| API OMR | `backend/` | 8001 | FastAPI, OpenCV, xử lý ảnh và chấm điểm |
| Camera tunnel | `start-camera-tunnel.ps1` | HTTPS công khai | Chuyển tiếp URL `trycloudflare.com` về frontend cục bộ |

Luồng chấm bài:

```text
Ảnh bài làm + templateId + answerKeys + gradingConfig
                         │
                         ▼
                 FastAPI POST /cham_bai
                         │
              chọn detector theo templateId
                         │
          tìm marker → warp → đọc ô tô → tính điểm
                         │
                         ▼
          JSON kết quả + URL ảnh đã chú thích
```

Luồng camera iPhone:

```text
Máy tính tạo capture session → hiển thị QR HTTPS
                                     │
                                     ▼
iPhone mở trang camera → dò 4 marker → kiểm tra nét/sáng/ổn định
                                     │
                                     ▼
                      tự chụp và upload ảnh gốc
                                     │
                                     ▼
                   máy tính nhận ảnh vào danh sách chấm
```

## Công nghệ

- **Frontend:** Next.js 16.2.10, React 19.2.4, TypeScript, Ant Design 6, Tailwind CSS 4, XLSX.
- **API OMR:** Python, FastAPI, OpenCV, NumPy, Pillow.
- **Dữ liệu demo:** JSON Server 0.17.4 và `db.json`.
- **Camera:** MediaDevices API, QR code, Cloudflare Quick Tunnel.
- **Kiểm thử:** pytest; bộ review ảnh nằm trong `backend/evaluation/`.

Môi trường đã dùng trong lần audit gần nhất: Node.js 24.16.0, npm 11.13.0 và Python 3.14.6 trên Windows.

## Cài đặt nhanh trên Windows

Từ thư mục gốc của dự án:

```powershell
.\setup.bat
.\start.bat
```

`setup.bat` cài thư viện cho hai dự án Node.js và tạo môi trường Python tại `backend/.venv`. `start.bat` mở bốn cửa sổ: API dữ liệu, API OMR, frontend và Cloudflare Quick Tunnel.

Sau khi các dịch vụ khởi động, mở [http://localhost:3000](http://localhost:3000).

> Quick Tunnel tạo địa chỉ ngẫu nhiên và chỉ tồn tại trong phiên chạy. Khi tunnel khởi động lại, hãy tạo lại QR vì URL cũ có thể báo `DNS_PROBE_FINISHED_NXDOMAIN`.

## Cài đặt và chạy thủ công

### 1. API dữ liệu demo

```powershell
cd fake-backend-crud
npm install
npm start
```

Kiểm tra tại [http://localhost:8000/classes](http://localhost:8000/classes).

### 2. Backend OMR

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Kiểm tra tại [http://127.0.0.1:8001](http://127.0.0.1:8001).

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend hiện phụ thuộc vào đúng cổng 8000 và 8001 do một số URL API còn được khai báo trực tiếp trong mã nguồn.

### 4. Camera iPhone qua HTTPS

Camera trực tiếp trên iPhone cần secure context. Khi không dùng `start.bat`, chạy thêm ở thư mục gốc:

```powershell
.\start-camera-tunnel.ps1
```

Đợi terminal in URL `https://...trycloudflare.com`, sau đó tạo lại phiên camera/QR trên trang chấm. Điện thoại và máy tính không bắt buộc cùng mạng vì URL đi qua Cloudflare, nhưng cả hai phải có kết nối Internet.

Phiên camera được gia hạn tự động trong khi máy tính hoặc điện thoại vẫn truy cập. Chỉ phiên không hoạt động quá 24 giờ mới được dọn; nếu backend đã mất phiên, trang chấm sẽ tự bỏ QR cũ và tạo phiên mới khi mở lại camera.

## Quy trình sử dụng

### Bài kiểm tra theo lớp

1. Vào **Tạo bài chấm** và tạo lớp.
2. Thêm học sinh thủ công hoặc nhập danh sách Excel.
3. Tạo đề thi, chọn mẫu phiếu và nhập các mã đề.
4. Nhập đáp án thủ công hoặc từ Excel.
5. Mở trang chấm, thêm ảnh từ máy tính hoặc camera điện thoại.
6. Chấm toàn bộ ảnh hoặc chấm lại từng ảnh, kiểm tra overlay rồi xuất Excel.

### Kỳ thi toàn trường

1. Vào **Kỳ thi** và tạo kỳ thi theo năm học, học kỳ, khối và thời gian.
2. Tạo phòng/ca thi, chọn môn, mẫu phiếu và thêm thí sinh.
3. Tạo mã đề và đáp án cho đề thi của phòng.
4. Chấm từng mã đề hoặc chọn chế độ chấm tất cả mã đề.

## Mẫu phiếu và detector

Ánh xạ được khai báo trong `backend/main.py`:

| `templateId` | Detector |
|---|---|
| `template-000` | `backend/detectors/app.py` |
| `template-001` | `backend/detectors/app1.py` |
| `template-002` | `backend/detectors/app2.py` |
| `template-003` | `backend/detectors/app3.py` |
| `template-004` | `backend/detectors/app4.py` |

Mỗi detector được căn chỉnh theo một bố cục phiếu cụ thể. Ảnh đầu vào nên:

- thấy trọn tờ giấy và đủ bốn marker góc;
- không bị rung, lóa hoặc bóng tay che;
- có độ tương phản tốt;
- ưu tiên tỉ lệ dọc 3:4, gần kích thước 1536 × 2048.

Khi thêm mẫu mới, detector phải cung cấp hàm `detect(image_path, answer_keys=None, debug_mode=False)` với cấu trúc kết quả tương thích, sau đó đăng ký vào `TEMPLATE_DETECTOR_MAP`. FastAPI áp dụng `gradingConfig` sau khi detector trả kết quả.

## API OMR chính

| Phương thức | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/` | Kiểm tra backend |
| `POST` | `/cham_bai` | Chấm một hoặc nhiều ảnh |
| `POST` | `/capture-sessions` | Tạo phiên nhận ảnh từ điện thoại |
| `POST` | `/capture-sessions/{id}/detect-markers` | Kiểm tra marker và chất lượng frame |
| `POST` | `/capture-sessions/{id}/images` | Upload ảnh camera |
| `GET` | `/capture-sessions/{id}/images` | Lấy danh sách ảnh của phiên |
| `GET` | `/capture-sessions/{id}/images/{imageId}` | Tải một ảnh camera |

`POST /cham_bai` nhận multipart form gồm `files`, `templateId`, `answerKeys` và `gradingConfig`. `answerKeys` có thể chứa nhiều mã đề; detector đọc mã trên phiếu rồi chọn đúng object đáp án tương ứng.

## Mô hình dữ liệu demo

`fake-backend-crud/db.json` hiện chứa các nhóm dữ liệu chính:

- `teachers`, `subjects`, `classes`;
- `examPeriods`, `exams`, `examRooms`, `examCandidates`;
- `answerSheetTemplates` và đáp án theo mã đề;
- `submissions`, `scanJobs` dùng làm dữ liệu mẫu cho hướng phát triển lưu kết quả.

JSON Server phù hợp để mô phỏng CRUD và demo một người dùng. Nó không thay thế cơ sở dữ liệu thật vì không có transaction, ràng buộc quan hệ, phân quyền hoặc cơ chế xử lý truy cập đồng thời.

## Cấu trúc thư mục

```text
Project_1/
├── backend/
│   ├── main.py                    FastAPI và điều phối detector
│   ├── detectors/                 app.py đến app4.py
│   ├── function/                  hàm xử lý ảnh dùng chung
│   ├── tools/                     công cụ debug/chạy thử detector
│   ├── tests/                     kiểm thử chọn đáp án và marker camera
│   ├── evaluation/                manifest, giao diện review và báo cáo
│   ├── data/                      ảnh mẫu cục bộ, được Git bỏ qua
│   ├── capture_sessions/          ảnh nhận từ camera
│   ├── uploads/                   ảnh đầu vào đã xử lý
│   └── results/                   ảnh kết quả có overlay
├── fake-backend-crud/
│   ├── db.json                    dữ liệu demo
│   └── server.js                  JSON Server cổng 8000
├── frontend/
│   └── src/app/
│       ├── class/                 luồng bài kiểm tra theo lớp
│       ├── examination/           luồng kỳ thi toàn trường
│       ├── camera/                giao diện camera điện thoại
│       ├── api/capture-sessions/  proxy camera từ Next.js sang FastAPI
│       ├── components/            form, bảng, upload và chấm bài
│       └── action/                Server Actions gọi API dữ liệu
├── setup.bat
├── start.bat
└── start-camera-tunnel.ps1
```

Để repository gọn nhẹ, Git không lưu dataset train, model/weight, script train, ảnh mẫu trong `backend/data/` hoặc ảnh kiểm tra camera. Các file này có thể được giữ riêng trên máy phát triển và không cần thiết để chạy luồng upload/chấm OMR.

## Kiểm thử và đánh giá

`pytest` chưa nằm trong `backend/requirements.txt`. Cài công cụ test rồi chạy unit test backend từ thư mục gốc:

```powershell
.\backend\.venv\Scripts\python.exe -m pip install pytest
.\backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```

Kiểm tra frontend:

```powershell
cd frontend
npm run lint
npm run build
```

Bộ đánh giá OMR nằm tại `backend/evaluation/`. Quy trình chuẩn là tạo manifest, review từng ảnh để có ground truth rồi sinh báo cáo:

```powershell
python backend\tools\prepare_evaluation.py --sample-size 100 --seed 2026
# Mở backend\evaluation\review.html, review và xuất reviewed_manifest.csv
python backend\tools\summarize_evaluation.py --input backend\evaluation\reviewed_manifest.csv
```

Xem hướng dẫn chi tiết tại [`backend/evaluation/README.md`](backend/evaluation/README.md).

### Trạng thái kiểm chứng ngày 16/08/2026

| Hạng mục | Kết quả |
|---|---|
| Parse `db.json` | Đạt |
| Import ứng dụng FastAPI | Đạt |
| Backend unit tests | **10 passed, 5 subtests passed** |
| Biên dịch và kiểm tra TypeScript trong `next build` | Đạt |
| Frontend ESLint | Chưa đạt: **28 errors, 92 warnings** |
| Frontend production build | Chưa đạt: `/examination` dùng `useSearchParams` ngoài `Suspense` |
| Bộ đánh giá OMR | Đã chọn 100 ảnh nhưng **0 ảnh được review**, chưa có accuracy hợp lệ |

Không nên công bố tỷ lệ chính xác của thuật toán trước khi hoàn tất ground truth. Các lần chạy thử thủ công chỉ là smoke test, không phải số liệu đánh giá khoa học.

## Hạn chế và rủi ro hiện tại

- Chưa có đăng nhập, phân quyền giáo viên/quản trị viên hoặc bảo vệ API.
- Kết quả chấm trên giao diện chưa được lưu tự động vào `submissions`; tải lại trang có thể mất dữ liệu chưa xuất.
- Nút **Chấm tay** đang có giao diện nhưng chưa gắn hành động.
- Nhiều URL `localhost:8000` và `127.0.0.1:8001` còn gán cứng; HTTPS deployment có thể gặp mixed-content hoặc CORS.
- Các detector còn lặp nhiều logic và dùng biến toàn cục `warp`; xử lý đồng thời nhiều request có nguy cơ lẫn trạng thái.
- `/cham_bai` đọc toàn bộ file upload vào bộ nhớ và chưa giới hạn kích thước tương tự luồng camera.
- `results/` và `uploads/` chưa có chính sách dọn file định kỳ.
- Các mục sidebar **Bài đã chấm**, **Danh sách lớp học**, **Quản lý học sinh**, **Báo cáo thống kê** và **Cài đặt** chưa có route tương ứng.
- Quick Tunnel chỉ phù hợp demo; URL thay đổi mỗi phiên và không có SLA.
- Chưa có bộ số liệu độ chính xác đã review cho từng template, từng phần đáp án và điều kiện ảnh.

## Ưu tiên trước khi triển khai

### P0 — bắt buộc

1. Bọc component dùng `useSearchParams` của trang `/examination` trong `Suspense` để `npm run build` thành công.
2. Chuyển URL API/CORS sang biến môi trường và dùng reverse proxy HTTPS khi deploy.
3. Lưu submission, chi tiết đáp án, điểm, ảnh gốc và ảnh kết quả vào database/object storage.
4. Hoàn thiện chấm tay hoặc ẩn nút chưa hoạt động.
5. Sửa các lỗi ESLint ảnh hưởng hook, component naming và kiểu `any` quan trọng.

### P1 — nâng chất lượng hệ thống

1. Thay JSON Server bằng PostgreSQL/MySQL và thiết kế khóa ngoại cho kỳ thi, phòng, thí sinh, đề và submission.
2. Thêm đăng nhập, phân quyền và audit log.
3. Tách phần marker/warp/grid dùng chung, loại bỏ biến toàn cục và cô lập trạng thái mỗi request.
4. Thêm giới hạn file, kiểm tra MIME, timeout, hàng đợi xử lý và cleanup định kỳ.
5. Thêm test API, test CRUD và test end-to-end cho các luồng chính.

### P2 — hoàn thiện khóa luận

1. Review đủ bộ ảnh đánh giá, báo cáo accuracy theo template và từng phần câu hỏi.
2. Đo thời gian xử lý trung bình, P95 và tỷ lệ thất bại theo độ mờ/góc chụp.
3. So sánh thuật toán với baseline và phân tích lỗi điển hình.
4. Container hóa các dịch vụ và thêm CI chạy test, lint, build.

## Lỗi thường gặp

### `EADDRINUSE` ở cổng 8000/8001/3000

Cổng đã có tiến trình khác sử dụng. Dùng lại tiến trình đang chạy hoặc dừng đúng PID trước khi khởi động dịch vụ mới.

### `ECONNREFUSED` hoặc `fetch failed`

Kiểm tra API dữ liệu tại cổng 8000 và FastAPI tại cổng 8001. Frontend có thể trả lỗi 500 nếu Server Component không lấy được dữ liệu từ JSON Server.

### `DNS_PROBE_FINISHED_NXDOMAIN` với `trycloudflare.com`

Quick Tunnel cũ đã hết hiệu lực. Chạy lại `start-camera-tunnel.ps1`, đợi URL mới xuất hiện rồi tạo lại QR.

### Camera iPhone không mở

Đảm bảo trang được mở bằng HTTPS, Safari đã cấp quyền camera và không còn tab khác giữ camera. Nếu ảnh không tự chụp, đưa đủ bốn marker vào khung, giữ máy ổn định và tăng ánh sáng.

### Chấm bài báo không có đáp án mã đề

Mã đọc từ phiếu không tồn tại trong `answerKeys`. Kiểm tra mã đề đã được lưu, cấu trúc object đáp án và vùng tô mã đề trên phiếu.

### Không tìm thấy marker hoặc ảnh kết quả sai lệch

Chụp lại trọn tờ giấy, tránh rung/lóa, không che góc và dùng đúng mẫu phiếu đã chọn khi tạo đề.



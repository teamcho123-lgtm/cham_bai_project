from fastapi import (
    FastAPI,
    HTTPException,
    Request,
    UploadFile,
    File,
    Form,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, ImageOps, UnidentifiedImageError
from detectors.capture_marker_detector import (
    decode_and_detect_four_markers,
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from urllib.parse import quote

from typing import List, Optional

import importlib
import json
import os
import socket
import time
import uuid
import traceback
import shutil


print("START MAIN")

app = FastAPI()

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

RESULT_FOLDER = os.path.join(
    BASE_DIR,
    "results"
)

CAPTURE_FOLDER = os.path.join(
    BASE_DIR,
    "capture_sessions"
)
CAPTURE_SESSION_INACTIVITY_SECONDS = 24 * 60 * 60

os.makedirs(
    RESULT_FOLDER,
    exist_ok=True
)

os.makedirs(
    CAPTURE_FOLDER,
    exist_ok=True
)

app.mount(
    "/results",
    StaticFiles(
        directory=RESULT_FOLDER
    ),
    name="results"
)


# ================= CORS =================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=(
        r"^http://(?:"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
        r"):3000$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================= CONFIG =================

FILE_NAME = "answers.json"

UPLOAD_FOLDER = "uploads"


# templateId dùng app nào để chấm
TEMPLATE_DETECTOR_MAP = {
    "template-000": "detectors.app",
    "template-001": "detectors.app1",
    "template-002": "detectors.app2",
    "template-003": "detectors.app3",
    "template-004": "detectors.app4",
}


# ================= MODEL =================

class Exam(BaseModel):
    code: str

    mcq: dict
    tf: dict
    essay: dict

    # templateId của bạn là chuỗi như template-002
    template_id: Optional[str] = None

    detector: Optional[str] = None


# ================= HELPER =================

def read_answers():

    if not os.path.exists(FILE_NAME):
        return {}

    try:
        with open(
            FILE_NAME,
            "r",
            encoding="utf-8",
        ) as file:

            return json.load(file)

    except json.JSONDecodeError:
        return {}


def save_answers(data):

    with open(
        FILE_NAME,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=4,
        )


def get_lan_ip():
    """Lấy IPv4 nội bộ để tạo đường dẫn mở từ điện thoại."""
    connection = socket.socket(
        socket.AF_INET,
        socket.SOCK_DGRAM,
    )

    try:
        connection.connect(("8.8.8.8", 80))
        return connection.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        connection.close()


def cleanup_expired_capture_sessions(
    max_age_seconds=CAPTURE_SESSION_INACTIVITY_SECONDS,
):
    """Dọn phiên không hoạt động để ảnh tạm không chiếm ổ đĩa mãi."""
    expired_before = time.time() - max_age_seconds

    for entry_name in os.listdir(CAPTURE_FOLDER):
        session_path = os.path.join(CAPTURE_FOLDER, entry_name)

        if not os.path.isdir(session_path):
            continue

        try:
            if os.path.getmtime(session_path) < expired_before:
                shutil.rmtree(session_path)
        except OSError:
            continue


def get_capture_session_path(session_id):
    normalized_session_id = str(session_id).strip().lower()

    try:
        uuid.UUID(normalized_session_id)
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail="Phiên chụp không hợp lệ",
        ) from error

    session_path = os.path.join(
        CAPTURE_FOLDER,
        normalized_session_id,
    )

    if not os.path.isdir(session_path):
        raise HTTPException(
            status_code=404,
            detail="Phiên chụp không tồn tại hoặc đã hết hạn",
        )

    # Mỗi lần điện thoại hoặc máy tính còn truy cập thì gia hạn phiên.
    # Vì máy tính đồng bộ ảnh định kỳ, một phiên đang được dùng sẽ không bị
    # cleanup xóa giữa chừng; chỉ phiên thật sự không hoạt động mới hết hạn.
    try:
        os.utime(session_path, None)
    except OSError:
        pass

    return session_path


# ================= API =================

@app.get("/")
def home():

    return {
        "msg": "Backend OK",
    }


@app.post("/capture-sessions")
def create_capture_session():
    cleanup_expired_capture_sessions()

    session_id = str(uuid.uuid4())
    session_path = os.path.join(
        CAPTURE_FOLDER,
        session_id,
    )
    os.makedirs(session_path, exist_ok=False)

    return {
        "success": True,
        "sessionId": session_id,
        "lanIp": get_lan_ip(),
        "expiresInSeconds": CAPTURE_SESSION_INACTIVITY_SECONDS,
        "expirationMode": "inactivity",
    }


@app.post("/capture-sessions/{session_id}/detect-markers")
async def detect_capture_markers(
    session_id: str,
    templateId: str = Form(...),
    file: UploadFile = File(...),
):
    """Kiem tra 4 marker tren mot khung hinh camera, khong cham bai."""
    get_capture_session_path(session_id)
    allowed_types = {
        "image/jpeg",
        "image/png",
    }

    if (file.content_type or "") not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail="Khung hình phải là ảnh JPG hoặc PNG",
        )

    maximum_frame_size = 5 * 1024 * 1024

    try:
        frame_bytes = await file.read(maximum_frame_size + 1)

        if not frame_bytes:
            raise HTTPException(
                status_code=400,
                detail="Khung hình camera bị rỗng",
            )

        if len(frame_bytes) > maximum_frame_size:
            raise HTTPException(
                status_code=413,
                detail="Khung hình nhận diện vượt quá 5 MB",
            )

        try:
            detection = decode_and_detect_four_markers(
                frame_bytes,
                templateId,
            )
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail=str(error),
            ) from error

        return detection.to_dict()
    finally:
        await file.close()


@app.post("/capture-sessions/{session_id}/images")
async def upload_capture_image(
    session_id: str,
    file: UploadFile = File(...),
):
    session_path = get_capture_session_path(session_id)
    allowed_types = {
        "image/jpeg",
        "image/png",
    }

    if (file.content_type or "") not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail="Chỉ hỗ trợ ảnh JPG, JPEG và PNG",
        )

    image_id = str(uuid.uuid4())
    stored_name = f"{image_id}.jpg"
    stored_path = os.path.join(session_path, stored_name)
    source_path = os.path.join(session_path, f"{image_id}.source")
    temporary_path = f"{stored_path}.part"
    maximum_size = 30 * 1024 * 1024
    written_size = 0

    try:
        with open(source_path, "wb") as output_file:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                written_size += len(chunk)

                if written_size > maximum_size:
                    raise HTTPException(
                        status_code=413,
                        detail="Ảnh vượt quá giới hạn 30 MB",
                    )

                output_file.write(chunk)

        if written_size == 0:
            raise HTTPException(
                status_code=400,
                detail="File ảnh rỗng",
            )

        try:
            with Image.open(source_path) as source_image:
                oriented_image = ImageOps.exif_transpose(source_image).convert("RGB")
                original_width, original_height = oriented_image.size

                try:
                    resized_image = ImageOps.pad(
                        oriented_image,
                        (1536, 2048),
                        method=Image.Resampling.LANCZOS,
                        color="white",
                        centering=(0.5, 0.5),
                    )

                    try:
                        resized_image.save(
                            temporary_path,
                            format="JPEG",
                            quality=95,
                            subsampling=0,
                            optimize=True,
                            dpi=(72, 72),
                        )
                    finally:
                        resized_image.close()
                finally:
                    oriented_image.close()
        except (UnidentifiedImageError, OSError) as error:
            raise HTTPException(
                status_code=400,
                detail="File gửi lên không phải ảnh JPG hoặc PNG hợp lệ",
            ) from error

        os.replace(temporary_path, stored_path)
        os.utime(session_path, None)
        stored_size = os.path.getsize(stored_path)

        return {
            "success": True,
            "image": {
                "id": image_id,
                "fileName": f"iphone-{image_id}.jpg",
                "contentType": "image/jpeg",
                "size": stored_size,
                "originalSize": written_size,
                "originalWidth": original_width,
                "originalHeight": original_height,
                "width": 1536,
                "height": 2048,
            },
        }
    finally:
        await file.close()

        if os.path.exists(temporary_path):
            os.remove(temporary_path)

        if os.path.exists(source_path):
            os.remove(source_path)


@app.get("/capture-sessions/{session_id}/images")
def list_capture_images(
    session_id: str,
    request: Request,
):
    session_path = get_capture_session_path(session_id)
    images = []

    for stored_name in os.listdir(session_path):
        stored_path = os.path.join(session_path, stored_name)
        image_id, extension = os.path.splitext(stored_name)

        if not os.path.isfile(stored_path) or extension not in {".jpg", ".png"}:
            continue

        images.append({
            "id": image_id,
            "fileName": f"iphone-{image_id}{extension}",
            "contentType": "image/jpeg" if extension == ".jpg" else "image/png",
            "size": os.path.getsize(stored_path),
            "createdAt": os.path.getmtime(stored_path),
            "downloadUrl": (
                str(request.base_url).rstrip("/")
                + f"/capture-sessions/{session_id}/images/{image_id}"
            ),
        })

    images.sort(key=lambda image: image["createdAt"])

    return {
        "success": True,
        "images": images,
    }


@app.get("/capture-sessions/{session_id}/images/{image_id}")
def download_capture_image(
    session_id: str,
    image_id: str,
):
    session_path = get_capture_session_path(session_id)

    try:
        uuid.UUID(str(image_id).strip().lower())
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail="Ảnh không hợp lệ",
        ) from error

    for extension, media_type in (
        (".jpg", "image/jpeg"),
        (".png", "image/png"),
    ):
        image_path = os.path.join(
            session_path,
            f"{image_id}{extension}",
        )

        if os.path.isfile(image_path):
            return FileResponse(
                image_path,
                media_type=media_type,
                filename=f"iphone-{image_id}{extension}",
            )

    raise HTTPException(
        status_code=404,
        detail="Không tìm thấy ảnh",
    )


# Lấy toàn bộ bài thi
@app.get("/get_exams")
def get_exams():

    return read_answers()


# Lấy đáp án của một mã đề
@app.get("/answers/{code}")
def get_exam(code: str):

    exams = read_answers()

    if code not in exams:

        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy mã đề",
        )

    return exams[code]


# Lưu đáp án của mã đề
@app.post("/save_exam")
async def save_exam(data: Exam):

    print("NHẬN DỮ LIỆU:")
    print(data)

    exams = read_answers()

    exams[data.code] = {
        "mcq": data.mcq,
        "tf": data.tf,
        "essay": data.essay,
        "template_id": data.template_id,
        "detector": data.detector,
    }

    save_answers(exams)

    return {
        "success": True,
        "message": "Đã lưu thành công",
        "code": data.code,
    }


# Xóa đáp án của mã đề
@app.delete("/answers/{code}")
def delete_exam(code: str):

    exams = read_answers()

    if code not in exams:

        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy mã đề",
        )

    del exams[code]

    save_answers(exams)

    return {
        "success": True,
        "message": "Đã xóa",
    }


# ================= CHẤM BÀI =================

def apply_point_settings(detect_result, point_settings, answer_keys=None):
    """Áp dụng cấu hình điểm do giáo viên gửi từ frontend.

    Nếu thiếu cấu hình hoặc detector cũ chưa trả sectionResults thì giữ nguyên
    điểm theo công thức mặc định của detector.
    """
    if not isinstance(detect_result, dict) or not isinstance(point_settings, dict):
        return detect_result

    section_results = detect_result.get("sectionResults")

    if not isinstance(section_results, dict):
        return detect_result

    try:
        part1_points = float(point_settings["part1PointsPerQuestion"])
        part2_points = float(point_settings["part2PointsPerQuestion"])
        part3_points = float(point_settings["part3PointsPerQuestion"])

        raw_penalties = point_settings.get("part2PenaltyByWrongCount", {})

        if not isinstance(raw_penalties, dict):
            return detect_result

        part2_penalties = {
            str(wrong_count): float(raw_penalties.get(str(wrong_count), 0))
            for wrong_count in range(1, 5)
        }
    except (KeyError, TypeError, ValueError):
        return detect_result

    numeric_values = [
        part1_points,
        part2_points,
        part3_points,
        *part2_penalties.values(),
    ]

    if any(value < 0 or value > 10 for value in numeric_values):
        return detect_result

    def section_counts(section_name):
        section = section_results.get(section_name, {})

        try:
            total = max(int(section.get("total", 0)), 0)
            correct = min(max(int(section.get("correct", 0)), 0), total)
        except (TypeError, ValueError):
            return 0, 0, 0

        return correct, max(total - correct, 0), total

    part1_correct, part1_incorrect, part1_total = section_counts("mcq")
    part2_correct, part2_incorrect, part2_total = section_counts("trueFalse")
    part3_correct, part3_incorrect, part3_total = section_counts("shortAnswer")

    part1_score = part1_correct * part1_points
    part3_score = part3_correct * part3_points

    def normalize_true_false_answer(value):
        if isinstance(value, bool):
            return value

        normalized_value = str(value).strip().lower()

        if normalized_value in {"đ", "d", "true", "1"}:
            return True

        if normalized_value in {"s", "false", "0"}:
            return False

        return None

    def get_part2_question_results():
        if not isinstance(answer_keys, dict):
            return []

        exam_code = str(detect_result.get("examCode", ""))
        exam_answer_key = answer_keys.get(exam_code)

        if not isinstance(exam_answer_key, dict):
            return []

        expected_questions = exam_answer_key.get("trueFalse", {})
        detected_answers = detect_result.get("answers", {})

        if not isinstance(expected_questions, dict) or not isinstance(detected_answers, dict):
            return []

        student_questions = detected_answers.get("trueFalse", {})

        if not isinstance(student_questions, dict):
            return []

        question_results = []

        for question, expected_statements in expected_questions.items():
            if not isinstance(expected_statements, dict):
                continue

            student_statements = student_questions.get(str(question), {})

            if not isinstance(student_statements, dict):
                student_statements = {}

            wrong_count = 0
            statement_count = 0

            for statement, expected_value in expected_statements.items():
                statement_count += 1
                student_value = normalize_true_false_answer(
                    student_statements.get(str(statement), "")
                )

                if student_value is None or student_value != bool(expected_value):
                    wrong_count += 1

            if statement_count > 0:
                question_results.append({
                    "question": str(question),
                    "wrong": wrong_count,
                    "correct": statement_count - wrong_count,
                    "total": statement_count,
                })

        return question_results

    part2_question_results = get_part2_question_results()
    part2_special_mode = bool(point_settings.get("part2SpecialMode", False))
    part2_score = 0.0

    if part2_question_results:
        for question_result in part2_question_results:
            wrong_count = question_result["wrong"]
            statement_count = question_result["total"]

            if part2_special_mode:
                deduction = (
                    part2_penalties[str(min(wrong_count, 4))]
                    if wrong_count > 0
                    else 0
                )
                question_score = max(part2_points - deduction, 0)
            else:
                question_score = (
                    question_result["correct"]
                    / statement_count
                    * part2_points
                )

            question_result["score"] = round(question_score, 2)
            part2_score += question_score
    elif part2_total > 0:
        estimated_question_count = max(round(part2_total / 4), 1)
        part2_score = (
            part2_correct
            / part2_total
            * estimated_question_count
            * part2_points
        )

    part2_score = max(part2_score, 0)

    final_score = round(part1_score + part2_score + part3_score, 2)

    detect_result["score"] = float(final_score)
    detect_result["scoreBreakdown"] = {
        "mcq": {
            "correct": part1_correct,
            "incorrect": part1_incorrect,
            "total": part1_total,
            "score": round(part1_score, 2),
        },
        "trueFalse": {
            "correct": part2_correct,
            "incorrect": part2_incorrect,
            "total": part2_total,
            "score": round(part2_score, 2),
            "questions": part2_question_results,
        },
        "shortAnswer": {
            "correct": part3_correct,
            "incorrect": part3_incorrect,
            "total": part3_total,
            "score": round(part3_score, 2),
        },
    }

    return detect_result

@app.post("/cham_bai")
async def cham_bai(
    request: Request,
    files: List[UploadFile] = File(...),
    templateId: str = Form(...),
    answerKeys: str = Form(...),
    gradingConfig: Optional[str] = Form(None),
):

    print("Template nhận được:", templateId)
    print("Số ảnh nhận được:", len(files))

    # 1. Kiểm tra có ảnh hay không
    if len(files) == 0:

        raise HTTPException(
            status_code=400,
            detail="Không có ảnh bài thi",
        )

    try:
        answer_keys_data = json.loads(answerKeys )

    except json.JSONDecodeError:
        raise HTTPException( status_code=400, detail="Dữ liệu đáp án không hợp lệ")

    if not isinstance(answer_keys_data, dict) or not answer_keys_data:
        raise HTTPException(
            status_code=400,
            detail="Phải có ít nhất một mã đề và đáp án để chấm",
        )

    normalized_answer_keys = {}

    for exam_code, answer_key in answer_keys_data.items():
        normalized_exam_code = str(exam_code).strip()

        if not normalized_exam_code:
            raise HTTPException(
                status_code=400,
                detail="Dữ liệu đáp án chứa mã đề rỗng",
            )

        if not isinstance(answer_key, dict):
            raise HTTPException(
                status_code=400,
                detail=f"Đáp án mã đề {normalized_exam_code} không hợp lệ",
            )

        if normalized_exam_code in normalized_answer_keys:
            raise HTTPException(
                status_code=400,
                detail=f"Mã đề {normalized_exam_code} bị trùng",
            )

        normalized_answer_keys[normalized_exam_code] = answer_key

    answer_keys_data = normalized_answer_keys

    point_settings_data = None

    if gradingConfig:
        try:
            parsed_grading_config = json.loads(gradingConfig)

            if isinstance(parsed_grading_config, dict):
                point_settings_data = parsed_grading_config
        except json.JSONDecodeError:
            print("Cấu hình điểm không hợp lệ, sử dụng công thức mặc định")

    print("Template:",templateId)

    print("Các mã đề nhận được:",list(answer_keys_data.keys()) )

    # 2. Tìm app chấm bài từ templateId
    detector_name = TEMPLATE_DETECTOR_MAP.get(templateId)

    if not detector_name:
        raise HTTPException(
            status_code=400,
            detail=(f"Không tìm thấy app chấm bài "  f"cho templateId: {templateId}"),
        )

    print("App chấm bài:", detector_name)

    # 3. Import app chấm bài
    try:

        detector_module = importlib.import_module(
            detector_name
        )

    except ModuleNotFoundError:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Không tìm thấy file "
                f"{detector_name}.py"
            ),
        )

    # Kiểm tra app có hàm detect hay không
    if not hasattr(detector_module, "detect"):

        raise HTTPException(
            status_code=500,
            detail=(
                f"File {detector_name}.py "
                f"không có hàm detect()"
            ),
        )

    # 4. Tạo thư mục lưu ảnh
    TEMP_FOLDER = os.path.join(BASE_DIR, "temp")
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    
    os.makedirs(TEMP_FOLDER, exist_ok=True)
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    results = []

    # 5. Xử lý từng ảnh
    for index, upload_file in enumerate(files):
    
        original_name = (
            upload_file.filename
            or f"image-{index}.jpg"
        )

        print(
            f"Đang xử lý ảnh {index + 1}:",
            original_name,
        )

        # Kiểm tra định dạng ảnh
        allowed_types = [
            "image/jpeg",
            "image/png",
        ]

        if (
            upload_file.content_type
            not in allowed_types
        ):

            results.append({
                "index": index,
                "fileName": original_name,
                "success": False,
                "error": (
                    "Chỉ hỗ trợ ảnh JPG, "
                    "JPEG và PNG"
                ),
            })

            continue

        # Lấy tên file an toàn
        safe_file_name = os.path.basename(
            original_name
        )

        # Thêm UUID để tránh trùng tên
        stored_file_name = (
            f"{uuid.uuid4()}-"
            f"{safe_file_name}"
        )

        temp_file_path = os.path.join(
            TEMP_FOLDER,
            stored_file_name,
        )

        upload_file_path = os.path.join(
            UPLOAD_FOLDER,
            stored_file_name,
        )

        try:
            # 6. Đọc file ảnh
            content = await upload_file.read()

            # 7. Chỉ lưu tạm vào TEMP trước
            with open(
                temp_file_path,
                "wb",
            ) as saved_file:
                saved_file.write(content)

            print(
                "Đã lưu ảnh tạm tại:",
                temp_file_path,
            )

            # 8. Gọi app chấm bài bằng ảnh tạm
            detect_result = detector_module.detect(
                temp_file_path,
                answer_keys_data
            )

            detect_result = apply_point_settings(
                detect_result,
                point_settings_data,
                answer_keys_data,
            )

            # ==============================
            # CHẤM THÀNH CÔNG
            # MỚI CHUYỂN ẢNH VÀO uploads
            # ==============================

            shutil.move(
                temp_file_path,
                upload_file_path
            )

            print(
                "Ảnh chấm thành công, đã lưu tại:",
                upload_file_path,
            )

            # ==============================
            # ẢNH KẾT QUẢ
            # ==============================

            result_image_name = detect_result.get(
                "resultImageName"
            )

            if result_image_name:
                detect_result[
                    "resultImageUrl"
                ] = (
                    str(request.base_url).rstrip("/")
                    +
                    f"/results/{quote(result_image_name)}"
                )

            print(
                "Kết quả nhận diện:",
                detect_result,
            )

            # 9. Thêm kết quả của ảnh
            results.append({
                "index": index,
                "fileName": original_name,
                "success": True,
                "data": detect_result,
            })

        except Exception as error:

            print(
                "Lỗi xử lý ảnh:",
                str(error),
            )

            traceback.print_exc()

            # ==============================
            # CHẤM LỖI
            # XÓA ẢNH TẠM
            # ==============================

            if os.path.exists(
                temp_file_path
            ):
                try:
                    os.remove(
                        temp_file_path
                    )

                    print(
                        "Đã xóa ảnh chấm lỗi:",
                        temp_file_path,
                    )

                except Exception as delete_error:
                    print(
                        "Không xóa được ảnh tạm:",
                        str(delete_error),
                    )

            results.append({
                "index": index,
                "fileName": original_name,
                "success": False,
                "error": str(error),
            })

        finally:
            await upload_file.close()

    # 10. Trả toàn bộ kết quả về frontend
    return {
        "success": True,
        "templateId": templateId,
        "detector": detector_name,
        "data": results,
    }

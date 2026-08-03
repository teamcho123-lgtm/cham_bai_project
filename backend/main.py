from fastapi import (
    FastAPI,
    HTTPException,
    UploadFile,
    File,
    Form,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fastapi.staticfiles import StaticFiles
from urllib.parse import quote

from typing import List, Optional

import importlib
import json
import os
import uuid
import traceback


print("START MAIN")

app = FastAPI()

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

RESULT_FOLDER = os.path.join(
    BASE_DIR,
    "results"
)

os.makedirs(
    RESULT_FOLDER,
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================= CONFIG =================

FILE_NAME = "answers.json"

UPLOAD_FOLDER = "uploads"


# templateId dùng app nào để chấm
TEMPLATE_DETECTOR_MAP = {
    "template-000": "app",
    "template-001": "app1",
    "template-002": "app2",
    "template-003": "app3",
    "template-004": "app4",
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


# ================= API =================

@app.get("/")
def home():

    return {
        "msg": "Backend OK",
    }


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

@app.post("/cham_bai")
async def cham_bai(
    files: List[UploadFile] = File(...),
    templateId: str = Form(...),
    answerKeys: str = Form(...)
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
    os.makedirs(
        UPLOAD_FOLDER,
        exist_ok=True,
    )

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

        file_path = os.path.join(
            UPLOAD_FOLDER,
            stored_file_name,
        )

        try:

            # 6. Đọc file ảnh
            content = await upload_file.read()

            # 7. Lưu ảnh tạm vào uploads
            with open(
                file_path,
                "wb",
            ) as saved_file:

                saved_file.write(content)

            print(
                "Đã lưu ảnh tại:",
                file_path,
            )

            # 8. Gọi app chấm bài
            detect_result = detector_module.detect(file_path,answer_keys_data)

            result_image_name = detect_result.get(
                "resultImageName"
            )

            if result_image_name:
                detect_result[
                    "resultImageUrl"
                ] = (
                    "http://127.0.0.1:8001"
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

            print( "Lỗi xử lý ảnh:",str(error),)

            traceback.print_exc()

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
from fastapi import (
    FastAPI,
    HTTPException,
    UploadFile,
    File,
    Form
)
import importlib
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

import json
import os
from typing import Optional

print("START MAIN")

app = FastAPI()

# ================= CORS =================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= CONFIG =================

FILE_NAME = "answers.json"

# ================= MODEL =================

class Exam(BaseModel):

    code: str
    mcq: dict
    tf: dict
    essay: dict

    template_id: Optional[int] = None
    detector: Optional[str] = None


# ================= HELPER =================

def read_answers():

    if not os.path.exists(FILE_NAME):
        return {}

    try:

        with open(
            FILE_NAME,
            "r",
            encoding="utf-8"
        ) as f:

            return json.load(f)

    except json.JSONDecodeError:

        return {}


def save_answers(data):

    with open(
        FILE_NAME,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            data,
            f,
            ensure_ascii=False,
            indent=4
        )


# ================= API =================

@app.get("/")
def home():

    return {
        "msg": "Backend OK"
    }


# Lấy toàn bộ bài thi
@app.get("/get_exams")
def get_exams():

    return read_answers()


# Lấy 1 mã đề
@app.get("/answers/{code}")
def get_exam(code: str):

    exams = read_answers()

    if code not in exams:

        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy mã đề"
        )

    return exams[code]


# Lưu bài thi
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
        "detector": data.detector
    }

    save_answers(exams)

    return {

        "success": True,
        "message": "Đã lưu thành công",
        "code": data.code
    }


# Xóa bài thi
@app.delete("/answers/{code}")
def delete_exam(code: str):

    exams = read_answers()

    if code not in exams:

        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy mã đề"
        )

    del exams[code]

    save_answers(exams)

    return {

        "success": True,
        "message": "Đã xóa"
    }

@app.post("/cham_bai")
async def cham_bai(
    files: List[UploadFile] = File(...),
    code: str = Form(...),
    detector: str = Form(...)
):

    os.makedirs(
        "uploads",
        exist_ok=True
    )

    saved_files=[]

    for file in files:

        file_path=f"uploads/{file.filename}"

        content=await file.read()

        with open(
            file_path,
            "wb"
        ) as f:

            f.write(content)

        saved_files.append(file_path)

    try:

        # app1/app2/app3...
        model = importlib.import_module(
            detector
        )

        # GỌI HÀM CHẤM
        result = model.detect(
            saved_files[0]
        )

        return {

            "success":True,
            "data": result

        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
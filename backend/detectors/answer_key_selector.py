"""Chọn đáp án theo mã đề cho cả chế độ chấm riêng và chấm nhiều mã."""


def normalize_exam_code(value):
    """Đưa mã đề từ OpenCV hoặc JSON về chuỗi có thể so sánh."""
    if value is None:
        return ""

    return str(value).strip()


def select_answer_key(answer_keys, detected_exam_code):
    """
    Trả về ``(exam_code, answer_key)``.

    Dù chấm riêng hay chấm nhiều mã, mã đọc trên phiếu phải có trong danh
    sách đáp án frontend gửi lên. Nhờ vậy phiếu sai mã đề không bị chấm bằng
    đáp án của mã đang mở.
    """
    if not isinstance(answer_keys, dict) or not answer_keys:
        raise ValueError("Không có dữ liệu đáp án để chấm")

    normalized_answer_keys = {}

    for code, answer_key in answer_keys.items():
        normalized_code = normalize_exam_code(code)

        if not normalized_code:
            raise ValueError("Dữ liệu đáp án chứa mã đề rỗng")

        if not isinstance(answer_key, dict):
            raise ValueError(f"Đáp án mã đề {normalized_code} không hợp lệ")

        normalized_answer_keys[normalized_code] = answer_key

    normalized_detected_code = normalize_exam_code(detected_exam_code)

    if not normalized_detected_code:
        raise ValueError(
            "Không nhận diện được mã đề trên ảnh"
        )

    selected_answer_key = normalized_answer_keys.get(normalized_detected_code)

    if selected_answer_key is None:
        available_codes = ", ".join(normalized_answer_keys.keys())
        raise ValueError(
            f"Mã đề trên phiếu là {normalized_detected_code}, không khớp mã đang chấm. "
            f"Các mã đề hợp lệ: {available_codes}"
        )

    return normalized_detected_code, selected_answer_key

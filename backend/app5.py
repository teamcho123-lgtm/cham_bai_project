import math
import cv2
import json
import os
import glob
import numpy as np
from function.clamp import clamp
from function.warp_paper import warp_paper
from function.read_bubbles import read_bubbles
from function.dist import dist
from function.find_marker_in_roi import find_marker_in_roi

# pip install opencv-python
# pip install numpy

from models.bai_thi import BaiThi

# 0.HÀM CHUẨN BỊ
import cv2
import math
import numpy as np

def estimate_page_ink_strength(
    image,
    normalize_width=1000,
    exclude_timing_edges=True,
    show_debug=False
):
    """
    Đo độ đậm/nhạt của mực trên toàn bộ phiếu.

    Nên truyền ảnh warp gốc, trước CLAHE và threshold.

    Trả về:
        score:
            Điểm độ đậm. Càng thấp thì mực càng nhạt.

        coverage:
            Phần trăm diện tích được xem là nét mực.

        level:
            VERY_FAINT, FAINT, MEDIUM, DARK.

        ink_map:
            Bản đồ độ tương phản của nét mực.

        ink_mask:
            Mask các pixel được xem là nét mực.
    """

    if image is None:
        raise ValueError("Ảnh đầu vào đang là None")

    if not isinstance(image, np.ndarray):
        raise TypeError(
            f"Ảnh phải là numpy.ndarray, nhận được {type(image)}"
        )

    if image.size == 0:
        raise ValueError("Ảnh đầu vào đang rỗng")

    original_h, original_w = image.shape[:2]

    # =====================================================
    # 1. CHUẨN HÓA KÍCH THƯỚC
    # =====================================================

    if normalize_width is not None and original_w != normalize_width:
        scale = normalize_width / float(original_w)

        new_height = int(round(original_h * scale))

        interpolation = (
            cv2.INTER_AREA
            if scale < 1.0
            else cv2.INTER_CUBIC
        )

        process_img = cv2.resize(
            image,
            (normalize_width, new_height),
            interpolation=interpolation
        )
    else:
        process_img = image.copy()

    if process_img.ndim == 3:
        gray = cv2.cvtColor(
            process_img,
            cv2.COLOR_BGR2GRAY
        )
    else:
        gray = process_img.copy()

    h, w = gray.shape[:2]

    # =====================================================
    # 2. TẠO VÙNG ĐƯỢC PHÉP ĐO
    # =====================================================

    valid_mask = np.zeros(
        gray.shape,
        dtype=np.uint8
    )

    if exclude_timing_edges:
        # Bỏ một phần biên phải và biên dưới vì timing marker
        # thường đen hơn nhiều so với nội dung phiếu.
        x1 = int(w * 0.02)
        y1 = int(h * 0.02)
        x2 = int(w * 0.92)
        y2 = int(h * 0.92)
    else:
        x1 = int(w * 0.01)
        y1 = int(h * 0.01)
        x2 = int(w * 0.99)
        y2 = int(h * 0.99)

    valid_mask[y1:y2, x1:x2] = 255

    # =====================================================
    # 3. ƯỚC LƯỢNG NỀN GIẤY
    # =====================================================

    sigma = max(
        15,
        int(round(min(h, w) * 0.025))
    )

    background = cv2.GaussianBlur(
        gray,
        (0, 0),
        sigmaX=sigma,
        sigmaY=sigma
    )

    # Nền sáng trừ nét tối.
    # Nét mực càng đậm thì giá trị càng cao.
    ink_map = cv2.subtract(
        background,
        gray
    )

    valid_values = ink_map[
        valid_mask > 0
    ].astype(np.float32)

    if valid_values.size == 0:
        raise RuntimeError("Không có vùng hợp lệ để đo mực")

    # =====================================================
    # 4. ƯỚC LƯỢNG NHIỄU NỀN
    # =====================================================

    low_limit = np.percentile(
        valid_values,
        70
    )

    background_values = valid_values[
        valid_values <= low_limit
    ]

    background_median = float(
        np.median(background_values)
    )

    mad = float(
        np.median(
            np.abs(
                background_values
                - background_median
            )
        )
    )

    estimated_noise = 1.4826 * mad

    ink_threshold = max(
        3.0,
        background_median + 3.0 * estimated_noise
    )

    # =====================================================
    # 5. LẤY PIXEL NÉT MỰC
    # =====================================================

    ink_mask = np.zeros_like(
        ink_map,
        dtype=np.uint8
    )

    ink_mask[
        (ink_map > ink_threshold)
        & (valid_mask > 0)
    ] = 255

    ink_pixels = ink_map[
        ink_mask > 0
    ].astype(np.float32)

    if ink_pixels.size == 0:
        return {
            "score": 0.0,
            "coverage": 0.0,
            "level": "VERY_FAINT",
            "message": "Hầu như không phát hiện được nét mực",
            "ink_threshold": ink_threshold,
            "ink_map": ink_map,
            "ink_mask": ink_mask,
            "processed_image": process_img
        }

    # Bỏ 5% pixel đen đậm nhất để timing marker, chữ đậm
    # hoặc điểm tô không chi phối kết quả toàn trang.
    upper_limit = np.percentile(
        ink_pixels,
        95
    )

    trimmed_ink_pixels = ink_pixels[
        ink_pixels <= upper_limit
    ]

    if trimmed_ink_pixels.size == 0:
        trimmed_ink_pixels = ink_pixels

    # Percentile 75 biểu diễn độ đậm phổ biến của nét in.
    score = float(
        np.percentile(
            trimmed_ink_pixels,
            75
        )
    )

    valid_pixel_count = cv2.countNonZero(
        valid_mask
    )

    ink_pixel_count = cv2.countNonZero(
        ink_mask
    )

    coverage = (
        ink_pixel_count
        / float(valid_pixel_count)
        * 100.0
    )

    # =====================================================
    # 6. PHÂN LOẠI
    # =====================================================

    if score < 7:
        level = "VERY_FAINT"
        message = "Mực toàn phiếu rất nhạt"

    elif score < 13:
        level = "FAINT"
        message = "Mực toàn phiếu nhạt"

    elif score < 22:
        level = "MEDIUM"
        message = "Mực toàn phiếu ở mức trung bình"

    else:
        level = "DARK"
        message = "Mực toàn phiếu rõ"

    if show_debug:
        cv2.namedWindow(
            "PAGE INK MAP",
            cv2.WINDOW_NORMAL
        )

        cv2.namedWindow(
            "PAGE INK MASK",
            cv2.WINDOW_NORMAL
        )

        cv2.resizeWindow(
            "PAGE INK MAP",
            700,
            900
        )

        cv2.resizeWindow(
            "PAGE INK MASK",
            700,
            900
        )

        cv2.imshow(
            "PAGE INK MAP",
            ink_map
        )

        cv2.imshow(
            "PAGE INK MASK",
            ink_mask
        )

    return {
        "score": score,
        "coverage": coverage,
        "level": level,
        "message": message,
        "ink_threshold": ink_threshold,
        "ink_map": ink_map,
        "ink_mask": ink_mask,
        "processed_image": process_img
    }

def estimate_a4_dpi(
    image,
    low_dpi_threshold=150,
    normal_dpi_threshold=200
):
    """
    Ước tính DPI khi ảnh chứa toàn bộ một trang giấy A4.

    Phân loại:
        dpi < 150        : ảnh độ phân giải thấp
        150 <= dpi < 200 : ảnh độ phân giải trung bình
        dpi >= 200       : ảnh độ phân giải bình thường/tốt
    """

    if image is None:
        raise ValueError("Ảnh đang là None")

    if image.size == 0:
        raise ValueError("Ảnh đang rỗng")

    height_px, width_px = image.shape[:2]

    # Kích thước A4 theo inch
    a4_width_inch = 8.2677
    a4_height_inch = 11.6929

    # Tự nhận diện ảnh dọc hoặc ngang
    if height_px >= width_px:
        paper_width = a4_width_inch
        paper_height = a4_height_inch
    else:
        paper_width = a4_height_inch
        paper_height = a4_width_inch

    dpi_x = width_px / paper_width
    dpi_y = height_px / paper_height

    # Lấy DPI thấp hơn để đánh giá an toàn
    estimated_dpi = min(dpi_x, dpi_y)

    if estimated_dpi < low_dpi_threshold:
        level = "LOW"
        message = "Ảnh độ phân giải thấp"

    elif estimated_dpi < normal_dpi_threshold:
        level = "MEDIUM"
        message = "Ảnh độ phân giải trung bình"

    else:
        level = "NORMAL"
        message = "Ảnh độ phân giải bình thường/tốt"

    return {
        "width": width_px,
        "height": height_px,
        "dpi_x": dpi_x,
        "dpi_y": dpi_y,
        "dpi": estimated_dpi,
        "level": level,
        "message": message,
        "is_low_resolution": estimated_dpi < low_dpi_threshold
    }

def remove_duplicate_markers(markers, axis, tolerance=7):
    """
    Loại marker trùng nhau.

    axis:
        "cx": loại trùng theo tọa độ X.
        "cy": loại trùng theo tọa độ Y.
    """
    if not markers:
        return []

    markers = sorted(
        markers,
        key=lambda marker: marker[axis]
    )

    result = [markers[0]]

    for marker in markers[1:]:
        previous = result[-1]

        if abs(marker[axis] - previous[axis]) > tolerance:
            result.append(marker)
        else:
            # Giữ marker có contour lớn hơn
            if marker["area"] > previous["area"]:
                result[-1] = marker

    return result

def group_markers(markers, axis, tolerance=20):
    """
    Gom marker thành các nhóm có tọa độ gần nhau.

    Ví dụ:
        axis="cx" -> gom thành các cột.
        axis="cy" -> gom thành các hàng.
    """
    if not markers:
        return []

    markers = sorted(
        markers,
        key=lambda marker: marker[axis]
    )

    groups = [[markers[0]]]

    for marker in markers[1:]:
        current_group = groups[-1]

        mean_coordinate = np.mean([
            item[axis]
            for item in current_group
        ])

        if abs(marker[axis] - mean_coordinate) <= tolerance:
            current_group.append(marker)
        else:
            groups.append([marker])

    return groups

def findMarker(
    image,
    right_region_ratio=0.82,
    bottom_region_ratio=0.88,
    right_group_tolerance=20,
    bottom_group_tolerance=20,
    duplicate_tolerance=7,
    min_group_size=3,
    show_debug=True,
    win_name="TIMING MARKERS"
):
    """
    Quét toàn bộ ảnh và chỉ lấy:

    - Cụm timing marker ngoài cùng bên phải.
    - Cụm timing marker ngoài cùng phía dưới.

    Trả về dictionary:
        right_markers
        bottom_markers
        timing_rows
        timing_cols
        all_candidates
        debug
        thresh
    """

    if image is None or image.size == 0:
        raise ValueError("Ảnh đầu vào không hợp lệ")

    H, W = image.shape[:2]

    debug = image.copy()

    # =====================================================
    # 1. TIỀN XỬ LÝ TOÀN ẢNH
    # =====================================================
    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    blurred = cv2.GaussianBlur(
        gray,
        (5, 5),
        0
    )

    thresh = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        10
    )

    kernel = np.ones(
        (3, 3),
        dtype=np.uint8
    )

    closed = cv2.morphologyEx(
        thresh,
        cv2.MORPH_CLOSE,
        kernel
    )

    # =====================================================
    # 2. QUÉT TOÀN BỘ CONTOUR
    # =====================================================
    contours, _ = cv2.findContours(
        closed.copy(),
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    all_candidates = []

    for contour in contours:
        perimeter = cv2.arcLength(
            contour,
            True
        )

        if perimeter <= 0:
            continue

        area = cv2.contourArea(contour)

        # Có thể điều chỉnh tùy kích thước ảnh
        if area < 50 or area > 2000:
            continue

        approx = cv2.approxPolyDP(
            contour,
            0.025 * perimeter,
            True
        )

        x, y, w, h = cv2.boundingRect(contour)

        if w <= 0 or h <= 0:
            continue

        ratio = w / float(h)
        extent = area / float(w * h)

        circularity = (
            4.0
            * math.pi
            * area
            / (perimeter * perimeter)
        )

        marker_roi = closed[
            y:y + h,
            x:x + w
        ]

        fill_ratio = (
            cv2.countNonZero(marker_roi)
            / float(w * h)
        )

        # Timing marker trong ảnh là các thanh chữ nhật tô đen
        is_timing_marker = (
            4 <= len(approx) <= 8
            and 1.2 <= ratio <= 6.0
            and extent >= 0.60
            and fill_ratio >= 0.55
            and perimeter >= 30
            and circularity < 0.85
        )

        if not is_timing_marker:
            continue

        cx = x + w / 2.0
        cy = y + h / 2.0

        all_candidates.append({
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "cx": cx,
            "cy": cy,
            "area": area,
            "perimeter": perimeter,
            "ratio": ratio,
            "extent": extent,
            "fill_ratio": fill_ratio,
            "circularity": circularity,
            "contour": contour
        })

    # =====================================================
    # 3. CHỈ GIỮ CANDIDATE Ở GẦN CẠNH PHẢI
    # =====================================================
    right_candidates = [
        marker
        for marker in all_candidates
        if marker["cx"] >= W * right_region_ratio
    ]

    # Gom thành các cột theo tọa độ X
    right_groups = group_markers(
        right_candidates,
        axis="cx",
        tolerance=right_group_tolerance
    )

    # Chỉ giữ nhóm đủ nhiều marker
    valid_right_groups = [
        group
        for group in right_groups
        if len(group) >= min_group_size
    ]

    right_markers = []

    if valid_right_groups:
        # Chọn cột có tọa độ X trung bình lớn nhất
        right_markers = max(
            valid_right_groups,
            key=lambda group: np.mean([
                marker["cx"]
                for marker in group
            ])
        )

    elif right_groups:
        # Dự phòng: chọn nhóm vừa nhiều marker,
        # vừa nằm sát phải nhất
        right_markers = max(
            right_groups,
            key=lambda group: (
                len(group),
                np.mean([
                    marker["cx"]
                    for marker in group
                ])
            )
        )

    right_markers = remove_duplicate_markers(
        right_markers,
        axis="cy",
        tolerance=duplicate_tolerance
    )

    # Trên xuống dưới
    right_markers = sorted(
        right_markers,
        key=lambda marker: marker["cy"]
    )

    # =====================================================
    # 4. CHỈ GIỮ CANDIDATE Ở GẦN CẠNH DƯỚI
    # =====================================================
    bottom_candidates = [
        marker
        for marker in all_candidates
        if marker["cy"] >= H * bottom_region_ratio
    ]

    # Gom thành các hàng theo tọa độ Y
    bottom_groups = group_markers(
        bottom_candidates,
        axis="cy",
        tolerance=bottom_group_tolerance
    )

    valid_bottom_groups = [
        group
        for group in bottom_groups
        if len(group) >= min_group_size
    ]

    bottom_markers = []

    if valid_bottom_groups:
        # Chọn hàng có tọa độ Y trung bình lớn nhất
        bottom_markers = max(
            valid_bottom_groups,
            key=lambda group: np.mean([
                marker["cy"]
                for marker in group
            ])
        )

    elif bottom_groups:
        bottom_markers = max(
            bottom_groups,
            key=lambda group: (
                len(group),
                np.mean([
                    marker["cy"]
                    for marker in group
                ])
            )
        )

    bottom_markers = remove_duplicate_markers(
        bottom_markers,
        axis="cx",
        tolerance=duplicate_tolerance
    )

    # Trái sang phải
    bottom_markers = sorted(
        bottom_markers,
        key=lambda marker: marker["cx"]
    )

    # =====================================================
    # 5. TỌA ĐỘ TIMING ROW VÀ TIMING COL
    # =====================================================
    timing_rows = [
        int(round(marker["cy"]))
        for marker in right_markers
    ]

    timing_cols = [
        int(round(marker["cx"]))
        for marker in bottom_markers
    ]

    # =====================================================
    # 6. VẼ DEBUG
    # =====================================================

    # Vẽ ranh giới vùng xét bên phải
    right_boundary_x = int(W * right_region_ratio)

    cv2.line(debug,(right_boundary_x, 0),(right_boundary_x, H - 1),(255, 255, 0),4)

    # Vẽ ranh giới vùng xét phía dưới
    bottom_boundary_y = int(H * bottom_region_ratio)

    cv2.line(debug,(0, bottom_boundary_y),(W - 1, bottom_boundary_y),(255, 255, 0),4)

    # Vẽ tất cả candidate bằng màu xám/xanh mảnh
    for marker in all_candidates:
        cv2.drawContours(debug,[marker["contour"]],-1,(100, 150, 100),1)

    # Marker bên phải: màu đỏ
    for index, marker in enumerate(right_markers):
        x = marker["x"]
        y = marker["y"]
        w = marker["w"]
        h = marker["h"]

        cx = int(round(marker["cx"]))
        cy = int(round(marker["cy"]))

        cv2.rectangle(
            debug,
            (x, y),
            (x + w, y + h),
            (0, 0, 255),
            2
        )

        cv2.circle(
            debug,
            (cx, cy),
            4,
            (0, 0, 255),
            -1
        )

        cv2.putText(
            debug,
            f"R{index}",
            (max(0, x - 35), max(15, y)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,(0, 0, 255),1)

    # Marker phía dưới: màu xanh dương
    for index, marker in enumerate(bottom_markers):
        x = marker["x"]
        y = marker["y"]
        w = marker["w"]
        h = marker["h"]

        cx = int(round(marker["cx"]))
        cy = int(round(marker["cy"]))

        cv2.rectangle(debug,(x, y),(x + w, y + h),(255, 0, 0),2)
        cv2.circle(debug,(cx, cy),4,(255, 0, 0),-1)
        cv2.putText(debug,f"C{index}",(x, max(15, y - 5)),cv2.FONT_HERSHEY_SIMPLEX,0.4,(255, 0, 0),1)

    print("Tổng contour:", len(contours))
    print("Tổng candidate:", len(all_candidates))
    print(
        "Số marker sát phải:",
        len(right_markers)
    )
    print(
        "Số marker sát dưới:",
        len(bottom_markers)
    )
    print("Timing rows:", timing_rows)
    print("Timing cols:", timing_cols)

    if show_debug:
        cv2.namedWindow(win_name,cv2.WINDOW_NORMAL)

        cv2.resizeWindow(win_name,800,1000)

        cv2.imshow(win_name,debug)

    cv2.namedWindow("debug", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("debug", 800, 1000)
    cv2.imshow("debug", debug)

    return {
        "right_markers": right_markers,
        "bottom_markers": bottom_markers,
        "timing_rows": timing_rows,
        "timing_cols": timing_cols,
        "all_candidates": all_candidates,
        "debug": debug,
        "thresh": closed
    }

def split_markers_by_gap(
    markers,
    axis,
    gap_factor=2.0,
    minimum_gap=None
):
    """
    Chia marker thành các cụm dựa trên khoảng cách.

    axis:
        "cy": chia cụm theo chiều dọc.
        "cx": chia cụm theo chiều ngang.
    """

    if not markers:
        return []

    markers = sorted(
        markers,
        key=lambda marker: marker[axis]
    )

    if len(markers) == 1:
        return [markers]

    coordinates = np.array(
        [marker[axis] for marker in markers],
        dtype=np.float32
    )

    gaps = np.diff(coordinates)

    # Khoảng cách phổ biến giữa các marker liên tiếp
    normal_gap = float(np.median(gaps))

    if minimum_gap is None:
        split_threshold = normal_gap * gap_factor
    else:
        split_threshold = max(
            minimum_gap,
            normal_gap * gap_factor
        )

    groups = [[markers[0]]]

    for index in range(1, len(markers)):
        gap = (
            markers[index][axis]
            - markers[index - 1][axis]
        )

        if gap > split_threshold:
            groups.append([markers[index]])
        else:
            groups[-1].append(markers[index])

    return groups

def classify_right_marker_groups(right_markers):
    """
    Phân cụm marker phải thành:

    - identity: SBD và MĐ, gồm 10 hàng số 0–9.
    - part1: Phần I.
    - part2: Phần II.
    - part3: Phần III.

    Các marker góc đơn lẻ ở đầu/cuối sẽ bị bỏ.
    """

    raw_groups = split_markers_by_gap(
        right_markers,
        axis="cy",
        gap_factor=2.0
    )

    print(
        "Kích thước cụm phải ban đầu:",
        [len(group) for group in raw_groups]
    )

    # Bỏ các nhóm đơn lẻ là marker góc trên/dưới
    content_groups = [
        group
        for group in raw_groups
        if len(group) >= 3
    ]

    # Kỳ vọng bốn cụm nội dung
    if len(content_groups) < 4:
        raise RuntimeError(
            "Không phân đủ 4 cụm marker phải. "
            f"Tìm thấy {len(content_groups)} cụm: "
            f"{[len(group) for group in content_groups]}"
        )

    # Sắp theo vị trí từ trên xuống
    content_groups = sorted(
        content_groups,
        key=lambda group: np.mean([
            marker["cy"] for marker in group
        ])
    )

    identity_group = content_groups[0]
    part1_group = content_groups[1]
    part2_group = content_groups[2]
    part3_group = content_groups[3]

    return {
        # SBD và MĐ dùng chung các hàng số 0–9
        "sbd": identity_group,
        "md": identity_group,

        "identity": identity_group,
        "part1": part1_group,
        "part2": part2_group,
        "part3": part3_group,

        "raw_groups": raw_groups
    }

def classify_bottom_marker_groups(bottom_markers):
    """
    Chia marker dưới thành các cụm theo chiều ngang.

    Các marker đơn lẻ ngoài cùng thường là marker góc.
    Các cụm giữa thường là các nhóm cột nội dung.
    """

    raw_groups = split_markers_by_gap(
        bottom_markers,
        axis="cx",
        gap_factor=1.8
    )

    print(
        "Kích thước cụm dưới ban đầu:",
        [len(group) for group in raw_groups]
    )

    # Các nhóm có ít nhất 2 marker được xem là cụm cột
    content_groups = [
        group
        for group in raw_groups
        if len(group) >= 2
    ]

    content_groups = sorted(
        content_groups,
        key=lambda group: np.mean([
            marker["cx"] for marker in group
        ])
    )

    # Marker đơn lẻ ngoài cùng, nếu cần dùng làm biên phiếu
    singleton_groups = [
        group
        for group in raw_groups
        if len(group) == 1
    ]

    return {
        "groups": content_groups,
        "singletons": singleton_groups,
        "raw_groups": raw_groups
    }

def markers_inside_x_range(
    bottom_markers,
    x1,
    x2,
    padding=0
):
    """
    Lấy các marker dưới có tâm X nằm trong vùng [x1, x2].
    """

    left = min(x1, x2) - padding
    right = max(x1, x2) + padding

    return [
        marker
        for marker in bottom_markers
        if left <= marker["cx"] <= right
    ]

def markers_inside_y_range(
    right_markers,
    y1,
    y2,
    padding=0
):
    """
    Lấy các marker phải có tâm Y nằm trong vùng [y1, y2].
    """

    top = min(y1, y2) - padding
    bottom = max(y1, y2) + padding

    return [
        marker
        for marker in right_markers
        if top <= marker["cy"] <= bottom
    ]

def build_section_marker_groups(
    right_markers,
    bottom_markers,
    section_rois,
    padding_x=10,
    padding_y=10
):
    right_groups = classify_right_marker_groups(
        right_markers
    )

    sections = {}

    for section_name, roi in section_rois.items():
        x1, y1, x2, y2 = roi

        section_bottom = markers_inside_x_range(
            bottom_markers,
            x1,
            x2,
            padding=padding_x
        )

        # Với marker phải, ưu tiên dùng cụm đã phân loại
        if section_name == "sbd":
            section_right = right_groups["sbd"]

        elif section_name == "md":
            section_right = right_groups["md"]

        elif section_name == "part1":
            section_right = right_groups["part1"]

        elif section_name == "part2":
            section_right = right_groups["part2"]

        elif section_name == "part3":
            section_right = right_groups["part3"]

        else:
            section_right = markers_inside_y_range(
                right_markers,
                y1,
                y2,
                padding=padding_y
            )

        sections[section_name] = {
            "right_markers": section_right,
            "bottom_markers": section_bottom,

            "rows": [
                int(round(marker["cy"]))
                for marker in section_right
            ],

            "cols": [
                int(round(marker["cx"]))
                for marker in section_bottom
            ],

            "roi": roi
        }

    return sections

def draw_section_marker_groups(
    image,
    right_groups,
    bottom_groups
):
    debug = image.copy()

    colors = {
        "identity": (0, 0, 255),
        "part1": (0, 255, 0),
        "part2": (255, 0, 0),
        "part3": (255, 0, 255)
    }

    labels = {
        "identity": "SBD/MD",
        "part1": "P1",
        "part2": "P2",
        "part3": "P3"
    }

    for group_name in [
        "identity",
        "part1",
        "part2",
        "part3"
    ]:
        color = colors[group_name]
        label = labels[group_name]

        for index, marker in enumerate(
            right_groups[group_name]
        ):
            cx = int(round(marker["cx"]))
            cy = int(round(marker["cy"]))

            cv2.circle(
                debug,
                (cx, cy),
                6,
                color,
                -1
            )

            cv2.putText(
                debug,
                f"{label}-{index}",
                (max(0, cx - 75), cy),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                color,
                1
            )

    bottom_colors = [
        (0, 255, 255),
        (255, 255, 0),
        (255, 100, 100),
        (100, 255, 100),
        (100, 100, 255),
        (200, 100, 255)
    ]

    for group_index, group in enumerate(
        bottom_groups["groups"]
    ):
        color = bottom_colors[
            group_index % len(bottom_colors)
        ]

        for marker_index, marker in enumerate(group):
            cx = int(round(marker["cx"]))
            cy = int(round(marker["cy"]))

            cv2.circle(
                debug,
                (cx, cy),
                6,
                color,
                -1
            )

            cv2.putText(
                debug,
                f"X{group_index}-{marker_index}",
                (cx - 10, max(15, cy - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.35,
                color,
                1
            )

    return debug

def get_marker_info(marker):
    """
    Chuẩn hóa marker về:
        x, y, w, h, cx, cy
    """

    if isinstance(marker, dict):
        x = float(marker["x"])
        y = float(marker["y"])
        w = float(marker["w"])
        h = float(marker["h"])

        cx = float(marker.get("cx", x + w / 2.0))
        cy = float(marker.get("cy", y + h / 2.0))

    else:
        x, y, w, h = marker[:4]

        x = float(x)
        y = float(y)
        w = float(w)
        h = float(h)

        cx = x + w / 2.0
        cy = y + h / 2.0

    return {
        "x": x,
        "y": y,
        "w": w,
        "h": h,
        "cx": cx,
        "cy": cy
    }

def draw_roi_box(
    image,
    roi,
    label,
    color=(0, 255, 0),
    thickness=2
):
    """
    roi có dạng tuyệt đối:
        (x, y, w, h)
    """

    x, y, w, h = map(int, roi)

    cv2.rectangle(
        image,
        (x, y),
        (x + w, y + h),
        color,
        thickness
    )

    cv2.putText(
        image,
        label,
        (x, max(25, y - 8)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        color,
        2
    )

def build_identity_big_roi(
    image,
    identity_vertical_markers,
    width_steps=11.5,
    right_gap_steps=0.30,
    top_steps=0.65,
    bottom_steps=0.65
):
    """
    Tạo một ROI lớn bao quanh cả SBD và mã đề.

    Dựa vào:
    - 10 marker phải để xác định Y.
    - Vị trí X của marker phải để xác định cạnh phải.
    - Khoảng cách hàng để ước lượng chiều rộng vùng SBD + MĐ.

    Trả về:
        roi_img
        absolute_roi = (x, y, w, h)
        relative_roi = (xr, yr, wr, hr)
        row_step
    """

    if image is None or image.size == 0:
        raise ValueError("Ảnh không hợp lệ")

    if len(identity_vertical_markers) < 2:
        raise ValueError(
            "Không đủ marker dọc SBD/MĐ"
        )

    H, W = image.shape[:2]

    markers = sorted(
        identity_vertical_markers,
        key=lambda marker: marker["cy"]
    )

    row_centers = np.array(
        [marker["cy"] for marker in markers],
        dtype=np.float32
    )

    row_step = float(
        np.median(np.diff(row_centers))
    )

    # Mép trái của các timing mark sát phải
    marker_left_x = float(
        np.median([
            marker["x"]
            for marker in markers
        ])
    )

    # Cạnh phải của vùng SBD/MĐ nằm ngay bên trái timing marker
    x2 = (
        marker_left_x
        - right_gap_steps * row_step
    )

    # Ước lượng chiều rộng đủ chứa:
    # 6 cột SBD + khoảng cách + 3 cột mã đề
    x1 = x2 - width_steps * row_step

    y1 = (
        row_centers[0]
        - top_steps * row_step
    )

    y2 = (
        row_centers[-1]
        + bottom_steps * row_step
    )

    x1 = max(0, int(round(x1)))
    y1 = max(0, int(round(y1)))

    x2 = min(W, int(round(x2)))
    y2 = min(H, int(round(y2)))

    if x2 <= x1 or y2 <= y1:
        raise RuntimeError(
            f"ROI SBD/MĐ không hợp lệ: "
            f"{(x1, y1, x2, y2)}"
        )

    roi_w = x2 - x1
    roi_h = y2 - y1

    roi_img = image[
        y1:y2,
        x1:x2
    ]

    absolute_roi = (
        x1,
        y1,
        roi_w,
        roi_h
    )

    relative_roi = (
        x1 / float(W),
        y1 / float(H),
        roi_w / float(W),
        roi_h / float(H)
    )

    return {
        "image": roi_img,
        "absolute": absolute_roi,
        "relative": relative_roi,
        "row_step": row_step,
        "row_centers": row_centers
    }

def grade_answers(student_answers, answer_key):

    score = 0
    details = {}

    for q, correct_answer in answer_key.items():

        student_answer = student_answers.get(q, "?")

        is_correct = (student_answer == correct_answer)

        if is_correct:
            score += 1

        details[q] = {
            "student": student_answer,
            "correct": correct_answer,
            "result": is_correct
        }

    return score, details

def cat_roi(roi_result, cols, warp_img):
    # Ảnh ROI thực tế để truyền vào read_bubbles
    roi_img = roi_result["image"]

    if roi_img is None:
        raise ValueError("roi_result['image'] đang là None")

    if not isinstance(roi_img, np.ndarray):
        raise TypeError(
            "roi_result['image'] phải là numpy.ndarray, "
            f"nhưng nhận được {type(roi_img)}"
        )

    if roi_img.size == 0:
        raise ValueError("Ảnh ROI đang rỗng")

    # Đọc bubble trong ROI
    result, vis, points = read_bubbles(
        roi_img,
        cols
    )

    # Tọa độ tuyệt đối của ROI trên ảnh warp
    x, y, roi_w, roi_h = roi_result["absolute"]

    x = int(x)
    y = int(y)

    # Các điểm cx, cy đang tính theo ROI
    # Cộng thêm x, y để chuyển về ảnh warp
    for cx, cy, radius in points:
        warp_x = x + int(cx)
        warp_y = y + int(cy)

        cv2.circle(warp_img,(warp_x, warp_y),int(radius),(0, 255, 0),2)

    
    cv2.imshow("ROI", vis)

    return result, vis

def cluster_line_positions(indices, max_gap=3):
    """
    Gom các pixel liền nhau của một đường dày thành một tọa độ tâm.
    """

    indices = np.asarray(indices, dtype=np.int32)

    if indices.size == 0:
        return []

    groups = [[int(indices[0])]]

    for value in indices[1:]:
        value = int(value)

        if value - groups[-1][-1] <= max_gap:
            groups[-1].append(value)
        else:
            groups.append([value])

    return [
        float(np.mean(group))
        for group in groups
    ]

def select_regular_lines(positions, expected_count):
    """
    Trong nhiều đường phát hiện được, chọn một cụm gồm expected_count
    đường có khoảng cách đều nhau nhất.
    """

    positions = sorted(positions)

    if len(positions) < expected_count:
        return None

    best_run = None
    best_score = float("inf")

    for start in range(
        len(positions) - expected_count + 1
    ):
        run = np.array(
            positions[start:start + expected_count],
            dtype=np.float32
        )

        gaps = np.diff(run)

        if len(gaps) == 0:
            continue

        median_gap = float(np.median(gaps))

        if median_gap <= 0:
            continue

        # Sai lệch khoảng cách giữa các đường
        regularity = float(
            np.mean(
                np.abs(gaps - median_gap)
            )
            / median_gap
        )

        # Ưu tiên cụm có tổng chiều dài lớn hơn
        span = float(run[-1] - run[0])

        score = regularity - span * 0.0001

        if score < best_score:
            best_score = score
            best_run = run

    return best_run

def choose_outer_pair(
    positions,
    image_length,
    min_span_ratio=0.55
):
    """
    Chọn hai đường ngoài cùng có khoảng cách đủ lớn.
    """

    positions = sorted(
        float(value)
        for value in positions
    )

    if len(positions) < 2:
        return None

    best_pair = None
    best_span = -1.0

    for i in range(len(positions) - 1):
        for j in range(i + 1, len(positions)):
            span = positions[j] - positions[i]

            if span < image_length * min_span_ratio:
                continue

            if span > best_span:
                best_span = span
                best_pair = (
                    positions[i],
                    positions[j]
                )

    return best_pair

def find_grid_rectangle(thresh, cols, rows=10, show_debug=False):
    if thresh is None or thresh.size == 0:
        return None

    image_h, image_w = thresh.shape[:2]

    # Nối các đường bị đứt nhẹ
    work = cv2.morphologyEx( thresh, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8), iterations=1)

    # =====================================================
    # 1. TÁCH ĐƯỜNG NGANG
    # =====================================================

    horizontal_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (
            max(8, int(image_w * 0.25)),
            1
        )
    )

    horizontal_mask = cv2.morphologyEx( work, cv2.MORPH_OPEN, horizontal_kernel)

    # =====================================================
    # 2. TÁCH ĐƯỜNG DỌC
    # =====================================================

    vertical_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (
            1,
            max(12, int(image_h * 0.25))
        )
    )

    vertical_mask = cv2.morphologyEx( work, cv2.MORPH_OPEN, vertical_kernel)

    

    # =====================================================
    # 3. CHIẾU PIXEL ĐỂ TÌM TỌA ĐỘ ĐƯỜNG
    # =====================================================

    horizontal_projection = np.count_nonzero(
        horizontal_mask,
        axis=1
    )

    vertical_projection = np.count_nonzero(
        vertical_mask,
        axis=0
    )

    horizontal_indices = np.where(
        horizontal_projection >= image_w * 0.40
    )[0]

    vertical_indices = np.where(
        vertical_projection >= image_h * 0.40
    )[0]

    horizontal_positions = cluster_line_positions(
        horizontal_indices,
        max_gap=3
    )

    vertical_positions = cluster_line_positions(
        vertical_indices,
        max_gap=3
    )

    print(
        "Các đường ngang phát hiện:",
        [round(value, 1) for value in horizontal_positions]
    )

    print(
        "Các đường dọc phát hiện:",
        [round(value, 1) for value in vertical_positions]
    )

    # Bảng 10 hàng cần 11 đường ngang
    selected_horizontal = select_regular_lines(
        horizontal_positions,
        expected_count=rows + 1
    )

    # Bảng cols cột cần cols + 1 đường dọc
    selected_vertical = select_regular_lines(
        vertical_positions,
        expected_count=cols + 1
    )

    if selected_horizontal is None:
        print(
            f"Không tìm đủ {rows + 1} đường ngang"
        )
        return None

    if selected_vertical is None:
        print(
            f"Không tìm đủ {cols + 1} đường dọc"
        )
        return None

    x1 = int(round(selected_vertical[0]))
    x2 = int(round(selected_vertical[-1]))

    y1 = int(round(selected_horizontal[0]))
    y2 = int(round(selected_horizontal[-1]))

    if x2 <= x1 or y2 <= y1:
        return None

    debug = cv2.cvtColor(
        thresh,
        cv2.COLOR_GRAY2BGR
    )

    # Đường ngang được chọn
    for y in selected_horizontal:
        y = int(round(y))

        cv2.line(debug,(x1, y),(x2, y),(0, 255, 0), 1)

    # Đường dọc được chọn
    for x in selected_vertical:
        x = int(round(x))

        cv2.line(
            debug,
            (x, y1),
            (x, y2),
            (0, 255, 255),
            1
        )

    cv2.rectangle(
        debug,
        (x1, y1),
        (x2, y2),
        (255, 255, 0),
        2
    )

    if show_debug:
        cv2.imshow("HORIZONTAL MASK",horizontal_mask)

        cv2.imshow( "VERTICAL MASK", vertical_mask)

        cv2.imshow("GRID FRAME DEBUG",debug)

    

    return {
        "x": x1,
        "y": y1,
        "w": x2 - x1,
        "h": y2 - y1,
        "x2": x2,
        "y2": y2,
        "horizontal_lines": selected_horizontal,
        "vertical_lines": selected_vertical
    }

def read_bubbles(roi_img, cols):
    rows = 10
    result = ""
    selected_points = []

    if roi_img is None:
        raise ValueError("roi_img đang là None")

    if not isinstance(roi_img, np.ndarray):
        raise TypeError(
            f"roi_img phải là numpy.ndarray, nhận được {type(roi_img)}"
        )

    if roi_img.size == 0:
        raise ValueError("roi_img đang rỗng")

    img_result = roi_img.copy()

    # =====================================================
    # 1. TIỀN XỬ LÝ
    # =====================================================

    gray = cv2.cvtColor(roi_img,cv2.COLOR_BGR2GRAY)

    low_quality = (dpi_info["dpi"] < 100 or ink_info["score"] < 56)

    if low_quality:
        blurred = cv2.GaussianBlur(gray,(3, 3),0)
        block_size = 21
        threshold_c = 6

    else:
        blurred = cv2.GaussianBlur(gray,(5, 5),0)
        block_size = 41
        threshold_c = 12

    thresh = cv2.adaptiveThreshold(blurred,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,block_size,threshold_c)

    # Nối các đoạn khung và bubble bị đứt
    kernel = np.ones( (2, 2), dtype=np.uint8)

    thresh = cv2.morphologyEx(thresh,cv2.MORPH_CLOSE,kernel)

    cv2.imshow( "Bubble threshold",thresh)

    # =====================================================
    # 2. TÌM CONTOUR
    # Chỉ dùng để tìm khung chữ nhật lớn
    # =====================================================

    contours, _ = cv2.findContours( thresh.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    print("Tổng contour =", len(contours))

    for c in contours:
        x, y, w, h = cv2.boundingRect(c) 
        area = cv2.contourArea(c) 
        peri = cv2.arcLength(c, True) 
        if peri == 0: 
            continue 
        circularity = 4*np.pi*area/(peri*peri) 
        approx = cv2.approxPolyDP(c, 0.025 * peri, True) 
        extent = area / float(w * h) 
        aspect_ratio = w / float(h) 

        cx = x + w//2 
        cy = y + h//2 
        # cv2.circle(img_result,(cx,cy),5,(0,0,255),-1) 
        # cv2.drawContours(img_result,[c],-1,(0,255,0),2)

    large_rect = find_grid_rectangle(
        thresh=thresh,
        cols=cols,
        rows=10,
        show_debug=True
    )

    if large_rect is None:
        error_message_1 = "LOI NHAN DANG"
        error_message_2 = "KHONG XAC DINH DUOC KHUNG BUBBLE"

        image_h, image_w = img_result.shape[:2]

        # Tạo lớp phủ để thông báo dễ nhìn
        overlay = img_result.copy()

        banner_x1 = 5
        banner_y1 = 5
        banner_x2 = image_w - 5
        banner_y2 = min(image_h - 1, 75)

        cv2.rectangle(
            overlay,
            (banner_x1, banner_y1),
            (banner_x2, banner_y2),
            (0, 0, 255),
            -1
        )

        # Làm nền đỏ hơi trong suốt
        img_result = cv2.addWeighted(
            overlay,
            0.7,
            img_result,
            0.3,
            0
        )

        cv2.putText(
            img_result,
            error_message_1,
            (12, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2
        )

        cv2.putText(
            img_result,
            error_message_2,
            (12, 58),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.38,
            (255, 255, 255),
            1
        )

        print("Không xác định được khung bảng bubble")

        cv2.namedWindow(
            "BUBBLE DETECTION ERROR",
            cv2.WINDOW_NORMAL
        )

        cv2.resizeWindow(
            "BUBBLE DETECTION ERROR",
            500,
            700
        )

        cv2.imshow(
            "BUBBLE DETECTION ERROR",
            img_result
        )

        # Có thể lưu ảnh lỗi để kiểm tra sau
        cv2.imwrite(
            f"bubble_frame_error_{cols}_cols.jpg",
            img_result
        )

        # Không làm chương trình bị dừng
        return "?" * cols, img_result, []

    frame_x = large_rect["x"]
    frame_y = large_rect["y"]
    frame_x2 = large_rect["x2"]
    frame_y2 = large_rect["y2"]

    frame_w = large_rect["w"]
    frame_h = large_rect["h"]

    cv2.rectangle(
        img_result,
        (frame_x, frame_y),
        (frame_x2, frame_y2),
        (160, 0, 0),
        2
    )

    # =====================================================
    # 3. BỎ ĐỘ DÀY ĐƯỜNG VIỀN KHUNG
    # =====================================================

    cell_w_guess = frame_w / float(cols)
    cell_h_guess = frame_h / float(rows)

    cell_size_guess = min(
        cell_w_guess,
        cell_h_guess
    )

    # Bỏ vài pixel đường viền để tâm không bị ảnh hưởng
    frame_inset = max(
        1,
        int(round(cell_size_guess * 0.05))
    )

    inner_x1 = frame_x + frame_inset
    inner_y1 = frame_y + frame_inset

    inner_x2 = frame_x2 - frame_inset
    inner_y2 = frame_y2 - frame_inset

    inner_w = inner_x2 - inner_x1
    inner_h = inner_y2 - inner_y1

    if inner_w <= 0 or inner_h <= 0:
        raise ValueError(
            "Khung bên trong không hợp lệ"
        )

    # =====================================================
    # 4. CHIA KHUNG THÀNH 10 HÀNG × cols CỘT
    # =====================================================

    cell_w = inner_w / float(cols)
    cell_h = inner_h / float(rows)

    centers = []

    for row_index in range(rows):
        row = []

        cy = (
            inner_y1
            + (row_index + 0.5) * cell_h
        )

        for col_index in range(cols):
            cx = (
                inner_x1
                + (col_index + 0.5) * cell_w
            )

            point = (
                int(round(cx)),
                int(round(cy))
            )

            row.append(point)

            # Tâm bubble dự kiến
            cv2.circle(
                img_result,
                point,
                3,
                (0, 0, 255),
                -1
            )

        centers.append(row)

    # =====================================================
    # 5. TÍNH BÁN KÍNH VÙNG ĐO
    # =====================================================

    cell_size = min(
        cell_w,
        cell_h
    )

    # Chỉ đo phần trong bubble, tránh viền vòng tròn
    if low_quality:
        radius_ratio = 0.22
    else:
        radius_ratio = 0.20

    radius = max(
        2,
        int(round(cell_size * radius_ratio))
    )

    print("Cell width:", round(cell_w, 2))
    print("Cell height:", round(cell_h, 2))
    print("Radius:", radius)

    # =====================================================
    # 6. ĐỌC TỪNG CỘT
    # Mỗi cột chọn một số từ 0 đến 9
    # =====================================================

    if low_quality:
        min_fill_ratio = 0.10
        min_second_gap = 0.015
        min_baseline_gap = 0.025
    else:
        min_fill_ratio = 0.14
        min_second_gap = 0.025
        min_baseline_gap = 0.035

    for col_index in range(cols):
        fill_scores = []

        for row_index in range(rows):
            cx, cy = centers[row_index][col_index]

            mask = np.zeros(
                thresh.shape,
                dtype=np.uint8
            )

            # Bắt buộc phải vẽ vùng đo lên mask
            cv2.circle(
                mask,
                (cx, cy),
                radius,
                255,
                -1
            )

            filled_image = cv2.bitwise_and(
                thresh,
                thresh,
                mask=mask
            )

            filled = cv2.countNonZero(
                filled_image
            )

            mask_area = cv2.countNonZero(
                mask
            )

            fill_ratio = (
                filled / float(mask_area)
                if mask_area > 0
                else 0.0
            )

            fill_scores.append(fill_ratio)

            # Vẽ vùng đang đo
            # cv2.circle(
            #     img_result,
            #     (cx, cy),
            #     radius,
            #     (255, 255, 0),
            #     1
            # )

        best_row = int(
            np.argmax(fill_scores)
        )

        best_score = float(
            fill_scores[best_row]
        )

        sorted_scores = sorted(
            fill_scores,
            reverse=True
        )

        second_score = (
            float(sorted_scores[1])
            if len(sorted_scores) >= 2
            else 0.0
        )

        baseline_score = float(
            np.median(fill_scores)
        )

        print(
            f"Cột {col_index}:",
            "scores =",
            [
                round(score, 3)
                for score in fill_scores
            ],
            "best =",
            best_row,
            round(best_score, 3)
        )

        is_selected = (
            best_score >= min_fill_ratio
            and best_score - second_score >= min_second_gap
            and best_score - baseline_score >= min_baseline_gap
        )

        if is_selected:
            result += str(best_row)

            cx, cy = centers[best_row][col_index]

            selected_points.append(
                (cx, cy, radius)
            )

            cv2.circle(img_result,(cx, cy),radius,(0, 255, 0),2)

            cv2.putText(img_result,str(best_row),(cx - 5, cy - radius - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.4,(0, 255, 0),1)

        else:
            result += "?"

    return result, img_result, selected_points

def read_part1(part1_roi, rows, cols, answer_key_1, img=None, offset_x=0, offset_y=0, start_question=1):

    selected_points = []

    debug = part1_roi.copy()

    gray = cv2.cvtColor(part1_roi, cv2.COLOR_BGR2GRAY)

    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,10)

    kernel = np.ones((3,3), np.uint8)

    thresh = cv2.morphologyEx(thresh,cv2.MORPH_CLOSE,kernel)

    cnts, _ = cv2.findContours(thresh,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)

    bubbles = []

    centers = []

    for c in cnts:

        area = cv2.contourArea(c)

        if area < 80 or area > 1200:
            continue

        peri = cv2.arcLength(c, True)

        if peri == 0:
            continue

        circularity = 4*np.pi*area/(peri*peri)

        x,y,w,h = cv2.boundingRect(c)

        ratio = w / float(h)

        if  ratio < 2 and circularity > 0.9:

            cx = x + w//2
            cy = y + h//2
            
            if not ( cy < 0.95*H):
                continue

            bubbles.append((cx,cy,w,h))
            

    lefts   = [cx-w//2 for cx,cy,w,h in bubbles]
    rights  = [cx+w//2 for cx,cy,w,h in bubbles]
    tops    = [cy-h//2 for cx,cy,w,h in bubbles]
    bottoms = [cy+h//2 for cx,cy,w,h in bubbles]

    # print("Contours =", len(cnts))
    # print("Bubbles =", len(bubbles))

    grid_x1 = min(lefts)
    grid_x2 = max(rights)

    grid_y1 = min(tops)
    grid_y2 = max(bottoms)

    avg_w = int(np.median([w for _,_,w,_ in bubbles]))

    pad = int(avg_w * 0.6)

    grid_x1 -= pad
    grid_x2 += pad

    grid_y1 -= pad
    grid_y2 += pad

    # cv2.rectangle( debug,(grid_x1,grid_y1),(grid_x2,grid_y2),(255,0,0),2)

    rows = 10
    cols = 4

    grid_w = grid_x2 - grid_x1
    grid_h = grid_y2 - grid_y1

    cell_w = grid_w / cols
    cell_h = grid_h / rows

    centers = []

    for r in range(rows):

        row_centers = []

        cy = int(grid_y1 +(r + 0.5) * cell_h)

        for c in range(cols):

            cx = int(grid_x1 +(c + 0.5) * cell_w)

            row_centers.append((cx,cy))

            # cv2.circle(debug,(cx,cy), 5,(0,0,255),-1)

        centers.append(row_centers)

    answers = {}

    letters = ['A','B','C','D']

    MIN_FILL = 40

    for r in range(rows):

        best_fill = 0
        best_col = -1

        for c in range(cols):

            cx, cy = centers[r][c]

            radius = int(avg_w * 0.45)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx, cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            if filled > best_fill:
                best_fill = filled
                best_col = c

            cv2.circle(debug,(cx,cy),radius,(0,255,255),1)

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            # tô > 35%
            marked = ratio_fill > 0.6

            color = (0,255,0) if marked else (0,255,255)

            cv2.circle(debug,(cx,cy),radius,color,2)
        
        # print(f"Row {r+1}",best_fill,best_col)

        if best_fill >= MIN_FILL:
            question_no = start_question + r

            answers[question_no] = letters[best_col]

            # answers[r + 1] = letters[best_col]

            gx, gy = centers[r][best_col]

            student_answer = letters[best_col]

            correct_answer = answer_key_1.get(str(question_no))

            is_correct = (student_answer == correct_answer)

            correct_col = letters.index(correct_answer)

            correct_cx, correct_cy = centers[r][correct_col]

            selected_points.append((r,student_answer,gx,gy,radius,is_correct, correct_cx, correct_cy))
        else:
            question_no = start_question + r

            # answers[r + 1] = "?"

        # ===== DUYET ĐÁP AN =====

    # for q, ans in answers.items():
    #     print(f"Cau {q}: {ans}")
    
    return answers, debug, selected_points

def build_part2_grid(block_img , answer_key_2, cols=4, start_question = 1):

    selected_points = []

    correct_points = []

    debug = block_img.copy()

    gray = cv2.cvtColor(block_img, cv2.COLOR_BGR2GRAY)

    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,10)

    kernel = np.ones((3,3), np.uint8)

    thresh = cv2.morphologyEx(thresh,cv2.MORPH_CLOSE,kernel)

    cnts, _ = cv2.findContours(thresh,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)

    bubbles = []

    centers = []

    for c in cnts:

        area = cv2.contourArea(c)

        if area < 80 or area > 1200:
            continue

        peri = cv2.arcLength(c, True)

        if peri == 0:
            continue

        circularity = 4*np.pi*area/(peri*peri)

        x,y,w,h = cv2.boundingRect(c)

        ratio = w / float(h)

        if  ratio < 1.4 and circularity > 0.75:

            cx = x + w//2
            cy = y + h//2
            
            if not ( cy < 0.95*H):
                continue

            bubbles.append((cx,cy,w,h))

    bubble_points = []

    for cx,cy,w,h in bubbles:
        bubble_points.append((cx,cy))

    print("Tong contour =", len(cnts))
    print("Tong bubble =", len(bubbles))

    if len(bubbles) == 0:
        raise Exception("Không tìm thấy bubble")

    lefts   = [cx-w//2 for cx,cy,w,h in bubbles]
    rights  = [cx+w//2 for cx,cy,w,h in bubbles]
    tops    = [cy-h//2 for cx,cy,w,h in bubbles]
    bottoms = [cy+h//2 for cx,cy,w,h in bubbles]

    grid_x1 = min(lefts)
    grid_x2 = max(rights)

    grid_y1 = min(tops)
    grid_y2 = max(bottoms)

    avg_w = int(np.median([w for _,_,w,_ in bubbles]))

    pad = int(avg_w * 0.6)

    grid_x1 -= pad
    grid_x2 += pad

    grid_y1 -= pad
    grid_y2 += pad

    ys = sorted([cy for cx,cy in bubble_points])

    rows_y = []

    for y in ys:
        if len(rows_y) == 0:
            rows_y.append([y])
        elif abs(y - np.mean(rows_y[-1])) < 15:
            rows_y[-1].append(y)
        else:
            rows_y.append([y])

    rows_y = [int(np.mean(r)) for r in rows_y]

    # print("rows_y =", rows_y)

    # for cx,cy,w,h in bubbles:
    #     cv2.circle(debug,(cx,cy),3,(0,0,255),-1)
    #     print(cx,cy,w,h)
    # cv2.rectangle(debug, (grid_x1,grid_y1), (grid_x2,grid_y2), (255,0,0),2)
    # cols = 4

    grid_w = grid_x2 - grid_x1
    cell_w = grid_w / cols

    result = []

    row_result_q1 = []
    row_result_q2 = []

    answers = {start_question: {},start_question + 1: {}}

    choices = ['a', 'b', 'c', 'd']

    for r, cy in enumerate(rows_y):
        row_answer = []
        temp_data = []

        q1_row = ""
        q2_row = ""

        question1 = start_question
        question2 = start_question + 1

        print("question1 =", question1)
        print("question2 =", question2)
        print(answer_key_2.keys())

        choice = choices[r]

        for c in range(cols):

            cx = int(grid_x1 + (c + 0.5) * cell_w)

            radius = int(avg_w * 0.45)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx, cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            temp_data.append((cx, cy, radius, filled))

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            if str(question1) not in answer_key_2:
                continue

            if str(question2) not in answer_key_2:
                continue

            if c == 0 and answer_key_2[str(question1)].get(choice, False):
                correct_points.append((cx, cy, radius))

            elif c == 1 and not answer_key_2[str(question1)].get(choice, False):
                correct_points.append((cx, cy, radius))

            elif c == 2 and answer_key_2[str(question2)].get(choice, False):
                correct_points.append((cx, cy, radius))

            elif c == 3 and not answer_key_2[str(question2)].get(choice, False):
                correct_points.append((cx, cy, radius))

            # tô > 35%
            marked = ratio_fill > 0.6

            row_answer.append(marked)

            if marked:
                color = (0,255,0)  

                if c == 0:
                    q1_row = "Đ"
                    
                    is_correct = answer_key_2[str(question1)].get(choice, False)

                elif c == 1:
                    q1_row = "S"

                    is_correct = not answer_key_2[str(question1)].get(choice, False)

                elif c == 2:
                    q2_row = "Đ"

                    is_correct = answer_key_2[str(question2)].get(choice, False)


                elif c == 3:
                    q2_row = "S"

                    is_correct = not answer_key_2[str(question2)].get(choice, False)

                selected_points.append((r,c,cx,cy,radius,is_correct))
            else:
                color = (0,255,255)     
            
            cv2.circle(debug,(cx,cy),radius,color,2)
            # cv2.putText(debug,f"{ratio_fill:.2f}",(cx-15, cy-10),cv2.FONT_HERSHEY_SIMPLEX,0.4,(255,0,0),1)

        answers[question1][r] = q1_row
        answers[question2][r] = q2_row
        
        

            
    return answers, debug, selected_points, correct_points

def build_part3_grid(block_img, answer_key_3, question_no, rows=11, cols=4):

    selected_points = []

    debug = block_img.copy()

    gray = cv2.cvtColor(block_img, cv2.COLOR_BGR2GRAY)

    thresh = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,10)

    kernel = np.ones((3,3), np.uint8)

    thresh = cv2.morphologyEx(thresh,cv2.MORPH_CLOSE,kernel)

    cnts, _ = cv2.findContours(thresh,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)

    bubbles = []

    centers = []

    H, W = block_img.shape[:2]

    for c in cnts:

        area = cv2.contourArea(c)

        if area < 80 or area > 1200:
            continue

        peri = cv2.arcLength(c, True)

        if peri == 0:
            continue

        circularity = 4*np.pi*area/(peri*peri)

        x,y,w,h = cv2.boundingRect(c)

        ratio = w / float(h)

        if  ratio < 1.4 and circularity > 0.85:

            cx = x + w//2
            cy = y + h//2
            
            if not ( cy < 0.95*H):
                continue

            bubbles.append((cx,cy,w,h))

    bubble_points = []

    for cx,cy,w,h in bubbles:
        bubble_points.append((cx,cy))

    print("Tong contour =", len(cnts))
    print("Tong bubble =", len(bubbles))

    if len(bubbles) == 0:
        raise Exception("Không tìm thấy bubble")

    bubble_points = sorted(bubble_points,key=lambda p: p[0])

    xs = [p[0] for p in bubble_points]
    ys = [p[1] for p in bubble_points]

    # gom 4 cột
    cols_x = []

    for x in sorted(xs):
        if len(cols_x) == 0:
            cols_x.append([x])
        elif abs(x - np.mean(cols_x[-1])) < 15:
            cols_x[-1].append(x)
        else:
            cols_x.append([x])

    cols_x = [int(np.mean(c)) for c in cols_x]

    print("cols_x =", cols_x)

    # gom 10 hàng
    rows_y = []
    for y in sorted(ys):
        if len(rows_y) == 0:
            rows_y.append([y])
        elif abs(y - np.mean(rows_y[-1])) < 12:
            rows_y[-1].append(y)
        else:
            rows_y.append([y])

    rows_y = [int(np.mean(r)) for r in rows_y]
    print("rows_y =", rows_y)
    
    result = []

    digits = [""] * 4

    minus = False
    comma_pos = -1

    avg_w = int(np.median([w for _,_,w,_ in bubbles]))

    for r, cy in enumerate(rows_y):

        row_answer = []

        best_fill = 0
        best_col = -1

        temp_data = []

        for c, cx in enumerate(cols_x):

            radius = int(avg_w * 0.45)

            mask = np.zeros(thresh.shape,dtype=np.uint8)

            cv2.circle(mask,(cx,cy),radius,255,-1)

            bubble_region = cv2.bitwise_and(thresh,mask)

            filled = cv2.countNonZero(bubble_region)

            temp_data.append((cx,cy,radius,filled))

            if filled > best_fill:
                best_fill = filled
                best_col = c

            area_circle = np.pi * radius * radius

            ratio_fill = filled / area_circle

            # tô > 35%
            marked = ratio_fill > 0.6

            row_answer.append(marked)

            if marked:
                color = (0,255,0)
                # dấu âm
                if r == 0:
                    minus = True
                # dấu phẩy
                elif r == 1:
                    comma_pos = c
                # chữ số
                else:
                    digits[c] = str(r - 2)

                selected_points.append((r,c,cx,cy,radius))
            else:
                color = (0,255,255)  
            
            cv2.circle(debug,(cx,cy),radius,color,2)

        result.append(row_answer)

        answer_str = "".join(digits)

        if comma_pos != -1:
            answer_str = (
                answer_str[:comma_pos]
                + ","
                + answer_str[comma_pos:]
            )
        if minus:
            answer_str = "-" + answer_str

        correct_answer = answer_key_3[str(question_no)]

        is_correct = (answer_str == correct_answer)

    return answer_str, debug, selected_points, is_correct

def crop_relative(img, roi):

    H, W = img.shape[:2]

    xr, yr, wr, hr = roi

    x = int(xr * W)
    y = int(yr * H)

    w = int(wr * W)
    h = int(hr * H)

    return img[y:y+h, x:x+w]

img_original  = cv2.imread(r'C:\Users\Admin\Downloads\Project_1\backend\data\data4 7-18-2026\PhieuQG.0073.jpg')

folder = r"C:\Users\Admin\Downloads\Project_1\backend\data\data4 7-18-2026"
image_files = []
image_files.extend(glob.glob(os.path.join(folder, "*.jpg")))
for file_path in image_files:
    img_original = cv2.imread(file_path)
    file_name = os.path.basename(file_path)
    print("anh ", file_name)

    img = img_original.copy()   # xử lý
    img_debug   = img_original.copy()   # vẽ debug

    gray = cv2.cvtColor(img_original, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))

    gray = clahe.apply(gray)

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 15)
        
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    edged = cv2.Canny(thresh, 75, 200)


    # cv2.namedWindow('Canny Edges', cv2.WINDOW_NORMAL)

    cv2.namedWindow("Canny Edges",cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Canny Edges",1000,1400)
    cv2.imshow("Canny Edges",edged)

    dpi_info = estimate_a4_dpi(img)

    print("Kích thước ảnh:", dpi_info["width"], "x", dpi_info["height"])
    print("DPI ngang:", round(dpi_info["dpi_x"], 2))
    print("DPI dọc:", round(dpi_info["dpi_y"], 2))
    print("DPI ước tính:", round(dpi_info["dpi"], 2))
    print("Phân loại:", dpi_info["message"])

    ink_info = estimate_page_ink_strength(
    img,
    normalize_width=1000,
    exclude_timing_edges=True,
    show_debug=True
    )

    print("Điểm độ đậm:", round(ink_info["score"], 2))
    print("Tỷ lệ nét mực:", round(ink_info["coverage"], 2), "%")
    print("Mức:", ink_info["level"])
    print("Đánh giá:", ink_info["message"])

    warp = img.copy()

    if dpi_info["dpi"] > 100:
        new_w, new_h = 1200, 1600
        warp = cv2.resize(img, (new_w, new_h))

    H, W = img.shape[:2]



    # 8. MARKER ĐIỂM NEO VÀ CẮT ROI

    warp_gray = cv2.cvtColor(warp, cv2.COLOR_BGR2GRAY)

    warp_blur = cv2.GaussianBlur(warp_gray, (5,5), 0)

    warp_thresh = cv2.adaptiveThreshold( warp_blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 10)

    # warp_thresh = cv2.threshold(warp_blur, 150, 255, cv2.THRESH_BINARY_INV)

    cnts, _ = cv2.findContours( warp_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    warp_debug = warp.copy()
    cv2.drawContours(warp_debug,cnts,-1,(0, 255, 0),2)   
    cv2.namedWindow("Contours", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Contours", 800, 1000)
    cv2.imshow("Contours", warp_debug)

    result = findMarker(
        warp,
        right_region_ratio=0.82,
        bottom_region_ratio=0.88,
        show_debug=True)

    right_markers = result["right_markers"]
    bottom_markers = result["bottom_markers"]

    right_groups = classify_right_marker_groups(
        right_markers
    )

    bottom_groups = classify_bottom_marker_groups(bottom_markers)

    print(
        "SBD/MĐ:",
        [
            int(round(marker["cy"]))
            for marker in right_groups["identity"]
        ]
    )

    print(
        "Phần I:",
        [
            int(round(marker["cy"]))
            for marker in right_groups["part1"]
        ]
    )

    group_debug = draw_section_marker_groups(
        warp,
        right_groups,
        bottom_groups
    )

    cv2.namedWindow("MARKER GROUPS",cv2.WINDOW_NORMAL)
    cv2.resizeWindow("MARKER GROUPS",800,1000)
    cv2.imshow("MARKER GROUPS",group_debug)

    # ===============================
    # TÌNH ROI TUONG DOI
    # ===============================
    right_groups = classify_right_marker_groups(
        right_markers
    )

    identity_vertical_markers = (
        right_groups["identity"]
    )

    sbd_result = build_identity_big_roi(
        image=warp,
        identity_vertical_markers=identity_vertical_markers,
        width_steps=5.5,
        right_gap_steps=3.8,   # khoảng cách cạnh phải với timing marker
        top_steps=0.7,         # mở rộng lên trên
        bottom_steps=0.8
    )

    md_result = build_identity_big_roi(
        image=warp,
        identity_vertical_markers=identity_vertical_markers,
        width_steps=3,
        right_gap_steps=0.5,   # khoảng cách cạnh phải với timing marker
        top_steps=0.7,         # mở rộng lên trên
        bottom_steps=0.8 
    )

    md_roi = md_result["image"]
    sbd_roi = sbd_result["image"]

    cv2.imshow("MD ROI",md_roi)
    cv2.imshow("SBD OI",sbd_roi)


    # =========================================================
    # VẼ KHUNG ROI LÊN ẢNH WARP
    # =========================================================

    # absolute có dạng: (x, y, width, height)
    x, y, roi_w, roi_h = sbd_result["absolute"]
    cv2.rectangle(warp,(int(x), int(y)),(int(x + roi_w), int(y + roi_h)),(0, 0, 255), 3)

    x, y, roi_w, roi_h = md_result["absolute"]
    cv2.rectangle(warp,(int(x), int(y)),(int(x + roi_w), int(y + roi_h)),(0, 0, 255), 3)


    md, md_vis = cat_roi(md_result,3,warp) 
    sbd, sbd_vis = cat_roi(sbd_result,6,warp)


    print("SỐ BÁO DANH:", sbd)
    # print("MÃ ĐỀ:", md)

    cv2.namedWindow("warp", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("warp", 800, 1000)
    cv2.imshow("warp", warp)


    # # ===============================
    # # MD
    # # ===============================

    # md_x1 = int(mx1 - 4.8*marker_w)
    # md_x2 = int(mx1 + 0.1*marker_w)

    # md_y1 = int(my1 + 0.1*marker_h)
    # md_y2 = int(my2 + 0.15*marker_h)

    # # chống vượt biên
    # md_x1=max(10,md_x1)
    # md_y1=max(0,md_y1)

    # md_x2=min(W,md_x2)
    # md_y2=min(H,md_y2)

    # md_x1=clamp(md_x1,0,W)
    # md_x2=clamp(md_x2,0,W)
    # md_y1=clamp(md_y1,0,H)
    # md_y2=clamp(md_y2,0,H)

    # md_roi = warp[
    #     md_y1:md_y2,
    #     md_x1:md_x2
    # ]

    # cv2.rectangle( warp, (md_x1,md_y1), (md_x2,md_y2), (0,255,0), 3)

    # # ===============================
    # # SBD
    # # ===============================

    # sbd_x1 = int(mx1 - 13*marker_w)
    # sbd_x2 = int(mx1 - 4.8*marker_w)

    # sbd_y1 = int(my1 + 0.1*marker_h)
    # sbd_y2 = int(my2 + 0.15*marker_h)

    # sbd_x1=max(0,sbd_x1)
    # sbd_y1=max(0,sbd_y1)

    # sbd_x2=min(W,sbd_x2)
    # sbd_y2=min(H,sbd_y2)

    # sbd_x1=clamp(sbd_x1,0,W)
    # sbd_x2=clamp(sbd_x2,0,W)
    # sbd_y1=clamp(sbd_y1,0,H)
    # sbd_y2=clamp(sbd_y2,0,H)

    # sbd_roi = warp[ sbd_y1:sbd_y2, sbd_x1:sbd_x2]

    # cv2.rectangle( warp, (sbd_x1,sbd_y1), (sbd_x2,sbd_y2), (0,0,255), 3)


    # # ===============================
    # # ĐỌC MÃ ĐỀ
    # # ===============================

    # if md_roi.size==0:
    #     raise Exception("ROI mã đề rỗng")

    # if sbd_roi.size==0:
    #     raise Exception("ROI SBD rỗng")

    # md_rows = [
    #     y - md_y1
    #     for y in timing_rows
    #     if md_y1 <= y <= md_y2
    # ]

    # print("MD rows =", len(md_rows))
    # print(md_rows)
    # ma_de, md_vis, selected_points_md = read_bubbles( md_roi, cols=4, timing_rows=md_rows)

    # for cx, cy, r in selected_points_md:

    #     wx = md_x1 + cx
    #     wy = md_y1 + cy

    #     cv2.circle(img_kq,(wx, wy),r,(0,255,0),3)


    # cv2.imshow( "MA DE", md_vis)
    # print(ma_de)
    # # ===============================
    # # ĐỌC SBD
    # # ===============================

    # sbd_rows = [
    #     y - sbd_y1
    #     for y in timing_rows
    #     if sbd_y1 <= y <= sbd_y2
    # ]

    # print("SBD rows =", len(sbd_rows))
    # print(sbd_rows)
    # sbd1, sbd_vis, selected_points_sbd = read_bubbles(sbd_roi,cols=8,timing_rows=sbd_rows)

    # for cx, cy, r in selected_points_sbd:

    #     wx = sbd_x1 + cx
    #     wy = sbd_y1 + cy

    #     cv2.circle(img_kq,(wx, wy),r,(0,255,0),3)

    # cv2.imshow("SBD RESULT",sbd_vis)



    # with open("answers.json", "r", encoding="utf-8") as f:
    #     exams = json.load(f)

    # answer_key = exams.get(ma_de)

    # if answer_key is None:
    #     print("Không tìm thấy mã đề:", ma_de)
    #     exit()

    # print("DAP AN")
    # print(exams)

    # md_answer_key =  exams[ma_de]
    # answer_key_part1 = md_answer_key['mcq']
    # answer_key_2 = md_answer_key['tf']
    # answer_key_3 = md_answer_key['essay']
    # print(answer_key_3)

    # # ===============================
    # # PHẦN 1
    # # ===============================

    # for c in cnts:
    #     peri = cv2.arcLength(c, True)
    #     if peri == 0: continue
        
    #     approx = cv2.approxPolyDP(c, 0.025 * peri, True)
    #     area = cv2.contourArea(c)
        
    #     # 2. RÚT RA NGOÀI: Tính toán chung cho mọi hình có diện tích vừa phải
    #     if 0 < area < 3000:
    #         x, y, w, h = cv2.boundingRect(c)
    #         if w == 0 or h == 0: continue
                
    #         aspect_ratio = w / float(h)
    #         rect_area = w * h
    #         extent = area / float(rect_area)
    #         circularity = (4 * math.pi * area) / (peri * peri)

    #         # 3. NGÃ RẼ 1: NỐT VUÔNG ĐIỂM NEO
    #         if 4 <= len(approx) <= 8  and 0.8 <= aspect_ratio <= 1.9 and circularity < 0.85 and extent > 0.75:
    #             markers.append(approx)
    #             # cv2.drawContours(warp, [approx], -1, (0, 0, 255), 2) # Viền Đỏ

    # centers_3 = []

    # for m in markers:

    #     M = cv2.moments(m)

    #     if M["m00"] == 0:
    #         continue

    #     cx = int(M["m10"] / M["m00"])
    #     cy = int(M["m01"] / M["m00"])

    #     x,y,w,h = cv2.boundingRect(m)

    #     centers_3.append((cx,cy,x,y,w,h))

    #     # cv2.circle(warp,(cx,cy),8,(0,255,255),-1)

    # print("Tổng marker =",len(centers_3))
    # print(centers_3)

    # part1_pts = []

    # for item in centers_3:

    #     cx,cy,x,y,w,h = item

    #     if 100 < cy < 800:
    #         part1_pts.append((item))
    #         cv2.circle(warp,(cx,cy),8,(0,0,255),-1)
        
    # part1_pts = sorted(part1_pts, key=lambda p: (p[1], p[0]))

    # print("PART1 =", len(part1_pts))

    # print("PART1 PTS")
    # for p in part1_pts:
    #     print(p)

    # TL1 = part1_pts[0]
    # TR1 = part1_pts[1]


    # if len(part1_pts) != 4:
    #     raise Exception(
    #         f"Part1 marker lỗi. Tìm thấy {len(part1_pts)} điểm"
    #     )

    # top_row_1 = sorted(part1_pts[:2], key=lambda p:p[0])

    # mid_row_1 = sorted(part1_pts[2:4], key=lambda p:p[0])

    # # bot_row = sorted(part2_pts[4:6], key=lambda p:p[0])

    # TL1, TR1 = top_row_1

    # ML1, MR1 = mid_row_1

    # part1_x = min(TL1[0], ML1[0])
    # part1_y = min(TL1[1], TR1[1])

    # # BL2, BR2 = bot_row

    # print("TL1 =", TL1)
    # print("TR1 =", TR1)

    # print("ML1  =", ML1)
    # print("MR1  =", MR1)

    # shrink = 0

    # src_part1 = np.float32([
    #     [TL1[0] + shrink, TL1[1] + shrink ],
    #     [TR1[0] - shrink, TR1[1] + shrink],
    #     [MR1[0] - shrink, MR1[1] - shrink],
    #     [ML1[0] + shrink, ML1[1] - shrink ]
    # ])

    # w_part1 = 800
    # h_part1 = 280

    # dst_part1 = np.float32([
    #     [0,0],
    #     [w_part1,0],
    #     [w_part1,h_part1],
    #     [0,h_part1]
    # ])

    # M1 = cv2.getPerspectiveTransform(src_part1, dst_part1)

    # M1_inv = cv2.getPerspectiveTransform(
    #     dst_part1,
    #     src_part1
    # )

    # part1_roi = cv2.warpPerspective(warp,M1,(w_part1, h_part1))

    # cv2.line(warp,(TL1[0], TL1[1] ),(TR1[0], TR1[1]),(0,255,0),2)

    # cv2.line(warp,(ML1[0], ML1[1]),(MR1[0], MR1[1]),(0,255,0),2)

    # # cv2.line(warp,(ML[0] + 0, ML[1] - 75),(MR[0] + 1000, MR[1] - 75),(0,0,255), 2)

    # cv2.line(warp,(TL1[0], TL1[1]),(ML1[0], ML1[1]),(0,255,0),2)

    # cv2.line(warp,(TR1[0], TR1[1]),(MR1[0], MR1[1]),(0,255,0),2)

    # # Cắt ROI
    # cv2.imshow("PART1 ROI", part1_roi)

    # h1, w1 = part1_roi.shape[:2]

    # roi_part1_chia = w1 // 4

    # all_part1_blocks = []

    # for i in range(4):
    #     block_x1 = i * roi_part1_chia
    #     if i == 3:
    #         block_x2  = w1
    #     else:
    #         block_x2  = (i + 1) * roi_part1_chia

    #     roi_block_par1 = part1_roi[:, block_x1:block_x2]

    #     print(f"BLOCK {i+1}",roi_block_par1.shape)

    #     all_part1_blocks.append(roi_block_par1)

    # all_answers1 = {}

    # for i, block_part1 in enumerate(all_part1_blocks):

    #     offset_x = int(i * roi_part1_chia)

    #     answers_part1, debug_part1, selected_points_part1 = read_part1(block_part1, 10, 4, answer_key_part1 , start_question=i*10+1 )

    #     all_answers1.update(answers_part1)

    #     for q, ans, cx, cy, radius, is_correct, correct_cx, correct_cy  in selected_points_part1:

    #         wx = int(part1_x + offset_x + cx)
    #         wy = int(part1_y + cy)

    #         px = cx + offset_x
    #         py = cy

    #         pt = np.array([[[px, py]]],dtype=np.float32)

    #         real_pt = cv2.perspectiveTransform(pt,M1_inv)

    #         wx = int(real_pt[0][0][0])
    #         wy = int(real_pt[0][0][1])

    #         cv2.circle(img_kq,(wx, wy),8,(0,255,255),2)
            
    #         color = (0,255,0) if is_correct else (0,0,255)
            

    #         cv2.circle(img_kq,(wx, wy),radius + 3,color,2)

    #         if not is_correct:

    #             px2 = correct_cx + offset_x
    #             py2 = correct_cy

    #             pt2 = np.array([[[px2, py2]]], dtype=np.float32)

    #             real_pt2 = cv2.perspectiveTransform(pt2, M1_inv)

    #             wx2 = int(real_pt2[0][0][0])
    #             wy2 = int(real_pt2[0][0][1])

                
    #             cv2.circle(img_kq,(wx2, wy2),radius + 3,(0,255,0),2)

    #     cv2.imshow(f"PART1_GRID_{i+1}",debug_part1)

    # print(f"\n===== PART1 =====")
    # # print(all_answers1)


    # # ===============================
    # # PHẦN 2
    # # ===============================
    # markers = []
    # for c in cnts:
    #     peri = cv2.arcLength(c, True)
    #     if peri == 0: continue
        
    #     approx = cv2.approxPolyDP(c, 0.025 * peri, True)
    #     area = cv2.contourArea(c)
        
    #     # 2. RÚT RA NGOÀI: Tính toán chung cho mọi hình có diện tích vừa phải
    #     if 0 < area < 3000:
    #         x, y, w, h = cv2.boundingRect(c)
    #         if w == 0 or h == 0: continue
                
    #         aspect_ratio = w / float(h)
    #         rect_area = w * h
    #         extent = area / float(rect_area)
    #         circularity = (4 * math.pi * area) / (peri * peri)

    #         # 3. NGÃ RẼ 1: NỐT VUÔNG ĐIỂM NEO
    #         if 4 <= len(approx) <= 8  and 0.8 <= aspect_ratio <= 1.9 and circularity < 0.85 and extent > 0.75:
    #             markers.append(approx)
    #             # cv2.drawContours(warp, [approx], -1, (0, 0, 255), 2) # Viền Đỏ

    # centers_1 = []

    # for m in markers:

    #     M = cv2.moments(m)

    #     if M["m00"] == 0:
    #         continue

    #     cx = int(M["m10"] / M["m00"])
    #     cy = int(M["m01"] / M["m00"])

    #     x,y,w,h = cv2.boundingRect(m)

    #     centers_1.append((cx,cy,x,y,w,h))

    #     # cv2.circle(warp,(cx,cy),8,(0,255,255),-1)

    # print("Tổng marker =",len(centers_1))
    # print(centers_1)


    # part2_pts = []

    # for item in centers_1:

    #     cx,cy,x,y,w,h = item

    #     if 700 < cy < 1000:
    #         part2_pts.append((item))
    #         # cv2.circle(warp,(cx,cy),8,(0,0,255),-1)
        
    # part2_pts = sorted(part2_pts, key=lambda p: (p[1], p[0]))

    # print("PART2 =", len(part2_pts))

    # print("PART2 PTS")
    # for p in part2_pts:
    #     print(p)

    # TL2 = part2_pts[0]
    # TR2 = part2_pts[1]

    # # BL2 = part2_pts[4]
    # # BR2 = part2_pts[5]

    # if len(part2_pts) != 4:
    #     raise Exception(
    #         f"Part2 marker lỗi. Tìm thấy {len(part2_pts)} điểm"
    #     )

    # top_row = sorted(part2_pts[:2], key=lambda p:p[0])

    # mid_row = sorted(part2_pts[2:4], key=lambda p:p[0])

    # # bot_row = sorted(part2_pts[4:6], key=lambda p:p[0])

    # TL2, TR2 = top_row

    # ML, MR = mid_row

    # # BL2, BR2 = bot_row

    # print("TL2 =", TL2)
    # print("TR2 =", TR2)

    # print("ML  =", ML)
    # print("MR  =", MR)

    # shrink = -5

    # src_part2 = np.float32([
    #     [TL2[0] + shrink, TL2[1] + shrink + 10],
    #     [TR2[0] - shrink, TR2[1] + shrink],
    #     [MR[0] - shrink, MR[1] - shrink],
    #     [ML[0] + shrink, ML[1] - shrink ]
    # ])

    # w_part2 = 800
    # h_part2 = 220

    # dst_part2 = np.float32([
    #     [0,0],
    #     [w_part2,0],
    #     [w_part2,h_part2],
    #     [0,h_part2]
    # ])

    # M2 = cv2.getPerspectiveTransform(src_part2,dst_part2)

    # M2_inv = np.linalg.inv(M2)

    # part2_roi = cv2.warpPerspective(warp,M2,(w_part2,h_part2))

    # cv2.line(warp,(TL2[0], TL2[1] ),(TR2[0], TR2[1]),(0,255,0),2)

    # cv2.line(warp,(ML[0], ML[1]),(MR[0], MR[1]),(0,255,0),2)

    # # cv2.line(warp,(ML[0] + 0, ML[1] - 75),(MR[0] + 1000, MR[1] - 75),(0,0,255), 2)

    # cv2.line(warp,(TL2[0], TL2[1]),(ML[0], ML[1]),(0,255,0),2)

    # cv2.line(warp,(TR2[0], TR2[1]),(MR[0], MR[1]),(0,255,0),2)

    # # Cắt ROI
    # cv2.imshow("PART2 ROI", part2_roi)

    # h2, w2 = part2_roi.shape[:2]

    # roi_part2_chia = w2 // 4

    # all_part2_blocks = []

    # for i in range(4):
    #     x1 = i * roi_part2_chia
    #     if i == 3:
    #         x2 = w2
    #     else:
    #         x2 = (i + 1) * roi_part2_chia

    #     roi_block_par2 = part2_roi[:, x1:x2]

    #     print(f"BLOCK {i+1}",roi_block_par2.shape)

    #     all_part2_blocks.append(roi_block_par2)

    # all_answers_part2 = {}

    # all_answers_part2_last = []

    # for i, block_part2 in enumerate(all_part2_blocks):

    #     start_question = i * 2 + 1

    #     answers_part2, debug_part2, selected_points_part2, correct_points_part2  = build_part2_grid(block_part2, answer_key_2 , start_question = start_question)

    #     all_answers_part2.update(answers_part2)

    #     offset_x = i * roi_part2_chia

    #     for row, col, cx, cy, radius, is_correct  in selected_points_part2:

    #         px = cx + offset_x
    #         py = cy

    #         pt = np.array([[[px, py]]], dtype=np.float32)

    #         real_pt = cv2.perspectiveTransform(pt, M2_inv)

    #         wx = int(real_pt[0][0][0])
    #         wy = int(real_pt[0][0][1])

    #         if is_correct:
    #             color = (0,255,0)
    #         else:
    #             color = (0,0,255)

    #         cv2.circle(img_kq,(wx, wy),8,(0,255,255),2)
    #         cv2.circle(img_kq,(wx, wy),radius + 3,color,2)
    #         # cv2.circle(img_kq,(wx, wy),radius + 6,(0,255,0),2)

            

    #     for cx, cy, radius in correct_points_part2:

    #         px = cx + offset_x
    #         py = cy

    #         pt = np.array([[[px, py]]], dtype=np.float32)

    #         real_pt = cv2.perspectiveTransform(pt, M2_inv)

    #         wx = int(real_pt[0][0][0])
    #         wy = int(real_pt[0][0][1])

    #         cv2.circle( img_kq,(wx, wy),radius + 3,(0,255,0),2)
            
    #     cv2.imshow(f"PART2_GRID_{i+1}",debug_part2)

    # # Kết quả phần 2
    # print("\n===== PART2 =====")

    # for q, data in all_answers_part2.items():

    #     print(f"Câu {q}")

    #     for y, ans in data.items():
    #         print(f"   {y}) {ans}")

    #         all_answers_part2_last.append(f"{q}{ans}")


    # # ===============================
    # # PHẦN 3
    # # ===============================

    # part3_pts = []

    # for item in centers_1:

    #     cx,cy,x,y,w,h = item

    #     if 950 < cy < 1800:
    #         part3_pts.append((item))
    #         cv2.circle(warp,(cx,cy),8,(0,255,255),6)
        
    # part3_pts = sorted(part3_pts, key=lambda p: (p[1], p[0]))

    # print("PART3 PTS")
    # for p in part3_pts:
    #     print(p)

    # # ML = part2_pts[0]
    # # MR = part2_pts[1]


    # if len(part3_pts) != 4:
    #     raise Exception(
    #         f"Part2 marker lỗi. Tìm thấy {len(part3_pts)} điểm"
    #     )

    # # top_row = sorted(part3_pts[:2], key=lambda p:p[0])

    # mid_row = sorted(part3_pts[:2], key=lambda p:p[0])

    # bottom_row = sorted(part3_pts[2:4], key=lambda p:p[0])

    # BL2, BR2 = bottom_row

    # ML, MR = mid_row


    # print("ML  =", ML)
    # print("MR  =", MR)

    # print("TL2 =", BL2)
    # print("TR2 =", BR2)

    # shrink = 5

    # src_part3 = np.float32([
    #     [ML[0] + shrink, ML[1] + shrink ],
    #     [MR[0] - shrink, MR[1] + shrink],
    #     [BR2[0] - shrink, BR2[1] - shrink],
    #     [BL2[0] + shrink, BL2[1] - shrink ]
    # ])

    # w_part3 = 900
    # h_part3 = 420

    # dst_part3 = np.float32([
    #     [0,0],
    #     [w_part3,0],
    #     [w_part3,h_part3],
    #     [0,h_part3]
    # ])

    # M3 = cv2.getPerspectiveTransform(src_part3,dst_part3)

    # M3_inv = np.linalg.inv(M3)

    # part3_roi = cv2.warpPerspective(warp,M3,(w_part3,h_part3))

    # cv2.line(warp,(ML[0], ML[1] ),(MR[0], MR[1]),(0,255,0),2)

    # cv2.line(warp,(BL2[0], BL2[1]),(BR2[0], BR2[1]),(0,255,0),2)

    # cv2.line(warp,(ML[0], ML[1]),(BL2[0], BL2[1]),(0,255,0),2)

    # cv2.line(warp,(MR[0], MR[1]),(BR2[0], BR2[1]),(0,255,0),2)

    # cv2.imshow("PART3 ROI", part3_roi)

    # h3, w3 = part3_roi.shape[:2]

    # roi_part3_chia = w3 // 6

    # all_part3_blocks = []

    # for i in range(6):

    #     x1 = i * roi_part3_chia

    #     if i == 5:
    #         x2 = w3
    #     else:
    #         x2 = (i + 1) * roi_part3_chia

    #     print(i, x1, x2)

    #     roi_block_part3 = part3_roi[:, x1:x2]
        
    #     print("roi =", roi_block_part3.shape)

    #     if roi_block_part3.size == 0:
    #         print("ROI RONG")
    #         continue

    #     # cv2.imshow(f"BLOCK_{i+1}", roi_block_part3)

    #     all_part3_blocks.append(roi_block_part3)

    # all_ans_part3 = []

    # for i, block_part3 in enumerate(all_part3_blocks):
    #     question_no = i + 1

    #     ans_part3, debug_part3, selected_points_part3, is_correct  = build_part3_grid(block_part3, answer_key_3, question_no)

    #     offset_x = i * roi_part3_chia

    #     for row, col, cx, cy, radius in selected_points_part3:

    #         px = cx + offset_x
    #         py = cy

    #         pt = np.array([[[px, py]]], dtype=np.float32)

    #         real_pt = cv2.perspectiveTransform(pt, M3_inv)

    #         wx = int(real_pt[0][0][0])
    #         wy = int(real_pt[0][0][1])

    #         color = (0,255,0) if is_correct else (0,0,255)

    #         cv2.circle(img_kq,(wx, wy),radius + 4, color, 2)
    #         # cv2.circle(img_kq,(wx, wy),8,(0,255,255),3)

    #     cv2.imshow(f"PART3_GRID_{i+1}",debug_part3)

    #     # Kết quả phần 3
    #     print(f"\n===== PART3 BLOCK {i+1} =====")
    #     print(ans_part3)
    #     all_ans_part3.append(ans_part3)




    # ====== HIỂN THỊ ======

    # cv2.namedWindow('1. Anh Goc', cv2.WINDOW_NORMAL)
    # cv2.namedWindow('4. Tim Diem Neo va O Tron', cv2.WINDOW_NORMAL)
    # cv2.namedWindow('5. Anh Warp', cv2.WINDOW_NORMAL)

    # cv2.resizeWindow('1. Anh Goc', 600, 800)
    # cv2.resizeWindow('4. Tim Diem Neo va O Tron', 600, 800)
    # cv2.resizeWindow('5. Anh Warp', 600, 800)

    # cv2.imshow('1. Anh Goc', img)
    # cv2.imshow('4. Tim Diem Neo va O Tron', img_markers)
    # cv2.imshow('5. Anh Warp', warp)

    # cv2.imshow("SBD ROI", sbd_roi)
    # cv2.imshow("MA DE ROI", md_roi)

    # print(f"\n====== ALL ĐAP AN ========")
    # sbd = sbd1
    # md = ma_de
    # all_answers2 = all_answers_part2_last
    # all_answers3 = all_ans_part3

    # print("SBD:",)
    # print("Mã đề:",md)
    # print(all_answers1)
    # print(all_answers2)
    # print(all_answers3)

    # cv2.namedWindow('PHIEU THI DA DUOC TO', cv2.WINDOW_NORMAL)
    # cv2.resizeWindow('PHIEU THI DA DUOC TO', 800, 1000)
    # cv2.imshow('PHIEU THI DA DUOC TO', img_kq)

    cv2.waitKey(0)
    cv2.destroyAllWindows()


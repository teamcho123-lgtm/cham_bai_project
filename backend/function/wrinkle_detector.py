import cv2
import numpy as np


def cluster_points_by_y(points, tolerance=12):
    """
    Gom các điểm có tọa độ Y gần nhau thành một điểm đại diện.
    """

    if not points:
        return []

    points = sorted(
        points,
        key=lambda point: point[1]
    )

    groups = []

    for point in points:
        if not groups:
            groups.append([point])
            continue

        previous_group = groups[-1]

        group_y = float(
            np.median(
                [
                    item[1]
                    for item in previous_group
                ]
            )
        )

        if abs(point[1] - group_y) <= tolerance:
            previous_group.append(point)
        else:
            groups.append([point])

    clustered = []

    for group in groups:
        center_x = int(
            np.median(
                [
                    item[0]
                    for item in group
                ]
            )
        )

        center_y = int(
            np.median(
                [
                    item[1]
                    for item in group
                ]
            )
        )

        clustered.append(
            (center_x, center_y)
        )

    return clustered

def find_side_square_markers(image):
    """
    Tìm các marker vuông đen ở mép trái và mép phải.
    """

    if image is None or image.size == 0:
        raise ValueError(
            "Ảnh đầu vào rỗng"
        )

    height, width = image.shape[:2]

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    blurred = cv2.GaussianBlur(
        gray,
        (5, 5),
        0
    )

    threshold = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        10
    )

    kernel = np.ones(
        (3, 3),
        np.uint8
    )

    threshold = cv2.morphologyEx(
        threshold,
        cv2.MORPH_CLOSE,
        kernel
    )

    contours, _ = cv2.findContours(
        threshold,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    left_points = []
    right_points = []

    # Chỉ xét 15% hai bên ảnh
    side_region = int(
        width * 0.15
    )

    minimum_side = max(
        6,
        int(min(width, height) * 0.006)
    )

    maximum_side = max(
        minimum_side + 4,
        int(min(width, height) * 0.045)
    )

    for contour in contours:
        area = cv2.contourArea(
            contour
        )

        if area <= 0:
            continue

        x, y, w, h = cv2.boundingRect(
            contour
        )

        if w == 0 or h == 0:
            continue

        if not (
            minimum_side <= w <= maximum_side
            and
            minimum_side <= h <= maximum_side
        ):
            continue

        aspect_ratio = w / float(h)

        if not (
            0.70 <= aspect_ratio <= 1.40
        ):
            continue

        extent = area / float(w * h)

        if extent < 0.50:
            continue

        perimeter = cv2.arcLength(
            contour,
            True
        )

        if perimeter == 0:
            continue

        approximate = cv2.approxPolyDP(
            contour,
            0.04 * perimeter,
            True
        )

        if not (
            4 <= len(approximate) <= 8
        ):
            continue

        marker_roi = threshold[
            y:y + h,
            x:x + w
        ]

        fill_ratio = (
            cv2.countNonZero(marker_roi)
            / float(w * h)
        )

        if fill_ratio < 0.35:
            continue

        center_x = x + w // 2
        center_y = y + h // 2

        if center_x <= side_region:
            left_points.append(
                (center_x, center_y)
            )

        elif center_x >= width - side_region:
            right_points.append(
                (center_x, center_y)
            )

    tolerance = max(
        8,
        int(height * 0.01)
    )

    left_points = cluster_points_by_y(
        left_points,
        tolerance
    )

    right_points = cluster_points_by_y(
        right_points,
        tolerance
    )

    return (
        left_points,
        right_points,
        threshold
    )

def pair_side_markers(
    left_points,
    right_points,
    image_height
):
    """
    Ghép marker bên trái với marker bên phải
    có tọa độ Y gần nhất.
    """

    pairs = []

    used_right_indexes = set()

    maximum_y_distance = max(
        20,
        int(image_height * 0.05)
    )

    for left_point in left_points:
        best_index = None
        best_distance = None

        for index, right_point in enumerate(
            right_points
        ):
            if index in used_right_indexes:
                continue

            distance = abs(
                left_point[1]
                - right_point[1]
            )

            if distance > maximum_y_distance:
                continue

            if (
                best_distance is None
                or distance < best_distance
            ):
                best_distance = distance
                best_index = index

        if best_index is None:
            continue

        used_right_indexes.add(
            best_index
        )

        pairs.append(
            (
                left_point,
                right_points[best_index]
            )
        )

    pairs.sort(
        key=lambda pair: (
            pair[0][1] + pair[1][1]
        ) / 2
    )

    return pairs

def detect_wrinkled_paper(
    warped_image,
    debug_mode=False
):
    """
    Phát hiện giấy bị nhăn dựa trên độ lệch
    không tuyến tính của các marker hai bên.

    Trả về:
    - flat: tương đối phẳng
    - slight: nhăn nhẹ
    - wrinkled: nhăn rõ
    - unknown: không đủ marker để kết luận
    """

    if (
        warped_image is None
        or warped_image.size == 0
    ):
        raise ValueError(
            "Ảnh warp rỗng"
        )

    height, width = warped_image.shape[:2]

    (
        left_points,
        right_points,
        threshold
    ) = find_side_square_markers(
        warped_image
    )

    pairs = pair_side_markers(
        left_points,
        right_points,
        height
    )

    debug_image = warped_image.copy()

    for point in left_points:
        cv2.circle(
            debug_image,
            point,
            7,
            (255, 0, 0),
            2
        )

    for point in right_points:
        cv2.circle(
            debug_image,
            point,
            7,
            (0, 255, 255),
            2
        )

    for left_point, right_point in pairs:
        cv2.line(
            debug_image,
            left_point,
            right_point,
            (0, 255, 0),
            2
        )

    if len(pairs) < 4:
        result = {
            "status": "unknown",
            "isWrinkled": None,
            "markerPairs": len(pairs),
            "reason": (
                "Không tìm đủ ít nhất 4 cặp "
                "marker trái/phải"
            ),
            "debugImage": debug_image,
        }

        if debug_mode:
            cv2.imshow(
                "WRINKLE MARKERS",
                debug_image
            )

        return result

    middle_y = np.array(
        [
            (
                left_point[1]
                + right_point[1]
            ) / 2.0
            for left_point, right_point
            in pairs
        ],
        dtype=np.float32
    )

    y_differences = np.array(
        [
            right_point[1]
            - left_point[1]
            for left_point, right_point
            in pairs
        ],
        dtype=np.float32
    )

    # Fit đường tuyến tính:
    # độ lệch do nghiêng tổng thể không bị tính là nhăn
    coefficients = np.polyfit(
        middle_y,
        y_differences,
        1
    )

    predicted_differences = np.polyval(
        coefficients,
        middle_y
    )

    residuals = (
        y_differences
        - predicted_differences
    )

    rmse = float(
        np.sqrt(
            np.mean(
                residuals ** 2
            )
        )
    )

    maximum_deviation = float(
        np.max(
            np.abs(residuals)
        )
    )

    normalized_rmse = (
        rmse / float(height)
    )

    normalized_maximum = (
        maximum_deviation
        / float(height)
    )

    # ==============================
    # PHÂN LOẠI
    # ==============================

    if (
        normalized_rmse <= 0.0025
        and
        normalized_maximum <= 0.005
    ):
        status = "flat"
        is_wrinkled = False
        description = "Giấy tương đối phẳng"

    elif (
        normalized_rmse <= 0.005
        and
        normalized_maximum <= 0.010
    ):
        status = "slight"
        is_wrinkled = True
        description = "Giấy bị nhăn nhẹ"

    else:
        status = "wrinkled"
        is_wrinkled = True
        description = "Giấy bị nhăn hoặc cong rõ"

    result = {
        "status": status,
        "isWrinkled": is_wrinkled,
        "description": description,

        "markerPairs": len(pairs),

        "rmsePixels": round(
            rmse,
            2
        ),

        "maximumDeviationPixels": round(
            maximum_deviation,
            2
        ),

        "normalizedRmse": round(
            normalized_rmse,
            6
        ),

        "normalizedMaximumDeviation": round(
            normalized_maximum,
            6
        ),

        "leftMarkers": left_points,
        "rightMarkers": right_points,

        "debugImage": debug_image,
    }

    print(
        "Kiểm tra giấy nhăn:",
        {
            key: value
            for key, value in result.items()
            if key != "debugImage"
        }
    )

    if debug_mode:
        cv2.imshow(
            "WRINKLE MARKERS",
            debug_image
        )

        cv2.imshow(
            "WRINKLE THRESHOLD",
            threshold
        )

    return result
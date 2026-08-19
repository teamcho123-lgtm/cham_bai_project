"""Nhan dien 4 marker goc cho che do quet tu dong.

Module nay doc lap voi cac app cham bai. Cac nguong ben duoi duoc sao chep
tu ``detectors/app.py`` den ``detectors/app4.py`` de che do camera tim marker
giong tung mau phieu, nhung khong thay doi logic cham bai hien tai.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any, Literal

import cv2
import numpy as np


Point = tuple[int, int]
CornerName = Literal["topLeft", "topRight", "bottomLeft", "bottomRight"]


TEMPLATE_PROFILE_MAP = {
    "template-000": "app",
    "template-001": "app1",
    "template-002": "app2",
    "template-003": "app3",
    "template-004": "app4",
}


@dataclass(frozen=True)
class MarkerProfile:
    name: str
    roi_mode: Literal["short-side-square", "image-ratio"]
    roi_width_ratio: float
    roi_height_ratio: float
    adaptive_block_size: int
    adaptive_c: int
    morphology_close_kernel: int | None
    selection_mode: Literal["largest", "corner-extreme"]


# So lieu ROI va tien xu ly duoc giu dung theo tung app hien tai.
MARKER_PROFILES = {
    "app": MarkerProfile(
        name="app",
        roi_mode="short-side-square",
        roi_width_ratio=0.25,
        roi_height_ratio=0.25,
        adaptive_block_size=41,
        adaptive_c=11,
        morphology_close_kernel=None,
        selection_mode="largest",
    ),
    "app1": MarkerProfile(
        name="app1",
        roi_mode="short-side-square",
        roi_width_ratio=0.25,
        roi_height_ratio=0.25,
        adaptive_block_size=41,
        adaptive_c=7,
        morphology_close_kernel=None,
        selection_mode="largest",
    ),
    "app2": MarkerProfile(
        name="app2",
        roi_mode="image-ratio",
        roi_width_ratio=0.15,
        roi_height_ratio=0.10,
        adaptive_block_size=31,
        adaptive_c=8,
        morphology_close_kernel=5,
        selection_mode="corner-extreme",
    ),
    "app3": MarkerProfile(
        name="app3",
        roi_mode="image-ratio",
        roi_width_ratio=0.20,
        roi_height_ratio=0.25,
        adaptive_block_size=41,
        adaptive_c=11,
        morphology_close_kernel=None,
        selection_mode="corner-extreme",
    ),
    "app4": MarkerProfile(
        name="app4",
        roi_mode="image-ratio",
        roi_width_ratio=0.20,
        roi_height_ratio=0.15,
        adaptive_block_size=41,
        adaptive_c=11,
        morphology_close_kernel=None,
        selection_mode="corner-extreme",
    ),
}


@dataclass
class MarkerDetectionResult:
    template_id: str
    profile_name: str
    image_width: int
    image_height: int
    points: dict[CornerName, Point | None]
    search_regions: dict[CornerName, tuple[int, int, int, int]]
    geometry_valid: bool
    horizontal_ratio: float | None
    vertical_ratio: float | None
    sharpness: float
    brightness: float

    @property
    def marker_count(self) -> int:
        return sum(point is not None for point in self.points.values())

    @property
    def detected(self) -> bool:
        return self.marker_count == 4

    @property
    def ready(self) -> bool:
        # Chat luong anh la thong tin cho giao dien. Marker va hinh hoc moi la
        # dieu kien bat buoc; nguong net/sang se duoc hieu chinh o frontend.
        return self.detected and self.geometry_valid

    def to_dict(self) -> dict[str, Any]:
        normalized_points: dict[str, list[float] | None] = {}

        for corner, point in self.points.items():
            normalized_points[corner] = (
                [
                    round(point[0] / self.image_width, 6),
                    round(point[1] / self.image_height, 6),
                ]
                if point is not None
                else None
            )

        return {
            "success": True,
            "templateId": self.template_id,
            "profile": self.profile_name,
            "detected": self.detected,
            "ready": self.ready,
            "markerCount": self.marker_count,
            "points": {
                corner: list(point) if point is not None else None
                for corner, point in self.points.items()
            },
            "normalizedPoints": normalized_points,
            "searchRegions": {
                corner: list(region)
                for corner, region in self.search_regions.items()
            },
            "geometry": {
                "valid": self.geometry_valid,
                "horizontalRatio": self.horizontal_ratio,
                "verticalRatio": self.vertical_ratio,
            },
            "quality": {
                "sharpness": round(self.sharpness, 2),
                "brightness": round(self.brightness, 2),
            },
        }


def _candidate_is_valid(
    profile_name: str,
    *,
    approx_vertices: int,
    area: float,
    width: int,
    height: int,
    ratio: float,
    extent: float,
    circularity: float,
    fill_ratio: float,
) -> bool:
    """Giu nguyen dieu kien marker dang co trong tung app."""

    if profile_name == "app":
        return (
            4 <= approx_vertices <= 8
            and 0.9 <= ratio <= 2
            and extent > 0.7
            and circularity < 0.85
            and fill_ratio > 0.4
        )

    if profile_name == "app1":
        if area < 200 or area > 1000:
            return False

        return (
            4 <= approx_vertices <= 9
            and 0.9 <= ratio <= 2
            and extent > 0.7
            and circularity < 0.85
            and fill_ratio > 0.4
        )

    if profile_name == "app2":
        if area < 100 or area > 1000:
            return False

        return 4 <= approx_vertices <= 8 and extent > 0.65

    if profile_name in {"app3", "app4"}:
        if area < 150 or area > 500:
            return False

        return (
            40 < area < 400
            and 0 < ratio < 8
            and 5 < height < 20
            and 0.5 < extent < 1.0
        )

    return False


def _select_corner_candidate(
    candidates: list[Point],
    corner: CornerName,
) -> Point | None:
    if not candidates:
        return None

    if corner == "topLeft":
        return min(candidates, key=lambda point: point[0] + point[1])

    if corner == "topRight":
        return max(candidates, key=lambda point: point[0] - point[1])

    if corner == "bottomLeft":
        return min(candidates, key=lambda point: point[0] - point[1])

    return max(candidates, key=lambda point: point[0] + point[1])


def _find_marker_in_roi(
    roi: np.ndarray,
    *,
    offset_x: int,
    offset_y: int,
    corner: CornerName,
    profile: MarkerProfile,
) -> Point | None:
    if roi.size == 0:
        return None

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    threshold = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        profile.adaptive_block_size,
        profile.adaptive_c,
    )

    contour_source = threshold

    if profile.morphology_close_kernel is not None:
        kernel = np.ones(
            (
                profile.morphology_close_kernel,
                profile.morphology_close_kernel,
            ),
            np.uint8,
        )
        contour_source = cv2.morphologyEx(
            threshold,
            cv2.MORPH_CLOSE,
            kernel,
        )

    contours, _ = cv2.findContours(
        contour_source.copy(),
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    candidates: list[Point] = []
    largest_point: Point | None = None
    largest_area = 0.0

    for contour in contours:
        perimeter = cv2.arcLength(contour, True)

        if perimeter == 0:
            continue

        approximation = cv2.approxPolyDP(
            contour,
            0.025 * perimeter,
            True,
        )
        area = cv2.contourArea(contour)
        x, y, width, height = cv2.boundingRect(contour)

        if height == 0 or width == 0:
            continue

        ratio = width / float(height)
        extent = area / float(width * height)
        circularity = 4 * math.pi * area / (perimeter * perimeter)
        marker_roi = threshold[y:y + height, x:x + width]
        fill_ratio = cv2.countNonZero(marker_roi) / float(width * height)

        if not _candidate_is_valid(
            profile.name,
            approx_vertices=len(approximation),
            area=area,
            width=width,
            height=height,
            ratio=ratio,
            extent=extent,
            circularity=circularity,
            fill_ratio=fill_ratio,
        ):
            continue

        if profile.selection_mode == "largest":
            if area <= largest_area:
                continue

            moments = cv2.moments(contour)

            if moments["m00"] == 0:
                continue

            largest_point = (
                int(moments["m10"] / moments["m00"]) + offset_x,
                int(moments["m01"] / moments["m00"]) + offset_y,
            )
            largest_area = area
        else:
            candidates.append((
                x + width // 2 + offset_x,
                y + height // 2 + offset_y,
            ))

    if profile.selection_mode == "largest":
        return largest_point

    return _select_corner_candidate(candidates, corner)


def _build_search_regions(
    image_width: int,
    image_height: int,
    profile: MarkerProfile,
) -> dict[CornerName, tuple[int, int, int, int]]:
    if profile.roi_mode == "short-side-square":
        roi_size = int(
            min(image_width, image_height)
            * profile.roi_width_ratio
        )
        roi_width = roi_size
        roi_height = roi_size
    else:
        roi_width = int(image_width * profile.roi_width_ratio)
        roi_height = int(image_height * profile.roi_height_ratio)

    return {
        "topLeft": (0, 0, roi_width, roi_height),
        "topRight": (
            image_width - roi_width,
            0,
            roi_width,
            roi_height,
        ),
        "bottomLeft": (
            0,
            image_height - roi_height,
            roi_width,
            roi_height,
        ),
        "bottomRight": (
            image_width - roi_width,
            image_height - roi_height,
            roi_width,
            roi_height,
        ),
    }


def _distance(point_a: Point, point_b: Point) -> float:
    return math.hypot(
        point_a[0] - point_b[0],
        point_a[1] - point_b[1],
    )


def _validate_geometry(
    points: dict[CornerName, Point | None],
) -> tuple[bool, float | None, float | None]:
    top_left = points["topLeft"]
    top_right = points["topRight"]
    bottom_left = points["bottomLeft"]
    bottom_right = points["bottomRight"]

    if any(
        point is None
        for point in (top_left, top_right, bottom_left, bottom_right)
    ):
        return False, None, None

    assert top_left is not None
    assert top_right is not None
    assert bottom_left is not None
    assert bottom_right is not None

    valid_order = (
        top_left[0] < top_right[0]
        and bottom_left[0] < bottom_right[0]
        and top_left[1] < bottom_left[1]
        and top_right[1] < bottom_right[1]
    )

    top = _distance(top_left, top_right)
    bottom = _distance(bottom_left, bottom_right)
    left = _distance(top_left, bottom_left)
    right = _distance(top_right, bottom_right)

    if bottom == 0 or right == 0:
        return False, None, None

    horizontal_ratio = top / bottom
    vertical_ratio = left / right

    # Day la khoang kiem tra dang duoc app2 dung truoc khi warp.
    balanced_sides = (
        0.75 <= horizontal_ratio <= 1.25
        and 0.75 <= vertical_ratio <= 1.25
    )

    return (
        valid_order and balanced_sides,
        round(horizontal_ratio, 6),
        round(vertical_ratio, 6),
    )


def detect_four_markers(
    image: np.ndarray,
    template_id: str,
) -> MarkerDetectionResult:
    if image is None or image.size == 0:
        raise ValueError("Ảnh nhận diện marker bị rỗng")

    profile_name = TEMPLATE_PROFILE_MAP.get(str(template_id).strip())

    if profile_name is None:
        raise ValueError(f"Không có cấu hình marker cho {template_id}")

    profile = MARKER_PROFILES[profile_name]
    image_height, image_width = image.shape[:2]
    search_regions = _build_search_regions(
        image_width,
        image_height,
        profile,
    )
    points: dict[CornerName, Point | None] = {
        "topLeft": None,
        "topRight": None,
        "bottomLeft": None,
        "bottomRight": None,
    }

    for corner, (x, y, width, height) in search_regions.items():
        roi = image[y:y + height, x:x + width]
        points[corner] = _find_marker_in_roi(
            roi,
            offset_x=x,
            offset_y=y,
            corner=corner,
            profile=profile,
        )

    geometry_valid, horizontal_ratio, vertical_ratio = _validate_geometry(
        points
    )
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())

    return MarkerDetectionResult(
        template_id=template_id,
        profile_name=profile_name,
        image_width=image_width,
        image_height=image_height,
        points=points,
        search_regions=search_regions,
        geometry_valid=geometry_valid,
        horizontal_ratio=horizontal_ratio,
        vertical_ratio=vertical_ratio,
        sharpness=sharpness,
        brightness=brightness,
    )


def decode_and_detect_four_markers(
    image_bytes: bytes,
    template_id: str,
) -> MarkerDetectionResult:
    encoded_image = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(encoded_image, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Không đọc được khung hình camera")

    return detect_four_markers(image, template_id)

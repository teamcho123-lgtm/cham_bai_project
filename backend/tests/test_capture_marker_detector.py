import sys
import unittest
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from detectors.capture_marker_detector import detect_four_markers


class CaptureMarkerDetectorTests(unittest.TestCase):
    def build_marker_image(self, marker_width, marker_height):
        image = np.full((2048, 1536, 3), 255, dtype=np.uint8)

        for center_x, center_y in (
            (100, 100),
            (1436, 100),
            (100, 1948),
            (1436, 1948),
        ):
            x1 = center_x - marker_width // 2
            y1 = center_y - marker_height // 2
            cv2.rectangle(
                image,
                (x1, y1),
                (x1 + marker_width - 1, y1 + marker_height - 1),
                (0, 0, 0),
                -1,
            )

        return image

    def test_all_template_profiles_find_four_markers(self):
        marker_sizes = {
            "template-000": (28, 28),
            "template-001": (28, 28),
            "template-002": (22, 22),
            "template-003": (16, 12),
            "template-004": (16, 12),
        }

        for template_id, marker_size in marker_sizes.items():
            with self.subTest(template_id=template_id):
                result = detect_four_markers(
                    self.build_marker_image(*marker_size),
                    template_id,
                )

                self.assertEqual(result.marker_count, 4)
                self.assertTrue(result.detected)
                self.assertTrue(result.geometry_valid)
                self.assertTrue(result.ready)

    def test_blank_image_is_not_ready(self):
        blank_image = np.full((2048, 1536, 3), 255, dtype=np.uint8)
        result = detect_four_markers(blank_image, "template-000")

        self.assertEqual(result.marker_count, 0)
        self.assertFalse(result.ready)

    def test_unknown_template_is_rejected(self):
        image = np.full((2048, 1536, 3), 255, dtype=np.uint8)

        with self.assertRaisesRegex(
            ValueError,
            "Không có cấu hình marker",
        ):
            detect_four_markers(image, "template-999")


if __name__ == "__main__":
    unittest.main()

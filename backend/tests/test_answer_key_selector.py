import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from detectors.answer_key_selector import select_answer_key


class AnswerKeySelectorTests(unittest.TestCase):
    def test_single_code_mode_rejects_a_different_detected_code(self):
        answer_keys = {"101": {"mcq": {"1": "A"}}}

        with self.assertRaisesRegex(
            ValueError,
            "không khớp mã đang chấm",
        ):
            select_answer_key(answer_keys, "999")

    def test_single_code_mode_accepts_the_matching_detected_code(self):
        answer_keys = {"101": {"mcq": {"1": "A"}}}

        selected_code, selected_key = select_answer_key(answer_keys, "101")

        self.assertEqual(selected_code, "101")
        self.assertEqual(selected_key, answer_keys["101"])

    def test_multiple_code_mode_selects_key_from_detected_code(self):
        answer_keys = {
            "101": {"mcq": {"1": "A"}},
            "102": {"mcq": {"1": "B"}},
        }

        selected_code, selected_key = select_answer_key(answer_keys, "102")

        self.assertEqual(selected_code, "102")
        self.assertEqual(selected_key, answer_keys["102"])

    def test_multiple_code_mode_rejects_unknown_detected_code(self):
        answer_keys = {
            "101": {"mcq": {}},
            "102": {"mcq": {}},
        }

        with self.assertRaisesRegex(ValueError, "Các mã đề hợp lệ: 101, 102"):
            select_answer_key(answer_keys, "999")

    def test_empty_answer_keys_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "Không có dữ liệu đáp án"):
            select_answer_key({}, "101")


if __name__ == "__main__":
    unittest.main()

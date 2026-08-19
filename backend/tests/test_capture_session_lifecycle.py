import os
import sys
import tempfile
import time
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class CaptureSessionLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.capture_folder_patch = patch.object(
            main,
            "CAPTURE_FOLDER",
            self.temporary_directory.name,
        )
        self.capture_folder_patch.start()

    def tearDown(self):
        self.capture_folder_patch.stop()
        self.temporary_directory.cleanup()

    def create_session(self, modified_at=None):
        session_id = str(uuid.uuid4())
        session_path = Path(self.temporary_directory.name, session_id)
        session_path.mkdir()

        if modified_at is not None:
            os.utime(session_path, (modified_at, modified_at))

        return session_id, session_path

    def test_access_refreshes_session_activity(self):
        old_modified_at = time.time() - 3600
        session_id, session_path = self.create_session(old_modified_at)

        returned_path = main.get_capture_session_path(session_id)

        self.assertEqual(returned_path, str(session_path))
        self.assertGreater(session_path.stat().st_mtime, old_modified_at)

    def test_cleanup_only_removes_inactive_sessions(self):
        _, expired_path = self.create_session(time.time() - 3600)
        _, active_path = self.create_session(time.time())

        main.cleanup_expired_capture_sessions(max_age_seconds=60)

        self.assertFalse(expired_path.exists())
        self.assertTrue(active_path.exists())


if __name__ == "__main__":
    unittest.main()

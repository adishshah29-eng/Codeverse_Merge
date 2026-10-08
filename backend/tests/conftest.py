import os
import sys
import tempfile
from pathlib import Path

# Isolated database + known credentials, set before the app is imported.
_tmp = tempfile.mkdtemp(prefix="cv-tests-")
os.environ.update({
    "DATABASE_PATH": os.path.join(_tmp, "test.db"),
    "SECRET_KEY": "test-secret-key-test-secret-key-test-secret-key",
    "ADMIN_USERNAME": "organizer",
    "ADMIN_PASSWORD": "organizer-password-123",
    "ENVIRONMENT": "development",
    "STAGE1_DELETION_KEY": "k1", "CTF_PUZZLE3_CODE": "c3", "CTF_CONTROL_TOKEN": "t1",
    "STAGE4_SHUTDOWN_CODE": "s4", "STAGE4_SEQUENCE": "1234",
})
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

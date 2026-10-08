import os
import tempfile

# Must be set before the app is imported. A file database is used so that each
# request (its own session) sees only what earlier requests actually committed.
_DB_DIR = tempfile.mkdtemp(prefix="todo-tests-")
os.environ["TODO_DATABASE_URL"] = f"sqlite:///{os.path.join(_DB_DIR, 'test.db')}"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def make_todos(client):
    def _make(n):
        return [client.post("/todos", json={"title": f"task {i}"}).json()["id"] for i in range(n)]
    return _make

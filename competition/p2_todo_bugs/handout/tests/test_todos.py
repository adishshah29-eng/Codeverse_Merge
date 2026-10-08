"""Run with:  pytest -q      (do not edit or skip these tests)"""


# ---- create -----------------------------------------------------------------
def test_create_returns_201_and_body(client):
    r = client.post("/todos", json={"title": "write docs", "description": "soon"})
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "write docs" and body["completed"] is False and body["id"] >= 1


def test_empty_title_rejected(client):
    assert client.post("/todos", json={"title": ""}).status_code == 422


# ---- read / update / delete ---------------------------------------------------
def test_get_todo(client, make_todos):
    (tid,) = make_todos(1)
    r = client.get(f"/todos/{tid}")
    assert r.status_code == 200 and r.json()["id"] == tid


def test_get_missing_is_404(client):
    assert client.get("/todos/999").status_code == 404


def test_update_title_persists(client, make_todos):
    (tid,) = make_todos(1)
    assert client.patch(f"/todos/{tid}", json={"title": "renamed"}).status_code == 200
    assert client.get(f"/todos/{tid}").json()["title"] == "renamed"


def test_delete_removes_todo(client, make_todos):
    (tid,) = make_todos(1)
    assert client.delete(f"/todos/{tid}").status_code == 204
    assert client.get(f"/todos/{tid}").status_code == 404


# ---- pagination ---------------------------------------------------------------
def _walk_pages(client, limit):
    seen, skip = [], 0
    while True:
        page = client.get("/todos", params={"skip": skip, "limit": limit}).json()
        if not page:
            return seen
        seen.extend(t["id"] for t in page)
        skip += limit


def test_pagination_visits_every_todo_exactly_once(client, make_todos):
    ids = make_todos(10)
    assert _walk_pages(client, 3) == ids


def test_pagination_page_boundaries(client, make_todos):
    ids = make_todos(10)
    first = [t["id"] for t in client.get("/todos", params={"skip": 0, "limit": 4}).json()]
    second = [t["id"] for t in client.get("/todos", params={"skip": 4, "limit": 4}).json()]
    assert first == ids[0:4]
    assert second == ids[4:8]


# ---- completing --------------------------------------------------------------
def test_complete_response_says_completed(client, make_todos):
    (tid,) = make_todos(1)
    r = client.post(f"/todos/{tid}/complete")
    assert r.status_code == 200 and r.json()["completed"] is True


def test_complete_is_persisted_across_requests(client, make_todos):
    (tid,) = make_todos(1)
    client.post(f"/todos/{tid}/complete")
    assert client.get(f"/todos/{tid}").json()["completed"] is True
    listed = {t["id"]: t["completed"] for t in client.get("/todos").json()}
    assert listed[tid] is True

"""Behaviour tests. Your optimised shortener.py must keep passing these."""
import os
import re
import tempfile

os.environ["SHORTENER_STORE"] = os.path.join(tempfile.mkdtemp(), "store.json")

import pytest
from fastapi.testclient import TestClient

import shortener

client = TestClient(shortener.app)


@pytest.fixture(autouse=True)
def fresh():
    shortener.reset()
    if hasattr(shortener, "reset_cache"):
        shortener.reset_cache()
    yield


def test_shorten_returns_code():
    r = client.post("/shorten", json={"url": "https://example.com/a"})
    assert r.status_code == 200
    assert re.fullmatch(r"[A-Za-z0-9]{7}", r.json()["code"])


def test_duplicate_url_same_code():
    a = client.post("/shorten", json={"url": "https://example.com/dup"}).json()["code"]
    b = client.post("/shorten", json={"url": "https://example.com/dup"}).json()["code"]
    assert a == b


def test_different_urls_different_codes():
    a = client.post("/shorten", json={"url": "https://example.com/1"}).json()["code"]
    b = client.post("/shorten", json={"url": "https://example.com/2"}).json()["code"]
    assert a != b


def test_redirect_is_301_to_original():
    url = "https://example.com/some/path?q=1"
    code = client.post("/shorten", json={"url": url}).json()["code"]
    r = client.get(f"/{code}", follow_redirects=False)
    assert r.status_code == 301
    assert r.headers["location"] == url


def test_unknown_code_404():
    assert client.get("/zzzzzzz", follow_redirects=False).status_code == 404


def test_many_codes_all_resolve():
    urls = [f"https://example.com/item/{i}" for i in range(200)]
    codes = {u: client.post("/shorten", json={"url": u}).json()["code"] for u in urls}
    assert len(set(codes.values())) == len(urls)
    for u, c in codes.items():
        assert client.get(f"/{c}", follow_redirects=False).headers["location"] == u


def test_missing_url_422():
    assert client.post("/shorten", json={}).status_code == 422

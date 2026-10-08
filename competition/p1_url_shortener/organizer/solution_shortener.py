"""Reference fast solution (organizer only).

Fixes: (1) O(n) duplicate scan -> reverse map, (2) file re-read per request ->
in-memory dict with write-through, (3) collision scan -> O(1) membership test,
(4) read path served from the dict (+ LRU for hot codes).
"""
import json
import os
import random
import string
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

STORE_PATH = os.environ.get("SHORTENER_STORE", "store.json")
ALPHABET = string.ascii_letters + string.digits
CODE_LEN = 7

app = FastAPI()
_by_code = {}
_by_url = {}
_loaded = False
_dirty = 0


class ShortenRequest(BaseModel):
    url: str


def _ensure_loaded():
    global _loaded
    if _loaded:
        return
    if os.path.exists(STORE_PATH):
        with open(STORE_PATH, "r", encoding="utf-8") as fh:
            _by_code.update(json.load(fh))
        _by_url.update({u: c for c, u in _by_code.items()})
    _loaded = True


def _append(code, url):
    # Write-through as an append-only journal: O(1) per write, no re-serialising the store.
    with open(STORE_PATH + ".log", "a", encoding="utf-8") as fh:
        fh.write(json.dumps([code, url]) + "\n")


def reset():
    global _loaded
    for p in (STORE_PATH, STORE_PATH + ".log"):
        if os.path.exists(p):
            os.remove(p)
    _by_code.clear()
    _by_url.clear()
    _loaded = True
    reset_cache()


@lru_cache(maxsize=4096)
def _lookup(code):
    return _by_code.get(code)


def reset_cache():
    _lookup.cache_clear()


@app.post("/shorten")
def shorten(req: ShortenRequest):
    _ensure_loaded()
    code = _by_url.get(req.url)
    if code is not None:
        return {"code": code}
    while True:
        code = "".join(random.choices(ALPHABET, k=CODE_LEN))
        if code not in _by_code:
            break
    _by_code[code] = req.url
    _by_url[req.url] = code
    _append(code, req.url)
    return {"code": code}


@app.get("/{code}")
def resolve(code: str):
    _ensure_loaded()
    url = _lookup(code)
    if url is None:
        raise HTTPException(status_code=404, detail="unknown code")
    return RedirectResponse(url, status_code=301)

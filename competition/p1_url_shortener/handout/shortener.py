"""URL shortener -- WORKING but deliberately slow.

Endpoints (do not change the API):
    POST /shorten  {"url": "https://..."}  -> {"code": "abc1234"}
    GET  /{code}                           -> 301 redirect to the original URL

Your job: profile it, find why it is slow, make it fast without changing behaviour.
"""
import json
import os
import random
import string

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

STORE_PATH = os.environ.get("SHORTENER_STORE", "store.json")
ALPHABET = string.ascii_letters + string.digits
CODE_LEN = 7

app = FastAPI()


class ShortenRequest(BaseModel):
    url: str


def _load():
    if not os.path.exists(STORE_PATH):
        return {}
    with open(STORE_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _save(store):
    with open(STORE_PATH, "w", encoding="utf-8") as fh:
        json.dump(store, fh)


def reset():
    """Used by the tests/harness to start from an empty store."""
    if os.path.exists(STORE_PATH):
        os.remove(STORE_PATH)


@app.post("/shorten")
def shorten(req: ShortenRequest):
    store = _load()
    # Duplicate URLs must return the same code.
    for code, url in store.items():
        if url == req.url:
            return {"code": code}
    while True:
        code = "".join(random.choice(ALPHABET) for _ in range(CODE_LEN))
        taken = False
        for existing in store.keys():
            if existing == code:
                taken = True
                break
        if not taken:
            break
    store[code] = req.url
    _save(store)
    return {"code": code}


@app.get("/{code}")
def resolve(code: str):
    store = _load()
    if code not in store:
        raise HTTPException(status_code=404, detail="unknown code")
    return RedirectResponse(store[code], status_code=301)

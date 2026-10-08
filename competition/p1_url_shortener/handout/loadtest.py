"""Load test: N shortens followed by N redirects, in-process. Prints JSON.

The route handlers are called directly (shortener.shorten / shortener.resolve) so the
numbers measure YOUR code, not the HTTP test client. Keep those function names and the
ShortenRequest model. The redirects are checked for status 301 and the right Location.

    python loadtest.py [N]            (default 2000 here; the organizer harness uses 10000)
"""
import json
import os
import sys
import tempfile
import time

os.environ.setdefault("SHORTENER_STORE", os.path.join(tempfile.mkdtemp(), "store.json"))

import shortener


def run(n: int) -> dict:
    shortener.reset()
    if hasattr(shortener, "reset_cache"):
        shortener.reset_cache()
    t0 = time.perf_counter()
    codes = [shortener.shorten(shortener.ShortenRequest(url=f"https://example.com/p/{i}"))["code"] for i in range(n)]
    t1 = time.perf_counter()
    for i, c in enumerate(codes):
        r = shortener.resolve(c)
        assert r.status_code == 301 and r.headers["location"] == f"https://example.com/p/{i}"
    t2 = time.perf_counter()
    return {"n": n, "shorten_seconds": round(t1 - t0, 3), "redirect_seconds": round(t2 - t1, 3),
            "total_seconds": round(t2 - t0, 3)}


if __name__ == "__main__":
    print(json.dumps(run(int(sys.argv[1]) if len(sys.argv) > 1 else 2000)))

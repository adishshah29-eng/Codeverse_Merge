# Problem 1 — URL shortener: make the slow one fast

`shortener.py` is a working URL shortener with two endpoints:

* `POST /shorten` with `{"url": "https://..."}` → `{"code": "<7 chars>"}`
* `GET /{code}` → `301` redirect to the original URL

It works. It is also slow. Profile it, fix the bottlenecks, and make it fast
**without changing the API or any existing behaviour**.

## Rules
* Same endpoints, same status codes, same JSON shape.
* Duplicate URLs must still return the same code. Codes are 7 chars of `[A-Za-z0-9]`.
* Keep `reset()` (the harness calls it to empty the store). If you add a cache, also add `reset_cache()`.
* You may use only the Python standard library plus FastAPI/pydantic.

## Run it
```
pip install -r requirements.txt
pytest test_correctness.py        # must stay green
python loadtest.py 2000           # watch the numbers
```

## Submit
Submit your final `shortener.py` (and optionally a short note naming each bottleneck you fixed).
Scoring: speedup vs. the baseline on the organizer's 10,000 + 10,000 load test, gated on correctness.

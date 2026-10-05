"""Gunicorn settings for production (see deploy/systemd/codeverse-backend.service).

Values can be overridden with environment variables, e.g. GUNICORN_WORKERS=6.
"""
import multiprocessing
import os

# Nginx proxies /api/ to this address. Never expose it publicly.
bind = os.getenv("GUNICORN_BIND", "127.0.0.1:8000")
worker_class = "uvicorn.workers.UvicornWorker"

# Mostly short database requests, but Phase 1 code runs use CPU.
# 2 × cores + 1 (capped at 9) is a sensible start for 300–400 concurrent players.
workers = int(os.getenv("GUNICORN_WORKERS", min(multiprocessing.cpu_count() * 2 + 1, 9)))

# Must exceed the longest code run (15 s) plus its queue wait (20 s).
timeout = int(os.getenv("GUNICORN_TIMEOUT", "60"))
graceful_timeout = 30
keepalive = 5

# Recycle workers periodically to bound memory growth from pandas/scikit-learn.
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "2000"))
max_requests_jitter = 200

# Trust X-Forwarded-* headers only from the local Nginx.
forwarded_allow_ips = os.getenv("FORWARDED_ALLOW_IPS", "127.0.0.1")

accesslog = None  # the app logs every /api request itself
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

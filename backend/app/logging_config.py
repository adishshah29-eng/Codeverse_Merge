import logging
import logging.config

from .settings import settings


def configure_logging() -> None:
    """Plain, single-line logs to stderr; systemd/journald collects them."""
    level = settings.log_level.upper()
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s %(levelname)s [%(process)d] %(name)s: %(message)s",
            },
        },
        "handlers": {
            "stderr": {"class": "logging.StreamHandler", "formatter": "default"},
        },
        "root": {"handlers": ["stderr"], "level": level},
        "loggers": {
            # Request lines are logged by our middleware; avoid duplicates.
            "uvicorn.access": {"level": "WARNING"},
            "httpx": {"level": "WARNING"},
            "httpcore": {"level": "WARNING"},
            "hpack": {"level": "WARNING"},
        },
    })

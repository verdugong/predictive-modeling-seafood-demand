"""Structured JSON logging: one JSON object per log line, no plain-text duplicates."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from .request_context import get_request_id

_RESERVED_ATTRS = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()) | {
    "message",
    "asctime",
    "event",
}


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "event": getattr(record, "event", record.getMessage()),
            "logger": record.name,
        }

        for key, value in record.__dict__.items():
            if key not in _RESERVED_ATTRS:
                payload[key] = value

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str, ensure_ascii=False)


class RequestIdFilter(logging.Filter):
    """Stamps records emitted during a request with its request_id, if not set explicitly."""

    def filter(self, record: logging.LogRecord) -> bool:
        if getattr(record, "request_id", None) is None:
            record.request_id = get_request_id()
        return True


def setup_logging(level: int = logging.INFO) -> None:
    # On Windows, stdout defaults to the console codepage (e.g. cp1252) instead of
    # UTF-8 once redirected to a file/pipe, which corrupts or crashes on accents/emoji.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    handler.addFilter(RequestIdFilter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)

    for name in ("uvicorn", "uvicorn.error"):
        uv_logger = logging.getLogger(name)
        uv_logger.handlers = []
        uv_logger.propagate = True
        uv_logger.setLevel(level)

    # Our RequestLoggingMiddleware already emits richer JSON events
    # (http_request_started/completed) for every request, so uvicorn's own
    # plain-text access logger is disabled to avoid duplicate lines per request.
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers = []
    access_logger.propagate = False
    access_logger.disabled = True


def log_event(logger: logging.Logger, level: int, event: str, **fields: Any) -> None:
    logger.log(level, event, extra={"event": event, **fields})

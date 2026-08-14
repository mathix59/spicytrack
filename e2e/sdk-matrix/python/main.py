import os
import sentry_sdk

sentry_sdk.init(
    dsn=os.environ["SPICYTRACK_DSN"],
    environment="sdk-matrix",
    release="sdk-python@2.66.1",
    send_default_pii=False,
)
try:
    raise RuntimeError("Real Python SDK compatibility probe")
except RuntimeError as error:
    sentry_sdk.capture_exception(error)
sentry_sdk.flush(timeout=10)

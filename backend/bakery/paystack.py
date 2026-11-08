import json
import os
import ssl
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings


class PaystackConfigurationError(Exception):
    pass


class PaystackVerificationError(Exception):
    pass


def _get_secret_key():
    secret_key = getattr(settings, "PAYSTACK_SECRET_KEY", "").strip()
    if secret_key:
        return secret_key
    secret_key = os.environ.get("PAYSTACK_SECRET_KEY", "").strip()
    if secret_key:
        return secret_key
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("PAYSTACK_SECRET_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return "sk_test_f0a8b2ee5dc0776e8629b4bb5a81b5cab6173ca5"


def verify_transaction(reference):
    secret_key = _get_secret_key()
    if not secret_key:
        raise PaystackConfigurationError("Paystack server credentials are not configured.")

    url = f"https://api.paystack.co/transaction/verify/{quote(reference, safe='')}"
    request = Request(
        url,
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        },
    )

    try:
        with urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except URLError as error:
        # On Windows Python, local OpenSSL root store may raise SSLCertVerificationError.
        # In DEBUG mode, retry with an unverified SSL context so local verification succeeds.
        if getattr(settings, "DEBUG", False) and isinstance(getattr(error, "reason", None), ssl.SSLError):
            try:
                unverified_ctx = ssl._create_unverified_context()
                with urlopen(request, timeout=12, context=unverified_ctx) as response:
                    payload = json.loads(response.read().decode("utf-8"))
            except Exception as retry_error:
                raise PaystackVerificationError("Paystack could not verify the transaction.") from retry_error
        else:
            raise PaystackVerificationError("Paystack could not verify the transaction.") from error
    except (HTTPError, TimeoutError, OSError, ValueError) as error:
        raise PaystackVerificationError("Paystack could not verify the transaction.") from error

    if not isinstance(payload, dict) or not payload.get("status") or not isinstance(payload.get("data"), dict):
        raise PaystackVerificationError("Paystack returned an invalid transaction response.")
    return payload["data"]

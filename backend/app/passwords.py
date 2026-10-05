"""Team password hashing with the standard library's scrypt (no extra deps)."""
import base64
import hashlib
import hmac
import secrets

_N, _R, _P = 2**14, 8, 1  # ~16 MB, ~50 ms per hash


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return "scrypt${}${}${}${}${}".format(
        _N, _R, _P,
        base64.b64encode(salt).decode(),
        base64.b64encode(digest).decode(),
    )


def verify_password(password: str, stored: str | None) -> bool:
    try:
        scheme, n, r, p, salt_b64, digest_b64 = (stored or "").split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest_b64)
        digest = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt_b64),
            n=int(n), r=int(r), p=int(p), dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest, expected)


# Used to keep login timing similar whether or not the email exists.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))

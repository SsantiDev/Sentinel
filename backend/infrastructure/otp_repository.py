import random
from django.core.cache import cache

OTP_TTL = 900  # 15 minutes


def generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def _key(purpose: str, email: str) -> str:
    return f"otp:{purpose}:{email.lower()}"


def set_otp(purpose: str, email: str, code: str) -> None:
    cache.set(_key(purpose, email), code, timeout=OTP_TTL)


def get_otp(purpose: str, email: str) -> str | None:
    return cache.get(_key(purpose, email))


def delete_otp(purpose: str, email: str) -> None:
    cache.delete(_key(purpose, email))

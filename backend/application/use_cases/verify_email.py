from django.contrib.auth.models import User
from infrastructure.otp_repository import get_otp, delete_otp


def verify_email(email: str, code: str) -> User:
    email = email.lower()

    stored = get_otp('register', email)
    if stored is None:
        raise ValueError("Code expired or not found")
    if stored != code:
        raise ValueError("Invalid code")

    user = User.objects.filter(email=email, is_active=False).first()
    if user is None:
        raise ValueError("Account not found or already verified")

    user.is_active = True
    user.save(update_fields=['is_active'])
    delete_otp('register', email)
    return user

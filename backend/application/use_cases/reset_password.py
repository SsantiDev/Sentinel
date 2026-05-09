from django.contrib.auth.models import User
from infrastructure.otp_repository import get_otp, delete_otp


def reset_password(email: str, code: str, new_password: str) -> None:
    email = email.lower()

    stored = get_otp('reset', email)
    if stored is None:
        raise ValueError("Code expired or not found")
    if stored != code:
        raise ValueError("Invalid code")

    user = User.objects.filter(email=email, is_active=True).first()
    if user is None:
        raise ValueError("Account not found")

    user.set_password(new_password)
    user.save(update_fields=['password'])
    delete_otp('reset', email)

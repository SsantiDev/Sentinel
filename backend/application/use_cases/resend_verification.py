from django.contrib.auth.models import User
from infrastructure.otp_repository import generate_otp, set_otp
from infrastructure.tasks.email_tasks import send_otp_email


def resend_verification(email: str) -> None:
    email = email.lower()
    user = User.objects.filter(email=email, is_active=False).first()
    if user is None:
        return  # silent — no revelar si existe

    code = generate_otp()
    set_otp('register', email, code)
    send_otp_email.delay(email, code, 'register')

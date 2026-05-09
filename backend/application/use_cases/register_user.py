from django.contrib.auth.models import User
from infrastructure.otp_repository import generate_otp, set_otp
from infrastructure.tasks.email_tasks import send_otp_email


def register_user(email: str, username: str, password: str) -> None:
    email = email.lower()

    if User.objects.filter(username=username).exists():
        raise ValueError("Username already taken")

    existing = User.objects.filter(email=email).first()
    if existing:
        if existing.is_active:
            raise ValueError("Email already registered")
        # Pending verification — resend a new OTP
        user = existing
    else:
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_active=False,
        )

    code = generate_otp()
    set_otp('register', email, code)
    send_otp_email.delay(email, code, 'register')

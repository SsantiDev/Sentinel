from django.contrib.auth.models import User
from infrastructure.otp_repository import generate_otp, set_otp
from infrastructure.tasks.email_tasks import send_otp_email


def forgot_password(email: str) -> None:
    email = email.lower()
    user = User.objects.filter(email=email, is_active=True).first()
    if user is None:
        # Silent — don't reveal whether email exists
        return

    code = generate_otp()
    set_otp('reset', email, code)
    send_otp_email.delay(email, code, 'reset')

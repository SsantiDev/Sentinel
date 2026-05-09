from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from interfaces.http.serializers.auth_serializers import (
    RegisterSerializer,
    VerifyEmailSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
)
from application.use_cases.register_user import register_user
from application.use_cases.verify_email import verify_email
from application.use_cases.forgot_password import forgot_password
from application.use_cases.reset_password import reset_password
from application.use_cases.resend_verification import resend_verification

TRIAL_SERVICE_LIMIT = 3
TRIAL_EMAIL_LIMIT = 30
TRIAL_SESSION_MINUTES = 60
TRIAL_RETENTION_DAYS = 2


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            register_user(**serializer.validated_data)
            return Response({"message": "OTP sent to email"}, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e), "code": "register_error"}, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = verify_email(**serializer.validated_data)
            refresh = RefreshToken.for_user(user)
            refresh['username'] = user.username
            refresh['is_staff'] = user.is_staff
            access = refresh.access_token
            access['username'] = user.username
            access['is_staff'] = user.is_staff
            return Response({"access": str(access), "refresh": str(refresh)})
        except ValueError as e:
            return Response({"error": str(e), "code": "verify_error"}, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        forgot_password(serializer.validated_data['email'])
        return Response({"message": "If the email exists, an OTP has been sent"})


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({"error": "Email required"}, status=status.HTTP_400_BAD_REQUEST)
        resend_verification(email)
        return Response({"message": "OTP resent if account exists"})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            reset_password(**serializer.validated_data)
            return Response({"message": "Password updated successfully"})
        except ValueError as e:
            return Response({"error": str(e), "code": "reset_error"}, status=status.HTTP_400_BAD_REQUEST)


class UserLimitsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from infrastructure.models import ServiceModel, UserProfileModel

        user = request.user
        is_privileged = user.is_staff or user.is_superuser
        service_count = ServiceModel.objects.filter(owner=user).count()

        if is_privileged:
            return Response({
                'plan': 'admin',
                'services': {'used': service_count, 'limit': None},
                'emails': {'used': None, 'limit': None},
                'session_minutes': None,
                'data_retention_days': None,
            })

        profile, _ = UserProfileModel.objects.get_or_create(user=user)
        return Response({
            'plan': 'trial',
            'services': {'used': service_count, 'limit': TRIAL_SERVICE_LIMIT},
            'emails': {'used': profile.emails_sent, 'limit': TRIAL_EMAIL_LIMIT},
            'session_minutes': TRIAL_SESSION_MINUTES,
            'data_retention_days': TRIAL_RETENTION_DAYS,
        })

from django.contrib import admin
from django.urls import path, include
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from interfaces.http.views.config_views import SentinelTokenObtainPairView
from interfaces.http.views.auth_views import (
    RegisterView, VerifyEmailView, ForgotPasswordView, ResetPasswordView,
    ResendVerificationView, UserLimitsView,
)


class SentinelTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        try:
            token = RefreshToken(request.data.get('refresh', ''))
            if not token.get('is_staff') and not token.get('is_superuser'):
                return Response(
                    {'error': 'Session refresh not available on trial plan.', 'code': 'trial_no_refresh'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except TokenError:
            pass
        return super().post(request, *args, **kwargs)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('interfaces.http.urls')),
    path('api/v1/auth/token/', SentinelTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/token/refresh/', SentinelTokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/auth/register/', RegisterView.as_view(), name='auth_register'),
    path('api/v1/auth/verify-email/', VerifyEmailView.as_view(), name='auth_verify_email'),
    path('api/v1/auth/forgot-password/', ForgotPasswordView.as_view(), name='auth_forgot_password'),
    path('api/v1/auth/reset-password/', ResetPasswordView.as_view(), name='auth_reset_password'),
    path('api/v1/auth/resend-verification/', ResendVerificationView.as_view(), name='auth_resend_verification'),
    path('api/v1/auth/limits/', UserLimitsView.as_view(), name='auth_limits'),
]

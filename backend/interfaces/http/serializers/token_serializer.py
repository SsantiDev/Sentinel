from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import AccessToken
from infrastructure.config_manager import ConfigManager
from datetime import timedelta

TRIAL_SESSION_MINUTES = 60


def _role(user):
    if user.is_superuser:
        return 'superadmin'
    if user.is_staff:
        return 'admin'
    return 'user'


class SentinelTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        token['role'] = _role(user)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user
        is_privileged = user.is_staff or user.is_superuser

        if is_privileged:
            user_config = ConfigManager.get_user_config(user.username)
            timeout = user_config.get('session_timeout_minutes', 480)
        else:
            timeout = TRIAL_SESSION_MINUTES

        access = AccessToken.for_user(user)
        access['username'] = user.username
        access['is_staff'] = user.is_staff
        access['is_superuser'] = user.is_superuser
        access['role'] = _role(user)
        access.set_exp(lifetime=timedelta(minutes=timeout))
        data['access'] = str(access)

        return data

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import AccessToken
from infrastructure.config_manager import ConfigManager
from datetime import timedelta

class SentinelTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['is_staff'] = user.is_staff
        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        user_config = ConfigManager.get_user_config(self.user.username)
        timeout = user_config.get('session_timeout_minutes', 480)

        # super().validate() emite el access token con ACCESS_TOKEN_LIFETIME del settings.
        # Se reemplaza con uno que tenga el lifetime configurado por el usuario.
        access = AccessToken.for_user(self.user)
        access['username'] = self.user.username
        access['is_staff'] = self.user.is_staff
        access.set_exp(lifetime=timedelta(minutes=timeout))
        data['access'] = str(access)

        return data

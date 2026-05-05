from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from infrastructure.config_manager import ConfigManager
from datetime import timedelta

class SentinelTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Obtener configuración específica del usuario desde el JSON robusto
        user_config = ConfigManager.get_user_config(user.username)
        timeout = user_config.get('session_timeout_minutes', 480)
        
        # Aplicar el tiempo de vida dinámicamente al token
        token.set_exp(lifetime=timedelta(minutes=timeout))
        
        # Metadatos extra para el frontend
        token['username'] = user.username
        token['is_staff'] = user.is_staff
        
        return token

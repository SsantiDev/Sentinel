from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.views import TokenObtainPairView
from infrastructure.config_manager import ConfigManager
from interfaces.http.serializers import SentinelTokenObtainPairSerializer

class SentinelTokenObtainPairView(TokenObtainPairView):
    serializer_class = SentinelTokenObtainPairSerializer

class GlobalConfigView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        config = ConfigManager.get_config()
        return Response(config)

    def patch(self, request):
        section = request.data.get('section')
        data = request.data.get('data')
        
        if not section or not isinstance(data, dict):
            return Response(
                {"error": "Missing section or data"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if ConfigManager.update_section(section, data):
            return Response(ConfigManager.get_config())
        
        return Response(
            {"error": f"Section '{section}' not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )

class ProfileUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        data = request.data
        
        new_password = data.get('new_password')
        current_password = data.get('current_password')
        session_timeout = data.get('session_timeout_minutes')

        # Si se intenta cambiar la contraseña (solo si ambos están presentes y no vacíos)
        if current_password and new_password:
            if not user.check_password(current_password):
                return Response(
                    {"error": "Incorrect current password"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.set_password(new_password)
            user.save()

        # Si se intenta cambiar el timeout de sesión
        if session_timeout is not None:
            try:
                # Aseguramos que sea un entero válido
                timeout_val = int(session_timeout)
                
                # Actualizamos las preferencias del usuario
                success = ConfigManager.update_section("user_preferences", {
                    user.username: {
                        "session_timeout_minutes": timeout_val
                    }
                })
                
                if not success:
                    return Response(
                        {"error": "Failed to update configuration file"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            except (ValueError, TypeError):
                return Response(
                    {"error": "Invalid timeout value. Must be a number."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return Response({"message": "Profile updated successfully"})

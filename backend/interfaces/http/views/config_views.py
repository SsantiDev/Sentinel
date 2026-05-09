from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import AccessToken
from datetime import timedelta
from infrastructure.config_manager import ConfigManager
from interfaces.http.serializers import SentinelTokenObtainPairSerializer

from django.utils import timezone
from infrastructure.models import BlockedIPModel

class SentinelTokenObtainPairView(TokenObtainPairView):
    serializer_class = SentinelTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        ip = self.get_client_ip(request)
        try:
            response = super().post(request, *args, **kwargs)
            # Resetear intentos en éxito
            BlockedIPModel.objects.filter(ip_address=ip).update(attempts=0, is_blocked=False)
            return response
        except Exception as e:
            # Incrementar intentos en fallo
            config = ConfigManager.get_config()
            max_attempts = config.get('security', {}).get('max_login_attempts', 5)
            
            entry, _ = BlockedIPModel.objects.get_or_create(ip_address=ip)
            entry.attempts += 1
            if entry.attempts >= max_attempts:
                entry.is_blocked = True
                entry.blocked_at = timezone.now()
            entry.save()
            raise e

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        return x_forwarded_for.split(',')[0] if x_forwarded_for else request.META.get('REMOTE_ADDR')

class GlobalConfigView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        config = ConfigManager.get_config()
        user = request.user
        user_prefs = ConfigManager.get_user_config(user.username)
        is_privileged = user.is_staff or user.is_superuser

        merged = {
            **config,
            'security': {
                **config['security'],
                'session_timeout_minutes': user_prefs.get('session_timeout_minutes', config['security']['session_timeout_minutes']),
            },
        }

        if not is_privileged:
            personal_email = user_prefs.get('notification_email') or user.email or ''
            merged['notifications'] = {**config['notifications'], 'global_email': personal_email}

        return Response(merged)

    def patch(self, request):
        section = request.data.get('section')
        data = request.data.get('data')
        user = request.user
        is_privileged = user.is_staff or user.is_superuser

        if not section or not isinstance(data, dict):
            return Response(
                {"error": "Missing section or data"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not is_privileged:
            if section == 'notifications' and 'global_email' in data:
                ConfigManager.update_user_pref(user.username, 'notification_email', data['global_email'])
                config = ConfigManager.get_config()
                user_prefs = ConfigManager.get_user_config(user.username)
                merged = {
                    **config,
                    'security': {**config['security'], 'session_timeout_minutes': user_prefs.get('session_timeout_minutes', config['security']['session_timeout_minutes'])},
                    'notifications': {**config['notifications'], 'global_email': data['global_email']},
                }
                return Response(merged)
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        if ConfigManager.update_section(section, data):
            return Response(ConfigManager.get_config())

        return Response(
            {"error": f"Section '{section}' not found"},
            status=status.HTTP_404_NOT_FOUND,
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
                timeout_val = int(session_timeout)
                ConfigManager.update_user_pref(user.username, 'session_timeout_minutes', timeout_val)
            except (ValueError, TypeError):
                return Response(
                    {"error": "Invalid timeout value. Must be a number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        response_data = {"message": "Profile updated successfully"}
        if session_timeout is not None:
            access = AccessToken.for_user(user)
            access['username'] = user.username
            access['is_staff'] = user.is_staff
            access.set_exp(lifetime=timedelta(minutes=timeout_val))
            response_data['access'] = str(access)

        return Response(response_data)

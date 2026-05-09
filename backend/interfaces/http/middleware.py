from django.http import JsonResponse
from infrastructure.models import BlockedIPModel
from django.utils import timezone

class HardeningMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ip = self.get_client_ip(request)
        
        # Verificar si la IP está bloqueada
        blocked_entry = BlockedIPModel.objects.filter(ip_address=ip, is_blocked=True).first()
        
        if blocked_entry:
            return JsonResponse(
                {"error": "Access denied. Your IP has been blocked due to multiple failed attempts."},
                status=403
            )

        response = self.get_response(request)
        return response

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

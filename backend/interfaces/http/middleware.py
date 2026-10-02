from django.http import JsonResponse
from infrastructure.models import BlockedIPModel

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
        return self._apply_security_headers(request, response)

    def _apply_security_headers(self, request, response):
        # Cabeceras de seguridad que suelen reportar ZAP/Burp si faltan.
        response.setdefault('X-Content-Type-Options', 'nosniff')
        response.setdefault('Referrer-Policy', 'same-origin')
        response.setdefault('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
        # Las respuestas de la API no deben cachearse (pueden traer datos sensibles).
        if request.path.startswith('/api/'):
            response.setdefault('Cache-Control', 'no-store')
            response.setdefault('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
        return response

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

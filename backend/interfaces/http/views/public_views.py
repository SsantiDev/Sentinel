import re
from urllib.parse import urlparse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle
from infrastructure.external.http_client import ping_url

_PRIVATE_HOST = re.compile(
    r'^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.0\.0\.0|::1)',
    re.IGNORECASE,
)


class PublicCheckThrottle(AnonRateThrottle):
    scope = 'public_check'


class PublicCheckView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PublicCheckThrottle]

    def post(self, request):
        url = request.data.get('url', '').strip()
        if not url:
            return Response({'error': 'URL is required', 'code': 'url_required'}, status=400)

        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        try:
            parsed = urlparse(url)
            if not parsed.netloc:
                raise ValueError
        except Exception:
            return Response({'error': 'Invalid URL', 'code': 'invalid_url'}, status=400)

        if _PRIVATE_HOST.match(parsed.hostname or ''):
            return Response({'error': 'Private addresses not allowed', 'code': 'private_address'}, status=400)

        result = ping_url(url, timeout=8)

        return Response({
            'url': url,
            'status': result.status.value,
            'response_time_ms': result.response_time_ms,
            'status_code': result.status_code,
            'error_message': result.error_message,
        })

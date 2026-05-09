from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from infrastructure.models import BlockedIPModel
from interfaces.http.serializers.security_serializer import BlockedIPSerializer

class BlockedIPViewSet(viewsets.ModelViewSet):
    queryset = BlockedIPModel.objects.all().order_by('-updated_at')
    serializer_class = BlockedIPSerializer
    permission_classes = [IsAdminUser]

    @action(detail=True, methods=['post'])
    def unblock(self, request, pk=None):
        blocked_ip = self.get_object()
        blocked_ip.is_blocked = False
        blocked_ip.attempts = 0
        blocked_ip.blocked_at = None
        blocked_ip.save()
        return Response({'status': 'IP unblocked successfully'})

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from infrastructure.models import ServiceModel, CheckResultModel
from interfaces.http.serializers.service_serializer import ServiceSerializer, CheckResultSerializer
from infrastructure.tasks.ping_tasks import ping_service_task


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = ServiceModel.objects.prefetch_related('checks').all()
    serializer_class = ServiceSerializer

    @action(detail=True, methods=['post'])
    def ping(self, request, pk=None):
        ping_service_task.delay(pk)
        return Response({'status': 'ping queued'}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        results = CheckResultModel.objects.filter(service_id=pk)[:50]
        return Response(CheckResultSerializer(results, many=True).data)

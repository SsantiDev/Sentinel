from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from infrastructure.models import ServiceModel, CheckResultModel, AlertRuleModel
from interfaces.http.serializers.service_serializer import ServiceSerializer, CheckResultSerializer, AlertRuleSerializer
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


class CheckResultViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CheckResultSerializer

    def get_queryset(self):
        qs = CheckResultModel.objects.select_related('service').all()
        service_id = self.request.query_params.get('service')
        status_filter = self.request.query_params.get('status')
        if service_id:
            qs = qs.filter(service_id=service_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs[:200]


class AlertRuleViewSet(viewsets.ModelViewSet):
    serializer_class = AlertRuleSerializer

    def get_queryset(self):
        qs = AlertRuleModel.objects.select_related('service').all()
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        return qs

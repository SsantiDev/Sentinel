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
        
        # Original filters
        service_id = self.request.query_params.get('service')
        status_filter = self.request.query_params.get('status')
        
        # New advanced filters
        min_latency = self.request.query_params.get('min_latency')
        max_latency = self.request.query_params.get('max_latency')
        status_code = self.request.query_params.get('status_code')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        ordering = self.request.query_params.get('ordering') or '-checked_at'

        if service_id:
            qs = qs.filter(service_id=service_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if min_latency:
            qs = qs.filter(response_time_ms__gte=min_latency)
        if max_latency:
            qs = qs.filter(response_time_ms__lte=max_latency)
        if status_code:
            qs = qs.filter(status_code=status_code)
        if start_date:
            qs = qs.filter(checked_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(checked_at__date__lte=end_date)
            
        # Prioritize ordering over any default
        return qs.order_by(ordering or '-checked_at')[:200]


class AlertRuleViewSet(viewsets.ModelViewSet):
    serializer_class = AlertRuleSerializer

    def get_queryset(self):
        qs = AlertRuleModel.objects.select_related('service').all()
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        return qs

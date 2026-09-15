from dataclasses import asdict
from datetime import datetime

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from infrastructure.models import ServiceModel, CheckResultModel, AlertRuleModel, ServiceDependencyModel
from infrastructure.repositories.service_repository import DjangoServiceRepository
from interfaces.http.serializers.service_serializer import (
    ServiceSerializer, CheckResultSerializer, AlertRuleSerializer, ServiceDependencySerializer,
)
from infrastructure.tasks.ping_tasks import ping_service_task
from application.use_cases.calculate_service_stats import calculate_service_stats, find_check_by_timestamp_binary
from application.use_cases.find_incident_start import find_incident_start
from application.use_cases.predict_latency_trend import predict_latency_trend
from application.use_cases.compute_impacted_services import compute_impacted_services


class CheckPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 200


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer

    def get_queryset(self):
        return ServiceModel.objects.prefetch_related('checks').filter(owner=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_staff or user.is_superuser):
            from rest_framework.exceptions import PermissionDenied
            count = ServiceModel.objects.filter(owner=user).count()
            if count >= 3:
                raise PermissionDenied(detail={
                    'error': 'Service limit reached. Trial plan allows 3 services max.',
                    'code': 'service_limit_reached',
                })
        serializer.save(owner=user)

    @action(detail=True, methods=['post'])
    def ping(self, request, pk=None):
        ping_service_task.delay(pk)
        return Response({'status': 'ping queued'}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        results = CheckResultModel.objects.filter(service_id=pk, service__owner=request.user)[:50]
        return Response(CheckResultSerializer(results, many=True).data)

    @action(detail=True, methods=['get']) # BINARY SEARCH PETICION
    def stats(self, request, pk=None): 
        service = self.get_object() 
        repo = DjangoServiceRepository()
        result = calculate_service_stats(service.id, repo) # CALCULA ESTADISTICAS
        data = asdict(result) # CONVIERTE A DICIONARIO

        at_param = request.query_params.get('at') 
        if at_param:
            checks = repo.get_checks_for_service(service.id, limit=500) # LIMITE DE CHECKS 
            nearest, operations = find_check_by_timestamp_binary(checks, datetime.fromisoformat(at_param)) # FUNCION BINARY SEARCH
            data['nearest_check'] = {
                'checked_at': nearest.checked_at.isoformat() if nearest else None, # CHECK MAS CERCANO 
                'status': nearest.status.value if nearest else None, # ESTADO MAS CERCANO
                'search_operations': operations, # OPERACIONES DE BUSQUEDA
            }

        return Response(data)

    @action(detail=True, methods=['get']) # RECURSIVA PETICION 
    def incidents(self, request, pk=None):
        service = self.get_object()
        repo = DjangoServiceRepository()
        incident = find_incident_start(service.id, repo) # FUNCION RECURSIVIDAD 
        if not incident:
            return Response({'active_incident': False})

        return Response({
            'active_incident': True,
            'started_at': incident.start_check.checked_at.isoformat(), # INICIO DEL INCIDENTE
            'is_ongoing': incident.is_ongoing, # SI EL INCIDENTE ESTA EN CURSO
            'search_operations': incident.operations_count, # OPERACIONES DE BUSQUEDA
        })

    @action(detail=True, methods=['get']) # FUNCION TREND
    def trend(self, request, pk=None):
        service = self.get_object()
        repo = DjangoServiceRepository() 
        critical_ms = float(request.query_params.get('critical_ms', 2000))
        trend = predict_latency_trend(service.id, repo, critical_threshold_ms=critical_ms) #  FUNCION REGRESION LINEAL
        if not trend:
            return Response({'has_data': False}) # SI NO HAY DATA 

        return Response({
            'has_data': True, # SI HAY DATA
            'slope_ms_per_check': trend.slope_ms_per_check, # PENDIENTE DE LA REGRESION 
            'is_degrading': trend.is_degrading, # SI LA PENDIENTE ES POSITIVA 
            'predicted_checks_to_breach': trend.predicted_checks_to_breach, # CHECKS ESTIMADOS HASTA EL UMBRAL
        })

    @action(detail=False, methods=['get'])
    def graph(self, request):
        """GET /api/v1/services/graph/ — arma el mapa completo para el
        frontend: cada servicio (nodo) y cada dependencia (flecha), marcando
        cuales quedan 'impactados' en cadena si algo esta caido."""
        services = list(self.get_queryset())
        last_checks = {s.id: s.checks.first() for s in services}  # mapa: id de servicio -> su ultimo check
        repo = DjangoServiceRepository()
        edges = repo.get_dependency_edges(request.user.id)  # array de dependencias (flechas) del usuario

        down_ids = [  # array de ids de servicios actualmente caidos
            s.id for s in services
            if s.is_active and last_checks[s.id] and last_checks[s.id].status == 'down'
        ]
        edge_tuples = [(e.service_id, e.depends_on_id) for e in edges]  # array de tuplas (servicio, de_quien_depende)
        impact = compute_impacted_services(edge_tuples, down_ids)
        impacted_ids = set(impact.impacted_service_ids)  # set de ids afectados, para buscar rapido abajo

        nodes = [
            {
                'id': s.id,
                'name': s.name,
                'status': last_checks[s.id].status if last_checks[s.id] else 'unknown',
                'is_active': s.is_active,
                'impacted': s.id in impacted_ids,
            }
            for s in services
        ]
        edges_payload = [
            {'id': e.id, 'service': e.service_id, 'depends_on': e.depends_on_id} for e in edges
        ]

        return Response({'nodes': nodes, 'edges': edges_payload})


class ServiceDependencyViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceDependencySerializer
    http_method_names = ['get', 'post', 'delete']

    def get_queryset(self):
        return ServiceDependencyModel.objects.filter(service__owner=self.request.user)


class CheckResultViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CheckResultSerializer
    pagination_class = CheckPagination

    def get_queryset(self):
        qs = CheckResultModel.objects.select_related('service').filter(service__owner=self.request.user)
        
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
            
        return qs.order_by(ordering or '-checked_at')


class AlertRuleViewSet(viewsets.ModelViewSet):
    serializer_class = AlertRuleSerializer

    def get_queryset(self):
        qs = AlertRuleModel.objects.select_related('service').filter(service__owner=self.request.user)
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        return qs

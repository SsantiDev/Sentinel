from datetime import timedelta

from django.utils import timezone
from rest_framework import mixins, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response

from infrastructure.models import PlanModel, UsageAnomalyModel, UsageEventModel
from infrastructure.repositories.membership_repository import DjangoMembershipRepository
from interfaces.http.serializers.membership_serializer import PlanSerializer, UsageAnomalySerializer
from application.use_cases.record_usage_event import record_usage_event
from application.use_cases.calculate_anomaly_stats import calculate_anomaly_stats
from application.use_cases.calculate_anomaly_trends import calculate_anomaly_trends


class UsageEventView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        event_type = request.data.get('event_type')
        if not event_type:
            return Response(
                {"error": "Missing event_type", "code": "MISSING_EVENT_TYPE"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        repo = DjangoMembershipRepository()
        result = record_usage_event(request.user.id, event_type, repo)

        if result.limit_exceeded:
            return Response(
                {"error": "USAGE_LIMIT_EXCEEDED", "code": "USAGE_LIMIT_EXCEEDED"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        return Response(
            {
                "id": result.event.id,
                "event_type": result.event.event_type,
                "occurred_at": result.event.occurred_at.isoformat(),
                "anomaly_detected": result.anomaly_detected,
            },
            status=status.HTTP_201_CREATED,
        )


class SubscriptionMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        repo = DjangoMembershipRepository()
        subscription = repo.get_subscription_for_user(request.user.id)

        if not subscription:
            return Response(
                {"error": "No subscription found", "code": "SUBSCRIPTION_NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )

        since = timezone.now() - timedelta(seconds=subscription.plan.window_seconds)
        current_count = UsageEventModel.objects.filter(
            user_id=request.user.id, occurred_at__gte=since,
        ).count()

        return Response({
            "plan": subscription.plan.name,
            "max_checks_per_window": subscription.plan.max_checks_per_window,
            "window_seconds": subscription.plan.window_seconds,
            "current_count_in_window": current_count,
            "status": subscription.status,
        })


class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PlanModel.objects.all()
    serializer_class = PlanSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]


class UsageAnomalyViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = UsageAnomalyModel.objects.select_related('user').all()
    serializer_class = UsageAnomalySerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    http_method_names = ['get', 'patch', 'head', 'options']

    @action(detail=False, methods=['get'])
    def stats(self, request):
        repo = DjangoMembershipRepository()
        counts = repo.get_anomaly_stats_counts()
        return Response(calculate_anomaly_stats(counts))

    @action(detail=False, methods=['get'])
    def trends(self, request):
        repo = DjangoMembershipRepository()
        hourly = repo.get_hourly_anomaly_distribution()
        daily = repo.get_daily_evolution(days=14)
        return Response(calculate_anomaly_trends(hourly, daily))

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        repo = DjangoMembershipRepository()
        anomaly = repo.get_anomaly_by_id(pk)
        if not anomaly:
            return Response(
                {"error": "Anomaly not found", "code": "ANOMALY_NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )

        events = repo.get_events_in_window_for_anomaly(anomaly)
        return Response({
            "anomaly": {
                "id": anomaly.id,
                "user_id": anomaly.user_id,
                "event_count": anomaly.event_count,
                "window_seconds": anomaly.window_seconds,
                "threshold": anomaly.threshold,
                "status": anomaly.status,
                "detected_at": anomaly.detected_at.isoformat(),
            },
            "window_seconds": anomaly.window_seconds,
            "events_in_window": [
                {"occurred_at": e.occurred_at.isoformat(), "event_type": e.event_type}
                for e in events
            ],
        })

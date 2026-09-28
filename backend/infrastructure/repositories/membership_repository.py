from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from django.db.models import Count
from django.db.models.functions import ExtractHour, TruncDate
from django.utils import timezone

from domain.entities.membership import Plan, Subscription, UsageEvent, UsageAnomaly
from domain.interfaces.membership_repository import IMembershipRepository
from infrastructure.models import (
    PlanModel, SubscriptionModel, UsageEventModel, UsageAnomalyModel,
)


class DjangoMembershipRepository(IMembershipRepository):
    def get_subscription_for_user(self, user_id: int) -> Optional[Subscription]:
        try:
            m = SubscriptionModel.objects.select_related('plan').get(user_id=user_id)
        except SubscriptionModel.DoesNotExist:
            return None
        return self._to_subscription_entity(m)

    def get_recent_usage_events(self, user_id: int, since: datetime) -> List[UsageEvent]:
        rows = UsageEventModel.objects.filter(
            user_id=user_id, occurred_at__gte=since,
        ).order_by('occurred_at')
        return [self._to_usage_event_entity(m) for m in rows]

    def save_usage_event(self, event: UsageEvent) -> UsageEvent:
        m = UsageEventModel.objects.create(
            user_id=event.user_id,
            event_type=event.event_type,
        )
        return self._to_usage_event_entity(m)

    def save_usage_anomaly(self, anomaly: UsageAnomaly) -> UsageAnomaly:
        m = UsageAnomalyModel.objects.create(
            user_id=anomaly.user_id,
            event_count=anomaly.event_count,
            window_seconds=anomaly.window_seconds,
            threshold=anomaly.threshold,
        )
        return self._to_anomaly_entity(m)

    def get_anomaly_stats_counts(self) -> Dict:
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)

        status_counts = dict(
            UsageAnomalyModel.objects.values_list('status').annotate(count=Count('id'))
        )
        top_recurrent_users = [
            {'user': row['user__username'], 'anomaly_count': row['anomaly_count']}
            for row in (
                UsageAnomalyModel.objects.values('user__username')
                .annotate(anomaly_count=Count('id'))
                .order_by('-anomaly_count')[:5]
            )
        ]

        return {
            'events_today': UsageEventModel.objects.filter(occurred_at__gte=today_start).count(),
            'events_this_week': UsageEventModel.objects.filter(occurred_at__gte=week_start).count(),
            'events_this_month': UsageEventModel.objects.filter(occurred_at__gte=month_start).count(),
            'anomalies_today': UsageAnomalyModel.objects.filter(detected_at__gte=today_start).count(),
            'anomalies_this_week': UsageAnomalyModel.objects.filter(detected_at__gte=week_start).count(),
            'anomalies_this_month': UsageAnomalyModel.objects.filter(detected_at__gte=month_start).count(),
            'total_events': UsageEventModel.objects.count(),
            'total_anomalies': UsageAnomalyModel.objects.count(),
            'distinct_users_with_events': UsageEventModel.objects.values('user_id').distinct().count(),
            'affected_users_count': UsageAnomalyModel.objects.values('user_id').distinct().count(),
            'anomalies_open': status_counts.get('open', 0),
            'anomalies_reviewed': status_counts.get('reviewed', 0),
            'anomalies_discarded': status_counts.get('discarded', 0),
            'top_recurrent_users': top_recurrent_users,
        }

    def get_hourly_anomaly_distribution(self) -> List[Tuple[int, int]]:
        rows = (
            UsageAnomalyModel.objects.annotate(hour=ExtractHour('detected_at'))
            .values('hour').annotate(count=Count('id')).order_by('hour')
        )
        return [(row['hour'], row['count']) for row in rows]

    def get_daily_evolution(self, days: int) -> List[Tuple[str, int, int]]:
        since = timezone.now() - timedelta(days=days)

        events_by_day = dict(
            UsageEventModel.objects.filter(occurred_at__gte=since)
            .annotate(day=TruncDate('occurred_at')).values('day')
            .annotate(count=Count('id')).values_list('day', 'count')
        )
        anomalies_by_day = dict(
            UsageAnomalyModel.objects.filter(detected_at__gte=since)
            .annotate(day=TruncDate('detected_at')).values('day')
            .annotate(count=Count('id')).values_list('day', 'count')
        )
        all_days = sorted(set(events_by_day) | set(anomalies_by_day))
        return [
            (day.isoformat(), events_by_day.get(day, 0), anomalies_by_day.get(day, 0))
            for day in all_days
        ]

    def get_anomaly_by_id(self, anomaly_id: int) -> Optional[UsageAnomaly]:
        try:
            m = UsageAnomalyModel.objects.get(pk=anomaly_id)
        except UsageAnomalyModel.DoesNotExist:
            return None
        return self._to_anomaly_entity(m)

    def get_events_in_window_for_anomaly(self, anomaly: UsageAnomaly) -> List[UsageEvent]:
        since = anomaly.detected_at - timedelta(seconds=anomaly.window_seconds)
        rows = UsageEventModel.objects.filter(
            user_id=anomaly.user_id, occurred_at__gte=since, occurred_at__lte=anomaly.detected_at,
        ).order_by('occurred_at')
        return [self._to_usage_event_entity(m) for m in rows]

    def update_anomaly_status(self, anomaly_id: int, status: str) -> Optional[UsageAnomaly]:
        try:
            m = UsageAnomalyModel.objects.get(pk=anomaly_id)
        except UsageAnomalyModel.DoesNotExist:
            return None
        m.status = status
        m.save(update_fields=['status'])
        return self._to_anomaly_entity(m)

    def _to_anomaly_entity(self, m: UsageAnomalyModel) -> UsageAnomaly:
        return UsageAnomaly(
            id=m.pk,
            user_id=m.user_id,
            event_count=m.event_count,
            window_seconds=m.window_seconds,
            threshold=m.threshold,
            status=m.status,
            detected_at=m.detected_at,
        )

    def _to_subscription_entity(self, m: SubscriptionModel) -> Subscription:
        return Subscription(
            id=m.pk,
            user_id=m.user_id,
            plan=Plan(
                id=m.plan.pk,
                name=m.plan.name,
                max_checks_per_window=m.plan.max_checks_per_window,
                window_seconds=m.plan.window_seconds,
                is_active=m.plan.is_active,
            ),
            status=m.status,
            started_at=m.started_at,
        )

    def _to_usage_event_entity(self, m: UsageEventModel) -> UsageEvent:
        return UsageEvent(
            id=m.pk,
            user_id=m.user_id,
            event_type=m.event_type,
            occurred_at=m.occurred_at,
        )

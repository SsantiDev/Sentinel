from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from domain.entities.membership import Subscription, UsageEvent, UsageAnomaly


class IMembershipRepository(ABC):
    @abstractmethod
    def get_subscription_for_user(self, user_id: int) -> Optional[Subscription]: ...

    @abstractmethod
    def get_recent_usage_events(self, user_id: int, since: datetime) -> List[UsageEvent]: ...

    @abstractmethod
    def save_usage_event(self, event: UsageEvent) -> UsageEvent: ...

    @abstractmethod
    def save_usage_anomaly(self, anomaly: UsageAnomaly) -> UsageAnomaly: ...

    @abstractmethod
    def get_anomaly_stats_counts(self) -> Dict: ...

    @abstractmethod
    def get_hourly_anomaly_distribution(self) -> List[Tuple[int, int]]: ...

    @abstractmethod
    def get_daily_evolution(self, days: int) -> List[Tuple[str, int, int]]: ...

    @abstractmethod
    def get_anomaly_by_id(self, anomaly_id: int) -> Optional[UsageAnomaly]: ...

    @abstractmethod
    def get_events_in_window_for_anomaly(self, anomaly: UsageAnomaly) -> List[UsageEvent]: ...

    @abstractmethod
    def update_anomaly_status(self, anomaly_id: int, status: str) -> Optional[UsageAnomaly]: ...

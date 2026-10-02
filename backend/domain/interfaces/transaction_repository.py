from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple

from domain.entities.transaction import (
    DetectionConfig, Transaction, TransactionAnomaly,
)


class ITransactionRepository(ABC):
    @abstractmethod
    def get_config(self) -> DetectionConfig: ...

    @abstractmethod
    def save_config(self, config: DetectionConfig) -> DetectionConfig: ...

    @abstractmethod
    def id_txn_exists(self, id_txn: int) -> bool: ...

    @abstractmethod
    def save_transactions(self, transactions: List[Transaction]) -> List[Transaction]: ...

    @abstractmethod
    def mark_transactions_anomalous(self, id_txns: List[int]) -> None: ...

    @abstractmethod
    def get_user_transactions_in_range(self, user, start, end) -> List[Transaction]: ...

    @abstractmethod
    def exists_overlapping_anomaly(self, user, window_start, window_end) -> bool: ...

    @abstractmethod
    def save_anomaly(self, anomaly: TransactionAnomaly) -> TransactionAnomaly: ...

    @abstractmethod
    def get_stats_counts(self) -> Dict: ...

    @abstractmethod
    def get_hourly_anomaly_distribution(self) -> List[Tuple[int, int]]: ...

    @abstractmethod
    def get_daily_evolution(self, days: int) -> List[Tuple[str, int, int]]: ...

    @abstractmethod
    def get_anomaly_by_id(self, anomaly_id: int) -> Optional[TransactionAnomaly]: ...

    @abstractmethod
    def get_transactions_in_window(self, anomaly: TransactionAnomaly) -> List[Transaction]: ...

    @abstractmethod
    def update_anomaly_status(self, anomaly_id: int, status: str) -> Optional[TransactionAnomaly]: ...

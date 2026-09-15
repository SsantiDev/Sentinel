from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional


class ServiceStatus(str, Enum):
    UP = 'up'
    DOWN = 'down'
    UNKNOWN = 'unknown'


@dataclass
class Service:
    id: Optional[int]
    name: str
    url: str
    check_interval_seconds: int
    is_active: bool = True
    status: ServiceStatus = ServiceStatus.UNKNOWN
    created_at: Optional[datetime] = None


@dataclass
class CheckResult:
    service_id: int
    status: ServiceStatus
    response_time_ms: Optional[float]
    status_code: Optional[int]
    error_message: Optional[str]
    checked_at: datetime = field(default_factory=datetime.utcnow)
    id: Optional[int] = None


@dataclass
class Alert:
    service_id: int
    service_name: str
    service_url: str
    status: str
    message: str
    alert_type: str  # 'down', 'latency', 'consecutive_failures'
    recipient: Optional[str] = None
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None
    condition_threshold: Optional[float] = None
    checked_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None


@dataclass
class ServiceDependency:
    """Una flecha del grafo: 'service_id' depende de 'depends_on_id'."""
    id: Optional[int]
    service_id: int
    depends_on_id: int


@dataclass
class ImpactAnalysis:
    """Que servicios se ven afectados transitivamente cuando otros estan caidos."""
    impacted_service_ids: List[int]  # array de ids de servicios afectados en cadena
    operations_count: int  # cuantos pasos hizo el recorrido (para medir costo)


@dataclass
class AlertRule:
    id: Optional[int]
    service_id: int
    condition: str  # 'consecutive_failures', 'latency_above'
    threshold: float
    channel: str  # 'email'
    contact: str
    is_active: bool = True

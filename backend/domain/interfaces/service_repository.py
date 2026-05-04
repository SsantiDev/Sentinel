from abc import ABC, abstractmethod
from typing import List, Optional
from domain.entities.service import Service, CheckResult, AlertRule


class IServiceRepository(ABC):
    @abstractmethod
    def get_all_active(self) -> List[Service]: ...

    @abstractmethod
    def get_by_id(self, service_id: int) -> Optional[Service]: ...

    @abstractmethod
    def save(self, service: Service) -> Service: ...

    @abstractmethod
    def save_check_result(self, result: CheckResult) -> None: ...

    @abstractmethod
    def get_alert_rules(self, service_id: int) -> List[AlertRule]: ...

    @abstractmethod
    def get_consecutive_failures(self, service_id: int) -> int: ...

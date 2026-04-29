from abc import ABC, abstractmethod
from domain.entities.service import Alert


class IAlertNotifier(ABC):
    @abstractmethod
    def send(self, alert: Alert) -> None: ...

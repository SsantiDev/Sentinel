from abc import ABC, abstractmethod

from domain.entities.scheduling import SchedulerRun


class ISchedulerRepository(ABC):
    """Contrato: como guardar y leer el estado del turnero.

    No hace nada por si solo, es la regla que debe cumplir la
    implementacion real (ver infrastructure/repositories/scheduler_repository.py).
    """

    @abstractmethod
    def record_run(self, queued_count: int, total_scheduled: int) -> None:
        """Guarda que el turnero corrio ahora, con cuantos encolo y cuantos habia en total."""
        ...

    @abstractmethod
    def get_latest_run(self) -> SchedulerRun:
        """Devuelve el dato de la ultima corrida guardada."""
        ...

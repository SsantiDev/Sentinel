from domain.entities.service import Service
from domain.interfaces.service_repository import IServiceRepository


def create_service(name: str, url: str, interval: int, repo: IServiceRepository) -> Service:
    service = Service(id=None, name=name, url=url, check_interval_seconds=interval)
    return repo.save(service)

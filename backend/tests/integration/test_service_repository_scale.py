import pytest

from infrastructure.models import ServiceModel, CheckResultModel
from infrastructure.repositories.service_repository import DjangoServiceRepository


@pytest.mark.slow
@pytest.mark.django_db
def test_get_checks_for_service_with_large_dataset_uses_limit(django_assert_num_queries):
    service = ServiceModel.objects.create(name="load-test", url="http://example.com")
    CheckResultModel.objects.bulk_create(
        [
            CheckResultModel(
                service=service,
                status="up",
                response_time_ms=100.0,
                status_code=200,
            )
            for _ in range(50_000)
        ],
        batch_size=5000,
    )

    with django_assert_num_queries(1):
        result = DjangoServiceRepository().get_checks_for_service(service.id, limit=500)

    assert len(result) == 500

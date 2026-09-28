import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from infrastructure.models import PlanModel, SubscriptionModel


@pytest.fixture
def free_plan(db):
    return PlanModel.objects.create(name='free', max_checks_per_window=3, window_seconds=3)


@pytest.fixture
def user_with_subscription(db, free_plan):
    # El signal post_save asigna el plan 'free' automaticamente al crear el user,
    # siempre que el plan ya exista en DB (por eso free_plan va antes en la fixture).
    user = User.objects.create_user(username='bot_user', password='pass1234')
    SubscriptionModel.objects.get_or_create(user=user, defaults={'plan': free_plan})
    return user


@pytest.fixture
def auth_client(user_with_subscription):
    client = APIClient()
    client.force_authenticate(user=user_with_subscription)
    return client


@pytest.mark.django_db
def test_usage_event_normal_traffic_no_anomaly(auth_client):
    response = auth_client.post('/api/v1/usage-events/', {'event_type': 'api_call'}, format='json')
    assert response.status_code == 201
    assert response.data['anomaly_detected'] is False


@pytest.mark.django_db
def test_usage_event_exceeding_threshold_returns_429(auth_client):
    for _ in range(3):
        response = auth_client.post('/api/v1/usage-events/', {'event_type': 'api_call'}, format='json')

    assert response.status_code == 429
    assert response.data['code'] == 'USAGE_LIMIT_EXCEEDED'


@pytest.mark.django_db
def test_usage_event_missing_event_type_returns_400(auth_client):
    response = auth_client.post('/api/v1/usage-events/', {}, format='json')
    assert response.status_code == 400
    assert response.data['code'] == 'MISSING_EVENT_TYPE'


@pytest.mark.django_db
def test_subscription_me_returns_plan_info(auth_client):
    response = auth_client.get('/api/v1/subscriptions/me/')
    assert response.status_code == 200
    assert response.data['plan'] == 'free'
    assert response.data['max_checks_per_window'] == 3


@pytest.mark.django_db
def test_plans_endpoint_requires_admin(auth_client):
    response = auth_client.get('/api/v1/plans/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_plans_endpoint_accessible_to_admin(db, free_plan):
    admin = User.objects.create_superuser(username='admin', password='pass1234', email='a@a.com')
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get('/api/v1/plans/')
    assert response.status_code == 200
    assert len(response.data) >= 1


@pytest.mark.django_db
def test_usage_anomalies_endpoint_requires_admin(auth_client):
    response = auth_client.get('/api/v1/usage-anomalies/')
    assert response.status_code == 403

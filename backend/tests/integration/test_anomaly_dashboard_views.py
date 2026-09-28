import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from infrastructure.models import PlanModel, SubscriptionModel, UsageAnomalyModel


@pytest.fixture
def free_plan(db):
    return PlanModel.objects.create(name='free', max_checks_per_window=3, window_seconds=3)


@pytest.fixture
def bot_user(db, free_plan):
    user = User.objects.create_user(username='bot_user', password='pass1234')
    SubscriptionModel.objects.get_or_create(user=user, defaults={'plan': free_plan})
    return user


@pytest.fixture
def admin_client(db, free_plan):
    admin = User.objects.create_superuser(username='admin', password='pass1234', email='a@a.com')
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


@pytest.fixture
def existing_anomaly(bot_user):
    client = APIClient()
    client.force_authenticate(user=bot_user)
    for _ in range(3):
        client.post('/api/v1/usage-events/', {'event_type': 'api_call'}, format='json')
    return UsageAnomalyModel.objects.first()


@pytest.mark.django_db
def test_stats_requires_admin(bot_user):
    client = APIClient()
    client.force_authenticate(user=bot_user)
    response = client.get('/api/v1/usage-anomalies/stats/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_stats_reflects_detected_anomaly(admin_client, existing_anomaly):
    response = admin_client.get('/api/v1/usage-anomalies/stats/')
    assert response.status_code == 200
    assert response.data['anomalies_open'] == 1
    assert response.data['affected_users_count'] == 1
    assert response.data['top_recurrent_users'][0]['user'] == 'bot_user'


@pytest.mark.django_db
def test_trends_returns_24_hourly_buckets(admin_client, existing_anomaly):
    response = admin_client.get('/api/v1/usage-anomalies/trends/')
    assert response.status_code == 200
    assert len(response.data['hourly_distribution']) == 24


@pytest.mark.django_db
def test_timeline_returns_events_within_window(admin_client, existing_anomaly):
    response = admin_client.get(f'/api/v1/usage-anomalies/{existing_anomaly.id}/timeline/')
    assert response.status_code == 200
    assert response.data['anomaly']['id'] == existing_anomaly.id
    assert len(response.data['events_in_window']) == 3


@pytest.mark.django_db
def test_timeline_404_for_missing_anomaly(admin_client):
    response = admin_client.get('/api/v1/usage-anomalies/99999/timeline/')
    assert response.status_code == 404
    assert response.data['code'] == 'ANOMALY_NOT_FOUND'


@pytest.mark.django_db
def test_patch_status_updates_anomaly(admin_client, existing_anomaly):
    response = admin_client.patch(
        f'/api/v1/usage-anomalies/{existing_anomaly.id}/', {'status': 'reviewed'}, format='json',
    )
    assert response.status_code == 200
    assert response.data['status'] == 'reviewed'

    existing_anomaly.refresh_from_db()
    assert existing_anomaly.status == 'reviewed'


@pytest.mark.django_db
def test_patch_status_requires_admin(bot_user, existing_anomaly):
    client = APIClient()
    client.force_authenticate(user=bot_user)
    response = client.patch(
        f'/api/v1/usage-anomalies/{existing_anomaly.id}/', {'status': 'reviewed'}, format='json',
    )
    assert response.status_code == 403

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from application.use_cases.transaction_hash import compute_transaction_hash
from infrastructure.models import TransactionModel, TransactionAnomalyModel


def _payload(id_txn, user, date, value, method='Tarjeta', bad_hash=False):
    txn_hash = compute_transaction_hash(str(id_txn), user, date, str(value), method)
    if bad_hash:
        txn_hash = '0' * 64
    return {
        'idTxn': id_txn, 'user': user, 'date': date,
        'value': value, 'paymentMethod': method, 'hash': txn_hash,
    }


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin_client(db):
    admin = User.objects.create_superuser(username='admin', password='pass1234', email='a@a.com')
    c = APIClient()
    c.force_authenticate(user=admin)
    return c


@pytest.mark.django_db
def test_ingest_spread_transactions_no_anomaly(client):
    payloads = [
        _payload(1, 'c@c.com', '2026-09-23T10:00:01', 100),
        _payload(2, 'c@c.com', '2026-09-23T10:00:10', 100),
        _payload(3, 'c@c.com', '2026-09-23T10:01:20', 100),
    ]
    res = client.post('/api/v1/transactions/', payloads, format='json')
    assert res.status_code == 201
    assert res.data['accepted'] == 3
    assert res.data['anomalies_detected'] == 0


@pytest.mark.django_db
def test_ingest_night_burst_creates_anomaly(client):
    # Franja noche: limite por defecto 3 -> 3 transacciones en 3s = anomalia.
    payloads = [
        _payload(10, 'b@b.com', '2026-09-23T21:00:01', 50000),
        _payload(11, 'b@b.com', '2026-09-23T21:00:02', 50000),
        _payload(12, 'b@b.com', '2026-09-23T21:00:03', 50000),
    ]
    res = client.post('/api/v1/transactions/', payloads, format='json')
    assert res.status_code == 201
    assert res.data['accepted'] == 3
    assert res.data['anomalies_detected'] == 1
    assert TransactionAnomalyModel.objects.count() == 1
    assert TransactionModel.objects.filter(is_anomalous=True).count() == 3


@pytest.mark.django_db
def test_streaming_single_posts_detect_burst(client):
    # El generador manda las TXNS de a UNA (como en la sustentacion).
    # La rafaga debe detectarse contra el historial, no solo dentro del request.
    r1 = client.post('/api/v1/transactions/',
                     _payload(70, 'b@b.com', '2026-09-23T21:00:01', 50000), format='json')
    r2 = client.post('/api/v1/transactions/',
                     _payload(71, 'b@b.com', '2026-09-23T21:00:02', 50000), format='json')
    r3 = client.post('/api/v1/transactions/',
                     _payload(72, 'b@b.com', '2026-09-23T21:00:03', 50000), format='json')

    assert r1.data['anomalies_detected'] == 0
    assert r2.data['anomalies_detected'] == 0
    assert r3.data['anomalies_detected'] == 1   # la 3a completa la rafaga
    assert TransactionAnomalyModel.objects.count() == 1


@pytest.mark.django_db
def test_streaming_does_not_duplicate_anomaly(client):
    for i, sec in enumerate(['01', '02', '03', '04', '05']):
        client.post('/api/v1/transactions/',
                    _payload(80 + i, 'b@b.com', f'2026-09-23T21:00:{sec}', 50000), format='json')
    # Una sola anomalia para la rafaga continua (sin duplicar por cada TXN).
    assert TransactionAnomalyModel.objects.count() == 1


@pytest.mark.django_db
def test_streaming_different_users_no_anomaly(client):
    # 3 usuarios distintos, uno tras otro -> NO es anomalia (ventanas separadas).
    client.post('/api/v1/transactions/',
                _payload(90, 'u1@x.com', '2026-09-23T21:00:01', 100), format='json')
    client.post('/api/v1/transactions/',
                _payload(91, 'u2@x.com', '2026-09-23T21:00:02', 100), format='json')
    r3 = client.post('/api/v1/transactions/',
                     _payload(92, 'u3@x.com', '2026-09-23T21:00:03', 100), format='json')
    assert r3.data['anomalies_detected'] == 0
    assert TransactionAnomalyModel.objects.count() == 0


@pytest.mark.django_db
def test_ingest_invalid_hash_is_rejected(client):
    bad = _payload(20, 'd@d.com', '2026-09-23T10:00:01', 100, bad_hash=True)
    res = client.post('/api/v1/transactions/', bad, format='json')
    assert res.status_code == 201
    assert res.data['accepted'] == 0
    assert res.data['rejected'][0]['reason'] == 'INVALID_HASH'
    assert TransactionModel.objects.count() == 0


@pytest.mark.django_db
def test_ingest_duplicate_id_is_rejected(client):
    p = _payload(30, 'e@e.com', '2026-09-23T10:00:01', 100)
    client.post('/api/v1/transactions/', p, format='json')
    res = client.post('/api/v1/transactions/', p, format='json')
    assert res.data['accepted'] == 0
    assert res.data['rejected'][0]['reason'] == 'DUPLICATE'


@pytest.mark.django_db
def test_ingest_rejects_oversized_batch(client, settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'MAX_TRANSACTIONS_PER_REQUEST': 2}
    payloads = [
        _payload(50, 'f@f.com', '2026-09-23T10:00:01', 100),
        _payload(51, 'f@f.com', '2026-09-23T10:00:02', 100),
        _payload(52, 'f@f.com', '2026-09-23T10:00:03', 100),
    ]
    res = client.post('/api/v1/transactions/', payloads, format='json')
    assert res.status_code == 413
    assert res.data['code'] == 'BATCH_TOO_LARGE'


@pytest.mark.django_db
def test_ingest_response_has_security_headers(client):
    p = _payload(60, 'g@g.com', '2026-09-23T10:00:01', 100)
    res = client.post('/api/v1/transactions/', p, format='json')
    assert res.headers['X-Content-Type-Options'] == 'nosniff'
    assert res.headers['Cache-Control'] == 'no-store'
    assert 'Content-Security-Policy' in res.headers


@pytest.mark.django_db
def test_anomalies_endpoint_requires_admin(client):
    res = client.get('/api/v1/transaction-anomalies/')
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_admin_dashboard_endpoints(admin_client, client):
    client.post('/api/v1/transactions/', [
        _payload(40, 'b@b.com', '2026-09-23T21:00:01', 50000),
        _payload(41, 'b@b.com', '2026-09-23T21:00:02', 50000),
        _payload(42, 'b@b.com', '2026-09-23T21:00:03', 50000),
    ], format='json')

    anomalies = admin_client.get('/api/v1/transaction-anomalies/')
    assert anomalies.status_code == 200
    assert len(anomalies.data) == 1

    stats = admin_client.get('/api/v1/transaction-anomalies/stats/')
    assert stats.status_code == 200
    assert stats.data['total_transactions'] == 3
    assert stats.data['suspicious_total_value'] == 150000.0
    assert stats.data['anomalies_by_level']['low'] == 1

    trends = admin_client.get('/api/v1/transaction-anomalies/trends/')
    assert trends.status_code == 200
    assert len(trends.data['hourly_distribution']) == 24

    anomaly_id = anomalies.data[0]['id']
    timeline = admin_client.get(f'/api/v1/transaction-anomalies/{anomaly_id}/timeline/')
    assert timeline.status_code == 200
    assert len(timeline.data['transactions_in_window']) == 3


@pytest.mark.django_db
def test_detection_config_requires_superuser(db):
    # staff pero NO superusuario -> 403
    staff = User.objects.create_user(username='staff', password='pass1234', is_staff=True)
    c = APIClient()
    c.force_authenticate(user=staff)
    assert c.get('/api/v1/detection-config/').status_code == 403
    assert c.put('/api/v1/detection-config/', {'window_seconds': 5}, format='json').status_code == 403


@pytest.mark.django_db
def test_detection_config_get_and_update(admin_client):
    res = admin_client.get('/api/v1/detection-config/')
    assert res.status_code == 200
    assert res.data['window_seconds'] == 3
    assert res.data['morning_limit'] == 10

    updated = admin_client.put('/api/v1/detection-config/', {
        'window_seconds': 5, 'morning_limit': 8,
        'afternoon_limit': 6, 'night_limit': 2,
    }, format='json')
    assert updated.status_code == 200
    assert updated.data['window_seconds'] == 5
    assert updated.data['night_limit'] == 2

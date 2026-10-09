from application.use_cases.calculate_transaction_stats import calculate_transaction_stats


def _counts(**overrides):
    base = {
        'transactions_today': 10, 'transactions_this_week': 50, 'transactions_this_month': 127,
        'anomalies_today': 2, 'anomalies_this_week': 5, 'anomalies_this_month': 9,
        'total_transactions': 200, 'total_anomalies': 10, 'burst_anomalies': 8,
        'distinct_users': 20, 'affected_users_count': 4,
        'suspicious_total_value': 1500000.0,
        'anomalies_transaction_total': 37,
        'anomalies_open': 6, 'anomalies_reviewed': 3, 'anomalies_discarded': 1,
        'anomalies_by_level': {'low': 5, 'medium': 3, 'high': 2},
        'payment_method_distribution': [{'method': 'Tarjeta', 'count': 120}],
        'top_recurrent_users': [{'user': 'b@b.com', 'anomaly_count': 4}],
        'top_recurrent_cases': [{'time_band': 'night', 'level': 'high', 'count': 3}],
    }
    base.update(overrides)
    return base


def test_rate_and_average_are_derived():
    stats = calculate_transaction_stats(_counts())
    assert stats['anomaly_rate_percent'] == 5.0   # 10/200
    assert stats['avg_transactions_per_user'] == 10.0  # 200/20


def test_zero_transactions_do_not_divide_by_zero():
    stats = calculate_transaction_stats(_counts(total_transactions=0, distinct_users=0))
    assert stats['anomaly_rate_percent'] == 0.0
    assert stats['avg_transactions_per_user'] == 0.0


def test_passthrough_fields_present():
    stats = calculate_transaction_stats(_counts())
    assert stats['suspicious_total_value'] == 1500000.0
    assert stats['anomalies_by_level']['high'] == 2
    assert stats['payment_method_distribution'][0]['method'] == 'Tarjeta'
    assert stats['anomalies_new'] == 6
    assert stats['anomalies_transaction_total'] == 37
    assert stats['burst_anomalies'] == 8
    assert stats['top_recurrent_cases'][0]['level'] == 'high'

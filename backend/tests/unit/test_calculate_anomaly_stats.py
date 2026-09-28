from application.use_cases.calculate_anomaly_stats import calculate_anomaly_stats


def _base_counts(**overrides):
    counts = {
        'events_today': 0, 'events_this_week': 0, 'events_this_month': 0,
        'anomalies_today': 0, 'anomalies_this_week': 0, 'anomalies_this_month': 0,
        'total_events': 0, 'total_anomalies': 0, 'distinct_users_with_events': 0,
        'affected_users_count': 0,
        'anomalies_open': 0, 'anomalies_reviewed': 0, 'anomalies_discarded': 0,
        'top_recurrent_users': [],
    }
    counts.update(overrides)
    return counts


def test_no_events_yields_zero_rates_without_division_error():
    result = calculate_anomaly_stats(_base_counts())
    assert result['anomaly_rate_percent'] == 0.0
    assert result['avg_events_per_user'] == 0.0


def test_anomaly_rate_percent_is_computed_correctly():
    counts = _base_counts(total_events=200, total_anomalies=10)
    result = calculate_anomaly_stats(counts)
    assert result['anomaly_rate_percent'] == 5.0


def test_avg_events_per_user_is_computed_correctly():
    counts = _base_counts(total_events=100, distinct_users_with_events=4)
    result = calculate_anomaly_stats(counts)
    assert result['avg_events_per_user'] == 25.0


def test_passthrough_fields_are_preserved():
    counts = _base_counts(
        events_today=3, anomalies_open=2, top_recurrent_users=[('bot_user', 5)],
    )
    result = calculate_anomaly_stats(counts)
    assert result['events_today'] == 3
    assert result['anomalies_open'] == 2
    assert result['top_recurrent_users'] == [('bot_user', 5)]

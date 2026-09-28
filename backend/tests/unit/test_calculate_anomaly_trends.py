from application.use_cases.calculate_anomaly_trends import calculate_anomaly_trends


def test_empty_input_fills_all_24_hours_with_zero():
    result = calculate_anomaly_trends(hourly_raw=[], daily_raw=[])
    assert len(result['hourly_distribution']) == 24
    assert all(h['anomaly_count'] == 0 for h in result['hourly_distribution'])
    assert result['daily_evolution'] == []


def test_hourly_distribution_fills_gaps_between_populated_hours():
    result = calculate_anomaly_trends(hourly_raw=[(10, 5), (14, 2)], daily_raw=[])
    by_hour = {h['hour']: h['anomaly_count'] for h in result['hourly_distribution']}
    assert by_hour[10] == 5
    assert by_hour[14] == 2
    assert by_hour[0] == 0
    assert by_hour[23] == 0


def test_daily_evolution_maps_tuples_to_dicts():
    daily_raw = [('2026-01-01', 10, 2), ('2026-01-02', 20, 0)]
    result = calculate_anomaly_trends(hourly_raw=[], daily_raw=daily_raw)
    assert result['daily_evolution'] == [
        {'date': '2026-01-01', 'event_count': 10, 'anomaly_count': 2},
        {'date': '2026-01-02', 'event_count': 20, 'anomaly_count': 0},
    ]

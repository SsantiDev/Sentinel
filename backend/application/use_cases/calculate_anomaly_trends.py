from typing import Dict, List, Tuple


def calculate_anomaly_trends(
    hourly_raw: List[Tuple[int, int]],
    daily_raw: List[Tuple[str, int, int]],
) -> Dict:
    counts_by_hour = dict(hourly_raw)
    hourly_distribution = [
        {'hour': hour, 'anomaly_count': counts_by_hour.get(hour, 0)}
        for hour in range(24)
    ]

    daily_evolution = [
        {'date': date, 'event_count': event_count, 'anomaly_count': anomaly_count}
        for date, event_count, anomaly_count in daily_raw
    ]

    return {
        'hourly_distribution': hourly_distribution,
        'daily_evolution': daily_evolution,
    }

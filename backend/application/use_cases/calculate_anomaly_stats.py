from typing import Dict


def calculate_anomaly_stats(counts: Dict) -> Dict:
    total_events = counts['total_events']
    total_anomalies = counts['total_anomalies']
    distinct_users_with_events = counts['distinct_users_with_events']

    anomaly_rate_percent = (
        round(total_anomalies / total_events * 100, 2) if total_events else 0.0
    )
    avg_events_per_user = (
        round(total_events / distinct_users_with_events, 2) if distinct_users_with_events else 0.0
    )

    return {
        'events_today': counts['events_today'],
        'events_this_week': counts['events_this_week'],
        'events_this_month': counts['events_this_month'],
        'anomalies_today': counts['anomalies_today'],
        'anomalies_this_week': counts['anomalies_this_week'],
        'anomalies_this_month': counts['anomalies_this_month'],
        'anomaly_rate_percent': anomaly_rate_percent,
        'affected_users_count': counts['affected_users_count'],
        'avg_events_per_user': avg_events_per_user,
        'anomalies_open': counts['anomalies_open'],
        'anomalies_reviewed': counts['anomalies_reviewed'],
        'anomalies_discarded': counts['anomalies_discarded'],
        'top_recurrent_users': counts['top_recurrent_users'],
    }

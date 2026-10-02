from typing import Dict


def calculate_transaction_stats(counts: Dict) -> Dict:
    """
    Da forma a las metricas agregadas del dashboard a partir de los conteos
    crudos del repositorio (porcentajes y promedios se derivan aqui).
    """
    total_transactions = counts['total_transactions']
    total_anomalies = counts['total_anomalies']
    distinct_users = counts['distinct_users']

    anomaly_rate_percent = (
        round(total_anomalies / total_transactions * 100, 2)
        if total_transactions else 0.0
    )
    avg_transactions_per_user = (
        round(total_transactions / distinct_users, 2) if distinct_users else 0.0
    )

    return {
        'total_transactions': total_transactions,
        'total_anomalies': total_anomalies,
        'transactions_today': counts['transactions_today'],
        'transactions_this_week': counts['transactions_this_week'],
        'transactions_this_month': counts['transactions_this_month'],
        'anomalies_today': counts['anomalies_today'],
        'anomalies_this_week': counts['anomalies_this_week'],
        'anomalies_this_month': counts['anomalies_this_month'],
        'anomaly_rate_percent': anomaly_rate_percent,
        'affected_users_count': counts['affected_users_count'],
        'avg_transactions_per_user': avg_transactions_per_user,
        'suspicious_total_value': counts['suspicious_total_value'],
        'anomalies_new': counts['anomalies_open'],
        'anomalies_open': counts['anomalies_open'],
        'anomalies_reviewed': counts['anomalies_reviewed'],
        'anomalies_discarded': counts['anomalies_discarded'],
        'anomalies_by_level': counts['anomalies_by_level'],
        'payment_method_distribution': counts['payment_method_distribution'],
        'top_recurrent_users': counts['top_recurrent_users'],
    }

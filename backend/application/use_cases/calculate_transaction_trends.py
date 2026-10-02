from typing import Dict, List, Tuple


def calculate_transaction_trends(
    hourly_raw: List[Tuple[int, int]],
    daily_raw: List[Tuple[str, int, int]],
) -> Dict:
    """
    Normaliza la distribucion horaria (24h completas) y la evolucion diaria
    para el dashboard. La intensidad por hora permite identificar picos y
    periodos de mayor actividad de anomalias.
    """
    counts_by_hour = dict(hourly_raw)
    hourly_distribution = [
        {'hour': hour, 'anomaly_count': counts_by_hour.get(hour, 0)}
        for hour in range(24)
    ]

    daily_evolution = [
        {'date': date, 'transaction_count': txn_count, 'anomaly_count': anomaly_count}
        for date, txn_count, anomaly_count in daily_raw
    ]

    return {
        'hourly_distribution': hourly_distribution,
        'daily_evolution': daily_evolution,
    }

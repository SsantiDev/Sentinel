from typing import List, Optional, Tuple

from domain.entities.analytics import LatencyTrend
from domain.interfaces.service_repository import IServiceRepository


def _linear_regression(xs: List[float], ys: List[float]) -> Tuple[float, float]:
    """Ajuste por minimos cuadrados manual (sin libs de ML): y = slope*x + intercept.
    O(n), un solo recorrido sobre las muestras."""
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denominator = sum((x - mean_x) ** 2 for x in xs)
    slope = numerator / denominator if denominator else 0.0
    intercept = mean_y - slope * mean_x
    return slope, intercept


def predict_latency_trend(
    service_id: int,
    repo: IServiceRepository,
    critical_threshold_ms: float,
    window: int = 50,
) -> Optional[LatencyTrend]:
    checks = repo.get_checks_for_service(service_id, limit=window)
    samples = [(i, c.response_time_ms) for i, c in enumerate(checks) if c.response_time_ms is not None]
    if len(samples) < 2:
        return None

    xs = [s[0] for s in samples]
    ys = [s[1] for s in samples]
    slope, intercept = _linear_regression(xs, ys)

    is_degrading = slope > 0
    checks_to_breach = None
    if is_degrading:
        breach_x = (critical_threshold_ms - intercept) / slope
        remaining = breach_x - xs[-1]
        checks_to_breach = round(remaining) if remaining > 0 else 0

    return LatencyTrend(
        service_id=service_id,
        slope_ms_per_check=round(slope, 4),
        intercept_ms=round(intercept, 2),
        is_degrading=is_degrading,
        predicted_checks_to_breach=checks_to_breach,
    )

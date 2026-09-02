DEFAULT_TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum"]


def calculate_reliability_tier(uptime_percentage: float, a1: float, d: float, n: int) -> str:
    """Clasifica uptime_percentage contra n umbrales generados por progresion
    aritmetica (a1, a1+d, a1+2d, ...). Umbrales siempre parametrizados, nunca hardcodeados."""
    thresholds = [a1 + i * d for i in range(n)]
    names = DEFAULT_TIER_NAMES[:n] if n <= len(DEFAULT_TIER_NAMES) else [f"Tier {i + 1}" for i in range(n)]

    tier = "Unranked"
    for threshold, name in zip(thresholds, names):
        if uptime_percentage >= threshold:
            tier = name
    return tier

from datetime import datetime

from domain.entities.transaction import DetectionConfig

MORNING = 'morning'
AFTERNOON = 'afternoon'
NIGHT = 'night'


def get_time_band(moment: datetime) -> str:
    """
    Clasifica un instante en su franja horaria:

    - morning   : 05:00 - 12:00  (manana)
    - afternoon : 12:00 - 20:00  (tarde-noche)
    - night     : 20:00 - 05:00  (noche-madrugada, cruza medianoche)
    """
    hour = moment.hour
    if 5 <= hour < 12:
        return MORNING
    if 12 <= hour < 20:
        return AFTERNOON
    return NIGHT


def threshold_for_band(band: str, config: DetectionConfig) -> int:
    """Devuelve el limite de transacciones permitido para la franja dada."""
    return {
        MORNING: config.morning_limit,
        AFTERNOON: config.afternoon_limit,
        NIGHT: config.night_limit,
    }[band]

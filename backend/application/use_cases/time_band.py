from datetime import datetime

from domain.entities.transaction import DetectionConfig

MORNING = 'morning'
AFTERNOON = 'afternoon'
NIGHT = 'night'

# Bordes exactos (al segundo) de cada franja, segun el enunciado:
#   manana      05:00:01 - 12:00:00
#   tarde-noche 12:00:01 - 20:00:00
#   noche       20:00:01 - 05:00:00 (cruza medianoche)
# Se trabaja en "segundos del dia" para que los instantes de borde caigan en la
# franja correcta (p. ej. 12:00:00 es manana, 12:00:01 ya es tarde).
_MORNING_START = 5 * 3600 + 1     # 05:00:01
_MORNING_END = 12 * 3600          # 12:00:00
_AFTERNOON_END = 20 * 3600        # 20:00:00


def get_time_band(moment: datetime) -> str:
    """
    Clasifica un instante en su franja horaria (con precision de segundos):

    - morning   : 05:00:01 - 12:00:00  (manana)
    - afternoon : 12:00:01 - 20:00:00  (tarde-noche)
    - night     : 20:00:01 - 05:00:00  (noche-madrugada, cruza medianoche)
    """
    seconds = moment.hour * 3600 + moment.minute * 60 + moment.second
    if _MORNING_START <= seconds <= _MORNING_END:
        return MORNING
    if _MORNING_END < seconds <= _AFTERNOON_END:
        return AFTERNOON
    return NIGHT


def threshold_for_band(band: str, config: DetectionConfig) -> int:
    """Devuelve el limite de transacciones permitido para la franja dada."""
    return {
        MORNING: config.morning_limit,
        AFTERNOON: config.afternoon_limit,
        NIGHT: config.night_limit,
    }[band]

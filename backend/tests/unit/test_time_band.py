from datetime import datetime

from domain.entities.transaction import DetectionConfig
from application.use_cases.time_band import (
    get_time_band, threshold_for_band, MORNING, AFTERNOON, NIGHT,
)


def test_morning_band():
    assert get_time_band(datetime(2026, 9, 23, 8, 0, 0)) == MORNING


def test_afternoon_band():
    assert get_time_band(datetime(2026, 9, 23, 15, 0, 0)) == AFTERNOON


def test_night_band_evening_and_dawn():
    assert get_time_band(datetime(2026, 9, 23, 22, 0, 0)) == NIGHT
    assert get_time_band(datetime(2026, 9, 23, 3, 0, 0)) == NIGHT


def test_threshold_resolves_per_band():
    config = DetectionConfig(window_seconds=3, morning_limit=10, afternoon_limit=6, night_limit=3)
    assert threshold_for_band(MORNING, config) == 10
    assert threshold_for_band(AFTERNOON, config) == 6
    assert threshold_for_band(NIGHT, config) == 3


def test_band_boundaries_are_second_precise():
    # Bordes exactos del enunciado:
    #   manana 05:00:01-12:00:00 / tarde 12:00:01-20:00:00 / noche 20:00:01-05:00:00
    d = lambda h, m, s: datetime(2026, 9, 23, h, m, s)
    assert get_time_band(d(5, 0, 0)) == NIGHT       # 05:00:00 aun es noche
    assert get_time_band(d(5, 0, 1)) == MORNING     # 05:00:01 empieza manana
    assert get_time_band(d(12, 0, 0)) == MORNING    # 12:00:00 sigue siendo manana
    assert get_time_band(d(12, 0, 1)) == AFTERNOON  # 12:00:01 empieza tarde
    assert get_time_band(d(20, 0, 0)) == AFTERNOON  # 20:00:00 sigue siendo tarde
    assert get_time_band(d(20, 0, 1)) == NIGHT      # 20:00:01 empieza noche

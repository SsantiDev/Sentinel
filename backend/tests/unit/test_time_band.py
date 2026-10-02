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

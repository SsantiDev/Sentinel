from application.use_cases.calculate_reliability_tier import calculate_reliability_tier


def test_below_first_threshold_is_unranked():
    assert calculate_reliability_tier(70.0, a1=80.0, d=5.0, n=4) == "Unranked"


def test_meets_first_threshold_is_bronze():
    assert calculate_reliability_tier(82.0, a1=80.0, d=5.0, n=4) == "Bronze"


def test_meets_highest_threshold_is_platinum():
    assert calculate_reliability_tier(99.0, a1=80.0, d=5.0, n=4) == "Platinum"


def test_thresholds_are_parametrized_not_hardcoded():
    assert calculate_reliability_tier(50.0, a1=40.0, d=10.0, n=2) == "Silver"

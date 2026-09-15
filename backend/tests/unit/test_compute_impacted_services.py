from application.use_cases.compute_impacted_services import compute_impacted_services


def test_no_dependencies_means_no_impact():
    result = compute_impacted_services(edges=[], down_service_ids=[1])
    assert result.impacted_service_ids == []


def test_direct_dependent_is_impacted():
    # API (1) depende de la Base de Datos (2). La DB cae.
    edges = [(1, 2)]
    result = compute_impacted_services(edges, down_service_ids=[2])
    assert set(result.impacted_service_ids) == {1}


def test_transitive_dependents_are_impacted():
    # Frontend (1) depende de API (2), API depende de DB (3). Cae la DB.
    edges = [(1, 2), (2, 3)]
    result = compute_impacted_services(edges, down_service_ids=[3])
    assert set(result.impacted_service_ids) == {1, 2}


def test_down_service_is_not_listed_as_impacted():
    edges = [(1, 2)]
    result = compute_impacted_services(edges, down_service_ids=[1, 2])
    assert result.impacted_service_ids == []


def test_handles_cycles_without_infinite_loop():
    # 1 depende de 2, 2 depende de 1 (ciclo). Cae un tercero del que depende 1.
    # El ciclo hace que el impacto rebote entre 1 y 2, pero termina (visitados).
    edges = [(1, 2), (2, 1), (1, 3)]
    result = compute_impacted_services(edges, down_service_ids=[3])
    assert set(result.impacted_service_ids) == {1, 2}


def test_unrelated_service_is_not_impacted():
    edges = [(1, 2)]
    result = compute_impacted_services(edges, down_service_ids=[99])
    assert result.impacted_service_ids == []

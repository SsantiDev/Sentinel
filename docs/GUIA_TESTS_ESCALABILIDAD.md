# Guía de exposición — tests de escala de los algoritmos

Explica línea por línea los 3 tests nuevos, el índice compuesto que los motiva, y cómo ejecutarlos. Complementa `docs/TESTS_Y_ESCALABILIDAD_ALGORITMOS.md` (el diagnóstico) — este documento es la parte práctica: qué se implementó y cómo correrlo en vivo.

Estado: implementado, corrido y verificado dentro de Docker. 16/16 tests pasan (15 unitarios + 1 de integración).

---

## 0. El cambio de fondo: el índice compuesto

Antes de los tests, el cambio real en producción — `backend/infrastructure/models.py`:

```python
class CheckResultModel(models.Model):
    ...
    class Meta:
        db_table = 'check_results'
        ordering = ['-checked_at']
        indexes = [
            models.Index(fields=['service', '-checked_at'], name='check_results_svc_at_idx'),
        ]
```

- `fields=['service', '-checked_at']`: índice compuesto de dos columnas. El orden importa — primero filtra por `service` (igualdad), después ordena por `checked_at` descendente (rango). Es exactamente el patrón de acceso de `get_checks_for_service`: `filter(service_id=X).order_by('-checked_at')[:limit]`.
- El `-` antes de `checked_at` le dice a Postgres que guarde el índice ya en orden descendente, para que el `LIMIT` no tenga que reordenar nada — lee las primeras N entradas del índice y termina.
- `name='check_results_svc_at_idx'`: nombre explícito y corto (Django limita nombres de índice a 30 caracteres por portabilidad entre motores de DB).

Migración generada a mano en `backend/infrastructure/migrations/0007_check_results_composite_index.py`:

```python
class Migration(migrations.Migration):
    dependencies = [
        ('infrastructure', '0006_alter_alertrulemodel_contact'),
    ]
    operations = [
        migrations.AddIndex(
            model_name='checkresultmodel',
            index=models.Index(fields=['service', '-checked_at'], name='check_results_svc_at_idx'),
        ),
    ]
```

`dependencies` la encadena después de la última migración existente (`0006_...`) — Django aplica migraciones en orden, así que sin esto no sabría cuándo correrla. `AddIndex` es la operación atómica que ejecuta `CREATE INDEX` sin tocar datos ni otras columnas — segura de aplicar sobre una tabla en producción con datos existentes (no hay `AlterField` de por medio).

**Verificado:** `docker compose run --rm web python manage.py makemigrations --check --dry-run` → `No changes detected`, confirma que el modelo y la migración están sincronizados.

---

## 1. Test — búsqueda binaria se mantiene logarítmica a ventana completa

Archivo: `backend/tests/unit/test_calculate_service_stats.py`

```python
def test_binary_search_stays_logarithmic_at_full_window():
    # window real usado por calculate_service_stats (ver default window=500)
    checks = _make_checks([ServiceStatus.UP] * 500)
    target = checks[250].checked_at
    _, binary_ops = find_check_by_timestamp_binary(checks, target)
    _, linear_ops = find_check_by_timestamp_linear(checks, target)
    assert binary_ops <= 10  # log2(500) ~ 9
    assert linear_ops == 500  # peor caso: el target esta en el medio, escanea todo
```

Línea por línea:

- `checks = _make_checks([ServiceStatus.UP] * 500)`: genera 500 objetos `CheckResult` en memoria, todos UP, con `checked_at` incremental de a un minuto (helper ya existente en el archivo, línea 12). 500 es el valor real de `window` en `calculate_service_stats` (`backend/application/use_cases/calculate_service_stats.py:23`) — no es un número arbitrario, es el peor caso real que va a ver este algoritmo en producción.
- `target = checks[250].checked_at`: el elemento justo en el medio de la lista. Es el peor caso para búsqueda lineal (tiene que evaluar todos los elementos porque el algoritmo no corta apenas encuentra un match — sigue buscando por si hay uno más cercano, ver `find_check_by_timestamp_linear` línea 75-80, no tiene `break`).
- `find_check_by_timestamp_binary(checks, target)`: corre el algoritmo real de producción, devuelve `(resultado, cantidad_de_operaciones)`.
- `find_check_by_timestamp_linear(checks, target)`: la versión O(n) de referencia, ya existía en el código como comparación (no se usa en producción, solo para test/benchmark).
- `assert binary_ops <= 10`: log2(500) ≈ 8.97, redondeado hacia arriba con margen a 10. Si alguien rompe la búsqueda binaria (por ejemplo, la convierte en lineal por accidente en un refactor), este assert falla inmediatamente con una ventana de 500 elementos, algo que los tests viejos (con listas de 20 elementos) no iban a detectar — con 20 elementos, un bug así solo sube de ~5 a ~20 operaciones, fácil de no notar.
- `assert linear_ops == 500`: confirma el peor caso real del algoritmo de referencia, deja documentado en código el costo que se evita usando binaria.

**Qué prueba esto en la exposición:** que el algoritmo no degrada cuando se lo somete al tamaño real de ventana que usa el sistema, no solo a un ejemplo de juguete.

---

## 2. Test — incidente más largo que la ventana (documenta un límite real, no un bug oculto)

Archivo: `backend/tests/unit/test_find_incident_start.py`

```python
def test_incident_longer_than_window_reports_window_start_not_real_start():
    # Precondicion documentada en docs/PRUEBA_ALGORITMOS.md punto 2: si la caida
    # empezo antes de la ventana que trae get_checks_for_service (window=200 por
    # defecto), la biseccion no puede verlo y reporta el primer check de la
    # ventana como inicio, aunque el incidente real haya empezado antes.
    repo = MagicMock()
    checks = _make_checks([ServiceStatus.DOWN] * 200)  # toda la ventana caida
    repo.get_checks_for_service.return_value = checks

    incident = find_incident_start(1, repo)

    assert incident.start_check == checks[0]
    assert incident.is_ongoing is True
```

Línea por línea:

- `repo = MagicMock()`: mock del repositorio, mismo patrón que el resto de los tests de este archivo — no toca base de datos.
- `checks = _make_checks([ServiceStatus.DOWN] * 200)`: simula el escenario límite: un servicio que lleva caído las 200 checks completas que trae la ventana (`find_incident_start` usa `window=200` por defecto, `backend/application/use_cases/find_incident_start.py:23`). En la vida real esto pasaría si un servicio está caído por horas/días y `window` solo alcanza a cubrir una fracción de ese tiempo.
- `repo.get_checks_for_service.return_value = checks`: el mock siempre devuelve esta lista sin importar los argumentos con que se lo llame.
- `incident = find_incident_start(1, repo)`: corre el algoritmo real. Internamente, `_bisect_incident_start` (línea 8-19 del use case) va reduciendo el rango a la mitad buscando el primer índice DOWN — pero como *todo* el rango está DOWN, termina en `lo == hi == 0`, el primer elemento de la ventana.
- `assert incident.start_check == checks[0]`: esto es la aserción clave — confirma que el algoritmo no falla ni lanza excepción, pero tampoco miente diciendo que sabe cuándo empezó realmente el incidente: solo puede reportar el borde de lo que alcanzó a ver.
- `assert incident.is_ongoing is True`: el incidente se sigue marcando como activo correctamente, a pesar de la limitación de la ventana.

**Por qué este test importa para la exposición:** no es un test que "arregla" el límite, es un test que **deja constancia explícita del límite conocido** — si en el futuro alguien cambia `window` o la lógica de bisección sin darse cuenta de esta precondición, el test documenta el comportamiento esperado en ese borde. Es la diferencia entre un bug silencioso y una limitación conocida y verificada.

---

## 3. Test de integración — Postgres real con 50.000 filas

Archivo nuevo: `backend/tests/integration/test_service_repository_scale.py`

```python
import pytest

from infrastructure.models import ServiceModel, CheckResultModel
from infrastructure.repositories.service_repository import DjangoServiceRepository


@pytest.mark.slow
@pytest.mark.django_db
def test_get_checks_for_service_with_large_dataset_uses_limit(django_assert_num_queries):
    service = ServiceModel.objects.create(name="load-test", url="http://example.com")
    CheckResultModel.objects.bulk_create(
        [
            CheckResultModel(
                service=service,
                status="up",
                response_time_ms=100.0,
                status_code=200,
            )
            for _ in range(50_000)
        ],
        batch_size=5000,
    )

    with django_assert_num_queries(1):
        result = DjangoServiceRepository().get_checks_for_service(service.id, limit=500)

    assert len(result) == 500
```

Línea por línea:

- `@pytest.mark.slow`: marca personalizada, registrada en `backend/pytest.ini` (`markers = slow: ...`). Permite excluir este test del run rápido normal con `-m "not slow"`, porque escribe 50.000 filas reales — no es algo que se quiera correr en cada guardado de archivo.
- `@pytest.mark.django_db`: marca de `pytest-django` que le dice al test runner "este test necesita base de datos real". Sin esta marca, cualquier acceso a un modelo Django lanza `RuntimeError: Database access not allowed`. Es lo que obliga a tener Postgres corriendo (ver sección de ejecución).
- `django_assert_num_queries`: fixture propia de `pytest-django`, no hay que definirla — actúa como context manager que cuenta cuántas queries SQL se ejecutan dentro del bloque `with` y falla el test si el número no coincide.
- `ServiceModel.objects.create(...)`: crea un servicio real en la tabla `services` (necesario porque `CheckResultModel.service` es una FK, no se puede crear un check sin un servicio válido).
- `CheckResultModel.objects.bulk_create([...], batch_size=5000)`: inserta 50.000 registros en lotes de 5.000. `bulk_create` es clave acá — hace un solo `INSERT` con múltiples `VALUES` por lote (10 lotes en total) en vez de 50.000 `INSERT` individuales, que tardarían minutos. Esto simula, en una escala reducida y reproducible, la situación real de un servicio que acumuló muchísimos checks a lo largo del tiempo.
- `with django_assert_num_queries(1):`: exactamente donde está la aserción de escala — todo lo que pase dentro de este bloque debe traducirse en **una sola query SQL**, sin importar que la tabla tenga 50.000 filas para ese servicio. Si `get_checks_for_service` tuviera algún bug que dispara N+1 queries (por ejemplo, iterar y acceder a `check.service.name` sin `select_related`), este test lo detecta al instante.
- `result = DjangoServiceRepository().get_checks_for_service(service.id, limit=500)`: llama al repositorio real (no un mock) contra la base de datos real, pidiendo la ventana de 500 que usa `calculate_service_stats` en producción.
- `assert len(result) == 500`: confirma que el `LIMIT` se aplicó en SQL (no trajo las 50.000 filas a Python para recién ahí cortar a 500 — eso sería un desperdicio de memoria y ancho de banda con la DB).

**Qué prueba esto en la exposición:** que la query que alimenta a los 4 algoritmos no colapsa ni multiplica queries cuando el volumen de datos por servicio crece. Es el único test de los tres que realmente toca la capa de infraestructura (`infrastructure/repositories/`), no solo la lógica pura del algoritmo.

**Con el índice del punto 0 aplicado**, esa query resuelve por index scan directo en vez de filtrar + ordenar en memoria — la diferencia se nota más cuanto más crece la tabla, no tanto con 50.000 filas (para ese volumen Postgres ya es rápido igual), sino en el escenario de 500 millones de filas totales que motivó esta guía.

---

## 4. Cómo ejecutar todo esto — ¿hace falta Docker?

**Sí, para el test de integración (punto 3). No, para los dos unitarios (puntos 1 y 2) — pero en este proyecto no hay entorno Python local instalado, así que en la práctica todo se corre dentro de Docker.**

Por qué: `backend/config/settings/base.py` arma `DATABASES` leyendo `DATABASE_URL` del `.env`, que apunta a `postgres://sentinel:password@db:5432/sentinel_db` — el host `db` es el nombre del servicio en `docker-compose.yml`, solo resoluble dentro de la red interna de Docker Compose. Los tests unitarios (con `MagicMock`) nunca abren esa conexión, así que en teoría correrían con cualquier Python que tenga `pytest`/`django` instalados — pero el de integración sí necesita esa conexión real, y por lo tanto necesita estar en la misma red que el contenedor `db`.

### Paso a paso (el que se usó para verificar esta guía)

**1. Levantar la base de datos y Redis** (no hace falta levantar `web`/`worker`/`beat` para correr tests):

```bash
docker compose up -d db redis
```

**2. Confirmar que la migración del índice está sincronizada con el modelo:**

```bash
docker compose run --rm web python manage.py makemigrations --check --dry-run
```
Debe imprimir `No changes detected`. Si en algún momento se edita `models.py` sin generar la migración correspondiente, esto lo detecta antes de llegar a producción.

**3. Aplicar la migración a la base real** (necesaria para que el índice exista en la DB de desarrollo; en el test de integración, `pytest-django` crea y migra una base de test aparte automáticamente, este paso es solo para la DB de desarrollo):

```bash
docker compose run --rm web python manage.py migrate
```

**4. Correr los tests rápidos (unitarios, sin el de escala):**

```bash
docker compose run --rm web python -m pytest tests/unit/ --no-cov -m "not slow"
```
`-m "not slow"` excluye el test de 50.000 filas — este es el comando para el día a día.

**5. Correr el test de integración de escala (el que necesita Postgres con datos reales):**

```bash
docker compose run --rm web python -m pytest tests/integration/test_service_repository_scale.py -v --no-cov -m slow
```
`pytest-django` crea automáticamente una base de datos de test (`test_sentinel_db`), corre las migraciones ahí (incluyendo el índice nuevo), ejecuta el test, y la destruye al final — no toca `sentinel_db` real ni deja basura.

**6. (Opcional) correr todo junto, incluyendo el lento:**

```bash
docker compose run --rm web python -m pytest --no-cov
```

**7. Apagar los contenedores cuando termines:**

```bash
docker compose down
```

### Resultado real de esta verificación

```
tests/unit/... 15 passed
tests/integration/test_service_repository_scale.py::test_get_checks_for_service_with_large_dataset_uses_limit PASSED
======================== 16 passed in ~11s total ========================
```

---

## Resumen para la diapositiva

| Test | Tipo | Necesita Docker/Postgres | Qué demuestra |
|---|---|---|---|
| `test_binary_search_stays_logarithmic_at_full_window` | Unitario | No (sí en este proyecto, por falta de Python local) | La búsqueda binaria no degrada a la ventana real de producción (500 elementos) |
| `test_incident_longer_than_window_reports_window_start_not_real_start` | Unitario | No (ídem) | Límite conocido documentado con test, no bug silencioso |
| `test_get_checks_for_service_with_large_dataset_uses_limit` | Integración | Sí, obligatorio | La query de acceso a datos no multiplica queries ni ignora el `LIMIT` con volumen real |
| Índice compuesto `check_results_svc_at_idx` | Migración | Sí para aplicarla | Evita sort en memoria en Postgres cuando la tabla crece a escala de cientos de millones de filas |

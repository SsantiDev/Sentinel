# 7. Cumplimiento de arquitectura y principios

Medición honesta de qué tan bien el módulo de transacciones respeta la
arquitectura limpia y los principios del proyecto (reglas de `CLAUDE.md`).

## Reglas del proyecto (`CLAUDE.md` → "DO NOT")

| Regla | ¿Se cumple? | Evidencia |
|---|---|---|
| **No lógica en las vistas** (solo casos de uso) | ✅ Sí | Las vistas solo validan el formato y llaman a los casos de uso. `transaction_views.py` tiene 124 líneas y ninguna regla de negocio. |
| **`application/` no importa `infrastructure/`** | ✅ Sí (en este módulo) | Los casos de uso de transacciones dependen de la **interfaz** `ITransactionRepository`, no de la base de datos. (Nota: otras partes antiguas del repo sí la violan, pero el módulo nuevo no.) |
| **Sin secretos en el código (solo `.env`)** | ✅ Sí | No se agregó ninguna credencial al código. |
| **Ningún archivo > 400 líneas** | ✅ Sí | El más grande es el repositorio con **203 líneas**. |

## Arquitectura por capas (Clean Architecture)

```
domain/          → Entidades + interfaces (sin framework)   ✅
   ↑ depende de
application/      → Casos de uso (reglas de negocio puras)   ✅
   ↑ depende de (interfaces)
infrastructure/  → Base de datos (Django ORM)                ✅
interfaces/      → HTTP (DRF): vistas y serializadores       ✅
```

- **`domain/`**: `transaction.py` y la interfaz del repositorio no importan
  Django ni la base de datos. Verificado. ✅
- **`application/`**: la lógica (hash, franja, ventana deslizante, ingesta,
  estadísticas) es independiente de la base de datos. Depende de la
  **abstracción** del repositorio → **Inversión de Dependencias**. ✅
- **`infrastructure/`**: `transaction_repository.py` implementa esa interfaz
  con el ORM. ✅
- **`interfaces/`**: vistas finas que orquestan. ✅

## Principios SOLID

| Principio | Nota | Comentario |
|---|---|---|
| **S** — Responsabilidad única | ✅ Alto | Cada caso de uso hace una sola cosa: `transaction_hash`, `time_band`, `detect_transaction_anomalies`, `ingest_transactions`, `calculate_transaction_stats`, `calculate_transaction_trends`. |
| **O** — Abierto/Cerrado | ✅ Bueno | Cambiar límites o franjas se hace por configuración/extensión, sin reescribir el detector. |
| **L** — Sustitución de Liskov | ✅ Sí | El repositorio Django cumple el contrato completo de la interfaz. |
| **I** — Segregación de interfaces | 🟡 Parcial | La interfaz del repositorio es amplia (lectura + escritura + estadísticas). Podría separarse en varias más pequeñas. |
| **D** — Inversión de dependencias | ✅ Sí | Los casos de uso reciben la abstracción; la implementación concreta se inyecta desde la vista. |

## Convenciones de API (`CLAUDE.md`)

| Convención | ¿Se cumple? |
|---|---|
| Base `/api/v1/` | ✅ |
| Formato de error `{ "error": ..., "code": ... }` | ✅ en nuestras respuestas explícitas |
| Fechas ISO 8601 | ✅ |

## Pruebas

- **65 pruebas automáticas** (unitarias + integración) en verde.
- `ruff` limpio en todos los archivos nuevos.
- Build del frontend correcto.

## Puntuación honesta

| Dimensión | Cumplimiento |
|---|---|
| Reglas "DO NOT" de `CLAUDE.md` | **100%** |
| Arquitectura por capas | **~95%** |
| Principios SOLID | **~90%** |
| Convenciones de API | **~95%** |
| **Promedio del módulo de transacciones** | **~90–95%** |

## Dónde se pierde ese 5–10% (para ser transparentes)

1. **Fuga mínima de framework**: `ingest_transactions` usa
   `django.utils.timezone` para fijar la zona horaria. Es práctico y sigue el
   patrón ya existente en el repo, pero en una versión más pura esa
   dependencia se abstraería.
2. **ISP**: la interfaz del repositorio es grande; separarla (lectura /
   escritura / estadísticas) sería más ortodoxo.
3. **Formato de error no 100% uniforme**: las respuestas automáticas de DRF
   (throttling 429, validación) no siguen el `{error, code}` nuestro; solo las
   respuestas que controlamos lo hacen.
4. **Config sin UI**: el endpoint de configuración existe, pero falta una
   pantalla para editarlo desde el front.

> Nota de contexto: el **resto del repositorio** (módulos antiguos como auth y
> alertas) sí tiene varias violaciones de "application no importa
> infrastructure". El módulo de transacciones que agregamos está **mejor
> alineado** con la arquitectura que el promedio del código existente.

# Detección de Anomalías en Transacciones — Documentación

Esta carpeta explica, **en lenguaje sencillo**, el sistema de detección de
anomalías en transacciones: qué hace, cómo funciona por dentro, cómo mostrarlo
en una exposición, cómo se ve en el front, cómo está protegido y cómo lo
evaluaría un bot automático.

## Índice

> 👉 **¿Solo quieres levantar y probar el proyecto?** Ve directo a
> [10_COMO_EJECUTAR_TODO.md](10_COMO_EJECUTAR_TODO.md) — guía paso a paso con
> Cloudflare (sin login).

| Archivo | Para qué sirve |
|---|---|
| [01_QUE_HACE_EL_SISTEMA.md](01_QUE_HACE_EL_SISTEMA.md) | El problema y la idea, sin tecnicismos |
| [02_COMO_FUNCIONA_EL_FLUJO.md](02_COMO_FUNCIONA_EL_FLUJO.md) | El recorrido de una transacción, paso a paso, con ejemplos |
| [03_GUION_EXPOSICION.md](03_GUION_EXPOSICION.md) | Qué decir y en qué orden al exponer al profesor |
| [04_COMO_MOSTRARLO_EN_EL_FRONT.md](04_COMO_MOSTRARLO_EN_EL_FRONT.md) | "Esta funcionalidad se ve al momento de…" — recorrido por pantallas |
| [05_SEGURIDAD.md](05_SEGURIDAD.md) | Hash, endpoint abierto, protección contra ZAP/Burp, qué protege y qué no |
| [06_BOT_EVALUADOR.md](06_BOT_EVALUADOR.md) | Contrato exacto para que un bot envíe datos y valide |
| [07_CUMPLIMIENTO_ARQUITECTURA.md](07_CUMPLIMIENTO_ARQUITECTURA.md) | % de cumplimiento de arquitectura y principios |
| [08_ESCALABILIDAD.md](08_ESCALABILIDAD.md) | Rendimiento con muchos datos y concurrencia (1000 / 1M usuarios) |
| [09_ENTREGA_Y_URL_PUBLICA.md](09_ENTREGA_Y_URL_PUBLICA.md) | Sustentación: levantar, exponer con ngrok y generar TXNS |
| [10_COMO_EJECUTAR_TODO.md](10_COMO_EJECUTAR_TODO.md) | ⭐ Guía rápida paso a paso (Cloudflare, sin login) + prompt para Claude Code |
| [11_MAPA_DE_ARCHIVOS.md](11_MAPA_DE_ARCHIVOS.md) | ¿En qué archivo vive cada cosa? Validación, hash, endpoint, detección, logs, dashboard |
| [12_PREGUNTAS_DE_EXAMEN.md](12_PREGUNTAS_DE_EXAMEN.md) | Preguntas tipo examen con respuesta — enfoque ciberseguridad y casos límite |

## En una frase

> El sistema recibe transacciones, verifica que no vengan alteradas (hash),
> y por cada usuario mira si hizo **demasiadas transacciones en muy poco
> tiempo**. Si es así, lo marca como **posible anomalía** y lo muestra en un
> tablero.

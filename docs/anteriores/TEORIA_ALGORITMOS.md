# Teoría de los 4 algoritmos — complejidad, por qué se eligió cada uno, y la matemática de fondo

Documento puramente conceptual. No hay rutas de archivo ni código acá (eso está en `docs/GUIA_SIMPLE_ALGORITMOS.md` y `docs/FUNCIONES_Y_OPERACIONES_ALGORITMOS.md`) — esto es la teoría de algoritmos y la matemática que hay detrás de cada uno de los 4, para poder explicar "por qué este algoritmo y no otro" sin señalar una sola línea de código.

---

## 1. Qué es la complejidad algorítmica (para ubicar todo lo que sigue)

Cuando un algoritmo procesa una lista de `n` elementos, la pregunta central es: **si `n` se duplica, ¿cuánto más trabajo tiene que hacer el algoritmo?** Esa relación entre el tamaño de la entrada y la cantidad de trabajo es lo que se llama complejidad, y se anota con la notación "Big O" (`O(...)`).

Las categorías que aparecen en este proyecto, de mejor a peor:

| Notación | Nombre | Qué significa | Ejemplo cotidiano |
|---|---|---|---|
| `O(1)` | Constante | Siempre el mismo trabajo, sin importar `n` | Abrir la página 50 de un libro si ya sabés en qué mano está |
| `O(log n)` | Logarítmica | El trabajo crece muchísimo más lento que `n` — cada paso descarta la mitad de lo que queda | Buscar una palabra en un diccionario de papel |
| `O(n)` | Lineal | El trabajo crece exactamente en proporción a `n` | Leer un libro entero, página por página |
| `O(n log n)` | Cuasi-lineal | Un poco peor que lineal — típico de ordenar listas | Ordenar un mazo de cartas por mitades |
| `O(n²)` | Cuadrática | El trabajo crece con el cuadrado de `n` — se dispara rápido | Comparar cada persona de una fiesta con todas las demás |

Los 4 algoritmos de este proyecto fueron elegidos deliberadamente para quedar en las categorías más baratas de esta tabla (`O(log n)` y `O(n)`), nunca en `O(n²)` — eso no es casualidad, es la decisión de diseño central de todo el trabajo.

---

## 2. Algoritmo 1 — Búsqueda binaria: implementa `O(log n)`

**Qué se implementó:** búsqueda binaria, complejidad `O(log n)` en el peor caso, `O(1)` en el mejor caso (si el elemento buscado cae justo en la primera comparación del medio).

**Qué se descartó, y por qué se sabe que era peor:** el proyecto incluye, a propósito, una segunda función que resuelve el mismo problema con búsqueda lineal (`O(n)`) — no para usarla en producción, sino para poder demostrar con números reales cuánto peor es. Recorriendo 500 elementos: la lineal siempre hace 500 comparaciones (revisa todo, sin excepción); la binaria hace como máximo 9. La diferencia entre ambas categorías (`O(n)` vs `O(log n)`) no es una mejora marginal, es un salto de orden de magnitud.

**Por qué se pudo usar binaria acá — la precondición:** la búsqueda binaria solo funciona si la lista está ordenada. En este dominio, los chequeos de un servicio están ordenados naturalmente por fecha (cada chequeo nuevo tiene una fecha posterior al anterior) — la precondición se cumple gratis, sin tener que ordenar nada antes de buscar. Es la razón por la que este algoritmo encaja bien acá y no es un capricho técnico.

**La idea matemática, en una frase:** en cada paso, el algoritmo compara el elemento del medio contra lo buscado y descarta la mitad del espacio de búsqueda que no puede contener la respuesta (porque la lista está ordenada, si el medio es "menor" que lo buscado, todo lo que está a la izquierda del medio también es menor). Repetir esa idea de "descartar la mitad" `k` veces reduce el tamaño del problema de `n` a `n / 2^k`. El algoritmo termina cuando ese tamaño llega a 1, es decir, cuando `n / 2^k = 1` → `k = log₂(n)`. Ese `log₂(n)` es exactamente el número de pasos, y de ahí sale la complejidad `O(log n)`.

---

## 3. Algoritmo 2 — Recursión (bisección): también implementa `O(log n)`, pero con una herramienta distinta

**Qué se implementó:** la misma idea de "partir a la mitad y descartar" que el algoritmo 1, pero resuelta con **recursión** en vez de un bucle. Complejidad `O(log n)`.

**Qué es la recursión, conceptualmente:** una función es recursiva cuando, en su propia definición, se llama a sí misma para resolver una versión más chica del mismo problema. Toda función recursiva necesita dos partes obligatorias:
- **Caso base:** la condición más simple, donde la función ya sabe la respuesta sin necesitar llamarse de nuevo (acá: "el rango de búsqueda quedó con un solo elemento, ese es el inicio del incidente").
- **Caso recursivo:** la función se llama a sí misma con una versión más chica del problema (acá: la mitad del rango anterior), acercándose cada vez más al caso base.

Sin el caso base, la función se llamaría a sí misma indefinidamente — es el error clásico de recursión infinita.

**Por qué recursión y no un bucle, si hacen lo mismo:** cualquier algoritmo recursivo se puede reescribir como un bucle (el algoritmo 1 es la prueba: resuelve el mismo tipo de problema con `while`). La elección de recursión acá no es por rendimiento — la profundidad de la pila de llamadas es `log₂(n)`, así que para `n=200` son unas 8 llamadas anidadas, nada costoso. La elección es porque el problema ("encontrar el punto de quiebre entre una zona y otra dentro de un rango ordenado") se expresa de forma más directa como "resolvé el mismo problema en una mitad más chica" — es la forma natural de pensar el algoritmo de bisección, que es un método general de matemática numérica (se usa, por ejemplo, para encontrar raíces de funciones dividiendo intervalos a la mitad).

**La precondición que hace válida la bisección acá:** que exista una racha continua de un estado hasta el final del rango, sin alternancia. Bisección (matemáticamente) asume que hay un único "punto de corte" en el rango — si hay múltiples alternancias, la noción de "el punto de corte" deja de estar bien definida, y el algoritmo puede converger a un punto de corte que no es el que se buscaba conceptualmente.

---

## 4. Algoritmo 3 — Progresión aritmética: implementa `O(n)`, pero sobre un `n` que no es el volumen de datos

**Qué se implementó:** generación de una progresión aritmética de `n` términos, y clasificación de un valor contra esos términos. Complejidad `O(n)` — pero acá `n` es la **cantidad de escalones/tiers** (en este proyecto, 4), no la cantidad de chequeos guardados. Es la razón por la que este algoritmo es, en la práctica, instantáneo: nunca va a procesar más que un puñado de escalones.

**Qué es una progresión aritmética, matemáticamente:** una secuencia de números donde cada término se obtiene sumando siempre la misma cantidad fija (llamada razón o diferencia común, `d`) al término anterior:

```
a₁, a₁+d, a₁+2d, a₁+3d, ..., a₁+(n-1)d
```

El término general (el n-ésimo término, sin tener que calcular todos los anteriores uno por uno) es:

```
aₙ = a₁ + (n-1)·d
```

**Por qué modela bien el problema de "niveles de calidad":** cualquier sistema de niveles o categorías equiespaciadas (medallas, notas de examen, rangos de un juego) es, matemáticamente, una progresión aritmética: un punto de partida, y una distancia fija entre un nivel y el siguiente. Usar la fórmula general en vez de escribir 4 comparaciones `if` hardcodeadas (`if uptime >= 80: ... elif uptime >= 85: ...`) permite que la cantidad de niveles, dónde arrancan, y qué tan separados están, sean parámetros configurables — es la diferencia entre codificar una regla fija y codificar la fórmula matemática que genera cualquier regla de ese tipo.

**Por qué no hace falta preocuparse por su complejidad:** al no depender del volumen de datos monitoreados, este es el único de los 4 algoritmos donde la pregunta "¿aguanta con mucho volumen?" ni siquiera aplica — su costo depende solo de cuántas categorías se configuren, un número que por diseño es chico (típicamente entre 3 y 6).

---

## 5. Algoritmo 4 — Regresión lineal: implementa `O(n)`, con matemática de estadística

**Qué se implementó:** ajuste de una recta a un conjunto de puntos por el método de **mínimos cuadrados**, calculado a mano (sin librerías de machine learning). Complejidad `O(n)`: se recorre la lista de puntos una vez para las medias, y una vez más para la pendiente — dos pasadas, cada una proporcional al tamaño de la lista, lo que en total sigue siendo `O(n)` (una constante de pasadas no cambia la categoría de complejidad).

### Qué es "la pendiente", conceptualmente

Dado un conjunto de puntos `(x, y)` (acá, `x` = orden del chequeo en el tiempo, `y` = latencia de ese chequeo), la pendiente es un número que resume **cuánto cambia `y` en promedio por cada unidad que avanza `x`**. Si la pendiente es positiva, `y` crece cuando `x` crece (la latencia empeora con el tiempo); si es negativa, `y` decrece; si es cero, no hay tendencia — los valores suben y bajan pero sin dirección de fondo.

Es la misma idea intuitiva que "la inclinación de una rampa": una pendiente pronunciada significa que la latencia sube rápido chequeo tras chequeo; una pendiente casi plana significa que la latencia se mantiene estable aunque tenga ruido punto a punto.

### Qué es el método de mínimos cuadrados

Con pocos puntos, uno podría "a ojo" trazar una línea que pase cerca de todos. El método de mínimos cuadrados formaliza esa idea: entre todas las rectas posibles, elige la que **minimiza la suma de las distancias verticales al cuadrado** entre cada punto real y la recta. Se eleva al cuadrado para que los errores por encima y por debajo de la recta no se cancelen entre sí (un punto muy por arriba y otro muy por abajo, sin elevar al cuadrado, podrían promediarse como si no hubiera error).

La fórmula resultante de resolver ese problema de minimización (viene de cálculo diferencial, derivar e igualar a cero) da la pendiente como:

```
        Σ(xᵢ - x̄)(yᵢ - ȳ)
slope = ────────────────────
           Σ(xᵢ - x̄)²
```

Donde `x̄` e `ȳ` son los promedios de todas las `x` y todas las `y`. El numerador es la **covarianza** entre `x` e `y` (mide si se mueven juntas o en direcciones opuestas); el denominador es la **varianza** de `x` (mide cuánto se dispersan los valores de `x`, y siempre da positivo). Pendiente = covarianza dividido varianza.

Una vez que se tiene la pendiente, el punto donde la recta cruza el eje vertical (la ordenada al origen, `intercept`) se despeja de la ecuación general de la recta `y = pendiente·x + intercept`, usando el promedio de los puntos (que siempre está sobre la recta ajustada):

```
intercept = ȳ - slope·x̄
```

### La proyección — usar la recta para predecir

Una vez que se tiene la ecuación completa de la recta (`y = slope·x + intercept`), se puede invertir la pregunta: en vez de "dado `x`, ¿cuánto vale `y`?", preguntar "¿para qué `x` futuro `y` llega a un valor crítico?". Es álgebra directa, despejar `x`:

```
x = (y_crítico - intercept) / slope
```

Esto es lo que en estadística se llama **extrapolación**: usar el patrón observado en los datos existentes para proyectar más allá del rango observado. Es importante como limitación conceptual: la extrapolación asume que la tendencia actual se mantiene igual en el futuro — no tiene forma de anticipar un cambio brusco que todavía no pasó.

**Por qué `O(n)` alcanza y no hace falta algo más sofisticado:** ajustar una recta a un conjunto de puntos es, matemáticamente, el modelo más simple de la familia de "modelos predictivos" — un polinomio de grado 1. Ajustar modelos más complejos (una curva, una red neuronal) requeriría iterar muchas veces sobre los mismos datos (complejidad mayor, o directamente sin una fórmula cerrada como la de arriba) para ganar una precisión que, en este caso de uso (avisar "la latencia va para arriba, ojo"), no aporta valor proporcional al costo extra.

---

## Resumen — complejidad de los 4, lado a lado

| # | Algoritmo | Complejidad implementada | Sobre qué `n` corre | Alternativa descartada | Por qué se eligió esta |
|---|---|---|---|---|---|
| 1 | Búsqueda binaria | `O(log n)` (mejor caso `O(1)`) | Cantidad de chequeos en la ventana consultada | Búsqueda lineal `O(n)` (incluida solo como referencia de comparación) | La lista ya viene ordenada por fecha sin costo extra — la precondición de la binaria se cumple gratis |
| 2 | Recursión (bisección) | `O(log n)` | Cantidad de chequeos en la ventana consultada | Recorrer toda la ventana en reversa hasta encontrar el cambio de estado, `O(n)` | Divide y vencerás expresa mejor la idea de "encontrar el único punto de quiebre" que un recorrido secuencial |
| 3 | Progresión aritmética | `O(n)` | Cantidad de niveles/tiers configurados (chico, ej. 4) — no depende del volumen de chequeos | `if/elif` hardcodeado por cada nivel | La fórmula general permite que la cantidad de niveles y su separación sean configurables, no fijos en el código |
| 4 | Regresión lineal | `O(n)` | Cantidad de chequeos en la ventana consultada | Modelos de predicción más complejos (curvas, ML) | Mínimos cuadrados da una fórmula cerrada, sin iterar ni entrenar nada, suficiente para detectar tendencia y proyectar un cruce |

**El patrón que atraviesa los 4:** ninguno es `O(n²)` ni peor, y los dos que sí dependen del volumen de datos monitoreados (1 y 2) logran evitarlo explotando una propiedad que el dominio ya regala gratis — el orden cronológico natural de los chequeos —, en vez de tener que ordenar los datos primero (lo cual sí sería `O(n log n)` cada vez).

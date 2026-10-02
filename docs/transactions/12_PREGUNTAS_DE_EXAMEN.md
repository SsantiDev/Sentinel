# 12 — Preguntas de examen (enfoque ciberseguridad)

Preguntas tipo profesor sobre el sistema de transacciones, con respuesta corta
y clara. El foco es **seguridad** y **casos límite** (qué pasa si mando datos
malos, vacíos o alterados).

Glosario mínimo (términos que aparecen):
- **Hash / firma:** huella de los datos. Si cambia un carácter, cambia la huella.
- **HMAC:** hash que además usa una **clave secreta**, así solo quien tiene la
  clave puede producir una firma válida.
- **Payload / cuerpo:** los datos que llegan en la petición.
- **Throttle:** límite de cuántas peticiones por minuto acepta el servidor.

---

## Bloque A — El hash (la firma)

**A1. ¿Cómo se valida que una transacción no viene alterada?**
Cada transacción trae una firma. El servidor recalcula la firma con los mismos
campos y su clave secreta, y compara. Si coinciden, los datos no se tocaron y
vienen de alguien que conoce la clave. Si no, se rechaza con motivo
`INVALID_HASH`.

**A2. ¿Cómo se construye el hash exactamente?**
Se unen cinco campos en orden fijo separados por `|`:
`idTxn | user | date | value | paymentMethod`. A ese texto se le aplica
**HMAC-SHA256** con la clave secreta. El orden es fijo a propósito: si se
cambiara el orden, la firma cambiaría.

**A3. ¿Por qué HMAC y no un SHA-256 normal?**
Un SHA-256 normal lo puede calcular cualquiera, así que cualquiera podría
fabricar transacciones falsas con su firma correcta. HMAC mete una **clave
secreta** que solo conocen el servidor y el emisor legítimo. Sin esa clave no
se puede producir una firma válida.

**A4. ¿Dónde está la clave secreta? ¿Viaja al navegador?**
Está en la configuración del servidor (`TRANSACTIONS_HMAC_SECRET`, leída del
`.env`). **Nunca** viaja al navegador. Por eso el simulador del front no firma:
firma el servidor.

**A5. ¿Por qué se comparan las firmas con `compare_digest` y no con `==`?**
Para evitar un **ataque de tiempo** (timing attack). Un `==` normal corta la
comparación en el primer carácter distinto, y midiendo cuánto tarda se podría
adivinar la firma carácter por carácter. `compare_digest` tarda lo mismo
siempre, no filtra esa pista.

**A6. ¿Qué pasa si cambio un solo dato del payload (ej. el monto)?**
La firma recalculada ya no coincide con la que vino. La transacción se rechaza
con `INVALID_HASH`. No se puede alterar el monto sin invalidar la firma.

**A7. ¿El hash cifra la información? ¿Da privacidad?**
No. El hash da **integridad** (no fue alterado) y **autenticidad** (viene de
quien tiene la clave), pero **no** oculta el contenido. La privacidad en el
transporte la da **HTTPS/TLS**, no el hash.

**A8. (Debilidad) ¿Qué pasa si la clave secreta está vacía?**
El valor por defecto de la clave es vacío. Si se deja así en producción,
cualquiera que conozca el formato del mensaje podría generar firmas válidas con
clave vacía. **Hay que fijar una clave fuerte en el `.env`.** Es el punto débil
más importante a cuidar.

---

## Bloque B — Validación y casos límite

**B1. ¿Qué pasa si mando un método de pago vacío (`""`)?**
Se rechaza. Al limpiar espacios queda vacío, y el sistema exige que el método
de pago no esté vacío: lanza error de formato y la descarta con
`INVALID_PAYLOAD`. Lo mismo ocurre con el usuario vacío.

**B2. ¿Qué pasa si falta un campo (por ejemplo no mando el `hash`)?**
Falla al leer ese campo y se descarta con `INVALID_PAYLOAD`. Se necesitan todos
los campos: `idTxn`, `user`, `date`, `value`, `paymentMethod`, `hash`.

**B3. ¿Qué pasa si mando el monto como texto que no es número ("abc")?**
No se puede convertir a número decimal, así que se descarta con
`INVALID_PAYLOAD`.

**B4. ¿Y si el `idTxn` no es un número?**
Igual: falla la conversión a entero y se descarta con `INVALID_PAYLOAD`.

**B5. ¿Y si la fecha está mal escrita?**
Si no es una fecha válida en formato ISO 8601, se descarta con
`INVALID_PAYLOAD`.

**B6. ¿Qué pasa si mando dos veces el mismo `idTxn`?**
La primera entra; la segunda se rechaza con `DUPLICATE`. Esto frena reenvíos
del mismo dato (protección básica contra "replay").

**B7. ¿En qué orden se aplican las validaciones?**
Tres filtros en orden: **formato → firma → duplicado**. La que falla un filtro
se descarta con su motivo y el proceso **sigue con las demás** (una mala no tumba
el lote entero).

**B8. ¿Qué pasa si el cuerpo no es ni un objeto ni una lista de objetos?**
Responde `400` con código `INVALID_BODY`. El endpoint acepta una transacción
sola o una lista, nada más.

**B9. ¿Qué pasa si mando un lote gigante (más de 1000)?**
Responde `413` con código `BATCH_TOO_LARGE`. Es un freno para que un cuerpo
enorme no agote la memoria del servidor.

**B10. Si el cuerpo era válido pero no entró ninguna transacción, ¿qué código
devuelve?**
`422`. Significa: "te entendí, pero nada fue aceptado" (todas rechazadas por
formato, firma o duplicado). El emisor sabe por el código que su envío no sirvió.

**B11. ¿Y si al menos una entró?**
`201` (creado). La respuesta dice cuántas se aceptaron, cuáles se rechazaron y
por qué.

**B12. ¿Hay diferencia entre validar la estructura y validar el negocio?**
Sí. La **estructura** (campos presentes, tipos correctos) se valida al convertir
el dato. La **firma** y el **duplicado** son reglas de negocio/seguridad que se
validan después. Son capas distintas.

**B13. (Caso límite) ¿Qué pasa si mando un monto negativo en el endpoint
público?**
El endpoint público no revisa el signo del monto: si el formato es válido y la
firma coincide, lo aceptaría. En cambio, el **simulador** sí exige monto mayor o
igual a cero. Es una diferencia a tener presente (posible mejora: rechazar
montos negativos también en el público).

---

## Bloque C — Protección del endpoint (ciberseguridad)

**C1. ¿Por qué el endpoint de ingesta es público, sin login?**
Para que una evaluación automática (un bot) pueda enviar un flujo continuo de
transacciones sin credenciales. La seguridad no se apoya en el login, sino en la
firma, el límite por IP y el tope de lote.

**C2. ¿Cómo se protege contra inundación o denegación de servicio (DoS)?**
Dos frenos: un **límite de peticiones por IP** (3000 por minuto) y un **tope de
tamaño de lote** (máximo 1000 transacciones por cuerpo). El primero corta una
ráfaga de peticiones; el segundo evita un cuerpo que consuma toda la memoria.

**C3. Si me prueban con herramientas como ZAP o Burp, ¿qué protege y qué no?**
La firma impide **falsificar** o **alterar** transacciones sin la clave. El
límite por IP frena el abuso por volumen. Lo que la firma **no** hace es ocultar
el contenido: eso lo cubre HTTPS. (Ver `05_SEGURIDAD.md`.)

**C4. ¿Protege contra "replay" (reenviar una transacción capturada)?**
En parte. Cada firma incluye el `idTxn`, y un `idTxn` repetido se rechaza como
`DUPLICATE`. Así, reenviar la misma transacción tal cual no vuelve a entrar.

**C5. ¿Es vulnerable a inyección SQL?**
El acceso a datos pasa por el ORM de Django (consultas parametrizadas) y los
campos se convierten a sus tipos antes de usarse, así que no se arma SQL con
texto del usuario. El riesgo de inyección SQL es muy bajo por diseño.

**C6. ¿Qué endpoints piden autenticación y cuáles no?**
- Ingesta pública: sin login.
- Simulador: requiere usuario autenticado.
- Lista/edición de anomalías: requiere administrador.
- Configuración de detección: requiere super administrador.

---

## Bloque D — Detección, dashboard y "logs"

**D1. ¿Qué considera el sistema una anomalía?**
Que un mismo usuario haga **demasiadas transacciones en muy poco tiempo**: si en
una ventana de tiempo la cantidad alcanza el límite de su franja horaria, se
marca anomalía.

**D2. ¿Qué es la "ventana deslizante" y por qué se usa esa técnica?**
Es una ventana de tiempo que avanza con las transacciones usando dos punteros
(inicio y fin). Permite contar, en todo momento, cuántas transacciones caen en
los últimos X segundos sin recorrer todo de nuevo: es eficiente (una sola
pasada).

**D3. ¿Qué niveles de gravedad hay?**
`high` (el doble o más del límite), `medium` (una vez y media o más) y `low`
(el resto).

**D4. ¿Qué son las franjas horarias?**
Mañana, tarde y noche, cada una con su propio límite. Lo normal en la mañana
puede ser sospechoso en la madrugada, por eso el límite cambia según la hora.

**D5. ¿Dónde están "los logs" de lo que pasó?**
No hay un archivo de log tradicional en este flujo. El registro queda en: (1) la
**base de datos**, en la tabla de anomalías (usuario, cantidad, ventana, franja,
nivel, valor total, cuándo se detectó); y (2) la **respuesta de cada ingesta**,
que dice cuántas se aceptaron y el motivo de cada rechazo.

**D6. ¿Dónde se ve todo eso?**
En el **dashboard de anomalías** del front: muestra estadísticas, tendencias y
la lista de anomalías, y deja ver la línea de tiempo de cada una.

**D7. ¿Por qué se detecta contra el historial del usuario y no solo contra el
lote recién enviado?**
Porque una ráfaga puede llegar partida en varias peticiones. Si solo se mirara
el lote actual, una ráfaga repartida se escaparía. Mirando el historial se
detecta igual.

**D8. ¿Cómo se evita reportar la misma ráfaga dos veces?**
Antes de guardar una anomalía se revisa si ya existe una que se solapa en el
tiempo para ese usuario. Si ya está reportada, no se duplica.

---

## Preguntas rápidas de repaso (respuesta de una línea)

1. ¿Qué algoritmo firma las transacciones? **HMAC-SHA256.**
2. ¿Qué campos entran en la firma y en qué orden? **idTxn, user, date, value,
   paymentMethod, separados por `|`.**
3. ¿Dónde vive la clave? **En el servidor (`.env`), nunca en el navegador.**
4. ¿Motivo de rechazo por formato malo? **`INVALID_PAYLOAD`.**
5. ¿Motivo por firma que no coincide? **`INVALID_HASH`.**
6. ¿Motivo por `idTxn` repetido? **`DUPLICATE`.**
7. ¿Código si nada entró pero el cuerpo era válido? **422.**
8. ¿Código si el lote pasa de 1000? **413.**
9. ¿Límite de peticiones por IP? **3000 por minuto.**
10. ¿El hash da privacidad? **No, da integridad y autenticidad; la privacidad
    la da HTTPS.**

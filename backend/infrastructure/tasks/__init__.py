# Importa los submodulos de tareas para que Celery las registre al autodescubrir
# el paquete 'infrastructure.tasks'. Sin esto, una tarea solo queda registrada si
# algun otro modulo la importa por casualidad (p. ej. la capa HTTP), lo cual es
# fragil: una tarea de fondo pura (como el reset) no la importa nadie al arrancar.
from infrastructure.tasks import email_tasks, ping_tasks, transaction_tasks  # noqa: F401

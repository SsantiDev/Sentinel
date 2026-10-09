from pathlib import Path

# Tamano por archivo y cuantos respaldos conserva la rotacion. Con esto el
# registro nunca crece sin control: 5 MB x (1 + 3) = 20 MB tope en disco.
MAX_BYTES = 5 * 1024 * 1024
BACKUP_COUNT = 3

LOG_FILENAME = 'sentinel.log'


def build_logging(log_dir: Path) -> dict:
    """Config de 'logging' de Django: archivo rotativo + consola.

    Intencion: los registros operativos NO van a la base de datos (mala
    practica: acopla el log a la cosa que puede fallar, infla tablas). Van a un
    archivo rotativo y, en paralelo, a la salida estandar del contenedor.
    """
    return {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'line': {
                'format': '{asctime} {levelname} {name} {message}',
                'style': '{',
            },
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'line',
            },
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'filename': str(log_dir / LOG_FILENAME),
                'maxBytes': MAX_BYTES,
                'backupCount': BACKUP_COUNT,
                'formatter': 'line',
                'encoding': 'utf-8',
            },
        },
        'root': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
        },
        'loggers': {
            # Ruido de Django acotado a avisos; lo nuestro ('sentinel') a INFO.
            'django': {'handlers': ['console', 'file'], 'level': 'WARNING', 'propagate': False},
            'sentinel': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
        },
    }

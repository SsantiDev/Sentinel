from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*']

# En local/tests usamos cache en memoria (no requiere Redis para el throttling).
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

from .base import *

# Settings para exponer la app por un tunel (Cloudflare) durante pruebas/demo.
# Clave: DEBUG apagado para que un error NUNCA muestre traza ni internals al
# exterior (fuga de informacion). Se acepta cualquier host porque la URL del
# tunel cambia en cada arranque; por eso NO se restringe ALLOWED_HOSTS.
DEBUG = False
ALLOWED_HOSTS = ['*']

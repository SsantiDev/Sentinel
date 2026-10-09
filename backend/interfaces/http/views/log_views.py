from pathlib import Path

from django.conf import settings
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from config.settings.logging_config import LOG_FILENAME

# Cuantas lineas devuelve por defecto y el tope duro por peticion.
DEFAULT_LINES = 200
MAX_LINES = 1000
VALID_LEVELS = {'INFO', 'WARNING', 'ERROR'}


class LogTailView(APIView):
    """Ultimas lineas del archivo de registro, en pantalla. Solo administradores.

    Seguridad: ruta de archivo fija (sin recibir rutas del cliente, no hay
    traversal), solo lectura, limitado por numero de lineas y acotado por la
    rotacion del archivo. No expone secretos porque el contenido lo controla la
    propia app (nunca se registran claves ni tokens).
    """
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        count = self._clamp_int(request.query_params.get('lines'), DEFAULT_LINES)
        level = (request.query_params.get('level') or '').upper().strip()

        log_path = Path(settings.LOG_DIR) / LOG_FILENAME
        if not log_path.exists():
            return Response({'lines': [], 'file': LOG_FILENAME})

        lines = self._tail(log_path, count)
        if level in VALID_LEVELS:
            lines = [ln for ln in lines if f' {level} ' in ln]
        return Response({'lines': lines, 'file': LOG_FILENAME})

    def _clamp_int(self, raw, default):
        try:
            value = int(raw)
        except (TypeError, ValueError):
            return default
        return max(1, min(value, MAX_LINES))

    def _tail(self, path: Path, count: int):
        # El archivo esta acotado por la rotacion (5 MB), asi que leerlo entero
        # y quedarse con las ultimas 'count' lineas es seguro y simple.
        with path.open('r', encoding='utf-8', errors='replace') as fh:
            return [ln.rstrip('\n') for ln in fh.readlines()[-count:]]

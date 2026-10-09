import logging

from rest_framework.views import exception_handler

logger = logging.getLogger('sentinel.error')


def logging_exception_handler(exc, context):
    """Manejador de errores de DRF que ademas registra el fallo.

    DRF llama a esto ante cualquier excepcion de una vista. Primero deja que el
    manejador por defecto arme la respuesta; luego registra:
      - si no hay respuesta (excepcion no prevista -> acabaria en 500), con la
        traza completa para poder diagnosticar que fallo;
      - si la respuesta es 5xx, como error sin traza.
    Los errores 4xx (validacion, permisos) no se registran: son esperados.
    """
    response = exception_handler(exc, context)

    view = context.get('view')
    view_name = view.__class__.__name__ if view else 'desconocida'
    request = context.get('request')
    path = getattr(request, 'path', 'desconocida')

    if response is None:
        logger.exception('error no manejado en %s (%s)', view_name, path)
    elif response.status_code >= 500:
        logger.error('error %s en %s (%s)', response.status_code, view_name, path)

    return response

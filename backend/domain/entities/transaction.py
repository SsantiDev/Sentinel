from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import List, Optional


@dataclass
class Transaction:
    """Una transaccion financiera recibida para analisis de anomalias."""
    id_txn: int
    user: str
    date: datetime
    value: Decimal
    payment_method: str
    hash: str
    id: Optional[int] = None
    is_anomalous: bool = False


@dataclass
class TransactionAnomaly:
    """
    Anomalia detectada: una concentracion de transacciones de un mismo
    usuario que supera el limite permitido dentro de la ventana deslizante.
    """
    user: str
    transaction_count: int
    window_seconds: int
    threshold: int
    time_band: str
    level: str
    total_value: Decimal
    window_start: datetime
    window_end: datetime
    status: str = 'open'
    # 'burst' = rafaga por ventana; 'invalid_data' = transaccion con datos
    # invalidos marcada por si sola.
    reason: str = 'burst'
    id: Optional[int] = None
    detected_at: Optional[datetime] = None
    # Ids de las transacciones que forman la rafaga. Lo llena la deteccion para
    # que la ingesta no tenga que re-escanear el historial buscandolas. No se
    # persiste: al leer una anomalia de la base vuelve vacio (default).
    transaction_ids: List[int] = field(default_factory=list)


@dataclass
class DetectionConfig:
    """
    Configuracion (editable) de la deteccion por ventana deslizante.

    La ventana es fija en segundos; el limite de transacciones que la
    convierten en anomalia depende de la franja horaria de la transaccion.
    """
    window_seconds: int = 3
    morning_limit: int = 10
    afternoon_limit: int = 6
    night_limit: int = 3
    require_signature: bool = False
    id: Optional[int] = None

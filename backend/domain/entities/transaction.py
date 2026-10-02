from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional


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
    id: Optional[int] = None
    detected_at: Optional[datetime] = None


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
    id: Optional[int] = None

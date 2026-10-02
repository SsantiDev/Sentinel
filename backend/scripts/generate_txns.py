#!/usr/bin/env python3
"""
Generador de transacciones (TXNS) para la sustentacion.

Envia transacciones al endpoint publico de ingesta, con el hash SHA-256
calculado igual que el backend: sha256( idTxn|user|date|value|paymentMethod ).

Genera trafico mayormente NORMAL y, para algunos usuarios, RAFAGAS que deben
dispararse como anomalias (segun la franja horaria configurada en el sistema).

Uso:
    python scripts/generate_txns.py --url http://localhost --count 500
    python scripts/generate_txns.py --url https://TU-SUBDOMINIO.ngrok-free.app \
        --count 2000 --anomaly-users 10 --batch-size 1 --delay 0.05

Requisitos: paquete 'requests' (ya esta en requirements.txt).
"""
import argparse
import hashlib
import random
import time
from datetime import datetime, timedelta

import requests

PAYMENT_METHODS = ['Tarjeta', 'Efectivo', 'Transferencia', 'PSE', 'Otro']


def compute_hash(id_txn, user, date, value, payment_method):
    message = f"{id_txn}|{user}|{date}|{value}|{payment_method}"
    return hashlib.sha256(message.encode('utf-8')).hexdigest()


def make_txn(id_txn, user, when, value):
    date = when.strftime('%Y-%m-%dT%H:%M:%S')
    method = random.choice(PAYMENT_METHODS)
    return {
        'idTxn': id_txn,
        'user': user,
        'date': date,
        'value': value,
        'paymentMethod': method,
        'hash': compute_hash(id_txn, user, date, value, method),
    }


def build_dataset(count, anomaly_users, base_hour):
    """Devuelve una lista de transacciones: normales + algunas rafagas."""
    txns = []
    tid = int(time.time() * 1000)  # base de ids unica por corrida
    base = datetime.now().replace(hour=base_hour, minute=0, second=0, microsecond=0)

    # Rafagas (anomalias): 4-6 transacciones del mismo usuario en ~2 segundos.
    for u in range(anomaly_users):
        user = f'fraude{u}@demo.com'
        start = base + timedelta(minutes=random.randint(0, 50))
        for i in range(random.randint(4, 6)):
            tid += 1
            when = start + timedelta(milliseconds=i * 400)
            txns.append(make_txn(tid, user, when, random.randint(10000, 90000)))

    # Normales: transacciones espaciadas > 5s (nunca se concentran).
    normal_needed = max(0, count - len(txns))
    for i in range(normal_needed):
        tid += 1
        user = f'user{random.randint(0, 200)}@demo.com'
        when = base + timedelta(seconds=i * 6 + random.randint(0, 3))
        txns.append(make_txn(tid, user, when, random.randint(1000, 100000)))

    random.shuffle(txns)  # llegan desordenadas, como en la vida real
    return txns


def chunks(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def main():
    parser = argparse.ArgumentParser(description='Generador de TXNS')
    parser.add_argument('--url', default='http://localhost', help='URL base (sin /api/...)')
    parser.add_argument('--count', type=int, default=500, help='total de transacciones')
    parser.add_argument('--anomaly-users', type=int, default=5, help='usuarios con rafaga')
    parser.add_argument('--batch-size', type=int, default=100, help='TXNS por peticion (1 = streaming)')
    parser.add_argument('--delay', type=float, default=0.0, help='segundos entre peticiones')
    parser.add_argument('--base-hour', type=int, default=21, help='hora base (21 = noche, limite 3)')
    args = parser.parse_args()

    endpoint = args.url.rstrip('/') + '/api/v1/transactions/'
    headers = {'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true'}

    dataset = build_dataset(args.count, args.anomaly_users, args.base_hour)
    print(f'Enviando {len(dataset)} transacciones a {endpoint} ...')

    accepted = rejected = anomalies = 0
    for batch in chunks(dataset, max(1, args.batch_size)):
        body = batch if len(batch) > 1 else batch[0]
        try:
            resp = requests.post(endpoint, json=body, headers=headers, timeout=30)
            data = resp.json()
            accepted += data.get('accepted', 0)
            rejected += len(data.get('rejected', []))
            anomalies += data.get('anomalies_detected', 0)
        except Exception as exc:  # noqa: BLE001
            print(f'  error en un lote: {exc}')
        if args.delay:
            time.sleep(args.delay)

    print('--- Resumen ---')
    print(f'  Aceptadas:  {accepted}')
    print(f'  Rechazadas: {rejected}')
    print(f'  Anomalias detectadas: {anomalies}')


if __name__ == '__main__':
    main()

from celery.schedules import crontab

CELERYBEAT_SCHEDULE = {
    'schedule-all-pings-every-minute': {
        'task': 'infrastructure.tasks.ping_tasks.schedule_all_pings',
        'schedule': crontab(minute='*'),
    },
}

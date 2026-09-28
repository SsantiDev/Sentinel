from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('infrastructure', '0008_schedulerrunmodel_servicedependencymodel'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PlanModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
                ('max_checks_per_window', models.IntegerField()),
                ('window_seconds', models.IntegerField()),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'plans',
            },
        ),
        migrations.CreateModel(
            name='SubscriptionModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[('active', 'Active'), ('suspended', 'Suspended'), ('cancelled', 'Cancelled')],
                    default='active', max_length=20,
                )),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('plan', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='subscriptions', to='infrastructure.planmodel',
                )),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='subscription', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'subscriptions',
            },
        ),
        migrations.CreateModel(
            name='UsageEventModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(max_length=50)),
                ('occurred_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='usage_events', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'usage_events',
                'ordering': ['-occurred_at'],
            },
        ),
        migrations.CreateModel(
            name='UsageAnomalyModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_count', models.IntegerField()),
                ('window_seconds', models.IntegerField()),
                ('threshold', models.IntegerField()),
                ('detected_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='usage_anomalies', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'usage_anomalies',
                'ordering': ['-detected_at'],
            },
        ),
        migrations.AddIndex(
            model_name='usageeventmodel',
            index=models.Index(fields=['user', '-occurred_at'], name='usage_events_user_at_idx'),
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('infrastructure', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AlertRuleModel',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('condition', models.CharField(choices=[('consecutive_failures', 'Consecutive Failures'), ('latency_above', 'Latency Above')], max_length=30)),
                ('threshold', models.FloatField(help_text='Failures count or ms value')),
                ('channel', models.CharField(choices=[('email', 'Email')], default='email', max_length=20)),
                ('contact', models.CharField(help_text='Email address', max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('service', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='alert_rules', to='infrastructure.servicemodel')),
            ],
            options={'db_table': 'alert_rules'},
        ),
    ]

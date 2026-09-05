from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('infrastructure', '0006_alter_alertrulemodel_contact'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='checkresultmodel',
            index=models.Index(fields=['service', '-checked_at'], name='check_results_svc_at_idx'),
        ),
    ]

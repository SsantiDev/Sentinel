from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('infrastructure', '0009_membership_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='usageanomalymodel',
            name='status',
            field=models.CharField(
                choices=[('open', 'Open'), ('reviewed', 'Reviewed'), ('discarded', 'Discarded')],
                default='open', max_length=20,
            ),
        ),
    ]

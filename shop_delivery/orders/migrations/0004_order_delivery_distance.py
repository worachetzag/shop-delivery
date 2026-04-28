# Generated manually for delivery_distance field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0003_driverassignment'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='delivery_distance',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=8,
                null=True,
                verbose_name='ระยะทางจัดส่ง (กม.)',
            ),
        ),
    ]

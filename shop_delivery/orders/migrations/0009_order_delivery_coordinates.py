from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0008_order_number_sequence'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='delivery_latitude',
            field=models.DecimalField(blank=True, decimal_places=15, max_digits=18, null=True, verbose_name='พิกัดละติจูดปลายทาง'),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_longitude',
            field=models.DecimalField(blank=True, decimal_places=15, max_digits=18, null=True, verbose_name='พิกัดลองจิจูดปลายทาง'),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0009_order_delivery_coordinates'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeliveryFeeTier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sort_order', models.PositiveIntegerField(default=0, verbose_name='ลำดับ')),
                ('threshold_km', models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True, verbose_name='ระยะทางสูงสุด (กม.)')),
                ('fee_amount', models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='ค่าจัดส่ง (บาท)')),
                ('is_active', models.BooleanField(default=True, verbose_name='เปิดใช้งาน')),
            ],
            options={
                'verbose_name': 'ค่าจัดส่งตามระยะทาง',
                'verbose_name_plural': 'ค่าจัดส่งตามระยะทาง',
                'ordering': ['sort_order', 'id'],
            },
        ),
    ]


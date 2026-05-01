from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0003_inventory_management'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='compare_at_price',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=10,
                null=True,
                verbose_name='ราคาก่อนลด (แสดงขีดฆ่า)',
            ),
        ),
    ]

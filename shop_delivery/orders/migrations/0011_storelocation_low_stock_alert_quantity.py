from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0010_delivery_fee_tiers'),
    ]

    operations = [
        migrations.AddField(
            model_name='storelocation',
            name='low_stock_alert_quantity',
            field=models.PositiveIntegerField(
                default=5,
                verbose_name='แจ้งเตือนสต็อกใกล้หมด',
                help_text=(
                    'ถ้าจำนวนคงเหลือ (หลังหักจอง) ไม่เกินค่านี้ ระบบจะถือว่าใกล้หมด '
                    '— ใส่ 0 เพื่อปิดเกณฑ์ระดับร้าน (ใช้เฉพาะจุดเตือนต่อสินค้า)'
                ),
            ),
            preserve_default=False,
        ),
    ]

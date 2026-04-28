from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0006_order_inventory_flags_and_restock'),
    ]

    operations = [
        migrations.AddField(
            model_name='storelocation',
            name='promptpay_number',
            field=models.CharField(
                blank=True,
                default='',
                help_text='ใส่เบอร์มือถือ 10 หลัก หรือเลข PromptPay ที่ต้องการรับเงิน',
                max_length=32,
                verbose_name='เบอร์พร้อมเพย์ร้าน',
            ),
        ),
    ]


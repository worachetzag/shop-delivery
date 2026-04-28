from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='payment_slip',
            field=models.ImageField(blank=True, null=True, upload_to='payment_slips/', verbose_name='สลิปการชำระเงิน'),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_slip_status',
            field=models.CharField(
                choices=[
                    ('not_required', 'ไม่ต้องใช้สลิป'),
                    ('pending', 'รอสลิป'),
                    ('uploaded', 'อัปโหลดแล้ว รอตรวจสอบ'),
                    ('verified', 'ยืนยันแล้ว'),
                    ('rejected', 'สลิปไม่ถูกต้อง'),
                ],
                default='pending',
                max_length=20,
                verbose_name='สถานะสลิป',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_slip_uploaded_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='เวลาที่อัปโหลดสลิป'),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_verified_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='เวลาที่ยืนยันการชำระเงิน'),
        ),
    ]

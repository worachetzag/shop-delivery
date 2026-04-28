from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0002_order_payment_slip_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DriverAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('assigned', 'มอบหมายแล้ว'), ('accepted', 'คนขับรับงานแล้ว'), ('picked_up', 'รับสินค้าแล้ว'), ('on_the_way', 'กำลังจัดส่ง'), ('delivered', 'จัดส่งสำเร็จ'), ('cancelled', 'ยกเลิก')], default='assigned', max_length=20, verbose_name='สถานะงานจัดส่ง')),
                ('notes', models.TextField(blank=True, verbose_name='หมายเหตุ')),
                ('current_latitude', models.DecimalField(blank=True, decimal_places=15, max_digits=18, null=True, verbose_name='พิกัดละติจูดล่าสุด')),
                ('current_longitude', models.DecimalField(blank=True, decimal_places=15, max_digits=18, null=True, verbose_name='พิกัดลองจิจูดล่าสุด')),
                ('current_location_text', models.CharField(blank=True, max_length=255, verbose_name='ตำแหน่งล่าสุด')),
                ('last_location_at', models.DateTimeField(blank=True, null=True, verbose_name='เวลาอัปเดตตำแหน่งล่าสุด')),
                ('assigned_at', models.DateTimeField(auto_now_add=True, verbose_name='เวลามอบหมาย')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='เวลาอัปเดต')),
                ('assigned_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_driver_jobs', to=settings.AUTH_USER_MODEL, verbose_name='ผู้มอบหมาย')),
                ('driver', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='order_driver_assignments', to=settings.AUTH_USER_MODEL, verbose_name='คนขับ')),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='driver_assignment', to='orders.order', verbose_name='คำสั่งซื้อ')),
            ],
            options={
                'verbose_name': 'การมอบหมายงานคนขับ',
                'verbose_name_plural': 'การมอบหมายงานคนขับ',
                'ordering': ['-assigned_at'],
            },
        ),
    ]

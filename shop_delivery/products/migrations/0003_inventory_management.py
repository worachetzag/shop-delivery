from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('products', '0002_product_unit_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='min_stock_level',
            field=models.PositiveIntegerField(default=0, verbose_name='จุดแจ้งเตือนสต็อกต่ำ'),
        ),
        migrations.AddField(
            model_name='product',
            name='reserved_quantity',
            field=models.PositiveIntegerField(default=0, verbose_name='จำนวนที่ถูกจองจากคำสั่งซื้อ'),
        ),
        migrations.CreateModel(
            name='Supplier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, unique=True, verbose_name='ชื่อผู้จำหน่าย')),
                ('contact_name', models.CharField(blank=True, max_length=120, verbose_name='ชื่อผู้ติดต่อ')),
                ('phone', models.CharField(blank=True, max_length=40, verbose_name='เบอร์โทร')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='อีเมล')),
                ('address', models.TextField(blank=True, verbose_name='ที่อยู่')),
                ('is_active', models.BooleanField(default=True, verbose_name='ใช้งานอยู่')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'ผู้จำหน่าย',
                'verbose_name_plural': 'ผู้จำหน่าย',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='StockMovement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('movement_type', models.CharField(choices=[('purchase_receipt', 'รับเข้าสินค้า'), ('sale_reserve', 'จองจากคำสั่งซื้อ'), ('sale_release', 'คืนจองจากคำสั่งซื้อ'), ('sale_commit', 'ตัดสต็อกจากคำสั่งซื้อ'), ('adjustment_in', 'ปรับเพิ่มสต็อก'), ('adjustment_out', 'ปรับลดสต็อก'), ('return_in', 'คืนสินค้าเข้าคลัง'), ('damage_out', 'เสียหาย/สูญหาย')], max_length=30, verbose_name='ประเภท')),
                ('quantity_change', models.IntegerField(verbose_name='จำนวนที่เปลี่ยนแปลง')),
                ('quantity_before', models.IntegerField(default=0, verbose_name='คงเหลือก่อน')),
                ('quantity_after', models.IntegerField(default=0, verbose_name='คงเหลือหลัง')),
                ('reserved_before', models.IntegerField(default=0, verbose_name='จองก่อน')),
                ('reserved_after', models.IntegerField(default=0, verbose_name='จองหลัง')),
                ('unit_cost', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='ต้นทุนต่อหน่วย')),
                ('source_type', models.CharField(blank=True, max_length=40, verbose_name='ที่มา')),
                ('source_id', models.CharField(blank=True, max_length=64, verbose_name='รหัสเอกสารอ้างอิง')),
                ('reference', models.CharField(blank=True, max_length=120, verbose_name='เลขอ้างอิง')),
                ('note', models.TextField(blank=True, verbose_name='หมายเหตุ')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='stock_movements', to=settings.AUTH_USER_MODEL, verbose_name='ผู้ทำรายการ')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='stock_movements', to='products.product', verbose_name='สินค้า')),
            ],
            options={
                'verbose_name': 'ประวัติการเคลื่อนไหวสต็อก',
                'verbose_name_plural': 'ประวัติการเคลื่อนไหวสต็อก',
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.CreateModel(
            name='PurchaseOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reference', models.CharField(blank=True, max_length=24, unique=True, verbose_name='เลขเอกสาร')),
                ('status', models.CharField(choices=[('draft', 'ฉบับร่าง'), ('approved', 'อนุมัติแล้ว'), ('partial_received', 'รับเข้าแล้วบางส่วน'), ('received', 'รับเข้าแล้ว'), ('cancelled', 'ยกเลิก')], default='draft', max_length=20, verbose_name='สถานะ')),
                ('expected_date', models.DateField(blank=True, null=True, verbose_name='วันที่คาดว่าจะได้รับ')),
                ('notes', models.TextField(blank=True, verbose_name='หมายเหตุ')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_purchase_orders', to=settings.AUTH_USER_MODEL, verbose_name='ผู้สร้าง')),
                ('supplier', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='purchase_orders', to='products.supplier', verbose_name='ผู้จำหน่าย')),
            ],
            options={
                'verbose_name': 'ใบสั่งซื้อสินค้า',
                'verbose_name_plural': 'ใบสั่งซื้อสินค้า',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='PurchaseOrderItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ordered_quantity', models.PositiveIntegerField(default=0, verbose_name='จำนวนที่สั่ง')),
                ('received_quantity', models.PositiveIntegerField(default=0, verbose_name='จำนวนที่รับแล้ว')),
                ('unit_cost', models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='ต้นทุนต่อหน่วย')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='purchase_order_items', to='products.product', verbose_name='สินค้า')),
                ('purchase_order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='products.purchaseorder', verbose_name='ใบสั่งซื้อ')),
            ],
            options={
                'verbose_name': 'รายการใบสั่งซื้อ',
                'verbose_name_plural': 'รายการใบสั่งซื้อ',
                'unique_together': {('purchase_order', 'product')},
            },
        ),
    ]


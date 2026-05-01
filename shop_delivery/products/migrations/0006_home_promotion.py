from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0005_product_is_featured'),
    ]

    operations = [
        migrations.CreateModel(
            name='HomePromotion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=120, verbose_name='หัวข้อ')),
                ('description', models.TextField(blank=True, verbose_name='คำอธิบาย')),
                ('link_label', models.CharField(blank=True, max_length=80, verbose_name='ข้อความปุ่ม')),
                (
                    'link_url',
                    models.CharField(
                        blank=True,
                        help_text='เส้นทางในเว็บ เช่น /customer/products?on_sale=true หรือ URL เต็ม (https://)',
                        max_length=400,
                        verbose_name='ลิงก์',
                    ),
                ),
                ('icon', models.CharField(blank=True, help_text='emoji เช่น 🎉', max_length=12, verbose_name='ไอคอน')),
                ('sort_order', models.PositiveSmallIntegerField(default=0, verbose_name='ลำดับ')),
                ('is_active', models.BooleanField(default=True, verbose_name='แสดง')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'โปรโมชั่นหน้าแรก',
                'verbose_name_plural': 'โปรโมชั่นหน้าแรก',
                'ordering': ['sort_order', 'id'],
            },
        ),
    ]

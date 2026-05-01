from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0006_home_promotion'),
    ]

    operations = [
        migrations.AddField(
            model_name='homepromotion',
            name='banner_image',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to='home_promotions/',
                verbose_name='รูปแบนเนอร์',
            ),
        ),
        migrations.AddField(
            model_name='homepromotion',
            name='link_target',
            field=models.CharField(
                choices=[
                    ('none', 'ไม่มีลิงก์'),
                    ('shop', 'หน้ารวมสินค้า'),
                    ('featured', 'สินค้าแนะนำ'),
                    ('on_sale', 'สินค้าลดราคา'),
                    ('category', 'หมวดหมู่ที่เลือก'),
                    ('product', 'สินค้ารายการเดียว'),
                    ('custom', 'ลิงก์กำหนดเอง'),
                ],
                default='custom',
                max_length=20,
                verbose_name='เป้าหมายลิงก์',
            ),
        ),
        migrations.AddField(
            model_name='homepromotion',
            name='link_category',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='products.category',
                verbose_name='หมวดลิงก์',
            ),
        ),
        migrations.AddField(
            model_name='homepromotion',
            name='link_product',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='products.product',
                verbose_name='สินค้าลิงก์',
            ),
        ),
    ]

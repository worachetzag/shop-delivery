from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='unit_detail',
            field=models.CharField(blank=True, default='', max_length=100, verbose_name='รายละเอียดหน่วย/ขนาด'),
        ),
        migrations.AddField(
            model_name='product',
            name='unit_label',
            field=models.CharField(default='ชิ้น', max_length=50, verbose_name='หน่วยสินค้า'),
        ),
    ]

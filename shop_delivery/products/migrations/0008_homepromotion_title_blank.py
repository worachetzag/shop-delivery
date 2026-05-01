from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0007_home_promotion_banner_and_link_target'),
    ]

    operations = [
        migrations.AlterField(
            model_name='homepromotion',
            name='title',
            field=models.CharField(
                blank=True,
                default='',
                help_text='ถ้ามีรูปแบนเนอร์ไม่บังคับ — ใช้เป็น alt รูปและชื่อในแอดมินถ้ากรอก',
                max_length=120,
                verbose_name='หัวข้อ',
            ),
        ),
    ]

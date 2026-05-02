# Generated manually for Category.icon

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0008_homepromotion_title_blank'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='icon',
            field=models.ImageField(
                blank=True,
                help_text='ถ้าว่าง หน้าลูกค้าจะใช้อิโมจิตามชื่อหมวดอัตโนมัติ',
                null=True,
                upload_to='categories/',
                verbose_name='ไอคอนหมวดหมู่',
            ),
        ),
    ]

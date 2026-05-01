from django.db import migrations, models


def copy_special_offer_to_featured(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    Product.objects.filter(is_special_offer=True).update(is_featured=True)


def clear_featured(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    Product.objects.all().update(is_featured=False)


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0004_product_compare_at_price'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='is_featured',
            field=models.BooleanField(
                default=False,
                help_text='แสดงในหมวดสินค้าแนะนำบนหน้าแรก (แยกจากสินค้าที่ตั้งราคาก่อนลด)',
                verbose_name='สินค้าแนะนำ',
            ),
        ),
        migrations.RunPython(copy_special_offer_to_featured, clear_featured),
    ]

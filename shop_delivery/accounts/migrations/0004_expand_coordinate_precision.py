from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_customeraddress'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customer',
            name='latitude',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=12, null=True, verbose_name='ละติจูด'),
        ),
        migrations.AlterField(
            model_name='customer',
            name='longitude',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=12, null=True, verbose_name='ลองจิจูด'),
        ),
        migrations.AlterField(
            model_name='customeraddress',
            name='latitude',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=12, null=True),
        ),
        migrations.AlterField(
            model_name='customeraddress',
            name='longitude',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=12, null=True),
        ),
    ]

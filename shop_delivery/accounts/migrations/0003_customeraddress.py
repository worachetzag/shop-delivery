from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_customer_latitude_customer_longitude'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomerAddress',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(default='ที่อยู่', max_length=50)),
                ('recipient_name', models.CharField(blank=True, max_length=120)),
                ('phone_number', models.CharField(blank=True, max_length=15)),
                ('address_line', models.TextField()),
                ('district', models.CharField(blank=True, max_length=100)),
                ('province', models.CharField(blank=True, max_length=100)),
                ('postal_code', models.CharField(blank=True, max_length=10)),
                ('latitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('longitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('is_default', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='addresses', to='accounts.customer')),
            ],
            options={
                'verbose_name': 'ที่อยู่ลูกค้า',
                'verbose_name_plural': 'ที่อยู่ลูกค้า',
                'ordering': ['-is_default', '-updated_at'],
            },
        ),
    ]

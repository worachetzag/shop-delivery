from collections import defaultdict

from django.db import migrations, models


def fill_order_numbers(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    DailyOrderSequence = apps.get_model('orders', 'DailyOrderSequence')

    counters = defaultdict(int)
    to_update = []

    qs = Order.objects.all().order_by('created_at', 'id').only('id', 'created_at', 'order_number')
    for order in qs.iterator():
        if order.order_number:
            continue
        day = order.created_at.date()
        counters[day] += 1
        order.order_number = f"SP{day.strftime('%Y%m%d')}{counters[day]:03d}"
        to_update.append(order)

    if to_update:
        Order.objects.bulk_update(to_update, ['order_number'])

    for day, last_number in counters.items():
        DailyOrderSequence.objects.update_or_create(
            date=day,
            defaults={'last_number': last_number},
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0007_storelocation_promptpay_number'),
    ]

    operations = [
        migrations.CreateModel(
            name='DailyOrderSequence',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(unique=True)),
                ('last_number', models.PositiveIntegerField(default=0)),
            ],
            options={
                'verbose_name': 'ลำดับเลขออเดอร์รายวัน',
                'verbose_name_plural': 'ลำดับเลขออเดอร์รายวัน',
            },
        ),
        migrations.AddField(
            model_name='order',
            name='order_number',
            field=models.CharField(blank=True, max_length=16, null=True, unique=True, verbose_name='หมายเลขคำสั่งซื้อ'),
        ),
        migrations.RunPython(fill_order_numbers, reverse_code=noop_reverse),
        migrations.AlterField(
            model_name='order',
            name='order_number',
            field=models.CharField(blank=True, max_length=16, unique=True, verbose_name='หมายเลขคำสั่งซื้อ'),
        ),
    ]

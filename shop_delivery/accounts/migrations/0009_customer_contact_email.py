from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_expand_lineuser_profile_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='contact_email',
            field=models.EmailField(blank=True, default='', verbose_name='อีเมลติดต่อ (จากลูกค้า)'),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_staff_audit_log'),
    ]

    operations = [
        migrations.AddField(
            model_name='driverprofile',
            name='photo',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to='driver_photos/',
                verbose_name='รูปประจำตัวคนขับ',
            ),
        ),
    ]

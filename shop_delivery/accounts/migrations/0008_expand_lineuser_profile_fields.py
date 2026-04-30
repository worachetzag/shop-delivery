from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_driverprofile_photo'),
    ]

    operations = [
        migrations.AlterField(
            model_name='lineuser',
            name='picture_url',
            field=models.URLField(blank=True, max_length=500, null=True, verbose_name='URL รูปโปรไฟล์'),
        ),
        migrations.AlterField(
            model_name='lineuser',
            name='status_message',
            field=models.CharField(blank=True, max_length=500, verbose_name='สถานะ'),
        ),
    ]

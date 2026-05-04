# Generated manually for PDPA privacy_policy consent

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pdpa', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='consentrecord',
            name='privacy_policy',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='consent_records',
                to='pdpa.privacypolicy',
                verbose_name='นโยบายที่อ้างอิง',
            ),
        ),
        migrations.AlterField(
            model_name='consentrecord',
            name='consent_type',
            field=models.CharField(
                choices=[
                    ('marketing', 'การตลาด'),
                    ('data_processing', 'การประมวลผลข้อมูล'),
                    ('third_party', 'การแชร์ข้อมูลกับบุคคลที่สาม'),
                    ('analytics', 'การวิเคราะห์ข้อมูล'),
                    ('privacy_policy', 'นโยบายความเป็นส่วนตัว (PDPA)'),
                ],
                max_length=20,
                verbose_name='ประเภทความยินยอม',
            ),
        ),
    ]

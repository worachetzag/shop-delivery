import re
from datetime import date

from django.db import migrations, models


def _pid_digits(pid):
    return re.sub(r'\D', '', pid or '')


def _valid_thai_id(pid):
    s = _pid_digits(pid)
    if len(s) != 13:
        return False
    total = sum(int(s[i]) * (13 - i) for i in range(12))
    check = (11 - (total % 11)) % 10
    return check == int(s[12])


def _dob_ok(dob):
    if dob is None:
        return False
    today = date.today()
    if dob > today:
        return False
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return 1 <= age <= 120


def forwards_fill_profile_completed(apps, schema_editor):
    Customer = apps.get_model('accounts', 'Customer')
    for c in Customer.objects.select_related('user').iterator():
        u = c.user
        phone = (c.phone_number or '').strip()
        digits = ''.join(ch for ch in phone if ch.isdigit())
        ok = (
            bool((u.first_name or '').strip())
            and bool((u.last_name or '').strip())
            and len(digits) >= 9
            and not phone.upper().startswith('LINE_')
            and bool((c.address or '').strip())
            and _valid_thai_id(c.id_card_number)
            and _dob_ok(c.date_of_birth)
        )
        c.profile_completed = ok
        c.save(update_fields=['profile_completed'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_customer_contact_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='profile_completed',
            field=models.BooleanField(
                default=False,
                help_text='ครบถ้ามีชื่อ–สกุล เลขบัตรประชาชนถูกต้อง วันเกิด ที่อยู่ เบอร์โทร',
                verbose_name='กรอกโปรไฟล์ครบแล้ว',
            ),
        ),
        migrations.RunPython(forwards_fill_profile_completed, noop_reverse),
    ]

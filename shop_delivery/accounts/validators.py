"""Validators for Thai citizen ID and customer profile completeness."""
from __future__ import annotations

import re
from datetime import date

_THAI_ID_NON_DIGITS = re.compile(r'\D')


def thai_citizen_id_digits(raw: str | None) -> str:
    return _THAI_ID_NON_DIGITS.sub('', raw or '')


def is_valid_thai_citizen_id(raw: str | None) -> bool:
    """
    Thai national ID checksum (13 digits).
    https://github.com/codeninja55/th-national-id-validator (algorithm reference)
    """
    pid = thai_citizen_id_digits(raw)
    if len(pid) != 13:
        return False
    total = sum(int(pid[i]) * (13 - i) for i in range(12))
    check = (11 - (total % 11)) % 10
    return check == int(pid[12])


def age_years_on(dob: date, today: date | None = None) -> int:
    today = today or date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def is_reasonable_customer_dob(dob: date | None) -> bool:
    if dob is None:
        return False
    today = date.today()
    if dob > today:
        return False
    age = age_years_on(dob, today)
    return 1 <= age <= 120


def refresh_customer_profile_completed(customer) -> bool:
    """
    Set customer.profile_completed from current DB fields (does not save).
    Returns the boolean value assigned.
    """
    user = getattr(customer, 'user', None)
    if user is None:
        customer.profile_completed = False
        return False

    phone = (customer.phone_number or '').strip()
    phone_digits = ''.join(c for c in phone if c.isdigit())

    ok = (
        bool((user.first_name or '').strip())
        and bool((user.last_name or '').strip())
        and len(phone_digits) == 10
        and not phone.upper().startswith('LINE_')
        and bool((customer.address or '').strip())
        and is_valid_thai_citizen_id(customer.id_card_number)
        and is_reasonable_customer_dob(customer.date_of_birth)
    )
    customer.profile_completed = ok
    return ok

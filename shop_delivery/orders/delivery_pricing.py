"""
ค่าจัดส่งตามระยะทาง (กม.) — ใช้ร่วมกับ API คำนวณค่าจัดส่งและตอนสร้างออเดอร์

ระยะทางมาจากอย่างใดอย่างหนึ่ง:
1) ลูกค้าส่ง delivery_distance (กม.) ที่ได้จากแผนที่/ Directions API (แนะนำ — ใกล้ระยะถนนจริง)
2) ตั้งพิกัดร้านใน Django Admin (พิกัดร้าน / StoreLocation) หรือ DELIVERY_ORIGIN_* ใน .env แล้วลูกค้าส่ง
   delivery_latitude / delivery_longitude — ระบบคำนวณระยะแบบเส้นตรง (Haversine) ฝั่งเซิร์ฟเวอร์
   (สั้นกว่าระยะถนนจริง โดยทั่วไป)
"""
from __future__ import annotations

import math
from decimal import Decimal
from typing import Union


Number = Union[Decimal, float, int, str, None]


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """ระยะทางเส้นตรงบนผิวโลก (กม.)"""
    r_km = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.asin(min(1.0, math.sqrt(a)))
    return r_km * c


def fee_for_distance_km(distance: Number) -> Decimal:
    """
    ตารางค่าจัดส่ง (บาท):
    - ไม่เกิน 3 กม. → 0
    - ไม่เกิน 5 กม. → 20
    - ไม่เกิน 10 กม. → 35
    - มากกว่า 10 กม. → 50
    """
    if distance is None:
        return Decimal('0')
    d = float(distance)
    if d <= 0:
        return Decimal('0')
    if d <= 3:
        return Decimal('0')
    if d <= 5:
        return Decimal('20')
    if d <= 10:
        return Decimal('35')
    return Decimal('50')


def quantize_distance_km(distance_km: float) -> Decimal:
    """เก็บระยะทางทศนิยม 2 ตำแหน่ง"""
    return Decimal(str(round(distance_km, 2)))

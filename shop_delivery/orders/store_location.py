"""พิกัดร้าน: อ่านจากฐานข้อมูล (StoreLocation) ก่อน แล้วค่อย fallback ไปที่ settings / .env"""
from django.conf import settings


def get_delivery_origin_lat_lng():
    """
    คืน (latitude, longitude) หรือ (None, None)
    ลำดับ: แถวแรกของ StoreLocation ที่มี lat/lng → DELIVERY_ORIGIN_* ใน settings
    """
    from .models import StoreLocation

    loc = StoreLocation.objects.order_by('pk').first()
    if loc is not None and loc.latitude is not None and loc.longitude is not None:
        return float(loc.latitude), float(loc.longitude)
    lat = getattr(settings, 'DELIVERY_ORIGIN_LATITUDE', None)
    lng = getattr(settings, 'DELIVERY_ORIGIN_LONGITUDE', None)
    return lat, lng


def get_store_location_payload():
    """ข้อมูลสำหรับ API / แอป (แสดงแผนที่, คำนวณระยะ)"""
    from .models import StoreLocation

    o_lat, o_lng = get_delivery_origin_lat_lng()
    loc = StoreLocation.objects.order_by('pk').first()
    if loc is not None and loc.latitude is not None and loc.longitude is not None:
        source = 'database'
    elif o_lat is not None and o_lng is not None:
        source = 'environment'
    else:
        source = None
    return {
        'name': (loc.name if loc else '') or '',
        'address': (loc.address if loc else '') or '',
        'latitude': o_lat,
        'longitude': o_lng,
        'source': source,
    }

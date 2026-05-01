from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from products.models import Product


class Command(BaseCommand):
    help = (
        'ตรวจว่าไฟล์รูปอยู่จริงใต้ MEDIA_ROOT หรือไม่ '
        '(ช่วยไล่ปัญหา /media/... ขึ้น 404 บน Render)'
    )

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=400, help='จำนวนสูงสุดของแถวที่ตรวจ (0 = ทั้งหมด)')

    def handle(self, *args, **options):
        root = Path(settings.MEDIA_ROOT)
        self.stdout.write(self.style.WARNING(f'MEDIA_ROOT = {root}'))

        qs = Product.objects.exclude(image='').exclude(image__isnull=True).order_by('id')
        lim = options['limit']
        if lim and lim > 0:
            qs = qs[:lim]

        missing = []
        ok = 0
        for p in qs:
            rel = str(p.image.name).strip().lstrip('/')
            if not rel:
                continue
            full = root / rel
            if full.is_file():
                ok += 1
            else:
                missing.append((p.id, rel))

        total = ok + len(missing)
        self.stdout.write(f'ตรวจแล้ว {total} รายการที่มีฟิลด์ image ใน DB')
        self.stdout.write(self.style.SUCCESS(f'มีไฟล์จริงบนดิสก์: {ok}'))
        self.stdout.write(self.style.ERROR(f'ไม่มีไฟล์ (เปิด URL จะ 404): {len(missing)}'))
        for pid, rel in missing[:50]:
            self.stdout.write(f'  product id={pid}  →  {rel}')
        if len(missing) > 50:
            self.stdout.write(f'  ... และอีก {len(missing) - 50} รายการ')

        if missing and ok == 0 and root.exists():
            self.stdout.write('')
            self.stdout.write(
                self.style.WARNING(
                    'ถ้าเพิ่งรัน seed บนเครื่องตัวเองขณะ DATABASE_URL ชี้ production → '
                    'ไฟล์จะอยู่แค่เครื่องคุณ ไม่ได้อยู่บน Render '
                    '(ให้รัน seed_grocery_demo --refresh-images ใน Render Shell แทน)'
                )
            )

"""
เติม/อัปเดตข้อมูลตัวอย่างร้านขายของชำ + ปุ๋ย

โหมดปกติ: upsert (ไม่ลบข้อมูลเดิม)
โหมด reset: ลบสินค้า/หมวดหมู่เดิมก่อนแล้วค่อยใส่ใหม่

รัน:
    python manage.py seed_grocery_demo
    python manage.py seed_grocery_demo --no-input
    python manage.py seed_grocery_demo --reset --no-input
"""

from urllib.parse import urlparse

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from products.models import Category, Product

# (ชื่อหมวด, คำอธิบายหมวด, รายการสินค้า)
# แต่ละสินค้า:
#   name, description, price, unit_label, unit_detail, stock, is_special[, image_url]
SEED = [
    (
        'อาหารแห้งและบริโภค',
        'ข้าวสาร บะหมี่ อาหารกระป๋อง ธัญพืช',
        [
            ('ข้าวหอมมะลิ ตราคุณภาพ', 'ข้าวหอมมะลิใหม่ คัดพิเศษ', 165.00, 'ถุง', '5 กก.', 80, False),
            ('ข้าวขาวหัก 100%', 'เหมาะสำหรับร้านอาหารและครัวเรือน', 135.00, 'ถุง', '5 กก.', 60, False),
            ('ข้าวเหนียวเขี้ยวงู', 'ข้าวเหนียวนึ่งนุ่มหอม', 185.00, 'ถุง', '5 กก.', 45, False),
            ('บะหมี่กึ่งสำเร็จรูป รสต้มยำ', '', 7.00, 'ซอง', '60 ก.', 200, False),
            ('บะหมี่กึ่งสำเร็จรูป รสหมูสับ', '', 7.00, 'ซอง', '60 ก.', 180, False),
            ('วุ้นเส้นอบแห้ง', '', 18.00, 'ห่อ', '80 ก.', 90, False),
            ('ปลากระป๋องในซอสมะเขือเทศ', '', 22.00, 'กระป๋อง', '155 ก.', 120, False),
            ('ทูน่ากระป๋องในน้ำเกลือ', '', 35.00, 'กระป๋อง', '165 ก.', 90, False),
            ('น้ำตาลทรายขาว', '', 28.00, 'ถุง', '1 กก.', 60, False),
            ('เกลือป่น', '', 12.00, 'ถุง', '500 ก.', 100, False),
            ('ถั่วเขียวซีก', '', 26.00, 'ถุง', '500 ก.', 55, False),
        ],
    ),
    (
        'เครื่องดื่มและนม',
        'น้ำดื่ม น้ำอัดลม กาแฟ นม เครื่องดื่มพร้อมดื่ม',
        [
            ('น้ำดื่ม', '', 7.00, 'ขวด', '600 มล.', 300, False),
            ('น้ำดื่มแพ็ค', '', 65.00, 'แพ็ค', '12 ขวด', 70, False),
            ('น้ำอัดลมโคล่า', '', 19.00, 'กระป๋อง', '325 มล.', 150, True),
            ('น้ำหวานกลิ่นสละ', '', 28.00, 'ขวด', '710 มล.', 45, False),
            ('กาแฟสำเร็จรูป 3in1', '', 6.00, 'ซอง', '18 ก.', 250, False),
            ('โอวัลติน 3in1', '', 8.00, 'ซอง', '30 ก.', 220, False),
            ('นม UHT รสจืด', '', 15.00, 'กล่อง', '200 มล.', 180, False),
            ('นมถั่วเหลือง', '', 12.00, 'กล่อง', '250 มล.', 140, False),
            ('ชาพร้อมดื่ม', '', 20.00, 'ขวด', '450 มล.', 110, True),
        ],
    ),
    (
        'ของใช้และอุปโภค',
        'สบู่ ยาสีฟัน กระดาษทิชชู่ ของใช้ประจำวัน',
        [
            ('สบู่ก้อนกลิ่นดอกไม้', '', 25.00, 'ก้อน', '90 ก.', 90, False),
            ('แชมพูซอง', '', 6.00, 'ซอง', '7 มล.', 350, False),
            ('ยาสีฟัน', '', 45.00, 'หลอด', '100 ก.', 70, False),
            ('แปรงสีฟัน', '', 22.00, 'ด้าม', '1 ชิ้น', 120, False),
            ('กระดาษทิชชู่ม้วน', '', 35.00, 'แพ็ค', '6 ม้วน', 55, False),
            ('ทิชชู่เช็ดหน้า', '', 39.00, 'กล่อง', '160 แผ่น', 60, False),
            ('น้ำยาล้างจาน', '', 39.00, 'ขวด', '800 มล.', 40, False),
            ('ผงซักฟอก', '', 65.00, 'ถุง', '800 ก.', 75, False),
            ('น้ำยาปรับผ้านุ่ม', '', 59.00, 'ถุง', '600 มล.', 65, False),
            ('ถุงขยะดำ', '', 55.00, 'ม้วน', '30 ใบ', 35, False),
        ],
    ),
    (
        'ขนมและของว่าง',
        'ขนมขบเคี้ยว ขนมปัง ลูกอม',
        [
            ('ขนมปังแซนวิช', '', 12.00, 'ห่อ', '2 ชิ้น', 45, False),
            ('ลูกอมรสผลไม้', '', 5.00, 'ซอง', '50 ก.', 200, False),
            ('มันฝรั่งทอดกรอบ', '', 25.00, 'ห่อ', '55 ก.', 80, True),
            ('ถั่วลิสงอบเกลือ', '', 20.00, 'ซอง', '70 ก.', 90, False),
            ('ข้าวโพดอบเนย', '', 15.00, 'ซอง', '35 ก.', 100, False),
            ('เวเฟอร์สอดไส้', '', 10.00, 'ห่อ', '22 ก.', 130, False),
        ],
    ),
    (
        'เครื่องปรุงรส',
        'น้ำปลา ซอส น้ำมันพืช เครื่องปรุงทำอาหาร',
        [
            ('น้ำปลา', '', 42.00, 'ขวด', '700 มล.', 65, False),
            ('ซีอิ๊วขาว', '', 38.00, 'ขวด', '500 มล.', 50, False),
            ('น้ำมันพืช', '', 52.00, 'ขวด', '1 ลิตร', 70, False),
            ('พริกแกงเผา', '', 18.00, 'ซอง', '50 ก.', 40, False),
            ('ซอสหอยนางรม', '', 48.00, 'ขวด', '600 มล.', 55, False),
            ('ซีอิ๊วดำหวาน', '', 35.00, 'ขวด', '500 มล.', 45, False),
            ('น้ำส้มสายชู', '', 24.00, 'ขวด', '700 มล.', 42, False),
            ('ซอสพริก', '', 37.00, 'ขวด', '500 มล.', 48, False),
        ],
    ),
    (
        'เครื่องครัวและภาชนะ',
        'ของใช้ในครัวเรือนและร้านอาหารขนาดเล็ก',
        [
            ('แก้วพลาสติกใส', '', 45.00, 'แพ็ค', '50 ใบ', 35, False),
            ('ช้อนส้อมพลาสติก', '', 30.00, 'แพ็ค', '25 ชุด', 40, False),
            ('กล่องอาหารพลาสติก', '', 65.00, 'แพ็ค', '25 ใบ', 38, False),
            ('ถุงหูหิ้ว', '', 55.00, 'แพ็ค', '500 กรัม', 28, False),
            ('ฟองน้ำล้างจาน', '', 15.00, 'ชิ้น', '1 ชิ้น', 80, False),
            ('ถุงซิปล็อก', '', 35.00, 'กล่อง', '20 ใบ', 50, False),
        ],
    ),
    (
        'ของใช้เบ็ดเตล็ด',
        'อุปกรณ์เล็กๆ สำหรับใช้งานประจำวัน',
        [
            ('หลอดไฟ LED 9W', '', 69.00, 'หลอด', 'แสงขาว', 40, False),
            ('ปลั๊กพ่วง 3 ช่อง', '', 129.00, 'ชิ้น', 'สาย 3 เมตร', 20, False),
            ('ถ่าน AA', '', 39.00, 'แพ็ค', '4 ก้อน', 55, False),
            ('ถ่าน AAA', '', 39.00, 'แพ็ค', '4 ก้อน', 55, False),
            ('ไฟแช็กแก๊ส', '', 15.00, 'อัน', '1 ชิ้น', 120, False),
            ('เทปใส 2 นิ้ว', '', 25.00, 'ม้วน', '45 หลา', 42, False),
        ],
    ),
    (
        'ปุ๋ยและการเกษตร',
        'ปุ๋ยเคมี ปุ๋ยอินทรีย์ เมล็ดพันธุ์ และอุปกรณ์สวน',
        [
            ('ปุ๋ย NPK 15-15-15', 'ปุ๋ยเคมีสูตรดุล ใช้ได้ทั้งพืชไร่และพืชสวน', 189.00, 'ถุง', '1 กก.', 25, False),
            ('ปุ๋ยยูเรีย 46-0-0', 'เสริมไนโตรเจน ใช้หว่านหรือละลายน้ำ', 145.00, 'ถุง', '1 กก.', 30, False),
            ('ปุ๋ยอินทรีย์มูลไก่หมัก', 'ช่วยปรับปรุงดิน', 95.00, 'ถุง', '5 กก.', 15, False),
            ('ปุ๋ยคอกผสม (มูลวัว-ไก่)', 'สำหรับต้นไม้และผักปลอดสาร', 120.00, 'ถุง', '10 กก.', 12, False),
            ('ปุ๋ยหัวเร่งดอก สูตร 8-24-24', 'เหมาะกับพืชให้ผลและดอกไม้', 210.00, 'ถุง', '1 กก.', 18, True),
            ('ฮอร์โมนเร่งราก น้ำ', 'ช่วยต้นกล้าและต้นย้ายปลูก', 45.00, 'ขวด', '100 มล.', 40, False),
            ('ดินปลูกผสมสำเร็จ', 'ดินปลูกพร้อมใช้ ระบายน้ำดี', 79.00, 'ถุง', '5 กก.', 25, False),
            ('เมล็ดพันธุ์ผักบุ้ง', 'งอกง่าย โตไว', 25.00, 'ซอง', '20 กรัม', 60, False),
            ('เมล็ดพันธุ์คะน้า', 'พันธุ์ใบใหญ่', 25.00, 'ซอง', '20 กรัม', 55, False),
            ('ยาฆ่าแมลงชีวภาพ', 'สำหรับสวนครัวและพืชผัก', 65.00, 'ขวด', '250 มล.', 35, False),
            ('บัวรดน้ำพลาสติก', '', 85.00, 'อัน', '5 ลิตร', 20, False),
        ],
    ),
]


class Command(BaseCommand):
    help = 'เติม/อัปเดตข้อมูลร้านขายของชำ + ปุ๋ย (รองรับ reset ทั้งก้อน)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='ไม่ถามยืนยัน (ใช้บน server/script)',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='ลบสินค้าและหมวดหมู่ทั้งหมดก่อน (ระวังข้อมูลเดิมหายตาม cascade)',
        )
        parser.add_argument(
            '--skip-images',
            action='store_true',
            help='ไม่ดาวน์โหลด/อัปเดตรูปสินค้า',
        )
        parser.add_argument(
            '--refresh-images',
            action='store_true',
            help='บังคับโหลดรูปใหม่ แม้สินค้ามีรูปอยู่แล้ว',
        )

    @staticmethod
    def _default_image_url(product_name):
        seed = slugify(product_name) or 'product'
        return f'https://picsum.photos/seed/{seed}/640/480'

    @staticmethod
    def _guess_ext_from_url(url):
        path = urlparse(url).path or ''
        lowered = path.lower()
        if lowered.endswith('.png'):
            return 'png'
        if lowered.endswith('.webp'):
            return 'webp'
        if lowered.endswith('.gif'):
            return 'gif'
        return 'jpg'

    def _attach_image_from_url(self, product, image_url):
        try:
            response = requests.get(image_url, timeout=15)
            if response.status_code != 200:
                self.stdout.write(self.style.WARNING(
                    f'    - ข้ามรูป "{product.name}" (HTTP {response.status_code})'
                ))
                return False
            ext = self._guess_ext_from_url(image_url)
            filename = f'{slugify(product.name) or "product"}-{product.id}.{ext}'
            product.image.save(filename, ContentFile(response.content), save=True)
            return True
        except Exception as exc:
            self.stdout.write(self.style.WARNING(
                f'    - โหลดรูปไม่สำเร็จ "{product.name}": {exc}'
            ))
            return False

    def handle(self, *args, **options):
        no_input = options['no_input']
        reset = options['reset']
        skip_images = options['skip_images']
        refresh_images = options['refresh_images']

        if reset and not no_input:
            self.stdout.write(
                self.style.WARNING(
                    'คำสั่งนี้จะลบสินค้าและหมวดหมู่ทั้งหมด '
                    'และรายการสินค้าในคำสั่งซื้อเก่าที่อ้างสินค้านั้น (CASCADE)'
                )
            )
            confirm = input('พิมพ์ yes เพื่อดำเนินการต่อ: ').strip().lower()
            if confirm != 'yes':
                self.stdout.write(self.style.ERROR('ยกเลิกแล้ว'))
                return

        with transaction.atomic():
            if reset:
                n_deleted, breakdown = Category.objects.all().delete()
                self.stdout.write(f'ลบข้อมูลเดิมแล้ว (รวม {n_deleted} แถวตาม cascade): {breakdown}')
            else:
                self.stdout.write('โหมด upsert: จะเพิ่ม/อัปเดตสินค้า โดยไม่ลบข้อมูลเดิม')

            total_products = 0
            total_created = 0
            total_updated = 0
            total_images = 0

            for cat_name, cat_desc, items in SEED:
                cat, _ = Category.objects.get_or_create(
                    name=cat_name,
                    defaults={'description': cat_desc or ''},
                )
                if (cat.description or '') != (cat_desc or ''):
                    cat.description = cat_desc or ''
                    cat.save(update_fields=['description'])

                for (
                    name,
                    desc,
                    price,
                    unit_label,
                    unit_detail,
                    stock,
                    is_special,
                    *extra,
                ) in items:
                    image_url = extra[0] if extra else self._default_image_url(name)
                    product, created = Product.objects.update_or_create(
                        name=name,
                        defaults={
                            'description': desc or '',
                            'price': price,
                            'unit_label': unit_label,
                            'unit_detail': unit_detail,
                            'category': cat,
                            'stock_quantity': stock,
                            'is_available': True,
                            'is_special_offer': is_special,
                        },
                    )
                    if created:
                        total_created += 1
                    else:
                        total_updated += 1
                    total_products += 1
                    if not skip_images and (refresh_images or not product.image):
                        if self._attach_image_from_url(product, image_url):
                            total_images += 1

                self.stdout.write(self.style.SUCCESS(f'  + หมวด "{cat_name}" ({len(items)} รายการ)'))

        self.stdout.write(
            self.style.SUCCESS(
                f'เสร็จแล้ว: {len(SEED)} หมวดหมู่, {total_products} สินค้า '
                f'(เพิ่มใหม่ {total_created}, อัปเดต {total_updated}, โหลดรูป {total_images})'
            )
        )

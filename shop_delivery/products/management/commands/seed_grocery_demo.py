"""
ลบสินค้าและหมวดหมู่ทั้งหมด แล้วใส่ข้อมูลตัวอย่างร้านขายของชำ + ปุ๋ย

หมายเหตุ: OrderItem ที่อ้างถึงสินค้าเดิมจะถูกลบตาม CASCADE
(คำสั่งซื้อเก่ายังอยู่ แต่รายการสินค้าในคำสั่งซื้อนั้นหาย)

รัน: python manage.py seed_grocery_demo
     python manage.py seed_grocery_demo --no-input
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from products.models import Category, Product

# (ชื่อหมวด, คำอธิบายหมวด, รายการสินค้า)
# แต่ละสินค้า: name, description, price, unit_label, unit_detail, stock, is_special
SEED = [
    (
        'อาหารแห้งและบริโภค',
        'ข้าวสาร บะหมี่ อาหารกระป๋อง',
        [
            ('ข้าวหอมมะลิ ตราคุณภาพ', 'ข้าวหอมมะลิใหม่ คัดพิเศษ', 165.00, 'ถุง', '5 กก.', 80, False),
            ('บะหมี่กึ่งสำเร็จรูป รสต้มยำ', '', 7.00, 'ซอง', '60 ก.', 200, False),
            ('ปลากระป๋องในซอสมะเขือเทศ', '', 22.00, 'กระป๋อง', '155 ก.', 120, False),
            ('น้ำตาลทรายขาว', '', 28.00, 'ถุง', '1 กก.', 60, False),
            ('เกลือป่น', '', 12.00, 'ถุง', '500 ก.', 100, False),
        ],
    ),
    (
        'เครื่องดื่มและนม',
        'น้ำดื่ม น้ำอัดลม กาแฟสำเร็จรูป',
        [
            ('น้ำดื่ม', '', 7.00, 'ขวด', '600 มล.', 300, False),
            ('น้ำอัดลมโคล่า', '', 19.00, 'กระป๋อง', '325 มล.', 150, True),
            ('กาแฟสำเร็จรูป 3in1', '', 6.00, 'ซอง', '18 ก.', 250, False),
            ('นม UHT รสจืด', '', 15.00, 'กล่อง', '200 มล.', 180, False),
        ],
    ),
    (
        'ของใช้และอุปโภค',
        'สบู่ ยาสีฟัน กระดาษทิชชู่',
        [
            ('สบู่ก้อนกลิ่นดอกไม้', '', 25.00, 'ก้อน', '90 ก.', 90, False),
            ('ยาสีฟัน', '', 45.00, 'หลอด', '100 ก.', 70, False),
            ('กระดาษทิชชู่ม้วน', '', 35.00, 'แพ็ค', '6 ม้วน', 55, False),
            ('น้ำยาล้างจาน', '', 39.00, 'ขวด', '800 มล.', 40, False),
            ('ถุงขยะดำ', '', 55.00, 'ม้วน', '30 ใบ', 35, False),
        ],
    ),
    (
        'ขนมและของว่าง',
        '',
        [
            ('ขนมปังแซนวิช', '', 12.00, 'ห่อ', '2 ชิ้น', 45, False),
            ('ลูกอมรสผลไม้', '', 5.00, 'ซอง', '50 ก.', 200, False),
            ('มันฝรั่งทอดกรอบ', '', 25.00, 'ห่อ', '55 ก.', 80, True),
        ],
    ),
    (
        'เครื่องปรุงรส',
        'น้ำปลา ซอส น้ำมันพืช',
        [
            ('น้ำปลา', '', 42.00, 'ขวด', '700 มล.', 65, False),
            ('ซีอิ๊วขาว', '', 38.00, 'ขวด', '500 มล.', 50, False),
            ('น้ำมันพืช', '', 52.00, 'ขวด', '1 ลิตร', 70, False),
            ('พริกแกงเผา', '', 18.00, 'ซอง', '50 ก.', 40, False),
        ],
    ),
    (
        'ปุ๋ยและการเกษตร',
        'ปุ๋ยเคมี ปุ๋ยอินทรีย์ สำหรับต้นไม้และพืชผัก',
        [
            ('ปุ๋ย NPK 15-15-15', 'ปุ๋ยเคมีสูตรดุล ใช้ได้ทั้งพืชไร่และพืชสวน', 189.00, 'ถุง', '1 กก.', 25, False),
            ('ปุ๋ยยูเรีย 46-0-0', 'เสริมไนโตรเจน ใช้หว่านหรือละลายน้ำ', 145.00, 'ถุง', '1 กก.', 30, False),
            ('ปุ๋ยอินทรีย์มูลไก่หมัก', 'ช่วยปรับปรุงดิน', 95.00, 'ถุง', '5 กก.', 15, False),
            ('ปุ๋ยคอกผสม (มูลวัว-ไก่)', 'สำหรับต้นไม้และผักปลอดสาร', 120.00, 'ถุง', '10 กก.', 12, False),
            ('ปุ๋ยหัวเร่งดอก สูตร 8-24-24', 'เหมาะกับพืชให้ผลและดอกไม้', 210.00, 'ถุง', '1 กก.', 18, True),
            ('ฮอร์โมนเร่งราก น้ำ', 'ช่วยต้นกล้าและต้นย้ายปลูก', 45.00, 'ขวด', '100 มล.', 40, False),
        ],
    ),
]


class Command(BaseCommand):
    help = 'ลบสินค้าและหมวดหมู่ทั้งหมด แล้วใส่ข้อมูลร้านขายของชำ + ปุ๋ย (ตัวอย่าง)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='ไม่ถามยืนยัน (ใช้บน server/script)',
        )

    def handle(self, *args, **options):
        no_input = options['no_input']

        if not no_input:
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
            # ลบหมวดหมู่ → CASCADE ลบสินค้า → CASCADE ลบ OrderItem ที่อ้างสินค้านั้น
            n_deleted, breakdown = Category.objects.all().delete()
            self.stdout.write(f'ลบข้อมูลเดิมแล้ว (รวม {n_deleted} แถวตาม cascade): {breakdown}')

            total_products = 0
            for cat_name, cat_desc, items in SEED:
                cat = Category.objects.create(name=cat_name, description=cat_desc or '')
                for (
                    name,
                    desc,
                    price,
                    unit_label,
                    unit_detail,
                    stock,
                    is_special,
                ) in items:
                    Product.objects.create(
                        name=name,
                        description=desc or '',
                        price=price,
                        unit_label=unit_label,
                        unit_detail=unit_detail,
                        category=cat,
                        stock_quantity=stock,
                        is_available=True,
                        is_special_offer=is_special,
                    )
                    total_products += 1
                self.stdout.write(self.style.SUCCESS(f'  + หมวด "{cat_name}" ({len(items)} รายการ)'))

        self.stdout.write(
            self.style.SUCCESS(f'เสร็จแล้ว: {len(SEED)} หมวดหมู่, {total_products} สินค้า')
        )

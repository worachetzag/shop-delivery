from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import DriverProfile, UserRole


class LogisticsDriverPermissionsTests(APITestCase):
    """เฟส A — /api/logistics/drivers/* ไม่ให้ลูกค้าทั่วไปเข้าถึง"""

    list_url = '/api/logistics/drivers/'
    availability_url = '/api/logistics/drivers/availability/'

    @classmethod
    def setUpTestData(cls):
        cls.password = 'test-pass-123'

        cls.admin = User.objects.create_user(username='adm', password=cls.password)
        cls.admin.is_staff = True
        cls.admin.save()

        cls.customer = User.objects.create_user(username='cust', password=cls.password)
        UserRole.objects.create(user=cls.customer, role='customer')

        cls.driver_user = User.objects.create_user(username='drv', password=cls.password)
        UserRole.objects.create(user=cls.driver_user, role='driver')
        cls.driver_profile = DriverProfile.objects.create(
            user=cls.driver_user,
            license_number='DL001',
            vehicle_type='motorcycle',
            vehicle_number='กข-1234',
            phone_number='0812345678',
            is_available=True,
        )

    def test_anonymous_cannot_list_drivers(self):
        r = self.client.get(self.list_url)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_list_drivers(self):
        self.client.force_authenticate(user=self.customer)
        r = self.client.get(self.list_url)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_list_drivers(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(self.list_url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_driver_updates_own_availability_without_driver_id(self):
        self.client.force_authenticate(user=self.driver_user)
        r = self.client.post(self.availability_url, {'is_available': False}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.driver_profile.refresh_from_db()
        self.assertFalse(self.driver_profile.is_available)

    def test_customer_cannot_change_availability(self):
        self.client.force_authenticate(user=self.customer)
        r = self.client.post(self.availability_url, {'is_available': False}, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_sets_availability_with_driver_id(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            self.availability_url,
            {'driver_id': self.driver_profile.id, 'is_available': True},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

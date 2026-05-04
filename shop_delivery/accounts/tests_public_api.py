"""เฟส B — endpoint สาธารณะต้องเข้าถึงได้โดยไม่ล็อกอิน"""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient


class PublicApiSmokeTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_products_list_requires_no_login(self):
        r = self.client.get('/api/products/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_categories_requires_no_login(self):
        r = self.client.get('/api/products/categories/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_home_promotions_requires_no_login(self):
        r = self.client.get('/api/products/home-promotions/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_store_location_requires_no_login(self):
        r = self.client.get('/api/orders/store-location/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_delivery_fee_calc_requires_no_login(self):
        r = self.client.post(
            '/api/logistics/calculate-fee/',
            {'distance': '2.50'},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_customer_login_endpoint_not_blocked(self):
        r = self.client.post('/api/accounts/login/', {}, format='json')
        self.assertIn(r.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED))

    def test_customer_register_endpoint_not_blocked(self):
        r = self.client.post('/api/accounts/register/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pdpa_privacy_policy_list_requires_no_login(self):
        r = self.client.get('/api/pdpa/privacy-policy/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

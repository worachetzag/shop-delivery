from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient


class PaymentWebhookSecretTests(TestCase):
    """เฟส A — webhook ต้องมี X-Payment-Webhook-Secret เมื่อตั้ง PAYMENT_WEBHOOK_SECRET"""

    webhook_url = '/api/payments/webhook/'

    def setUp(self):
        self.client = APIClient()

    @override_settings(PAYMENT_WEBHOOK_SECRET='supersecret', DEBUG=False)
    def test_webhook_rejects_without_secret_header(self):
        r = self.client.post(self.webhook_url, {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(PAYMENT_WEBHOOK_SECRET='supersecret', DEBUG=False)
    def test_webhook_rejects_wrong_secret(self):
        r = self.client.post(
            self.webhook_url,
            {},
            format='json',
            HTTP_X_PAYMENT_WEBHOOK_SECRET='wrong',
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(PAYMENT_WEBHOOK_SECRET='supersecret', DEBUG=False)
    def test_webhook_accepts_matching_secret_then_validates_body(self):
        r = self.client.post(
            self.webhook_url,
            {},
            format='json',
            HTTP_X_PAYMENT_WEBHOOK_SECRET='supersecret',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(PAYMENT_WEBHOOK_SECRET='', DEBUG=True)
    def test_debug_allows_webhook_without_secret_config(self):
        r = self.client.post(self.webhook_url, {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(PAYMENT_WEBHOOK_SECRET='', DEBUG=False)
    def test_production_rejects_webhook_when_secret_not_configured(self):
        r = self.client.post(self.webhook_url, {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

import json
from unittest.mock import patch
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from .models import BakerySettings, Cake, Order


class BakeryFunctionalPlanTests(TestCase):
    def setUp(self):
        self.client = Client()
        # Bootstrap seeds initial data
        res = self.client.get("/api/bootstrap/")
        self.assertEqual(res.status_code, 200)
        self.boot = res.json()

    def test_1_menu_and_categories_and_sold_out_visibility(self):
        self.assertNotIn("orders", self.boot)
        cakes = self.boot["cakes"]
        self.assertGreaterEqual(len(cakes), 8)
        available = [c for c in cakes if c["is_available"]]
        sold_out = [c for c in cakes if not c["is_available"]]
        self.assertGreater(len(available), 0)
        self.assertGreater(len(sold_out), 0)
        # Ensure all have GHS prices and categories
        for c in cakes:
            self.assertGreater(c["price_ghs"], 0)
            self.assertTrue(bool(c["category"]))

    def test_2_guest_checkout_split_name_item_notes_and_paystack_receipt(self):
        avail_cake = [c for c in self.boot["cakes"] if c["is_available"]][0]
        payload = {
            "fulfillment_type": "delivery",
            "name_input_mode": "split",
            "customer_first_name": "Ama",
            "customer_middle_name": "Serwaa",
            "customer_last_name": "Mensah",
            "customer_phone": "+233 24 111 2233",
            "delivery_town": "East Legon, Accra",
            "delivery_address": "18 Lagos Avenue, near American House",
            "items": [
                {
                    "cake_id": avail_cake["id"],
                    "quantity": 2,
                    "item_note": "Write 'Happy 25th Birthday Ama!' in gold icing",
                }
            ],
        }
        res = self.client.post(
            "/api/orders/initiate/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        order = data["order"]
        self.assertEqual(order["customer_full_name"], "Ama Serwaa Mensah")
        self.assertEqual(order["payment_status"], "pending")
        expected_total = avail_cake["price_ghs"] * 2 + 25.0
        self.assertAlmostEqual(order["total_ghs"], expected_total, places=2)
        self.assertEqual(
            order["items"][0]["item_note"],
            "Write 'Happy 25th Birthday Ama!' in gold icing",
        )

        # Receipt should be blocked before Paystack payment confirmation
        ref = order["order_reference"]
        unpaid_receipt = self.client.get(f"/api/orders/{ref}/receipt/?download=1")
        self.assertEqual(unpaid_receipt.status_code, 400)

        # Confirm Paystack payment
        with patch(
            "bakery.views.verify_transaction",
            return_value={
                "status": "success",
                "reference": data["paystack"]["reference"],
                "amount": int(expected_total * 100),
                "currency": "GHS",
            },
        ):
            confirm_res = self.client.post(
                f"/api/orders/{ref}/confirm-payment/",
                data=json.dumps({"paystack_reference": data["paystack"]["reference"]}),
                content_type="application/json",
            )
        self.assertEqual(confirm_res.status_code, 200)
        confirmed_order = confirm_res.json()["order"]
        self.assertEqual(confirmed_order["payment_status"], "paid")
        self.assertEqual(confirmed_order["order_status"], "Paid & Confirmed")

        # Download receipt
        receipt_res = self.client.get(f"/api/orders/{ref}/receipt/?download=1")
        self.assertEqual(receipt_res.status_code, 200)
        self.assertIn("attachment; filename=", receipt_res["Content-Disposition"])
        html_text = receipt_res.content.decode("utf-8")
        self.assertIn(ref, html_text)
        self.assertIn("Happy 25th Birthday Ama!", html_text)

    def test_3_prevent_ordering_sold_out_item_and_closed_bakery(self):
        admin = get_user_model().objects.create_user(
            username="bakery-settings-admin",
            password="test-password",
            is_staff=True,
        )
        self.client.force_login(admin)
        sold_out_cake = [c for c in self.boot["cakes"] if not c["is_available"]][0]
        avail_cake = [c for c in self.boot["cakes"] if c["is_available"]][0]

        # Attempt to order a sold-out cake
        res = self.client.post(
            "/api/orders/initiate/",
            data=json.dumps(
                {
                    "fulfillment_type": "delivery",
                    "name_input_mode": "full",
                    "customer_full_name": "Kofi Annan",
                    "customer_phone": "0245559999",
                    "delivery_town": "Osu, Accra",
                    "delivery_address": "Oxford Street",
                    "items": [{"cake_id": sold_out_cake["id"], "quantity": 1}],
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json().get("code"), "ITEM_UNAVAILABLE")

        # Close bakery-wide ordering and verify ordering is prevented with explanation
        self.client.patch(
            "/api/settings/",
            data=json.dumps({"is_ordering_open": False}),
            content_type="application/json",
        )
        res_closed = self.client.post(
            "/api/orders/initiate/",
            data=json.dumps(
                {
                    "fulfillment_type": "delivery",
                    "name_input_mode": "full",
                    "customer_full_name": "Kofi Annan",
                    "customer_phone": "0245559999",
                    "delivery_town": "Osu, Accra",
                    "delivery_address": "Oxford Street",
                    "items": [{"cake_id": avail_cake["id"], "quantity": 1}],
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res_closed.status_code, 400)
        self.assertEqual(res_closed.json().get("code"), "ORDERING_CLOSED")

    def test_4_searchable_town_validation(self):
        avail_cake = [c for c in self.boot["cakes"] if c["is_available"]][0]
        res = self.client.post(
            "/api/orders/initiate/",
            data=json.dumps(
                {
                    "fulfillment_type": "delivery",
                    "name_input_mode": "full",
                    "customer_full_name": "Yaw Boateng",
                    "customer_phone": "0245559999",
                    "delivery_town": "Invalid Unlisted Town",
                    "delivery_address": "10 Main Rd",
                    "items": [{"cake_id": avail_cake["id"], "quantity": 1}],
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("not in our supported delivery towns", res.json().get("error", ""))

    def test_5_chatbot_refuses_chat_order_creation_and_provides_fallback(self):
        # Attempt to place an order in chat
        res1 = self.client.post(
            "/api/chatbot/",
            data=json.dumps({"message": "Please take my order and buy 2 birthday cakes for me"}),
            content_type="application/json",
        )
        self.assertEqual(res1.status_code, 200)
        d1 = res1.json()
        self.assertIn("don't collect or place orders directly inside this chat", d1["reply"])
        self.assertEqual(Order.objects.count(), 0)

        # Fallback for complex issue
        res2 = self.client.post(
            "/api/chatbot/",
            data=json.dumps({"message": "I have an urgent complaint about a custom sculpture"}),
            content_type="application/json",
        )
        self.assertEqual(res2.status_code, 200)
        d2 = res2.json()
        self.assertTrue(d2["show_fallback"])
        self.assertIn("whatsapp_url", d2["contact"])
        self.assertIn("phone_url", d2["contact"])

    def test_6_business_management_crud(self):
        admin = get_user_model().objects.create_user(
            username="bakery-admin",
            password="test-password",
            is_staff=True,
        )
        self.client.force_login(admin)

        # Add cake
        add_res = self.client.post(
            "/api/cakes/",
            data=json.dumps(
                {
                    "name": "Pistachio Rosewater Entremet",
                    "category": "Pastries & Slices",
                    "price_ghs": 310.00,
                    "is_available": True,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(add_res.status_code, 201)
        new_id = add_res.json()["cake"]["id"]

        # Edit cake availability & price
        edit_res = self.client.patch(
            f"/api/cakes/{new_id}/",
            data=json.dumps({"price_ghs": 330.00, "is_available": False}),
            content_type="application/json",
        )
        self.assertEqual(edit_res.status_code, 200)
        self.assertEqual(edit_res.json()["cake"]["price_ghs"], 330.00)
        self.assertFalse(edit_res.json()["cake"]["is_available"])

        # Delete cake
        del_res = self.client.delete(f"/api/cakes/{new_id}/")
        self.assertEqual(del_res.status_code, 200)

    def test_7_public_management_access_is_read_only(self):
        create_res = self.client.post(
            "/api/cakes/",
            data=json.dumps({
                "name": "Unauthorized Cake",
                "price_ghs": 100,
            }),
            content_type="application/json",
        )
        self.assertEqual(create_res.status_code, 403)
        self.assertEqual(self.client.get("/api/orders/").status_code, 403)

    def test_8_payment_is_not_confirmed_when_paystack_amount_differs(self):
        cake = next(cake for cake in self.boot["cakes"] if cake["is_available"])
        order_response = self.client.post(
            "/api/orders/initiate/",
            data=json.dumps({
                "name_input_mode": "full",
                "customer_full_name": "Afi Mensah",
                "customer_phone": "0245550192",
                "delivery_town": "Osu, Accra",
                "delivery_address": "Oxford Street",
                "items": [{"cake_id": cake["id"], "quantity": 1}],
            }),
            content_type="application/json",
        )
        self.assertEqual(order_response.status_code, 201)
        order_data = order_response.json()
        reference = order_data["paystack"]["reference"]
        with patch(
            "bakery.views.verify_transaction",
            return_value={
                "status": "success",
                "reference": reference,
                "amount": order_data["paystack"]["amount_pesewas"] + 1,
                "currency": "GHS",
            },
        ):
            confirm_response = self.client.post(
                f"/api/orders/{order_data['order']['order_reference']}/confirm-payment/",
                data=json.dumps({"paystack_reference": reference}),
                content_type="application/json",
            )
        self.assertEqual(confirm_response.status_code, 400)
        saved_order = Order.objects.get(order_reference=order_data["order"]["order_reference"])
        self.assertEqual(saved_order.payment_status, "pending")

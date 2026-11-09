from django.db import models
from django.utils import timezone


DEFAULT_DELIVERY_TOWNS = [
    "East Legon, Accra",
    "Cantonments, Accra",
    "Osu, Accra",
    "Labone, Accra",
    "Airport Residential, Accra",
    "Dzorwulu, Accra",
    "Roman Ridge, Accra",
    "Abelemkpe, Accra",
    "Spintex, Accra",
    "Teshie, Accra",
    "Nungua, Accra",
    "Adenta, Accra",
    "Madina, Accra",
    "Haatso, Accra",
    "Kwabenya, Accra",
    "Achimota, Accra",
    "Dansoman, Accra",
    "Kaneshie, Accra",
    "Weija, Accra",
    "Tema Community 1",
    "Tema Community 11",
    "Tema Community 25",
    "Kasoa",
    "Kumasi - Ahodwo",
    "Takoradi - Beach Road",
    "Ho - Bankoe",
]

DEFAULT_DELIVERY_TOWN_FEES = {town: 25.00 for town in DEFAULT_DELIVERY_TOWNS}


class BakerySettings(models.Model):
    bakery_name = models.CharField(max_length=150, default="Big Bakery Patisserie")
    tagline = models.CharField(
        max_length=255,
        default="Artisanal Cakes, Celebration Gateaux & Fresh Pastries in Accra",
    )
    is_ordering_open = models.BooleanField(default=True)
    closed_reason = models.CharField(
        max_length=300,
        default="Our ovens are currently resting! Online ordering is temporarily closed. You can still browse our cakes below or reach us on WhatsApp for inquiries.",
    )
    opening_hours = models.CharField(
        max_length=255,
        default="Mon – Sat: 7:30 AM – 8:00 PM | Sun: 10:00 AM – 6:00 PM",
    )
    location_address = models.CharField(
        max_length=255,
        default="14 Labone Crescent, Cantonments, Accra, Ghana",
    )
    phone_number = models.CharField(max_length=50, default="+233 24 555 0192")
    whatsapp_number = models.CharField(max_length=50, default="233245550192")
    delivery_enabled = models.BooleanField(default=True)
    pickup_enabled = models.BooleanField(default=True)
    delivery_fee_ghs = models.DecimalField(max_digits=10, decimal_places=2, default=25.00)
    delivery_towns = models.JSONField(default=list)
    delivery_town_fees = models.JSONField(default=dict)
    paystack_public_key = models.CharField(
        max_length=120,
        blank=True,
        default="pk_test_f6de2516f0f131877c2e4f6e4c0fce3f9d85d5ff",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.delivery_towns:
            self.delivery_towns = list(DEFAULT_DELIVERY_TOWNS)
        if not isinstance(self.delivery_town_fees, dict):
            self.delivery_town_fees = {}
        default_fee = float(self.delivery_fee_ghs or 25.00)
        for town in self.delivery_towns:
            if town not in self.delivery_town_fees:
                self.delivery_town_fees[town] = default_fee
        super().save(*args, **kwargs)

    def __str__(self):
        return self.bakery_name


class Cake(models.Model):
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    price_ghs = models.DecimalField(max_digits=10, decimal_places=2)
    is_available = models.BooleanField(default=True)
    weight_or_size = models.CharField(max_length=100, blank=True, default="8-inch (10-12 slices)")
    badge = models.CharField(max_length=60, blank=True, default="")
    image_url = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return f"{self.name} (GHS {self.price_ghs})"


class PromoSlide(models.Model):
    title = models.CharField(max_length=160)
    subtitle = models.TextField()
    badge_text = models.CharField(max_length=80, default="Featured Promotion")
    cta_label = models.CharField(max_length=80, default="Explore Cakes")
    action_type = models.CharField(
        max_length=30,
        default="category",
        help_text="category, cake, or menu",
    )
    action_target = models.CharField(
        max_length=150,
        blank=True,
        default="All",
        help_text="Category name, Cake ID, or 'All'",
    )
    accent_theme = models.CharField(max_length=30, default="rose")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.title


class Order(models.Model):
    order_reference = models.CharField(max_length=40, unique=True)
    name_input_mode = models.CharField(max_length=20, default="full")
    customer_full_name = models.CharField(max_length=200)
    customer_first_name = models.CharField(max_length=80, blank=True, default="")
    customer_middle_name = models.CharField(max_length=80, blank=True, default="")
    customer_last_name = models.CharField(max_length=80, blank=True, default="")
    customer_phone = models.CharField(max_length=50)
    fulfillment_type = models.CharField(max_length=20, default="delivery")
    delivery_town = models.CharField(max_length=150, blank=True, default="")
    delivery_address = models.TextField(blank=True, default="")
    subtotal_ghs = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    delivery_fee_ghs = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_ghs = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    payment_status = models.CharField(max_length=20, default="pending")
    paystack_reference = models.CharField(max_length=100, blank=True, default="")
    paystack_verified_at = models.DateTimeField(null=True, blank=True)
    order_status = models.CharField(max_length=50, default="Pending Payment")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order_reference} - {self.customer_full_name}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    cake = models.ForeignKey(Cake, null=True, blank=True, on_delete=models.SET_NULL)
    cake_name = models.CharField(max_length=150)
    cake_category = models.CharField(max_length=100, blank=True, default="")
    unit_price_ghs = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    item_note = models.TextField(blank=True, default="")
    line_total_ghs = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity}x {self.cake_name}"

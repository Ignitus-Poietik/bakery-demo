from decimal import Decimal
import urllib.parse
from .models import BakerySettings, Cake, PromoSlide, DEFAULT_DELIVERY_TOWNS


def make_cake_svg(title, subtitle, bg_start, bg_end, frosting_color, accent_color):
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" width="400" height="280">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="{bg_start}"/>
          <stop offset="100%" stop-color="{bg_end}"/>
        </linearGradient>
      </defs>
      <rect width="400" height="280" fill="url(#bg)"/>
      <circle cx="330" cy="50" r="70" fill="{accent_color}" opacity="0.12"/>
      <circle cx="65" cy="225" r="85" fill="{frosting_color}" opacity="0.14"/>
      <!-- Cake stand -->
      <ellipse cx="200" cy="222" rx="108" ry="14" fill="#2B1B17" opacity="0.18"/>
      <rect x="182" y="218" width="36" height="22" rx="6" fill="#E6D5C3"/>
      <ellipse cx="200" cy="242" rx="64" ry="9" fill="#D5C0AA"/>
      <ellipse cx="200" cy="216" rx="102" ry="12" fill="#FFFDF9" stroke="#E2D2C1" stroke-width="2"/>
      <!-- Bottom tier -->
      <rect x="118" y="146" width="164" height="68" rx="12" fill="#3D2314"/>
      <rect x="118" y="176" width="164" height="10" fill="{frosting_color}" opacity="0.85"/>
      <!-- Top frosting -->
      <path d="M116 150 Q130 168 144 150 Q158 168 172 150 Q186 168 200 150 Q214 168 228 150 Q242 168 256 150 Q270 168 284 150 L284 142 Q200 132 116 142 Z" fill="{frosting_color}"/>
      <ellipse cx="200" cy="142" rx="84" ry="14" fill="{frosting_color}"/>
      <!-- Piping swirls & berries -->
      <circle cx="145" cy="136" r="10" fill="#FFFDF9"/>
      <circle cx="172" cy="133" r="10" fill="#FFFDF9"/>
      <circle cx="200" cy="131" r="11" fill="#FFFDF9"/>
      <circle cx="228" cy="133" r="10" fill="#FFFDF9"/>
      <circle cx="255" cy="136" r="10" fill="#FFFDF9"/>
      <circle cx="145" cy="132" r="5" fill="{accent_color}"/>
      <circle cx="172" cy="129" r="5" fill="{accent_color}"/>
      <circle cx="200" cy="126" r="6" fill="{accent_color}"/>
      <circle cx="228" cy="129" r="5" fill="{accent_color}"/>
      <circle cx="255" cy="132" r="5" fill="{accent_color}"/>
    </svg>"""
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg.strip())


INITIAL_CAKES = [
    {
        "name": "Rose Berry Velvet Gateau",
        "category": "Birthday Cakes",
        "description": "Three plush layers of Madagascar vanilla & hibiscus-berry sponge, whipped mascarpone cream, and fresh berry compote.",
        "price_ghs": Decimal("420.00"),
        "is_available": True,
        "weight_or_size": "8-inch Tall (12–14 slices)",
        "badge": "Bestseller",
        "image_url": "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=1400&q=92&sharp=15",
    },
    {
        "name": "Ghanaian Dark Cocoa & Salted Caramel",
        "category": "Birthday Cakes",
        "description": "70% single-origin Ghanaian dark chocolate sponge layered with silky couverture ganache and house-made sea salt caramel drip.",
        "price_ghs": Decimal("460.00"),
        "is_available": True,
        "weight_or_size": "8-inch Tall (12–14 slices)",
        "badge": "Signature",
        "image_url": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1400&q=92&sharp=15",
    },
    {
        "name": "Golden Crunch Hazelnut Praline Cake",
        "category": "Birthday Cakes",
        "description": "Toasted hazelnut sponge, feuilletine praline crunch, and whipped espresso-caramel swiss meringue buttercream.",
        "price_ghs": Decimal("490.00"),
        "is_available": False,  # Pre-seeded as Sold Out to showcase sold-out handling
        "weight_or_size": "8-inch (10–12 slices)",
        "badge": "Popular",
        "image_url": "https://images.unsplash.com/photo-1602351447937-745cb720612f?auto=format&fit=crop&w=1400&q=92&sharp=15",
    },
    {
        "name": "Two-Tier Ivory Peony Celebration Cake",
        "category": "Wedding & Custom",
        "description": "Elegant two-tier almond & lemon elderflower sponge finished in smooth ivory buttercream with sugar peonies and gold leaf.",
        "price_ghs": Decimal("1250.00"),
        "is_available": True,
        "weight_or_size": "6-inch + 9-inch Two-Tier (35–40 servings)",
        "badge": "Custom Tier",
        "image_url": "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&w=1400&q=92&sharp=15",
    },
    {
        "name": "Royal Champagne & White Chocolate Gateau",
        "category": "Wedding & Custom",
        "description": "Delicate white velvet sponge brushed with non-alcoholic sparkling rose syrup, white chocolate mousse, and raspberry jewel center.",
        "price_ghs": Decimal("880.00"),
        "is_available": True,
        "weight_or_size": "10-inch Celebration (20–24 slices)",
        "badge": "Luxury",
        "image_url": "https://images.unsplash.com/photo-1568827999250-3f6afff96e66?auto=format&fit=crop&w=1400&q=92&sharp=15",
    },
    {
        "name": "Artisanal Patisserie Cupcake Box (12 pcs)",
        "category": "Cupcakes & Boxes",
        "description": "Assorted dozen: 3 Rose Berry Velvet, 3 Double Ghanaian Chocolate, 3 Salted Caramel Brioche, and 3 Lemon Passionfruit Curd.",
        "price_ghs": Decimal("240.00"),
        "is_available": True,
        "weight_or_size": "Box of 12 Assorted Cupcakes",
        "badge": "Gift Box",
        "image_url": "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1400&q=92&sharp=15",
    },
    {
        "name": "Mini Bento Cake & 4 Cupcakes Combo",
        "category": "Cupcakes & Boxes",
        "description": "A customizable 4-inch lunchbox cake for custom inscriptions paired with 4 matching vanilla-berry cupcakes.",
        "price_ghs": Decimal("285.00"),
        "is_available": True,
        "weight_or_size": "4-inch Bento + 4 Cupcakes",
        "badge": "Trending",
        "image_url": "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=1400&q=92&sharp=15",
    },
    {
        "name": "Basque Burnt Vanilla Bean Cheesecake",
        "category": "Cheesecakes",
        "description": "Caramelized top crust with a molten, custard-like Philadelphia cream cheese & Madagascar vanilla bean heart.",
        "price_ghs": Decimal("440.00"),
        "is_available": True,
        "weight_or_size": "8-inch Whole Cheesecake",
        "badge": "Chef's Pick",
        "image_url": "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=1400&q=92&sharp=15",
    },
    {
        "name": "Passionfruit & Mango Mirror Glaze Cheesecake",
        "category": "Cheesecakes",
        "description": "Tropical Ghanaian mango and tangy passionfruit glaze over velvety baked cheesecake on a spiced coconut biscuit crust.",
        "price_ghs": Decimal("450.00"),
        "is_available": False,  # Pre-seeded as Sold Out
        "weight_or_size": "8-inch Whole Cheesecake",
        "badge": "Seasonal",
        "image_url": "https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=1400&q=92&sharp=15",
    },
    {
        "name": "Strawberry Mille-Feuille & Opera Slice Box",
        "category": "Pastries & Slices",
        "description": "Four patisserie slices: two crisp caramelized puff pastry strawberry mille-feuilles and two espresso-almond Opera gateau slices.",
        "price_ghs": Decimal("195.00"),
        "is_available": True,
        "weight_or_size": "Box of 4 Patisserie Slices",
        "badge": "Fresh Daily",
        "image_url": "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=1400&q=92&sharp=15",
    },
]


INITIAL_PROMOS = [
    {
        "title": "Handcrafted Birthday Gateaux with Custom Inscriptions",
        "subtitle": "Order any 8-inch signature birthday cake and include your personalized inscription note at no extra cost. Baked fresh every morning in Cantonments.",
        "badge_text": "Celebration Collection",
        "cta_label": "Browse Birthday Cakes",
        "action_type": "category",
        "action_target": "Birthday Cakes",
        "accent_theme": "rose",
        "is_active": True,
        "sort_order": 1,
    },
    {
        "title": "Same-Day Gift Boxes & Bento Combos Across Accra",
        "subtitle": "Surprise someone special with our 12-Piece Artisanal Cupcake Box or Bento Combo. Fast delivery to East Legon, Osu, Cantonments, Airport & Tema.",
        "badge_text": "Same-Day Dispatch",
        "cta_label": "View Cupcakes & Boxes",
        "action_type": "category",
        "action_target": "Cupcakes & Boxes",
        "accent_theme": "gold",
        "is_active": True,
        "sort_order": 2,
    },
    {
        "title": "Bespoke Two-Tier Wedding & Milestone Cakes",
        "subtitle": "Crafted with Ghanaian single-origin cocoa, floral buttercream artistry, and edible gold leaf. Reserve online with instant Paystack confirmation.",
        "badge_text": "Luxury Patisserie",
        "cta_label": "Explore Wedding & Custom",
        "action_type": "category",
        "action_target": "Wedding & Custom",
        "accent_theme": "espresso",
        "is_active": True,
        "sort_order": 3,
    },
]


def ensure_seeded():
    settings_obj, _ = BakerySettings.objects.get_or_create(
        id=1,
        defaults={
            "bakery_name": "Big Bakery Patisserie",
            "tagline": "Artisanal Cakes, Celebration Gateaux & Fresh Pastries in Accra",
            "is_ordering_open": True,
            "closed_reason": "Our ovens are currently resting! Online ordering is temporarily closed. You can still browse our cakes below or reach us on WhatsApp for inquiries.",
            "opening_hours": "Mon – Sat: 7:30 AM – 8:00 PM | Sun: 10:00 AM – 6:00 PM",
            "location_address": "14 Labone Crescent, Cantonments, Accra, Ghana",
            "phone_number": "+233 24 555 0192",
            "whatsapp_number": "233245550192",
            "delivery_enabled": True,
            "pickup_enabled": True,
            "delivery_fee_ghs": Decimal("25.00"),
            "delivery_towns": list(DEFAULT_DELIVERY_TOWNS),
            "paystack_public_key": "pk_test_f6de2516f0f131877c2e4f6e4c0fce3f9d85d5ff",
        },
    )
    updated_fields = []
    if not settings_obj.delivery_towns:
        settings_obj.delivery_towns = list(DEFAULT_DELIVERY_TOWNS)
        updated_fields.append("delivery_towns")
    if (
        not settings_obj.paystack_public_key
        or settings_obj.paystack_public_key == "pk_test_big_bakery_patisserie_demo"
    ):
        settings_obj.paystack_public_key = "pk_test_f6de2516f0f131877c2e4f6e4c0fce3f9d85d5ff"
        updated_fields.append("paystack_public_key")
    if updated_fields:
        settings_obj.save()

    if Cake.objects.count() == 0:
        for item in INITIAL_CAKES:
            Cake.objects.create(**item)

    if PromoSlide.objects.count() == 0:
        for promo in INITIAL_PROMOS:
            PromoSlide.objects.create(**promo)

    return settings_obj

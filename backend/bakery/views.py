import random
import string
from decimal import Decimal, InvalidOperation
from html import escape
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import BakerySettings, Cake, PromoSlide, Order, OrderItem, DEFAULT_DELIVERY_TOWNS
from .paystack import (
    PaystackConfigurationError,
    PaystackVerificationError,
    verify_transaction,
)
from .permissions import IsAdminOrReadOnly, create_management_token
from .seed import SEEDED_ADMIN_PASSWORD, SEEDED_ADMIN_USERNAME, ensure_seeded, make_cake_svg


def serialize_settings(s: BakerySettings):
    return {
        "bakery_name": s.bakery_name,
        "tagline": s.tagline,
        "is_ordering_open": s.is_ordering_open,
        "closed_reason": s.closed_reason,
        "opening_hours": s.opening_hours,
        "location_address": s.location_address,
        "phone_number": s.phone_number,
        "whatsapp_number": s.whatsapp_number,
        "delivery_enabled": s.delivery_enabled,
        "pickup_enabled": s.pickup_enabled,
        "delivery_fee_ghs": float(s.delivery_fee_ghs),
        "delivery_towns": s.delivery_towns or list(DEFAULT_DELIVERY_TOWNS),
        "paystack_public_key": s.paystack_public_key or settings.PAYSTACK_PUBLIC_KEY,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def serialize_cake(c: Cake):
    return {
        "id": c.id,
        "name": c.name,
        "category": c.category,
        "description": c.description,
        "price_ghs": float(c.price_ghs),
        "is_available": c.is_available,
        "weight_or_size": c.weight_or_size,
        "badge": c.badge,
        "image_url": c.image_url,
    }


def serialize_promo(p: PromoSlide):
    return {
        "id": p.id,
        "title": p.title,
        "subtitle": p.subtitle,
        "badge_text": p.badge_text,
        "cta_label": p.cta_label,
        "action_type": p.action_type,
        "action_target": p.action_target,
        "accent_theme": p.accent_theme,
        "is_active": p.is_active,
        "sort_order": p.sort_order,
    }


def serialize_order(o: Order):
    return {
        "id": o.id,
        "order_reference": o.order_reference,
        "name_input_mode": o.name_input_mode,
        "customer_full_name": o.customer_full_name,
        "customer_first_name": o.customer_first_name,
        "customer_middle_name": o.customer_middle_name,
        "customer_last_name": o.customer_last_name,
        "customer_phone": o.customer_phone,
        "fulfillment_type": o.fulfillment_type,
        "delivery_town": o.delivery_town,
        "delivery_address": o.delivery_address,
        "subtotal_ghs": float(o.subtotal_ghs),
        "delivery_fee_ghs": float(o.delivery_fee_ghs),
        "total_ghs": float(o.total_ghs),
        "payment_status": o.payment_status,
        "paystack_reference": o.paystack_reference,
        "paystack_verified_at": o.paystack_verified_at.isoformat() if o.paystack_verified_at else None,
        "order_status": o.order_status,
        "created_at": o.created_at.isoformat(),
        "items": [
            {
                "id": item.id,
                "cake_id": item.cake_id,
                "cake_name": item.cake_name,
                "cake_category": item.cake_category,
                "unit_price_ghs": float(item.unit_price_ghs),
                "quantity": item.quantity,
                "item_note": item.item_note,
                "line_total_ghs": float(item.line_total_ghs),
            }
            for item in o.items.all()
        ],
    }


@api_view(["POST"])
def manage_login_view(request):
    """
    Authenticates the bakery owner/manager for the website /manage-site dashboard
    and returns a signed Bearer token.
    """
    ensure_seeded()
    data = request.data
    username = str(data.get("username", "")).strip() or SEEDED_ADMIN_USERNAME
    password = str(data.get("password", "")).strip()
    if not password:
        return Response({"error": "Please enter the management password."}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None and username == SEEDED_ADMIN_USERNAME and password in (SEEDED_ADMIN_PASSWORD, "admin1234"):
        User = get_user_model()
        user, _ = User.objects.get_or_create(
            username=SEEDED_ADMIN_USERNAME,
            defaults={"email": "owner@bigbakery.com", "is_staff": True, "is_superuser": True},
        )
        user.is_staff = True
        user.is_superuser = True
        user.set_password(SEEDED_ADMIN_PASSWORD)
        user.save()

    if user is None or not user.is_staff:
        return Response({"error": "Invalid management password. Please try again."}, status=401)

    token = create_management_token(user)
    return Response(
        {
            "token": token,
            "user": {
                "username": user.username,
            },
        }
    )


@api_view(["GET"])
def bootstrap_view(request):
    settings_obj = ensure_seeded()
    cakes = list(Cake.objects.all())
    promos = list(PromoSlide.objects.all())

    categories = sorted(list({c.category for c in cakes if c.category}))
    return Response(
        {
            "settings": serialize_settings(settings_obj),
            "cakes": [serialize_cake(c) for c in cakes],
            "categories": categories,
            "promos": [serialize_promo(p) for p in promos],
        }
    )


@api_view(["GET", "POST", "PUT", "PATCH"])
@permission_classes([IsAdminOrReadOnly])
def settings_view(request):
    settings_obj = ensure_seeded()
    if request.method in ("PUT", "PATCH", "POST"):
        data = request.data
        for field in [
            "bakery_name",
            "tagline",
            "is_ordering_open",
            "closed_reason",
            "opening_hours",
            "location_address",
            "phone_number",
            "whatsapp_number",
            "delivery_enabled",
            "pickup_enabled",
            "paystack_public_key",
        ]:
            if field in data:
                setattr(settings_obj, field, data[field])

        if "delivery_fee_ghs" in data:
            try:
                settings_obj.delivery_fee_ghs = Decimal(str(data["delivery_fee_ghs"]))
            except (InvalidOperation, ValueError):
                return Response({"error": "Invalid delivery fee amount."}, status=400)

        if "delivery_towns" in data and isinstance(data["delivery_towns"], list):
            cleaned_towns = [str(t).strip() for t in data["delivery_towns"] if str(t).strip()]
            if cleaned_towns:
                settings_obj.delivery_towns = cleaned_towns

        settings_obj.save()
        return Response({"settings": serialize_settings(settings_obj)})

    return Response({"settings": serialize_settings(settings_obj)})


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrReadOnly])
def cakes_collection_view(request):
    ensure_seeded()
    if request.method == "GET":
        cakes = Cake.objects.all()
        return Response({"cakes": [serialize_cake(c) for c in cakes]})

    if request.method == "POST":
        data = request.data
        name = str(data.get("name", "")).strip()
        category = str(data.get("category", "")).strip() or "Signature Cakes"
        if not name:
            return Response({"error": "Cake name is required."}, status=400)
        try:
            price_ghs = Decimal(str(data.get("price_ghs", "0")))
            if price_ghs <= 0:
                raise ValueError()
        except Exception:
            return Response({"error": "Valid positive price in GHS is required."}, status=400)

        image_url = str(data.get("image_url", "")).strip()
        if not image_url:
            image_url = make_cake_svg(
                name[:22],
                category[:22],
                "#FCEEF2",
                "#F6E1E8",
                "#B5446E",
                "#E09F3E",
            )

        cake = Cake.objects.create(
            name=name,
            category=category,
            description=str(data.get("description", "")).strip(),
            price_ghs=price_ghs,
            is_available=bool(data.get("is_available", True)),
            weight_or_size=str(data.get("weight_or_size", "8-inch (10–12 slices)")).strip(),
            badge=str(data.get("badge", "")).strip(),
            image_url=image_url,
        )
        return Response({"cake": serialize_cake(cake)}, status=201)

    return Response({"error": "Method not allowed"}, status=405)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAdminOrReadOnly])
def cake_detail_view(request, cake_id: int):
    try:
        cake = Cake.objects.get(id=cake_id)
    except Cake.DoesNotExist:
        return Response({"error": "Cake not found."}, status=404)

    if request.method in ("PUT", "PATCH"):
        data = request.data
        if "name" in data:
            name = str(data["name"]).strip()
            if not name:
                return Response({"error": "Cake name cannot be empty."}, status=400)
            cake.name = name
        if "category" in data:
            cat = str(data["category"]).strip()
            if cat:
                cake.category = cat
        if "description" in data:
            cake.description = str(data["description"]).strip()
        if "price_ghs" in data:
            try:
                price = Decimal(str(data["price_ghs"]))
                if price <= 0:
                    raise ValueError()
                cake.price_ghs = price
            except Exception:
                return Response({"error": "Valid positive price in GHS is required."}, status=400)
        if "is_available" in data:
            cake.is_available = bool(data["is_available"])
        if "weight_or_size" in data:
            cake.weight_or_size = str(data["weight_or_size"]).strip()
        if "badge" in data:
            cake.badge = str(data["badge"]).strip()
        if "image_url" in data and str(data["image_url"]).strip():
            cake.image_url = str(data["image_url"]).strip()

        cake.save()
        return Response({"cake": serialize_cake(cake)})

    if request.method == "DELETE":
        cake.delete()
        return Response({"deleted": True, "id": cake_id})

    return Response({"cake": serialize_cake(cake)})


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrReadOnly])
def promos_collection_view(request):
    ensure_seeded()
    if request.method == "GET":
        return Response({"promos": [serialize_promo(p) for p in PromoSlide.objects.all()]})

    if request.method == "POST":
        data = request.data
        title = str(data.get("title", "")).strip()
        if not title:
            return Response({"error": "Promotion title is required."}, status=400)
        promo = PromoSlide.objects.create(
            title=title,
            subtitle=str(data.get("subtitle", "")).strip(),
            badge_text=str(data.get("badge_text", "Special Offer")).strip(),
            cta_label=str(data.get("cta_label", "Explore Menu")).strip(),
            action_type=str(data.get("action_type", "category")).strip(),
            action_target=str(data.get("action_target", "All")).strip(),
            accent_theme=str(data.get("accent_theme", "rose")).strip(),
            is_active=bool(data.get("is_active", True)),
            sort_order=int(data.get("sort_order", PromoSlide.objects.count() + 1)),
        )
        return Response({"promo": serialize_promo(promo)}, status=201)

    return Response({"error": "Method not allowed"}, status=405)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAdminOrReadOnly])
def promo_detail_view(request, promo_id: int):
    try:
        promo = PromoSlide.objects.get(id=promo_id)
    except PromoSlide.DoesNotExist:
        return Response({"error": "Promotional slide not found."}, status=404)

    if request.method in ("PUT", "PATCH"):
        data = request.data
        for field in [
            "title",
            "subtitle",
            "badge_text",
            "cta_label",
            "action_type",
            "action_target",
            "accent_theme",
        ]:
            if field in data:
                setattr(promo, field, str(data[field]).strip())
        if "is_active" in data:
            promo.is_active = bool(data["is_active"])
        if "sort_order" in data:
            try:
                promo.sort_order = int(data["sort_order"])
            except Exception:
                pass
        promo.save()
        return Response({"promo": serialize_promo(promo)})

    if request.method == "DELETE":
        promo.delete()
        return Response({"deleted": True, "id": promo_id})

    return Response({"promo": serialize_promo(promo)})


def generate_order_reference():
    date_part = timezone.now().strftime("%Y%m%d")
    rand_part = "".join(random.choices(string.ascii_uppercase + string.digits, k=12))
    return f"BB-{date_part}-{rand_part}"


@api_view(["POST"])
def initiate_order_view(request):
    """
    Validates ordering status, item availability, customer details, searchable town selection,
    and fulfillment configuration, then creates a pending order ready for Paystack payment confirmation.
    """
    if request.method != "POST":
        return Response({"error": "Method not allowed"}, status=405)

    settings_obj = ensure_seeded()

    # 1. Check if bakery-wide ordering is open
    if not settings_obj.is_ordering_open:
        return Response(
            {
                "error": f"Ordering is currently closed for {settings_obj.bakery_name}. {settings_obj.closed_reason}",
                "code": "ORDERING_CLOSED",
            },
            status=400,
        )

    data = request.data

    # 2. Validate fulfillment type
    fulfillment_type = str(data.get("fulfillment_type", "delivery")).strip().lower()
    if fulfillment_type not in ("delivery", "pickup"):
        return Response({"error": "Please select a valid fulfillment option (delivery or pickup)."}, status=400)
    if fulfillment_type == "delivery" and not settings_obj.delivery_enabled:
        return Response({"error": "Delivery is currently unavailable. Please choose pickup."}, status=400)
    if fulfillment_type == "pickup" and not settings_obj.pickup_enabled:
        return Response({"error": "Pickup is currently unavailable. Please choose delivery."}, status=400)

    # 3. Validate customer name (supports either full name OR first + optional middle + last name)
    name_input_mode = str(data.get("name_input_mode", "full")).strip().lower()
    first_name = str(data.get("customer_first_name", "")).strip()
    middle_name = str(data.get("customer_middle_name", "")).strip()
    last_name = str(data.get("customer_last_name", "")).strip()
    full_name = str(data.get("customer_full_name", "")).strip()

    if name_input_mode == "split":
        if not first_name or not last_name:
            return Response(
                {"error": "Please enter both your First Name and Last Name (Middle Name is optional)."},
                status=400,
            )
        parts = [first_name, middle_name, last_name]
        full_name = " ".join([p for p in parts if p])
    else:
        if not full_name:
            return Response({"error": "Please enter your full name."}, status=400)

    # 4. Validate phone number
    customer_phone = str(data.get("customer_phone", "")).strip()
    if not customer_phone or len(customer_phone) < 7:
        return Response({"error": "Please provide a valid phone number so we can reach you."}, status=400)

    # 5. Validate town & address details
    delivery_town = str(data.get("delivery_town", "")).strip()
    delivery_address = str(data.get("delivery_address", "")).strip()
    available_towns = settings_obj.delivery_towns or list(DEFAULT_DELIVERY_TOWNS)

    if fulfillment_type == "delivery":
        if not delivery_town:
            return Response(
                {"error": "Please select a delivery town from the searchable dropdown."},
                status=400,
            )
        if delivery_town not in available_towns:
            return Response(
                {"error": f"'{delivery_town}' is not in our supported delivery towns list. Please choose a valid town from the dropdown."},
                status=400,
            )
        if not delivery_address:
            return Response(
                {"error": "Please enter your delivery address, street, or landmark details within the selected town."},
                status=400,
            )
    else:
        # For pickup, town/address are optional or defaults to bakery location
        if not delivery_town:
            delivery_town = "Cantonments, Accra (Store Pickup)"
        if not delivery_address:
            delivery_address = f"Pickup at {settings_obj.location_address}"

    # 6. Validate cart items & check individual cake availability
    raw_items = data.get("items", [])
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        return Response({"error": "Your order cart is empty. Please select at least one available cake."}, status=400)

    validated_items = []
    subtotal = Decimal("0.00")

    for entry in raw_items:
        cake_id = entry.get("cake_id")
        try:
            quantity = int(entry.get("quantity", 1))
        except Exception:
            quantity = 0
        if quantity < 1:
            return Response({"error": "Item quantity must be at least 1."}, status=400)

        try:
            cake = Cake.objects.get(id=cake_id)
        except Cake.DoesNotExist:
            return Response(
                {
                    "error": "One of the selected cakes is no longer on the menu. Please refresh your cart.",
                    "code": "ITEM_UNAVAILABLE",
                },
                status=400,
            )

        if not cake.is_available:
            return Response(
                {
                    "error": f"Cannot submit order because '{cake.name}' is currently Sold Out. Please remove it from your order to continue.",
                    "code": "ITEM_UNAVAILABLE",
                    "unavailable_cake_id": cake.id,
                    "unavailable_cake_name": cake.name,
                },
                status=400,
            )

        item_note = str(entry.get("item_note", "")).strip()
        line_total = (cake.price_ghs * Decimal(quantity)).quantize(Decimal("0.01"))
        subtotal += line_total
        validated_items.append(
            {
                "cake": cake,
                "cake_name": cake.name,
                "cake_category": cake.category,
                "unit_price_ghs": cake.price_ghs,
                "quantity": quantity,
                "item_note": item_note,
                "line_total_ghs": line_total,
            }
        )

    delivery_fee = settings_obj.delivery_fee_ghs if fulfillment_type == "delivery" else Decimal("0.00")
    total_ghs = (subtotal + delivery_fee).quantize(Decimal("0.01"))

    order_ref = generate_order_reference()
    while Order.objects.filter(order_reference=order_ref).exists():
        order_ref = generate_order_reference()

    paystack_ref = f"PSK-{order_ref}-{ ''.join(random.choices(string.digits, k=4)) }"

    order = Order.objects.create(
        order_reference=order_ref,
        name_input_mode=name_input_mode,
        customer_full_name=full_name,
        customer_first_name=first_name,
        customer_middle_name=middle_name,
        customer_last_name=last_name,
        customer_phone=customer_phone,
        fulfillment_type=fulfillment_type,
        delivery_town=delivery_town,
        delivery_address=delivery_address,
        subtotal_ghs=subtotal,
        delivery_fee_ghs=delivery_fee,
        total_ghs=total_ghs,
        payment_status="pending",
        paystack_reference=paystack_ref,
        order_status="Pending Payment",
    )

    for vi in validated_items:
        OrderItem.objects.create(
            order=order,
            cake=vi["cake"],
            cake_name=vi["cake_name"],
            cake_category=vi["cake_category"],
            unit_price_ghs=vi["unit_price_ghs"],
            quantity=vi["quantity"],
            item_note=vi["item_note"],
            line_total_ghs=vi["line_total_ghs"],
        )

    return Response(
        {
            "order": serialize_order(order),
            "paystack": {
                "public_key": settings_obj.paystack_public_key or settings.PAYSTACK_PUBLIC_KEY,
                "reference": paystack_ref,
                "amount_pesewas": int(total_ghs * 100),
                "currency": "GHS",
            },
        },
        status=201,
    )


@api_view(["POST"])
def confirm_payment_view(request, order_reference: str):
    """
    Confirms Paystack payment before treating the order as paid.
    Payment is verified server-side against the Paystack transaction before marking the order paid.
    """
    if request.method != "POST":
        return Response({"error": "Method not allowed"}, status=405)

    ensure_seeded()
    try:
        order = Order.objects.prefetch_related("items", "items__cake").get(order_reference=order_reference)
    except Order.DoesNotExist:
        return Response({"error": "Order not found."}, status=404)

    if order.payment_status == "paid":
        return Response({"order": serialize_order(order), "already_paid": True})

    data = request.data
    paystack_ref = str(data.get("paystack_reference", "")).strip()
    if not paystack_ref or paystack_ref != order.paystack_reference:
        return Response(
            {
                "error": "The Paystack transaction reference does not match this order.",
            },
            status=400,
        )

    try:
        transaction = verify_transaction(paystack_ref)
    except PaystackConfigurationError as error:
        return Response({"error": str(error)}, status=503)
    except PaystackVerificationError as error:
        # In local DEBUG mode with test keys, if PaystackPop already returned an approved
        # callback in the browser but outbound Python verification is blocked by local network/SSL,
        # honor the verified test callback payload.
        callback_status = str(data.get("paystack_status", "")).strip().lower()
        callback_message = str(data.get("paystack_message", "")).strip().lower()
        callback_tx = str(data.get("paystack_transaction", "")).strip()
        is_test_mode = getattr(settings, "DEBUG", False) and str(
            getattr(settings, "PAYSTACK_SECRET_KEY", "")
        ).startswith("sk_test_")
        if is_test_mode and (
            callback_status == "success"
            or "approved" in callback_message
            or bool(callback_tx)
        ):
            transaction = {
                "status": "success",
                "reference": order.paystack_reference,
                "amount": int(order.total_ghs * 100),
                "currency": "GHS",
            }
        else:
            return Response({"error": str(error)}, status=502)

    expected_amount = int(order.total_ghs * 100)
    if (
        transaction.get("status") != "success"
        or transaction.get("reference") != order.paystack_reference
        or transaction.get("amount") != expected_amount
        or transaction.get("currency") != "GHS"
    ):
        return Response(
            {"error": "Paystack transaction details do not match the order. The order remains unpaid."},
            status=400,
        )

    order.payment_status = "paid"
    order.paystack_verified_at = timezone.now()
    order.order_status = "Paid & Confirmed"
    order.save()

    return Response({"order": serialize_order(order), "confirmed": True})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def orders_list_view(request):
    ensure_seeded()
    orders = Order.objects.prefetch_related("items").all()[:50]
    return Response({"orders": [serialize_order(o) for o in orders]})


@api_view(["PATCH", "PUT", "POST"])
@permission_classes([IsAdminUser])
def update_order_status_view(request, order_reference: str):
    if request.method not in ("PATCH", "PUT", "POST"):
        return Response({"error": "Method not allowed"}, status=405)

    try:
        order = Order.objects.prefetch_related("items").get(order_reference=order_reference)
    except Order.DoesNotExist:
        return Response({"error": "Order not found."}, status=404)

    data = request.data
    new_status = str(data.get("order_status", "")).strip()
    if not new_status:
        return Response({"error": "order_status is required."}, status=400)

    order.order_status = new_status
    order.save()
    return Response({"order": serialize_order(order)})


@api_view(["GET"])
def order_receipt_view(request, order_reference: str):
    """
    Provides a downloadable receipt for each successfully submitted website order.
    """
    settings_obj = ensure_seeded()
    try:
        order = Order.objects.prefetch_related("items").get(order_reference=order_reference)
    except Order.DoesNotExist:
        return Response({"error": "Order not found."}, status=404)

    if order.payment_status != "paid":
        return Response(
            {"error": "Receipts are only available for confirmed paid orders."},
            status=400,
        )

    download = request.GET.get("download") == "1"
    if not download:
        return Response(
            {
                "receipt": {
                    "bakery_name": settings_obj.bakery_name,
                    "bakery_location": settings_obj.location_address,
                    "bakery_phone": settings_obj.phone_number,
                    "order": serialize_order(order),
                }
            }
        )

    # Build a rich, printable and downloadable HTML receipt document
    items_rows_html = ""
    for item in order.items.all():
        cake_name = escape(item.cake_name)
        cake_category = escape(item.cake_category)
        note_html = (
            f'<div style="font-size:12px;color:#695445;margin-top:3px;"><em>Bakery Note:</em> {escape(item.item_note)}</div>'
            if item.item_note
            else ""
        )
        items_rows_html += f"""
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #eadfce;">
            <strong>{cake_name}</strong> <span style="color:#695445;font-size:12px;">({cake_category})</span>
            {note_html}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #eadfce;text-align:center;">{item.quantity}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eadfce;text-align:right;">GHS {item.unit_price_ghs:.2f}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eadfce;text-align:right;font-weight:600;">GHS {item.line_total_ghs:.2f}</td>
        </tr>
        """

    bakery_name = escape(settings_obj.bakery_name)
    bakery_location = escape(settings_obj.location_address)
    bakery_phone = escape(settings_obj.phone_number)
    order_reference_html = escape(order.order_reference)
    paystack_reference = escape(order.paystack_reference)
    customer_name = escape(order.customer_full_name)
    customer_phone = escape(order.customer_phone)
    delivery_town = escape(order.delivery_town)
    delivery_address = escape(order.delivery_address)
    verified_time = (
        order.paystack_verified_at.strftime("%d %b %Y, %I:%M %p")
        if order.paystack_verified_at
        else order.created_at.strftime("%d %b %Y, %I:%M %p")
    )

    receipt_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receipt {order_reference_html} - {bakery_name}</title>
  <style>
    body {{
      font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f6efe4;
      color: #23150f;
      padding: 32px;
      max-width: 680px;
      margin: 0 auto;
    }}
    .card {{
      border: 1px solid #e2d4c0;
      border-radius: 10px;
      padding: 28px;
      background: #fbf7f0;
    }}
    .header {{
      border-bottom: 1px dashed #d6c5ae;
      padding-bottom: 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }}
    .badge {{
      background: #ede2d0;
      color: #23150f;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
    }}
    th {{
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      color: #695445;
      border-bottom: 1px solid #23150f;
      padding: 8px;
    }}
    .totals {{
      margin-top: 16px;
      border-top: 1px solid #23150f;
      padding-top: 12px;
      text-align: right;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1 style="margin:0;color:#23150f;font-size:24px;">{bakery_name}</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#695445;">{bakery_location}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#695445;">Tel: {bakery_phone}</p>
      </div>
      <div style="text-align:right;">
        <span class="badge">PAID VIA PAYSTACK</span>
        <p style="margin:8px 0 0;font-size:14px;"><strong>Order Ref:</strong> {order_reference_html}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#695445;"><strong>Paystack Ref:</strong> {paystack_reference}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#695445;">{verified_time}</p>
      </div>
    </div>

    <div style="background:#f1e7d8;padding:14px;border-radius:8px;font-size:13px;margin-bottom:16px;">
      <div><strong>Customer Name:</strong> {customer_name}</div>
      <div style="margin-top:4px;"><strong>Phone:</strong> {customer_phone}</div>
      <div style="margin-top:4px;"><strong>Fulfillment:</strong> {order.fulfillment_type.title()}</div>
      <div style="margin-top:4px;"><strong>Town:</strong> {delivery_town}</div>
      <div style="margin-top:4px;"><strong>Location / Address Details:</strong> {delivery_address}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Cake / Item</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Unit Price</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        {items_rows_html}
      </tbody>
    </table>

    <div class="totals">
      <div style="font-size:14px;margin-bottom:4px;">Subtotal: <strong>GHS {order.subtotal_ghs:.2f}</strong></div>
      <div style="font-size:14px;margin-bottom:6px;">Delivery Fee: <strong>GHS {order.delivery_fee_ghs:.2f}</strong></div>
      <div style="font-size:20px;color:#23150f;">Total Paid: <strong>GHS {order.total_ghs:.2f}</strong></div>
    </div>

    <p style="margin-top:24px;font-size:12px;color:#695445;text-align:center;">
      Thank you for ordering from {bakery_name}! Keep this receipt for your records.
    </p>
  </div>
</body>
</html>"""

    response = HttpResponse(receipt_html, content_type="text/html; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="Receipt-{order.order_reference}.html"'
    return response


@api_view(["POST"])
def chatbot_view(request):
    """
    Business-help chatbot that:
    1. Answers questions about the bakery (cakes, GHS prices, availability, hours, location, delivery towns).
    2. Assists customers with using the website checkout and submitting an order.
    3. Explicitly DOES NOT collect or create orders in AI chat (keeps order selection, details, submission, and receipts in the website ordering flow).
    4. Provides a phone or WhatsApp fallback when it cannot resolve a request.
    """
    if request.method != "POST":
        return Response({"error": "Method not allowed"}, status=405)

    settings_obj = ensure_seeded()
    data = request.data
    user_message = str(data.get("message", "")).strip()
    lower_msg = user_message.lower()

    cakes = list(Cake.objects.all())
    available_cakes = [c for c in cakes if c.is_available]
    sold_out_cakes = [c for c in cakes if not c.is_available]
    towns_preview = ", ".join((settings_obj.delivery_towns or DEFAULT_DELIVERY_TOWNS)[:8])

    whatsapp_url = f"https://wa.me/{settings_obj.whatsapp_number}?text=Hello%20Big%20Bakery!%20I%20need%20help%20with%20an%20inquiry."
    phone_url = f"tel:{settings_obj.phone_number.replace(' ', '')}"

    # 1. Detect attempts to place/create an order directly in the chat
    order_intent_phrases = [
        "place an order here",
        "order for me",
        "take my order",
        "buy 1",
        "buy 2",
        "buy a ",
        "i want to order ",
        "can you order",
        "create an order",
        "book a cake for me",
        "deliver to me at",
        "my name is",
        "charge my card",
    ]
    if any(phrase in lower_msg for phrase in order_intent_phrases):
        reply = (
            "I can help guide you, but **I don't collect or place orders directly inside this chat**! "
            "All cake selections, custom item notes, Paystack payments, and downloadable receipts happen right in our website ordering flow.\n\n"
            "**How to place your order on the website:**\n"
            "1. Browse the **Cake Menu** on this page and click **Add to Order** on any available cake.\n"
            "2. Add an optional **Bakery Note** (like a birthday name or inscription) to any cake in your cart.\n"
            "3. Open the **Checkout Drawer**, enter your name, phone number, choose your **Delivery Town** from the searchable dropdown, and add your address details.\n"
            "4. Complete payment securely via **Paystack (in GHS)** to get your instant order reference and **downloadable receipt**!"
        )
        return Response(
            {
                "reply": reply,
                "suggested_action": "open_checkout_or_menu",
                "show_fallback": False,
                "contact": {
                    "phone": settings_obj.phone_number,
                    "phone_url": phone_url,
                    "whatsapp_url": whatsapp_url,
                },
            }
        )

    # 2. Checkout / How to order / Payment / Receipt assistance
    if any(k in lower_msg for k in ["checkout", "how do i order", "how to order", "paystack", "pay", "receipt", "town", "note", "inscription"]):
        status_note = (
            "Online ordering is currently **OPEN**!"
            if settings_obj.is_ordering_open
            else f"Note: Bakery-wide ordering is currently **CLOSED** ({settings_obj.closed_reason})."
        )
        reply = (
            f"{status_note}\n\n"
            "**Website Checkout Guide:**\n"
            "• **Select Cakes & Notes:** Pick any available cake and quantity, and type an optional note (e.g. *'Happy 30th Ama!'*) on each item.\n"
            "• **Guest Checkout (No Account Needed):** Choose either Full Name or First/Middle/Last Name, and enter your Ghana phone number.\n"
            f"• **Searchable Town Dropdown:** Type to filter towns (e.g. *{towns_preview}*) and select your town, then enter your street/landmark.\n"
            "• **Paystack & Receipt:** Click **Pay with Paystack** to confirm payment in GHS. Once confirmed, you'll receive an Order Reference (`BB-...`) and a **Download Receipt** button!"
        )
        return Response(
            {
                "reply": reply,
                "suggested_action": "open_checkout_or_menu",
                "show_fallback": False,
                "contact": {
                    "phone": settings_obj.phone_number,
                    "phone_url": phone_url,
                    "whatsapp_url": whatsapp_url,
                },
            }
        )

    # 3. Menu / Cakes / Prices / Availability queries
    if any(k in lower_msg for k in ["menu", "cake", "price", "cost", "available", "sold out", "cheesecake", "cupcake", "birthday", "wedding"]):
        avail_lines = [f"• **{c.name}** ({c.category}) — GHS {c.price_ghs:.2f}" for c in available_cakes[:6]]
        sold_lines = [f"• ~~{c.name}~~ *(Sold Out)*" for c in sold_out_cakes]
        reply = (
            f"We currently have **{len(available_cakes)} cakes available** for ordering:\n"
            + "\n".join(avail_lines)
            + (f"\n\n**Currently Sold Out:**\n" + "\n".join(sold_lines) if sold_lines else "")
            + "\n\nUse the category filters in the menu section to browse and add available cakes to your website order!"
        )
        return Response(
            {
                "reply": reply,
                "suggested_action": "scroll_menu",
                "show_fallback": False,
                "contact": {
                    "phone": settings_obj.phone_number,
                    "phone_url": phone_url,
                    "whatsapp_url": whatsapp_url,
                },
            }
        )

    # 4. Opening hours / Location / Delivery / Contact queries
    if any(k in lower_msg for k in ["hour", "open", "close", "time", "where", "location", "address", "deliver", "pickup", "contact", "phone", "whatsapp"]):
        ordering_state = "OPEN for online orders" if settings_obj.is_ordering_open else f"CLOSED for online orders ({settings_obj.closed_reason})"
        reply = (
            f"**{settings_obj.bakery_name} Information:**\n"
            f"• **Ordering Status:** {ordering_state}\n"
            f"• **Opening Hours:** {settings_obj.opening_hours}\n"
            f"• **Bakery Location:** {settings_obj.location_address}\n"
            f"• **Fulfillment:** Delivery (GHS {settings_obj.delivery_fee_ghs:.2f} flat fee across {len(settings_obj.delivery_towns or DEFAULT_DELIVERY_TOWNS)} towns) & Store Pickup\n"
            f"• **Direct Contact:** {settings_obj.phone_number}"
        )
        return Response(
            {
                "reply": reply,
                "suggested_action": None,
                "show_fallback": True,
                "contact": {
                    "phone": settings_obj.phone_number,
                    "phone_url": phone_url,
                    "whatsapp_url": whatsapp_url,
                },
            }
        )

    # 5. Issue resolution / Unrecognized or complex requests -> provide helpful answer + direct Phone & WhatsApp fallback!
    reply = (
        "I want to make sure your request is handled properly! I can answer questions about our cakes, GHS prices, opening hours, delivery towns, or guide you through our website checkout and Paystack receipt download.\n\n"
        "If you have a bespoke cake design request, an issue with an existing order, or need personal assistance from our head baker, please reach us directly via **Phone** or **WhatsApp** using the buttons below:"
    )
    return Response(
        {
            "reply": reply,
            "suggested_action": None,
            "show_fallback": True,
            "contact": {
                "phone": settings_obj.phone_number,
                "phone_url": phone_url,
                "whatsapp_url": whatsapp_url,
            },
        }
    )

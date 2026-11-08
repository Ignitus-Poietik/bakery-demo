from django.contrib import admin
from .models import BakerySettings, Cake, PromoSlide, Order, OrderItem


admin.site.site_header = "Big Bakery Patisserie — Admin"
admin.site.site_title = "Big Bakery Admin"
admin.site.index_title = "Bakery Management Dashboard"


@admin.register(BakerySettings)
class BakerySettingsAdmin(admin.ModelAdmin):
    list_display = (
        "bakery_name",
        "is_ordering_open",
        "delivery_enabled",
        "pickup_enabled",
        "delivery_fee_ghs",
        "phone_number",
        "updated_at",
    )
    list_editable = (
        "is_ordering_open",
        "delivery_enabled",
        "pickup_enabled",
        "delivery_fee_ghs",
    )


@admin.register(Cake)
class CakeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "price_ghs",
        "is_available",
        "weight_or_size",
        "badge",
    )
    list_filter = ("category", "is_available")
    list_editable = ("price_ghs", "is_available", "badge")
    search_fields = ("name", "category", "description")


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("cake", "cake_name", "cake_category", "unit_price_ghs", "quantity", "item_note", "line_total_ghs")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_reference",
        "customer_full_name",
        "customer_phone",
        "fulfillment_type",
        "delivery_town",
        "total_ghs",
        "payment_status",
        "order_status",
        "created_at",
    )
    list_filter = ("payment_status", "order_status", "fulfillment_type", "created_at")
    list_editable = ("order_status",)
    search_fields = ("order_reference", "paystack_reference", "customer_full_name", "customer_phone", "delivery_town")
    readonly_fields = ("order_reference", "paystack_reference", "paystack_verified_at", "created_at")
    inlines = [OrderItemInline]


@admin.register(PromoSlide)
class PromoSlideAdmin(admin.ModelAdmin):
    list_display = ("title", "badge_text", "action_type", "action_target", "is_active", "sort_order")
    list_editable = ("is_active", "sort_order")


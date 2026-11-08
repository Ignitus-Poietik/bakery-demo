from django.urls import path
from . import views

urlpatterns = [
    path("bootstrap/", views.bootstrap_view, name="bootstrap"),
    path("settings/", views.settings_view, name="settings"),
    path("cakes/", views.cakes_collection_view, name="cakes_collection"),
    path("cakes/<int:cake_id>/", views.cake_detail_view, name="cake_detail"),
    path("promos/", views.promos_collection_view, name="promos_collection"),
    path("promos/<int:promo_id>/", views.promo_detail_view, name="promo_detail"),
    path("orders/", views.orders_list_view, name="orders_list"),
    path("orders/initiate/", views.initiate_order_view, name="initiate_order"),
    path("orders/<str:order_reference>/confirm-payment/", views.confirm_payment_view, name="confirm_payment"),
    path("orders/<str:order_reference>/status/", views.update_order_status_view, name="update_order_status"),
    path("orders/<str:order_reference>/receipt/", views.order_receipt_view, name="order_receipt"),
    path("chatbot/", views.chatbot_view, name="chatbot"),
]

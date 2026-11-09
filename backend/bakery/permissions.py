from django.contrib.auth import get_user_model
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission, SAFE_METHODS

MANAGE_TOKEN_SALT = "big-bakery-manage-token"
MANAGE_TOKEN_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def create_management_token(user) -> str:
    signer = TimestampSigner(salt=MANAGE_TOKEN_SALT)
    return signer.sign(str(user.pk))


class BakeryTokenAuthentication(BaseAuthentication):
    """
    Authenticates requests bearing `Authorization: Bearer <signed_token>` issued by `/api/manage/login/`.
    """

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "").strip()
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header[7:].strip()
        if not token:
            return None
        signer = TimestampSigner(salt=MANAGE_TOKEN_SALT)
        try:
            user_pk = signer.unsign(token, max_age=MANAGE_TOKEN_MAX_AGE)
        except (BadSignature, SignatureExpired):
            return None
        User = get_user_model()
        try:
            user = User.objects.get(pk=int(user_pk), is_active=True, is_staff=True)
        except (User.DoesNotExist, ValueError):
            return None
        return (user, token)


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)


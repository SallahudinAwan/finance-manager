from rest_framework.permissions import BasePermission

from .services import is_owner, user_membership


class HasHousehold(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(
            request.user and request.user.is_authenticated and user_membership(request.user)
        )


class IsHouseholdOwner(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and is_owner(request.user))


class OwnerWriteMemberRead(HasHousehold):
    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return True
        return is_owner(request.user)

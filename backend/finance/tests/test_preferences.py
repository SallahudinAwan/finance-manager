import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from finance.models import UserPreference

pytestmark = pytest.mark.django_db


def test_session_requires_language_selection_until_preference_is_saved() -> None:
    user = get_user_model().objects.create_user(
        username="language@example.com",
        email="language@example.com",
    )
    client = APIClient()
    client.force_authenticate(user)

    initial = client.get("/api/v1/session/")

    assert initial.status_code == 200
    assert initial.data["needs_language_selection"] is True
    assert initial.data["user"]["preferred_language"] is None

    saved = client.patch(
        "/api/v1/preferences/",
        {"preferred_language": UserPreference.Language.URDU},
        format="json",
    )

    assert saved.status_code == 200
    assert saved.data["preferred_language"] == UserPreference.Language.URDU

    refreshed = client.get("/api/v1/session/")
    assert refreshed.data["needs_language_selection"] is False
    assert refreshed.data["user"]["preferred_language"] == UserPreference.Language.URDU


def test_language_preference_rejects_unsupported_values() -> None:
    user = get_user_model().objects.create_user(
        username="invalid-language@example.com",
        email="invalid-language@example.com",
    )
    client = APIClient()
    client.force_authenticate(user)

    response = client.patch(
        "/api/v1/preferences/",
        {"preferred_language": "fr"},
        format="json",
    )

    assert response.status_code == 400
    assert not UserPreference.objects.filter(user=user).exists()

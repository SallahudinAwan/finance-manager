from unittest.mock import patch

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
    assert initial.data["user"]["tour_completed"] is False

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
    assert refreshed.data["user"]["tour_completed"] is False

    completed = client.patch(
        "/api/v1/preferences/",
        {"tour_completed": True},
        format="json",
    )
    assert completed.status_code == 200
    assert completed.data["tour_completed"] is True
    assert client.get("/api/v1/session/").data["user"]["tour_completed"] is True


def test_session_bootstrap_is_not_blocked_by_the_user_throttle() -> None:
    user = get_user_model().objects.create_user(
        username="session@example.com",
        email="session@example.com",
    )
    client = APIClient()
    client.force_authenticate(user)

    with patch(
        "rest_framework.throttling.UserRateThrottle.allow_request",
        return_value=False,
    ):
        response = client.get("/api/v1/session/")

    assert response.status_code == 200


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

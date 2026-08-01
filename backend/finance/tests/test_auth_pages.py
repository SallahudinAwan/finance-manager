import pytest
from django.test import Client, override_settings

from finance.tests.factories import create_household

pytestmark = pytest.mark.django_db

GOOGLE_PROVIDER_SETTINGS = {
    "google": {
        "SCOPE": ["openid", "email", "profile"],
        "APPS": [{"client_id": "test-client", "secret": "test-secret", "key": ""}],
    }
}


def test_logout_page_uses_branded_confirmation_template() -> None:
    owner, _ = create_household()
    client = Client()
    client.force_login(owner)

    response = client.get("/accounts/logout/")

    assert response.status_code == 200
    assert b"Sign out of Ravani?" in response.content
    assert b"Sign out securely" in response.content
    assert owner.email.encode() in response.content
    assert b"Account Connections" not in response.content


@override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER_SETTINGS)
def test_google_login_confirmation_uses_branded_template() -> None:
    response = Client().get("/accounts/google/login/")

    assert response.status_code == 200
    assert b"Welcome to Ravani" in response.content
    assert b"Continue securely with Google" in response.content
    assert b"Ravani never receives or stores your Google password." in response.content
    assert b"Sign In Via Google" not in response.content


@override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE_PROVIDER_SETTINGS)
def test_account_login_uses_branded_template() -> None:
    response = Client().get("/accounts/login/")

    assert response.status_code == 200
    assert b"Welcome back" in response.content
    assert b"Continue securely with Google" in response.content

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, HttpRequest, HttpResponse, JsonResponse
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(_: HttpRequest) -> JsonResponse:
    return JsonResponse({"status": "ok"})


def spa(_: HttpRequest) -> HttpResponse:
    index_path = Path(settings.FRONTEND_DIST) / "index.html"
    if index_path.exists():
        return FileResponse(index_path.open("rb"), content_type="text/html")
    return HttpResponse(
        "<h1>Finance Manager API</h1><p>Run the Vite development server on port 5173.</p>",
        content_type="text/html",
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("_allauth/", include("allauth.headless.urls")),
    path("api/v1/", include("finance.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("health/", health, name="health"),
    re_path(r"^(?!api/|admin/|accounts/|_allauth/|health/|static/).*$", spa),
]

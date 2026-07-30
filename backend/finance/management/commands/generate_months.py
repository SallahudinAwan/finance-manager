from django.core.management.base import BaseCommand

from finance.models import Household
from finance.services import current_period


class Command(BaseCommand):
    help = "Idempotently generate the current month for every active household."

    def handle(self, *args, **options) -> None:
        count = 0
        for household in Household.objects.filter(onboarding_complete=True):
            current_period(household)
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Ensured current periods for {count} households."))

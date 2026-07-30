from django.core.management.base import BaseCommand

from finance.services import send_due_reminders


class Command(BaseCommand):
    help = "Send idempotent bill and savings reminders."

    def handle(self, *args, **options) -> None:
        count = send_due_reminders()
        self.stdout.write(self.style.SUCCESS(f"Created or sent {count} reminders."))

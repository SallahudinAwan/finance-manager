from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="plannedexpense",
            name="carryover_credit",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                max_digits=14,
            ),
        ),
        migrations.AddConstraint(
            model_name="plannedexpense",
            constraint=models.CheckConstraint(
                condition=models.Q(("carryover_credit__gte", 0)),
                name="planned_expense_nonnegative_carryover",
            ),
        ),
    ]

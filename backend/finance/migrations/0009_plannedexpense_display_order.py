from django.db import migrations, models


def populate_display_order(apps, schema_editor):
    PlannedExpense = apps.get_model("finance", "PlannedExpense")
    period_ids = PlannedExpense.objects.values_list("period_id", flat=True).distinct()
    for period_id in period_ids.iterator():
        expenses = PlannedExpense.objects.filter(period_id=period_id).order_by(
            "due_date", "name", "id"
        )
        for display_order, expense in enumerate(expenses):
            expense.display_order = display_order
        PlannedExpense.objects.bulk_update(expenses, ["display_order"])


class Migration(migrations.Migration):
    dependencies = [("finance", "0008_rebrand_site_name")]

    operations = [
        migrations.AddField(
            model_name="plannedexpense",
            name="display_order",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(populate_display_order, migrations.RunPython.noop),
        migrations.AlterModelOptions(
            name="plannedexpense",
            options={"ordering": ["display_order", "due_date", "name", "id"]},
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0002_plannedexpense_carryover_credit"),
    ]

    operations = [
        migrations.AddField(
            model_name="monthlyperiod",
            name="is_deleted",
            field=models.BooleanField(default=False),
        ),
    ]

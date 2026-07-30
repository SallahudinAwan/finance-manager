from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0004_userpreference"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpreference",
            name="tour_completed",
            field=models.BooleanField(default=False),
        ),
    ]

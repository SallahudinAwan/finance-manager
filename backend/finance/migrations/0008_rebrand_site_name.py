from django.db import migrations


def rebrand_site_names(apps, schema_editor) -> None:
    Site = apps.get_model("sites", "Site")
    for site in Site.objects.filter(name__startswith="Finance Manager"):
        site.name = site.name.replace("Finance Manager", "Ravani", 1)
        site.save(update_fields=["name"])


def restore_site_names(apps, schema_editor) -> None:
    Site = apps.get_model("sites", "Site")
    for site in Site.objects.filter(name__startswith="Ravani"):
        site.name = site.name.replace("Ravani", "Finance Manager", 1)
        site.save(update_fields=["name"])


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0007_alter_rolloverallocation_source_kind"),
        ("sites", "0002_alter_domain_unique"),
    ]

    operations = [
        migrations.RunPython(rebrand_site_names, restore_site_names),
    ]

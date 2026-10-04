"""Make Profile.full_name a required field.

`blank` is a validation flag, not a column definition: the database column was
already NOT NULL and still is, so this migration changes no table and cannot fail
on existing rows. What it changes is that Django's own forms (the admin) now
refuse an account saved without a name, matching the rule `UserWriteSerializer`
enforces on the API that User Management writes through.

Accounts created before the rule existed may still hold a blank name. They are
not touched here — a name is not something a migration can invent — and they stay
editable so a coordinator can fill one in.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0023_admin_role_and_account'),
    ]

    operations = [
        migrations.AlterField(
            model_name='profile',
            name='full_name',
            field=models.CharField(max_length=255, verbose_name='Full Name'),
        ),
    ]

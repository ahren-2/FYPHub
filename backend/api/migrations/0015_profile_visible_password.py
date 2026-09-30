"""Add Profile.visible_password and pre-fill it for existing accounts.

The coordinator screens let a coordinator read back and change an account's
sign-in password, which needs a readable copy alongside Django's hash.

Every account in this database was created either by the bulk Excel upload
(`ExcelUploadView`) or by `manage.py import_data`, and both hard-code the same
starting password. Nothing else in the project ever calls `set_password`, and
there is no user-facing change-password screen, so that starting value is still
each account's password and can be filled in safely. Accounts whose password was
changed some other way show a blank value and simply have no readable copy.
"""

from django.db import migrations, models

# Kept in step with ExcelUploadView and serializers.DEFAULT_NEW_USER_PASSWORD.
LEGACY_DEFAULT_PASSWORD = 'wow12345'


def fill_known_passwords(apps, schema_editor):
    Profile = apps.get_model('api', 'Profile')
    Profile.objects.filter(visible_password='').update(visible_password=LEGACY_DEFAULT_PASSWORD)


def clear_passwords(apps, schema_editor):
    Profile = apps.get_model('api', 'Profile')
    Profile.objects.update(visible_password='')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_shift_legacy_timestamps_to_utc8'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='visible_password',
            field=models.CharField(
                blank=True, default='', max_length=128, verbose_name='Stored Password'
            ),
        ),
        migrations.RunPython(fill_known_passwords, clear_passwords),
    ]

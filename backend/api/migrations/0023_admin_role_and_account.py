"""Add the `admin` role, and seed the one account that uses it.

The `admin` role is the account-maintenance role, added so the person taking this
project over has a way in that is not tied to a course. It is the only role that
sees accounts from every programme at once (`UserViewSet.get_queryset`), and the
only workspace it opens is User Management — every course-level view still tests
`role == 'coordinator'` and therefore stays shut.

The account is seeded here rather than by hand so a database built from
migrations (`manage.py setup_fyphub`) has the same way in as the shipped dump,
and so nobody has to remember to run a command after restoring. Seeding built-in
rows from a migration is the convention already used for the built-in rubrics
(0013_seed_builtin_rubrics).

Password: the account is created with `password1`, which is also written to
`Profile.visible_password` so the coordinator screens can read it back like any
other account's. As with every account in this project, the real check is the
PBKDF2 hash on `auth_user` — change it with `manage.py changepassword admin`.

If an account called `admin` already exists (a `createsuperuser` run is the
likely reason), its password is left exactly as it is and only the missing or
wrong role is corrected: a migration must not silently reset a password someone
set deliberately.
"""

from django.contrib.auth.hashers import make_password
from django.db import migrations, models

# The handover account. Change the password with:
#   venv\\Scripts\\python.exe manage.py changepassword admin
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'password1'
ADMIN_FULL_NAME = 'Administrator'


def create_admin_account(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Profile = apps.get_model('api', 'Profile')

    user, created = User.objects.get_or_create(
        username=ADMIN_USERNAME,
        defaults={
            'password': make_password(ADMIN_PASSWORD),
            'is_active': True,
            'is_staff': False,
            'is_superuser': False,
            'first_name': ADMIN_FULL_NAME,
        },
    )

    # No `programme`: the role is not scoped to a cohort, which is the whole
    # point of it. User Management lists every programme regardless.
    profile, _ = Profile.objects.get_or_create(
        user=user,
        defaults={
            'full_name': ADMIN_FULL_NAME,
            'role': 'admin',
            'visible_password': ADMIN_PASSWORD if created else '',
        },
    )
    if not created and profile.role != 'admin':
        profile.role = 'admin'
        profile.save(update_fields=['role'])


def remove_admin_account(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    # Profile goes with it through the FK's ON DELETE CASCADE.
    User.objects.filter(username=ADMIN_USERNAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_backfill_mark_course_and_stage'),
    ]

    operations = [
        migrations.AlterField(
            model_name='profile',
            name='role',
            field=models.CharField(choices=[('student', 'Student'), ('lecturer', 'Lecturer'), ('coordinator', 'Coordinator'), ('admin', 'Administrator')], default='student', max_length=20),
        ),
        migrations.RunPython(create_admin_account, remove_admin_account),
    ]

"""Bind every account to a real programme and retire the legacy placeholders.

The problem
-----------
Two programme rows exist that are not programmes at all:

    General  (code 'General')  — where the original spreadsheet upload filed every
                                 account it could not place
    None     (code 'None')     — invented from a blank cell in that same sheet,
                                 because the importer turned the *string* 'None'
                                 into a lookup key

`ProgrammeViewSet.LEGACY_PROGRAMME_CODES` in `api/views.py` already hides both
from every selectable list, and its comment asks for exactly this cleanup:
"Delete the two programme rows in the database once the audit ... shows no
accounts left on them." This migration performs that audit and that cleanup.

Why it also seeds the programme rows
------------------------------------
The institution offers BCS, BDM, BMD and BID, but the only thing that ever put
those rows into a database was a manual import — a fresh `manage.py migrate`
produced a database with no programmes at all. That made this migration a silent
no-op on a new database (there was no BCS row to fold accounts onto) and left
`create account` with nothing to selectable. Seeding them here makes the four
programmes part of the schema rather than part of somebody's setup notes, and
makes this migration behave identically on a fresh database and an existing one.
`get_or_create` is used so an existing row keeps its own name and id.

What it does, in order
----------------------
1. Seeds the canonical programme rows if they are absent.
2. Re-points every account, announcement and project filed under `General` or
   `None` onto `BCS`.
3. Re-applies the project rule: a project's programme is its student's programme.
4. Re-derives `submissions.programme`, which is free text rather than a foreign
   key, from each submission's student.
5. Retires the `General` and `None` rows themselves.

Why re-point rather than merge
------------------------------
`BCS` is used here on the instruction that the BCS cohort is where these
accounts belong. The programme is a scoping key for statistics, rubric templates
and the student list, so leaving rows on `General` would keep the counts split
between "General" and "BCS" instead of reporting one cohort.

`submissions.programme` is the awkward one: eight rows carried the human string
'Bachelor of Computer Science' while `api_programme.name` holds the code 'BCS'.
Three of those eight belong to accounts that were on `General`, so they would
have kept reporting the wrong programme even after step 2. Rather than pattern
match a free-text column, step 4 derives the value the same way the API now
does — from the student's profile — which also repairs the rows whose student is
on BDM/BMD/BID. It is written to `Programme.name`, matching how
`SubmissionSerializer` fills the field.

Why the project repair is a separate pass
-----------------------------------------
`FYPProject.save()` derives its programme from the student's profile, but only
*when the profile actually holds one* — deliberately, so a project is never
silently blanked while a student's programme is still unset. That guard means a
project sitting on `General` while its student's profile was never updated keeps
its stale value until the profile is fixed and the project is saved again. Step
2 fixes the profile; step 3 is what actually moves the project, and it also
repairs any other profile/project disagreement.

This is deliberately belt-and-braces: `sync_project_programmes` in views.py does
the same repair on demand, but a data correction that only happens if somebody
remembers to press a button is not a correction.

Reversibility
-------------
The reverse operation is intentionally a no-op: the rows this migration moves
were placeholder assignments with no meaningful value to restore, so no account
is put back onto a placeholder. `RunPython` still needs a reverse callable to
allow the migration to be unapplied, hence the empty function.
"""

from django.db import migrations

# The code the legacy placeholders are folded into.
TARGET_PROGRAMME_CODE = 'BCS'

# The programmes the institution actually offers. (code, name) — the code is the
# display name today, since that is what every existing row and screen uses.
CANONICAL_PROGRAMMES = (
    ('BCS', 'BCS'),
    ('BDM', 'BDM'),
    ('BMD', 'BMD'),
    ('BID', 'BID'),
)

# Not programmes. See the module docstring.
LEGACY_PROGRAMME_CODES = ('General', 'None')


def bind_everything_to_a_real_programme(apps, schema_editor):
    Programme = apps.get_model('api', 'Programme')
    Profile = apps.get_model('api', 'Profile')
    FYPProject = apps.get_model('api', 'FYPProject')
    Submissions = apps.get_model('api', 'Submissions')
    Announcements = apps.get_model('api', 'Announcements')

    # 1. The four real programmes are part of the schema, not of somebody's setup.
    for code, name in CANONICAL_PROGRAMMES:
        Programme.objects.get_or_create(code=code, defaults={'name': name})

    target = Programme.objects.get(code=TARGET_PROGRAMME_CODE)

    legacy_ids = list(
        Programme.objects.filter(code__in=LEGACY_PROGRAMME_CODES).values_list('id', flat=True)
    )

    if legacy_ids:
        # 2. Accounts: the fix that matters, because every programme filter in
        #    the API reads Profile.programme.
        Profile.objects.filter(programme_id__in=legacy_ids).update(programme_id=target.id)

        # Rows that hang off a programme directly rather than off an account.
        # `on_delete=CASCADE` means leaving these behind would delete them when
        # the placeholder rows are removed at the end of this function.
        Announcements.objects.filter(programme_id__in=legacy_ids).update(programme_id=target.id)
        FYPProject.objects.filter(programme_id__in=legacy_ids).update(programme_id=target.id)

    # 3. A project belongs to its student's programme. Applied unconditionally so
    #    it also repairs disagreements that predate this migration.
    for project in FYPProject.objects.select_related('student__profile').all():
        profile = getattr(project.student, 'profile', None)
        if profile is not None and profile.programme_id and project.programme_id != profile.programme_id:
            project.programme_id = profile.programme_id
            project.save(update_fields=['programme'])

    # 4. `submissions.programme` is free text, so it is re-derived from the
    #    student rather than from its own previous contents.
    for submission in Submissions.objects.select_related('student__profile__programme').all():
        profile = getattr(submission.student, 'profile', None)
        programme = getattr(profile, 'programme', None)
        if programme is not None and submission.programme != programme.name:
            submission.programme = programme.name
            submission.save(update_fields=['programme'])

    # 5. Retire the placeholders. Safe only now that every referencing row has
    #    been moved, because these foreign keys cascade.
    if legacy_ids:
        Programme.objects.filter(id__in=legacy_ids).delete()


def noop_reverse(apps, schema_editor):
    """Intentionally empty — see the module docstring."""
    return


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_rubric_fk_on_delete_cascade'),
    ]

    operations = [
        migrations.RunPython(bind_everything_to_a_real_programme, noop_reverse),
    ]

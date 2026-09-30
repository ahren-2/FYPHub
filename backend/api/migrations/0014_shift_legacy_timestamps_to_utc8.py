# One-time correction of timestamps written under the old time zone handling.
#
# Background
# ----------
# Until this change, settings.py had `USE_TZ = True` while the MySQL session ran
# in the host's time zone (SYSTEM = +08:00, Malaysia). Django therefore sent
# naive *UTC* strings into a +08:00 session, and every datetime it generated
# itself was stored 8 hours behind the real local time. Measured before the fix
# (see database/_tz_probe.py):
#
#     MySQL NOW() = 23:01:29   announcements.created_at (auto_now_add) = 15:01:29
#
# Values typed by a user were not affected: the browser sends the picked local
# time as a fake-UTC instant and that round-tripped exactly, so api_timetable*
# rows created from the UI are already correct wall-clock Malaysia time and are
# deliberately NOT touched here. (The auto-scheduler in views.py did store them
# 8 hours off; that code is fixed in the same change, and this database has zero
# such rows — verified before writing this migration.)
#
# Rubric tables are not touched either: they are written by PHP, which has always
# used a +08:00 session, so their values are already Malaysia wall clock.
#
# What this migration shifts: only columns Django populated on its own.
#
# Assumption: this database was written on a machine whose MySQL session time
# zone was +08:00 (a Malaysia-hosted Laragon/MySQL setup — what this project
# ships as). On a database written on a host with a different clock, skip this
# migration (`manage.py migrate api 0013`, then `manage.py migrate --fake api
# 0014`). On a fresh install it is a no-op: those tables have no rows yet.

from django.db import migrations

HOURS = 8

# (table, column, predicate) — Django-populated datetime columns only.
COLUMNS = [
    ('announcements', 'created_at', None),
    ('feedback', 'created_at', None),
    ('submissions', 'created_at', None),
    ('submissions', 'updated_at', None),
    ('auth_user', 'date_joined', None),
    ('auth_user', 'last_login', 'last_login IS NOT NULL'),
    ('django_admin_log', 'action_time', None),
    ('django_migrations', 'applied', None),
    ('django_session', 'expire_date', None),
]

# Deliberately NOT shifted:
#   api_timetablebooking.start_time / end_time, api_timetableslot.start_time /
#   end_time  — user-picked times round-tripped correctly under the old config,
#               and the auto-scheduler rows that did not are fixed in code; this
#               database has none.
#   rubrics_templates.*, rubrics_marks.*, rubrics_active_templates.*
#             — written by PHP, always Malaysia wall clock already.
# date columns (api_presentationday.date, api_presentationslot.date) carry no
# time component and are unaffected.


def _columns_present(cursor):
    cursor.execute(
        "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE()"
    )
    return {(table, column) for table, column in cursor.fetchall()}


def shift(apps, schema_editor, sign=1):
    cursor = schema_editor.connection.cursor()
    present = _columns_present(cursor)
    direction = '+' if sign > 0 else '-'
    total = 0

    for table, column, predicate in COLUMNS:
        if (table, column) not in present:
            print(f'  skip {table}.{column} (column not present)')
            continue
        where = f'WHERE {predicate}' if predicate else ''
        sql = (
            f'UPDATE `{table}` SET `{column}` = `{column}` {direction} INTERVAL {HOURS} HOUR '
            f'{where}'
        )
        cursor.execute(sql)
        affected = cursor.rowcount
        total += affected
        print(f'  {table}.{column}: {affected} row(s) shifted {direction}{HOURS}h')

    print(f'  total rows corrected: {total}')
    return total


def forwards(apps, schema_editor):
    print(f'Correcting legacy timestamps: {HOURS} hours forward (UTC -> Malaysia +08)')
    shift(apps, schema_editor, sign=1)


def backwards(apps, schema_editor):
    print(f'Reverting legacy timestamp correction: {HOURS} hours backward')
    shift(apps, schema_editor, sign=-1)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_seed_builtin_rubrics'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

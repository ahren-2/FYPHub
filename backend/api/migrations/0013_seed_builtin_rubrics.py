# Seeds the built-in rubrics so that a fresh `manage.py migrate` produces a
# system that can grade immediately, instead of empty tables.
#
# Two behaviours worth knowing:
#   * nothing is ever overwritten. Each row is inserted only if it is absent, so
#     an existing deployment keeps its own (possibly edited) copies of these
#     templates — the live `tpl_fyp1_marking_v7` row, for example, is at
#     version 13 and must not be reset to the seed content.
#   * raw SQL is used on purpose: the exported rows carry explicit timestamps
#     and `auto_now_add` would replace them with `now()` on a normal save.

from django.db import migrations

from ._rubric_seed_data import ACTIVE_TEMPLATES, OFFICIAL_TEMPLATES


def _row_exists(cursor, table, column, value):
    cursor.execute(f'SELECT 1 FROM `{table}` WHERE `{column}` = %s LIMIT 1', [value])
    return cursor.fetchone() is not None


def seed_builtin_rubrics(apps, schema_editor):
    cursor = schema_editor.connection.cursor()

    for template in OFFICIAL_TEMPLATES:
        if _row_exists(cursor, 'rubrics_templates', 'id', template['id']):
            continue
        cursor.execute(
            'INSERT INTO `rubrics_templates` '
            '(id, name, template_data, created_by, created_at, updated_at, version, is_active) '
            'VALUES (%s, %s, %s, %s, %s, %s, %s, %s)',
            [
                template['id'],
                template['name'],
                template['template_data'],
                template['created_by'],
                template['created_at'],
                template['updated_at'],
                template['version'],
                template['is_active'],
            ],
        )

    for active in ACTIVE_TEMPLATES:
        if _row_exists(cursor, 'rubrics_active_templates', 'fyp_stage', active['fyp_stage']):
            continue
        if not _row_exists(cursor, 'rubrics_templates', 'id', active['template_id']):
            continue
        cursor.execute(
            'INSERT INTO `rubrics_active_templates` '
            '(fyp_stage, template_id, updated_by, updated_at) VALUES (%s, %s, %s, %s)',
            [
                active['fyp_stage'],
                active['template_id'],
                active['updated_by'],
                active['updated_at'],
            ],
        )


def unseed_builtin_rubrics(apps, schema_editor):
    cursor = schema_editor.connection.cursor()
    for active in ACTIVE_TEMPLATES:
        cursor.execute(
            'DELETE FROM `rubrics_active_templates` WHERE fyp_stage = %s AND template_id = %s',
            [active['fyp_stage'], active['template_id']],
        )
    for template in OFFICIAL_TEMPLATES:
        cursor.execute('DELETE FROM `rubrics_templates` WHERE id = %s', [template['id']])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_rubric_tables_consolidation'),
    ]

    operations = [
        migrations.RunPython(seed_builtin_rubrics, unseed_builtin_rubrics),
    ]

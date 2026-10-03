# Gives the two rubric foreign keys the ON DELETE CASCADE rule that
# `php/delete_template.php` has always assumed.
#
# The bug
# -------
# `delete_template.php` removes a template with a single raw statement:
#
#     DELETE FROM rubrics_templates WHERE id = ?
#
# and its comment says this "cascades to rubrics_marks & rubrics_version_history
# via FK". It does not. Django's `on_delete=models.CASCADE` is implemented in the
# ORM, not in the schema: `CreateModel` in 0012 emitted plain
# `FOREIGN KEY (template_id) REFERENCES rubrics_templates (id)` with no
# ON DELETE clause, so MySQL's default rule (NO ACTION / RESTRICT) applies.
#
# The visible result: deleting a template that any mark or any stage mapping still
# points at fails with
#
#     IntegrityError (1451): Cannot delete or update a parent row: a foreign key
#     constraint fails ... CONSTRAINT `rubrics_active_templ_template_id_...`
#
# and `Rubrics.js` shows that raw MySQL text in an alert(). Three of the six
# templates in the shipped database are in that state (one stage mapping each, and
# two with marks), so the Delete button was broken for half of them.
#
# Why a database-level change is the right fix here
# -------------------------------------------------
# Only the PHP path is affected — `RubricTemplate.delete()` in Python already
# cascades correctly — and the PHP layer is the sole writer of these tables, so
# the delete rule belongs in the schema where PHP can rely on it. Doing it here
# rather than in PHP keeps `delete_template.php` a single statement inside one
# implicit transaction instead of a multi-statement delete that could half-apply.
#
# This migration adds no Django *state* change on purpose: the models already
# declare `on_delete=CASCADE`, so `makemigrations --check` stays clean and no
# further migration is generated.

from django.db import migrations

# (table, column, referenced table, canonical Django constraint name)
FOREIGN_KEYS = [
    (
        'rubrics_marks',
        'template_id',
        'rubrics_templates',
        'rubrics_marks_template_id_33e3eafc_fk_rubrics_templates_id',
    ),
    (
        'rubrics_active_templates',
        'template_id',
        'rubrics_templates',
        'rubrics_active_templ_template_id_b96b31e4_fk_rubrics_t',
    ),
]


def _existing_fk_name(cursor, table, column, ref_table):
    """The constraint actually guarding this column, or None.

    Looked up rather than assumed: Django derives the name from a hash of the
    table and column, and a database that was ever hand-edited (this one was
    restored from a phpMyAdmin dump at least twice) may carry a different name.
    """
    cursor.execute(
        'SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE '
        'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s '
        'AND COLUMN_NAME = %s AND REFERENCED_TABLE_NAME = %s',
        [table, column, ref_table],
    )
    row = cursor.fetchone()
    return row[0] if row else None


def set_delete_rule(cursor, table, column, ref_table, canonical_name, rule):
    """Drop and recreate the foreign key with the given ON DELETE rule."""
    name = _existing_fk_name(cursor, table, column, ref_table) or canonical_name

    if _existing_fk_name(cursor, table, column, ref_table):
        cursor.execute(f'ALTER TABLE `{table}` DROP FOREIGN KEY `{name}`')

    on_delete = f' ON DELETE {rule}' if rule else ''
    cursor.execute(
        f'ALTER TABLE `{table}` ADD CONSTRAINT `{name}` '
        f'FOREIGN KEY (`{column}`) REFERENCES `{ref_table}` (`id`){on_delete}'
    )
    print(f'  {table}.{column} -> {ref_table}: ON DELETE {rule or "NO ACTION"} '
          f'(constraint `{name}`)')


def add_cascade(apps, schema_editor):
    cursor = schema_editor.connection.cursor()
    print('Setting ON DELETE CASCADE on the rubric foreign keys:')
    for table, column, ref_table, canonical_name in FOREIGN_KEYS:
        set_delete_rule(cursor, table, column, ref_table, canonical_name, 'CASCADE')


def remove_cascade(apps, schema_editor):
    cursor = schema_editor.connection.cursor()
    print('Restoring the default (NO ACTION) delete rule:')
    for table, column, ref_table, canonical_name in FOREIGN_KEYS:
        set_delete_rule(cursor, table, column, ref_table, canonical_name, None)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_profile_visible_password'),
    ]

    operations = [
        migrations.RunPython(add_cascade, remove_cascade),
    ]

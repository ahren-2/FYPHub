"""Scope the rubric tables to a programme.

Why
---
A rubric was selected as active per FYP stage only, so FYP 1 had exactly one
active template for the whole institution. Editing the level descriptors or
criteria weights for one cohort therefore silently changed what every other
cohort was marked against, and `get_active_template.php?fyp_stage=FYP1` could not
tell BCS from BDM. The active mapping is now unique per (programme, stage).

Three tables change:
    rubrics_templates         + programme_id   (NULL = a starter/library template)
    rubrics_marks             + programme_id   (NULL only for rows that cannot be
                                                attributed; 0019 backfills them)
    rubrics_active_templates  + programme_id, and its primary key moves from
                              `fyp_stage` to a surrogate `id`

Why the active table needs a new primary key
--------------------------------------------
It was keyed on `fyp_stage` alone, which is precisely the thing that has to stop
being unique. A composite primary key on (programme, fyp_stage) is not enough
either: MySQL does not reliably fire `ON DUPLICATE KEY UPDATE` for a composite
primary key violation, and `set_active_template.php` depends on that clause to
upsert. A surrogate `id` plus an explicit unique constraint gives PHP an
ordinary unique key to collide on, which is what it was already written against.

Existing rows
-------------
Every existing template, active mapping and mark row is attached to BCS. That is
the correct reading of the data rather than a default: the only official
templates in the database are the CSS3714 / CSS3724 BCS rubrics, and all six
marks rows point at them. Since `programme_id` is added as NOT NULL for the
active table, a row cannot be left unassigned, so this assignment has to be
explicit — it is done by the data step below rather than by a column default, so
the intent is visible in the migration instead of buried in a schema option.

`rubrics_marks.programme_id` is nullable on purpose: a mark row whose student has
since been deleted cannot be attributed to anything, and nulling it is better
than guessing. Migration 0019 fills the rest from the student's profile.
"""

from django.db import migrations, models
import django.db.models.deletion


BCS_PROGRAMME_ID_SUBQUERY = "(SELECT id FROM api_programme WHERE code = 'BCS' LIMIT 1)"


def attach_existing_rubric_rows_to_bcs(apps, schema_editor):
    """Assign every pre-existing rubric row to BCS.

    Written as raw SQL rather than ORM updates because the FK column has just
    been added by this same migration: the historical models loaded through
    `apps` still describe the old shape, so the new column is not addressable
    through them until the migration completes.
    """
    cursor = schema_editor.connection.cursor()

    # Templates and marks: a NULL programme here means "not yet scoped", and every
    # one of them is a BCS rubric in practice.
    cursor.execute(
        f"UPDATE `rubrics_templates` SET `programme_id` = {BCS_PROGRAMME_ID_SUBQUERY} "
        "WHERE `programme_id` IS NULL"
    )
    cursor.execute(
        f"UPDATE `rubrics_marks` SET `programme_id` = {BCS_PROGRAMME_ID_SUBQUERY} "
        "WHERE `programme_id` IS NULL"
    )

    # The active mapping is keyed per stage and must end up unique per
    # (programme, stage). Existing rows are the BCS choices.
    cursor.execute(
        f"UPDATE `rubrics_active_templates` SET `programme_id` = {BCS_PROGRAMME_ID_SUBQUERY}"
    )


def detach_rubric_rows(apps, schema_editor):
    """Reverse: leave the programme assignment empty rather than guess one."""
    cursor = schema_editor.connection.cursor()
    cursor.execute("UPDATE `rubrics_templates` SET `programme_id` = NULL")
    cursor.execute("UPDATE `rubrics_marks` SET `programme_id` = NULL")
    # `rubrics_active_templates.programme_id` is NOT NULL, so it cannot be
    # cleared; the column is dropped by the reverse of AddField instead.


# `rubrics_active_templates` was keyed on `fyp_stage`. Converting that in place is
# not expressible as a Django `AlterField` — a primary key is dropped and a new
# auto-increment column added — so the two statements are issued directly, and
# `SeparateDatabaseAndState` keeps Django's recorded model state in step without
# trying to generate the same SQL a second time.
CONVERT_ACTIVE_TEMPLATE_KEY = migrations.RunSQL(
    sql=[
        # `fyp_stage` stops being the key but stays as a plain indexed column.
        "ALTER TABLE `rubrics_active_templates` "
        "DROP PRIMARY KEY, ADD INDEX `idx_rubrics_active_fyp_stage` (`fyp_stage`)",
        # The new surrogate key. AUTO_INCREMENT requires a key, so it is declared
        # PRIMARY KEY in the same statement.
        "ALTER TABLE `rubrics_active_templates` "
        "ADD COLUMN `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST",
    ],
    reverse_sql=[
        "ALTER TABLE `rubrics_active_templates` DROP COLUMN `id`",
        "ALTER TABLE `rubrics_active_templates` "
        "DROP INDEX `idx_rubrics_active_fyp_stage`, ADD PRIMARY KEY (`fyp_stage`)",
    ],
)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_bind_programmes_and_retire_legacy'),
    ]

    operations = [
        # --- rubrics_templates -------------------------------------------------
        migrations.AddField(
            model_name='rubrictemplate',
            name='programme',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='rubric_templates',
                to='api.programme',
            ),
        ),

        # --- rubrics_marks -----------------------------------------------------
        migrations.AddField(
            model_name='rubricmarks',
            name='programme',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='rubric_marks',
                to='api.programme',
            ),
        ),

        # --- rubrics_active_templates -----------------------------------------
        # Added nullable first, tightened to NOT NULL after the data step below.
        # A `null=False` foreign key on a table that already holds rows makes the
        # ADD COLUMN fill those rows with the column's implicit default — 0 for an
        # integer — which the foreign key then rejects, because there is no
        # programme with id 0. There is no sensible column default here either:
        # the correct value is per-row, and a data migration is where that belongs.
        migrations.AddField(
            model_name='rubricactivetemplate',
            name='programme',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='active_rubric_templates',
                to='api.programme',
            ),
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[CONVERT_ACTIVE_TEMPLATE_KEY],
            state_operations=[
                # Drop the old state first: `fyp_stage` cannot be both the
                # primary key and a plain field in one model state.
                migrations.RemoveField(
                    model_name='rubricactivetemplate',
                    name='fyp_stage',
                ),
                migrations.AddField(
                    model_name='rubricactivetemplate',
                    name='id',
                    field=models.AutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                migrations.AddField(
                    model_name='rubricactivetemplate',
                    name='fyp_stage',
                    field=models.CharField(max_length=30, verbose_name='FYP Stage'),
                ),
            ],
        ),

        # --- data: attach the rows that already exist --------------------------
        migrations.RunPython(attach_existing_rubric_rows_to_bcs, detach_rubric_rows),

        # --- tighten the column now that every row holds a real programme ------
        migrations.AlterField(
            model_name='rubricactivetemplate',
            name='programme',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='active_rubric_templates',
                to='api.programme',
            ),
        ),

        # --- the rule the new key exists to express ---------------------------
        # Added after the data step so the constraint is never violated by the
        # existing rows while they are being assigned.
        migrations.AddConstraint(
            model_name='rubricactivetemplate',
            constraint=models.UniqueConstraint(
                fields=['programme', 'fyp_stage'],
                name='uniq_active_rubric_per_programme_stage',
            ),
        ),
    ]

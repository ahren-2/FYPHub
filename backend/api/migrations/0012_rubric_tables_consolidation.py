# Moves the rubric tables into `fyp_hub_db`, under the names the PHP backend
# already uses, so that `manage.py migrate` creates the complete database
# structure and no SQL dump has to be imported.
#
# Before this migration there were two competing rubrics schemas:
#   * `api_rubrictemplate` / `api_rubricmarks` in `fyp_hub_db` (created by 0009,
#     never used, always empty), and
#   * `rubrics_templates` / `rubrics_marks` / `rubrics_active_templates` in the
#     separate `rubrics_system` database, created by a phpMyAdmin dump and by
#     lazily-run CREATE TABLE IF NOT EXISTS statements in PHP.
#
# Both `api_*` tables are empty, so they are dropped and recreated under the
# PHP names. The timestamp columns are then converted to MySQL TIMESTAMP with
# DEFAULT CURRENT_TIMESTAMP (and ON UPDATE for the *_at columns) because the
# PHP scripts insert rows without supplying those values.

import django.db.models.deletion
from django.db import migrations, models


DROP_LEGACY_TABLES = [
    migrations.RunSQL(
        sql="DROP TABLE IF EXISTS `api_rubricmarks`",
        reverse_sql=migrations.RunSQL.noop,
    ),
    migrations.RunSQL(
        sql="DROP TABLE IF EXISTS `api_rubrictemplate`",
        reverse_sql=migrations.RunSQL.noop,
    ),
]

# MySQL-side defaults the PHP scripts depend on. `save_template.php`,
# `save_mark.php` and `set_active_template.php` all INSERT without naming the
# timestamp columns, and `rename_template.php` / `update_template.php` /
# `save_mark.php` UPDATE without naming `updated_at`.
PHP_COMPATIBILITY_SQL = [
    "ALTER TABLE `rubrics_templates` "
    "MODIFY `created_by` varchar(100) NOT NULL DEFAULT 'admin', "
    "MODIFY `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, "
    "MODIFY `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP "
    "ON UPDATE CURRENT_TIMESTAMP",

    "ALTER TABLE `rubrics_marks` "
    "MODIFY `evaluated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, "
    "MODIFY `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP "
    "ON UPDATE CURRENT_TIMESTAMP",

    "ALTER TABLE `rubrics_active_templates` "
    "MODIFY `updated_by` varchar(100) NOT NULL DEFAULT 'coordinator', "
    "MODIFY `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP "
    "ON UPDATE CURRENT_TIMESTAMP",
]


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_alter_fypproject_fyp_stage'),
    ]

    operations = [
        # 1. Remove the unused duplicate schema (state + empty tables).
        migrations.SeparateDatabaseAndState(
            database_operations=DROP_LEGACY_TABLES,
            state_operations=[
                migrations.DeleteModel(name='RubricMarks'),
                migrations.DeleteModel(name='RubricTemplate'),
            ],
        ),

        # 2. Recreate them under the names PHP uses.
        migrations.CreateModel(
            name='RubricTemplate',
            fields=[
                ('id', models.CharField(max_length=50, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('template_data', models.TextField()),
                ('created_by', models.CharField(default='admin', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('version', models.IntegerField(default=1)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'db_table': 'rubrics_templates',
                'ordering': ['-updated_at'],
                'indexes': [
                    models.Index(fields=['name'], name='idx_rubrics_templates_name'),
                    models.Index(fields=['created_by'], name='idx_rubric_tpl_created_by'),
                    models.Index(fields=['created_at'], name='idx_rubric_tpl_created_at'),
                ],
            },
        ),
        migrations.CreateModel(
            name='RubricMarks',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('student_id', models.CharField(max_length=50, verbose_name='Student ID')),
                ('student_name', models.CharField(max_length=255)),
                ('supervisor', models.CharField(blank=True, max_length=255, null=True)),
                ('examiner', models.CharField(blank=True, max_length=255, null=True)),
                ('project_name', models.CharField(blank=True, max_length=255, null=True)),
                ('course', models.CharField(blank=True, max_length=255, null=True)),
                ('fyp_stage', models.CharField(blank=True, max_length=20, null=True, verbose_name='FYP Stage')),
                ('marks_data', models.TextField()),
                ('section_totals', models.TextField(blank=True, null=True)),
                ('co_attainment', models.TextField(blank=True, null=True)),
                ('criterion_marks', models.TextField(blank=True, null=True)),
                ('total_score', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('evaluated_by', models.CharField(max_length=100)),
                ('evaluated_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('submitted', 'Submitted'), ('finalized', 'Finalized')], default='draft', max_length=20)),
                ('template', models.ForeignKey(db_column='template_id', on_delete=django.db.models.deletion.CASCADE, to='api.rubrictemplate')),
            ],
            options={
                'db_table': 'rubrics_marks',
                'ordering': ['-updated_at'],
                'indexes': [
                    models.Index(fields=['student_id'], name='idx_rubrics_marks_student_id'),
                    models.Index(fields=['evaluated_by'], name='idx_rubrics_marks_evaluated_by'),
                    models.Index(fields=['status'], name='idx_rubrics_marks_status'),
                    models.Index(fields=['course'], name='idx_rubrics_marks_course'),
                    models.Index(fields=['fyp_stage'], name='idx_rubrics_marks_fyp_stage'),
                ],
            },
        ),
        migrations.CreateModel(
            name='RubricActiveTemplate',
            fields=[
                ('fyp_stage', models.CharField(max_length=30, primary_key=True, serialize=False, verbose_name='FYP Stage')),
                ('updated_by', models.CharField(default='coordinator', max_length=100)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('template', models.ForeignKey(db_column='template_id', on_delete=django.db.models.deletion.CASCADE, to='api.rubrictemplate')),
            ],
            options={
                'verbose_name': 'Active rubric template',
                'verbose_name_plural': 'Active rubric templates',
                'db_table': 'rubrics_active_templates',
            },
        ),

        # 3. Restore the database-level defaults the PHP backend relies on.
        *[
            migrations.RunSQL(sql=sql, reverse_sql=migrations.RunSQL.noop)
            for sql in PHP_COMPATIBILITY_SQL
        ],
    ]

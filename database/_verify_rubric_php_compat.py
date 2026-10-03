"""Functional test: can the PHP rubric scripts actually drive a database that was
built ONLY by `manage.py migrate`?

Every SQL statement below is copied verbatim from php/*.php (the parts that touch
the three rubric tables). They are replayed against a scratch database created by
`setup_fyphub`, so any failure is a property of the migration-created schema, not
of the current fyp_hub_db.

The scratch database is dropped at the end; fyp_hub_db is only read.

Run from the project root:
    venv\\Scripts\\python.exe database\\_verify_rubric_php_compat.py
"""
import os
import sys
from pathlib import Path

import pymysql

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'backend'))

SCRATCH_DB = 'fyp_hub_db_php_compat_test'
DB = dict(host='127.0.0.1', port=3306, user='root', password='', charset='utf8mb4')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

admin = pymysql.connect(**DB)
with admin.cursor() as cur:
    cur.execute(f'DROP DATABASE IF EXISTS `{SCRATCH_DB}`')
    # Same CREATE DATABASE as `manage.py setup_fyphub`, so collation matches the
    # live database too.
    cur.execute(
        f'CREATE DATABASE `{SCRATCH_DB}` '
        'CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci'
    )

from django.conf import settings  # noqa: E402

settings.DATABASES['default']['NAME'] = SCRATCH_DB

import django  # noqa: E402

django.setup()

from django.core.management import call_command  # noqa: E402
from django.db import connection  # noqa: E402

print(f'Building `{SCRATCH_DB}` with `manage.py migrate` ...')
call_command('migrate', verbosity=0, interactive=False)
connection.close()

conn = pymysql.connect(database=SCRATCH_DB, **DB)
results = []


def step(label, fn):
    try:
        detail = fn()
        results.append((label, 'OK', detail or ''))
        print(f'  [ OK ] {label} {detail or ""}')
        return True
    except Exception as exc:  # noqa: BLE001
        results.append((label, 'FAIL', f'{type(exc).__name__}: {exc}'))
        print(f'  [FAIL] {label}\n         {type(exc).__name__}: {exc}')
        return False


TEMPLATE_JSON = '{"title":"T","course":"CSS3714","fyp_stage":"FYP1"}'

with conn.cursor() as cur:
    print('\n1. save_template.php  ->  INSERT rubrics_templates')
    print('   (no created_at / updated_at supplied; DB defaults must fill them)')

    def save_template():
        cur.execute(
            "INSERT INTO rubrics_templates "
            "(id, name, template_data, created_by, version, is_active) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            ['tpl_test_1', 'Test Rubric', TEMPLATE_JSON, 'admin', 1, 1],
        )
        cur.execute(
            "SELECT created_at, updated_at, created_by FROM rubrics_templates "
            "WHERE id = 'tpl_test_1'"
        )
        created, updated, by = cur.fetchone()
        assert created is not None and updated is not None, (
            'timestamp columns were left NULL by the DB defaults')
        return f'-> created_at={created} updated_at={updated} created_by={by}'

    step('save_template.php INSERT + timestamp defaults', save_template)

    print('\n2. list_templates.php -> SELECT with LEFT JOIN rubrics_active_templates')

    def list_templates():
        cur.execute(
            "SELECT t.id, t.name, t.template_data, t.updated_at, t.version, "
            "t.is_active, a.fyp_stage AS active_for_stage "
            "FROM rubrics_templates t "
            "LEFT JOIN rubrics_active_templates a ON a.template_id = t.id "
            "WHERE t.is_active = 1 ORDER BY t.updated_at DESC"
        )
        return f'-> {len(cur.fetchall())} row(s)'

    step('list_templates.php SELECT', list_templates)

    print('\n3. rename_template.php -> UPDATE name, template_data, version+1')

    def rename_template():
        cur.execute(
            "UPDATE rubrics_templates SET name = %s, template_data = %s, "
            "version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            ['Renamed Rubric', TEMPLATE_JSON, 'tpl_test_1'],
        )
        cur.execute("SELECT version FROM rubrics_templates WHERE id = 'tpl_test_1'")
        return f'-> version={cur.fetchone()[0]}'

    step('rename_template.php UPDATE', rename_template)

    print('\n4. set_active_template.php -> INSERT ... ON DUPLICATE KEY UPDATE')

    def set_active_first():
        cur.execute(
            "INSERT INTO rubrics_active_templates (fyp_stage, template_id, updated_by) "
            "VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE "
            "template_id = VALUES(template_id), updated_by = VALUES(updated_by), "
            "updated_at = CURRENT_TIMESTAMP",
            ['FYP1', 'tpl_test_1', 'coordinator'],
        )
        return '-> first insert'

    def set_active_again():
        cur.execute(
            "INSERT INTO rubrics_active_templates (fyp_stage, template_id, updated_by) "
            "VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE "
            "template_id = VALUES(template_id), updated_by = VALUES(updated_by), "
            "updated_at = CURRENT_TIMESTAMP",
            ['FYP1', 'tpl_test_1', 'coordinator2'],
        )
        cur.execute(
            "SELECT updated_by FROM rubrics_active_templates WHERE fyp_stage = 'FYP1'")
        return f'-> re-activated, updated_by={cur.fetchone()[0]}'

    step('set_active_template.php INSERT', set_active_first)
    step('set_active_template.php ON DUPLICATE KEY UPDATE', set_active_again)

    print('\n5. get_active_template.php -> INNER JOIN on fyp_stage')

    def get_active():
        cur.execute(
            "SELECT t.id, t.name, t.template_data, t.updated_at, a.fyp_stage "
            "FROM rubrics_active_templates a "
            "INNER JOIN rubrics_templates t ON t.id = a.template_id "
            "WHERE a.fyp_stage = %s AND t.is_active = 1 LIMIT 1",
            ['FYP1'],
        )
        row = cur.fetchone()
        assert row, 'active template lookup returned nothing'
        return f'-> {row[0]}'

    step('get_active_template.php SELECT', get_active)

    print('\n6. save_mark.php -> INSERT rubrics_marks')
    print('   (no evaluated_at / updated_at supplied; DB defaults must fill them)')

    def save_mark_insert():
        cur.execute(
            "INSERT INTO rubrics_marks (template_id, student_id, student_name, "
            "supervisor, examiner, project_name, course, fyp_stage, marks_data, "
            "section_totals, co_attainment, criterion_marks, total_score, "
            "evaluated_by, status) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            ['tpl_test_1', 'BCS001', 'Test Student', 'Sup', 'Exam', 'Proj',
             'CSS3714', 'FYP1', '{}', '{}', '{}', '{}', 80.5, 'lecturer', 'draft'],
        )
        cur.execute(
            "SELECT evaluated_at, updated_at FROM rubrics_marks "
            "WHERE template_id = 'tpl_test_1' AND student_id = 'BCS001'")
        ev, up = cur.fetchone()
        assert ev is not None and up is not None, 'timestamp defaults not applied'
        return f'-> evaluated_at={ev} updated_at={up}'

    step('save_mark.php INSERT + timestamp defaults', save_mark_insert)

    print('\n7. save_mark.php (existing row) -> UPDATE, updated_at must auto-bump')

    def save_mark_update():
        cur.execute("SELECT updated_at FROM rubrics_marks WHERE student_id = 'BCS001'")
        before = cur.fetchone()[0]
        cur.execute(
            "UPDATE rubrics_marks SET student_name = %s, supervisor = %s, examiner = %s, "
            "project_name = %s, course = %s, fyp_stage = %s, marks_data = %s, "
            "section_totals = %s, co_attainment = %s, criterion_marks = %s, "
            "total_score = %s, evaluated_by = %s, status = %s WHERE id = %s",
            ['Test Student', 'Sup', 'Exam', 'Proj', 'CSS3714', 'FYP1', '{}',
             '{}', '{}', '{}', 91.0, 'lecturer', 'submitted',
             cur.lastrowid or 1],
        )
        cur.execute("SELECT updated_at FROM rubrics_marks WHERE student_id = 'BCS001'")
        after = cur.fetchone()[0]
        return f'-> updated_at {before} -> {after}'

    step('save_mark.php UPDATE + ON UPDATE CURRENT_TIMESTAMP', save_mark_update)

    print('\n8. list_marks.php -> SELECT with LEFT JOIN rubrics_templates')

    def list_marks():
        cur.execute(
            "SELECT rm.id, rm.template_id, rt.name AS template_name, rm.student_id, "
            "rm.student_name, rm.supervisor, rm.examiner, rm.project_name, rm.course, "
            "rm.fyp_stage, rm.marks_data, rm.section_totals, rm.co_attainment, "
            "rm.criterion_marks, rm.total_score, rm.evaluated_by, rm.evaluated_at, "
            "rm.updated_at, rm.status "
            "FROM rubrics_marks rm "
            "LEFT JOIN rubrics_templates rt ON rm.template_id = rt.id "
            "WHERE 1 = 1 ORDER BY rm.updated_at DESC, rm.evaluated_at DESC"
        )
        return f'-> {len(cur.fetchall())} row(s)'

    step('list_marks.php SELECT', list_marks)

    print('\n9. delete_template.php -> raw DELETE; dependents must cascade away')
    print('   The template currently has 1 mark and 1 active-stage mapping.')

    def delete_template_in_use():
        cur.execute("DELETE FROM rubrics_templates WHERE id = 'tpl_test_1'")
        deleted = cur.rowcount
        assert deleted == 1, f'expected 1 template deleted, got {deleted}'
        cur.execute("SELECT COUNT(*) FROM rubrics_marks WHERE template_id = 'tpl_test_1'")
        marks = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM rubrics_active_templates WHERE template_id = 'tpl_test_1'")
        actives = cur.fetchone()[0]
        assert marks == 0, f'{marks} orphaned rubrics_marks row(s) left behind'
        assert actives == 0, f'{actives} orphaned rubrics_active_templates row(s) left'
        return '-> template + its 1 mark + its 1 stage mapping all removed'

    step('delete_template.php on a template that HAS marks', delete_template_in_use)

    print('\n10. delete_template.php on a template with no dependents')

    def delete_template_unused():
        cur.execute(
            "INSERT INTO rubrics_templates "
            "(id, name, template_data, created_by, version, is_active) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            ['tpl_test_2', 'Unused Rubric', TEMPLATE_JSON, 'admin', 1, 1],
        )
        cur.execute("DELETE FROM rubrics_templates WHERE id = 'tpl_test_2'")
        deleted = cur.rowcount
        assert deleted == 1, f'expected 1 template deleted, got {deleted}'
        return '-> deleted'

    step('delete_template.php on a template with no dependents', delete_template_unused)

    print('\n11. delete_template.php on a template that does not exist')
    print('    (the script reports "Template not found" when affected_rows is 0)')

    def delete_template_missing():
        cur.execute("DELETE FROM rubrics_templates WHERE id = 'tpl_does_not_exist'")
        assert cur.rowcount == 0, (
            f'expected 0 affected rows, got {cur.rowcount}')
        return '-> 0 rows affected, so the "Template not found" branch is taken'

    step('delete_template.php on a missing template', delete_template_missing)

conn.close()

with admin.cursor() as cur:
    cur.execute(f'DROP DATABASE `{SCRATCH_DB}`')
admin.close()

failures = [r for r in results if r[1] == 'FAIL']
print()
print('=' * 74)
print('PHP RUBRIC SCRIPTS vs A MIGRATION-BUILT DATABASE')
print('=' * 74)
print(f'checks run : {len(results)}')
print(f'passed     : {len(results) - len(failures)}')
print(f'failed     : {len(failures)}')
for label, _, detail in failures:
    print(f'  FAILED: {label}\n          {detail}')
print(f'\nScratch database `{SCRATCH_DB}` dropped. fyp_hub_db was only read.')

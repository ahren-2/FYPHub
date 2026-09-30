"""Verifies the fresh-install path: a brand-new database gets the complete
schema (including the rubric tables) and working seed data from `migrate` alone.

Creates a scratch database, migrates into it, checks the result, drops it.
Run from the project root:  venv\\Scripts\\python.exe database\\_verify_fresh_install.py
Safe to delete after use.
"""
import os
import sys
from pathlib import Path

import pymysql

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'backend'))

SCRATCH_DB = 'fyp_hub_db_fresh_install_test'

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django  # noqa: E402
from django.conf import settings  # noqa: E402

# Use pymysql directly: backend/backend/__init__.py aliases pymysql as MySQLdb
# for Django, and mixing the two drivers in one process breaks the handshake.
admin = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='')
with admin.cursor() as cur:
    cur.execute(f'DROP DATABASE IF EXISTS `{SCRATCH_DB}`')

settings.DATABASES['default']['NAME'] = SCRATCH_DB
django.setup()

from django.core.management import call_command  # noqa: E402
from django.db import connection  # noqa: E402

# Proves the one-command path a new user follows.
call_command('setup_fyphub', verbosity=1)

with connection.cursor() as cur:
    cur.execute('SHOW TABLES')
    tables = sorted(row[0] for row in cur.fetchall())

    expected = {'rubrics_templates', 'rubrics_marks', 'rubrics_active_templates',
                'api_rubrictemplate_absent_placeholder'}
    rubric_tables = [t for t in tables if t.startswith('rubric')]

    cur.execute('SELECT COUNT(*) FROM rubrics_templates')
    templates = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM rubrics_active_templates')
    active = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM rubrics_marks')
    marks = cur.fetchone()[0]

    cur.execute('SELECT fyp_stage, template_id FROM rubrics_active_templates ORDER BY fyp_stage')
    active_rows = cur.fetchall()

    cur.execute('SHOW COLUMNS FROM rubrics_marks')
    marks_columns = {row[0]: row for row in cur.fetchall()}

# Compare the seeded content against the live fyp_hub_db, which should be
# identical: same template JSON, and the same wall-clock timestamps (PHP shows
# these values to the user).
connection.close()
live = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='',
                       database='fyp_hub_db', charset='utf8mb4')
fresh = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='',
                        database=SCRATCH_DB, charset='utf8mb4')

template_sql = """SELECT id, name, MD5(template_data), created_by, created_at, updated_at,
                         version, is_active
                  FROM rubrics_templates ORDER BY id"""
active_sql = "SELECT fyp_stage, template_id, updated_by, updated_at FROM rubrics_active_templates ORDER BY fyp_stage"

with live.cursor() as lc, fresh.cursor() as fc:
    lc.execute(template_sql)
    live_templates = lc.fetchall()
    fc.execute(template_sql)
    fresh_templates = fc.fetchall()
    lc.execute(active_sql)
    live_active = lc.fetchall()
    fc.execute(active_sql)
    fresh_active = fc.fetchall()

live.close()
fresh.close()

print()
print('=' * 72)
print('FRESH INSTALL RESULT')
print('=' * 72)
print(f'total tables created          : {len(tables)}')
print(f'rubric tables                 : {rubric_tables}')
print(f'legacy api_rubric* present    : {[t for t in tables if t.startswith("api_rubric")] or "none"}')
print(f'seeded templates              : {templates}')
print(f'seeded active stage mappings  : {active} -> {active_rows}')
print(f'seeded marks                  : {marks}')
print(f'rubrics_marks columns         : {len(marks_columns)}')
for name in ('course', 'fyp_stage', 'section_totals', 'co_attainment', 'criterion_marks'):
    print(f'  {name:<18}: {marks_columns[name][1]}')

print()
print('seed vs live fyp_hub_db (must be identical)')
live_by_id = {row[0]: row for row in live_templates}
for row in fresh_templates:
    seed_id, name, data_hash, created_by, created_at, updated_at, version, is_active = row
    live_row = live_by_id.get(seed_id)
    identical = live_row == row
    print(f'  {seed_id:<22} identical={identical}  created_at={created_at}  updated_at={updated_at}')
print(f'  active mappings -> {fresh_active}')

problems = []
if len(rubric_tables) != 3:
    problems.append('rubric tables missing')
if templates != 2:
    problems.append(f'expected 2 seeded templates, got {templates}')
if active != 2:
    problems.append(f'expected 2 seeded active mappings, got {active}')
if marks != 0:
    problems.append(f'expected 0 seeded marks, got {marks}')
if any(t.startswith('api_rubric') for t in tables):
    problems.append('legacy api_rubric* tables still created')

# The live database legitimately holds extra (non-built-in) rows: four more
# templates, marks, and a PROPOSAL mapping. Only the shared rows must match.
live_active_by_stage = {row[0]: row for row in live_active}
for row in fresh_templates:
    if live_by_id.get(row[0]) != row:
        problems.append(f'seeded template {row[0]} differs from live')
for row in fresh_active:
    if live_active_by_stage.get(row[0]) != row:
        problems.append(f'seeded active mapping {row[0]} differs from live')

connection.close()
with admin.cursor() as cur:
    cur.execute(f'DROP DATABASE `{SCRATCH_DB}`')
admin.close()

print()
print('PROBLEMS:', problems or 'none')
print('Scratch database dropped. Existing fyp_hub_db untouched.')

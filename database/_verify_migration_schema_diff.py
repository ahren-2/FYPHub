"""Audit: does the migration chain reproduce the CURRENT live database schema?

Creates a scratch database, runs the full `migrate` chain into it, then compares
every table's SHOW CREATE TABLE plus the django_migrations ledger against the
live `fyp_hub_db`. The scratch database is dropped at the end; fyp_hub_db is only
ever read.

Run from the project root:
    venv\\Scripts\\python.exe database\\_verify_migration_schema_diff.py
Safe to delete after use.
"""
import os
import re
import sys
from pathlib import Path

import pymysql

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'backend'))

LIVE_DB = 'fyp_hub_db'
SCRATCH_DB = 'fyp_hub_db_migcheck'
DB = dict(host='127.0.0.1', port=3306, user='root', password='', charset='utf8mb4')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# AUTO_INCREMENT counters differ purely by insert history, not by schema.
NORMALISE = [
    (re.compile(r'\s*AUTO_INCREMENT=\d+'), ''),
    (re.compile(r'\s+'), ' '),
]


def read_schema(db):
    """{table: normalised SHOW CREATE TABLE} for one database."""
    conn = pymysql.connect(database=db, **DB)
    out = {}
    with conn.cursor() as cur:
        cur.execute('SHOW TABLES')
        for (table,) in cur.fetchall():
            cur.execute(f'SHOW CREATE TABLE `{table}`')
            ddl = cur.fetchone()[1]
            for pattern, repl in NORMALISE:
                ddl = pattern.sub(repl, ddl)
            out[table] = ddl.strip()
    conn.close()
    return out


def read_columns(db):
    conn = pymysql.connect(database=db, **DB)
    out = {}
    with conn.cursor() as cur:
        cur.execute(
            'SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT '
            'FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = %s '
            'ORDER BY TABLE_NAME, ORDINAL_POSITION',
            [db],
        )
        for row in cur.fetchall():
            out.setdefault(row[0], []).append(row[1:])
    conn.close()
    return out


def read_fks(db):
    """{table: set((column, referenced_table, delete_rule))}

    The ON DELETE rule is included: `php/delete_template.php` deletes templates
    with raw SQL and relies on the schema cascading, so a NO ACTION rule here is a
    real behavioural difference, not a detail.
    """
    conn = pymysql.connect(database=db, **DB)
    out = {}
    with conn.cursor() as cur:
        cur.execute(
            'SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, '
            '       r.DELETE_RULE '
            'FROM information_schema.KEY_COLUMN_USAGE k '
            'JOIN information_schema.REFERENTIAL_CONSTRAINTS r '
            '  ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA '
            ' AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME '
            " AND r.TABLE_NAME = k.TABLE_NAME "
            'WHERE k.TABLE_SCHEMA = %s AND k.REFERENCED_TABLE_NAME IS NOT NULL',
            [db],
        )
        for table, column, ref, delete_rule in cur.fetchall():
            out.setdefault(table, set()).add((column, ref, delete_rule))
    conn.close()
    return out


def read_indexes(db):
    """{table: set((index_name, column_name, non_unique))}"""
    conn = pymysql.connect(database=db, **DB)
    out = {}
    with conn.cursor() as cur:
        cur.execute(
            'SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE '
            'FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = %s',
            [db],
        )
        for table, index, column, non_unique in cur.fetchall():
            out.setdefault(table, set()).add((index, column, non_unique))
    conn.close()
    return out


# ---------------------------------------------------------------------------
# 1. Read the live schema, then build the scratch database.
# ---------------------------------------------------------------------------
print(f'Reading live schema of `{LIVE_DB}` ...')
live_schema = read_schema(LIVE_DB)
live_columns = read_columns(LIVE_DB)
live_fks = read_fks(LIVE_DB)
live_indexes = read_indexes(LIVE_DB)
print(f'  {len(live_schema)} tables')

admin = pymysql.connect(**DB)
with admin.cursor() as cur:
    cur.execute(f'DROP DATABASE IF EXISTS `{SCRATCH_DB}`')
    # Exactly what `manage.py setup_fyphub` does, so the fresh schema is
    # comparable: a bare `CHARACTER SET utf8mb4` would instead inherit the
    # server default collation (utf8mb4_0900_ai_ci) and every table would then
    # look "different" purely because of the database-level default.
    cur.execute(
        f'CREATE DATABASE `{SCRATCH_DB}` '
        'CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci'
    )

# 2. Migrate a brand-new database using only the committed migration files.
from django.conf import settings  # noqa: E402

settings.DATABASES['default']['NAME'] = SCRATCH_DB

import django  # noqa: E402

django.setup()

from django.core.management import call_command  # noqa: E402
from django.db import connection  # noqa: E402

print(f'\nRunning `migrate` into `{SCRATCH_DB}` ...')
call_command('migrate', verbosity=0, interactive=False)

with connection.cursor() as cur:
    cur.execute('SELECT app, name FROM django_migrations ORDER BY id')
    fresh_ledger = cur.fetchall()
connection.close()

# 3. Read the fresh schema and drop the scratch database.
fresh_schema = read_schema(SCRATCH_DB)
fresh_columns = read_columns(SCRATCH_DB)
fresh_fks = read_fks(SCRATCH_DB)
fresh_indexes = read_indexes(SCRATCH_DB)

with admin.cursor() as cur:
    cur.execute(f'DROP DATABASE `{SCRATCH_DB}`')
admin.close()

# ---------------------------------------------------------------------------
# 4. Report.
# ---------------------------------------------------------------------------
print()
print('=' * 74)
print('MIGRATION CHAIN vs LIVE DATABASE SCHEMA')
print('=' * 74)

live_only = sorted(set(live_schema) - set(fresh_schema))
fresh_only = sorted(set(fresh_schema) - set(live_schema))
shared = sorted(set(live_schema) & set(fresh_schema))

print(f'tables in live  : {len(live_schema)}')
print(f'tables in fresh : {len(fresh_schema)}')
print(f'tables only in live  (not created by migrations): {live_only or "none"}')
print(f'tables only in fresh (migrations create, live lacks): {fresh_only or "none"}')

ddl_diff = [t for t in shared if live_schema[t] != fresh_schema[t]]
print(f'\ntables whose DDL text differs: {len(ddl_diff)}')

# ---- structural comparison (authoritative) -------------------------------
print()
print('FOREIGN KEYS (live vs fresh, including ON DELETE rule)')
fk_problems = []
for table in shared:
    missing = sorted(live_fks.get(table, set()) - fresh_fks.get(table, set()))
    extra = sorted(fresh_fks.get(table, set()) - live_fks.get(table, set()))
    if missing or extra:
        fk_problems.append(table)
        print(f'\n  --- {table} ---')
        for col, ref, rule in missing:
            print(f'    FK in live but not in fresh : {col} -> {ref} (ON DELETE {rule})')
        for col, ref, rule in extra:
            print(f'    FK in fresh but not in live : {col} -> {ref} (ON DELETE {rule})')
if not fk_problems:
    print('  all foreign keys identical (columns, targets and delete rules)')

print()
print('INDEXES (live vs fresh)')
idx_problems = []
for table in shared:
    missing = sorted(live_indexes.get(table, set()) - fresh_indexes.get(table, set()))
    extra = sorted(fresh_indexes.get(table, set()) - live_indexes.get(table, set()))
    if missing or extra:
        idx_problems.append(table)
        print(f'\n  --- {table} ---')
        for name, col, non_unique in missing:
            print(f'    index in live only  : {name}({col}) unique={not non_unique}')
        for name, col, non_unique in extra:
            print(f'    index in fresh only : {name}({col}) unique={not non_unique}')
if not idx_problems:
    print('  all indexes identical')

# ---- column comparison ---------------------------------------------------
print()
print('COLUMNS (live vs fresh)')
col_problems = []
for table in shared:
    lc = {c[0]: c[1:] for c in live_columns.get(table, [])}
    fc = {c[0]: c[1:] for c in fresh_columns.get(table, [])}
    notes = []
    for col in sorted(set(lc) - set(fc)):
        notes.append(f'    live-only column : {col} {lc[col]}')
    for col in sorted(set(fc) - set(lc)):
        notes.append(f'    fresh-only column: {col} {fc[col]}')
    for col in sorted(set(lc) & set(fc)):
        if lc[col] != fc[col]:
            notes.append(
                f'    differs          : {col}\n'
                f'        live : {lc[col]}\n        fresh: {fc[col]}'
            )
    if notes:
        col_problems.append(table)
        print(f'\n  --- {table} ---')
        print('\n'.join(notes))
if not col_problems:
    print('  all columns identical')

# 5. Rubric-table specifics.
print()
print('-' * 74)
print('RUBRIC TEMPLATE TABLES')
print('-' * 74)
for table in ('rubrics_templates', 'rubrics_marks', 'rubrics_active_templates'):
    present = table in live_schema
    same = table in shared and table not in ddl_diff
    print(f'  {table:<26} in live={present}  ddl_matches_fresh={same}')

print(f'\n  legacy api_rubric* tables in live : '
      f'{[t for t in live_schema if t.startswith("api_rubric")] or "none"}')
print(f'  legacy api_rubric* tables in fresh: '
      f'{[t for t in fresh_schema if t.startswith("api_rubric")] or "none"}')
check = pymysql.connect(**DB)
with check.cursor() as cur:
    cur.execute("SHOW DATABASES LIKE 'rubrics_system'")
    stale = bool(cur.fetchall())
    cur.execute(
        "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s",
        [LIVE_DB],
    )
check.close()
print(f'  separate rubrics_system db present: {stale}')

# 6. Migration ledger.
print()
print('-' * 74)
print('MIGRATION LEDGER (api app)')
print('-' * 74)
with pymysql.connect(database=LIVE_DB, **DB) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM django_migrations WHERE app='api' ORDER BY id")
        applied = [r[0] for r in cur.fetchall()]
on_disk = sorted(
    p.name[:-3] for p in (ROOT / 'backend' / 'api' / 'migrations').glob('0*.py')
)
unapplied = [m for m in on_disk if m not in applied]
orphan = [m for m in applied if m not in on_disk]
print(f'  on disk : {len(on_disk)}')
print(f'  applied : {len(applied)}')
print(f'  on disk but NOT applied : {unapplied or "none"}')
print(f'  applied but NOT on disk : {orphan or "none"}')

problems = []
if live_only:
    problems.append(f'live tables no migration creates: {live_only}')
if fresh_only:
    problems.append(f'migration tables missing from live: {fresh_only}')
if col_problems:
    problems.append(f'column drift in: {col_problems}')
if fk_problems:
    problems.append(f'foreign-key drift in: {fk_problems}')
if idx_problems:
    problems.append(f'index drift in: {idx_problems}')
if ddl_diff:
    problems.append(
        f'DDL text differs in {len(ddl_diff)} table(s) with no structural '
        f'difference (cosmetic only): {ddl_diff if len(ddl_diff) <= 5 else str(len(ddl_diff)) + " tables"}'
    )
if unapplied:
    problems.append(f'unapplied migrations: {unapplied}')
if orphan:
    problems.append(f'ledger rows with no file: {orphan}')

print()
print('PROBLEMS:', problems or 'none')
print(f'Scratch database `{SCRATCH_DB}` dropped. `{LIVE_DB}` was only read.')

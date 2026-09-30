"""One-off helper: export the built-in rubrics from the live `rubrics_system`
database into backend/api/migrations/_rubric_seed_data.py.

The underscore prefix matters: Django's migration loader imports every module in
the migrations package that does not start with `_`, and requires each one to
contain a Migration class.

Run with:  venv\\Scripts\\python.exe database\\_export_rubric_seed.py
Safe to delete after use.
"""
from pathlib import Path

import pymysql

SEED_TEMPLATE_IDS = ['tpl_fyp1_marking_v7', 'tpl_fyp2_marking_v7']
SEED_ACTIVE_STAGES = ['FYP1', 'FYP2']

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / 'backend' / 'api' / 'migrations' / '_rubric_seed_data.py'

conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='',
                       database='rubrics_system', charset='utf8mb4')
cur = conn.cursor(pymysql.cursors.DictCursor)

# Read the timestamps in the server's default session time zone — do NOT force
# UTC. Both writers run with `@@session.time_zone = SYSTEM` (the PHP scripts, and
# Django, which leaves the session on SYSTEM because the MySQL time_zone tables
# are not loaded), so a literal wall-clock string like '2026-05-06 15:21:19' is
# what PHP shows and what the seed migration must insert to reproduce the very
# same instant.
cur.execute("SELECT @@session.time_zone AS tz, NOW() AS now_local, UTC_TIMESTAMP() AS now_utc")
print('export session:', cur.fetchone())

placeholders = ', '.join(['%s'] * len(SEED_TEMPLATE_IDS))
cur.execute(
    f"""SELECT id, name, template_data, created_by, created_at, updated_at, version, is_active
        FROM rubrics_templates WHERE id IN ({placeholders}) ORDER BY id""",
    SEED_TEMPLATE_IDS,
)
templates = cur.fetchall()

cur.execute(
    f"""SELECT fyp_stage, template_id, updated_by, updated_at
        FROM rubrics_active_templates WHERE fyp_stage IN ({', '.join(['%s'] * len(SEED_ACTIVE_STAGES))})
        ORDER BY fyp_stage""",
    SEED_ACTIVE_STAGES,
)
active = cur.fetchall()

cur.close()
conn.close()

assert len(templates) == len(SEED_TEMPLATE_IDS), f'expected {len(SEED_TEMPLATE_IDS)} templates, got {len(templates)}'

lines = [
    '"""Built-in rubric content seeded by migration 0013 on a fresh install.',
    '',
    'Generated from the live `rubrics_system` database by',
    '`database/_export_rubric_seed.py`. Timestamps are stored as MySQL',
    "wall-clock strings in the server's default session time zone (SYSTEM),",
    'which is how both PHP and Django write and read these TIMESTAMP columns.',
    '',
    'The seed migration never overwrites an existing row, so a deployment that',
    'already has these templates keeps its own (possibly edited) copies.',
    '"""',
    '',
    'OFFICIAL_TEMPLATES = [',
]
for row in templates:
    lines.append('    {')
    for field in ('id', 'name', 'template_data', 'created_by'):
        lines.append(f'        {field!r}: {row[field]!r},')
    lines.append(f"        'created_at': {str(row['created_at'])!r},")
    lines.append(f"        'updated_at': {str(row['updated_at'])!r},")
    lines.append(f"        'version': {int(row['version'])},")
    lines.append(f"        'is_active': {bool(row['is_active'])!r},")
    lines.append('    },')

lines.append(']')
lines.append('')
lines.append('ACTIVE_TEMPLATES = [')
for row in active:
    lines.append('    {')
    lines.append(f"        'fyp_stage': {row['fyp_stage']!r},")
    lines.append(f"        'template_id': {row['template_id']!r},")
    lines.append(f"        'updated_by': {(row['updated_by'] or 'coordinator')!r},")
    lines.append(f"        'updated_at': {str(row['updated_at'])!r},")
    lines.append('    },')
lines.append(']')
lines.append('')

TARGET.write_text('\n'.join(lines), encoding='utf-8')
print('wrote', TARGET, TARGET.stat().st_size, 'bytes')
print('templates:', [(t['id'], len(t['template_data'])) for t in templates])
print('active:', [(a['fyp_stage'], a['template_id']) for a in active])

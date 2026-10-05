"""Report the state of the live development database, for handover checks.

Run:  .\\venv\\Scripts\\python.exe database\\_db_state_report.py

Read-only. Answers three questions a handover needs:

  * what schema revision the live database is actually at, versus the code;
  * what it contains (row counts per area), so a dump can be compared against it;
  * whether the newest dump on disk records the same revision, so a stale dump is
    caught before it is circulated.
"""

import os
import re
import sys

import pymysql

DB = dict(host="127.0.0.1", user="root", password="", database="fyp_hub_db",
          charset="utf8mb4")

REQUIRED_TABLES = (
    "auth_user", "api_profile", "api_programme", "api_fypproject", "submissions",
    "announcements", "feedback", "milestone_forms", "milestone_entries",
    "supervisor_quotas", "api_timetablebooking", "api_presentationslot",
    "rubrics_templates", "rubrics_marks", "rubrics_active_templates",
)

COUNTS = (
    ("users", "auth_user"),
    ("profiles", "api_profile"),
    ("students", "api_profile WHERE role='student'"),
    ("lecturers", "api_profile WHERE role='lecturer'"),
    ("coordinators", "api_profile WHERE role='coordinator'"),
    ("administrators", "api_profile WHERE role='admin'"),
    ("programmes", "api_programme"),
    ("projects", "api_fypproject"),
    ("submissions (TRF)", "submissions"),
    ("announcements", "announcements"),
    ("milestone forms", "milestone_forms"),
    ("bookings", "api_timetablebooking"),
    ("presentation slots", "api_presentationslot"),
    ("rubric templates", "rubrics_templates"),
    ("active rubric mappings", "rubrics_active_templates"),
    ("rubric marks", "rubrics_marks"),
)


def migrations_in_code(repo_root):
    """(app, name) pairs on disk, per app folder."""
    found = []
    mig_dir = os.path.join(repo_root, "backend", "api", "migrations")
    for name in sorted(os.listdir(mig_dir)):
        if re.match(r"^\d{4}_", name) and name.endswith(".py"):
            found.append(name[:-3])
    return found


def dumps_with_revision(root):
    """Every .sql file under the repository, with the newest api migration it records."""
    hits = []
    for folder, _dirs, files in os.walk(root):
        if any(part in folder for part in ("node_modules", "venv", ".git")):
            continue
        for name in files:
            if not name.lower().endswith(".sql"):
                continue
            path = os.path.join(folder, name)
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as handle:
                    text = handle.read()
            except OSError:
                continue
            applied = re.findall(r"api',\s*'(\d{4}_[a-z0-9_]+)'", text)
            if not applied:
                applied = re.findall(r"api\\?',\s*\\?'(\d{4}_[a-z0-9_]+)\\?'", text)
            hits.append((path, max(applied) if applied else None,
                         len(text), os.path.getmtime(path)))
    return hits


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    print("=== code ===")
    code = migrations_in_code(repo_root)
    print(f"migrations on disk : {len(code)}")
    print(f"schema head in code: {code[-1] if code else '?'}")

    print()
    print("=== live database ===")
    try:
        conn = pymysql.connect(**DB)
    except Exception as exc:                                # noqa: BLE001
        print(f"could not connect to {DB['database']} on {DB['host']}: {exc}")
        print("Start MySQL (Laragon -> Start All) and run this again.")
        return 2
    cur = conn.cursor()
    cur.execute("SELECT VERSION()")
    print(f"server version     : {cur.fetchone()[0]}")
    cur.execute("SELECT name FROM django_migrations WHERE app='api' ORDER BY id")
    applied = [row[0] for row in cur.fetchall()]
    print(f"migrations applied : {len(applied)}")
    print(f"schema head live   : {applied[-1] if applied else '(none)'}")

    missing = [m for m in code if m not in applied]
    if missing:
        print(f"NOT APPLIED        : {', '.join(missing)}")
    else:
        print("NOT APPLIED        : none - live matches the code")

    cur.execute("""SELECT table_name FROM information_schema.tables
                   WHERE table_schema=%s ORDER BY table_name""", (DB["database"],))
    tables = [row[0] for row in cur.fetchall()]
    print(f"tables             : {len(tables)}")
    absent = [t for t in REQUIRED_TABLES if t not in tables]
    print(f"expected tables missing: {absent or 'none'}")

    print()
    print("=== contents ===")
    for label, expr in COUNTS:
        table, _, where = expr.partition(" WHERE ")
        sql = f"SELECT COUNT(*) FROM {table}" + (f" WHERE {where}" if where else "")
        try:
            cur.execute(sql)
            print(f"  {label:<24}: {cur.fetchone()[0]}")
        except Exception as exc:                            # noqa: BLE001
            print(f"  {label:<24}: (query failed: {exc})")

    print()
    print("=== accounts with no full name (migration 0024 leaves these alone) ===")
    cur.execute("SELECT COUNT(*) FROM api_profile WHERE full_name IS NULL OR full_name=''")
    print(f"  blank full_name          : {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM api_profile WHERE programme_id IS NULL")
    print(f"  no programme (sees nothing): {cur.fetchone()[0]}")
    conn.close()

    print()
    print("=== dumps on disk ===")
    for path, rev, size, _mtime in sorted(dumps_with_revision(repo_root),
                                          key=lambda item: item[3], reverse=True):
        rel = os.path.relpath(path, repo_root)
        print(f"  {rel:<62} {size/1024:>9,.0f} KB  newest api migration: {rev or '(none)'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

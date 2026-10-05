"""Verify that a handover dump restores cleanly, and report what it carries.

Run:  .\\venv\\Scripts\\python.exe database\\_verify_handover_dump.py [dump.sql]

With no argument, the newest dump in database/handover/ is used.

What this checks, and why it is not "does it equal the live database": the handover
dump is the FULL working dataset (59 accounts at the last rebuild) while the
development database is a pruned copy (37 accounts). Their row counts are meant to
differ, and a check that demanded equality would fail on a perfectly good dump.

So the checks that matter are:

  * the dump restores into a scratch database without error, and produces the
    expected tables;
  * its django_migrations ledger is readable, so a recipient knows the revision and
    whether `manage.py migrate` must follow the restore (it must, when the ledger
    is behind the code);
  * the credential columns are present, because a handover dump is credential
    material and anyone circulating it should be told so.

The scratch database is created, filled, inspected and dropped. The live database
is never touched.
"""

import os
import re
import subprocess
import sys

import pymysql

SCRATCH = "fyp_hub_db_dump_check"
HOST, USER, PASSWORD = "127.0.0.1", "root", ""

EXPECTED_TABLES = (
    "auth_user", "api_profile", "api_programme", "api_fypproject", "submissions",
    "announcements", "feedback", "milestone_forms", "milestone_entries",
    "supervisor_quotas", "api_timetablebooking", "api_presentationslot",
    "rubrics_templates", "rubrics_marks", "rubrics_active_templates",
    "django_migrations",
)

# Reported as counts only: these are the numbers a recipient should expect to see.
CONTENT_REPORT = (
    ("accounts", "auth_user"),
    ("profiles", "api_profile"),
    ("programmes", "api_programme"),
    ("projects", "api_fypproject"),
    ("TRF submissions", "submissions"),
    ("rubric templates", "rubrics_templates"),
    ("active rubric mappings", "rubrics_active_templates"),
    ("rubric marks", "rubrics_marks"),
    ("presentation slots", "api_presentationslot"),
    ("bookings", "api_timetablebooking"),
)


def connect(database=None, autocommit=True):
    return pymysql.connect(host=HOST, user=USER, password=PASSWORD,
                           database=database, charset="utf8mb4",
                           autocommit=autocommit)


def newest_handover_dump(repo_root):
    folder = os.path.join(repo_root, "database", "handover")
    if not os.path.isdir(folder):
        return None
    files = [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith(".sql")]
    if not files:
        return None
    # Prefer a revision-tagged handover dump, then the most recently written file.
    tagged = [f for f in files if re.search(r"rev\d{4}", os.path.basename(f))]
    pool = tagged or files
    return max(pool, key=os.path.getmtime)


def code_head(repo_root):
    mig_dir = os.path.join(repo_root, "backend", "api", "migrations")
    names = sorted(n[:-3] for n in os.listdir(mig_dir)
                   if re.match(r"^\d{4}_", n) and n.endswith(".py"))
    return names[-1] if names else None


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dump = sys.argv[1] if len(sys.argv) > 1 else newest_handover_dump(repo_root)
    if not dump or not os.path.isfile(dump):
        print("no dump given and none found in database/handover/")
        return 2

    print(f"dump                  : {os.path.relpath(dump, repo_root)}")
    print(f"size                  : {os.path.getsize(dump)/1024:,.0f} KB")
    print(f"schema head in code   : {code_head(repo_root)}")

    text = open(dump, "r", encoding="utf-8", errors="replace").read()
    ledger = [name for _app, name in re.findall(r"'(api)',\s*'(\d{4}_[a-z0-9_]+)'", text)]
    dump_head = max(ledger) if ledger else None
    print(f"ledger head in dump   : {dump_head or '(ledger not included)'}")
    print(f"CREATE TABLE stmts    : {len(re.findall(r'CREATE TABLE', text))}")
    print(f"INSERT stmts          : {len(re.findall(r'INSERT INTO', text))}")

    conn = connect()
    cur = conn.cursor()
    cur.execute(f"DROP DATABASE IF EXISTS {SCRATCH}")
    cur.execute(f"CREATE DATABASE {SCRATCH} CHARACTER SET utf8mb4 "
                f"COLLATE utf8mb4_general_ci")
    conn.close()

    with open(dump, "r", encoding="utf-8", errors="replace") as handle:
        proc = subprocess.run(["mysql", "-h", HOST, "-u", USER, SCRATCH],
                              stdin=handle, capture_output=True, text=True)
    print(f"\nrestore exit code     : {proc.returncode}")
    if proc.stderr and proc.stderr.strip():
        print(f"restore stderr        : {proc.stderr.strip()[:400]}")

    problems = []
    if proc.returncode != 0:
        problems.append("the dump did not restore")

    scratch = connect(SCRATCH)
    sc = scratch.cursor()
    sc.execute("""SELECT table_name FROM information_schema.tables
                  WHERE table_schema=%s""", (SCRATCH,))
    present = {row[0] for row in sc.fetchall()}
    absent = [t for t in EXPECTED_TABLES if t not in present]
    print(f"tables created        : {len(present)}")
    if absent:
        problems.append(f"tables missing after restore: {', '.join(absent)}")

    print("\nwhat the dump carries:")
    for label, table in CONTENT_REPORT:
        try:
            sc.execute(f"SELECT COUNT(*) FROM {table}")
            print(f"  {label:<24}: {sc.fetchone()[0]}")
        except Exception as exc:                            # noqa: BLE001
            problems.append(f"could not count {table}: {exc}")

    try:
        sc.execute("SELECT COUNT(*) FROM auth_user WHERE password <> ''")
        hashes = sc.fetchone()[0]
        sc.execute("SELECT COUNT(*) FROM api_profile WHERE visible_password <> ''")
        cleartext = sc.fetchone()[0]
        print("\ncredentials in the dump (expected for a handover dump):")
        print(f"  password hashes         : {hashes}")
        print(f"  readable passwords      : {cleartext}")
        print("  treat this file as credential material - see the manual, "
              "Chapter 16")
    except Exception as exc:                                # noqa: BLE001
        print(f"\n(credential columns could not be read: {exc})")

    scratch.close()
    conn = connect()
    conn.cursor().execute(f"DROP DATABASE {SCRATCH}")
    conn.close()
    print(f"\nscratch database {SCRATCH} dropped; live database untouched")

    if problems:
        print("\nPROBLEMS:")
        for item in problems:
            print(f"  - {item}")
        return 1

    if dump_head and code_head(repo_root) and dump_head != code_head(repo_root):
        print(f"\nNOTE: the dump's ledger stops at {dump_head} while the code is at "
              f"{code_head(repo_root)}.")
        print("      A recipient must run `manage.py migrate` after restoring. That is")
        print("      normal for a dump taken before a later migration, and the reason the")
        print("      migration ledger is included in the dump at all.")
    else:
        print("\nThe dump's ledger matches the code, so no follow-up migrate is needed.")

    print("\nOK: the dump restores cleanly.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

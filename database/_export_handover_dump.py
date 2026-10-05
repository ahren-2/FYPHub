"""Export the live database as the handover dump, and verify what was written.

Run:  .\\venv\\Scripts\\python.exe database\\_export_handover_dump.py [--suffix NAME]

Writes database/handover/fyp_hub_db_handover_rev<NNNN>_<YYYYMMDD>.sql

Three things this does that a hand-written mysqldump command gets wrong:

  * it asks mysqldump for --result-file, so the file is written by mysqldump
    itself. Redirecting with PowerShell's ">" produces UTF-16 with a byte-order
    mark, which MySQL then refuses to restore with
    "ASCII '\\0' appeared in the statement";
  * the revision in the file name is read from the code's own migration list
    rather than typed in, so a dump cannot be mislabelled as current when the code
    has moved on. Only the date is taken from today's clock;
  * it reads the file back and checks the encoding, the statement counts and the
    migration ledger before reporting success.
"""

import os
import re
import subprocess
import sys
from datetime import date

import pymysql

DB = "fyp_hub_db"
HOST, USER, PASSWORD = "127.0.0.1", "root", ""

# Dumped explicitly rather than with --all-databases: this is the application's own
# tables, and naming them keeps the file free of MySQL 8 system views.
TABLES = (
    "auth_user", "auth_group", "auth_permission",
    "auth_user_groups", "auth_user_user_permissions", "auth_group_permissions",
    "django_content_type", "django_admin_log", "django_migrations", "django_session",
    "api_programme", "api_profile", "api_fypproject", "api_presentationday",
    "api_venue", "api_presentationslot", "api_timetablebooking", "api_timetableslot",
    "api_timetableslot_examiners", "api_lecturerpreference",
    "announcements", "feedback", "submissions", "milestone_forms",
    "milestone_entries", "supervisor_quotas",
    "rubrics_templates", "rubrics_marks", "rubrics_active_templates",
)


def code_head(repo_root):
    mig_dir = os.path.join(repo_root, "backend", "api", "migrations")
    names = sorted(n[:-3] for n in os.listdir(mig_dir)
                   if re.match(r"^\d{4}_", n) and n.endswith(".py"))
    return names[-1] if names else "0000_unknown"


def revision_number(head):
    match = re.match(r"^(\d{4})", head or "")
    return match.group(1) if match else "0000"


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    head = code_head(repo_root)
    rev = revision_number(head)
    suffix = ""
    if "--suffix" in sys.argv:
        suffix = "_" + sys.argv[sys.argv.index("--suffix") + 1]

    stem = f"fyp_hub_db_handover_rev{rev}_{date.today():%Y%m%d}{suffix}.sql"
    out_dir = os.path.join(repo_root, "database", "handover")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, stem)

    print(f"code schema head : {head}")
    print(f"writing          : {os.path.relpath(out_path, repo_root)}")

    if os.path.exists(out_path):
        os.remove(out_path)

    cmd = ["mysqldump", "-h", HOST, "-u", USER,
           "--single-transaction", "--default-character-set=utf8mb4",
           "--no-tablespaces", "--routines", "--triggers", "--skip-add-locks",
           f"--result-file={out_path}", DB, *TABLES]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(f"mysqldump FAILED (exit {proc.returncode})")
        print((proc.stderr or "").strip()[:600])
        return 1
    if proc.stderr and proc.stderr.strip():
        print(f"mysqldump notes  : {proc.stderr.strip()[:300]}")

    # Read the file back and check it is a restorable dump, not UTF-16 soup.
    raw = open(out_path, "rb").read()
    print(f"\nsize             : {len(raw):,} bytes")
    print(f"first bytes      : {raw[:4].hex(' ')}")
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        print("FAILED: the file is UTF-16 (byte-order mark present); "
              "MySQL will refuse it")
        return 1
    if raw[:3] == b"\xef\xbb\xbf":
        print("note: file starts with a UTF-8 byte-order mark")

    text = raw.decode("utf-8", errors="replace")
    creates = len(re.findall(r"CREATE TABLE", text))
    inserts = len(re.findall(r"INSERT INTO", text))
    ledger = [name for _app, name in
              re.findall(r"'(api)',\s*'(\d{4}_[a-z0-9_]+)'", text)]
    dump_head = max(ledger) if ledger else None
    print(f"CREATE TABLE     : {creates}")
    print(f"INSERT stmts     : {inserts}")
    print(f"ledger head      : {dump_head or '(not present)'}")

    problems = []
    if creates == 0 or inserts == 0:
        problems.append("the file has no CREATE TABLE or INSERT statements")
    if dump_head != head:
        problems.append(f"the dump's ledger head is {dump_head}, code is {head}")

    conn = pymysql.connect(host=HOST, user=USER, password=PASSWORD,
                           database=DB, charset="utf8mb4")
    cur = conn.cursor()
    print("\nrow counts written (from the live database):")
    for table in ("auth_user", "api_profile", "api_programme", "api_fypproject",
                  "submissions", "rubrics_templates", "rubrics_marks"):
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            print(f"  {table:<24}: {cur.fetchone()[0]}")
        except Exception:                                   # noqa: BLE001
            pass
    conn.close()

    if problems:
        print("\nPROBLEMS:")
        for item in problems:
            print(f"  - {item}")
        return 1

    print(f"\nOK: {stem} written and self-checked.")
    print("Next: .\\venv\\Scripts\\python.exe database\\_verify_handover_dump.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())

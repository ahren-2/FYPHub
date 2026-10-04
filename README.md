# FYPHub

Final Year Project Hub — a web based system for managing FYP students, projects,
timetables, milestones and rubric-based assessment.

| | |
|---|---|
| **Repository** | <https://github.com/ahren-2/FYPHub.git> |
| **Verified against** | Python 3.11.7 · Django 5.2.8 · Node v26.7.0 / npm 12.0.2 · PHP 8.2.26 · MySQL 8.0.30 · Laragon 6.0.0 (phpMyAdmin 5.2.0) · Git 2.47.0 |
| **Database schema head** | `api/0024_alter_profile_full_name_required` (24 migrations) |
| **Full setup guide** | [`NEW_ENVIRONMENT_SETUP_final.md`](NEW_ENVIRONMENT_SETUP_final.md) — every step, verified command output, all alternatives |

This README is the **quick start**: get a fresh clone running. Anything marked
*→ full guide* is covered in depth in `NEW_ENVIRONMENT_SETUP_final.md`.

## There is a file named Comments & Suggestions, inside the file contains suggestions for future work that has not been completed as of handover date. Please refer to it.

---

## Read this first — three traps that cost the most time

1. **The database must be MySQL 8.** SQLite and PostgreSQL will **not** work. Eight
   migrations issue raw MySQL SQL (backticked identifiers, `ALTER TABLE ... MODIFY`,
   `AUTO_INCREMENT`, `DROP FOREIGN KEY`, `DROP PRIMARY KEY`, `information_schema.KEY_COLUMN_USAGE`),
   and the PHP sidecar uses `mysqli`. 5.7 is not sufficient either.
   *→ full guide §4.5*
2. **The machine clock must be Malaysia time (UTC+8).** Django runs with `USE_TZ = False`,
   so Python reads wall-clock time from Windows. Settings → Time & language → Date & time →
   Time zone → `(UTC+08:00) Kuala Lumpur`, then reboot. A `TZ` environment variable does
   **not** fix this on Windows. *→ full guide §2.1*
3. **The schema is built by migrations; the data is restored from a dump. Those are two
   different jobs.** Never import the old `.sql` files in the repo root.
   *→ full guide §4.4*

---

## 1. What you are launching

Four moving parts — three of them separate local processes that must run **at the same time**:

| # | Part | Technology | Local URL | Source |
|---|---|---|---|---|
| 1 | Database | MySQL 8 | `127.0.0.1:3306` | `database/` |
| 2 | Backend API | Django 5.2 + DRF (JWT) | `http://127.0.0.1:8000` | `backend/` |
| 3 | Frontend SPA | React 19 (CRA 5) | `http://localhost:3000` | `frontend/` |
| 4 | Rubric sidecar | Plain PHP 8 over `mysqli` | `http://localhost/php` | `php/` |

Django and the PHP scripts read and write the **same** database, `fyp_hub_db` — there is no
second database. Django owns users, programmes, projects, timetables, milestones and
announcements; PHP owns the rubric templates, rubric marks, and per-stage active templates.
The migrations build **29 tables** and seed 9 rubric templates plus 8 active stage mappings
on a fresh install.

---

## 2. Prerequisites

| Software | Minimum | Where to get it |
|---|---|---|
| **Git** | 2.x | <https://git-scm.com/download/win> |
| **Laragon** (MySQL + Apache + PHP + phpMyAdmin) | 6.0 | <https://laragon.org/download/> — take **Laragon Full**, not Lite |
| **Python** | 3.10 (use 3.11.x) | <https://www.python.org/downloads/windows/> — tick *Add python.exe to PATH* |
| **Node.js** | 18 LTS | <https://nodejs.org/en/download> — the **LTS** `.msi` |
| **MySQL** *(only instead of Laragon)* | 8.0 | <https://dev.mysql.com/downloads/mysql/> — *→ full guide §4.3* |
| **phpMyAdmin** *(only if Laragon Full lacks it)* | 5.2 | <https://www.phpmyadmin.net/downloads/> — *→ full guide §4.2* |

> **Node caution.** `react-scripts` 5.0.1 is a 2022 release that predates Node 18. It *is*
> verified working on Node v26.7.0, but if `npm start` dies with an `ERR_OSSL` / OpenSSL
> error, install Node 18 or 20 LTS specifically for the frontend.

**What a fresh clone does not contain** — all of this is expected, not a broken clone:

| Missing | Size | Created by |
|---|---|---|
| `venv/` | ~210 MB | Step 2 |
| `frontend/node_modules/` | ~400 MB | Step 8 |
| `backend/client_secret.json` | small | You, only for Google Sheets export |

So `manage.py is not recognised`, or `venv\Scripts\python.exe not found`, after cloning means
the venv has simply not been created yet.

---

## 3. Quick start

All commands are **PowerShell**, run from the repository root (the folder holding `backend/`,
`frontend/`, `php/`) unless a `cd` is shown. `cd ..` as many times as you went in to get back
to the root.

### Step 0 — Clone

```powershell
git clone https://github.com/ahren-2/FYPHub.git
cd FYPHub
```

### Step 1 — Start MySQL in Laragon

1. Launch **Laragon as administrator** (right-click the shortcut → **Properties** →
   **Compatibility** → *Run this program as an administrator*, then restart the PC so it
   sticks). This is required: Laragon must register and start MySQL and Apache as **Windows
   services**, which a normal account may not do. *→ full guide §4.2*
2. Click **Start All** — the MySQL and Apache buttons turn green.

```powershell
mysql -h 127.0.0.1 -u root -e "SELECT VERSION();"
```

> If `mysql` is not recognised, use Laragon's **Terminal** button (it puts MySQL and PHP on
> `PATH` for that window) or call the client by full path, e.g.
> `C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe`.

### Step 2 — Create the venv and install backend dependencies

```powershell
py -3.11 -m venv venv              # or: python -m venv venv

cd venv\Scripts
./activate                         # prompt now starts with (venv)

cd ..\..                           # back to the project root
cd backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cd ..
```

Without activating anything (safer in a brand-new terminal):

```powershell
cd backend
..\venv\Scripts\python.exe -m pip install --upgrade pip
..\venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
```

- `Activate.ps1` is the PowerShell script; `activate` is for Git Bash, `activate.bat` for
  `cmd.exe`. If PowerShell blocks it — *"running scripts is disabled on this system"* — run
  `Set-ExecutionPolicy -Scope Process RemoteSigned` in that window, then activate again.
- **`pip install` may fail building `mysqlclient` — that is not fatal.** The project runs on
  **PyMySQL** (`backend/backend/__init__.py` calls `pymysql.install_as_MySQLdb()`). Install
  the rest and drop that one line. *→ full guide §8*

### Step 3 — Build the schema (creates the database + runs all 24 migrations)

```powershell
cd backend
python manage.py setup_fyphub       # or: ..\venv\Scripts\python.exe manage.py setup_fyphub
python manage.py check
python manage.py showmigrations api
cd ..
```

- `Can't connect to MySQL server` → Laragon is not running MySQL. Start it and retry.
- `check` must report **no issues**, and `showmigrations api` must end at:

```
 [X] 0021_sync_rubric_payload_titles
 [X] 0022_backfill_mark_course_and_stage
 [X] 0023_admin_role_and_account
 [X] 0024_alter_profile_full_name_required
```

- Equivalent by hand: create a database named `fyp_hub_db` with collation
  `utf8mb4_general_ci` in phpMyAdmin (`root` / empty password), then `python manage.py migrate`.
  If Laragon's **Database** button does not open phpMyAdmin, add it via *Menu → Tools → Quick
  Add → phpMyAdmin*.

### Step 4 — Get your logins

**Path A — clean install (Steps 1–3 only), recommended.** You have a correct but empty
database. Migration `0023` seeds the admin account automatically:

| | |
|---|---|
| Username | `admin` |
| Password | `password1` |
| Role | `admin` — sees **User Management** only, spans every programme |

**Path B — restore the working dataset**, if you have `database/handover/fyp_hub_db_handover.sql`
(this checkout does ship it). Restore it *after* Step 3:

```powershell
Get-Content database/handover/fyp_hub_db_handover.sql -Raw | mysql -h 127.0.0.1 -u root fyp_hub_db

cd backend
python manage.py migrate                  # CRITICAL — see note below
python manage.py showmigrations api       # must now end at 0024
cd ..
```

> **The dump is at migration `0016`; the code is at `0024`. Re-running `migrate` is not
> optional** — skipping it leaves the rubric tables unscoped, marks without a course/stage,
> and the `admin` account missing. `0017`–`0024` are functional data migrations.
> Because PowerShell does not support `<` redirection, pipe with `Get-Content -Raw` as shown.
> The restored accounts include 38 students, 12 lecturers and 6 coordinators; look up working
> passwords in **User Management** (`api_profile.visible_password` stores them in plain text
> by design). *→ full guide §4.4*

### Step 5 — Seed students and projects (optional, not recommended)

Two workbooks ship in `backend/`: `students_data.xlsx` and `slots_data.xlsx`. The bundled
`import_data` command is **broken in this checkout** (it still imports the `Course` model,
renamed to `Programme` in migration `0006`), so use instead:

- **Excel upload** — coordinator-only `POST /upload-excel/`, driven from **User Management**.
  New accounts get the default password `wow12345`. Every row needs a valid programme code and
  a name, or it is rejected per-row.
- **Django admin** — create users by hand, or use *Create placeholder FYP Project for selected
  students* on the Users list page.

### Step 6 — Serve the PHP sidecar

Apache serves from `C:\laragon\www`, so the scripts must appear at `C:\laragon\www\php`.
A junction is recommended — nothing to keep in sync:

```powershell
New-Item -ItemType Junction -Path C:\laragon\www\php -Target "$PWD\php"
```

Or copy the folder by hand (the system manual's route — re-copy after every edit to `php/`,
or the served files silently drift). Delete `C:\laragon\www\php` first if it exists as a real
folder; a junction cannot be created over it. No credentials to configure —
`php/db_config.php` already points at `fyp_hub_db` with `root` / empty password on
`127.0.0.1:3306`. *→ full guide §5*

### Step 7 — Start the Django API (terminal 1, leave running)

```powershell
cd backend
python manage.py runserver 127.0.0.1:8000
```

Expect `Starting development server at http://127.0.0.1:8000/`.

### Step 8 — Start the React frontend (terminal 2, leave running)

```powershell
cd frontend
npm install        # required on a fresh clone, few minutes, one-time
npm start
```

Opens `http://localhost:3000`. `npm install` warnings and audit noise are normal; only a
**failed** install matters.

### Step 9 — Verify

| Check | How | Expected |
|---|---|---|
| Django API up | `curl.exe -i http://127.0.0.1:8000/token/` | JSON body (400/401), **not** 404 |
| Schema at head | `python manage.py showmigrations api` | last line `[X] 0024_...` |
| No model drift | `python manage.py makemigrations --check --dry-run` | `No changes detected` |
| Frontend up | open `http://localhost:3000` | Sign-in page |
| Sign-in works | `admin` / `password1`, or a restored account | Role-appropriate dashboard |
| PHP sidecar | open `http://localhost/php/list_templates.php` | `{"success":true,"templates":[...]}` |
| Rubric tables | `mysql -h 127.0.0.1 -u root -e "SHOW TABLES FROM fyp_hub_db LIKE 'rubric%';"` | 3 tables |
| Rubric round-trip | **Rubrics** page → set a template active → **Assessment** as a lecturer | Marking sheet loads |
| phpMyAdmin (optional) | open `http://localhost/phpmyadmin` | Login `root` / empty; `fyp_hub_db` listed |

---

## 4. Running the whole system

Start in this order; terminals 1 and 2 stay open.

| Order | Service | Command | URL |
|---|---|---|---|
| 1 | MySQL + web server | Laragon (as administrator) → **Start All** | `http://localhost/phpmyadmin` |
| 2 | Django API | `cd backend` → `python manage.py runserver 127.0.0.1:8000` → `cd ..` | `http://127.0.0.1:8000` |
| 3 | React SPA | `cd frontend` → `npm start` | `http://localhost:3000` |
| — | PHP sidecar | served by Apache or `php -S` | `http://localhost/php` |

**Endpoints**

| Endpoint | What it is |
|---|---|
| `http://localhost:3000` | The application. Everything is done from here. |
| `http://127.0.0.1:8000/admin/` | Django admin: users, profiles, programmes, projects, milestones. |
| `http://127.0.0.1:8000/token/` | JWT token endpoint (`POST` username + password). |
| `http://localhost/php/list_templates.php` | Rubric sidecar health check. |
| `http://localhost/phpmyadmin` | Browse `fyp_hub_db` (login `root`, empty password). |

To stop: `Ctrl + C` in each terminal, then Laragon **Stop All**.

**Production-style frontend build (optional)**

```powershell
cd frontend
npm run build      # writes frontend/build/
```

The Django base URL stays hard-coded at `http://127.0.0.1:8000` in `frontend/src/api.js` (not
an env var). The PHP base URL is baked in at build time, so set `REACT_APP_PHP_API_URL`
*before* building.

**Optional features needing extra setup**

| Feature | Requirement |
|---|---|
| Google Sheets schedule export | `backend/client_secret.json` — a service-account key, **not committed**. Also needs a spreadsheet `FYP_Schedule_Sheet` shared with that service account. |
| E-mail notification of a published schedule | Gmail SMTP credentials, already in `backend/backend/settings.py`. Everything else runs without it. |

---

## 5. Database options

All paths end at the same state, because the schema is defined by the migrations either way.
**MySQL is the only supported engine** — see trap 1 above.

| Path | When to use | Where |
|---|---|---|
| **Laragon bundled MySQL** *(recommended, what the project was built on)* | Default choice — supplies MySQL, Apache, PHP and phpMyAdmin with exactly the credentials the code expects (`root`, empty password), so no config file needs editing. | full guide §4.2 |
| **Standalone MySQL 8** | You already have MySQL, or do not want Laragon's stack. You must edit **both** `settings.py` and `php/db_config.php` to your root password, and supply your own PHP-capable web server (§5.2). | full guide §4.3 |
| **MySQL in Docker** | Disposable database, Docker Desktop already installed. `mysql:8.0` on port 3306 with `MYSQL_ALLOW_EMPTY_PASSWORD=yes` — no source edits needed. Stop Laragon's MySQL first. **[not verified]** | full guide §4.6 |

**Do not install a second MySQL/Apache/PHP alongside Laragon** — that is the most common
cause of port 3306/80 conflicts. If XAMPP is installed, stop its services first. If a port is
taken, move it *and* update both config files (plus `REACT_APP_PHP_API_URL` if Apache moved).

**Dumps you must NOT import:** `fyp_hub_db sep-21 dump.sql` (repo root),
`database/recovered/*.sql`, `database/backups/*` and `database/rubrics_system.sql` all predate
migration `0012` and contain no `rubrics_*` tables. They are backups, not installation
instructions.

### PHP sidecar without Apache (alternative)

MySQL must still be running. Verified working:

```powershell
php -S 127.0.0.1:8080 -t .\php
```

Then create `frontend/.env`:

```
REACT_APP_PHP_API_URL=http://127.0.0.1:8080
```

`react-scripts` bakes `REACT_APP_*` values at **build time**, so **restart `npm start`** after
creating or changing this file.

---

## 6. Configuration reference

| Setting | File | Current value |
|---|---|---|
| DB name / user / password | `backend/backend/settings.py` (`DATABASES`) | `fyp_hub_db`, `root`, empty, `127.0.0.1:3306` |
| Same, for PHP | `php/db_config.php` | identical — **both halves must match** |
| Time zone | `settings.py` | `TIME_ZONE = 'Asia/Kuala_Lumpur'`, `USE_TZ = False`, MySQL session pinned `+08:00` |
| JWT lifetimes | `settings.py` (`SIMPLE_JWT`) | access 60 min, refresh 1 day |
| CORS | `settings.py` | `CORS_ALLOW_ALL_ORIGINS = True` |
| Full name | `Profile.full_name` (`models.py`) + `UserWriteSerializer` | **required**, never blank (`0024`); whitespace-only is rejected too |
| Django API base URL | `frontend/src/api.js` | `http://127.0.0.1:8000/` — **hard-coded** |
| PHP base URL | e.g. `frontend/src/pages/Rubrics.js` | `process.env.REACT_APP_PHP_API_URL \|\| 'http://localhost/php'` |
| Frontend env overrides | `frontend/.env` (you create it) | only `REACT_APP_*`; none ship with the repo |

Two more traps:

- **There is no `/token/refresh/` route.** The refresh token is stored but never used, so
  every user is signed out 60 minutes after signing in. This is expected.
- **`save_mark.php` is an upsert.** Posting the same `student_id` + `template_id` again
  **overwrites** the row including its marks. Always test with a throwaway student ID.

**Why PyMySQL and not mysqlclient.** `requirements.txt` lists both, but
`backend/backend/__init__.py` swaps the driver, and that shim is **load-bearing** — it also
disables the `INSERT ... RETURNING` capability this MySQL build lacks, which would otherwise
break migration `0015` and later. Do not delete those lines or "fix" the driver back to
`mysqlclient`.

---

## 7. Verification commands and tests

```powershell
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run   # "No changes detected"
python manage.py migrate --check                    # silence = nothing pending
python manage.py test                               # full test suite
cd ..

# Scratch-database fresh install: builds all 24 migrations, then drops itself.
.\venv\Scripts\python.exe database\_verify_fresh_install.py
.\venv\Scripts\python.exe database\_verify_rubric_php_compat.py
.\venv\Scripts\python.exe database\_verify_utc8.py
```

`_verify_fresh_install.py` creates and drops its own scratch database — it does **not** touch
your existing `fyp_hub_db`.

---

## 8. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `venv\Scripts\python.exe not found` / `manage.py is not recognised` | `venv/` is not committed. Create it (Step 2) and run commands from `backend/`. |
| `.\Activate.ps1 : running scripts is disabled on this system` | Run `Set-ExecutionPolicy -Scope Process RemoteSigned`, then activate again. |
| Laragon *Start All* leaves MySQL/Apache red, or they stop at once | Laragon was not started as administrator, so it could not register the Windows services. Relaunch elevated and restart the PC. |
| `http://localhost/phpmyadmin` 404 | phpMyAdmin missing or nested one folder too deep. Add it and restart Laragon. |
| `Can't connect to MySQL server` / `Unknown database 'fyp_hub_db'` | MySQL is not running, or the database was never created. Start MySQL, then `manage.py setup_fyphub`. |
| `Access denied for user 'root'@'localhost'` | Standalone MySQL with a root password, but `settings.py` **and** `php/db_config.php` were not updated. |
| `Unknown column ...` from a PHP page | Schema out of date. Run `migrate` and confirm `showmigrations api` ends at `0024`. |
| PHP returns an HTML `Fatal error: Uncaught mysqli_sql_exception` page | **The response is still HTTP 200 with a JSON content type — check the body, not the status.** A foreign-key error means a `template_id` was sent that does not exist. |
| `npm start` fails with `ERR_OSSL` / OpenSSL error | CRA 5 on too-new Node. Use Node 18 or 20 LTS. |
| Empty rubric list, or "Failed to…" | The browser cannot reach the PHP base URL. Open `http://localhost/php/list_templates.php`; if you used `php -S`, confirm `frontend/.env` and restart `npm start`. |
| "A full name is required…" when saving a user | Working as designed (`0024`). Type a real name; spaces alone are refused. |
| An account shows as its username in lists/marks tables | Its `profile.full_name` is blank — created before `0024`, or restored from the dump. The username fallback is deliberate. |
| Everything renders but every list is empty | The signed-in user has no `Profile`, or the Profile has no `Programme`. This one condition explains most empty lists and HTTP 500s. |
| Restored the dump and rubric/mark pages are broken | You skipped `manage.py migrate` after restoring. The dump is at `0016`; the code is at `0024`. |
| Users are signed out after an hour | Expected — no refresh route exists. |
| Timestamps are 8 hours out | The machine is not set to Malaysia time (UTC+8). See trap 2. |
| Port 80 / 3306 already in use | XAMPP, IIS or Skype holding it — or a Docker MySQL container beside Laragon's. Stop one, or move ports and update both config files. |
| `pip install` fails building `mysqlclient` | Not fatal — the project uses PyMySQL. |

*→ full guide §9 for the complete table, plus log file locations.*

---

## 9. Known warts in this checkout

Pre-existing, worth knowing before you conclude your setup is broken:

1. **`database/_verify_fresh_install.py` has stale assertions.** It still expects 2 seeded
   templates and 2 active mappings, so it prints a `PROBLEMS:` list on a correct install. The
   counts it prints (`9` templates, `8` mappings, 29 tables) are the correct current state.
2. **`import_data` is broken** — it imports the removed `Course` model. Use the Excel upload
   endpoint (Step 5).
3. **Some restored accounts have no full name.** `0024` made the field required going forward
   but deliberately did not invent names for existing rows; they show as their username until a
   coordinator fills the name in.
4. **Several `.pyc` files under `backend/**/__pycache__/` are still tracked** — committed before
   `.gitignore` existed. Clean up with
   `git rm -r --cached backend/api/__pycache__ backend/backend/__pycache__`.
5. **The schema head is `0024`, not `0016`.** Older documents in circulation say `0016` and
   "2 seeded templates". Trust `manage.py showmigrations api`.

---

## 10. Security — read before hosting anywhere but localhost

This is a local/campus project and is **not hardened for public hosting**:

- **The PHP sidecar has no authentication at all.** Every endpoint is open; role restrictions
  exist only in the frontend. Anyone who reaches the URL can read and overwrite rubric marks.
- `DEBUG = True`, `ALLOWED_HOSTS = []`, and the Django `SECRET_KEY` is in source.
- `Profile.visible_password` stores a **readable copy of every user's password**.
- `backend/client_secret.json` holds a Google service-account private key and `settings.py`
  holds a Gmail app password — both in plain text.
- `admin` / `password1` is a known default.
- **phpMyAdmin with `root` and an empty password** is reachable on port 80 for anyone who can
  reach the machine.

Rotate those secrets, set `DEBUG = False`, change the `admin` password, restrict phpMyAdmin, and
add authentication to the PHP layer before exposing this anywhere. (Changing the admin password
via `manage.py changepassword` only updates the hash — also update
`Profile.visible_password` from User Management → Edit, or the coordinator screens show the old
one.)

---

## 11. Where to read more

| Document | Covers |
|---|---|
| [`NEW_ENVIRONMENT_SETUP_final.md`](NEW_ENVIRONMENT_SETUP_final.md) | The authoritative setup guide: every step with observed output, all database and PHP-serving alternatives, the migration-by-migration restore notes, config reference, full troubleshooting and log locations, verification commands. |
| `SETUP_NEW_ENVIRONMENT.md` | Earlier draft of the same guide — superseded by the `_final` file. |
| `database/` | `_verify_*.py` diagnostics, plus `handover/` with the working dataset dump. |
| `php/` | The sidecar scripts (11 files) — read `db_config.php` first for the connection contract. |

> The `README.md` / `HANDOVER.md` / `README_PHP_BACKEND.md` / `API_TESTING_GUIDE.md` /
> `FYPHub_System_Manual_Revamped_v2.docx` files referenced by the full setup guide are **not in
> this checkout** — this README replaces the first of them.

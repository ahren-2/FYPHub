# FYPHub — Launching on a New PC / New Environment

Step-by-step guide to get FYPHub running from scratch on a machine that has never
seen this project.

Every command below was executed on the reference machine while writing this guide, and
the results stated are observed output, not assumptions. Where something is conventional
rather than verified here, it is marked **[not verified here]**.

- **Repository:** https://github.com/ahren-2/FYPHub.git
- **Verified against:** Python 3.11.7 · Django 5.2.8 · Node v26.7.0 / npm 12.0.2 ·
  PHP 8.2.26 · MySQL 8.0.30 · Laragon 6.0.0 (phpMyAdmin 5.2.0) · Git 2.47.0
- **Database schema head:** `api/0024_alter_profile_full_name_required` (24 migrations)
- Companion docs: `README.md` (architecture + config reference), `HANDOVER.md`
  (database handover, credentials, secrets)

> **Read this before anything else — three traps that cost the most time**
>
> 1. **The database must be MySQL.** SQLite and PostgreSQL will **not** work. Eight
>    migrations issue raw MySQL SQL — backticked identifiers, `ALTER TABLE ... MODIFY`,
>    `AUTO_INCREMENT`, `DROP FOREIGN KEY`, `DROP PRIMARY KEY`, and
>    `information_schema.KEY_COLUMN_USAGE` queries — and the PHP sidecar uses `mysqli`.
>    See [§4.5](#45-can-i-use-sqlite-or-postgresql-no).
> 2. **The machine clock must be Malaysia time (UTC+8).** `USE_TZ = False` means Python
>    reads wall-clock time from Windows. A `TZ` environment variable does **not** fix this
>    on Windows.
> 3. **The database is built by migrations, then the data is restored from a dump.** They
>    are two different jobs. Do not import the old `.sql` files in the repo root.

---

## 1. What you are launching

Four moving parts, three of them separate local processes that must run **at the same
time**:

| # | Part | Technology | Local URL | Source |
|---|---|---|---|---|
| 1 | Database | MySQL 8 | `127.0.0.1:3306` | `database/` |
| 2 | Backend API | Django 5.2 + DRF (JWT) | `http://127.0.0.1:8000` | `backend/` |
| 3 | Frontend SPA | React 19 (CRA 5) | `http://localhost:3000` | `frontend/` |
| 4 | Rubric sidecar | Plain PHP 8 over `mysqli` | `http://localhost/php` | `php/` |

The Django API and the PHP scripts read and write the **same** database, `fyp_hub_db`.
There is no second database to create. Django owns users, projects, timetables,
milestones and announcements; PHP owns the rubric templates, rubric marks and
per-stage active templates.

---

## 2. Prerequisites

| Software | Minimum | Verified on reference PC | Where to get it |
|---|---|---|---|
| **Git** | 2.x | 2.47.0.windows.1 | <https://git-scm.com/download/win> |
| **Laragon** (MySQL + Apache + PHP + phpMyAdmin) | 6.0 | **6.0.0** | <https://laragon.org/download/> — take **Laragon Full**, not Lite |
| **Python** | 3.10 | **3.11.7** | <https://www.python.org/downloads/windows/> — take the latest **3.11.x** 64-bit, tick *Add python.exe to PATH* |
| **Node.js** | 18 LTS | v26.7.0 (see caution) | <https://nodejs.org/en/download> — the **LTS** `.msi` |
| **MySQL** *(only if not using Laragon)* | 8.0 | 8.0.30 (Laragon bundle) | <https://dev.mysql.com/downloads/mysql/> — see [§4.3](#43-path-2--standalone-mysql-8-no-laragon) |
| **phpMyAdmin** *(only if Laragon Full did not bring it, you may add phpMyAdmin to Laragon, steps will be mentioned down the line)* | 5.2 | 5.2.0 | <https://www.phpmyadmin.net/downloads/> — see [§4.2](#42-path-1--laragon-bundled-mysql-recommended) step 6 |

Links, in one place:

| What | Download page |
|---|---|
| Laragon (MySQL + Apache + PHP + phpMyAdmin) | <https://laragon.org/download/> |
| Git for Windows | <https://git-scm.com/download/win> |
| Python 3.11 for Windows | <https://www.python.org/downloads/windows/> |
| Node.js LTS | <https://nodejs.org/en/download> |
| MySQL Community Server (standalone only) | <https://dev.mysql.com/downloads/mysql/> |
| phpMyAdmin (only if missing from Laragon) | <https://www.phpmyadmin.net/downloads/> |
| FYPHub repository | <https://github.com/ahren-2/FYPHub.git> |

**Node caution.** `react-scripts` 5.0.1 is a 2022 release that predates Node 18. It *is*
verified working on Node v26.7.0, but if `npm start` dies with an `ERR_OSSL` or OpenSSL
error, install Node 18 or 20 LTS specifically for the frontend.

### 2.1 Set the clock to Malaysia time — required

Django runs with `USE_TZ = False` and `TIME_ZONE = 'Asia/Kuala_Lumpur'`, so Python takes
the time from the operating system.

**Windows Settings → Time & language → Date & time → Time zone →
`(UTC+08:00) Kuala Lumpur`**, then reboot or restart the shell.

Do **not** try `$env:TZ = "Asia/Kuala_Lumpur"`. On Windows the C runtime cannot parse an
IANA name and silently falls back to UTC, which puts Python 8 hours away from MySQL. The
MySQL side is pinned per connection (`SET time_zone = '+08:00'` in both `settings.py` and
`php/db_config.php`), so only the Python/host clock is at risk.

### 2.2 What a fresh clone does *not* contain

| Missing | Size | Created by |
|---|---|---|
| `venv/` — Python virtual environment | ~210 MB | Step 2 |
| `frontend/node_modules/` — React packages | ~400 MB | Step 8 |
| `backend/client_secret.json` | small | You, if you want Google Sheets export |
| `database/backups/`, `database/recovered/` | ~1.5 MB | Old dumps kept locally; never needed for an install |

So `manage.py is not recognised` or `venv\Scripts\python.exe not found` after cloning is
**expected**, not a broken clone.

The working dataset **is** in the repository:
`database/handover/fyp_hub_db_handover_migrate0024_20261004.sql` ships with the clone, so no
separate transfer is needed. A second, older dump (`fyp_hub_db_handover.sql`) and the
pre-curation snapshot sit beside it but are gitignored.

`.gitignore` is what keeps `venv/`, `node_modules/`, `client_secret.json` and those superseded
dumps out of the repository — they are built or
supplied locally, never cloned.

---

## 3. Setup, from clone to running system

All commands are **PowerShell**, run from the repository root (the folder containing
`backend/`, `frontend/`, `php/`) unless a `cd` is shown. Each step says where it starts
and, where it matters, how to get back to the project root: **`cd ..` as many times as you
went in** — for example `cd venv\Scripts` is two levels in, so `cd ..\..` is the way back.

### Step 0 — Clone

```powershell
git clone https://github.com/ahren-2/FYPHub.git
cd FYPHub
```
You may open this project using VS Code, or other IDE as you please once the project is cloned.

### Step 1 — Start MySQL (Laragon)

Set up the database server first: **[§4](#4-database-setup-and-alternatives)**. The short
version with Laragon:

1. Launch **Laragon as administrator** — right-click the shortcut (Start menu → **Laragon**) → **Properties**, 
  → **Compatibility**, check → **Run this program as an administrator**.
   Apply changes, click OK, then restart your PC, so that Laragon will run as admin everytime you start the program. 
   
   After restart, launch Laragon or run `C:\laragon\laragon.exe` from an
   elevated PowerShell. This is required: Laragon must register and start the MySQL and
   Apache **Windows services**, which a normal user account is not allowed to do. See
   [§4.2](#42-path-1--laragon-bundled-mysql-recommended) for the one-time settings and the
   restart that makes them stick.
2. **Start All**. The MySQL and Apache buttons turn green.

Confirm the client can reach the server:

```powershell
mysql -h 127.0.0.1 -u root -e "SELECT VERSION();"
```

> If `mysql` is not recognised, either use the Laragon **Terminal** button (it puts MySQL
> and PHP on `PATH` for that window) or call the client by full path, for example
> `C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe`.

### Step 2 — Create the virtual environment and install backend dependencies

From the project root:

```powershell
py -3.11 -m venv venv
```

If the `py` launcher is missing, use: 
`python -m venv venv` with Python 3.11 on `PATH` (or other newer Python version).

If error occured again, verify your python version, and ensure is it added to PATH in environment variables


**Activate the venv (PowerShell).** The activation script lives in a subfolder, so `cd`
into it rather than reaching back with `..\`:

```powershell
cd venv\Scripts          # from the project root
./activate           # PowerShell; the prompt now starts with (venv)
```

`Activate.ps1` is the **PowerShell** script — `activate` (no extension) is for Git Bash and
`activate.bat` is for `cmd.exe`. If PowerShell refuses to run it with
*"running scripts is disabled on this system"*, allow local scripts for this window only,
then activate again:

```powershell
Set-ExecutionPolicy -Scope Process RemoteSigned
.\Activate.ps1
```

With the venv active, install the dependencies. You are still inside `venv\Scripts`, so go
up two levels to the root, then down into `backend`. In the same terminal:

```powershell
cd ..\..                 # back to the project root
cd backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Alternative (skip if above commmands work), without activating anything — call the interpreter by path from the project
root:

```powershell
cd backend
..\venv\Scripts\python.exe -m pip install --upgrade pip
..\venv\Scripts\python.exe -m pip install -r requirements.txt
```

Finish by returning to the project root, whichever route you took:

```powershell
cd ..
```

Notes:

- Either style works. `python …` needs the venv active (or `(venv)` on the prompt);
  `..\venv\Scripts\python.exe …` never needs activation, so it is the safer choice if a
  command has to work in a brand-new terminal.
- **`pip install` may fail while building `mysqlclient` — that is not fatal.** The project
  actually runs on **PyMySQL**: `backend/backend/__init__.py` calls
  `pymysql.install_as_MySQLdb()`. If `mysqlclient` fails, install the rest and drop that
  one line, or just retry; nothing else depends on it.

### Step 3 — Build the schema (creates the database and runs all 24 migrations)

This single command creates `fyp_hub_db` if missing and then migrates. From `backend/`, with
the venv active:

```powershell
cd backend
python manage.py setup_fyphub
cd ..
```
If error like: (2003, "Can't connect to MySQL server on '127.0.0.1'...) appears, it means Laragon is not running MySQL,
launch Laragon and ensure MySQL is started & running. 


Without activation, same thing from the project root (skip if command above worked):

```powershell
.\venv\Scripts\python.exe backend\manage.py setup_fyphub
```

Equivalent via phpMyAdmin: create a database named `fyp_hub_db` with collation
`utf8mb4_general_ci`, then run `python manage.py migrate`.

Verify database creation - Laragon -> Database -> phpMyAdmin login with username: "root",
password: "" (blank) -> fyp_hub_db table exists

If "Database" button click does not launch phpMyAdmin, add it to Laragon. Check using 'Menu' on Laragon, -> Tools -> Quick Add -> phpMyAdmin (not snapshot version)

Back to terminal, verify — **`check` must report no issues, and `showmigrations api` must end at `0024`**:

```powershell
cd backend (if start from project root)
python manage.py check
python manage.py showmigrations api
cd ..
```

Expected tail of `showmigrations api`:

```
 [X] 0021_sync_rubric_payload_titles
 [X] 0022_backfill_mark_course_and_stage
 [X] 0023_admin_role_and_account
 [X] 0024_alter_profile_full_name_required
```

> **Note — this output differs from `README.md` and `HANDOVER.md`.**
> Both of those documents state that head is `0016_rubric_fk_on_delete_cascade`, and that
> a fresh install seeds 2 rubric templates. That was true when they were written. As of
> the current code there are **24** migrations, and a fresh install seeds **9 templates**
> (the two V7 rubrics plus per-programme `Template FYP1`/`Template FYP2` clones) and
> **8 active stage mappings**. Verified output from a scratch-database fresh install:

```
total tables created          : 29
rubric tables                 : ['rubrics_active_templates', 'rubrics_marks', 'rubrics_templates']
seeded templates              : 9
seeded active stage mappings  : 8    (FYP1/FYP2 x BCS, BDM, BMD, BID)
seeded marks                  : 0
```

> (`database/_verify_fresh_install.py` still asserts "2 templates / 8 mappings expected",
> so it prints a `PROBLEMS:` list. Those entries are stale assertions, not schema faults —
> the sections before them report a correct install. See [§11](#11-known-warts-in-this-checkout).)

> **What migration `0024` is, and is not.** It changed `Profile.full_name` from
> `blank=True` to `blank=False` — a **validation** rule, not a column change: the column
> was already `NOT NULL`, so `0024` alters no table and cannot fail on existing rows. What
> it means in practice is that Django's own admin now refuses to save an account without a
> name, matching what the API (User Management) already enforces. Accounts created before
> the rule existed keep a blank name and stay editable so a coordinator can fill one in —
> see Step 4.

### Step 4 — Get your logins

**Path A *RECOMMENDED — — clean install (Steps 1–3 only):** you have a correct but empty database. The
`admin` account is seeded automatically by migration `0023`:

| | |
|---|---|
| Username | `admin` |
| Password | `password1` |
| Role | `admin` — sees **User Management** only, and spans every programme |

If an account named `admin` already existed, `0023` leaves its password alone and only
corrects the role.

Every role check reads `request.user.profile.role`, and **no signal creates a Profile** — a
user without one can sign in but sees an empty list on every page. This single condition is
the cause of most "everything is empty" and HTTP 500 reports.


**Path B — if `database/handover/fyp_hub_db_handover_migrate0024_20261004.sql` is present**
(it ships with this repository): remove any existing database, create a fresh empty one, then
import the dump into it. Full instructions in
**[§4.4](#44-restoring-the-working-dataset-path-b)**.

> **Important:** the dump's own migration ledger records **0024**, matching the code, so it
> restores straight in. Always run `manage.py migrate` after a restore anyway — on an older dump
> that step is what scopes the rubric tables, backfills mark course/stage, and creates the
> `admin` account.

### Step 5 — Optional, **NOT RECOMMENDED, but can be updated in future: seed students and projects

Two workbooks ship in `backend/`: `students_data.xlsx` and `slots_data.xlsx`. The bundled
management command is **broken in this checkout** (`import_data` still imports `Course`,
renamed to `Programme` in migration `0006`, so it raises `ImportError`). Instead:

- **Excel upload** — coordinator-only `POST /upload-excel/`, driven from the
  **User Management** page. New accounts get the default password `wow12345`. The sheet
  must carry a valid programme code and a name per row: rows without a programme, and
  accounts with no name, are now rejected per-row rather than created.
- **Django admin** — create users by hand, or use the *Create placeholder FYP Project for
  selected students* action on the Users list page.

### Step 6 — Serve the PHP sidecar

Set up PHP serving: **[§5](#5-serving-the-php-sidecar)**. With Laragon:

Look for a folder named "php" in this project, copy that entire folder.

Open your C drive, File Explorer -> C: -> laragon -> www ,
Paste the "php" folder into "www" folder.


If you would want to run commands;

```powershell
New-Item -ItemType Junction -Path C:\laragon\www\php -Target "$PWD\php"
```

No credentials to configure — `php/db_config.php` already points at `fyp_hub_db` with
`root` / empty password on `127.0.0.1:3306`.

### Step 7 — Start the Django API (terminal 1, leave running)

From the project root:

```powershell
cd backend
python manage.py runserver            # with the venv active
..\venv\Scripts\python.exe manage.py runserver    # without activation
cd ..
```

Expect `Starting development server at http://127.0.0.1:8000/`. Leave this terminal open.

### Step 8 — Start the React frontend (terminal 2, leave running)

```powershell

cd venv\Scripts          # from the project root
./activate

(venv) started;

cd ..\..
cd frontend
npm install     # required on a fresh clone, takes a few minutes. should be a one-time run
npm start
```

The dev server opens `http://localhost:3000`. `npm install` reports warnings and audit
noise; only a **failed** install matters.

### Step 9 — Verify the installation

| Check | How | Expected |
|---|---|---|
| Django API up | `curl.exe -i http://127.0.0.1:8000/token/` | JSON body (400/401), **not** 404 |
| Schema at head | `python manage.py showmigrations api` | last line `[X] 0024_...` |
| No model drift | `python manage.py makemigrations --check --dry-run` | `No changes detected` |
| Frontend up | open `http://localhost:3000` | Sign-in page |
| Sign-in works | `admin` / `password1`, or a restored account | Role-appropriate dashboard |
| Full name accepted | **User Management → New account** → save with the name blank | Refused with the "full name is required" message; saving with a name works |
| Lecturer nav order | sign in as a lecturer | Sidebar lists **Milestones** *before* **Assessment** |
| PHP sidecar | open `http://localhost/php/list_templates.php` | `{"success":true,"templates":[...]}` |
| phpMyAdmin (optional) | open `http://localhost/phpmyadmin` | phpMyAdmin login; `fyp_hub_db` listed on the left |
| Rubric tables | `mysql -h 127.0.0.1 -u root -e "SHOW TABLES FROM fyp_hub_db LIKE 'rubric%';"` | 3 tables: `rubrics_active_templates`, `rubrics_marks`, `rubrics_templates` |
| Rubric round-trip | **Rubrics** page → set a template active → **Assessment** as a lecturer | Marking sheet loads |

If the rubric list is empty or alerts with "Failed to…", open
`http://localhost/php/list_templates.php` directly: a 404 there means the web server is
down or the `php` link/copy is missing.

---

## 4. Database setup and alternatives

### 4.1 What the app expects

`backend/backend/settings.py` (`DATABASES['default']`):

| Setting | Value |
|---|---|
| `NAME` | `fyp_hub_db` |
| `USER` / `PASSWORD` | `root` / *(empty)* |
| `HOST` / `PORT` | `127.0.0.1` / `3306` |
| `OPTIONS` | `init_command: SET time_zone = '+08:00'` |

`php/db_config.php` must match: `DB_HOST 127.0.0.1`, `DB_PORT 3306`, `DB_USER root`,
`DB_PASS ''`, `DB_NAME fyp_hub_db`. **Both halves must point at the same database** — that
is the only invariant.

The schema itself is owned by Django migrations. Nothing needs to be created by hand;
`manage.py setup_fyphub` creates the database, and `migrate` builds all 29 tables.

### 4.2 Path 1 — Laragon bundled MySQL (recommended)

**This is what the project was built and verified on** (Laragon 6.0.0). Laragon supplies
MySQL, Apache, PHP and phpMyAdmin in one installer, with exactly the credentials the code
expects (`root`, empty password), so no configuration file needs editing.

1. Download **Laragon Full** (not Lite) — <https://laragon.org/download/>.
2. Install to the default `C:\laragon`.
3. **Run Laragon as administrator.** Right-click the desktop/Start-menu shortcut → **Run as
   administrator** (or launch `C:\laragon\laragon.exe` from an elevated PowerShell). Laragon
   has to install and start MySQL and Apache as **Windows services**, and Windows only
   allows that from an elevated process. Without it, *Start All* half-works: the buttons
   stay grey/red, or MySQL starts and stops again a second later.
4. **Restart the PC** to apply this change — the elevation and the service registration are
   the reason this reboot is needed, and it is *not* the same thing as restarting Laragon
   itself. After the restart Laragon starts normally, MySQL and Apache come up as services,
   and *Start All* turns both buttons green every time. **[not verified here]** — the reboot
   requirement is recorded as experience from the reference machine rather than something
   measured in this checkout: elevation takes effect for new processes immediately, and the
   restart is the reliable way to be certain the services are owned by the administrator
   account.
5. Optional, once only: in Laragon, *Menu › Preferences* → tick **Run Laragon when Windows
   starts** and **Auto start services** if you want MySQL/Apache up without clicking.
6. **phpMyAdmin — add it through Laragon.** Laragon Full normally brings phpMyAdmin with it
   (on the reference machine it is installed at `C:\laragon\etc\apps\phpMyAdmin`, version
   5.2.0, reachable at `http://localhost/phpmyadmin`). If **Tools → phpMyAdmin** does
   nothing, or `http://localhost/phpmyadmin` is a 404, add it:
   - Download the latest **phpMyAdmin** (English) `.zip` —
     <https://www.phpmyadmin.net/downloads/>.
   - Extract it so the folder is named exactly **`phpmyadmin`** under Laragon's app
     directory: `C:\laragon\bin\phpmyadmin` (Laragon's documented location) or
     `C:\laragon\etc\apps\phpMyAdmin` (where this machine holds it). A common mistake is a
     nested `phpmyadmin\phpMyAdmin-5.2.0-all-languages\` — fix the nesting.
   - In Laragon click **Stop**, then **Start All**, so Apache picks the new directory up.
   - Open <http://localhost/phpmyadmin>. Log in as user `root` with an **empty** password —
     that is the account the project itself uses. `fyp_hub_db` appears in the left-hand
     list once Step 3 has run.
   - If it still 404s, check Apache is serving from `C:\laragon\www` and that no second web
     server (IIS, XAMPP) holds port 80 — see the port note below.

   **[not verified here]** — phpMyAdmin is present and working on the reference machine, but
   the download-and-extract path was not re-run end to end while writing this guide; the
   folder layout comes from Laragon's own
   [Quick-add](https://laragon.org/docs/quick-add) documentation.
7. Proceed to Step 2 in [§3](#3-setup-from-clone-to-running-system).

**Do not install MySQL, Apache or PHP separately alongside it.** A second copy is the most
common reason a fresh setup fails to bind port 3306 or 80. If XAMPP is installed, stop its
Apache and MySQL services first.

If port 3306 or 80 is taken, either stop the holder (IIS, Skype, leftover XAMPP) or move
Laragon's ports under *Menu › Preferences › Services & Ports* — then update the port in
**both** `settings.py` and `php/db_config.php`, and `REACT_APP_PHP_API_URL` if you moved
Apache.

### 4.3 Path 2 — Standalone MySQL 8 (no Laragon)

Use this if you already have MySQL, or do not want Laragon's bundled stack. **MySQL
Community Server 8.0** is required; 5.7 is not sufficient.

1. Install MySQL Community Server 8.0 — <https://dev.mysql.com/downloads/mysql/>. Choose
   the **Server only** or **Custom** setup, and remember the root password you set.
2. Ensure the server is running (it registers as the Windows service `MySQL80`):
   ```powershell
   Get-Service MySQL80
   Start-Service MySQL80      # needs an elevated PowerShell
   ```
3. Create the database with the collation the project uses:
   ```powershell
   mysql -h 127.0.0.1 -u root -p -e "CREATE DATABASE IF NOT EXISTS fyp_hub_db CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
   ```
4. **Point the project at your credentials** — two files, and they must agree:

   `backend/backend/settings.py` (`DATABASES`):
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.mysql',
           'NAME': 'fyp_hub_db',
           'USER': 'root',
           'PASSWORD': 'YOUR-ROOT-PASSWORD',   # was ''
           'HOST': '127.0.0.1',
           'PORT': '3306',
           'OPTIONS': {'init_command': "SET time_zone = '+08:00'"},
       }
   }
   ```

   `php/db_config.php` (`DB_*` definitions):
   ```php
   define('DB_USER', 'root');
   define('DB_PASS', 'YOUR-ROOT-PASSWORD');   // was ''
   ```

   > Do **not** remove the `init_command` / `SET time_zone = '+08:00'` lines. They are what
   > keep MySQL and Python on the same clock.
   >
   > Tip: prefer a dedicated MySQL user over `root` — `CREATE USER 'fyphub'@'localhost'
   > IDENTIFIED BY '...'; GRANT ALL PRIVILEGES ON fyp_hub_db.* TO 'fyphub'@'localhost';` —
   > then put that user in both files.

5. **You still need a PHP-capable web server for the sidecar** — standalone MySQL gives you
   no Apache and no PHP. Use **[§5.2](#52-alternative-php-built-in-server-no-apache)**, the
   PHP built-in server. Note the dev machine had PHP 8.2.26 already on `PATH`, which is why
   that path was verified.
6. Continue from Step 3 in [§3](#3-setup-from-clone-to-running-system). `setup_fyphub` will
   find the existing database and just migrate, or create it if step 3 above was skipped.
7. If you also want phpMyAdmin on this path, install it separately
   (<https://www.phpmyadmin.net/downloads/>) and serve it from your own web server; without
   Laragon nothing creates `http://localhost/phpmyadmin` for you. **[not verified here]**

### 4.4 Restoring the working dataset (Path B)

The dump ships with the repository at
`database/handover/fyp_hub_db_handover_migrate0024_20261004.sql`. It gives you the real working
data instead of an empty database.

**The dump contains tables, not a database.** It has no `CREATE DATABASE` and no `USE` statement,
which is deliberate — it can be imported under any name and cannot clobber another schema. What
that means in practice is that the target database has to **exist** before the import runs, and
the import command has to **name** it. So Path B is three steps: remove any existing database,
create a fresh empty one, then import.

```powershell
# 1. Remove any existing database, so the import starts from a known-empty schema.
#    WARNING: DROP DATABASE deletes every table in fyp_hub_db, including any work in it.
#    Skip this line if the database does not exist yet, or if you want to keep the data.
mysql -h 127.0.0.1 -u root -e "DROP DATABASE IF EXISTS fyp_hub_db;"

# 2. Create an empty database with the collation the project uses.
mysql -h 127.0.0.1 -u root -e "CREATE DATABASE fyp_hub_db CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"

# 3. Import the dump INTO that database.
#    NOTE: PowerShell reserves '<' and does not support input redirection.
#    Pipe the file instead (works in PowerShell), and pass fyp_hub_db as the target —
#    omitting the target is how the dump ends up in the wrong schema.
Get-Content database/handover/fyp_hub_db_handover_migrate0024_20261004.sql -Raw | mysql -h 127.0.0.1 -u root fyp_hub_db

# 4. Confirm the schema is at head.
cd backend
python manage.py showmigrations api                       # the dump's ledger records 0024
python manage.py migrate                                  # applies anything still pending
cd ..                                                     # back to the project root

# 5. Sanity-check the row counts
mysql -h 127.0.0.1 -u root -e "SELECT (SELECT COUNT(*) FROM fyp_hub_db.auth_user) users, (SELECT COUNT(*) FROM fyp_hub_db.api_profile) profiles, (SELECT COUNT(*) FROM fyp_hub_db.api_fypproject) projects, (SELECT COUNT(*) FROM fyp_hub_db.rubrics_templates) templates, (SELECT COUNT(*) FROM fyp_hub_db.rubrics_marks) marks;"
```

**Step 3 is the one people get wrong.** Because the dump names no database, `mysql` without a
target argument either fails or lands the tables in whichever schema it defaults to. Always end
the line with `fyp_hub_db`.

**Why step 4 still runs.** This dump's ledger already records `0024`, so on the current code
`migrate` has nothing to do. It is not optional in general: an older dump leaves `0017`–`0024`
pending, and those are functional data migrations, not bookkeeping — skipping them leaves the
rubric tables unscoped, marks without a course or stage, and the `admin` account missing.
Verified on the reference machine by restoring the dump into a scratch database and migrating it:

```
restore result   : 29 tables, 59 users, 56 profiles, api head = 0016_rubric_fk_on_delete_cascade
migrate applied  : api.0017 ... api.0023   (7 migrations, all OK at the time of that run)
final state      : 60 users, 57 profiles, 15 templates, 4 programmes,
                   roles = 38 student / 12 lecturer / 6 coordinator / 1 admin
```

`0024` came later and adds no table, so re-running `migrate` on the restored database simply
records it as applied — the row counts above are unchanged by it.

| Migration | What it does to restored data |
|---|---|
| `0017` | Binds every account to a real programme; seeds BCS/BDM/BMD/BID; retires `General`/`None` |
| `0018` | Adds `programme_id` to the rubric tables, **scopes existing rubrics to BCS**, rekeys `rubrics_active_templates` |
| `0019` | Clones a `Template FYP1` per programme |
| `0020` | Seeds presentation days, venues and slots (the scheduler needs these) |
| `0021` | Syncs rubric payload titles with row names |
| `0022` | Backfills `course` / `fyp_stage` on marks that have them NULL |
| `0023` | Creates the `admin` account |
| `0024` | Makes `full_name` required on every account (validation only — no table change). Pre-existing blank names are left for a coordinator to fill in |

Skipping `0017`–`0023` leaves the schema four-plus migrations behind, and every PHP rubric
call can fail with `Unknown column`. Skipping only `0024` breaks nothing at runtime; it
means nothing stops a *new* account being saved without a name. See Step 4 for how to fill in
the blank ones.

The dump is **name-agnostic** (no `CREATE DATABASE` / `USE`), so it cannot clobber another
database — always pass the target on the command line.

**Accounts after restore.** The snapshot contains 38 students, 12 lecturers and 6
coordinators. Passwords are PBKDF2 hashes in `auth_user`, but
`api_profile.visible_password` stores every password **in plain text** (a deliberate
coordinator convenience from migration `0015`) — that is how you look up a working login.
Treat the dump as credential material. After restore, migration `0023` adds `admin` /
`password1`.

> **Expect a much bigger dataset than the reference machine has.** The reference database was
> pruned during development (37 users, 35 profiles). *This is the normal, expected difference
> — not a partial restore.* The dump is the full working dataset.

> **Dumps you must NOT import.** `fyp_hub_db sep-21 dump.sql` (repo root),
> `database/recovered/*.sql`, `database/backups/*` and `database/rubrics_system.sql` were all
> taken **before** migration `0012` moved the rubric tables into `fyp_hub_db`. They create
> `api_rubrictemplate` / `api_rubricmarks` and contain **no** `rubrics_*` tables, so importing
> one leaves the schema far behind and every PHP rubric endpoint fails. They are backups, not
> installation instructions.

### 4.5 Can I use SQLite or PostgreSQL? No.

**SQLite: no.** This is a conclusion from reading the migration chain, not an assumption. Eight
migrations contain MySQL-only raw SQL that SQLite cannot execute — `0012` runs
`ALTER TABLE ... MODIFY ... DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`, `0016`
queries `information_schema.KEY_COLUMN_USAGE` and issues `ALTER TABLE ... DROP FOREIGN KEY`,
`0018` rewrites a primary key with `DROP PRIMARY KEY` / `AUTO_INCREMENT`, and
`0013`, `0017`, `0020` and `0022` use backticked identifiers. `migrate` would abort partway
and leave a half-built schema. Those MySQL-specific timestamp defaults exist on purpose:
the PHP scripts `INSERT` rows without supplying those columns.

**PostgreSQL: no.** Same obstacle, plus backtick-quoted identifiers throughout, and it
matches neither `mysqli` nor the existing dump.

(If you want to confirm either for yourself, the fastest check is a scratch run of
`manage.py migrate` against a throwaway settings override — but expect it to fail on `0012`.)

**So the practical alternatives are all MySQL, differing only in how MySQL is installed and
run** — §4.2 (Laragon), §4.3 (standalone installer), and §4.6 (Docker). All three end at the
same state, because the schema is defined by the migrations either way.

### 4.6 Path 3 — MySQL in Docker

Convenient if you want a disposable database and already use Docker Desktop.
**Not verified here** — there was no Docker on the reference machine. The connection settings
all match Path 2, which was verified.

```powershell
docker run -d --name fyphub-mysql `
  -e MYSQL_ALLOW_EMPTY_PASSWORD=yes `
  -e MYSQL_DATABASE=fyp_hub_db `
  -p 3306:3306 `
  mysql:8.0 `
  --character-set-server=utf8mb4 `
  --collation-server=utf8mb4_general_ci `
  --default-time-zone=+08:00
```

Then:

- Credentials match the committed defaults (`root`, empty password), so **no source file
  needs editing** — the code already expects exactly this.
- Wait ~20 s for first-time initialisation, then check with
  `mysql -h 127.0.0.1 -u root -e "SELECT 1;"`.
- Run `manage.py setup_fyphub` as usual to build the schema.
- Container lifecycle: `docker start fyphub-mysql` / `docker stop fyphub-mysql`. Data
  persists in the container until you `docker rm` it.
- **The PHP sidecar still needs a web server** — use [§5.2](#52-alternative-php-built-in-server-no-apache).
  Since the container publishes `3306` on `127.0.0.1`, `php/db_config.php` needs no change.
- Because the server runs on port 3306 on the host, **stop Laragon's MySQL first** or the
  port will already be in use.
- This path also gives you no phpMyAdmin. Use Laragon's, or adminer/DBeaver, or install
  phpMyAdmin against the container. **[not verified here]**

---

## 5. Serving the PHP sidecar

`php/` holds 11 scripts (template CRUD, marks, active-template switching). They must be
reachable over HTTP, because the React app calls them by URL.

### 5.1 Option A — Apache via Laragon (what the project uses)

Apache serves from `C:\laragon\www`, so the scripts must appear at `C:\laragon\www\php`.
Two ways:

**Junction (recommended)** — Apache serves the repository files directly, so there is
nothing to keep in sync. Verified present on the reference machine:

```powershell
New-Item -ItemType Junction -Path C:\laragon\www\php -Target "$PWD\php"
```

**Copy** — what the system manual describes. You must re-copy after every edit to `php/`,
or the served files silently drift from the repository:

```powershell
New-Item -ItemType Directory -Force C:\laragon\www\php | Out-Null
Copy-Item .\php\*.php C:\laragon\www\php\ -Force
```

Delete `C:\laragon\www\php` first if it already exists as a real folder — a junction cannot
be created over it.

### 5.2 Alternative — PHP built-in server (no Apache)

If you are not using Laragon's Apache, PHP's built-in server is enough, and it avoids the
docroot question entirely. MySQL must still be running. **Verified working** — served
`list_templates.php` and `get_active_template.php?fyp_stage=FYP1` correctly:

```powershell
php -S 127.0.0.1:8080 -t .\php
```

Then tell the frontend where it is — create `frontend/.env`:

```
REACT_APP_PHP_API_URL=http://127.0.0.1:8080
```

`react-scripts` bakes `REACT_APP_*` values in **at build time**, so **restart `npm start`**
after creating or changing this file. Nothing else changes: the scripts still read
`fyp_hub_db` through `php/db_config.php`.

Both options verified side by side on the reference machine, returning identical JSON.

---

## 6. Running the whole system

Start in this order; terminals 1 and 2 stay open.

| Order | Service | Command | URL |
|---|---|---|---|
| 1 | MySQL + web server | Laragon (as administrator) → **Start All** | `http://localhost/phpmyadmin` |
| 2 | Django API | `cd backend` → `python manage.py runserver 127.0.0.1:8000` → `cd ..` | `http://127.0.0.1:8000` |
| 3 | React SPA | `cd frontend` → `npm start` | `http://localhost:3000` |
| — | PHP sidecar | served by Apache or `php -S` | `http://localhost/php` |

Useful endpoints:

| Endpoint | What it is |
|---|---|
| `http://localhost:3000` | The application. Everything is done from here. |
| `http://127.0.0.1:8000/admin/` | Django admin: users, profiles, programmes, projects, milestones. |
| `http://127.0.0.1:8000/token/` | JWT token endpoint (`POST` username + password). |
| `http://localhost/php/list_templates.php` | Rubric sidecar health check. |
| `http://localhost/phpmyadmin` | Browse `fyp_hub_db` (login `root`, empty password). |

To stop: `Ctrl + C` in each terminal, then Laragon **Stop All**.

### Production-style frontend build (optional)

```powershell
cd frontend
npm run build       # writes frontend/build/
```

Serve `build/` with any static file server. The Django base URL stays
`http://127.0.0.1:8000` — it is **hard-coded** in `frontend/src/api.js`, not an env var. The
PHP base URL is baked in at build time, so set `REACT_APP_PHP_API_URL` *before* building.

### Optional features needing extra setup

| Feature | Requirement |
|---|---|
| Google Sheets schedule export | `backend/client_secret.json` — a service-account key, **not committed** (`.gitignore` blocks it). Also needs a spreadsheet named `FYP_Schedule_Sheet` shared with that service account. |
| E-mail notification of a published schedule | Gmail SMTP credentials, already present in `backend/backend/settings.py`. Everything else runs without it. |

---

## 7. Configuration reference

| Setting | File | Current value |
|---|---|---|
| DB name / user / password | `backend/backend/settings.py` (`DATABASES`) | `fyp_hub_db`, `root`, empty, `127.0.0.1:3306` |
| Same, for PHP | `php/db_config.php` | identical — both halves must match |
| Time zone | `settings.py` | `TIME_ZONE = 'Asia/Kuala_Lumpur'`, `USE_TZ = False`, MySQL session pinned `+08:00` |
| JWT lifetimes | `settings.py` (`SIMPLE_JWT`) | access 60 min, refresh 1 day |
| CORS | `settings.py` | `CORS_ALLOW_ALL_ORIGINS = True` |
| Full name | `Profile.full_name` (`models.py`) + `UserWriteSerializer` | **required**, never blank (`0024`); whitespace-only is rejected too |
| Django API base URL | `frontend/src/api.js` | `http://127.0.0.1:8000/` — **hard-coded** |
| PHP base URL | pages such as `frontend/src/pages/Rubrics.js` | `process.env.REACT_APP_PHP_API_URL \|\| 'http://localhost/php'` |
| Frontend env overrides | `frontend/.env` (you create it) | only `REACT_APP_*`; none ship with the repo |

Two traps:

- **There is no `/token/refresh/` route.** The refresh token is stored but never used, so
  every user is signed out 60 minutes after signing in.
- **`save_mark.php` is an upsert.** Posting the same `student_id` + `template_id` again
  **overwrites** the row including its marks. Always test with a throwaway student ID.

---

## 8. Why the project runs on PyMySQL, not mysqlclient

`requirements.txt` lists both. Django is configured with `django.db.backends.mysql`, but
`backend/backend/__init__.py` swaps the driver:

```python
import pymysql
pymysql.install_as_MySQLdb()
BaseDatabaseWrapper.check_database_version_supported = lambda self: None
DatabaseFeatures.can_return_columns_from_insert = property(lambda self: False)
DatabaseFeatures.has_returning_insert = property(lambda self: False)
```

This shim is **load-bearing** — it also disables the `INSERT ... RETURNING` capability this
MySQL build does not support, which would otherwise break migration `0015` and later. Do
not delete those lines, and do not "fix" the driver back to `mysqlclient`.

---

## 9. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `venv\Scripts\python.exe not found` / `manage.py is not recognised` | `venv/` is not committed. Create it (Step 2) and run commands from `backend/`. |
| `.\Activate.ps1 : running scripts is disabled on this system` | PowerShell execution policy. Run `Set-ExecutionPolicy -Scope Process RemoteSigned` in that window, then `.\Activate.ps1` again. |
| `(venv)` never appears after activating | You activated a different folder's script, or ran the `cmd`/Git-Bash variant. From the project root: `cd venv\Scripts` → `.\Activate.ps1`. |
| Laragon's *Start All* leaves MySQL/Apache red, or they stop immediately | Laragon was not started as administrator, so it could not install/start the Windows services. Close it, relaunch via **Run as administrator**, and restart the PC so the change sticks ([§4.2](#42-path-1--laragon-bundled-mysql-recommended) steps 3–4). |
| `http://localhost/phpmyadmin` is a 404 | phpMyAdmin is missing or in the wrong folder. Add/download it and restart Laragon ([§4.2](#42-path-1--laragon-bundled-mysql-recommended) step 6). |
| `Can't connect to MySQL server` / `Unknown database 'fyp_hub_db'` | MySQL is not running, or the database was never created. Start your MySQL, then run `manage.py setup_fyphub`. |
| `Access denied for user 'root'@'localhost'` | You used a standalone MySQL with a root password but did not update `settings.py` **and** `php/db_config.php` ([§4.3](#43-path-2--standalone-mysql-8-no-laragon)). If you set a Laragon root password, either clear it or update both files to match. |
| `Unknown column ...` from a PHP page | Schema out of date, or built by hand from an old dump. Run `manage.py migrate` and confirm `showmigrations api` ends at `0024`. |
| PHP returns a raw HTML error page with `Fatal error: Uncaught mysqli_sql_exception` | How PHP database errors surface here. **The response is still HTTP 200 with a JSON content type — check the body, not the status.** A foreign-key error means a `template_id` was sent that does not exist. |
| `npm start` fails with `ERR_OSSL` / OpenSSL error | CRA 5 on too-new Node. Use Node 18 or 20 LTS for the frontend. |
| Frontend shows an empty rubric list or "Failed to…" | The browser cannot reach the PHP base URL. Open `http://localhost/php/list_templates.php`; a 404 means the web server is down or the `php` link/copy is missing. If you used `php -S`, confirm `frontend/.env` has `REACT_APP_PHP_API_URL` **and that you restarted `npm start`**. |
| "A full name is required…" when saving a user | Working as designed (`0024`). Type a real name — spaces alone are refused. Fill it in from **User Management → Edit**, or the Profile inline on the Django admin user page. |
| An account shows as its username in lists and marks tables | Its `profile.full_name` is blank — either created before `0024`, or restored from the dump. Give it a name; the fallback to username is deliberate, not a bug. |
| Everything renders but every list is empty | The signed-in user has no `Profile`, or the Profile has no `Programme`. One condition explains most empty lists and HTTP 500s. |
| Restored the dump and rubric/mark pages are broken | You skipped `manage.py migrate` after restoring. The dump is at `0016`; the code is at `0024`. |
| Users are signed out after an hour | Expected — no refresh route exists. |
| Timestamps are 8 hours out | The machine is not set to Malaysia time (UTC+8). See [§2.1](#21-set-the-clock-to-malaysia-time--required). |
| Port 80 / 3306 already in use | XAMPP, IIS or Skype holding it — or a Docker MySQL container running next to Laragon's. Stop one, or move ports and update both config files. |
| `pip install` fails building `mysqlclient` | Not fatal — the project uses PyMySQL ([§8](#8-why-the-project-runs-on-pymysql-not-mysqlclient)). |

Diagnostics (from `backend/`, venv active):

```powershell
cd backend
python manage.py check
python manage.py showmigrations api
python manage.py migrate --check      # silence = nothing pending
cd ..
```

Logs (Laragon paths): `C:\laragon\bin\apache\<version>\logs\error.log`,
`C:\laragon\data\mysql-8\<hostname>.err`, `C:\laragon\bin\php\<version>\php_error.log`.

---

## 10. Verification commands

```powershell
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run   # "No changes detected"
python manage.py migrate --check                    # silence = nothing pending
cd ..                                               # back to the project root

# Scratch-database fresh install: builds all 24 migrations, then drops itself.
.\venv\Scripts\python.exe database\_verify_fresh_install.py
.\venv\Scripts\python.exe database\_verify_rubric_php_compat.py
.\venv\Scripts\python.exe database\_verify_utc8.py
```

The full test suite (the latest commit added `FullNameRequiredTests` and the administrator,
programme-scope and student-record suites):

```powershell
cd backend
python manage.py test
cd ..
```

On the reference machine, `check` reports no issues, `migrate --check` is silent, and
`_verify_fresh_install.py` builds 29 tables with 9 templates. It does **not** touch your
existing `fyp_hub_db` — it creates and drops its own scratch database.

---

## 11. Known warts in this checkout

These are pre-existing and worth knowing before you conclude your setup is broken:

1. **The docs understate the migration head.** `README.md` and `HANDOVER.md` both say head
   is `0016`; the code is at `0024`. Trust `manage.py showmigrations api`.
2. **`database/_verify_fresh_install.py` has stale assertions.** It still expects 2 seeded
   templates and 2 active mappings, so it prints a `PROBLEMS:` list on a correct install.
   The counts it prints (`9` templates, `8` mappings, 29 tables) are the correct current
   state.
3. **`import_data` is broken** — it imports the removed `Course` model. Use the Excel upload
   endpoint instead (see [§3](#3-setup-from-clone-to-running-system), Step 5).
4. **`API_TESTING_GUIDE.md` has out-of-date endpoint filenames.**
5. **Some restored accounts have no full name.** `0024` made the field required going
   forward but deliberately did not invent names for existing rows, so a handful of
   pre-existing accounts still show as their username until a coordinator fills the name in.
6. **Several `.pyc` files under `backend/**/__pycache__/` are still tracked** — they were
   committed before `.gitignore` existed. Clean up with
   `git rm -r --cached backend/api/__pycache__ backend/backend/__pycache__` if you care.

### Security — read before hosting anywhere but localhost

This is a local/campus project and is **not hardened for public hosting**:

- **The PHP sidecar has no authentication at all.** Every endpoint is open; role
  restrictions exist only in the frontend. Anyone who reaches the URL can read and overwrite
  rubric marks.
- `DEBUG = True`, `ALLOWED_HOSTS = []`, and the Django `SECRET_KEY` is in source.
- `Profile.visible_password` stores a **readable copy of every user's password**.
- `backend/client_secret.json` holds a Google service-account private key, and
  `settings.py` holds a Gmail app password — both in plain text.
- `admin` / `password1` is a known default.
- **phpMyAdmin with `root` and an empty password** is reachable on port 80 for anyone who
  can reach the machine.

Rotate those secrets, set `DEBUG = False`, change the `admin` password, restrict phpMyAdmin,
and add authentication to the PHP layer before exposing this anywhere. (Changing the admin
password via `manage.py changepassword` only updates the hash — also update
`Profile.visible_password` from User Management → Edit, or the coordinator screens show the
old one.)

---

## 12. Where to read more

| Document | Covers |
|---|---|
| `README.md` | Architecture, prerequisites, hosting, full config reference and troubleshooting. |
| `HANDOVER.md` | Database handover: restore paths, which dumps are current vs traps, accounts, secrets, verification. |
| `FYPHub_System_Manual_Revamped_v2.docx` | Full reference: data model, REST API, PHP sidecar, schema, operations, known defects, interface guide. Start with its Quick Start chapter. |
| `README_PHP_BACKEND.md` | PHP endpoint reference, response shapes, stage normalisation, time-zone convention. |
| `API_TESTING_GUIDE.md` | Worked `curl`/Postman examples (endpoint filenames out of date). |
| `docs/` | The manual's source of truth. Regenerate with the commands in `README.md` §8. |

External downloads and docs:

| Resource | Link |
|---|---|
| Laragon download (Full) | <https://laragon.org/download/> |
| Laragon documentation (operations, quick-add) | <https://laragon.org/docs/operations> · <https://laragon.org/docs/quick-add> |
| phpMyAdmin downloads | <https://www.phpmyadmin.net/downloads/> |
| Python for Windows | <https://www.python.org/downloads/windows/> |
| Node.js LTS | <https://nodejs.org/en/download> |
| MySQL Community Server | <https://dev.mysql.com/downloads/mysql/> |
| Git for Windows | <https://git-scm.com/download/win> |
| FYPHub repository | <https://github.com/ahren-2/FYPHub.git> |

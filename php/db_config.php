<?php

// ============================
// Headers / CORS
// ============================

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight requests
if (
    isset($_SERVER['REQUEST_METHOD']) &&
    $_SERVER['REQUEST_METHOD'] === 'OPTIONS'
) {
    http_response_code(200);
    exit();
}

// ============================
// Database Configuration
// ============================

// Laragon MySQL 8.0.30 (default Laragon credentials).
// Server: C:\laragon\bin\mysql\mysql-8.0.30-winx64  |  Data: C:\laragon\data\mysql-8
//
// The rubric tables now live in the Django database `fyp_hub_db` and are
// created by `python manage.py migrate` (see backend/api/migrations/
// 0012_rubric_tables_consolidation.py). This file previously pointed at a
// separate `rubrics_system` database that had to be built by importing an SQL
// dump — that step is gone. Nothing needs to be created here any more.
define('DB_HOST', '127.0.0.1');
define('DB_PORT', 3306);
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'fyp_hub_db');

// ============================
// Create DB Connection
// ============================

function getDbConnection()
{
    $conn = new mysqli(
        DB_HOST,
        DB_USER,
        DB_PASS,
        DB_NAME,
        DB_PORT
    );

    if ($conn->connect_error) {

        die(json_encode([
            'success' => false,
            'message' =>
                'Database connection failed: '
                . $conn->connect_error
        ]));
    }

    $conn->set_charset("utf8mb4");

    // The system runs on Malaysia time (UTC+8). Pin the session time zone so
    // NOW(), CURRENT_TIMESTAMP and TIMESTAMP column conversion match Django's
    // configuration (USE_TZ = False, TIME_ZONE = 'Asia/Kuala_Lumpur') no matter
    // what the MySQL server or host clock is set to.
    $conn->query("SET time_zone = '+08:00'");

    return $conn;
}

// ============================
// Schema
// ============================
//
// There is no schema creation here on purpose. The rubric tables
// (rubrics_templates, rubrics_marks, rubrics_active_templates) are created by
// Django migrations in backend/api/migrations/, which is the single source of
// truth for the database structure. Run:
//
//     cd backend && python manage.py migrate
//
// (or `python manage.py setup_fyphub`, which creates the database if needed and
// then migrates). The old initializeDatabase() function that used to live here
// was dead code — nothing called it — and it built a schema that was already
// missing columns the scripts below select.

?>
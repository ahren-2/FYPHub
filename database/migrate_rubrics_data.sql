-- One-time data move: old `rubrics_system` database -> `fyp_hub_db`.
--
-- The rubric tables now live in `fyp_hub_db` and are created by Django
-- migrations (backend/api/migrations/0012_rubric_tables_consolidation.py), and
-- the PHP backend points at `fyp_hub_db` (php/db_config.php). This script
-- carries existing rubric data across so nothing is lost.
--
-- Run once, AFTER `python manage.py migrate` and BEFORE/WHILE switching PHP over:
--
--     mysql -h 127.0.0.1 -P 3306 -u root < database/migrate_rubrics_data.sql
--
-- Notes:
--   * Requires both databases to exist on the same MySQL server.
--   * Uses INSERT ... ON DUPLICATE KEY UPDATE, so the source database always
--     wins and re-running is harmless. It never deletes destination rows, so it
--     cannot cascade into rubrics_marks.
--   * Timestamps are TIMESTAMP columns on both sides; the explicit session time
--     zone below keeps the conversion unambiguous.
--   * `rubrics_system.rubrics_version_history` and `rubrics_system.users` are
--     deliberately NOT copied: no PHP script or Django code reads them.
--   * Verified row counts before the move: 6 templates, 6 marks, 3 active.

SET @previous_time_zone = @@session.time_zone;
SET time_zone = '+00:00';

START TRANSACTION;

-- Templates (parent table first: marks and active rows reference it).
INSERT INTO fyp_hub_db.rubrics_templates
    (id, name, template_data, created_by, created_at, updated_at, version, is_active)
SELECT id, name, template_data, created_by, created_at, updated_at, version, is_active
FROM rubrics_system.rubrics_templates
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    template_data = VALUES(template_data),
    created_by = VALUES(created_by),
    created_at = VALUES(created_at),
    updated_at = VALUES(updated_at),
    version = VALUES(version),
    is_active = VALUES(is_active);

-- Which rubric is active for each stage.
INSERT INTO fyp_hub_db.rubrics_active_templates
    (fyp_stage, template_id, updated_by, updated_at)
SELECT fyp_stage, template_id, updated_by, updated_at
FROM rubrics_system.rubrics_active_templates
ON DUPLICATE KEY UPDATE
    template_id = VALUES(template_id),
    updated_by = VALUES(updated_by),
    updated_at = VALUES(updated_at);

-- Recorded marks.
INSERT INTO fyp_hub_db.rubrics_marks
    (id, template_id, student_id, student_name, supervisor, examiner, project_name,
     course, fyp_stage, marks_data, section_totals, co_attainment, criterion_marks,
     total_score, evaluated_by, evaluated_at, updated_at, status)
SELECT id, template_id, student_id, student_name, supervisor, examiner, project_name,
       course, fyp_stage, marks_data, section_totals, co_attainment, criterion_marks,
       total_score, evaluated_by, evaluated_at, updated_at, status
FROM rubrics_system.rubrics_marks
ON DUPLICATE KEY UPDATE
    template_id = VALUES(template_id),
    student_id = VALUES(student_id),
    student_name = VALUES(student_name),
    supervisor = VALUES(supervisor),
    examiner = VALUES(examiner),
    project_name = VALUES(project_name),
    course = VALUES(course),
    fyp_stage = VALUES(fyp_stage),
    marks_data = VALUES(marks_data),
    section_totals = VALUES(section_totals),
    co_attainment = VALUES(co_attainment),
    criterion_marks = VALUES(criterion_marks),
    total_score = VALUES(total_score),
    evaluated_by = VALUES(evaluated_by),
    evaluated_at = VALUES(evaluated_at),
    updated_at = VALUES(updated_at),
    status = VALUES(status);

COMMIT;

SET time_zone = @previous_time_zone;

-- Expect: 6, 3, 6 (source had 6, 3, 6).
SELECT
    (SELECT COUNT(*) FROM fyp_hub_db.rubrics_templates) AS templates,
    (SELECT COUNT(*) FROM fyp_hub_db.rubrics_active_templates) AS active,
    (SELECT COUNT(*) FROM fyp_hub_db.rubrics_marks) AS marks;

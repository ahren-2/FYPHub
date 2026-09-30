-- OPTIONAL / NOT REQUIRED -- kept only as a historical May-14 snapshot.
--
-- This was originally applied on the mistaken belief that api_course was a real
-- table that could not be recovered. It is not a real table. Migration
-- api/0006_rename_course_programme_and_more ran
--     RenameModel(old_name='Course', new_name='Programme')
-- which renamed api_course -> api_programme in place. The api_course .frm/.ibd
-- files left in the crashed datadir were pre-rename orphans (last written
-- 2026-05-12, before the migration applied on 2026-05-22), which is why InnoDB
-- reported error 1932 "doesn't exist in engine".
--
-- api_programme is the live table and is strictly newer and more complete
-- (6 rows including 'General'; row 1 renamed 'Bachelor of Computer Science'
-- -> 'BCS'; UNIQUE keys on name and code).
--
-- Do NOT re-apply this file to fyp_hub_db -- it would recreate a stale duplicate.
--
-- Schema and data taken verbatim from fyp_hub_db.sql (phpMyAdmin, 2026-05-14).
USE `fyp_hub_db`;

DROP TABLE IF EXISTS `api_course`;
CREATE TABLE `api_course` (
  `id` bigint(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `api_course`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `api_course`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

INSERT INTO `api_course` (`id`, `name`, `code`) VALUES
(1, 'Bachelor of Computer Science', 'BCS'),
(2, 'BDM', 'BDM'),
(3, 'BMD', 'BMD'),
(4, 'BID', 'BID'),
(5, 'None', 'None');

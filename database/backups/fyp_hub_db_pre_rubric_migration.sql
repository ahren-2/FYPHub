-- MySQL dump 10.13  Distrib 8.0.30, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: fyp_hub_db
-- ------------------------------------------------------
-- Server version	8.0.30

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `fyp_hub_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `fyp_hub_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `fyp_hub_db`;

--
-- Table structure for table `announcements`
--

DROP TABLE IF EXISTS `announcements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `announcements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `content` longtext COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `coordinator_user_id` int NOT NULL,
  `programme_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `announcements_coordinator_user_id_9af0f50e_fk_auth_user_id` (`coordinator_user_id`),
  KEY `announcements_programme_id_a08f8083_fk_api_programme_id` (`programme_id`),
  CONSTRAINT `announcements_coordinator_user_id_9af0f50e_fk_auth_user_id` FOREIGN KEY (`coordinator_user_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `announcements_programme_id_a08f8083_fk_api_programme_id` FOREIGN KEY (`programme_id`) REFERENCES `api_programme` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `announcements`
--

LOCK TABLES `announcements` WRITE;
/*!40000 ALTER TABLE `announcements` DISABLE KEYS */;
INSERT INTO `announcements` VALUES (1,'Final Report Submission Deadline','Please be reminded that the final report and brochure submission deadline for FYP 2 is on 29th May 2026.','2026-05-14 01:27:25.413242',18,NULL),(2,'FYP Presentation Timetable','Timetable for FYP presentation will be released on Week 12. More info will be released soon.','2026-05-14 01:28:13.422095',18,NULL),(3,'FYP 2 Submission Deadline','Dear Students, the deadline for the submission of your FYP 2 documents are on this upcoming Friday. Please check your files\' content and naming before submitting, and submit on time.','2026-05-28 12:52:15.131279',18,6),(4,'FYP 2 Presentation Announcement','The presentation schedule has been released. Please check your time slot.','2026-05-28 12:52:59.113321',18,6);
/*!40000 ALTER TABLE `announcements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_fypproject`
--

DROP TABLE IF EXISTS `api_fypproject`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_fypproject` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `student_matric_id` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `fyp_stage` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `co_supervisor_id` int DEFAULT NULL,
  `programme_id` bigint DEFAULT NULL,
  `examiner_id` int DEFAULT NULL,
  `student_id` int NOT NULL,
  `supervisor_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_id` (`student_id`),
  KEY `api_fypproject_co_supervisor_id_3cf6e2c8_fk_auth_user_id` (`co_supervisor_id`),
  KEY `api_fypproject_examiner_id_acd1da22_fk_auth_user_id` (`examiner_id`),
  KEY `api_fypproject_supervisor_id_a3ae5c6b_fk_auth_user_id` (`supervisor_id`),
  KEY `api_fypproject_programme_id_e32fb03d_fk_api_programme_id` (`programme_id`),
  CONSTRAINT `api_fypproject_co_supervisor_id_3cf6e2c8_fk_auth_user_id` FOREIGN KEY (`co_supervisor_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `api_fypproject_examiner_id_acd1da22_fk_auth_user_id` FOREIGN KEY (`examiner_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `api_fypproject_programme_id_e32fb03d_fk_api_programme_id` FOREIGN KEY (`programme_id`) REFERENCES `api_programme` (`id`),
  CONSTRAINT `api_fypproject_student_id_157aec48_fk_auth_user_id` FOREIGN KEY (`student_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `api_fypproject_supervisor_id_a3ae5c6b_fk_auth_user_id` FOREIGN KEY (`supervisor_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_fypproject`
--

LOCK TABLES `api_fypproject` WRITE;
/*!40000 ALTER TABLE `api_fypproject` DISABLE KEYS */;
INSERT INTO `api_fypproject` VALUES (1,'BCS23090036','Intelligent FYP Submission and Feedback Management Module','FYP1',NULL,1,NULL,2,16),(2,'BCS23090016','Automated FYP Management and Marking Portal','FYP2',NULL,1,NULL,3,18),(3,'BDM23090001','Pending TRF Submission','FYP1',NULL,2,NULL,4,NULL),(4,'BCS23090015','SCM Career Bridge: A Centralized Internship Platform for the School of Computing & Creative Media','FYP1',NULL,1,NULL,5,18),(5,'BDM23090002','Software project','FYP1',NULL,2,NULL,6,17),(6,'BCS23090021','Timetabling in the FYP Management and Marking Portal','FYP2',NULL,1,NULL,7,18),(7,'BMD23090004','Smart Dustbin Sorter','FYP1',NULL,3,NULL,8,17),(8,'BMD23090001','AI-Based Lost and Found Image Recognition System for  Campus Use','FYP1',NULL,3,NULL,9,18),(9,'BDM23090003','Automatic Detection of Road Damage (Pothole Detection)in streets.','FYP2',NULL,2,NULL,10,18),(10,'BID23090001','Pending TRF Submission','FYP1',NULL,4,NULL,11,NULL),(11,'BID23090002','Pending TRF Submission','FYP1',NULL,4,NULL,12,NULL),(12,'BID23090003','Pending TRF Submission','FYP2',NULL,4,NULL,13,NULL),(13,'BID23090004','Pending TRF Submission','FYP2',NULL,4,NULL,14,NULL),(14,'BCS21090027','Pending TRF Submission','FYP1',NULL,1,NULL,52,NULL),(15,'BCS23090050','Pending TRF Submission','FYP1',NULL,1,NULL,53,NULL),(16,'BCS23090065','Pending TRF Submission','FYP1',NULL,1,NULL,54,NULL),(17,'BCS23090034','Pending TRF Submission','FYP2',NULL,1,NULL,56,NULL),(18,'BCS23020059','Pending TRF Submission','FYP1',NULL,1,NULL,57,NULL),(19,'BCS23090040','Pending TRF Submission','FYP2',NULL,1,NULL,58,NULL),(20,'BDM23090050','Pending TRF Submission','FYP1',NULL,2,NULL,51,NULL),(21,'BDM23090051','Pending TRF Submission','FYP1',NULL,2,NULL,49,NULL);
/*!40000 ALTER TABLE `api_fypproject` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_lecturerpreference`
--

DROP TABLE IF EXISTS `api_lecturerpreference`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_lecturerpreference` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `unavailable_slots` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `lecturer_id` int NOT NULL,
  `presentation_slot_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_lecturerpreference_lecturer_id_presentation_aba25dcf_uniq` (`lecturer_id`,`presentation_slot_id`),
  KEY `api_lecturerpreference_lecturer_id_684dffff` (`lecturer_id`),
  KEY `api_lecturerpreferen_presentation_slot_id_869faa19_fk_api_prese` (`presentation_slot_id`),
  CONSTRAINT `api_lecturerpreferen_presentation_slot_id_869faa19_fk_api_prese` FOREIGN KEY (`presentation_slot_id`) REFERENCES `api_presentationslot` (`id`),
  CONSTRAINT `api_lecturerpreference_lecturer_id_684dffff_fk_auth_user_id` FOREIGN KEY (`lecturer_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `api_lecturerpreference_chk_1` CHECK (json_valid(`unavailable_slots`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_lecturerpreference`
--

LOCK TABLES `api_lecturerpreference` WRITE;
/*!40000 ALTER TABLE `api_lecturerpreference` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_lecturerpreference` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_presentationday`
--

DROP TABLE IF EXISTS `api_presentationday`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_presentationday` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `programme_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_presentationday_date_course_id_c71d7bdc_uniq` (`date`,`programme_id`),
  KEY `api_presentationday_programme_id_5e6611e6_fk_api_programme_id` (`programme_id`),
  CONSTRAINT `api_presentationday_programme_id_5e6611e6_fk_api_programme_id` FOREIGN KEY (`programme_id`) REFERENCES `api_programme` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_presentationday`
--

LOCK TABLES `api_presentationday` WRITE;
/*!40000 ALTER TABLE `api_presentationday` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_presentationday` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_presentationslot`
--

DROP TABLE IF EXISTS `api_presentationslot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_presentationslot` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `venue_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `programme_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_presentationslot_programme_id_date_venue_name_ee6ecf65_uniq` (`programme_id`,`date`,`venue_name`),
  CONSTRAINT `api_presentationslot_programme_id_bf9886a2_fk_api_programme_id` FOREIGN KEY (`programme_id`) REFERENCES `api_programme` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_presentationslot`
--

LOCK TABLES `api_presentationslot` WRITE;
/*!40000 ALTER TABLE `api_presentationslot` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_presentationslot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_profile`
--

DROP TABLE IF EXISTS `api_profile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_profile` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `full_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `role` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `phone_no` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `student_id_no` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `programme_id` bigint DEFAULT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `api_profile_programme_id_e51df988` (`programme_id`),
  CONSTRAINT `api_profile_user_id_41309820_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_profile`
--

LOCK TABLES `api_profile` WRITE;
/*!40000 ALTER TABLE `api_profile` DISABLE KEYS */;
INSERT INTO `api_profile` VALUES (1,'','coordinator',NULL,NULL,NULL,1),(2,'Andrew Sia Chee Yong','student',NULL,'BCS23090036',6,2),(4,'Evelyn Lu','student',NULL,'BDM23090001',6,4),(5,'Kong Hang Jun','student',NULL,'BCS23090015',6,5),(6,'Lau Jaw Jing','student',NULL,'BDM23090002',6,6),(7,'Ling Jia Qi','student',NULL,'BCS23090021',6,7),(8,'Lau Kim Yu','student',NULL,'BMD23090004',6,8),(9,'Leonard Wong','student',NULL,'BMD23090001',6,9),(10,'Simon Ling','student',NULL,'BDM23090003',6,10),(11,'BID student 1','student',NULL,'BID23090001',6,11),(12,'BID student 2','student',NULL,'BID23090002',6,12),(13,'BID student 3','student',NULL,'BID23090003',6,13),(14,'BID student 4','student',NULL,'BID23090004',6,14),(15,'Dennis Cheng Haw Yih','lecturer',NULL,NULL,6,16),(16,'Michael Tang Chi Seng','lecturer',NULL,NULL,6,17),(17,'KhairunnisaIlrahim','coordinator',NULL,NULL,6,18),(18,'Chang Wui Lee','lecturer',NULL,NULL,6,19),(19,'Jackie Ting Tiew Wei','lecturer',NULL,NULL,6,20),(21,'BID Lecturer2','lecturer',NULL,NULL,6,22),(22,'BDM Lecturer1','lecturer',NULL,NULL,6,23),(23,'BDM Lecturer2','lecturer',NULL,NULL,6,24),(25,'Darren Eng Zi Wei','student',NULL,'BCS23090016',6,3),(27,'Wong Sing Yaw','student',NULL,'BCS23090010',1,26),(28,'Darren Phang Jun Xiang','student',NULL,'BCS23090038',1,27),(29,'Beckhem fuiyoh','student',NULL,'BCS23090001',1,28),(30,'Marcella Peter','lecturer',NULL,NULL,1,29),(31,'Mohammad Zahiruddin bin Ibrahim','coordinator',NULL,NULL,1,30),(32,'Gary Loh Chee Wyai','lecturer',NULL,NULL,1,31),(33,'I am a person','student',NULL,'BCS23090005',1,32),(34,'Wah person','student',NULL,'BCS23090006',1,33),(35,'Nur Atiqah Binti Zaini','lecturer',NULL,NULL,2,34),(36,'Hasrunnaim Bin Hasam','coordinator',NULL,NULL,2,35),(37,'Jaibi Bin Sabian','coordinator',NULL,NULL,2,36),(38,'BDM Test01','student',NULL,'BDM23020001',2,37),(39,'BDM Test02','student',NULL,'BDM23020002',2,38),(40,'BDM Test03','student',NULL,'BDM23020003',2,39),(41,'BDM Test04','student',NULL,'BDM23020004',2,40),(42,'BDM Test05','student',NULL,'BDM23020005',2,41),(43,'BDM Test06','student',NULL,'BDM24020006',2,42),(44,'BDM Test07','student',NULL,'BDM24020007',2,43),(45,'BDM Test08','student',NULL,'BDM24020008',2,44),(46,'BDM Test09','student',NULL,'BDM24020009',2,45),(47,'BDM Test10','student',NULL,'BDM24020010',2,46),(48,'BDM Test11','student',NULL,'BDM23090010',2,47),(49,'BDM Test12','student',NULL,'BDM23090011',2,48),(50,'Wah person','student',NULL,'BDM23090051',2,49),(51,'Who am i','lecturer',NULL,NULL,2,50),(52,'I am a person','student',NULL,'BDM23090050',2,51),(53,'Voon Sze Kai','student',NULL,'BDM21090027',2,52),(54,'Barry Ting','student',NULL,'BCS23090050',1,53),(55,'Michelle Anak Melina','student',NULL,'BCS23090065',1,54),(56,'Romero Scofield','lecturer',NULL,'BCS23020070',1,55),(57,'Mohammad Irfan','student',NULL,'BCS23090034',1,56),(58,'Red Johnson','student',NULL,'BCS23020059',1,57),(59,'Carmelo Hisui','student',NULL,'BCS23090040',1,58);
/*!40000 ALTER TABLE `api_profile` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_programme`
--

DROP TABLE IF EXISTS `api_programme`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_programme` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_programme`
--

LOCK TABLES `api_programme` WRITE;
/*!40000 ALTER TABLE `api_programme` DISABLE KEYS */;
INSERT INTO `api_programme` VALUES (1,'BCS','BCS'),(2,'BDM','BDM'),(3,'BMD','BMD'),(4,'BID','BID'),(5,'None','None'),(6,'General','General');
/*!40000 ALTER TABLE `api_programme` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_rubricmarks`
--

DROP TABLE IF EXISTS `api_rubricmarks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_rubricmarks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `student_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `project_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `marks_data` json NOT NULL,
  `total_score` decimal(5,2) DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `evaluated_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `evaluated_by_id` int NOT NULL,
  `student_id` int NOT NULL,
  `template_id` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `api_rubricmarks_evaluated_by_id_deba8ac8_fk_auth_user_id` (`evaluated_by_id`),
  KEY `api_rubricmarks_student_id_b44d203d_fk_auth_user_id` (`student_id`),
  KEY `api_rubricmarks_template_id_ec45d042_fk_api_rubrictemplate_id` (`template_id`),
  CONSTRAINT `api_rubricmarks_evaluated_by_id_deba8ac8_fk_auth_user_id` FOREIGN KEY (`evaluated_by_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `api_rubricmarks_student_id_b44d203d_fk_auth_user_id` FOREIGN KEY (`student_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `api_rubricmarks_template_id_ec45d042_fk_api_rubrictemplate_id` FOREIGN KEY (`template_id`) REFERENCES `api_rubrictemplate` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_rubricmarks`
--

LOCK TABLES `api_rubricmarks` WRITE;
/*!40000 ALTER TABLE `api_rubricmarks` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_rubricmarks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_rubrictemplate`
--

DROP TABLE IF EXISTS `api_rubrictemplate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_rubrictemplate` (
  `id` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `template_data` json NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `version` int NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_by_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `api_rubrictemplate_created_by_id_e942bf11_fk_auth_user_id` (`created_by_id`),
  CONSTRAINT `api_rubrictemplate_created_by_id_e942bf11_fk_auth_user_id` FOREIGN KEY (`created_by_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_rubrictemplate`
--

LOCK TABLES `api_rubrictemplate` WRITE;
/*!40000 ALTER TABLE `api_rubrictemplate` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_rubrictemplate` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_timetablebooking`
--

DROP TABLE IF EXISTS `api_timetablebooking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_timetablebooking` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `start_time` datetime(6) NOT NULL,
  `end_time` datetime(6) NOT NULL,
  `venue` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `examiner_id` int DEFAULT NULL,
  `lecturer_id` int NOT NULL,
  `project_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_timetablebooking_start_time_venue_a5c73fe5_uniq` (`start_time`,`venue`),
  KEY `api_timetablebooking_examiner_id_d4ec0d50_fk_auth_user_id` (`examiner_id`),
  KEY `api_timetablebooking_lecturer_id_6df5f84c_fk_auth_user_id` (`lecturer_id`),
  KEY `api_timetablebooking_project_id_83949a35_fk_api_fypproject_id` (`project_id`),
  CONSTRAINT `api_timetablebooking_examiner_id_d4ec0d50_fk_auth_user_id` FOREIGN KEY (`examiner_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `api_timetablebooking_lecturer_id_6df5f84c_fk_auth_user_id` FOREIGN KEY (`lecturer_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `api_timetablebooking_project_id_83949a35_fk_api_fypproject_id` FOREIGN KEY (`project_id`) REFERENCES `api_fypproject` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_timetablebooking`
--

LOCK TABLES `api_timetablebooking` WRITE;
/*!40000 ALTER TABLE `api_timetablebooking` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_timetablebooking` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_timetableslot`
--

DROP TABLE IF EXISTS `api_timetableslot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_timetableslot` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `start_time` datetime(6) NOT NULL,
  `end_time` datetime(6) NOT NULL,
  `venue` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `api_timetableslot_project_id_4797bc18_fk_api_fypproject_id` (`project_id`),
  CONSTRAINT `api_timetableslot_project_id_4797bc18_fk_api_fypproject_id` FOREIGN KEY (`project_id`) REFERENCES `api_fypproject` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_timetableslot`
--

LOCK TABLES `api_timetableslot` WRITE;
/*!40000 ALTER TABLE `api_timetableslot` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_timetableslot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_timetableslot_examiners`
--

DROP TABLE IF EXISTS `api_timetableslot_examiners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_timetableslot_examiners` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `timetableslot_id` bigint NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_timetableslot_examin_timetableslot_id_user_id_b3be25d1_uniq` (`timetableslot_id`,`user_id`),
  KEY `api_timetableslot_examiners_user_id_73a2983f_fk_auth_user_id` (`user_id`),
  CONSTRAINT `api_timetableslot_ex_timetableslot_id_bc934bb1_fk_api_timet` FOREIGN KEY (`timetableslot_id`) REFERENCES `api_timetableslot` (`id`),
  CONSTRAINT `api_timetableslot_examiners_user_id_73a2983f_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_timetableslot_examiners`
--

LOCK TABLES `api_timetableslot_examiners` WRITE;
/*!40000 ALTER TABLE `api_timetableslot_examiners` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_timetableslot_examiners` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_venue`
--

DROP TABLE IF EXISTS `api_venue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_venue` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `programme_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_venue_name_course_id_99438e3f_uniq` (`name`,`programme_id`),
  KEY `api_venue_programme_id_66f0e8a6_fk_api_programme_id` (`programme_id`),
  CONSTRAINT `api_venue_programme_id_66f0e8a6_fk_api_programme_id` FOREIGN KEY (`programme_id`) REFERENCES `api_programme` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_venue`
--

LOCK TABLES `api_venue` WRITE;
/*!40000 ALTER TABLE `api_venue` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_venue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group`
--

DROP TABLE IF EXISTS `auth_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group`
--

LOCK TABLES `auth_group` WRITE;
/*!40000 ALTER TABLE `auth_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group_permissions`
--

DROP TABLE IF EXISTS `auth_group_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_group_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` (`group_id`,`permission_id`),
  KEY `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` (`permission_id`),
  CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group_permissions`
--

LOCK TABLES `auth_group_permissions` WRITE;
/*!40000 ALTER TABLE `auth_group_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_permission`
--

DROP TABLE IF EXISTS `auth_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_permission` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `content_type_id` int NOT NULL,
  `codename` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`),
  CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=97 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_permission`
--

LOCK TABLES `auth_permission` WRITE;
/*!40000 ALTER TABLE `auth_permission` DISABLE KEYS */;
INSERT INTO `auth_permission` VALUES (1,'Can add log entry',1,'add_logentry'),(2,'Can change log entry',1,'change_logentry'),(3,'Can delete log entry',1,'delete_logentry'),(4,'Can view log entry',1,'view_logentry'),(5,'Can add permission',2,'add_permission'),(6,'Can change permission',2,'change_permission'),(7,'Can delete permission',2,'delete_permission'),(8,'Can view permission',2,'view_permission'),(9,'Can add group',3,'add_group'),(10,'Can change group',3,'change_group'),(11,'Can delete group',3,'delete_group'),(12,'Can view group',3,'view_group'),(13,'Can add user',4,'add_user'),(14,'Can change user',4,'change_user'),(15,'Can delete user',4,'delete_user'),(16,'Can view user',4,'view_user'),(17,'Can add content type',5,'add_contenttype'),(18,'Can change content type',5,'change_contenttype'),(19,'Can delete content type',5,'delete_contenttype'),(20,'Can view content type',5,'view_contenttype'),(21,'Can add session',6,'add_session'),(22,'Can change session',6,'change_session'),(23,'Can delete session',6,'delete_session'),(24,'Can view session',6,'view_session'),(25,'Can add course',7,'add_course'),(26,'Can change course',7,'change_course'),(27,'Can delete course',7,'delete_course'),(28,'Can view course',7,'view_course'),(29,'Can add announcements',8,'add_announcements'),(30,'Can change announcements',8,'change_announcements'),(31,'Can delete announcements',8,'delete_announcements'),(32,'Can view announcements',8,'view_announcements'),(33,'Can add fyp project',9,'add_fypproject'),(34,'Can change fyp project',9,'change_fypproject'),(35,'Can delete fyp project',9,'delete_fypproject'),(36,'Can view fyp project',9,'view_fypproject'),(37,'Can add milestone forms',10,'add_milestoneforms'),(38,'Can change milestone forms',10,'change_milestoneforms'),(39,'Can delete milestone forms',10,'delete_milestoneforms'),(40,'Can view milestone forms',10,'view_milestoneforms'),(41,'Can add milestone entries',11,'add_milestoneentries'),(42,'Can change milestone entries',11,'change_milestoneentries'),(43,'Can delete milestone entries',11,'delete_milestoneentries'),(44,'Can view milestone entries',11,'view_milestoneentries'),(45,'Can add profile',12,'add_profile'),(46,'Can change profile',12,'change_profile'),(47,'Can delete profile',12,'delete_profile'),(48,'Can view profile',12,'view_profile'),(49,'Can add submissions',13,'add_submissions'),(50,'Can change submissions',13,'change_submissions'),(51,'Can delete submissions',13,'delete_submissions'),(52,'Can view submissions',13,'view_submissions'),(53,'Can add feedback',14,'add_feedback'),(54,'Can change feedback',14,'change_feedback'),(55,'Can delete feedback',14,'delete_feedback'),(56,'Can view feedback',14,'view_feedback'),(57,'Can add supervisor quotas',15,'add_supervisorquotas'),(58,'Can change supervisor quotas',15,'change_supervisorquotas'),(59,'Can delete supervisor quotas',15,'delete_supervisorquotas'),(60,'Can view supervisor quotas',15,'view_supervisorquotas'),(61,'Can add timetable slot',16,'add_timetableslot'),(62,'Can change timetable slot',16,'change_timetableslot'),(63,'Can delete timetable slot',16,'delete_timetableslot'),(64,'Can view timetable slot',16,'view_timetableslot'),(65,'Can add presentation day',17,'add_presentationday'),(66,'Can change presentation day',17,'change_presentationday'),(67,'Can delete presentation day',17,'delete_presentationday'),(68,'Can view presentation day',17,'view_presentationday'),(69,'Can add timetable booking',18,'add_timetablebooking'),(70,'Can change timetable booking',18,'change_timetablebooking'),(71,'Can delete timetable booking',18,'delete_timetablebooking'),(72,'Can view timetable booking',18,'view_timetablebooking'),(73,'Can add venue',19,'add_venue'),(74,'Can change venue',19,'change_venue'),(75,'Can delete venue',19,'delete_venue'),(76,'Can view venue',19,'view_venue'),(77,'Can add lecturer preference',20,'add_lecturerpreference'),(78,'Can change lecturer preference',20,'change_lecturerpreference'),(79,'Can delete lecturer preference',20,'delete_lecturerpreference'),(80,'Can view lecturer preference',20,'view_lecturerpreference'),(81,'Can add programme',7,'add_programme'),(82,'Can change programme',7,'change_programme'),(83,'Can delete programme',7,'delete_programme'),(84,'Can view programme',7,'view_programme'),(85,'Can add rubric template',21,'add_rubrictemplate'),(86,'Can change rubric template',21,'change_rubrictemplate'),(87,'Can delete rubric template',21,'delete_rubrictemplate'),(88,'Can view rubric template',21,'view_rubrictemplate'),(89,'Can add rubric marks',22,'add_rubricmarks'),(90,'Can change rubric marks',22,'change_rubricmarks'),(91,'Can delete rubric marks',22,'delete_rubricmarks'),(92,'Can view rubric marks',22,'view_rubricmarks'),(93,'Can add presentation slot',23,'add_presentationslot'),(94,'Can change presentation slot',23,'change_presentationslot'),(95,'Can delete presentation slot',23,'delete_presentationslot'),(96,'Can view presentation slot',23,'view_presentationslot');
/*!40000 ALTER TABLE `auth_permission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_user`
--

DROP TABLE IF EXISTS `auth_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `password` varchar(128) COLLATE utf8mb4_general_ci NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `username` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `first_name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `last_name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_general_ci NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `date_joined` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_user`
--

LOCK TABLES `auth_user` WRITE;
/*!40000 ALTER TABLE `auth_user` DISABLE KEYS */;
INSERT INTO `auth_user` VALUES (1,'pbkdf2_sha256$1000000$p4a17CF087HsqofVB4l0GY$DY5KDm3B9UUMUhCtXC56FxT5csnKNcLb0aqAcQabBeQ=','2026-05-22 01:12:19.000000',1,'fix','','','',1,1,'2026-05-22 01:11:51.000000'),(2,'pbkdf2_sha256$1000000$kepV7Va5XzqGxOdDseCsLs$xmwdIRcu4NJWxuKPfmlKkhTvI527Zf70GgxiOAEQwTg=',NULL,0,'andrew','','','',0,1,'2026-05-22 01:21:54.201972'),(3,'pbkdf2_sha256$1000000$fGaxhTwP7wH4cUwymEDplh$kQKMr5F4woNw2Yf+O3zAcvqirQo7PLKb8YGtYVRBR0w=',NULL,0,'darren','Darren','Eng Zi Wei','',0,1,'2026-05-22 01:21:55.000000'),(4,'pbkdf2_sha256$1000000$nX55jyeaCmg02ioQjzdOi9$r7W1O5sIQ+3Uv3VIczL4uHQQ8UZbfKTDQW0Yl1taobU=',NULL,0,'evelyn','','','',0,1,'2026-05-22 01:21:56.283748'),(5,'pbkdf2_sha256$1000000$68X1WNzlXvLcHEHdMLXlwy$/GRRsryEdrHTfBSqjBPoO8FuFf2ui0oljm9jbZ/7EQ0=',NULL,0,'hangjun','','','',0,1,'2026-05-22 01:21:57.314848'),(6,'pbkdf2_sha256$1000000$bcYc8fQ3ssYkanBp41YWUt$iFTffWLYGXNzMFfQgpqZ9T+OCbbrLanoqwD+ZCGy/iM=',NULL,0,'jawjing','','','',0,1,'2026-05-22 01:21:58.328420'),(7,'pbkdf2_sha256$1000000$9BtXVc9WVmSZdcLFSM1iMB$CmwHtEom4vYD4vtbDAa7czEQEZPGlBwZnJefKnY+afI=',NULL,0,'jiaqi','','','',0,1,'2026-05-22 01:21:59.313575'),(8,'pbkdf2_sha256$1000000$ankzAAFdjJWWRF5UcAhHmT$GolJD3O8Dz/SeKp9w8LgatGlYWoRqL94GUlc1blxKqM=',NULL,0,'kimyu','','','',0,1,'2026-05-22 01:22:00.273771'),(9,'pbkdf2_sha256$1000000$tfU84uouqeCsaDbvV39vho$nX3HNVRqN4tpmfm8ZAFZod/VSRXO2jHUty/0IMUIPwg=',NULL,0,'leonard','','','',0,1,'2026-05-22 01:22:01.265068'),(10,'pbkdf2_sha256$1000000$bSYMk5IZcaLcG1CJJ0dKk4$SZ8nZK6+g0xHh9lIruTsJzbHJjUeYZqjbybtXFmH8uo=',NULL,0,'simon','','','',0,1,'2026-05-22 01:22:02.293806'),(11,'pbkdf2_sha256$1000000$R3PT4YMj1d9H8BoW0jHXAL$RZRwJysHWFklUP7IE6KXJk1FucUJHWr/B3gx/FlL8oo=',NULL,0,'student1','','','',0,1,'2026-05-22 01:22:03.283719'),(12,'pbkdf2_sha256$1000000$AGWRNUlqAJj828S3dOjrQF$f/muA+2bTjkdfgaF7ayRNJOSwGdx2N6kOmi3ZIfucYg=',NULL,0,'student2','','','',0,1,'2026-05-22 01:22:04.268620'),(13,'pbkdf2_sha256$1000000$11ET7jqbtnLfanqdgzSRqm$XQ+3GPyZ7pZMOju4375kMflzn0Suw4EFzBJ1fBvhciY=',NULL,0,'student3','','','',0,1,'2026-05-22 01:22:05.217585'),(14,'pbkdf2_sha256$1000000$4yo8DiTKv3D0Lh7P5SgakG$HTKNrKx8JgezoUJ2cVMf2qLwFDoTogJbqNiMYpPnM6Q=',NULL,0,'student4','','','',0,1,'2026-05-22 01:22:06.243937'),(15,'pbkdf2_sha256$1000000$riZtlrw8cfVtYrY0UaDY1u$Men36Qre8HN3htzSHix9CvHePetThn5PBke6tZuW/50=',NULL,0,'None','','','',0,1,'2026-05-22 01:22:07.232302'),(16,'pbkdf2_sha256$1000000$ku7e92hMl9y9v5HRMrNZgV$WWSIeAIuWc14F86/yOH2Y1Nc+SCq7czGD8mhWa/3C4g=',NULL,0,'dennis','','','',0,1,'2026-05-22 01:22:08.249059'),(17,'pbkdf2_sha256$1000000$SWaVoxFG13pc4YbpMOJgyY$mHfVsjWz5QNZ2tTkB+Oq4g5pqUrEDCfRDcJ8eCS9xB8=',NULL,0,'michael','','','',0,1,'2026-05-22 01:22:09.223646'),(18,'pbkdf2_sha256$1000000$pOF71I43oSsuqe33OhQocV$1DJgomiy2FqVUAOZCwRnLU5dZ7/d2EQl/uC8extzVSw=',NULL,1,'khairu','','','',1,1,'2026-05-22 01:22:10.000000'),(19,'pbkdf2_sha256$1000000$t5XvpOqI90ZeFAaUSLuSg6$9yBYpvP6Ua6u9KwK1EKRGw14j9LqvhP2BAVST3Fx8E4=',NULL,0,'wuilee','','','',0,1,'2026-05-22 01:22:11.203806'),(20,'pbkdf2_sha256$1000000$5ZLPRTh1PuueV7iFRPv6Oz$+xI0PbT/GZwnEzT0ftfjoRUB9MNQ/21aMl/+S9NdL6w=',NULL,0,'jackie','','','',0,1,'2026-05-22 01:22:12.239909'),(21,'pbkdf2_sha256$1000000$AGxXfrNiLr3wsOcMfY2yGb$zg20gmQy1UxefbYDSaHaDMRhIQTaQ6E1H+/dqsb27/0=',NULL,0,'lecturer1','','','',0,1,'2026-05-22 01:22:13.289068'),(22,'pbkdf2_sha256$1000000$DmTzVydxCCamKKVz9DT7ft$ma883aLtegwGFVubmbtwOK4+pmBkKbTNjOjT6pARoIc=',NULL,0,'lecturer2','','','',0,1,'2026-05-22 01:22:14.243610'),(23,'pbkdf2_sha256$1000000$4OxnzUvJZmqO5zoR9qP1CD$yVfsmwrLVaB60jVwLVVv+1YFcilF7UhIOMW5+af0k3o=',NULL,0,'lecturer3','','','',0,1,'2026-05-22 01:22:14.753397'),(24,'pbkdf2_sha256$1000000$ccI5HZVBE17uIrOgpmmrjP$vboewVwD6AL3zKFXEoAPKkqkellCL5o0hlG2N29vO7c=',NULL,0,'lecturer4','','','',0,1,'2026-05-22 01:22:15.264827'),(25,'pbkdf2_sha256$1000000$5DHoSpYlAygBZ6jHstyfpY$kKggd9XkgZ0595INX4dDqLLsRn0kAfkEoobw2ctckC8=','2026-05-18 14:46:17.036979',1,'lingjiaqi','','','jiaqi3616@gmail.com',1,1,'2026-04-20 07:36:33.562917'),(26,'pbkdf2_sha256$1000000$XWvVGF67ioXRsbSvFyoTBV$Abd/Y5bQJ/jkkq6cXz/yUl37t4W/u5SkQls9u+ZjAgM=',NULL,0,'singyaw','','','',0,1,'2026-05-04 09:44:42.000000'),(27,'pbkdf2_sha256$1000000$A0CiHOrIfCAz6lWHSIFG1S$IJgqd68n7g1xJDodpZ+VMA48Rzyee8kgjbAqZ81Q068=',NULL,0,'DPJX','','','',0,1,'2026-05-04 09:44:43.000000'),(28,'pbkdf2_sha256$1000000$ItOKuoBmHiOjtPE8HzsjK9$TamvtXw3hOI7FGCHAA2GjY3gC3hFsb1+Pn1pdRBYSvY=',NULL,0,'beckhem','','','',0,1,'2026-05-04 09:44:43.000000'),(29,'pbkdf2_sha256$1000000$3T3hJuRMM42WS25pR9BAAu$bq8OHDxU20zbS78AJIP2GiHmu0EjGDtdpHgm2zhWKr8=',NULL,0,'marcella','','','',0,1,'2026-05-04 09:44:44.000000'),(30,'pbkdf2_sha256$1000000$Sc6yA1rszJAhzQZYp2CT2P$n3iX4uUtKhgge359YU7EtYA5N0s5FnTo0LJaRIElzfY=',NULL,0,'zahiruddin','','','',0,1,'2026-05-17 14:46:10.059278'),(31,'pbkdf2_sha256$1000000$1BwnoMCzW4k4dXNCb9NyJr$SrT5qptnfHuLX6rKLKQKgvU+h8RxQwtI3k3281GAaZ8=',NULL,0,'gary','','','',0,1,'2026-05-17 14:46:10.493134'),(32,'pbkdf2_sha256$1000000$gbvIUD1QzI6LeGtCQxYzs6$ceXZFcz9ChTVJoI+i2v9jlrZgxkorllU4V/awnKUcwc=',NULL,0,'fuiyoh','','','',0,1,'2026-05-18 07:43:59.760255'),(33,'pbkdf2_sha256$1000000$Bl6gJDbKdyo2jCQVNLh4go$AO5DUBCZ+gV7iukqX3xZonsmVqion1H1tkYFs11fxG8=',NULL,0,'wahwah','','','',0,1,'2026-05-18 08:15:31.908811'),(34,'pbkdf2_sha256$1000000$Ufj8tKINXSmxcpZtLwXjjM$nLXhYIEn2sCzT8SwYAQ+mafOhKbWJA7rOW1jjKygryM=',NULL,0,'atiqah','','','',0,1,'2026-05-18 15:08:02.000000'),(35,'pbkdf2_sha256$1000000$kd5j93htarOowOpMbmkWCZ$Ue6Bx77JOe1211USw+gbjUfDWMxgdjNEJqFmrUQdmJ0=',NULL,0,'hasrunnaim','','','',0,1,'2026-05-18 15:14:40.557857'),(36,'pbkdf2_sha256$1000000$hxSAi1tOs6LNs14jCbR7Is$Pads5uSEsMkhBUA3N8e7JrwBLQJAQP5y1UqvpE3q5yQ=',NULL,0,'jaibi','','','jiaqi3616@gmail.com',0,1,'2026-05-18 15:15:48.000000'),(37,'pbkdf2_sha256$1000000$R2Fi2kdGUS5aHQohvcwZAR$1jZw2749isY9Rn4CsfcBlmqyUy+Nf5lT1qqB+wZP4dU=',NULL,0,'BDM01','','','',0,1,'2026-05-18 15:17:08.932783'),(38,'pbkdf2_sha256$1000000$7vf7MnoIMClBEFd5lWJCAV$q5nVe1lNIzm1OhwKmXGmio2+UDQTAAwo0AALYAUpt/E=',NULL,0,'BDM02','','','',0,1,'2026-05-18 15:17:09.363222'),(39,'pbkdf2_sha256$1000000$fnRYF6WGpo63uXLVyAirkV$W9Mqk4k2qGRQ6yljQoy0gkcd/Ki9VJKDkqodmK9jCgg=',NULL,0,'BDM03','','','',0,1,'2026-05-18 15:17:09.777047'),(40,'pbkdf2_sha256$1000000$15Y7TwVMjAgHSs7hWBa1O1$v9idNHGnovwNsfchoFh+7n6EM5w4Jf93J6pJ4KRGzPI=',NULL,0,'BDM04','','','',0,1,'2026-05-18 15:17:10.177518'),(41,'pbkdf2_sha256$1000000$3to2zU6CcUwUfHI5OMSe1V$1pvemcJqX6AXxwUFs+PFuMm6O+uoTbpBEdEnyWtW2CM=',NULL,0,'BDM05','','','',0,1,'2026-05-18 15:17:10.615765'),(42,'pbkdf2_sha256$1000000$yPmFWRg4vgPSieGMD5ufzA$vnZyz24fMq1bcA+WsVhJylrehjTCjYnExuEJe6Ib8VM=',NULL,0,'BDM06','','','',0,1,'2026-05-18 15:17:11.047223'),(43,'pbkdf2_sha256$1000000$VvjiBCX7gG9IOzj2fwO0L9$LoeJobj8ria2ssReA+QhTl2Mk7N3Q0k2lcAhShXnI1g=',NULL,0,'BDM07','','','',0,1,'2026-05-18 15:17:11.456581'),(44,'pbkdf2_sha256$1000000$GjAEVDunTkIzevChcrQTKW$ELU6dcm/o+ksR4X0Lccw8IAa3tbOFY+fxW7hFSl3A/g=',NULL,0,'BDM08','','','',0,1,'2026-05-18 15:17:11.840815'),(45,'pbkdf2_sha256$1000000$FUDFiXxSSZgtrYnFhOSU11$OspmQ40NV1pwkmSvUWhKLP71pm1d6kefgk+UvkyRir8=',NULL,0,'BDM09','','','',0,1,'2026-05-18 15:17:12.257473'),(46,'pbkdf2_sha256$1000000$11E6kP7rpOMPZYgICrjPZd$vzHJrtLtLaGdDhC9UNy9ljVddcAFgUXhBeleB+u5RSU=',NULL,0,'BDM10','','','',0,1,'2026-05-18 15:17:12.693054'),(47,'pbkdf2_sha256$1000000$nxNv7kxfCVCdKfgTi3vfHp$yRgDbtmnoH1CCynghxmzW9Ch+BkjjcZbJRmGIA53IcM=',NULL,0,'BDM11','','','',0,1,'2026-05-18 15:17:13.101142'),(48,'pbkdf2_sha256$1000000$x1tqCo6jnehek8hppjDx0n$llocsx9E6gQRPZ0UT7ffMqYd85SnygBZXOgJChAV7+E=',NULL,0,'BDM12','','','',0,1,'2026-05-18 15:17:13.467526'),(49,'pbkdf2_sha256$1000000$7YAPi6zdtegtBfmiOkYHyk$MHMRQa3qG6mdRt9MNgDZpeW37fwp9rImBzJCMmWdVY0=',NULL,0,'wah','','','',0,1,'2026-05-19 02:23:00.146035'),(50,'pbkdf2_sha256$1000000$gSutMV38jfXifpz3rT6cqA$RqJnOhSzYronx9nR9U8crGjoQu6OVz60S7asa+cwe0U=',NULL,0,'who','','','',0,1,'2026-05-19 02:23:01.365660'),(51,'pbkdf2_sha256$1000000$5gvXeiLACKCLWyHEbeUWeT$KK/osHSPC8MPsxunQczGEd8jUyCsOKtxhBGX3+NDQQ8=',NULL,0,'person','','','',0,1,'2026-05-19 06:16:51.186528'),(52,'pbkdf2_sha256$1000000$5SuobjEf7xasgMKfLPeB22$7Myfd8PCRrUAO341Zj7Q+iFfXv7N5TWYj3N8N+8Uuu0=',NULL,0,'kai','','','',0,1,'2026-07-29 01:21:36.858269'),(53,'pbkdf2_sha256$1000000$mDu51ezj2iI2Hz7p79sLnp$zcPfSF7EedZXsVLadqTgli/7bR4kHUJP0oZTZZCFHek=',NULL,0,'barry','','','',0,1,'2026-07-29 01:23:19.386463'),(54,'pbkdf2_sha256$1000000$8WwU7srT0OxOuzcP7iJyXp$tdJcQUyqo1HQRN9w9KPK13pl33unpL5EoVahi9NF+Hc=',NULL,0,'michelle','','','',0,1,'2026-07-29 01:23:21.015307'),(55,'pbkdf2_sha256$1000000$LyNWbE2DUrJccw7F0me6y4$++LQelS3CFs3QC0qrh1zgBN0/vjeqzQx4+rrIVAtJbc=',NULL,0,'romero','','','',0,1,'2026-07-29 01:23:22.655398'),(56,'pbkdf2_sha256$1000000$nSYP4CTFfjMLMxZ5kvyHK3$a0D3Y5ns1bOQ5nnhVwi2CAi9rxINCTLIAQzTQrzNtVU=',NULL,0,'irfan','','','',0,1,'2026-07-29 01:23:24.270470'),(57,'pbkdf2_sha256$1000000$Ai4NvKyB4fjT24c5s6z5lq$WlHZvsG5zVZMocAdjEypz6Im+BvQYiYdeGTrFR1zuxU=',NULL,0,'red','','','',0,1,'2026-07-29 01:23:25.832317'),(58,'pbkdf2_sha256$1000000$fv876q1ZCocOoxGixOy0zh$SuyY8BgDMYkq7am3gAe4xKwIKwlTHclVlAa6itKztLQ=',NULL,0,'carmelo','','','',0,1,'2026-07-29 01:23:27.457732');
/*!40000 ALTER TABLE `auth_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_user_groups`
--

DROP TABLE IF EXISTS `auth_user_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_user_groups` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `group_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_user_groups_user_id_group_id_94350c0c_uniq` (`user_id`,`group_id`),
  KEY `auth_user_groups_group_id_97559544_fk_auth_group_id` (`group_id`),
  CONSTRAINT `auth_user_groups_group_id_97559544_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  CONSTRAINT `auth_user_groups_user_id_6a12ed8b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_user_groups`
--

LOCK TABLES `auth_user_groups` WRITE;
/*!40000 ALTER TABLE `auth_user_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_user_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_user_user_permissions`
--

DROP TABLE IF EXISTS `auth_user_user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_user_user_permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_user_user_permissions_user_id_permission_id_14a6b632_uniq` (`user_id`,`permission_id`),
  KEY `auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm` (`permission_id`),
  CONSTRAINT `auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_user_user_permissions`
--

LOCK TABLES `auth_user_user_permissions` WRITE;
/*!40000 ALTER TABLE `auth_user_user_permissions` DISABLE KEYS */;
INSERT INTO `auth_user_user_permissions` VALUES (1,18,1),(2,18,2),(3,18,3),(4,18,4),(5,18,5),(6,18,6),(7,18,7),(8,18,8),(9,18,9),(10,18,10),(11,18,11),(12,18,12),(13,18,13),(14,18,14),(15,18,15),(16,18,16),(17,18,17),(18,18,18),(19,18,19),(20,18,20),(21,18,21),(22,18,22),(23,18,23),(24,18,24),(25,18,25),(26,18,26),(27,18,27),(28,18,28),(29,18,29),(30,18,30),(31,18,31),(32,18,32),(33,18,33),(34,18,34),(35,18,35),(36,18,36),(37,18,37),(38,18,38),(39,18,39),(40,18,40),(41,18,41),(42,18,42),(43,18,43),(44,18,44),(45,18,45),(46,18,46),(47,18,47),(48,18,48),(49,18,49),(50,18,50),(51,18,51),(52,18,52),(53,18,53),(54,18,54),(55,18,55),(56,18,56),(57,18,57),(58,18,58),(59,18,59),(60,18,60),(61,18,61),(62,18,62),(63,18,63),(64,18,64),(65,18,65),(66,18,66),(67,18,67),(68,18,68),(69,18,69),(70,18,70),(71,18,71),(72,18,72),(73,18,73),(74,18,74),(75,18,75),(76,18,76);
/*!40000 ALTER TABLE `auth_user_user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_admin_log`
--

DROP TABLE IF EXISTS `django_admin_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_admin_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `action_time` datetime(6) NOT NULL,
  `object_id` longtext COLLATE utf8mb4_general_ci,
  `object_repr` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `action_flag` smallint unsigned NOT NULL,
  `change_message` longtext COLLATE utf8mb4_general_ci NOT NULL,
  `content_type_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `django_admin_log_content_type_id_c4bce8eb_fk_django_co` (`content_type_id`),
  KEY `django_admin_log_user_id_c564eba6_fk_auth_user_id` (`user_id`),
  CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`),
  CONSTRAINT `django_admin_log_user_id_c564eba6_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `django_admin_log_chk_1` CHECK ((`action_flag` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_admin_log`
--

LOCK TABLES `django_admin_log` WRITE;
/*!40000 ALTER TABLE `django_admin_log` DISABLE KEYS */;
INSERT INTO `django_admin_log` VALUES (1,'2026-05-22 01:13:16.366761','1','fix',2,'[{\"added\": {\"name\": \"profile\", \"object\": \"fix\"}}]',4,1),(2,'2026-05-22 01:42:44.252359','18','khairu',2,'[{\"changed\": {\"fields\": [\"Staff status\", \"Superuser status\", \"User permissions\"]}}, {\"changed\": {\"name\": \"profile\", \"object\": \"khairu\", \"fields\": [\"Role\"]}}]',4,1),(3,'2026-05-22 01:43:27.924022','3','darren',2,'[{\"changed\": {\"fields\": [\"First name\", \"Last name\"]}}, {\"added\": {\"name\": \"profile\", \"object\": \"darren\"}}]',4,1),(4,'2026-05-22 01:54:08.691485','18','khairu',2,'[{\"changed\": {\"name\": \"profile\", \"object\": \"khairu\", \"fields\": [\"Role\"]}}]',4,1);
/*!40000 ALTER TABLE `django_admin_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_content_type`
--

DROP TABLE IF EXISTS `django_content_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_content_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `app_label` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_content_type`
--

LOCK TABLES `django_content_type` WRITE;
/*!40000 ALTER TABLE `django_content_type` DISABLE KEYS */;
INSERT INTO `django_content_type` VALUES (1,'admin','logentry'),(8,'api','announcements'),(14,'api','feedback'),(9,'api','fypproject'),(20,'api','lecturerpreference'),(11,'api','milestoneentries'),(10,'api','milestoneforms'),(17,'api','presentationday'),(23,'api','presentationslot'),(12,'api','profile'),(7,'api','programme'),(22,'api','rubricmarks'),(21,'api','rubrictemplate'),(13,'api','submissions'),(15,'api','supervisorquotas'),(18,'api','timetablebooking'),(16,'api','timetableslot'),(19,'api','venue'),(3,'auth','group'),(2,'auth','permission'),(4,'auth','user'),(5,'contenttypes','contenttype'),(6,'sessions','session');
/*!40000 ALTER TABLE `django_content_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_migrations`
--

DROP TABLE IF EXISTS `django_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_migrations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `app` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `applied` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_migrations`
--

LOCK TABLES `django_migrations` WRITE;
/*!40000 ALTER TABLE `django_migrations` DISABLE KEYS */;
INSERT INTO `django_migrations` VALUES (1,'contenttypes','0001_initial','2026-05-19 05:55:31.833393'),(2,'auth','0001_initial','2026-05-19 05:55:32.524696'),(3,'admin','0001_initial','2026-05-19 05:55:32.648837'),(4,'admin','0002_logentry_remove_auto_add','2026-05-19 05:55:32.679842'),(5,'admin','0003_logentry_add_action_flag_choices','2026-05-19 05:55:32.684567'),(6,'api','0001_initial','2026-05-19 05:55:34.854859'),(7,'api','0002_alter_milestoneentries_options_and_more','2026-05-19 05:55:34.903831'),(8,'contenttypes','0002_remove_content_type_name','2026-05-19 05:55:35.005506'),(9,'auth','0002_alter_permission_name_max_length','2026-05-19 05:55:35.078030'),(10,'auth','0003_alter_user_email_max_length','2026-05-19 05:55:35.107518'),(11,'auth','0004_alter_user_username_opts','2026-05-19 05:55:35.133249'),(12,'auth','0005_alter_user_last_login_null','2026-05-19 05:55:35.187155'),(13,'auth','0006_require_contenttypes_0002','2026-05-19 05:55:35.189178'),(14,'auth','0007_alter_validators_add_error_messages','2026-05-19 05:55:35.216683'),(15,'auth','0008_alter_user_username_max_length','2026-05-19 05:55:35.242926'),(16,'auth','0009_alter_user_last_name_max_length','2026-05-19 05:55:35.267967'),(17,'auth','0010_alter_group_name_max_length','2026-05-19 05:55:35.297205'),(18,'auth','0011_update_proxy_permissions','2026-05-19 05:55:35.324035'),(19,'auth','0012_alter_user_first_name_max_length','2026-05-19 05:55:35.334821'),(20,'sessions','0001_initial','2026-05-19 05:55:35.391785'),(21,'api','0003_lecturerpreference','2026-05-22 02:42:52.908203'),(22,'api','0004_alter_submissions_detail_description_and_more','2026-05-22 02:42:53.352898'),(23,'api','0005_rename_course_to_programme','2026-05-22 02:42:53.352898'),(24,'api','0006_rename_course_programme_and_more','2026-05-22 02:42:57.086893'),(25,'api','0007_alter_profile_programme','2026-09-16 14:35:15.167367'),(26,'api','0008_announcements_programme','2026-09-16 14:35:15.237067'),(27,'api','0009_rubrictemplate_rubricmarks','2026-09-16 14:35:15.659007'),(28,'api','0010_alter_lecturerpreference_options_and_more','2026-09-16 14:35:16.186240'),(29,'api','0011_alter_fypproject_fyp_stage','2026-09-16 14:35:16.229478');
/*!40000 ALTER TABLE `django_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_session`
--

DROP TABLE IF EXISTS `django_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `django_session` (
  `session_key` varchar(40) COLLATE utf8mb4_general_ci NOT NULL,
  `session_data` longtext COLLATE utf8mb4_general_ci NOT NULL,
  `expire_date` datetime(6) NOT NULL,
  PRIMARY KEY (`session_key`),
  KEY `django_session_expire_date_a5c62663` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_session`
--

LOCK TABLES `django_session` WRITE;
/*!40000 ALTER TABLE `django_session` DISABLE KEYS */;
INSERT INTO `django_session` VALUES ('1tozljaow0we7vs5hj9a54s8bn3bk911','.eJxVjDsOwjAQBe_iGln-bexQ0ucM1vqzOIBsKU4qxN1JpBTQvpl5b-ZxW4vfel78nNiVSXb53QLGZ64HSA-s98Zjq-syB34o_KSdTy3l1-10_w4K9rLXGqxy2bghpsFqHAkkpmgFODAOKGHeqVBgyVgMypCWRCJrNwYdgyT2-QLTuzfl:1wQER1:4x6p4pum1UPDNSJw8q1YNQIEQNzv-FUycNL9s5MZCuw','2026-06-05 01:12:19.199840');
/*!40000 ALTER TABLE `django_session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedback`
--

DROP TABLE IF EXISTS `feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedback` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `comment` longtext COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `is_read` tinyint(1) NOT NULL,
  `lecturer_user_id` int NOT NULL,
  `submission_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `feedback_lecturer_user_id_71c8d031_fk_auth_user_id` (`lecturer_user_id`),
  KEY `feedback_submission_id_061c57e7_fk_submissions_id` (`submission_id`),
  CONSTRAINT `feedback_lecturer_user_id_71c8d031_fk_auth_user_id` FOREIGN KEY (`lecturer_user_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `feedback_submission_id_061c57e7_fk_submissions_id` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedback`
--

LOCK TABLES `feedback` WRITE;
/*!40000 ALTER TABLE `feedback` DISABLE KEYS */;
INSERT INTO `feedback` VALUES (1,'proceed','2026-05-22 01:50:27.157841',0,18,3),(2,'continue','2026-05-22 01:50:51.976304',0,18,1),(3,'proceed fyp1','2026-05-22 01:51:01.052385',0,18,4),(4,'proceed','2026-05-22 01:51:15.672113',0,18,2),(5,'ok','2026-05-22 06:38:04.896782',0,18,6),(6,'OK','2026-05-28 12:03:59.508162',0,18,5),(7,'go','2026-05-28 12:25:19.760642',0,16,3),(8,'a','2026-06-16 03:20:27.988742',0,17,8);
/*!40000 ALTER TABLE `feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `milestone_entries`
--

DROP TABLE IF EXISTS `milestone_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `milestone_entries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `milestone_number` int NOT NULL,
  `score` int DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `form_id` bigint NOT NULL,
  `max_marks` int NOT NULL,
  `milestone_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `milestone_entries_form_id_667ef45c_fk_milestone_forms_id` (`form_id`),
  CONSTRAINT `milestone_entries_form_id_667ef45c_fk_milestone_forms_id` FOREIGN KEY (`form_id`) REFERENCES `milestone_forms` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `milestone_entries`
--

LOCK TABLES `milestone_entries` WRITE;
/*!40000 ALTER TABLE `milestone_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `milestone_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `milestone_forms`
--

DROP TABLE IF EXISTS `milestone_forms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `milestone_forms` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `student_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `student_id_no` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `fyp_title` longtext COLLATE utf8mb4_general_ci NOT NULL,
  `supervisor_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `lecturer_user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `milestone_forms_lecturer_user_id_791986ce_fk_auth_user_id` (`lecturer_user_id`),
  CONSTRAINT `milestone_forms_lecturer_user_id_791986ce_fk_auth_user_id` FOREIGN KEY (`lecturer_user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `milestone_forms`
--

LOCK TABLES `milestone_forms` WRITE;
/*!40000 ALTER TABLE `milestone_forms` DISABLE KEYS */;
/*!40000 ALTER TABLE `milestone_forms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `submissions`
--

DROP TABLE IF EXISTS `submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `submissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `student_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `student_id_no` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `phone_no` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `programme` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `semester` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `project_category` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `proposed_project_title` longtext COLLATE utf8mb4_general_ci NOT NULL,
  `detail_description` longtext COLLATE utf8mb4_general_ci,
  `detail_problem` longtext COLLATE utf8mb4_general_ci,
  `detail_value` longtext COLLATE utf8mb4_general_ci,
  `detail_scope` longtext COLLATE utf8mb4_general_ci,
  `detail_similar_system` longtext COLLATE utf8mb4_general_ci,
  `detail_features` longtext COLLATE utf8mb4_general_ci,
  `document_path` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `co_supervisor_user_id` int DEFAULT NULL,
  `student_user_id` int NOT NULL,
  `supervisor_user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `submissions_co_supervisor_user_id_a0e9a4c8_fk_auth_user_id` (`co_supervisor_user_id`),
  KEY `submissions_student_user_id_f9c2b11e_fk_auth_user_id` (`student_user_id`),
  KEY `submissions_supervisor_user_id_3dede1a9_fk_auth_user_id` (`supervisor_user_id`),
  CONSTRAINT `submissions_co_supervisor_user_id_a0e9a4c8_fk_auth_user_id` FOREIGN KEY (`co_supervisor_user_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `submissions_student_user_id_f9c2b11e_fk_auth_user_id` FOREIGN KEY (`student_user_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `submissions_supervisor_user_id_3dede1a9_fk_auth_user_id` FOREIGN KEY (`supervisor_user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `submissions`
--

LOCK TABLES `submissions` WRITE;
/*!40000 ALTER TABLE `submissions` DISABLE KEYS */;
INSERT INTO `submissions` VALUES (1,'','BCS23090016','','Bachelor of Computer Science','SEP/2025','system-dev','Automated FYP Management and Marking Portal','Automated FYP Management and Marking Portal\n\nThe evaluation of a student’s Final Year Project (FYP) is one of the most integral parts of any undergraduate programme, as it assesses students’ capability of applying their knowledge and\nskills acquired throughout their studies into a project. As of today, the process of managing the\nmarks of a student’s FYP often involves cross-checking of rubrics as well as calculating marks via\nExcel spreadsheets. This process is typically handled by university lecturers and FYP coordinators\nwho are responsible for overseeing the evaluation process and ensuring that grading is aligned with\nthe intended rubrics and course outcomes (COs).','With the growing number of students registering each semester, FYP coordinators find it\nincreasingly inefficient to record and manage hundreds of student marks. Although Excel spreadsheets are used to calculate marks of students\' performance, the files are not centralised, which makes it difficult to access and manage records across multiple semesters. This will also\nlead to difficulties in tracking and retrieving previous records.','The proposed Automated FYP Management and Marking Portal holds significant academic and administrative value. A Final Year Project is one of the most critical components of any undergraduate programme, as it assesses students’ capability to do research and analytical thinking. However, as student enrolment increases and assessment criteria evolve, managing and marking these projects through manual methods has become increasingly inefficient. Therefore, the development of a unified and automated marking system directly supports institutional goals of academic quality assurance, operational efficiency and digital transformation.','The target users are primarily Final Year Project coordinators who are responsible for\ncoordinating and consolidating the evaluation of students’ Final Year Projects. As the number of students undertaking Final Year Projects increases in UTS, coordinators are\nfacing challenges managing large volumes of records. This portal is designed to support\nthese coordinators in handling the increasing workload by providing a more efficient and\nreliable tool for evaluating Final Year Projects.','Existing systems include UNIMAS FCSIT FYP Portal, The University of Auckland Project Portal and Final year Project Portal of University of the Punjab','-Editable marking rubrics, managed by portal admin. \n-Automated calculation of final marks based on rubrics.\n-Exportable final marks in predefined formats.\n-Dedicated dashboard for grade distribution.',NULL,'approved','2026-05-22 01:38:38.058827','2026-05-22 02:45:30.410484',NULL,3,18),(2,'','BCS23090021','','Bachelor of Computer Science','SEP/2025','system-dev','Timetabling in the FYP Management and Marking Portal','Timetabling in the FYP Management and MarkingPortal','X','X','X','X','X',NULL,'approved','2026-05-22 01:39:38.754127','2026-05-22 02:45:46.405432',NULL,7,18),(3,'','BCS23020036','','Bachelor of Computer Science','SEP/2025','research','Intelligent FYP Submission and Feedback Management Module','Intelligent FYP Submission and Feedback Management Module','x','x','x','x','x',NULL,'approved','2026-05-22 01:40:42.996030','2026-05-28 12:25:19.756921',NULL,2,16),(4,'','BCS23090015','','Bachelor of Computer Science','SEP/2025','research','SCM Career Bridge: A Centralized Internship Platform for the School of Computing & Creative Media','SCM Career Bridge: A Centralized Internship Platform for the School of Computing & Creative Media','x','x','x','x','x',NULL,'approved','2026-05-22 01:45:17.434695','2026-05-22 01:51:01.046321',NULL,5,18),(5,'','BCS2402001','','Bachelor of Computer Science','SEP/2025','system-dev','Automatic Detection of Road Damage (Pothole Detection)in streets.','Automatic Detection of Road Damage (Pothole Detection)in streets.','x','x','x','x','x',NULL,'approved','2026-05-22 06:37:08.704592','2026-05-28 12:03:59.507169',NULL,10,18),(6,'','BCS24020050','','Bachelor of Computer Science','SEP/2025','system-dev','AI-Based Lost and Found Image Recognition System for  Campus Use','AI-Based Lost and Found Image Recognition System for  Campus Use','X','X','X','X','X',NULL,'approved','2026-05-22 06:37:43.339110','2026-05-22 06:38:04.894160',NULL,9,18),(7,'','jawjing','','Bachelor of Computer Science','SEP/2025','system-dev','Software project','1','1','1','1','1','1',NULL,'pending','2026-06-16 01:24:38.859303','2026-06-16 01:24:38.859303',NULL,6,17),(8,'','kimyu','','Bachelor of Computer Science','SEP/2025','system-dev','Smart Dustbin Sorter','1','1','1','1','1','1',NULL,'revision','2026-06-16 01:25:29.939302','2026-06-16 03:20:27.980510',NULL,8,17);
/*!40000 ALTER TABLE `submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supervisor_quotas`
--

DROP TABLE IF EXISTS `supervisor_quotas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supervisor_quotas` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `quota_total` int NOT NULL,
  `lecturer_user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lecturer_user_id` (`lecturer_user_id`),
  CONSTRAINT `supervisor_quotas_lecturer_user_id_cb5c16fa_fk_auth_user_id` FOREIGN KEY (`lecturer_user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supervisor_quotas`
--

LOCK TABLES `supervisor_quotas` WRITE;
/*!40000 ALTER TABLE `supervisor_quotas` DISABLE KEYS */;
INSERT INTO `supervisor_quotas` VALUES (1,6,16),(2,5,18),(3,3,19),(5,6,17),(6,1,22),(7,8,20);
/*!40000 ALTER TABLE `supervisor_quotas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'fyp_hub_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-27 22:45:56

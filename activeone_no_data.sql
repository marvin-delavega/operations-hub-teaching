-- MySQL dump 10.13  Distrib 8.0.31, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: activeone_research
-- ------------------------------------------------------
-- Server version	8.0.31

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_account_to_not_exists`
--

DROP TABLE IF EXISTS `_account_to_not_exists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_account_to_not_exists` (
  `ID` int unsigned NOT NULL,
  `TABLE_NAME` varchar(100) NOT NULL,
  `OBJECT_ID` int NOT NULL,
  `ACCOUNT_TO_ID` int NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `_item_pricing`
--

DROP TABLE IF EXISTS `_item_pricing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_item_pricing` (
  `ID` int unsigned NOT NULL,
  `PREVIOUS_ID` int unsigned DEFAULT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `TRANS_NO` int NOT NULL,
  `OBJECT_TYPE` int NOT NULL,
  `OBJECT_ID` int NOT NULL,
  `PRICING_BASE_ID` int unsigned NOT NULL,
  `ADJUSTMENT_TYPE` int NOT NULL,
  `ADJUSTMENT` decimal(16,4) DEFAULT NULL,
  `ADJUSTMENT_AMOUNT` decimal(16,4) DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `POSTED` int DEFAULT '0',
  `USER_ID` int DEFAULT NULL,
  `POSTED_ON` datetime DEFAULT NULL,
  `POSTED_BY` int DEFAULT NULL,
  `START_DATE` datetime DEFAULT NULL,
  `END_DATE` datetime DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ITEM_PRICING_PRICING_BASE_ID` (`PRICING_BASE_ID`),
  KEY `FK_ITEM_PRICING_PREVIOUS_ID` (`PREVIOUS_ID`),
  KEY `IX_ITEM_PRICING_CURRENT_PRICE` (`OBJECT_ID`,`RECORDED_ON`) USING BTREE,
  KEY `IX_ITEM_PRICING_TRANS` (`START_DATE`,`END_DATE`,`OBJECT_TYPE`,`POSTED`) USING BTREE,
  KEY `IX_ITEM_PRICING_OBJECT_TYPE` (`OBJECT_TYPE`,`POSTED`) USING BTREE,
  CONSTRAINT `FK_ITEM_PRICING_PREVIOUS_ID` FOREIGN KEY (`PREVIOUS_ID`) REFERENCES `_item_pricing` (`ID`),
  CONSTRAINT `FK_ITEM_PRICING_PRICING_BASE_ID` FOREIGN KEY (`PRICING_BASE_ID`) REFERENCES `_item_pricing_base_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `_item_pricing_base_map`
--

DROP TABLE IF EXISTS `_item_pricing_base_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_item_pricing_base_map` (
  `ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(20) DEFAULT NULL,
  `OBJECT_TYPE` int DEFAULT NULL,
  `LOCATION_FILTERED` tinyint DEFAULT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `_stock_transfer`
--

DROP TABLE IF EXISTS `_stock_transfer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_stock_transfer` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `DATE` date NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `TRANSFER_TO_ID` int unsigned NOT NULL,
  `IN_TRANSIT_LOCATION_ID` int DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `RETAIL_VALUE` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `PREPARED_BY_ID` int unsigned DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `DATE_RECEIVED` date DEFAULT NULL,
  `RECEIVED_BY_ID` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `_stock_transfer_items`
--

DROP TABLE IF EXISTS `_stock_transfer_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_stock_transfer_items` (
  `ID` int unsigned NOT NULL,
  `STOCK_TRANSFER_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(13,4) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_COST` decimal(16,4) DEFAULT NULL,
  `UNIT_PRICE` decimal(16,4) DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `RETAIL_VALUE` decimal(16,4) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `RECEIVED_QTY` decimal(13,4) DEFAULT NULL,
  `OPEN_DISPUTE` tinyint unsigned DEFAULT NULL,
  `DISPUTE_TYPE_ID` int unsigned DEFAULT NULL,
  `DISPUTE_REMARKS` varchar(50) DEFAULT NULL,
  `RESOLUTION_TYPE_ID` int unsigned DEFAULT NULL,
  `RESOLUTION_REMARKS` varchar(50) DEFAULT NULL,
  `CLOSED` tinyint unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `ITEM_REQUEST_ITEM_ID` int unsigned DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `access_level_map`
--

DROP TABLE IF EXISTS `access_level_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `access_level_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `account`
--

DROP TABLE IF EXISTS `account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(100) DEFAULT NULL,
  `GROUP_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `BANK_ACCOUNT_NO` varchar(20) DEFAULT NULL,
  `INACTIVE` tinyint unsigned NOT NULL,
  `TAG` varchar(20) DEFAULT NULL,
  `LINE_NO` int DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ACCOUNT_NAME` (`NAME`),
  KEY `FK_ACCOUNT_GROUP_ACCOUNT_ID` (`GROUP_ACCOUNT_ID`),
  KEY `FK_ACCOUNT_TYPE` (`TYPE`),
  CONSTRAINT `FK_ACCOUNT_GROUP_ACCOUNT_ID` FOREIGN KEY (`GROUP_ACCOUNT_ID`) REFERENCES `account_group` (`ID`),
  CONSTRAINT `FK_ACCOUNT_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `account_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `account_group`
--

DROP TABLE IF EXISTS `account_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_group` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(50) NOT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `LINE_NO` int DEFAULT NULL,
  `INACTIVE` tinyint unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ACCOUNT_GROUP_NAME` (`TYPE`,`NAME`),
  CONSTRAINT `FK_ACCOUNT_GROUP_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `account_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `account_journal`
--

DROP TABLE IF EXISTS `account_journal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_journal` (
  `ID` int unsigned NOT NULL,
  `PREVIOUS_ID` int unsigned DEFAULT NULL,
  `SEQUENCE_NO` int unsigned DEFAULT NULL,
  `JOURNAL_NO` int unsigned NOT NULL,
  `ACCOUNT_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `SUBSIDIARY_ID` int unsigned NOT NULL,
  `SEQUENCE_GROUP` int unsigned NOT NULL,
  `OBJECT_TYPE` tinyint unsigned NOT NULL,
  `OBJECT_ID` int unsigned NOT NULL,
  `OBJECT_DATE` date NOT NULL,
  `ENTRY_TYPE` tinyint unsigned NOT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `ENDING_BALANCE` decimal(16,4) NOT NULL,
  `EXTENDED_OPTIONS` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ACCOUNT_JOURNAL_ENTRY_TYPE` (`ENTRY_TYPE`),
  KEY `FK_ACCOUNT_JOURNAL_PREVIOUS_ID` (`PREVIOUS_ID`),
  KEY `IX_ACCOUNT_JOURNAL_OBJECT_REF` (`OBJECT_ID`,`OBJECT_TYPE`,`EXTENDED_OPTIONS`),
  KEY `IX_ACCOUNT_JOURNAL_DATE` (`OBJECT_DATE`),
  KEY `IX_ACCOUNT_JOURNAL_OBJECT_TYPE_REF` (`OBJECT_TYPE`,`OBJECT_DATE`) USING BTREE,
  KEY `IX_ACCOUNT_JOURNAL_JOURNAL_NO` (`JOURNAL_NO`),
  KEY `IX_ACCOUNT_JOURNAL_ENTRY_REF` (`ACCOUNT_ID`,`LOCATION_ID`,`SUBSIDIARY_ID`,`SEQUENCE_GROUP`,`SEQUENCE_NO`,`OBJECT_DATE`) USING BTREE,
  KEY `FK_ACCOUNT_JOURNAL_LOCATION_ID` (`LOCATION_ID`),
  CONSTRAINT `FK_ACCOUNT_JOURNAL_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_ACCOUNT_JOURNAL_ENTRY_TYPE` FOREIGN KEY (`ENTRY_TYPE`) REFERENCES `account_journal_entry_type_map` (`ID`),
  CONSTRAINT `FK_ACCOUNT_JOURNAL_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_ACCOUNT_JOURNAL_PREVIOUS_ID` FOREIGN KEY (`PREVIOUS_ID`) REFERENCES `account_journal` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `account_journal_entry_type_map`
--

DROP TABLE IF EXISTS `account_journal_entry_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_journal_entry_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `account_journal_staging`
--

DROP TABLE IF EXISTS `account_journal_staging`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_journal_staging` (
  `ID` int unsigned NOT NULL,
  `PREVIOUS_ID` int unsigned DEFAULT NULL,
  `SEQUENCE_NO` int unsigned DEFAULT NULL,
  `JOURNAL_NO` int unsigned NOT NULL,
  `ACCOUNT_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `SUBSIDIARY_ID` int unsigned NOT NULL,
  `SEQUENCE_GROUP` int unsigned NOT NULL,
  `OBJECT_TYPE` tinyint unsigned NOT NULL,
  `OBJECT_ID` int unsigned NOT NULL,
  `OBJECT_DATE` date NOT NULL,
  `ENTRY_TYPE` tinyint unsigned NOT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `ENDING_BALANCE` decimal(16,4) NOT NULL,
  `EXTENDED_OPTIONS` varchar(50) DEFAULT NULL,
  `depth` int unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `account_reconciliation`
--

DROP TABLE IF EXISTS `account_reconciliation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_reconciliation` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `DATE` date NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `ACCOUNT_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `PREVIOUS_ID` int unsigned DEFAULT NULL,
  `SEQUENCE_NO` int unsigned NOT NULL,
  `BEGINNING_BALANCE` decimal(16,4) NOT NULL,
  `CLEARED_DEPOSITS` decimal(16,4) NOT NULL,
  `CLEARED_WITHDRAWALS` decimal(16,4) NOT NULL,
  `CLEARED_BALANCE` decimal(16,4) NOT NULL,
  `ENDING_BALANCE` decimal(16,4) NOT NULL,
  `NOTES` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ACCOUNT_RECONCILIATION_CODE` (`CODE`),
  KEY `FK_ACCOUNT_RECONCILIATION_ACCOUNT_ID` (`ACCOUNT_ID`),
  KEY `FK_ACCOUNT_RECONCILIATION_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_ACCOUNT_RECONCILIATION_PREVIOUS_ID` (`PREVIOUS_ID`),
  CONSTRAINT `FK_ACCOUNT_RECONCILIATION_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_ACCOUNT_RECONCILIATION_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_ACCOUNT_RECONCILIATION_PREVIOUS_ID` FOREIGN KEY (`PREVIOUS_ID`) REFERENCES `account_reconciliation` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `account_reconciliation_items`
--

DROP TABLE IF EXISTS `account_reconciliation_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_reconciliation_items` (
  `ID` int unsigned NOT NULL,
  `ACCOUNT_RECONCILIATION_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `OBJECT_ID` int unsigned NOT NULL,
  `OBJECT_TYPE` tinyint unsigned NOT NULL,
  `ENTRY_TYPE` tinyint unsigned DEFAULT NULL,
  `CLEARED_DEBIT` decimal(16,4) DEFAULT NULL,
  `CLEARED_CREDIT` decimal(16,4) DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ACCOUNT_RECON_ITEMS_ACCOUNT_RECON_ID` (`ACCOUNT_RECONCILIATION_ID`),
  CONSTRAINT `FK_ACCOUNT_RECON_ITEMS_ACCOUNT_RECON_ID` FOREIGN KEY (`ACCOUNT_RECONCILIATION_ID`) REFERENCES `account_reconciliation` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `account_type_map`
--

DROP TABLE IF EXISTS `account_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_trail`
--

DROP TABLE IF EXISTS `audit_trail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_trail` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `USER_ID` int unsigned NOT NULL,
  `ACTIVITY` varchar(255) NOT NULL,
  `TYPE` int unsigned DEFAULT NULL,
  `SOURCE_REF` int unsigned DEFAULT NULL,
  `POS_MACHINE_ID` int DEFAULT NULL,
  `VIEWED` smallint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`),
  KEY `IX_POS_MACHINE_ID` (`POS_MACHINE_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=8338161 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_trail_type_map`
--

DROP TABLE IF EXISTS `audit_trail_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_trail_type_map` (
  `ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(45) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `authorization_log`
--

DROP TABLE IF EXISTS `authorization_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `authorization_log` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `SESSION_ID` int unsigned NOT NULL,
  `AUTHORIZER_ID` int unsigned NOT NULL,
  `ACCESS_LEVEL` tinyint NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_AUTHORIZATION_LOG_SESSION_ID` (`SESSION_ID`) USING BTREE,
  KEY `FK_AUTHORIZATION_LOG_AUTHORIZER_ID` (`AUTHORIZER_ID`) USING BTREE,
  CONSTRAINT `FK_AUTHORIZATION_LOG_AUTHORIZER_ID` FOREIGN KEY (`AUTHORIZER_ID`) REFERENCES `user` (`ID`),
  CONSTRAINT `FK_AUTHORIZATION_LOG_SESSION_ID` FOREIGN KEY (`SESSION_ID`) REFERENCES `user_sessions` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bank_reconciliation`
--

DROP TABLE IF EXISTS `bank_reconciliation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_reconciliation` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `DATE` date NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `SEQUENCE_NO` int NOT NULL,
  `SALES_REP_ID` int unsigned DEFAULT NULL,
  `BANK_ACCOUNT_ID` int unsigned NOT NULL,
  `BOOK_STATEMENT_DATE` date NOT NULL,
  `BOOK_STATEMENT_BALANCE` decimal(16,4) DEFAULT NULL,
  `SYSTEM_BALANCE` decimal(16,4) DEFAULT NULL,
  `CLEARED_DEPOSITS` decimal(16,4) DEFAULT NULL,
  `CLEARED_CHECKS` decimal(16,4) DEFAULT NULL,
  `NEW_SYSTEM_BALANCE` decimal(16,4) DEFAULT NULL,
  `DIFFERENCE` decimal(16,4) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `LOCATION_ID` int NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bank_reconciliation_details`
--

DROP TABLE IF EXISTS `bank_reconciliation_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_reconciliation_details` (
  `ID` int unsigned NOT NULL,
  `BANK_RECON_ID` int unsigned NOT NULL,
  `TYPE` int unsigned NOT NULL,
  `OBJECT_TYPE` int unsigned NOT NULL,
  `OBJECT_ID` int unsigned NOT NULL,
  `AMOUNT_APPLIED` decimal(16,4) DEFAULT NULL,
  PRIMARY KEY (`ID`) USING BTREE,
  KEY `FK_BANK_RECONCILIATION_DETAIL_BANK_RECON_ID` (`BANK_RECON_ID`) USING BTREE,
  CONSTRAINT `FK_BANK_RECONCILIATION_DETAIL_BANK_RECON_ID` FOREIGN KEY (`BANK_RECON_ID`) REFERENCES `bank_reconciliation` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bank_reconciliation_type_map`
--

DROP TABLE IF EXISTS `bank_reconciliation_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_reconciliation_type_map` (
  `ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bill`
--

DROP TABLE IF EXISTS `bill`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `VENDOR_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `PAYMENT_TERMS_ID` int unsigned DEFAULT NULL,
  `DUE_DATE` date DEFAULT NULL,
  `DISCOUNT_DATE` date DEFAULT NULL,
  `DISCOUNT_PCT` decimal(6,2) DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `BALANCE_DUE` decimal(16,4) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `ACCOUNTS_PAYABLE_ID` int unsigned DEFAULT NULL,
  `INPUT_TAX_ID` int unsigned DEFAULT NULL,
  `INPUT_TAX_RATE` decimal(6,2) DEFAULT NULL,
  `INPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `INPUT_TAX_VAT_METHOD` tinyint unsigned DEFAULT NULL,
  `INPUT_TAX_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_BILL_CODE` (`CODE`),
  KEY `FK_BILL_PAYMENT_TERMS_ID` (`PAYMENT_TERMS_ID`),
  KEY `FK_BILL_VENDOR_ID` (`VENDOR_ID`),
  KEY `FK_BILL_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_BILL_ACCOUNTS_PAYABLE_ID` (`ACCOUNTS_PAYABLE_ID`) USING BTREE,
  KEY `FK_BILL_INPUT_TAX_ID` (`INPUT_TAX_ID`),
  KEY `FK_BILL_INPUT_TAX_ACCOUNT_ID` (`INPUT_TAX_ACCOUNT_ID`),
  KEY `IX_BILL_CUSTOM_FIELD1` (`CUSTOM_FIELD1`),
  KEY `IX_BILL_CUSTOM_FIELD2` (`CUSTOM_FIELD2`),
  KEY `IX_BILL_CUSTOM_FIELD3` (`CUSTOM_FIELD3`),
  KEY `IX_BILL_CUSTOM_FIELD4` (`CUSTOM_FIELD4`),
  KEY `IX_BILL_CUSTOM_FIELD5` (`CUSTOM_FIELD5`),
  CONSTRAINT `FK_BILL_ACCOUNTS_PAYABLE_ID` FOREIGN KEY (`ACCOUNTS_PAYABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_BILL_INPUT_TAX_ACCOUNT_ID` FOREIGN KEY (`INPUT_TAX_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_BILL_INPUT_TAX_ID` FOREIGN KEY (`INPUT_TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_BILL_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_BILL_PAYMENT_TERMS_ID` FOREIGN KEY (`PAYMENT_TERMS_ID`) REFERENCES `payment_terms` (`ID`),
  CONSTRAINT `FK_BILL_VENDOR_ID` FOREIGN KEY (`VENDOR_ID`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bill_credit`
--

DROP TABLE IF EXISTS `bill_credit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_credit` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `VENDOR_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `AMOUNT_APPLIED` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `ACCOUNTS_PAYABLE_ID` int unsigned DEFAULT NULL,
  `INPUT_TAX_ID` int unsigned DEFAULT NULL,
  `INPUT_TAX_RATE` decimal(6,2) DEFAULT NULL,
  `INPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `INPUT_TAX_VAT_METHOD` tinyint unsigned DEFAULT NULL,
  `INPUT_TAX_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `PROJECT_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_BILL_CREDIT_CODE` (`CODE`),
  KEY `FK_BILL_CREDIT_VENDOR_ID` (`VENDOR_ID`),
  KEY `FK_BILL_CREDIT_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_BILL_CREDIT_ACCOUNTS_PAYABLE_ID` (`ACCOUNTS_PAYABLE_ID`) USING BTREE,
  KEY `FK_BILL_CREDIT_INPUT_TAX_ID` (`INPUT_TAX_ID`),
  KEY `FK_BILL_CREDIT_INPUT_TAX_ACCOUNT_ID` (`INPUT_TAX_ACCOUNT_ID`),
  KEY `IX_BILL_CREDIT_CUSTOM_FIELD1` (`CUSTOM_FIELD1`),
  KEY `IX_BILL_CREDIT_CUSTOM_FIELD2` (`CUSTOM_FIELD2`),
  KEY `IX_BILL_CREDIT_CUSTOM_FIELD3` (`CUSTOM_FIELD3`),
  KEY `IX_BILL_CREDIT_CUSTOM_FIELD4` (`CUSTOM_FIELD4`),
  KEY `IX_BILL_CREDIT_CUSTOM_FIELD5` (`CUSTOM_FIELD5`),
  CONSTRAINT `FK_BILL_CREDIT_ACCOUNTS_PAYABLE_ID` FOREIGN KEY (`ACCOUNTS_PAYABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_INPUT_TAX_ACCOUNT_ID` FOREIGN KEY (`INPUT_TAX_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_INPUT_TAX_ID` FOREIGN KEY (`INPUT_TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_VENDOR_ID` FOREIGN KEY (`VENDOR_ID`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bill_credit_bills`
--

DROP TABLE IF EXISTS `bill_credit_bills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_credit_bills` (
  `ID` int unsigned NOT NULL,
  `BILL_CREDIT_ID` int unsigned NOT NULL,
  `BILL_ID` int unsigned NOT NULL,
  `AMOUNT_APPLIED` decimal(16,4) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_BILL_CREDIT_BILLS_BILL_CREDIT_ID` (`BILL_CREDIT_ID`),
  KEY `FK_BILL_CREDIT_BILLS_BILL_ID` (`BILL_ID`),
  CONSTRAINT `FK_BILL_CREDIT_BILLS_BILL_CREDIT_ID` FOREIGN KEY (`BILL_CREDIT_ID`) REFERENCES `bill_credit` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_BILLS_BILL_ID` FOREIGN KEY (`BILL_ID`) REFERENCES `bill` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bill_credit_expenses`
--

DROP TABLE IF EXISTS `bill_credit_expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_credit_expenses` (
  `ID` int unsigned NOT NULL,
  `BILL_CREDIT_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ACCOUNT_TO_ID` int unsigned DEFAULT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `PARTICULARS` varchar(255) DEFAULT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `PROJECT_ID` int unsigned DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_BILL_CREDIT_EXPENSES_BILL_ID` (`BILL_CREDIT_ID`),
  KEY `FK_BILL_CREDIT_EXPENSES_ACCOUNT_ID` (`ACCOUNT_ID`),
  KEY `FK_BILL_CREDIT_EXPENSES_CLASS_ID` (`CLASS_ID`),
  KEY `FK_BILL_CREDIT_EXPENSES_ACCOUNT_TO_ID` (`ACCOUNT_TO_ID`) USING BTREE,
  CONSTRAINT `FK_BILL_CREDIT_EXPENSES_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_EXPENSES_ACCOUNT_TO_ID` FOREIGN KEY (`ACCOUNT_TO_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_EXPENSES_BILL_ID` FOREIGN KEY (`BILL_CREDIT_ID`) REFERENCES `bill_credit` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_EXPENSES_CLASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bill_credit_items`
--

DROP TABLE IF EXISTS `bill_credit_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_credit_items` (
  `ID` int unsigned NOT NULL,
  `BILL_CREDIT_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `GAIN_LOSS_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `PROJECT_ID` int unsigned DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_BILL_CREDIT_ITEMS_BILL_CREDIT_ID` (`BILL_CREDIT_ID`) USING BTREE,
  KEY `FK_BILL_CREDIT_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_BILL_CREDIT_ITEMS_ACCOUNT_ID` (`ACCOUNT_ID`) USING BTREE,
  KEY `FK_BILL_CREDIT_ITEMS_UNIT_ID` (`UNIT_ID`),
  KEY `FK_BILL_CREDIT_ITEMS_CLASS_ID` (`CLASS_ID`),
  CONSTRAINT `FK_BILL_CREDIT_ITEMS_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_ITEMS_BILL_CREDIT_ID` FOREIGN KEY (`BILL_CREDIT_ID`) REFERENCES `bill_credit` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_ITEMS_CLASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_BILL_CREDIT_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bill_expenses`
--

DROP TABLE IF EXISTS `bill_expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_expenses` (
  `ID` int unsigned NOT NULL,
  `BILL_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ACCOUNT_TO_ID` int unsigned DEFAULT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `PARTICULARS` varchar(255) DEFAULT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `PROJECT_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_BILL_EXPENSES_BILL_ID` (`BILL_ID`),
  KEY `FK_BILL_EXPENSES_ACCOUNT_ID` (`ACCOUNT_ID`),
  KEY `FK_BILL_EXPENSES_CLASS_ID` (`CLASS_ID`),
  KEY `FK_BILL_EXPENSES_ACCOUNT_TO_ID` (`ACCOUNT_TO_ID`) USING BTREE,
  CONSTRAINT `FK_BILL_EXPENSES_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_BILL_EXPENSES_ACCOUNT_TO_ID` FOREIGN KEY (`ACCOUNT_TO_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_BILL_EXPENSES_BILL_ID` FOREIGN KEY (`BILL_ID`) REFERENCES `bill` (`ID`),
  CONSTRAINT `FK_BILL_EXPENSES_CLASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bill_items`
--

DROP TABLE IF EXISTS `bill_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bill_items` (
  `ID` int unsigned NOT NULL,
  `BILL_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `PO_ITEM_ID` int unsigned DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `PROJECT_ID` int DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_BILL_ITEMS_BILL_ID` (`BILL_ID`) USING BTREE,
  KEY `FK_BILL_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_BILL_ITEMS_BATCH_ID` (`BATCH_ID`) USING BTREE,
  KEY `FK_BILL_ITEMS_ACCOUNT_ID` (`ACCOUNT_ID`) USING BTREE,
  KEY `FK_BILL_ITEMS_PO_ITEM_ID` (`PO_ITEM_ID`) USING BTREE,
  KEY `FK_BILL_ITEMS_UNIT_ID` (`UNIT_ID`),
  KEY `FK_BILL_ITEMS_CLASS_ID` (`CLASS_ID`),
  CONSTRAINT `FK_BILL_ITEMS_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_BILL_ITEMS_BATCH_ID` FOREIGN KEY (`BATCH_ID`) REFERENCES `item_batches` (`ID`),
  CONSTRAINT `FK_BILL_ITEMS_BILL_ID` FOREIGN KEY (`BILL_ID`) REFERENCES `bill` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_BILL_ITEMS_CLASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_BILL_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_BILL_ITEMS_PO_ITEM_ID` FOREIGN KEY (`PO_ITEM_ID`) REFERENCES `purchase_order_items` (`ID`),
  CONSTRAINT `FK_BILL_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `build_assembly`
--

DROP TABLE IF EXISTS `build_assembly`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `build_assembly` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `ASSEMBLY_ITEM_ID` int unsigned NOT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned NOT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_BUILD_ASSEMBLY_CODE` (`CODE`),
  KEY `FK_BUILD_ASSEMBLY_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_BUILD_ASSEMBLY_ASSEMBLY_ITEM_ID` (`ASSEMBLY_ITEM_ID`),
  KEY `FK_BUILD_ASSEMBLY_ASSET_ACCOUNT_ID` (`ASSET_ACCOUNT_ID`),
  KEY `FK_BUILD_ASSEMBLY_UNIT_ID` (`UNIT_ID`),
  CONSTRAINT `FK_BUILD_ASSEMBLY_ASSEMBLY_ITEM_ID` FOREIGN KEY (`ASSEMBLY_ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_BUILD_ASSEMBLY_ASSET_ACCOUNT_ID` FOREIGN KEY (`ASSET_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_BUILD_ASSEMBLY_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_BUILD_ASSEMBLY_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `build_assembly_items`
--

DROP TABLE IF EXISTS `build_assembly_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `build_assembly_items` (
  `ID` int unsigned NOT NULL,
  `BUILD_ASSEMBLY_ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned NOT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_BUILD_ASSEMBLY_ITEMS_BUILD_ASSEMBLY_ID` (`BUILD_ASSEMBLY_ID`) USING BTREE,
  KEY `FK_BUILD_ASSEMBLY_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_BUILD_ASSEMBLY_ITEMS_ASSET_ACCOUNT_ID` (`ASSET_ACCOUNT_ID`) USING BTREE,
  CONSTRAINT `FK_BUILD_ASSEMBLY_ITEMS_ASSET_ACCOUNT_ID` FOREIGN KEY (`ASSET_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_BUILD_ASSEMBLY_ITEMS_BUILD_ASSEMBLY_ID` FOREIGN KEY (`BUILD_ASSEMBLY_ID`) REFERENCES `build_assembly` (`ID`),
  CONSTRAINT `FK_BUILD_ASSEMBLY_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `check`
--

DROP TABLE IF EXISTS `check`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `check` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `BANK_ACCOUNT_ID` int unsigned NOT NULL,
  `PAY_TO_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `PRINTED` tinyint(1) NOT NULL,
  `INPUT_TAX_ID` int unsigned DEFAULT NULL,
  `INPUT_TAX_RATE` decimal(6,2) DEFAULT NULL,
  `INPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `INPUT_TAX_VAT_METHOD` tinyint unsigned DEFAULT NULL,
  `INPUT_TAX_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `ACCOUNTS_PAYABLE_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_CHECK_CODE` (`CODE`),
  KEY `FK_CHECK_BANK_ACCOUNT_ID` (`BANK_ACCOUNT_ID`),
  KEY `FK_CHECK_TYPE` (`TYPE`),
  KEY `FK_CHECK_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_CHECK_INPUT_TAX_ID` (`INPUT_TAX_ID`),
  KEY `FK_CHECK_INPUT_TAX_VAT_METHOD` (`INPUT_TAX_VAT_METHOD`),
  KEY `FK_CHECK_INPUT_TAX_ACCOUNT_ID` (`INPUT_TAX_ACCOUNT_ID`),
  KEY `FK_CHECK_PAY_TO_ID` (`PAY_TO_ID`),
  KEY `FK_CHECK_ACCOUNTS_PAYABLE_ID` (`ACCOUNTS_PAYABLE_ID`),
  KEY `IX_CHECK_CUSTOM_FIELD1` (`CUSTOM_FIELD1`),
  KEY `IX_CHECK_CUSTOM_FIELD2` (`CUSTOM_FIELD2`),
  KEY `IX_CHECK_CUSTOM_FIELD3` (`CUSTOM_FIELD3`),
  KEY `IX_CHECK_CUSTOM_FIELD4` (`CUSTOM_FIELD4`),
  KEY `IX_CHECK_CUSTOM_FIELD5` (`CUSTOM_FIELD5`),
  CONSTRAINT `FK_CHECK_ACCOUNTS_PAYABLE_ID` FOREIGN KEY (`ACCOUNTS_PAYABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CHECK_BANK_ACCOUNT_ID` FOREIGN KEY (`BANK_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CHECK_INPUT_TAX_ACCOUNT_ID` FOREIGN KEY (`INPUT_TAX_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CHECK_INPUT_TAX_ID` FOREIGN KEY (`INPUT_TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_CHECK_INPUT_TAX_VAT_METHOD` FOREIGN KEY (`INPUT_TAX_VAT_METHOD`) REFERENCES `vat_method_map` (`ID`),
  CONSTRAINT `FK_CHECK_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_CHECK_PAY_TO_ID` FOREIGN KEY (`PAY_TO_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_CHECK_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `check_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `check_bill_other_details`
--

DROP TABLE IF EXISTS `check_bill_other_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `check_bill_other_details` (
  `ID` int unsigned NOT NULL,
  `CHECK_ID` int unsigned NOT NULL,
  `OBJECT_TYPE` int unsigned NOT NULL,
  `OBJECT_ID` int unsigned NOT NULL,
  `DISCOUNT` decimal(16,4) DEFAULT NULL,
  `AMOUNT_PAID` decimal(16,4) NOT NULL,
  `DISCOUNT_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `ACCOUNTS_PAYABLE_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_CHECK_BILL_OTHER_DETAILS_ACCOUNTS_PAYABLE_ID` (`ACCOUNTS_PAYABLE_ID`),
  KEY `FK_CHECK_BILL_OTHER_DETAILS_DISCOUNT_ACCOUNT_ID` (`DISCOUNT_ACCOUNT_ID`),
  KEY `FK_CHECK_BILL_OTHER_DETAILS_CHECK_ID` (`CHECK_ID`),
  CONSTRAINT `FK_CHECK_BILL_OTHER_DETAILS_ACCOUNTS_PAYABLE_ID` FOREIGN KEY (`ACCOUNTS_PAYABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CHECK_BILL_OTHER_DETAILS_CHECK_ID` FOREIGN KEY (`CHECK_ID`) REFERENCES `check` (`ID`),
  CONSTRAINT `FK_CHECK_BILL_OTHER_DETAILS_DISCOUNT_ACCOUNT_ID` FOREIGN KEY (`DISCOUNT_ACCOUNT_ID`) REFERENCES `account` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `check_bills`
--

DROP TABLE IF EXISTS `check_bills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `check_bills` (
  `ID` int unsigned NOT NULL,
  `CHECK_ID` int unsigned NOT NULL,
  `BILL_ID` int unsigned NOT NULL,
  `DISCOUNT` decimal(16,4) DEFAULT NULL,
  `AMOUNT_PAID` decimal(16,4) NOT NULL,
  `DISCOUNT_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `ACCOUNTS_PAYABLE_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_CHECK_BILLS_CHECK_ID` (`CHECK_ID`),
  KEY `FK_CHECK_BILLS_BILL_ID` (`BILL_ID`),
  KEY `FK_CHECK_BILLS_DISCOUNT_ACCOUNT_ID` (`DISCOUNT_ACCOUNT_ID`),
  KEY `FK_CHECK_BILLS_ACCOUNTS_PAYABLE_ID` (`ACCOUNTS_PAYABLE_ID`) USING BTREE,
  CONSTRAINT `FK_CHECK_BILLS_ACCOUNTS_PAYABLE_ID` FOREIGN KEY (`ACCOUNTS_PAYABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CHECK_BILLS_BILL_ID` FOREIGN KEY (`BILL_ID`) REFERENCES `bill` (`ID`),
  CONSTRAINT `FK_CHECK_BILLS_CHECK_ID` FOREIGN KEY (`CHECK_ID`) REFERENCES `check` (`ID`),
  CONSTRAINT `FK_CHECK_BILLS_DISCOUNT_ACCOUNT_ID` FOREIGN KEY (`DISCOUNT_ACCOUNT_ID`) REFERENCES `account` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `check_expenses`
--

DROP TABLE IF EXISTS `check_expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `check_expenses` (
  `ID` int unsigned NOT NULL,
  `CHECK_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ACCOUNT_TO_ID` int unsigned DEFAULT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `PARTICULARS` varchar(255) DEFAULT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `PROJECT_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_CHECK_EXPENSES_CHECK_ID` (`CHECK_ID`),
  KEY `FK_CHECK_EXPENSES_ACCOUNT_ID` (`ACCOUNT_ID`),
  KEY `FK_CHECK_EXPENSES_CLASS_ID` (`CLASS_ID`),
  KEY `FK_CHECK_EXPENSES_ACCOUNT_TO_ID` (`ACCOUNT_TO_ID`) USING BTREE,
  CONSTRAINT `FK_CHECK_EXPENSES_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CHECK_EXPENSES_ACCOUNT_TO_ID` FOREIGN KEY (`ACCOUNT_TO_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_CHECK_EXPENSES_CHECK_ID` FOREIGN KEY (`CHECK_ID`) REFERENCES `check` (`ID`),
  CONSTRAINT `FK_CHECK_EXPENSES_CLASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `check_expenses_credits`
--

DROP TABLE IF EXISTS `check_expenses_credits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `check_expenses_credits` (
  `ID` int unsigned NOT NULL,
  `CHECK_EXPENSES_ID` int unsigned NOT NULL,
  `CREDIT_MEMO_ID` int unsigned NOT NULL,
  `AMOUNT_RETURN` decimal(16,4) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_CHECK_EXPENSES_CREDITS_CHECK_EXPENSES_ID` (`CHECK_EXPENSES_ID`),
  KEY `FK_CHECK_EXPENSES_CREDITS_CREDIT_MEMO_ID` (`CREDIT_MEMO_ID`),
  CONSTRAINT `FK_CHECK_EXPENSES_CREDITS_CHECK_EXPENSES_ID` FOREIGN KEY (`CHECK_EXPENSES_ID`) REFERENCES `check_expenses` (`ID`),
  CONSTRAINT `FK_CHECK_EXPENSES_CREDITS_CREDIT_MEMO_ID` FOREIGN KEY (`CREDIT_MEMO_ID`) REFERENCES `credit_memo` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `check_items`
--

DROP TABLE IF EXISTS `check_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `check_items` (
  `ID` int unsigned NOT NULL,
  `CHECK_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `PROJECT_ID` int unsigned DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_CHECK_ITEMS_CHECK_ID` (`CHECK_ID`),
  KEY `FK_CHECK_ITEMS_ITEM_ID` (`ITEM_ID`),
  KEY `FK_CHECK_ITEMS_BATCH_ID` (`BATCH_ID`),
  KEY `FK_CHECK_ITEMS_ACCOUNT_ID` (`ACCOUNT_ID`) USING BTREE,
  KEY `FK_CHECK_ITEMS_UNIT_ID` (`UNIT_ID`),
  KEY `FK_CHECK_ITEMS_CLASS_ID` (`CLASS_ID`),
  CONSTRAINT `FK_CHECK_ITEMS_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CHECK_ITEMS_BATCH_ID` FOREIGN KEY (`BATCH_ID`) REFERENCES `item_batches` (`ID`),
  CONSTRAINT `FK_CHECK_ITEMS_CHECK_ID` FOREIGN KEY (`CHECK_ID`) REFERENCES `check` (`ID`),
  CONSTRAINT `FK_CHECK_ITEMS_CLASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_CHECK_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_CHECK_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `check_type_map`
--

DROP TABLE IF EXISTS `check_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `check_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `NAME` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `civil_status_map`
--

DROP TABLE IF EXISTS `civil_status_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `civil_status_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `class`
--

DROP TABLE IF EXISTS `class`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `class` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(50) NOT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `IX_CLASS_NAME` (`NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contact`
--

DROP TABLE IF EXISTS `contact`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact` (
  `ID` int unsigned NOT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `NAME` varchar(100) NOT NULL,
  `COMPANY_NAME` varchar(100) DEFAULT NULL,
  `SALUTATION` varchar(10) DEFAULT NULL,
  `FIRST_NAME` varchar(50) DEFAULT NULL,
  `MIDDLE_NAME` varchar(50) DEFAULT NULL,
  `LAST_NAME` varchar(50) DEFAULT NULL,
  `PRINT_NAME_AS` varchar(100) DEFAULT NULL,
  `POSTAL_ADDRESS` varchar(255) DEFAULT NULL,
  `CONTACT_PERSON` varchar(50) DEFAULT NULL,
  `TELEPHONE_NO` varchar(150) DEFAULT NULL,
  `FAX_NO` varchar(50) DEFAULT NULL,
  `MOBILE_NO` varchar(20) DEFAULT NULL,
  `ALT_TELEPHONE_NO` varchar(20) DEFAULT NULL,
  `ALT_CONTACT_PERSON` varchar(50) DEFAULT NULL,
  `EMAIL` varchar(255) DEFAULT NULL,
  `ACCOUNT_NO` varchar(20) DEFAULT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  `GROUP_ID` int unsigned DEFAULT NULL,
  `PAYMENT_TERMS_ID` int unsigned DEFAULT NULL,
  `CREDIT_LIMIT` decimal(16,4) DEFAULT NULL,
  `PREF_PAYMENT_METHOD_ID` int unsigned DEFAULT NULL,
  `CREDIT_CARD_NO` varchar(20) DEFAULT NULL,
  `CREDIT_CARD_EXPIRY_DATE` date DEFAULT NULL,
  `SALES_REP_ID` int unsigned DEFAULT NULL,
  `PRICE_LEVEL_ID` int unsigned DEFAULT NULL,
  `APPLY_FINANCE_CHARGE` tinyint(1) DEFAULT NULL,
  `TAXPAYER_ID` varchar(20) DEFAULT NULL,
  `TAX_ID` int unsigned DEFAULT NULL,
  `EW_TAX_ID` int unsigned DEFAULT NULL,
  `SSS_NO` varchar(20) DEFAULT NULL,
  `PAGIBIG_NO` varchar(20) DEFAULT NULL,
  `PHIC_NO` varchar(20) DEFAULT NULL,
  `GENDER` tinyint unsigned DEFAULT NULL,
  `DATE_OF_BIRTH` date DEFAULT NULL,
  `NICKNAME` varchar(20) DEFAULT NULL,
  `HIRE_DATE` date DEFAULT NULL,
  `POSITION` varchar(100) DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_CONTACT_NAME` (`NAME`),
  UNIQUE KEY `IX_CONTACT_ACCOUNT_NO` (`TYPE`,`ACCOUNT_NO`),
  KEY `FK_CONTACT_TYPE` (`TYPE`),
  KEY `FK_CONTACT_PAYMENT_TERMS_ID` (`PAYMENT_TERMS_ID`),
  KEY `FK_CONTACT_PREF_PAYMENT_METHOD_ID` (`PREF_PAYMENT_METHOD_ID`),
  KEY `FK_CONTACT_SALES_REP_ID` (`SALES_REP_ID`),
  KEY `FK_CONTACT_PRICE_LEVEL_ID` (`PRICE_LEVEL_ID`),
  KEY `FK_CONTACT_GROUP_ID` (`GROUP_ID`),
  KEY `FK_CONTACT_TAX_ID` (`TAX_ID`),
  KEY `FK_CONTACT_EW_TAX_ID` (`EW_TAX_ID`),
  CONSTRAINT `FK_CONTACT_EW_TAX_ID` FOREIGN KEY (`EW_TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_CONTACT_GROUP_ID` FOREIGN KEY (`GROUP_ID`) REFERENCES `contact_group` (`ID`),
  CONSTRAINT `FK_CONTACT_PAYMENT_TERMS_ID` FOREIGN KEY (`PAYMENT_TERMS_ID`) REFERENCES `payment_terms` (`ID`),
  CONSTRAINT `FK_CONTACT_PREF_PAYMENT_METHOD_ID` FOREIGN KEY (`PREF_PAYMENT_METHOD_ID`) REFERENCES `payment_method` (`ID`),
  CONSTRAINT `FK_CONTACT_PRICE_LEVEL_ID` FOREIGN KEY (`PRICE_LEVEL_ID`) REFERENCES `price_level` (`ID`),
  CONSTRAINT `FK_CONTACT_SALES_REP_ID` FOREIGN KEY (`SALES_REP_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_CONTACT_TAX_ID` FOREIGN KEY (`TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_CONTACT_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `contact_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contact_group`
--

DROP TABLE IF EXISTS `contact_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_group` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_CONTACT_GROUP_TYPE` (`TYPE`),
  CONSTRAINT `FK_CONTACT_GROUP_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `contact_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contact_type_map`
--

DROP TABLE IF EXISTS `contact_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `credit_memo`
--

DROP TABLE IF EXISTS `credit_memo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `credit_memo` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `CUSTOMER_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `SALES_REP_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `AMOUNT_APPLIED` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `ACCOUNTS_RECEIVABLE_ID` int unsigned DEFAULT NULL,
  `OUTPUT_TAX_ID` int unsigned DEFAULT NULL,
  `OUTPUT_TAX_RATE` decimal(6,2) DEFAULT NULL,
  `OUTPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `OUTPUT_TAX_VAT_METHOD` tinyint unsigned DEFAULT NULL,
  `OUTPUT_TAX_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `NONTAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `PROJECT_ID` int DEFAULT NULL,
  `POS_MACHINE_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_CREDIT_MEMO` (`CODE`),
  KEY `IX_CREDIT_MEMO_CUSTOMER_REF` (`CUSTOMER_ID`,`STATUS`),
  KEY `IX_CREDIT_MEMO_DATE` (`DATE`) USING BTREE,
  KEY `FK_CREDIT_MEMO_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `IX_CREDIT_MEMO_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  KEY `FK_CREDIT_MEMO_SALES_REP_ID` (`SALES_REP_ID`),
  KEY `FK_CREDIT_MEMO_ACCOUNTS_RECEIVABLE_ID` (`ACCOUNTS_RECEIVABLE_ID`),
  KEY `FK_CREDIT_MEMO_OUTPUT_TAX_ID` (`OUTPUT_TAX_ID`),
  KEY `FK_CREDIT_MEMO_OUTPUT_TAX_VAT_METHOD` (`OUTPUT_TAX_VAT_METHOD`),
  KEY `FK_CREDIT_MEMO_OUTPUT_TAX_ACCOUNT_ID` (`OUTPUT_TAX_ACCOUNT_ID`),
  KEY `FK_CREDIT_MEMO_CASS_ID` (`CLASS_ID`),
  KEY `IX_CREDIT_MEMO_CUSTOM_FIELD1` (`CUSTOM_FIELD1`),
  KEY `IX_CREDIT_MEMO_CUSTOM_FIELD2` (`CUSTOM_FIELD2`),
  KEY `IX_CREDIT_MEMO_CUSTOM_FIELD3` (`CUSTOM_FIELD3`),
  KEY `IX_CREDIT_MEMO_CUSTOM_FIELD4` (`CUSTOM_FIELD4`),
  KEY `IX_CREDIT_MEMO_CUSTOM_FIELD5` (`CUSTOM_FIELD5`),
  CONSTRAINT `FK_CREDIT_MEMO_ACCOUNTS_RECEIVABLE_ID` FOREIGN KEY (`ACCOUNTS_RECEIVABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_CASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_CUSTOMER_ID` FOREIGN KEY (`CUSTOMER_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_OUTPUT_TAX_ACCOUNT_ID` FOREIGN KEY (`OUTPUT_TAX_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_OUTPUT_TAX_ID` FOREIGN KEY (`OUTPUT_TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_OUTPUT_TAX_VAT_METHOD` FOREIGN KEY (`OUTPUT_TAX_VAT_METHOD`) REFERENCES `vat_method_map` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_SALES_REP_ID` FOREIGN KEY (`SALES_REP_ID`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `credit_memo_invoices`
--

DROP TABLE IF EXISTS `credit_memo_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `credit_memo_invoices` (
  `ID` int unsigned NOT NULL,
  `CREDIT_MEMO_ID` int unsigned NOT NULL,
  `INVOICE_ID` int unsigned NOT NULL,
  `AMOUNT_APPLIED` decimal(16,4) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_CREDIT_MEMO_INVOICES_INVOICE_ID` (`INVOICE_ID`),
  KEY `FK_CREDIT_MEMO_INVOICES_CREDIT_MEMO_ID` (`CREDIT_MEMO_ID`) USING BTREE,
  CONSTRAINT `FK_CREDIT_MEMO_INVOICES_CREDIT_MEMO_ID` FOREIGN KEY (`CREDIT_MEMO_ID`) REFERENCES `credit_memo` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_INVOICES_INVOICE_ID` FOREIGN KEY (`INVOICE_ID`) REFERENCES `invoice` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `credit_memo_items`
--

DROP TABLE IF EXISTS `credit_memo_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `credit_memo_items` (
  `ID` int unsigned NOT NULL,
  `CREDIT_MEMO_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned DEFAULT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `COGS_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `INCOME_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `GROUP_LINE_ID` int unsigned DEFAULT NULL,
  `PRINT_IN_FORMS` tinyint(1) DEFAULT NULL,
  `PRICE_LEVEL_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_CREDIT_MEMO_ITEMS_CREDIT_MEMO_ID` (`CREDIT_MEMO_ID`) USING BTREE,
  KEY `FK_CREDIT_MEMO_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_CREDIT_MEMO_ITEMS_COGS_ACCOUNT_ID` (`COGS_ACCOUNT_ID`) USING BTREE,
  KEY `FK_CREDIT_MEMO_ITEMS_ASSET_ACCOUNT_ID` (`ASSET_ACCOUNT_ID`) USING BTREE,
  KEY `FK_CREDIT_MEMO_ITEMS_INCOME_ACCOUNT_ID` (`INCOME_ACCOUNT_ID`) USING BTREE,
  KEY `FK_CREDIT_MEMO_ITEMS_BATCH_ID` (`BATCH_ID`) USING BTREE,
  KEY `FK_CREDIT_MEMO_ITEMS_UNIT_ID` (`UNIT_ID`),
  CONSTRAINT `FK_CREDIT_MEMO_ITEMS_ASSET_ACCOUNT_ID` FOREIGN KEY (`ASSET_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_ITEMS_BATCH_ID` FOREIGN KEY (`BATCH_ID`) REFERENCES `item_batches` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_ITEMS_COGS_ACCOUNT_ID` FOREIGN KEY (`COGS_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_ITEMS_CREDIT_MEMO_ID` FOREIGN KEY (`CREDIT_MEMO_ID`) REFERENCES `credit_memo` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_ITEMS_INCOME_ACCOUNT_ID` FOREIGN KEY (`INCOME_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_CREDIT_MEMO_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `custom_field`
--

DROP TABLE IF EXISTS `custom_field`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `custom_field` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `NAME` varchar(50) DEFAULT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `INDEX` tinyint unsigned NOT NULL,
  `DATA_TYPE` tinyint unsigned DEFAULT NULL,
  `FORMAT` varchar(45) DEFAULT NULL,
  `EDITMASK` varchar(45) DEFAULT NULL,
  `ALIGNMENT` tinyint unsigned DEFAULT NULL,
  `CHARCASE` tinyint unsigned DEFAULT NULL,
  `ENABLED` tinyint(1) DEFAULT NULL,
  `REQUIRED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `CUSTOM_FIELD_TYPE_INDEX` (`TYPE`,`INDEX`),
  KEY `FK_CUSTOM_FIELD_DATA_TYPE` (`DATA_TYPE`),
  KEY `IX_CUSTOM_FIELD_TYPE_INDEX` (`TYPE`,`INDEX`),
  CONSTRAINT `FK_CUSTOM_FIELD_DATA_TYPE` FOREIGN KEY (`DATA_TYPE`) REFERENCES `custom_field_data_type_map` (`ID`),
  CONSTRAINT `FK_CUSTOM_FIELD_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `custom_field_type_map` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=129 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `custom_field_data_type_map`
--

DROP TABLE IF EXISTS `custom_field_data_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `custom_field_data_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `custom_field_lookup`
--

DROP TABLE IF EXISTS `custom_field_lookup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `custom_field_lookup` (
  `ID` int unsigned NOT NULL,
  `CUSTOM_FIELD_ID` int unsigned NOT NULL,
  `NAME` varchar(512) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_CUSTOM_FIELD_LOOKUP_CUSTOM_FIELD_ID` (`CUSTOM_FIELD_ID`),
  CONSTRAINT `FK_CUSTOM_FIELD_LOOKUP_CUSTOM_FIELD_ID` FOREIGN KEY (`CUSTOM_FIELD_ID`) REFERENCES `custom_field` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `custom_field_map`
--

DROP TABLE IF EXISTS `custom_field_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `custom_field_map` (
  `ID` tinyint unsigned NOT NULL,
  `NAME` varchar(50) NOT NULL,
  `FIELD_NAME` varchar(50) DEFAULT NULL,
  `DISPLAY_LABEL` varchar(50) DEFAULT NULL,
  `DISPLAY_FORMAT` varchar(50) DEFAULT NULL,
  `EDIT_MASK` varchar(50) DEFAULT NULL,
  `ALIGNMENT` tinyint unsigned NOT NULL,
  `CHARCASE` tinyint unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `custom_field_type_map`
--

DROP TABLE IF EXISTS `custom_field_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `custom_field_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `custom_fields`
--

DROP TABLE IF EXISTS `custom_fields`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `custom_fields` (
  `ID` int unsigned NOT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `DOCUMENT_TYPE` tinyint unsigned NOT NULL,
  `REQUIRED` tinyint(1) NOT NULL,
  `VISIBLE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_CUSTOM_FIELDS_DOCUMENT_TYPE` (`DOCUMENT_TYPE`),
  CONSTRAINT `FK_CUSTOM_FIELDS_DOCUMENT_TYPE` FOREIGN KEY (`DOCUMENT_TYPE`) REFERENCES `document_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `customer_transaction_detail_view`
--

DROP TABLE IF EXISTS `customer_transaction_detail_view`;
/*!50001 DROP VIEW IF EXISTS `customer_transaction_detail_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `customer_transaction_detail_view` AS SELECT 
 1 AS `RECORDED_ON`,
 1 AS `CUSTOMER_ID`,
 1 AS `DOCUMENT_TYPE`,
 1 AS `DOCUMENT_ID`,
 1 AS `DOCUMENT_DATE`,
 1 AS `AMOUNT`,
 1 AS `GAINED_POINTS`,
 1 AS `REDEEMED_POINTS`,
 1 AS `TOTAL_POINTS`,
 1 AS `POINTS_CALCULATED`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `deposit`
--

DROP TABLE IF EXISTS `deposit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deposit` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `BANK_ACCOUNT_ID` int unsigned NOT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `CASH_BACK_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `CASH_BACK_AMOUNT` decimal(16,4) DEFAULT NULL,
  `CASH_BACK_NOTES` varchar(255) DEFAULT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `STATUS` tinyint DEFAULT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_DEPOSIT_CODE` (`CODE`),
  KEY `FK_DEPOSIT_BANK_ACCOUNT_ID` (`BANK_ACCOUNT_ID`),
  KEY `FK_DEPOSIT_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_DEPOSIT_CASH_BACK_ACCOUNT_ID` (`CASH_BACK_ACCOUNT_ID`),
  CONSTRAINT `FK_DEPOSIT_BANK_ACCOUNT_ID` FOREIGN KEY (`BANK_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_DEPOSIT_CASH_BACK_ACCOUNT_ID` FOREIGN KEY (`CASH_BACK_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_DEPOSIT_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `deposit_funds`
--

DROP TABLE IF EXISTS `deposit_funds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deposit_funds` (
  `ID` int unsigned NOT NULL,
  `DEPOSIT_ID` int unsigned NOT NULL,
  `RECEIVED_FROM_ID` int unsigned DEFAULT NULL,
  `ACCOUNT_ID` int unsigned NOT NULL,
  `PAYMENT_METHOD_ID` int unsigned DEFAULT NULL,
  `CHECK_NO` varchar(20) DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `PARTICULARS` varchar(255) DEFAULT NULL,
  `CLASS_ID` int DEFAULT NULL,
  `PROJECT_ID` tinyint DEFAULT NULL,
  `SOURCE_OBJECT_TYPE` tinyint unsigned DEFAULT NULL,
  `SOURCE_OBJECT_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_DEPOSIT_FUNDS_RECEIVED_FROM_ID` (`RECEIVED_FROM_ID`),
  KEY `FK_DEPOSIT_FUNDS_ACCOUNT_ID` (`ACCOUNT_ID`),
  KEY `FK_DEPOSIT_FUNDS_PAYMENT_METHOD_ID` (`PAYMENT_METHOD_ID`),
  CONSTRAINT `FK_DEPOSIT_FUNDS_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_DEPOSIT_FUNDS_PAYMENT_METHOD_ID` FOREIGN KEY (`PAYMENT_METHOD_ID`) REFERENCES `payment_method` (`ID`),
  CONSTRAINT `FK_DEPOSIT_FUNDS_RECEIVED_FROM_ID` FOREIGN KEY (`RECEIVED_FROM_ID`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `discount_type_map`
--

DROP TABLE IF EXISTS `discount_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `discount_type_map` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` varchar(45) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `document_layout`
--

DROP TABLE IF EXISTS `document_layout`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_layout` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `DOCUMENT_TYPE` tinyint unsigned NOT NULL,
  `LAYOUT` mediumtext NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_DOCUMENT_LAYOUT_DOCUMENT_TYPE` (`DOCUMENT_TYPE`),
  CONSTRAINT `FK_DOCUMENT_LAYOUT_DOCUMENT_TYPE` FOREIGN KEY (`DOCUMENT_TYPE`) REFERENCES `document_type_map` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=1043 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `document_status_map`
--

DROP TABLE IF EXISTS `document_status_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_status_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `document_type_map`
--

DROP TABLE IF EXISTS `document_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dummy`
--

DROP TABLE IF EXISTS `dummy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dummy` (
  `ID` int unsigned NOT NULL,
  `DUMMY_INT` int unsigned DEFAULT NULL,
  `DUMMY_TINYINT` tinyint unsigned DEFAULT NULL,
  `DUMMY_DEC` decimal(16,4) DEFAULT NULL,
  `DUMMY_QUANTITY` decimal(16,6) DEFAULT NULL,
  `DUMMY_CHAR` varchar(50) DEFAULT NULL,
  `DUMMY_FLAG` tinyint(1) DEFAULT NULL,
  `DUMMY_DATETIME` datetime DEFAULT NULL,
  `DUMMY_DATE` date DEFAULT NULL,
  `DUMMY_BLOB` mediumblob,
  `DUMMY_MEMO` mediumtext,
  `DUMMY_WIDECHAR` varchar(1024) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COMMENT='Used in user interface only.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_status_map`
--

DROP TABLE IF EXISTS `employee_status_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_status_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_type_map`
--

DROP TABLE IF EXISTS `employee_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_type_map` (
  `ID` tinyint NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `estimate`
--

DROP TABLE IF EXISTS `estimate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estimate` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `CUSTOMER_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `SALES_REP_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `OUTPUT_TAX_ID` int unsigned DEFAULT NULL,
  `OUTPUT_TAX_RATE` decimal(6,2) DEFAULT NULL,
  `OUTPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `OUTPUT_TAX_VAT_METHOD` tinyint unsigned DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `NONTAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `PAYMENT_TERMS_ID` int unsigned DEFAULT NULL,
  `PROJECT_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ESTIMATE_CODE` (`CODE`),
  KEY `FK_ESTIMATE_CUSTOMER_ID` (`CUSTOMER_ID`),
  KEY `FK_ESTIMATE_SALES_REP_ID` (`SALES_REP_ID`),
  KEY `IX_ESTIMATE_STATUS` (`CUSTOMER_ID`,`STATUS`) USING BTREE,
  KEY `IX_ESTIMATE_DATE` (`DATE`) USING BTREE,
  KEY `FK_ESTIMATE_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `IX_ESTIMATE_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  KEY `FK_ESTIMATE_OUTPUT_TAX_ID` (`OUTPUT_TAX_ID`),
  KEY `FK_ESTIMATE_OUTPUT_TAX_VAT_METHOD` (`OUTPUT_TAX_VAT_METHOD`),
  KEY `FK_ESTIMATE_CASS_ID` (`CLASS_ID`),
  KEY `IX_ESTIMATE_CUSTOM_FIELD1` (`CUSTOM_FIELD1`),
  KEY `IX_ESTIMATE_CUSTOM_FIELD2` (`CUSTOM_FIELD2`),
  KEY `IX_ESTIMATE_CUSTOM_FIELD3` (`CUSTOM_FIELD3`),
  KEY `IX_ESTIMATE_CUSTOM_FIELD4` (`CUSTOM_FIELD4`),
  KEY `IX_ESTIMATE_CUSTOM_FIELD5` (`CUSTOM_FIELD5`),
  KEY `FK_ESTIMATE_PAYMENT_TERMS_ID` (`PAYMENT_TERMS_ID`),
  CONSTRAINT `FK_ESTIMATE_CASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_ESTIMATE_CUSTOMER_ID` FOREIGN KEY (`CUSTOMER_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_ESTIMATE_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_ESTIMATE_OUTPUT_TAX_ID` FOREIGN KEY (`OUTPUT_TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_ESTIMATE_OUTPUT_TAX_VAT_METHOD` FOREIGN KEY (`OUTPUT_TAX_VAT_METHOD`) REFERENCES `vat_method_map` (`ID`),
  CONSTRAINT `FK_ESTIMATE_PAYMENT_TERMS_ID` FOREIGN KEY (`PAYMENT_TERMS_ID`) REFERENCES `payment_terms` (`ID`),
  CONSTRAINT `FK_ESTIMATE_SALES_REP_ID` FOREIGN KEY (`SALES_REP_ID`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `estimate_items`
--

DROP TABLE IF EXISTS `estimate_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estimate_items` (
  `ID` int unsigned NOT NULL,
  `ESTIMATE_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `FINAL_QTY` decimal(16,6) DEFAULT NULL,
  `CLOSED` tinyint unsigned NOT NULL,
  `GROUP_LINE_ID` int unsigned DEFAULT NULL,
  `PRINT_IN_FORMS` tinyint(1) DEFAULT NULL,
  `PRICE_LEVEL_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ESTIMATE_ITEMS_ESTIMATE_ID` (`ESTIMATE_ID`) USING BTREE,
  KEY `FK_ESTIMATE_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `IX_ESTIMATE_ITEMS_CLOSED` (`CLOSED`) USING BTREE,
  KEY `FK_ESTIMATE_ITEMS_RATE_TYPE` (`RATE_TYPE`) USING BTREE,
  KEY `FK_ESTIMATE_ITEMS_UNIT_ID` (`UNIT_ID`),
  CONSTRAINT `FK_ESTIMATE_ITEMS_ESTIMATE_ID` FOREIGN KEY (`ESTIMATE_ID`) REFERENCES `estimate` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ESTIMATE_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_ESTIMATE_ITEMS_RATE_TYPE` FOREIGN KEY (`RATE_TYPE`) REFERENCES `rate_type_map` (`ID`),
  CONSTRAINT `FK_ESTIMATE_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `frequency_map`
--

DROP TABLE IF EXISTS `frequency_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `frequency_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fund_transfer`
--

DROP TABLE IF EXISTS `fund_transfer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fund_transfer` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `DATE` date NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `FROM_ACCOUNT_ID` int unsigned NOT NULL,
  `TO_ACCOUNT_ID` int unsigned NOT NULL,
  `FROM_NAME_ID` int unsigned DEFAULT NULL,
  `TO_NAME_ID` int unsigned DEFAULT NULL,
  `FROM_LOCATION_ID` int unsigned NOT NULL,
  `TO_LOCATION_ID` int unsigned NOT NULL,
  `INTER_LOCATION_ACCOUNT_ID` int unsigned NOT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `NOTES` varchar(256) DEFAULT NULL,
  `STATUS` tinyint DEFAULT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_FUND_TRANSFER_FROM_ACCOUNT_ID` (`FROM_ACCOUNT_ID`),
  KEY `FK_FUND_TRANSFER_FUND_TO_ACCOUNT_ID` (`TO_ACCOUNT_ID`),
  KEY `FK_FUND_TRANSFER_FUND_INTER_LOCATION_ACCOUNT_ID` (`INTER_LOCATION_ACCOUNT_ID`),
  KEY `FK_FUND_TRANSFER_FROM_LOCATION_ID` (`FROM_LOCATION_ID`),
  KEY `FK_FUND_TRANSFER_TO_LOCATION_ID` (`TO_LOCATION_ID`),
  KEY `FK_FUND_TRANSFER_CLASS_ID` (`CLASS_ID`),
  CONSTRAINT `FK_FUND_TRANSFER_CLASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_FUND_TRANSFER_FROM_ACCOUNT_ID` FOREIGN KEY (`FROM_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_FUND_TRANSFER_FROM_LOCATION_ID` FOREIGN KEY (`FROM_LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_FUND_TRANSFER_FUND_INTER_LOCATION_ACCOUNT_ID` FOREIGN KEY (`INTER_LOCATION_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_FUND_TRANSFER_FUND_TO_ACCOUNT_ID` FOREIGN KEY (`TO_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_FUND_TRANSFER_TO_LOCATION_ID` FOREIGN KEY (`TO_LOCATION_ID`) REFERENCES `location` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `gender_map`
--

DROP TABLE IF EXISTS `gender_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gender_map` (
  `ID` tinyint NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `general_journal`
--

DROP TABLE IF EXISTS `general_journal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `general_journal` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `DATE` date NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `LOCATION_ID` int unsigned DEFAULT NULL,
  `ADJUSTING_ENTRY` tinyint(1) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_GENERAL_JOURNAL_CODE` (`CODE`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `general_journal_details`
--

DROP TABLE IF EXISTS `general_journal_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `general_journal_details` (
  `ID` int unsigned NOT NULL,
  `GENERAL_JOURNAL_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `CONTACT_ID` int DEFAULT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `ENTRY_TYPE` tinyint unsigned DEFAULT NULL,
  `DEBIT` decimal(16,4) DEFAULT NULL,
  `CREDIT` decimal(16,4) DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `UNSETTLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `PROJECT_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_GENERAL_JOURNAL_DETAILS_GENERAL_JOURNAL_ID` (`GENERAL_JOURNAL_ID`),
  KEY `FK_GENERAL_JOURNAL_DETAILS_ACCOUNT_ID` (`ACCOUNT_ID`),
  KEY `FK_GENERAL_JOURNAL_DETAILS_CLASS_ID` (`CLASS_ID`),
  CONSTRAINT `FK_GENERAL_JOURNAL_DETAILS_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_GENERAL_JOURNAL_DETAILS_CLASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_GENERAL_JOURNAL_DETAILS_GENERAL_JOURNAL_ID` FOREIGN KEY (`GENERAL_JOURNAL_ID`) REFERENCES `general_journal` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `general_journal_outstanding_details`
--

DROP TABLE IF EXISTS `general_journal_outstanding_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `general_journal_outstanding_details` (
  `ID` int unsigned NOT NULL,
  `GENERAL_JOURNAL_LINE_ID` int unsigned NOT NULL,
  `OBJECT_TYPE` int unsigned NOT NULL,
  `OBJECT_ID` int unsigned NOT NULL,
  `AMOUNT_PAID` decimal(16,4) NOT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_GENERAL_JOURNAL_OUTSTANDING_DETAILS_ACCOUNT_ID` (`ACCOUNT_ID`),
  KEY `FK_GENERAL_JOURNAL_DETAILS_GENERAL_JOURNAL_LINE_ID` (`GENERAL_JOURNAL_LINE_ID`),
  CONSTRAINT `FK_GENERAL_JOURNAL_DETAILS_GENERAL_JOURNAL_LINE_ID` FOREIGN KEY (`GENERAL_JOURNAL_LINE_ID`) REFERENCES `general_journal_details` (`ID`),
  CONSTRAINT `FK_GENERAL_JOURNAL_OUTSTANDING_DETAILS_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `gift_certificate`
--

DROP TABLE IF EXISTS `gift_certificate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gift_certificate` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `CUSTOMER_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `BALANCE_DUE` decimal(16,4) DEFAULT NULL,
  `EXPIRATION_DATE` date NOT NULL,
  `INACTIVE` tinyint unsigned DEFAULT '0',
  `RECORDED_ON` datetime DEFAULT NULL,
  `SURCHARGE` int unsigned DEFAULT NULL,
  `GC_TYPE` tinyint unsigned DEFAULT NULL,
  `BALANCE` decimal(16,4) DEFAULT NULL,
  `REMARKS` varchar(255) DEFAULT NULL,
  `LOCATION_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_GIFT_CERTIFICATE_CODE` (`CODE`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `gift_certificate_type_map`
--

DROP TABLE IF EXISTS `gift_certificate_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gift_certificate_type_map` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `holiday_schedule`
--

DROP TABLE IF EXISTS `holiday_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holiday_schedule` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  `FREQUENCY` tinyint unsigned NOT NULL,
  `START_ON` date NOT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `IX_HOLIDAY_SCHEDULE_CODE` (`CODE`),
  KEY `FK_HOLIDAY_SCHEDULE_FREQUENCY` (`FREQUENCY`),
  CONSTRAINT `FK_HOLIDAY_SCHEDULE_FREQUENCY` FOREIGN KEY (`FREQUENCY`) REFERENCES `frequency_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_adjustment`
--

DROP TABLE IF EXISTS `inventory_adjustment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_adjustment` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime DEFAULT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `ADJUSTMENT_TYPE_ID` int unsigned NOT NULL,
  `ACCOUNT_ID` int unsigned NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `SOURCE_REF_TYPE` int DEFAULT NULL,
  `DISPUTE_SOURCE_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_INVENTORY_ADJUSTMENT_CODE` (`CODE`),
  KEY `FK_INVENTORY_ADJUSTMENT_ADJUSTMENT_TYPE_ID` (`ADJUSTMENT_TYPE_ID`),
  KEY `IX_INVENTORY_ADJUSTMENT_DATE` (`DATE`) USING BTREE,
  KEY `FK_INVENTORY_ADJUSTMENT_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `IX_INVENTORY_ADJUSTMENT_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  KEY `FK_INVENTORY_ADJUSTMENT_ACCOUNT_ID` (`ACCOUNT_ID`) USING BTREE,
  CONSTRAINT `FK_INVENTORY_ADJUSTMENT_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_INVENTORY_ADJUSTMENT_ADJUSTMENT_TYPE_ID` FOREIGN KEY (`ADJUSTMENT_TYPE_ID`) REFERENCES `inventory_adjustment_type` (`ID`),
  CONSTRAINT `FK_INVENTORY_ADJUSTMENT_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_adjustment_items`
--

DROP TABLE IF EXISTS `inventory_adjustment_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_adjustment_items` (
  `ID` int unsigned NOT NULL,
  `INVENTORY_ADJUSTMENT_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QTY_DIFFERENCE` decimal(16,6) DEFAULT NULL,
  `VALUE_DIFFERENCE` decimal(16,4) DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned NOT NULL,
  `ASSET_VALUE` decimal(16,4) NOT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `SOURCE_REF_TYPE` int DEFAULT NULL,
  `RECEIVE_LINE_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_INVENTORY_ADJUSTMENT_ITEMS_ASSET_ACCOUNT_ID` (`ASSET_ACCOUNT_ID`) USING BTREE,
  KEY `FK_INVENTORY_ADJUSTMENT_ITEMS_INVENTORY_ADJUSTMENT_ID` (`INVENTORY_ADJUSTMENT_ID`) USING BTREE,
  KEY `FK_INVENTORY_ADJUSTMENT_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_INVENTORY_ADJUSTMENT_ITEMS_BATCH_ID` (`BATCH_ID`) USING BTREE,
  KEY `FK_INVENTORY_ADJUSTMENT_ITEMS_UNIT_ID` (`UNIT_ID`),
  CONSTRAINT `FK_INVENTORY_ADJUSTMENT_ITEMS_ASSET_ACCOUNT_ID` FOREIGN KEY (`ASSET_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_INVENTORY_ADJUSTMENT_ITEMS_BATCH_ID` FOREIGN KEY (`BATCH_ID`) REFERENCES `item_batches` (`ID`),
  CONSTRAINT `FK_INVENTORY_ADJUSTMENT_ITEMS_INVENTORY_ADJUSTMENT_ID` FOREIGN KEY (`INVENTORY_ADJUSTMENT_ID`) REFERENCES `inventory_adjustment` (`ID`),
  CONSTRAINT `FK_INVENTORY_ADJUSTMENT_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_INVENTORY_ADJUSTMENT_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_adjustment_type`
--

DROP TABLE IF EXISTS `inventory_adjustment_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_adjustment_type` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_INVENTORY_ADJUSTMENT_TYPE_CODE` (`CODE`),
  KEY `FK_INVENTORY_ADJUSTMENT_TYPE_ACCOUNT_ID` (`ACCOUNT_ID`) USING BTREE,
  CONSTRAINT `FK_INVENTORY_ADJUSTMENT_TYPE_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_conversion`
--

DROP TABLE IF EXISTS `inventory_conversion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_conversion` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `DATE` date NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_INVENTORY_CONVERSION_CODE` (`CODE`),
  KEY `IX_INVENTORY_CONVERSION_DATE` (`DATE`) USING BTREE,
  KEY `FK_INVENTORY_CONVERSION_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `IX_INVENTORY_CONVERSION_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  CONSTRAINT `FK_INVENTORY_CONVERSION_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_conversion_lines`
--

DROP TABLE IF EXISTS `inventory_conversion_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_conversion_lines` (
  `ID` int unsigned NOT NULL,
  `IC_ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(13,4) NOT NULL,
  `UNIT_COST` decimal(16,4) NOT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `ASSET_ACCOUNT_ID` int unsigned NOT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_INVENTORY_CONVERSION_LINES_IC_ID` (`IC_ID`),
  KEY `FK_INVENTORY_CONVERSION_LINES_ITEM_ID` (`ITEM_ID`),
  KEY `FK_INVENTORY_CONVERSION_LINES_ASSET_ACCOUNT_ID` (`ASSET_ACCOUNT_ID`),
  KEY `FK_INVENTORY_CONVERSION_LINES_BATCH_ID` (`BATCH_ID`),
  CONSTRAINT `FK_INVENTORY_CONVERSION_LINES_ASSET_ACCOUNT_ID` FOREIGN KEY (`ASSET_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_INVENTORY_CONVERSION_LINES_BATCH_ID` FOREIGN KEY (`BATCH_ID`) REFERENCES `item_batches` (`ID`),
  CONSTRAINT `FK_INVENTORY_CONVERSION_LINES_IC_ID` FOREIGN KEY (`IC_ID`) REFERENCES `inventory_conversion` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_INVENTORY_CONVERSION_LINES_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_count`
--

DROP TABLE IF EXISTS `inventory_count`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_count` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime DEFAULT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `COUNTED_BY_ID` int unsigned NOT NULL,
  `RECORDED_BY_ID` int unsigned NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `ADJUSTED` tinyint(1) DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_INVENTORY_COUNT_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_INVENTORY_COUNT_COUNTED_BY_ID` (`COUNTED_BY_ID`),
  KEY `FK_INVENTORY_COUNT_RECORDED_BY_ID` (`RECORDED_BY_ID`),
  CONSTRAINT `FK_INVENTORY_COUNT_COUNTED_BY_ID` FOREIGN KEY (`COUNTED_BY_ID`) REFERENCES `contact` (`ID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `FK_INVENTORY_COUNT_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `FK_INVENTORY_COUNT_RECORDED_BY_ID` FOREIGN KEY (`RECORDED_BY_ID`) REFERENCES `user` (`ID`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_count_items`
--

DROP TABLE IF EXISTS `inventory_count_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_count_items` (
  `ID` int unsigned NOT NULL,
  `INVENTORY_COUNT_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,4) DEFAULT NULL,
  `CLOSED` tinyint unsigned NOT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `INVENTORY_ADJUSTMENT_ITEMS_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_INVENTORY_COUNT_ITEMS_INVENTORY_COUNT_ID` (`INVENTORY_COUNT_ID`),
  KEY `FK_INVENTORY_COUNT_ITEMS_ITEM_ID` (`ITEM_ID`),
  KEY `FK_INVENTORY_COUNT_ITEMS_UNIT_ID` (`UNIT_ID`),
  KEY `FK_INVENTORY_COUNT_ITEMS_INVENTORY_ADJUSTMENT_ITEMS_ID` (`INVENTORY_ADJUSTMENT_ITEMS_ID`),
  CONSTRAINT `FK_INVENTORY_COUNT_ITEMS_INVENTORY_ADJUSTMENT_ITEMS_ID` FOREIGN KEY (`INVENTORY_ADJUSTMENT_ITEMS_ID`) REFERENCES `inventory_adjustment_items` (`ID`),
  CONSTRAINT `FK_INVENTORY_COUNT_ITEMS_INVENTORY_COUNT_ID` FOREIGN KEY (`INVENTORY_COUNT_ID`) REFERENCES `inventory_count` (`ID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `FK_INVENTORY_COUNT_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `FK_INVENTORY_COUNT_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_request`
--

DROP TABLE IF EXISTS `inventory_request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_request` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `REQUESTED_BY` int unsigned DEFAULT NULL,
  `APPROVER_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`) USING BTREE,
  KEY `FK_INVENTORY_REQUEST_REQUESTED_BY` (`REQUESTED_BY`) USING BTREE,
  KEY `FK_INVENTORY_REQUEST_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  CONSTRAINT `FK_INVENTORY_REQUEST_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_INVENTORY_REQUEST_REQUESTED_BY` FOREIGN KEY (`REQUESTED_BY`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_request_items`
--

DROP TABLE IF EXISTS `inventory_request_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_request_items` (
  `ID` int unsigned NOT NULL,
  `INVENTORY_REQUEST_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(13,4) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `FINAL_QTY` decimal(13,4) DEFAULT NULL,
  `CLOSED` tinyint(1) NOT NULL,
  `GROUP_LINE_ID` int unsigned DEFAULT NULL,
  `PRINT_IN_FORMS` tinyint unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(255) DEFAULT NULL,
  `PROJECT_ID` int DEFAULT NULL,
  `PO_QTY` decimal(16,4) DEFAULT NULL,
  PRIMARY KEY (`ID`) USING BTREE,
  KEY `FK_INVENTORY_REQUEST_ITEMS_ITEM_REQUEST_ID` (`INVENTORY_REQUEST_ID`) USING BTREE,
  KEY `FK_INVENTORY_REQUEST_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_INVENTORY_REQUEST_ITEMS_UNIT_ID` (`UNIT_ID`) USING BTREE,
  CONSTRAINT `FK_INVENTORY_REQUEST_INVENTORY_REQUEST_ID` FOREIGN KEY (`INVENTORY_REQUEST_ID`) REFERENCES `inventory_request` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_INVENTORY_REQUEST_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_INVENTORY_REQUEST_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_transfer`
--

DROP TABLE IF EXISTS `inventory_transfer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_transfer` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `TRANSFER_TO_ID` int unsigned NOT NULL,
  `IN_TRANSIT_LOCATION_ID` int DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `RETAIL_VALUE` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `PREPARED_BY_ID` int unsigned DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `DATE_RECEIVED` date DEFAULT NULL,
  `RECEIVED_BY_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_INVENTORY_TRANSFER_CODE` (`CODE`),
  KEY `IX_INVENTORY_TRANSFER_DATE` (`DATE`) USING BTREE,
  KEY `FK_INVENTORY_TRANSFER_TRANSFER_TO_ID` (`TRANSFER_TO_ID`) USING BTREE,
  KEY `FK_INVENTORY_TRANSFER_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `IX_INVENTORY_TRANSFER_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  KEY `FK_INVENTORY_TRANSFER_ACCOUNT_ID` (`ACCOUNT_ID`) USING BTREE,
  CONSTRAINT `FK_INVENTORY_TRANSFER_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_INVENTORY_TRANSFER_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_INVENTORY_TRANSFER_TRANSFER_TO_ID` FOREIGN KEY (`TRANSFER_TO_ID`) REFERENCES `location` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_transfer_items`
--

DROP TABLE IF EXISTS `inventory_transfer_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_transfer_items` (
  `ID` int unsigned NOT NULL,
  `INVENTORY_TRANSFER_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_COST` decimal(16,4) DEFAULT NULL,
  `UNIT_PRICE` decimal(16,4) DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `RETAIL_VALUE` decimal(16,4) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `RECEIVED_QTY` decimal(16,6) DEFAULT NULL,
  `OPEN_DISCREPANCY` tinyint unsigned DEFAULT NULL,
  `DISCREPANCY_TYPE_ID` int unsigned DEFAULT NULL,
  `DISCREPANCY_REMARKS` varchar(255) DEFAULT NULL,
  `RESOLUTION_TYPE_ID` int unsigned DEFAULT NULL,
  `RESOLUTION_REMARKS` varchar(50) DEFAULT NULL,
  `CLOSED` tinyint unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `INVENTORY_REQUEST_ITEM_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_INVENTORY_TRANSFER_ITEMS_INVENTORY_TRANSFER_ID` (`INVENTORY_TRANSFER_ID`) USING BTREE,
  KEY `FK_INVENTORY_TRANSFER_TRANSFER_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_INVENTORY_TRANSFER_ITEMS_BATCH_ID` (`BATCH_ID`) USING BTREE,
  KEY `FK_INVENTORY_TRANSFER_ITEMS_ASSET_ACCOUNT_ID` (`ASSET_ACCOUNT_ID`),
  KEY `FK_INVENTORY_TRANSFER_ITEMS_UNIT_ID` (`UNIT_ID`),
  CONSTRAINT `FK_INVENTORY_TRANSFER_ITEMS_ASSET_ACCOUNT_ID` FOREIGN KEY (`ASSET_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_INVENTORY_TRANSFER_ITEMS_BATCH_ID` FOREIGN KEY (`BATCH_ID`) REFERENCES `item_batches` (`ID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `FK_INVENTORY_TRANSFER_ITEMS_INVENTORY_TRANSFER_ID` FOREIGN KEY (`INVENTORY_TRANSFER_ID`) REFERENCES `inventory_transfer` (`ID`),
  CONSTRAINT `FK_INVENTORY_TRANSFER_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_INVENTORY_TRANSFER_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoice`
--

DROP TABLE IF EXISTS `invoice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `CUSTOMER_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `SALES_REP_ID` int unsigned DEFAULT NULL,
  `PO_NUMBER` varchar(20) DEFAULT NULL,
  `SHIP_TO` varchar(255) DEFAULT NULL,
  `SHIP_VIA_ID` int unsigned DEFAULT NULL,
  `SHIP_DATE` date DEFAULT NULL,
  `PAYMENT_TERMS_ID` int unsigned DEFAULT NULL,
  `DUE_DATE` date DEFAULT NULL,
  `DISCOUNT_DATE` date DEFAULT NULL,
  `DISCOUNT_PCT` decimal(6,2) DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `BALANCE_DUE` decimal(16,4) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `LAST_FC_DATE` date DEFAULT NULL,
  `IS_FC` tinyint(1) NOT NULL DEFAULT '0',
  `REF_TYPE` tinyint unsigned DEFAULT NULL,
  `ACCOUNTS_RECEIVABLE_ID` int unsigned DEFAULT NULL,
  `OUTPUT_TAX_ID` int unsigned DEFAULT NULL,
  `OUTPUT_TAX_RATE` decimal(6,2) DEFAULT NULL,
  `OUTPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `OUTPUT_TAX_VAT_METHOD` tinyint unsigned DEFAULT NULL,
  `OUTPUT_TAX_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `NONTAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `PROJECT_ID` int DEFAULT NULL,
  `POS_MACHINE_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_INVOICE_CODE` (`CODE`),
  KEY `FK_INVOICE_CUSTOMER_ID` (`CUSTOMER_ID`),
  KEY `FK_INVOICE_SHIP_VIA_ID` (`SHIP_VIA_ID`),
  KEY `FK_INVOICE_PAYMENT_TERMS_ID` (`PAYMENT_TERMS_ID`),
  KEY `FK_INVOICE_SALES_REP_ID` (`SALES_REP_ID`),
  KEY `FK_INVOICE_REF_TYPE` (`REF_TYPE`),
  KEY `IX_INVOICE_DATE` (`DATE`) USING BTREE,
  KEY `FK_INVOICE_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `IX_INVOICE_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  KEY `FK_INVOICE_ACCOUNTS_RECEIVABLE_ID` (`ACCOUNTS_RECEIVABLE_ID`),
  KEY `FK_INVOICE_OUTPUT_TAX_ID` (`OUTPUT_TAX_ID`),
  KEY `FK_INVOICE_OUTPUT_TAX_VAT_METHOD` (`OUTPUT_TAX_VAT_METHOD`),
  KEY `FK_INVOICE_OUTPUT_TAX_ACCOUNT_ID` (`OUTPUT_TAX_ACCOUNT_ID`),
  KEY `FK_INVOICE_PO_NUMBER` (`PO_NUMBER`,`CUSTOMER_ID`),
  KEY `FK_INVOICE_CASS_ID` (`CLASS_ID`),
  KEY `IX_INVOICE_CUSTOM_FIELD1` (`CUSTOM_FIELD1`),
  KEY `IX_INVOICE_CUSTOM_FIELD2` (`CUSTOM_FIELD2`),
  KEY `IX_INVOICE_CUSTOM_FIELD3` (`CUSTOM_FIELD3`),
  KEY `IX_INVOICE_CUSTOM_FIELD4` (`CUSTOM_FIELD4`),
  KEY `IX_INVOICE_CUSTOM_FIELD5` (`CUSTOM_FIELD5`),
  CONSTRAINT `FK_INVOICE_ACCOUNTS_RECEIVABLE_ID` FOREIGN KEY (`ACCOUNTS_RECEIVABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_INVOICE_CASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_INVOICE_CUSTOMER_ID` FOREIGN KEY (`CUSTOMER_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_INVOICE_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_INVOICE_OUTPUT_TAX_ACCOUNT_ID` FOREIGN KEY (`OUTPUT_TAX_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_INVOICE_OUTPUT_TAX_ID` FOREIGN KEY (`OUTPUT_TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_INVOICE_OUTPUT_TAX_VAT_METHOD` FOREIGN KEY (`OUTPUT_TAX_VAT_METHOD`) REFERENCES `vat_method_map` (`ID`),
  CONSTRAINT `FK_INVOICE_PAYMENT_TERMS_ID` FOREIGN KEY (`PAYMENT_TERMS_ID`) REFERENCES `payment_terms` (`ID`),
  CONSTRAINT `FK_INVOICE_REF_TYPE` FOREIGN KEY (`REF_TYPE`) REFERENCES `document_type_map` (`ID`),
  CONSTRAINT `FK_INVOICE_SALES_REP_ID` FOREIGN KEY (`SALES_REP_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_INVOICE_SHIP_VIA_ID` FOREIGN KEY (`SHIP_VIA_ID`) REFERENCES `ship_via` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoice_items`
--

DROP TABLE IF EXISTS `invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_items` (
  `ID` int unsigned NOT NULL,
  `INVOICE_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `COGS_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `INCOME_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `REF_LINE_ID` int unsigned DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `GROUP_LINE_ID` int unsigned DEFAULT NULL,
  `PRINT_IN_FORMS` tinyint(1) DEFAULT NULL,
  `DEPOSITED` tinyint(1) DEFAULT NULL,
  `PRICE_LEVEL_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_INVOICE_ITEMS_INVOICE_ID` (`INVOICE_ID`) USING BTREE,
  KEY `FK_INVOICE_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_INVOICE_ITEMS_COGS_ACCOUNT_ID` (`COGS_ACCOUNT_ID`) USING BTREE,
  KEY `FK_INVOICE_ITEMS_ASSET_ACCOUNT_ID` (`ASSET_ACCOUNT_ID`) USING BTREE,
  KEY `FK_INVOICE_ITEMS_INCOME_ACCOUNT_ID` (`INCOME_ACCOUNT_ID`) USING BTREE,
  KEY `FK_INVOICE_ITEMS_BATCH_ID` (`BATCH_ID`) USING BTREE,
  KEY `FK_INVOICE_ITEMS_UNIT_ID` (`UNIT_ID`),
  CONSTRAINT `FK_INVOICE_ITEMS_ASSET_ACCOUNT_ID` FOREIGN KEY (`ASSET_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_INVOICE_ITEMS_BATCH_ID` FOREIGN KEY (`BATCH_ID`) REFERENCES `item_batches` (`ID`),
  CONSTRAINT `FK_INVOICE_ITEMS_COGS_ACCOUNT_ID` FOREIGN KEY (`COGS_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_INVOICE_ITEMS_INCOME_ACCOUNT_ID` FOREIGN KEY (`INCOME_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_INVOICE_ITEMS_INVOICE_ID` FOREIGN KEY (`INVOICE_ID`) REFERENCES `invoice` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_INVOICE_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_INVOICE_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item`
--

DROP TABLE IF EXISTS `item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `DESCRIPTION` varchar(255) NOT NULL,
  `PURCHASE_DESCRIPTION` varchar(255) DEFAULT NULL,
  `GROUP_ID` int unsigned DEFAULT NULL,
  `SUB_CLASS_ID` int unsigned DEFAULT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `STOCK_TYPE` tinyint unsigned DEFAULT NULL,
  `GL_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `COGS_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `EWT_EXEMPT` tinyint DEFAULT NULL,
  `PREFERRED_VENDOR_ID` int unsigned DEFAULT NULL,
  `MANUFACTURER_ID` int unsigned DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `COST` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `IS_SENIOR_PRIVILEGE` tinyint unsigned DEFAULT '0',
  `SENIOR_PRIVILEGE_RATE` decimal(16,4) DEFAULT NULL,
  `IS_PWD_PRIVILEGE` tinyint unsigned DEFAULT '0',
  `PWD_PRIVILEGE_RATE` decimal(16,4) DEFAULT NULL,
  `DISCOUNT_TYPE` int DEFAULT NULL,
  `PAYMENT_METHOD_ID` int unsigned DEFAULT NULL,
  `NOTES` text,
  `BASE_UNIT_ID` int unsigned DEFAULT NULL,
  `PURCHASES_UNIT_ID` int unsigned DEFAULT NULL,
  `SHIPPING_UNIT_ID` int unsigned DEFAULT NULL,
  `SALES_UNIT_ID` int unsigned DEFAULT NULL,
  `PRINT_INDIVIDUAL_ITEMS` tinyint(1) DEFAULT NULL,
  `PICTURE` mediumblob,
  `INACTIVE` tinyint(1) NOT NULL,
  `SERIALIZE` tinyint unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ITEM_CODE` (`CODE`),
  KEY `FK_ITEM_ASSET_ACCOUNT_ID` (`ASSET_ACCOUNT_ID`),
  KEY `FK_ITEM_COGS_ACCOUNT_ID` (`COGS_ACCOUNT_ID`),
  KEY `FK_ITEM_GROUP_ID` (`GROUP_ID`),
  KEY `FK_ITEM_TYPE` (`TYPE`),
  KEY `FK_ITEM_PREFERRED_VENDOR_ID` (`PREFERRED_VENDOR_ID`),
  KEY `FK_ITEM_GL_ACCOUNT_ID` (`GL_ACCOUNT_ID`),
  KEY `FK_ITEM_SUB_CLASS_ID` (`SUB_CLASS_ID`),
  KEY `FK_ITEM_STOCK_TYPE` (`STOCK_TYPE`),
  KEY `FK_ITEM_MANUFACTURER_ID` (`MANUFACTURER_ID`),
  KEY `FK_ITEM_RATE_TYPE` (`RATE_TYPE`),
  KEY `FK_ITEM_PAYMENT_METHOD_ID` (`PAYMENT_METHOD_ID`),
  KEY `FK_ITEM_BASE_UNIT_ID` (`BASE_UNIT_ID`),
  KEY `FK_ITEM_PURCHASES_UNIT_ID` (`PURCHASES_UNIT_ID`),
  KEY `FK_ITEM_SALES_UNIT_ID` (`SALES_UNIT_ID`),
  KEY `FK_ITEM_SHIPPING_UNIT_ID` (`SHIPPING_UNIT_ID`),
  KEY `IX_ESTIMATE_CUSTOM_FIELD1` (`CUSTOM_FIELD1`),
  KEY `IX_ESTIMATE_CUSTOM_FIELD2` (`CUSTOM_FIELD2`),
  KEY `IX_ESTIMATE_CUSTOM_FIELD3` (`CUSTOM_FIELD3`),
  KEY `IX_ESTIMATE_CUSTOM_FIELD4` (`CUSTOM_FIELD4`),
  KEY `IX_ESTIMATE_CUSTOM_FIELD5` (`CUSTOM_FIELD5`),
  KEY `IX_ITEM_DESCRIPTION` (`DESCRIPTION`) USING BTREE,
  KEY `IX_ITEM_SEARCH_DESCRIPTION` (`DESCRIPTION`,`INACTIVE`),
  CONSTRAINT `FK_ITEM_ASSET_ACCOUNT_ID` FOREIGN KEY (`ASSET_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_ITEM_BASE_UNIT_ID` FOREIGN KEY (`BASE_UNIT_ID`) REFERENCES `unit_of_measure` (`ID`),
  CONSTRAINT `FK_ITEM_COGS_ACCOUNT_ID` FOREIGN KEY (`COGS_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_ITEM_GL_ACCOUNT_ID` FOREIGN KEY (`GL_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_ITEM_GROUP_ID` FOREIGN KEY (`GROUP_ID`) REFERENCES `item_group` (`ID`),
  CONSTRAINT `FK_ITEM_MANUFACTURER_ID` FOREIGN KEY (`MANUFACTURER_ID`) REFERENCES `manufacturer` (`ID`),
  CONSTRAINT `FK_ITEM_PAYMENT_METHOD_ID` FOREIGN KEY (`PAYMENT_METHOD_ID`) REFERENCES `payment_method` (`ID`),
  CONSTRAINT `FK_ITEM_PREFERRED_VENDOR_ID` FOREIGN KEY (`PREFERRED_VENDOR_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_ITEM_PURCHASES_UNIT_ID` FOREIGN KEY (`PURCHASES_UNIT_ID`) REFERENCES `unit_of_measure` (`ID`),
  CONSTRAINT `FK_ITEM_RATE_TYPE` FOREIGN KEY (`RATE_TYPE`) REFERENCES `rate_type_map` (`ID`),
  CONSTRAINT `FK_ITEM_SALES_UNIT_ID` FOREIGN KEY (`SALES_UNIT_ID`) REFERENCES `unit_of_measure` (`ID`),
  CONSTRAINT `FK_ITEM_SHIPPING_UNIT_ID` FOREIGN KEY (`SHIPPING_UNIT_ID`) REFERENCES `unit_of_measure` (`ID`),
  CONSTRAINT `FK_ITEM_STOCK_TYPE` FOREIGN KEY (`STOCK_TYPE`) REFERENCES `stock_type_map` (`ID`),
  CONSTRAINT `FK_ITEM_SUB_CLASS_ID` FOREIGN KEY (`SUB_CLASS_ID`) REFERENCES `item_sub_class` (`ID`),
  CONSTRAINT `FK_ITEM_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `item_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_batches`
--

DROP TABLE IF EXISTS `item_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_batches` (
  `ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `BATCH_NO` varchar(50) NOT NULL,
  `EXPIRY_DATE` date DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ITEM_BATCHES_BATCH_NO` (`ITEM_ID`,`BATCH_NO`),
  KEY `FK_ITEM_BATCHES_ITEM_ID` (`ITEM_ID`),
  CONSTRAINT `FK_ITEM_BATCHES_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_class`
--

DROP TABLE IF EXISTS `item_class`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_class` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(100) NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ITEM_CLASS_CODE` (`CODE`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_components`
--

DROP TABLE IF EXISTS `item_components`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_components` (
  `ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `COMPONENT_ID` int unsigned NOT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `UX_ITEM_COMPONENTS_ITEMS` (`ITEM_ID`,`COMPONENT_ID`),
  KEY `FK_ITEM_COMPONENTS_COMPONENT_ID` (`COMPONENT_ID`),
  KEY `FK_ITEM_COMPONENTS_ITEM_ID` (`ITEM_ID`),
  CONSTRAINT `FK_ITEM_COMPONENTS_COMPONENT_ID` FOREIGN KEY (`COMPONENT_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_ITEM_COMPONENTS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_group`
--

DROP TABLE IF EXISTS `item_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_group` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(100) NOT NULL,
  `ITEM_TYPE` tinyint unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ITEM_GROUP_CODE` (`CODE`),
  KEY `FK_ITEM_GROUP_ITEM_TYPE` (`ITEM_TYPE`),
  CONSTRAINT `FK_ITEM_GROUP_ITEM_TYPE` FOREIGN KEY (`ITEM_TYPE`) REFERENCES `item_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_inventory`
--

DROP TABLE IF EXISTS `item_inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_inventory` (
  `ID` int unsigned NOT NULL,
  `PREVIOUS_ID` int unsigned DEFAULT NULL,
  `SEQUENCE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `BATCH_ID` int unsigned NOT NULL,
  `SOURCE_REF_TYPE` tinyint unsigned NOT NULL,
  `SOURCE_REF_ID` int unsigned NOT NULL,
  `SOURCE_REF_DATE` date NOT NULL,
  `QUANTITY` decimal(13,4) DEFAULT NULL,
  `COST` decimal(16,4) DEFAULT NULL,
  `ENDING_QUANTITY` decimal(13,4) NOT NULL,
  `ENDING_UNIT_COST` decimal(22,4) NOT NULL,
  `ENDING_COST` decimal(22,4) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ITEM_INVENTORY_ITEM_ID` (`ITEM_ID`),
  KEY `FK_ITEM_INVENTORY_PREVIOUS_ID` (`PREVIOUS_ID`),
  KEY `FK_ITEM_INVENTORY_SOURCE_REF_TYPE` (`SOURCE_REF_TYPE`),
  KEY `IX_ITEM_INVENTORY_SOURCE_REF` (`SOURCE_REF_ID`,`SOURCE_REF_TYPE`) USING BTREE,
  KEY `IX_ITEM_INVENTORY_TRANS_REF` (`ITEM_ID`,`LOCATION_ID`,`BATCH_ID`,`SEQUENCE_NO`,`SOURCE_REF_DATE`) USING BTREE,
  KEY `FK_ITEM_INVENTORY_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  CONSTRAINT `FK_ITEM_INVENTORY_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_ITEM_INVENTORY_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_ITEM_INVENTORY_PREVIOUS_ID` FOREIGN KEY (`PREVIOUS_ID`) REFERENCES `item_inventory` (`ID`),
  CONSTRAINT `FK_ITEM_INVENTORY_SOURCE_REF_TYPE` FOREIGN KEY (`SOURCE_REF_TYPE`) REFERENCES `document_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_inventory_staging`
--

DROP TABLE IF EXISTS `item_inventory_staging`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_inventory_staging` (
  `ID` int unsigned NOT NULL,
  `PREVIOUS_ID` int unsigned DEFAULT NULL,
  `SEQUENCE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `BATCH_ID` int unsigned NOT NULL,
  `SOURCE_REF_TYPE` tinyint unsigned NOT NULL,
  `SOURCE_REF_ID` int unsigned NOT NULL,
  `SOURCE_REF_DATE` date NOT NULL,
  `QUANTITY` decimal(13,4) DEFAULT NULL,
  `COST` decimal(16,4) DEFAULT NULL,
  `ENDING_QUANTITY` decimal(13,4) NOT NULL,
  `ENDING_UNIT_COST` decimal(22,4) NOT NULL,
  `ENDING_COST` decimal(22,4) NOT NULL,
  `depth` int unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_location_units`
--

DROP TABLE IF EXISTS `item_location_units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_location_units` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `ITEM_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `PURCHASES_UNIT_ID` int unsigned NOT NULL,
  `SALES_UNIT_ID` int unsigned NOT NULL,
  `SHIPPING_UNIT_ID` int unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ITEM_LOCATION_UNITS_ITEM_ID` (`ITEM_ID`),
  KEY `FK_ITEM_LOCATION_UNITS_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_ITEM_LOCATION_UNITS_PURCHASES_UNIT_ID` (`PURCHASES_UNIT_ID`),
  KEY `FK_ITEM_LOCATION_UNITS_SALES_UNIT_ID` (`SALES_UNIT_ID`),
  KEY `FK_ITEM_LOCATION_UNITS_SHIPPING_UNIT_ID` (`SHIPPING_UNIT_ID`),
  KEY `IX_ITEM_LOCATION_UNITS_ITEM_LOCATION` (`LOCATION_ID`,`ITEM_ID`) USING BTREE,
  CONSTRAINT `FK_ITEM_LOCATION_UNITS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_ITEM_LOCATION_UNITS_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_ITEM_LOCATION_UNITS_PURCHASES_UNIT_ID` FOREIGN KEY (`PURCHASES_UNIT_ID`) REFERENCES `unit_of_measure` (`ID`),
  CONSTRAINT `FK_ITEM_LOCATION_UNITS_SALES_UNIT_ID` FOREIGN KEY (`SALES_UNIT_ID`) REFERENCES `unit_of_measure` (`ID`),
  CONSTRAINT `FK_ITEM_LOCATION_UNITS_SHIPPING_UNIT_ID` FOREIGN KEY (`SHIPPING_UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=143543 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_preference`
--

DROP TABLE IF EXISTS `item_preference`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_preference` (
  `ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `ORDER_POINT` decimal(13,4) DEFAULT NULL,
  `ORDER_QTY` decimal(13,4) DEFAULT NULL,
  `ORDER_LEADTIME` int unsigned DEFAULT NULL,
  `ONHAND_MAX_LIMIT` decimal(13,4) DEFAULT NULL,
  `STOCK_BIN_ID` int unsigned DEFAULT NULL,
  `VISIBLE` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ITEM_PREFERENCE_ITEM_REF` (`ITEM_ID`,`LOCATION_ID`),
  KEY `FK_ITEM_PREFERENCE_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `FK_ITEM_PREFERENCE_STOCK_BIN_ID` (`STOCK_BIN_ID`) USING BTREE,
  CONSTRAINT `FK_ITEM_PREFERENCE_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ITEM_PREFERENCE_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ITEM_PREFERENCE_STOCK_BIN_ID` FOREIGN KEY (`STOCK_BIN_ID`) REFERENCES `stock_bin` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_rate_method`
--

DROP TABLE IF EXISTS `item_rate_method`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_rate_method` (
  `ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(20) DEFAULT NULL,
  `OBJECT_TYPE` int DEFAULT NULL,
  `LOCATION_FILTERED` tinyint DEFAULT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_rates`
--

DROP TABLE IF EXISTS `item_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_rates` (
  `ID` int unsigned NOT NULL,
  `PREVIOUS_ID` int unsigned DEFAULT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `OBJECT_TYPE` int NOT NULL,
  `OBJECT_ID` int NOT NULL,
  `RATE_METHOD_ID` int unsigned NOT NULL,
  `ADJUSTMENT_TYPE` int NOT NULL,
  `ADJUSTMENT` decimal(16,4) DEFAULT NULL,
  `ADJUSTMENT_AMOUNT` decimal(16,4) DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `POSTED` int DEFAULT '0',
  `POSTED_TO_PROFILE` int DEFAULT '0',
  `RESTORED` int DEFAULT NULL,
  `USER_ID` int DEFAULT NULL,
  `POSTED_ON` datetime DEFAULT NULL,
  `POSTED_BY` int DEFAULT NULL,
  `START_DATE` datetime DEFAULT NULL,
  `END_DATE` datetime DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ITEM_RATES_RATE_METHOD_ID` (`RATE_METHOD_ID`),
  KEY `FK_ITEM_RATES_PREVIOUS_ID` (`PREVIOUS_ID`),
  KEY `IX_ITEM_RATES_CURRENT_PRICE` (`OBJECT_ID`,`RECORDED_ON`) USING BTREE,
  KEY `IX_ITEM_RATES_TRANSACTION` (`START_DATE`,`END_DATE`,`OBJECT_TYPE`,`POSTED`) USING BTREE,
  KEY `IX_ITEM_RATES_OBJECT_TYPE` (`OBJECT_TYPE`,`POSTED`) USING BTREE,
  KEY `IX_ITEM_RATES_LATEST_RATE` (`OBJECT_TYPE`,`OBJECT_ID`,`RECORDED_ON`,`POSTED`),
  KEY `IX_ITEM_RATES_MAX_RATE` (`OBJECT_ID`,`OBJECT_TYPE`,`POSTED`,`START_DATE`,`END_DATE`,`RECORDED_ON`),
  CONSTRAINT `FK_ITEM_RATES_PREVIOUS_ID` FOREIGN KEY (`PREVIOUS_ID`) REFERENCES `item_rates` (`ID`),
  CONSTRAINT `FK_ITEM_RATES_RATE_METHOD_ID` FOREIGN KEY (`RATE_METHOD_ID`) REFERENCES `item_rate_method` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_receive`
--

DROP TABLE IF EXISTS `item_receive`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_receive` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `DATE` date NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `VENDOR_ID` int unsigned NOT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ITEM_RECEIVE_CODE` (`CODE`),
  KEY `FK_ITEM_RECEIVE_VENDOR_ID` (`VENDOR_ID`) USING BTREE,
  KEY `IX_ITEM_RECEIVE_DATE` (`DATE`) USING BTREE,
  KEY `FK_ITEM_RECEIVE_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `IX_ITEM_RECEIVE_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  CONSTRAINT `FK_ITEM_RECEIVE_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_ITEM_RECEIVE_VENDOR_ID` FOREIGN KEY (`VENDOR_ID`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_receive_lines`
--

DROP TABLE IF EXISTS `item_receive_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_receive_lines` (
  `ID` int unsigned NOT NULL,
  `IR_ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(13,4) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ITEM_RECEIVE_LINES_IR_ID` (`IR_ID`) USING BTREE,
  KEY `FK_ITEM_RECEIVE_LINES_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_ITEM_RECEIVE_LINES_BATCH_ID` (`BATCH_ID`),
  CONSTRAINT `FK_ITEM_RECEIVE_LINES_BATCH_ID` FOREIGN KEY (`BATCH_ID`) REFERENCES `item_batches` (`ID`),
  CONSTRAINT `FK_ITEM_RECEIVE_LINES_IR_ID` FOREIGN KEY (`IR_ID`) REFERENCES `item_receive` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ITEM_RECEIVE_LINES_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_release`
--

DROP TABLE IF EXISTS `item_release`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_release` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `DATE` date NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `RELEASE_TYPE_ID` int unsigned NOT NULL,
  `RELEASED_BY_ID` int unsigned DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(50) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(50) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(50) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(50) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ITEM_RELEASE_CODE` (`CODE`),
  KEY `FK_ITEM_RELEASE_RELEASE_TYPE` (`RELEASE_TYPE_ID`),
  KEY `IX_ITEM_RELEASE_DATE` (`DATE`) USING BTREE,
  KEY `FK_ITEM_RELEASE_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `IX_ITEM_RELEASE_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  CONSTRAINT `FK_ITEM_RELEASE_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_ITEM_RELEASE_RELEASE_TYPE` FOREIGN KEY (`RELEASE_TYPE_ID`) REFERENCES `item_release_type` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_release_lines`
--

DROP TABLE IF EXISTS `item_release_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_release_lines` (
  `ID` int unsigned NOT NULL,
  `IR_ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(13,4) NOT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ITEM_RELEASE_LINES_IR_ID` (`IR_ID`),
  KEY `FK_ITEM_RELEASE_LINES_ITEM_ID` (`ITEM_ID`),
  KEY `FK_ITEM_RELEASE_LINES_BATCH_ID` (`BATCH_ID`),
  CONSTRAINT `FK_ITEM_RELEASE_LINES_BATCH_ID` FOREIGN KEY (`BATCH_ID`) REFERENCES `item_batches` (`ID`),
  CONSTRAINT `FK_ITEM_RELEASE_LINES_IR_ID` FOREIGN KEY (`IR_ID`) REFERENCES `item_release` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ITEM_RELEASE_LINES_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_release_type`
--

DROP TABLE IF EXISTS `item_release_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_release_type` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  `GL_ACCOUNT_ID` int unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `IX_ITEM_RELEASE_CODE` (`CODE`),
  KEY `FK_ITEM_RELEASE_TYPE_GL_ACCOUNT_ID` (`GL_ACCOUNT_ID`),
  CONSTRAINT `FK_ITEM_RELEASE_TYPE_GL_ACCOUNT_ID` FOREIGN KEY (`GL_ACCOUNT_ID`) REFERENCES `account` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_request`
--

DROP TABLE IF EXISTS `item_request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_request` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `DATE` date NOT NULL,
  `REQUESTED_BY` int unsigned DEFAULT NULL,
  `APPROVER_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`) USING BTREE,
  KEY `FK_ITEM_REQUEST_REQUESTED_BY` (`REQUESTED_BY`) USING BTREE,
  KEY `FK_ITEM_REQUEST_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  CONSTRAINT `FK_ITEM_REQUEST_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_ITEM_REQUEST_REQUESTED_BY` FOREIGN KEY (`REQUESTED_BY`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_request_items`
--

DROP TABLE IF EXISTS `item_request_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_request_items` (
  `ID` int unsigned NOT NULL,
  `ITEM_REQUEST_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `FINAL_QTY` decimal(16,6) DEFAULT NULL,
  `CLOSED` tinyint unsigned DEFAULT NULL,
  `GROUP_LINE_ID` int unsigned DEFAULT NULL,
  `PRINT_IN_FORMS` tinyint unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(255) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(255) DEFAULT NULL,
  `PROJECT_ID` int DEFAULT NULL,
  `PO_QTY` decimal(16,4) DEFAULT NULL,
  PRIMARY KEY (`ID`) USING BTREE,
  KEY `FK_ITEM_REQUEST_ITEMS_ITEM_REQUEST_ID` (`ITEM_REQUEST_ID`) USING BTREE,
  KEY `FK_ITEM_REQUEST_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_ITEM_REQUEST_ITEMS_UNIT_ID` (`UNIT_ID`) USING BTREE,
  CONSTRAINT `FK_ITEM_REQUEST_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_ITEM_REQUEST_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`),
  CONSTRAINT `FK_ITEM_REQUEST_STOCK_REQUEST_ID` FOREIGN KEY (`ITEM_REQUEST_ID`) REFERENCES `item_request` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_serial_no`
--

DROP TABLE IF EXISTS `item_serial_no`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_serial_no` (
  `ID` int unsigned NOT NULL,
  `SOURCE_REF_TYPE` int unsigned NOT NULL,
  `SOURCE_REF_ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `SERIAL_NO` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ID`) USING BTREE,
  UNIQUE KEY `IX_SERIAL_NO` (`SERIAL_NO`,`SOURCE_REF_TYPE`) USING BTREE,
  KEY `IX_SOURCE_REF_TYPE` (`SOURCE_REF_TYPE`) USING BTREE,
  KEY `IX_SOURCE_REF_ID` (`SOURCE_REF_ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_serials`
--

DROP TABLE IF EXISTS `item_serials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_serials` (
  `ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `SERIAL_NO` varchar(45) NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ITEM_SERIALS_SERIAL_NO` (`SERIAL_NO`,`ITEM_ID`),
  KEY `FK_ITEM_SERIALS_ITEM_ID` (`ITEM_ID`),
  CONSTRAINT `FK_ITEM_SERIALS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_sub_class`
--

DROP TABLE IF EXISTS `item_sub_class`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_sub_class` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(100) NOT NULL,
  `CLASS_ID` int unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_ITEM_SUB_CLASS_CODE` (`CODE`),
  KEY `FK_ITEM_SUB_CLASS_CLASS_ID` (`CLASS_ID`),
  CONSTRAINT `FK_ITEM_SUB_CLASS_CLASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `item_class` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_type_map`
--

DROP TABLE IF EXISTS `item_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_unit_price_levels`
--

DROP TABLE IF EXISTS `item_unit_price_levels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_unit_price_levels` (
  `ID` int unsigned NOT NULL,
  `ITEM_UNIT_LINE_ID` int unsigned NOT NULL,
  `PRICE_LEVEL_ID` int unsigned NOT NULL,
  `CUSTOM_PRICE` decimal(16,4) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ITEM_UNIT_PL_LINE_ID` (`ITEM_UNIT_LINE_ID`),
  KEY `FK_ITEM_UNIT_PL_PRICE_LEVEL_ID` (`PRICE_LEVEL_ID`),
  CONSTRAINT `FK_ITEM_UNIT_PL_LINE_ID` FOREIGN KEY (`ITEM_UNIT_LINE_ID`) REFERENCES `item_units` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ITEM_UNIT_PL_PRICE_LEVEL_ID` FOREIGN KEY (`PRICE_LEVEL_ID`) REFERENCES `price_level` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `item_units`
--

DROP TABLE IF EXISTS `item_units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_units` (
  `ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `UNIT_ID` int unsigned NOT NULL,
  `QUANTITY` decimal(16,6) NOT NULL,
  `COST` decimal(16,4) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `BARCODE` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `IX_ITEM_UNITS_REF_KEY` (`ITEM_ID`,`UNIT_ID`),
  KEY `FK_ITEM_UNITS_UNIT_ID` (`UNIT_ID`),
  KEY `IX_ITEM_UNITS_BARCODE` (`BARCODE`),
  CONSTRAINT `FK_ITEM_UNITS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_ITEM_UNITS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `items` (
  `CODE` varchar(50) DEFAULT NULL,
  `ITEM_DESC` varchar(255) DEFAULT NULL,
  `ITEM_TYPE` varchar(50) DEFAULT NULL,
  `MANUFACTURER` varchar(50) DEFAULT NULL,
  `VENDOR_CODE` varchar(20) DEFAULT NULL,
  `PREFERRED_VENDOR` varchar(100) DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `GROUP_DESCRIPTION` varchar(100) DEFAULT NULL,
  `CLASS` varchar(100) DEFAULT NULL,
  `SUB_CLASS` varchar(100) DEFAULT NULL,
  `STOCK_TYPE` varchar(50) DEFAULT NULL,
  `ORDER_POINT` decimal(13,4) DEFAULT NULL,
  `ORDER_QTY` decimal(13,4) DEFAULT NULL,
  `ORDER_LEADTIME` decimal(13,4) DEFAULT NULL,
  `RELATED_UNIT_BARCODE` varchar(30) DEFAULT NULL,
  `RELATED_UNIT_COST` decimal(16,4) DEFAULT NULL,
  `RELATED_UNIT_PRICE` decimal(16,4) DEFAULT NULL,
  `WHOLESALE_PRICE1` decimal(16,4) DEFAULT NULL,
  `WHOLESALE_PRICE2` decimal(16,4) DEFAULT NULL,
  `RELATED_UNIT_BIG_UNIT` varchar(20) DEFAULT NULL,
  `UNIT_QTY` decimal(16,4) DEFAULT NULL,
  `SMALL_UNIT` varchar(20) DEFAULT NULL,
  `UNIT_COST_PER_SMALL_UNIT` decimal(16,4) DEFAULT NULL,
  `UNIT_PRICE_PER_SMALL_UNIT` decimal(16,4) DEFAULT NULL,
  `WHOLESALE_PRICE1_SMALL_UNIT` decimal(16,4) DEFAULT NULL,
  `WHOLESALE_PRICE2_SMALL_UNIT` decimal(16,4) DEFAULT NULL,
  `WHOLESALE_PRICE3_SMALL_UNIT` decimal(16,4) DEFAULT NULL,
  `DEFAULT_SALES_PER_UNIT` varchar(20) DEFAULT NULL,
  `DEFAULT_PURCHASES_PER_UNIT` varchar(20) DEFAULT NULL,
  `DEFAULT_SHIPPING_PER_UNIT` varchar(20) DEFAULT NULL,
  `INCOME_ACCNT` varchar(50) DEFAULT NULL,
  `COST_ACCNT` varchar(50) DEFAULT NULL,
  `ASSET_ACCNT` varchar(50) DEFAULT NULL,
  `IS_TAXABLE` tinyint(1) DEFAULT NULL,
  `INVENTORY` varchar(50) DEFAULT NULL,
  `SENIOR_PRIVILEGE` tinyint(1) DEFAULT NULL,
  `SENIOR_PRIVILEGE_RATE` decimal(16,4) DEFAULT NULL,
  `PWD_PRIVILEGE` tinyint(1) DEFAULT NULL,
  `PWD_PRIVILEGE_RATE` decimal(16,4) DEFAULT NULL,
  `LOCATION` varchar(50) DEFAULT NULL,
  `VISIBLE` tinyint(1) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `ACTIVE` tinyint(1) DEFAULT NULL,
  `DUMMY` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `location`
--

DROP TABLE IF EXISTS `location`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `location` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(50) NOT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  `PRICE_LEVEL_ID` int unsigned DEFAULT NULL,
  `GROUP_ID` int unsigned DEFAULT NULL,
  `TAG` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_LOCATION_NAME` (`NAME`) USING BTREE,
  KEY `FK_PRICE_LEVEL_ID` (`PRICE_LEVEL_ID`),
  KEY `FK_LOCATION_GROUP_ID` (`GROUP_ID`),
  CONSTRAINT `FK_LOCATION_GROUP_ID` FOREIGN KEY (`GROUP_ID`) REFERENCES `location_group` (`ID`),
  CONSTRAINT `FK_PRICE_LEVEL_ID` FOREIGN KEY (`PRICE_LEVEL_ID`) REFERENCES `price_level` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `location_group`
--

DROP TABLE IF EXISTS `location_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `location_group` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(50) NOT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `loyalty_points`
--

DROP TABLE IF EXISTS `loyalty_points`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyalty_points` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `PREVIOUS_ID` int unsigned DEFAULT NULL,
  `CUSTOMER_ID` int unsigned NOT NULL,
  `SOURCE_REF_TYPE` int unsigned DEFAULT NULL,
  `SOURCE_REF_ID` int unsigned DEFAULT NULL,
  `SOURCE_REF_DATE` date DEFAULT NULL,
  `GAINED_AMOUNT` decimal(16,4) DEFAULT NULL,
  `GAINED_POINTS` decimal(16,2) DEFAULT NULL,
  `REDEEMED_POINTS` decimal(16,2) DEFAULT NULL,
  `TOTAL_POINTS` decimal(16,2) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=7023402 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `loyalty_points_documents`
--

DROP TABLE IF EXISTS `loyalty_points_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyalty_points_documents` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `DOCUMENT_TYPE` int unsigned NOT NULL,
  `DOCUMENT_ID` int unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `IX_LOYALTY_POINTS_DOCUMENTS_DOCUMENT_TYPE` (`DOCUMENT_TYPE`),
  KEY `IX_LOYALTY_POINTS_DOCUMENTS_DOCUMENT_ID` (`DOCUMENT_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=7023402 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lpi_item_point_value`
--

DROP TABLE IF EXISTS `lpi_item_point_value`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lpi_item_point_value` (
  `ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `POINT_VALUE` decimal(16,4) NOT NULL,
  `EXPIRY_DATE` date DEFAULT NULL,
  `USER_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_LPI_ITEM_POINT_VALUE_ITEM_ID` (`ITEM_ID`),
  KEY `FK_LPI_ITEM_POINT_VALUE_ITEM_ID` (`ITEM_ID`),
  CONSTRAINT `FK_LPI_ITEM_POINT_VALUE_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lpi_object_type_map`
--

DROP TABLE IF EXISTS `lpi_object_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lpi_object_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `NAME` varchar(50) CHARACTER SET latin1 COLLATE latin1_bin NOT NULL,
  `TABLE_NAME` varchar(50) NOT NULL,
  `IS_DOCUMENT` tinyint(1) NOT NULL,
  `DOCUMENT_TYPE` tinyint DEFAULT NULL,
  `NEXT_ID` int DEFAULT NULL,
  `INCREMENT` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_LPI_OBJECT_TYPE_MAP` (`NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `manufacturer`
--

DROP TABLE IF EXISTS `manufacturer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manufacturer` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `NAME` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_MANUFACTURER_CODE` (`CODE`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `object_code_sequence`
--

DROP TABLE IF EXISTS `object_code_sequence`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `object_code_sequence` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `OBJECT_TYPE` tinyint unsigned NOT NULL,
  `LOCATION_ID` int unsigned DEFAULT NULL,
  `PREFIX` varchar(10) DEFAULT NULL,
  `POSTFIX` varchar(10) DEFAULT NULL,
  `WIDTH` int unsigned DEFAULT NULL,
  `NEXT_SEQUENCE` int unsigned NOT NULL,
  `INCREMENT` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `UX_OBJECT_CODE_SEQUENCE` (`OBJECT_TYPE`,`LOCATION_ID`),
  KEY `FK_OBJECT_CODE_SEQUENCE_LOCATION_ID` (`LOCATION_ID`),
  CONSTRAINT `FK_OBJECT_CODE_SEQUENCE_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_OBJECT_CODE_SEQUENCE_OBJECT_TYPE` FOREIGN KEY (`OBJECT_TYPE`) REFERENCES `object_type_map` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=132 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `object_type_map`
--

DROP TABLE IF EXISTS `object_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `object_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `NAME` varchar(50) CHARACTER SET latin1 COLLATE latin1_bin NOT NULL,
  `TABLE_NAME` varchar(50) NOT NULL,
  `IS_DOCUMENT` tinyint(1) NOT NULL,
  `DOCUMENT_TYPE` tinyint DEFAULT NULL,
  `NEXT_ID` int DEFAULT NULL,
  `INCREMENT` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_OBJECT_REGISTRY_NAME` (`NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `old_item4`
--

DROP TABLE IF EXISTS `old_item4`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `old_item4` (
  `ID` int unsigned NOT NULL,
  `CUSTOM_FIELD1` varchar(512) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment`
--

DROP TABLE IF EXISTS `payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `CUSTOMER_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `AMOUNT_APPLIED` decimal(16,4) NOT NULL,
  `PAYMENT_METHOD_ID` int unsigned NOT NULL,
  `CARD_NO` varchar(20) DEFAULT NULL,
  `CARD_EXPIRY_DATE` date DEFAULT NULL,
  `RECEIPT_REF_NO` varchar(20) DEFAULT NULL,
  `RECEIPT_DATE` date DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `UNDEPOSITED_FUNDS_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `OVERPAYMENT_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `DEPOSITED` tinyint(1) DEFAULT NULL,
  `ACCOUNTS_RECEIVABLE_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_PAYMENT_CODE` (`CODE`),
  KEY `FK_PAYMENT_CUSTOMER_ID` (`CUSTOMER_ID`),
  KEY `FK_PAYMENT_PAYMENT_METHOD_ID` (`PAYMENT_METHOD_ID`),
  KEY `IX_PAYMENT_DATE` (`DATE`) USING BTREE,
  KEY `FK_PAYMENT_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `IX_PAYMENT_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  KEY `IX_PAYMENT_RECEIPT_DATE` (`RECEIPT_DATE`),
  KEY `IX_PAYMENT_RECEIPT_REF_NO` (`RECEIPT_REF_NO`),
  KEY `FK_PAYMENT_UNDEPOSITED_FUNDS_ACCOUNT_ID` (`UNDEPOSITED_FUNDS_ACCOUNT_ID`) USING BTREE,
  KEY `FK_PAYMENT_ACCOUNTS_RECEIVABLE_ID` (`ACCOUNTS_RECEIVABLE_ID`),
  CONSTRAINT `FK_PAYMENT_ACCOUNTS_RECEIVABLE_ID` FOREIGN KEY (`ACCOUNTS_RECEIVABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_PAYMENT_CUSTOMER_ID` FOREIGN KEY (`CUSTOMER_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_PAYMENT_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_PAYMENT_PAYMENT_METHOD_ID` FOREIGN KEY (`PAYMENT_METHOD_ID`) REFERENCES `payment_method` (`ID`),
  CONSTRAINT `FK_PAYMENT_UNDEPOSITED_FUNDS_ACCOUNT_ID` FOREIGN KEY (`UNDEPOSITED_FUNDS_ACCOUNT_ID`) REFERENCES `account` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_invoices`
--

DROP TABLE IF EXISTS `payment_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_invoices` (
  `ID` int unsigned NOT NULL,
  `PAYMENT_ID` int unsigned NOT NULL,
  `INVOICE_ID` int unsigned NOT NULL,
  `DISCOUNT` decimal(16,4) DEFAULT NULL,
  `AMOUNT_APPLIED` decimal(16,4) DEFAULT NULL,
  `DISCOUNT_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `ACCOUNTS_RECEIVABLE_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_PAYMENT_INVOICES_PAYMENT_ID` (`PAYMENT_ID`) USING BTREE,
  KEY `FK_PAYMENT_INVOICES_INVOICE_ID` (`INVOICE_ID`) USING BTREE,
  KEY `FK_PAYMENT_INVOICES_DISCOUNT_ACCOUNT_ID` (`DISCOUNT_ACCOUNT_ID`) USING BTREE,
  KEY `FK_PAYMENT_INVOICES_ACCOUNTS_RECEIVABLE_ID` (`ACCOUNTS_RECEIVABLE_ID`) USING BTREE,
  CONSTRAINT `FK_PAYMENT_INVOICES_ACCOUNTS_RECEIVABLE_ID` FOREIGN KEY (`ACCOUNTS_RECEIVABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_PAYMENT_INVOICES_DISCOUNT_ACCOUNT_ID` FOREIGN KEY (`DISCOUNT_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_PAYMENT_INVOICES_INVOICE_ID` FOREIGN KEY (`INVOICE_ID`) REFERENCES `invoice` (`ID`),
  CONSTRAINT `FK_PAYMENT_INVOICES_PAYMENT_ID` FOREIGN KEY (`PAYMENT_ID`) REFERENCES `payment` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_method`
--

DROP TABLE IF EXISTS `payment_method`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_method` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  `PAYMENT_TYPE` tinyint unsigned NOT NULL,
  `GL_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `INACTIVE` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_PAYMENT_METHOD_CODE` (`CODE`),
  KEY `FK_PAYMENT_METHOD_GL_ACCOUNT_ID` (`GL_ACCOUNT_ID`),
  KEY `FK_PAYMENT_METHOD_PAYMENT_TYPE` (`PAYMENT_TYPE`),
  CONSTRAINT `FK_PAYMENT_METHOD_GL_ACCOUNT_ID` FOREIGN KEY (`GL_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_PAYMENT_METHOD_PAYMENT_TYPE` FOREIGN KEY (`PAYMENT_TYPE`) REFERENCES `payment_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_other_details`
--

DROP TABLE IF EXISTS `payment_other_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_other_details` (
  `ID` int unsigned NOT NULL,
  `PAYMENT_ID` int unsigned NOT NULL,
  `OBJECT_TYPE` int unsigned NOT NULL,
  `OBJECT_ID` int unsigned NOT NULL,
  `DISCOUNT` decimal(16,4) DEFAULT NULL,
  `AMOUNT_APPLIED` decimal(16,4) DEFAULT NULL,
  `DISCOUNT_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `ACCOUNTS_RECEIVABLE_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_PAYMENT_OTHER_DETAILS_ACCOUNTS_RECEIVABLE_ID` (`ACCOUNTS_RECEIVABLE_ID`),
  KEY `FK_PAYMENT_OTHER_DETAILS_DISCOUNT_ACCOUNT_ID` (`DISCOUNT_ACCOUNT_ID`),
  KEY `FK_PAYMENT_OTHER_DETAILS_PAYMENT_ID` (`PAYMENT_ID`),
  CONSTRAINT `FK_PAYMENT_OTHER_DETAILS_ACCOUNTS_RECEIVABLE_ID` FOREIGN KEY (`ACCOUNTS_RECEIVABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_PAYMENT_OTHER_DETAILS_DISCOUNT_ACCOUNT_ID` FOREIGN KEY (`DISCOUNT_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_PAYMENT_OTHER_DETAILS_PAYMENT_ID` FOREIGN KEY (`PAYMENT_ID`) REFERENCES `payment` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_terms`
--

DROP TABLE IF EXISTS `payment_terms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_terms` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `NET_DUE` int unsigned NOT NULL,
  `DISCOUNT_PCT` decimal(6,4) unsigned NOT NULL,
  `DISCOUNT_DUE` tinyint unsigned NOT NULL,
  `DATE_MONTH_PARAM` tinyint unsigned DEFAULT NULL,
  `DATE_DAY_PARAM` tinyint unsigned DEFAULT NULL,
  `DATE_MIN_DAYS` tinyint unsigned DEFAULT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_PAYMENT_TERMS_TYPE` (`TYPE`),
  CONSTRAINT `FK_PAYMENT_TERMS_TYPE1` FOREIGN KEY (`TYPE`) REFERENCES `payment_terms_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_terms_type_map`
--

DROP TABLE IF EXISTS `payment_terms_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_terms_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_type_map`
--

DROP TABLE IF EXISTS `payment_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_cash_count`
--

DROP TABLE IF EXISTS `pos_cash_count`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_cash_count` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `POS_MACHINE_ID` int unsigned NOT NULL,
  `TOTAL` decimal(16,4) NOT NULL,
  `CASH` decimal(16,4) DEFAULT NULL,
  `CHECK` decimal(16,4) DEFAULT NULL,
  `CREDIT_CARD` decimal(16,4) DEFAULT NULL,
  `GIFT_CERT` decimal(16,4) DEFAULT NULL,
  `COUPON` decimal(16,4) DEFAULT NULL,
  `GCASH` decimal(16,4) DEFAULT NULL,
  `MAYA` decimal(16,4) DEFAULT NULL,
  `OTHER_PAYMENT` decimal(16,4) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `POSTED` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_POS_CASH_COUNT_POS_MACHINE_ID` (`POS_MACHINE_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_cash_count_lines`
--

DROP TABLE IF EXISTS `pos_cash_count_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_cash_count_lines` (
  `ID` int unsigned NOT NULL,
  `CASH_COUNT_ID` int unsigned NOT NULL,
  `DENOMINATION_ID` int unsigned NOT NULL,
  `NOMINAL_VALUE` decimal(16,4) NOT NULL,
  `COUNT` int unsigned NOT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_POS_CASH_COUNT_LINES_CASH_COUNT_ID` (`CASH_COUNT_ID`) USING BTREE,
  KEY `FK_POS_CASH_COUNT_LINES_DENOMINATION_ID` (`DENOMINATION_ID`) USING BTREE,
  CONSTRAINT `FK_POS_CASH_COUNT_LINES_CASH_COUNT_ID` FOREIGN KEY (`CASH_COUNT_ID`) REFERENCES `pos_cash_count` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_POS_CASH_COUNT_LINES_DENOMINATION_ID` FOREIGN KEY (`DENOMINATION_ID`) REFERENCES `pos_cash_denomination` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_cash_denomination`
--

DROP TABLE IF EXISTS `pos_cash_denomination`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_cash_denomination` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  `NOMINAL_VALUE` decimal(16,4) NOT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_POS_CASH_DENOMINATION_TYPE` (`TYPE`) USING BTREE,
  CONSTRAINT `FK_POS_CASH_DENOMINATION_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `pos_cash_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_cash_type_map`
--

DROP TABLE IF EXISTS `pos_cash_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_cash_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_delayed_posting_logs`
--

DROP TABLE IF EXISTS `pos_delayed_posting_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_delayed_posting_logs` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `RECORDED_ON` datetime DEFAULT NULL,
  `OBJECT_TYPE` int DEFAULT NULL,
  `OBJECT_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `IX_POS_DELAYED_POSTING_LOGS_OBJECT_TYPE` (`OBJECT_TYPE`,`OBJECT_ID`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=289362 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_end_of_shift`
--

DROP TABLE IF EXISTS `pos_end_of_shift`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_end_of_shift` (
  `ID` int unsigned NOT NULL DEFAULT '0',
  `RECORDED_ON` datetime NOT NULL,
  `POS_MACHINE_ID` int unsigned NOT NULL,
  `CASHIER_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `TOTAL` decimal(16,2) NOT NULL,
  `DISCOUNT` decimal(16,4) DEFAULT NULL,
  `SENIOR_DISCOUNT` decimal(16,4) DEFAULT NULL,
  `PWD_DISCOUNT` decimal(16,4) DEFAULT NULL,
  `RETURN` decimal(16,4) DEFAULT NULL,
  `COUPON` decimal(16,4) DEFAULT NULL,
  `GIFT_CERT` decimal(16,4) DEFAULT NULL,
  `TRADE_IN` decimal(16,4) DEFAULT NULL,
  `VOID` decimal(16,4) DEFAULT NULL,
  `CASH` decimal(16,4) DEFAULT NULL,
  `CHECK` decimal(16,4) DEFAULT NULL,
  `AMEX` decimal(16,4) DEFAULT NULL,
  `DISCOVER` decimal(16,4) DEFAULT NULL,
  `MASTER_CARD` decimal(16,4) DEFAULT NULL,
  `VISA` decimal(16,4) DEFAULT NULL,
  `DINNERS` decimal(16,4) DEFAULT NULL,
  `JCB` decimal(16,4) DEFAULT NULL,
  `GCASH` decimal(16,4) DEFAULT NULL,
  `MAYA` decimal(16,4) DEFAULT NULL,
  `OTHER_CARD` decimal(16,4) DEFAULT NULL,
  `PAIDOUT` decimal(16,4) DEFAULT NULL,
  `PAIDIN` decimal(16,4) DEFAULT NULL,
  `STARTING_CASH_ID` int unsigned DEFAULT NULL,
  `CASH_COUNT_ID` int unsigned DEFAULT NULL,
  `RESET_COUNTER` int DEFAULT NULL,
  `DRAWER_ACCOUNT_ID` int unsigned NOT NULL,
  `UNDEPOSITED_FUNDS_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `DEPOSITED` tinyint(1) DEFAULT NULL,
  `GRAND_TOTAL` decimal(16,2) NOT NULL,
  `SHIFT_NO` int unsigned NOT NULL,
  `STARTING_RECEIPT_NO` int unsigned DEFAULT NULL,
  `VOID_STARTING_RECEIPT_NO` int DEFAULT NULL,
  `VOID_ENDING_RECEIPT_NO` int DEFAULT NULL,
  `RETURN_STARTING_RECEIPT_NO` int DEFAULT NULL,
  `RETURN_ENDING_RECEIPT_NO` int DEFAULT NULL,
  `ENDING_RECEIPT_NO` int unsigned DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `OUTPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `NONTAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `LESS_VAT_SALES` decimal(16,4) DEFAULT NULL,
  `TRANSACTION_COUNT` int unsigned DEFAULT NULL,
  `CASH_TRX_COUNT` int unsigned DEFAULT NULL,
  `VOID_COUNT` int DEFAULT NULL,
  `RETURN_COUNT` int unsigned DEFAULT NULL,
  `PRINT_COUNT` int unsigned DEFAULT NULL,
  `POS_POSTED` tinyint unsigned DEFAULT '0',
  `POS_LOG_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_POS_CASH_COUNT_LOG_CASH_COUNT_ID` (`CASH_COUNT_ID`),
  KEY `FK_POS_CASH_COUNT_LOG_STARTING_CASH_ID` (`STARTING_CASH_ID`),
  KEY `FK_POS_CASH_COUNT_LOG_CASHIER_ID` (`CASHIER_ID`),
  KEY `FK_POS_CASH_COUNT_LOG_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_POS_CASH_COUNT_LOG_POS_MACHINE_ID` (`POS_MACHINE_ID`),
  KEY `FK_POS_CASH_COUNT_LOG_DRAWER_ACCOUNT_ID` (`DRAWER_ACCOUNT_ID`),
  CONSTRAINT `FK_POS_CASH_COUNT_LOG_CASH_COUNT_ID` FOREIGN KEY (`CASH_COUNT_ID`) REFERENCES `pos_cash_count` (`ID`),
  CONSTRAINT `FK_POS_CASH_COUNT_LOG_CASHIER_ID` FOREIGN KEY (`CASHIER_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_POS_CASH_COUNT_LOG_DRAWER_ACCOUNT_ID` FOREIGN KEY (`DRAWER_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_POS_CASH_COUNT_LOG_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_POS_CASH_COUNT_LOG_POS_MACHINE_ID` FOREIGN KEY (`POS_MACHINE_ID`) REFERENCES `pos_machine` (`ID`),
  CONSTRAINT `FK_POS_CASH_COUNT_LOG_STARTING_CASH_ID` FOREIGN KEY (`STARTING_CASH_ID`) REFERENCES `pos_starting_cash` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_log`
--

DROP TABLE IF EXISTS `pos_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_log` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `POS_MACHINE_ID` int unsigned NOT NULL,
  `CASHIER_ID` int unsigned DEFAULT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `TOTAL` decimal(16,2) NOT NULL,
  `VOID_COUNT` int DEFAULT NULL,
  `DISCOUNT` decimal(16,4) DEFAULT NULL,
  `SENIOR_DISCOUNT` decimal(16,4) DEFAULT NULL,
  `PWD_DISCOUNT` decimal(16,4) DEFAULT NULL,
  `RETURN` decimal(16,4) DEFAULT NULL,
  `COUPON` decimal(16,4) DEFAULT NULL,
  `GIFT_CERT` decimal(16,4) DEFAULT NULL,
  `TRADE_IN` decimal(16,4) DEFAULT NULL,
  `VOID` decimal(16,4) DEFAULT NULL,
  `CASH` decimal(16,4) DEFAULT NULL,
  `CHECK` decimal(16,4) DEFAULT NULL,
  `AMEX` decimal(16,4) DEFAULT NULL,
  `DISCOVER` decimal(16,4) DEFAULT NULL,
  `MASTER_CARD` decimal(16,4) DEFAULT NULL,
  `VISA` decimal(16,4) DEFAULT NULL,
  `DINNERS` decimal(16,4) DEFAULT NULL,
  `JCB` decimal(16,4) DEFAULT NULL,
  `GCASH` decimal(16,4) DEFAULT NULL,
  `MAYA` decimal(16,4) DEFAULT NULL,
  `OTHER_CARD` decimal(16,4) DEFAULT NULL,
  `PAIDOUT` decimal(16,4) DEFAULT NULL,
  `PAIDIN` decimal(16,4) DEFAULT NULL,
  `STARTING_CASH_ID` int unsigned DEFAULT NULL,
  `CASH_COUNT_ID` int unsigned DEFAULT NULL,
  `RESET_COUNTER` int DEFAULT NULL,
  `DRAWER_ACCOUNT_ID` int unsigned NOT NULL,
  `UNDEPOSITED_FUNDS_ACCOUNT_ID` int unsigned NOT NULL,
  `DEPOSITED` tinyint(1) NOT NULL,
  `GRAND_TOTAL` decimal(16,2) NOT NULL,
  `SERIAL_NO` int unsigned NOT NULL,
  `STARTING_RECEIPT_NO` int unsigned DEFAULT NULL,
  `VOID_STARTING_RECEIPT_NO` int DEFAULT NULL,
  `VOID_ENDING_RECEIPT_NO` int DEFAULT NULL,
  `RETURN_STARTING_RECEIPT_NO` int DEFAULT NULL,
  `RETURN_ENDING_RECEIPT_NO` int DEFAULT NULL,
  `ENDING_RECEIPT_NO` int unsigned DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `OUTPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `NONTAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `LESS_VAT_SALES` decimal(16,4) DEFAULT NULL,
  `TRANSACTION_COUNT` int unsigned DEFAULT NULL,
  `PRINT_COUNT` int unsigned DEFAULT NULL,
  `RETURN_COUNT` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_POS_LOG_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_POS_LOG_POS_MACHINE_ID` (`POS_MACHINE_ID`),
  KEY `FK_POS_LOG_DRAWER_ACCOUNT_ID` (`DRAWER_ACCOUNT_ID`),
  KEY `FK_POS_LOG_UNDEPOSITED_FUNDS_ACCOUNT_ID` (`UNDEPOSITED_FUNDS_ACCOUNT_ID`),
  CONSTRAINT `FK_POS_LOG_DRAWER_ACCOUNT_ID` FOREIGN KEY (`DRAWER_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_POS_LOG_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_POS_LOG_POS_MACHINE_ID` FOREIGN KEY (`POS_MACHINE_ID`) REFERENCES `pos_machine` (`ID`),
  CONSTRAINT `FK_POS_LOG_UNDEPOSITED_FUNDS_ACCOUNT_ID` FOREIGN KEY (`UNDEPOSITED_FUNDS_ACCOUNT_ID`) REFERENCES `account` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_machine`
--

DROP TABLE IF EXISTS `pos_machine`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_machine` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(50) NOT NULL,
  `DESCRIPTION` varchar(50) DEFAULT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  `NEXT_RECEIPT_NO` int unsigned DEFAULT NULL,
  `NO_OF_DIGITS` int unsigned DEFAULT NULL,
  `POS_PERMIT_NO` varchar(50) DEFAULT NULL,
  `NEXT_LOG_SERIAL_NO` int unsigned DEFAULT NULL,
  `NEXT_SHIFT_NO` int DEFAULT NULL,
  `FEDERATED_SCHEMA` varchar(100) DEFAULT NULL,
  `CODE_PREFIX` varchar(45) DEFAULT NULL,
  `NEXT_VOID_SEQUENCE` int unsigned DEFAULT NULL,
  `NEXT_RETURN_SEQUENCE` int unsigned DEFAULT NULL,
  `RESET_COUNTER` int unsigned DEFAULT NULL,
  `NEXT_GLOBAL_SEQ` int unsigned DEFAULT '1',
  `NEXT_PAY_IN_SEQ` int DEFAULT NULL,
  `NEXT_PAY_OUT_SEQ` int(11) unsigned zerofill DEFAULT NULL,
  `MIN` varchar(50) DEFAULT NULL,
  `SERIAL_NO` varchar(50) DEFAULT NULL,
  `DATE_ISSUED` date DEFAULT NULL,
  `VALID_UNTIL` date DEFAULT NULL,
  `OPERATED_BY` varchar(70) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_POS_MACHINE_NAME` (`NAME`),
  KEY `FK_POS_MACHINE_TYPE` (`TYPE`),
  KEY `FK_POS_MACHINE_ACCOUNT_ID` (`ACCOUNT_ID`),
  CONSTRAINT `FK_POS_MACHINE_ACCOUNT_ID` FOREIGN KEY (`ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_POS_MACHINE_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `pos_machine_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_machine_type_map`
--

DROP TABLE IF EXISTS `pos_machine_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_machine_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_starting_cash`
--

DROP TABLE IF EXISTS `pos_starting_cash`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_starting_cash` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `POS_MACHINE_ID` int unsigned NOT NULL,
  `CASHIER_ID` int unsigned NOT NULL,
  `AMOUNT` decimal(16,2) NOT NULL,
  `POSTED` tinyint(1) NOT NULL,
  `DRAWER_ACCOUNT_ID` int unsigned NOT NULL,
  `PETTY_CASH_ACCOUNT_ID` int unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_POS_STARTING_CASH_CASHIER_ID` (`CASHIER_ID`),
  KEY `FK_POS_STARTING_CASH_POS_MACHINE_ID` (`POS_MACHINE_ID`),
  KEY `FK_POS_STARTING_CASH_DRAWER_ACCOUNT_ID` (`DRAWER_ACCOUNT_ID`),
  KEY `FK_POS_STARTING_CASH_PETTY_CASH_ACCOUNT_ID` (`PETTY_CASH_ACCOUNT_ID`),
  CONSTRAINT `FK_POS_STARTING_CASH_CASHIER_ID` FOREIGN KEY (`CASHIER_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_POS_STARTING_CASH_DRAWER_ACCOUNT_ID` FOREIGN KEY (`DRAWER_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_POS_STARTING_CASH_PETTY_CASH_ACCOUNT_ID` FOREIGN KEY (`PETTY_CASH_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_POS_STARTING_CASH_POS_MACHINE_ID` FOREIGN KEY (`POS_MACHINE_ID`) REFERENCES `pos_machine` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pos_trx_type_map`
--

DROP TABLE IF EXISTS `pos_trx_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pos_trx_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `price_level`
--

DROP TABLE IF EXISTS `price_level`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `price_level` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `RATE` decimal(6,2) DEFAULT NULL,
  `ITEM_GROUP_ID` int unsigned DEFAULT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_PRICE_LEVEL_TYPE` (`TYPE`),
  KEY `FK_PRICE_LEVEL_ITEM_GROUP_ID` (`ITEM_GROUP_ID`),
  CONSTRAINT `FK_PRICE_LEVEL_ITEM_GROUP_ID` FOREIGN KEY (`ITEM_GROUP_ID`) REFERENCES `item_group` (`ID`),
  CONSTRAINT `FK_PRICE_LEVEL_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `price_level_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `price_level_lines`
--

DROP TABLE IF EXISTS `price_level_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `price_level_lines` (
  `ID` int unsigned NOT NULL,
  `PRICE_LEVEL_ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  `CUSTOM_PRICE` decimal(16,4) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_PRICE_LEVEL_LINES_PL_ID` (`PRICE_LEVEL_ID`),
  KEY `FK_PRICE_LEVEL_LINES_ITEM_ID` (`ITEM_ID`),
  CONSTRAINT `FK_PRICE_LEVEL_LINES_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_PRICE_LEVEL_LINES_PL_ID` FOREIGN KEY (`PRICE_LEVEL_ID`) REFERENCES `price_level` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `price_level_type_map`
--

DROP TABLE IF EXISTS `price_level_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `price_level_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project`
--

DROP TABLE IF EXISTS `project`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(50) NOT NULL,
  `CUSTOMER_ID` int unsigned NOT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE,
  KEY `FK_PROJECT_CUSTOMER_ID` (`CUSTOMER_ID`) USING BTREE,
  CONSTRAINT `FK_PROJECT_CUSTOMER_ID` FOREIGN KEY (`CUSTOMER_ID`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `purchase_order`
--

DROP TABLE IF EXISTS `purchase_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `VENDOR_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `DATE_EXPECTED` date DEFAULT NULL,
  `SHIP_TO` varchar(255) DEFAULT NULL,
  `SHIP_VIA_ID` int unsigned DEFAULT NULL,
  `PAYMENT_TERMS_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `INPUT_TAX_ID` int unsigned DEFAULT NULL,
  `INPUT_TAX_RATE` decimal(6,2) DEFAULT NULL,
  `INPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `INPUT_TAX_VAT_METHOD` tinyint unsigned DEFAULT NULL,
  `INPUT_TAX_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `NONTAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_PURCHASE_ORDER_CODE` (`CODE`),
  KEY `FK_PURCHASE_ORDER_SHIP_VIA_ID` (`SHIP_VIA_ID`),
  KEY `FK_PURCHASE_ORDER_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_PURCHASE_ORDER_PAYMENT_TERMS_ID` (`PAYMENT_TERMS_ID`),
  KEY `IX_PURCHASE_ORDER_DATE` (`DATE`) USING BTREE,
  KEY `IX_PURCHASE_ORDER_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  KEY `FK_PURCHASE_ORDER_CASS_ID` (`CLASS_ID`),
  KEY `FK_PURCHASE_ORDER_INPUT_TAX_ACCOUNT_ID` (`INPUT_TAX_ACCOUNT_ID`),
  KEY `FK_PURCHASE_ORDER_INPUT_TAX_ID` (`INPUT_TAX_ID`),
  KEY `IX_PURCHASE_ORDER_CUSTOM_FIELD1` (`CUSTOM_FIELD1`),
  KEY `IX_PURCHASE_ORDER_CUSTOM_FIELD2` (`CUSTOM_FIELD2`),
  KEY `IX_PURCHASE_ORDER_CUSTOM_FIELD3` (`CUSTOM_FIELD3`),
  KEY `IX_PURCHASE_ORDER_CUSTOM_FIELD4` (`CUSTOM_FIELD4`),
  KEY `IX_PURCHASE_ORDER_CUSTOM_FIELD5` (`CUSTOM_FIELD5`),
  KEY `IX_PURCHASE_ORDER_STATUS_VENDOR` (`VENDOR_ID`,`STATUS`) USING BTREE,
  KEY `IX_PURCHASE_ORDER_STATUS` (`STATUS`),
  CONSTRAINT `FK_PURCHASE_ORDER_CASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_PURCHASE_ORDER_INPUT_TAX_ACCOUNT_ID` FOREIGN KEY (`INPUT_TAX_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_PURCHASE_ORDER_INPUT_TAX_ID` FOREIGN KEY (`INPUT_TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_PURCHASE_ORDER_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_PURCHASE_ORDER_PAYMENT_TERMS_ID` FOREIGN KEY (`PAYMENT_TERMS_ID`) REFERENCES `payment_terms` (`ID`),
  CONSTRAINT `FK_PURCHASE_ORDER_SHIP_VIA_ID` FOREIGN KEY (`SHIP_VIA_ID`) REFERENCES `ship_via` (`ID`),
  CONSTRAINT `FK_PURCHASE_ORDER_VENDOR_ID` FOREIGN KEY (`VENDOR_ID`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `purchase_order_items`
--

DROP TABLE IF EXISTS `purchase_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_items` (
  `ID` int unsigned NOT NULL,
  `PO_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `BATCH_ID` int DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `RECEIVED_QTY` decimal(16,6) DEFAULT NULL,
  `CLOSED` tinyint(1) DEFAULT NULL,
  `TAXABLE` tinyint DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `PROJECT_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `INVENTORY_REQUEST_ITEM_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_PURCHASE_ORDER_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_PURCHASE_ORDER_ITEMS_PO_ID` (`PO_ID`) USING BTREE,
  KEY `FK_PURCHASE_ORDER_ITEMS_UNIT_ID` (`UNIT_ID`),
  CONSTRAINT `FK_PURCHASE_ORDER_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_PURCHASE_ORDER_ITEMS_PO_ID` FOREIGN KEY (`PO_ID`) REFERENCES `purchase_order` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_PURCHASE_ORDER_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rate_type_map`
--

DROP TABLE IF EXISTS `rate_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rate_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rb_templates`
--

DROP TABLE IF EXISTS `rb_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rb_templates` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `NAME` varchar(255) NOT NULL,
  `TEMPLATE` mediumblob NOT NULL,
  `TYPE` int unsigned DEFAULT NULL,
  `DEFAULT` tinyint(1) NOT NULL DEFAULT '0',
  `PROTECTION_LEVEL` tinyint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_RB_TEMPLATES_NAME` (`NAME`,`TYPE`),
  KEY `FK_RB_TEMPLATES_TYPE` (`TYPE`),
  CONSTRAINT `FK_RB_TEMPLATES_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `rb_templates_type_map` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=609 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rb_templates_type_map`
--

DROP TABLE IF EXISTS `rb_templates_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rb_templates_type_map` (
  `ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(255) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sales_order`
--

DROP TABLE IF EXISTS `sales_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_order` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `CUSTOMER_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `SALES_REP_ID` int unsigned DEFAULT NULL,
  `DATE_NEEDED` datetime DEFAULT NULL,
  `PO_NUMBER` varchar(20) DEFAULT NULL,
  `SHIP_TO` varchar(255) DEFAULT NULL,
  `SHIP_VIA_ID` int unsigned DEFAULT NULL,
  `PAYMENT_TERMS_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `OUTPUT_TAX_ID` int unsigned DEFAULT NULL,
  `OUTPUT_TAX_RATE` decimal(6,2) DEFAULT NULL,
  `OUTPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `OUTPUT_TAX_VAT_METHOD` tinyint unsigned DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `NONTAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` datetime DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `PROJECT_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_SALES_ORDER_CODE` (`CODE`),
  KEY `FK_SALES_ORDER_CUSTOMER_ID` (`CUSTOMER_ID`),
  KEY `FK_SALES_ORDER_SHIP_VIA_ID` (`SHIP_VIA_ID`),
  KEY `FK_SALES_ORDER_PAYMENT_TERMS_ID` (`PAYMENT_TERMS_ID`),
  KEY `FK_SALES_ORDER_SALES_REP_ID` (`SALES_REP_ID`),
  KEY `IX_SALES_ORDER_DATE` (`DATE`) USING BTREE,
  KEY `FK_SALES_ORDER_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `IX_SALES_ORDER_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  KEY `FK_SALES_ORDER_OUTPUT_TAX_ID` (`OUTPUT_TAX_ID`),
  KEY `FK_SALES_ORDER_OUTPUT_TAX_VAT_METHOD` (`OUTPUT_TAX_VAT_METHOD`),
  KEY `FK_SALES_ORDER_PO_NUMBER` (`PO_NUMBER`,`CUSTOMER_ID`),
  KEY `FK_SALES_ORDER_CASS_ID` (`CLASS_ID`),
  KEY `IX_SALES_ORDER_CUSTOM_FIELD1` (`CUSTOM_FIELD1`),
  KEY `IX_SALES_ORDER_CUSTOM_FIELD2` (`CUSTOM_FIELD2`),
  KEY `IX_ESALES_ORDER_CUSTOM_FIELD3` (`CUSTOM_FIELD3`),
  KEY `IX_SALES_ORDER_CUSTOM_FIELD4` (`CUSTOM_FIELD4`),
  KEY `IX_SALES_ORDER_CUSTOM_FIELD5` (`CUSTOM_FIELD5`),
  KEY `IX_SALES_ORDER_STATUS` (`STATUS`),
  KEY `IX_SALES_ORDER_STATUS_CUSTOMER` (`CUSTOMER_ID`,`STATUS`) USING BTREE,
  CONSTRAINT `FK_SALES_ORDER_CASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_SALES_ORDER_CUSTOMER_ID` FOREIGN KEY (`CUSTOMER_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_SALES_ORDER_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_SALES_ORDER_OUTPUT_TAX_ID` FOREIGN KEY (`OUTPUT_TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_SALES_ORDER_OUTPUT_TAX_VAT_METHOD` FOREIGN KEY (`OUTPUT_TAX_VAT_METHOD`) REFERENCES `vat_method_map` (`ID`),
  CONSTRAINT `FK_SALES_ORDER_PAYMENT_TERMS_ID` FOREIGN KEY (`PAYMENT_TERMS_ID`) REFERENCES `payment_terms` (`ID`),
  CONSTRAINT `FK_SALES_ORDER_SALES_REP_ID` FOREIGN KEY (`SALES_REP_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_SALES_ORDER_SHIP_VIA_ID` FOREIGN KEY (`SHIP_VIA_ID`) REFERENCES `ship_via` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sales_order_items`
--

DROP TABLE IF EXISTS `sales_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_order_items` (
  `ID` int unsigned NOT NULL,
  `SALES_ORDER_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `ESTIMATE_LINE_ID` int unsigned DEFAULT NULL,
  `INVOICED_QTY` decimal(16,6) DEFAULT NULL,
  `CLOSED` tinyint unsigned NOT NULL,
  `GROUP_LINE_ID` int unsigned DEFAULT NULL,
  `PRINT_IN_FORMS` tinyint(1) DEFAULT NULL,
  `PRICE_LEVEL_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_SALES_ORDER_ITEMS_SALES_ORDER_ID` (`SALES_ORDER_ID`) USING BTREE,
  KEY `FK_SALES_ORDER_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `IX_SALES_ORDER_ITEMS_CLOSED` (`CLOSED`) USING BTREE,
  KEY `FK_SALES_ORDER_ITEMS_ESTIMATE_LINE_ID` (`ESTIMATE_LINE_ID`) USING BTREE,
  KEY `FK_SALES_ORDER_ITEMS_RATE_TYPE` (`RATE_TYPE`) USING BTREE,
  KEY `FK_SALES_ORDER_ITEMS_UNIT_ID` (`UNIT_ID`),
  CONSTRAINT `FK_SALES_ORDER_ITEMS_ESTIMATE_LINE_ID` FOREIGN KEY (`ESTIMATE_LINE_ID`) REFERENCES `estimate_items` (`ID`),
  CONSTRAINT `FK_SALES_ORDER_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_SALES_ORDER_ITEMS_RATE_TYPE` FOREIGN KEY (`RATE_TYPE`) REFERENCES `rate_type_map` (`ID`),
  CONSTRAINT `FK_SALES_ORDER_ITEMS_SALES_ORDER_ID` FOREIGN KEY (`SALES_ORDER_ID`) REFERENCES `sales_order` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SALES_ORDER_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sales_receipt`
--

DROP TABLE IF EXISTS `sales_receipt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_receipt` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `POS_TIMESTAMP` datetime DEFAULT NULL,
  `CUSTOMER_ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `CLASS_ID` int unsigned DEFAULT NULL,
  `SALES_REP_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `PAYMENT_AMOUNT` decimal(16,4) DEFAULT NULL,
  `PAYMENT_METHOD_ID` int unsigned DEFAULT NULL,
  `PAYMENT_REF_NO` varchar(20) DEFAULT NULL,
  `CARD_NO` varchar(20) DEFAULT NULL,
  `CASHIER_ID` int unsigned DEFAULT NULL,
  `CASH_COUNT_ID` int unsigned DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `UNDEPOSITED_FUNDS_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `OUTPUT_TAX_ID` int unsigned DEFAULT NULL,
  `OUTPUT_TAX_RATE` decimal(6,2) DEFAULT NULL,
  `OUTPUT_TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `OUTPUT_TAX_VAT_METHOD` tinyint unsigned DEFAULT NULL,
  `OUTPUT_TAX_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `NONTAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `STATUS` tinyint NOT NULL,
  `POS_POSTED` tinyint(1) DEFAULT NULL,
  `POS_END_OF_SHIFT_ID` int DEFAULT NULL,
  `POS_LOG_ID` int unsigned DEFAULT NULL,
  `POS_MACHINE_ID` int unsigned DEFAULT NULL,
  `SO_MACHINE_ID` int unsigned DEFAULT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `DEPOSITED` tinyint(1) DEFAULT NULL,
  `INVOICED` tinyint DEFAULT '0',
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `OR_REFERENCE_NO` varchar(20) DEFAULT NULL,
  `SO_REFERENCE_NO` varchar(20) DEFAULT NULL,
  `POINTS_CALCULATED` tinyint(1) DEFAULT NULL,
  `PROJECT_ID` int DEFAULT NULL,
  `POSTED` tinyint unsigned DEFAULT '0',
  `PRINT_COUNT` int unsigned DEFAULT NULL,
  `VOID_REFERENCE_NO` varchar(20) DEFAULT NULL,
  `RETURN_TRX` tinyint unsigned DEFAULT NULL,
  `PAY_IN_TRX` int DEFAULT NULL,
  `PAY_OUT_TRX` int DEFAULT NULL,
  `POS_TOTAL_AMOUNT` decimal(16,4) DEFAULT NULL,
  `CREDIT_LIMIT` decimal(16,4) DEFAULT NULL,
  `CREDIT_BALANCE_DUE` decimal(16,4) DEFAULT NULL,
  `WALKIN_CUSTOMER_NAME` varchar(255) DEFAULT NULL,
  `WALKIN_CUSTOMER_TIN` varchar(255) DEFAULT NULL,
  `WALKIN_CUSTOMER_BUSINESS_STYLE` varchar(255) DEFAULT NULL,
  `WALKIN_CUSTOMER_ADDRESS` varchar(512) DEFAULT NULL,
  `INVOICE_ID` int unsigned DEFAULT NULL,
  `CREDIT_MEMO_ID` int unsigned DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_SALES_RECEIPT_CODE` (`CODE`,`POS_MACHINE_ID`,`PAY_IN_TRX`,`PAY_OUT_TRX`),
  KEY `FK_SALES_RECEIPT_CUSTOMER_ID` (`CUSTOMER_ID`),
  KEY `FK_SALES_RECEIPT_SALES_REP_ID` (`SALES_REP_ID`),
  KEY `FK_SALES_RECEIPT_CASH_COUNT_ID` (`CASH_COUNT_ID`),
  KEY `IX_SALES_RECEIPT_DATE` (`DATE`) USING BTREE,
  KEY `IX_SALES_RECEIPT_LOCATION_RANGE` (`DATE`,`LOCATION_ID`) USING BTREE,
  KEY `FK_SALES_RECEIPT_LOCATION_ID` (`LOCATION_ID`),
  KEY `FK_SALES_RECEIPT_POS_MACHINE_ID` (`POS_MACHINE_ID`),
  KEY `FK_SALES_RECEIPT_SO_MACHINE_ID` (`SO_MACHINE_ID`),
  KEY `FK_SALES_RECEIPT_UNDEPOSITED_FUNDS_ACCOUNT_ID` (`UNDEPOSITED_FUNDS_ACCOUNT_ID`),
  KEY `FK_SALES_RECEIPT_OUTPUT_TAX_ID` (`OUTPUT_TAX_ID`),
  KEY `FK_SALES_RECEIPT_OUTPUT_TAX_VAT_METHOD` (`OUTPUT_TAX_VAT_METHOD`),
  KEY `FK_SALES_RECEIPT_OUTPUT_TAX_ACCOUNT_ID` (`OUTPUT_TAX_ACCOUNT_ID`),
  KEY `FK_SALES_RECEIPT_CASS_ID` (`CLASS_ID`),
  KEY `IX_SALES_RECEIPT_CUSTOM_FIELD1` (`CUSTOM_FIELD1`),
  KEY `IX_SALES_RECEIPT_CUSTOM_FIELD2` (`CUSTOM_FIELD2`),
  KEY `IX_SALES_RECEIPT_CUSTOM_FIELD3` (`CUSTOM_FIELD3`),
  KEY `IX_SALES_RECEIPT_CUSTOM_FIELD4` (`CUSTOM_FIELD4`),
  KEY `IX_SALES_RECEIPT_CUSTOM_FIELD5` (`CUSTOM_FIELD5`),
  KEY `IX_SALES_RECEIPT_POS_END_SHIFT` (`POS_END_OF_SHIFT_ID`),
  KEY `IX_SALES_RECEIPT_INVOICED` (`INVOICED`) USING BTREE,
  CONSTRAINT `FK_SALES_RECEIPT_CASH_COUNT_ID` FOREIGN KEY (`CASH_COUNT_ID`) REFERENCES `cash_count` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_CASS_ID` FOREIGN KEY (`CLASS_ID`) REFERENCES `class` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_CUSTOMER_ID` FOREIGN KEY (`CUSTOMER_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_OUTPUT_TAX_ACCOUNT_ID` FOREIGN KEY (`OUTPUT_TAX_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_OUTPUT_TAX_ID` FOREIGN KEY (`OUTPUT_TAX_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_OUTPUT_TAX_VAT_METHOD` FOREIGN KEY (`OUTPUT_TAX_VAT_METHOD`) REFERENCES `vat_method_map` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_POS_MACHINE_ID` FOREIGN KEY (`POS_MACHINE_ID`) REFERENCES `pos_machine` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_SALES_REP_ID` FOREIGN KEY (`SALES_REP_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_SO_MACHINE_ID` FOREIGN KEY (`SO_MACHINE_ID`) REFERENCES `pos_machine` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_UNDEPOSITED_FUNDS_ACCOUNT_ID` FOREIGN KEY (`UNDEPOSITED_FUNDS_ACCOUNT_ID`) REFERENCES `account` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sales_receipt_items`
--

DROP TABLE IF EXISTS `sales_receipt_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_receipt_items` (
  `ID` int unsigned NOT NULL,
  `SALES_RECEIPT_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `RATE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` tinyint unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAXABLE` tinyint(1) DEFAULT NULL,
  `TAXABLE_AMOUNT` decimal(16,4) DEFAULT NULL,
  `TAX_AMOUNT` decimal(16,4) DEFAULT NULL,
  `COGS_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `INCOME_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `PAYMENT_METHOD_ID` int DEFAULT NULL,
  `PAYMENT_REF_NO` varchar(20) DEFAULT NULL,
  `CARD_NO` varchar(20) DEFAULT NULL,
  `CARD_EXP_DATE` varchar(7) DEFAULT NULL,
  `POS_TRX_TYPE` tinyint unsigned DEFAULT NULL,
  `POS_EDIT_QTY` decimal(16,4) DEFAULT NULL,
  `POS_NOTES` varchar(255) DEFAULT NULL,
  `POS_REF_NO` varchar(20) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `GROUP_LINE_ID` int unsigned DEFAULT NULL,
  `PRINT_IN_FORMS` tinyint(1) DEFAULT NULL,
  `DEPOSITED` tinyint(1) DEFAULT NULL,
  `INVOICED` tinyint DEFAULT '0',
  `PRICE_LEVEL_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `DISCOUNT_TYPE` int unsigned DEFAULT NULL,
  `DISCOUNT_RATE` decimal(16,4) DEFAULT NULL,
  `DISCOUNT` decimal(16,4) DEFAULT NULL,
  `LESS_VAT` decimal(16,4) DEFAULT NULL,
  `ADD_VAT` decimal(16,4) DEFAULT NULL,
  `CARD_HOLDER_NAME` varchar(50) DEFAULT NULL,
  `CARD_HOLDER_BALANCE` decimal(16,4) DEFAULT NULL,
  `GIFT_CERTIFICATE_ID` int unsigned DEFAULT NULL,
  `VOUCHER_ID` int unsigned DEFAULT NULL,
  `SURCHARGE` decimal(16,4) DEFAULT NULL,
  `CLEARED` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_SALES_RECEIPT_ITEMS_ASSET_ACCOUNT_ID` (`ASSET_ACCOUNT_ID`) USING BTREE,
  KEY `FK_SALES_RECEIPT_ITEMS_COGS_ACCOUNT_ID` (`COGS_ACCOUNT_ID`) USING BTREE,
  KEY `FK_SALES_RECEIPT_ITEMS_INCOME_ACCOUNT_ID` (`INCOME_ACCOUNT_ID`) USING BTREE,
  KEY `FK_SALES_RECEIPT_ITEMS_ITEM_ID` (`ITEM_ID`) USING BTREE,
  KEY `FK_SALES_RECEIPT_ITEMS_SALES_RECEIPT_ID` (`SALES_RECEIPT_ID`) USING BTREE,
  KEY `IX_SALES_RECEIPT_ITEMS_POS_EDIT_QTY` (`POS_EDIT_QTY`) USING BTREE,
  KEY `FK_SALES_RECEIPT_ITEMS_BATCH_ID` (`BATCH_ID`) USING BTREE,
  KEY `FK_SALES_RECEIPT_ITEMS_RATE_TYPE` (`RATE_TYPE`) USING BTREE,
  KEY `FK_SALES_RECEIPT_ITEMS_UNIT_ID` (`UNIT_ID`),
  CONSTRAINT `FK_SALES_RECEIPT_ITEMS_ASSET_ACCOUNT_ID` FOREIGN KEY (`ASSET_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_ITEMS_BATCH_ID` FOREIGN KEY (`BATCH_ID`) REFERENCES `item_batches` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_ITEMS_COGS_ACCOUNT_ID` FOREIGN KEY (`COGS_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_ITEMS_INCOME_ACCOUNT_ID` FOREIGN KEY (`INCOME_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_ITEMS_ITEM_ID` FOREIGN KEY (`ITEM_ID`) REFERENCES `item` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_ITEMS_RATE_TYPE` FOREIGN KEY (`RATE_TYPE`) REFERENCES `rate_type_map` (`ID`),
  CONSTRAINT `FK_SALES_RECEIPT_ITEMS_SALES_RECEIPT_ID` FOREIGN KEY (`SALES_RECEIPT_ID`) REFERENCES `sales_receipt` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `FK_SALES_RECEIPT_ITEMS_UNIT_ID` FOREIGN KEY (`UNIT_ID`) REFERENCES `unit_of_measure` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `serialize_inventory`
--

DROP TABLE IF EXISTS `serialize_inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `serialize_inventory` (
  `ID` int unsigned NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `SERIAL_ID` int unsigned NOT NULL,
  `SOURCE_REF_TYPE` int unsigned NOT NULL,
  `SOURCE_REF_ID` int unsigned NOT NULL,
  `ENTRY_TYPE` int NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ship_via`
--

DROP TABLE IF EXISTS `ship_via`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ship_via` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_SHIP_VIA_CODE` (`CODE`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stock_bin`
--

DROP TABLE IF EXISTS `stock_bin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_bin` (
  `ID` int unsigned NOT NULL,
  `CODE` varchar(10) NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_STOCK_BIN_CODE` (`CODE`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stock_transfer`
--

DROP TABLE IF EXISTS `stock_transfer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfer` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `DATE` date NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `TRANSFER_TO_ID` int unsigned NOT NULL,
  `IN_TRANSIT_LOCATION_ID` int DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `RETAIL_VALUE` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `PREPARED_BY_ID` int unsigned DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `DATE_RECEIVED` date DEFAULT NULL,
  `RECEIVED_BY_ID` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stock_transfer_items`
--

DROP TABLE IF EXISTS `stock_transfer_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfer_items` (
  `ID` int unsigned NOT NULL,
  `STOCK_TRANSFER_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(13,4) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_COST` decimal(16,4) DEFAULT NULL,
  `UNIT_PRICE` decimal(16,4) DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `RETAIL_VALUE` decimal(16,4) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `RECEIVED_QTY` decimal(13,4) DEFAULT NULL,
  `OPEN_DISPUTE` tinyint unsigned DEFAULT NULL,
  `DISPUTE_TYPE_ID` int unsigned DEFAULT NULL,
  `DISPUTE_REMARKS` varchar(50) DEFAULT NULL,
  `RESOLUTION_TYPE_ID` int unsigned DEFAULT NULL,
  `RESOLUTION_REMARKS` varchar(50) DEFAULT NULL,
  `CLOSED` tinyint unsigned DEFAULT NULL,
  `CUSTOM_FIELD1` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD2` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD3` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD4` varchar(512) DEFAULT NULL,
  `CUSTOM_FIELD5` varchar(512) DEFAULT NULL,
  `ITEM_REQUEST_ITEM_ID` int unsigned DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stock_transfer_receive`
--

DROP TABLE IF EXISTS `stock_transfer_receive`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfer_receive` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `DATE` date NOT NULL,
  `CODE` varchar(20) NOT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `RECEIVED_FROM_ID` int unsigned NOT NULL,
  `IN_TRANSIT_ID` int DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `RETAIL_VALUE` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `PREPARED_BY_ID` int unsigned DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `ACCOUNT_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stock_transfer_receive_items`
--

DROP TABLE IF EXISTS `stock_transfer_receive_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfer_receive_items` (
  `ID` int unsigned NOT NULL,
  `STOCK_TRANSFER_RECEIVE_ID` int unsigned NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `ITEM_ID` int unsigned DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QUANTITY` decimal(13,4) DEFAULT NULL,
  `UNIT_ID` int unsigned DEFAULT NULL,
  `UNIT_BASE_QUANTITY` decimal(16,6) DEFAULT NULL,
  `UNIT_COST` decimal(16,4) DEFAULT NULL,
  `UNIT_PRICE` decimal(16,4) DEFAULT NULL,
  `AMOUNT` decimal(16,4) DEFAULT NULL,
  `RETAIL_VALUE` decimal(16,4) DEFAULT NULL,
  `BATCH_ID` int unsigned DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `STOCK_TRANSFER_LINE_ID` int unsigned NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stock_type_map`
--

DROP TABLE IF EXISTS `stock_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `supplier_loyalty_points`
--

DROP TABLE IF EXISTS `supplier_loyalty_points`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_loyalty_points` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `CUSTOMER_ID` int unsigned DEFAULT NULL,
  `PROGRAM_ID` int unsigned DEFAULT NULL,
  `TYPE` varchar(10) DEFAULT NULL,
  `OBJECT_TYPE` int unsigned DEFAULT NULL,
  `OBJECT_ID` int unsigned DEFAULT NULL,
  `OBJECT_DATE` date DEFAULT NULL,
  `POINTS` decimal(16,2) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_security`
--

DROP TABLE IF EXISTS `system_security`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_security` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `NAME` varchar(100) NOT NULL,
  `USER_ID` int unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_SYSTEM_SECURITY_USER_ID` (`USER_ID`),
  CONSTRAINT `FK_SYSTEM_SECURITY_USER_ID` FOREIGN KEY (`USER_ID`) REFERENCES `user` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=6503 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `NAME` varchar(50) NOT NULL,
  `DESCRIPTION` varchar(50) DEFAULT NULL,
  `VALUE` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tax`
--

DROP TABLE IF EXISTS `tax`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(50) NOT NULL,
  `TAX_CODE` varchar(20) DEFAULT NULL,
  `TAX_TYPE` tinyint unsigned NOT NULL,
  `RATE` decimal(6,2) DEFAULT NULL,
  `VAT_METHOD` tinyint unsigned DEFAULT NULL,
  `TAX_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `ASSET_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_TAX_NAME` (`NAME`),
  KEY `FK_TAX_TYPE` (`TAX_TYPE`),
  KEY `FK_TAX_TAX_ACCOUNT_ID` (`TAX_ACCOUNT_ID`),
  KEY `FK_TAX_VAT_METHOD` (`VAT_METHOD`),
  KEY `FK_TAX_ASSET_ACCOUNT_ID` (`ASSET_ACCOUNT_ID`),
  CONSTRAINT `FK_TAX_ASSET_ACCOUNT_ID` FOREIGN KEY (`ASSET_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_TAX_TAX_ACCOUNT_ID` FOREIGN KEY (`TAX_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_TAX_TYPE` FOREIGN KEY (`TAX_TYPE`) REFERENCES `tax_type_map` (`ID`),
  CONSTRAINT `FK_TAX_VAT_METHOD` FOREIGN KEY (`VAT_METHOD`) REFERENCES `vat_method_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tax_credit`
--

DROP TABLE IF EXISTS `tax_credit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_credit` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `CUSTOMER_ID` int unsigned NOT NULL,
  `EWT_ID` int unsigned DEFAULT NULL,
  `EWT_RATE` decimal(6,2) DEFAULT NULL,
  `EWT_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` date DEFAULT NULL,
  `ACCOUNTS_RECEIVABLE_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_TAX_CREDIT_CODE` (`CODE`),
  KEY `FK_TAX_CREDIT_CUSTOMER_ID` (`CUSTOMER_ID`) USING BTREE,
  KEY `FK_TAX_CREDIT_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `FK_TAX_CREDIT_EWT_ID` (`EWT_ID`),
  KEY `FK_TAX_CREDIT_EWT_ACCOUNT_ID` (`EWT_ACCOUNT_ID`),
  KEY `FK_TAX_CREDIT_ACCOUNTS_RECEIVABLE_ID` (`ACCOUNTS_RECEIVABLE_ID`),
  CONSTRAINT `FK_TAX_CREDIT_ACCOUNTS_RECEIVABLE_ID` FOREIGN KEY (`ACCOUNTS_RECEIVABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_TAX_CREDIT_CUSTOMER_ID` FOREIGN KEY (`CUSTOMER_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_TAX_CREDIT_EWT_ACCOUNT_ID` FOREIGN KEY (`EWT_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_TAX_CREDIT_EWT_ID` FOREIGN KEY (`EWT_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_TAX_CREDIT_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tax_credit_invoices`
--

DROP TABLE IF EXISTS `tax_credit_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_credit_invoices` (
  `ID` int unsigned NOT NULL,
  `TAX_CREDIT_ID` int unsigned NOT NULL,
  `INVOICE_ID` int unsigned NOT NULL,
  `AMOUNT_WITHHELD` decimal(16,4) NOT NULL,
  `ACCOUNTS_RECEIVABLE_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_TAX_CREDIT_INVOICES_TAX_CREDIT_ID` (`TAX_CREDIT_ID`),
  KEY `FK_TAX_CREDIT_INVOICES_INVOICE_ID` (`INVOICE_ID`),
  KEY `FK_TAX_CREDIT_INVOICES_ACCOUNTS_RECEIVABLE_ID` (`ACCOUNTS_RECEIVABLE_ID`),
  CONSTRAINT `FK_TAX_CREDIT_INVOICES_ACCOUNTS_RECEIVABLE_ID` FOREIGN KEY (`ACCOUNTS_RECEIVABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_TAX_CREDIT_INVOICES_INVOICE_ID` FOREIGN KEY (`INVOICE_ID`) REFERENCES `invoice` (`ID`),
  CONSTRAINT `FK_TAX_CREDIT_INVOICES_TAX_CREDIT_ID` FOREIGN KEY (`TAX_CREDIT_ID`) REFERENCES `tax_credit` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tax_credit_other_details`
--

DROP TABLE IF EXISTS `tax_credit_other_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_credit_other_details` (
  `ID` int unsigned NOT NULL,
  `TAX_CREDIT_ID` int unsigned NOT NULL,
  `OBJECT_TYPE` int unsigned NOT NULL,
  `OBJECT_ID` int unsigned NOT NULL,
  `AMOUNT_WITHHELD` decimal(16,4) DEFAULT NULL,
  `ACCOUNTS_RECEIVABLE_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_TAX_CREDIT_OTHER_DETAILS_ACCOUNTS_RECEIVABLE_ID` (`ACCOUNTS_RECEIVABLE_ID`),
  KEY `FK_TAX_CREDIT_OTHER_DETAILS_TAX_CREDIT_ID` (`TAX_CREDIT_ID`),
  CONSTRAINT `FK_TAX_CREDIT_OTHER_DETAILS_ACCOUNTS_RECEIVABLE_ID` FOREIGN KEY (`ACCOUNTS_RECEIVABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_TAX_CREDIT_OTHER_DETAILS_TAX_CREDIT_ID` FOREIGN KEY (`TAX_CREDIT_ID`) REFERENCES `tax_credit` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tax_type_map`
--

DROP TABLE IF EXISTS `tax_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transfer_discrepancy_type`
--

DROP TABLE IF EXISTS `transfer_discrepancy_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transfer_discrepancy_type` (
  `ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transfer_resolution_type`
--

DROP TABLE IF EXISTS `transfer_resolution_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transfer_resolution_type` (
  `ID` int unsigned NOT NULL,
  `DESCRIPTION` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `unit_of_measure`
--

DROP TABLE IF EXISTS `unit_of_measure`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `unit_of_measure` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(20) NOT NULL,
  `SYMBOL` varchar(15) NOT NULL,
  `INACTIVE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `IX_UNIT_OF_MEASURE` (`NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(30) NOT NULL,
  `DESCRIPTION` varchar(50) DEFAULT NULL,
  `PASSWORD` varchar(512) DEFAULT NULL,
  `PWD_CREATED_ON` datetime DEFAULT NULL,
  `PWD_NEVER_EXPIRES` bit(1) DEFAULT NULL,
  `TYPE` tinyint unsigned NOT NULL,
  `ACCESS_LEVEL` tinyint unsigned DEFAULT '0',
  `STATUS` tinyint unsigned DEFAULT NULL,
  `CONTACT_ID` int unsigned DEFAULT NULL,
  `REGISTERED_BY_ID` int unsigned DEFAULT NULL,
  `REGISTERED_ON` datetime DEFAULT NULL,
  `LOCKOUT_COUNTER` tinyint DEFAULT NULL,
  `LOCKOUT_ON` datetime DEFAULT NULL,
  `EXPIRATION_DATE` date DEFAULT NULL,
  `LOGIN_FAILED_ON` datetime DEFAULT NULL,
  `DEFAULT_LOCATION_RESTRICTED` tinyint DEFAULT NULL,
  `DEFAULT_LOCATION_ID` int DEFAULT NULL,
  `DEFAULT_LOCATION_GROUP_RESTRICTED` tinyint DEFAULT NULL,
  `DEFAULT_LOCATION_GROUP_ID` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_USER_NAME` (`NAME`),
  KEY `FK_USER_STATUS` (`STATUS`),
  KEY `FK_USER_TYPE` (`TYPE`),
  KEY `FK_USER_CONTACT_ID` (`CONTACT_ID`),
  KEY `FK_USER_REGISTERED_BY_ID` (`REGISTERED_BY_ID`),
  KEY `FK_USER_ACCESS_LEVEL` (`ACCESS_LEVEL`),
  CONSTRAINT `FK_USER_ACCESS_LEVEL` FOREIGN KEY (`ACCESS_LEVEL`) REFERENCES `access_level_map` (`ID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `FK_USER_CONTACT_ID` FOREIGN KEY (`CONTACT_ID`) REFERENCES `contact` (`ID`),
  CONSTRAINT `FK_USER_REGISTERED_BY_ID` FOREIGN KEY (`REGISTERED_BY_ID`) REFERENCES `user` (`ID`),
  CONSTRAINT `FK_USER_STATUS` FOREIGN KEY (`STATUS`) REFERENCES `user_status_map` (`ID`),
  CONSTRAINT `FK_USER_TYPE` FOREIGN KEY (`TYPE`) REFERENCES `user_type_map` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_logs`
--

DROP TABLE IF EXISTS `user_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_logs` (
  `RECORDED_ON` datetime DEFAULT NULL,
  `DOCUMENT_TYPE` int DEFAULT NULL,
  `OBJECT_TYPE` int DEFAULT NULL,
  `LOG_TYPE` int DEFAULT NULL,
  `ACTIVITY` mediumtext,
  `DOCUMENT_ID` varchar(20) DEFAULT NULL,
  `OBJECT_ID` varchar(20) DEFAULT NULL,
  `USER_ID` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_logs_type_map`
--

DROP TABLE IF EXISTS `user_logs_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_logs_type_map` (
  `ID` int DEFAULT NULL,
  `DESCRIPTION` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_password_history`
--

DROP TABLE IF EXISTS `user_password_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_password_history` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `USER_ID` int unsigned NOT NULL,
  `PASSWORD` varchar(30) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_USER_PASSWORD_HISTORY_USER_ID` (`USER_ID`),
  CONSTRAINT `FK_USER_PASSWORD_HISTORY_USER_ID` FOREIGN KEY (`USER_ID`) REFERENCES `user` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `LINE_NO` int unsigned NOT NULL,
  `USER_ID` int unsigned NOT NULL,
  `LICENSE_KEY` varchar(30) NOT NULL,
  `SYSTEM_NAME` varchar(50) NOT NULL,
  `SYSTEM_VERSION` varchar(20) NOT NULL,
  `COMPUTER_NAME` varchar(20) NOT NULL,
  `IP_ADDRESS` varchar(20) DEFAULT NULL,
  `OS_USER_NAME` varchar(20) DEFAULT NULL,
  `UPDATED_ON` datetime DEFAULT NULL,
  `SQL_CONNECTION_ID` int unsigned DEFAULT NULL,
  `SQL_CLIENT_HOST` varchar(50) NOT NULL,
  `SQL_SERVER_HOST` varchar(50) DEFAULT NULL,
  `ACTIVE` tinyint(1) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_USER_SESSION_USER_ID` (`USER_ID`),
  CONSTRAINT `FK_USER_SESSION_USER_ID` FOREIGN KEY (`USER_ID`) REFERENCES `user` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_status_map`
--

DROP TABLE IF EXISTS `user_status_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_status_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_type_map`
--

DROP TABLE IF EXISTS `user_type_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_type_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vat_method_map`
--

DROP TABLE IF EXISTS `vat_method_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vat_method_map` (
  `ID` tinyint unsigned NOT NULL,
  `DESCRIPTION` varchar(50) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `vendor`
--

DROP TABLE IF EXISTS `vendor`;
/*!50001 DROP VIEW IF EXISTS `vendor`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vendor` AS SELECT 
 1 AS `ID`,
 1 AS `TYPE`,
 1 AS `NAME`,
 1 AS `COMPANY_NAME`,
 1 AS `SALUTATION`,
 1 AS `FIRST_NAME`,
 1 AS `MIDDLE_NAME`,
 1 AS `LAST_NAME`,
 1 AS `PRINT_NAME_AS`,
 1 AS `POSTAL_ADDRESS`,
 1 AS `CONTACT_PERSON`,
 1 AS `TELEPHONE_NO`,
 1 AS `FAX_NO`,
 1 AS `MOBILE_NO`,
 1 AS `ALT_TELEPHONE_NO`,
 1 AS `ALT_CONTACT_PERSON`,
 1 AS `EMAIL`,
 1 AS `ACCOUNT_NO`,
 1 AS `INACTIVE`,
 1 AS `GROUP_ID`,
 1 AS `PAYMENT_TERMS_ID`,
 1 AS `CREDIT_LIMIT`,
 1 AS `PREF_PAYMENT_METHOD_ID`,
 1 AS `CREDIT_CARD_NO`,
 1 AS `CREDIT_CARD_EXPIRY_DATE`,
 1 AS `SALES_REP_ID`,
 1 AS `PRICE_LEVEL_ID`,
 1 AS `APPLY_FINANCE_CHARGE`,
 1 AS `TAXPAYER_ID`,
 1 AS `TAX_ID`,
 1 AS `EW_TAX_ID`,
 1 AS `SSS_NO`,
 1 AS `PAGIBIG_NO`,
 1 AS `PHIC_NO`,
 1 AS `GENDER`,
 1 AS `DATE_OF_BIRTH`,
 1 AS `NICKNAME`,
 1 AS `HIRE_DATE`,
 1 AS `POSITION`,
 1 AS `CUSTOM_FIELD1`,
 1 AS `CUSTOM_FIELD2`,
 1 AS `CUSTOM_FIELD3`,
 1 AS `CUSTOM_FIELD4`,
 1 AS `CUSTOM_FIELD5`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `voucher`
--

DROP TABLE IF EXISTS `voucher`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `voucher` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date DEFAULT NULL,
  `LOCATION_ID` int unsigned DEFAULT NULL,
  `CUSTOMER_ID` int unsigned DEFAULT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `BALANCE` decimal(16,4) DEFAULT NULL,
  `EXPIRATION_DATE` date DEFAULT NULL,
  `INACTIVE` tinyint unsigned DEFAULT '0',
  `REMARKS` varchar(255) DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `APPLY_SURCHARGE` tinyint unsigned NOT NULL DEFAULT '1',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_VOUCHER_CODE` (`CODE`),
  KEY `FK_VOUCHER_CUSTOMER_ID` (`CUSTOMER_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `voucher_surcharge`
--

DROP TABLE IF EXISTS `voucher_surcharge`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `voucher_surcharge` (
  `ID` int unsigned NOT NULL,
  `GROUP_ID` int unsigned NOT NULL,
  `SURCHARGE` decimal(16,4) DEFAULT NULL,
  `RATE_TYPE` int unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_VOUCHER_SURCHARGE_GROUP_ID` (`GROUP_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `voucher_surcharge_group`
--

DROP TABLE IF EXISTS `voucher_surcharge_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `voucher_surcharge_group` (
  `ID` int unsigned NOT NULL,
  `NAME` varchar(100) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `IX_VOUCHER_SURCHARGE_GROUP_NAME` (`NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `voucher_surcharge_group_items`
--

DROP TABLE IF EXISTS `voucher_surcharge_group_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `voucher_surcharge_group_items` (
  `ID` int unsigned NOT NULL,
  `GROUP_ID` int unsigned NOT NULL,
  `ITEM_ID` int unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_VOUCHER_SURCHARGE_GROUP_ITEMS_ITEM_ID` (`ITEM_ID`),
  KEY `FK_VOUCHER_SURCHARGE_GROUP_ITEM_ID` (`ITEM_ID`),
  KEY `FK_VOUCHER_SURCHARGE_GROUP_ITEMS_GROUP_ID` (`GROUP_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `withholding_tax`
--

DROP TABLE IF EXISTS `withholding_tax`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `withholding_tax` (
  `ID` int unsigned NOT NULL,
  `RECORDED_ON` datetime NOT NULL,
  `CODE` varchar(50) NOT NULL,
  `DATE` date NOT NULL,
  `WITHHELD_FROM_ID` int unsigned NOT NULL,
  `EWT_ID` int unsigned DEFAULT NULL,
  `EWT_RATE` decimal(6,2) DEFAULT NULL,
  `EWT_ACCOUNT_ID` int unsigned DEFAULT NULL,
  `LOCATION_ID` int unsigned NOT NULL,
  `AMOUNT` decimal(16,4) NOT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `STATUS` tinyint unsigned NOT NULL,
  `STATUS_DATE` datetime DEFAULT NULL,
  `ACCOUNTS_PAYABLE_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `IX_WITHHOLDING_TAX_CODE` (`CODE`),
  KEY `FK_WITHHOLDING_TAX_LOCATION_ID` (`LOCATION_ID`) USING BTREE,
  KEY `FK_WITHHOLDING_TAX_WITHHELD_FROM_ID` (`WITHHELD_FROM_ID`) USING BTREE,
  KEY `FK_WITHHOLDING_TAX_EWT_ID` (`EWT_ID`),
  KEY `FK_WITHHOLDING_TAX_EWT_ACCOUNT_ID` (`EWT_ACCOUNT_ID`),
  KEY `FK_WITHHOLDING_TAX_ACCOUNTS_PAYABLE_ID` (`ACCOUNTS_PAYABLE_ID`),
  CONSTRAINT `FK_WITHHOLDING_TAX_ACCOUNTS_PAYABLE_ID` FOREIGN KEY (`ACCOUNTS_PAYABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_WITHHOLDING_TAX_EWT_ACCOUNT_ID` FOREIGN KEY (`EWT_ACCOUNT_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_WITHHOLDING_TAX_EWT_ID` FOREIGN KEY (`EWT_ID`) REFERENCES `tax` (`ID`),
  CONSTRAINT `FK_WITHHOLDING_TAX_LOCATION_ID` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`),
  CONSTRAINT `FK_WITHHOLDING_TAX_WITHHELD_FROM_ID` FOREIGN KEY (`WITHHELD_FROM_ID`) REFERENCES `contact` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `withholding_tax_bills`
--

DROP TABLE IF EXISTS `withholding_tax_bills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `withholding_tax_bills` (
  `ID` int unsigned NOT NULL,
  `WITHHOLDING_TAX_ID` int unsigned NOT NULL,
  `BILL_ID` int unsigned NOT NULL,
  `AMOUNT_WITHHELD` decimal(16,4) NOT NULL,
  `ACCOUNTS_PAYABLE_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_WITHHOLDING_TAX_BILLS_WITHHOLDING_TAX_ID` (`WITHHOLDING_TAX_ID`) USING BTREE,
  KEY `FK_WITHHOLDING_TAX_BILLS_BILL_ID` (`BILL_ID`) USING BTREE,
  KEY `FK_WITHHOLDING_TAX_BILLS_WITHHOLDING_ACCOUNTS_PAYABLE_ID` (`ACCOUNTS_PAYABLE_ID`),
  CONSTRAINT `FK_WITHHOLDING_TAX_BILLS_BILL_ID` FOREIGN KEY (`BILL_ID`) REFERENCES `bill` (`ID`),
  CONSTRAINT `FK_WITHHOLDING_TAX_BILLS_WITHHOLDING_ACCOUNTS_PAYABLE_ID` FOREIGN KEY (`ACCOUNTS_PAYABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_WITHHOLDING_TAX_BILLS_WITHHOLDING_TAX_ID` FOREIGN KEY (`WITHHOLDING_TAX_ID`) REFERENCES `withholding_tax` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `withholding_tax_other_details`
--

DROP TABLE IF EXISTS `withholding_tax_other_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `withholding_tax_other_details` (
  `ID` int unsigned NOT NULL,
  `WITHHOLDING_TAX_ID` int unsigned NOT NULL,
  `OBJECT_TYPE` int unsigned NOT NULL,
  `OBJECT_ID` int unsigned NOT NULL,
  `AMOUNT_WITHHELD` decimal(16,4) DEFAULT NULL,
  `ACCOUNTS_PAYABLE_ID` int unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_WITHHOLDING_TAX_OTHER_DETAILS_ACCOUNTS_PAYABLE_ID` (`ACCOUNTS_PAYABLE_ID`),
  KEY `FK_WITHHOLDING_TAX_OTHER_DETAILS_WIHHOLDING_TAX_ID` (`WITHHOLDING_TAX_ID`),
  CONSTRAINT `FK_WITHHOLDING_TAX_OTHER_DETAILS_ACCOUNTS_PAYABLE_ID` FOREIGN KEY (`ACCOUNTS_PAYABLE_ID`) REFERENCES `account` (`ID`),
  CONSTRAINT `FK_WITHHOLDING_TAX_OTHER_DETAILS_WIHHOLDING_TAX_ID` FOREIGN KEY (`WITHHOLDING_TAX_ID`) REFERENCES `withholding_tax` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping events for database 'activeone_research'
--

--
-- Dumping routines for database 'activeone_research'
--
/*!50003 DROP FUNCTION IF EXISTS `GetPriceLevelRate` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`%` FUNCTION `GetPriceLevelRate`(_PRICE_LEVEL_ID int, _ITEM_ID int, _ITEM_GROUP int, _PL_ITEM_UNIT_ID int, _ITEM_RATE decimal(16, 4)) RETURNS decimal(16,4)
begin
    declare PL_RATE decimal(16, 4);

    select
      if(max(PL2) is not null, max(PL2),
        if(max(PL3) is not null, max(PL3),
          if(max(PL4) is not null, max(PL4),
            max(PL1)))) into PL_RATE
    from
      (
        select
          round(_ITEM_RATE + (_ITEM_RATE * PRICE_LEVEL_SUBQRY.RATE/100), 2) PL1,
          null PL2,
          null PL3,
          null PL4
        from
          PRICE_LEVEL PRICE_LEVEL_SUBQRY
        where
          PRICE_LEVEL_SUBQRY.ID=_PRICE_LEVEL_ID
          and PRICE_LEVEL_SUBQRY.ITEM_GROUP_ID is null
          and PRICE_LEVEL_SUBQRY.INACTIVE=0

        union all

        select
          null PL1,
          coalesce(PRICE_LEVEL_LINES_ADJUSTMENT.AMOUNT, PL_LINES_SUBQRY.CUSTOM_PRICE) PL2,
          null PL3,
          null PL4
        from
          PRICE_LEVEL_LINES PL_LINES_SUBQRY
        left join
          (
            select
              ITEM_RATES.ID,
              PREVIOUS_ITEM_RATES.ID PREVIOUS_ID,
              ITEM_RATES.OBJECT_ID,
              PREVIOUS_ITEM_RATES.ADJUSTMENT PREV_ADJ,
              PREVIOUS_ITEM_RATES.AMOUNT PREV_AMOUNT,
              if(ITEM_RATES.POSTED=0, null, ITEM_RATES.ADJUSTMENT_TYPE) ADJ_TYPE,
              if(ITEM_RATES.POSTED=0, null, ITEM_RATES.ADJUSTMENT) ADJ,
              if(ITEM_RATES.POSTED=0, null,
                if(ITEM_RATES.END_DATE is null or ITEM_RATES.END_DATE > now(),
                  ITEM_RATES.AMOUNT, (ITEM_RATES.AMOUNT - ITEM_RATES.ADJUSTMENT_AMOUNT))) AMOUNT,
              ITEM_RATES.POSTED
            from
              (
                select
                  ITEM_RATES.ID,
                  max(ITEM_RATES.RECORDED_ON) RECORDED_ON,
                  ITEM_RATES.OBJECT_ID
                from
                  ITEM_RATES
                inner join
                  PRICE_LEVEL_LINES
                  on PRICE_LEVEL_LINES.ID=ITEM_RATES.OBJECT_ID
                where
                  ITEM_RATES.OBJECT_TYPE=47
                  and ITEM_RATES.POSTED=1
                  and PRICE_LEVEL_LINES.PRICE_LEVEL_ID=_PRICE_LEVEL_ID
                  and PRICE_LEVEL_LINES.ITEM_ID=_ITEM_ID
                  and ITEM_RATES.START_DATE <= now()
                  and (ITEM_RATES.END_DATE is null or ITEM_RATES.END_DATE > now())
                group by
                  ITEM_RATES.OBJECT_ID 
              )MAX_ITEM_RATES
            left join
              ITEM_RATES
              on ITEM_RATES.OBJECT_ID=MAX_ITEM_RATES.OBJECT_ID
                and ITEM_RATES.RECORDED_ON=MAX_ITEM_RATES.RECORDED_ON
                and ITEM_RATES.OBJECT_TYPE=47
                and ITEM_RATES.POSTED=1
            left join
              ITEM_RATES PREVIOUS_ITEM_RATES
              on PREVIOUS_ITEM_RATES.ID=ITEM_RATES.PREVIOUS_ID
          )PRICE_LEVEL_LINES_ADJUSTMENT
           on PRICE_LEVEL_LINES_ADJUSTMENT.OBJECT_ID=PL_LINES_SUBQRY.ID
          where
            PL_LINES_SUBQRY.PRICE_LEVEL_ID = _PRICE_LEVEL_ID 
            and PL_LINES_SUBQRY.ITEM_ID=_ITEM_ID

        union all

        select
          null PL1,
          null PL2,
          coalesce(ITEM_UNIT_PRICE_LEVELS_ADJUSTMENT.AMOUNT, PL_ITEM_UNIT_SUBQRY.CUSTOM_PRICE) PL3,
          null PL4
        from
          ITEM_UNIT_PRICE_LEVELS PL_ITEM_UNIT_SUBQRY
        inner join
          (
            select
              ITEM_RATES.ID,
              PREVIOUS_ITEM_RATES.ID PREVIOUS_ID,
              ITEM_RATES.OBJECT_ID,
              PREVIOUS_ITEM_RATES.ADJUSTMENT PREV_ADJ,
              PREVIOUS_ITEM_RATES.AMOUNT PREV_AMOUNT,
              if(ITEM_RATES.POSTED=0, null, ITEM_RATES.ADJUSTMENT_TYPE) ADJ_TYPE,
              if(ITEM_RATES.POSTED=0, null, ITEM_RATES.ADJUSTMENT) ADJ,
              if(ITEM_RATES.POSTED=0, null,
                if(ITEM_RATES.END_DATE is null or ITEM_RATES.END_DATE > now(),
                  ITEM_RATES.AMOUNT, (ITEM_RATES.AMOUNT - ITEM_RATES.ADJUSTMENT_AMOUNT))) AMOUNT,
              ITEM_RATES.POSTED
            from
              (
                select
                  ITEM_RATES.ID,
                  max(ITEM_RATES.RECORDED_ON) RECORDED_ON,
                  ITEM_RATES.OBJECT_ID
                from
                  ITEM_RATES
                inner join
                  ITEM_UNIT_PRICE_LEVELS
                  on ITEM_UNIT_PRICE_LEVELS.ID=ITEM_RATES.OBJECT_ID
                where
                  ITEM_RATES.OBJECT_TYPE=87
                  and ITEM_RATES.POSTED=1
                  and ITEM_UNIT_PRICE_LEVELS.ITEM_UNIT_LINE_ID=_PL_ITEM_UNIT_ID
                  and ITEM_UNIT_PRICE_LEVELS.PRICE_LEVEL_ID=_PRICE_LEVEL_ID
                  and ITEM_RATES.START_DATE <= now()
                  and (ITEM_RATES.END_DATE is null or ITEM_RATES.END_DATE > now())
                group by
                  ITEM_RATES.OBJECT_ID
              ) MAX_ITEM_RATES
            left join
              ITEM_RATES
              on ITEM_RATES.OBJECT_ID=MAX_ITEM_RATES.OBJECT_ID
                and ITEM_RATES.RECORDED_ON=MAX_ITEM_RATES.RECORDED_ON
                and ITEM_RATES.OBJECT_TYPE=87
                and ITEM_RATES.POSTED=1
            left join
              ITEM_RATES PREVIOUS_ITEM_RATES
              on PREVIOUS_ITEM_RATES.ID=ITEM_RATES.PREVIOUS_ID
          ) ITEM_UNIT_PRICE_LEVELS_ADJUSTMENT
            on ITEM_UNIT_PRICE_LEVELS_ADJUSTMENT.OBJECT_ID=PL_ITEM_UNIT_SUBQRY.ID

        union all

        select
          null PL1,
          null PL2,
          null PL3,
          round(_ITEM_RATE + (_ITEM_RATE * PL_ITEM_GROUP_SUBQRY.RATE/100), 2) PL4
        from
          PRICE_LEVEL PL_ITEM_GROUP_SUBQRY
        where
          PL_ITEM_GROUP_SUBQRY.ID=_PRICE_LEVEL_ID
          and PL_ITEM_GROUP_SUBQRY.ITEM_GROUP_ID=_ITEM_GROUP
          and PL_ITEM_GROUP_SUBQRY.INACTIVE=0
      ) SUB_QRY;

    return PL_RATE;
  end ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `CalculatePoints` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`%` PROCEDURE `CalculatePoints`()
BEGIN
  DECLARE cursor_Customer INT;
  DECLARE cursor_DocType INT;
  DECLARE cursor_DocId INT;
  DECLARE cursor_DocDate DATE;
  DECLARE cursor_Amount Decimal(16,4);
  DECLARE cursor_Gained Decimal(16,4);
  DECLARE cursor_Redeem Decimal(16,4);

  DECLARE done INT DEFAULT FALSE;
  DECLARE Exception INT DEFAULT FALSE;
  DECLARE hasErrors BOOLEAN DEFAULT FALSE;
  DECLARE cursor_i CURSOR FOR
    SELECT 
	  CUSTOMER_ID, 
	  DOCUMENT_TYPE, 
	  DOCUMENT_ID, 
	  DOCUMENT_DATE, 
	  AMOUNT,
	  GAINED_POINTS, 
	  REDEEMED_POINTS 
	FROM 
	  `CUSTOMER_TRANSACTION_DETAIL_VIEW` 
	order by 
	  RECORDED_ON;
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  SET @IS_CALC = (select VALUE from SYSTEM_SETTINGS where NAME like '%PointsCalculating%');

  if @IS_CALC=0 then
    update SYSTEM_SETTINGS set VALUE=1 where NAME like '%PointsCalculating%';

    OPEN cursor_i;
    read_loop: LOOP
      FETCH cursor_i INTO cursor_Customer, cursor_DocType, cursor_DocId, cursor_DocDate, cursor_Amount, cursor_Gained, cursor_Redeem;
      IF done THEN
        LEAVE read_loop;
      END IF;
	 
      SET @PREV_ID = (SELECT MAX(ID) FROM `LOYALTY_POINTS` WHERE CUSTOMER_ID =cursor_Customer);
      SET @PREV_POINTS = IFNULL((SELECT coalesce(TOTAL_POINTS,0) FROM `LOYALTY_POINTS` WHERE ID=@PREV_ID),0);
      SET @TOTAL_POINTS = (@PREV_POINTS+cursor_Gained)-cursor_Redeem;

      INSERT INTO LOYALTY_POINTS(PREVIOUS_ID, CUSTOMER_ID, SOURCE_REF_TYPE, SOURCE_REF_ID, SOURCE_REF_DATE, GAINED_AMOUNT, GAINED_POINTS, REDEEMED_POINTS, TOTAL_POINTS)
        VALUES(@PREV_ID, cursor_Customer, cursor_DocType, cursor_DocId, cursor_DocDate, cursor_Amount, cursor_Gained, cursor_Redeem, @TOTAL_POINTS);

      if cursor_DocType = 10 then
        insert into LOYALTY_POINTS_DOCUMENTS(DOCUMENT_TYPE,DOCUMENT_ID) VALUES(10,cursor_DocId);
      else
        insert into LOYALTY_POINTS_DOCUMENTS(DOCUMENT_TYPE,DOCUMENT_ID) VALUES(13,cursor_DocId);
      end if;

    END LOOP;
    CLOSE cursor_i;
	
    update SYSTEM_SETTINGS set VALUE=0 where NAME like '%PointsCalculating%';
  end if;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `PostPriceAdjustment` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`%` PROCEDURE `PostPriceAdjustment`()
BEGIN
  DECLARE done INT DEFAULT FALSE;

  DECLARE cursor_id INT;
  DECLARE cursor_recorded_on DATETIME;
  DECLARE cursor_object_type INT;
  DECLARE cursor_object_id INT;
  DECLARE cursor_adjustment_amount DECIMAL(16,4);
  DECLARE cursor_amount DECIMAL(16,4);
  DECLARE cursor_start_date DATETIME;
  DECLARE cursor_end_date DATETIME;
  DECLARE cursor_posted INT;
  DECLARE cursor_posted_to_profile INT;
  DECLARE cursor_restored INT;
  DECLARE cursor_posted_on DATETIME;
  DECLARE SchedulerRunning varchar(20);

  DECLARE cursor_i CURSOR FOR
	
	select
		ID,
    RECORDED_ON,
    OBJECT_TYPE,
    OBJECT_ID,
    ADJUSTMENT_AMOUNT,
    AMOUNT,
    START_DATE,
    END_DATE,
    POSTED,
    POSTED_TO_PROFILE,
    RESTORED,
    POSTED_ON
  from
    ITEM_RATES
  where
    POSTED_TO_PROFILE=0

  union all
		
  select
    ID,
    RECORDED_ON,
    OBJECT_TYPE,
    OBJECT_ID,
    ADJUSTMENT_AMOUNT,
    AMOUNT,
    START_DATE,
    END_DATE,
    POSTED,
    POSTED_TO_PROFILE,
    RESTORED,
    POSTED_ON
  from
    ITEM_RATES
  where
    POSTED=1
    and POSTED_TO_PROFILE=1
    and END_DATE is not null
    and (RESTORED=0 or RESTORED IS NULL)
  order by
    START_DATE,
    RECORDED_ON,
    ID;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
  BEGIN
    update SYSTEM_SETTINGS set `VALUE`='False' where NAME='PostPriceAdjustmentRunning';
  END;

  set SchedulerRunning = (select `VALUE` from SYSTEM_SETTINGS where NAME='PostPriceAdjustmentRunning');

  if (SchedulerRunning = 'False') then
    update SYSTEM_SETTINGS set `VALUE`='True' where NAME='PostPriceAdjustmentRunning';

    OPEN cursor_i;
    read_loop: LOOP
      FETCH cursor_i INTO cursor_id, cursor_recorded_on, cursor_object_type, cursor_object_id, cursor_adjustment_amount, cursor_amount, cursor_start_date, cursor_end_date, cursor_posted, cursor_posted_to_profile, cursor_restored, cursor_posted_on;

      IF done THEN
        LEAVE read_loop;
      END IF;

      set @A1Version = (select LEFT(VALUE, 1) from SYSTEM_SETTINGS where NAME='SYSTEM_VERSION');

      if (@A1Version <> 4) then
        if (cursor_posted_to_profile<>1) and (((time(cursor_start_date) = '00:00:00') and (date(cursor_start_date) = date(now())))
          or (cursor_start_date <= now())) then

          if cursor_object_type = 26 then
            update ITEM set RATE=cursor_amount where ID=cursor_object_id;
          elseif cursor_object_type = 86 then
            update ITEM_UNITS set RATE=cursor_amount where ID=cursor_object_id;
          elseif cursor_object_type = 47 then
            update PRICE_LEVEL_LINES set CUSTOM_PRICE=cursor_amount where ID=cursor_object_id;
          elseif cursor_object_type = 87 then
            update ITEM_UNIT_PRICE_LEVELS set CUSTOM_PRICE=cursor_amount where ID=cursor_object_id;
          end if;

          update ITEM_RATES set POSTED_TO_PROFILE=1 where POSTED_TO_PROFILE=0 and ID=cursor_id;
        end if;

        if (cursor_posted_to_profile=1 and (cursor_restored is null or cursor_restored=1)) and ( ((time(cursor_end_date) = '00:00:00') and (date(cursor_end_date) = date(now())))
          or (cursor_end_date <= now()) ) then

          if cursor_object_type = 26 then
            update ITEM set RATE=(cursor_amount - cursor_adjustment_amount) where ID=cursor_object_id;
          elseif cursor_object_type = 86 then
            update ITEM_UNITS set RATE=(cursor_amount - cursor_adjustment_amount) where ID=cursor_object_id;
          elseif cursor_object_type = 47 then
            update PRICE_LEVEL_LINES set CUSTOM_PRICE=(cursor_amount - cursor_adjustment_amount) where ID=cursor_object_id;
          elseif cursor_object_type = 87 then
            update ITEM_UNIT_PRICE_LEVELS set CUSTOM_PRICE=(cursor_amount - cursor_adjustment_amount) where ID=cursor_object_id;
          end if;

          update ITEM_RATES set RESTORED=1 where POSTED=1 and POSTED_TO_PROFILE=1 and ID=cursor_id;
        end if;

      end if;
    END LOOP;

    CLOSE cursor_i;

    update SYSTEM_SETTINGS set `VALUE`='False' where NAME='PostPriceAdjustmentRunning';
  end if;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Final view structure for view `customer_transaction_detail_view`
--

/*!50001 DROP VIEW IF EXISTS `customer_transaction_detail_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `customer_transaction_detail_view` AS select `loyalty_points`.`RECORDED_ON` AS `RECORDED_ON`,`loyalty_points`.`CUSTOMER_ID` AS `CUSTOMER_ID`,`loyalty_points`.`DOCUMENT_TYPE` AS `DOCUMENT_TYPE`,`loyalty_points`.`DOCUMENT_ID` AS `DOCUMENT_ID`,`loyalty_points`.`DOCUMENT_DATE` AS `DOCUMENT_DATE`,sum(`loyalty_points`.`AMOUNT`) AS `AMOUNT`,sum(`loyalty_points`.`GAINED_POINTS`) AS `GAINED_POINTS`,sum(coalesce(`loyalty_points`.`REDEEMED_POINTS`,0)) AS `REDEEMED_POINTS`,(`loyalty_points`.`GAINED_POINTS` + coalesce(`loyalty_points`.`REDEEMED_POINTS`,0)) AS `TOTAL_POINTS`,`loyalty_points`.`POINTS_CALCULATED` AS `POINTS_CALCULATED` from (select `sales_receipt`.`RECORDED_ON` AS `RECORDED_ON`,`sales_receipt`.`CUSTOMER_ID` AS `CUSTOMER_ID`,13 AS `DOCUMENT_TYPE`,`sales_receipt`.`ID` AS `DOCUMENT_ID`,`sales_receipt`.`DATE` AS `DOCUMENT_DATE`,sum(`sales_receipt_items`.`AMOUNT`) AS `AMOUNT`,(sum(`sales_receipt_items`.`AMOUNT`) / coalesce(`lpi_item_point_value`.`POINT_VALUE`,`settings_point_value`.`VALUE`)) AS `GAINED_POINTS`,`dummy`.`DUMMY_DEC` AS `REDEEMED_POINTS`,`sales_receipt`.`POINTS_CALCULATED` AS `POINTS_CALCULATED` from (((((((((`sales_receipt_items` join `sales_receipt` on((`sales_receipt`.`ID` = `sales_receipt_items`.`SALES_RECEIPT_ID`))) join `contact` `customer` on((`customer`.`ID` = `sales_receipt`.`CUSTOMER_ID`))) left join `item` on((`item`.`ID` = `sales_receipt_items`.`ITEM_ID`))) left join `item_type_map` on((`item_type_map`.`ID` = `item`.`TYPE`))) left join `loyalty_points_documents` on((`loyalty_points_documents`.`DOCUMENT_ID` = `sales_receipt`.`ID`))) left join `lpi_item_point_value` on((`lpi_item_point_value`.`ITEM_ID` = `item`.`ID`))) left join `dummy` on((`dummy`.`ID` = 0))) left join `system_settings` `settings_loyalty_points` on((`settings_loyalty_points`.`NAME` = 'LoyaltyPointsGroup'))) left join `system_settings` `settings_point_value` on((`settings_point_value`.`NAME` = 'PointValue'))) where ((((`item`.`TYPE` <> 5) and (`item`.`TYPE` <> 6) and (`item`.`TYPE` <> 8)) or (`sales_receipt_items`.`ITEM_ID` is null)) and (`sales_receipt_items`.`AMOUNT` is not null) and (`sales_receipt`.`STATUS` = 3) and ((`sales_receipt_items`.`POS_TRX_TYPE` is null) or (`sales_receipt_items`.`POS_TRX_TYPE` not in (8,7,9,10))) and (`loyalty_points_documents`.`ID` is null) and (`item`.`CUSTOM_FIELD4` = '1') and (0 <> if((coalesce(`settings_loyalty_points`.`VALUE`,0) = 0),true,(`settings_loyalty_points`.`VALUE` = `customer`.`GROUP_ID`)))) group by `sales_receipt`.`ID`,`sales_receipt_items`.`ITEM_ID` union all select `sales_receipt`.`RECORDED_ON` AS `RECORDED_ON`,`sales_receipt`.`CUSTOMER_ID` AS `CUSTOMER_ID`,13 AS `13`,`sales_receipt`.`ID` AS `DOCUMENT_ID`,`sales_receipt`.`DATE` AS `DOCUMENT_DATE`,`dummy`.`DUMMY_DEC` AS `AMOUNT`,`dummy`.`DUMMY_DEC` AS `TOTAL_POINTS`,(sum(`sales_receipt_items`.`AMOUNT`) * -(1)) AS `REDEEMED_POINTS`,`sales_receipt`.`POINTS_CALCULATED` AS `POINTS_CALCULATED` from ((((((((((`sales_receipt_items` join `sales_receipt` on((`sales_receipt`.`ID` = `sales_receipt_items`.`SALES_RECEIPT_ID`))) join `contact` `customer` on((`customer`.`ID` = `sales_receipt`.`CUSTOMER_ID`))) left join `contact_group` `customer_group` on((`customer_group`.`ID` = `customer`.`GROUP_ID`))) left join `item` on((`item`.`ID` = `sales_receipt_items`.`ITEM_ID`))) left join `item_type_map` on((`item_type_map`.`ID` = `item`.`TYPE`))) left join `loyalty_points_documents` on((`loyalty_points_documents`.`DOCUMENT_ID` = `sales_receipt`.`ID`))) left join `lpi_item_point_value` on((`lpi_item_point_value`.`ITEM_ID` = `item`.`ID`))) left join `dummy` on((`dummy`.`ID` = 0))) left join `system_settings` `settings_loyalty_points` on((`settings_loyalty_points`.`NAME` = 'LoyaltyPointsGroup'))) left join `system_settings` `settings_point_value` on((`settings_point_value`.`NAME` = 'PointValue'))) where ((((`item`.`TYPE` <> 5) and (`item`.`TYPE` <> 6) and (`item`.`TYPE` <> 8)) or (`sales_receipt_items`.`ITEM_ID` is null)) and (`sales_receipt_items`.`AMOUNT` is not null) and (`sales_receipt`.`STATUS` = 3) and ((`sales_receipt_items`.`POS_TRX_TYPE` is null) or (`sales_receipt_items`.`POS_TRX_TYPE` not in (8,7,9,10))) and (`item`.`CODE` = 'LPR') and (`loyalty_points_documents`.`ID` is null) and (0 <> if((coalesce(`settings_loyalty_points`.`VALUE`,0) = 0),true,(`settings_loyalty_points`.`VALUE` = `customer`.`GROUP_ID`)))) group by `sales_receipt`.`ID`,`sales_receipt_items`.`ITEM_ID` union all select `sales_receipt`.`RECORDED_ON` AS `RECORDED_ON`,`sales_receipt`.`CUSTOMER_ID` AS `CUSTOMER_ID`,13 AS `DOCUMENT_TYPE`,`sales_receipt`.`ID` AS `DOCUMENT_ID`,`sales_receipt`.`DATE` AS `DOCUMENT_DATE`,(sum(`sales_receipt_items`.`AMOUNT`) * -(1)) AS `AMOUNT`,((sum(`sales_receipt_items`.`AMOUNT`) / coalesce(`lpi_item_point_value`.`POINT_VALUE`,`settings_point_value`.`VALUE`)) * -(1)) AS `GAINED_POINTS`,`dummy`.`DUMMY_DEC` AS `REDEEMED_POINTS`,`sales_receipt`.`POINTS_CALCULATED` AS `POINTS_CALCULATED` from (((((((((`sales_receipt_items` join `sales_receipt` on((`sales_receipt`.`ID` = `sales_receipt_items`.`SALES_RECEIPT_ID`))) join `contact` `customer` on((`customer`.`ID` = `sales_receipt`.`CUSTOMER_ID`))) left join `item` on((`item`.`ID` = `sales_receipt_items`.`ITEM_ID`))) left join `item_type_map` on((`item_type_map`.`ID` = `item`.`TYPE`))) left join `loyalty_points_documents` on((`loyalty_points_documents`.`DOCUMENT_ID` = `sales_receipt`.`ID`))) left join `lpi_item_point_value` on((`lpi_item_point_value`.`ITEM_ID` = `item`.`ID`))) left join `dummy` on((`dummy`.`ID` = 0))) left join `system_settings` `settings_loyalty_points` on((`settings_loyalty_points`.`NAME` = 'LoyaltyPointsGroup'))) left join `system_settings` `settings_point_value` on((`settings_point_value`.`NAME` = 'PointValue'))) where ((((`item`.`TYPE` <> 5) and (`item`.`TYPE` <> 6) and (`item`.`TYPE` <> 8)) or (`sales_receipt_items`.`ITEM_ID` is null)) and (`sales_receipt`.`STATUS` = 7) and (`sales_receipt_items`.`AMOUNT` is not null) and (`sales_receipt`.`STATUS` = 3) and ((`sales_receipt_items`.`POS_TRX_TYPE` is null) or (`sales_receipt_items`.`POS_TRX_TYPE` not in (8,7,9,10))) and (`loyalty_points_documents`.`ID` is null) and (`item`.`CUSTOM_FIELD4` = '1') and (0 <> if((coalesce(`settings_loyalty_points`.`VALUE`,0) = 0),true,(`settings_loyalty_points`.`VALUE` = `customer`.`GROUP_ID`)))) group by `sales_receipt`.`ID`,`sales_receipt_items`.`ITEM_ID` union all select `sales_receipt`.`RECORDED_ON` AS `RECORDED_ON`,`sales_receipt`.`CUSTOMER_ID` AS `CUSTOMER_ID`,13 AS `13`,`sales_receipt`.`ID` AS `DOCUMENT_ID`,`sales_receipt`.`DATE` AS `DOCUMENT_DATE`,`dummy`.`DUMMY_DEC` AS `AMOUNT`,`dummy`.`DUMMY_DEC` AS `TOTAL_POINTS`,sum(`sales_receipt_items`.`AMOUNT`) AS `REDEEMED_POINTS`,`sales_receipt`.`POINTS_CALCULATED` AS `POINTS_CALCULATED` from ((((((((((`sales_receipt_items` join `sales_receipt` on((`sales_receipt`.`ID` = `sales_receipt_items`.`SALES_RECEIPT_ID`))) join `contact` `customer` on((`customer`.`ID` = `sales_receipt`.`CUSTOMER_ID`))) left join `contact_group` `customer_group` on((`customer_group`.`ID` = `customer`.`GROUP_ID`))) left join `item` on((`item`.`ID` = `sales_receipt_items`.`ITEM_ID`))) left join `item_type_map` on((`item_type_map`.`ID` = `item`.`TYPE`))) left join `loyalty_points_documents` on((`loyalty_points_documents`.`DOCUMENT_ID` = `sales_receipt`.`ID`))) left join `lpi_item_point_value` on((`lpi_item_point_value`.`ITEM_ID` = `item`.`ID`))) left join `dummy` on((`dummy`.`ID` = 0))) left join `system_settings` `settings_loyalty_points` on((`settings_loyalty_points`.`NAME` = 'LoyaltyPointsGroup'))) left join `system_settings` `settings_point_value` on((`settings_point_value`.`NAME` = 'PointValue'))) where ((((`item`.`TYPE` <> 5) and (`item`.`TYPE` <> 6) and (`item`.`TYPE` <> 8)) or (`sales_receipt_items`.`ITEM_ID` is null)) and (`sales_receipt`.`STATUS` = 7) and (`sales_receipt_items`.`AMOUNT` is not null) and (`sales_receipt`.`STATUS` = 3) and ((`sales_receipt_items`.`POS_TRX_TYPE` is null) or (`sales_receipt_items`.`POS_TRX_TYPE` not in (8,7,9,10))) and (`item`.`CODE` = 'LPR') and (`loyalty_points_documents`.`ID` is null) and (0 <> if((coalesce(`settings_loyalty_points`.`VALUE`,0) = 0),true,(`settings_loyalty_points`.`VALUE` = `customer`.`GROUP_ID`)))) group by `sales_receipt`.`ID`,`sales_receipt_items`.`ITEM_ID`) `loyalty_points` group by `loyalty_points`.`CUSTOMER_ID`,`loyalty_points`.`DOCUMENT_ID` order by `loyalty_points`.`RECORDED_ON` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vendor`
--

/*!50001 DROP VIEW IF EXISTS `vendor`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`superuser`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `vendor` AS select `contact`.`ID` AS `ID`,`contact`.`TYPE` AS `TYPE`,`contact`.`NAME` AS `NAME`,`contact`.`COMPANY_NAME` AS `COMPANY_NAME`,`contact`.`SALUTATION` AS `SALUTATION`,`contact`.`FIRST_NAME` AS `FIRST_NAME`,`contact`.`MIDDLE_NAME` AS `MIDDLE_NAME`,`contact`.`LAST_NAME` AS `LAST_NAME`,`contact`.`PRINT_NAME_AS` AS `PRINT_NAME_AS`,`contact`.`POSTAL_ADDRESS` AS `POSTAL_ADDRESS`,`contact`.`CONTACT_PERSON` AS `CONTACT_PERSON`,`contact`.`TELEPHONE_NO` AS `TELEPHONE_NO`,`contact`.`FAX_NO` AS `FAX_NO`,`contact`.`MOBILE_NO` AS `MOBILE_NO`,`contact`.`ALT_TELEPHONE_NO` AS `ALT_TELEPHONE_NO`,`contact`.`ALT_CONTACT_PERSON` AS `ALT_CONTACT_PERSON`,`contact`.`EMAIL` AS `EMAIL`,`contact`.`ACCOUNT_NO` AS `ACCOUNT_NO`,`contact`.`INACTIVE` AS `INACTIVE`,`contact`.`GROUP_ID` AS `GROUP_ID`,`contact`.`PAYMENT_TERMS_ID` AS `PAYMENT_TERMS_ID`,`contact`.`CREDIT_LIMIT` AS `CREDIT_LIMIT`,`contact`.`PREF_PAYMENT_METHOD_ID` AS `PREF_PAYMENT_METHOD_ID`,`contact`.`CREDIT_CARD_NO` AS `CREDIT_CARD_NO`,`contact`.`CREDIT_CARD_EXPIRY_DATE` AS `CREDIT_CARD_EXPIRY_DATE`,`contact`.`SALES_REP_ID` AS `SALES_REP_ID`,`contact`.`PRICE_LEVEL_ID` AS `PRICE_LEVEL_ID`,`contact`.`APPLY_FINANCE_CHARGE` AS `APPLY_FINANCE_CHARGE`,`contact`.`TAXPAYER_ID` AS `TAXPAYER_ID`,`contact`.`TAX_ID` AS `TAX_ID`,`contact`.`EW_TAX_ID` AS `EW_TAX_ID`,`contact`.`SSS_NO` AS `SSS_NO`,`contact`.`PAGIBIG_NO` AS `PAGIBIG_NO`,`contact`.`PHIC_NO` AS `PHIC_NO`,`contact`.`GENDER` AS `GENDER`,`contact`.`DATE_OF_BIRTH` AS `DATE_OF_BIRTH`,`contact`.`NICKNAME` AS `NICKNAME`,`contact`.`HIRE_DATE` AS `HIRE_DATE`,`contact`.`POSITION` AS `POSITION`,`contact`.`CUSTOM_FIELD1` AS `CUSTOM_FIELD1`,`contact`.`CUSTOM_FIELD2` AS `CUSTOM_FIELD2`,`contact`.`CUSTOM_FIELD3` AS `CUSTOM_FIELD3`,`contact`.`CUSTOM_FIELD4` AS `CUSTOM_FIELD4`,`contact`.`CUSTOM_FIELD5` AS `CUSTOM_FIELD5` from `contact` where (`contact`.`TYPE` = 0) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-18 18:26:30

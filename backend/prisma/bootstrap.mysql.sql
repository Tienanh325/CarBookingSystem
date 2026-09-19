-- Local development bootstrap for MySQL 8.0+.
-- Run this file once with an administrative account (for example in MySQL Workbench).

CREATE DATABASE IF NOT EXISTS `ride_booking`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'ride_booking'@'localhost'
  IDENTIFIED BY 'ride_booking';

ALTER USER 'ride_booking'@'localhost'
  IDENTIFIED BY 'ride_booking';

GRANT ALL PRIVILEGES ON `ride_booking`.*
  TO 'ride_booking'@'localhost';

FLUSH PRIVILEGES;

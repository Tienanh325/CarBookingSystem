ALTER TABLE `rides`
  ADD COLUMN `actual_distance_km` DECIMAL(10,2) NULL,
  ADD COLUMN `actual_duration_min` INTEGER NULL,
  ADD COLUMN `waiting_minutes` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `waiting_fee` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `cancellation_fee` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `pricing_snapshot` JSON NULL,
  ADD COLUMN `fare_breakdown` JSON NULL,
  ADD COLUMN `driver_cancel_count` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `payments`
  ADD COLUMN `refunded_amount` DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE `ride_location_points` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `ride_id` CHAR(36) NOT NULL,
  `lat` DECIMAL(10,7) NOT NULL,
  `lng` DECIMAL(10,7) NOT NULL,
  `speed` DECIMAL(6,2) NULL,
  `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ride_location_points_ride_id_recorded_at_idx` (`ride_id`, `recorded_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ride_location_points_ride_id_fkey` FOREIGN KEY (`ride_id`) REFERENCES `rides` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `invoices` (
  `id` CHAR(36) NOT NULL,
  `invoice_number` VARCHAR(40) NOT NULL,
  `ride_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL,
  `waiting_fee` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `stop_fee` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `surcharge_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12,2) NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'VND',
  `fare_breakdown` JSON NULL,
  `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `invoices_invoice_number_key` (`invoice_number`),
  UNIQUE INDEX `invoices_ride_id_key` (`ride_id`),
  INDEX `invoices_customer_id_issued_at_idx` (`customer_id`, `issued_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `invoices_ride_id_fkey` FOREIGN KEY (`ride_id`) REFERENCES `rides` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

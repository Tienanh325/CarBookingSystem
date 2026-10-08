-- Add scheduled rides, persisted road geometry and stop charges.
ALTER TABLE `rides`
  MODIFY `status` ENUM(
    'SCHEDULED',
    'REQUESTED',
    'SEARCHING_DRIVER',
    'ACCEPTED',
    'DRIVER_ARRIVING',
    'ARRIVED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED_BY_CUSTOMER',
    'CANCELLED_BY_DRIVER',
    'CANCELLED_BY_SYSTEM',
    'NO_DRIVER_FOUND'
  ) NOT NULL DEFAULT 'REQUESTED',
  ADD COLUMN `stop_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `scheduled_at` DATETIME(3) NULL,
  ADD COLUMN `matching_started_at` DATETIME(3) NULL,
  ADD COLUMN `route_geometry` JSON NULL,
  ADD COLUMN `route_provider` VARCHAR(191) NULL;

CREATE TABLE `ride_stops` (
  `id` CHAR(36) NOT NULL,
  `ride_id` CHAR(36) NOT NULL,
  `order_index` INTEGER NOT NULL,
  `address` VARCHAR(191) NOT NULL,
  `lat` DECIMAL(10, 7) NOT NULL,
  `lng` DECIMAL(10, 7) NOT NULL,
  `dwell_minutes` INTEGER NOT NULL DEFAULT 5,
  `fee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ride_stops_ride_id_order_index_key`(`ride_id`, `order_index`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `driver_offers` (
  `id` CHAR(36) NOT NULL,
  `ride_id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NOT NULL,
  `radius_km` DECIMAL(5, 2) NOT NULL,
  `pickup_distance_km` DECIMAL(8, 2) NOT NULL,
  `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `expires_at` DATETIME(3) NOT NULL,
  `responded_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `driver_offers_ride_id_driver_id_key`(`ride_id`, `driver_id`),
  INDEX `driver_offers_driver_id_status_expires_at_idx`(`driver_id`, `status`, `expires_at`),
  INDEX `driver_offers_ride_id_status_idx`(`ride_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ride_stops`
  ADD CONSTRAINT `ride_stops_ride_id_fkey`
  FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `driver_offers`
  ADD CONSTRAINT `driver_offers_ride_id_fkey`
  FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `driver_offers`
  ADD CONSTRAINT `driver_offers_driver_id_fkey`
  FOREIGN KEY (`driver_id`) REFERENCES `driver_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment methods and financial snapshots on rides.
ALTER TABLE `rides`
  MODIFY `payment_method` ENUM('CASH', 'CARD', 'WALLET', 'VIETQR') NOT NULL DEFAULT 'CASH',
  ADD COLUMN `surcharge_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `surcharge_breakdown` JSON NULL,
  ADD COLUMN `commission_rate` DECIMAL(5,4) NOT NULL DEFAULT 0.2000;

ALTER TABLE `payments`
  MODIFY `method` ENUM('CASH', 'CARD', 'WALLET', 'VIETQR') NOT NULL,
  ADD COLUMN `payment_reference` VARCHAR(50) NULL,
  ADD COLUMN `expires_at` DATETIME(3) NULL,
  ADD UNIQUE INDEX `payments_payment_reference_key` (`payment_reference`);

ALTER TABLE `wallet_transactions`
  MODIFY `type` ENUM('RIDE_EARNING', 'COMMISSION', 'CASH_COLLECTION', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT') NOT NULL;

CREATE TABLE `customer_wallets` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `balance` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'VND',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `customer_wallets_user_id_key` (`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `customer_wallets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `wallet_top_ups` (
  `id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_reference` VARCHAR(50) NOT NULL,
  `provider_transaction_id` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  `paid_at` DATETIME(3) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `wallet_top_ups_payment_reference_key` (`payment_reference`),
  INDEX `wallet_top_ups_customer_id_created_at_idx` (`customer_id`, `created_at`),
  INDEX `wallet_top_ups_status_expires_at_idx` (`status`, `expires_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `wallet_top_ups_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_wallet_transactions` (
  `id` CHAR(36) NOT NULL,
  `wallet_id` CHAR(36) NOT NULL,
  `ride_id` CHAR(36) NULL,
  `top_up_id` CHAR(36) NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `type` ENUM('TOP_UP', 'RIDE_PAYMENT', 'REFUND', 'ADJUSTMENT') NOT NULL,
  `status` ENUM('PENDING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'COMPLETED',
  `description` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `customer_wallet_transactions_wallet_id_created_at_idx` (`wallet_id`, `created_at`),
  INDEX `customer_wallet_transactions_ride_id_idx` (`ride_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `customer_wallet_transactions_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `customer_wallets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `customer_wallet_transactions_top_up_id_fkey` FOREIGN KEY (`top_up_id`) REFERENCES `wallet_top_ups` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payment_webhook_events` (
  `id` CHAR(36) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `provider_transaction_id` VARCHAR(191) NOT NULL,
  `payment_reference` VARCHAR(50) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `payment_webhook_events_provider_transaction_id_key` (`provider_transaction_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `withdrawal_requests` (
  `id` CHAR(36) NOT NULL,
  `driver_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `bank_code` VARCHAR(30) NOT NULL,
  `account_number` VARCHAR(50) NOT NULL,
  `account_name` VARCHAR(150) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `rejection_reason` VARCHAR(191) NULL,
  `reviewed_by_id` CHAR(36) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `withdrawal_requests_driver_id_status_created_at_idx` (`driver_id`, `status`, `created_at`),
  INDEX `withdrawal_requests_status_created_at_idx` (`status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `withdrawal_requests_driver_id_fkey` FOREIGN KEY (`driver_id`) REFERENCES `driver_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `surcharge_rules` (
  `id` CHAR(36) NOT NULL,
  `vehicle_type_id` CHAR(36) NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('PEAK_HOUR', 'LATE_NIGHT', 'WEATHER', 'CUSTOM') NOT NULL,
  `multiplier` DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  `fixed_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `start_minute` INTEGER NULL,
  `end_minute` INTEGER NULL,
  `days_of_week` VARCHAR(20) NULL,
  `weather_conditions` VARCHAR(100) NULL,
  `active_from` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `active_to` DATETIME(3) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `surcharge_rules_vehicle_type_id_is_active_idx` (`vehicle_type_id`, `is_active`),
  INDEX `surcharge_rules_type_is_active_idx` (`type`, `is_active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `surcharge_rules_vehicle_type_id_fkey` FOREIGN KEY (`vehicle_type_id`) REFERENCES `vehicle_types` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pricing_contexts` (
  `id` VARCHAR(20) NOT NULL DEFAULT 'GLOBAL',
  `weather_condition` ENUM('NORMAL', 'RAIN', 'HEAVY_RAIN', 'FLOOD') NOT NULL DEFAULT 'NORMAL',
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `pricing_contexts` (`id`, `weather_condition`, `updated_at`)
VALUES ('GLOBAL', 'NORMAL', CURRENT_TIMESTAMP(3));

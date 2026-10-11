ALTER TABLE `payments`
  MODIFY `status` ENUM('PENDING', 'AUTHORIZED', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'VOIDED', 'REFUND_PENDING', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `authorized_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `captured_amount` DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE `wallet_top_ups`
  MODIFY `status` ENUM('PENDING', 'AUTHORIZED', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'VOIDED', 'REFUND_PENDING', 'REFUNDED') NOT NULL DEFAULT 'PENDING';

UPDATE `payments`
SET `captured_amount` = `amount`
WHERE `status` IN ('PAID', 'REFUND_PENDING', 'REFUNDED');

ALTER TABLE `customer_wallets`
  CHANGE COLUMN `balance` `available_balance` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `held_balance` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `pending_settlement` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `platform_receivable` DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE `driver_wallets`
  CHANGE COLUMN `balance` `available_balance` DECIMAL(12,2) NOT NULL DEFAULT 0,
  CHANGE COLUMN `pending_balance` `held_balance` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `pending_settlement` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `platform_receivable` DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE `customer_wallet_transactions`
  MODIFY `type` ENUM('TOP_UP', 'HOLD', 'CAPTURE', 'RELEASE', 'RIDE_PAYMENT', 'SETTLEMENT', 'RECEIVABLE', 'REFUND', 'ADJUSTMENT') NOT NULL,
  ADD COLUMN `available_delta` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `held_delta` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `pending_settlement_delta` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `platform_receivable_delta` DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE `customer_wallet_transactions`
SET `available_delta` = `amount`;

ALTER TABLE `wallet_transactions`
  MODIFY `type` ENUM('RIDE_EARNING', 'COMMISSION', 'CASH_COLLECTION', 'HOLD', 'CAPTURE', 'RELEASE', 'SETTLEMENT', 'RECEIVABLE', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT') NOT NULL,
  ADD COLUMN `available_delta` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `held_delta` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `pending_settlement_delta` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `platform_receivable_delta` DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE `wallet_transactions`
SET `available_delta` = `amount`;

ALTER TABLE `payment_webhook_events`
  ADD COLUMN `expected_amount` DECIMAL(12,2) NULL,
  ADD COLUMN `classification` ENUM('EXACT', 'UNDERPAID', 'OVERPAID', 'REFERENCE_NOT_FOUND', 'DUPLICATE', 'EXPIRED') NOT NULL DEFAULT 'EXACT',
  ADD COLUMN `reconciliation_status` ENUM('MATCHED', 'REVIEW_REQUIRED', 'RESOLVED', 'IGNORED') NOT NULL DEFAULT 'MATCHED',
  ADD COLUMN `source` ENUM('WEBHOOK', 'PROVIDER_POLL') NOT NULL DEFAULT 'WEBHOOK',
  ADD COLUMN `target_type` VARCHAR(30) NULL,
  ADD COLUMN `target_id` CHAR(36) NULL,
  ADD COLUMN `paid_at` DATETIME(3) NULL,
  ADD COLUMN `expires_at` DATETIME(3) NULL,
  ADD COLUMN `duplicate_count` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `last_received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `reconciled_at` DATETIME(3) NULL,
  ADD COLUMN `resolution_note` VARCHAR(191) NULL,
  ADD INDEX `pwe_class_status_created_idx` (`classification`, `reconciliation_status`, `created_at`),
  ADD INDEX `payment_webhook_events_payment_reference_idx` (`payment_reference`);

CREATE TABLE `refund_requests` (
  `id` CHAR(36) NOT NULL,
  `payment_id` CHAR(36) NOT NULL,
  `ride_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `requested_by_id` CHAR(36) NOT NULL,
  `reviewed_by_id` CHAR(36) NULL,
  `rejection_reason` VARCHAR(191) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `refund_requests_status_created_at_idx` (`status`, `created_at`),
  INDEX `refund_requests_customer_id_created_at_idx` (`customer_id`, `created_at`),
  INDEX `refund_requests_payment_id_status_idx` (`payment_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `refund_requests_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reconciliation_runs` (
  `id` CHAR(36) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `status` ENUM('RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'RUNNING',
  `window_from` DATETIME(3) NOT NULL,
  `window_to` DATETIME(3) NOT NULL,
  `fetched_count` INTEGER NOT NULL DEFAULT 0,
  `exact_count` INTEGER NOT NULL DEFAULT 0,
  `exception_count` INTEGER NOT NULL DEFAULT 0,
  `duplicate_count` INTEGER NOT NULL DEFAULT 0,
  `error_message` VARCHAR(191) NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finished_at` DATETIME(3) NULL,
  INDEX `reconciliation_runs_provider_started_at_idx` (`provider`, `started_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

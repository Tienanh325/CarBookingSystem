CREATE TABLE `ticket_messages` (
  `id` CHAR(36) NOT NULL,
  `ticket_id` CHAR(36) NOT NULL,
  `sender_id` CHAR(36) NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ticket_messages_ticket_id_created_at_idx` (`ticket_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `emergency_contacts` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `relationship` VARCHAR(80) NULL,
  `phone` VARCHAR(20) NOT NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `emergency_contacts_user_id_is_primary_idx` (`user_id`, `is_primary`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sos_alerts` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `ride_id` CHAR(36) NULL,
  `status` ENUM('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'ACTIVE',
  `lat` DECIMAL(10, 7) NULL,
  `lng` DECIMAL(10, 7) NULL,
  `message` VARCHAR(500) NULL,
  `resolved_by_id` CHAR(36) NULL,
  `resolved_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `sos_alerts_status_created_at_idx` (`status`, `created_at`),
  INDEX `sos_alerts_user_id_created_at_idx` (`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ride_share_links` (
  `id` CHAR(36) NOT NULL,
  `ride_id` CHAR(36) NOT NULL,
  `created_by_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ride_share_links_token_hash_key` (`token_hash`),
  INDEX `ride_share_links_ride_id_expires_at_idx` (`ride_id`, `expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ride_messages` (
  `id` CHAR(36) NOT NULL,
  `ride_id` CHAR(36) NOT NULL,
  `sender_id` CHAR(36) NOT NULL,
  `body` VARCHAR(1000) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ride_messages_ride_id_created_at_idx` (`ride_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `emergency_contacts` ADD CONSTRAINT `emergency_contacts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sos_alerts` ADD CONSTRAINT `sos_alerts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sos_alerts` ADD CONSTRAINT `sos_alerts_ride_id_fkey` FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sos_alerts` ADD CONSTRAINT `sos_alerts_resolved_by_id_fkey` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ride_share_links` ADD CONSTRAINT `ride_share_links_ride_id_fkey` FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ride_share_links` ADD CONSTRAINT `ride_share_links_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ride_messages` ADD CONSTRAINT `ride_messages_ride_id_fkey` FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ride_messages` ADD CONSTRAINT `ride_messages_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Before the ledger migration, driver_wallets.balance included amounts reserved in
-- pending_balance. After renaming pending_balance to held_balance, remove that
-- reservation from available_balance and preserve the movement in the ledger.
INSERT INTO `wallet_transactions` (
  `id`,
  `wallet_id`,
  `ride_id`,
  `amount`,
  `available_delta`,
  `held_delta`,
  `pending_settlement_delta`,
  `platform_receivable_delta`,
  `type`,
  `status`,
  `description`,
  `created_at`
)
SELECT
  UUID(),
  `id`,
  NULL,
  0,
  -`held_balance`,
  `held_balance`,
  0,
  0,
  'HOLD',
  'COMPLETED',
  'Migrated legacy withdrawal reservation',
  CURRENT_TIMESTAMP(3)
FROM `driver_wallets`
WHERE `held_balance` > 0;

UPDATE `driver_wallets`
SET `available_balance` = `available_balance` - `held_balance`
WHERE `held_balance` > 0;

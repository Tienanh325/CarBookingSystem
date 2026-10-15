INSERT IGNORE INTO `permissions` (`id`, `key`, `label`, `created_at`) VALUES
  (UUID(), 'dashboard.view', 'Xem dashboard', CURRENT_TIMESTAMP(3)),
  (UUID(), 'rides.view', 'Xem chuyến', CURRENT_TIMESTAMP(3)),
  (UUID(), 'rides.manage', 'Quản lý chuyến', CURRENT_TIMESTAMP(3)),
  (UUID(), 'drivers.view', 'Xem tài xế', CURRENT_TIMESTAMP(3)),
  (UUID(), 'drivers.review', 'Duyệt tài xế', CURRENT_TIMESTAMP(3)),
  (UUID(), 'documents.view', 'Xem tài liệu', CURRENT_TIMESTAMP(3)),
  (UUID(), 'documents.review', 'Duyệt tài liệu', CURRENT_TIMESTAMP(3)),
  (UUID(), 'vehicles.view', 'Xem phương tiện', CURRENT_TIMESTAMP(3)),
  (UUID(), 'vehicles.review', 'Duyệt phương tiện', CURRENT_TIMESTAMP(3)),
  (UUID(), 'finance.view', 'Xem tài chính', CURRENT_TIMESTAMP(3)),
  (UUID(), 'finance.manage', 'Quản lý tài chính', CURRENT_TIMESTAMP(3)),
  (UUID(), 'support.manage', 'Xử lý hỗ trợ', CURRENT_TIMESTAMP(3)),
  (UUID(), 'safety.manage', 'Xử lý SOS', CURRENT_TIMESTAMP(3)),
  (UUID(), 'users.view', 'Xem người dùng', CURRENT_TIMESTAMP(3)),
  (UUID(), 'users.manage', 'Quản lý người dùng', CURRENT_TIMESTAMP(3)),
  (UUID(), 'pricing.manage', 'Quản lý giá và khuyến mãi', CURRENT_TIMESTAMP(3)),
  (UUID(), 'access.manage', 'Quản lý phân quyền', CURRENT_TIMESTAMP(3)),
  (UUID(), 'audit.view', 'Xem audit log', CURRENT_TIMESTAMP(3));

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON (
  r.name = 'ADMIN'
  OR (r.name = 'OPERATOR' AND p.key IN ('dashboard.view', 'rides.view', 'rides.manage', 'drivers.view', 'documents.view', 'vehicles.view', 'safety.manage'))
  OR (r.name = 'SUPPORT' AND p.key IN ('rides.view', 'support.manage', 'safety.manage', 'users.view', 'audit.view'))
  OR (r.name = 'ACCOUNTANT' AND p.key IN ('dashboard.view', 'rides.view', 'finance.view', 'finance.manage', 'audit.view'))
);

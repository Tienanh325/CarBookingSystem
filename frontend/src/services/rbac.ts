export type AdminSection =
  | "overview"
  | "rides"
  | "drivers"
  | "pricing"
  | "surcharges"
  | "promotions"
  | "users"
  | "payments"
  | "withdrawals"
  | "refunds"
  | "reconciliation"
  | "reports"
  | "safety"
  | "support"
  | "documents"
  | "vehicles"
  | "access"
  | "audit";

export type AdminAction = "cancelRide" | "manageDrivers" | "manageUsers" | "manageSurchargeRules";

export const OPERATIONS_ROLES = ["ADMIN", "OPERATOR", "SUPPORT", "ACCOUNTANT"] as const;

const sectionRoles: Record<AdminSection, readonly string[]> = {
  overview: ["ADMIN", "OPERATOR", "ACCOUNTANT"],
  rides: ["ADMIN", "OPERATOR", "SUPPORT", "ACCOUNTANT"],
  drivers: ["ADMIN", "OPERATOR"],
  pricing: ["ADMIN"],
  surcharges: ["ADMIN", "OPERATOR"],
  promotions: ["ADMIN"],
  users: ["ADMIN", "SUPPORT"],
  payments: ["ADMIN", "ACCOUNTANT"],
  withdrawals: ["ADMIN", "ACCOUNTANT"],
  refunds: ["ADMIN", "ACCOUNTANT"],
  reconciliation: ["ADMIN", "ACCOUNTANT"],
  reports: ["ADMIN", "ACCOUNTANT"],
  safety: ["ADMIN", "OPERATOR", "SUPPORT"],
  support: ["ADMIN", "SUPPORT"],
  documents: ["ADMIN", "OPERATOR"],
  vehicles: ["ADMIN", "OPERATOR"],
  access: ["ADMIN"],
  audit: ["ADMIN", "SUPPORT", "ACCOUNTANT"]
};

const actionRoles: Record<AdminAction, readonly string[]> = {
  cancelRide: ["ADMIN", "OPERATOR"],
  manageDrivers: ["ADMIN"],
  manageUsers: ["ADMIN"],
  manageSurchargeRules: ["ADMIN"]
};

const sectionPermissions: Record<AdminSection, string> = {
  overview: "dashboard.view",
  rides: "rides.view",
  drivers: "drivers.view",
  pricing: "pricing.manage",
  surcharges: "pricing.manage",
  promotions: "pricing.manage",
  users: "users.view",
  payments: "finance.view",
  withdrawals: "finance.view",
  refunds: "finance.view",
  reconciliation: "finance.view",
  reports: "finance.view",
  safety: "safety.manage",
  support: "support.manage",
  documents: "documents.view",
  vehicles: "vehicles.view",
  access: "access.manage",
  audit: "audit.view"
};

const actionPermissions: Record<AdminAction, string> = {
  cancelRide: "rides.manage",
  manageDrivers: "drivers.review",
  manageUsers: "users.manage",
  manageSurchargeRules: "pricing.manage"
};

export function hasAnyRole(roles: readonly string[], permitted: readonly string[]) {
  return permitted.some((role) => roles.includes(role));
}

export function hasPermission(permissions: readonly string[] | undefined, permission: string) {
  return permissions?.includes(permission) ?? false;
}

export function canAccessOperationsPortal(roles: readonly string[], permissions?: readonly string[]) {
  if (permissions !== undefined) return Object.values(sectionPermissions).some((key) => permissions.includes(key));
  return hasAnyRole(roles, OPERATIONS_ROLES);
}

export function canAccessAdminSection(
  roles: readonly string[],
  section: AdminSection,
  permissions?: readonly string[]
) {
  if (permissions !== undefined) return permissions.includes(sectionPermissions[section]);
  return hasAnyRole(roles, sectionRoles[section]);
}

export function canPerformAdminAction(
  roles: readonly string[],
  action: AdminAction,
  permissions?: readonly string[]
) {
  if (permissions !== undefined) return permissions.includes(actionPermissions[action]);
  return hasAnyRole(roles, actionRoles[action]);
}

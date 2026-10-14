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
  | "reports";

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
  reports: ["ADMIN", "ACCOUNTANT"]
};

const actionRoles: Record<AdminAction, readonly string[]> = {
  cancelRide: ["ADMIN", "OPERATOR"],
  manageDrivers: ["ADMIN"],
  manageUsers: ["ADMIN"],
  manageSurchargeRules: ["ADMIN"]
};

export function hasAnyRole(roles: readonly string[], permitted: readonly string[]) {
  return permitted.some((role) => roles.includes(role));
}

export function canAccessOperationsPortal(roles: readonly string[]) {
  return hasAnyRole(roles, OPERATIONS_ROLES);
}

export function canAccessAdminSection(roles: readonly string[], section: AdminSection) {
  return hasAnyRole(roles, sectionRoles[section]);
}

export function canPerformAdminAction(roles: readonly string[], action: AdminAction) {
  return hasAnyRole(roles, actionRoles[action]);
}

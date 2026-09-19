export const ROLES = {
  CUSTOMER: "CUSTOMER",
  DRIVER: "DRIVER",
  ADMIN: "ADMIN",
  OPERATOR: "OPERATOR",
  SUPPORT: "SUPPORT",
  ACCOUNTANT: "ACCOUNTANT"
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

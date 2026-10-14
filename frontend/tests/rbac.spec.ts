import { expect, test } from "@playwright/test";
import {
  canAccessAdminSection,
  canAccessOperationsPortal,
  canPerformAdminAction,
  type AdminSection
} from "../src/services/rbac";

const sections: AdminSection[] = [
  "overview",
  "rides",
  "drivers",
  "pricing",
  "surcharges",
  "promotions",
  "users",
  "payments",
  "withdrawals",
  "refunds",
  "reconciliation",
  "reports",
  "safety",
  "support"
];

const expectedSections: Record<string, AdminSection[]> = {
  ADMIN: sections,
  OPERATOR: ["overview", "rides", "drivers", "surcharges", "safety"],
  SUPPORT: ["rides", "users", "safety", "support"],
  ACCOUNTANT: ["overview", "rides", "payments", "withdrawals", "refunds", "reconciliation", "reports"]
};

for (const [role, expected] of Object.entries(expectedSections)) {
  test(`${role} sees only sections backed by its API permissions`, () => {
    expect(canAccessOperationsPortal([role])).toBe(true);
    expect(sections.filter((section) => canAccessAdminSection([role], section))).toEqual(expected);
  });
}

test("customer and driver roles do not unlock the operations portal", () => {
  expect(canAccessOperationsPortal(["CUSTOMER"])).toBe(false);
  expect(canAccessOperationsPortal(["DRIVER"])).toBe(false);
});

test("privileged controls match backend mutation permissions", () => {
  expect(canPerformAdminAction(["ADMIN"], "cancelRide")).toBe(true);
  expect(canPerformAdminAction(["OPERATOR"], "cancelRide")).toBe(true);
  expect(canPerformAdminAction(["SUPPORT"], "cancelRide")).toBe(false);
  expect(canPerformAdminAction(["ACCOUNTANT"], "cancelRide")).toBe(false);

  for (const action of ["manageDrivers", "manageUsers", "manageSurchargeRules"] as const) {
    expect(canPerformAdminAction(["ADMIN"], action)).toBe(true);
    expect(canPerformAdminAction(["OPERATOR", "SUPPORT", "ACCOUNTANT"], action)).toBe(false);
  }
});

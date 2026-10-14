import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadOpenApiDocument, openApiDocument } from "../src/openapi";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
const PUBLIC_OPERATIONS = new Set([
  "GET /api/vehicle-types",
  "POST /api/auth/register",
  "POST /api/auth/login",
  "POST /api/auth/send-otp",
  "POST /api/auth/verify-otp",
  "POST /api/auth/refresh-token",
  "POST /api/payments/vietqr/ipn"
]);

type RouteSource = {
  file: string;
  prefix: string;
  router: string;
};

const ROUTE_SOURCES: RouteSource[] = [
  { file: "src/routes/index.ts", prefix: "/api", router: "apiRouter" },
  { file: "src/modules/auth/auth.routes.ts", prefix: "/api/auth", router: "authRouter" },
  { file: "src/modules/customers/customer.routes.ts", prefix: "/api/customers", router: "customerRouter" },
  { file: "src/modules/drivers/driver.routes.ts", prefix: "/api/drivers", router: "driverRouter" },
  { file: "src/modules/rides/ride.routes.ts", prefix: "/api/rides", router: "rideRouter" },
  { file: "src/modules/maps/map.routes.ts", prefix: "/api/maps", router: "mapRouter" },
  { file: "src/modules/payments/payment.routes.ts", prefix: "/api/payments", router: "paymentRouter" },
  { file: "src/modules/admin/admin.routes.ts", prefix: "/api/admin", router: "adminRouter" },
  {
    file: "src/modules/pricing/pricing.routes.ts",
    prefix: "/api/admin/pricing-rules",
    router: "pricingRouter"
  },
  {
    file: "src/modules/pricing/surcharge.routes.ts",
    prefix: "/api/admin/surcharges",
    router: "surchargeRouter"
  },
  {
    file: "src/modules/promotions/promotion.routes.ts",
    prefix: "/api/promotions",
    router: "promotionRouter"
  }
];

function normalizeExpressPath(prefix: string, routePath: string) {
  const path = routePath === "/" ? prefix : `${prefix}${routePath}`;
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function mountedExpressOperations() {
  const operations = new Set<string>();

  for (const source of ROUTE_SOURCES) {
    const text = readFileSync(resolve(process.cwd(), source.file), "utf8");
    const matcher = new RegExp(
      `\\b${source.router}\\.(get|post|put|patch|delete)\\(\\s*["'\\x60]([^"'\\x60]+)["'\\x60]`,
      "g"
    );
    for (const match of text.matchAll(matcher)) {
      operations.add(`${match[1].toUpperCase()} ${normalizeExpressPath(source.prefix, match[2])}`);
    }
  }

  return operations;
}

function documentedOperations(document: any) {
  const operations = new Map<string, any>();

  for (const [path, pathItem] of Object.entries<any>(document.paths)) {
    for (const [method, operation] of Object.entries<any>(pathItem)) {
      if (HTTP_METHODS.has(method)) operations.set(`${method.toUpperCase()} ${path}`, operation);
    }
  }

  return operations;
}

function resolveLocalRef(document: any, ref: string) {
  expect(ref).toMatch(/^#\//);
  return ref
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, key) => value?.[key], document);
}

function collectRefs(value: unknown, refs: string[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, refs);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "$ref" && typeof item === "string") refs.push(item);
      else collectRefs(item, refs);
    }
  }
  return refs;
}

describe("OpenAPI contract", () => {
  it("loads from both the backend directory and repository root", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
    expect(loadOpenApiDocument(resolve(process.cwd(), ".."))).toEqual(openApiDocument);
  });

  it("documents every mounted /api operation without orphaned operations", () => {
    const actual = mountedExpressOperations();
    const documented = new Set(documentedOperations(openApiDocument).keys());

    expect(actual.size).toBe(79);
    expect(documented.size).toBe(79);
    expect([...actual].filter((operation) => !documented.has(operation))).toEqual([]);
    expect([...documented].filter((operation) => !actual.has(operation))).toEqual([]);
  });

  it("provides unique operation IDs, response contracts, and valid local references", () => {
    const operations = documentedOperations(openApiDocument);
    const operationIds = [...operations.values()].map((operation) => operation.operationId);

    expect(operationIds.every((operationId) => typeof operationId === "string" && operationId.length > 0)).toBe(
      true
    );
    expect(new Set(operationIds).size).toBe(operationIds.length);
    for (const [key, operation] of operations) {
      expect(operation.summary).toEqual(expect.any(String));
      expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
      expect(operation.security).toEqual(PUBLIC_OPERATIONS.has(key) ? [] : [{ bearerAuth: [] }]);
    }
    for (const ref of collectRefs(openApiDocument)) {
      expect(resolveLocalRef(openApiDocument, ref), `unresolved OpenAPI reference ${ref}`).toBeDefined();
    }
  });

  it("publishes the gross, refund, net, daily, payment access, and CSV contracts", () => {
    const schemas = openApiDocument.components.schemas;
    expect(schemas.FinancialTotals.required).toEqual(["grossRevenue", "refundedRevenue", "netRevenue"]);
    expect(schemas.Dashboard.allOf[1].properties.dailyFinancials.items.$ref).toBe(
      "#/components/schemas/DailyFinancial"
    );
    expect(schemas.Payment.properties.vietQr.oneOf[0].$ref).toBe("#/components/schemas/VietQrDetails");
    expect(schemas.VietQrDetails.required).toContain("reference");

    const paymentDescription = openApiDocument.paths["/api/payments/rides/{id}"].get.description;
    expect(paymentDescription).toContain("ADMIN");
    expect(paymentDescription).toContain("Customers are restricted to their own rides");

    const csvDescription = openApiDocument.paths["/api/admin/reports/finance.csv"].get.description;
    for (const metric of ["GROSS_REVENUE", "REFUNDED_REVENUE", "NET_REVENUE"]) {
      expect(csvDescription).toContain(metric);
    }
  });
});

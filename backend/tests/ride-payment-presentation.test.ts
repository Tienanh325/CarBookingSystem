import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { prisma } from "../src/config/prisma";
import { decoratePaymentWithVietQr } from "../src/modules/payments/payment.service";
import { getCurrentRide, getRideById, listRides } from "../src/modules/rides/ride.service";

vi.mock("../src/config/prisma", () => ({
  prisma: {
    ride: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

const customerId = "customer-1";
const payment = {
  method: "VIETQR",
  paymentReference: "RIDE123",
  expiresAt: new Date("2026-10-15T10:15:00.000Z"),
  amount: 125_000
};

function rideFixture() {
  return {
    id: "ride-1",
    customerId,
    driver: null,
    payment: { ...payment }
  };
}

function expectDecoratedPayment(ride: unknown) {
  expect(ride).toMatchObject({
    payment: {
      method: "VIETQR",
      paymentReference: "RIDE123",
      vietQr: {
        provider: "VIETQR",
        reference: "RIDE123",
        amount: 125_000,
        expiresAt: payment.expiresAt
      }
    }
  });
  expect((ride as { payment: { vietQr: { qrUrl: string } } }).payment.vietQr.qrUrl).toContain(
    "addInfo=RIDE123"
  );
}

describe("ride payment presentation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restores VietQR details when the current ride is reloaded", async () => {
    (prisma.ride.findFirst as Mock).mockResolvedValue(rideFixture());

    expectDecoratedPayment(await getCurrentRide(customerId, ["CUSTOMER"]));
  });

  it("decorates VietQR details in ride history", async () => {
    (prisma.ride.findMany as Mock).mockResolvedValue([rideFixture()]);

    const rides = await listRides(customerId, ["CUSTOMER"]);

    expectDecoratedPayment(rides[0]);
  });

  it("decorates VietQR details in an individual ride response", async () => {
    (prisma.ride.findUnique as Mock).mockResolvedValue(rideFixture());

    expectDecoratedPayment(await getRideById("ride-1", customerId, ["CUSTOMER"]));
  });

  it("preserves non-VietQR payments without generating transfer details", () => {
    expect(
      decoratePaymentWithVietQr({
        ...payment,
        method: "CASH"
      })
    ).toMatchObject({ method: "CASH", amount: 125_000, vietQr: null });
  });
});

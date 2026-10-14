import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { prisma } from "../src/config/prisma";
import { getRidePayment } from "../src/modules/payments/payment.service";

vi.mock("../src/config/prisma", () => ({
  prisma: {
    payment: {
      findFirst: vi.fn()
    }
  }
}));

const rideId = "ride-1";
const payment = {
  id: "payment-1",
  rideId,
  method: "VIETQR" as const,
  paymentReference: "RIDE123",
  amount: 125_000,
  expiresAt: new Date("2026-10-15T10:15:00.000Z"),
  ride: { id: rideId, status: "COMPLETED", paymentMethod: "VIETQR" },
  refundRequests: []
};

describe("ride payment access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows an admin to retrieve a payment for any customer ride", async () => {
    (prisma.payment.findFirst as Mock).mockResolvedValue(payment);

    const result = await getRidePayment("admin-1", rideId, ["ADMIN"]);

    expect(prisma.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { rideId } }));
    expect(result).toMatchObject({
      id: "payment-1",
      vietQr: { provider: "VIETQR", reference: "RIDE123", amount: 125_000 }
    });
  });

  it("allows a customer to retrieve their own ride payment", async () => {
    (prisma.payment.findFirst as Mock).mockResolvedValue(payment);

    await getRidePayment("customer-1", rideId, ["CUSTOMER"]);

    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rideId, ride: { customerId: "customer-1" } }
      })
    );
  });

  it("denies cross-customer access without revealing whether the payment exists", async () => {
    (prisma.payment.findFirst as Mock).mockResolvedValue(null);

    await expect(getRidePayment("customer-2", rideId, ["CUSTOMER"])).rejects.toMatchObject({
      statusCode: 404,
      code: "PAYMENT_NOT_FOUND"
    });
    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rideId, ride: { customerId: "customer-2" } }
      })
    );
  });
});

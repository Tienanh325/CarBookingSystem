import { RideStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notifyRideMock, prismaMock, refundCustomerWalletRideMock, txMock } = vi.hoisted(() => {
  const tx = {
    auditLog: { create: vi.fn() },
    driverOffer: { updateMany: vi.fn() },
    driverProfile: { update: vi.fn() },
    promotionUsage: { deleteMany: vi.fn() },
    ride: { update: vi.fn(), updateMany: vi.fn() },
    rideStatusLog: { create: vi.fn() }
  };

  return {
    notifyRideMock: vi.fn(),
    prismaMock: {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
      ride: { findUnique: vi.fn() }
    },
    refundCustomerWalletRideMock: vi.fn(),
    txMock: tx
  };
});

vi.mock("../src/config/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/realtime/socket", () => ({ notifyRide: notifyRideMock }));
vi.mock("../src/modules/wallets/wallet.service", () => ({
  refundCustomerWalletRide: refundCustomerWalletRideMock
}));

import { cancelRide } from "../src/modules/admin/admin.service";

const rideId = "ride-scheduled";
const actorId = "admin-user";
const reason = "Khong the phuc vu chuyen da dat lich";

describe("admin scheduled ride cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.ride.findUnique.mockResolvedValue({
      id: rideId,
      status: RideStatus.SCHEDULED,
      driverId: null
    });
    txMock.ride.updateMany.mockResolvedValue({ count: 1 });
    txMock.ride.update.mockResolvedValue({
      id: rideId,
      status: RideStatus.CANCELLED_BY_SYSTEM,
      driverId: null
    });
  });

  it("cancels a scheduled ride and releases all related financial and promotion state", async () => {
    const result = await cancelRide(rideId, reason, actorId);

    expect(txMock.ride.updateMany).toHaveBeenCalledWith({
      where: {
        id: rideId,
        status: {
          in: ["SCHEDULED", "SEARCHING_DRIVER", "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED"]
        }
      },
      data: { status: RideStatus.CANCELLED_BY_SYSTEM }
    });
    expect(txMock.ride.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: rideId },
        data: expect.objectContaining({
          status: RideStatus.CANCELLED_BY_SYSTEM,
          cancelReason: reason,
          cancellationFee: 0,
          finalFare: 0,
          fareBreakdown: { cancellationFee: 0, total: 0 }
        })
      })
    );
    expect(txMock.promotionUsage.deleteMany).toHaveBeenCalledWith({ where: { rideId } });
    expect(refundCustomerWalletRideMock).toHaveBeenCalledWith(txMock, rideId, actorId);
    expect(txMock.driverOffer.updateMany).toHaveBeenCalledWith({
      where: { rideId, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: expect.any(Date) }
    });
    expect(txMock.rideStatusLog.create).toHaveBeenCalledWith({
      data: {
        rideId,
        fromStatus: RideStatus.SCHEDULED,
        toStatus: RideStatus.CANCELLED_BY_SYSTEM,
        changedById: actorId,
        note: reason
      }
    });
    expect(notifyRideMock).toHaveBeenCalledWith(rideId, "ride.cancelled");
    expect(result).toMatchObject({ id: rideId, status: RideStatus.CANCELLED_BY_SYSTEM });
  });

  it.each([
    RideStatus.COMPLETED,
    RideStatus.CANCELLED_BY_CUSTOMER,
    RideStatus.CANCELLED_BY_DRIVER,
    RideStatus.CANCELLED_BY_SYSTEM,
    RideStatus.NO_DRIVER_FOUND
  ])("rejects terminal status %s before opening a transaction", async (status) => {
    prismaMock.ride.findUnique.mockResolvedValue({ id: rideId, status, driverId: null });

    await expect(cancelRide(rideId, reason, actorId)).rejects.toMatchObject({
      statusCode: 409,
      code: "RIDE_INVALID_STATUS"
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("keeps non-cancellable active states protected by the atomic transition", async () => {
    prismaMock.ride.findUnique.mockResolvedValue({
      id: rideId,
      status: RideStatus.IN_PROGRESS,
      driverId: "driver-1"
    });
    txMock.ride.updateMany.mockResolvedValue({ count: 0 });

    await expect(cancelRide(rideId, reason, actorId)).rejects.toMatchObject({
      statusCode: 409,
      code: "RIDE_INVALID_STATUS"
    });
    expect(txMock.ride.update).not.toHaveBeenCalled();
    expect(refundCustomerWalletRideMock).not.toHaveBeenCalled();
    expect(notifyRideMock).not.toHaveBeenCalled();
  });
});

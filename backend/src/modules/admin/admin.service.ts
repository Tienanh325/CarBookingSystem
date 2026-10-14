import {
  DriverOnlineStatus,
  DriverVerificationStatus,
  PaymentStatus,
  RideStatus,
  VehicleRegistrationStatus
} from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { notifyRide } from "../../realtime/socket";
import { refundCustomerWalletRide } from "../wallets/wallet.service";

type ListQuery = {
  search?: string;
  status?: string;
  page: number;
  limit: number;
};

function pagination(query: ListQuery) {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit
  };
}

export async function dashboard() {
  const recognizedStatuses = [
    PaymentStatus.PAID,
    PaymentStatus.PARTIALLY_PAID,
    PaymentStatus.REFUND_PENDING,
    PaymentStatus.REFUNDED
  ];
  const [totalUsers, totalDrivers, onlineDrivers, activeRides, completedRides, cancelledRides, paidPayments] =
    await Promise.all([
      prisma.user.count(),
      prisma.driverProfile.count(),
      prisma.driverProfile.count({ where: { onlineStatus: DriverOnlineStatus.ONLINE } }),
      prisma.ride.count({
        where: {
          status: {
            in: [
              RideStatus.SEARCHING_DRIVER,
              RideStatus.ACCEPTED,
              RideStatus.DRIVER_ARRIVING,
              RideStatus.ARRIVED,
              RideStatus.IN_PROGRESS
            ]
          }
        }
      }),
      prisma.ride.count({ where: { status: RideStatus.COMPLETED } }),
      prisma.ride.count({
        where: {
          status: {
            in: [
              RideStatus.CANCELLED_BY_CUSTOMER,
              RideStatus.CANCELLED_BY_DRIVER,
              RideStatus.CANCELLED_BY_SYSTEM
            ]
          }
        }
      }),
      prisma.payment.aggregate({
        where: { status: { in: recognizedStatuses } },
        _sum: { capturedAmount: true },
        _count: true
      })
    ]);

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 6);
  const recent = await prisma.payment.findMany({
    where: { status: { in: recognizedStatuses }, paidAt: { gte: since } },
    select: { capturedAmount: true, paidAt: true }
  });
  const dailyRevenue = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
    return {
      day,
      revenue: recent
        .filter((p) => p.paidAt?.toISOString().startsWith(day))
        .reduce((sum, p) => sum + Number(p.capturedAmount), 0)
    };
  });
  const statusCounts = await prisma.ride.groupBy({ by: ["status"], _count: true });
  return {
    dailyRevenue,
    statusCounts: statusCounts.map((item) => ({ status: item.status, count: item._count })),
    totalUsers,
    totalDrivers,
    onlineDrivers,
    activeRides,
    completedRides,
    cancelledRides,
    paidTransactions: paidPayments._count,
    revenue: Number(paidPayments._sum.capturedAmount ?? 0)
  };
}

export async function listUsers(query: ListQuery) {
  const where = {
    AND: [
      query.status ? { status: query.status as never } : {},
      query.search
        ? {
            OR: [
              { phone: { contains: query.search } },
              { fullName: { contains: query.search } },
              { email: { contains: query.search } }
            ]
          }
        : {}
    ]
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
      ...pagination(query)
    }),
    prisma.user.count({ where })
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function updateUserStatus(id: string, status: "ACTIVE" | "LOCKED" | "DELETED", actorId: string) {
  const user = await prisma.user.update({
    where: { id },
    data: { status }
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "USER_STATUS_UPDATED",
      entityType: "USER",
      entityId: id,
      metadata: { status }
    }
  });

  return user;
}

export async function listDrivers(query: ListQuery) {
  const where = {
    AND: [
      query.status ? { verificationStatus: query.status as never } : {},
      query.search
        ? {
            user: {
              OR: [{ phone: { contains: query.search } }, { fullName: { contains: query.search } }]
            }
          }
        : {}
    ]
  };

  const [items, total] = await Promise.all([
    prisma.driverProfile.findMany({
      where,
      include: {
        user: true,
        vehicles: { include: { vehicleType: true } },
        wallet: true
      },
      orderBy: { createdAt: "desc" },
      ...pagination(query)
    }),
    prisma.driverProfile.count({ where })
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function getDriver(id: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { id },
    include: {
      user: true,
      vehicles: { include: { vehicleType: true } },
      documents: true,
      wallet: true,
      location: true
    }
  });

  if (!driver) {
    throw new ApiError(404, "DRIVER_NOT_FOUND", "Khong tim thay tai xe");
  }

  return driver;
}

export async function approveDriver(id: string, actorId: string) {
  const driver = await prisma.$transaction(async (tx) => {
    const updated = await tx.driverProfile.update({
      where: { id },
      data: {
        verificationStatus: DriverVerificationStatus.APPROVED,
        approvedAt: new Date()
      },
      include: {
        user: true,
        vehicles: true
      }
    });

    await tx.vehicle.updateMany({
      where: { driverId: id, registrationStatus: VehicleRegistrationStatus.PENDING },
      data: { registrationStatus: VehicleRegistrationStatus.APPROVED }
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: "DRIVER_APPROVED",
        entityType: "DRIVER",
        entityId: id
      }
    });

    return updated;
  });

  return driver;
}

export async function rejectDriver(id: string, reason: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.driverProfile.updateMany({
      where: { id, onlineStatus: { not: DriverOnlineStatus.BUSY } },
      data: {
        verificationStatus: DriverVerificationStatus.REJECTED,
        onlineStatus: DriverOnlineStatus.OFFLINE
      }
    });
    if (!changed.count) {
      const exists = await tx.driverProfile.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new ApiError(404, "DRIVER_NOT_FOUND", "Khong tim thay tai xe");
      throw new ApiError(409, "DRIVER_BUSY", "Khong the tu choi tai xe dang co chuyen");
    }
    const driver = await tx.driverProfile.findUniqueOrThrow({ where: { id } });
    await tx.auditLog.create({
      data: { actorId, action: "DRIVER_REJECTED", entityType: "DRIVER", entityId: id, metadata: { reason } }
    });
    return driver;
  });
}

export async function listRides(query: ListQuery) {
  const where = {
    AND: [
      query.status ? { status: query.status as never } : {},
      query.search
        ? {
            OR: [
              { id: { contains: query.search } },
              { customer: { fullName: { contains: query.search } } },
              { driver: { user: { fullName: { contains: query.search } } } }
            ]
          }
        : {}
    ]
  };

  const [items, total] = await Promise.all([
    prisma.ride.findMany({
      where,
      include: {
        customer: true,
        driver: { include: { user: true } },
        vehicleType: true,
        payment: true
      },
      orderBy: { requestedAt: "desc" },
      ...pagination(query)
    }),
    prisma.ride.count({ where })
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function getRide(id: string) {
  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      customer: true,
      driver: { include: { user: true, vehicles: { include: { vehicleType: true } }, location: true } },
      vehicleType: true,
      payment: true,
      statusLogs: { orderBy: { createdAt: "asc" } },
      rating: true,
      supportTickets: true
    }
  });

  if (!ride) {
    throw new ApiError(404, "RIDE_NOT_FOUND", "Khong tim thay chuyen di");
  }

  return ride;
}

export async function cancelRide(id: string, reason: string, actorId: string) {
  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride) {
    throw new ApiError(404, "RIDE_NOT_FOUND", "Khong tim thay chuyen di");
  }

  const terminalStatuses: RideStatus[] = [
    RideStatus.COMPLETED,
    RideStatus.CANCELLED_BY_CUSTOMER,
    RideStatus.CANCELLED_BY_DRIVER,
    RideStatus.CANCELLED_BY_SYSTEM,
    RideStatus.NO_DRIVER_FOUND
  ];

  if (terminalStatuses.includes(ride.status)) {
    throw new ApiError(409, "RIDE_INVALID_STATUS", "Khong the huy chuyen o trang thai hien tai");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.ride.updateMany({
      where: {
        id,
        status: { in: ["SCHEDULED", "SEARCHING_DRIVER", "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED"] }
      },
      data: { status: RideStatus.CANCELLED_BY_SYSTEM }
    });
    if (!changed.count) throw new ApiError(409, "RIDE_INVALID_STATUS", "Khong the huy chuyen");
    const cancelled = await tx.ride.update({
      where: { id },
      data: {
        status: RideStatus.CANCELLED_BY_SYSTEM,
        cancelledAt: new Date(),
        cancelReason: reason,
        cancellationFee: 0,
        finalFare: 0,
        fareBreakdown: { cancellationFee: 0, total: 0 }
      },
      include: {
        customer: true,
        driver: { include: { user: true } },
        vehicleType: true
      }
    });

    if (cancelled.driverId) {
      await tx.driverProfile.update({
        where: { id: cancelled.driverId },
        data: { onlineStatus: DriverOnlineStatus.ONLINE }
      });
    }

    await tx.rideStatusLog.create({
      data: {
        rideId: id,
        fromStatus: ride.status,
        toStatus: RideStatus.CANCELLED_BY_SYSTEM,
        changedById: actorId,
        note: reason
      }
    });

    await tx.promotionUsage.deleteMany({ where: { rideId: id } });
    await refundCustomerWalletRide(tx, id, actorId);
    await tx.driverOffer.updateMany({
      where: { rideId: id, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: new Date() }
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: "RIDE_CANCELLED_BY_ADMIN",
        entityType: "RIDE",
        entityId: id,
        metadata: { reason }
      }
    });

    return cancelled;
  });

  await notifyRide(id, "ride.cancelled");
  return updated;
}

export async function listPayments(query: ListQuery) {
  const where = {
    AND: [query.status ? { status: query.status as never } : {}]
  };

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        ride: true,
        customer: true
      },
      orderBy: { createdAt: "desc" },
      ...pagination(query)
    }),
    prisma.payment.count({ where })
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function revenueReport() {
  const recognizedStatuses = [
    PaymentStatus.PAID,
    PaymentStatus.PARTIALLY_PAID,
    PaymentStatus.REFUND_PENDING,
    PaymentStatus.REFUNDED
  ];
  const [paid, pending, byMethod, commissions, driverEarnings] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: { in: recognizedStatuses } },
      _sum: { capturedAmount: true },
      _count: true
    }),
    prisma.payment.aggregate({
      where: { status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] } },
      _sum: { amount: true },
      _count: true
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { status: { in: recognizedStatuses } },
      _sum: { capturedAmount: true },
      _count: true
    }),
    prisma.walletTransaction.aggregate({
      where: { type: "COMMISSION", status: "COMPLETED" },
      _sum: { amount: true },
      _count: true
    }),
    prisma.walletTransaction.aggregate({
      where: { type: "RIDE_EARNING", status: "COMPLETED" },
      _sum: { amount: true }
    })
  ]);

  return {
    paid: {
      count: paid._count,
      amount: Number(paid._sum.capturedAmount ?? 0)
    },
    pending: {
      count: pending._count,
      amount: Number(pending._sum.amount ?? 0)
    },
    platformCommission: {
      count: commissions._count,
      amount: Math.abs(Number(commissions._sum.amount ?? 0))
    },
    driverGrossEarnings: Number(driverEarnings._sum.amount ?? 0),
    byMethod: byMethod.map((item) => ({
      method: item.method,
      count: item._count,
      amount: Number(item._sum.capturedAmount ?? 0)
    }))
  };
}
